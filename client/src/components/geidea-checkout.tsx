import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, CheckCircle, XCircle, RefreshCw, AlertCircle, Wifi, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/useTranslate";

declare global {
  interface Window {
    GeideaCheckout?: any;
  }
}

interface GeideaSessionConfig {
  merchantPublicKey: string;
  orderAmount: string;
  orderCurrency: string;
  merchantReferenceId: string;
  callbackUrl: string;
  signature: string;
  timestamp: string;
}

interface GeideaCheckoutProps {
  orderNumber: string;
  amount: number;
  customerPhone?: string;
  customerEmail?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type SdkState = "loading" | "ready" | "processing" | "success" | "error";

const SDK_URL = "https://js.geidea.net/GeideaCheckoutSDK.js";
const SDK_TIMEOUT_MS = 20000;

const loadGeideaSDK = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.GeideaCheckout) { resolve(); return; }
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (el: HTMLScriptElement) => {
      if (timeoutId) clearTimeout(timeoutId);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
    const onLoad = (e: Event) => {
      const el = e.currentTarget as HTMLScriptElement;
      cleanup(el);
      window.GeideaCheckout ? resolve() : reject(new Error("sdk_not_available"));
    };
    const onError = (e: Event) => {
      const el = e.currentTarget as HTMLScriptElement;
      cleanup(el);
      reject(new Error("sdk_load_failed"));
    };
    const existing = document.getElementById("geidea-sdk");
    if (existing) existing.remove();
    const s = document.createElement("script");
    s.id = "geidea-sdk";
    s.src = SDK_URL;
    s.async = true;
    s.addEventListener("load", onLoad);
    s.addEventListener("error", onError);
    document.head.appendChild(s);
    timeoutId = setTimeout(() => {
      s.removeEventListener("load", onLoad);
      s.removeEventListener("error", onError);
      reject(new Error("sdk_load_timeout"));
    }, SDK_TIMEOUT_MS);
  });

export default function GeideaCheckoutWidget({
  orderNumber,
  amount,
  customerPhone,
  customerEmail,
  onSuccess,
  onError,
  onCancel,
}: GeideaCheckoutProps) {
  const tc = useTranslate();
  const [sdkState, setSdkState] = useState<SdkState>("loading");
  const [userFriendlyError, setUserFriendlyError] = useState("");
  const sessionConfig = useRef<GeideaSessionConfig | null>(null);
  const checkoutRef = useRef<any>(null);
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const mountedRef = useRef(true);

  const { data: payCfg } = useQuery<{ paymentTestMode: boolean; provider: string; geideaConfigured: boolean }>({
    queryKey: ["/api/payments/config"],
    staleTime: 30000,
  });

  const isTestMode = !!payCfg?.paymentTestMode;

  const friendlyMessage = (raw: any): string => {
    if (!raw) return tc("حدث خطأ في الدفع. يرجى المحاولة مرة أخرى.", "A payment error occurred. Please try again.");
    const code = raw?.responseCode || raw?.detailedResponseCode || "";
    const msg = typeof raw === "string" ? raw : raw?.detailedResponseMessage || raw?.responseMessage || raw?.message || "";
    if (code === "015" || msg.toLowerCase().includes("signature"))
      return tc("خطأ في التوقيع الرقمي. يرجى الاتصال بالدعم (كود: 015).", `Digital signature error. Please contact support (code: 015).`);
    if (code === "036" || msg.toLowerCase().includes("gateway configuration"))
      return tc("لم يتم تفعيل بوابة الدفع الإلكترونية بعد.", "Payment gateway not activated yet. Please contact Geidea.");
    if (code === "100" || msg.toLowerCase().includes("general error"))
      return tc("خطأ عام في بوابة الدفع. يرجى المحاولة مرة أخرى.", "General payment gateway error. Please try again.");
    if (code === "210") return tc("تعذّر معالجة الدفع.", "Payment processing failed. Please contact support.");
    if (!msg || msg.includes("{") || msg.includes("undefined") || msg.includes("null"))
      return code ? tc(`خطأ في الدفع (كود: ${code}).`, `Payment error (code: ${code}). Please try again.`) : tc("حدث خطأ في الدفع.", "A payment error occurred.");
    if (msg.toLowerCase().includes("declined") || msg.includes("رُفضت"))
      return tc("تم رفض البطاقة. يرجى التحقق من بياناتها أو استخدام بطاقة أخرى.", "Card declined. Please check card details or use another card.");
    if (msg.toLowerCase().includes("cancel")) return tc("تم إلغاء عملية الدفع.", "Payment was cancelled.");
    if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("network"))
      return tc("انقطع الاتصال أثناء الدفع.", "Connection interrupted during payment. Please try again.");
    if (msg.toLowerCase().includes("invalid"))
      return tc(`خطأ في بيانات الدفع.`, `Invalid payment data. Please contact support.`);
    if (msg.length > 120) return tc("حدث خطأ في الدفع.", "A payment error occurred. Please try again.");
    return msg;
  };

  const clearPopupTimer = () => {
    if (popupTimer.current) { clearTimeout(popupTimer.current); popupTimer.current = null; }
  };

  const fetchAndPrepare = async () => {
    if (!mountedRef.current) return;
    setSdkState("loading");
    setUserFriendlyError("");
    sessionConfig.current = null;
    if (isTestMode) {
      if (mountedRef.current) setSdkState("ready");
      return;
    }
    try {
      await loadGeideaSDK();
      if (!mountedRef.current) return;
      if (!window.GeideaCheckout) throw new Error("sdk_not_available");
      const callbackUrl = `${window.location.origin}/api/payments/geidea/callback`;
      const controller = new AbortController();
      const apiTimeout = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch("/api/payments/geidea/session-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, currency: "SAR", merchantReferenceId: orderNumber, callbackUrl }),
          signal: controller.signal,
        });
      } finally { clearTimeout(apiTimeout); }
      if (!mountedRef.current) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "session_config_failed");
      }
      const cfg: GeideaSessionConfig = await res.json();
      sessionConfig.current = cfg;
      if (mountedRef.current) setSdkState("ready");
    } catch (err: any) {
      if (!mountedRef.current) return;
      let msg = tc("تعذّر الاتصال ببوابة الدفع.", "Could not connect to payment gateway. Please try again.");
      if (err.name === "AbortError") msg = tc("انتهت مهلة الاتصال.", "Connection timed out. Please check your internet connection.");
      else if (err.message === "sdk_load_failed" || err.message === "sdk_not_available") msg = tc("تعذّر تحميل نظام الدفع.", "Failed to load payment system. Check your internet.");
      else if (err.message === "sdk_load_timeout") msg = tc("استغرق تحميل بوابة الدفع وقتاً طويلاً.", "Payment gateway took too long to load. Please try again.");
      else if (err.message === "session_config_failed") msg = tc("خطأ في إعداد جلسة الدفع.", "Payment session setup error. Please contact support.");
      setSdkState("error");
      setUserFriendlyError(msg);
      onError(msg);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (payCfg !== undefined) fetchAndPrepare();
    return () => { mountedRef.current = false; clearPopupTimer(); };
  }, [payCfg]);

  const handleTestPayNow = async () => {
    setSdkState("processing");
    try {
      const res = await fetch("/api/payments/simulate-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, amount, currency: "SAR" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (mountedRef.current) setSdkState("success");
        onSuccess();
      } else {
        throw new Error(data.error || "simulation_failed");
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setSdkState("error");
        setUserFriendlyError(tc("فشل في محاكاة الدفع.", "Payment simulation failed. Make sure test mode is enabled."));
      }
    }
  };

  const handlePayNow = () => {
    if (isTestMode) { handleTestPayNow(); return; }
    const cfg = sessionConfig.current;
    if (!cfg || !window.GeideaCheckout) { fetchAndPrepare(); return; }
    setSdkState("processing");
    setPopupBlocked(false);
    popupTimer.current = setTimeout(() => { if (mountedRef.current) setPopupBlocked(true); }, 10000);
    try {
      checkoutRef.current = new window.GeideaCheckout(
        (order: any) => {
          clearPopupTimer();
          if (mountedRef.current) setSdkState("success");
          onSuccess();
        },
        (order: any) => {
          clearPopupTimer();
          const msg = friendlyMessage(order);
          if (mountedRef.current) { setSdkState("error"); setUserFriendlyError(msg); }
          onError(msg);
        },
        (order: any) => {
          clearPopupTimer();
          if (mountedRef.current) { setSdkState("ready"); setPopupBlocked(false); }
          onCancel();
        }
      );
      const returnUrl = `${window.location.origin}/payment-return`;
      const sessionParams: any = {
        merchantPublicKey: cfg.merchantPublicKey,
        orderAmount: parseFloat(cfg.orderAmount),
        orderCurrency: cfg.orderCurrency,
        merchantReferenceId: cfg.merchantReferenceId,
        callbackUrl: cfg.callbackUrl || returnUrl,
        returnUrl,
        signature: cfg.signature,
        timestamp: cfg.timestamp,
        language: "ar",
        showEmail: false,
        showPhone: false,
      };
      if (customerEmail) sessionParams.customerEmail = customerEmail;
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/^\+966/, '').replace(/^966/, '').replace(/^0/, '');
        sessionParams.customerPhone = cleanPhone;
        sessionParams.customerMobileCountryCode = "966";
      }
      checkoutRef.current.startSession(sessionParams);
    } catch (err: any) {
      clearPopupTimer();
      const msg = tc("تعذّر فتح نموذج الدفع.", "Could not open payment form. Please try again.");
      if (mountedRef.current) { setSdkState("error"); setUserFriendlyError(msg); }
      onError(msg);
    }
  };

  const handleRetry = () => {
    clearPopupTimer();
    setPopupBlocked(false);
    sessionConfig.current = null;
    fetchAndPrepare();
  };

  if (sdkState === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
        <CheckCircle className="w-14 h-14 text-green-500" />
        <div className="text-center">
          <p className="font-bold text-xl text-green-700 dark:text-green-400">{tc("تم الدفع بنجاح!", "Payment Successful!")}</p>
          {isTestMode && <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">⚗️ {tc("وضع الاختبار — لم يُخصم مبلغ حقيقي", "Test mode — no real amount was charged")}</p>}
          <p className="text-sm text-muted-foreground mt-1">{tc("جاري معالجة طلبك...", "Processing your order...")}</p>
        </div>
      </div>
    );
  }

  if (sdkState === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
        <XCircle className="w-12 h-12 text-red-500" />
        <div className="text-center space-y-1">
          <p className="font-bold text-lg text-red-700 dark:text-red-400">{tc("تعذّر إتمام الدفع", "Payment Failed")}</p>
          <p className="text-sm text-muted-foreground">{userFriendlyError}</p>
        </div>
        <Button variant="outline" onClick={handleRetry} className="mt-2 gap-2" data-testid="button-retry-geidea">
          <RefreshCw className="w-4 h-4" />
          {tc("حاول مرة أخرى", "Try Again")}
        </Button>
      </div>
    );
  }

  if (sdkState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 bg-primary/5 rounded-xl border border-primary/20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="font-semibold text-foreground">{tc("جاري تجهيز بوابة الدفع...", "Preparing payment gateway...")}</p>
        <p className="text-xs text-muted-foreground">{tc("يرجى الانتظار لحظة", "Please wait a moment")}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Wifi className="w-3 h-3" />
          <span>{tc("يتطلب اتصالاً بالإنترنت", "Requires internet connection")}</span>
        </div>
      </div>
    );
  }

  if (sdkState === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-primary/5 rounded-xl border border-primary/20">
        {isTestMode ? (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-semibold text-foreground">{tc("جاري محاكاة الدفع...", "Simulating payment...")}</p>
            <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">⚗️ {tc("وضع الاختبار", "Test Mode")}</p>
          </>
        ) : popupBlocked ? (
          <>
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">{tc("لم تظهر نافذة الدفع؟", "Payment window didn't appear?")}</p>
              <p className="text-sm text-muted-foreground">{tc("قد يكون المتصفح قد حجب النافذة.", "Your browser may have blocked the popup.")}</p>
            </div>
            <Button size="lg" onClick={handlePayNow} className="gap-2" data-testid="button-open-geidea">
              <CreditCard className="w-4 h-4" />
              {tc("افتح نافذة الدفع", "Open Payment Window")}
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">{tc("جاري فتح نافذة الدفع...", "Opening payment window...")}</p>
              <p className="text-xs text-muted-foreground">{tc("مدعوم بواسطة Geidea", "Powered by Geidea")}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 bg-primary/5 rounded-xl border border-primary/20">
      <CreditCard className="w-10 h-10 text-primary" />
      <div className="text-center space-y-2">
        <p className="font-semibold text-foreground text-lg">{tc("بوابة الدفع جاهزة", "Payment Gateway Ready")}</p>
        <p className="text-sm text-muted-foreground">{tc("اضغط الزر أدناه لفتح نموذج الدفع الآمن", "Press the button below to open the secure payment form")}</p>
      </div>
      <Button size="lg" onClick={handlePayNow} className="gap-2 w-full max-w-xs" data-testid="button-open-geidea">
        <CreditCard className="w-4 h-4" />
        {tc("ادفع الآن", "Pay Now")}
      </Button>
      <p className="text-xs text-muted-foreground">🔒 {tc("دفع آمن ومشفّر بواسطة Geidea", "Secure encrypted payment by Geidea")}</p>
    </div>
  );
}
