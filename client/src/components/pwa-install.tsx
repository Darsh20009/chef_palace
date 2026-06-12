import { useState, useEffect } from "react";
import { Download, X, Smartphone, Monitor, Share, Plus, Zap, Wifi, Bell, ChevronRight } from "lucide-react";
import qiroxLogo from "@assets/qirox-logo-customer.png";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa-installable"));
  });
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }
    if (deferredPrompt) setCanInstall(true);
    const handler = () => setCanInstall(true);
    window.addEventListener("pwa-installable", handler);
    return () => window.removeEventListener("pwa-installable", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
    }
    return outcome === "accepted";
  };

  return { canInstall, isInstalled, install };
}

function getDevice(): "iphone" | "ipad" | "android" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipod/i.test(ua) && !(window as any).MSStream;
  const isIPad =
    /ipad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "iphone";
  if (isIPad) return "ipad";
  const isAndroid = /android/i.test(ua);
  if (isAndroid) return !/mobile/i.test(ua) ? "tablet" : "android";
  return "desktop";
}

const G = "#2D9B6E";
const G_DIM = "rgba(45,155,110,0.12)";
const G_BORDER = "rgba(45,155,110,0.22)";

function AppIcon({ size = 60 }: { size?: number }) {
  const r = Math.round(size * 0.22);
  return (
    <img
      src={qiroxLogo}
      alt="مكان الشيف البخاري"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        objectFit: "cover",
        flexShrink: 0,
        boxShadow: `0 6px 20px rgba(45,155,110,0.28), 0 2px 6px rgba(0,0,0,0.4)`,
      }}
    />
  );
}

function Stars() {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="#F5A623">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginRight: 4 }}>4.9</span>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: G_DIM, border: `1px solid ${G_BORDER}`,
      borderRadius: 20, padding: "5px 10px",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      <Icon size={12} color={G} />
      <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function Handle() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
      <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="close"
      style={{
        width: 30, height: 30, borderRadius: "50%",
        background: "rgba(255,255,255,0.07)", border: "none",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <X size={14} color="rgba(255,255,255,0.4)" />
    </button>
  );
}

function AppHeader({ onClose, subtitle }: { onClose: () => void; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 20px 14px" }}>
      <AppIcon size={58} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: 0, lineHeight: 1.2 }}>مكان الشيف البخاري</p>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: "2px 0 5px" }}>chefsplace.online</p>
        <Stars />
      </div>
      <CloseBtn onClose={onClose} />
    </div>
  );
}

function PillsRow() {
  return (
    <div style={{ display: "flex", gap: 7, padding: "0 20px 16px", overflowX: "auto", msOverflowStyle: "none", scrollbarWidth: "none" }}>
      <Pill icon={Zap} label="أسرع بـ 3x" />
      <Pill icon={Wifi} label="يعمل بلا إنترنت" />
      <Pill icon={Bell} label="إشعارات لحظية" />
      <Pill icon={Download} label="بدون متجر" />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.055)", margin: "0 20px 18px" }} />;
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: G_DIM, border: `1.5px solid ${G_BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: G, fontWeight: 800, fontSize: 14 }}>{n}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: "2px 0 8px" }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {children}
    </div>
  );
}

function SafariBrowserBar() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "8px 12px",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{
        flex: 1, background: "rgba(255,255,255,0.07)",
        borderRadius: 7, padding: "5px 10px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: G, flexShrink: 0 }} />
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>chefsplace.online</span>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: "#147EFB",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Share size={16} color="#fff" />
      </div>
    </div>
  );
}

function IOSGuide({ onClose }: { onClose: () => void }) {
  const device = getDevice();
  const isIPad = device === "ipad";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex",
        alignItems: isIPad ? "center" : "flex-end",
        justifyContent: "center",
        padding: isIPad ? 24 : 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          width: "100%",
          maxWidth: isIPad ? 460 : "100%",
          background: "linear-gradient(160deg, #161616 0%, #0e0e0e 100%)",
          borderRadius: isIPad ? 28 : "26px 26px 0 0",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(45,155,110,0.1)",
          animation: "slideUpSheet 0.38s cubic-bezier(0.34,1.4,0.64,1)",
        }}
      >
        <Handle />
        <AppHeader onClose={onClose} subtitle="أضفه إلى شاشتك الرئيسية" />
        <PillsRow />
        <Divider />

        <div style={{ padding: "0 20px 8px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Step n="١" title="افتح قائمة المشاركة في Safari">
            <SafariBrowserBar />
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: "7px 0 0" }}>
              اضغط أيقونة الـ Share في شريط Safari السفلي
            </p>
          </Step>

          <Step n="٢" title='اختر "Add to Home Screen"'>
            <StepCard>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: "rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Plus size={18} color="rgba(255,255,255,0.6)" />
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, margin: 0 }}>
                  Add to Home Screen
                </p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: "2px 0 0" }}>
                  مرّر للأسفل في القائمة إذا لم تجدها
                </p>
              </div>
            </StepCard>
          </Step>

          <Step n="٣" title='اضغط "Add" في الأعلى'>
            <div style={{
              background: G_DIM, border: `1px solid ${G_BORDER}`,
              borderRadius: 12, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <AppIcon size={32} />
              <div>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, margin: 0 }}>مكان الشيف البخاري</p>
                <p style={{ color: G, fontSize: 11, margin: "2px 0 0", fontWeight: 500 }}>
                  ستظهر الأيقونة على شاشتك فوراً ✨
                </p>
              </div>
            </div>
          </Step>
        </div>

        <div style={{ padding: "20px 20px", paddingBottom: isIPad ? 20 : "calc(20px + env(safe-area-inset-bottom))" }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", height: 52, borderRadius: 16,
              background: `linear-gradient(135deg, ${G} 0%, #1e7a55 100%)`,
              border: "none", color: "#fff", fontSize: 16,
              fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 20px rgba(45,155,110,0.35)`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            فهمت! 👍
          </button>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center", margin: "10px 0 0" }}>
            مجاني تماماً · بلا إعلانات · بلا متجر تطبيقات
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function AndroidPrompt({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  const device = getDevice();
  const isTablet = device === "tablet";
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    await onInstall();
    setInstalling(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex",
        alignItems: isTablet ? "center" : "flex-end",
        justifyContent: "center",
        padding: isTablet ? 24 : 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          width: "100%",
          maxWidth: isTablet ? 440 : "100%",
          background: "#161616",
          borderRadius: isTablet ? 28 : "24px 24px 0 0",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          animation: "slideUpSheet 0.32s cubic-bezier(0.34,1.4,0.64,1)",
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, ${G}, #1e7a55, ${G})` }} />
        <Handle />

        <div style={{ padding: "6px 20px 0" }}>
          <AppHeader onClose={onClose} subtitle="" />
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8, padding: "0 20px 20px",
        }}>
          {[
            { icon: Zap, label: "أسرع بـ 3x" },
            { icon: Wifi, label: "بلا إنترنت" },
            { icon: Bell, label: "إشعارات" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} style={{
              background: G_DIM, border: `1px solid ${G_BORDER}`,
              borderRadius: 14, padding: "14px 8px",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 7,
            }}>
              <Icon size={20} color={G} />
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, textAlign: "center", fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "0 20px", paddingBottom: isTablet ? 20 : "calc(20px + env(safe-area-inset-bottom))" }}>
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              width: "100%", height: 56, borderRadius: 18,
              background: installing
                ? "rgba(45,155,110,0.4)"
                : `linear-gradient(135deg, ${G} 0%, #1e7a55 100%)`,
              border: "none", color: "#fff", fontSize: 17,
              fontWeight: 800, cursor: installing ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: installing ? "none" : `0 6px 24px rgba(45,155,110,0.4)`,
              transition: "all 0.2s",
            }}
          >
            {installing ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <Download size={20} />
                تثبيت التطبيق
              </>
            )}
          </button>
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, textAlign: "center", margin: "10px 0 0" }}>
            مجاني · بدون إعلانات · لا يحتاج متجر تطبيقات
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const device = getDevice();

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  useEffect(() => {
    if (isStandalone) return;
    if (sessionStorage.getItem("pwa-prompt-dismissed")) return;

    if (device === "iphone" || device === "ipad") {
      const t = setTimeout(() => setShowSheet(true), 3500);
      return () => clearTimeout(t);
    }
    if ((device === "android" || device === "tablet") && canInstall) {
      const t = setTimeout(() => setShowSheet(true), 2500);
      return () => clearTimeout(t);
    }
  }, [device, canInstall, isStandalone]);

  const handleClose = () => {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setShowSheet(false);
    setDismissed(true);
  };

  const handleInstall = async () => {
    await install();
    handleClose();
  };

  if (isStandalone || dismissed || !showSheet) return null;

  if (device === "iphone" || device === "ipad") return <IOSGuide onClose={handleClose} />;
  if ((device === "android" || device === "tablet") && canInstall)
    return <AndroidPrompt onInstall={handleInstall} onClose={handleClose} />;

  return null;
}

export function PWAInstallButton({ className = "" }: { className?: string }) {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const device = getDevice();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 ${className}`}>
        <Monitor className="w-4 h-4" />
        التطبيق مثبّت ✅
      </div>
    );
  }

  if (device === "iphone" || device === "ipad") {
    return (
      <>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/5 transition-colors ${className}`}
          onClick={() => setShowIOSGuide(true)}
        >
          <Smartphone className="w-4 h-4 text-green-500" />
          أضف إلى الشاشة الرئيسية
          <ChevronRight className="w-3 h-3 opacity-40" />
        </button>
        {showIOSGuide && <IOSGuide onClose={() => setShowIOSGuide(false)} />}
      </>
    );
  }

  if (!canInstall) return null;

  return (
    <button
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition-all ${className}`}
      style={{ background: `linear-gradient(135deg, ${G}, #1e7a55)`, boxShadow: "0 4px 16px rgba(45,155,110,0.35)" }}
      onClick={install}
    >
      <Download className="w-4 h-4" />
      تثبيت التطبيق
    </button>
  );
}
