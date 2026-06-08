import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import SarIconComponent from "@/components/sar-icon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight, ArrowLeft, Printer, Loader2, AlertCircle, Receipt, User, Phone,
  Calendar, MapPin, CreditCard, Coffee, Hash, CheckCircle2, Clock, Truck, ChefHat,
} from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";
import { brand } from "@/lib/brand";
import { printTaxInvoice } from "@/lib/print-utils";

interface OrderItem {
  id?: string;
  coffeeItemId?: string;
  nameAr?: string;
  nameEn?: string;
  quantity: number;
  price: number | string;
  selectedSize?: string;
  notes?: string;
  selectedAddons?: any[];
  coffeeItem?: { nameAr?: string; nameEn?: string; price?: string | number };
}
interface OrderDetail {
  id: string;
  _id?: string;
  dailyNumber?: number | string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  totalAmount: number | string;
  subtotal?: number | string;
  taxAmount?: number | string;
  discount?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  status: string;
  channel?: string;
  orderType?: string;
  branchId?: string;
  tableNumber?: string | number;
  createdAt?: string;
  notes?: string;
  items?: OrderItem[];
  orderItems?: OrderItem[];
  deliveryAddress?: any;
}

const STATUS_MAP: Record<string, { ar: string; en: string; color: string; icon: any }> = {
  pending: { ar: "قيد الانتظار", en: "Pending", color: "bg-amber-500", icon: Clock },
  pending_payment: { ar: "بانتظار الدفع", en: "Awaiting Payment", color: "bg-amber-500", icon: CreditCard },
  confirmed: { ar: "مؤكَّد", en: "Confirmed", color: "bg-blue-500", icon: CheckCircle2 },
  preparing: { ar: "قيد التحضير", en: "Preparing", color: "bg-orange-500", icon: ChefHat },
  ready: { ar: "جاهز", en: "Ready", color: "bg-emerald-500", icon: CheckCircle2 },
  out_for_delivery: { ar: "في الطريق", en: "On the way", color: "bg-blue-600", icon: Truck },
  delivered: { ar: "تم التسليم", en: "Delivered", color: "bg-emerald-600", icon: CheckCircle2 },
  completed: { ar: "مكتمل", en: "Completed", color: "bg-emerald-700", icon: CheckCircle2 },
  cancelled: { ar: "ملغي", en: "Cancelled", color: "bg-red-500", icon: AlertCircle },
};

function SarIcon() { return <SarIconComponent size={12} />; }

export default function OrderReceiptPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const isRtl = !isEn;

  const { data: order, isLoading, isError, error } = useQuery<OrderDetail>({
    queryKey: ["/api/orders", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: !!params.id,
    retry: 1,
  });

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">{tc("جارٍ تحميل تفاصيل الطلب...", "Loading order details...")}</p>
        </div>
      </div>
    );
  }

  // ─── Error / not found ──────────────────────────────────────────────────────
  if (isError || !order) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-6" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-black mb-2">{tc("الطلب غير موجود", "Order Not Found")}</h1>
          <p className="text-muted-foreground mb-2">
            {tc("تعذّر العثور على هذا الطلب. ربما تم حذفه أو الرابط غير صحيح.", "We couldn't find this order. It may have been deleted or the link is invalid.")}
          </p>
          <p className="text-xs text-muted-foreground/60 mb-6 font-mono break-all">{params.id}</p>
          {(error as any)?.message && (
            <p className="text-xs text-red-500 mb-4 font-mono">{(error as any).message}</p>
          )}
          <Button onClick={() => setLocation("/manager/dashboard")} className="w-full" data-testid="button-back-dashboard">
            {isRtl ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />}
            {tc("العودة للوحة التحكم", "Back to Dashboard")}
          </Button>
        </Card>
      </div>
    );
  }

  // ─── Data prep ───────────────────────────────────────────────────────────────
  const items: OrderItem[] = order.orderItems?.length ? order.orderItems : (order.items || []);
  const total = Number(order.totalAmount || 0);
  const subtotal = Number(order.subtotal || total / 1.15);
  const tax = Number(order.taxAmount || total - subtotal);
  const discount = Number(order.discount || 0);
  const num = order.dailyNumber || order.orderNumber || String(order.id || "").slice(-6);
  const statusInfo = STATUS_MAP[order.status] || { ar: order.status, en: order.status, color: "bg-muted", icon: Hash };
  const StatusIcon = statusInfo.icon;

  const paymentLabel = (() => {
    const m = (order.paymentMethod || "").toLowerCase();
    if (m === "cash") return tc("نقدي", "Cash");
    if (m === "apple_pay" || m === "paymob-apple-pay" || m === "neoleap-apple-pay") return "Apple Pay";
    if (m === "stc-pay" || m === "stc_pay") return "STC Pay";
    if (m === "mada") return tc("مدى", "Mada");
    if (m === "pos" || m === "pos-network" || m === "card" || m === "network" || m === "external_pos") return tc("شبكة", "Network");
    if (m === "qirox-card" || m === "qirox_card" || m === "qahwa-card" || m === "loyalty-card" || m === "loyalty") return tc("بطاقة ولاء", "Loyalty Card");
    if (m === "geidea" || m === "paymob-card" || m === "paymob") return tc("بطاقة ائتمان", "Credit Card");
    if (m === "bank_transfer" || m === "rajhi" || m === "alinma") return tc("تحويل بنكي", "Bank Transfer");
    if (m === "split") return tc("نقدي + شبكة", "Split");
    if (m === "online") return tc("دفع إلكتروني", "Online Payment");
    return order.paymentMethod || tc("غير محدد", "N/A");
  })();

  const orderDate = order.createdAt ? new Date(order.createdAt) : null;

  const handlePrint = async () => {
    try {
      await printTaxInvoice({
        orderNumber: String(num),
        customerName: order.customerName || "—",
        customerPhone: order.customerPhone || "",
        items: items.map(it => ({
          coffeeItem: {
            nameAr: it.nameAr || it.coffeeItem?.nameAr || "",
            nameEn: it.nameEn || it.coffeeItem?.nameEn || "",
            price: String(it.price ?? it.coffeeItem?.price ?? 0),
          },
          quantity: it.quantity,
          selectedSize: it.selectedSize,
        })),
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: paymentLabel,
        employeeName: tc("لوحة الإدارة", "Admin"),
        date: order.createdAt || new Date().toISOString(),
      }, { autoPrint: true });
    } catch (e) {
      console.warn("[OrderReceipt] Print failed:", e);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-6 px-4" dir={isRtl ? "rtl" : "ltr"} data-testid="page-order-receipt">
      {/* Top bar (hidden in print) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => window.history.back()} data-testid="button-back">
          {isRtl ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />}
          {tc("رجوع", "Back")}
        </Button>
        <Button onClick={handlePrint} data-testid="button-print">
          <Printer className="w-4 h-4 me-2" />
          {tc("طباعة الفاتورة", "Print Invoice")}
        </Button>
      </div>

      {/* Receipt card */}
      <Card className="max-w-3xl mx-auto overflow-hidden shadow-xl">
        {/* Header — brand */}
        <div className="bg-gradient-to-br from-primary via-primary/95 to-emerald-700 text-white p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                <Coffee className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black leading-tight">{tc(brand.nameAr, brand.nameEn)}</h1>
                <p className="text-xs text-white/80">{tc(brand.taglineAr || "", brand.taglineEn || "")}</p>
              </div>
            </div>
            <Badge className={`${statusInfo.color} text-white border-0 px-3 py-1.5 text-sm font-bold flex items-center gap-1.5`}>
              <StatusIcon className="w-4 h-4" />
              {tc(statusInfo.ar, statusInfo.en)}
            </Badge>
          </div>

          <Separator className="my-5 bg-white/20" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-white/60 text-xs mb-0.5">{tc("رقم الطلب", "Order #")}</p>
              <p className="font-black text-lg" data-testid="text-order-number">#{num}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-0.5">{tc("النوع", "Type")}</p>
              <p className="font-bold">{
                order.orderType === "dine-in" || order.orderType === "table"
                  ? tc("داخل المقهى", "Dine-in")
                  : order.orderType === "takeaway"
                  ? tc("سفري", "Takeaway")
                  : order.orderType === "delivery"
                  ? tc("توصيل", "Delivery")
                  : order.orderType || "—"
              }</p>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-0.5">{tc("القناة", "Channel")}</p>
              <p className="font-bold capitalize">{order.channel || "—"}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-0.5">{tc("التاريخ", "Date")}</p>
              <p className="font-bold text-xs">
                {orderDate
                  ? orderDate.toLocaleString(isEn ? "en-GB" : "ar-SA", { dateStyle: "short", timeStyle: "short" })
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div className="p-6 bg-white border-b">
          <h2 className="font-black text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            {tc("بيانات العميل", "Customer Info")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-semibold" data-testid="text-customer-name">{order.customerName || tc("بدون اسم", "Anonymous")}</span></div>
            {order.customerPhone && (
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-semibold" data-testid="text-customer-phone" dir="ltr">{order.customerPhone}</span></div>
            )}
            {order.tableNumber && (
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-semibold">{tc("طاولة", "Table")} #{order.tableNumber}</span></div>
            )}
          </div>
          {order.notes && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <strong>{tc("ملاحظات: ", "Notes: ")}</strong>{order.notes}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="p-6">
          <h2 className="font-black text-sm text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            {tc(`الأصناف (${items.length})`, `Items (${items.length})`)}
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Coffee className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{tc("لا توجد أصناف في هذا الطلب", "No items in this order")}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {items.map((it, idx) => {
                  const name = isEn
                    ? (it.nameEn || it.coffeeItem?.nameEn || it.nameAr || "—")
                    : (it.nameAr || it.coffeeItem?.nameAr || it.nameEn || "—");
                  const price = Number(it.price ?? it.coffeeItem?.price ?? 0);
                  const lineTotal = price * it.quantity;
                  return (
                    <div key={it.id || idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl" data-testid={`item-receipt-${idx}`}>
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
                        {it.quantity}×
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{name}</p>

                        {/* Size with its price as a dimension reference */}
                        {it.selectedSize && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-blue-700 font-bold">📏 {tc("الحجم: ", "Size: ")}</span>
                            <span className="text-xs font-bold text-blue-900">{it.selectedSize}</span>
                            <span className="text-[10px] text-blue-600 font-semibold ms-1">({price.toFixed(2)} <SarIcon />)</span>
                          </div>
                        )}

                        {/* Each add-on on its own row with its name + price (no duplication) */}
                        {it.selectedAddons && it.selectedAddons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                              {tc("الإضافات", "Add-ons")}
                            </p>
                            {(() => {
                              // De-duplicate add-ons by name+price; count them up
                              const grouped = new Map<string, { name: string; price: number; qty: number }>();
                              for (const a of it.selectedAddons as any[]) {
                                const aName = isEn
                                  ? (a?.nameEn || a?.nameAr || a?.name || "—")
                                  : (a?.nameAr || a?.nameEn || a?.name || "—");
                                const aPrice = Number(a?.price ?? 0);
                                const aQty = Number(a?.quantity ?? 1);
                                const key = `${aName}::${aPrice}`;
                                const prev = grouped.get(key);
                                if (prev) prev.qty += aQty;
                                else grouped.set(key, { name: aName, price: aPrice, qty: aQty });
                              }
                              return Array.from(grouped.values()).map((a, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1"
                                  data-testid={`addon-row-${idx}-${i}`}
                                >
                                  <span className="text-xs font-semibold text-emerald-900 truncate">
                                    {a.qty > 1 && <span className="font-black me-1">{a.qty}×</span>}
                                    + {a.name}
                                  </span>
                                  <span className="text-xs font-bold text-emerald-700 shrink-0 ms-2">
                                    {(a.price * a.qty).toFixed(2)} <SarIcon />
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        )}

                        {it.notes && (
                          <div className="mt-1.5 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            <span className="text-[11px] text-amber-800">📝 {it.notes}</span>
                          </div>
                        )}

                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {tc("سعر الوحدة:", "Unit price:")} {price.toFixed(2)} <SarIcon /> × {it.quantity}
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-black text-primary">{lineTotal.toFixed(2)} <SarIcon /></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Totals */}
        <div className="px-6 pb-6">
          <Separator className="mb-4" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{tc("الإجمالي قبل الضريبة", "Subtotal")}</span><span className="font-semibold">{subtotal.toFixed(2)} <SarIcon /></span></div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>{tc("الخصم", "Discount")}</span><span className="font-semibold">- {discount.toFixed(2)} <SarIcon /></span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">{tc("ضريبة القيمة المضافة 15%", "VAT 15%")}</span><span className="font-semibold">{tax.toFixed(2)} <SarIcon /></span></div>
            <Separator />
            <div className="flex justify-between text-xl font-black pt-2">
              <span>{tc("الإجمالي المستحق", "Grand Total")}</span>
              <span className="text-primary" data-testid="text-grand-total">{total.toFixed(2)} <SarIcon /></span>
            </div>
          </div>

          <div className="mt-5 p-4 bg-muted/40 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{tc("طريقة الدفع", "Payment Method")}</p>
              <p className="font-bold" data-testid="text-payment-method">{paymentLabel}</p>
            </div>
            {order.paymentStatus && (
              <Badge variant={order.paymentStatus === "paid" ? "default" : "outline"}>
                {order.paymentStatus === "paid"
                  ? tc("مدفوع", "Paid")
                  : order.paymentStatus === "awaiting_external"
                  ? tc("بانتظار البطاقة", "Awaiting card")
                  : tc("معلَّق", "Pending")}
              </Badge>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/30 px-6 py-4 text-center text-xs text-muted-foreground border-t">
          <p className="mb-1">{tc("شكراً لاختياركم", "Thank you for choosing")} <strong>{tc(brand.nameAr, brand.nameEn)}</strong></p>
          {brand.website && <p className="text-[11px]">{brand.website}</p>}
        </div>
      </Card>
    </div>
  );
}
