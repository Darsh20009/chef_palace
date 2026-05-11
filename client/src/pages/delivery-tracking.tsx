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
  Truck, Coffee, ArrowRight, Home, RefreshCw
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
  { key: "pending", ar: "جاري التجهيز", en: "Preparing", icon: Package },
  { key: "assigned", ar: "تم تعيين المندوب", en: "Driver Assigned", icon: User },
  { key: "picked_up", ar: "تم الاستلام", en: "Picked Up", icon: Coffee },
  { key: "on_the_way", ar: "في الطريق", en: "On the Way", icon: Truck },
  { key: "delivered", ar: "تم التوصيل", en: "Delivered", icon: CheckCircle },
];

const getStatusIndex = (status: string): number => {
  const idx = STATUS_STEPS_AR.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
};

const getProgressPercent = (status: string): number => {
  const idx = getStatusIndex(status);
  return ((idx + 1) / STATUS_STEPS_AR.length) * 100;
};

export default function DeliveryTracking() {
  const [, params] = useRoute("/delivery/track/:orderId");
  const [, setLocation] = useLocation();
  const orderId = params?.orderId;
  const tc = useTranslate();

  useEffect(() => {
    document.title = tc("تتبع التوصيل - مكان الشيف البخاري", "Delivery Tracking - مكان الشيف البخاري");
  }, [tc]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/delivery/orders/by-order', orderId],
    enabled: !!orderId,
    refetchInterval: 30000,
  });

  const order = (data as any)?.order as DeliveryOrder | undefined;

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5" dir="rtl">
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
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {tc("طلب", "Order")} {order.orderNumber || orderId?.slice(-6)}
              </CardTitle>
              {isCancelled ? (
                <Badge variant="destructive">{tc("ملغي", "Cancelled")}</Badge>
              ) : isDelivered ? (
                <Badge className="bg-green-500 text-white">{tc("تم التوصيل", "Delivered")}</Badge>
              ) : (
                <Badge className="bg-primary text-primary-foreground">{tc("جاري التوصيل", "In Delivery")}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("ar-SA")}
            </div>
          </CardContent>
        </Card>

        {!isCancelled && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <Progress value={progressPercent} className="h-2" />
              </div>

              <div className="space-y-4">
                {STATUS_STEPS_AR.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? isCurrent
                            ? "bg-primary text-primary-foreground animate-pulse"
                            : "bg-green-500 text-white"
                          : "bg-muted"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isCurrent ? "text-primary" : ""}`}>
                          {tc(step.ar, step.en)}
                        </p>
                        {isCurrent && order.estimatedMinutes && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{order.estimatedMinutes} {tc("دقيقة متبقية", "minutes remaining")}
                          </p>
                        )}
                      </div>
                      {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {order.driverName && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                {tc("معلومات المندوب", "Driver Info")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{order.driverName}</span>
              </div>
              {order.driverPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${order.driverPhone}`} className="text-primary hover:underline">
                    {order.driverPhone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {tc("عنوان التوصيل", "Delivery Address")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{order.customerAddress}</p>
          </CardContent>
        </Card>

        {order.items && order.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Coffee className="w-5 h-5 text-primary" />
                {tc("تفاصيل الطلب", "Order Details")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>{tc("المجموع", "Total")}</span>
                  <span className="text-primary">{order.totalAmount?.toFixed(2)} <SarIcon /></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isDelivered && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-green-600 mb-2">{tc("تم التوصيل بنجاح!", "Delivered Successfully!")}</h3>
              <p className="text-muted-foreground mb-4">{tc("شكراً لطلبك من مكان الشيف البخاري", "Thank you for ordering from مكان الشيف البخاري")}</p>
              <Link href="/menu">
                <Button className="w-full">
                  {tc("طلب جديد", "New Order")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
