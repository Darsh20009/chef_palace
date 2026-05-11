import { useState, useEffect, useRef } from "react";
import { Loader2, ShieldCheck, X, ExternalLink, CheckCircle2, XCircle, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymobCheckoutProps {
  orderNumber: string;
  amount: number;
  checkoutUrl: string;
  publicKey?: string;
  clientSecret?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

type PaymobState = "loading" | "ready" | "processing" | "verifying" | "success" | "error";

export default function PaymobCheckout({
  orderNumber,
  amount,
  checkoutUrl,
  onSuccess,
  onError,
  onCancel,
}: PaymobCheckoutProps) {
  const [state, setState] = useState<PaymobState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const successTriggered = useRef(false);

  useEffect(() => {
    if (checkoutUrl) {
      setState("ready");
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    }
  }, [checkoutUrl]);

  const triggerSuccess = () => {
    if (successTriggered.current) return;
    successTriggered.current = true;
    setConfirmCancel(false);
    setState("success");
    setTimeout(() => {
      setVisible(false);
      setTimeout(onSuccess, 400);
    }, 1800);
  };

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setState("error");
    onError(msg);
  };

  const verifyPaymentStatus = async (retries = 8, delayMs = 1500): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(`/api/payments/order-status/${encodeURIComponent(orderNumber)}`);
        const data = await res.json();
        if (data.paid === true) return true;
      } catch {}
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
  };

  const handleCloseAttempt = async () => {
    if (state === "success" || state === "processing" || state === "verifying") return;
    setState("verifying");
    setConfirmCancel(false);
    await new Promise(r => setTimeout(r, 1000));
    const paid = await verifyPaymentStatus();
    if (paid) {
      triggerSuccess();
    } else {
      setState("ready");
      setConfirmCancel(true);
    }
  };

  const handleForceClose = () => {
    setVisible(false);
    setTimeout(onCancel, 350);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (typeof data !== "object" || data === null) return;
        if (
          data.type === "PAYMOB_SUCCESS" ||
          data.success === true ||
          data.payment_status === "PAID" ||
          data.status === "success"
        ) {
          triggerSuccess();
        } else if (data.type === "PAYMOB_ERROR" || data.success === false || data.type === "PAYMOB_PENDING") {
          // Always verify server-side before showing error/pending
          // Webhook fires concurrently — poll until confirmed or timeout
          const msg = data.message || "فشلت عملية الدفع. يرجى المحاولة مرة أخرى.";
          setState("verifying");
          (async () => {
            const paid = await verifyPaymentStatus(10, 1200);
            if (paid) {
              triggerSuccess();
            } else if (data.type === "PAYMOB_PENDING") {
              setState("ready");
            } else {
              triggerError(msg);
            }
          })();
        } else if (data.type === "PAYMOB_CANCEL") {
          handleCloseAttempt();
        }
      } catch {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleIframeLoad = () => {
    if (state === "loading") setState("ready");
    try {
      const loc = iframeRef.current?.contentWindow?.location?.href;
      if (loc && (loc.includes("payment-return-iframe") || loc.includes("payment-return?"))) {
        const url = new URL(loc);
        const success = url.searchParams.get("success");
        const pending = url.searchParams.get("pending");
        if (success === "true" && pending !== "true") {
          triggerSuccess();
        } else if (success === "false" || success === null) {
          // Don't show failure immediately — poll server (webhook fires concurrently)
          setState("verifying");
          (async () => {
            const paid = await verifyPaymentStatus(10, 1200);
            if (paid) triggerSuccess();
            else if (success === "false") triggerError("لم تكتمل عملية الدفع. يرجى المحاولة مرة أخرى.");
            else setState("ready");
          })();
        }
      }
    } catch {}
  };

  const handleOpenExternal = () => {
    const win = window.open(checkoutUrl, "_blank", "width=520,height=700,scrollbars=yes")
              || window.open(checkoutUrl, "_blank");

    if (!win) {
      // Popup blocked — redirect same tab as last resort
      window.location.href = checkoutUrl;
      return;
    }

    setState("processing");
    const poll = setInterval(async () => {
      try {
        if (win.closed) {
          clearInterval(poll);
          setState("verifying");
          await new Promise(r => setTimeout(r, 1500));
          const paid = await verifyPaymentStatus();
          if (paid) {
            triggerSuccess();
          } else {
            setState("ready");
          }
        }
      } catch {
        clearInterval(poll);
      }
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col justify-end"
      dir="rtl"
      style={{ pointerEvents: "all" }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={state === "ready" ? () => handleCloseAttempt() : undefined}
      />

      <div
        className="relative bg-background rounded-t-[28px] shadow-2xl transition-transform duration-400 ease-out"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">أكمل الدفع الآن</p>
              <p className="text-xs text-muted-foreground">بوابة PayMob المعتمدة في السعودية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[11px] text-muted-foreground leading-none">الإجمالي</span>
              <span className="font-black text-base text-primary leading-tight">
                {amount.toFixed(2)} <span className="text-xs font-medium">ر.س</span>
              </span>
            </div>
            {(state === "ready" || state === "error") && (
              <button
                onClick={() => handleCloseAttempt()}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                data-testid="button-paymob-close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          {state === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <p className="text-sm font-medium">جارٍ تحميل صفحة الدفع...</p>
            </div>
          )}

          {state === "verifying" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/95 z-20 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <p className="text-sm font-semibold">جارٍ التحقق من حالة الدفع...</p>
              <p className="text-xs text-muted-foreground">يرجى الانتظار، لا تغلق هذه الصفحة</p>
            </div>
          )}

          {state === "processing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
              <p className="text-sm font-semibold">تم فتح صفحة الدفع في نافذة جديدة</p>
              <p className="text-xs text-muted-foreground leading-relaxed">أكمل عملية الدفع، ثم عد هنا.</p>
            </div>
          )}

          {state === "success" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10 px-8 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <div>
                <p className="font-bold text-lg text-green-700 dark:text-green-400">تم الدفع بنجاح!</p>
                <p className="text-sm text-muted-foreground mt-1">رقم الطلب: <span className="font-mono font-bold">{orderNumber}</span></p>
              </div>
              <p className="text-xs text-muted-foreground animate-pulse">جارٍ تحويلك لمتابعة طلبك...</p>
            </div>
          )}

          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10 px-8 text-center">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <p className="font-bold text-base text-red-600">فشلت عملية الدفع</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-xs">{errorMessage || "يرجى التحقق من بيانات بطاقتك."}</p>
              </div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button variant="outline" onClick={handleForceClose} className="flex-1">إلغاء</Button>
                <Button onClick={() => setState("ready")} className="flex-1">إعادة المحاولة</Button>
              </div>
            </div>
          )}

          {confirmCancel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/95 z-20 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-base">هل تريد إلغاء الدفع؟</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-xs">
                  إذا كنت قد أكملت الدفع بالفعل، سيظهر طلبك قريباً في "طلباتي".
                </p>
              </div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button
                  variant="outline"
                  onClick={() => { setConfirmCancel(false); setState("ready"); }}
                  className="flex-1"
                >
                  العودة للدفع
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleForceClose}
                  className="flex-1"
                >
                  إلغاء الدفع
                </Button>
              </div>
            </div>
          )}

          {(state === "ready" || state === "loading") && (
            <iframe
              ref={iframeRef}
              src={checkoutUrl}
              title="PayMob Checkout"
              width="100%"
              height="100%"
              style={{ border: "none", display: "block", minHeight: "420px", height: "calc(92vh - 200px)" }}
              allow="payment; camera"
              onLoad={handleIframeLoad}
            />
          )}
        </div>

        <div className="px-4 pt-3 pb-4 border-t flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenExternal}
            className="flex items-center gap-2 w-full text-muted-foreground hover:text-foreground h-9"
            data-testid="button-paymob-open-tab"
            disabled={state === "success" || state === "processing" || state === "verifying"}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-xs">فتح صفحة الدفع في متصفحي</span>
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span>جميع المعاملات مشفرة ومؤمّنة — مدى · فيزا · ماستركارد</span>
          </div>
        </div>
      </div>
    </div>
  );
}
