import { useState, useEffect } from "react";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import { useTranslate } from "@/lib/useTranslate";
  import { Download, X, Smartphone, Monitor } from "lucide-react";

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  // Listen globally so we never miss it
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent('pwa-installable'));
    });
  }

  export function usePWAInstall() {
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
      // Already installed?
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
      if (deferredPrompt) setCanInstall(true);
      const handler = () => setCanInstall(true);
      window.addEventListener('pwa-installable', handler);
      return () => window.removeEventListener('pwa-installable', handler);
    }, []);

    const install = async () => {
      if (!deferredPrompt) return false;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { deferredPrompt = null; setCanInstall(false); setIsInstalled(true); }
      return outcome === 'accepted';
    };

    return { canInstall, isInstalled, install };
  }

  export function PWAInstallBanner() {
    const tc = useTranslate();
    const { canInstall, install } = usePWAInstall();
    const [dismissed, setDismissed] = useState(false);

    // iOS detection
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const [showIOS, setShowIOS] = useState(false);

    useEffect(() => {
      if (isIOS && !isStandalone && !sessionStorage.getItem('pwa-ios-dismissed')) setShowIOS(true);
    }, []);

    if (isStandalone || dismissed) return null;

    if (showIOS) return (
      <Card className="fixed bottom-20 left-3 right-3 z-50 border-primary/30 shadow-2xl bg-background/95 backdrop-blur-md md:left-auto md:right-4 md:w-80">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-bold text-sm flex items-center gap-1">
                <Smartphone className="w-4 h-4 text-primary" />{tc("ثبّت التطبيق على iPhone", "Install on iPhone")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{tc('اضغط زر "مشاركة" ثم "أضف إلى الشاشة الرئيسية"', 'Tap the "Share" button then "Add to Home Screen"')}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { sessionStorage.setItem('pwa-ios-dismissed','1'); setShowIOS(false); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );

    if (!canInstall) return null;

    return (
      <Card className="fixed bottom-20 left-3 right-3 z-50 border-primary/30 shadow-2xl bg-background/95 backdrop-blur-md md:left-auto md:right-4 md:w-80">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-bold text-sm">{tc("ثبّت تطبيق مكان الشيف البخاري", "Install مكان الشيف البخاري App")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("يعمل بدون إنترنت وبسرعة أكبر", "Works offline and faster")}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={async () => { const ok = await install(); if (!ok) setDismissed(true); }}>
                <Download className="w-3.5 h-3.5 ml-1" />{tc("تثبيت", "Install")}
              </Button>
              <Button size="sm" variant="ghost" className="px-2" onClick={() => setDismissed(true)}><X className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  export function PWAInstallButton({ className = '' }: { className?: string }) {
    const tc = useTranslate();
    const { canInstall, isInstalled, install } = usePWAInstall();

    if (isInstalled) return (
      <div className={`flex items-center gap-2 text-sm text-green-500 ${className}`}>
        <Monitor className="w-4 h-4" />{tc("التطبيق مثبت ✅", "App Installed ✅")}
      </div>
    );

    if (!canInstall) return null;

    return (
      <Button variant="outline" size="sm" className={`gap-2 ${className}`} onClick={install}>
        <Download className="w-4 h-4" />
        {tc("تثبيت التطبيق", "Install App")}
      </Button>
    );
  }
  