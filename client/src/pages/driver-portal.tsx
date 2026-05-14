import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState } from "@/components/ui/states";
import SarIcon from "@/components/sar-icon";
import { 
  Truck, Package, MapPin, Clock, Phone, User, 
  CheckCircle, XCircle, Navigation, ArrowRight,
  Coffee, RefreshCw, Bike, Car, LogOut, Bell,
  Locate, Wifi, WifiOff, MessageCircle, Star
} from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

interface DeliveryOrder {
  id: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocation?: { lat: number; lng: number };
  branchId: string;
  branchName?: string;
  estimatedDeliveryTime?: string;
  estimatedMinutes?: number;
  totalAmount: number;
  items?: Array<{ name: string; quantity: number }>;
  createdAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

interface Driver {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  vehicleType: string;
  currentLocation?: { lat: number; lng: number };
}

const VEHICLE_ICONS: Record<string, any> = {
  motorcycle: Bike,
  car: Car,
  bicycle: Bike,
};

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  assigned:   { next: "accepted",   label: "قبول الطلب",       color: "bg-blue-600 hover:bg-blue-700" },
  accepted:   { next: "picking_up", label: "في الطريق للاستلام", color: "bg-purple-600 hover:bg-purple-700" },
  picking_up: { next: "on_the_way", label: "بدء التوصيل 🚀",   color: "bg-orange-500 hover:bg-orange-600" },
  on_the_way: { next: "delivered",  label: "تم التوصيل ✓",     color: "bg-green-600 hover:bg-green-700" },
};

export default function DriverPortal() {
  const [, setLocation] = useLocation();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [locationSharing, setLocationSharing] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevOrderCountRef = useRef(0);
  const { toast } = useToast();
  const tc = useTranslate();

  const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:    { label: tc("في الانتظار", "Pending"),         color: "bg-yellow-500" },
    assigned:   { label: tc("تم التعيين", "Assigned"),        color: "bg-blue-500" },
    accepted:   { label: tc("مقبول", "Accepted"),             color: "bg-indigo-500" },
    picking_up: { label: tc("في الطريق للاستلام", "Picking Up"), color: "bg-purple-500" },
    on_the_way: { label: tc("في الطريق", "On the Way"),       color: "bg-orange-500" },
    delivered:  { label: tc("تم التوصيل", "Delivered"),       color: "bg-green-500" },
    cancelled:  { label: tc("ملغي", "Cancelled"),             color: "bg-red-500" },
  };

  useEffect(() => {
    document.title = tc("بوابة المندوب - مكان الشيف البخاري", "Driver Portal - مكان الشيف البخاري");
    const storedDriver = localStorage.getItem("currentDriver");
    if (storedDriver) {
      const driverData = JSON.parse(storedDriver);
      setDriver(driverData);
      setIsOnline(driverData.status === "available" || driverData.status === "online");
    }
  }, [tc]);

  const { data: ordersData, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['/api/delivery/orders/driver', driver?.id],
    enabled: !!driver,
    refetchInterval: 10000,
  });

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refetchOrders();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [refetchOrders]);

  const orders = (ordersData as any)?.orders || [];
  const activeOrders = orders.filter((o: DeliveryOrder) => 
    !["delivered", "cancelled"].includes(o.status)
  );

  useEffect(() => {
    const currentCount = activeOrders.filter((o: DeliveryOrder) => o.status === "assigned").length;
    if (currentCount > prevOrderCountRef.current && prevOrderCountRef.current >= 0) {
      toast({
        title: "🔔 طلب جديد!",
        description: "تم تعيين طلب توصيل جديد لك",
        className: "bg-blue-600 text-white border-blue-700",
      });
      if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]);
    }
    prevOrderCountRef.current = currentCount;
  }, [activeOrders.length]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest('PATCH', `/api/delivery/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/delivery/orders/driver'] });
      refetchOrders();
      toast({ title: tc("تم التحديث", "Updated"), description: tc("تم تحديث حالة الطلب", "Order status updated"), className: "bg-green-600 text-white" });
    },
    onError: () => {
      toast({ title: tc("خطأ", "Error"), description: tc("فشل في تحديث الحالة", "Failed to update status"), variant: "destructive" });
    },
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async (status: string) => {
      const driverId = driver?.id;
      return apiRequest('PATCH', `/api/delivery/drivers/${driverId}/status`, { status });
    },
    onSuccess: (_, status) => {
      setIsOnline(status === "available");
      if (driver) {
        const updatedDriver = { ...driver, status };
        setDriver(updatedDriver);
        localStorage.setItem("currentDriver", JSON.stringify(updatedDriver));
      }
      toast({ 
        title: status === "available" ? tc("أنت متصل الآن", "You are now online") : tc("أنت غير متصل", "You are now offline"),
        description: status === "available" ? tc("يمكنك استلام طلبات جديدة", "You can receive new orders") : tc("لن تستلم طلبات جديدة", "You will not receive new orders")
      });
    },
  });

  const sendLocationMutation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      return apiRequest('PATCH', `/api/delivery/drivers/${driver?.id}/location`, {
        location: { lat, lng },
        currentLat: lat,
        currentLng: lng,
      });
    },
  });

  const startLocationSharing = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS غير متاح", description: "جهازك لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }
    setLocationSharing(true);
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendLocationMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.warn("Location error:", err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    sendLocation();
    locationIntervalRef.current = setInterval(sendLocation, 30000);
    toast({ title: "📍 مشاركة الموقع مفعّلة", description: "سيتم إرسال موقعك كل 30 ثانية", className: "bg-green-600 text-white" });
  };

  const stopLocationSharing = () => {
    setLocationSharing(false);
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    toast({ title: "مشاركة الموقع متوقفة" });
  };

  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const handleToggleOnline = (checked: boolean) => {
    toggleOnlineMutation.mutate(checked ? "available" : "offline");
  };

  const handleLogout = () => {
    stopLocationSharing();
    localStorage.removeItem("currentDriver");
    setLocation("/driver/login");
  };

  const completedOrders = orders.filter((o: DeliveryOrder) => 
    ["delivered", "cancelled"].includes(o.status)
  );

  const VehicleIcon = driver?.vehicleType ? VEHICLE_ICONS[driver.vehicleType] || Truck : Truck;

  if (!driver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Truck className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle>{tc("بوابة المندوب", "Driver Portal")}</CardTitle>
            <CardDescription>{tc("يرجى تسجيل الدخول للمتابعة", "Please sign in to continue")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/driver/login")} data-testid="button-driver-login">
              {tc("تسجيل الدخول", "Sign In")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const newAssignedCount = activeOrders.filter((o: DeliveryOrder) => o.status === "assigned").length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? "bg-green-100" : "bg-gray-100"}`}>
                <VehicleIcon className={`w-6 h-6 ${isOnline ? "text-green-600" : "text-gray-400"}`} />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">{driver.fullName}</h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {driver.phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Online toggle */}
              <div className="flex flex-col items-center gap-0.5">
                <Switch 
                  id="online-status" 
                  checked={isOnline} 
                  onCheckedChange={handleToggleOnline}
                  data-testid="switch-online-status"
                />
                <Label htmlFor="online-status" className="text-xs">
                  {isOnline ? (
                    <span className="text-green-600 font-semibold">متصل</span>
                  ) : (
                    <span className="text-gray-400">غير متصل</span>
                  )}
                </Label>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout" className="text-gray-500">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* New order alert banner */}
      {newAssignedCount > 0 && (
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <span className="font-bold">
              {newAssignedCount === 1 ? "لديك طلب جديد!" : `لديك ${newAssignedCount} طلبات جديدة!`}
            </span>
          </div>
          <span className="text-sm opacity-80">اضغط لقبول الطلب ↓</span>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className={`${newAssignedCount > 0 ? "border-blue-300 bg-blue-50" : "bg-white"}`}>
            <CardContent className="p-3 text-center">
              <Package className={`w-7 h-7 mx-auto mb-1 ${newAssignedCount > 0 ? "text-blue-600" : "text-primary"}`} />
              <p className={`text-2xl font-bold ${newAssignedCount > 0 ? "text-blue-700" : ""}`}>{activeOrders.length}</p>
              <p className="text-xs text-gray-500">طلبات نشطة</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <CheckCircle className="w-7 h-7 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-700">
                {completedOrders.filter((o: DeliveryOrder) => o.status === "delivered").length}
              </p>
              <p className="text-xs text-gray-500">تم التوصيل</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <Locate className={`w-7 h-7 mx-auto mb-1 ${locationSharing ? "text-green-600" : "text-gray-400"}`} />
              <button
                onClick={locationSharing ? stopLocationSharing : startLocationSharing}
                className={`text-xs font-semibold px-2 py-1 rounded-full border transition-all ${
                  locationSharing
                    ? "border-green-300 text-green-700 bg-green-50"
                    : "border-gray-300 text-gray-500 hover:border-gray-400"
                }`}
                data-testid="button-toggle-location"
              >
                {locationSharing ? "GPS ✓" : "GPS"}
              </button>
              <p className="text-xs text-gray-400 mt-0.5">{locationSharing ? "مفعّل" : "متوقف"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Auto-refresh indicator */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">الطلبات</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Wifi className="w-3 h-3 text-green-500" />
              تحديث بعد {countdown}ث
            </span>
            <Button variant="outline" size="sm" onClick={() => { refetchOrders(); setCountdown(10); }} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active" className="relative">
              نشطة ({activeOrders.length})
              {newAssignedCount > 0 && (
                <span className="absolute -top-1 -left-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {newAssignedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              مكتملة ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {loadingOrders ? (
              <LoadingState />
            ) : activeOrders.length === 0 ? (
              <EmptyState 
                title={tc("لا توجد طلبات نشطة", "No Active Orders")}
                description={isOnline ? "انتظر وصول طلبات جديدة..." : "فعّل حالة الاتصال لاستلام الطلبات"}
              />
            ) : (
              activeOrders.map((order: DeliveryOrder) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onStatusChange={handleStatusChange}
                  isPending={updateStatusMutation.isPending}
                  statusLabels={ORDER_STATUS_LABELS}
                  tc={tc}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completedOrders.length === 0 ? (
              <EmptyState title="لا توجد طلبات مكتملة" description="ستظهر هنا الطلبات المكتملة" />
            ) : (
              completedOrders.slice(0, 20).map((order: DeliveryOrder) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onStatusChange={handleStatusChange}
                  isPending={updateStatusMutation.isPending}
                  isCompleted
                  statusLabels={ORDER_STATUS_LABELS}
                  tc={tc}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function OrderCard({ 
  order, 
  onStatusChange, 
  isPending,
  isCompleted = false,
  statusLabels,
  tc,
}: { 
  order: DeliveryOrder; 
  onStatusChange: (orderId: string, status: string) => void;
  isPending: boolean;
  isCompleted?: boolean;
  statusLabels: Record<string, { label: string; color: string }>;
  tc: (ar: string, en: string) => string;
}) {
  const orderId = order.id || "";
  const statusInfo = statusLabels[order.status] || { label: order.status, color: "bg-gray-500" };
  const flowInfo = STATUS_FLOW[order.status];
  const isNewlyAssigned = order.status === "assigned";

  return (
    <Card className={`overflow-hidden border-2 transition-all ${
      isNewlyAssigned ? "border-blue-400 shadow-blue-100 shadow-md" 
      : isCompleted ? "border-gray-200 opacity-80"
      : "border-[#2D9B6E]/30"
    }`}>
      <div className={`h-1.5 ${statusInfo.color}`} />
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg text-gray-900">طلب {order.orderNumber || orderId.slice(-6)}</span>
              <Badge className={`${statusInfo.color} text-white`}>
                {statusInfo.label}
              </Badge>
              {isNewlyAssigned && (
                <Badge className="bg-blue-600 text-white animate-bounce text-xs">جديد!</Badge>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {new Date(order.createdAt).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="font-bold text-primary text-xl">{order.totalAmount?.toFixed(2)} <SarIcon /></p>
            {order.estimatedMinutes && (
              <p className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-0.5">
                <Clock className="w-3 h-3" />
                ~{order.estimatedMinutes} د
              </p>
            )}
          </div>
        </div>

        {/* Customer info */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-semibold text-gray-800">{order.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <a href={`tel:${order.customerPhone}`} className="text-[#2D9B6E] font-medium text-sm hover:underline">
              {order.customerPhone}
            </a>
            <a
              href={`https://wa.me/${order.customerPhone?.replace(/\D/g, "")}?text=${encodeURIComponent(`مرحباً، أنا مندوب التوصيل، سأصل قريباً إن شاء الله`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-auto flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full hover:bg-green-200"
              data-testid={`button-whatsapp-${orderId}`}
            >
              <MessageCircle className="w-3 h-3" />
              واتساب
            </a>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700 flex-1">{order.customerAddress}</span>
          </div>
        </div>

        {/* Items */}
        {order.items && order.items.length > 0 && (
          <div className="bg-primary/5 rounded-lg p-2 mb-3 border border-primary/10">
            <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
              <Coffee className="w-3 h-3" />
              المنتجات
            </p>
            <div className="space-y-0.5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-700">
                  <span>{item.name}</span>
                  <span className="font-bold text-primary">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isCompleted && (
          <div className="flex gap-2">
            {order.customerLocation && (
              <Button 
                variant="outline" 
                className="flex-1 border-[#2D9B6E] text-[#2D9B6E] hover:bg-[#2D9B6E]/10"
                onClick={() => {
                  const { lat, lng } = order.customerLocation!;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
                }}
                data-testid={`button-navigate-${orderId}`}
              >
                <Navigation className="w-4 h-4 ml-1" />
                ملاحة
              </Button>
            )}
            {!order.customerLocation && order.customerAddress && (
              <Button 
                variant="outline" 
                className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                onClick={() => {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`, "_blank");
                }}
                data-testid={`button-maps-address-${orderId}`}
              >
                <Navigation className="w-4 h-4 ml-1" />
                خرائط
              </Button>
            )}
            {flowInfo && (
              <Button 
                className={`flex-1 text-white ${flowInfo.color}`}
                onClick={() => onStatusChange(orderId, flowInfo.next)}
                disabled={isPending}
                data-testid={`button-next-status-${orderId}`}
              >
                {flowInfo.label}
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            )}
            {order.status === "assigned" && (
              <Button 
                variant="outline"
                className="border-red-300 text-red-500 hover:bg-red-50"
                onClick={() => onStatusChange(orderId, "cancelled")}
                disabled={isPending}
                data-testid={`button-cancel-${orderId}`}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Completion badge */}
        {order.status === "delivered" && (
          <div className="mt-3 flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold text-sm">تم التوصيل بنجاح ✓</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
