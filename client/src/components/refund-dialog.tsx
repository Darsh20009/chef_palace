import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import SarIcon from "@/components/sar-icon";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { printRefundThermal } from "@/lib/print-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RotateCcw, Search, CheckCircle, Loader2, CreditCard, Banknote,
  SplitSquareVertical, Printer, ChevronRight, ChevronLeft, X,
  AlertTriangle, Package
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface RefundItem {
  coffeeItemId: string;
  nameAr: string;
  nameEn?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  employeeId?: string;
  employeeName?: string;
  tenantId?: string;
}

type RefundPayMethod = "cash" | "card" | "split";


export default function RefundDialog({ open, onOpenChange, branchId, employeeId, employeeName, tenantId }: RefundDialogProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [searchError, setSearchError] = useState("");

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({});

  const [payMethod, setPayMethod] = useState<RefundPayMethod>("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setStep(1);
    setSearchQuery("");
    setFoundOrder(null);
    setSearchError("");
    setSelectedItems({});
    setRefundQtys({});
    setPayMethod("cash");
    setCashAmount("");
    setCardAmount("");
    setReason("");
    setNotes("");
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchError("");
    setFoundOrder(null);
    try {
      let order: any = null;
      const isPhone = /^\d{9,11}$/.test(q.replace(/\D/g, ""));
      if (isPhone) {
        const res = await fetch(`/api/orders/customer/${q}?limit=5`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const orders = Array.isArray(data) ? data : (data.orders || []);
          order = orders[0] || null;
        }
      } else {
        const num = q.replace(/^#/, "");
        const res = await fetch(`/api/orders/number/${num}`, { credentials: "include" });
        if (res.ok) {
          order = await res.json();
        }
      }
      if (!order) {
        setSearchError("لم يتم العثور على الطلب — تحقق من الرقم أو الجوال");
      } else {
        const items = typeof order.items === "string" ? JSON.parse(order.items) : (order.items || []);
        order.items = items;
        setFoundOrder(order);
        const initSel: Record<string, boolean> = {};
        const initQty: Record<string, number> = {};
        items.forEach((item: any, idx: number) => {
          const key = `${item.coffeeItemId || item.id || idx}`;
          initSel[key] = true;
          initQty[key] = Number(item.quantity) || 1;
        });
        setSelectedItems(initSel);
        setRefundQtys(initQty);
      }
    } catch {
      setSearchError("حدث خطأ أثناء البحث");
    } finally {
      setIsSearching(false);
    }
  };

  const getOrderItems = (): any[] => {
    if (!foundOrder) return [];
    return foundOrder.items || [];
  };

  const calcRefundTotal = (): number => {
    return getOrderItems().reduce((sum, item, idx) => {
      const key = `${item.coffeeItemId || item.id || idx}`;
      if (!selectedItems[key]) return sum;
      const qty = refundQtys[key] || 0;
      const price = Number(item.price || item.unitPrice || item.coffeeItem?.price || 0);
      return sum + price * qty;
    }, 0);
  };

  const buildRefundItems = (): RefundItem[] => {
    return getOrderItems()
      .map((item, idx) => {
        const key = `${item.coffeeItemId || item.id || idx}`;
        if (!selectedItems[key]) return null;
        const qty = refundQtys[key] || 0;
        if (qty <= 0) return null;
        const price = Number(item.price || item.unitPrice || item.coffeeItem?.price || 0);
        return {
          coffeeItemId: item.coffeeItemId || item.id || "",
          nameAr: item.coffeeItem?.nameAr || item.nameAr || "صنف",
          nameEn: item.coffeeItem?.nameEn || item.nameEn,
          quantity: qty,
          unitPrice: price,
          subtotal: price * qty,
        };
      })
      .filter(Boolean) as RefundItem[];
  };

  const createRefundMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/refunds", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "✅ تم الاسترجاع بنجاح", description: `إجمالي المسترجع: ${data.refundAmount?.toFixed(2)} ريال` });
      setTimeout(() => {
        printRefundThermal({
          refundId: data.id,
          originalOrderNumber: foundOrder?.orderNumber || "—",
          items: buildRefundItems(),
          refundAmount: data.refundAmount,
          paymentMethod: payMethod,
          cashAmount: payMethod === "split" ? parseFloat(cashAmount) : undefined,
          cardAmount: payMethod === "split" ? parseFloat(cardAmount) : undefined,
          reason,
          employeeName,
          date: format(new Date(), "dd/MM/yyyy HH:mm", { locale: ar }),
          originalPaymentMethod: foundOrder?.paymentMethod,
        });
      }, 300);
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "فشل الاسترجاع", description: err.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const handleConfirmRefund = () => {
    const items = buildRefundItems();
    if (items.length === 0) {
      toast({ title: "اختر صنفاً واحداً على الأقل", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "يرجى إدخال سبب الاسترجاع", variant: "destructive" });
      return;
    }
    const refundAmount = calcRefundTotal();
    if (refundAmount <= 0) {
      toast({ title: "المبلغ المسترجع يجب أن يكون أكبر من صفر", variant: "destructive" });
      return;
    }
    if (payMethod === "split") {
      const cash = parseFloat(cashAmount) || 0;
      const card = parseFloat(cardAmount) || 0;
      if (Math.abs(cash + card - refundAmount) > 0.01) {
        toast({ title: `مجموع النقدي + الشبكة يجب أن يساوي ${refundAmount.toFixed(2)} ريال`, variant: "destructive" });
        return;
      }
    }
    createRefundMutation.mutate({
      originalOrderId: foundOrder?.id || foundOrder?._id,
      originalOrderNumber: foundOrder?.orderNumber,
      branchId: branchId || foundOrder?.branchId,
      tenantId,
      employeeId,
      employeeName,
      items,
      refundAmount,
      paymentMethod: payMethod,
      cashAmount: payMethod !== "card" ? (parseFloat(cashAmount) || refundAmount) : 0,
      cardAmount: payMethod !== "cash" ? (parseFloat(cardAmount) || (payMethod === "card" ? refundAmount : 0)) : 0,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const refundTotal = calcRefundTotal();
  const orderItems = getOrderItems();
  const payMethodLabel: Record<RefundPayMethod, string> = {
    cash: "نقدي",
    card: "شبكة / بطاقة",
    split: "نقدي + شبكة",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <div className="bg-red-100 p-1.5 rounded-lg">
              <RotateCcw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-base font-bold">استرجاع طلب / Refund</p>
              <p className="text-xs font-normal text-muted-foreground">
                الخطوة {step} من 3 —{" "}
                {step === 1 ? "البحث عن الطلب" : step === 2 ? "تحديد الأصناف" : "تفاصيل الاسترجاع"}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 mb-2">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? "bg-red-500" : "bg-muted"}`}
            />
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-1">
          {/* ── Step 1: Search ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-bold">ابحث برقم الطلب أو رقم الجوال</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="مثال: 42  أو  0501234567"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1 text-right"
                    data-testid="input-refund-search"
                  />
                  <Button type="button" onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} data-testid="button-refund-search">
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {searchError}
                </div>
              )}

              {foundOrder && (
                <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-green-500 text-green-700 font-bold">
                      طلب #{foundOrder.orderNumber}
                    </Badge>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">التاريخ</span>
                      <p className="font-medium">{foundOrder.createdAt ? format(new Date(foundOrder.createdAt), "dd/MM/yyyy HH:mm") : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">إجمالي الطلب</span>
                      <p className="font-bold text-green-700">{Number(foundOrder.totalAmount || 0).toFixed(2)} <SarIcon size={12} /></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">طريقة الدفع الأصلية</span>
                      <p className="font-medium">{foundOrder.paymentMethod || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">عدد الأصناف</span>
                      <p className="font-medium">{orderItems.length} صنف</p>
                    </div>
                  </div>
                  {foundOrder.customerInfo?.customerName && (
                    <p className="text-xs text-muted-foreground">العميل: {foundOrder.customerInfo.customerName}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Select Items ──────────────────── */}
          {step === 2 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-muted-foreground">اختر الأصناف المراد استرجاعها وحدد الكمية</p>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => {
                    const allSel: Record<string, boolean> = {};
                    const allQty: Record<string, number> = {};
                    orderItems.forEach((item, idx) => {
                      const key = `${item.coffeeItemId || item.id || idx}`;
                      allSel[key] = true;
                      allQty[key] = Number(item.quantity) || 1;
                    });
                    setSelectedItems(allSel);
                    setRefundQtys(allQty);
                  }}
                >
                  تحديد الكل
                </button>
              </div>

              {orderItems.map((item, idx) => {
                const key = `${item.coffeeItemId || item.id || idx}`;
                const maxQty = Number(item.quantity) || 1;
                const price = Number(item.price || item.unitPrice || item.coffeeItem?.price || 0);
                const qty = refundQtys[key] ?? maxQty;
                const isSelected = !!selectedItems[key];

                return (
                  <div
                    key={key}
                    className={`border rounded-xl p-3 transition-colors ${isSelected ? "border-red-300 bg-red-50/50" : "border-border bg-muted/30 opacity-60"}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedItems(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${isSelected ? "border-red-500 bg-red-500" : "border-muted-foreground"}`}
                        data-testid={`button-refund-select-${key}`}
                      >
                        {isSelected && <span className="text-white text-[11px] font-black leading-none">✓</span>}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{item.coffeeItem?.nameAr || item.nameAr || "صنف"}</p>
                        <p className="text-xs text-muted-foreground">{price.toFixed(2)} <SarIcon size={11} /> للوحدة</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted"
                          onClick={() => setRefundQtys(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? maxQty) - 1) }))}
                          disabled={!isSelected}
                        >−</button>
                        <span className="w-6 text-center text-sm font-bold">{isSelected ? qty : 0}</span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted"
                          onClick={() => setRefundQtys(prev => ({ ...prev, [key]: Math.min(maxQty, (prev[key] ?? maxQty) + 1) }))}
                          disabled={!isSelected || qty >= maxQty}
                        >+</button>
                      </div>

                      <div className="text-left shrink-0 w-16">
                        <p className="text-sm font-bold text-red-600">{isSelected ? (price * qty).toFixed(2) : "0.00"}</p>
                        <p className="text-[10px] text-muted-foreground"><SarIcon size={10} /></p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Separator />
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-200">
                <span className="font-bold text-sm">إجمالي الاسترجاع</span>
                <span className="text-xl font-black text-red-600">{refundTotal.toFixed(2)} <SarIcon size={14} /></span>
              </div>
            </div>
          )}

          {/* ── Step 3: Method & Reason ───────────────── */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-xl border text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">إجمالي الاسترجاع</span>
                  <span className="font-black text-red-600 text-base">{refundTotal.toFixed(2)} <SarIcon size={13} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد الأصناف</span>
                  <span className="font-medium">{buildRefundItems().length} صنف</span>
                </div>
                {foundOrder?.paymentMethod && (
                  <div className="flex justify-between pt-1 border-t border-dashed">
                    <span className="text-muted-foreground">طريقة الدفع الأصلية</span>
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">
                      {foundOrder.paymentMethod}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">طريقة إعادة المبلغ</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "card", "split"] as RefundPayMethod[]).map((m) => {
                    const Icon = m === "cash" ? Banknote : m === "card" ? CreditCard : SplitSquareVertical;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-bold transition-colors ${
                          payMethod === m ? "border-red-500 bg-red-50 text-red-700" : "border-border hover:border-muted-foreground"
                        }`}
                        data-testid={`button-refund-method-${m}`}
                      >
                        <Icon className="w-5 h-5" />
                        {payMethodLabel[m]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {payMethod === "split" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-xl border">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      <Banknote className="w-3 h-3" />المبلغ النقدي
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={cashAmount}
                      onChange={(e) => {
                        setCashAmount(e.target.value);
                        setCardAmount(String(Math.max(0, refundTotal - (parseFloat(e.target.value) || 0)).toFixed(2)));
                      }}
                      className="text-left"
                      data-testid="input-refund-cash-amount"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />مبلغ الشبكة
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={cardAmount}
                      onChange={(e) => {
                        setCardAmount(e.target.value);
                        setCashAmount(String(Math.max(0, refundTotal - (parseFloat(e.target.value) || 0)).toFixed(2)));
                      }}
                      className="text-left"
                      data-testid="input-refund-card-amount"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground text-center">
                    المجموع يجب أن يساوي {refundTotal.toFixed(2)} <SarIcon size={11} />
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-sm font-bold">سبب الاسترجاع <span className="text-red-500">*</span></Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {["منتج تالف", "خطأ في الطلب", "تأخر في التحضير", "العميل غير راضٍ", "طلب مكرر"].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${
                        reason === r ? "bg-red-500 text-white border-red-500" : "border-border hover:bg-muted"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="أو اكتب السبب هنا..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-right"
                  data-testid="input-refund-reason"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-bold">ملاحظات إضافية (اختياري)</Label>
                <Input
                  placeholder="أي تفاصيل إضافية..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-right"
                  data-testid="input-refund-notes"
                />
              </div>
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="flex gap-2 pt-1">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="gap-1" data-testid="button-refund-back">
              <ChevronRight className="w-4 h-4" />
              السابق
            </Button>
          )}

          {step < 3 && (
            <Button
              type="button"
              className="flex-1 gap-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={step === 1 ? !foundOrder : refundTotal <= 0}
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              data-testid="button-refund-next"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}

          {step === 3 && (
            <Button
              type="button"
              className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white font-bold"
              disabled={createRefundMutation.isPending || !reason.trim()}
              onClick={handleConfirmRefund}
              data-testid="button-refund-confirm"
            >
              {createRefundMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              تأكيد الاسترجاع وطباعة الإيصال
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
