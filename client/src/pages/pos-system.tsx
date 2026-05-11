import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useOrderWebSocket } from "@/lib/websocket";
import { getSoundEnabled, setSoundEnabled as saveSoundEnabled, testSound, playNotificationSound } from "@/lib/notification-sounds";
import { AudioUnlockBanner } from "@/components/audio-unlock-banner";
import { 
  Coffee, ShoppingBag, Trash2, Plus, Minus, Search, 
  CreditCard, ChevronLeft, ChevronRight, ChevronDown, XCircle, 
  Volume2, VolumeX, ClipboardList, Grid3X3, Tag, PlayCircle,
  Columns2, ArrowRight, Printer, CheckCircle, CheckCircle2, ShoppingCart, 
  Clock, Check, X, AlertTriangle, MessageSquare, 
  Archive, RefreshCw, Wifi, WifiOff, Loader2,
  Navigation, SplitSquareVertical, Banknote,
  Lock, Bell, BellOff, MonitorSmartphone, ScanLine,
  PauseCircle, Receipt, Settings, User, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { queueOfflineOrder, syncOfflineOrders, countPendingOrders } from "@/lib/offline-queue";
import type { CoffeeItem, Order, Table, Employee } from "@shared/schema";
import { 
  printTaxInvoice, 
  buildReceiptPreviewHtml,
  buildEmployeeReceiptPreviewHtml,
  printKitchenOrder,
  fmtOrderNum
} from "@/lib/print-utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import DrinkCustomizationDialog, { type DrinkCustomization } from "@/components/drink-customization-dialog";
import PrinterSettingsPanel from "@/components/printer-settings-panel";
import { loadPrinterSettings } from "@/lib/thermal-printer";

type OrderType = "dine_in" | "takeaway" | "delivery" | "car_pickup";
type PaymentMethod = "cash" | "card" | "qahwa-card" | "split";

const ORDER_TYPES = [
  { id: "dine_in", name: "محلي", nameEn: "Dine-in", icon: Coffee },
  { id: "takeaway", name: "سفري", nameEn: "Takeaway", icon: ShoppingBag },
  { id: "car_pickup", name: "توصيل للسيارة", nameEn: "Car Pickup", icon: Navigation },
  { id: "delivery", name: "توصيل", nameEn: "Delivery", icon: ShoppingBag },
];

const PAYMENT_METHODS = [
  { id: "cash", icon: Banknote, tKey: "pos.payment_cash" },
  { id: "card", icon: CreditCard, tKey: "pos.payment_card" },
  { id: "qahwa-card", icon: Wallet, tKey: "pos.payment_loyalty" },
  { id: "split", icon: SplitSquareVertical, tKey: "pos.payment_split" },
];

export default function PosSystem() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: tc("نقدي","Cash"),
    card: tc("شبكة","Network"),
    "qahwa-card": tc("بطاقة مكان الشيف","مكان الشيف البخاري Card"),
    split: tc("نقدي + شبكة","Cash + Network"),
  };
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const employee = useMemo(() => {
    try {
      const data = localStorage.getItem("currentEmployee");
      return data ? JSON.parse(data) as Employee : null;
    } catch { return null; }
  }, []);
  const { toast } = useToast();
  const { requestPermission: requestPushPermission } = useNotifications({
    userType: 'employee',
    userId: employee?.id?.toString(),
    branchId: employee?.branchId?.toString(),
    autoSubscribe: true,
  });
  
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [customerLookupFound, setCustomerLookupFound] = useState<boolean | null>(null);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [splitViewMode, setSplitViewMode] = useState(false);
  const [mobilePanelView, setMobilePanelView] = useState<'products' | 'cart'>('products');
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundEnabled('pos'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'online' | 'pos'>('all');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptCountdown, setReceiptCountdown] = useState(0);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [lastPrintFailed, setLastPrintFailed] = useState(false);
  const [receiptPreviewHtml, setReceiptPreviewHtml] = useState('');
  const [employeeReceiptPreviewHtml, setEmployeeReceiptPreviewHtml] = useState('');
  const [previewTab, setPreviewTab] = useState<'customer' | 'employee'>('customer');
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [posTerminalConnected, setPosTerminalConnected] = useState(() => {
    return localStorage.getItem("pos-terminal-connected") === "true";
  });
  const [showTablesDialog, setShowTablesDialog] = useState(false);
  const [showOpenBillsDialog, setShowOpenBillsDialog] = useState(false);
  const [selectedTableForBill, setSelectedTableForBill] = useState<any>(null);
  const [billPaymentMethod, setBillPaymentMethod] = useState<PaymentMethod>("cash");
  const [showPOSSettings, setShowPOSSettings] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printerMode] = useState(() => loadPrinterSettings().mode);
  const [autoPrint, setAutoPrint] = useState(() => {
    const stored = localStorage.getItem("pos-auto-print");
    return stored === null ? true : stored === "true"; // default ON
  });
  const [showVatLabel, setShowVatLabel] = useState(() => localStorage.getItem("pos-show-vat-label") === "true");
  const [posCustomizationItem, setPosCustomizationItem] = useState<{ item: CoffeeItem; group: CoffeeItem[] } | null>(null);
  const [showOrderReview, setShowOrderReview] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [carTypeInput, setCarTypeInput] = useState("");
  const [carColorInput, setCarColorInput] = useState("");
  const [carPlateInput, setCarPlateInput] = useState("");
  const [posZoom, setPosZoom] = useState<number>(() => {
    const saved = localStorage.getItem("pos-zoom");
    return saved ? Number(saved) : 100;
  });

  const { isConnected: wsConnected, sendMessage: wsSend } = useOrderWebSocket({
    clientType: "pos",
    branchId: employee?.branchId?.toString(),
    onNewOrder: (order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
      const isOnlineWebOrder = order?.channel === 'online' || order?.channel === 'web';
      const isPosOrder = order?.channel === 'pos';
      // Only show badge and toast for online/web customer orders (not POS orders created by staff)
      if (isOnlineWebOrder) {
        setNewOrdersCount(prev => prev + 1);
        if (soundEnabled) {
          playNotificationSound('onlineOrderVoice', 1.0);
        }
        toast({
          title: t('pos.new_order_toast'),
          description: t('pos.new_order_toast_desc', { number: order?.orderNumber ? fmtOrderNum(order.orderNumber) : '', amount: order?.totalAmount || 0 }),
        });
        // Auto-print online order receipt
        const printerSettings = loadPrinterSettings();
        if (printerSettings.autoPrint && order?.items?.length > 0) {
          const onlineOrderType = order.orderType || 'online';
          const onlineOrderTypeName =
            onlineOrderType === 'dine_in' || onlineOrderType === 'dine-in' ? 'طاولة' :
            onlineOrderType === 'takeaway' || onlineOrderType === 'pickup' ? 'سفري' :
            onlineOrderType === 'delivery' ? 'توصيل' :
            onlineOrderType === 'car_pickup' || onlineOrderType === 'car-pickup' ? 'سيارة' :
            'أونلاين';
          const printData = {
            orderNumber: String(order.orderNumber || order.dailyNumber || order._id?.slice(-4) || '0'),
            customerName: order.customerName || 'عميل أونلاين',
            customerPhone: order.customerPhone || '',
            items: (order.items || []).map((item: any) => ({
              coffeeItem: {
                nameAr: item.coffeeItem?.nameAr || item.nameAr || '',
                nameEn: item.coffeeItem?.nameEn || item.nameEn || '',
                price: String(item.coffeeItem?.price || item.price || 0),
              },
              quantity: item.quantity || 1,
              customization: item.customization,
            })),
            subtotal: String(order.subtotal || (Number(order.totalAmount) / 1.15).toFixed(2)),
            total: String(order.totalAmount || 0),
            paymentMethod: order.paymentMethod || 'أونلاين',
            employeeName: '',
            tableNumber: order.tableNumber,
            orderType: onlineOrderType as any,
            orderTypeName: onlineOrderTypeName,
            date: order.createdAt || new Date().toISOString(),
          };
          setTimeout(() => {
            try { printTaxInvoice(printData, { autoPrint: true }); } catch (e) {
              console.warn('[POS] Online order auto-print failed silently:', e);
            }
          }, 500);
        }
      } else if (!isPosOrder && soundEnabled) {
        playNotificationSound('newOrder', 0.6);
      }
      // POS orders: no sound, no toast (cashier already knows they created it)
    },
    onOrderUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
    },
    enabled: true,
  });

  const broadcastToDisplay = useCallback((event: string, data?: any) => {
    if (typeof wsSend === 'function') {
      wsSend({ type: "pos_cart_update", payload: { event, ...data } });
    }
  }, [wsSend]);

  useEffect(() => {
    localStorage.setItem("pos-terminal-connected", String(posTerminalConnected));
  }, [posTerminalConnected]);

  // Offline queue: load count on mount, sync when back online
  useEffect(() => {
    countPendingOrders().then(setOfflineQueueCount).catch(() => {});

    const handleOnline = async () => {
      setIsOnline(true);
      const count = await countPendingOrders().catch(() => 0);
      if (count > 0) {
        toast({ title: tc("🔄 جاري مزامنة الطلبات المعلقة...", "🔄 Syncing pending orders..."), description: `${count} ${tc("طلب في قائمة الانتظار","orders in queue")}` });
        const { synced, failed } = await syncOfflineOrders();
        const newCount = await countPendingOrders().catch(() => 0);
        setOfflineQueueCount(newCount);
        if (synced > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          toast({ title: tc("✅ تمت المزامنة","✅ Sync complete"), description: `${synced} ${tc("طلب تم إرساله","orders sent")}${failed > 0 ? `, ${failed} ${tc("فشل","failed")}` : ''}` });
        }
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => { localStorage.setItem("pos-auto-print", String(autoPrint)); }, [autoPrint]);

  // Show toast when thermal printing fails (USB/BT/Network error dispatched by print-utils)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { error: string; mode: string } | undefined;
      const isUsb = detail?.mode === 'webusb' || detail?.mode === 'usb';
      setLastPrintFailed(true);
      toast({
        title: '🖨️ فشلت الطباعة',
        description: isUsb
          ? 'افتح إعدادات الطابعة واضغط "اختر الطابعة (USB)" لإعادة الاتصال، ثم اضغط زر "طباعة" في الفاتورة'
          : (detail?.error || 'تحقق من إعدادات الطابعة'),
        variant: 'destructive',
      });
    };
    window.addEventListener('qirox:print-error', handler);
    return () => window.removeEventListener('qirox:print-error', handler);
  }, [toast]);

  useEffect(() => { localStorage.setItem("pos-show-vat-label", String(showVatLabel)); }, [showVatLabel]);
  useEffect(() => { localStorage.setItem("pos-zoom", String(posZoom)); }, [posZoom]);
  useEffect(() => { if (orderItems.length === 0 && showOrderReview) setShowOrderReview(false); }, [orderItems.length, showOrderReview]);

  // Auto-close receipt dialog after 12 seconds with countdown
  useEffect(() => {
    if (!showReceiptDialog) { setReceiptCountdown(0); return; }
    setReceiptCountdown(12);
    const interval = setInterval(() => {
      setReceiptCountdown(prev => {
        if (prev <= 0) { clearInterval(interval); return 0; }       // manually paused
        if (prev <= 1) { clearInterval(interval); setShowReceiptDialog(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showReceiptDialog]);

  useEffect(() => {
    const is9Digit = customerPhone.length === 9 && customerPhone.startsWith('5');
    const is10Digit = customerPhone.length === 10 && customerPhone.startsWith('05');
    const normalizedPhone = is10Digit ? customerPhone.slice(1) : customerPhone;

    if (!is9Digit && !is10Digit) {
      if (customerPhone.length === 0) {
        setCustomerLookupFound(null);
        setCustomerName("");
        setCustomerPoints(0);
        setUsePoints(false);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsLookingUpCustomer(true);
      setCustomerLookupFound(null);
      try {
        const res = await fetch('/api/customers/lookup-by-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalizedPhone }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.found && data.customer) {
            setCustomerName(data.customer.name || data.customer.customerName || '');
            setCustomerLookupFound(true);
            setShowCustomerInfo(true);
            const pts = data.loyaltyCard?.points ?? data.customer.points ?? data.customer.loyaltyPoints ?? 0;
            setCustomerPoints(Number(pts));
            setUsePoints(false);
            toast({
              title: i18n.language === 'ar' ? 'تم العثور على العميل' : 'Customer Found',
              description: `${data.customer.name || data.customer.customerName}${pts > 0 ? ` — ${pts} ${i18n.language === 'ar' ? 'نقطة' : 'pts'}` : ''}`,
              className: 'bg-green-600 text-white',
            });
          } else {
            setCustomerLookupFound(false);
          }
        } else {
          setCustomerLookupFound(false);
        }
      } catch {
        setCustomerLookupFound(false);
      } finally {
        setIsLookingUpCustomer(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customerPhone]);

  useEffect(() => {
    if (employee && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestPushPermission();
    }
  }, [employee, requestPushPermission]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      // / or F2 → focus search (from anywhere except other inputs)
      if ((e.key === '/' || e.key === 'F2') && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // Escape → clear search or blur
      if (e.key === 'Escape' && isInput) {
        setSearchQuery('');
        (e.target as HTMLElement).blur();
        return;
      }
      // Ctrl+P → print receipt
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && orderItems.length > 0) {
        e.preventDefault();
        window.print();
        return;
      }
      // Ctrl+F → focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [orderItems.length]);

  const { data: productsData, isLoading: isLoadingProducts } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: menuCategories = [] } = useQuery<Array<{ id: string; nameAr: string; nameEn?: string; icon?: string; department: string }>>({
    queryKey: ["/api/menu-categories"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: itemsWithAddons = [] } = useQuery<string[]>({
    queryKey: ["/api/coffee-items/with-addons"],
    staleTime: 5 * 60 * 1000,
  });
  const itemsWithAddonsSet = useMemo(() => new Set(itemsWithAddons), [itemsWithAddons]);

  const { data: liveOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders/live"],
    refetchInterval: 20000,
    staleTime: 10000,
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ['/api/business-config'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: tables = [], refetch: refetchTables } = useQuery<any[]>({
    queryKey: ["/api/tables/status", employee?.branchId],
    queryFn: async () => {
      const res = await fetch(`/api/tables/status?branchId=${employee?.branchId}`);
      return res.json();
    },
    enabled: !!employee?.branchId,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
      toast({ title: t('pos.update_success'), description: t('pos.order_updated') });
    },
    onError: () => {
      toast({ variant: "destructive", title: t('pos.error'), description: t('pos.update_error') });
    }
  });

  const emptyTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      return await apiRequest("PATCH", `/api/tables/${tableId}/occupancy`, { isOccupied: 0 });
    },
    onSuccess: () => {
      refetchTables();
      toast({ title: t('pos.table_cleared'), description: t('pos.table_cleared_desc') });
    },
    onError: () => {
      toast({ variant: "destructive", title: t('pos.error'), description: t('pos.table_clear_error') });
    }
  });

  const closeBillMutation = useMutation({
    mutationFn: async ({ orderId, payMethod }: { orderId: string; payMethod: string }) => {
      return await apiRequest("PUT", `/api/orders/${orderId}/status`, { status: "completed", paymentMethod: payMethod });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
      refetchTables();
      const order = selectedTableForBill;
      if (order) {
        const items = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
          coffeeItem: {
            nameAr: item.name || item.nameAr || item.coffeeItem?.nameAr || '',
            nameEn: item.nameEn || item.coffeeItem?.nameEn || '',
            price: String(item.price || item.unitPrice || 0),
          },
          quantity: item.quantity || 1,
        }));
        const total = Number(order.totalAmount || 0);
        printTaxInvoice({
          orderNumber: order.dailyNumber || order.orderNumber || '',
          customerName: order.customerName || order.customerInfo?.customerName || t('pos.customer_cash'),
          customerPhone: order.customerPhone || order.customerInfo?.customerPhone || '',
          items,
          subtotal: (total / 1.15).toFixed(2),
          total: total.toFixed(2),
          paymentMethod: PAYMENT_METHOD_LABELS[variables.payMethod] || variables.payMethod,
          employeeName: employee?.fullName || t('pos.employee_fallback'),
          tableNumber: order.tableNumber,
          orderType: order.orderType,
          date: order.createdAt || new Date().toISOString(),
          crNumber: businessConfig?.commercialRegistration,
          vatNumber: businessConfig?.vatNumber,
        });
      }
      setSelectedTableForBill(null);
      toast({ title: t('pos.bill_closed'), description: t('pos.bill_closed_desc') });
    },
    onError: () => {
      toast({ variant: "destructive", title: t('pos.error'), description: t('pos.bill_close_error') });
    }
  });

  const openTableOrders = useMemo(() => {
    if (!liveOrders) return [];
    return liveOrders.filter((o: any) => 
      ['pending', 'in_progress', 'ready'].includes(o.status) && 
      o.tableNumber && 
      (o.orderType === 'dine_in' || o.orderType === 'dine-in')
    );
  }, [liveOrders]);

  const getItemDisplayName = useCallback((item: any) => {
    if (i18n.language === 'en') return item.nameEn || item.nameAr || '';
    return item.nameAr || item.nameEn || '';
  }, [i18n.language]);

  const getGroupingKey = useCallback((item: CoffeeItem): string => {
    if ((item as any).groupId) return `${item.category || ''}::${(item as any).groupId}`;
    const nameAr = item.nameAr || "";
    if (!nameAr || typeof nameAr !== 'string') return `${item.category || 'unknown'}::unknown`;
    const cleaned = nameAr.trim()
      .replace(/^[\u064B-\u0652]+/, '')
      .replace(/^(بارد|حار)\s+/i, '');
    const words = cleaned.split(/\s+/);
    const nameBase = words.length >= 2 ? `${words[0]} ${words[1]}` : (words[0] || 'unknown');
    return `${item.category || 'none'}::${nameBase}`;
  }, []);

  const groupedItemsMap = useMemo(() => {
    if (!productsData) return {} as Record<string, CoffeeItem[]>;
    return productsData.reduce((acc: Record<string, CoffeeItem[]>, item) => {
      const key = getGroupingKey(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [productsData, getGroupingKey]);

  const filteredItemsList = useMemo(() => {
    if (!productsData) return [];
    const q = searchQuery.toLowerCase();
    return Object.values(groupedItemsMap)
      .filter(group => {
        const rep = group[0];
        const matchesCategory = selectedCategory === "all" || rep.category === selectedCategory;
        if (!matchesCategory) return false;
        if (!q) return true;
        return group.some(item => {
          const arName = (item.nameAr || '').toLowerCase();
          const enName = (item.nameEn || '').toLowerCase();
          return arName.includes(q) || enName.includes(q);
        });
      })
      .map(group => group[0]);
  }, [productsData, selectedCategory, searchQuery, groupedItemsMap]);

  const visibleCategories = useMemo(() => {
    const itemCategorySet = new Set(productsData?.map(p => p.category).filter(Boolean) || []);
    return menuCategories
      .filter(c => itemCategorySet.has(c.id))
      .map(c => ({
        id: c.id,
        name: c.nameAr,
        icon: Tag,
        color: "text-primary"
      }));
  }, [productsData, menuCategories]);

  const calculateTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
      return sum + ((Number(item.coffeeItem.price) + addonsPrice) * item.quantity);
    }, 0);
  }, [orderItems]);

  const pointsDiscount = useMemo(() => {
    if (!usePoints || customerPoints < 100) return 0;
    const maxDiscount = parseFloat((customerPoints / 50).toFixed(2));
    return Math.min(maxDiscount, calculateTotal);
  }, [usePoints, customerPoints, calculateTotal]);

  const calculateTotalAfterPoints = useMemo(() => Math.max(0, calculateTotal - pointsDiscount), [calculateTotal, pointsDiscount]);

  const calculateSubtotal = useMemo(() => calculateTotal / 1.15, [calculateTotal]);

  // Discount coupon (e.g. TECH10 — موظفي مكان الشيف)
  const [discountCode, setDiscountCode] = useState("");
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percentage: number; reason?: string } | null>(null);

  const couponDiscountAmount = useMemo(
    () => (appliedDiscount ? calculateTotalAfterPoints * appliedDiscount.percentage / 100 : 0),
    [appliedDiscount, calculateTotalAfterPoints]
  );

  const calculateGrandTotal = useMemo(
    () => Math.max(0, calculateTotalAfterPoints - couponDiscountAmount),
    [calculateTotalAfterPoints, couponDiscountAmount]
  );

  const handleValidateDiscount = async () => {
    const code = discountCode.trim();
    if (!code) return;
    setIsValidatingDiscount(true);
    try {
      const response = await fetch("/api/discount-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount: calculateTotalAfterPoints }),
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setAppliedDiscount({ code: data.code, percentage: data.discountPercentage, reason: data.reason });
        setDiscountCode(data.code);
        toast({
          title: tc("تم تطبيق الكوبون", "Coupon applied"),
          description: `${data.reason || data.code} — ${data.discountPercentage}%`,
        });
      } else {
        setAppliedDiscount(null);
        toast({
          variant: "destructive",
          title: tc("كود غير صالح", "Invalid code"),
          description: data.error || tc("تعذر التحقق من الكود", "Could not validate code"),
        });
      }
    } catch (_) {
      toast({ variant: "destructive", title: tc("خطأ في الاتصال", "Connection error") });
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleClearDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  const buildDisplayPayload = (items: any[], event: string, extra?: any) => {
    const total = items.reduce((s, i) => s + Number(i.coffeeItem.price) * i.quantity, 0);
    const subtotal = total / 1.15;
    const tax = total - subtotal;
    return {
      event,
      items: items.map(i => ({
        nameAr: i.coffeeItem.nameAr,
        price: Number(i.coffeeItem.price),
        quantity: i.quantity,
        lineItemId: i.lineItemId,
      })),
      subtotal,
      tax,
      total,
      ...extra,
    };
  };

  const addToOrder = (product: CoffeeItem, customization?: { selectedItemAddons: Array<{nameAr: string; nameEn?: string; price: number}> }) => {
    const addonKey = JSON.stringify(customization?.selectedItemAddons || []);
    const existing = orderItems.find(item => item.coffeeItem.id === product.id && JSON.stringify(item.customization?.selectedItemAddons || []) === addonKey);
    const next = existing
      ? orderItems.map(item =>
          item.coffeeItem.id === product.id && JSON.stringify(item.customization?.selectedItemAddons || []) === addonKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...orderItems, {
          lineItemId: Math.random().toString(36).substr(2, 9),
          coffeeItem: product,
          quantity: 1,
          customization: customization || {},
        }];
    setOrderItems(next);
    const isFirst = next.length === 1;
    broadcastToDisplay(isFirst ? "order_started" : "item_added", buildDisplayPayload(next, isFirst ? "order_started" : "item_added", { lastAdded: product.nameAr }));
  };

  const updateQuantity = (lineItemId: string, newQty: number) => {
    const next = newQty <= 0
      ? orderItems.filter(item => item.lineItemId !== lineItemId)
      : orderItems.map(item =>
          item.lineItemId === lineItemId ? { ...item, quantity: newQty } : item
        );
    setOrderItems(next);
    if (next.length === 0) {
      broadcastToDisplay("order_cancelled", { items: [], subtotal: 0, tax: 0, total: 0 });
    } else {
      broadcastToDisplay("item_updated", buildDisplayPayload(next, "item_updated"));
    }
  };

  const handleCheckout = async () => {
    if (orderItems.length === 0) return;

    // Validate split payment: ensure cash amount is entered and doesn't exceed total
    if (paymentMethod === "split") {
      const cashVal = parseFloat(splitCashAmount) || 0;
      const total0 = Math.max(0, calculateTotal - (usePoints && customerPoints >= 100 ? pointsDiscount : 0));
      if (cashVal <= 0 || cashVal >= total0) {
        alert(tc("الرجاء إدخال مبلغ الكاش بشكل صحيح (أقل من الإجمالي وأكبر من صفر)", "Please enter a valid cash amount (less than total and greater than 0)"));
        return;
      }
    }
    
    try {
      setSyncing(true);
      const rawTotal = calculateTotal;
      const pointsDiscountAmt = usePoints && customerPoints >= 100 ? pointsDiscount : 0;
      const afterPoints = Math.max(0, rawTotal - pointsDiscountAmt);
      const couponDiscountAmt = appliedDiscount ? afterPoints * appliedDiscount.percentage / 100 : 0;
      const discount = pointsDiscountAmt + couponDiscountAmt;
      const total = Math.max(0, rawTotal - discount);
      const subtotal = calculateSubtotal;
      const tax = rawTotal - subtotal;
      const splitPaymentData = paymentMethod === "split"
        ? { cash: parseFloat(splitCashAmount) || 0, card: Math.max(0, total - (parseFloat(splitCashAmount) || 0)) }
        : undefined;
      const pointsUsed = discount > 0 ? Math.round(discount * 50) : 0;

      broadcastToDisplay("payment_processing", {
        items: orderItems.map(i => ({ nameAr: i.coffeeItem.nameAr, price: Number(i.coffeeItem.price), quantity: i.quantity })),
        subtotal, tax, total,
      });

      const orderData: any = {
        items: orderItems.map(item => {
          const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
          return {
            coffeeItemId: item.coffeeItem.id,
            name: item.coffeeItem.nameAr,
            nameAr: item.coffeeItem.nameAr,
            price: Number(item.coffeeItem.price) + addonsPrice,
            quantity: item.quantity,
            customization: item.customization || {}
          };
        }),
        subtotal,
        tax,
        total,
        orderType,
        paymentMethod,
        tableNumber: orderType === "dine_in" ? tableNumber : undefined,
        customerName,
        customerPhone,
        status: "pending",
        deliveryType: orderType === "car_pickup" ? "car_pickup" : orderType === "delivery" ? "delivery" : orderType === "dine_in" ? "dine-in" : "pickup",
        carType: orderType === "car_pickup" ? carTypeInput || undefined : undefined,
        carColor: orderType === "car_pickup" ? carColorInput || undefined : undefined,
        plateNumber: orderType === "car_pickup" ? carPlateInput || undefined : undefined,
        carInfo: orderType === "car_pickup" && carTypeInput ? { carType: carTypeInput, carColor: carColorInput, plateNumber: carPlateInput } : undefined,
        carPickup: orderType === "car_pickup" || undefined,
        branchId: employee?.branchId || "main",
        tenantId: employee?.tenantId || "demo-tenant",
        employeeId: employee?.id,
        channel: "pos",
        notes: orderNote || undefined,
        ...(splitPaymentData ? { splitPayment: splitPaymentData } : {}),
        ...(pointsUsed > 0 ? {
          pointsRedeemed: pointsUsed,
          pointsValue: discount,
          bypassPointsVerification: true,
        } : {}),
        ...(appliedDiscount ? {
          discountCode: appliedDiscount.code,
          discountPercentage: appliedDiscount.percentage,
          discountAmount: couponDiscountAmt,
        } : {}),
      };

      // If offline, queue the order locally AND show receipt
      if (!navigator.onLine) {
        const localId = await queueOfflineOrder({ ...orderData, totalAmount: total });
        const newCount = await countPendingOrders().catch(() => 0);
        setOfflineQueueCount(newCount);

        // Build offline receipt with a temporary order number
        // Skip 100 from last known online order to avoid conflicts when reconnecting
        const lastOnlineNum = parseInt(localStorage.getItem("pos-last-online-order-num") || "0", 10);
        const offlineBase = lastOnlineNum + 100;
        const offlineLocalCounter = parseInt(localStorage.getItem("pos-offline-counter") || "0", 10) + 1;
        localStorage.setItem("pos-offline-counter", String(offlineLocalCounter));
        const offlineOrderNumRaw = offlineBase + offlineLocalCounter;
        const offlineOrderNum = String(offlineOrderNumRaw).padStart(4, '0');
        const offlineReceipt = {
          orderNumber: offlineOrderNum,
          date: new Date().toISOString(),
          items: orderItems.map(item => {
            const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
            return {
              coffeeItem: {
                nameAr: item.coffeeItem.nameAr,
                nameEn: item.coffeeItem.nameEn,
                price: String(Number(item.coffeeItem.price) + addonsPrice),
              },
              quantity: item.quantity,
              customization: item.customization,
            };
          }),
          subtotal,
          tax,
          total,
          paymentMethod,
          customerName,
          customerPhone,
          employeeName: employee?.fullName || t('pos.employee_fallback'),
          tableNumber: orderType === "dine_in" ? tableNumber : undefined,
          orderType,
          isOffline: true,
        };
        setLastOrder(offlineReceipt);

        // Auto-print offline receipt if enabled
        if (autoPrint) {
          const printSnapshot = {
            orderNumber: offlineOrderNum,
            customerName,
            customerPhone,
            items: orderItems.map(item => {
              const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
              const inlineNames = (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr).join('، ');
              return {
                coffeeItem: {
                  nameAr: (item.coffeeItem?.nameAr || '') + (inlineNames ? ` (${inlineNames})` : ''),
                  nameEn: item.coffeeItem?.nameEn || '',
                  price: String(Number(item.coffeeItem?.price || 0) + addonsPrice),
                },
                quantity: item.quantity,
                customization: item.customization,
              };
            }),
            subtotal: subtotal.toFixed(2),
            total: total.toFixed(2),
            paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod,
            splitPayment: splitPaymentData,
            employeeName: employee?.fullName || t('pos.employee_fallback'),
            tableNumber: orderType === "dine_in" ? tableNumber : undefined,
            orderType: orderType as any,
            date: new Date().toISOString(),
            crNumber: businessConfig?.commercialRegistration,
            vatNumber: businessConfig?.vatNumber,
          };
          setTimeout(() => {
            try { printTaxInvoice(printSnapshot, { autoPrint: true }); } catch (e) {
              console.warn('[POS] Offline auto-print failed silently:', e);
            }
          }, 200);
        }

        // Show the receipt dialog
        setLastPrintFailed(false);
        setShowReceiptDialog(true);

        // Clear cart
        setOrderItems([]);
        setSplitCashAmount("");
        setCustomerName("");
        setCustomerPhone("");
        setOrderNote("");
        setSyncing(false);
        return;
      }

      const res = await apiRequest("POST", "/api/orders", orderData);
      const result = await res.json().catch(() => ({}));

      if (!result || result.error) {
        throw new Error(result?.error || tc('فشل إنشاء الطلب','Failed to create order'));
      }

      // Save last online order number to localStorage for offline counter base
      const onlineNum = parseInt(String(result.orderNumber || result.dailyNumber || '0').replace(/\D/g, ''), 10);
      if (onlineNum > 0) {
        const stored = parseInt(localStorage.getItem("pos-last-online-order-num") || "0", 10);
        if (onlineNum > stored) localStorage.setItem("pos-last-online-order-num", String(onlineNum));
        // Reset offline counter when back online (new session)
        localStorage.setItem("pos-offline-counter", "0");
      }

      setLastOrder({
        orderNumber: result.orderNumber || result.dailyNumber || result._id?.slice(-4) || '—',
        date: new Date().toISOString(),
        items: orderItems.map(item => {
          const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
          return {
            coffeeItem: {
              nameAr: item.coffeeItem.nameAr,
              nameEn: item.coffeeItem.nameEn,
              price: String(Number(item.coffeeItem.price) + addonsPrice),
            },
            quantity: item.quantity,
            customization: item.customization,
          };
        }),
        subtotal,
        tax,
        total,
        paymentMethod,
        customerName,
        customerPhone,
        employeeName: employee?.fullName || t('pos.employee_fallback'),
        tableNumber: orderType === "dine_in" ? tableNumber : undefined,
        orderType,
      });
      // ✅ Defer print to avoid blocking the UI thread after checkout
      if (autoPrint) {
        const printSnapshot = {
          orderNumber: result.orderNumber || result.dailyNumber || result._id?.slice(-4) || '—',
          customerName,
          customerPhone,
          items: orderItems.map(item => {
            const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
            const inlineNames = (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr).join('، ');
            return {
              coffeeItem: {
                nameAr: (item.coffeeItem?.nameAr || '') + (inlineNames ? ` (${inlineNames})` : ''),
                nameEn: item.coffeeItem?.nameEn || '',
                price: String(Number(item.coffeeItem?.price || 0) + addonsPrice),
              },
              quantity: item.quantity,
              customization: item.customization,
            };
          }),
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod,
          employeeName: employee?.fullName || t('pos.employee_fallback'),
          tableNumber: orderType === "dine_in" ? tableNumber : undefined,
          orderType: orderType as any,
          orderTypeName: (
            (orderType as string) === 'dine_in' || (orderType as string) === 'dine-in' ? 'طاولة' :
            (orderType as string) === 'takeaway' || (orderType as string) === 'pickup' ? 'سفري' :
            (orderType as string) === 'delivery' ? 'توصيل' :
            (orderType as string) === 'car_pickup' || (orderType as string) === 'car-pickup' ? 'سيارة' :
            (orderType as string) === 'online' ? 'أونلاين' :
            (orderType as string) === 'drive_thru' ? 'درايف ثرو' : ''
          ),
          date: new Date().toISOString(),
          crNumber: businessConfig?.commercialRegistration,
          vatNumber: businessConfig?.vatNumber,
          splitPayment: splitPaymentData,
        };
        // Delay print by 200ms so UI updates (clear cart, show receipt) render first
        setTimeout(() => {
          try { printTaxInvoice(printSnapshot, { autoPrint: true }); } catch (e) {
            console.warn('[POS] Auto-print failed silently:', e);
          }
        }, 200);
      }
      broadcastToDisplay("payment_success", {
        orderNumber: result.orderNumber || result.dailyNumber || '',
        items: orderItems.map(i => ({ nameAr: i.coffeeItem.nameAr, price: Number(i.coffeeItem.price), quantity: i.quantity })),
        subtotal, tax, total,
      });

      // Play confirmation sound for the cashier who placed the order
      if (soundEnabled) {
        testSound('success', 0.85);
      }

      setLastPrintFailed(false);
      setShowReceiptDialog(true);

      setOrderItems([]);
      setSplitCashAmount("");
      setOrderNote("");
      setTableNumber("");
      setCustomerName("");
      setCustomerPhone("");
      setCarTypeInput("");
      setCarColorInput("");
      setCarPlateInput("");
      setCustomerPoints(0);
      setUsePoints(false);
      
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
    } catch (error) {
      console.error("Checkout error:", error);
      toast({ 
        variant: "destructive",
        title: t('pos.checkout_error_title'), 
        description: t('pos.checkout_error') 
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!lastOrder) return;
    printTaxInvoice({
      orderNumber: lastOrder.orderNumber,
      customerName: lastOrder.customerName || t('pos.customer_cash'),
      customerPhone: lastOrder.customerPhone || '',
      items: lastOrder.items,
      subtotal: lastOrder.subtotal.toFixed(2),
      total: lastOrder.total.toFixed(2),
      paymentMethod: PAYMENT_METHOD_LABELS[lastOrder.paymentMethod] || lastOrder.paymentMethod,
      employeeName: lastOrder.employeeName,
      tableNumber: lastOrder.tableNumber,
      orderType: lastOrder.orderType,
      date: lastOrder.date,
      crNumber: businessConfig?.commercialRegistration,
      vatNumber: businessConfig?.vatNumber,
    }, { autoPrint: true });
  };

  const handlePrintLiveOrder = (order: any) => {
    const items = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
      coffeeItem: {
        nameAr: item.name || item.nameAr || item.coffeeItem?.nameAr || '',
        nameEn: item.nameEn || item.coffeeItem?.nameEn || '',
        price: String(item.price || item.unitPrice || 0),
      },
      quantity: item.quantity || 1,
    }));
    printTaxInvoice({
      orderNumber: order.dailyNumber || order.orderNumber || '',
      customerName: order.customerName || order.customerInfo?.customerName || t('pos.customer_cash'),
      customerPhone: order.customerPhone || order.customerInfo?.customerPhone || '',
      items,
      subtotal: (Number(order.totalAmount || 0) / 1.15).toFixed(2),
      total: String(order.totalAmount || 0),
      paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod || t('pos.payment_cash'),
      employeeName: employee?.fullName || t('pos.employee_fallback'),
      tableNumber: order.tableNumber,
      orderType: order.orderType,
      date: order.createdAt || new Date().toISOString(),
      crNumber: businessConfig?.commercialRegistration,
      vatNumber: businessConfig?.vatNumber,
    }, { autoPrint: true });
  };

  if (!employee) return <LoadingState />;

  const scale = posZoom / 100;
  const inverseScale = 1 / scale;

  return (
    <div dir="ltr" style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
    <div
      className="flex flex-col bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground"
      dir={dir}
      style={{
        width: `${inverseScale * 100}vw`,
        height: `${inverseScale * 100}vh`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      <header className="flex flex-col sm:flex-row items-center justify-between px-3 py-2 sm:px-6 sm:py-3 border-b bg-card gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 sm:p-2 rounded-lg">
              <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-primary">مكان الشيف البخاري</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:hidden">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowOrdersPanel(true)}
              className="relative"
              data-testid="button-mobile-orders"
            >
              <ClipboardList className="w-4 h-4" />
              {newOrdersCount > 0 && (
                <Badge className="absolute -top-2 -right-2 px-1.5 min-w-[18px] h-[18px] bg-red-500 animate-pulse">
                  {newOrdersCount}
                </Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowPrinterSettings(true)}
              className="relative"
              data-testid="button-mobile-printer-settings"
              title={tc("إعدادات الطابعة", "Printer Settings")}
            >
              <Printer className="w-4 h-4" />
              <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${printerMode === 'network' ? 'bg-blue-500' : printerMode === 'bluetooth' ? 'bg-purple-500' : printerMode === 'webusb' ? 'bg-green-500' : 'bg-gray-400'}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowPOSSettings(true)}
              data-testid="button-mobile-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            {splitViewMode && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSplitViewMode(false)}
                data-testid="button-mobile-back"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)} className="w-[400px]">
            <TabsList className="grid grid-cols-4 w-full h-10 p-1">
              {ORDER_TYPES.map((type) => (
                <TabsTrigger key={type.id} value={type.id} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid={`tab-order-type-${type.id}`}>
                  <type.icon className="w-3.5 h-3.5 ml-1.5" />
                  {t(`pos.order_type_${type.id}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          <Button
            variant={posTerminalConnected ? "default" : "outline"}
            size="sm"
            onClick={() => setPosTerminalConnected(!posTerminalConnected)}
            className="hidden sm:flex gap-1"
            data-testid="button-pos-terminal-toggle"
          >
            <MonitorSmartphone className="w-4 h-4" />
            <span className="text-xs">{posTerminalConnected ? t('pos.terminal_connected') : t('pos.terminal_disconnected')}</span>
            <div className={`w-2 h-2 rounded-full ${posTerminalConnected ? 'bg-green-400' : 'bg-orange-400'}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/customer-display', '_blank')}
            className="hidden sm:flex gap-1"
            data-testid="button-customer-display"
          >
            <SplitSquareVertical className="w-4 h-4" />
            <span className="text-xs">{t('pos.customer_display')}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPrinterSettings(true)}
            className="hidden sm:flex relative"
            data-testid="button-pos-printer-settings"
            title={tc("إعدادات الطابعة", "Printer Settings")}
          >
            <Printer className="w-4 h-4" />
            <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-background ${printerMode === 'network' ? 'bg-blue-500' : printerMode === 'bluetooth' ? 'bg-purple-500' : printerMode === 'webusb' ? 'bg-green-500' : 'bg-gray-400'}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPOSSettings(true)}
            className="hidden sm:flex"
            data-testid="button-pos-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <div className="hidden sm:flex">
            <AudioUnlockBanner
              pageKey="pos"
              soundEnabled={soundEnabled}
              onToggleSound={(val) => { setSoundEnabled(val); saveSoundEnabled('pos', val); }}
              compact
            />
          </div>

          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} title={wsConnected ? t('pos.connected_status') : t('pos.disconnected_status')} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOrdersPanel(true)}
            className="relative hidden sm:flex"
            data-testid="button-desktop-orders"
          >
            <ClipboardList className="w-4 h-4 ml-2" />
            {t('pos.orders')}
            {newOrdersCount > 0 && (
              <Badge className="absolute -top-2 -right-2 px-1.5 min-w-[18px] h-[18px] bg-red-500 animate-pulse">
                {newOrdersCount}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTablesDialog(true)}
            className="hidden sm:flex"
            data-testid="button-tables-grid"
          >
            <Grid3X3 className="w-4 h-4 ml-2" />
            {t('pos.tables')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOpenBillsDialog(true)}
            className="relative hidden sm:flex"
            data-testid="button-open-bills"
          >
            <Receipt className="w-4 h-4 ml-2" />
            {t('pos.open_bills')}
            {openTableOrders.length > 0 && (
              <Badge className="absolute -top-2 -right-2 px-1.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground">
                {openTableOrders.length}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-full border">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] sm:text-xs font-medium">{employee?.fullName || t('pos.employee_fallback')}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="h-8 px-2 text-xs font-bold"
            data-testid="button-toggle-language-pos"
          >
            {i18n.language === 'ar' ? 'EN' : 'ع'}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/employee/home")} className="h-8 w-8 sm:h-9 sm:w-9" data-testid="button-back-dashboard" title={t('pos.back_to_dashboard')}>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">

        <section className={`${mobilePanelView === 'products' ? 'flex' : 'hidden'} md:flex ${splitViewMode ? 'md:hidden' : ''} flex-1 flex-col overflow-hidden`}>
          {/* Category Top Bar */}
          <div className={`${mobilePanelView === 'cart' ? 'hidden' : ''} flex gap-1 overflow-x-auto border-b bg-muted/30 px-2 py-2 shrink-0 no-scrollbar`}>
            <Button
              variant={selectedCategory === "all" ? "default" : "ghost"}
              className="flex-row gap-1.5 h-9 px-3 shrink-0 rounded-lg"
              onClick={() => setSelectedCategory("all")}
              data-testid="button-category-all"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="text-xs font-bold whitespace-nowrap">{t('pos.category_all')}</span>
            </Button>
            {visibleCategories.map((cat: any) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "ghost"}
                className="flex-row gap-1.5 h-9 px-3 shrink-0 rounded-lg"
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`button-category-${cat.id}`}
              >
                <cat.icon className="w-4 h-4" />
                <span className="text-xs font-bold whitespace-nowrap">{cat.name}</span>
              </Button>
            ))}
          </div>

          <div className="p-2 sm:p-4 border-b bg-card/50 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={`${t('pos.search_placeholder')}  (/ ${tc('أو','or')} F2)`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-9 sm:h-12 text-sm sm:text-base rounded-xl border-2 focus-visible:ring-primary"
                data-testid="input-search-products"
              />
            </div>
            <div className="flex gap-2 sm:hidden overflow-x-auto whitespace-nowrap pb-1 no-scrollbar">
              {ORDER_TYPES.map((type) => (
                <Button
                  key={type.id}
                  variant={orderType === type.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrderType(type.id as OrderType)}
                  className="whitespace-nowrap shrink-0 h-9"
                  data-testid={`button-mobile-order-type-${type.id}`}
                >
                  <type.icon className="w-4 h-4 ml-1" />
                  {t(`pos.order_type_${type.id}`)}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1 p-2 sm:p-4 lg:p-6">
            {isLoadingProducts ? (
              <LoadingState message={t('pos.loading_products')} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 pb-[58px] md:pb-0">
                {filteredItemsList.map((item: any) => (
                  <Card 
                    key={item.id}
                    className={`group relative overflow-hidden cursor-pointer transition-shadow hover:shadow-lg border-2 ${
                      !item.isAvailable ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-primary/50'
                    }`}
                    onClick={() => {
                      if (!item.isAvailable) return;
                      const groupKey = getGroupingKey(item);
                      const group = groupedItemsMap[groupKey] || [item];
                      const hasVariants = group.length > 1;
                      const hasSizes = item.availableSizes && item.availableSizes.length > 0;
                      const hasAddons = itemsWithAddonsSet.has(item.id);
                      if (!hasVariants && !hasSizes && !hasAddons) {
                        addToOrder(item);
                      } else {
                        setPosCustomizationItem({ item, group });
                      }
                    }}
                    data-testid={`card-product-${item.id}`}
                  >
                    <div className="aspect-square relative overflow-hidden">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.nameAr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Coffee className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                      )}
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Badge variant="destructive" className="text-[10px] sm:text-sm font-bold px-2 py-0.5 sm:px-3 sm:py-1">{t('pos.out_of_stock')}</Badge>
                        </div>
                      )}
                      {(() => {
                        const groupKey = getGroupingKey(item);
                        const groupCount = (groupedItemsMap[groupKey] || [item]).length;
                        const hasAddonsBadge = itemsWithAddonsSet.has(item.id);
                        return (
                          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                            {groupCount > 1 && (
                              <Badge className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-primary/90 text-white font-bold">
                                {groupCount} {i18n.language === 'ar' ? 'خيارات' : 'options'}
                              </Badge>
                            )}
                            {hasAddonsBadge && (
                              <Badge className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-orange-500/90 text-white font-bold">
                                + {i18n.language === 'ar' ? 'إضافات' : 'Addons'}
                              </Badge>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <CardContent className="p-2 sm:p-3">
                      <h3 className="font-bold text-xs sm:text-base mb-1 line-clamp-1">{getItemDisplayName(item)}</h3>
                      <div className="flex justify-between items-center">
                        <p className="text-primary font-black text-xs sm:text-base">{Number(item.price).toFixed(2)} {t('pos.currency')}{showVatLabel && <span className="text-muted-foreground font-medium text-[9px] sm:text-[10px] mr-1">{t('pos.vat_included')}</span>}</p>
                        <div className="bg-primary/10 text-primary rounded-full p-1">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </section>

        <aside className={`${mobilePanelView === 'cart' ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-[420px] border-r flex flex-col bg-card shrink-0`}>
          <div className="p-2 sm:p-3 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 text-muted-foreground"
                onClick={() => setMobilePanelView('products')}
                data-testid="button-back-to-products"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              <div className="bg-primary p-1.5 rounded-lg hidden sm:flex">
                <ShoppingBag className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base">{t('pos.order_details')}</h2>
                {orderItems.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{orderItems.length} {i18n.language === 'ar' ? 'منتج' : 'items'}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setSplitViewMode(!splitViewMode)} data-testid="button-split-view">
                <Columns2 className="w-4 h-4" />
              </Button>
              {orderItems.length > 0 && (
                <Button variant="ghost" size="icon" onClick={() => { setOrderItems([]); setSplitCashAmount(""); broadcastToDisplay("order_cancelled", { items: [], subtotal: 0, tax: 0, total: 0 }); }} className="text-destructive h-8 w-8" data-testid="button-clear-order">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-2 sm:px-4 py-2">
            {orderItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-20">
                <ShoppingBag className="w-12 h-12 mb-4" />
                <p className="text-sm font-bold">{t('pos.empty_cart')}</p>
              </div>
            ) : (
              <div className="space-y-2 pb-2">
                {orderItems.map((item) => (
                  <div key={item.lineItemId} className="flex items-center gap-2 p-2 sm:p-3 rounded-xl border bg-background shadow-sm" data-testid={`order-item-${item.lineItemId}`}>
                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm leading-tight line-clamp-2">{getItemDisplayName(item.coffeeItem)}</h4>
                      {item.customization?.selectedItemAddons && item.customization.selectedItemAddons.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          + {item.customization.selectedItemAddons.map((a: any) => a.nameAr).join('، ')}
                        </p>
                      )}
                      <p className="text-primary font-black text-xs mt-0.5">
                        {((Number(item.coffeeItem.price) + (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + Number(a.price || 0), 0)) * item.quantity).toFixed(2)} {t('pos.currency')}
                      </p>
                    </div>
                    {/* Quantity controls */}
                    <div className="flex items-center bg-muted rounded-full p-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-background"
                        onClick={() => updateQuantity(item.lineItemId, item.quantity - 1)}
                        data-testid={`button-decrease-${item.lineItemId}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-background"
                        onClick={() => updateQuantity(item.lineItemId, item.quantity + 1)}
                        data-testid={`button-increase-${item.lineItemId}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => updateQuantity(item.lineItemId, 0)}
                      data-testid={`button-delete-${item.lineItemId}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t">
            <button
              className="w-full flex items-center justify-between px-3 sm:px-4 py-2 hover:bg-muted/50 transition-colors text-sm"
              onClick={() => setShowCustomerInfo(v => !v)}
              data-testid="button-toggle-customer-info"
            >
              <span className="flex items-center gap-2 font-medium text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                {customerName
                  ? customerName
                  : i18n.language === 'ar' ? 'بيانات العميل' : 'Customer Info'}
                {(customerName || customerPhone) && (
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showCustomerInfo ? 'rotate-180' : ''}`} />
            </button>
            {showCustomerInfo && (
              <div className="px-2 sm:px-4 pb-2 space-y-2">
                <Input
                  placeholder={t('pos.customer_name')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 text-sm"
                  data-testid="input-pos-customer-name"
                />
                <div className="relative">
                  <Input
                    placeholder={t('pos.customer_phone')}
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      setCustomerLookupFound(null);
                    }}
                    className={`h-9 text-sm pr-8 ${customerLookupFound === true ? 'border-green-500 focus-visible:ring-green-400' : customerLookupFound === false ? 'border-orange-400' : ''}`}
                    dir="ltr"
                    data-testid="input-pos-customer-phone"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    {isLookingUpCustomer && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    {!isLookingUpCustomer && customerLookupFound === true && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                    {!isLookingUpCustomer && customerLookupFound === false && <User className="w-3.5 h-3.5 text-orange-400" />}
                  </div>
                </div>
                {orderType === "dine_in" && (
                  <Input
                    placeholder={t('pos.table_number')}
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="h-9 text-sm"
                    data-testid="input-pos-table-number"
                  />
                )}
                {orderType === "car_pickup" && (
                  <div className="space-y-2 mt-1 p-2 rounded-lg border border-purple-500/30 bg-purple-500/5">
                    <p className="text-xs font-bold text-purple-500 flex items-center gap-1">🚗 {tc("بيانات السيارة","Car Info")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder={tc("نوع السيارة", "Car model")}
                        value={carTypeInput}
                        onChange={(e) => setCarTypeInput(e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-pos-car-type"
                      />
                      <Input
                        placeholder={tc("لون السيارة", "Car color")}
                        value={carColorInput}
                        onChange={(e) => setCarColorInput(e.target.value)}
                        className="h-8 text-xs"
                        data-testid="input-pos-car-color"
                      />
                    </div>
                    <Input
                      placeholder={tc("رقم اللوحة", "Plate number")}
                      value={carPlateInput}
                      onChange={(e) => setCarPlateInput(e.target.value)}
                      className="h-8 text-xs"
                      data-testid="input-pos-car-plate"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-2 sm:px-4 py-2 border-t">
            <p className="text-xs sm:text-sm font-bold text-muted-foreground mb-2">{t('pos.payment_method')}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {PAYMENT_METHODS.map((method) => (
                <Button
                  key={method.id}
                  variant={paymentMethod === method.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setPaymentMethod(method.id as PaymentMethod); setSplitCashAmount(""); }}
                  className="flex flex-col gap-0.5 h-auto py-2 text-[10px] sm:text-xs"
                  data-testid={`button-payment-${method.id}`}
                >
                  <method.icon className="w-4 h-4" />
                  <span className="font-bold">{t((method as any).tKey)}</span>
                </Button>
              ))}
            </div>
            {paymentMethod === "card" && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                  {t('pos.card_amount_note')}
                </p>
                {posTerminalConnected ? (
                  <div className="flex items-center justify-center gap-1.5 text-green-600 text-[10px] sm:text-xs" data-testid="status-terminal-connected">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium">{t('pos.terminal_connected_status')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-orange-500 text-[10px] sm:text-xs" data-testid="status-terminal-disconnected">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-medium">{t('pos.terminal_disconnected_status')}</span>
                  </div>
                )}
              </div>
            )}
            {paymentMethod === "split" && (() => {
              const splitTotal = usePoints && pointsDiscount > 0 ? calculateTotalAfterPoints : calculateTotal;
              const cashVal = parseFloat(splitCashAmount) || 0;
              const cardVal = Math.max(0, splitTotal - cashVal);
              const isValid = cashVal >= 0 && cashVal <= splitTotal;
              return (
                <div className="mt-2 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold text-primary text-center">{tc("أدخل المبلغ النقدي — الباقي يُسدَّد شبكة","Enter cash amount — rest goes to card")}</p>
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-green-600 shrink-0" />
                    <Input
                      type="number"
                      min={0}
                      max={splitTotal}
                      step={0.01}
                      placeholder={tc("مبلغ الكاش","Cash amount")}
                      value={splitCashAmount}
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      className="h-8 text-sm font-bold"
                      data-testid="input-split-cash"
                    />
                    <span className="text-xs font-bold shrink-0">{tc("ر.س","SAR")}</span>
                  </div>
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold ${isValid ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700' : 'bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200'}`}>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{tc("الشبكة:","Card:")}</span>
                    </div>
                    <span>{isValid ? cardVal.toFixed(2) : "—"} {tc("ر.س","SAR")}</span>
                  </div>
                  {cashVal > 0 && isValid && (
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{tc("كاش","Cash")} {cashVal.toFixed(2)} + {tc("شبكة","Card")} {cardVal.toFixed(2)}</span>
                      <span className="font-bold text-primary">= {splitTotal.toFixed(2)} {tc("ر.س","SAR")}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="p-2 sm:p-4 pb-[72px] md:pb-4 border-t bg-muted/10 gap-2 sm:gap-3 flex flex-col">
            {/* Discount coupon input */}
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-2 sm:p-3" data-testid="card-pos-discount">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] sm:text-xs font-black text-primary">
                  {tc('كوبون خصم', 'Discount Coupon')}
                </span>
              </div>
              {appliedDiscount ? (
                <div className="flex items-center justify-between gap-2 bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-lg px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-xs font-black text-green-700 dark:text-green-300 truncate" data-testid="text-applied-coupon">
                      {appliedDiscount.code} — {appliedDiscount.percentage}%
                    </p>
                    {appliedDiscount.reason && (
                      <p className="text-[9px] sm:text-[10px] text-green-600 dark:text-green-400 truncate">
                        {appliedDiscount.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-600 hover:bg-red-50 shrink-0"
                    onClick={handleClearDiscount}
                    data-testid="button-clear-discount"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder={tc('أدخل الكود', 'Enter code')}
                    className="h-8 text-[11px] sm:text-xs font-bold"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleValidateDiscount(); } }}
                    data-testid="input-discount-code"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2 text-[11px] sm:text-xs font-bold shrink-0"
                    onClick={handleValidateDiscount}
                    disabled={isValidatingDiscount || !discountCode.trim()}
                    data-testid="button-apply-discount"
                  >
                    {isValidatingDiscount ? '...' : tc('تطبيق', 'Apply')}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-[10px] sm:text-sm">
                <span className="text-muted-foreground">{t('pos.subtotal')}</span>
                <span className="font-bold">{calculateSubtotal.toFixed(2)} {t('pos.currency')}</span>
              </div>
              <div className="flex justify-between text-[10px] sm:text-sm">
                <span className="text-muted-foreground">{t('pos.tax')}</span>
                <span className="font-bold">{(calculateTotal - calculateSubtotal).toFixed(2)} {t('pos.currency')}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-1">
                <span className="font-black text-sm sm:text-base">{t('pos.total')}</span>
                <span className={`font-black text-base sm:text-xl ${(usePoints && pointsDiscount > 0) || appliedDiscount ? 'line-through text-muted-foreground text-sm sm:text-base' : 'text-primary'}`}>{calculateTotal.toFixed(2)} {t('pos.currency')}</span>
              </div>
              {usePoints && pointsDiscount > 0 && (
                <div className="flex justify-between text-[10px] sm:text-sm text-amber-600">
                  <span className="font-bold">{i18n.language === 'ar' ? 'خصم بطاقة مكان الشيف' : 'Chef Card'}</span>
                  <span className="font-bold">- {pointsDiscount.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
              {appliedDiscount && couponDiscountAmount > 0 && (
                <div className="flex justify-between text-[10px] sm:text-sm text-green-600" data-testid="text-coupon-discount-line">
                  <span className="font-bold">{tc('كوبون', 'Coupon')} {appliedDiscount.code} ({appliedDiscount.percentage}%)</span>
                  <span className="font-bold">- {couponDiscountAmount.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
              {((usePoints && pointsDiscount > 0) || appliedDiscount) && (
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm sm:text-base">{i18n.language === 'ar' ? 'الإجمالي بعد الخصم' : 'Total After Discount'}</span>
                  <span className="font-black text-base sm:text-xl text-primary" data-testid="text-grand-total">{calculateGrandTotal.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
            </div>

            {/* Points discount toggle — only when customer found with ≥100 pts */}
            {customerLookupFound === true && customerPoints >= 100 && (
              <div className={`rounded-xl border-2 p-3 transition-colors ${usePoints ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-muted bg-muted/30'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wallet className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-amber-700 dark:text-amber-300 leading-none">
                        {i18n.language === 'ar' ? 'استخدام النقاط' : 'Use Points'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {customerPoints} {i18n.language === 'ar' ? 'نقطة' : 'pts'} = {(customerPoints / 50).toFixed(2)} {t('pos.currency')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={usePoints}
                    onCheckedChange={setUsePoints}
                    data-testid="toggle-use-points"
                  />
                </div>
                {usePoints && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold mt-2 border-t border-amber-200 dark:border-amber-700 pt-2">
                    {i18n.language === 'ar'
                      ? `سيُخصم ${pointsDiscount.toFixed(2)} ريال (${Math.round(pointsDiscount * 50)} نقطة) من الطلب`
                      : `${pointsDiscount.toFixed(2)} SAR (${Math.round(pointsDiscount * 50)} pts) will be deducted`}
                  </p>
                )}
              </div>
            )}

            {/* Offline / Queue Indicator */}
            {(!isOnline || offlineQueueCount > 0) && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${!isOnline ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`} data-testid="pos-offline-indicator">
                {!isOnline ? <WifiOff className="w-4 h-4 shrink-0" /> : <Wifi className="w-4 h-4 shrink-0" />}
                <span className="flex-1">
                  {!isOnline ? tc('غير متصل — الطلبات تُخزّن محلياً','Offline — Orders saved locally') : `${offlineQueueCount} ${tc('طلب في انتظار الإرسال','orders pending upload')}`}
                </span>
                {isOnline && offlineQueueCount > 0 && (
                  <button
                    className="text-xs underline"
                    onClick={async () => {
                      const { synced } = await syncOfflineOrders();
                      const c = await countPendingOrders().catch(() => 0);
                      setOfflineQueueCount(c);
                      if (synced > 0) queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                    }}
                  >{tc("مزامنة","Sync")}</button>
                )}
              </div>
            )}

            <Button 
              className="w-full h-11 sm:h-13 text-sm sm:text-base font-black rounded-xl shadow-lg shadow-primary/20 gap-2"
              disabled={orderItems.length === 0 || syncing}
              onClick={() => setShowOrderReview(true)}
              data-testid="button-checkout"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.icon && (() => {
                    const IconComp = PAYMENT_METHODS.find(m => m.id === paymentMethod)!.icon;
                    return <IconComp className="w-4 h-4" />;
                  })()}
                </>
              )}
              {i18n.language === 'ar' ? 'مراجعة الطلب والدفع' : 'Review & Pay'}
            </Button>
          </div>
        </aside>
      </main>

      {/* Mobile bottom navigation — Products / Cart tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 flex h-[58px] shadow-lg">
        <button
          onClick={() => setMobilePanelView('products')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            mobilePanelView === 'products'
              ? 'text-primary border-t-2 border-primary bg-primary/5'
              : 'text-muted-foreground'
          }`}
          data-testid="button-mobile-tab-products"
        >
          <Grid3X3 className="w-5 h-5" />
          <span className="text-[10px] font-bold">{i18n.language === 'ar' ? 'المنتجات' : 'Products'}</span>
        </button>
        <button
          onClick={() => setMobilePanelView('cart')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
            mobilePanelView === 'cart'
              ? 'text-primary border-t-2 border-primary bg-primary/5'
              : 'text-muted-foreground'
          }`}
          data-testid="button-mobile-tab-cart"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {orderItems.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {orderItems.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">
            {orderItems.length > 0
              ? `${calculateTotal.toFixed(0)} ${t('pos.currency')}`
              : i18n.language === 'ar' ? 'الطلب' : 'Cart'}
          </span>
        </button>
      </div>

      <Dialog open={showOrdersPanel} onOpenChange={(open) => { setShowOrdersPanel(open); if (open) setNewOrdersCount(0); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {t('pos.live_orders', { count: liveOrders?.length || 0 })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 px-1 pb-2">
            {([
              { key: 'all' as const, label: i18n.language === 'ar' ? 'الكل' : 'All', count: liveOrders?.length || 0 },
              { key: 'online' as const, label: i18n.language === 'ar' ? 'طلبات أونلاين' : 'Online Orders', count: liveOrders?.filter((o: any) => o.channel === 'online' || o.channel === 'web').length || 0 },
              { key: 'pos' as const, label: i18n.language === 'ar' ? 'طلبات الكاشير' : 'POS Orders', count: liveOrders?.filter((o: any) => o.channel === 'pos' || !o.channel).length || 0 },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOrdersFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  ordersFilter === tab.key
                    ? tab.key === 'online' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.key === 'online' && <MonitorSmartphone className="w-3.5 h-3.5" />}
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    ordersFilter === tab.key ? 'bg-white/50 dark:bg-white/10' : 'bg-background'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(90vh - 130px)' }}>
            <div className="space-y-3 p-1">
              {(() => {
                const filteredOrders = (liveOrders || []).filter((o: any) => {
                  if (ordersFilter === 'online') return o.channel === 'online' || o.channel === 'web';
                  if (ordersFilter === 'pos') return o.channel === 'pos' || o.channel === undefined || o.channel === null;
                  return true;
                });
                if (filteredOrders.length === 0) return (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-bold">{ordersFilter !== 'all'
                      ? (i18n.language === 'ar' ? 'لا توجد طلبات في هذا التصنيف' : 'No orders in this filter')
                      : t('pos.no_live_orders')}</p>
                  </div>
                );
                return filteredOrders.map((order: any) => {
                  const orderCustomerName = order.customerName || order.customerInfo?.customerName || order.customerInfo?.name || '';
                  const orderCustomerPhone = order.customerPhone || order.customerInfo?.customerPhone || order.customerInfo?.phone || '';
                  const statusColors: Record<string, string> = {
                    'pending': 'border-yellow-500 bg-yellow-500/5',
                    'in_progress': 'border-blue-500 bg-blue-500/5',
                    'ready': 'border-green-500 bg-green-500/5',
                  };
                  const statusLabels: Record<string, string> = {
                    'pending': t('pos.status_pending'),
                    'payment_confirmed': t('pos.status_confirmed'),
                    'in_progress': t('pos.status_in_progress'),
                    'ready': t('pos.status_ready'),
                  };
                  const carInfo = order.carType || order.carInfo?.carType;
                  const carColor = order.carColor || order.carInfo?.carColor;
                  const carPlateNum = order.plateNumber || order.carInfo?.plateNumber || order.carPlate || "";
                  
                  return (
                    <Card key={order.id || order._id} className={`border-2 ${statusColors[order.status] || 'border-border'}`} data-testid={`order-card-${order.id}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-black text-lg">{fmtOrderNum(order.orderNumber)}</span>
                              <Badge variant={order.status === 'ready' ? 'default' : 'secondary'} className="text-xs">
                                {statusLabels[order.status] || order.status}
                              </Badge>
                              {(order.channel === 'online' || order.channel === 'web') && (
                                <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0 gap-1">
                                  <MonitorSmartphone className="w-3 h-3" />
                                  {i18n.language === 'ar' ? 'أونلاين' : 'Online'}
                                </Badge>
                              )}
                              {order.orderType && (
                                <Badge variant="outline" className="text-xs">
                                  {order.orderType === 'dine_in' || order.orderType === 'dine-in' ? t('pos.order_type_dine_label') : 
                                   order.orderType === 'takeaway' || order.orderType === 'pickup' ? t('pos.order_type_takeaway_label') : 
                                   order.orderType === 'car_pickup' || order.orderType === 'car-pickup' ? t('pos.order_type_car_label') : 
                                   order.orderType === 'delivery' ? t('pos.order_type_delivery_label') : order.orderType}
                                </Badge>
                              )}
                            </div>
                            {orderCustomerName && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">{orderCustomerName}</span>
                                {orderCustomerPhone && <span className="mr-2 text-xs">({orderCustomerPhone})</span>}
                              </p>
                            )}
                            {order.tableNumber && (
                              <p className="text-xs text-muted-foreground">{t('pos.table_label', { number: order.tableNumber })}</p>
                            )}
                            {carInfo && (
                              <div className="flex flex-col gap-0.5 mt-1 text-xs text-purple-500 bg-purple-500/10 rounded p-1.5 border border-purple-500/20">
                                <div className="flex items-center gap-1 font-bold">
                                  <Navigation className="w-3 h-3" />
                                  <span>🚗 استلام من السيارة</span>
                                </div>
                                <span>{carInfo} | {carColor}{carPlateNum ? ` | لوحة: ${carPlateNum}` : ''}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <span className="font-black text-primary text-lg">{Number(order.totalAmount).toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground mr-1">{t('pos.currency')}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          {(Array.isArray(order.items) ? order.items : []).map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs py-0.5">
                              <span>{item.name || item.nameAr || item.coffeeItem?.nameAr} x{item.quantity}</span>
                              <span className="text-muted-foreground">{Number(item.price || item.unitPrice || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* ─── Order Tracking Strip ─── */}
                        {order.status !== 'cancelled' && order.status !== 'completed' && (
                          <div className="mb-3">
                            {(() => {
                              const steps = [
                                { key: 'pending', label: i18n.language === 'ar' ? 'مؤكد' : 'Confirmed', aliases: ['payment_confirmed', 'confirmed'] },
                                { key: 'in_progress', label: i18n.language === 'ar' ? 'تحضير' : 'Preparing' },
                                { key: 'ready', label: i18n.language === 'ar' ? 'جاهز' : 'Ready' },
                                { key: 'completed', label: i18n.language === 'ar' ? 'مكتمل' : 'Done' },
                              ];
                              const currentIdx = steps.findIndex(s => s.key === order.status || (s.aliases || []).includes(order.status));
                              return (
                                <div className="flex items-center gap-1" dir="ltr">
                                  {steps.map((step, idx) => (
                                    <div key={step.key} className="flex items-center flex-1">
                                      <div className="flex flex-col items-center flex-1">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-colors ${
                                          idx <= currentIdx
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'border-muted-foreground/30 text-muted-foreground'
                                        }`}>
                                          {idx < currentIdx ? '✓' : idx + 1}
                                        </div>
                                        <span className={`text-[9px] mt-0.5 text-center leading-tight ${idx <= currentIdx ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                          {step.label}
                                        </span>
                                      </div>
                                      {idx < steps.length - 1 && (
                                        <div className={`h-[2px] flex-1 mx-0.5 rounded transition-colors ${idx < currentIdx ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* ─── Action Buttons (all orders, not just online) ─── */}
                        <div className="flex gap-2 flex-wrap">
                          {(order.status === 'pending' || order.status === 'payment_confirmed' || order.status === 'confirmed') && (
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id || order._id, status: 'in_progress' })}
                              disabled={updateOrderStatusMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              data-testid={`button-start-prep-${order.id}`}
                            >
                              <Clock className="w-3 h-3 ml-1" />
                              {t('pos.start_prep')}
                            </Button>
                          )}
                          {order.status === 'in_progress' && (
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id || order._id, status: 'ready' })}
                              disabled={updateOrderStatusMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              data-testid={`button-ready-${order.id}`}
                            >
                              <Check className="w-3 h-3 ml-1" />
                              {t('pos.mark_ready')}
                            </Button>
                          )}
                          {order.status === 'ready' && (
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id || order._id, status: 'completed' })}
                              disabled={updateOrderStatusMutation.isPending}
                              className="bg-primary hover:bg-primary/90"
                              data-testid={`button-delivered-${order.id}`}
                            >
                              <CheckCircle className="w-3 h-3 ml-1" />
                              {t('pos.mark_delivered')}
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePrintLiveOrder(order)}
                            data-testid={`button-print-order-${order.id}`}
                          >
                            <Printer className="w-3 h-3 ml-1" />
                            {t('pos.print')}
                          </Button>
                          {order.status !== 'cancelled' && order.status !== 'completed' && (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id || order._id, status: 'cancelled' })}
                              disabled={updateOrderStatusMutation.isPending}
                              data-testid={`button-cancel-${order.id}`}
                            >
                              <X className="w-3 h-3 ml-1" />
                              {t('pos.cancel')}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Review Dialog */}
      <Dialog open={showOrderReview} onOpenChange={setShowOrderReview}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" dir={dir}>
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <ShoppingCart className="w-5 h-5 text-primary" />
              {i18n.language === 'ar' ? 'مراجعة الطلب' : 'Order Review'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {i18n.language === 'ar'
                ? 'راجع الأصناف قبل إتمام الدفع'
                : 'Review items before completing payment'}
            </p>
          </DialogHeader>

          {/* Items list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            <div className="space-y-2">
              {orderItems.map((item) => {
                const unitPrice = parseFloat(String(item.coffeeItem.price)) || 0;
                const itemAddons = item.customization?.selectedItemAddons || [];
                const addonsTotal = itemAddons.reduce((s: number, a: any) => s + (parseFloat(String(a.price)) || 0), 0);
                const lineTotal = (unitPrice + addonsTotal) * item.quantity;
                return (
                  <div
                    key={item.lineItemId}
                    className="flex items-start gap-3 p-3 rounded-xl border bg-card"
                    data-testid={`review-item-${item.lineItemId}`}
                  >
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-snug">{item.coffeeItem.nameAr}</p>
                      {item.coffeeItem.nameEn && (
                        <p className="text-xs text-muted-foreground">{item.coffeeItem.nameEn}</p>
                      )}
                      {itemAddons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {itemAddons.map((a: any, i: number) => (
                            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                              +{a.nameAr || a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className="w-7 h-7 rounded-full border bg-muted flex items-center justify-center text-base font-bold hover:bg-destructive/10 transition-colors"
                        onClick={() => updateQuantity(item.lineItemId, item.quantity - 1)}
                        data-testid={`review-qty-dec-${item.lineItemId}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-black" data-testid={`review-qty-${item.lineItemId}`}>{item.quantity}</span>
                      <button
                        className="w-7 h-7 rounded-full border bg-muted flex items-center justify-center text-base font-bold hover:bg-primary/10 transition-colors"
                        onClick={() => updateQuantity(item.lineItemId, item.quantity + 1)}
                        data-testid={`review-qty-inc-${item.lineItemId}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line price */}
                    <div className="text-sm font-black text-primary shrink-0 w-16 text-left" data-testid={`review-price-${item.lineItemId}`}>
                      {lineTotal.toFixed(2)}
                    </div>

                    {/* Delete */}
                    <button
                      className="w-7 h-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      onClick={() => updateQuantity(item.lineItemId, 0)}
                      data-testid={`review-delete-${item.lineItemId}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary + payment method + action buttons */}
          <div className="px-5 pt-3 pb-5 border-t bg-muted/20 shrink-0 space-y-3">
            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('pos.subtotal')}</span>
                <span className="font-bold">{calculateSubtotal.toFixed(2)} {t('pos.currency')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('pos.tax')}</span>
                <span className="font-bold">{(calculateTotal - calculateSubtotal).toFixed(2)} {t('pos.currency')}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-1">
                <span className="font-black text-base">{t('pos.total')}</span>
                <span className={`font-black text-xl ${(usePoints && pointsDiscount > 0) || appliedDiscount ? 'line-through text-muted-foreground text-base' : 'text-primary'}`}>{calculateTotal.toFixed(2)} {t('pos.currency')}</span>
              </div>
              {usePoints && pointsDiscount > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span className="font-bold">{i18n.language === 'ar' ? 'خصم بطاقة مكان الشيف' : 'Chef Card Discount'}</span>
                  <span className="font-bold">- {pointsDiscount.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
              {appliedDiscount && couponDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="font-bold">{tc('كوبون', 'Coupon')} {appliedDiscount.code} ({appliedDiscount.percentage}%)</span>
                  <span className="font-bold">- {couponDiscountAmount.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
              {((usePoints && pointsDiscount > 0) || appliedDiscount) && (
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="font-black text-base">{i18n.language === 'ar' ? 'الإجمالي النهائي' : 'Final Total'}</span>
                  <span className="font-black text-xl text-primary">{calculateGrandTotal.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
            </div>

            {/* Order note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {i18n.language === 'ar' ? 'ملاحظة على الطلب' : 'Order Note'}
              </label>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder={i18n.language === 'ar' ? 'أضف ملاحظة أو تعليمات خاصة...' : 'Add a note or special instructions...'}
                rows={2}
                className="w-full rounded-xl border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 text-right placeholder:text-muted-foreground"
                dir="auto"
                data-testid="input-order-note"
              />
            </div>

            {/* Payment method (read-only summary) */}
            <div className="flex items-center gap-2 bg-card border rounded-xl px-4 py-2.5">
              {(() => {
                const m = PAYMENT_METHODS.find(m => m.id === paymentMethod);
                if (!m) return null;
                const IconComp = m.icon;
                return (
                  <>
                    <IconComp className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-bold flex-1">{t(m.tKey)}</span>
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={() => setShowOrderReview(false)}
                      data-testid="review-change-payment"
                    >
                      {i18n.language === 'ar' ? 'تغيير' : 'Change'}
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                className="h-11 font-bold gap-2"
                onClick={() => setShowOrderReview(false)}
                data-testid="review-back-btn"
              >
                <ArrowRight className="w-4 h-4" />
                {i18n.language === 'ar' ? 'رجوع' : 'Back'}
              </Button>
              <Button
                className="h-11 font-black gap-2 shadow-lg shadow-primary/20"
                disabled={orderItems.length === 0 || syncing}
                onClick={async () => {
                  setShowOrderReview(false);
                  await handleCheckout();
                }}
                data-testid="review-confirm-pay-btn"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {i18n.language === 'ar' ? 'إتمام الدفع' : 'Confirm Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                {t('pos.receipt_title')}
              </div>
              {receiptCountdown > 0 && (
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
                  {receiptCountdown}s
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {lastOrder && (
            <div className="space-y-4">
              <div className="text-center space-y-2 border-b pb-4">
                <img
                  src="/logo.png"
                  alt="مكان الشيف البخاري"
                  className="w-20 h-20 object-contain mx-auto mb-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <h3 className="font-black text-xl text-primary">مكان الشيف البخاري</h3>
                {lastOrder.isOffline && (
                  <div className="flex items-center justify-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2">
                    <span className="text-amber-600 dark:text-amber-400 text-sm">📶</span>
                    <div className="text-right">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {i18n.language === 'ar' ? 'طلب محفوظ بدون إنترنت' : 'Saved Offline'}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {i18n.language === 'ar' ? 'سيُرسل تلقائياً عند استعادة الاتصال' : 'Will sync when back online'}
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(lastOrder.date).toLocaleDateString()} - {new Date(lastOrder.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className={`mt-2 py-3 px-4 rounded-2xl border ${lastOrder.isOffline ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700' : 'bg-primary/10 border-primary/20'}`} data-testid="text-receipt-order-number">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {i18n.language === 'ar' ? 'رقم الطلب' : 'Order Number'}
                  </p>
                  <p className={`text-4xl font-black tracking-wide ${lastOrder.isOffline ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
                    {fmtOrderNum(lastOrder.orderNumber)}
                  </p>
                  {lastOrder.isOffline && (
                    <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">
                      {i18n.language === 'ar' ? 'رقم مؤقت — سيتغير عند المزامنة' : 'Temp number — will update on sync'}
                    </p>
                  )}
                </div>
              </div>

              {(lastOrder.customerName || lastOrder.customerPhone) && (
                <div className="text-xs space-y-0.5 border-b pb-2">
                  {lastOrder.customerName && <p>{t('pos.customer_label')} <span className="font-bold">{lastOrder.customerName}</span></p>}
                  {lastOrder.customerPhone && <p>{t('pos.phone_label')} <span className="font-bold" dir="ltr">{lastOrder.customerPhone}</span></p>}
                </div>
              )}

              <div className="space-y-1.5">
                {lastOrder.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm" data-testid={`receipt-item-${idx}`}>
                    <div className="flex-1">
                      <span className="font-medium">{item.coffeeItem.nameAr}</span>
                      <span className="text-muted-foreground mr-1">x{item.quantity}</span>
                    </div>
                    <span className="font-bold">{(Number(item.coffeeItem.price) * item.quantity).toFixed(2)} {t('pos.currency')}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pos.subtotal')}</span>
                  <span className="font-bold">{lastOrder.subtotal.toFixed(2)} {t('pos.currency')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pos.tax')}</span>
                  <span className="font-bold">{lastOrder.tax.toFixed(2)} {t('pos.currency')}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-black text-base">{t('pos.total')}</span>
                  <span className="font-black text-lg text-primary">{lastOrder.total.toFixed(2)} {t('pos.currency')}</span>
                </div>
              </div>

              <div className="text-xs space-y-0.5 border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pos.payment_label')}</span>
                  <span className="font-bold">{PAYMENT_METHOD_LABELS[lastOrder.paymentMethod] || lastOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pos.employee_label')}</span>
                  <span className="font-bold">{lastOrder.employeeName}</span>
                </div>
                {lastOrder.tableNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('pos.table_label_receipt')}</span>
                    <span className="font-bold">{lastOrder.tableNumber}</span>
                  </div>
                )}
              </div>

              {lastPrintFailed && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-right">
                  <span className="text-lg mt-0.5">⚠️</span>
                  <div className="flex-1 text-xs text-red-700 dark:text-red-400">
                    <p className="font-bold mb-1">لم تتم الطباعة</p>
                    <p>افتح إعدادات الطابعة ← اختر الطابعة (USB) ← ثم اضغط "طباعة" أدناه</p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2 sticky bottom-0 bg-background pb-1">
                <Button
                  className="w-full gap-2 h-11 text-base font-bold"
                  onClick={() => { setShowReceiptDialog(false); }}
                  data-testid="button-new-order"
                >
                  <Plus className="w-5 h-5" />
                  {t('pos.new_order_btn')}
                  {receiptCountdown > 0 && (
                    <span className="mr-1 text-xs opacity-70">({receiptCountdown})</span>
                  )}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={`flex-1 gap-2 ${lastPrintFailed ? 'border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30' : ''}`}
                    onClick={() => { setLastPrintFailed(false); setReceiptCountdown(0); handlePrintReceipt(); }}
                    data-testid="button-print-receipt"
                  >
                    <Printer className="w-4 h-4" />
                    {lastPrintFailed ? tc('إعادة الطباعة', 'Retry Print') : t('pos.print_invoice')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 gap-2"
                    data-testid="button-preview-receipt"
                    onClick={async () => {
                      if (!lastOrder) return;
                      const previewData = {
                        orderNumber: lastOrder.orderNumber,
                        customerName: lastOrder.customerName,
                        customerPhone: lastOrder.customerPhone,
                        items: lastOrder.items,
                        subtotal: lastOrder.subtotal.toFixed(2),
                        total: lastOrder.total.toFixed(2),
                        paymentMethod: lastOrder.paymentMethod,
                        employeeName: lastOrder.employeeName,
                        tableNumber: lastOrder.tableNumber,
                        orderType: lastOrder.orderType,
                        date: lastOrder.date,
                        splitPayment: lastOrder.splitPayment,
                      };
                      const [custHtml, empHtml] = await Promise.all([
                        buildReceiptPreviewHtml(previewData),
                        Promise.resolve(buildEmployeeReceiptPreviewHtml(previewData)),
                      ]);
                      setReceiptPreviewHtml(custHtml);
                      setEmployeeReceiptPreviewHtml(empHtml);
                      setPreviewTab('customer');
                      setShowReceiptPreview(true);
                    }}
                  >
                    <Receipt className="w-4 h-4" />
                    {tc('معاينة', 'Preview')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Receipt visual preview modal ──────────────────────────────────── */}
      <Dialog open={showReceiptPreview} onOpenChange={setShowReceiptPreview}>
        <DialogContent className="max-w-md max-h-[96vh] p-0 overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-4 h-4 text-primary" />
              معاينة الفاتورة
            </DialogTitle>
          </DialogHeader>
          {/* Tab switcher */}
          <div className="shrink-0 flex border-b bg-muted/40">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${previewTab === 'customer' ? 'bg-background border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setPreviewTab('customer')}
              data-testid="tab-preview-customer"
            >نسخة العميل</button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${previewTab === 'employee' ? 'bg-background border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setPreviewTab('employee')}
              data-testid="tab-preview-employee"
            >نسخة الموظف</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#f5f5f0]">
            {previewTab === 'customer' && receiptPreviewHtml && (
              <iframe
                srcDoc={receiptPreviewHtml}
                title="receipt-preview-customer"
                className="w-full border-0"
                style={{ height: '700px', minHeight: '500px' }}
                sandbox="allow-same-origin"
              />
            )}
            {previewTab === 'employee' && employeeReceiptPreviewHtml && (
              <iframe
                srcDoc={employeeReceiptPreviewHtml}
                title="receipt-preview-employee"
                className="w-full border-0"
                style={{ height: '700px', minHeight: '500px' }}
                sandbox="allow-same-origin"
              />
            )}
          </div>
          <div className="shrink-0 flex gap-2 p-3 border-t bg-background">
            <Button
              className="flex-1 gap-2"
              onClick={() => {
                setShowReceiptPreview(false);
                setLastPrintFailed(false);
                handlePrintReceipt();
              }}
              data-testid="button-preview-print"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowReceiptPreview(false)}
              data-testid="button-preview-close"
            >
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DrinkCustomizationDialog
        coffeeItem={posCustomizationItem?.item || null}
        variants={posCustomizationItem?.group || []}
        open={!!posCustomizationItem}
        modal={false}
        onClose={() => setPosCustomizationItem(null)}
        onConfirm={(customization: DrinkCustomization, _quantity: number, selectedVariant?: CoffeeItem) => {
          const targetItem = selectedVariant || posCustomizationItem?.item;
          if (!targetItem) return;
          const selectedItemAddons = customization.selectedAddons.map(addon => ({
            nameAr: addon.nameAr + (addon.quantity > 1 ? ` ×${addon.quantity}` : ''),
            nameEn: addon.nameAr,
            price: addon.price * addon.quantity,
          }));
          addToOrder(targetItem, selectedItemAddons.length > 0 ? { selectedItemAddons } : undefined);
          setPosCustomizationItem(null);
        }}
      />

      <Dialog open={showTablesDialog} onOpenChange={setShowTablesDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5" />
              {t('pos.tables_title', { count: tables.length })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            {tables.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">{t('pos.no_tables')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                {tables.map((table: any) => {
                  const isOccupied = table.isOccupied === 1 || table.isOccupied === true;
                  const isReserved = !!table.reservationInfo;
                  const isAvailable = !isOccupied && !isReserved;
                  const borderColor = isAvailable ? 'border-green-500' : isReserved ? 'border-yellow-500' : 'border-red-500';
                  const bgColor = isAvailable ? 'bg-green-500/5' : isReserved ? 'bg-yellow-500/5' : 'bg-red-500/5';

                  return (
                    <Card
                      key={table.id || table._id}
                      className={`border-2 ${borderColor} ${bgColor} cursor-pointer transition-all`}
                      onClick={() => {
                        if (isAvailable) {
                          setTableNumber(String(table.tableNumber || table.number));
                          setOrderType("dine_in");
                          setShowTablesDialog(false);
                          toast({ title: t('pos.table_selected'), description: t('pos.table_selected_desc', { number: table.tableNumber || table.number }) });
                        }
                      }}
                      data-testid={`table-card-${table.id || table._id}`}
                    >
                      <CardContent className="p-3 text-center space-y-2">
                        <div className="text-2xl font-black">{table.tableNumber || table.number}</div>
                        <Badge
                          variant={isAvailable ? "default" : "secondary"}
                          className={`text-[10px] ${isAvailable ? 'bg-green-600' : isReserved ? 'bg-yellow-500 text-black' : 'bg-red-600'}`}
                          data-testid={`table-status-${table.id || table._id}`}
                        >
                          {isAvailable ? t('pos.table_available') : isReserved ? t('pos.table_reserved') : t('pos.table_occupied')}
                        </Badge>
                        {table.capacity && (
                          <p className="text-[10px] text-muted-foreground">{t('pos.capacity', { count: table.capacity })}</p>
                        )}
                        {isOccupied && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              emptyTableMutation.mutate(table.id || table._id);
                            }}
                            disabled={emptyTableMutation.isPending}
                            data-testid={`button-empty-table-${table.id || table._id}`}
                          >
                            <X className="w-3 h-3 ml-1" />
                            {t('pos.empty_table')}
                          </Button>
                        )}
                        {isReserved && table.reservationInfo && (
                          <p className="text-[10px] text-yellow-600 font-medium">
                            {table.reservationInfo.customerName || t('pos.active_reservation')}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOpenBillsDialog} onOpenChange={(open) => { setShowOpenBillsDialog(open); if (!open) setSelectedTableForBill(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {t('pos.open_bills_title', { count: openTableOrders.length })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            {openTableOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">{t('pos.no_open_bills')}</p>
              </div>
            ) : (
              <div className="space-y-3 p-1">
                {openTableOrders.map((order: any) => {
                  const orderItems = Array.isArray(order.items) ? order.items : [];
                  const total = Number(order.totalAmount || 0);
                  const elapsed = order.createdAt ? Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000) : 0;
                  const isSelectedForClose = selectedTableForBill?.id === order.id;
                  const statusLabels: Record<string, string> = {
                    'pending': t('pos.status_pending'),
                    'in_progress': t('pos.status_in_progress'),
                    'ready': t('pos.status_ready'),
                  };

                  return (
                    <Card key={order.id || order._id} className="border-2" data-testid={`open-bill-${order.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-lg">{t('pos.table_number_label', { number: order.tableNumber })}</span>
                              <Badge variant="secondary" className="text-xs">{fmtOrderNum(order.orderNumber)}</Badge>
                              <Badge variant="outline" className="text-xs">
                                {statusLabels[order.status] || order.status}
                              </Badge>
                            </div>
                            {elapsed > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {t('pos.ago_minutes', { count: elapsed })}
                              </p>
                            )}
                          </div>
                          <div className="text-left">
                            <span className="font-black text-primary text-lg">{total.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground mr-1">{t('pos.currency')}</span>
                          </div>
                        </div>

                        <div className="border-t pt-2">
                          {orderItems.slice(0, 5).map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs py-0.5">
                              <span>{item.name || item.nameAr || item.coffeeItem?.nameAr} x{item.quantity || 1}</span>
                              <span className="text-muted-foreground">{Number(item.price || item.unitPrice || 0).toFixed(2)}</span>
                            </div>
                          ))}
                          {orderItems.length > 5 && (
                            <p className="text-xs text-muted-foreground mt-1">{t('pos.more_items', { count: orderItems.length - 5 })}</p>
                          )}
                        </div>

                        {isSelectedForClose ? (
                          <div className="border-t pt-3 space-y-3">
                            <p className="text-sm font-bold">{t('pos.select_payment')}</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {PAYMENT_METHODS.map((method) => (
                                <Button
                                  key={method.id}
                                  variant={billPaymentMethod === method.id ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setBillPaymentMethod(method.id as PaymentMethod)}
                                  className="flex flex-col gap-0.5 h-auto py-2 text-[10px]"
                                  data-testid={`bill-payment-${method.id}`}
                                >
                                  <method.icon className="w-4 h-4" />
                                  <span className="font-bold">{t((method as any).tKey)}</span>
                                </Button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1 gap-2"
                                onClick={() => closeBillMutation.mutate({ orderId: order.id || order._id, payMethod: billPaymentMethod })}
                                disabled={closeBillMutation.isPending}
                                data-testid={`button-confirm-close-bill-${order.id}`}
                              >
                                {closeBillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                {t('pos.confirm_print')}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setSelectedTableForBill(null)}
                                data-testid={`button-cancel-close-bill-${order.id}`}
                              >
                                {t('pos.cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap border-t pt-2">
                            <Button
                              size="sm"
                              onClick={() => { setSelectedTableForBill(order); setBillPaymentMethod("cash"); }}
                              data-testid={`button-close-bill-${order.id}`}
                            >
                              <Banknote className="w-3 h-3 ml-1" />
                              {t('pos.close_bill')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrintLiveOrder(order)}
                              data-testid={`button-print-bill-${order.id}`}
                            >
                              <Printer className="w-3 h-3 ml-1" />
                              {t('pos.print')}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Printer Settings Dialog ─────────────────────────────────────────── */}
      <Dialog open={showPrinterSettings} onOpenChange={setShowPrinterSettings}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right font-bold text-xl">
              <Printer className="w-5 h-5" />
              {tc("إعدادات الطابعة", "Printer Settings")}
            </DialogTitle>
          </DialogHeader>
          <PrinterSettingsPanel />
        </DialogContent>
      </Dialog>

      <Dialog open={showPOSSettings} onOpenChange={setShowPOSSettings}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-right font-bold text-xl">{t('pos.settings_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Printer quick link */}
            <button
              onClick={() => { setShowPOSSettings(false); setShowPrinterSettings(true); }}
              className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group"
              data-testid="button-open-printer-settings"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20">
                  <Printer className="w-5 h-5 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{tc("إعدادات الطابعة", "Printer Settings")}</p>
                  <p className="text-xs text-muted-foreground">
                    {printerMode === 'network'
                      ? tc("شبكة LAN — ProPos / Epson LAN", "Network LAN — ProPos / Epson LAN")
                      : printerMode === 'bluetooth'
                        ? tc("بلوتوث BLE — انقر للإعداد", "Bluetooth BLE — Click to configure")
                        : printerMode === 'webusb'
                          ? tc("USB مباشر — متصلة", "Direct USB — Connected")
                          : tc("متصفح — انقر لإعداد الطابعة", "Browser — Click to configure printer")
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${printerMode === 'network' ? 'bg-blue-500' : printerMode === 'bluetooth' ? 'bg-purple-500' : printerMode === 'webusb' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-print" className="text-sm font-bold cursor-pointer">{t('pos.auto_print')}</Label>
              <Switch id="auto-print" checked={autoPrint} onCheckedChange={setAutoPrint} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sound-notif" className="text-sm font-bold cursor-pointer">{t('pos.sound_notif')}</Label>
              <div className="flex items-center gap-2">
                {soundEnabled && (
                  <button
                    onClick={() => testSound('newOrder', 0.8)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    title={tc("اختبار الصوت","Test sound")}
                    data-testid="button-test-sound-settings"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{tc("اختبار","Test")}</span>
                  </button>
                )}
                <Switch id="sound-notif" checked={soundEnabled} onCheckedChange={(val) => { setSoundEnabled(val); saveSoundEnabled('pos', val); }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-vat" className="text-sm font-bold cursor-pointer">{t('pos.show_vat')}</Label>
              <Switch id="show-vat" checked={showVatLabel} onCheckedChange={setShowVatLabel} />
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">{tc("حجم الشاشة (Zoom)","Screen Size (Zoom)")}</Label>
                <span className="text-sm font-mono font-bold text-primary">{posZoom}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={posZoom <= 60}
                  onClick={() => setPosZoom(z => Math.max(60, z - 5))}
                  data-testid="button-zoom-out"
                >
                  <span className="text-lg font-bold">−</span>
                </Button>
                <div className="flex-1 flex justify-center gap-1">
                  {[70, 80, 90, 100].map(v => (
                    <Button
                      key={v}
                      variant={posZoom === v ? "default" : "outline"}
                      size="sm"
                      className="flex-1 text-xs px-1"
                      onClick={() => setPosZoom(v)}
                      data-testid={`button-zoom-${v}`}
                    >
                      {v}%
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={posZoom >= 100}
                  onClick={() => setPosZoom(z => Math.min(100, z + 5))}
                  data-testid="button-zoom-in"
                >
                  <span className="text-lg font-bold">+</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                {tc("قلل الحجم لتناسب الشاشات الصغيرة دون تشويه","Reduce size to fit small screens without distortion")}
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pos-terminal" className="text-sm font-bold cursor-pointer block">{t('pos.terminal_connection')}</Label>
                <p className="text-xs text-muted-foreground mt-1">{posTerminalConnected ? t('pos.connected_status') : t('pos.disconnected_status')}</p>
              </div>
              <Switch id="pos-terminal" checked={posTerminalConnected} onCheckedChange={setPosTerminalConnected} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
