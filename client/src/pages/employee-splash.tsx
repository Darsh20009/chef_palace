import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import chefsplaceStaffLogo from "@assets/blackrose-staff-logo.png";
import { useTranslate } from "@/lib/useTranslate";

export default function EmployeeSplash() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const tc = useTranslate();

  useEffect(() => {
    document.title = tc("نظام الموظفين - مكان الشيف البخاري SYSTEMS | نظام إدارة متكامل", "Employee System - مكان الشيف البخاري SYSTEMS | Integrated Management");
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', tc('نظام إدارة الموظفين والعمليات في مكان الشيف البخاري SYSTEMS', 'Employee and operations management system for مكان الشيف البخاري SYSTEMS'));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [tc]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1a2e2b] via-[#1e3530] to-[#12201e] flex items-center justify-center p-6 overflow-hidden relative">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[100px]"
          animate={{ scale: [1, 1.15, 1], x: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#2D9B6E]/20 blur-[100px]"
          animate={{ scale: [1, 1.1, 1], x: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-[#4eca9c] to-primary" />

          <div className="p-8 flex flex-col items-center gap-6" dir="rtl">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-lg shadow-black/30 ring-1 ring-white/10 bg-black flex items-center justify-center p-3">
                <img
                  src={chefsplaceStaffLogo}
                  alt="مكان الشيف البخاري SYSTEMS"
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>

            <div className="text-center">
              <h1 className="text-white font-bold text-2xl tracking-wide mb-1">
                مكان الشيف البخاري SYSTEMS
              </h1>
              <p className="text-white/50 text-sm font-cairo">
                {tc("نظام إدارة الموظفين", "Employee Management System")}
              </p>
            </div>

            <div className="w-full h-px bg-white/10" />

            {isLoading ? (
              <div className="flex gap-2 py-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-primary"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                className="w-full flex flex-col gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Button
                  size="lg"
                  onClick={() => setLocation("/employee/gateway")}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/25"
                >
                  {tc("الدخول للنظام", "Enter System")}
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  onClick={async () => {
                    const manifestTag = document.getElementById('main-manifest') as HTMLLinkElement;
                    if (manifestTag) {
                      const newManifest = manifestTag.cloneNode(true) as HTMLLinkElement;
                      newManifest.href = '/employee-manifest.json?v=' + Date.now();
                      manifestTag.parentNode?.replaceChild(newManifest, manifestTag);
                    }
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') setDeferredPrompt(null);
                    } else {
                      const ua = navigator.userAgent.toLowerCase();
                      if (/iphone|ipad|ipod/.test(ua)) {
                        alert(tc("لتثبيت النظام على iPhone: اضغط على زر 'مشاركة' ثم 'إضافة إلى الشاشة الرئيسية'", "To install on iPhone: tap 'Share' then 'Add to Home Screen'"));
                      } else {
                        alert(tc("لتثبيت النظام: اضغط على القائمة (⋮) ثم 'تثبيت التطبيق'", "To install: tap the menu (⋮) then 'Install App'"));
                      }
                    }
                  }}
                  className="w-full text-white/60 hover:text-white hover:bg-white/5 h-10 rounded-xl font-cairo text-sm"
                >
                  <Download className="ml-2 h-4 w-4" />
                  {tc("تحميل كتطبيق", "Install as App")}
                </Button>
              </motion.div>
            )}
          </div>

          <div className="px-8 pb-5 text-center">
            <p className="text-white/25 text-xs font-cairo">
              {tc("أهلاً وسهلاً بك في نظام الموظفين", "Welcome to the Employee System")}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
