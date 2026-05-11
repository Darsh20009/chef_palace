import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Clock, Printer, Banknote, CreditCard, ShoppingCart, AlertCircle, User, Wallet } from "lucide-react";

interface ActiveShift {
  _id: string;
  shiftNumber: string;
  employeeName: string;
  branchName?: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  totalOrders: number;
  totalCashSales: number;
  totalCardSales: number;
  totalDigitalSales: number;
  totalDiscounts: number;
  totalVAT: number;
  netRevenue: number;
  paymentBreakdown: { cash: number; card: number; loyalty: number };
  orderTypeBreakdown: Record<string, number>;
  cashMovements: any[];
  closingNotes?: string;
}

interface AutoShift {
  enabled: boolean;
  autoShiftHours: number;
  period: { start: string; end: string; now: string; index: number };
  totalSales: number;
  totalOrders: number;
  totalCashSales: number;
  totalCardSales: number;
  totalDigitalSales: number;
  totalDiscounts: number;
  totalVAT: number;
  netRevenue: number;
  paymentBreakdown: { cash: number; card: number; loyalty: number };
  orderTypeBreakdown: Record<string, number>;
  employees: Array<{ name: string; orders: number; sales: number }>;
}

const fmtSAR = (n: number) => `${(n || 0).toFixed(2)} ر.س`;
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (s: string) => new Date(s).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
const fmtDuration = (start: string, end?: string) => {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.floor((e - s) / 60000));
  const h = Math.floor(mins / 60);
  return `${h}س ${mins % 60}د`;
};

export function buildShiftReportHtml(opts: {
  title: string;
  subtitle?: string;
  shiftNumber?: string;
  employeeName?: string;
  branchName?: string;
  openedAt: string;
  closedAt?: string;
  openingCash?: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  totalOrders: number;
  totalCashSales: number;
  totalCardSales: number;
  totalDigitalSales: number;
  totalDiscounts: number;
  totalVAT: number;
  netRevenue: number;
  paymentBreakdown: { cash: number; card: number; loyalty: number };
  orderTypeBreakdown: Record<string, number>;
  cashMovements?: Array<{ type: string; amount: number; reason?: string; timestamp?: string }>;
  employees?: Array<{ name: string; orders: number; sales: number }>;
  closingNotes?: string;
}) {
  const cashIn = (opts.cashMovements || []).filter(m => m.type === 'cash_in' || m.type === 'paid_in').reduce((s, m) => s + m.amount, 0);
  const cashOut = (opts.cashMovements || []).filter(m => m.type === 'cash_out' || m.type === 'paid_out').reduce((s, m) => s + m.amount, 0);
  const pb = opts.paymentBreakdown || { cash: 0, card: 0, loyalty: 0 };
  const ob = opts.orderTypeBreakdown || {};
  return `<html dir="rtl"><head><title>${opts.title}</title>
<style>
body{font-family:'Cairo','Tajawal',Arial,sans-serif;padding:12px;max-width:380px;margin:0 auto;font-size:13px;}
.header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:10px;}
.header h1{font-size:18px;margin:5px 0;}
.header h2{font-size:14px;color:#2D9B6E;margin:3px 0;}
.row{display:flex;justify-content:space-between;padding:3px 0;}
.section{border-top:1px dashed #999;margin:8px 0;padding-top:8px;}
.section-title{font-weight:bold;font-size:14px;margin-bottom:5px;color:#2D9B6E;}
.total-row{font-weight:bold;font-size:15px;border-top:2px solid #000;padding-top:5px;margin-top:5px;}
.diff-positive{color:#2D9B6E;}
.diff-negative{color:#dc2626;}
.footer{text-align:center;margin-top:15px;border-top:1px dashed #999;padding-top:10px;font-size:11px;color:#666;}
table{width:100%;border-collapse:collapse;margin-top:5px;}
th,td{padding:3px 5px;text-align:right;font-size:12px;}
th{border-bottom:1px solid #999;}
@media print{body{padding:5px;}}
</style></head><body>
<div class="header">
  <h1>مكان الشيف البخاري</h1>
  <h2>${opts.title}</h2>
  ${opts.subtitle ? `<div>${opts.subtitle}</div>` : ''}
  ${opts.shiftNumber ? `<div>${opts.shiftNumber}</div>` : ''}
</div>
${opts.employeeName ? `<div class="row"><span>الموظف:</span><span>${opts.employeeName}</span></div>` : ''}
<div class="row"><span>الفرع:</span><span>${opts.branchName || 'الرئيسي'}</span></div>
<div class="row"><span>من:</span><span>${new Date(opts.openedAt).toLocaleString('ar-SA')}</span></div>
<div class="row"><span>إلى:</span><span>${opts.closedAt ? new Date(opts.closedAt).toLocaleString('ar-SA') : '—'}</span></div>
<div class="row"><span>المدة:</span><span>${fmtDuration(opts.openedAt, opts.closedAt)}</span></div>

<div class="section">
  <div class="section-title">ملخص المبيعات</div>
  <div class="row"><span>إجمالي المبيعات:</span><span>${fmtSAR(opts.totalSales)}</span></div>
  <div class="row"><span>عدد الطلبات:</span><span>${opts.totalOrders}</span></div>
  <div class="row"><span>ضريبة القيمة المضافة:</span><span>${fmtSAR(opts.totalVAT)}</span></div>
  <div class="row"><span>الخصومات:</span><span>${fmtSAR(opts.totalDiscounts)}</span></div>
  <div class="total-row row"><span>صافي الإيرادات:</span><span>${fmtSAR(opts.netRevenue)}</span></div>
</div>

<div class="section">
  <div class="section-title">طرق الدفع</div>
  <div class="row"><span>نقدي:</span><span>${fmtSAR(pb.cash)}</span></div>
  <div class="row"><span>شبكة:</span><span>${fmtSAR(pb.card)}</span></div>
  ${(pb.loyalty || 0) > 0 ? `<div class="row"><span>بطاقة الولاء:</span><span>${fmtSAR(pb.loyalty)}</span></div>` : ''}
</div>

<div class="section">
  <div class="section-title">أنواع الطلبات</div>
  ${(ob.dine_in || 0) > 0 ? `<div class="row"><span>محلي:</span><span>${ob.dine_in}</span></div>` : ''}
  ${(ob.takeaway || 0) > 0 ? `<div class="row"><span>سفري:</span><span>${ob.takeaway}</span></div>` : ''}
  ${(ob.car_pickup || 0) > 0 ? `<div class="row"><span>سيارة:</span><span>${ob.car_pickup}</span></div>` : ''}
  ${(ob.delivery || 0) > 0 ? `<div class="row"><span>توصيل:</span><span>${ob.delivery}</span></div>` : ''}
  ${(ob.online || 0) > 0 ? `<div class="row"><span>أونلاين:</span><span>${ob.online}</span></div>` : ''}
</div>

${opts.openingCash !== undefined ? `<div class="section">
  <div class="section-title">حركة الصندوق</div>
  <div class="row"><span>رصيد الافتتاح:</span><span>${fmtSAR(opts.openingCash)}</span></div>
  ${cashIn > 0 ? `<div class="row"><span>إيداعات:</span><span>${fmtSAR(cashIn)}</span></div>` : ''}
  ${cashOut > 0 ? `<div class="row"><span>سحوبات:</span><span>${fmtSAR(cashOut)}</span></div>` : ''}
  <div class="row"><span>المبيعات النقدية:</span><span>${fmtSAR(opts.totalCashSales)}</span></div>
  <div class="row"><span>الرصيد المتوقع:</span><span>${fmtSAR(opts.expectedCash || 0)}</span></div>
  <div class="row"><span>الرصيد الفعلي:</span><span>${fmtSAR(opts.closingCash || 0)}</span></div>
  <div class="total-row row">
    <span>الفرق:</span>
    <span class="${(opts.cashDifference || 0) >= 0 ? 'diff-positive' : 'diff-negative'}">${fmtSAR(opts.cashDifference || 0)}</span>
  </div>
</div>` : ''}

${(opts.employees && opts.employees.length) ? `<div class="section">
  <div class="section-title">الموظفون</div>
  <table><tr><th>الاسم</th><th>طلبات</th><th>مبيعات</th></tr>
    ${opts.employees.map(e => `<tr><td>${e.name}</td><td>${e.orders}</td><td>${fmtSAR(e.sales)}</td></tr>`).join('')}
  </table>
</div>` : ''}

${opts.closingNotes ? `<div class="section"><div class="section-title">ملاحظات</div><p>${opts.closingNotes}</p></div>` : ''}

<div class="footer">
  <div>مكان الشيف البخاري</div>
  <div>طُبع في: ${new Date().toLocaleString('ar-SA')}</div>
</div>
</body></html>`;
}

export function printShiftReport(html: string) {
  const w = window.open('', '_blank', 'width=420,height=800');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

export default function ShiftQuickBar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showAutoDialog, setShowAutoDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const { data: activeShift, refetch } = useQuery<ActiveShift | null>({
    queryKey: ['/api/shifts/active'],
    refetchInterval: 30000,
  });

  const { data: autoShift } = useQuery<AutoShift>({
    queryKey: ['/api/shifts/auto-current'],
    refetchInterval: 60000,
    enabled: !activeShift,
  });

  const openMutation = useMutation({
    mutationFn: async (data: { openingCash: number; notes: string }) => {
      const res = await apiRequest("POST", "/api/shifts/open", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم فتح الوردية", description: "يمكنك الآن استقبال الطلبات" });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/active'] });
      setShowOpenDialog(false);
      setShowAutoDialog(false);
      setOpeningCash("");
      setOpeningNotes("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message || "فشل فتح الوردية", variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: async (data: { closingCash: number; closingNotes: string }) => {
      const res = await apiRequest("POST", "/api/shifts/close", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم إغلاق الوردية", description: "تم إنشاء تقرير Z" });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/history'] });
      setShowCloseDialog(false);
      setClosingCash("");
      setClosingNotes("");
      const s = data.shift;
      if (s) {
        const html = buildShiftReportHtml({
          title: 'تقرير Z - إغلاق الوردية',
          shiftNumber: s.shiftNumber,
          employeeName: s.employeeName,
          branchName: s.branchName,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          openingCash: s.openingCash,
          closingCash: s.closingCash,
          expectedCash: s.expectedCash,
          cashDifference: s.cashDifference,
          totalSales: s.totalSales,
          totalOrders: s.totalOrders,
          totalCashSales: s.totalCashSales,
          totalCardSales: s.totalCardSales,
          totalDigitalSales: s.totalDigitalSales,
          totalDiscounts: s.totalDiscounts,
          totalVAT: s.totalVAT,
          netRevenue: s.netRevenue,
          paymentBreakdown: s.paymentBreakdown,
          orderTypeBreakdown: s.orderTypeBreakdown,
          cashMovements: s.cashMovements,
          closingNotes: s.closingNotes,
        });
        printShiftReport(html);
      }
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message || "فشل إغلاق الوردية", variant: "destructive" }),
  });

  const handlePrintAuto = useCallback(() => {
    if (!autoShift) return;
    const html = buildShiftReportHtml({
      title: 'تقرير وردية تلقائية',
      subtitle: `كل ${autoShift.autoShiftHours} ساعة`,
      employeeName: 'تجميع تلقائي',
      openedAt: autoShift.period.start,
      closedAt: autoShift.period.now,
      totalSales: autoShift.totalSales,
      totalOrders: autoShift.totalOrders,
      totalCashSales: autoShift.totalCashSales,
      totalCardSales: autoShift.totalCardSales,
      totalDigitalSales: autoShift.totalDigitalSales,
      totalDiscounts: autoShift.totalDiscounts,
      totalVAT: autoShift.totalVAT,
      netRevenue: autoShift.netRevenue,
      paymentBreakdown: autoShift.paymentBreakdown,
      orderTypeBreakdown: autoShift.orderTypeBreakdown,
      employees: autoShift.employees,
    });
    printShiftReport(html);
  }, [autoShift]);

  const handlePrintActive = useCallback(() => {
    if (!activeShift) return;
    const html = buildShiftReportHtml({
      title: 'تقرير الوردية الحالية',
      shiftNumber: activeShift.shiftNumber,
      employeeName: activeShift.employeeName,
      branchName: activeShift.branchName,
      openedAt: activeShift.openedAt,
      openingCash: activeShift.openingCash,
      totalSales: activeShift.totalSales,
      totalOrders: activeShift.totalOrders,
      totalCashSales: activeShift.totalCashSales,
      totalCardSales: activeShift.totalCardSales,
      totalDigitalSales: activeShift.totalDigitalSales,
      totalDiscounts: activeShift.totalDiscounts,
      totalVAT: activeShift.totalVAT,
      netRevenue: activeShift.netRevenue,
      paymentBreakdown: activeShift.paymentBreakdown,
      orderTypeBreakdown: activeShift.orderTypeBreakdown,
      cashMovements: activeShift.cashMovements,
    });
    printShiftReport(html);
  }, [activeShift]);

  const showAutoBadge = !activeShift && autoShift && (autoShift as any).enabled !== false && autoShift.totalOrders > 0;

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card border-b" dir="rtl" data-testid="shift-quick-bar">
        {activeShift ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-green-500 text-white animate-pulse" data-testid="badge-shift-open">
                <Clock className="w-3 h-3 ml-1" />وردية مفتوحة
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">{activeShift.shiftNumber}</span>
              <span className="text-xs flex items-center gap-1"><User className="w-3 h-3" />{activeShift.employeeName}</span>
              <span className="text-xs text-muted-foreground">| منذ {fmtTime(activeShift.openedAt)} ({fmtDuration(activeShift.openedAt)})</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs"><ShoppingCart className="w-3 h-3" /><span className="font-bold">{activeShift.totalOrders}</span> طلب</div>
              <div className="flex items-center gap-1 text-xs"><Banknote className="w-3 h-3 text-green-600" /><span className="font-mono font-bold">{fmtSAR(activeShift.totalCashSales)}</span></div>
              <div className="flex items-center gap-1 text-xs"><CreditCard className="w-3 h-3 text-purple-500" /><span className="font-mono font-bold">{fmtSAR(activeShift.totalCardSales + activeShift.totalDigitalSales)}</span></div>
              <Button size="sm" variant="outline" onClick={handlePrintActive} data-testid="button-print-active-shift" className="h-7 px-2"><Printer className="w-3 h-3" /></Button>
              <Button size="sm" variant="destructive" onClick={() => setShowCloseDialog(true)} data-testid="button-close-shift" className="h-7 px-3 gap-1"><Square className="w-3 h-3" />إغلاق الوردية</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                <AlertCircle className="w-3 h-3 ml-1" />لا توجد وردية مفتوحة
              </Badge>
              {showAutoBadge && autoShift && (
                <button
                  onClick={() => setShowAutoDialog(true)}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                  data-testid="button-show-auto-shift"
                >
                  <Clock className="w-3 h-3" />وردية تلقائية: {fmtTime(autoShift.period.start)} - الآن ({autoShift.totalOrders} طلب)
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowOpenDialog(true)} data-testid="button-open-shift" className="h-7 px-3 gap-1 bg-primary"><Play className="w-3 h-3" />فتح وردية</Button>
            </div>
          </>
        )}
      </div>

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Play className="w-5 h-5 text-primary" />فتح وردية جديدة</DialogTitle>
            <DialogDescription>أدخل رصيد الصندوق عند بدء الوردية</DialogDescription>
          </DialogHeader>
          {autoShift && (autoShift as any).enabled !== false && autoShift.totalOrders > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
              <div className="font-bold text-amber-800 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />تنبيه: وردية تلقائية جارية
              </div>
              <div className="text-amber-700">
                يوجد {autoShift.totalOrders} طلب مسجلين منذ {fmtTime(autoShift.period.start)} ({fmtSAR(autoShift.totalSales)}).
                هذه الطلبات ستبقى في التقرير التلقائي ولن تُضاف لورديتك الجديدة.
                يمكنك طباعة التقرير التلقائي الآن قبل فتح وردية جديدة.
              </div>
              <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={handlePrintAuto}>
                <Printer className="w-3 h-3 ml-1" />طباعة الوردية التلقائية أولاً
              </Button>
            </div>
          )}
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">رصيد الافتتاح (ر.س)</label>
              <Input type="number" placeholder="0.00" value={openingCash} onChange={e => setOpeningCash(e.target.value)} className="text-lg text-center font-mono" dir="ltr" data-testid="input-opening-cash" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ملاحظات (اختياري)</label>
              <Textarea value={openingNotes} onChange={e => setOpeningNotes(e.target.value)} rows={2} data-testid="input-opening-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>إلغاء</Button>
            <Button onClick={() => openMutation.mutate({ openingCash: Number(openingCash) || 0, notes: openingNotes })} disabled={openMutation.isPending} data-testid="button-confirm-open">
              {openMutation.isPending ? "جاري الفتح..." : "فتح الوردية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Square className="w-5 h-5 text-red-500" />إغلاق الوردية</DialogTitle>
            <DialogDescription>عدّ النقود في الصندوق وأدخل المبلغ الفعلي</DialogDescription>
          </DialogHeader>
          {activeShift && (
            <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>رصيد الافتتاح</span><span className="font-mono">{fmtSAR(activeShift.openingCash)}</span></div>
              <div className="flex justify-between"><span>المبيعات النقدية</span><span className="font-mono">{fmtSAR(activeShift.totalCashSales)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>إجمالي المبيعات</span><span className="font-mono text-primary">{fmtSAR(activeShift.totalSales)}</span></div>
              <div className="flex justify-between"><span>عدد الطلبات</span><span className="font-bold">{activeShift.totalOrders}</span></div>
            </div>
          )}
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">الرصيد الفعلي (ر.س)</label>
              <Input type="number" placeholder="0.00" value={closingCash} onChange={e => setClosingCash(e.target.value)} className="text-lg text-center font-mono" dir="ltr" data-testid="input-closing-cash" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ملاحظات (اختياري)</label>
              <Textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={2} data-testid="input-closing-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => closeMutation.mutate({ closingCash: Number(closingCash) || 0, closingNotes })} disabled={closeMutation.isPending} data-testid="button-confirm-close">
              {closeMutation.isPending ? "جاري الإغلاق..." : "إغلاق وطباعة Z"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Shift Detail Dialog */}
      <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" />وردية تلقائية</DialogTitle>
            <DialogDescription>
              تجميع تلقائي للطلبات كل {autoShift?.autoShiftHours || 12} ساعة (لا توجد وردية يدوية مفتوحة)
            </DialogDescription>
          </DialogHeader>
          {autoShift && (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>من:</span><span className="font-mono">{fmtDate(autoShift.period.start)} {fmtTime(autoShift.period.start)}</span></div>
                <div className="flex justify-between"><span>إلى:</span><span className="font-mono">{fmtTime(autoShift.period.now)} (الآن)</span></div>
                <div className="flex justify-between"><span>نهاية الفترة:</span><span className="font-mono">{fmtTime(autoShift.period.end)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Card><CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold">{autoShift.totalOrders}</div>
                  <div className="text-xs text-muted-foreground">طلب</div>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-primary">{fmtSAR(autoShift.totalSales)}</div>
                  <div className="text-xs text-muted-foreground">إجمالي</div>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{fmtSAR(autoShift.paymentBreakdown.cash)}</div>
                  <div className="text-xs text-muted-foreground">نقدي</div>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-purple-600">{fmtSAR(autoShift.paymentBreakdown.card)}</div>
                  <div className="text-xs text-muted-foreground">شبكة</div>
                </CardContent></Card>
              </div>
              {autoShift.employees.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs font-bold mb-2">الموظفون في هذه الفترة:</div>
                  {autoShift.employees.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs py-1">
                      <span>{e.name}</span>
                      <span>{e.orders} طلب — {fmtSAR(e.sales)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoDialog(false)}>إغلاق</Button>
            <Button onClick={handlePrintAuto} data-testid="button-print-auto" className="gap-1"><Printer className="w-4 h-4" />طباعة التقرير</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
