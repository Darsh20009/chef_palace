import { useState, useEffect } from "react";
import { Bell, Download, Smartphone, Share2, PlusSquare, X, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import qiroxLogo from "@assets/qirox-logo-customer.png";
import { brand } from "@/lib/brand";
import { useTranslate } from "@/lib/useTranslate";
import { subscribeToPush } from "@/lib/push-utils";

const NOTIF_DISMISSED_KEY = "qirox_notif_prompted";
const INSTALL_DISMISSED_KEY = "qirox_install_prompted";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

function isEmployeePage() {
  const path = window.location.pathname;
  return path.startsWith('/employee') || path.startsWith('/manager') ||
    path.startsWith('/admin') || path.startsWith('/qirox') ||
    path === '/0' || path.startsWith('/owner') || path.startsWith('/executive');
}

function isiOSVersionSupported() {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  if (!match) return false;
  return parseInt(match[1]) >= 16;
}

export function GlobalPrompts() {
  const tc = useTranslate();
  const [showNotif, setShowNotif] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showIOSNotifBlocked, setShowIOSNotifBlocked] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (isEmployeePage()) return;
    if (typeof window === "undefined") return;

    // Delay longer — give user time to settle
    const notifTimer = setTimeout(() => {
      if (isIOS() && !isStandalone()) {
        const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
        setShowIOSGuide(true);
        return;
      }

      if (!("Notification" in window)) return;
      if (Notification.permission !== "default") return;
      const dismissed = sessionStorage.getItem(NOTIF_DISMISSED_KEY);
      if (dismissed) return;
      setShowNotif(true);
    }, 5000); // increased from 2500ms to 5000ms

    return () => clearTimeout(notifTimer);
  }, []);

  useEffect(() => {
    if (isEmployeePage()) return;
    if (isStandalone() || isIOS()) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installTimer = setTimeout(() => {
      if (isStandalone()) return;
      const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (dismissed) {
        const dismissedAt = parseInt(dismissed);
        if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
      }
      if (Notification.permission !== "default") {
        setShowInstall(true);
      }
    }, 8000); // delayed further

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(installTimer);
    };
  }, []);

  useEffect(() => {
    if (isIOS() || isEmployeePage()) return;
    if (!showNotif && ("Notification" in window) && Notification.permission !== "default" && !showInstall && !isStandalone()) {
      const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => setShowInstall(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [showNotif]);

  function getCustomerUserId(): string {
    try {
      const stored = localStorage.getItem("qahwa-customer") || localStorage.getItem("currentCustomer");
      if (stored) {
        const cust = JSON.parse(stored);
        if (cust?.id || cust?._id) return cust.id || cust._id;
        if (cust?.phone) return `phone:${cust.phone}`;
      }
    } catch {}
    return "visitor";
  }

  const dismissNotif = (save = true) => {
    setIsLeaving(true);
    setTimeout(() => {
      setShowNotif(false);
      setIsLeaving(false);
      if (save) sessionStorage.setItem(NOTIF_DISMISSED_KEY, "1");
    }, 300);
  };

  const handleNotifEnable = async () => {
    setNotifLoading(true);
    try {
      if (isIOS() && !isStandalone()) {
        dismissNotif(false);
        setShowIOSGuide(true);
        return;
      }

      const result = await Notification.requestPermission();
      if (result === "granted") {
        try {
          const userId = getCustomerUserId();
          await subscribeToPush({ userType: "customer", userId });
        } catch (e: any) {
          console.warn("[Push] Subscribe error:", e);
          if (isIOS() && isStandalone()) setShowIOSNotifBlocked(true);
        }
      }
      dismissNotif();
    } finally {
      setNotifLoading(false);
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowInstall(false);
      setDeferredPrompt(null);
    } else if (isIOS()) {
      setShowIOSGuide(true);
    }
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  };

  const handleInstallDismiss = () => {
    setShowInstall(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  };

  const handleIOSGuideDismiss = () => {
    setShowIOSGuide(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  };

  if (isEmployeePage()) return null;

  return (
    <>
      {/* ── Compact notification toast — slides in from bottom-left ── */}
      {showNotif && (
        <div
          dir="rtl"
          className={`fixed bottom-5 right-4 left-4 md:left-auto md:right-5 md:w-[340px] z-[200]
            transition-all duration-300 ease-out
            ${isLeaving
              ? "opacity-0 translate-y-3 pointer-events-none"
              : "opacity-100 translate-y-0 animate-in slide-in-from-bottom-3 duration-400"
            }
          `}
        >
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Top accent line */}
            <div className="h-0.5 w-full bg-gradient-to-l from-[#C8A53A] via-[#C8A53A]/60 to-transparent" />

            <div className="p-4">
              {/* Header row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative shrink-0">
                  <img src={qiroxLogo} alt="مكان الشيف" className="w-10 h-10 rounded-xl border border-white/10" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-[#C8A53A] rounded-full flex items-center justify-center border border-[#0f1117]">
                    <Bell className="w-2.5 h-2.5 text-black" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm leading-tight">{tc("فعّل الإشعارات", "Enable Notifications")}</p>
                  <p className="text-white/50 text-[11px] mt-0.5 leading-tight">
                    {tc("تابع طلبك لحظة بلحظة", "Track your order in real time")}
                  </p>
                </div>

                <button
                  onClick={() => dismissNotif()}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0 text-white/30 hover:text-white/60"
                  data-testid="button-notif-dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Benefits — compact chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { emoji: "📦", text: tc("جاهزية طلبك", "Order ready") },
                  { emoji: "🎁", text: tc("عروض حصرية", "Exclusive offers") },
                  { emoji: "⚡", text: tc("تحديث فوري", "Instant update") },
                ].map(item => (
                  <span key={item.text} className="text-[11px] text-white/60 bg-white/5 rounded-full px-2.5 py-1 flex items-center gap-1">
                    <span>{item.emoji}</span>
                    <span>{item.text}</span>
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleNotifEnable}
                  disabled={notifLoading}
                  className="flex-1 h-9 rounded-xl text-xs font-bold bg-[#C8A53A] hover:bg-[#b8952f] text-black gap-1.5"
                  data-testid="button-notif-enable"
                >
                  {notifLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  {notifLoading ? tc("جاري التفعيل...", "Enabling...") : tc("تفعيل الآن", "Enable Now")}
                </Button>
                <button
                  onClick={() => dismissNotif()}
                  className="px-3 h-9 rounded-xl text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
                >
                  {tc("لاحقاً", "Later")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Android install prompt — compact card ── */}
      {showInstall && !showNotif && (
        <div className="fixed bottom-5 left-3 right-3 md:left-auto md:right-5 md:w-80 z-[100] animate-in slide-in-from-bottom-4 duration-400" dir="rtl">
          <div className="bg-[#0f1117] border border-white/10 text-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-3.5">
              <img src={qiroxLogo} alt={brand.shortNameEn} className="w-10 h-10 rounded-xl shrink-0 border border-white/10" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">{brand.nameEn}</p>
                <p className="text-[11px] text-white/50 mt-0.5">{tc("ثبّت التطبيق على جهازك", "Install app on your device")}</p>
              </div>
              <Button
                onClick={handleInstall}
                size="sm"
                className="bg-[#C8A53A] hover:bg-[#b8952f] text-black rounded-xl font-bold text-xs px-3 h-8 shrink-0 gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                {tc("حمّل", "Install")}
              </Button>
              <button onClick={handleInstallDismiss} className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0">
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS Install Guide — full sheet (needs instructions) ── */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-8 duration-400 pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-6 pt-2 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <img src={qiroxLogo} alt={brand.shortNameEn} className="w-14 h-14 rounded-2xl shadow-md" />
                <div>
                  <h2 className="text-lg font-black text-gray-900">{tc("فعّل إشعارات", "Enable Notifications for")} {brand.nameAr || brand.nameEn}</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {tc("الإشعارات على iPhone تتطلب تثبيت التطبيق أولاً", "iPhone notifications require installing the app first")}
                  </p>
                </div>
              </div>

              {isIOS() && !isiOSVersionSupported() && (
                <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    {tc("الإشعارات تتطلب iOS 16.4 أو أحدث.", "Notifications require iOS 16.4 or later.")}
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-5">
                {[
                  { step: "1", title: tc('اضغط على أيقونة "مشاركة"', 'Tap the "Share" icon'), sub: tc('الأيقونة في أسفل شاشة Safari', 'The icon at the bottom of Safari'), icon: Share2 },
                  { step: "2", title: tc('"أضف إلى الشاشة الرئيسية"', '"Add to Home Screen"'), sub: tc("مرّر لأسفل في القائمة واختر هذا الخيار", "Scroll down and select this option"), icon: PlusSquare },
                  { step: "3", title: tc('اضغط "إضافة" للتأكيد', 'Tap "Add" to confirm'), sub: tc("ثم افتح التطبيق من الشاشة الرئيسية وفعّل الإشعارات", "Then open the app from Home Screen and enable notifications"), icon: null },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50">
                    <div className="w-10 h-10 rounded-xl bg-[#C8A53A]/15 flex items-center justify-center shrink-0">
                      <span className="text-xl font-bold text-[#C8A53A]">{item.step}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                        {item.icon && <item.icon className="inline w-3.5 h-3.5 text-[#C8A53A]" />}
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleIOSGuideDismiss}
                className="w-full rounded-2xl h-12 font-bold text-sm bg-[#C8A53A] hover:bg-[#b8952f] text-black"
              >
                {tc("فهمت، شكراً", "Got it, thanks")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS Notification blocked ── */}
      {showIOSNotifBlocked && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-8 duration-400 pb-safe">
            <div className="px-6 pt-5 pb-6">
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-lg font-black text-gray-900">{tc("لم تكتمل عملية التفعيل", "Activation not completed")}</h2>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  {tc("إشعارات iPhone تعمل فقط عند استخدام التطبيق المثبّت على الشاشة الرئيسية", "iPhone notifications only work when using the app installed on the Home Screen")}
                </p>
              </div>
              <Button
                onClick={() => { setShowIOSNotifBlocked(false); setShowIOSGuide(true); }}
                className="w-full rounded-2xl h-12 font-bold text-sm bg-[#C8A53A] hover:bg-[#b8952f] text-black mb-2"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                {tc("كيف أضيف التطبيق؟", "How do I add the app?")}
              </Button>
              <Button variant="ghost" onClick={() => setShowIOSNotifBlocked(false)} className="w-full rounded-2xl h-10 text-sm text-gray-400">
                {tc("لاحقاً", "Later")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
