import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Gift,
  Bell,
  BellOff,
  BellRing,
  Zap,
  MessageCircle,
  Trash2,
  CheckCircle2,
  Smartphone,
  Share,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";
import { useCustomer } from "@/contexts/CustomerContext";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (window.navigator as any).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function PushPromptBanner({ customerId, tc, dir }: { customerId: string; tc: any; dir: string }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const ios = isIOS();
  const standalone = isInStandaloneMode();
  const supported = isPushSupported();

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) setIsSubscribed(true);
      } catch {}
    })();
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
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userType: 'customer',
          userId: customerId,
        }),
      });
      setIsSubscribed(true);
      setPermission('granted');
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [supported, customerId]);

  if (isSubscribed && permission === 'granted') {
    return (
      <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4" dir={dir}>
        <BellRing className="w-5 h-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700 dark:text-green-400">{tc("الإشعارات الفورية مفعّلة ✓", "Push notifications enabled ✓")}</p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4" dir={dir}>
        <BellOff className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{tc("الإشعارات محجوبة", "Notifications blocked")}</p>
          <p className="text-xs text-red-500 mt-0.5">{tc("افتح إعدادات المتصفح وسمح بالإشعارات من هذا الموقع", "Open browser settings and allow notifications for this site")}</p>
        </div>
      </div>
    );
  }

  if (ios && !standalone) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4" dir={dir}>
        <div className="flex items-center gap-3 mb-2">
          <Smartphone className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{tc("تفعيل الإشعارات على الآيفون", "Enable Notifications on iPhone")}</p>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
          {tc(
            "لتلقّي إشعارات الطلبات على الآيفون، أضف التطبيق لشاشتك الرئيسية:",
            "To receive order notifications on iPhone, add the app to your Home Screen:"
          )}
        </p>
        <button
          onClick={() => setShowIOSGuide(!showIOSGuide)}
          className="text-xs text-amber-800 dark:text-amber-300 underline font-medium"
          data-testid="button-ios-guide"
        >
          {showIOSGuide ? tc("إخفاء الخطوات", "Hide steps") : tc("اعرض الخطوات", "Show steps")}
        </button>
        {showIOSGuide && (
          <ol className="mt-3 space-y-2 text-xs text-amber-700 dark:text-amber-400 list-decimal list-inside">
            <li className="flex items-start gap-2">
              <Share className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{tc("اضغط زر المشاركة ☐ في سفارة المتصفح", "Tap the Share button ☐ at the bottom of Safari")}</span>
            </li>
            <li>{tc('اختر "إضافة إلى الشاشة الرئيسية"', 'Select "Add to Home Screen"')}</li>
            <li>{tc("اضغط إضافة ثم افتح التطبيق من الشاشة الرئيسية", "Tap Add, then open the app from the Home Screen")}</li>
            <li>{tc("ارجع لهذه الصفحة وفعّل الإشعارات", "Return to this page and enable notifications")}</li>
          </ol>
        )}
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">{tc("فعّل إشعارات الطلبات", "Enable Order Notifications")}</p>
            <p className="text-xs text-muted-foreground">{tc("احصل على تنبيه فوري عند تغيير حالة طلبك", "Get instant alerts when your order status changes")}</p>
          </div>
        </div>
        <Button size="sm" onClick={subscribe} disabled={loading} data-testid="button-enable-push" className="flex-shrink-0">
          {loading ? tc("جاري...", "...") : tc("تفعيل", "Enable")}
        </Button>
      </div>
    </div>
  );
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "order_update": return <Package className="w-5 h-5" />;
    case "referral": return <Gift className="w-5 h-5" />;
    case "loyalty": return <Zap className="w-5 h-5" />;
    case "promotion": return <MessageCircle className="w-5 h-5" />;
    default: return <Bell className="w-5 h-5" />;
  }
};

export default function NotificationsPage() {
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const { customer } = useCustomer();
  const dir = i18n.language === 'en' ? 'ltr' : 'rtl';
  const customerId = (customer as any)?.id || '';

  const getNotificationLabel = (type: string) => {
    switch (type) {
      case "order_update": return tc("تحديث الطلب", "Order Update");
      case "referral": return tc("الإحالات", "Referrals");
      case "loyalty": return tc("برنامج الولاء", "Loyalty Program");
      case "promotion": return tc("عروض ترويجية", "Promotions");
      default: return tc("نظام", "System");
    }
  };

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json();
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("PATCH", `/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/notifications/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/notifications/mark-all-read", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  if (isLoading) {
    return <div className="p-4">{tc("جاري التحميل...", "Loading...")}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" dir={dir}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{tc("الإشعارات", "Notifications")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount} {tc("إشعارات جديدة", "new notifications")}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={() => markAllAsReadMutation.mutate()}
            variant="outline"
            size="sm"
            data-testid="button-mark-all-read"
          >
            <CheckCircle2 className="w-4 h-4 ml-2" />
            {tc("وضع علامة على الكل كمقروء", "Mark All as Read")}
          </Button>
        )}
      </div>

      {customerId && <PushPromptBanner customerId={customerId} tc={tc} dir={dir} />}

      {notifications && notifications.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{tc("لا توجد إشعارات حالياً", "No notifications yet")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications?.map((notification: any) => (
            <Card
              key={notification.id}
              className={`p-4 transition-colors ${
                !notification.isRead
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  : ""
              }`}
              data-testid={`card-notification-${notification.id}`}
            >
              <div className="flex gap-4 items-start">
                <div className="text-blue-500 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div>
                      <h3 className="font-semibold">{notification.title}</h3>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full inline-block mt-1">
                        {getNotificationLabel(notification.type)}
                      </span>
                    </div>
                    {!notification.isRead && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-foreground my-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleDateString(
                      i18n.language === 'en' ? 'en-US' : "ar-SA",
                      { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!notification.isRead && (
                    <Button
                      onClick={() => markAsReadMutation.mutate(notification.id)}
                      size="sm"
                      variant="ghost"
                      data-testid={`button-mark-read-${notification.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => deleteMutation.mutate(notification.id)}
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    data-testid={`button-delete-${notification.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
