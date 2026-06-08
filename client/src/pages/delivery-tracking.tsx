import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SarIcon from "@/components/sar-icon";
import {
  Package, MapPin, Clock, Phone, User, CheckCircle,
  Truck, Coffee, Home, RefreshCw, Star, XCircle,
  MessageCircle, Navigation, ChevronRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";

const STATUS_STEPS_DATA = [
  { key: "pending",    labelAr: "جاري التجهيز",          labelEn: "Preparing",              icon: Coffee,       color: "#f59e0b" },
  { key: "accepted",   labelAr: "تم قبول الطلب",          labelEn: "Order Accepted",          icon: CheckCircle,  color: "#6366f1" },
  { key: "assigned",   labelAr: "تم تعيين المندوب",       labelEn: "Driver Assigned",         icon: User,         color: "#8b5cf6" },
  { key: "picking_up", labelAr: "المندوب في الطريق للفرع", labelEn: "Driver Heading to Branch", icon: Truck,        color: "#f97316" },
  { key: "on_the_way", labelAr: "في الطريق إليك",          labelEn: "On the Way",              icon: Navigation,   color: "#0ea5e9" },
  { key: "delivered",  labelAr: "تم التوصيل بنجاح",        labelEn: "Delivered",               icon: CheckCircle,  color: "#22c55e" },
];

function getStepIndex(status: string) {
  const idx = STATUS_STEPS_DATA.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

/* ────────────── Live Map Component ────────────── */
function LiveDeliveryMap({ order }: { order: any }) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);

  const customerLat = order.customerLat || order.deliveryAddress?.lat;
  const customerLng = order.customerLng || order.deliveryAddress?.lng;
  const driverLat = order.driverLocation?.lat;
  const driverLng = order.driverLocation?.lng;

  const hasCustomer = !!(customerLat && customerLng);
  const hasDriver = !!(driverLat && driverLng);
  const isOnTheWay = ["on_the_way", "picking_up", "assigned"].includes(order.status);

  const centerLat = hasDriver && isOnTheWay ? driverLat : (hasCustomer ? customerLat : 24.7136);
  const centerLng = hasDriver && isOnTheWay ? driverLng : (hasCustomer ? customerLng : 46.6753);

  useEffect(() => {
    let L: any;
    async function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      try {
        L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        mapInstanceRef.current = L.map(mapRef.current, {
          center: [centerLat, centerLng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);

        L.control.zoom({ position: "bottomleft" }).addTo(mapInstanceRef.current);

        if (hasCustomer) {
          const customerIcon = L.divIcon({
            html: `<div style="width:36px;height:36px;background:#22c55e;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </div>`,
            className: "",
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          customerMarkerRef.current = L.marker([customerLat, customerLng], { icon: customerIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup("📍 موقعك");
        }

        if (hasDriver && isOnTheWay) {
          const driverIcon = L.divIcon({
            html: `<div style="width:40px;height:40px;background:#0ea5e9;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            </div>`,
            className: "",
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup("🚗 المندوب");

          if (hasCustomer) {
            lineRef.current = L.polyline(
              [[driverLat, driverLng], [customerLat, customerLng]],
              { color: "#0ea5e9", weight: 2, dashArray: "6, 6", opacity: 0.7 }
            ).addTo(mapInstanceRef.current);
            const bounds = L.latLngBounds([[driverLat, driverLng], [customerLat, customerLng]]);
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      } catch (e) {
        console.error("Map init error:", e);
      }
    }
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        driverMarkerRef.current = null;
        customerMarkerRef.current = null;
        lineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !driverMarkerRef.current) return;
    if (hasDriver && isOnTheWay) {
      driverMarkerRef.current.setLatLng([driverLat, driverLng]);
      if (lineRef.current && hasCustomer) {
        lineRef.current.setLatLngs([[driverLat, driverLng], [customerLat, customerLng]]);
      }
    }
  }, [driverLat, driverLng]);

  if (!hasCustomer && !hasDriver) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-white text-sm font-medium">
            {isOnTheWay && hasDriver ? "تتبع المندوب مباشرة" : "موقع التوصيل"}
          </span>
        </div>
        {isOnTheWay && hasDriver && (
          <span className="flex items-center gap-1.5 text-xs text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            مباشر
          </span>
        )}
      </div>
      <div ref={mapRef} style={{ height: "220px", width: "100%" }} />
      <div className="px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
        {hasDriver && isOnTheWay && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" /> المندوب
          </span>
        )}
        {hasCustomer && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> موقعك
          </span>
        )}
      </div>
    </div>
  );
}

export default function DeliveryTracking() {
  const [, params] = useRoute("/delivery/track/:orderId");
  const [, setLocation] = useLocation();
  const orderId = params?.orderId;
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const { toast } = useToast();
  const tc = useTranslate();

  useEffect(() => {
    document.title = tc("تتبع التوصيل", "Delivery Tracking");
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/delivery/orders/by-order", orderId],
    enabled: !!orderId,
    refetchInterval: 6000,
  });

  const order = (data as any)?.order as any;

  const rateMutation = useMutation({
    mutationFn: (r: number) => apiRequest("PATCH", `/api/delivery/orders/${order?.id}/rate`, { rating: r }),
    onSuccess: () => {
      setRatingDone(true);
      toast({ title: tc("شكراً على تقييمك!", "Thank you for your rating!") });
    },
  });

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Package className="w-16 h-16 mx-auto text-gray-600" />
          <h2 className="text-white text-xl font-bold">{tc("تتبع طلبك", "Track Your Order")}</h2>
          <p className="text-gray-500">{tc("أدخل رقم الطلب لمتابعته", "Enter the order number to track it")}</p>
          <Link href="/menu">
            <Button className="bg-primary hover:bg-primary/90">{tc("العودة للقائمة", "Back to Menu")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">{tc("جاري تحميل بيانات الطلب...", "Loading order data...")}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 mx-auto text-red-500" />
          <h2 className="text-white text-xl font-bold">{tc("لم يتم العثور على الطلب", "Order Not Found")}</h2>
          <p className="text-gray-500">{tc("تأكد من رقم الطلب وحاول مرة أخرى", "Verify the order number and try again")}</p>
          <Link href="/menu">
            <Button variant="outline" className="border-gray-700 text-gray-300">{tc("العودة للقائمة", "Back to Menu")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";
  const currentIdx = getStepIndex(order.status);
  const progressPct = ((currentIdx + 1) / STATUS_STEPS_DATA.length) * 100;
  const showMap = !!(order.customerLat || order.customerLng || order.deliveryAddress?.lat);

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/menu">
            <button className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
              <ChevronRight className="w-4 h-4" />
              {tc("القائمة", "Menu")}
            </button>
          </Link>
          <h1 className="font-bold text-white">{tc("تتبع الطلب", "Track Order")}</h1>
          <button onClick={() => refetch()} className="text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── Order Header ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-gray-400 text-xs">{tc("رقم الطلب", "Order Number")}</p>
              <p className="text-white font-black text-xl">#{order.orderNumber || orderId?.slice(-6)}</p>
            </div>
            {isCancelled ? (
              <Badge className="bg-red-500/20 text-red-400 border-0">{tc("ملغي", "Cancelled")}</Badge>
            ) : isDelivered ? (
              <Badge className="bg-green-500/20 text-green-400 border-0">{tc("تم التوصيل ✓", "Delivered ✓")}</Badge>
            ) : (
              <Badge className="bg-primary/20 text-primary border-0 animate-pulse">{tc("جاري التوصيل", "In Delivery")}</Badge>
            )}
          </div>
          <p className="text-gray-500 text-xs">{new Date(order.createdAt).toLocaleString("ar-SA")}</p>
        </div>

        {/* ── Progress Bar ── */}
        {!isCancelled && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="relative h-1.5 bg-gray-800 rounded-full mb-6 overflow-hidden">
              <div
                className="absolute top-0 right-0 h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="space-y-4">
              {STATUS_STEPS_DATA.map((step, idx) => {
                const Icon = step.icon;
                const done = idx <= currentIdx;
                const current = idx === currentIdx;
                if (idx > currentIdx + 1 && !isDelivered) return null;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done
                        ? current
                          ? "ring-2 ring-offset-2 ring-offset-gray-900"
                          : ""
                        : "bg-gray-800"
                    }`}
                      style={done ? { backgroundColor: step.color + "22" } : {}}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{ color: done ? step.color : "#4b5563" }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${done ? "text-white" : "text-gray-600"}`}>
                        {tc(step.labelAr, step.labelEn)}
                      </p>
                      {current && order.estimatedMinutes && (
                        <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {tc("وقت تقديري:", "Estimated:")} ~{order.estimatedMinutes} {tc("دقيقة", "min")}
                        </p>
                      )}
                    </div>
                    {done && !current && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {current && (
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: step.color }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Live Map ── */}
        {!isCancelled && showMap && (
          <LiveDeliveryMap key={`${order.driverLocation?.lat}-${order.driverLocation?.lng}`} order={order} />
        )}

        {/* ── Driver Info ── */}
        {order.driverName && !isCancelled && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-0.5">{tc("المندوب", "Driver")}</p>
                <p className="text-white font-bold">{order.driverName}</p>
              </div>
              {order.driverPhone && (
                <div className="flex gap-2">
                  <a
                    href={`tel:${order.driverPhone}`}
                    className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center"
                  >
                    <Phone className="w-4 h-4 text-green-400" />
                  </a>
                  <a
                    href={`https://wa.me/966${order.driverPhone.replace(/^0/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center"
                  >
                    <MessageCircle className="w-4 h-4 text-green-500" />
                  </a>
                </div>
              )}
            </div>
            {order.driverRating && (
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-800">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 text-sm font-bold">{order.driverRating}</span>
                <span className="text-gray-600 text-xs">{tc("تقييم المندوب", "Driver Rating")}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Delivery Address ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-400 text-xs mb-1">{tc("عنوان التوصيل", "Delivery Address")}</p>
              <p className="text-white text-sm">{order.customerAddress || tc("غير محدد", "Not specified")}</p>
              {order.deliveryFee > 0 && (
                <p className="text-primary text-xs mt-1">رسوم التوصيل: {order.deliveryFee?.toFixed(2)} <SarIcon size={10} className="inline" /></p>
              )}
            </div>
          </div>
        </div>

        {/* ── Order Items ── */}
        {order.items && order.items.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-xs mb-3 flex items-center gap-2">
              <Coffee className="w-4 h-4" />
              {tc("تفاصيل الطلب", "Order Details")}
            </p>
            <div className="space-y-2">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">{item.name}</span>
                  <span className="text-gray-500 text-sm">×{item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-gray-400 text-sm">{tc("المجموع", "Total")}</span>
              <span className="text-white font-bold">
                {order.totalAmount?.toFixed(2)} <SarIcon size={12} className="inline" />
              </span>
            </div>
          </div>
        )}

        {/* ── SUCCESS + RATING ── */}
        {isDelivered && !ratingDone && (
          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/30 border border-green-500/30 rounded-2xl p-5 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-1">{tc("تم التوصيل بنجاح!", "Delivered Successfully!")}</h3>
            <p className="text-gray-400 text-sm mb-5">{tc("شكراً لك على طلبك — نتمنى أن تنال إعجابك", "Thank you for your order — we hope you enjoy it")}</p>

            {!showRating ? (
              <Button
                onClick={() => setShowRating(true)}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold w-full h-12 rounded-xl"
              >
                <Star className="w-5 h-5 ml-1.5" />
                {tc("قيّم تجربة التوصيل", "Rate Delivery Experience")}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm">{tc("كيف كانت خدمة التوصيل؟", "How was the delivery service?")}</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star className={`w-9 h-9 ${r <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}`} />
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => { if (rating > 0) rateMutation.mutate(rating); }}
                  disabled={rating === 0 || rateMutation.isPending}
                  className="bg-primary hover:bg-primary/90 w-full h-11 rounded-xl"
                >
                  {rateMutation.isPending ? tc("جاري الإرسال...", "Sending...") : tc("إرسال التقييم", "Submit Rating")}
                </Button>
              </div>
            )}

            <Link href="/menu" className="block mt-3">
              <Button variant="ghost" className="text-gray-400 w-full">
                {tc("العودة للقائمة", "Back to Menu")}
              </Button>
            </Link>
          </div>
        )}

        {ratingDone && (
          <div className="text-center py-4 space-y-3">
            <div className="flex justify-center gap-1">
              {[1,2,3,4,5].map((r) => <Star key={r} className={`w-6 h-6 ${r <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-700"}`} />)}
            </div>
            <p className="text-gray-400 text-sm">{tc("شكراً على تقييمك!", "Thank you for your rating!")}</p>
            <Link href="/menu">
              <Button className="bg-primary hover:bg-primary/90 w-full h-11 rounded-xl">{tc("طلب جديد", "New Order")}</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
