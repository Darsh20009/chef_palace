
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coffee, MapPin, Truck, Check, Clock, Package, ExternalLink, Store, Navigation, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import LocationPreparationCheck from "@/components/location-preparation-check";
import type { Order } from "@shared/schema";
import { useTranslation } from 'react-i18next';
import SarIcon from "@/components/sar-icon";
import { fmtOrderNum } from "@/lib/print-utils";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`;
  return `+966${digits}`;
}

function openDirections(lat: number, lng: number) {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function CountdownTimer({ estimatedMinutes, startTime, t }: { estimatedMinutes: number, startTime: string | Date, t: any }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const calculateTime = () => {
      const start = new Date(startTime).getTime();
      const end = start + estimatedMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      const totalSeconds = estimatedMinutes * 60;
      const elapsed = (now - start) / 1000;
      
      setTimeLeft(remaining);
      setProgress(Math.max(0, Math.min(100, 100 - (elapsed / totalSeconds) * 100)));
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [estimatedMinutes, startTime]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="mt-6 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground">{t("tracking.prep_remaining")}</span>
        <span className="text-2xl font-bold text-primary font-mono" dir="ltr">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-center text-xs text-muted-foreground">
        {t("tracking.est_time", { minutes: estimatedMinutes })}
      </p>
    </div>
  );
}

export default function OrderTrackingPage() {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
 const [orderNumber, setOrderNumber] = useState("");
 const [trackingOrderNumber, setTrackingOrderNumber] = useState("");
 const previousStatusRef = useRef<string>("");
 const { toast } = useToast();
 
 useEffect(() => {
 const params = new URLSearchParams(window.location.search);
 const orderFromUrl = params.get('order');
 if (orderFromUrl) {
 setOrderNumber(orderFromUrl);
 setTrackingOrderNumber(orderFromUrl);
 }
 }, [location]);

 const { data: order, isLoading, refetch } = useQuery<Order>({
 queryKey: ["/api/orders/number", trackingOrderNumber],
 queryFn: async () => {
 if (!trackingOrderNumber) return null;
 const res = await fetch(`/api/orders/number/${trackingOrderNumber}`);
 if (!res.ok) throw new Error("Order not found");
 return res.json();
 },
 enabled: !!trackingOrderNumber,
 refetchInterval: 15000,
 });

 // WebSocket: instant order status updates without waiting for poll
 useEffect(() => {
   if (!trackingOrderNumber) return;
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const ws = new WebSocket(`${protocol}//${window.location.host}/ws/orders`);
   ws.onmessage = (e) => {
     try {
       const msg = JSON.parse(e.data);
       if (
         (msg.type === 'order_status_update' || msg.type === 'new_order' || msg.type === 'order_update') &&
         (msg.orderNumber === trackingOrderNumber || msg.data?.orderNumber === trackingOrderNumber || msg.order?.orderNumber === trackingOrderNumber)
       ) {
         refetch();
       }
     } catch {}
   };
   return () => { try { ws.close(); } catch {} };
 }, [trackingOrderNumber, refetch]);
 
 const { data: branch } = useQuery<any>({
 queryKey: ["/api/branches", order?.branchId],
 queryFn: async () => {
 if (!order?.branchId) return null;
 const res = await fetch(`/api/branches/${order.branchId}`);
 if (!res.ok) return null;
 return res.json();
 },
 enabled: !!order?.branchId,
 });

  useEffect(() => {
    if (order && order.status === 'ready' && previousStatusRef.current && previousStatusRef.current !== 'ready') {
      // Sound alerts disabled by user request
      toast({
        title: t("tracking.ready_toast_title"),
        description: t("tracking.ready_toast_desc"),
        className: "bg-green-600 text-white border-green-700",
        duration: 10000,
      });
    }
    
    if (order) {
      previousStatusRef.current = order.status;
    }
  }, [order, toast, t]);

  const handleTrack = () => {
    if (!orderNumber) return;
    setTrackingOrderNumber(orderNumber);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return <Clock className="w-8 h-8 text-orange-500" />;
      case 'pending':
      case 'payment_confirmed':
        return <Clock className="w-8 h-8 text-yellow-500" />;
      case 'in_progress':
        return <Package className="w-8 h-8 text-blue-500" />;
      case 'ready':
        return <Coffee className="w-8 h-8 text-green-500" />;
      case 'out_for_delivery':
        return <Truck className="w-8 h-8 text-purple-500" />;
      case 'completed':
        return <Check className="w-8 h-8 text-green-600" />;
      default:
        return <Clock className="w-8 h-8 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    return t(`status.${status}`) || status;
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-amiri text-4xl font-bold text-primary mb-2">
            {t("tracking.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("tracking.subtitle")}
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="order-number">{t("tracking.order_number")}</Label>
                <Input
                  id="order-number"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-..."
                  className={i18n.language === 'ar' ? "text-right" : "text-left"}
                  dir="ltr"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleTrack}
                  disabled={!orderNumber || isLoading}
                  className="bg-primary text-primary-foreground"
                >
                  {isLoading ? t("tracking.searching") : t("tracking.track_btn")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {order && (
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-10 duration-500">
            {/* Order Status */}
            <Card className="overflow-hidden border-2 border-primary/20">
              <CardHeader className="bg-primary/5 pb-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-background rounded-full shadow-lg border-2 border-primary/10">
                    {getStatusIcon(order.status)}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-primary">
                      {getStatusText(order.status)}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">{t("tracking.status_updated")}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">{t("tracking.order_number")}:</span>
                      <span className="font-bold text-primary" dir="ltr">{fmtOrderNum(order.orderNumber)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">{t("tracking.total_amount")}:</span>
                      <span className="font-bold">{order.totalAmount} <SarIcon /></span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">{t("tracking.drink_status")}:</span>
                      <Badge
                        variant={order.status === 'ready' || order.status === 'completed' ? 'default' : 'secondary'}
                        className={`text-sm px-3 py-1 ${order.status === 'out_for_delivery' ? 'bg-orange-500 text-white' : ''}`}
                      >
                        {order.status === 'ready' ? t("tracking.ready_badge")
                          : order.status === 'in_progress' ? t("tracking.preparing_badge")
                          : order.status === 'out_for_delivery' ? t("status.out_for_delivery")
                          : order.status === 'completed' ? t("status.completed")
                          : t("tracking.pending_badge")}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">{t("tracking.order_confirmed")}:</span>
                      <Badge variant="outline" className="text-sm px-3 py-1 border-green-500 text-green-600">
                        {t("tracking.confirmed_badge")} ✅
                      </Badge>
                    </div>
                  </div>
                </div>

                {['pending', 'payment_confirmed', 'confirmed', 'in_progress'].includes(order.status) && order.estimatedPrepTimeInMinutes && (
                  <CountdownTimer 
                    estimatedMinutes={order.estimatedPrepTimeInMinutes} 
                    startTime={(order as any).prepTimeSetAt || order.updatedAt || order.createdAt} 
                    t={t}
                  />
                )}
              </CardContent>
            </Card>

            {order.deliveryType && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("tracking.delivery_type")}:</span>
                    <span className="font-bold">
                      {order.deliveryType === 'delivery' ? t("tracking.delivery") : t("tracking.pickup")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {branch && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <Store className="w-5 h-5" />
                    <span>{t("tracking.branch_info")}</span>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("tracking.branch_name")}:</span>
                      <span className="font-bold">{i18n.language === 'ar' ? branch.nameAr : branch.nameEn || branch.nameAr}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("delivery.address")}:</span>
                      <span className="font-bold text-right">{branch.address}</span>
                    </div>
                    {branch.phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("delivery.phone")}:</span>
                        <a
                          href={`tel:${normalizePhone(branch.phone)}`}
                          className="font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                          dir="ltr"
                          data-testid="link-branch-phone-tracking"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {branch.phone}
                        </a>
                      </div>
                    )}

                    {/* Action buttons — directions + call + view map */}
                    <div className="flex gap-2 pt-1">
                      {(() => {
                        const loc = branch.location as any;
                        const lat = loc?.lat ?? loc?.latitude;
                        const lng = loc?.lng ?? loc?.longitude;
                        if (!lat || !lng) return null;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => openDirections(lat, lng)}
                            data-testid="button-navigate-branch-tracking"
                          >
                            <Navigation className="w-4 h-4 ml-1" />
                            {t("delivery.navigate") || "توجيه"}
                          </Button>
                        );
                      })()}
                      {branch.mapsUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(branch.mapsUrl, '_blank', 'noopener,noreferrer')}
                          data-testid="button-view-branch-location"
                        >
                          <MapPin className="w-4 h-4 ml-1" />
                          {t("tracking.view_map") || "الخريطة"}
                        </Button>
                      )}
                      {branch.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.location.href = `tel:${normalizePhone(branch.phone)}`}
                          data-testid="button-call-branch-tracking"
                        >
                          <Phone className="w-4 h-4 ml-1" />
                          {t("delivery.call") || "اتصال"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Location Preparation Check - Show when order is ready for pickup */}
            {branch && order.deliveryType === 'pickup' && ['in_progress', 'ready'].includes(order.status) && (
              <LocationPreparationCheck 
                branch={branch}
                preparationRadius={5}
                onPreparationReady={() => {
                  toast({
                    title: t("tracking.proximity_toast_title"),
                    description: t("tracking.proximity_toast_desc"),
                  });
                }}
              />
            )}

            {/* Live Driver Location (if applicable) */}
            {order.deliveryType === 'delivery' && order.status === 'out_for_delivery' && order.driverLocation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-primary" />
                    {t("tracking.driver_location")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">{t("tracking.map_placeholder")}</p>
                  </div>
                  {order.estimatedDeliveryTime && (
                    <p className="mt-4 text-center text-muted-foreground">
                      {t("tracking.est_arrival")} {new Date(order.estimatedDeliveryTime).toLocaleTimeString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>{t("tracking.order_details")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(order.items) && order.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span>{i18n.language === 'ar' ? item.nameAr || item.name : item.nameEn || item.name}</span>
                      <span className="text-muted-foreground">× {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
