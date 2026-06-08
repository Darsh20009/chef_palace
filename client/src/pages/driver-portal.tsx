import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SarIcon from "@/components/sar-icon";
import {
  Truck, Package, MapPin, Clock, Phone, User,
  CheckCircle, Navigation, Coffee, RefreshCw,
  Bike, Car, LogOut, Star, TrendingUp, Bell,
  AlertCircle, ChevronRight, XCircle, Wallet,
  ArrowRight, Zap, Timer
} from "lucide-react";

const VEHICLE_ICONS: Record<string, any> = {
  motorcycle: Bike, car: Car, bicycle: Bike, truck: Truck,
};

const STATUS_FLOW: Record<string, { label: string; nextStatus: string; nextLabel: string; color: string; bg: string }> = {
  assigned:   { label: "تم تعيينك",         nextStatus: "picking_up",  nextLabel: "جاري التوجه للفرع",   color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  picking_up: { label: "في الطريق للفرع",   nextStatus: "on_the_way",  nextLabel: "استلمت الطلب — في الطريق", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  on_the_way: { label: "في الطريق للعميل", nextStatus: "delivered",    nextLabel: "تم التوصيل ✓",          color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  delivered:  { label: "تم التوصيل",        nextStatus: "",             nextLabel: "",                      color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  cancelled:  { label: "ملغي",              nextStatus: "",             nextLabel: "",                      color: "text-red-700",    bg: "bg-red-50 border-red-200" },
};

const STATUS_STEPS = [
  { key: "assigned",   icon: User,         label: "تم التعيين" },
  { key: "picking_up", icon: Coffee,       label: "في الطريق للفرع" },
  { key: "on_the_way", icon: Truck,        label: "في الطريق للعميل" },
  { key: "delivered",  icon: CheckCircle,  label: "تم التوصيل" },
];

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function useGPS(enabled: boolean, onUpdate: (lat: number, lng: number) => void) {
  const watchId = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => onUpdate(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [enabled]);
}

export default function DriverPortal() {
  const [, setLocation] = useLocation();
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const prevOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.title = "بوابة المندوب";
    const stored = localStorage.getItem("currentDriver");
    if (stored) {
      const d = JSON.parse(stored);
      setDriver(d);
      setIsOnline(d.status === "available" || d.status === "busy");
    }
  }, []);

  const { data: ordersData, refetch: refetchOrders } = useQuery({
    queryKey: ["/api/delivery/orders/driver", driver?.id],
    enabled: !!driver?.id,
    refetchInterval: 5000,
  });

  const orders: any[] = (ordersData as any)?.orders || [];
  const activeOrders = orders.filter((o) => !["delivered", "cancelled", "returned"].includes(o.status));
  const historyOrders = orders.filter((o) => ["delivered", "cancelled", "returned"].includes(o.status));
  const newOrders = orders.filter((o) => o.status === "assigned");

  // Notify when a new order arrives
  useEffect(() => {
    newOrders.forEach((o) => {
      if (!prevOrderIds.current.has(o.id)) {
        toast({
          title: "🚨 طلب توصيل جديد!",
          description: `طلب رقم #${o.orderNumber || o.id?.slice(-4)} — ${o.customerAddress || ""}`,
        });
        // Vibrate if available
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      }
    });
    const currentIds = new Set(newOrders.map((o) => o.id));
    prevOrderIds.current = currentIds;
  }, [newOrders.map((o) => o.id).join(",")]);

  // GPS sharing for active delivery
  const onGpsUpdate = useCallback(async (lat: number, lng: number) => {
    if (!driver?.id) return;
    try {
      await apiRequest("PATCH", `/api/delivery/drivers/${driver.id}/location`, { lat, lng });
      if (trackingOrderId) {
        await apiRequest("PATCH", `/api/delivery/orders/${trackingOrderId}/location`, { lat, lng });
      }
    } catch {}
  }, [driver?.id, trackingOrderId]);

  const isGpsTracking = activeOrders.some((o) => o.status === "on_the_way");
  useGPS(isGpsTracking, onGpsUpdate);

  // Update tracking order
  useEffect(() => {
    const onWay = activeOrders.find((o) => o.status === "on_the_way");
    setTrackingOrderId(onWay?.id || null);
  }, [activeOrders]);

  const toggleOnlineMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/delivery/drivers/${driver?.id}/status`, { status }),
    onSuccess: (_, status) => {
      setIsOnline(status === "available");
      const updated = { ...driver, status };
      setDriver(updated);
      localStorage.setItem("currentDriver", JSON.stringify(updated));
      toast({ title: status === "available" ? "✅ أنت متصل الآن" : "🔴 أنت غير متصل" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      apiRequest("PATCH", `/api/delivery/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders/driver", driver?.id] });
      refetchOrders();
    },
    onError: () => toast({ title: "خطأ", description: "فشل تحديث الحالة", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (orderId: string) => apiRequest("POST", `/api/delivery/orders/${orderId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/orders/driver", driver?.id] });
      toast({ title: "تم رفض الطلب" });
    },
  });

  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/delivery/drivers/logout", {}); } catch {}
    localStorage.removeItem("currentDriver");
    setLocation("/driver/login");
  };

  const todayDeliveries = historyOrders.filter(
    (o) => o.status === "delivered" && new Date(o.deliveredAt || o.updatedAt).toDateString() === new Date().toDateString()
  );
  const todayEarnings = todayDeliveries.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

  const VehicleIcon = driver?.vehicleType ? VEHICLE_ICONS[driver.vehicleType] || Truck : Truck;

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Truck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">بوابة المندوب</h1>
          <p className="text-gray-400">يرجى تسجيل الدخول للمتابعة</p>
          <Button className="w-48 bg-primary hover:bg-primary/90" onClick={() => setLocation("/driver/login")}>
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                <VehicleIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{driver.fullName}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
                  <p className="text-xs text-gray-400">{isOnline ? "متصل" : "غير متصل"}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-1.5">
                <span className="text-xs text-gray-400">حالتي</span>
                <Switch
                  checked={isOnline}
                  onCheckedChange={(c) => toggleOnlineMutation.mutate(c ? "available" : "offline")}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* ── Today Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
            <p className="text-2xl font-black text-primary">{todayDeliveries.length}</p>
            <p className="text-xs text-gray-500 mt-1">توصيل اليوم</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
            <p className="text-2xl font-black text-yellow-400">{activeOrders.length}</p>
            <p className="text-xs text-gray-500 mt-1">نشطة الآن</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
            <div className="flex items-center justify-center gap-1">
              <p className="text-xl font-black text-green-400">{todayEarnings.toFixed(0)}</p>
              <SarIcon size={14} className="text-green-400" />
            </div>
            <p className="text-xs text-gray-500 mt-1">أرباح اليوم</p>
          </div>
        </div>

        {/* ── Offline notice ── */}
        {!isOnline && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="font-bold text-gray-300">أنت غير متصل</p>
              <p className="text-xs text-gray-500 mt-0.5">شغّل المفتاح أعلاه لاستلام طلبات التوصيل</p>
            </div>
          </div>
        )}

        {/* ── NEW ORDER NOTIFICATION (pulsing card) ── */}
        {newOrders.map((order) => (
          <NewOrderCard
            key={order.id}
            order={order}
            onAccept={() => updateStatusMutation.mutate({ orderId: order.id, status: "picking_up" })}
            onReject={() => rejectMutation.mutate(order.id)}
            isPending={updateStatusMutation.isPending || rejectMutation.isPending}
          />
        ))}

        {/* ── Active Orders ── */}
        {activeOrders.filter((o) => o.status !== "assigned").map((order) => (
          <ActiveOrderCard
            key={order.id}
            order={order}
            onStatusChange={(status) => updateStatusMutation.mutate({ orderId: order.id, status })}
            isPending={updateStatusMutation.isPending}
          />
        ))}

        {/* ── Tab: History ── */}
        {activeOrders.length === 0 && newOrders.length === 0 && isOnline && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-gray-300 font-medium">بانتظار طلبات جديدة</p>
            <p className="text-gray-600 text-sm mt-1">سيتم إشعارك فور تعيين طلب</p>
            <button
              onClick={() => refetchOrders()}
              className="mt-4 flex items-center gap-1.5 text-primary text-sm mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث
            </button>
          </div>
        )}

        {/* ── History Section ── */}
        {historyOrders.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 text-sm font-medium px-1">السجل</p>
            {historyOrders.slice(0, 10).map((order) => (
              <HistoryCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ──────────────────── New Order Card ──────────────────── */
function NewOrderCard({ order, onAccept, onReject, isPending }: {
  order: any; onAccept: () => void; onReject: () => void; isPending: boolean;
}) {
  const [countdown, setCountdown] = useState(45);
  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(t); onReject(); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary to-emerald-700 rounded-2xl p-4 shadow-2xl animate-pulse-border">
      <div className="absolute top-0 left-0 w-full h-1 bg-white/20">
        <div
          className="h-full bg-white transition-all duration-1000"
          style={{ width: `${(countdown / 45) * 100}%` }}
        />
      </div>
      <div className="flex items-start justify-between mb-3 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <p className="text-white font-black text-base">طلب جديد!</p>
          </div>
          <p className="text-green-100 text-sm">طلب رقم #{order.orderNumber || order.id?.slice(-4)}</p>
        </div>
        <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center">
          <span className="text-white font-black text-lg">{countdown}</span>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-green-100 text-sm">
          <User className="w-4 h-4 flex-shrink-0" />
          <span>{order.customerName}</span>
        </div>
        <div className="flex items-center gap-2 text-green-100 text-sm">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="line-clamp-1">{order.customerAddress || "العنوان غير محدد"}</span>
        </div>
        {order.totalAmount > 0 && (
          <div className="flex items-center gap-2 text-green-100 text-sm">
            <Wallet className="w-4 h-4 flex-shrink-0" />
            <span>قيمة الطلب: {order.totalAmount.toFixed(2)} ر.س</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={onAccept}
          disabled={isPending}
          className="bg-white text-primary hover:bg-green-50 font-bold h-12 rounded-xl"
        >
          <CheckCircle className="w-5 h-5 ml-1.5" />
          قبول الطلب
        </Button>
        <Button
          onClick={onReject}
          disabled={isPending}
          variant="outline"
          className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-medium h-12 rounded-xl"
        >
          <XCircle className="w-4 h-4 ml-1.5" />
          رفض
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────── Customer Map (driver view) ──────────────────── */
function CustomerLocationMap({ lat, lng, address }: { lat: number; lng: number; address?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let mounted = true;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (!mounted || !mapRef.current) return;
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapInstanceRef.current);
        const icon = L.divIcon({
          html: `<div style="width:38px;height:38px;background:#22c55e;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.5)">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>`,
          className: "",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
        L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current)
          .bindPopup(address || "موقع العميل").openPopup();
      } catch (e) {
        console.warn("Customer map error:", e);
      }
    })();
    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700">
      <div ref={mapRef} style={{ height: "160px", width: "100%" }} />
    </div>
  );
}

/* ──────────────────── Active Order Card ──────────────────── */
function ActiveOrderCard({ order, onStatusChange, isPending }: {
  order: any; onStatusChange: (s: string) => void; isPending: boolean;
}) {
  const cfg = STATUS_FLOW[order.status] || STATUS_FLOW.assigned;
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const [showMap, setShowMap] = useState(false);

  const hasCustomerLocation = !!(order.customerLat && order.customerLng);

  const openMaps = () => {
    if (order.customerLat && order.customerLng) {
      window.open(`https://maps.google.com/?q=${order.customerLat},${order.customerLng}`, "_blank");
    } else if (order.customerAddress) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(order.customerAddress)}`, "_blank");
    }
  };

  return (
    <div className={`bg-gray-900 border ${cfg.bg.includes("border") ? "" : "border-gray-800"} rounded-2xl overflow-hidden`}
      style={{ borderColor: cfg.bg.includes("indigo") ? "#6366f1" : cfg.bg.includes("purple") ? "#a855f7" : cfg.bg.includes("orange") ? "#f97316" : "#4ade80" }}>

      {/* Status bar */}
      <div className={`px-4 py-2 flex items-center gap-2 ${cfg.bg}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.color.replace("text", "bg")} animate-pulse`} />
        <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const done = idx <= currentStepIdx;
            const current = idx === currentStepIdx;
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? "bg-primary" : "bg-gray-800"
                } ${current ? "ring-2 ring-primary ring-offset-1 ring-offset-gray-900" : ""}`}>
                  <Icon className={`w-3.5 h-3.5 ${done ? "text-white" : "text-gray-600"}`} />
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${idx < currentStepIdx ? "bg-primary" : "bg-gray-800"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Order info */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">طلب رقم</span>
          <span className="text-white font-bold">#{order.orderNumber || order.id?.slice(-4)}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium">{order.customerName}</p>
              {order.customerPhone && (
                <a href={`tel:${order.customerPhone}`}
                  className="text-primary text-xs flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" />
                  {order.customerPhone}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-300 text-sm">{order.customerAddress || "العنوان غير محدد"}</p>
              {hasCustomerLocation && (
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="text-primary text-xs mt-1 flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  {showMap ? "إخفاء الخريطة" : "عرض الخريطة"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Embedded customer location map */}
        {showMap && hasCustomerLocation && (
          <CustomerLocationMap
            lat={order.customerLat}
            lng={order.customerLng}
            address={order.customerAddress}
          />
        )}

        {/* Items */}
        {order.items && order.items.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3 space-y-1">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{item.name}</span>
                <span className="text-gray-500">×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            onClick={openMaps}
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 h-11 rounded-xl"
          >
            <Navigation className="w-4 h-4 ml-1.5" />
            ملاحة
          </Button>
          {cfg.nextStatus && (
            <Button
              onClick={() => onStatusChange(cfg.nextStatus)}
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 font-bold h-11 rounded-xl"
            >
              {cfg.nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── History Card ──────────────────── */
function HistoryCard({ order }: { order: any }) {
  const isDelivered = order.status === "delivered";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
        isDelivered ? "bg-green-500/10" : "bg-red-500/10"
      }`}>
        {isDelivered
          ? <CheckCircle className="w-5 h-5 text-green-500" />
          : <XCircle className="w-5 h-5 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">#{order.orderNumber || order.id?.slice(-4)}</p>
        <p className="text-gray-500 text-xs truncate">{order.customerName} — {order.customerAddress}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {order.deliveryFee > 0 && (
          <p className="text-green-400 text-sm font-bold">{order.deliveryFee.toFixed(0)} <SarIcon size={11} className="inline" /></p>
        )}
        {order.deliveredAt && (
          <p className="text-gray-600 text-xs">{new Date(order.deliveredAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</p>
        )}
      </div>
    </div>
  );
}
