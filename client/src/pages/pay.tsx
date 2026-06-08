import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Receipt, ShieldCheck, CheckCircle2, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SarIcon from "@/components/sar-icon";
import PaymobCheckout from "@/components/paymob-checkout";
import { brand } from "@/lib/brand";
import { useTranslate } from "@/lib/useTranslate";

interface PublicOrderItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface PublicOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  subtotal: number;
  tax: number;
  tableNumber?: string;
  items: PublicOrderItem[];
  alreadyPaid: boolean;
}

interface PublicTablePayload {
  table: { tableNumber: string; branchId?: string };
  bills: PublicOrder[];
}

type PageMode = "order" | "table";

export default function PayPage() {
  const tc = useTranslate();
  // The URL param is the unguessable order `id` (nanoid), not the order number.
  const [orderMatch, orderParams] = useRoute("/pay/order/:id");
  const [tableMatch, tableParams] = useRoute("/pay/table/:qrToken");

  const mode: PageMode = orderMatch ? "order" : "table";
  const payId = orderMatch ? decodeURIComponent(orderParams?.id || "") : "";
  const qrToken = tableMatch ? decodeURIComponent(tableParams?.qrToken || "") : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PublicOrder | null>(null);
  const [tableBills, setTableBills] = useState<PublicTablePayload | null>(null);

  // Payment flow state
  const [initiating, setInitiating] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Load the bill(s)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (mode === "order" && payId) {
          const r = await fetch(`/api/pay/order/${encodeURIComponent(payId)}`);
          const data = await r.json();
          if (cancelled) return;
          if (!r.ok || data?.error) {
            setError(data?.error || tc("تعذّر العثور على الفاتورة.", "Invoice not found."));
          } else {
            setSelectedOrder(data as PublicOrder);
            if (data.alreadyPaid) setPaid(true);
          }
        } else if (mode === "table" && qrToken) {
          const r = await fetch(`/api/pay/table/${encodeURIComponent(qrToken)}`);
          const data = await r.json();
          if (cancelled) return;
          if (!r.ok || data?.error) {
            setError(data?.error || tc("تعذّر تحميل بيانات الطاولة.", "Failed to load table data."));
          } else {
            setTableBills(data as PublicTablePayload);
          }
        } else {
          setError(tc("الرابط غير صالح.", "Invalid link."));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || tc("خطأ في الاتصال.", "Connection error."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [mode, payId, qrToken]);

  // Poll for paid status while user is on this page (in case payment completes via redirect)
  useEffect(() => {
    if (!selectedOrder || paid) return;
    const id = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/payments/order-status/${encodeURIComponent(selectedOrder.orderNumber)}`);
        const d = await r.json();
        if (d?.paid === true) setPaid(true);
      } catch {}
    }, 4000);
    return () => window.clearInterval(id);
  }, [selectedOrder, paid]);

  const handleStartPayment = async (order: PublicOrder) => {
    setInitiating(true);
    setPayError(null);
    setSelectedOrder(order);
    try {
      const res = await fetch("/api/payments/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.total,
          currency: "SAR",
          orderId: order.orderNumber,
          customerName: "Guest",
          paymentMethod: "paymob-card",
          returnUrl: `${window.location.origin}/pay/order/${encodeURIComponent(order.id)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.paymentUrl) {
        throw new Error(data?.error || data?.details || tc("تعذّر بدء عملية الدفع.", "Failed to initiate payment."));
      }
      setCheckoutUrl(data.paymentUrl);
    } catch (e: any) {
      setPayError(e?.message || "خطأ غير متوقع.");
    } finally {
      setInitiating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background gap-3" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{tc("جارٍ تحميل الفاتورة…", "Loading invoice…")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4 bg-background" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="font-bold text-lg">{tc("تعذّر تحميل الفاتورة", "Failed to load invoice")}</h1>
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4 bg-gradient-to-b from-green-50 to-background dark:from-green-950/30" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center animate-in zoom-in duration-500">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="font-bold text-xl text-green-700 dark:text-green-300">{tc("تم الدفع بنجاح", "Payment Successful")}</h1>
        <p className="text-sm text-muted-foreground max-w-xs">{tc("شكراً لك! يمكنك إغلاق هذه الصفحة الآن.", "Thank you! You can close this page now.")}</p>
        {selectedOrder && (
          <p className="font-mono text-xs text-muted-foreground">{tc("رقم الفاتورة:", "Invoice #:")} {selectedOrder.orderNumber}</p>
        )}
      </div>
    );
  }

  const renderOrderCard = (order: PublicOrder, idx?: number) => (
    <Card key={order.orderNumber} className="border-2 shadow-md" data-testid={`card-bill-${order.orderNumber}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">{tc("فاتورة", "Invoice")} <span className="font-mono">#{order.orderNumber}</span></span>
          </div>
          {order.tableNumber && (
            <span className="text-xs bg-muted px-2 py-1 rounded-full">{tc("طاولة", "Table")} {order.tableNumber}</span>
          )}
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {order.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex-1 truncate">
                {it.name} <span className="text-muted-foreground">× {it.quantity}</span>
              </span>
              <span className="font-mono shrink-0 flex items-center gap-1">
                {it.total.toFixed(2)} <SarIcon size={10} />
              </span>
            </div>
          ))}
        </div>

        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{tc("المجموع قبل الضريبة", "Subtotal")}</span>
            <span className="font-mono flex items-center gap-1">{order.subtotal.toFixed(2)} <SarIcon size={10} /></span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{tc("ضريبة القيمة المضافة 15%", "VAT 15%")}</span>
            <span className="font-mono flex items-center gap-1">{order.tax.toFixed(2)} <SarIcon size={10} /></span>
          </div>
          <div className="flex justify-between font-black text-lg pt-1 border-t">
            <span>{tc("الإجمالي", "Total")}</span>
            <span className="font-mono text-primary flex items-center gap-1">
              {order.total.toFixed(2)} <SarIcon size={14} />
            </span>
          </div>
        </div>

        <Button
          className="w-full h-12 gap-2 font-bold text-base"
          onClick={() => handleStartPayment(order)}
          disabled={initiating}
          data-testid={`button-pay-${order.orderNumber}`}
        >
          {initiating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
          {tc("ادفع الآن عبر باي موب", "Pay Now via PayMob")}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background" dir="rtl">
      <div className="max-w-md mx-auto px-4 pt-8 pb-12 space-y-5">
        {/* Branding header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            {tc("دفع آمن عبر", "Secure payment via")} {brand.platformNameAr || brand.nameAr}
          </div>
          {tableBills?.table && (
            <h1 className="text-2xl font-black pt-2">{tc("طاولة", "Table")} {tableBills.table.tableNumber}</h1>
          )}
          {selectedOrder && !tableBills && (
            <h1 className="text-xl font-black pt-2">{tc("فاتورتك جاهزة للدفع", "Your invoice is ready to pay")}</h1>
          )}
        </div>

        {payError && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            {payError}
          </div>
        )}

        {/* Bills */}
        {mode === "order" && selectedOrder && renderOrderCard(selectedOrder)}
        {mode === "table" && tableBills && (
          tableBills.bills.length === 0 ? (
            <Card className="border-2">
              <CardContent className="p-6 text-center space-y-2">
                <Receipt className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-bold">{tc("لا توجد فواتير مفتوحة لهذه الطاولة", "No open bills for this table")}</p>
                <p className="text-xs text-muted-foreground">{tc("إذا كنت قد طلبت للتو، انتظر بضع لحظات وأعد تحميل الصفحة.", "If you just ordered, wait a moment and reload the page.")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">{tableBills.bills.map((b, i) => renderOrderCard(b, i))}</div>
          )
        )}

        <div className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1.5 pt-2">
          <ShieldCheck className="w-3 h-3 text-green-500" />
          {tc("جميع المعاملات مشفّرة — مدى · فيزا · ماستركارد عبر PayMob", "All transactions encrypted — Mada · Visa · Mastercard via PayMob")}
        </div>
      </div>

      {/* PayMob iframe checkout */}
      {checkoutUrl && selectedOrder && (
        <PaymobCheckout
          orderNumber={selectedOrder.orderNumber}
          amount={selectedOrder.total}
          checkoutUrl={checkoutUrl}
          onSuccess={() => { setPaid(true); setCheckoutUrl(null); }}
          onError={(msg) => { setPayError(msg); setCheckoutUrl(null); }}
          onCancel={() => setCheckoutUrl(null)}
        />
      )}
    </div>
  );
}
