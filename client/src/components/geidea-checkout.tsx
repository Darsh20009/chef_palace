import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, CheckCircle, XCircle, RefreshCw, AlertCircle, Wifi, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const friendlyMessage = (raw: any): string => {
  if (!raw) return "حدث خطأ في الدفع. يرجى المحاولة مرة أخرى.";

  const code = raw?.responseCode || raw?.detailedResponseCode || "";
  const msg =
    typeof raw === "string"
      ? raw
      : raw?.detailedResponseMessage || raw?.responseMessage || raw?.message || "";

  if (code === "015" || msg.toLowerCase().includes("signature"))
    return "خطأ في التوقيع الرقمي. يرجى الاتصال بالدعم (كود: 015).";
  if (code === "036" || msg.toLowerCase().includes("gateway configuration"))
    return "لم يتم تفعيل بوابة الدفع الإلكترونية بعد. يرجى التواصل مع Geidea لتفعيل الدفع عبر الإنترنت.";
  if (code === "100" || msg.toLowerCase().includes("general error"))
    return "خطأ عام في بوابة الدفع. يرجى المحاولة مرة أخرى.";
  if (code === "210") return "تعذّر معالجة الدفع. قد تكون بوابة Geidea غير مفعّلة للدفع الإلكتروني — يرجى التواصل مع الدعم.";

  if (!msg || msg.includes("{") || msg.includes("undefined") || msg.includes("null")) {
    return code ? `خطأ في الدفع (كود: ${code}). يرجى المحاولة مرة أخرى.` : "حدث خطأ في الدفع. يرجى المحاولة مرة أخرى.";
  }
  if (msg.toLowerCase().includes("declined") || msg.includes("رُفضت"))
    return "تم رفض البطاقة. يرجى التحقق من بياناتها أو استخدام بطاقة أخرى.";
  if (msg.toLowerCase().includes("cancel")) return "تم إلغاء عملية الدفع.";
  if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("network"))
    return "انقطع الاتصال أثناء الدفع. يرجى المحاولة مرة أخرى.";
  if (msg.toLowerCase().includes("invalid"))
    return `خطأ في بيانات الدفع. ${code ? `(كود: ${code})` : ""} يرجى الاتصال بالدعم.`;
  if (msg.length > 120) return "حدث خطأ في الدفع. يرجى المحاولة مرة أخرى.";
  return msg;
};

const SDK_URL = "https://js.geidea.net/GeideaCheckoutSDK.js";
const SDK_TIMEOUT_MS = 20000;

const loadGeideaSDK = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.GeideaCheckout) {
      resolve();
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (el: HTMLScriptElement) => {
      if (timeoutId) clearTimeout(timeoutId);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };

    const onLoad = (e: Event) => {
      const el = e.currentTarget as HTMLScriptElement;
      cleanup(el);
      if (window.GeideaCheckout) {
        resolve();
      } else {
        reject(new Error("sdk_not_available"));
      }
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
  const [sdkState, setSdkState] = useState<SdkState>("loading");
  const [userFriendlyError, setUserFriendlyError] = useState("");
  const sessionConfig = useRef<GeideaSessionConfig | null>(null);
  const checkoutRef = useRef<any>(null);
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const mountedRef = useRef(true);

  // Check if test mode is active
  const { data: payCfg } = useQuery<{ paymentTestMode: boolean; provider: string; geideaConfigured: boolean }>({
    queryKey: ["/api/payments/config"],
    staleTime: 30000,
  });

  const isTestMode = !!payCfg?.paymentTestMode;

  const clearPopupTimer = () => {
    if (popupTimer.current) { clearTimeout(popupTimer.current); popupTimer.current = null; }
  };

  // In test mode, skip SDK loading
  const fetchAndPrepare = async () => {
    if (!mountedRef.current) return;
    setSdkState("loading");
    setUserFriendlyError("");
    sessionConfig.current = null;

    if (isTestMode) {
      // Test mode: no SDK needed, just show ready state
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
          body: JSON.stringify({
            amount,
            currency: "SAR",
            merchantReferenceId: orderNumber,
            callbackUrl,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(apiTimeout);
      }

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
      console.error("[Geidea] Prepare error:", err.message);
      let msg = "تعذّر الاتصال ببوابة الدفع. يرجى المحاولة مرة أخرى.";
      if (err.name === "AbortError")
        msg = "انتهت مهلة الاتصال. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.";
      else if (err.message === "sdk_load_failed" || err.message === "sdk_not_available")
        msg = "تعذّر تحميل نظام الدفع. تحقق من اتصالك بالإنترنت.";
      else if (err.message === "sdk_load_timeout")
        msg = "استغرق تحميل بوابة الدفع وقتاً طويلاً. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.";
      else if (err.message === "session_config_failed")
        msg = "خطأ في إعداد جلسة الدفع. يرجى الاتصال بالدعم.";
      setSdkState("error");
      setUserFriendlyError(msg);
      onError(msg);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    // Wait for payCfg to load before preparing
    if (payCfg !== undefined) fetchAndPrepare();
    return () => {
      mountedRef.current = false;
      clearPopupTimer();
    };
  }, [payCfg]);

  // Test mode payment simulation
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
        setUserFriendlyError("فشل في محاكاة الدفع. تأكد من تفعيل وضع الاختبار.");
      }
    }
  };

  const handlePayNow = () => {
    if (isTestMode) {
      handleTestPayNow();
      return;
    }

    const cfg = sessionConfig.current;
    if (!cfg || !window.GeideaCheckout) {
      fetchAndPrepare();
      return;
    }

    setSdkState("processing");
    setPopupBlocked(false);

    popupTimer.current = setTimeout(() => {
      if (mountedRef.current) setPopupBlocked(true);
    }, 10000);

    try {
      checkoutRef.current = new window.GeideaCheckout(
        (order: any) => {
          clearPopupTimer();
          console.log("[Geidea] Success:", order?.orderId);
          if (mountedRef.current) setSdkState("success");
          onSuccess();
        },
        (order: any) => {
          clearPopupTimer();
          console.error("[Geidea] Error full:", JSON.stringify(order));
          const msg = friendlyMessage(order);
          if (mountedRef.current) {
            setSdkState("error");
            setUserFriendlyError(msg);
          }
          onError(msg);
        },
        (order: any) => {
          clearPopupTimer();
          console.log("[Geidea] Cancelled");
          if (mountedRef.current) {
            setSdkState("ready");
            setPopupBlocked(false);
          }
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
      console.log('[Geidea] startSession params:', { ...sessionParams, merchantPublicKey: '***', signature: '***', orderAmount: sessionParams.orderAmount });
      checkoutRef.current.startSession(sessionParams);
    } catch (err: any) {
      clearPopupTimer();
      console.error("[Geidea] startSession error:", err);
      const msg = "تعذّر فتح نموذج الدفع. يرجى المحاولة مرة أخرى.";
      if (mountedRef.current) {
        setSdkState("error");
        setUserFriendlyError(msg);
      }
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
          <p className="font-bold text-xl text-green-700 dark:text-green-400">تم الدفع بنجاح!</p>
          {isTestMode && <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">⚗️ وضع الاختبار — لم يُخصم مبلغ حقيقي</p>}
          <p className="text-sm text-muted-foreground mt-1">جاري معالجة طلبك...</p>
        </div>
      </div>
    );
  }

  if (sdkState === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
        <XCircle className="w-12 h-12 text-red-500" />
        <div className="text-center space-y-1">
          <p className="font-bold text-lg text-red-700 dark:text-red-400">تعذّر إتمام الدفع</p>
          <p className="text-sm text-muted-foreground">{userFriendlyError}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRetry}
          className="mt-2 gap-2"
          data-testid="button-retry-geidea"
        >
          <RefreshCw className="w-4 h-4" />
          حاول مرة أخرى
        </Button>
      </div>
    );
  }

  if (sdkState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 bg-primary/5 rounded-xl border border-primary/20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="font-semibold text-foreground">جاري تجهيز بوابة الدفع...</p>
        <p className="text-xs text-muted-foreground">يرجى الانتظار لحظة</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Wifi className="w-3 h-3" />
          <span>يتطلب اتصالاً بالإنترنت</span>
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
            <p className="font-semibold text-foreground">جاري محاكاة الدفع...</p>
            <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">⚗️ وضع الاختبار</p>
          </>
        ) : popupBlocked ? (
          <>
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">لم تظهر نافذة الدفع؟</p>
              <p className="text-sm text-muted-foreground">
                قد يكون المتصفح قد حجب النافذة. اضغط الزر أدناه لفتحها مجدداً.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handlePayNow}
              className="gap-2"
              data-testid="button-open-geidea"
            >
              <CreditCard className="w-4 h-4" />
              افتح نافذة الدفع
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">جاري فتح نافذة الدفع...</p>
              <p className="text-xs text-muted-foreground">مدعوم بواسطة Geidea</p>
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
        <p className="font-semibold text-foreground text-lg">بوابة الدفع جاهزة</p>
        <p className="text-sm text-muted-foreground">اضغط الزر أدناه لفتح نموذج الدفع الآمن</p>
      </div>
      <Button
        size="lg"
        onClick={handlePayNow}
        className="gap-2 w-full max-w-xs"
        data-testid="button-open-geidea"
      >
<CreditCard className="w-4 h-4" />
        ادفع الآن
      </Button>
      <p className="text-xs text-muted-foreground">🔒 دفع آمن ومشفّر بواسطة Geidea</p>
    </div>
  );
}
