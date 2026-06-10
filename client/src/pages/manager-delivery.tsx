import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslate } from "@/lib/useTranslate";
import SarIcon from "@/components/sar-icon";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DeliveryManagement } from "@/components/delivery-management";
import {
  Truck, Package, Users, Clock, TrendingUp,
  MapPin, CheckCircle, XCircle, ArrowLeft,
  RefreshCw, Zap, Globe, BarChart3,
  Navigation, Phone, Star, Signal, SignalLow,
  SignalMedium, AlertCircle, Timer, Route,
  Coffee, UtensilsCrossed, TableProperties, Activity, Wifi
} from "lucide-react";
import { useLocation } from "wouter";
import { useRealtimeEvent } from "@/hooks/useRealtimeEngine";

const STATUS_LABELS: Record<string, { labelAr: string; labelEn: string; color: string }> = {
  pending:    { labelAr: 'بانتظار',        labelEn: 'Pending',      color: 'bg-yellow-500' },
  accepted:   { labelAr: 'مقبول',          labelEn: 'Accepted',     color: 'bg-blue-500' },
  assigned:   { labelAr: 'تم التعيين',     labelEn: 'Assigned',     color: 'bg-indigo-500' },
  picking_up: { labelAr: 'جاري الاستلام',  labelEn: 'Picking Up',   color: 'bg-purple-500' },
  on_the_way: { labelAr: 'في الطريق',      labelEn: 'On The Way',   color: 'bg-orange-500' },
  arrived:    { labelAr: 'وصل',            labelEn: 'Arrived',      color: 'bg-teal-500' },
  delivered:  { labelAr: 'تم التوصيل',     labelEn: 'Delivered',    color: 'bg-green-500' },
  cancelled:  { labelAr: 'ملغي',           labelEn: 'Cancelled',    color: 'bg-red-500' },
  returned:   { labelAr: 'مرتجع',          labelEn: 'Returned',     color: 'bg-gray-500' },
};

const PROVIDER_LABELS: Record<string, string> = {
  internal:        'Internal',
  noon_food:       'Noon Food',
  hunger_station:  'HungerStation',
  hungerstation:   'HungerStation',
  keeta:           'Keeta',
  jahez:           'Jahez',
  toyou:           'ToYou',
  mrsool:          'Mrsool',
  careem:          'Careem',
};

function formatCurrency(amount: number) {
  return `${amount.toFixed(2)} ر.س`;
}

const DRIVER_STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; dot: string; ring: string; text: string; animate: boolean }> = {
  online:   { labelAr: "متاح",      labelEn: "Available", dot: "bg-green-500",  ring: "ring-green-400",  text: "text-green-700",  animate: true },
  busy:     { labelAr: "مشغول",     labelEn: "Busy",      dot: "bg-orange-500", ring: "ring-orange-400", text: "text-orange-700", animate: true },
  offline:  { labelAr: "غير متصل", labelEn: "Offline",   dot: "bg-gray-400",   ring: "ring-gray-300",   text: "text-gray-500",   animate: false },
  inactive: { labelAr: "غير نشط",  labelEn: "Inactive",  dot: "bg-gray-300",   ring: "ring-gray-200",   text: "text-gray-400",   animate: false },
};

function LiveDriverTracking() {
  const tc = useTranslate();

  const { data: driversRaw = [], isLoading: loadingDrivers, refetch } = useQuery({
    queryKey: ["/api/delivery/drivers"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/drivers");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.drivers || [];
    },
    refetchInterval: 20000,
  });

  const { data: ordersRaw = [] } = useQuery({
    queryKey: ["/api/delivery/orders"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/orders");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.orders || [];
    },
    refetchInterval: 20000,
  });

  const drivers: any[] = driversRaw;
  const orders: any[] = ordersRaw;

  const activeOrders = orders.filter((o: any) =>
    ["assigned", "picking_up", "on_the_way", "arrived"].includes(o.status)
  );

  const getDriverOrder = (driverId: string) =>
    activeOrders.find((o: any) => o.driverId === driverId);

  const online  = drivers.filter((d: any) => d.status === "online");
  const busy    = drivers.filter((d: any) => d.status === "busy");
  const offline = drivers.filter((d: any) => !["online","busy"].includes(d.status));

  if (loadingDrivers) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">{tc("جاري تحميل بيانات السائقين...", "Loading driver data...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#2D9B6E] animate-pulse" />
            {tc("تتبع السائقين - مباشر", "Live Driver Tracking")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tc("يتحدث كل 20 ثانية","Updates every 20s")} • {new Date().toLocaleTimeString(tc("ar-SA","en-US"), { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 ml-1" />
          {tc("تحديث","Refresh")}
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-green-700">{online.length}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-semibold text-green-700">{tc("متاح","Available")}</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-orange-700">{busy.length}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <p className="text-xs font-semibold text-orange-700">{tc("مشغول","Busy")}</p>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-gray-600">{offline.length}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <p className="text-xs font-semibold text-gray-500">{tc("غير متصل","Offline")}</p>
          </div>
        </div>
      </div>

      {/* Active Orders with Drivers */}
      {activeOrders.length > 0 && (
        <Card className="border-[#2D9B6E]/30 bg-[#2D9B6E]/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-[#2D9B6E]">
              <Route className="w-4 h-4" />
              {tc("توصيلات جارية", "Active Deliveries")} ({activeOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeOrders.map((order: any) => {
              const statusInfo = STATUS_LABELS[order.status] || { labelAr: order.status, labelEn: order.status, color: "bg-gray-500" };
              return (
                <div key={order.id} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusInfo.color} animate-pulse`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{order.customerName || tc("عميل","Customer")}</p>
                      <Badge className={`${statusInfo.color} text-white text-xs shrink-0`}>{tc(statusInfo.labelAr, statusInfo.labelEn)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {order.customerAddress || tc("العنوان غير محدد","Address not set")}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    {order.driverName && (
                      <div className="flex items-center gap-1 text-xs font-medium text-[#2D9B6E]">
                        <Truck className="w-3 h-3" />
                        {order.driverName}
                      </div>
                    )}
                    {order.estimatedDeliveryTime && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Timer className="w-3 h-3" />
                        {new Date(order.estimatedDeliveryTime).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Driver Cards Grid */}
      {drivers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Truck className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">{tc("لا يوجد سائقون مسجلون","No registered drivers")}</p>
            <p className="text-sm text-muted-foreground">{tc("أضف سائقين من تبويب الإعدادات","Add drivers from the Settings tab")}</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            {tc("قائمة السائقين","Driver List")} ({drivers.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {drivers.map((driver: any) => {
              const cfg = DRIVER_STATUS_CONFIG[driver.status] || DRIVER_STATUS_CONFIG.offline;
              const assignedOrder = getDriverOrder(driver.id);
              return (
                <Card key={driver.id} className={`border ${driver.status === "online" ? "border-green-200 bg-green-50/40" : driver.status === "busy" ? "border-orange-200 bg-orange-50/40" : "border-gray-200"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        {/* Avatar */}
                        <div className={`relative w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm ring-2 ${cfg.ring}`}>
                          {(driver.nameAr || driver.name || "?")[0]}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${cfg.dot} ${cfg.animate ? "animate-pulse" : ""}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{driver.nameAr || driver.name}</p>
                          {driver.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {driver.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`text-xs ${cfg.animate ? "animate-pulse" : ""} ${
                        driver.status === "online" ? "bg-green-100 text-green-800 border border-green-300" :
                        driver.status === "busy" ? "bg-orange-100 text-orange-800 border border-orange-300" :
                        "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}>
                        {tc(cfg.labelAr, cfg.labelEn)}
                      </Badge>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background rounded-lg p-2 border border-border/50">
                        <p className="text-muted-foreground">{tc("التوصيلات","Deliveries")}</p>
                        <p className="font-bold text-sm">{driver.totalDeliveries || 0}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 border border-border/50">
                        <p className="text-muted-foreground">{tc("التقييم","Rating")}</p>
                        <p className="font-bold text-sm flex items-center gap-1">
                          {driver.rating ? driver.rating.toFixed(1) : "—"}
                          {driver.rating && <Star className="w-3 h-3 text-yellow-500" />}
                        </p>
                      </div>
                    </div>

                    {/* Current assignment */}
                    {assignedOrder && (
                      <div className="mt-3 p-2 bg-[#2D9B6E]/10 rounded-lg border border-[#2D9B6E]/20">
                        <p className="text-xs font-semibold text-[#2D9B6E] flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {tc("الطلب الحالي","Current Order")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {assignedOrder.customerName} — {assignedOrder.customerAddress}
                        </p>
                      </div>
                    )}

                    {/* Last seen */}
                    {driver.lastActive && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        آخر ظهور: {new Date(driver.lastActive).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingModeSelector() {
  const tc = useTranslate();
  const [mode, setMode] = useState<"external" | "cafe">("cafe");
  return (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1 w-fit">
        <button
          onClick={() => setMode("cafe")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            mode === "cafe"
              ? "bg-green-600 text-white shadow-sm shadow-green-200"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Coffee className="w-4 h-4" />
          {tc("التوصيل الداخلي", "In-Cafe Delivery")}
        </button>
        <button
          onClick={() => setMode("external")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            mode === "external"
              ? "bg-[#2D9B6E] text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Truck className="w-4 h-4" />
          {tc("سائقو التوصيل الخارجي", "External Drivers")}
        </button>
      </div>
      {mode === "cafe" ? <CafeInternalTracking /> : <LiveDriverTracking />}
    </div>
  );
}

const DINE_IN_STATUS_STEPS = [
  { key: 'pending',    labelAr: 'وارد',      labelEn: 'Received',    color: 'bg-yellow-400', icon: Clock },
  { key: 'preparing',  labelAr: 'يُحضَّر',   labelEn: 'Preparing',   color: 'bg-blue-500',   icon: Coffee },
  { key: 'ready',      labelAr: 'جاهز',      labelEn: 'Ready',       color: 'bg-purple-500', icon: CheckCircle },
  { key: 'serving',    labelAr: 'يُقدَّم',   labelEn: 'Serving',     color: 'bg-orange-500', icon: UtensilsCrossed },
  { key: 'delivered',  labelAr: 'سُلِّم',    labelEn: 'Delivered',   color: 'bg-green-500',  icon: CheckCircle },
];

function CafeInternalTracking() {
  const tc = useTranslate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const { data: rawOrders = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/orders", "dine_in_active"],
    queryFn: async () => {
      const res = await fetch("/api/orders?limit=50&status=pending,preparing,ready,serving&orderType=dine_in", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.orders || [];
    },
    refetchInterval: 15000,
  });

  const orders: any[] = rawOrders.filter((o: any) =>
    ['pending', 'preparing', 'ready', 'serving'].includes(o.status) &&
    (o.orderType === 'dine_in' || o.orderType === 'dine-in' || o.tableNumber)
  );

  const elapsedMin = (createdAt: string) => {
    const diff = now.getTime() - new Date(createdAt).getTime();
    return Math.floor(diff / 60000);
  };

  const getStepIdx = (status: string) => DINE_IN_STATUS_STEPS.findIndex(s => s.key === status);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">{tc("جاري تحميل الطلبات الداخلية...","Loading in-cafe orders...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
            <Coffee className="w-5 h-5 text-green-600 animate-pulse" />
            {tc("التوصيل الداخلي للكافيه - مباشر", "In-Cafe Live Delivery")}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-green-500" />
            {tc("يتحدث كل 15 ثانية","Updates every 15s")} • {now.toLocaleTimeString(tc("ar-SA","en-US"), { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="border-green-300 text-green-700 hover:bg-green-50">
          <RefreshCw className="w-4 h-4 ml-1" />
          تحديث
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-yellow-700">
            {orders.filter(o => o.status === 'pending' || o.status === 'preparing').length}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <p className="text-xs font-semibold text-yellow-700">{tc("قيد التحضير","Preparing")}</p>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-purple-700">
            {orders.filter(o => o.status === 'ready').length}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <p className="text-xs font-semibold text-purple-700">{tc("جاهز للتقديم","Ready")}</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-orange-700">
            {orders.filter(o => o.status === 'serving').length}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <p className="text-xs font-semibold text-orange-700">{tc("يُقدَّم الآن","Serving Now")}</p>
          </div>
        </div>
      </div>

      {/* Orders by table */}
      {orders.length === 0 ? (
        <Card className="border-dashed border-gray-300">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
              <Coffee className="w-8 h-8 text-green-400" />
            </div>
            <p className="font-semibold text-gray-600">{tc("لا توجد طلبات داخلية نشطة حالياً","No active in-cafe orders")}</p>
            <p className="text-sm text-gray-400">{tc("ستظهر طلبات الطاولات هنا بمجرد ورودها","Table orders will appear here as they come in")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order: any) => {
            const elapsed = elapsedMin(order.createdAt);
            const stepIdx = getStepIdx(order.status);
            const isUrgent = elapsed > 15;
            const step = DINE_IN_STATUS_STEPS[Math.max(0, stepIdx)];
            const StepIcon = step?.icon || Clock;
            return (
              <Card key={order.id} className={`border-2 transition-all ${
                order.status === 'ready' ? 'border-purple-400 bg-purple-50/30 shadow-purple-100 shadow-md' :
                order.status === 'serving' ? 'border-orange-400 bg-orange-50/30 shadow-orange-100 shadow-md' :
                isUrgent ? 'border-red-300 bg-red-50/20' :
                'border-gray-200 bg-white'
              }`}>
                <CardContent className="p-4">
                  {/* Table + Order number header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white ${step?.color || 'bg-gray-400'}`}>
                        {order.tableNumber ? `T${order.tableNumber}` : order.orderNumber?.slice(-2) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">
                          {order.tableNumber ? `${tc("طاولة","Table")} ${order.tableNumber}` : (order.customerName || tc('طلب داخلي','In-Cafe Order'))}
                        </p>
                        <p className="text-xs text-gray-500">#{order.orderNumber || order.id?.slice(-6)}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <Badge className={`${step?.color} text-white text-xs flex items-center gap-1 ${order.status === 'ready' || order.status === 'serving' ? 'animate-pulse' : ''}`}>
                        <StepIcon className="w-3 h-3" />
                        {step ? tc(step.labelAr, step.labelEn) : ''}
                      </Badge>
                      <p className={`text-xs mt-1 text-left ${isUrgent ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {elapsed} {tc("دقيقة","min")} {isUrgent ? '⚠️' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-1 mb-3">
                    {DINE_IN_STATUS_STEPS.slice(0, 4).map((s, idx) => (
                      <div key={s.key} className="flex-1 flex items-center gap-1">
                        <div className={`h-1.5 flex-1 rounded-full transition-all ${idx <= stepIdx ? s.color : 'bg-gray-200'}`} />
                        {idx < 3 && <div className={`w-1 h-1 rounded-full ${idx < stepIdx ? 'bg-gray-400' : 'bg-gray-200'}`} />}
                      </div>
                    ))}
                  </div>

                  {/* Items summary */}
                  <div className="space-y-1">
                    {(order.items || []).slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <span className="w-4 h-4 rounded bg-green-100 text-green-700 text-center leading-4 font-bold text-[10px]">{item.quantity}</span>
                          <span className="truncate max-w-[120px]">{item.coffeeItem?.nameAr || item.nameAr || 'صنف'}</span>
                        </span>
                      </div>
                    ))}
                    {(order.items || []).length > 3 && (
                      <p className="text-xs text-gray-400">+{(order.items || []).length - 3} أصناف أخرى</p>
                    )}
                  </div>

                  {/* Waiter */}
                  {order.employeeName && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg p-1.5">
                      <Users className="w-3 h-3" />
                      <span className="font-medium">{order.employeeName}</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{tc("إجمالي الطلب","Order Total")}</span>
                    <span className="font-bold text-sm text-gray-900">{(order.totalAmount || 0).toFixed(2)} <SarIcon size={11} /></span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DispatchCenter() {
  const tc = useTranslate();
  const { toast } = useToast();

  const { data: unassignedRaw, isLoading: loadingUnassigned, refetch: refetchUnassigned } = useQuery({
    queryKey: ["/api/delivery/orders/unassigned"],
    refetchInterval: 8000,
  });

  const { data: driversRaw, isLoading: loadingDrivers, refetch: refetchDrivers } = useQuery({
    queryKey: ["/api/delivery/drivers"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/drivers", { credentials: "include" });
      if (!res.ok) return { drivers: [] };
      return res.json();
    },
    refetchInterval: 8000,
  });

  const unassignedOrders: any[] = (unassignedRaw as any)?.orders || [];
  const allDrivers: any[] = Array.isArray(driversRaw) ? driversRaw : (driversRaw as any)?.drivers || [];
  const availableDrivers = allDrivers.filter((d) => d.status === "available" || d.status === "online");

  const assignMutation = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) =>
      apiRequest("PATCH", `/api/delivery/orders/${orderId}/assign`, { driverId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/drivers"] });
      toast({ title: tc("تم تعيين السائق", "Driver assigned"), className: "bg-green-600 text-white" });
    },
    onError: (e: any) => toast({ title: e?.message || tc("فشل التعيين", "Assignment failed"), variant: "destructive" }),
  });

  const autoAssignMutation = useMutation({
    mutationFn: (orderId: string) => apiRequest("POST", `/api/delivery/orders/${orderId}/auto-assign`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/drivers"] });
      toast({ title: tc("تم التعيين التلقائي", "Auto-assigned successfully"), className: "bg-green-600 text-white" });
    },
    onError: (e: any) => toast({ title: e?.message || tc("لا يوجد سائق متاح", "No available driver"), variant: "destructive" }),
  });

  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500 animate-pulse" />
            {tc("مركز الإرسال", "Dispatch Center")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tc("وزّع الطلبات على السائقين المتاحين", "Assign pending orders to available drivers")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchUnassigned(); refetchDrivers(); }}>
          <RefreshCw className="w-4 h-4 ml-1" />
          {tc("تحديث", "Refresh")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
            <Package className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-orange-700">{unassignedOrders.length}</p>
            <p className="text-xs text-orange-600">{tc("طلبات بانتظار سائق", "Awaiting Driver")}</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-green-700">{availableDrivers.length}</p>
            <p className="text-xs text-green-600">{tc("سائقون متاحون", "Available Drivers")}</p>
          </div>
        </div>
      </div>

      {/* Available Drivers Quick View */}
      {availableDrivers.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
            {tc("السائقون المتاحون", "Available Drivers")}
          </p>
          <div className="flex gap-2 flex-wrap">
            {availableDrivers.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-800">{d.fullName || d.nameAr || d.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Orders */}
      {loadingUnassigned ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : unassignedOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 opacity-50" />
            <p className="font-semibold text-muted-foreground">{tc("لا توجد طلبات بانتظار التعيين", "No orders awaiting assignment")}</p>
            <p className="text-sm text-muted-foreground">{tc("جميع الطلبات تم تعيينها", "All orders have been assigned")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {tc("الطلبات غير المعيّنة", "Unassigned Orders")} ({unassignedOrders.length})
          </p>
          {unassignedOrders.map((order: any) => {
            const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
            const isUrgent = elapsed > 10;
            return (
              <Card key={order.id} className={`overflow-hidden border-2 ${isUrgent ? "border-red-300 bg-red-50/20" : "border-orange-200"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold">{order.customerName || tc("عميل", "Customer")}</p>
                        {isUrgent && (
                          <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs animate-pulse">
                            ⚠️ {elapsed} {tc("دقيقة انتظار", "min wait")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {order.customerAddress || tc("عنوان غير محدد", "Address not set")}
                      </p>
                      {order.customerPhone && (
                        <a href={`tel:${order.customerPhone}`} className="text-xs text-primary flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {order.customerPhone}
                        </a>
                      )}
                    </div>
                    <div className="text-left flex-shrink-0 mr-3">
                      <p className="font-bold text-sm">{(order.totalAmount || 0).toFixed(0)} <SarIcon size={11} className="inline" /></p>
                      {!isUrgent && <p className="text-xs text-muted-foreground">{elapsed} {tc("د", "min")}</p>}
                    </div>
                  </div>

                  {/* Items */}
                  {order.items && order.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {order.items.slice(0, 4).map((item: any, idx: number) => (
                        <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {item.name} ×{item.quantity}
                        </span>
                      ))}
                      {order.items.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{order.items.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Assign actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableDrivers.length > 0 ? (
                      <>
                        <Select
                          value={selectedDrivers[order.id] || ""}
                          onValueChange={(v) => setSelectedDrivers((prev) => ({ ...prev, [order.id]: v }))}
                        >
                          <SelectTrigger className="h-9 flex-1 min-w-32 text-sm">
                            <SelectValue placeholder={tc("اختر سائقاً", "Select driver")} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDrivers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.fullName || d.nameAr || d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => {
                            const driverId = selectedDrivers[order.id];
                            if (driverId) assignMutation.mutate({ orderId: order.id, driverId });
                          }}
                          disabled={!selectedDrivers[order.id] || assignMutation.isPending}
                          className="bg-primary hover:bg-primary/90 h-9"
                        >
                          <Truck className="w-3.5 h-3.5 ml-1" />
                          {tc("تعيين", "Assign")}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => autoAssignMutation.mutate(order.id)}
                      disabled={autoAssignMutation.isPending}
                      className="h-9 border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <Zap className="w-3.5 h-3.5 ml-1" />
                      {tc("تعيين تلقائي", "Auto Assign")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function useOrderWaitTime(createdAt: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [createdAt]);
  return elapsed;
}

function WaitTimer({ createdAt, warnAfterSec = 300 }: { createdAt: string; warnAfterSec?: number }) {
  const elapsed = useOrderWaitTime(createdAt);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isUrgent = elapsed >= warnAfterSec;
  return (
    <span className={`font-mono text-xs font-bold ${isUrgent ? "text-red-600 animate-pulse" : "text-orange-600"}`}>
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

export default function ManagerDelivery() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState("today");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [newOrderAlert, setNewOrderAlert] = useState<any | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time WebSocket: new delivery order arrived
  useRealtimeEvent("new_delivery_order", useCallback((data: any) => {
    const order = data?.order || data;
    if (!order) return;
    setNewOrderAlert(order);
    queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
    toast({
      title: `🚨 ${tc("طلب توصيل جديد!", "New Delivery Order!")}`,
      description: `${order.customerName || tc("عميل","Customer")} — ${PROVIDER_LABELS[order.externalProvider] || tc("داخلي","Internal")}`,
      className: "bg-orange-600 text-white border-orange-700",
    });
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setNewOrderAlert(null), 30000);
  }, [tc, toast]));

  // Real-time: delivery order status updated
  useRealtimeEvent("delivery_order_updated", useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
  }, []));

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/delivery/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/delivery/stats?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: ordersData = [] } = useQuery({
    queryKey: ["/api/delivery/orders"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/orders");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.orders || [];
    },
    refetchInterval: 15000,
  });

  const autoAssignMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/delivery/orders/${orderId}/auto-assign`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
      toast({ title: tc("تم تعيين سائق بنجاح ✅", "Driver assigned successfully ✅"), className: "bg-green-600 text-white" });
    },
    onError: (err: any) => {
      toast({ title: err.message || tc("لا يوجد سائق متاح", "No available driver"), variant: "destructive" });
    },
  });

  const deliveryStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, reason }: { orderId: string; status: string; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/delivery/orders/${orderId}/status`, { status, cancellationReason: reason });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
      const labels: Record<string, string> = {
        accepted:    tc("✅ تم قبول الطلب", "✅ Order accepted"),
        assigned:    tc("✅ تم تعيين السائق", "✅ Driver assigned"),
        picking_up:  tc("🏃 السائق في المطعم", "🏃 Driver at restaurant"),
        on_the_way:  tc("🚗 الطلب في الطريق", "🚗 Order on the way"),
        arrived:     tc("📍 وصل للعميل", "📍 Arrived at customer"),
        delivered:   tc("✅ تم التسليم", "✅ Delivered"),
        cancelled:   tc("❌ تم الإلغاء", "❌ Cancelled"),
      };
      toast({ title: labels[vars.status] || tc("تم تحديث الحالة", "Status updated"), className: vars.status === "cancelled" ? undefined : "bg-green-600 text-white" });
    },
    onError: (err: any) => {
      toast({ title: err.message || tc("فشل تحديث الحالة", "Status update failed"), variant: "destructive" });
    },
  });

  const orderStatusMutation = deliveryStatusMutation;

  const stats = statsData?.stats;
  const activeOrders = ordersData.filter((o: any) =>
    ['pending', 'accepted', 'assigned', 'picking_up', 'on_the_way', 'arrived', 'in_progress', 'out_for_delivery'].includes(o.status)
  );
  const pendingOrders = ordersData.filter((o: any) => o.status === 'pending');

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white text-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/manager/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="w-7 h-7 text-[#2D9B6E]" />
              {tc("إدارة التوصيل", "Delivery Management")}
            </h1>
            <p className="text-sm text-muted-foreground">{tc("لوحة تحكم شاملة لإدارة الطلبات والسائقين وتطبيقات التوصيل", "Comprehensive dashboard for orders, drivers, and delivery apps")}</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{tc("اليوم", "Today")}</SelectItem>
            <SelectItem value="week">{tc("الأسبوع", "Week")}</SelectItem>
            <SelectItem value="month">{tc("الشهر", "Month")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto gap-0.5">
          <TabsTrigger value="dashboard" className="flex-1 min-w-fit">{tc("الرئيسية", "Dashboard")}</TabsTrigger>
          <TabsTrigger value="dispatch" className="flex-1 min-w-fit">
            <Zap className="w-3.5 h-3.5 ml-1 text-orange-500" />
            {tc("إرسال", "Dispatch")}
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 min-w-fit">{tc("الطلبات", "Orders")}</TabsTrigger>
          <TabsTrigger value="tracking" className="flex-1 min-w-fit">{tc("تتبع مباشر", "Live Track")}</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 min-w-fit">{tc("الإعدادات", "Settings")}</TabsTrigger>
          <TabsTrigger value="integrations" className="flex-1 min-w-fit">{tc("الربط", "Integrations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">

          {/* New delivery order alert banner */}
          {newOrderAlert && (
            <div className="flex items-center gap-3 bg-orange-600 text-white rounded-xl p-4 shadow-lg animate-pulse">
              <span className="text-2xl">🚨</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{tc("طلب توصيل جديد!", "New Delivery Order!")}</p>
                <p className="text-xs opacity-90">{newOrderAlert.customerName} — {PROVIDER_LABELS[newOrderAlert.externalProvider] || tc("داخلي","Internal")} • <WaitTimer createdAt={newOrderAlert.createdAt} warnAfterSec={60} /></p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs h-8"
                  onClick={() => { setActiveTab("orders"); setNewOrderAlert(null); }}>
                  {tc("عرض الطلب","View Order")}
                </Button>
                <button onClick={() => setNewOrderAlert(null)} className="opacity-70 hover:opacity-100">✕</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 mx-auto mb-2 text-[#2D9B6E]" />
                <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                <p className="text-xs text-muted-foreground">{tc("إجمالي الطلبات", "Total Orders")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Truck className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold">{stats?.activeOrders || 0}</p>
                <p className="text-xs text-muted-foreground">{tc("طلبات نشطة", "Active Orders")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{stats?.completedOrders || 0}</p>
                <p className="text-xs text-muted-foreground">{tc("تم التوصيل", "Delivered")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{stats?.avgDeliveryTime || 0} {tc("د", "min")}</p>
                <p className="text-xs text-muted-foreground">{tc("متوسط وقت التوصيل", "Avg Delivery Time")}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> {tc("الإيرادات", "Revenue")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{tc("إجمالي المبيعات", "Total Sales")}</span>
                  <span className="font-bold">{formatCurrency(stats?.totalRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{tc("رسوم التوصيل", "Delivery Fees")}</span>
                  <span className="font-bold">{formatCurrency(stats?.totalDeliveryFees || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{tc("طلبات ملغية", "Cancelled Orders")}</span>
                  <span className="font-bold text-red-500">{stats?.cancelledOrders || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" /> {tc("السائقين", "Drivers")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{tc("إجمالي", "Total")}</span>
                  <span className="font-bold">{stats?.driverStats?.total || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">{tc("متاح", "Available")}</Badge>
                  </span>
                  <span className="font-bold text-green-600">{stats?.driverStats?.online || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 text-xs">{tc("مشغول", "Busy")}</Badge>
                  </span>
                  <span className="font-bold text-orange-600">{stats?.driverStats?.busy || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    <Badge variant="outline" className="bg-gray-500/10 text-gray-500 text-xs">{tc("غير متصل", "Offline")}</Badge>
                  </span>
                  <span className="font-bold text-gray-500">{stats?.driverStats?.offline || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {stats?.providerBreakdown && Object.keys(stats.providerBreakdown).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4" /> {tc("حسب مصدر الطلب", "By Order Source")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(stats.providerBreakdown).map(([provider, data]: [string, any]) => (
                    <div key={provider} className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm font-bold">{PROVIDER_LABELS[provider] || provider}</p>
                      <p className="text-lg font-bold text-[#2D9B6E]">{data.orders}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(data.revenue)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pendingOrders.length > 0 && (
            <Card className="border-orange-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                  <Zap className="w-4 h-4 animate-pulse" /> {tc("طلبات تحتاج تعيين", "Orders Needing Assignment")} ({pendingOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingOrders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                    <div>
                      <p className="font-bold text-sm flex items-center gap-2">
                        {order.customerName || tc('عميل', 'Customer')}
                        {order.createdAt && <WaitTimer createdAt={order.createdAt} warnAfterSec={300} />}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {order.customerAddress || tc('عنوان غير محدد', 'Address not specified')}
                      </p>
                      {order.externalProvider && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {PROVIDER_LABELS[order.externalProvider] || order.externalProvider}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatCurrency(order.totalAmount || 0)}</span>
                      <Button
                        size="sm"
                        onClick={() => autoAssignMutation.mutate(order.id)}
                        disabled={autoAssignMutation.isPending}
                        className="bg-[#2D9B6E] hover:bg-[#258a5e]"
                      >
                        <Zap className="w-3 h-3 ml-1" />
                        {tc("تعيين تلقائي", "Auto Assign")}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dispatch" className="space-y-4">
          <DispatchCenter />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <Package className="w-5 h-5" />
              {tc("الطلبات النشطة", "Active Orders")} ({activeOrders.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
              }}
            >
              <RefreshCw className="w-4 h-4 ml-1" />
              {tc("تحديث", "Refresh")}
            </Button>
          </div>

          {activeOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{tc("لا توجد طلبات نشطة حالياً", "No active orders at the moment")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order: any) => {
                const statusInfo = STATUS_LABELS[order.status] || { labelAr: order.status, labelEn: order.status, color: 'bg-gray-500' };
                return (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold">{order.customerName || tc('عميل', 'Customer')}</p>
                            <Badge className={`${statusInfo.color} text-white text-xs`}>
                              {tc(statusInfo.labelAr, statusInfo.labelEn)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {order.customerAddress || tc('عنوان غير محدد', 'Address not specified')}
                          </p>
                          {order.externalProvider && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {PROVIDER_LABELS[order.externalProvider] || order.externalProvider}
                            </Badge>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{formatCurrency(order.totalAmount || 0)}</p>
                          {order.deliveryFee > 0 && (
                            <p className="text-xs text-muted-foreground">{tc("توصيل:", "Delivery:")} {formatCurrency(order.deliveryFee)}</p>
                          )}
                        </div>
                      </div>

                      {order.driverName && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                          <Users className="w-4 h-4 text-[#2D9B6E]" />
                          <span className="font-medium">{order.driverName}</span>
                          {order.driverPhone && <span className="text-muted-foreground">({order.driverPhone})</span>}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'accepted' })}
                              disabled={deliveryStatusMutation.isPending}
                              className="bg-[#2D9B6E] hover:bg-[#258a5e] text-white"
                            >
                              <CheckCircle className="w-3 h-3 ml-1" />
                              {tc("قبول الطلب", "Accept Order")}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => autoAssignMutation.mutate(order.id)}
                              disabled={autoAssignMutation.isPending}
                              variant="outline"
                              className="border-blue-500 text-blue-600 hover:bg-blue-50"
                            >
                              <Zap className="w-3 h-3 ml-1" />
                              {tc("تعيين تلقائي", "Auto Assign")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'cancelled', reason: tc("ملغي من المطعم", "Cancelled by restaurant") })}
                              disabled={deliveryStatusMutation.isPending}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-3 h-3 ml-1" />
                              {tc("رفض", "Reject")}
                            </Button>
                          </>
                        )}
                        {order.status === 'accepted' && (
                          <Button
                            size="sm"
                            onClick={() => autoAssignMutation.mutate(order.id)}
                            disabled={autoAssignMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Zap className="w-3 h-3 ml-1" />
                            {tc("تعيين سائق", "Assign Driver")}
                          </Button>
                        )}
                        {order.status === 'assigned' && (
                          <Button
                            size="sm"
                            onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'picking_up' })}
                            disabled={deliveryStatusMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <Package className="w-3 h-3 ml-1" />
                            {tc("السائق في المطعم", "Driver at Branch")}
                          </Button>
                        )}
                        {order.status === 'picking_up' && (
                          <Button
                            size="sm"
                            onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'on_the_way' })}
                            disabled={deliveryStatusMutation.isPending}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            <Truck className="w-3 h-3 ml-1" />
                            {tc("في الطريق", "On The Way")}
                          </Button>
                        )}
                        {order.status === 'on_the_way' && (
                          <Button
                            size="sm"
                            onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'arrived' })}
                            disabled={deliveryStatusMutation.isPending}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                          >
                            <MapPin className="w-3 h-3 ml-1" />
                            {tc("وصل للعميل", "Arrived")}
                          </Button>
                        )}
                        {order.status === 'arrived' && (
                          <Button
                            size="sm"
                            onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'delivered' })}
                            disabled={deliveryStatusMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-3 h-3 ml-1" />
                            {tc("تم التسليم", "Delivered")}
                          </Button>
                        )}
                        {!['delivered','cancelled','returned'].includes(order.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deliveryStatusMutation.mutate({ orderId: order.id, status: 'cancelled', reason: tc("ملغي من المطعم","Cancelled by restaurant") })}
                            disabled={deliveryStatusMutation.isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                          >
                            <XCircle className="w-3 h-3 ml-1" />
                            {tc("إلغاء", "Cancel")}
                          </Button>
                        )}
                      </div>

                      {order.estimatedDeliveryTime && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {tc("التوصيل المتوقع:", "Est. delivery:")} {new Date(order.estimatedDeliveryTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <TrackingModeSelector />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {/* Zone Settings Quick Link */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{tc("إعدادات مناطق التوصيل", "Delivery Zone Settings")}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tc("أسعار التوصيل، أحياء الرياض، الكيلومتر", "Delivery prices, Riyadh districts, per-km pricing")}</p>
                  </div>
                </div>
                <a href="/manager/delivery-zones">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs h-8">
                    {tc("إدارة المناطق", "Manage Zones")}
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
          <DeliveryManagement />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#2D9B6E]" />
                {tc("رابط الـ Webhook", "Webhook URL")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {tc("استخدم الروابط أدناه لاستقبال الطلبات تلقائياً من تطبيقات التوصيل. أدخل الرابط المناسب في إعدادات كل تطبيق.", "Use the URLs below to receive orders automatically from delivery apps. Enter the relevant URL in each app's settings.")}
              </p>
              {['hungerstation', 'jahez', 'toyou', 'mrsool', 'noon_food', 'keeta', 'careem'].map(provider => (
                <div key={provider} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-bold min-w-24">{PROVIDER_LABELS[provider] || provider}</span>
                  <code className="text-xs bg-background p-2 rounded flex-1 overflow-x-auto border">
                    {`${window.location.origin}/api/webhooks/delivery/${provider}`}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/delivery/${provider}`);
                      toast({ title: tc("تم النسخ", "Copied!"), className: "bg-green-600 text-white" });
                    }}
                  >
                    {tc("نسخ", "Copy")}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{tc("ملاحظات الربط", "Integration Notes")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• {tc('يجب تفعيل الربط مع كل تطبيق من تبويب "الإعدادات" أولاً', 'Integration must be activated for each app from the "Settings" tab first')}</p>
              <p>• {tc('عند تفعيل "القبول التلقائي"، سيتم تعيين أقرب سائق متاح تلقائياً', 'When "Auto Accept" is enabled, the nearest available driver will be assigned automatically')}</p>
              <p>• {tc('الطلبات الواردة ستظهر في تبويب "الطلبات النشطة" فوراً', 'Incoming orders will appear in the "Active Orders" tab immediately')}</p>
              <p>• {tc('تأكد من إدخال مفتاح الـ API الصحيح لكل تطبيق', 'Make sure to enter the correct API key for each app')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
