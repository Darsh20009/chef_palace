import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Loader2, QrCode, Smartphone } from "lucide-react";
import SarIcon from "@/components/sar-icon";

interface QrPayModalProps {
  open: boolean;
  onClose: () => void;
  /** Unguessable order id (nanoid) used in the public QR URL. */
  payId: string;
  /** Human-readable order number, used only for status polling + display. */
  orderNumber: string;
  amount: number;
  onPaid?: () => void;
}

export default function QrPayModal({ open, onClose, payId, orderNumber, amount, onPaid }: QrPayModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [status, setStatus] = useState<"waiting" | "paid" | "error">("waiting");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const paidFiredRef = useRef(false);

  const payUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/order/${encodeURIComponent(payId)}`
      : `/pay/order/${encodeURIComponent(payId)}`;

  // Build the QR image whenever the modal opens for a new order
  useEffect(() => {
    if (!open || !payId) return;
    setStatus("waiting");
    setCopied(false);
    paidFiredRef.current = false;
    QRCode.toDataURL(payUrl, {
      width: 320,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setStatus("error"));
  }, [open, payId, payUrl]);

  // Poll the order status while the modal is open
  useEffect(() => {
    if (!open || !orderNumber) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/payments/order-status/${encodeURIComponent(orderNumber)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.paid === true && !paidFiredRef.current) {
          paidFiredRef.current = true;
          setStatus("paid");
          try { onPaid && onPaid(); } catch {}
          setTimeout(() => {
            if (!cancelled) onClose();
          }, 1800);
        }
      } catch { /* swallow — keep polling */ }
    };

    tick();
    pollRef.current = window.setInterval(tick, 3000) as any;
    return () => {
      cancelled = true;
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, orderNumber, onClose, onPaid]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" dir="rtl" data-testid="dialog-qr-pay">
        <DialogHeader className="px-5 pt-4 pb-3 border-b bg-gradient-to-l from-primary/10 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="w-5 h-5 text-primary" />
            ادفع من جوالك عبر باي موب
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 flex flex-col items-center gap-4">
          {/* Order summary card */}
          <div className="w-full bg-muted/40 rounded-2xl p-3 flex items-center justify-between">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground leading-none">رقم الفاتورة</p>
              <p className="font-mono font-bold text-sm" data-testid="text-qr-order-number">{orderNumber}</p>
            </div>
            <div className="text-left">
              <p className="text-[11px] text-muted-foreground leading-none">المبلغ</p>
              <p className="font-black text-lg text-primary flex items-center gap-1" data-testid="text-qr-amount">
                {amount.toFixed(2)} <SarIcon size={14} />
              </p>
            </div>
          </div>

          {/* QR */}
          <div className="relative">
            <div className="w-[260px] h-[260px] rounded-2xl bg-white border-2 border-primary/20 shadow-lg flex items-center justify-center overflow-hidden">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className={`w-full h-full transition-opacity duration-300 ${status === "paid" ? "opacity-30" : "opacity-100"}`}
                  data-testid="img-qr-code"
                />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              )}
            </div>

            {status === "paid" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-50/95 dark:bg-green-950/80 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <p className="font-bold text-green-700 dark:text-green-300" data-testid="text-qr-paid">تم الدفع بنجاح!</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          {status === "waiting" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground text-center">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>اطلب من العميل مسح الباركود بكاميرا الجوال — سيفتح صفحة دفع آمنة عبر باي موب</span>
            </div>
          )}

          {/* Live indicator */}
          {status === "waiting" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="font-medium text-muted-foreground">بانتظار الدفع…</span>
            </div>
          )}

          {/* Copy link as fallback */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-dashed text-xs hover:bg-muted/40 transition-colors"
            data-testid="button-qr-copy-link"
          >
            <span className="truncate font-mono text-muted-foreground" dir="ltr">{payUrl}</span>
            <span className="shrink-0 flex items-center gap-1 text-primary font-bold">
              <Copy className="w-3 h-3" /> {copied ? "تم!" : "نسخ"}
            </span>
          </button>

          <Button variant="outline" className="w-full" onClick={onClose} data-testid="button-qr-close">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
