import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState, EmptyState } from "@/components/ui/states";
import SarIcon from "@/components/sar-icon";
import {
  Package, MapPin, Clock, Phone, User, CheckCircle,
  Truck, Coffee, ArrowRight, Home, RefreshCw,
  Navigation, MessageCircle, Timer, Wifi, Star
} from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

interface DeliveryOrder {
  _id: string;
  id?: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocation?: { lat: number; lng: number };
  driverName?: string;
  driverPhone?: string;
  driverLocation?: { lat: number; lng: number };
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

const STATUS_STEPS_AR = [
  { key: "pending",    ar: "جاري التجهيز",      en: "Preparing",       icon: Package,      color: "bg-yellow-500" },
  { key: "assigned",   ar: "تم تعيين المندوب",  en: "Driver Assigned", icon: User,         color: "bg-blue-500" },
  { key: "picking_up", ar: "المندوب في الطريق", en: "Picking Up",      icon: Truck,        color: "bg-purple-500" },
  { key: "on_the_way", ar: "في الطريق إليك",   en: "On the Way",      icon: Navigation,   color: "bg-orange-500" },
  { key: "delivered",  ar: "تم التوصيل",        en: "Delivered",       icon: CheckCircle,  color: "bg-green-500" },
];

const getStatusIndex = (status: string): number => {
  const idx = STATUS_STEPS_AR.findIndex(s => s.key === status);
  if (idx >= 0) return idx;
  if (status === "accepted") return 1;
  return 0;
};

const getProgressPercent = (status: string): number => {
  if (status === "delivered") return 100;
  if (status === "cancelled") return 0;
  const idx = getStatusIndex(status);
  return Math.round(((idx + 0.5) / STATUS_STEPS_AR.length) * 100);
};

const STATUS_MESSAGES: Record<string, string> = {
  pending:    "طلبك قيد التحضير في المطبخ 👨‍🍳",
  assigned:   "تم تعيين مندوب لطلبك ✅",
  accepted:   "المندوب قبل طلبك وهو في الطريق 🚗",
  picking_up: "المندوب على طريقه لاستلام طلبك 🛵",
  on_the_way: "طلبك في الطريق إليك الآن! 🚀",
  delivered:  "تم توصيل طلبك بنجاح 🎉",
  cancelled:  "تم إلغاء الطلب",
};

export default function DeliveryTracking() {
  const [, params] = useRoute("/delivery/track/:orderId");
  const [, setLocation] = useLocation();
  const orderId = params?.orderId;
  const tc = useTranslate();
  const [countdown, setCountdown] = useState(15);
  const [etaCountdown, setEtaCountdown] = useState<number | null>(null);

  useEffect(() => {
    document.title = tc("تتبع الطلب - مكان الشيف البخاري", "Track Order - مكان الشيف البخاري");
  }, [tc]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/delivery/orders/by-order', orderId],
    enabled: !!orderId,
    refetchInterval: 15000,
  });

  const order = (data as any)?.order as DeliveryOrder | undefined;

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refetch();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    if (order?.estimatedMinutes && order.estimatedMinutes > 0) {
      setEtaCountdown(order.estimatedMinutes * 60);
    }
  }, [order?.estimatedMinutes]);

  useEffect(() => {
    if (etaCountdown === null || etaCountdown <= 0) return;
    const t = setInterval(() => setEtaCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearInterval(t);
  }, [etaCountdown !== null]);

  const formatEta = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m <= 0) return `${s}ث`;
    return `${m}د ${s}ث`;
  };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>{tc("تتبع التوصيل", "Delivery Tracking")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{tc("يرجى إدخال رقم الطلب للتتبع", "Please enter an order number to track")}</p>
            <Link href="/menu">
              <Button className="w-full">
                <ArrowRight className="w-4 h-4 ml-2" />
                {tc("العودة للقائمة", "Back to Menu")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4" dir="rtl">
        <LoadingState />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>{tc("لم يتم العثور على الطلب", "Order Not Found")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{tc("تأكد من رقم الطلب وحاول مرة أخرى", "Check the order number and try again")}</p>
            <Link href="/menu">
              <Button className="w-full">
                <Home className="w-4 h-4 ml-2" />
                {tc("العودة للقائمة", "Back to Menu")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepIndex = getStatusIndex(order.status);
  const progressPercent = getProgressPercent(order.status);
  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";
  const isActive = !isDelivered && !isCancelled;
  const currentStep = STATUS_STEPS_AR[currentStepIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/menu">
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4 ml-2" />
                {tc("العودة", "Back")}
              </Button>
            </Link>
            <h1 className="font-bold text-foreground">{tc("تتبع الطلب", "Track Order")}</h1>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Wifi className="w-3 h-3 text-green-500" />
                {countdown}ث
              </span>
              <Button variant="ghost" size="icon" onClick={() => { refetch(); setCountdown(15); }} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Order summary card */}
        <Card className={`border-2 ${
          isDelivered ? "border-green-300 bg-green-50/50"
          : isCancelled ? "border-red-200"
          : "border-primary/30 bg-primary/5"
        }`}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-muted-foreground">رقم الطلب</p>
                <h2 className="font-bold text-lg">#{order.orderNumber || orderId?.slice(-6)}</h2>
              </div>
              {isCancelled ? (
                <Badge variant="destructive" className="text-sm px-3 py-1">{tc("ملغي", "Cancelled")}</Badge>
              ) : isDelivered ? (
                <Badge className="bg-green-500 text-white text-sm px-3 py-1">{tc("تم التوصيل ✓", "Delivered ✓")}</Badge>
              ) : (
                <Badge className={`${currentStep?.color || "bg-primary"} text-white text-sm px-3 py-1 animate-pulse`}>
                  جارٍ...
                </Badge>
              )}
            </div>

            {/* Status message */}
            {isActive && (
              <div className="mt-2 p-3 bg-white rounded-xl border border-primary/20">
                <p className="text-sm font-medium text-center text-gray-800">
                  {STATUS_MESSAGES[order.status] || "جارٍ معالجة طلبك..."}
                </p>
                {etaCountdown !== null && etaCountdown > 0 && order.status === "on_the_way" && (
                  <p className="text-center mt-2 text-2xl font-black text-primary">
                    {formatEta(etaCountdown)}
                    <span className="text-xs font-normal text-gray-400 mr-1"> متبقي</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress tracker */}
        {!isCancelled && (
          <Card>
            <CardContent className="pt-5">
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>التجهيز</span>
                  <span>التوصيل</span>
                </div>
                <Progress value={progressPercent} className="h-2.5" />
                <p className="text-center text-xs text-muted-foreground mt-1">{Math.round(progressPercent)}%</p>
              </div>

              <div className="space-y-3">
                {STATUS_STEPS_AR.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex && isActive;
                  const isPending = idx > currentStepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 transition-all ${
                        isPending ? "opacity-40" : ""
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isDone
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? `${step.color} text-white shadow-md`
                            : "bg-gray-100 text-gray-400"
                      } ${isCurrent ? "scale-110" : ""}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${isCurrent ? "text-gray-900" : isDone ? "text-gray-600" : "text-gray-400"}`}>
                          {tc(step.ar, step.en)}
                        </p>
                        {isCurrent && order.estimatedMinutes && order.estimatedMinutes > 0 && (
                          <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                            <Timer className="w-3 h-3" />
                            الوقت المتوقع: ~{order.estimatedMinutes} دقيقة
                          </p>
                        )}
                      </div>
                      {isDone && (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      )}
                      {isCurrent && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver card */}
        {order.driverName && (
          <Card className="border-[#2D9B6E]/30 bg-[#2D9B6E]/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#2D9B6E] text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {order.driverName[0]}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{order.driverName}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    مندوب التوصيل
                  </p>
                </div>
                {order.driverPhone && (
                  <div className="flex flex-col gap-2">
                    <a
                      href={`tel:${order.driverPhone}`}
                      className="flex items-center gap-1.5 bg-[#2D9B6E] text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#258a5e] transition-colors"
                      data-testid="button-call-driver"
                    >
                      <Phone className="w-4 h-4" />
                      اتصال
                    </a>
                    <a
                      href={`https://wa.me/${order.driverPhone.replace(/\D/g, "")}?text=${encodeURIComponent("مرحباً، أنا العميل. كم الوقت المتبقي لوصول طلبي؟")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-green-200 transition-colors"
                      data-testid="button-whatsapp-driver"
                    >
                      <MessageCircle className="w-4 h-4" />
                      واتساب
                    </a>
                  </div>
                )}
              </div>

              {/* Driver location link */}
              {order.driverLocation && (
                <a
                  href={`https://www.google.com/maps?q=${order.driverLocation.lat},${order.driverLocation.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-3 p-2 bg-white rounded-lg border border-[#2D9B6E]/20 text-sm text-[#2D9B6E] font-medium hover:bg-[#2D9B6E]/10"
                  data-testid="button-driver-location"
                >
                  <Navigation className="w-4 h-4" />
                  عرض موقع السائق على الخريطة
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {tc("عنوان التوصيل", "Delivery Address")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{order.customerAddress}</p>
            {order.customerLocation && (
              <a
                href={`https://www.google.com/maps?q=${order.customerLocation.lat},${order.customerLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 mt-2 hover:underline"
              >
                <Navigation className="w-3 h-3" />
                عرض على الخريطة
              </a>
            )}
          </CardContent>
        </Card>

        {/* Order items */}
        {order.items && order.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Coffee className="w-4 h-4 text-primary" />
                {tc("تفاصيل الطلب", "Order Details")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-bold text-primary">×{item.quantity}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span className="text-gray-900">{tc("المجموع", "Total")}</span>
                  <span className="text-primary">{order.totalAmount?.toFixed(2)} <SarIcon /></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivered success */}
        {isDelivered && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-2xl font-black text-green-600 mb-2">{tc("تم التوصيل بنجاح!", "Delivered Successfully!")}</h3>
              <p className="text-gray-600 mb-2">
                {order.deliveredAt
                  ? `في ${new Date(order.deliveredAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`
                  : "شكراً لثقتك بنا"}
              </p>
              <div className="flex items-center justify-center gap-1 mb-4">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-gray-500 mb-4">نتمنى أن يعجبك طلبك 🎉</p>
              <Link href="/menu">
                <Button className="w-full bg-[#2D9B6E] hover:bg-[#258a5e]">
                  {tc("طلب مرة أخرى", "Order Again")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Cancelled */}
        {isCancelled && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600 mb-4">نأسف لهذا، يرجى التواصل معنا لأي استفسار</p>
              <Link href="/menu">
                <Button variant="outline" className="w-full">
                  <Home className="w-4 h-4 ml-2" />
                  العودة للقائمة
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
