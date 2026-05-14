import { useState, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DeliveryManagement } from "@/components/delivery-management";
import {
  Truck, Package, Users, Clock, TrendingUp,
  MapPin, CheckCircle, XCircle, ArrowLeft,
  RefreshCw, Zap, Globe, BarChart3,
  Navigation, Phone, Star, Signal, SignalLow,
  SignalMedium, AlertCircle, Timer, Route,
  Coffee, UtensilsCrossed, TableProperties, Activity, Wifi,
  UserCheck, Bike, Car, Filter, ChevronDown, ChevronUp, Send
} from "lucide-react";
import { useLocation } from "wouter";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار', color: 'bg-yellow-500' },
  accepted: { label: 'مقبول', color: 'bg-blue-500' },
  assigned: { label: 'تم التعيين', color: 'bg-indigo-500' },
  picking_up: { label: 'جاري الاستلام', color: 'bg-purple-500' },
  on_the_way: { label: 'في الطريق', color: 'bg-orange-500' },
  arrived: { label: 'وصل', color: 'bg-teal-500' },
  delivered: { label: 'تم التوصيل', color: 'bg-green-500' },
  cancelled: { label: 'ملغي', color: 'bg-red-500' },
  returned: { label: 'مرتجع', color: 'bg-gray-500' },
};

const PROVIDER_LABELS: Record<string, string> = {
  internal: 'توصيل داخلي',
  noon_food: 'نون فود',
  hunger_station: 'هنقرستيشن',
  hungerstation: 'هنقرستيشن',
  keeta: 'كيتا',
  jahez: 'جاهز',
  toyou: 'تو يو',
  mrsool: 'مرسول',
  careem: 'كريم',
};

function formatCurrency(amount: number) {
  return `${amount.toFixed(2)} ر.س`;
}

const DRIVER_STATUS_CONFIG: Record<string, { label: string; dot: string; ring: string; text: string; animate: boolean }> = {
  online:    { label: "متاح",     dot: "bg-green-500",  ring: "ring-green-400",  text: "text-green-700",  animate: true },
  available: { label: "متاح",     dot: "bg-green-500",  ring: "ring-green-400",  text: "text-green-700",  animate: true },
  busy:      { label: "مشغول",    dot: "bg-orange-500", ring: "ring-orange-400", text: "text-orange-700", animate: true },
  on_break:  { label: "استراحة", dot: "bg-yellow-400", ring: "ring-yellow-300", text: "text-yellow-700", animate: false },
  offline:   { label: "غير متصل",dot: "bg-gray-400",   ring: "ring-gray-300",   text: "text-gray-500",   animate: false },
  inactive:  { label: "غير نشط", dot: "bg-gray-300",   ring: "ring-gray-200",   text: "text-gray-400",   animate: false },
};

function LiveDriverTracking() {
  const tc = useTranslate();

  const { data: driversRaw = [], isLoading: loadingDrivers, refetch } = useQuery({
    queryKey: ["/api/delivery/drivers"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/drivers", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.drivers || [];
    },
    refetchInterval: 20000,
  });

  const { data: ordersRaw = [] } = useQuery({
    queryKey: ["/api/delivery/orders"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/orders", { credentials: "include" });
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
    activeOrders.find((o: any) => o.driverId === driverId || o.driverName);

  const isAvailable = (d: any) => d.status === "online" || d.status === "available";
  const online  = drivers.filter(isAvailable);
  const busy    = drivers.filter((d: any) => d.status === "busy");
  const offline = drivers.filter((d: any) => !isAvailable(d) && d.status !== "busy");

  if (loadingDrivers) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">جاري تحميل بيانات السائقين...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#2D9B6E] animate-pulse" />
            {tc("تتبع السائقين - مباشر", "Live Driver Tracking")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            يتحدث كل 20 ثانية • {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 ml-1" />
          تحديث
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-green-700">{online.length}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-semibold text-green-700">متاح</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-orange-700">{busy.length}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <p className="text-xs font-semibold text-orange-700">مشغول</p>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-gray-600">{offline.length}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <p className="text-xs font-semibold text-gray-500">غير متصل</p>
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
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-500" };
              return (
                <div key={order.id} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border/50">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusInfo.color} animate-pulse`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{order.customerName || tc("عميل","Customer")}</p>
                      <Badge className={`${statusInfo.color} text-white text-xs shrink-0`}>{statusInfo.label}</Badge>
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
                <Card key={driver.id} className={`border ${(driver.status === "online" || driver.status === "available") ? "border-green-200 bg-green-50/40" : driver.status === "busy" ? "border-orange-200 bg-orange-50/40" : driver.status === "on_break" ? "border-yellow-200 bg-yellow-50/40" : "border-gray-200"}`}>
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
                        (driver.status === "online" || driver.status === "available") ? "bg-green-100 text-green-800 border border-green-300" :
                        driver.status === "busy" ? "bg-orange-100 text-orange-800 border border-orange-300" :
                        driver.status === "on_break" ? "bg-yellow-100 text-yellow-800 border border-yellow-300" :
                        "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}>
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background rounded-lg p-2 border border-border/50">
                        <p className="text-muted-foreground">التوصيلات</p>
                        <p className="font-bold text-sm">{driver.totalDeliveries || 0}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 border border-border/50">
                        <p className="text-muted-foreground">التقييم</p>
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
  { key: 'pending',    label: 'وارد',        color: 'bg-yellow-400', icon: Clock },
  { key: 'preparing',  label: 'يُحضَّر',     color: 'bg-blue-500',   icon: Coffee },
  { key: 'ready',      label: 'جاهز',        color: 'bg-purple-500', icon: CheckCircle },
  { key: 'serving',    label: 'يُقدَّم',     color: 'bg-orange-500', icon: UtensilsCrossed },
  { key: 'delivered',  label: 'سُلِّم',      color: 'bg-green-500',  icon: CheckCircle },
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
          <p className="text-sm text-gray-500">جاري تحميل الطلبات الداخلية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
            <Coffee className="w-5 h-5 text-green-600 animate-pulse" />
            {tc("التوصيل الداخلي للمطعم - مباشر", "In-Restaurant Live Delivery")}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-green-500" />
            يتحدث كل 15 ثانية • {now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
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
            <p className="text-xs font-semibold text-yellow-700">قيد التحضير</p>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-purple-700">
            {orders.filter(o => o.status === 'ready').length}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <p className="text-xs font-semibold text-purple-700">جاهز للتقديم</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-orange-700">
            {orders.filter(o => o.status === 'serving').length}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <p className="text-xs font-semibold text-orange-700">يُقدَّم الآن</p>
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
            <p className="font-semibold text-gray-600">لا توجد طلبات داخلية نشطة حالياً</p>
            <p className="text-sm text-gray-400">ستظهر طلبات الطاولات هنا بمجرد ورودها</p>
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
                          {order.tableNumber ? `طاولة ${order.tableNumber}` : (order.customerName || 'طلب داخلي')}
                        </p>
                        <p className="text-xs text-gray-500">#{order.orderNumber || order.id?.slice(-6)}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <Badge className={`${step?.color} text-white text-xs flex items-center gap-1 ${order.status === 'ready' || order.status === 'serving' ? 'animate-pulse' : ''}`}>
                        <StepIcon className="w-3 h-3" />
                        {step?.label}
                      </Badge>
                      <p className={`text-xs mt-1 text-left ${isUrgent ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {elapsed} دقيقة {isUrgent ? '⚠️' : ''}
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
                    <span className="text-xs text-gray-400">إجمالي الطلب</span>
                    <span className="font-bold text-sm text-gray-900">{(order.totalAmount || 0).toFixed(2)} ر.س</span>
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

function ManualAssignDialog({
  order,
  drivers,
  open,
  onClose,
}: {
  order: any;
  drivers: any[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const tc = useTranslate();
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const assignMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const res = await apiRequest("PATCH", `/api/delivery/orders/${order?.id}/assign`, { driverId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/drivers"] });
      toast({ title: tc("تم تعيين السائق بنجاح", "Driver assigned successfully"), className: "bg-green-600 text-white" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: err.message || tc("فشل تعيين السائق", "Failed to assign driver"), variant: "destructive" });
    },
  });

  const availableDrivers = drivers.filter((d: any) => d.status === "available" || d.status === "online");
  const busyDrivers = drivers.filter((d: any) => d.status === "busy");

  const VehicleIcon = (type: string) => {
    if (type === "motorcycle" || type === "bicycle") return Bike;
    return Car;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#2D9B6E]" />
            تعيين سائق للطلب
          </DialogTitle>
        </DialogHeader>

        {order && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-sm">{order.customerName || "عميل"}</p>
              <Badge className="bg-yellow-500 text-white text-xs">بانتظار سائق</Badge>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {order.customerAddress || "عنوان غير محدد"}
            </p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {order.customerPhone || "—"}
            </p>
          </div>
        )}

        <div className="space-y-3 max-h-72 overflow-y-auto">
          {availableDrivers.length === 0 && busyDrivers.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا يوجد سائقون متاحون الآن</p>
              <p className="text-xs mt-1">أضف سائقين من تبويب الإعدادات</p>
            </div>
          )}

          {availableDrivers.length > 0 && (
            <>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">متاحون للتوصيل ({availableDrivers.length})</p>
              {availableDrivers.map((driver: any) => {
                const Icon = VehicleIcon(driver.vehicleType);
                const isSelected = selectedDriverId === driver.id;
                return (
                  <button
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right ${
                      isSelected
                        ? "border-[#2D9B6E] bg-[#2D9B6E]/10"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    data-testid={`driver-select-${driver.id}`}
                  >
                    <div className="relative w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0">
                      {(driver.nameAr || driver.name || "؟")[0]}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{driver.nameAr || driver.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {driver.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Icon className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {driver.totalDeliveries || 0} توصيلة
                          {driver.rating ? ` • ⭐ ${driver.rating.toFixed(1)}` : ""}
                        </span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle className="w-5 h-5 text-[#2D9B6E] shrink-0" />}
                  </button>
                );
              })}
            </>
          )}

          {busyDrivers.length > 0 && (
            <>
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mt-2">مشغولون ({busyDrivers.length})</p>
              {busyDrivers.map((driver: any) => {
                const Icon = VehicleIcon(driver.vehicleType);
                const isSelected = selectedDriverId === driver.id;
                return (
                  <button
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right opacity-70 ${
                      isSelected
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
                    }`}
                    data-testid={`driver-select-busy-${driver.id}`}
                  >
                    <div className="relative w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 shrink-0">
                      {(driver.nameAr || driver.name || "؟")[0]}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{driver.nameAr || driver.name}</p>
                      <p className="text-xs text-orange-600">مشغول حالياً</p>
                    </div>
                    {isSelected && <CheckCircle className="w-5 h-5 text-orange-500 shrink-0" />}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <Button
            className="flex-1 bg-[#2D9B6E] hover:bg-[#258a5e]"
            disabled={!selectedDriverId || assignMutation.isPending}
            onClick={() => assignMutation.mutate(selectedDriverId)}
            data-testid="button-confirm-assign-driver"
          >
            <UserCheck className="w-4 h-4 ml-2" />
            {assignMutation.isPending ? "جاري التعيين..." : "تعيين السائق"}
          </Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ManagerDelivery() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState("today");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [assignDialogOrder, setAssignDialogOrder] = useState<any>(null);
  const [ordersFilter, setOrdersFilter] = useState<"all" | "pending" | "active" | "completed">("all");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/delivery/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/delivery/stats?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: ordersData = [], refetch: refetchOrders } = useQuery({
    queryKey: ["/api/delivery/orders"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/orders", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.orders || [];
    },
    refetchInterval: 12000,
  });

  const { data: driversData = [] } = useQuery({
    queryKey: ["/api/delivery/drivers"],
    queryFn: async () => {
      const res = await fetch("/api/delivery/drivers", { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : d.drivers || [];
    },
    refetchInterval: 20000,
  });

  const autoAssignMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/delivery/orders/${orderId}/auto-assign`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
      toast({ title: tc("تم تعيين سائق بنجاح", "Driver assigned successfully"), className: "bg-green-600 text-white" });
    },
    onError: (err: any) => {
      toast({ title: err.message || tc("فشل التعيين", "Assignment failed"), variant: "destructive" });
    },
  });

  const orderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/delivery/orders/${orderId}/status`, { status });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/stats"] });
      const statusLabels: Record<string, string> = {
        accepted: "تم القبول",
        picking_up: "جاري استلام الطلب",
        on_the_way: "السائق في الطريق",
        delivered: "تم التوصيل بنجاح ✓",
        cancelled: "تم الإلغاء",
      };
      toast({ title: statusLabels[vars.status] || tc("تم تحديث الحالة", "Status updated"), className: "bg-green-600 text-white" });
    },
    onError: (err: any) => {
      toast({ title: err.message || tc("فشل تحديث الحالة", "Status update failed"), variant: "destructive" });
    },
  });

  const stats = statsData?.stats;
  const allOrders: any[] = ordersData;
  const activeOrders = allOrders.filter((o: any) =>
    ['pending', 'accepted', 'assigned', 'picking_up', 'on_the_way', 'arrived', 'in_progress', 'out_for_delivery'].includes(o.status)
  );
  const pendingOrders = allOrders.filter((o: any) => o.status === 'pending' || (!o.driverId && !['delivered','cancelled','returned'].includes(o.status)));
  const completedOrders = allOrders.filter((o: any) => ['delivered', 'completed', 'cancelled', 'returned'].includes(o.status));

  const filteredOrders = ordersFilter === "pending" ? pendingOrders
    : ordersFilter === "active" ? activeOrders
    : ordersFilter === "completed" ? completedOrders
    : allOrders;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white text-gray-900 min-h-screen" dir="rtl">
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
        <TabsList className="grid grid-cols-5 w-full max-w-xl">
          <TabsTrigger value="dashboard">{tc("الرئيسية", "Dashboard")}</TabsTrigger>
          <TabsTrigger value="orders">{tc("الطلبات", "Orders")}</TabsTrigger>
          <TabsTrigger value="tracking">{tc("تتبع مباشر", "Live Track")}</TabsTrigger>
          <TabsTrigger value="settings">{tc("الإعدادات", "Settings")}</TabsTrigger>
          <TabsTrigger value="integrations">{tc("الربط", "Integrations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
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
            <Card className="border-orange-400 border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                  <Zap className="w-4 h-4 animate-pulse" />
                  طلبات تحتاج تعيين سائق ({pendingOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingOrders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm">{order.customerName || tc('عميل', 'Customer')}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {order.customerAddress || tc('عنوان غير محدد', 'Address not specified')}
                        </p>
                        {order.customerPhone && (
                          <a href={`tel:${order.customerPhone}`} className="text-xs text-[#2D9B6E] flex items-center gap-1 mt-0.5 hover:underline">
                            <Phone className="w-3 h-3" />
                            {order.customerPhone}
                          </a>
                        )}
                      </div>
                      <span className="text-sm font-bold text-gray-800 shrink-0">{formatCurrency(order.totalAmount || 0)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-[#2D9B6E] hover:bg-[#258a5e] text-white"
                        onClick={() => setAssignDialogOrder(order)}
                        data-testid={`button-manual-assign-dashboard-${order.id}`}
                      >
                        <UserCheck className="w-3 h-3 ml-1" />
                        اختيار سائق
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-400 text-orange-600 hover:bg-orange-100"
                        onClick={() => autoAssignMutation.mutate(order.id)}
                        disabled={autoAssignMutation.isPending}
                        data-testid={`button-auto-assign-dashboard-${order.id}`}
                      >
                        <Zap className="w-3 h-3 ml-1" />
                        تلقائي
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* Manual assign dialog accessible from dashboard */}
          <ManualAssignDialog
            order={assignDialogOrder}
            drivers={driversData}
            open={!!assignDialogOrder}
            onClose={() => setAssignDialogOrder(null)}
          />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {/* Filter + refresh bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
              {(["all","pending","active","completed"] as const).map((f) => {
                const labels: Record<string, string> = { all: "الكل", pending: "بانتظار سائق", active: "جارية", completed: "مكتملة" };
                const counts: Record<string, number> = {
                  all: allOrders.length,
                  pending: pendingOrders.length,
                  active: activeOrders.length,
                  completed: completedOrders.length,
                };
                return (
                  <button
                    key={f}
                    onClick={() => setOrdersFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      ordersFilter === f
                        ? "bg-[#2D9B6E] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                    data-testid={`filter-orders-${f}`}
                  >
                    {labels[f]} ({counts[f]})
                  </button>
                );
              })}
            </div>
            <div className="mr-auto flex items-center gap-2">
              {pendingOrders.length > 0 && (
                <span className="text-xs text-orange-600 font-semibold animate-pulse flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {pendingOrders.length} طلب بانتظار سائق
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => refetchOrders()}>
                <RefreshCw className="w-4 h-4 ml-1" />
                تحديث
              </Button>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{tc("لا توجد طلبات في هذه الفئة", "No orders in this category")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order: any) => {
                const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-gray-500' };
                const needsDriver = !order.driverId && !["delivered","cancelled","returned","completed"].includes(order.status);
                const isCompleted = ["delivered","completed","cancelled","returned"].includes(order.status);
                return (
                  <Card key={order.id} className={`overflow-hidden border-2 transition-all ${
                    needsDriver ? "border-orange-300 bg-orange-50/30"
                    : isCompleted ? "border-gray-200 opacity-80"
                    : "border-[#2D9B6E]/30 bg-[#2D9B6E]/5"
                  }`}>
                    <div className={`h-1 ${statusInfo.color}`} />
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold">{order.customerName || tc('عميل', 'Customer')}</p>
                            <Badge className={`${statusInfo.color} text-white text-xs`}>
                              {statusInfo.label}
                            </Badge>
                            {needsDriver && (
                              <Badge className="bg-orange-500 text-white text-xs animate-pulse">
                                ⚡ يحتاج سائق
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {order.customerAddress || tc('عنوان غير محدد', 'Address not specified')}
                          </p>
                          {order.customerPhone && (
                            <a href={`tel:${order.customerPhone}`} className="text-xs text-[#2D9B6E] flex items-center gap-1 mt-0.5 hover:underline">
                              <Phone className="w-3 h-3" />
                              {order.customerPhone}
                            </a>
                          )}
                          {order.externalProvider && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {PROVIDER_LABELS[order.externalProvider] || order.externalProvider}
                            </Badge>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          <p className="font-bold text-lg">{formatCurrency(order.totalAmount || 0)}</p>
                          {order.deliveryFee > 0 && (
                            <p className="text-xs text-muted-foreground">توصيل: {formatCurrency(order.deliveryFee)}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      {/* Items summary */}
                      {order.items && order.items.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-2 mb-3">
                          {order.items.slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span>{item.name || item.nameAr || "صنف"}</span>
                              <span className="font-medium">×{item.quantity}</span>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <p className="text-xs text-gray-400 mt-1">+{order.items.length - 3} أصناف أخرى</p>
                          )}
                        </div>
                      )}

                      {/* Driver info */}
                      {order.driverName && (
                        <div className="flex items-center gap-2 p-2 bg-[#2D9B6E]/10 rounded-lg mb-3 border border-[#2D9B6E]/20">
                          <Truck className="w-4 h-4 text-[#2D9B6E] shrink-0" />
                          <div className="flex-1">
                            <span className="font-semibold text-sm text-[#2D9B6E]">{order.driverName}</span>
                            {order.driverPhone && (
                              <a href={`tel:${order.driverPhone}`} className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 hover:underline">
                                <Phone className="w-3 h-3" />
                                {order.driverPhone}
                              </a>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-[#2D9B6E]/40 text-[#2D9B6E]"
                            onClick={() => setAssignDialogOrder(order)}
                          >
                            <RefreshCw className="w-3 h-3 ml-1" />
                            تغيير
                          </Button>
                        </div>
                      )}

                      {/* Action buttons */}
                      {!isCompleted && (
                        <div className="flex flex-wrap gap-2">
                          {needsDriver && (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#2D9B6E] hover:bg-[#258a5e] text-white"
                                onClick={() => setAssignDialogOrder(order)}
                                data-testid={`button-manual-assign-${order.id}`}
                              >
                                <UserCheck className="w-3 h-3 ml-1" />
                                اختيار سائق
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => autoAssignMutation.mutate(order.id)}
                                disabled={autoAssignMutation.isPending}
                                className="border-[#2D9B6E]/40 text-[#2D9B6E]"
                                data-testid={`button-auto-assign-${order.id}`}
                              >
                                <Zap className="w-3 h-3 ml-1" />
                                تعيين تلقائي
                              </Button>
                            </>
                          )}
                          {order.status === "assigned" && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: "picking_up" })}
                              disabled={orderStatusMutation.isPending}
                            >
                              <Package className="w-3 h-3 ml-1" />
                              السائق في الطريق للاستلام
                            </Button>
                          )}
                          {order.status === "picking_up" && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: "on_the_way" })}
                              disabled={orderStatusMutation.isPending}
                            >
                              <Truck className="w-3 h-3 ml-1" />
                              في الطريق للعميل
                            </Button>
                          )}
                          {order.status === "on_the_way" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: "delivered" })}
                              disabled={orderStatusMutation.isPending}
                            >
                              <CheckCircle className="w-3 h-3 ml-1" />
                              تم التوصيل ✓
                            </Button>
                          )}
                          {!["delivered","cancelled","returned"].includes(order.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => orderStatusMutation.mutate({ orderId: order.id, status: "cancelled" })}
                              disabled={orderStatusMutation.isPending}
                            >
                              <XCircle className="w-3 h-3 ml-1" />
                              إلغاء
                            </Button>
                          )}
                        </div>
                      )}

                      {/* ETA */}
                      {order.estimatedDeliveryTime && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          التوصيل المتوقع: {new Date(order.estimatedDeliveryTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}

                      {/* Customer tracking link */}
                      {!isCompleted && (
                        <a
                          href={`/delivery/track/${order.orderId || order.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#2D9B6E] flex items-center gap-1 mt-2 hover:underline"
                        >
                          <Navigation className="w-3 h-3" />
                          رابط تتبع العميل
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Manual assign dialog */}
          <ManualAssignDialog
            order={assignDialogOrder}
            drivers={driversData}
            open={!!assignDialogOrder}
            onClose={() => setAssignDialogOrder(null)}
          />
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <TrackingModeSelector />
        </TabsContent>

        <TabsContent value="settings">
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
