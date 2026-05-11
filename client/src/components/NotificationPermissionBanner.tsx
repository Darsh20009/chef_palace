import { useState, useEffect } from "react";
import { Bell, Loader2, Share2, PlusSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import chefsplaceLogo from "@assets/blackrose-logo.png";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

interface NotificationPermissionBannerProps {
  onRequestPermission: () => Promise<NotificationPermission | void>;
  onDismiss?: () => void;
}

export function NotificationPermissionBanner({
  onRequestPermission,
}: NotificationPermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const iosDevice = isIOS();
    const standaloneMode = isStandalone();
    setIos(iosDevice);
    setStandalone(standaloneMode);

    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") {
      setDenied(true);
      return;
    }

    // iOS non-standalone: show iOS guide instead of useless permission prompt
    if (iosDevice && !standaloneMode) {
      const dismissed = localStorage.getItem('ios-install-guide-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed) < 3 * 24 * 60 * 60 * 1000) return;
      const timer = setTimeout(() => setShowIOSGuide(true), 2000);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") setVisible(false);
    if (Notification.permission === "denied") {
      setDenied(true);
      setVisible(false);
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await onRequestPermission();
      if (result === "granted") {
        setVisible(false);
      } else if (result === "denied") {
        setDenied(true);
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleIOSGuideDismiss = () => {
    setShowIOSGuide(false);
    localStorage.setItem('ios-install-guide-dismissed', String(Date.now()));
  };

  // iOS non-standalone guide
  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-8 duration-500 pb-safe">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="px-6 pt-3 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <img src={chefsplaceLogo} alt="مكان الشيف" className="w-14 h-14 rounded-2xl shadow-md" />
              <div>
                <h2 className="text-lg font-black text-gray-900">فعّل الإشعارات</h2>
                <p className="text-xs text-gray-500 mt-0.5">أضف التطبيق لشاشتك الرئيسية أولاً</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
              <p className="text-xs text-amber-700 leading-relaxed text-center font-medium">
                ⚠️ إشعارات iPhone تعمل فقط عند تثبيت التطبيق على الشاشة الرئيسية
              </p>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { step: "1", title: 'اضغط على أيقونة "مشاركة"', sub: 'في أسفل Safari', icon: Share2 },
                { step: "2", title: '"أضف إلى الشاشة الرئيسية"', sub: "مرّر القائمة واختر هذا الخيار", icon: PlusSquare },
                { step: "3", title: "افتح التطبيق من الشاشة الرئيسية", sub: "ثم فعّل الإشعارات تلقائياً", icon: Smartphone },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                      <item.icon className="w-3.5 h-3.5 text-primary" />
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleIOSGuideDismiss}
              className="w-full rounded-2xl h-12 font-bold text-sm"
            >
              فهمت، شكراً
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="تفعيل الإشعارات"
    >
      <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-500 pb-safe">
        <div className="bg-[#111827] rounded-t-3xl shadow-2xl border-t border-white/10 px-6 pt-5 pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <img
                src={chefsplaceLogo}
                alt="مكان الشيف"
                className="w-20 h-20 rounded-3xl shadow-xl border border-white/10"
              />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-[#111827]">
                <Bell className="w-4 h-4 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-black text-white mt-1">فعّل الإشعارات</h2>
            <p className="text-sm text-white/60 mt-1 leading-relaxed max-w-xs">
              لاستقبال إشعارات الطلبات الجديدة فوراً
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {[
              { emoji: "🔔", text: "طلب جديد — إشعار فوري لك" },
              { emoji: "☕", text: "تحديثات الطلبات بدون انتظار" },
              { emoji: "⚡", text: "تنبيه مباشر حتى عند إغلاق التطبيق" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3"
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="text-sm text-white/80 font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={handleEnable}
            disabled={loading}
            className="w-full h-14 rounded-2xl text-base font-black bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 gap-2"
            data-testid="button-notif-enable"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التفعيل...
              </>
            ) : (
              <>
                <Bell className="w-5 h-5" />
                تفعيل الإشعارات الآن
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-white/30 mt-3">
            يمكنك تغيير الإعدادات لاحقاً من إعدادات جهازك
          </p>
        </div>
      </div>
    </div>
  );
}
