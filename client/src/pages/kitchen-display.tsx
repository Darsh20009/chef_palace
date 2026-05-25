import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/hooks/use-toast";
import {
  playNotificationSound,
  getSoundEnabled,
  setSoundEnabled as saveSoundEnabled,
  initAudioUnlock,
} from "@/lib/notification-sounds";
import { AudioUnlockBanner } from "@/components/audio-unlock-banner";
import { useRealtimeEvent, useRealtimeStatus } from "@/hooks/useRealtimeEngine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChefHat, CheckCircle2, AlertTriangle, RefreshCw,
  ArrowLeft, Wifi, WifiOff, Store, ShoppingBag, Truck, Navigation,
  Clock, History, Zap, Star, RotateCcw, Car, Bell, BellOff,
  Flame, Snowflake, Coffee, Utensils, Cookie, FlameKindling,
  Timer, Check, X, ChevronDown, ChevronUp, User, PhoneCall,
  AlertOctagon, PlayCircle, PauseCircle, Eye, EyeOff,
  Volume2, VolumeX, Home,
} from "lucide-react";
import { useLocation } from "wouter";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { cn } from "@/lib/utils";
import { QuickSidebar } from "@/components/quick-sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  coffeeItemId: string;
  quantity: number;
  size: string;
  extras?: string[];
  sugarLevel?: string;
  notes?: string;
  lineItemId?: string;
  coffeeItem?: {
    nameAr: string;
    nameEn?: string;
    price?: number;
    imageUrl?: string;
    category?: string;
    station?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  tableNumber?: string;
  orderType?: string;
  deliveryType?: string;
  carInfo?: { carType: string; carColor: string; plateNumber: string };
  carType?: string; carColor?: string; carPlate?: string; plateNumber?: string;
  arrivalTime?: string;
  scheduledPickupTime?: string;
  preparationHoldUntil?: string;
  estimatedPrepTimeInMinutes?: number;
  customerNotes?: string; notes?: string;
  branchId?: string; channel?: string;
  customerName?: string; customerPhone?: string;
  priority?: 'normal' | 'rush' | 'vip';
  driverName?: string;
}

// ─── Stations ─────────────────────────────────────────────────────────────────
interface Station {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  keywords: string[]; // category keywords that belong to this station
  color: string;
}

const STATIONS: Station[] = [
  { id: 'all',      labelAr: 'الكل',            labelEn: 'All',        icon: <Utensils className="w-4 h-4" />,   keywords: [],                             color: 'bg-primary' },
  { id: 'hot',      labelAr: 'ساخن',            labelEn: 'Hot',        icon: <Flame className="w-4 h-4" />,      keywords: ['hot','ساخن','espresso','coffee','قهوة','لاتيه','كابتشينو','موكا','americano','أمريكانو'],  color: 'bg-red-500' },
  { id: 'cold',     labelAr: 'بارد',            labelEn: 'Cold',       icon: <Snowflake className="w-4 h-4" />,  keywords: ['cold','بارد','iced','frappe','فرابيه','smoothie','سموثي','milkshake','milkshakes'], color: 'bg-blue-500' },
  { id: 'food',     labelAr: 'طعام',            labelEn: 'Food',       icon: <Utensils className="w-4 h-4" />,   keywords: ['food','طعام','sandwich','سندويش','breakfast','فطور','lunch','waffles','وافل','pasta'],  color: 'bg-orange-500' },
  { id: 'desserts', labelAr: 'حلويات',          labelEn: 'Desserts',   icon: <Cookie className="w-4 h-4" />,     keywords: ['dessert','حلو','حلويات','cake','كيك','cookie','كوكيز','brownie','cheesecake'],  color: 'bg-pink-500' },
  { id: 'drinks',   labelAr: 'مشروبات أخرى',   labelEn: 'Other Drinks', icon: <Coffee className="w-4 h-4" />,  keywords: ['juice','عصير','tea','شاي','lemonade','ليمون','سودا','soda'],  color: 'bg-green-600' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getElapsedSeconds(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
}
function getElapsedMinutes(dateString: string): number {
  return Math.floor(getElapsedSeconds(dateString) / 60);
}
function getDelayThreshold(order: Order): number {
  return order.estimatedPrepTimeInMinutes || 10;
}
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function orderMatchesStation(order: Order, stationId: string): boolean {
  if (stationId === 'all') return true;
  const station = STATIONS.find(s => s.id === stationId);
  if (!station) return true;
  return order.items.some(item => {
    const cat = ((item.coffeeItem?.category || '') + ' ' + (item.coffeeItem?.station || '')).toLowerCase();
    const nameAr = (item.coffeeItem?.nameAr || '').toLowerCase();
    const nameEn = (item.coffeeItem?.nameEn || '').toLowerCase();
    return station.keywords.some(kw => cat.includes(kw) || nameAr.includes(kw) || nameEn.includes(kw));
  });
}

function getOrderTypeIcon(order: Order) {
  const type = order.deliveryType || order.orderType;
  if (type === 'delivery') return <Truck className="w-3.5 h-3.5 text-blue-500" />;
  if (type === 'car-pickup' || type === 'car_pickup') return <Car className="w-3.5 h-3.5 text-purple-500" />;
  if (type === 'pickup' || type === 'takeaway') return <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />;
  return <Store className="w-3.5 h-3.5 text-green-500" />;
}

// ─── Pulsing Rush Sound interval ──────────────────────────────────────────────
let rushInterval: ReturnType<typeof setInterval> | null = null;

export default function KitchenDisplay() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [activeStation, setActiveStation]   = useState('all');
  const [activeTab, setActiveTab]           = useState<'all'|'pending'|'preparing'|'ready'|'completed'|'delayed'>('all');
  const [autoRefresh, setAutoRefresh]       = useState(true);
  const [soundEnabled, setSoundEnabled]     = useState(() => getSoundEnabled("kitchen"));

  // ── Rush mode ────────────────────────────────────────────────────────────────
  const [rushMode, setRushMode]             = useState(false);

  // ── Priority (local client-side flags) ──────────────────────────────────────
  const [priorityOrders, setPriorityOrders] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('kds-priority') || '[]')); }
    catch { return new Set(); }
  });

  // ── Item-level ready state per order ────────────────────────────────────────
  const [itemReady, setItemReady] = useState<Record<string, boolean[]>>({});

  // ── Expanded cards ────────────────────────────────────────────────────────────
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // ── Delay Fire ────────────────────────────────────────────────────────────────
  const [delayFireDialog, setDelayFireDialog] = useState<string | null>(null);
  const [delayFireMinutes, setDelayFireMinutes] = useState('15');

  // ── Driver coordination ──────────────────────────────────────────────────────
  const [driverAssignments, setDriverAssignments] = useState<Record<string, string>>({});
  const [showDriverPanel, setShowDriverPanel] = useState(false);

  // ── Recall confirm ────────────────────────────────────────────────────────────
  const [recallOrderId, setRecallOrderId] = useState<string | null>(null);

  // ── Tick every second for live timers ─────────────────────────────────────────
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-unlock audio on first user interaction ────────────────────────────
  // Browsers block autoplay until user gesture — unlock silently on first click/touch
  useEffect(() => {
    const unlock = () => {
      initAudioUnlock();
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('click', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, []);

  // ── Rush mode interval sound ───────────────────────────────────────────────────
  useEffect(() => {
    if (rushMode && soundEnabled) {
      rushInterval = setInterval(() => {
        playNotificationSound('cashierOrder', 0.5);
      }, 30000);
    }
    return () => { if (rushInterval) { clearInterval(rushInterval); rushInterval = null; } };
  }, [rushMode, soundEnabled]);

  // ── Persist priority to localStorage ──────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('kds-priority', JSON.stringify([...priorityOrders]));
  }, [priorityOrders]);

  // ─── Data fetching ───────────────────────────────────────────────────────────
  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders/kitchen"],
    refetchInterval: autoRefresh ? 6000 : false,
  });

  // ─── Polling-based new order detection (backup when WebSocket is down) ───────
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstPollRef  = useRef(true);

  useEffect(() => {
    if (!orders.length && !isFirstPollRef.current) return;
    const currentIds = new Set(orders.map((o: Order) => o.id as string));
    if (isFirstPollRef.current) {
      prevOrderIdsRef.current = currentIds;
      isFirstPollRef.current = false;
      return;
    }
    const newOrders = orders.filter(
      (o: Order) => !prevOrderIdsRef.current.has(o.id as string)
    );
    if (newOrders.length > 0 && soundEnabled) {
      playNotificationSound(
        newOrders[0]?.channel === 'online' ? 'cashierOrder' : 'newOrder', 0.9
      );
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── WebSocket ───────────────────────────────────────────────────────────────
  const alertedPrepNowIds = useRef<Set<string>>(new Set());

  const handleNewOrder = useCallback((order: Order) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
    if (soundEnabled) {
      playNotificationSound(order?.channel === 'online' ? 'cashierOrder' : 'newOrder', 0.9);
      toast({
        title: tc('🆕 طلب جديد!', '🆕 New Order!'),
        description: `#${order.orderNumber}`,
      });
    }
  }, [soundEnabled, toast, tc]);

  const handleOrderUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
  }, []);

  const handleOrderReady = useCallback((order: Order) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
    if (soundEnabled) {
      playNotificationSound('success', 0.8);
      toast({
        title: tc('✅ طلب جاهز!', '✅ Order Ready!'),
        description: `#${order.orderNumber}`,
      });
    }
  }, [soundEnabled, toast, tc]);

  const { connected: isConnected } = useRealtimeStatus();
  useRealtimeEvent("new_order",     handleNewOrder);
  useRealtimeEvent("order_updated", handleOrderUpdated);
  useRealtimeEvent("order_ready",   handleOrderReady);

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ id, status, estimatedPrepTimeInMinutes }: { id: string; status: string; estimatedPrepTimeInMinutes?: number }) =>
      apiRequest("PUT", `/api/orders/${id}/status`, { status, estimatedPrepTimeInMinutes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] }),
    onError: (e: any) => toast({ title: tc('خطأ', 'Error'), description: e?.message, variant: 'destructive' }),
  });

  const timeMutation = useMutation({
    mutationFn: ({ id, additionalMinutes }: { id: string; additionalMinutes: number }) =>
      apiRequest("PATCH", `/api/orders/${id}/prep-time`, { additionalMinutes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] }),
  });

  const handleStartPreparing  = (id: string, est?: number) => statusMutation.mutate({ id, status: 'in_progress', estimatedPrepTimeInMinutes: est || 5 });
  const handleMarkReady       = (id: string) => { statusMutation.mutate({ id, status: 'ready' }); if (soundEnabled) playNotificationSound('success', 0.8); };
  const handleMarkCompleted   = (id: string) => statusMutation.mutate({ id, status: 'completed' });
  const handleRecall          = (id: string) => statusMutation.mutate({ id, status: 'confirmed' });

  const handleDelayFire = (orderId: string) => {
    const minutes = parseInt(delayFireMinutes) || 15;
    timeMutation.mutate({ id: orderId, additionalMinutes: minutes });
    setDelayFireDialog(null);
    toast({ title: tc(`⏱ تم تأجيل الطلب ${minutes} دقيقة`, `⏱ Order delayed by ${minutes} min`) });
  };

  // ─── Computed order groups ─────────────────────────────────────────────────
  const {
    pendingOrders, preparingOrders, readyOrders, completedOrders,
    delayedOrders, scheduledOrders, needsPrepNowOrders, preWarningOrders,
  } = useMemo(() => {
    void tick;
    const now = Date.now();
    const isOnHold     = (o: Order) => !!(o.preparationHoldUntil && new Date(o.preparationHoldUntil).getTime() > now);
    const isPrepDue    = (o: Order) => !!(o.preparationHoldUntil && new Date(o.preparationHoldUntil).getTime() <= now);
    const isPreWarning = (o: Order) => !!(o.preparationHoldUntil && new Date(o.preparationHoldUntil).getTime() > now && new Date(o.preparationHoldUntil).getTime() - now <= 10 * 60 * 1000);

    const all = orders.filter(o => activeStation === 'all' || orderMatchesStation(o, activeStation));

    const scheduled    = all.filter(o => isOnHold(o) && !isPreWarning(o) && ['pending','payment_confirmed','confirmed'].includes(o.status));
    const preWarning   = all.filter(o => isPreWarning(o) && ['pending','payment_confirmed','confirmed'].includes(o.status));
    const needsPrepNow = all.filter(o => isPrepDue(o) && ['pending','payment_confirmed','confirmed'].includes(o.status));
    const pending      = all.filter(o => ['pending','payment_confirmed','confirmed'].includes(o.status) && !isOnHold(o));
    const preparing    = all.filter(o => o.status === 'in_progress');
    const ready        = all.filter(o => o.status === 'ready');
    const completed    = all.filter(o => o.status === 'completed');
    const delayed      = [...pending, ...preparing].filter(o => getElapsedMinutes(o.createdAt) >= getDelayThreshold(o));

    // Sort: priority orders first, then by elapsed time
    const sortFn = (a: Order, b: Order) => {
      const aPriority = priorityOrders.has(a.id) ? 0 : (a.priority === 'rush' ? 1 : 2);
      const bPriority = priorityOrders.has(b.id) ? 0 : (b.priority === 'rush' ? 1 : 2);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    };

    return {
      pendingOrders:     [...needsPrepNow, ...pending].sort(sortFn),
      preparingOrders:   preparing.sort(sortFn),
      readyOrders:       ready,
      completedOrders:   completed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      delayedOrders:     delayed,
      scheduledOrders:   scheduled,
      needsPrepNowOrders: needsPrepNow,
      preWarningOrders:  preWarning,
    };
  }, [orders, activeStation, priorityOrders, tick]);

  // ─── Prep-now sound alert ───────────────────────────────────────────────────
  useEffect(() => {
    if (!soundEnabled || needsPrepNowOrders.length === 0) return;
    const fresh = needsPrepNowOrders.filter(o => !alertedPrepNowIds.current.has(o.id));
    if (!fresh.length) return;
    fresh.forEach(o => alertedPrepNowIds.current.add(o.id));
    playNotificationSound('cashierOrder', 0.9);
    toast({ title: tc('⏰ حان وقت التحضير!', '⏰ Time to prepare!'), description: `${fresh.length} ${tc('طلب جاهز للتحضير الآن','orders need prep now')}` });
  }, [needsPrepNowOrders, soundEnabled, toast, tc]);

  // ─── Display helpers ────────────────────────────────────────────────────────
  const getDisplayOrders = (): Order[] => {
    switch (activeTab) {
      case 'pending':   return pendingOrders;
      case 'preparing': return preparingOrders;
      case 'ready':     return readyOrders;
      case 'completed': return completedOrders;
      case 'delayed':   return delayedOrders;
      default: return [...pendingOrders, ...preparingOrders, ...readyOrders];
    }
  };

  const togglePriority = (id: string) => {
    setPriorityOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleItemReady = (orderId: string, itemIndex: number, totalItems: number) => {
    setItemReady(prev => {
      const arr = prev[orderId] ? [...prev[orderId]] : Array(totalItems).fill(false);
      arr[itemIndex] = !arr[itemIndex];
      return { ...prev, [orderId]: arr };
    });
  };

  const getItemReadyCount = (orderId: string, totalItems: number) => {
    const arr = itemReady[orderId];
    if (!arr) return 0;
    return arr.filter(Boolean).length;
  };

  const allItemsReady = (orderId: string, totalItems: number) =>
    getItemReadyCount(orderId, totalItems) === totalItems && totalItems > 0;

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Station counts ──────────────────────────────────────────────────────────
  const stationCounts = useMemo(() => {
    const active = [...pendingOrders, ...preparingOrders, ...readyOrders];
    return STATIONS.reduce((acc, st) => {
      acc[st.id] = st.id === 'all' ? active.length : active.filter(o => orderMatchesStation(o, st.id)).length;
      return acc;
    }, {} as Record<string, number>);
  }, [pendingOrders, preparingOrders, readyOrders]);

  const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length;
  const isMutating  = statusMutation.isPending || timeMutation.isPending;

  const handleStartAllPending = useCallback(async () => {
    for (const order of pendingOrders) {
      await apiRequest('PATCH', `/api/orders/${order.id}/status`, { status: 'preparing' });
    }
    queryClient.invalidateQueries({ queryKey: ['/api/orders/kitchen'] });
  }, [pendingOrders]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState message={tc('جاري تحميل الطلبات...', 'Loading orders...')} />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen flex flex-col transition-colors duration-300', rushMode ? 'bg-red-950/5' : 'bg-background')}>

      {/* ── RUSH MODE BANNER ──────────────────────────────────────────────────── */}
      {rushMode && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5" />
            <span className="font-black text-sm">{tc('🔥 وضع الطوارئ مفعّل — جميع الطلبات أولوية قصوى!', '🔥 RUSH MODE ACTIVE — All orders max priority!')}</span>
          </div>
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setRushMode(false)}>
            {tc('إيقاف', 'Stop')}
          </Button>
        </div>
      )}

      {/* ── PRE-WARNING BANNER ───────────────────────────────────────────────── */}
      {preWarningOrders.length > 0 && (
        <div className="bg-yellow-400 border-b-2 border-yellow-600 px-4 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            <AlertTriangle className="h-5 w-5 text-yellow-900 animate-pulse" />
            <span className="font-bold text-yellow-900 text-sm">{tc('⏰ تنبيه — الطلبات التالية موعدها خلال 10 دقائق:', '⏰ Alert — following orders due in 10 min:')}</span>
            {preWarningOrders.map(o => {
              const minsLeft = Math.ceil((new Date(o.preparationHoldUntil!).getTime() - Date.now()) / 60000);
              return (
                <span key={o.id} className="bg-yellow-900 text-yellow-100 text-xs font-black px-3 py-1 rounded-full">
                  #{o.orderNumber} ({minsLeft}{tc('د', 'm')})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Left: back + title */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation('/employee/home')} data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <ChefHat className="h-5 w-5 text-primary" />
              <h1 className="font-black text-base hidden sm:block">{tc('شاشة المطبخ', 'Kitchen Display')}</h1>
              {/* Live order counts */}
              <div className="flex items-center gap-1 ml-2">
                <Badge className="bg-primary/10 text-primary border-0 text-xs font-bold">{tc('انتظار', 'Wait')} {pendingOrders.length}</Badge>
                <Badge className="bg-yellow-500/10 text-yellow-700 border-0 text-xs font-bold">{tc('تحضير', 'Prep')} {preparingOrders.length}</Badge>
                <Badge className="bg-green-500/10 text-green-700 border-0 text-xs font-bold">{tc('جاهز', 'Ready')} {readyOrders.length}</Badge>
                {delayedOrders.length > 0 && <Badge className="bg-destructive/10 text-destructive border-0 text-xs font-bold animate-pulse">⚠ {delayedOrders.length}</Badge>}
              </div>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Rush mode */}
              <Button
                size="sm"
                variant={rushMode ? 'destructive' : 'outline'}
                className={cn('h-8 text-xs gap-1.5', rushMode && 'animate-pulse')}
                onClick={() => { setRushMode(v => !v); if (!rushMode && soundEnabled) playNotificationSound('cashierOrder', 1); }}
                data-testid="button-rush-mode"
              >
                <FlameKindling className="w-3.5 h-3.5" />
                {tc('طوارئ', 'Rush')}
              </Button>

              {/* Driver panel */}
              <Button size="sm" variant={showDriverPanel ? 'default' : 'outline'} className="h-8 text-xs gap-1.5" onClick={() => setShowDriverPanel(v => !v)} data-testid="button-driver-panel">
                <Truck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tc('سائقون', 'Drivers')}</span>
                {readyOrders.filter(o => o.deliveryType === 'delivery').length > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] font-black flex items-center justify-center">{readyOrders.filter(o => o.deliveryType === 'delivery').length}</span>
                )}
              </Button>

              {/* WS status */}
              <Badge variant="outline" className={isConnected ? 'bg-green-500/10 text-green-500 border-green-500/30 text-xs' : 'bg-red-500/10 text-red-500 border-red-500/30 text-xs'}>
                {isConnected ? <Wifi className="h-3 w-3 ml-1" /> : <WifiOff className="h-3 w-3 ml-1" />}
                {isConnected ? tc('متصل', 'Live') : tc('مقطوع', 'Off')}
              </Badge>

              {/* Sound */}
              <AudioUnlockBanner
                pageKey="kitchen"
                soundEnabled={soundEnabled}
                onToggleSound={val => { setSoundEnabled(val); saveSoundEnabled('kitchen', val); }}
              />

              {/* Refresh */}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className={cn('h-3.5 w-3.5', autoRefresh && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>

        {/* ── STATION BAR ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 px-3 pb-2 overflow-x-auto no-scrollbar">
          {STATIONS.map(station => (
            <button
              key={station.id}
              onClick={() => setActiveStation(station.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0',
                activeStation === station.id
                  ? `${station.color} text-white shadow`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              data-testid={`button-station-${station.id}`}
            >
              {station.icon}
              <span>{tc(station.labelAr, station.labelEn)}</span>
              {stationCounts[station.id] > 0 && (
                <span className={cn('rounded-full px-1.5 text-[9px] font-black', activeStation === station.id ? 'bg-white/30 text-white' : 'bg-primary/10 text-primary')}>
                  {stationCounts[station.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── STATUS TABS ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-0 border-t overflow-x-auto no-scrollbar">
          {([
            { key: 'all',       labelAr: 'الكل',     labelEn: 'All',      count: totalActive,           color: '' },
            { key: 'pending',   labelAr: 'انتظار',   labelEn: 'Waiting',  count: pendingOrders.length,  color: 'text-primary' },
            { key: 'preparing', labelAr: 'تحضير',    labelEn: 'Preparing',count: preparingOrders.length,color: 'text-yellow-600' },
            { key: 'ready',     labelAr: 'جاهز',     labelEn: 'Ready',    count: readyOrders.length,    color: 'text-green-600' },
            { key: 'delayed',   labelAr: 'متأخر',    labelEn: 'Delayed',  count: delayedOrders.length,  color: 'text-destructive' },
            { key: 'completed', labelAr: 'مكتمل',    labelEn: 'Done',     count: completedOrders.length,color: 'text-muted-foreground' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0',
                activeTab === tab.key
                  ? 'border-primary text-primary bg-primary/5'
                  : `border-transparent text-muted-foreground hover:text-foreground ${tab.key === 'delayed' && delayedOrders.length > 0 ? 'text-destructive animate-pulse' : ''}`,
              )}
              data-testid={`button-kds-tab-${tab.key}`}
            >
              {tc(tab.labelAr, tab.labelEn)}
              {tab.count > 0 && <span className={cn('rounded-full px-1.5 text-[9px] font-black', activeTab === tab.key ? 'bg-primary text-white' : 'bg-muted')}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </header>

      {/* ── CONTENT AREA with quick sidebar ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-16 sm:pb-0">

      {/* ── DRIVER COORDINATION PANEL ────────────────────────────────────────── */}
      {showDriverPanel && (
        <div className="bg-card border-b px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black flex items-center gap-2"><Truck className="w-4 h-4 text-primary" />{tc('تنسيق السائقين', 'Driver Coordination')}</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowDriverPanel(false)}><X className="w-4 h-4" /></Button>
          </div>
          {readyOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{tc('لا توجد طلبات جاهزة للتسليم', 'No orders ready for delivery')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {readyOrders.map(order => {
                const delivType = order.deliveryType || order.orderType;
                return (
                  <div key={order.id} className="rounded-xl border p-3 flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0',
                      delivType === 'delivery' ? 'bg-blue-500' : delivType === 'car_pickup' || delivType === 'car-pickup' ? 'bg-purple-500' : 'bg-amber-500'
                    )}>
                      {order.orderNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{order.customerName || tc('عميل', 'Customer')}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {getOrderTypeIcon(order)}
                        <span className="text-[10px] text-muted-foreground">{order.items.length} {tc('منتج', 'items')}</span>
                      </div>
                      <input
                        className="mt-1 w-full text-[10px] border rounded px-1.5 py-0.5 bg-background"
                        placeholder={tc('اسم السائق...', 'Driver name...')}
                        value={driverAssignments[order.id] || ''}
                        onChange={e => setDriverAssignments(prev => ({ ...prev, [order.id]: e.target.value }))}
                        data-testid={`input-driver-${order.id}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => handleMarkCompleted(order.id)} data-testid={`button-driver-complete-${order.id}`}>
                        <Check className="w-3 h-3 ml-1" />{tc('سلّم', 'Done')}
                      </Button>
                      {order.customerPhone && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" asChild>
                          <a href={`tel:${order.customerPhone}`}>
                            <PhoneCall className="w-3 h-3 ml-1" />{tc('اتصل', 'Call')}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN GRID ────────────────────────────────────────────────────────── */}
      <main className="p-3">
        {getDisplayOrders().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
            <CheckCircle2 className="h-16 w-16 mb-4 text-green-500" />
            <h3 className="text-xl font-bold mb-1">{tc('لا توجد طلبات', 'No Orders')}</h3>
            <p className="text-sm">{activeTab === 'completed' ? tc('لا توجد طلبات مكتملة بعد', 'No completed orders yet') : tc('لا توجد طلبات في هذه الحالة', 'No orders in this state')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {getDisplayOrders().map(order => (
              <KdsCard
                key={order.id}
                order={order}
                tick={tick}
                isRushMode={rushMode}
                isPriority={priorityOrders.has(order.id)}
                isExpanded={expandedCards.has(order.id)}
                itemReadyArr={itemReady[order.id]}
                isMutating={isMutating}
                tc={tc}
                onTogglePriority={() => togglePriority(order.id)}
                onToggleExpand={() => toggleExpanded(order.id)}
                onToggleItem={(idx) => toggleItemReady(order.id, idx, order.items.length)}
                onStartPreparing={(est) => handleStartPreparing(order.id, est)}
                onMarkReady={() => handleMarkReady(order.id)}
                onMarkCompleted={() => handleMarkCompleted(order.id)}
                onRecall={() => setRecallOrderId(order.id)}
                onDelayFire={() => setDelayFireDialog(order.id)}
                onAddTime={(min) => timeMutation.mutate({ id: order.id, additionalMinutes: min })}
              />
            ))}
          </div>
        )}
      </main>
      </div>{/* end scrollable content */}

        {/* ── Kitchen Quick Sidebar ────────────────────────────────────────── */}
        <QuickSidebar
          groups={[
            [
              {
                icon: <PlayCircle className="w-5 h-5" />,
                label: tc('بدء تحضير الكل', 'Start All Pending'),
                onClick: handleStartAllPending,
                active: pendingOrders.length > 0,
                badge: pendingOrders.length || undefined,
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
      </div>{/* end flex row */}

      {/* ── DELAY FIRE DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={!!delayFireDialog} onOpenChange={v => !v && setDelayFireDialog(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-orange-500" />
              {tc('تأجيل إطلاق الطلب', 'Delay Fire Order')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{tc('احجز الطلب لدقائق إضافية قبل بدء التحضير','Hold order for extra minutes before preparation starts')}</p>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={120}
              value={delayFireMinutes}
              onChange={e => setDelayFireMinutes(e.target.value)}
              className="text-center font-bold"
              data-testid="input-delay-fire-minutes"
            />
            <span className="text-sm font-bold">{tc('دقيقة', 'min')}</span>
          </div>
          <div className="flex gap-2">
            {[5, 10, 15, 30].map(m => (
              <Button key={m} size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setDelayFireMinutes(String(m))}>{m}</Button>
            ))}
          </div>
          <Button
            onClick={() => delayFireDialog && handleDelayFire(delayFireDialog)}
            disabled={isMutating}
            data-testid="button-confirm-delay-fire"
          >
            <PauseCircle className="w-4 h-4 ml-2" />
            {tc('تأجيل', 'Delay')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── RECALL CONFIRM DIALOG ────────────────────────────────────────────── */}
      <Dialog open={!!recallOrderId} onOpenChange={v => !v && setRecallOrderId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              {tc('استرداد الطلب', 'Recall Order')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{tc('هل تريد إعادة الطلب إلى قائمة الانتظار؟', 'Return this order to the active queue?')}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRecallOrderId(null)}>{tc('إلغاء', 'Cancel')}</Button>
            <Button className="flex-1" onClick={() => { if (recallOrderId) { handleRecall(recallOrderId); setRecallOrderId(null); } }} data-testid="button-confirm-recall">
              <RotateCcw className="w-4 h-4 ml-2" />
              {tc('استرداد', 'Recall')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MobileBottomNav />
    </div>
  );
}

// ─── KDS Card Component ───────────────────────────────────────────────────────
interface KdsCardProps {
  order: Order;
  tick: number;
  isRushMode: boolean;
  isPriority: boolean;
  isExpanded: boolean;
  itemReadyArr?: boolean[];
  isMutating: boolean;
  tc: (ar: string, en: string) => string;
  onTogglePriority: () => void;
  onToggleExpand: () => void;
  onToggleItem: (idx: number) => void;
  onStartPreparing: (est?: number) => void;
  onMarkReady: () => void;
  onMarkCompleted: () => void;
  onRecall: () => void;
  onDelayFire: () => void;
  onAddTime: (min: number) => void;
}

function KdsCard({
  order, tick, isRushMode, isPriority, isExpanded, itemReadyArr = [],
  isMutating, tc, onTogglePriority, onToggleExpand, onToggleItem,
  onStartPreparing, onMarkReady, onMarkCompleted, onRecall, onDelayFire, onAddTime,
}: KdsCardProps) {
  void tick;
  const elapsedSec  = getElapsedSeconds(order.createdAt);
  const elapsedMin  = Math.floor(elapsedSec / 60);
  const threshold   = getDelayThreshold(order);
  const isDelayed   = elapsedMin >= threshold && ['pending','payment_confirmed','confirmed','in_progress'].includes(order.status);
  const isUrgent    = isPriority || isRushMode || order.priority === 'rush' || isDelayed;

  const readyCount  = itemReadyArr.filter(Boolean).length;
  const totalItems  = order.items.length;
  const progressPct = totalItems > 0 ? Math.round((readyCount / totalItems) * 100) : 0;
  const allReady    = readyCount === totalItems && totalItems > 0;

  const delivType = order.deliveryType || order.orderType;

  // Timer color
  const timerColor =
    isDelayed ? 'text-red-500' :
    elapsedMin >= threshold * 0.7 ? 'text-orange-500' :
    elapsedMin >= threshold * 0.4 ? 'text-yellow-600' :
    'text-green-600';

  // Border color
  const borderClass =
    isDelayed || (isRushMode && order.status !== 'completed') ? 'border-red-500 shadow-red-500/20 shadow-md' :
    isPriority ? 'border-orange-400 shadow-orange-400/20 shadow-md' :
    order.status === 'ready' ? 'border-green-500 shadow-green-500/20 shadow-md' :
    order.status === 'in_progress' ? 'border-yellow-400' :
    order.status === 'completed' ? 'border-muted opacity-70' :
    'border-border';

  return (
    <Card className={cn('flex flex-col transition-all duration-200', borderClass)} data-testid={`card-kds-${order.id}`}>
      {/* ── Card Header ──────────────────────────────────────────────────────── */}
      <div className={cn('px-3 pt-3 pb-2 rounded-t-xl', isUrgent && order.status !== 'completed' && 'bg-red-500/5')}>
        <div className="flex items-start justify-between gap-1">
          {/* Order number + type */}
          <div className="flex items-center gap-1.5">
            <span className={cn('text-2xl font-black font-mono leading-none', isDelayed ? 'text-red-500' : 'text-primary')} data-testid="text-order-number">
              #{order.orderNumber}
            </span>
            {getOrderTypeIcon(order)}
            {(isPriority || order.priority === 'rush') && (
              <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0 animate-pulse">RUSH</Badge>
            )}
            {order.priority === 'vip' && (
              <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0">
                <Star className="w-2.5 h-2.5 ml-0.5" />VIP
              </Badge>
            )}
          </div>

          {/* Timer */}
          <div className={cn('text-right', timerColor)}>
            <div className="text-lg font-black font-mono leading-none" data-testid="text-elapsed-timer">{formatElapsed(elapsedSec)}</div>
            <div className="text-[9px] font-bold opacity-70">{tc('منذ الطلب', 'elapsed')}</div>
          </div>
        </div>

        {/* Table / car info */}
        {order.tableNumber && (
          <div className="mt-1 text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Store className="w-3 h-3" />{tc('طاولة', 'Table')} {order.tableNumber}
          </div>
        )}
        {(order.carType || order.carInfo?.carType) && (
          <div className="mt-1 text-[10px] font-bold text-purple-600 flex items-center gap-1">
            <Car className="w-3 h-3" />
            {order.carColor || order.carInfo?.carColor} {order.carType || order.carInfo?.carType}
            {(order.carPlate || order.plateNumber || order.carInfo?.plateNumber) && ` · ${order.carPlate || order.plateNumber || order.carInfo?.plateNumber}`}
          </div>
        )}
        {order.customerName && (
          <div className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" />{order.customerName}
          </div>
        )}

        {/* Progress bar for item ready states */}
        {order.status === 'in_progress' && totalItems > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
              <span>{tc('جاهز', 'Ready')}: {readyCount}/{totalItems}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', allReady ? 'bg-green-500' : 'bg-yellow-500')}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Prep time countdown (if in_progress with estimatedPrepTimeInMinutes) */}
        {order.status === 'in_progress' && order.estimatedPrepTimeInMinutes && (
          <div className={cn('mt-1 text-[10px] font-bold flex items-center gap-1', elapsedMin >= order.estimatedPrepTimeInMinutes ? 'text-red-500' : 'text-blue-600')}>
            <Timer className="w-3 h-3" />
            {elapsedMin >= order.estimatedPrepTimeInMinutes
              ? tc('تأخر!', 'Overdue!')
              : tc(`متبقي ${order.estimatedPrepTimeInMinutes - elapsedMin} د`, `${order.estimatedPrepTimeInMinutes - elapsedMin}m left`)}
          </div>
        )}

        {/* Delay fire hold indicator */}
        {order.preparationHoldUntil && new Date(order.preparationHoldUntil).getTime() > Date.now() && (
          <div className="mt-1 text-[10px] font-bold text-blue-600 flex items-center gap-1">
            <PauseCircle className="w-3 h-3" />
            {tc('مؤجل حتى', 'Held until')} {new Date(order.preparationHoldUntil).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {(order.notes || order.customerNotes) && (
          <div className="mt-1 text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded px-1.5 py-0.5 border border-amber-200/50">
            💬 {order.notes || order.customerNotes}
          </div>
        )}
      </div>

      {/* ── Items list ────────────────────────────────────────────────────────── */}
      <CardContent className="px-3 py-2 flex-1">
        <div className="space-y-1.5">
          {order.items.map((item, idx) => {
            const isItemDone = itemReadyArr[idx] === true;
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors cursor-pointer',
                  isItemDone ? 'bg-green-50 dark:bg-green-950/20 opacity-60' : 'bg-muted/40 hover:bg-muted/60',
                  order.status === 'in_progress' && 'cursor-pointer'
                )}
                onClick={() => order.status === 'in_progress' && onToggleItem(idx)}
                data-testid={`item-kds-${order.id}-${idx}`}
              >
                {/* Item ready checkbox */}
                {order.status === 'in_progress' && (
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                    isItemDone ? 'bg-green-500 border-green-500' : 'border-muted-foreground'
                  )}>
                    {isItemDone && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}
                {/* Quantity bubble */}
                {order.status !== 'in_progress' && (
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shrink-0">
                    {item.quantity}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('font-bold text-xs leading-tight', isItemDone && 'line-through')}>
                    {order.status === 'in_progress' && <span className="text-primary font-black ml-1">{item.quantity}×</span>}
                    {item.coffeeItem?.nameAr || item.coffeeItemId}
                  </p>
                  {item.size && item.size !== 'regular' && (
                    <p className="text-[10px] text-muted-foreground">{item.size}</p>
                  )}
                  {item.extras && item.extras.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">+ {item.extras.join(', ')}</p>
                  )}
                  {item.sugarLevel && (
                    <p className="text-[10px] text-primary/80">{tc('سكر:', 'Sugar:')} {item.sugarLevel}</p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-amber-600 font-bold">💬 {item.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand toggle for more info */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t space-y-1 text-[10px] text-muted-foreground">
            <p><span className="font-bold">{tc('وقت الطلب:', 'Ordered:')}</span> {new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            {order.scheduledPickupTime && <p><span className="font-bold">{tc('موعد الاستلام:', 'Pickup:')}</span> {order.scheduledPickupTime}</p>}
            {order.channel && <p><span className="font-bold">{tc('القناة:', 'Channel:')}</span> {order.channel}</p>}
          </div>
        )}
      </CardContent>

      {/* ── Action Buttons ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 space-y-2">
        {/* Primary action */}
        {order.status === 'pending' || order.status === 'payment_confirmed' || order.status === 'confirmed' ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              className="h-9 text-xs font-bold"
              onClick={() => onStartPreparing(5)}
              disabled={isMutating}
              data-testid={`button-start-${order.id}`}
            >
              <PlayCircle className="w-3.5 h-3.5 ml-1" />
              {tc('ابدأ التحضير', 'Start')}
            </Button>
            <Button
              variant="outline"
              className="h-9 text-xs"
              onClick={onDelayFire}
              disabled={isMutating}
              data-testid={`button-delay-${order.id}`}
            >
              <Timer className="w-3.5 h-3.5 ml-1" />
              {tc('تأجيل', 'Delay')}
            </Button>
          </div>
        ) : order.status === 'in_progress' ? (
          <div className="space-y-1.5">
            <Button
              className={cn('w-full h-9 text-xs font-bold', allReady ? 'bg-green-500 hover:bg-green-600' : '')}
              onClick={onMarkReady}
              disabled={isMutating}
              data-testid={`button-ready-${order.id}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
              {allReady ? tc('✅ جاهز للاستلام', '✅ Ready!') : tc('تعيين كجاهز', 'Mark Ready')}
            </Button>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={() => onAddTime(5)} disabled={isMutating}>+5{tc('د', 'm')}</Button>
              <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={() => onAddTime(10)} disabled={isMutating}>+10{tc('د', 'm')}</Button>
              <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={onDelayFire} disabled={isMutating}>
                <Timer className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : order.status === 'ready' ? (
          <Button className="w-full h-9 text-xs font-bold bg-green-600 hover:bg-green-700" onClick={onMarkCompleted} disabled={isMutating} data-testid={`button-complete-${order.id}`}>
            <Check className="w-3.5 h-3.5 ml-1" />
            {tc('تسليم ✔', 'Complete ✔')}
          </Button>
        ) : order.status === 'completed' ? (
          <Button variant="outline" className="w-full h-8 text-[10px] text-muted-foreground" onClick={onRecall} data-testid={`button-recall-${order.id}`}>
            <RotateCcw className="w-3 h-3 ml-1" />
            {tc('استرداد', 'Recall')}
          </Button>
        ) : null}

        {/* Secondary controls row */}
        <div className="flex items-center justify-between gap-1">
          {/* Priority toggle */}
          <button
            onClick={onTogglePriority}
            className={cn(
              'flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 transition-colors',
              isPriority ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
            data-testid={`button-priority-${order.id}`}
          >
            <Flame className="w-3 h-3" />
            {isPriority ? tc('أولوية', 'RUSH') : tc('عادي', 'Normal')}
          </button>

          {/* Expand */}
          <button
            onClick={onToggleExpand}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-expand-${order.id}`}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Start prep time options */}
          {(order.status === 'pending' || order.status === 'payment_confirmed' || order.status === 'confirmed') && (
            <div className="flex gap-0.5">
              {[3, 7, 15].map(min => (
                <button
                  key={min}
                  onClick={() => onStartPreparing(min)}
                  className="text-[9px] bg-primary/10 text-primary hover:bg-primary/20 rounded px-1.5 py-0.5 font-bold transition-colors"
                  data-testid={`button-start-${min}m-${order.id}`}
                >
                  {min}{tc('د', 'm')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
