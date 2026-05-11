import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Coffee, Star, CheckCircle, Bell, BellRing, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import OrderTracker from "@/components/order-tracker";
import { ReceiptInvoice } from "@/components/receipt-invoice";
import { CarPickupForm } from "@/components/car-pickup-form";
import type { Order as OrderType } from "@shared/schema";
import { CustomerLayout } from "@/components/layouts/CustomerLayout";
import { useCustomer } from "@/contexts/CustomerContext";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SarIcon from "@/components/sar-icon";

interface OrderDisplay extends OrderType {
 items: any[];
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const tc = useTranslate();
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1 justify-center my-2">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => onChange(s)} className="transition-transform hover:scale-110" data-testid={`star-${s}`}>
          <Star className={`w-7 h-7 ${s <= (hover || value) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function MiniPushBanner({ customerId, t }: { customerId: string; t: any }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) setIsSubscribed(true);
    }).catch(() => {});
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !customerId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const res = await fetch('/api/push/vapid-key');
        const { publicKey } = await res.json();
        if (!publicKey) return;
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') return;
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      }
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userType: 'customer', userId: customerId }),
      });
      setIsSubscribed(true);
      setPermission('granted');
    } catch (err) {
      console.error('[Push]', err);
    } finally {
      setLoading(false);
    }
  }, [supported, customerId]);

  if (isSubscribed && permission === 'granted') {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
        <BellRing className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{tc('إشعارات الطلبات مفعّلة', 'Order notifications enabled')}</span>
      </div>
    );
  }

  if (permission === 'denied') return null;

  if (ios && !standalone) {
    return (
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{tc('أضف التطبيق لشاشتك الرئيسية لتلقي إشعارات الطلبات على الآيفون', 'Add app to Home Screen to receive order notifications on iPhone')}</span>
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between gap-3 mb-4 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <Bell className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs">{tc('فعّل الإشعارات ليصلك تنبيه عند تغيير حالة طلبك', 'Enable notifications to get alerts when your order status changes')}</span>
      </div>
      <Button size="sm" variant="outline" className="h-6 text-xs px-2 flex-shrink-0" onClick={subscribe} disabled={loading} data-testid="button-enable-push-orders">
        {loading ? '...' : tc('تفعيل', 'Enable')}
      </Button>
    </div>
  );
}

export default function MyOrders() {
 const [, setLocation] = useLocation();
 const { customer } = useCustomer();
 const { t } = useTranslation();
 const { toast } = useToast();
 const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
 const [activeReview, setActiveReview] = useState<string | null>(null);
 const [reviewRating, setReviewRating] = useState(5);
 const [reviewComment, setReviewComment] = useState('');

 const reviewMutation = useMutation({
   mutationFn: ({ orderId, rating, comment }: { orderId: string; rating: number; comment: string }) =>
     apiRequest('POST', '/api/reviews/order/' + orderId, {
       rating,
       comment,
       customerName: (customer as any)?.name || tc('عميل', 'Customer'),
       customerId: (customer as any)?.id,
       customerPhone: (customer as any)?.phone,
     }),
   onSuccess: (_: any, vars: any) => {
     setReviewedOrders(prev => new Set([...prev, vars.orderId]));
     setActiveReview(null);
     setReviewRating(5);
     setReviewComment('');
     toast({ title: tc('شكراً على تقييمك!', 'Thank you for your rating!') });
   },
   onError: (err: any) => {
     if (String(err?.message || '').includes(tc('مسبقاً', 'already'))) {
       toast({ title: tc('لقد قيّمت هذا الطلب مسبقاً', 'You have already rated this order') });
       setActiveReview(null);
     } else {
       toast({ title: tc('فشل إرسال التقييم', 'Failed to submit rating'), variant: 'destructive' });
     }
   }
 });

 // Set SEO metadata
 useEffect(() => {
   document.title = t("orders.page_title");
   const metaDesc = document.querySelector('meta[name="description"]');
   if (metaDesc) metaDesc.setAttribute('content', t("orders.meta_description"));
 }, [t]);

  const customerPhone = customer?.phone || (customer as any)?.phoneNumber || (customer as any)?.phoneNumberAr;
  const customerId = customer?.id;
  const isAuthenticated = !!customer && (!!customerPhone || !!customerId);
  
  useEffect(() => {
    console.log("[MyOrders] Customer:", customer);
    console.log("[MyOrders] Phone:", customerPhone, "ID:", customerId);
  }, [customer, customerPhone, customerId]);
  
  const { data: orders = [], isLoading, refetch } = useQuery<OrderDisplay[]>({
    queryKey: ["/api/orders/customer", customerPhone || customerId],
    enabled: !!(customerPhone || customerId),
    refetchInterval: 15000,
    queryFn: async () => {
      const identifier = customerPhone || customerId;
      if (!identifier) return [];
      console.log("[MyOrders] Fetching orders for:", identifier);
      const res = await fetch(`/api/orders/customer/${identifier}`);
      if (!res.ok) {
        console.error("[MyOrders] Failed to fetch orders:", res.statusText);
        return [];
      }
      const data = await res.json();
      console.log("[MyOrders] Fetched orders:", data?.length || 0);
      return data;
    }
  });

  // Combine server orders with local orders (for offline support)
  const allOrders = useMemo(() => {
    const localOrders = customerStorage.getOrders();
    const combined = [...orders];
    
    // Add local orders that aren't in server orders (avoid duplicates)
    localOrders.forEach(local => {
      if (!combined.find(s => s.orderNumber === local.orderNumber)) {
        combined.push(local as unknown as OrderDisplay);
      }
    });
    
    // Sort by date descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return combined;
  }, [orders]);

  return (
    <CustomerLayout showNav={true} showHeader={false}>
      <div className="min-h-screen bg-background overflow-hidden relative" data-testid="page-my-orders">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-32 h-32 bg-accent/15 rounded-full blur-2xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute top-1/2 left-10 w-28 h-28 bg-primary/10 rounded-full blur-xl animate-pulse" style={{animationDelay: '3s'}}></div>
        </div>

        <div className="max-w-4xl mx-auto p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <Button
              variant="ghost"
              onClick={() => setLocation("/menu")}
              className="text-accent hover:text-accent hover:bg-primary/50 backdrop-blur-sm"
              data-testid="button-back"
            >
              <ArrowRight className="ml-2 h-5 w-5" />
              {t("orders.back_to_menu")}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-amiri font-bold text-foreground mb-2">
              {t("orders.title")}
            </h1>
            <p className="text-accent font-cairo">
              {t("orders.subtitle")}
            </p>
          </motion.div>

          {customerId && <MiniPushBanner customerId={customerId} t={t} />}

          {!isAuthenticated ? (
            <Card className="p-8 bg-card backdrop-blur-lg shadow-2xl border-2 border-primary/50 text-center">
              <Coffee className="h-16 w-16 text-accent mx-auto mb-4" />
              <h2 className="text-2xl font-amiri font-bold text-accent mb-3">
                {t("orders.no_orders")}
              </h2>
              <p className="text-accent font-cairo mb-6">
                {t("orders.login_to_view")}
              </p>
              <Button
                onClick={() => setLocation("/menu")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-cairo"
              >
                {t("orders.browse_menu")}
              </Button>
            </Card>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex space-x-2 space-x-reverse">
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          ) : allOrders.length === 0 ? (
            <Card className="p-8 bg-card backdrop-blur-lg shadow-2xl border-2 border-primary/50 text-center">
              <Coffee className="h-16 w-16 text-accent mx-auto mb-4" />
              <h2 className="text-2xl font-amiri font-bold text-accent mb-3">
                {t("orders.no_orders")}
              </h2>
              <p className="text-accent font-cairo mb-6">
                {t("orders.start_first_order")}
              </p>
              <Button
                onClick={() => setLocation("/menu")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-cairo"
              >
                {t("orders.browse_menu")}
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {allOrders.map((order: OrderDisplay, index: number) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="space-y-4">
                    <Card className="p-6 bg-card backdrop-blur-lg shadow-lg border-2 border-primary/50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Coffee className="h-5 w-5 text-accent" />
                            <h3 className="text-lg font-cairo font-bold text-accent">
                              {t("orders.order_number")} {order.orderNumber}
                            </h3>
                          </div>
                          <p className="text-sm text-accent font-cairo">
                            {new Date(order.createdAt).toLocaleDateString('ar-SA', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-left">
                          <span className="text-2xl font-bold text-accent font-cairo">
                            {Number(order.totalAmount).toFixed(2)} <SarIcon />
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {Array.isArray(order.items) ? order.items.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm bg-background p-2 rounded-lg">
                            <span className="text-accent font-cairo">
                              {item.nameAr || item.name} × {item.quantity}
                            </span>
                            <span className="text-accent font-bold">
                              {(parseFloat(item.price || "0") * (item.quantity || 1)).toFixed(2)} <SarIcon />
                            </span>
                          </div>
                        )) : null}
                      </div>
                    </Card>

                    <OrderTracker order={order} />

                    {order.status === 'ready' && (order.deliveryType === 'curbside' || order.deliveryType === 'car_pickup' || order.deliveryType === 'car-pickup' || order.carPickup) && (
                      <CarPickupForm order={order} customer={customer} />
                    )}

                    {(order.status === 'ready' || order.status === 'completed') && (
                      <ReceiptInvoice order={order} />
                    )}

                    {order.status === 'completed' && !reviewedOrders.has(order.id) && activeReview !== order.id && (
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setActiveReview(order.id); setReviewRating(5); setReviewComment(''); }}
                          className="border-primary/50 text-primary hover:bg-primary/10 font-cairo"
                          data-testid={'btn-rate-order-' + order.id}
                        >
                          <Star className="w-4 h-4 ml-2 text-amber-400" />
                          قيّم طلبك
                        </Button>
                      </div>
                    )}

                    {order.status === 'completed' && reviewedOrders.has(order.id) && (
                      <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-lg p-2">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-cairo">{tc("شكراً على تقييمك!", "Thank you for your rating!")}</span>
                      </div>
                    )}

                    {activeReview === order.id && (
                      <Card className="p-4 bg-card border-border">
                        <p className="text-center text-accent font-cairo font-semibold mb-2">{tc("كيف كانت تجربتك؟", "How was your experience?")}</p>
                        <StarRatingInput value={reviewRating} onChange={setReviewRating} />
                        <textarea
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          placeholder={tc("أضف تعليقك (اختياري)...", "Add your comment (optional)...")}
                          className="w-full mt-2 p-2 rounded-lg border border-border bg-background text-sm font-cairo resize-none focus:outline-none focus:border-primary"
                          rows={3}
                          data-testid={'textarea-review-' + order.id}
                        />
                        <div className="flex gap-2 mt-3">
                          <Button
                            onClick={() => reviewMutation.mutate({ orderId: order.id, rating: reviewRating, comment: reviewComment })}
                            disabled={reviewMutation.isPending}
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-cairo"
                            data-testid={'btn-submit-review-' + order.id}
                          >
                            {reviewMutation.isPending ? '...' : tc('إرسال التقييم', 'Submit Rating')}
                          </Button>
                          <Button variant="outline" onClick={() => setActiveReview(null)} className="border-border text-muted-foreground font-cairo">
                            إلغاء
                          </Button>
                        </div>
                      </Card>
                    )}

                    {order.customerNotes && (
                      <div className="bg-primary/20 rounded-lg p-3 mb-4 border border-primary/20">
                        <p className="text-accent text-sm font-semibold mb-1">{t("orders.customer_notes")}</p>
                        <p className="text-white text-sm" data-testid={`text-customer-notes-${order.id}`}>
                          {order.customerNotes}
                        </p>
                      </div>
                    )}

                    {order.status === 'cancelled' && (order as any).cancellationReason && (
                      <div className="bg-red-900/20 rounded-lg p-3 mb-4 border border-red-500/20">
                        <p className="text-red-400 text-sm font-semibold mb-1">{t("orders.cancellation_reason")}</p>
                        <p className="text-white text-sm">
                          {(order as any).cancellationReason}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}