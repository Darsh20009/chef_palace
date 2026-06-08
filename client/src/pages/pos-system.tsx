import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRealtimeEvent, useRealtimeStatus, useRealtimeSend } from "@/hooks/useRealtimeEngine";
import { getSoundEnabled, setSoundEnabled as saveSoundEnabled, testSound, playNotificationSound, playChannelSound, getChannelConfig } from "@/lib/notification-sounds";
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
  PauseCircle, Receipt, Settings, User, Wallet, RotateCcw,
  Percent, DollarSign, FolderOpen, Hash, Merge, Users, Scissors, Car,
  Home, MoreHorizontal
} from "lucide-react";
import {
  type CartSnapshot, type HeldCart as HeldCartType, type LineItemDiscount, type OrderDiscount,
  type ServiceCharge as ServiceChargeConfig, type PersonPayment,
  computeUnitPrice, computeTotalItemDiscounts, computeServiceChargeAmount,
  computeOrderDiscountAmount, mergeCartItems, computePOSTotals, newCartId, blankCart
} from "@/lib/pos-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import SarIcon from "@/components/sar-icon";
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
  fmtOrderNum,
  printReceiptSection,
  openReceiptPreviewWindow,
  prewarmZatcaQr,
} from "@/lib/print-utils";
import { preRenderReceiptPng } from "@/lib/receipt-png-cache";
import { QuickSidebar } from "@/components/quick-sidebar";
import QrPayModal from "@/components/qr-pay-modal";
import { QrCode } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import DrinkCustomizationDialog, { type DrinkCustomization } from "@/components/drink-customization-dialog";
import PrinterSettingsPanel from "@/components/printer-settings-panel";
import { SoundSettingsPanel } from "@/components/sound-settings-panel";
import { loadPrinterSettings } from "@/lib/thermal-printer";
import RefundDialog from "@/components/refund-dialog";
import { PosShiftBar } from "@/components/pos-shift-bar";

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
  { id: "split", icon: SplitSquareVertical, tKey: "pos.payment_split" },
];

export default function PosSystem() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: tc("نقدي","Cash"),
    card: tc("شبكة","Network"),
    "qahwa-card": tc("بطاقة مكان الشيف","مكان الشيف Card"),
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
  const [personPayments, setPersonPayments] = useState<PersonPayment[]>([
    { id: '1', method: 'cash', amount: '' },
  ]);
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
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'online' | 'pos' | 'car'>('all');
  const [carPreparationAlerts, setCarPreparationAlerts] = useState<any[]>([]);
  const [showCarOrdersPanel, setShowCarOrdersPanel] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [qrPayOpen, setQrPayOpen] = useState(false);
  const [qrPayOrder, setQrPayOrder] = useState<{ id: string; orderNumber: string; amount: number } | null>(null);
  const [creatingQrPay, setCreatingQrPay] = useState(false);
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
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [printerMode] = useState(() => loadPrinterSettings().mode);
  const [autoPrint, setAutoPrint] = useState(() => {
    const stored = localStorage.getItem("pos-auto-print");
    return stored === null ? true : stored === "true"; // default ON
  });
  const [showVatLabel, setShowVatLabel] = useState(() => localStorage.getItem("pos-show-vat-label") === "true");
  const [posCustomizationItem, setPosCustomizationItem] = useState<{ item: CoffeeItem; group: CoffeeItem[]; initialCustomization?: DrinkCustomization } | null>(null);
  const [showOrderReview, setShowOrderReview] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [carTypeInput, setCarTypeInput] = useState("");
  const [carColorInput, setCarColorInput] = useState("");
  const [carPlateInput, setCarPlateInput] = useState("");
  const [posZoom, setPosZoom] = useState<number>(() => {
    const saved = localStorage.getItem("pos-zoom");
    return saved ? Number(saved) : 100;
  });
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // ── Stable callback refs (prevents TDZ in keyboard useEffect) ────────────
  const newCartTabRef     = useRef<() => void>(() => {});
  const holdCurrentCartRef = useRef<() => void>(() => {});

  // ── POS Engine: Multi-Cart, Hold, Service Charge, Discounts ──────────────
  interface CartTab { id: string; name: string; itemCount: number; total: number; createdAt: number; }

  const [cartTabs, setCartTabs] = useState<CartTab[]>([{ id: 'main', name: tc('طلب 1','Order 1'), itemCount: 0, total: 0, createdAt: Date.now() }]);
  const [activeTabId, setActiveTabId] = useState('main');
  const [heldCarts, setHeldCarts] = useState<HeldCartType[]>(() => {
    try { return JSON.parse(localStorage.getItem('pos-held-carts') || '[]'); } catch { return []; }
  });
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [showMergeBills, setShowMergeBills] = useState(false);

  // Service charge
  const [serviceCharge, setServiceCharge] = useState<ServiceChargeConfig>({ enabled: false, type: 'percent', value: 10 });

  // Per-item discounts: Record<lineItemId, {type, value}>
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, LineItemDiscount>>({});
  const [showItemDiscountFor, setShowItemDiscountFor] = useState<string | null>(null);
  const [itemDiscountInput, setItemDiscountInput] = useState('');
  const [itemDiscountType, setItemDiscountType] = useState<'percent' | 'amount'>('percent');

  // Manual order-level discount
  const [manualDiscount, setManualDiscount] = useState<OrderDiscount | undefined>(undefined);
  const [showManualDiscount, setShowManualDiscount] = useState(false);
  const [manualDiscountInput, setManualDiscountInput] = useState('');
  const [manualDiscountType, setManualDiscountType] = useState<'percent' | 'amount'>('percent');

  // Split by persons
  const [showSplitPersons, setShowSplitPersons] = useState(false);
  const [splitPersons, setSplitPersons] = useState(2);

  // Saved cart snapshots for tab switching (stored as map cartId → CartSnapshot)
  const savedTabsRef = useRef<Record<string, Partial<CartSnapshot>>>({});

  // ── RealtimeEngine WebSocket (replaces legacy useOrderWebSocket) ─────────────
  const { connected: wsConnected } = useRealtimeStatus();
  const { send: rtSend } = useRealtimeSend();

  useRealtimeEvent("new_order", (order: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
    const isOnlineWebOrder = order?.channel === 'online' || order?.channel === 'web';
    const isPosOrder = order?.channel === 'pos';
    if (isOnlineWebOrder) {
      setNewOrdersCount(prev => prev + 1);
      playChannelSound('online');
      toast({
        title: t('pos.new_order_toast'),
        description: t('pos.new_order_toast_desc', {
          number: order?.orderNumber ? fmtOrderNum(order.orderNumber) : '',
          amount: order?.totalAmount || 0,
        }),
      });
      const printerSettings = loadPrinterSettings();
      if (printerSettings.autoPrint && order?.items?.length > 0) {
        const onlineOrderType = order.orderType || 'online';
        const onlineOrderTypeName =
          onlineOrderType === 'dine_in'    || onlineOrderType === 'dine-in'    ? 'محلي'   :
          onlineOrderType === 'takeaway'   || onlineOrderType === 'pickup'     ? 'سفري'   :
          onlineOrderType === 'delivery'                                        ? 'توصيل'  :
          onlineOrderType === 'car_pickup' || onlineOrderType === 'car-pickup' ? 'سيارة'  :
          'أونلاين';
        const printData = {
          orderNumber: String(order.orderNumber || order.dailyNumber || order._id?.slice(-4) || '0'),
          customerName: order.customerName || 'عميل أونلاين',
          customerPhone: order.customerPhone || '',
          items: (order.items || []).map((item: any) => ({
            coffeeItem: {
              nameAr: item.coffeeItem?.nameAr || item.nameAr || '',
              nameEn: item.coffeeItem?.nameEn || item.nameEn || '',
              price: String(item.price || item.unitPrice || item.coffeeItem?.price || 0),
            },
            quantity: item.quantity || 1,
            selectedSize: item.selectedSize || undefined,
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
    } else if (!isPosOrder) {
      playChannelSound('manual');
    }
  });

  useRealtimeEvent("order_updated", () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
  });

  useRealtimeEvent("car_preparation_alert", (order: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/curbside"] });
    setCarPreparationAlerts(prev => {
      if (prev.some(a => a._id === order._id)) return prev;
      return [order, ...prev];
    });
    playChannelSound('car');
    toast({
      title: `🚗 طلب سيارة — وصول خلال ${order.diffMin ?? '≤10'} دقيقة!`,
      description: `${order.customerName || 'عميل'} | ${order.carColor || ''} ${order.carType || ''} | لوحة: ${order.plateNumber || '—'}`,
      duration: 15000,
    });
    // Auto-print kitchen preparation ticket
    const printerSettings = loadPrinterSettings();
    if (printerSettings.autoPrint && order?.items?.length > 0) {
      import('@/lib/print-utils').then(({ printTaxInvoice }) => {
        printTaxInvoice({
          orderNumber: String(order.orderNumber || order.dailyNumber || ''),
          customerName: order.customerName || 'سيارة',
          customerPhone: order.customerPhone || '',
          items: (order.items || []).map((item: any) => ({
            coffeeItem: {
              nameAr: item.coffeeItem?.nameAr || item.nameAr || '',
              nameEn: item.coffeeItem?.nameEn || item.nameEn || '',
              price: String(item.coffeeItem?.price || item.price || 0),
            },
            quantity: item.quantity || 1,
          })),
          subtotal: String(Number(order.totalAmount || 0) / 1.15),
          total: String(order.totalAmount || 0),
          paymentMethod: 'نقدي عند الاستلام',
          employeeName: employee?.fullName || '',
          orderType: 'car_pickup' as any,
          orderTypeName: `🚗 سيارة — ${order.carColor || ''} ${order.carType || ''} (${order.plateNumber || ''}) — يصل ${order.arrivalTime || ''}`,
          date: new Date().toISOString(),
        }, { autoPrint: true });
      }).catch(() => {});
    }
  });

  const broadcastToDisplay = useCallback((event: string, data?: any) => {
    rtSend("pos_cart_update", { event, ...data });
  }, [rtSend]);

  useEffect(() => {
    localStorage.setItem("pos-terminal-connected", String(posTerminalConnected));
  }, [posTerminalConnected]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    if (!showCategoryDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCategoryDropdown]);

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

  // Auto-generate new-design receipt HTML whenever an order completes
  useEffect(() => {
    if (!lastOrder || !showReceiptDialog) return;
    setReceiptPreviewHtml('');
    const previewData = {
      orderNumber: lastOrder.orderNumber,
      customerName: lastOrder.customerName,
      customerPhone: lastOrder.customerPhone,
      items: lastOrder.items,
      subtotal: String(lastOrder.subtotal),
      total: String(lastOrder.total),
      paymentMethod: PAYMENT_METHOD_LABELS[lastOrder.paymentMethod] || lastOrder.paymentMethod,
      employeeName: lastOrder.employeeName,
      tableNumber: lastOrder.tableNumber,
      orderType: lastOrder.orderType,
      date: lastOrder.date,
      splitPayment: lastOrder.splitPayment,
    };
    buildReceiptPreviewHtml(previewData).then(html => setReceiptPreviewHtml(html)).catch(() => {});
  }, [lastOrder, showReceiptDialog]);

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

      // / or F2 → focus search
      if ((e.key === '/' || e.key === 'F2') && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // Escape → clear search or close dialogs
      if (e.key === 'Escape') {
        if (showItemDiscountFor) { setShowItemDiscountFor(null); return; }
        if (showHeldCarts) { setShowHeldCarts(false); return; }
        if (showMergeBills) { setShowMergeBills(false); return; }
        if (isInput) { setSearchQuery(''); (e.target as HTMLElement).blur(); return; }
      }
      // Ctrl+P → print receipt (via print queue, not window.print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && orderItems.length > 0) {
        e.preventDefault();
        const printEvent = new CustomEvent('qirox:pos-print-shortcut');
        window.dispatchEvent(printEvent);
        return;
      }
      // Ctrl+F → focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // F4 → new cart tab
      if (e.key === 'F4' && !isInput) {
        e.preventDefault();
        newCartTabRef.current();
        return;
      }
      // F5 → hold current cart
      if (e.key === 'F5' && !isInput) {
        e.preventDefault();
        holdCurrentCartRef.current();
        return;
      }
      // F6 → show held carts
      if (e.key === 'F6' && !isInput) {
        e.preventDefault();
        setShowHeldCarts(true);
        return;
      }
      // F3 → toggle incoming orders panel
      if (e.key === 'F3' && !isInput) {
        e.preventDefault();
        setShowOrdersPanel(prev => { if (!prev) setNewOrdersCount(0); return !prev; });
        return;
      }
      // F7 → toggle service charge
      if (e.key === 'F7' && !isInput) {
        e.preventDefault();
        setServiceCharge(prev => ({ ...prev, enabled: !prev.enabled }));
        return;
      }
      // F8 → toggle customer lookup
      if (e.key === 'F8' && !isInput) {
        e.preventDefault();
        setShowCustomerInfo(v => !v);
        return;
      }
      // F9 → open bills
      if (e.key === 'F9' && !isInput) {
        e.preventDefault();
        setShowOpenBillsDialog(true);
        return;
      }
      // F10 → tables
      if (e.key === 'F10' && !isInput) {
        e.preventDefault();
        setShowTablesDialog(true);
        return;
      }
      // Ctrl+D → manual discount
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isInput) {
        e.preventDefault();
        setShowManualDiscount(true);
        return;
      }
      // Ctrl+M → merge bills
      if ((e.ctrlKey || e.metaKey) && e.key === 'm' && !isInput) {
        e.preventDefault();
        setShowMergeBills(true);
        return;
      }
      // Ctrl+S → split bill
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !isInput) {
        e.preventDefault();
        setShowSplitPersons(true);
        return;
      }
      // Numpad +/- → adjust quantity of last item
      if (!isInput && orderItems.length > 0) {
        const lastItem = orderItems[orderItems.length - 1];
        if (e.key === 'NumpadAdd' || e.key === '+') {
          e.preventDefault();
          updateQuantity(lastItem.lineItemId, lastItem.quantity + 1);
          return;
        }
        if (e.key === 'NumpadSubtract' || e.key === '-') {
          e.preventDefault();
          updateQuantity(lastItem.lineItemId, Math.max(0, lastItem.quantity - 1));
          return;
        }
      }
      // Ctrl+H → hold current order
      if ((e.ctrlKey || e.metaKey) && e.key === 'h' && !isInput) {
        e.preventDefault();
        holdCurrentCartRef.current();
        return;
      }
      // Ctrl+T → new cart tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && !isInput) {
        e.preventDefault();
        newCartTabRef.current();
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [orderItems.length, showItemDiscountFor, showHeldCarts, showMergeBills]);

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
    staleTime: 30000,
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ['/api/business-config'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: allPaymentMethods = [] } = useQuery<any[]>({
    queryKey: ['/api/payment-methods'],
    staleTime: 5 * 60 * 1000,
  });

  const [showMorePayments, setShowMorePayments] = useState(false);

  const { data: tables = [], refetch: refetchTables } = useQuery<any[]>({
    queryKey: ["/api/tables/status", employee?.branchId],
    queryFn: async () => {
      const res = await fetch(`/api/tables/status?branchId=${employee?.branchId}`);
      return res.json();
    },
    enabled: !!employee?.branchId,
    staleTime: 60000,
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
      ['pending', 'payment_confirmed', 'confirmed', 'in_progress', 'ready', 'delivered', 'received', 'suspended'].includes(o.status) && 
      o.tableNumber && 
      (o.orderType === 'dine_in' || o.orderType === 'dine-in')
    );
  }, [liveOrders]);

  // ── 10-minute pre-warning for scheduled orders (car pickup / pre-paid table) ──
  const { data: kitchenOrdersForAlert = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/kitchen"],
    staleTime: 60000,
    select: (orders: any[]) =>
      (orders || []).filter((o: any) => o.scheduledPickupTime && o.preparationHoldUntil),
  });

  const alertedPosPreWarningIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!kitchenOrdersForAlert.length) return;
    const now = Date.now();
    const newWarnings = kitchenOrdersForAlert.filter((o: any) => {
      if (!o.preparationHoldUntil) return false;
      const holdTime = new Date(o.preparationHoldUntil).getTime();
      return (
        holdTime > now &&
        holdTime - now <= 10 * 60 * 1000 &&
        !alertedPosPreWarningIds.current.has(o.id || o._id)
      );
    });
    if (!newWarnings.length) return;
    newWarnings.forEach((o: any) => alertedPosPreWarningIds.current.add(o.id || o._id));
    newWarnings.forEach((o: any) => {
      const minsLeft = Math.ceil((new Date(o.preparationHoldUntil).getTime() - now) / 60000);
      toast({
        title: `⏰ تنبيه موعد — طلب #${o.orderNumber}`,
        description: `باقي ${minsLeft} دقيقة للموعد — ابدأ التحضير الآن!`,
        variant: "destructive",
      });
    });
  }, [kitchenOrdersForAlert, toast]);

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
    const allCounts = productsData
      .map((i: any) => i.salesCount || 0)
      .filter((c: number) => c > 0)
      .sort((a: number, b: number) => b - a);
    const bsThreshold = allCounts.length >= 3 ? allCounts[2] : (allCounts[0] || 1);
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
      .map(group => {
        const item = group[0] as any;
        return {
          ...item,
          isBestSeller: (item.salesCount || 0) >= bsThreshold && bsThreshold > 0,
        };
      });
  }, [productsData, selectedCategory, searchQuery, groupedItemsMap]);

  const visibleCategories = useMemo(() => {
    const itemCategorySet = new Set(productsData?.map(p => p.category).filter(Boolean) || []);
    return menuCategories
      .filter(c => itemCategorySet.has(c.id))
      .map(c => ({
        id: c.id,
        name: i18n.language === 'ar' ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr),
        icon: Tag,
        color: "text-primary"
      }));
  }, [productsData, menuCategories, i18n.language]);

  // Helper: get the correct unit price for a POS order item, respecting the selected size
  // Defined here (before calculateTotal) so it can be used in useMemo callbacks
  const getPosItemUnitPriceEarly = (item: any): number => {
    let base = Number(item.coffeeItem?.price) || 0;
    if (item.selectedSize && item.coffeeItem?.availableSizes) {
      const size = item.coffeeItem.availableSizes.find((s: any) => s.nameAr === item.selectedSize);
      if (size) base = Number(size.price) || 0;
    }
    const addonsPrice = (item.customization?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
    return base + addonsPrice;
  };

  const calculateTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + (getPosItemUnitPriceEarly(item) * item.quantity);
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderItems]);

  const pointsDiscount = useMemo(() => {
    if (!usePoints || customerPoints < 100) return 0;
    const maxDiscount = parseFloat((customerPoints / 50).toFixed(2));
    return Math.min(maxDiscount, calculateTotal);
  }, [usePoints, customerPoints, calculateTotal]);

  const calculateTotalAfterPoints = useMemo(() => Math.max(0, calculateTotal - pointsDiscount), [calculateTotal, pointsDiscount]);

  const calculateSubtotal = useMemo(() => calculateTotal / 1.15, [calculateTotal]);

  // Discount coupon (e.g. TECH10 — كلية التقنية للبنات بينبع)
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

  // ── New engine calculations ────────────────────────────────────────────────
  const itemDiscountTotal = useMemo(
    () => computeTotalItemDiscounts(orderItems, itemDiscounts),
    [orderItems, itemDiscounts]
  );
  const manualDiscountAmount = useMemo(
    () => computeOrderDiscountAmount(Math.max(0, calculateGrandTotal - itemDiscountTotal), manualDiscount),
    [calculateGrandTotal, itemDiscountTotal, manualDiscount]
  );
  const serviceChargeAmount = useMemo(
    () => computeServiceChargeAmount(Math.max(0, calculateGrandTotal - itemDiscountTotal - manualDiscountAmount), serviceCharge),
    [calculateGrandTotal, itemDiscountTotal, manualDiscountAmount, serviceCharge]
  );
  const finalGrandTotal = useMemo(
    () => Math.max(0, calculateGrandTotal - itemDiscountTotal - manualDiscountAmount + serviceChargeAmount),
    [calculateGrandTotal, itemDiscountTotal, manualDiscountAmount, serviceChargeAmount]
  );
  const finalSubtotal = useMemo(() => finalGrandTotal / 1.15, [finalGrandTotal]);
  const finalTax     = useMemo(() => finalGrandTotal - finalSubtotal, [finalGrandTotal, finalSubtotal]);

  // Sync tab item counts
  useEffect(() => {
    setCartTabs(prev => prev.map(t =>
      t.id === activeTabId
        ? { ...t, itemCount: orderItems.length, total: finalGrandTotal }
        : t
    ));
  }, [orderItems.length, finalGrandTotal, activeTabId]);

  // Persist held carts to localStorage
  useEffect(() => {
    localStorage.setItem('pos-held-carts', JSON.stringify(heldCarts));
  }, [heldCarts]);

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
    const total = items.reduce((s, i) => s + getPosItemUnitPrice(i) * i.quantity, 0);
    const subtotal = total / 1.15;
    const tax = total - subtotal;
    return {
      event,
      items: items.map(i => ({
        nameAr: i.coffeeItem.nameAr,
        price: getPosItemUnitPrice(i),
        quantity: i.quantity,
        lineItemId: i.lineItemId,
      })),
      subtotal,
      tax,
      total,
      ...extra,
    };
  };

  const getPosItemUnitPrice = getPosItemUnitPriceEarly;

  const addToOrder = (product: CoffeeItem, customization?: { selectedItemAddons: Array<{nameAr: string; nameEn?: string; price: number}> }, selectedSize?: string | null, quantity: number = 1, fullCustomization?: DrinkCustomization) => {
    const addonKey = JSON.stringify(customization?.selectedItemAddons || []);
    const sizeKey = selectedSize || '';
    const existing = orderItems.find(item => item.coffeeItem.id === product.id && item.selectedSize === sizeKey && JSON.stringify(item.customization?.selectedItemAddons || []) === addonKey);
    const next = existing
      ? orderItems.map(item =>
          item.coffeeItem.id === product.id && item.selectedSize === sizeKey && JSON.stringify(item.customization?.selectedItemAddons || []) === addonKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      : [...orderItems, {
          lineItemId: Math.random().toString(36).substr(2, 9),
          coffeeItem: product,
          quantity: quantity,
          selectedSize: sizeKey,
          customization: customization || {},
          _fullCustomization: fullCustomization,
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
    if (newQty <= 0) {
      // Remove item discount if item deleted
      setItemDiscounts(prev => { const n = { ...prev }; delete n[lineItemId]; return n; });
    }
    setOrderItems(next);
    if (next.length === 0) {
      broadcastToDisplay("order_cancelled", { items: [], subtotal: 0, tax: 0, total: 0 });
    } else {
      broadcastToDisplay("item_updated", buildDisplayPayload(next, "item_updated"));
    }
  };

  // ── Multi-Cart: hold, resume, new tab, switch, merge ──────────────────────

  const captureCurrentCartSnapshot = useCallback((): Partial<CartSnapshot> => ({
    orderItems,
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    orderNote,
    paymentMethod,
    splitCashAmount,
    personPayments,
    itemDiscounts,
  }), [orderItems, orderType, tableNumber, customerName, customerPhone, orderNote, paymentMethod, splitCashAmount, personPayments, itemDiscounts]);

  const restoreCartSnapshot = useCallback((snap: Partial<CartSnapshot>) => {
    setOrderItems(snap.orderItems || []);
    if (snap.orderType) setOrderType(snap.orderType as any);
    setTableNumber(snap.tableNumber || '');
    setCustomerName(snap.customerName || '');
    setCustomerPhone(snap.customerPhone || '');
    setOrderNote(snap.orderNote || '');
    if (snap.paymentMethod) setPaymentMethod(snap.paymentMethod as any);
    setSplitCashAmount(snap.splitCashAmount || '');
    setPersonPayments(snap.personPayments?.length ? snap.personPayments : [{ id: '1', method: 'cash', amount: '' }]);
    setItemDiscounts(snap.itemDiscounts || {});
  }, []);

  const holdCurrentCart = useCallback(() => {
    if (orderItems.length === 0) { toast({ title: tc('السلة فارغة', 'Cart is empty') }); return; }
    const snap = captureCurrentCartSnapshot();
    const rawTotal = orderItems.reduce((s, i) => s + getPosItemUnitPriceEarly(i) * i.quantity, 0);
    const holdName = tableNumber
      ? tc(`طاولة ${tableNumber}`, `Table ${tableNumber}`)
      : customerName || tc(`طلب مؤجل ${heldCarts.length + 1}`, `Hold ${heldCarts.length + 1}`);
    const held: HeldCartType = {
      id: newCartId(),
      name: holdName,
      heldAt: Date.now(),
      totalAmount: rawTotal,
      orderItems: snap.orderItems || [],
      orderType: (snap.orderType || 'dine_in') as any,
      tableNumber: snap.tableNumber || '',
      customerName: snap.customerName || '',
      customerPhone: snap.customerPhone || '',
      orderNote: snap.orderNote || '',
      paymentMethod: (snap.paymentMethod || 'cash') as any,
      splitCashAmount: snap.splitCashAmount || '',
      personPayments: snap.personPayments || [{ id: '1', method: 'cash' as const, amount: '' }],
      itemDiscounts: snap.itemDiscounts || {},
      createdAt: Date.now(),
    };
    setHeldCarts(prev => [held, ...prev]);
    // Clear current cart
    setOrderItems([]);
    setTableNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setOrderNote('');
    setItemDiscounts({});
    setAppliedDiscount(null);
    setDiscountCode('');
    broadcastToDisplay("order_cancelled", { items: [], subtotal: 0, tax: 0, total: 0 });
    toast({ title: tc(`تم حجز الطلب: ${holdName}`, `Order held: ${holdName}`) });
  }, [orderItems, captureCurrentCartSnapshot, heldCarts.length, tableNumber, customerName, toast, tc]);

  const resumeHeldCart = useCallback((heldId: string) => {
    const held = heldCarts.find(h => h.id === heldId);
    if (!held) return;
    if (orderItems.length > 0) {
      // Auto-hold the current cart before resuming
      holdCurrentCart();
    }
    restoreCartSnapshot(held);
    setHeldCarts(prev => prev.filter(h => h.id !== heldId));
    setShowHeldCarts(false);
    toast({ title: tc(`تم استرداد: ${held.name}`, `Resumed: ${held.name}`) });
  }, [heldCarts, orderItems.length, holdCurrentCart, restoreCartSnapshot, toast, tc]);

  const deleteHeldCart = useCallback((heldId: string) => {
    setHeldCarts(prev => prev.filter(h => h.id !== heldId));
  }, []);

  const newCartTab = useCallback(() => {
    // Save current cart to the saved tabs ref
    savedTabsRef.current[activeTabId] = captureCurrentCartSnapshot();
    // Create new tab
    const newId = newCartId();
    const newName = tc(`طلب ${cartTabs.length + 1}`, `Order ${cartTabs.length + 1}`);
    setCartTabs(prev => [...prev, { id: newId, name: newName, itemCount: 0, total: 0, createdAt: Date.now() }]);
    setActiveTabId(newId);
    // Clear cart for new tab
    setOrderItems([]);
    setTableNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setOrderNote('');
    setItemDiscounts({});
    setAppliedDiscount(null);
    setDiscountCode('');
  }, [activeTabId, captureCurrentCartSnapshot, cartTabs.length, tc]);

  const switchCartTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    // Save current
    savedTabsRef.current[activeTabId] = captureCurrentCartSnapshot();
    // Restore target
    const saved = savedTabsRef.current[tabId];
    if (saved) {
      restoreCartSnapshot(saved);
    } else {
      setOrderItems([]);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setOrderNote('');
      setItemDiscounts({});
    }
    setActiveTabId(tabId);
  }, [activeTabId, captureCurrentCartSnapshot, restoreCartSnapshot]);

  const closeCartTab = useCallback((tabId: string) => {
    if (cartTabs.length <= 1) return; // keep at least 1
    const idx = cartTabs.findIndex(t => t.id === tabId);
    const isActive = tabId === activeTabId;
    const remaining = cartTabs.filter(t => t.id !== tabId);
    setCartTabs(remaining);
    delete savedTabsRef.current[tabId];
    if (isActive) {
      const nextTab = remaining[Math.max(0, idx - 1)];
      switchCartTab(nextTab.id);
    }
  }, [cartTabs, activeTabId, switchCartTab]);

  const mergeTabIntoActive = useCallback((sourceTabId: string) => {
    const sourceSaved = savedTabsRef.current[sourceTabId];
    const sourceItems = sourceSaved?.orderItems || [];
    const merged = mergeCartItems(orderItems, sourceItems);
    setOrderItems(merged);
    // Close source tab
    const remaining = cartTabs.filter(t => t.id !== sourceTabId);
    setCartTabs(remaining);
    delete savedTabsRef.current[sourceTabId];
    setShowMergeBills(false);
    toast({ title: tc('تم دمج الطلبات', 'Bills merged') });
  }, [orderItems, cartTabs, toast, tc]);

  // Item-level discount helpers
  const applyItemDiscount = useCallback((lineId: string) => {
    const val = parseFloat(itemDiscountInput);
    if (!val || val <= 0) return;
    setItemDiscounts(prev => ({ ...prev, [lineId]: { type: itemDiscountType, value: val } }));
    setShowItemDiscountFor(null);
    setItemDiscountInput('');
  }, [itemDiscountInput, itemDiscountType]);

  const clearItemDiscount = useCallback((lineId: string) => {
    setItemDiscounts(prev => { const n = { ...prev }; delete n[lineId]; return n; });
  }, []);

  const applyManualDiscount = useCallback(() => {
    const val = parseFloat(manualDiscountInput);
    if (!val || val <= 0) { setManualDiscount(undefined); setShowManualDiscount(false); return; }
    setManualDiscount({ type: manualDiscountType, value: val });
    setShowManualDiscount(false);
    setManualDiscountInput('');
  }, [manualDiscountInput, manualDiscountType]);

  // Keep keyboard-accessible refs up-to-date every render
  useEffect(() => {
    newCartTabRef.current     = newCartTab;
    holdCurrentCartRef.current = holdCurrentCart;
  });

  // ── Create a pending PayMob order and show QR code for customer to scan ──
  const handleQrPayCheckout = async () => {
    if (orderItems.length === 0) return;
    if (!navigator.onLine) {
      toast({ title: tc('لا يوجد اتصال', 'Offline'), description: tc('الدفع عبر QR يتطلب الإنترنت', 'QR pay requires internet'), variant: 'destructive' });
      return;
    }
    try {
      setCreatingQrPay(true);
      const rawTotal = calculateTotal;
      const pointsDiscountAmt = usePoints && customerPoints >= 100 ? pointsDiscount : 0;
      const afterPoints = Math.max(0, rawTotal - pointsDiscountAmt);
      const couponDiscountAmt = appliedDiscount ? afterPoints * appliedDiscount.percentage / 100 : 0;
      const discount = pointsDiscountAmt + couponDiscountAmt;
      const itemDiscountsAmt = computeTotalItemDiscounts(orderItems, itemDiscounts);
      const manualDiscAmt = computeOrderDiscountAmount(Math.max(0, rawTotal - discount - itemDiscountsAmt), manualDiscount);
      const svcChargeAmt = computeServiceChargeAmount(Math.max(0, rawTotal - discount - itemDiscountsAmt - manualDiscAmt), serviceCharge);
      const total = Math.max(0, rawTotal - discount - itemDiscountsAmt - manualDiscAmt + svcChargeAmt);
      const subtotal = total / 1.15;
      const tax = total - subtotal;

      const orderData: any = {
        items: orderItems.map(item => ({
          coffeeItemId: item.coffeeItem.id,
          name: item.coffeeItem.nameAr,
          nameAr: item.coffeeItem.nameAr,
          price: getPosItemUnitPrice(item),
          selectedSize: item.selectedSize || undefined,
          quantity: item.quantity,
          customization: item.customization || {},
        })),
        subtotal, tax, total,
        orderType,
        paymentMethod: 'paymob-card',
        paymentStatus: 'pending',
        tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
        customerName, customerPhone,
        // 'awaiting_payment' keeps the order out of normal operational counts
        // until PayMob confirms; webhook will flip it to 'payment_confirmed'.
        status: 'awaiting_payment',
        deliveryType: orderType === 'car_pickup' ? 'car_pickup' : orderType === 'delivery' ? 'delivery' : orderType === 'dine_in' ? 'dine-in' : 'pickup',
        branchId: employee?.branchId || 'main',
        tenantId: employee?.tenantId || 'demo-tenant',
        employeeId: employee?.id,
        channel: 'pos',
        notes: orderNote || undefined,
      };

      const res = await apiRequest('POST', '/api/orders', orderData);
      const result = await res.json().catch(() => ({}));
      if (!result || result.error || !result.orderNumber || !result.id) {
        throw new Error(result?.error || tc('فشل إنشاء الطلب', 'Failed to create order'));
      }

      // Show the QR modal — it will poll for payment status and auto-close on paid.
      // QR link uses the unguessable nanoid `id`, not the predictable orderNumber.
      setQrPayOrder({ id: result.id, orderNumber: result.orderNumber, amount: total });
      setQrPayOpen(true);
    } catch (e: any) {
      toast({ title: tc('خطأ', 'Error'), description: e?.message || '', variant: 'destructive' });
    } finally {
      setCreatingQrPay(false);
    }
  };

  const handleQrPaymentConfirmed = () => {
    // When customer pays via QR, clear the cart & invalidate orders cache.
    setOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setOrderNote('');
    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders/live'] });
    toast({ title: tc('✅ تم استلام الدفع', '✅ Payment received'), description: tc('شكراً، تم تأكيد الفاتورة', 'Thanks, invoice confirmed') });
  };

  const handleCheckout = async () => {
    if (orderItems.length === 0) return;

    // Validate split payment: ensure all person payments sum to total
    if (paymentMethod === "split") {
      const getPersonTotal = (p: PersonPayment) =>
        p.method === 'mixed'
          ? (parseFloat(p.cashAmount || '') || 0) + (parseFloat(p.cardAmount || '') || 0)
          : (parseFloat(p.amount) || 0);
      const paidTotal = personPayments.reduce((s, p) => s + getPersonTotal(p), 0);
      const orderTotal = finalGrandTotal;
      if (personPayments.every(p => getPersonTotal(p) === 0)) {
        alert(tc("الرجاء إدخال مبالغ الدفع لكل شخص", "Please enter payment amounts for each person"));
        return;
      }
      if (Math.abs(paidTotal - orderTotal) > 0.01) {
        alert(tc(`المبالغ المدخلة (${paidTotal.toFixed(2)}) لا تساوي الإجمالي (${orderTotal.toFixed(2)})`, `Entered amounts (${paidTotal.toFixed(2)}) don't match total (${orderTotal.toFixed(2)})`));
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
      // Apply new engine discounts on top
      const itemDiscountsAmt = computeTotalItemDiscounts(orderItems, itemDiscounts);
      const manualDiscAmt = computeOrderDiscountAmount(Math.max(0, rawTotal - discount - itemDiscountsAmt), manualDiscount);
      const svcChargeAmt = computeServiceChargeAmount(Math.max(0, rawTotal - discount - itemDiscountsAmt - manualDiscAmt), serviceCharge);
      const total = Math.max(0, rawTotal - discount - itemDiscountsAmt - manualDiscAmt + svcChargeAmt);
      const subtotal = total / 1.15;
      const tax = total - subtotal;
      const getPersonCash = (p: PersonPayment) =>
        p.method === 'mixed' ? (parseFloat(p.cashAmount || '') || 0) : p.method === 'cash' ? (parseFloat(p.amount) || 0) : 0;
      const getPersonCard = (p: PersonPayment) =>
        p.method === 'mixed' ? (parseFloat(p.cardAmount || '') || 0) : p.method === 'card' ? (parseFloat(p.amount) || 0) : 0;
      const splitPaymentData = paymentMethod === "split"
        ? {
            cash: personPayments.reduce((s, p) => s + getPersonCash(p), 0),
            card: personPayments.reduce((s, p) => s + getPersonCard(p), 0),
            persons: personPayments.map(p => ({
              method: p.method,
              amount: p.method === 'mixed'
                ? (parseFloat(p.cashAmount || '') || 0) + (parseFloat(p.cardAmount || '') || 0)
                : (parseFloat(p.amount) || 0),
              cashAmount: getPersonCash(p),
              cardAmount: getPersonCard(p),
            })),
          }
        : undefined;
      const pointsUsed = discount > 0 ? Math.round(discount * 50) : 0;

      broadcastToDisplay("payment_processing", {
        items: orderItems.map(i => ({ nameAr: i.coffeeItem.nameAr, price: getPosItemUnitPrice(i), quantity: i.quantity })),
        subtotal, tax, total,
      });

      const orderData: any = {
        items: orderItems.map(item => {
          return {
            coffeeItemId: item.coffeeItem.id,
            name: item.coffeeItem.nameAr,
            nameAr: item.coffeeItem.nameAr,
            price: getPosItemUnitPrice(item),
            selectedSize: item.selectedSize || undefined,
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
            return {
              coffeeItem: {
                nameAr: item.coffeeItem.nameAr,
                nameEn: item.coffeeItem.nameEn,
                price: String(getPosItemUnitPrice(item)),
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
              const inlineNames = (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr).join('، ');
              return {
                coffeeItem: {
                  nameAr: (item.coffeeItem?.nameAr || '') + (inlineNames ? ` (${inlineNames})` : ''),
                  nameEn: item.coffeeItem?.nameEn || '',
                  price: String(getPosItemUnitPrice(item)),
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
            notes: orderNote || undefined,
          };
          try { printTaxInvoice(printSnapshot, { autoPrint: true }); } catch (e) {
            console.warn('[POS] Offline auto-print failed silently:', e);
          }
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

      const orderNumForPrint = result.orderNumber || result.dailyNumber || result._id?.slice(-4) || '—';

      // ── Pre-generate ZATCA QR code in background so printing is instant ──
      prewarmZatcaQr({
        orderNumber: orderNumForPrint,
        total: total.toFixed(2),
        date: new Date().toISOString(),
        vatNumber: businessConfig?.vatNumber,
      });

      // ── Pre-render receipt PNG immediately so print is instant when user clicks ──
      preRenderReceiptPng({
        orderNumber: orderNumForPrint,
        createdAt: new Date().toISOString(),
        tableNumber: orderType === "dine_in" ? tableNumber : undefined,
        totalAmount: total,
        paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod,
        employeeName: employee?.fullName || t('pos.employee_fallback'),
        deliveryType: orderType,
        orderType: orderType,
        customerName,
        customerPhone,
        notes: orderNote || undefined,
        items: orderItems.map(item => ({
          nameAr: item.coffeeItem?.nameAr || '',
          nameEn: item.coffeeItem?.nameEn || '',
          quantity: item.quantity,
          price: getPosItemUnitPrice(item),
          selectedSize: item.selectedSize || undefined,
          customization: item.customization,
        })),
      });

      setLastOrder({
        orderNumber: orderNumForPrint,
        date: new Date().toISOString(),
        items: orderItems.map(item => ({
          coffeeItem: {
            nameAr: item.coffeeItem.nameAr,
            nameEn: item.coffeeItem.nameEn,
            price: String(getPosItemUnitPrice(item)),
          },
          quantity: item.quantity,
          selectedSize: item.selectedSize || undefined,
          customization: item.customization,
        })),
        subtotal,
        tax,
        total,
        paymentMethod,
        customerName,
        customerPhone,
        employeeName: employee?.fullName || t('pos.employee_fallback'),
        tableNumber: orderType === "dine_in" ? tableNumber : undefined,
        orderType,
        notes: orderNote || undefined,
      });
      // ✅ Defer print to avoid blocking the UI thread after checkout
      if (autoPrint) {
        const printSnapshot = {
          orderNumber: result.orderNumber || result.dailyNumber || result._id?.slice(-4) || '—',
          customerName,
          customerPhone,
          items: orderItems.map(item => ({
            coffeeItem: {
              nameAr: item.coffeeItem?.nameAr || '',
              nameEn: item.coffeeItem?.nameEn || '',
              price: String(getPosItemUnitPrice(item)),
            },
            quantity: item.quantity,
            selectedSize: item.selectedSize || undefined,
            customization: item.customization,
          })),
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod,
          employeeName: employee?.fullName || t('pos.employee_fallback'),
          tableNumber: orderType === "dine_in" ? tableNumber : undefined,
          orderType: orderType as any,
          orderTypeName: (
            (orderType as string) === 'dine_in' || (orderType as string) === 'dine-in' ? 'محلي'  :
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
          cashReceived: (paymentMethod === 'cash' && splitCashAmount)
            ? parseFloat(splitCashAmount) || undefined
            : undefined,
          notes: orderNote || undefined,
        };
        // Fire immediately — thermal path is instant, HTML fallback uses pre-warmed ZATCA QR cache
        try {
          printTaxInvoice(printSnapshot, { autoPrint: true });
        } catch (e) {
          console.warn('[POS] Auto-print failed silently:', e);
        }
      }
      broadcastToDisplay("payment_success", {
        orderNumber: result.orderNumber || result.dailyNumber || '',
        items: orderItems.map(i => ({ nameAr: i.coffeeItem.nameAr, price: getPosItemUnitPrice(i), quantity: i.quantity })),
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
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/active"] });
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

  // Build a single invoice payload once — used by every action button below.
  const buildLastOrderInvoiceData = () => {
    if (!lastOrder) return null;
    return {
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
    } as any;
  };

  // ── Pre-stage a print iframe with the customer receipt HTML so the
  //    "Print" button can call print() synchronously — zero perceived delay.
  const stagedPrintIframeRef = useRef<HTMLIFrameElement | null>(null);
  const stagedPrintReadyRef = useRef(false);

  useEffect(() => {
    // Cleanup previous staging whenever the receipt HTML changes / dialog closes
    return () => {
      try { stagedPrintIframeRef.current?.remove(); } catch {}
      stagedPrintIframeRef.current = null;
      stagedPrintReadyRef.current = false;
    };
  }, [receiptPreviewHtml, showReceiptDialog]);

  useEffect(() => {
    if (!showReceiptDialog || !receiptPreviewHtml) return;
    if (stagedPrintIframeRef.current) return;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:302px;height:1px;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    iframe.addEventListener('load', () => { stagedPrintReadyRef.current = true; });
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      // Browser refused us a document — bail out gracefully; fallback path will be used.
      try { iframe.remove(); } catch {}
      return;
    }
    try {
      doc.open();
      doc.write(receiptPreviewHtml);
      doc.close();
      stagedPrintIframeRef.current = iframe;
      // Mark ready once the document has fully parsed (covers browsers that don't fire load for srcdoc-less iframes)
      if (doc.readyState === 'complete') {
        stagedPrintReadyRef.current = true;
      } else {
        doc.addEventListener('readystatechange', () => {
          if (doc.readyState === 'complete') stagedPrintReadyRef.current = true;
        });
      }
    } catch (err) {
      console.warn('[POS] receipt staging failed:', err);
      try { iframe.remove(); } catch {}
    }
  }, [showReceiptDialog, receiptPreviewHtml]);

  // Helper: fast-path print only when staged iframe is truly ready & populated.
  const tryStagedPrint = (): boolean => {
    const staged = stagedPrintIframeRef.current;
    if (!staged || !staged.contentWindow) return false;
    if (!stagedPrintReadyRef.current) return false;
    const doc = staged.contentDocument;
    if (!doc || doc.readyState !== 'complete' || !doc.body || !doc.body.innerHTML.trim()) {
      return false;
    }
    try {
      staged.contentWindow.focus();
      staged.contentWindow.print();
      return true;
    } catch {
      return false;
    }
  };

  const handlePrintReceipt = () => {
    const data = buildLastOrderInvoiceData();
    if (!data) return;
    const ps = loadPrinterSettings();
    // If thermal printer is configured, skip browser staged-print entirely
    if (ps.enabled && ps.mode !== 'browser') {
      printReceiptSection(data, 'customer');
      return;
    }
    // Fast path: if we have a staged iframe truly ready, print synchronously
    if (tryStagedPrint()) return;
    // Fallback to full thermal/HTML pipeline
    printTaxInvoice(data, { autoPrint: true });
  };

  // ── 5-action handlers for the receipt dialog ──────────────────────────
  const handlePreviewBoth = async () => {
    const data = buildLastOrderInvoiceData();
    if (!data) return;
    try { await openReceiptPreviewWindow(data); } catch (e) { console.error(e); }
  };
  const handlePrintCustomerOnly = async () => {
    const data = buildLastOrderInvoiceData();
    if (!data) return;
    const ps = loadPrinterSettings();
    // If thermal printer is configured, go direct — no browser PDF
    if (ps.enabled && ps.mode !== 'browser') {
      try { await printReceiptSection(data, 'customer'); } catch (e) { console.error(e); }
      return;
    }
    // Browser fallback: try staged iframe first (instant), then HTML queue
    if (tryStagedPrint()) return;
    try { await printReceiptSection(data, 'customer'); } catch (e) { console.error(e); }
  };
  const handlePrintKitchenOnly = async () => {
    const data = buildLastOrderInvoiceData();
    if (!data) return;
    try { await printReceiptSection(data, 'kitchen'); } catch (e) { console.error(e); }
  };
  const handlePrintBoth = async () => {
    const data = buildLastOrderInvoiceData();
    if (!data) return;
    try { await printReceiptSection(data, 'both'); } catch (e) { console.error(e); }
  };
  const handleEditLastOrder = () => {
    // Close the receipt dialog and return to POS so cashier can build a new/edit order
    setShowReceiptDialog(false);
    setLastPrintFailed(false);
  };

  const handlePrintLiveOrder = (order: any) => {
    const items = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
      coffeeItem: {
        nameAr: item.name || item.nameAr || item.coffeeItem?.nameAr || '',
        nameEn: item.nameEn || item.coffeeItem?.nameEn || '',
        price: String(item.price || item.unitPrice || item.coffeeItem?.price || 0),
      },
      quantity: item.quantity || 1,
      selectedSize: item.selectedSize || undefined,
      customization: item.customization,
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
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-primary">مكان الشيف</h1>
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
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)} className="w-full max-w-sm">
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCarOrdersPanel(true)}
            className="relative hidden sm:flex gap-1 border-primary/30 text-primary hover:bg-primary/10"
            data-testid="button-car-orders"
            title={tc("طلبات السيارات", "Car Orders")}
          >
            <Car className="w-4 h-4" />
            <span className="text-xs font-bold">{tc("سيارات", "Cars")}</span>
            {carPreparationAlerts.length > 0 && (
              <Badge className="absolute -top-2 -right-2 px-1.5 min-w-[18px] h-[18px] bg-amber-500 text-white animate-pulse">
                {carPreparationAlerts.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRefundDialog(true)}
            className="hidden sm:flex gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
            data-testid="button-refund-open"
            title={tc("استرجاع طلب / Refund", "Refund Order")}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs font-bold">{tc("استرجاع", "Refund")}</span>
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
      <PosShiftBar />

      <main className="flex-1 flex overflow-hidden">

        <section className={`${mobilePanelView === 'products' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden`}>
          {/* Category Top Bar */}
          <div className={`${mobilePanelView === 'cart' ? 'hidden' : ''} flex border-b bg-muted/30 shrink-0`}>
            {/* Scrollable category buttons */}
            <div className="flex gap-1 overflow-x-auto px-2 py-2 no-scrollbar flex-1 min-w-0">
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
            {/* Fixed three-dots button */}
            <div ref={categoryDropdownRef} className="relative flex items-center shrink-0 border-r px-1">
              <Button
                variant={showCategoryDropdown ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-lg shrink-0"
                onClick={() => setShowCategoryDropdown(v => !v)}
                data-testid="button-category-dropdown-toggle"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              {showCategoryDropdown && (
                <div
                  className="absolute top-full left-0 z-50 mt-1 bg-card border rounded-xl shadow-2xl p-2 min-w-[220px] max-h-[60vh] overflow-y-auto"
                  style={{ direction: 'rtl' }}
                >
                  <p className="text-[10px] font-bold text-muted-foreground px-2 pb-1.5">{i18n.language === 'ar' ? 'جميع الأقسام' : 'All Categories'}</p>
                  <button
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors text-right ${selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => { setSelectedCategory('all'); setShowCategoryDropdown(false); }}
                    data-testid="button-catdrop-all"
                  >
                    <Grid3X3 className="w-4 h-4 shrink-0" />
                    <span>{t('pos.category_all')}</span>
                  </button>
                  {visibleCategories.map((cat: any) => (
                    <button
                      key={cat.id}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors text-right ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                      onClick={() => { setSelectedCategory(cat.id); setShowCategoryDropdown(false); }}
                      data-testid={`button-catdrop-${cat.id}`}
                    >
                      <cat.icon className="w-4 h-4 shrink-0" />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                        const existingCartItem = orderItems.find((oi: any) => oi.coffeeItem.id === item.id);
                        setPosCustomizationItem({ item, group, initialCustomization: existingCartItem?._fullCustomization });
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
                        const customBadge = i18n.language === 'ar'
                          ? (item.badgeAr || item.badgeEn)
                          : (item.badgeEn || item.badgeAr);
                        return (
                          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                            {item.isBestSeller && (
                              <Badge className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-primary text-white font-bold">
                                🔥 {i18n.language === 'ar' ? 'الأكثر طلباً' : 'Best Seller'}
                              </Badge>
                            )}
                            {item.isNewProduct === 1 && (
                              <Badge className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-green-500 text-white font-bold">
                                {i18n.language === 'ar' ? 'جديد' : 'New'}
                              </Badge>
                            )}
                            {customBadge && (
                              <Badge className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-accent text-white font-bold border-0">
                                {customBadge}
                              </Badge>
                            )}
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
              {/* Hold current cart */}
              {orderItems.length > 0 && (
                <Button variant="ghost" size="icon" title={tc('احجز الطلب (F5)','Hold Order (F5)')} onClick={holdCurrentCart} className="h-8 w-8 text-amber-600 hover:text-amber-700" data-testid="button-hold-order">
                  <PauseCircle className="w-4 h-4" />
                </Button>
              )}
              {/* Held carts badge */}
              {heldCarts.length > 0 && (
                <Button variant="ghost" size="icon" title={tc('الطلبات المحجوزة (F6)','Held Orders (F6)')} onClick={() => setShowHeldCarts(true)} className="h-8 w-8 relative" data-testid="button-show-held-carts">
                  <Archive className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">{heldCarts.length}</span>
                </Button>
              )}
              {/* Merge bills */}
              {cartTabs.length > 1 && (
                <Button variant="ghost" size="icon" title={tc('دمج الفواتير','Merge Bills')} onClick={() => setShowMergeBills(true)} className="h-8 w-8" data-testid="button-merge-bills">
                  <Merge className="w-4 h-4" />
                </Button>
              )}
              {orderItems.length > 0 && (
                <Button variant="ghost" size="icon" onClick={() => { setOrderItems([]); setSplitCashAmount(""); setItemDiscounts({}); broadcastToDisplay("order_cancelled", { items: [], subtotal: 0, tax: 0, total: 0 }); }} className="text-destructive h-8 w-8" data-testid="button-clear-order">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* ── Cart Tabs Bar (Multi-Cart) ──────────────────────────────── */}
          {cartTabs.length > 1 && (
            <div className="flex items-center gap-0.5 px-2 pt-1 pb-0 border-b overflow-x-auto no-scrollbar bg-muted/20">
              {cartTabs.map(tab => (
                <div key={tab.id} className="flex items-center shrink-0">
                  <button
                    onClick={() => switchCartTab(tab.id)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-t-lg text-[10px] font-bold whitespace-nowrap border-b-2 transition-all ${
                      activeTabId === tab.id
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                    data-testid={`button-cart-tab-${tab.id}`}
                  >
                    {tab.name}
                    {tab.itemCount > 0 && (
                      <span className={`rounded-full px-1 text-[9px] font-black ${activeTabId === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {tab.itemCount}
                      </span>
                    )}
                  </button>
                  {cartTabs.length > 1 && (
                    <button
                      onClick={() => closeCartTab(tab.id)}
                      className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-destructive transition-colors mr-1"
                      data-testid={`button-close-tab-${tab.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={newCartTab}
                className="flex items-center gap-0.5 px-2 py-1.5 rounded-t-lg text-[10px] text-muted-foreground hover:text-primary transition-colors shrink-0"
                title={tc('طلب جديد (F4 / Ctrl+T)','New Order (F4 / Ctrl+T)')}
                data-testid="button-new-cart-tab"
              >
                <Plus className="w-3 h-3" />
                <span>{tc('جديد','New')}</span>
              </button>
            </div>
          )}
          {/* Quick new tab when only 1 tab */}
          {cartTabs.length === 1 && (
            <div className="flex justify-end px-2 pt-1">
              <button
                onClick={newCartTab}
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                title={tc('طلب جديد (F4)','New Order (F4)')}
                data-testid="button-new-first-tab"
              >
                <Plus className="w-3 h-3" />
                <span>{tc('+ طلب جديد','+ New Order')}</span>
              </button>
            </div>
          )}

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
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <p className="text-primary font-black text-xs">
                          {(getPosItemUnitPrice(item) * item.quantity).toFixed(2)} {t('pos.currency')}
                        </p>
                        {/* Per-item discount badge */}
                        {itemDiscounts[item.lineItemId] ? (
                          <button
                            onClick={() => { setShowItemDiscountFor(item.lineItemId); setItemDiscountInput(String(itemDiscounts[item.lineItemId].value)); setItemDiscountType(itemDiscounts[item.lineItemId].type); }}
                            className="text-[9px] font-bold text-green-700 bg-green-100 rounded px-1 inline-flex items-center gap-0.5 dark:bg-green-900/30 dark:text-green-400"
                            data-testid={`badge-item-discount-${item.lineItemId}`}
                          >
                            <Percent className="w-2.5 h-2.5" />
                            -{itemDiscounts[item.lineItemId].type === 'percent' ? `${itemDiscounts[item.lineItemId].value}%` : `${itemDiscounts[item.lineItemId].value} ${tc('ر.س','SAR')}`}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setShowItemDiscountFor(item.lineItemId); setItemDiscountInput(''); setItemDiscountType('percent'); }}
                            className="text-[9px] text-muted-foreground/60 hover:text-primary inline-flex items-center gap-0.5 transition-colors"
                            data-testid={`button-add-item-discount-${item.lineItemId}`}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tc('خصم','Disc')}
                          </button>
                        )}
                      </div>
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
            {(() => {
              const customPosMethods = allPaymentMethods.filter((m: any) => m.isCustom && m.enabledForPos !== false);
              const allPos = [...PAYMENT_METHODS.map(m => ({ ...m, isCustom: false })), ...customPosMethods.map((m: any) => ({ id: m.id, isCustom: true, nameAr: m.nameAr, emoji: m.emoji || '💳' }))];
              const visibleMethods = allPos.slice(0, 3);
              const overflowMethods = allPos.slice(3);
              return (
                <div className="flex gap-1.5 sm:gap-2">
                  {visibleMethods.map((method) => (
                    <Button
                      key={method.id}
                      type="button"
                      variant={paymentMethod === method.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPaymentMethod(method.id as PaymentMethod);
                        setSplitCashAmount("");
                        if (method.id === 'split') {
                          setPersonPayments([{ id: Date.now().toString(), method: 'cash', amount: '' }]);
                        }
                      }}
                      className="flex flex-col gap-0.5 h-auto py-2 text-[10px] sm:text-xs flex-1"
                      data-testid={`button-payment-${method.id}`}
                    >
                      {(method as any).isCustom
                        ? <span className="text-base leading-none">{(method as any).emoji}</span>
                        : (() => { const IconComp = (method as any).icon; return <IconComp className="w-4 h-4" />; })()
                      }
                      <span className="font-bold truncate max-w-full px-1">
                        {(method as any).isCustom ? (method as any).nameAr : t((method as any).tKey)}
                      </span>
                    </Button>
                  ))}
                  {overflowMethods.length > 0 && (
                    <Popover open={showMorePayments} onOpenChange={setShowMorePayments}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant={overflowMethods.some(m => m.id === paymentMethod) ? "default" : "outline"}
                          size="sm"
                          className="flex flex-col gap-0.5 h-auto py-2 text-[10px] sm:text-xs w-12 shrink-0"
                          data-testid="button-payment-more"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="font-bold">{overflowMethods.length}+</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" side="top" align="end">
                        <div className="space-y-1">
                          {overflowMethods.map((method) => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(method.id as PaymentMethod);
                                setSplitCashAmount("");
                                setShowMorePayments(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${paymentMethod === method.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                              data-testid={`button-payment-overflow-${method.id}`}
                            >
                              {(method as any).isCustom
                                ? <span className="text-base">{(method as any).emoji}</span>
                                : (() => { const IconComp = (method as any).icon; return <IconComp className="w-4 h-4" />; })()
                              }
                              <span className="truncate">
                                {(method as any).isCustom ? (method as any).nameAr : t((method as any).tKey)}
                              </span>
                              {paymentMethod === method.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })()}

            {paymentMethod === "cash" && (() => {
              const received = parseFloat(splitCashAmount) || 0;
              const change = received - finalGrandTotal;
              const roundUpTo = (n: number) => Math.ceil(finalGrandTotal / n) * n;
              const quickAmounts: { label: string; value: number; testId: string }[] = [
                { label: tc("بالضبط","Exact"), value: finalGrandTotal, testId: "exact" },
                { label: `≈${roundUpTo(10)}`, value: roundUpTo(10), testId: "round10" },
                { label: `≈${roundUpTo(50)}`, value: roundUpTo(50), testId: "round50" },
                { label: `≈${roundUpTo(100)}`, value: roundUpTo(100), testId: "round100" },
              ];
              const bills = [50, 100, 200, 500];
              const switchToSplitWithCard = () => {
                const cashEntered = received > 0 ? Math.min(received, finalGrandTotal) : finalGrandTotal / 2;
                const cardPart = Math.max(0, finalGrandTotal - cashEntered);
                setPersonPayments([{
                  id: Date.now().toString(),
                  method: 'mixed',
                  amount: '',
                  cashAmount: cashEntered.toFixed(2),
                  cardAmount: cardPart.toFixed(2),
                }]);
                setPaymentMethod('split' as PaymentMethod);
              };
              return (
                <div className="mt-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-primary">{tc("المبلغ المستلم من العميل","Cash received from customer")}</p>
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-primary shrink-0" />
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder={finalGrandTotal.toFixed(2)}
                      value={splitCashAmount}
                      onChange={e => setSplitCashAmount(e.target.value)}
                      className="h-9 text-base font-bold flex-1"
                      data-testid="input-cash-received"
                    />
                    <SarIcon size={12} />
                  </div>
                  {/* Quick-fill shortcuts */}
                  <div className="grid grid-cols-4 gap-1">
                    {quickAmounts.map((q) => (
                      <Button
                        key={q.testId}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-bold px-1 border-primary/30 hover:bg-primary/10"
                        onClick={() => setSplitCashAmount(q.value.toFixed(2))}
                        data-testid={`button-quick-cash-${q.testId}`}
                      >{q.label}</Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {bills.map((b) => (
                      <Button
                        key={b}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-bold px-1"
                        onClick={() => setSplitCashAmount(((parseFloat(splitCashAmount) || 0) + b).toFixed(2))}
                        data-testid={`button-add-bill-${b}`}
                      >+{b}</Button>
                    ))}
                  </div>
                  {splitCashAmount && received > 0 && (
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold border ${change >= 0 ? 'bg-green-50 dark:bg-green-950/30 text-green-700 border-green-300' : 'bg-red-50 dark:bg-red-950/20 text-red-600 border-red-300'}`}>
                      <span>{change >= 0 ? tc("🪙 الباقي (الفكة)","🪙 Change due") : tc("⚠️ ناقص","⚠️ Short")}</span>
                      <span className="text-base font-black">{Math.abs(change).toFixed(2)} <SarIcon size={13} /></span>
                    </div>
                  )}
                  {/* Quick switch to split-with-card */}
                  {received < finalGrandTotal && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-[11px] font-black border-dashed border-primary/50 text-primary hover:bg-primary/10 gap-1"
                      onClick={switchToSplitWithCard}
                      data-testid="button-switch-cash-to-split"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      {received > 0
                        ? tc(`الباقي ${(finalGrandTotal - received).toFixed(2)} ر.س على الشبكة`, `Charge remaining ${(finalGrandTotal - received).toFixed(2)} to card`)
                        : tc("تقسيم الفاتورة كاش + شبكة","Split bill — Cash + Card")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full h-7 text-[10px] text-muted-foreground"
                    onClick={() => setSplitCashAmount("")}
                    data-testid="button-clear-cash"
                  >{tc("مسح","Clear")}</Button>
                </div>
              );
            })()}
            {paymentMethod === "card" && (
              <div className="mt-2 space-y-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
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
                {/* Quick switch shortcuts */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-primary/10">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px] font-black border-dashed border-primary/50 text-primary hover:bg-primary/10 gap-1"
                    onClick={() => {
                      const half = finalGrandTotal / 2;
                      setPersonPayments([{
                        id: Date.now().toString(),
                        method: 'mixed',
                        amount: '',
                        cashAmount: half.toFixed(2),
                        cardAmount: half.toFixed(2),
                      }]);
                      setPaymentMethod('split' as PaymentMethod);
                    }}
                    data-testid="button-switch-card-to-split"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    {tc("نصف كاش + نصف شبكة","½ Cash + ½ Card")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px] font-black border-dashed border-primary/50 text-primary hover:bg-primary/10 gap-1"
                    onClick={() => {
                      setPersonPayments([{
                        id: Date.now().toString(),
                        method: 'mixed',
                        amount: '',
                        cashAmount: '',
                        cardAmount: finalGrandTotal.toFixed(2),
                      }]);
                      setPaymentMethod('split' as PaymentMethod);
                    }}
                    data-testid="button-card-go-split"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tc("تقسيم مخصص","Custom split")}
                  </Button>
                </div>
              </div>
            )}
            {paymentMethod === "split" && (() => {
              const orderTotal = finalGrandTotal;
              const getPersonCashUI = (p: PersonPayment) =>
                p.method === 'mixed' ? (parseFloat(p.cashAmount || '') || 0) : p.method === 'cash' ? (parseFloat(p.amount) || 0) : 0;
              const getPersonCardUI = (p: PersonPayment) =>
                p.method === 'mixed' ? (parseFloat(p.cardAmount || '') || 0) : p.method === 'card' ? (parseFloat(p.amount) || 0) : 0;
              const getPersonTotalUI = (p: PersonPayment) => getPersonCashUI(p) + getPersonCardUI(p);
              const paidTotal = personPayments.reduce((s, p) => s + getPersonTotalUI(p), 0);
              const remaining = Math.max(0, orderTotal - paidTotal);
              const isComplete = Math.abs(paidTotal - orderTotal) <= 0.01;
              const addPerson = () => setPersonPayments(prev => [...prev, { id: Date.now().toString(), method: 'cash', amount: '' }]);
              const removePerson = (id: string) => setPersonPayments(prev => prev.filter(p => p.id !== id));
              const updatePerson = (id: string, field: keyof PersonPayment, val: string) =>
                setPersonPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
              const fillRemaining = (id: string) => {
                const p = personPayments.find(pp => pp.id === id)!;
                if (p.method === 'mixed') {
                  updatePerson(id, 'cashAmount', remaining > 0 ? remaining.toFixed(2) : '');
                } else {
                  updatePerson(id, 'amount', remaining > 0 ? remaining.toFixed(2) : '');
                }
              };
              const totalCash = personPayments.reduce((s, p) => s + getPersonCashUI(p), 0);
              const totalCard = personPayments.reduce((s, p) => s + getPersonCardUI(p), 0);
              const splitEqualCash = (n: number) => {
                const per = orderTotal / n;
                const items = Array.from({ length: n }, (_, i) => ({
                  id: `${Date.now()}-${i}`,
                  method: 'cash' as const,
                  amount: per.toFixed(2),
                }));
                setPersonPayments(items);
              };
              const splitCashCard = () => {
                const half = orderTotal / 2;
                setPersonPayments([{
                  id: Date.now().toString(),
                  method: 'mixed',
                  amount: '',
                  cashAmount: half.toFixed(2),
                  cardAmount: half.toFixed(2),
                }]);
              };
              const resetSplit = () => setPersonPayments([{ id: Date.now().toString(), method: 'cash', amount: '' }]);
              return (
                <div className="mt-2 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-primary">{tc("تقسيم الفاتورة على أشخاص","Split bill between people")}</p>
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{tc("إجمالي","Total")}: {orderTotal.toFixed(2)}</span>
                  </div>
                  {/* Quick presets */}
                  <div className="grid grid-cols-5 gap-1">
                    {[2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] font-black border-primary/40 hover:bg-primary/10"
                        onClick={() => splitEqualCash(n)}
                        data-testid={`button-split-equal-${n}`}
                      >÷{n}<br /><span className="text-[8px] font-normal">{(orderTotal / n).toFixed(2)}</span></Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-black border-primary/40 hover:bg-primary/10 text-red-600"
                      onClick={resetSplit}
                      data-testid="button-split-reset"
                    >{tc("صفر","Reset")}</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-black border-dashed border-primary/50 text-primary hover:bg-primary/10"
                      onClick={splitCashCard}
                      data-testid="button-split-cash-card-half"
                    >½ {tc("كاش","Cash")} + ½ {tc("شبكة","Card")}</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] font-black border-dashed border-primary/50 text-primary hover:bg-primary/10"
                      onClick={() => setPersonPayments([{
                        id: Date.now().toString(),
                        method: 'mixed',
                        amount: '',
                        cashAmount: '',
                        cardAmount: '',
                      }])}
                      data-testid="button-split-mixed-empty"
                    >{tc("شخص واحد — كاش + شبكة","One person — Cash+Card")}</Button>
                  </div>
                  <div className="space-y-2">
                    {personPayments.map((p, idx) => (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground shrink-0 w-5">{idx + 1}</span>
                          <select
                            value={p.method}
                            onChange={e => updatePerson(p.id, 'method', e.target.value)}
                            className="h-8 rounded-md border border-input bg-background text-xs font-bold px-1 shrink-0"
                            data-testid={`select-person-method-${idx}`}
                          >
                            <option value="cash">{tc("كاش","Cash")}</option>
                            <option value="card">{tc("شبكة","Card")}</option>
                            <option value="mixed">{tc("كاش+شبكة","Cash+Card")}</option>
                          </select>
                          {p.method !== 'mixed' && (
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder={tc("المبلغ","Amount")}
                              value={p.amount}
                              onChange={e => updatePerson(p.id, 'amount', e.target.value)}
                              className="h-8 text-sm font-bold flex-1 min-w-0"
                              data-testid={`input-person-amount-${idx}`}
                            />
                          )}
                          {p.method === 'mixed' && (
                            <span className="text-[10px] text-primary font-bold flex-1 text-center">
                              {getPersonTotalUI(p) > 0 ? `${getPersonTotalUI(p).toFixed(2)} ${tc("ر.س","SAR")}` : tc("أدخل المبالغ أدناه","Enter below")}
                            </span>
                          )}
                          {remaining > 0 && getPersonTotalUI(p) === 0 && (
                            <button
                              onClick={() => fillRemaining(p.id)}
                              className="text-[9px] text-primary underline shrink-0 whitespace-nowrap"
                            >{remaining.toFixed(2)}</button>
                          )}
                          {personPayments.length > 1 && (
                            <button onClick={() => removePerson(p.id)} className="text-red-500 hover:text-red-700 shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {p.method === 'mixed' && (
                          <div className="flex items-center gap-1.5 mr-5">
                            <Banknote className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <Input
                              type="number" min={0} step={0.01}
                              placeholder={tc("كاش","Cash")}
                              value={p.cashAmount || ''}
                              onChange={e => updatePerson(p.id, 'cashAmount', e.target.value)}
                              className="h-7 text-xs font-bold flex-1"
                              data-testid={`input-person-cash-${idx}`}
                            />
                            <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <Input
                              type="number" min={0} step={0.01}
                              placeholder={tc("شبكة","Card")}
                              value={p.cardAmount || ''}
                              onChange={e => updatePerson(p.id, 'cardAmount', e.target.value)}
                              className="h-7 text-xs font-bold flex-1"
                              data-testid={`input-person-card-${idx}`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addPerson}
                    className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline"
                    data-testid="button-add-person"
                  >
                    <Plus className="w-3 h-3" />
                    {tc("إضافة شخص","Add person")}
                  </button>
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold border ${isComplete ? 'bg-green-50 dark:bg-green-950/30 text-green-700 border-green-200' : remaining > 0 ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                    <span>{isComplete ? tc("✓ مكتمل","✓ Complete") : remaining > 0 ? tc("المتبقي:","Remaining:") : tc("زيادة!","Over!")}</span>
                    <span className="font-black text-sm">{isComplete ? '' : Math.abs(remaining > 0 ? remaining : paidTotal - orderTotal).toFixed(2) + ' ' + tc("ر.س","SAR")}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t">
                    <span>{tc("نقدي","Cash")}: {totalCash.toFixed(2)}</span>
                    <span>{tc("شبكة","Card")}: {totalCard.toFixed(2)}</span>
                    <span className="font-bold text-primary">{tc("مدفوع","Paid")}: {paidTotal.toFixed(2)}</span>
                  </div>
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
                  <span className="font-bold">{i18n.language === 'ar' ? 'خصم بطاقة مكان الشيف' : "Chef's Card"}</span>
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
                  <span className={`font-black text-base sm:text-xl ${(itemDiscountTotal > 0 || manualDiscountAmount > 0 || serviceChargeAmount > 0) ? 'line-through text-muted-foreground text-sm' : 'text-primary'}`} data-testid="text-grand-total">{calculateGrandTotal.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}

              {/* ── Engine extras: item discounts, manual discount, service charge ── */}
              {itemDiscountTotal > 0 && (
                <div className="flex justify-between text-[10px] sm:text-sm text-green-600">
                  <span className="font-bold flex items-center gap-1"><Tag className="w-3 h-3" />{tc('خصم العناصر','Item Discounts')}</span>
                  <span className="font-bold">- {itemDiscountTotal.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
              {manualDiscountAmount > 0 && (
                <div className="flex justify-between text-[10px] sm:text-sm text-green-600">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowManualDiscount(true)} className="font-bold flex items-center gap-1 hover:underline">
                      <DollarSign className="w-3 h-3" />{tc('خصم يدوي','Manual Discount')}
                      {manualDiscount && <span className="text-[9px] text-muted-foreground">({manualDiscount.type === 'percent' ? `${manualDiscount.value}%` : `${manualDiscount.value} ${tc('ر.س','SAR')}`})</span>}
                    </button>
                    <button onClick={() => setManualDiscount(undefined)} className="text-destructive hover:opacity-70 ml-1"><X className="w-3 h-3" /></button>
                  </div>
                  <span className="font-bold">- {manualDiscountAmount.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}
              {serviceCharge.enabled && serviceChargeAmount > 0 && (
                <div className="flex justify-between text-[10px] sm:text-sm text-orange-600">
                  <button onClick={() => setServiceCharge(prev => ({...prev, enabled: false}))} className="font-bold flex items-center gap-1 hover:underline">
                    <Hash className="w-3 h-3" />{tc('رسوم الخدمة','Service Charge')} ({serviceCharge.value}{serviceCharge.type === 'percent' ? '%' : ` ${tc('ر.س','SAR')}`})
                  </button>
                  <span className="font-bold">+ {serviceChargeAmount.toFixed(2)} {t('pos.currency')}</span>
                </div>
              )}

              {/* Service charge quick toggle */}
              {!serviceCharge.enabled && (
                <button
                  onClick={() => setServiceCharge(prev => ({ ...prev, enabled: true }))}
                  className="text-[10px] text-muted-foreground/50 hover:text-orange-600 transition-colors flex items-center gap-1"
                  data-testid="button-enable-service-charge"
                >
                  <Hash className="w-3 h-3" />
                  {tc('إضافة رسوم خدمة (F7)','Add Service Charge (F7)')}
                </button>
              )}
              {/* Manual discount quick add */}
              {!manualDiscountAmount && (
                <button
                  onClick={() => setShowManualDiscount(true)}
                  className="text-[10px] text-muted-foreground/50 hover:text-green-600 transition-colors flex items-center gap-1"
                  data-testid="button-add-manual-discount"
                >
                  <DollarSign className="w-3 h-3" />
                  {tc('إضافة خصم يدوي','Add Manual Discount')}
                </button>
              )}

              {(itemDiscountTotal > 0 || manualDiscountAmount > 0 || serviceChargeAmount > 0) && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-black text-sm sm:text-base">{tc('الإجمالي النهائي','Final Total')}</span>
                    <span className="font-black text-base sm:text-xl text-primary" data-testid="text-final-grand-total">{finalGrandTotal.toFixed(2)} {t('pos.currency')}</span>
                  </div>
                </>
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
                      ? <span>سيُخصم {pointsDiscount.toFixed(2)} <SarIcon size={10} /> ({Math.round(pointsDiscount * 50)} نقطة) من الطلب</span>
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

            <div className="flex gap-2">
              <Button
                className="flex-1 h-11 sm:h-13 text-sm sm:text-base font-black rounded-xl shadow-lg shadow-primary/20 gap-2"
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
          </div>
        </aside>

        {/* ── Quick Shortcuts Sidebar (left strip, hidden on mobile) ── */}
        <QuickSidebar
          groups={[
            [
              {
                icon: <Plus className="w-5 h-5" />,
                label: tc('طلب جديد', 'New Order'),
                onClick: () => newCartTabRef.current(),
                shortcut: 'F4',
              },
              {
                icon: <PauseCircle className="w-5 h-5" />,
                label: tc('تعليق الطلب', 'Hold Order'),
                onClick: () => holdCurrentCartRef.current(),
                shortcut: 'F5',
              },
              {
                icon: <Archive className="w-5 h-5" />,
                label: tc('الطلبات المعلقة', 'Held Orders'),
                onClick: () => setShowHeldCarts(true),
                shortcut: 'F6',
              },
              {
                icon: <Merge className="w-5 h-5" />,
                label: tc('دمج الفواتير', 'Merge Bills'),
                onClick: () => setShowMergeBills(true),
                shortcut: 'Ctrl+M',
              },
            ],
            [
              {
                icon: <ClipboardList className="w-5 h-5" />,
                label: tc('الطلبات الواردة', 'Incoming Orders'),
                onClick: () => { setShowOrdersPanel(true); setNewOrdersCount(0); },
                badge: newOrdersCount || undefined,
                shortcut: 'F3',
              },
              {
                icon: <Grid3X3 className="w-5 h-5" />,
                label: tc('الطاولات', 'Tables'),
                onClick: () => setShowTablesDialog(true),
                shortcut: 'F10',
              },
              {
                icon: <FolderOpen className="w-5 h-5" />,
                label: tc('الحسابات المفتوحة', 'Open Bills'),
                onClick: () => setShowOpenBillsDialog(true),
                badge: openTableOrders.length || undefined,
                shortcut: 'F9',
              },
              {
                icon: <Car className="w-5 h-5" />,
                label: tc('طلبات السيارات', 'Car Orders'),
                onClick: () => setShowCarOrdersPanel(true),
                badge: carPreparationAlerts.length || undefined,
              },
            ],
            [
              {
                icon: <User className="w-5 h-5" />,
                label: tc('بحث عن عميل', 'Customer Lookup'),
                onClick: () => setShowCustomerInfo(v => !v),
                active: showCustomerInfo,
                shortcut: 'F8',
              },
              {
                icon: <Percent className="w-5 h-5" />,
                label: tc('خصم يدوي', 'Manual Discount'),
                onClick: () => setShowManualDiscount(true),
                shortcut: 'Ctrl+D',
              },
              {
                icon: <SplitSquareVertical className="w-5 h-5" />,
                label: tc('تقسيم الفاتورة', 'Split Bill'),
                onClick: () => setShowSplitPersons(true),
                shortcut: 'Ctrl+S',
              },
              {
                icon: <Receipt className="w-5 h-5" />,
                label: tc('آخر فاتورة', 'Last Receipt'),
                onClick: () => { if (lastOrder) setShowReceiptDialog(true); },
                active: !!lastOrder,
                shortcut: 'Ctrl+P',
              },
              {
                icon: <RotateCcw className="w-5 h-5" />,
                label: tc('استرجاع طلب', 'Refund'),
                onClick: () => setShowRefundDialog(true),
                danger: true,
              },
            ],
            [
              {
                icon: <Printer className="w-5 h-5" />,
                label: tc('إعدادات الطابعة', 'Printer Settings'),
                onClick: () => setShowPrinterSettings(true),
              },
              {
                icon: <Settings className="w-5 h-5" />,
                label: tc('إعدادات نقطة البيع', 'POS Settings'),
                onClick: () => setShowPOSSettings(true),
              },
              {
                icon: <Volume2 className="w-5 h-5" />,
                label: tc('إعدادات الأصوات', 'Sound Settings'),
                onClick: () => setShowSoundSettings(true),
              },
            ],
          ]}
          bottomItems={[
            {
              icon: <Home className="w-5 h-5" />,
              label: tc('الرئيسية', 'Home'),
              onClick: () => setLocation('/employee/home'),
            },
          ]}
        />
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
          <div className="flex gap-2 px-1 pb-2 flex-wrap">
            {([
              { key: 'all' as const, label: i18n.language === 'ar' ? 'الكل' : 'All', count: liveOrders?.length || 0 },
              { key: 'online' as const, label: i18n.language === 'ar' ? 'أونلاين' : 'Online', count: liveOrders?.filter((o: any) => o.channel === 'online' || o.channel === 'web').length || 0 },
              { key: 'pos' as const, label: i18n.language === 'ar' ? 'كاشير' : 'POS', count: liveOrders?.filter((o: any) => o.channel === 'pos' || !o.channel).length || 0 },
              { key: 'car' as const, label: i18n.language === 'ar' ? 'سيارات' : 'Cars', count: liveOrders?.filter((o: any) => o.orderType === 'car_pickup' || o.orderType === 'car-pickup').length || 0 },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOrdersFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  ordersFilter === tab.key
                    ? tab.key === 'online' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : tab.key === 'car' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.key === 'online' && <MonitorSmartphone className="w-3.5 h-3.5" />}
                {tab.key === 'car' && <Car className="w-3.5 h-3.5" />}
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
                  if (ordersFilter === 'car') return o.orderType === 'car_pickup' || o.orderType === 'car-pickup';
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
                              {(order.status === 'refunded' || (order as any).isFullyRefunded) && (
                                <Badge className="text-xs bg-red-100 text-red-700 border border-red-300">مسترجع ↩</Badge>
                              )}
                              {(order as any).refundedAmount > 0 && !(order as any).isFullyRefunded && order.status !== 'refunded' && (
                                <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-300">جزئي ↩</Badge>
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
                const unitPrice = getPosItemUnitPrice(item);
                const lineTotal = unitPrice * item.quantity;
                const itemAddons = item.customization?.selectedItemAddons || [];
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
                      {item.selectedSize && (
                        <p className="text-[10px] text-blue-600 mt-0.5">الحجم: {item.selectedSize}</p>
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
                  <span className="font-bold">{i18n.language === 'ar' ? 'خصم بطاقة مكان الشيف' : "Chef's Card Discount"}</span>
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
        <DialogContent className="max-w-sm max-h-[94vh] p-0 overflow-hidden flex flex-col" dir={dir}>
          <DialogHeader className="px-4 pt-3 pb-2 border-b shrink-0">
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
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* ── Offline warning ── */}
              {lastOrder.isOffline && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-700 px-3 py-2 shrink-0">
                  <span className="text-amber-600 dark:text-amber-400">📶</span>
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

              {/* ── New-design receipt iframe ── */}
              <div className="flex-1 overflow-y-auto bg-[#e0ddd8]" data-testid="text-receipt-order-number">
                {receiptPreviewHtml ? (
                  <iframe
                    srcDoc={receiptPreviewHtml}
                    title="customer-receipt"
                    className="w-full border-0"
                    style={{ height: '580px', minHeight: '400px' }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">{tc('جاري تحضير الفاتورة…', 'Preparing receipt…')}</span>
                  </div>
                )}
              </div>

              {/* ── Print error banner ── */}
              {lastPrintFailed && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800 px-3 py-2 shrink-0 text-right">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1 text-xs text-red-700 dark:text-red-400">
                    <p className="font-bold mb-0.5">لم تتم الطباعة</p>
                    <p>افتح إعدادات الطابعة ← اختر الطابعة (USB) ← ثم اضغط "طباعة" أدناه</p>
                  </div>
                </div>
              )}

              {/* ── Action buttons (5-action panel) ── */}
              <div className="flex flex-col gap-2 p-3 border-t bg-background shrink-0">
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

                {/* Row 1: full-width preview */}
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={handlePreviewBoth}
                  data-testid="button-preview-receipt"
                >
                  <Receipt className="w-4 h-4" />
                  {tc('معاينة الفواتير', 'Preview Invoices')}
                </Button>

                {/* Row 2: customer + kitchen */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={`flex-1 gap-2 ${lastPrintFailed ? 'border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30' : 'border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
                    onClick={() => { setLastPrintFailed(false); setReceiptCountdown(0); handlePrintCustomerOnly(); }}
                    data-testid="button-print-receipt"
                  >
                    <Printer className="w-4 h-4" />
                    {lastPrintFailed ? tc('إعادة الطباعة', 'Retry') : tc('فاتورة العميل', 'Customer')}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    onClick={handlePrintKitchenOnly}
                    data-testid="button-print-kitchen"
                  >
                    <Printer className="w-4 h-4" />
                    {tc('طلب المطبخ', 'Kitchen')}
                  </Button>
                </div>

                {/* Row 3: print both + edit */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2 bg-slate-900 hover:bg-black text-white"
                    onClick={handlePrintBoth}
                    data-testid="button-print-both"
                  >
                    <Printer className="w-4 h-4" />
                    {tc('طباعة الكل', 'Print Both')}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    onClick={handleEditLastOrder}
                    data-testid="button-edit-order"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {tc('تعديل الطلب', 'Edit Order')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Receipt visual preview modal ──────────────────────────────────── */}
      <Dialog open={showReceiptPreview} onOpenChange={setShowReceiptPreview}>
        <DialogContent className="max-w-md max-h-[96vh] p-0 overflow-hidden flex flex-col">
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

      {qrPayOrder && (
        <QrPayModal
          open={qrPayOpen}
          onClose={() => setQrPayOpen(false)}
          payId={qrPayOrder.id}
          orderNumber={qrPayOrder.orderNumber}
          amount={qrPayOrder.amount}
          onPaid={handleQrPaymentConfirmed}
        />
      )}

      <DrinkCustomizationDialog
        coffeeItem={posCustomizationItem?.item || null}
        variants={posCustomizationItem?.group || []}
        open={!!posCustomizationItem}
        modal={false}
        initialCustomization={posCustomizationItem?.initialCustomization}
        onClose={() => setPosCustomizationItem(null)}
        onConfirm={(customization: DrinkCustomization, quantity: number, selectedVariant?: CoffeeItem) => {
          const targetItem = selectedVariant || posCustomizationItem?.item;
          if (!targetItem) return;
          const selectedItemAddons = customization.selectedAddons.map(addon => ({
            nameAr: addon.nameAr + (addon.quantity > 1 ? ` ×${addon.quantity}` : ''),
            nameEn: addon.nameAr,
            price: addon.price * addon.quantity,
          }));
          addToOrder(targetItem, selectedItemAddons.length > 0 ? { selectedItemAddons } : undefined, customization.selectedSize || null, quantity, customization);
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
                    'payment_confirmed': t('pos.status_payment_confirmed', { defaultValue: 'تأكيد الدفع' }),
                    'confirmed': t('pos.status_confirmed', { defaultValue: 'مؤكد' }),
                    'in_progress': t('pos.status_in_progress'),
                    'ready': t('pos.status_ready'),
                    'delivered': t('pos.status_delivered', { defaultValue: 'تم التسليم' }),
                    'received': t('pos.status_received', { defaultValue: 'تم الاستلام' }),
                    'suspended': t('pos.status_suspended', { defaultValue: 'معلق' }),
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

      {/* ─── Car Orders Panel ────────────────────────────────────────────────── */}
      <Dialog open={showCarOrdersPanel} onOpenChange={setShowCarOrdersPanel}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              {tc("طلبات السيارات", "Car Orders")}
              {carPreparationAlerts.length > 0 && (
                <Badge className="bg-amber-500 text-white animate-pulse">{carPreparationAlerts.length} {tc("يحتاج تحضير", "needs prep")}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 p-1">
            {carPreparationAlerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black text-amber-600 flex items-center gap-1 px-1">
                  <Bell className="w-3.5 h-3.5 animate-bounce" />
                  {tc("تنبيهات — العميل يصل خلال دقائق!", "Alerts — Customer arriving soon!")}
                </p>
                {carPreparationAlerts.map((order: any) => (
                  <div key={order._id} className="border-2 border-amber-400 bg-amber-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500 text-white text-xs">🚗 يصل {order.arrivalTime}</Badge>
                        <span className="font-black text-sm">#{String(order.orderNumber || order.dailyNumber || '').padStart(3, '0')}</span>
                      </div>
                      <button onClick={() => setCarPreparationAlerts(prev => prev.filter(a => a._id !== order._id))} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="text-sm space-y-0.5">
                      <p><span className="text-gray-500">العميل:</span> <strong>{order.customerName}</strong> — {order.customerPhone}</p>
                      <p><span className="text-gray-500">السيارة:</span> <strong>{order.carColor} {order.carType}</strong> | لوحة: <strong className="font-mono">{order.plateNumber || '—'}</strong></p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {(order.items || []).map((item: any, i: number) => (
                        <span key={i}>{item.coffeeItem?.nameAr || item.nameAr} ×{item.quantity}{i < order.items.length - 1 ? '، ' : ''}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-primary">{Number(order.totalAmount || 0).toFixed(2)} ر.س</span>
                      <Button size="sm" className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
                        import('@/lib/print-utils').then(({ printTaxInvoice }) => {
                          printTaxInvoice({
                            orderNumber: String(order.orderNumber || order.dailyNumber || ''),
                            customerName: order.customerName || 'سيارة',
                            customerPhone: order.customerPhone || '',
                            items: (order.items || []).map((item: any) => ({
                              coffeeItem: { nameAr: item.coffeeItem?.nameAr || item.nameAr || '', nameEn: '', price: String(item.coffeeItem?.price || item.price || 0) },
                              quantity: item.quantity || 1,
                            })),
                            subtotal: String(Number(order.totalAmount || 0) / 1.15),
                            total: String(order.totalAmount || 0),
                            paymentMethod: 'نقدي عند الاستلام',
                            employeeName: employee?.fullName || '',
                            orderType: 'car_pickup' as any,
                            orderTypeName: `🚗 ${order.carColor || ''} ${order.carType || ''} (${order.plateNumber || ''})`,
                            date: new Date().toISOString(),
                          }, { autoPrint: true });
                        });
                      }}>
                        <Printer className="w-3 h-3 ml-1" /> طباعة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CurbsideOrdersList employeeName={employee?.fullName || ''} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Refund Dialog ───────────────────────────────────────────────────── */}
      <RefundDialog
        open={showRefundDialog}
        onOpenChange={setShowRefundDialog}
        branchId={employee?.branchId?.toString()}
        employeeId={employee?.id?.toString()}
        employeeName={employee?.fullName}
        tenantId={employee?.tenantId?.toString()}
      />

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

      {/* ─── Sound Settings Dialog ───────────────────────────────────────────── */}
      <Dialog open={showSoundSettings} onOpenChange={setShowSoundSettings}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right font-bold text-xl">
              <Volume2 className="w-5 h-5 text-primary" />
              {tc("إعدادات الأصوات", "Sound Settings")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <SoundSettingsPanel />
          </div>
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
            <button
              onClick={() => { setShowPOSSettings(false); setShowSoundSettings(true); }}
              className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all group"
              data-testid="button-open-sound-settings"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20">
                  <Volume2 className="w-5 h-5 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{tc("إعدادات الأصوات", "Sound Settings")}</p>
                  <p className="text-xs text-muted-foreground">{tc("تخصيص صوت لكل نوع طلب", "Customize sound per order type")}</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
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
                  disabled={posZoom <= 30}
                  onClick={() => setPosZoom(z => Math.max(30, z - 5))}
                  data-testid="button-zoom-out"
                >
                  <span className="text-lg font-bold">−</span>
                </Button>
                <div className="flex-1 flex justify-center gap-1">
                  {[30, 60, 80, 100].map(v => (
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

      {/* ── Held Orders Dialog ──────────────────────────────────────────── */}
      <Dialog open={showHeldCarts} onOpenChange={setShowHeldCarts}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              {tc('الطلبات المحجوزة','Held Orders')}
              <Badge variant="outline">{heldCarts.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          {heldCarts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{tc('لا توجد طلبات محجوزة','No held orders')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {heldCarts.map(held => (
                <div key={held.id} className="rounded-xl border p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{held.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {held.orderItems.length} {tc('منتج','items')} · {held.totalAmount.toFixed(2)} <SarIcon size={10} />
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(held.heldAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-8 text-xs" onClick={() => resumeHeldCart(held.id)} data-testid={`button-resume-held-${held.id}`}>
                      <FolderOpen className="w-3.5 h-3.5 ml-1" />
                      {tc('استرداد','Resume')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteHeldCart(held.id)} data-testid={`button-delete-held-${held.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Per-Item Discount Dialog ────────────────────────────────────── */}
      {showItemDiscountFor && (() => {
        const item = orderItems.find(i => i.lineItemId === showItemDiscountFor);
        if (!item) return null;
        return (
          <Dialog open={true} onOpenChange={() => setShowItemDiscountFor(null)}>
            <DialogContent className="max-w-xs" dir={dir}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-green-600" />
                  {tc('خصم على المنتج','Item Discount')}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm font-bold text-muted-foreground line-clamp-1">{getItemDisplayName(item.coffeeItem)}</p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm" variant={itemDiscountType === 'percent' ? 'default' : 'outline'}
                    onClick={() => setItemDiscountType('percent')} className="flex-1 h-8 text-xs"
                  >
                    <Percent className="w-3 h-3 ml-1" /> {tc('نسبة %','Percent %')}
                  </Button>
                  <Button
                    size="sm" variant={itemDiscountType === 'amount' ? 'default' : 'outline'}
                    onClick={() => setItemDiscountType('amount')} className="flex-1 h-8 text-xs"
                  >
                    <DollarSign className="w-3 h-3 ml-1" /> {tc('مبلغ ثابت','Fixed SAR')}
                  </Button>
                </div>
                <Input
                  type="number" min={0} step={itemDiscountType === 'percent' ? 1 : 0.01}
                  max={itemDiscountType === 'percent' ? 100 : getPosItemUnitPrice(item) * item.quantity}
                  placeholder={itemDiscountType === 'percent' ? tc('الخصم %','Discount %') : tc('مبلغ الخصم','Discount SAR')}
                  value={itemDiscountInput}
                  onChange={e => setItemDiscountInput(e.target.value)}
                  className="h-10 text-center text-base font-bold"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') applyItemDiscount(showItemDiscountFor); if (e.key === 'Escape') setShowItemDiscountFor(null); }}
                  data-testid="input-item-discount"
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => applyItemDiscount(showItemDiscountFor)} data-testid="button-apply-item-discount">
                    {tc('تطبيق','Apply')}
                  </Button>
                  {itemDiscounts[showItemDiscountFor] && (
                    <Button variant="outline" className="text-destructive" onClick={() => { clearItemDiscount(showItemDiscountFor); setShowItemDiscountFor(null); }}>
                      {tc('إزالة','Remove')}
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Manual Order Discount Dialog ────────────────────────────────── */}
      <Dialog open={showManualDiscount} onOpenChange={setShowManualDiscount}>
        <DialogContent className="max-w-xs" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              {tc('خصم يدوي على الطلب','Manual Order Discount')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={manualDiscountType === 'percent' ? 'default' : 'outline'} onClick={() => setManualDiscountType('percent')} className="flex-1 h-8 text-xs">
                <Percent className="w-3 h-3 ml-1" /> {tc('نسبة %','Percent %')}
              </Button>
              <Button size="sm" variant={manualDiscountType === 'amount' ? 'default' : 'outline'} onClick={() => setManualDiscountType('amount')} className="flex-1 h-8 text-xs">
                <DollarSign className="w-3 h-3 ml-1" /> {tc('مبلغ ثابت','Fixed SAR')}
              </Button>
            </div>
            <Input
              type="number" min={0} step={manualDiscountType === 'percent' ? 1 : 0.01}
              max={manualDiscountType === 'percent' ? 100 : finalGrandTotal}
              placeholder={manualDiscountType === 'percent' ? tc('الخصم %','Discount %') : tc('مبلغ الخصم','Discount SAR')}
              value={manualDiscountInput}
              onChange={e => setManualDiscountInput(e.target.value)}
              className="h-10 text-center text-base font-bold"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') applyManualDiscount(); if (e.key === 'Escape') setShowManualDiscount(false); }}
              data-testid="input-manual-discount"
            />
            {/* Service charge toggle inside manual discount dialog */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{tc('رسوم الخدمة','Service Charge')}</span>
                <Switch checked={serviceCharge.enabled} onCheckedChange={v => setServiceCharge(prev => ({...prev, enabled: v}))} />
              </div>
              {serviceCharge.enabled && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} max={serviceCharge.type === 'percent' ? 100 : undefined} step={1}
                    value={serviceCharge.value}
                    onChange={e => setServiceCharge(prev => ({...prev, value: parseFloat(e.target.value) || 0}))}
                    className="h-8 text-sm text-center flex-1"
                  />
                  <Button size="sm" variant={serviceCharge.type === 'percent' ? 'default' : 'outline'} className="h-8 text-xs px-2" onClick={() => setServiceCharge(prev => ({...prev, type: 'percent'}))}>%</Button>
                  <Button size="sm" variant={serviceCharge.type === 'fixed' ? 'default' : 'outline'} className="h-8 text-xs px-2" onClick={() => setServiceCharge(prev => ({...prev, type: 'fixed'}))}><SarIcon size={12} /></Button>
                </div>
              )}
            </div>
            <Button className="w-full" onClick={applyManualDiscount} data-testid="button-apply-manual-discount">
              {tc('تطبيق','Apply')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Merge Bills Dialog ──────────────────────────────────────────── */}
      <Dialog open={showMergeBills} onOpenChange={setShowMergeBills}>
        <DialogContent className="max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5" />
              {tc('دمج الفواتير','Merge Bills')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{tc('اختر الطلب الذي تريد دمجه في الطلب الحالي','Choose which order to merge into the current one')}</p>
          <div className="space-y-2">
            {cartTabs.filter(t => t.id !== activeTabId).map(tab => {
              const saved = savedTabsRef.current[tab.id];
              const items = saved?.orderItems || [];
              const total = items.reduce((s: number, i: any) => s + getPosItemUnitPriceEarly(i) * i.quantity, 0);
              return (
                <div key={tab.id} className="rounded-xl border p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{tab.name}</p>
                    <p className="text-[10px] text-muted-foreground">{items.length} {tc('منتج','items')} · {total.toFixed(2)} <SarIcon size={10} /></p>
                  </div>
                  <Button size="sm" className="h-8 text-xs" onClick={() => mergeTabIntoActive(tab.id)} data-testid={`button-merge-tab-${tab.id}`}>
                    <Merge className="w-3.5 h-3.5 ml-1" />
                    {tc('دمج','Merge')}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <MobileBottomNav />
    </div>
    </div>
  );
}

// ─── Curbside Orders List (sub-component for Car Orders Panel) ────────────────
function CurbsideOrdersList({ employeeName }: { employeeName: string }) {
  const { data: curbsideOrders, isLoading } = useQuery<any[]>({
    queryKey: ["/api/orders/curbside"],
    refetchInterval: 30000,
  });

  const orders = curbsideOrders || [];

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin ml-2" />
      <span>جاري التحميل...</span>
    </div>
  );

  if (orders.length === 0) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <Car className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p>لا توجد طلبات سيارات نشطة</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground px-1">كل طلبات السيارات النشطة ({orders.length})</p>
      {orders.map((order: any) => (
        <div key={order._id} className="border rounded-xl p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                🚗 يصل {order.arrivalTime || '—'}
              </Badge>
              <span className="font-black text-sm">#{String(order.orderNumber || order.dailyNumber || '').padStart(3, '0')}</span>
            </div>
            <Badge className={`text-xs ${
              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
              order.status === 'ready' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {order.status === 'pending' ? 'معلّق' :
               order.status === 'preparing' ? 'يُحضَّر' :
               order.status === 'ready' ? 'جاهز' :
               order.status || '—'}
            </Badge>
          </div>
          <div className="text-sm space-y-0.5 text-gray-700">
            <p><span className="text-gray-400 text-xs">العميل:</span> <strong>{order.customerName || '—'}</strong> {order.customerPhone ? `| ${order.customerPhone}` : ''}</p>
            <p><span className="text-gray-400 text-xs">السيارة:</span> <strong>{order.carColor || ''} {order.carType || ''}</strong>{order.plateNumber ? ` | ${order.plateNumber}` : ''}</p>
          </div>
          <div className="text-xs text-gray-500 leading-relaxed">
            {(order.items || []).map((item: any, i: number) => (
              <span key={i}>{item.coffeeItem?.nameAr || item.nameAr || ''} ×{item.quantity || 1}{i < (order.items?.length || 0) - 1 ? '، ' : ''}</span>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-black text-primary">{Number(order.totalAmount || 0).toFixed(2)} ر.س</span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => {
                import('@/lib/print-utils').then(({ printTaxInvoice }) => {
                  printTaxInvoice({
                    orderNumber: String(order.orderNumber || order.dailyNumber || ''),
                    customerName: order.customerName || 'سيارة',
                    customerPhone: order.customerPhone || '',
                    items: (order.items || []).map((item: any) => ({
                      coffeeItem: {
                        nameAr: item.coffeeItem?.nameAr || item.nameAr || '',
                        nameEn: item.coffeeItem?.nameEn || item.nameEn || '',
                        price: String(item.coffeeItem?.price || item.price || 0),
                      },
                      quantity: item.quantity || 1,
                    })),
                    subtotal: String(Number(order.totalAmount || 0) / 1.15),
                    total: String(order.totalAmount || 0),
                    paymentMethod: 'نقدي عند الاستلام',
                    employeeName,
                    orderType: 'car_pickup' as any,
                    orderTypeName: `🚗 ${order.carColor || ''} ${order.carType || ''} (${order.plateNumber || ''})`,
                    date: new Date().toISOString(),
                  }, { autoPrint: true });
                });
              }}
            >
              <Printer className="w-3 h-3" />
              طباعة
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
