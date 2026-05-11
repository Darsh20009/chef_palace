import { useEffect, useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentStatus = "loading" | "success" | "failed" | "pending";

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function PaymentReturnPage() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    const orderNum = params.get("orderNumber");
    const provider = params.get("provider") || "paymob";
    setOrderNumber(orderNum);

    const paymobSuccess = params.get("success");
    const paymobPending = params.get("pending");
    const geideaResponseCode = params.get("geideaResponseCode") || params.get("responseCode");
    const geideaStatus = params.get("geideaStatus") || params.get("status");
    const geideaOrderId = params.get("geideaOrderId") || params.get("orderId");
    const geideaMerchantRefId = params.get("geideaMerchantRefId") || params.get("merchantReferenceId");
    const geideaAmount = params.get("geideaAmount") || params.get("amount");
    const geideaCurrency = params.get("geideaCurrency") || params.get("currency");
    const geideaSignature = params.get("geideaSignature") || params.get("signature");

    const orderRef = params.get("orderRef") || "";

    const verifyOrderPaid = async (ref: string, retries = 10, delayMs = 1200): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(`/api/payments/order-status/${encodeURIComponent(ref)}`);
          const data = await res.json();
          if (data.paid === true) return true;
        } catch {}
        if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
      }
      return false;
    };

    const resolvePaymob = async () => {
      if (paymobSuccess === "true" && paymobPending !== "true") {
        setStatus("success");
        setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
        try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", session }, "*"); } catch {}
        if (!isInIframe()) {
          setTimeout(() => navigate("/my-orders"), 2500);
        }
      } else if (paymobSuccess === "false" || paymobPending === "true" || paymobSuccess === null) {
        // Don't immediately fail — verify with server (webhook may have confirmed payment)
        setStatus("loading");
        setMessage(tc("جاري التحقق من حالة الدفع...", "Checking payment status..."));

        const ref = orderRef || session;
        if (ref) {
          await new Promise(r => setTimeout(r, 2500));
          const paid = await verifyOrderPaid(ref);
          if (paid) {
            setStatus("success");
            setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
            try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", session }, "*"); } catch {}
            if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 2500);
            return;
          }
        }

        if (paymobSuccess === "false") {
          setStatus("failed");
          setMessage(tc("لم تتم عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment was not completed. Please try again."));
          try { window.parent.postMessage({ type: "PAYMOB_ERROR", status: "failed", session }, "*"); } catch {}
        } else if (paymobPending === "true") {
          setStatus("pending");
          setMessage(tc("الدفع قيد المعالجة...", "Payment is being processed..."));
          try { window.parent.postMessage({ type: "PAYMOB_PENDING", status: "pending", session }, "*"); } catch {}
        } else {
          setStatus("pending");
          setMessage(tc("جاري التحقق من حالة الدفع...", "Checking payment status..."));
        }
      }
    };

    if (session && (paymobSuccess !== null || !geideaResponseCode)) {
      resolvePaymob();
      return;
    }

    const verifyPayment = async () => {
      try {
        const body: any = { provider, sessionId: geideaOrderId || geideaMerchantRefId || session };
        if (geideaResponseCode !== null) {
          Object.assign(body, { geideaResponseCode, geideaStatus, geideaOrderId, geideaMerchantRefId, geideaAmount, geideaCurrency, geideaSignature });
        }
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.verified) {
          setStatus("success");
          setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
          try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", session }, "*"); } catch {}
          if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 2500);
        } else {
          const isPaidByCode = geideaResponseCode === "000" || geideaStatus === "Success" || geideaStatus === "succeeded";
          if (isPaidByCode) {
            setStatus("success");
            setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
            try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", session }, "*"); } catch {}
            if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 2500);
          } else if (geideaResponseCode !== null) {
            setStatus("failed");
            setMessage(tc("لم تتم عملية الدفع. يرجى المحاولة مرة أخرى.", "Payment was not completed. Please try again."));
            try { window.parent.postMessage({ type: "PAYMOB_ERROR", status: "failed" }, "*"); } catch {}
          } else {
            setStatus("pending");
            setMessage(tc("جاري التحقق من حالة الدفع...", "Checking payment status..."));
          }
        }
      } catch {
        if (geideaResponseCode === "000" || geideaStatus === "Success") {
          setStatus("success");
          setMessage(tc("تمت عملية الدفع بنجاح! شكراً لك.", "Payment successful! Thank you."));
          try { window.parent.postMessage({ type: "PAYMOB_SUCCESS", status: "success", session }, "*"); } catch {}
          if (!isInIframe()) setTimeout(() => navigate("/my-orders"), 2500);
        } else {
          setStatus("failed");
          setMessage(tc("حدث خطأ أثناء التحقق من الدفع.", "An error occurred while verifying payment."));
          try { window.parent.postMessage({ type: "PAYMOB_ERROR", status: "failed" }, "*"); } catch {}
        }
      }
    };

    verifyPayment();
  }, []);

  if (isInIframe()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background" dir="rtl">
        <div className="text-center space-y-4">
          {status === "loading" && <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />}
          {status === "success" && <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />}
          {status === "failed" && <XCircle className="w-12 h-12 text-red-500 mx-auto" />}
          {status === "pending" && <Loader2 className="w-12 h-12 animate-spin text-yellow-500 mx-auto" />}
          <p className="text-sm font-medium">{message || tc("جاري معالجة الدفع...", "Processing payment...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
              <h1 className="text-2xl font-bold">{tc("جاري التحقق من الدفع...", "Verifying Payment...")}</h1>
              <p className="text-muted-foreground">{tc("يرجى الانتظار، لا تغلق هذه الصفحة", "Please wait, do not close this page")}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto animate-in zoom-in duration-500" />
              <h1 className="text-3xl font-bold text-green-600">{tc("تم الدفع بنجاح!", "Payment Successful!")}</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              {orderNumber && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">{tc("رقم الطلب", "Order Number")}</p>
                  <p className="text-xl font-bold font-mono text-green-700 dark:text-green-400">#{orderNumber}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground animate-pulse">{tc("سيتم تحويلك لمتابعة طلبك...", "Redirecting to your orders...")}</p>
              <Button size="lg" className="w-full" onClick={() => navigate("/my-orders")} data-testid="button-view-order">
                {tc("متابعة طلبي", "Track my order")}
              </Button>
            </>
          )}

          {status === "failed" && (
            <>
              <XCircle className="w-20 h-20 text-red-500 mx-auto animate-in zoom-in duration-500" />
              <h1 className="text-3xl font-bold text-red-600">{tc("فشل الدفع", "Payment Failed")}</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              <Button size="lg" className="w-full" onClick={() => navigate("/")} data-testid="button-retry-payment">
                {tc("إعادة المحاولة", "Try Again")}
              </Button>
            </>
          )}

          {status === "pending" && (
            <>
              <Loader2 className="w-20 h-20 text-yellow-500 mx-auto animate-spin" />
              <h1 className="text-3xl font-bold text-yellow-600">{tc("جاري المعالجة", "Processing")}</h1>
              <p className="text-muted-foreground text-lg">{message}</p>
              <Button size="lg" variant="outline" className="w-full" onClick={() => navigate("/my-orders")} data-testid="button-check-order">
                {tc("التحقق من حالة الطلب", "Check Order Status")}
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {tc("مدعوم بواسطة PayMob — بوابة الدفع المعتمدة في السعودية", "Powered by PayMob — Certified Saudi Payment Gateway")}
        </p>
      </div>
    </div>
  );
}
