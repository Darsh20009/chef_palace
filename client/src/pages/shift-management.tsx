import { useState, useEffect, useCallback } from "react";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Square,
  Clock,
  DollarSign,
  CreditCard,
  Smartphone,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText,
  Printer,
  Calendar,
  User,
  ShoppingCart,
  Ban,
  Receipt,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  History,
  Banknote,
} from "lucide-react";

interface CashierShift {
  _id: string;
  shiftNumber: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
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
  totalRefunds: number;
  totalDiscounts: number;
  totalCancelledOrders: number;
  totalVAT: number;
  netRevenue: number;
  paymentBreakdown: Record<string, number>;
  orderTypeBreakdown: Record<string, number>;
  cashMovements: Array<{
    type: string;
    amount: number;
    reason: string;
    timestamp: string;
    performedBy?: string;
  }>;
  orderIds: string[];
  notes?: string;
  closingNotes?: string;
}

function formatCurrency(amount: number) {
  return `${(amount || 0).toFixed(2)} ر.س`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start: string, end?: string) {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}:${m.toString().padStart(2, '0')} ساعة`;
}

export default function ShiftManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showCashMovementDialog, setShowCashMovementDialog] = useState(false);
  const [showZReportDialog, setShowZReportDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [movementType, setMovementType] = useState<string>("cash_in");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [selectedZReport, setSelectedZReport] = useState<CashierShift | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'auto'>('current');

  const { data: autoCurrent } = useQuery<any>({
    queryKey: ['/api/shifts/auto-current'],
    refetchInterval: 60000,
  });
  const { data: autoPeriodsData } = useQuery<any>({
    queryKey: ['/api/shifts/auto-periods?days=7'],
    enabled: activeTab === 'auto',
  });

  const { data: activeShift, isLoading: loadingShift, refetch: refetchShift } = useQuery<CashierShift | null>({
    queryKey: ['/api/shifts/active'],
    refetchInterval: 30000,
  });

  const { data: shiftHistory } = useQuery<CashierShift[]>({
    queryKey: ['/api/shifts/history'],
    enabled: activeTab === 'history' || showHistoryDialog,
  });

  const openShiftMutation = useMutation({
    mutationFn: async (data: { openingCash: number; notes: string }) => {
      const res = await apiRequest("POST", "/api/shifts/open", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: tc("تم فتح الوردية بنجاح", "Shift Opened Successfully"), description: tc("يمكنك الآن استقبال الطلبات", "You can now accept orders") });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/active'] });
      setShowOpenDialog(false);
      setOpeningCash("");
      setOpeningNotes("");
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ", "Error"), description: error.message || tc("فشل في فتح الوردية", "Failed to open shift"), variant: "destructive" });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async (data: { closingCash: number; closingNotes: string }) => {
      const res = await apiRequest("POST", "/api/shifts/close", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: tc("تم إغلاق الوردية", "Shift Closed"), description: tc("تم إنشاء تقرير Z بنجاح", "Z-report generated successfully") });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/history'] });
      setShowCloseDialog(false);
      setClosingCash("");
      setClosingNotes("");
      if (data.shift) {
        setSelectedZReport(data.shift);
        setShowZReportDialog(true);
      }
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ", "Error"), description: error.message || tc("فشل في إغلاق الوردية", "Failed to close shift"), variant: "destructive" });
    },
  });

  const cashMovementMutation = useMutation({
    mutationFn: async (data: { type: string; amount: number; reason: string }) => {
      const res = await apiRequest("POST", "/api/shifts/cash-movement", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: tc("تم تسجيل الحركة بنجاح", "Transaction Recorded") });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/active'] });
      setShowCashMovementDialog(false);
      setMovementAmount("");
      setMovementReason("");
    },
    onError: (error: any) => {
      toast({ title: tc("خطأ", "Error"), description: error.message || tc("فشل في تسجيل الحركة", "Failed to record transaction"), variant: "destructive" });
    },
  });

  const handlePrintZReport = useCallback((shift: CashierShift) => {
    const printWindow = window.open('', '_blank', 'width=400,height=800');
    if (!printWindow) return;

    const cashIn = (shift.cashMovements || []).filter(m => m.type === 'cash_in' || m.type === 'paid_in').reduce((s, m) => s + m.amount, 0);
    const cashOut = (shift.cashMovements || []).filter(m => m.type === 'cash_out' || m.type === 'paid_out').reduce((s, m) => s + m.amount, 0);
    const pb = shift.paymentBreakdown || {};
    const ob = shift.orderTypeBreakdown || {};

    printWindow.document.write(`
      <html dir="rtl"><head><title>Z-Report - ${shift.shiftNumber}</title>
      <style>
        body { font-family: 'Cairo', Arial, sans-serif; padding: 15px; max-width: 350px; margin: 0 auto; font-size: 13px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .header h1 { font-size: 18px; margin: 5px 0; }
        .header h2 { font-size: 14px; color: #2D9B6E; margin: 3px 0; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; }
        .section { border-top: 1px dashed #999; margin: 8px 0; padding-top: 8px; }
        .section-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #2D9B6E; }
        .total-row { font-weight: bold; font-size: 15px; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
        .diff-positive { color: #2D9B6E; }
        .diff-negative { color: #dc2626; }
        .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #999; padding-top: 10px; font-size: 11px; color: #666; }
        @media print { body { padding: 5px; } }
      </style></head><body>
        <div class="header">
          <h1>مكان الشيف البخاري</h1>
          <h2>تقرير Z - إغلاق الوردية</h2>
          <div>${shift.shiftNumber}</div>
        </div>
        <div class="row"><span>الكاشير:</span><span>${shift.employeeName}</span></div>
        <div class="row"><span>الفرع:</span><span>${shift.branchName || 'الرئيسي'}</span></div>
        <div class="row"><span>فتح الوردية:</span><span>${formatTime(shift.openedAt)}</span></div>
        <div class="row"><span>إغلاق الوردية:</span><span>${shift.closedAt ? formatTime(shift.closedAt) : '-'}</span></div>
        <div class="row"><span>المدة:</span><span>${formatDuration(shift.openedAt, shift.closedAt)}</span></div>

        <div class="section">
          <div class="section-title">ملخص المبيعات</div>
          <div class="row"><span>إجمالي المبيعات:</span><span>${formatCurrency(shift.totalSales)}</span></div>
          <div class="row"><span>عدد الطلبات:</span><span>${shift.totalOrders}</span></div>
          <div class="row"><span>ضريبة القيمة المضافة:</span><span>${formatCurrency(shift.totalVAT)}</span></div>
          <div class="row"><span>الخصومات:</span><span>${formatCurrency(shift.totalDiscounts)}</span></div>
          <div class="row"><span>المرتجعات:</span><span>${formatCurrency(shift.totalRefunds)}</span></div>
          <div class="row"><span>الطلبات الملغاة:</span><span>${shift.totalCancelledOrders}</span></div>
          <div class="total-row row"><span>صافي الإيرادات:</span><span>${formatCurrency(shift.netRevenue)}</span></div>
        </div>

        <div class="section">
          <div class="section-title">طرق الدفع</div>
          <div class="row"><span>نقدي:</span><span>${formatCurrency(pb.cash || 0)}</span></div>
          <div class="row"><span>شبكة:</span><span>${formatCurrency(pb.card || 0)}</span></div>
          ${(pb.loyalty || 0) > 0 ? `<div class="row"><span>بطاقة مكان الشيف:</span><span>${formatCurrency(pb.loyalty)}</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">أنواع الطلبات</div>
          ${(ob.dine_in || 0) > 0 ? `<div class="row"><span>محلي:</span><span>${ob.dine_in}</span></div>` : ''}
          ${(ob.takeaway || 0) > 0 ? `<div class="row"><span>سفري:</span><span>${ob.takeaway}</span></div>` : ''}
          ${(ob.car_pickup || 0) > 0 ? `<div class="row"><span>سيارة:</span><span>${ob.car_pickup}</span></div>` : ''}
          ${(ob.delivery || 0) > 0 ? `<div class="row"><span>توصيل:</span><span>${ob.delivery}</span></div>` : ''}
          ${(ob.online || 0) > 0 ? `<div class="row"><span>أونلاين:</span><span>${ob.online}</span></div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">حركة الصندوق</div>
          <div class="row"><span>رصيد الافتتاح:</span><span>${formatCurrency(shift.openingCash)}</span></div>
          ${cashIn > 0 ? `<div class="row"><span>إيداعات نقدية:</span><span>${formatCurrency(cashIn)}</span></div>` : ''}
          ${cashOut > 0 ? `<div class="row"><span>سحوبات نقدية:</span><span>${formatCurrency(cashOut)}</span></div>` : ''}
          <div class="row"><span>المبيعات النقدية:</span><span>${formatCurrency(shift.totalCashSales)}</span></div>
          <div class="row"><span>الرصيد المتوقع:</span><span>${formatCurrency(shift.expectedCash || 0)}</span></div>
          <div class="row"><span>الرصيد الفعلي:</span><span>${formatCurrency(shift.closingCash || 0)}</span></div>
          <div class="total-row row">
            <span>الفرق:</span>
            <span class="${(shift.cashDifference || 0) >= 0 ? 'diff-positive' : 'diff-negative'}">
              ${formatCurrency(shift.cashDifference || 0)}
            </span>
          </div>
        </div>

        ${shift.closingNotes ? `<div class="section"><div class="section-title">ملاحظات</div><p>${shift.closingNotes}</p></div>` : ''}

        <div class="footer">
          <div>مكان الشيف البخاري v3.0</div>
          <div>${new Date().toLocaleString('ar-SA')}</div>
        </div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }, []);

  if (loadingShift) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          إدارة الورديات
        </h1>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'current' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('current')}
          >
            الوردية الحالية
          </Button>
          <Button
            variant={activeTab === 'auto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('auto')}
            data-testid="tab-auto-shifts"
          >
            <Clock className="w-4 h-4 ml-1" />
            تلقائية
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('history')}
          >
            <History className="w-4 h-4 ml-1" />
            السجل
          </Button>
        </div>
      </div>

      {activeTab === 'auto' && (
        <div className="space-y-3">
          {autoCurrent && autoCurrent.totalOrders > 0 && (
            <Card className="border-blue-300 bg-blue-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  الفترة الحالية: {new Date(autoCurrent.period.start).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} - الآن
                  <Badge variant="outline" className="ml-2">كل {autoCurrent.autoShiftHours} ساعة</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="bg-white rounded p-2"><div className="font-bold text-lg">{autoCurrent.totalOrders}</div><div className="text-xs text-muted-foreground">طلب</div></div>
                  <div className="bg-white rounded p-2"><div className="font-bold text-lg text-primary">{formatCurrency(autoCurrent.totalSales)}</div><div className="text-xs text-muted-foreground">إجمالي</div></div>
                  <div className="bg-white rounded p-2"><div className="font-bold text-green-600">{formatCurrency(autoCurrent.paymentBreakdown?.cash || 0)}</div><div className="text-xs text-muted-foreground">نقدي</div></div>
                  <div className="bg-white rounded p-2"><div className="font-bold text-purple-600">{formatCurrency(autoCurrent.paymentBreakdown?.card || 0)}</div><div className="text-xs text-muted-foreground">شبكة</div></div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1"
                  data-testid="button-print-auto-current"
                  onClick={async () => {
                    const { buildShiftReportHtml, printShiftReport } = await import("@/components/shift-quick-bar");
                    printShiftReport(buildShiftReportHtml({
                      title: 'تقرير وردية تلقائية',
                      subtitle: `كل ${autoCurrent.autoShiftHours} ساعة`,
                      employeeName: 'تجميع تلقائي',
                      openedAt: autoCurrent.period.start,
                      closedAt: autoCurrent.period.now,
                      totalSales: autoCurrent.totalSales,
                      totalOrders: autoCurrent.totalOrders,
                      totalCashSales: autoCurrent.totalCashSales,
                      totalCardSales: autoCurrent.totalCardSales,
                      totalDigitalSales: autoCurrent.totalDigitalSales,
                      totalDiscounts: autoCurrent.totalDiscounts,
                      totalVAT: autoCurrent.totalVAT,
                      netRevenue: autoCurrent.netRevenue,
                      paymentBreakdown: autoCurrent.paymentBreakdown,
                      orderTypeBreakdown: autoCurrent.orderTypeBreakdown,
                      employees: autoCurrent.employees,
                      categories: autoCurrent.categories,
                      topProducts: autoCurrent.topProducts,
                    }));
                  }}
                >
                  <Printer className="w-3 h-3" />طباعة الفترة الحالية
                </Button>
              </CardContent>
            </Card>
          )}
          <h3 className="text-sm font-bold text-muted-foreground">آخر الفترات (7 أيام)</h3>
          {!autoPeriodsData?.periods?.length ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد فترات تلقائية بها طلبات</CardContent></Card>
          ) : (
            autoPeriodsData.periods.map((p: any, i: number) => (
              <Card key={i} className="cursor-pointer hover:border-primary/40" data-testid={`auto-period-${i}`}
                onClick={async () => {
                  const { buildShiftReportHtml, printShiftReport } = await import("@/components/shift-quick-bar");
                  printShiftReport(buildShiftReportHtml({
                    title: 'تقرير وردية تلقائية',
                    subtitle: `كل ${autoPeriodsData.autoShiftHours} ساعة`,
                    employeeName: 'تجميع تلقائي',
                    openedAt: p.start,
                    closedAt: p.end,
                    totalSales: p.totalSales,
                    totalOrders: p.totalOrders,
                    totalCashSales: p.totalCashSales,
                    totalCardSales: p.totalCardSales,
                    totalDigitalSales: p.totalDigitalSales,
                    totalDiscounts: p.totalDiscounts,
                    totalVAT: p.totalVAT,
                    netRevenue: p.netRevenue,
                    paymentBreakdown: p.paymentBreakdown,
                    orderTypeBreakdown: p.orderTypeBreakdown,
                    employees: p.employees,
                    categories: p.categories,
                    topProducts: p.topProducts,
                  }));
                }}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">تلقائية</Badge>
                      <span className="text-sm font-medium">
                        {new Date(p.start).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(p.start).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(p.end).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <Printer className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{p.totalOrders} طلب</span>
                    <span className="font-bold text-primary">{formatCurrency(p.totalSales)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
      {activeTab !== 'auto' && (activeTab === 'current' ? (
        <>
          {!activeShift ? (
            /* No Active Shift - Show Open Button */
            <Card className="border-2 border-dashed border-primary/30">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Play className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">لا توجد وردية مفتوحة</h2>
                <p className="text-muted-foreground text-center mb-6">
                  افتح وردية جديدة لبدء استقبال الطلبات وتتبع المبيعات
                </p>
                <Button size="lg" onClick={() => setShowOpenDialog(true)} className="gap-2">
                  <Play className="w-5 h-5" />
                  فتح وردية جديدة
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Active Shift Dashboard */
            <>
              {/* Shift Status Bar */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-500 text-white animate-pulse">مفتوحة</Badge>
                      <span className="font-mono text-sm">{activeShift.shiftNumber}</span>
                      <span className="text-sm text-muted-foreground">|</span>
                      <span className="text-sm">{activeShift.employeeName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {formatTime(activeShift.openedAt)} — {formatDuration(activeShift.openedAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="py-4 px-3 text-center">
                    <DollarSign className="w-6 h-6 mx-auto mb-1 text-primary" />
                    <div className="text-2xl font-bold">{formatCurrency(activeShift.totalSales)}</div>
                    <div className="text-xs text-muted-foreground">إجمالي المبيعات</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 px-3 text-center">
                    <ShoppingCart className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                    <div className="text-2xl font-bold">{activeShift.totalOrders}</div>
                    <div className="text-xs text-muted-foreground">عدد الطلبات</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 px-3 text-center">
                    <Banknote className="w-6 h-6 mx-auto mb-1 text-green-600" />
                    <div className="text-2xl font-bold">{formatCurrency(activeShift.totalCashSales)}</div>
                    <div className="text-xs text-muted-foreground">مبيعات نقدية</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 px-3 text-center">
                    <CreditCard className="w-6 h-6 mx-auto mb-1 text-purple-500" />
                    <div className="text-2xl font-bold">{formatCurrency(activeShift.totalCardSales + activeShift.totalDigitalSales)}</div>
                    <div className="text-xs text-muted-foreground">مبيعات إلكترونية</div>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      طرق الدفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {Object.entries(activeShift.paymentBreakdown || {}).map(([key, value]) => {
                      if (!value || value === 0) return null;
                      const labels: Record<string, string> = {
                        cash: 'نقدي', card: 'شبكة', loyalty: 'بطاقة مكان الشيف'
                      };
                      return (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm">{labels[key] || key}</span>
                          <span className="font-mono text-sm font-medium">{formatCurrency(value)}</span>
                        </div>
                      );
                    })}
                    {Object.values(activeShift.paymentBreakdown || {}).every(v => !v || v === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-2">لا توجد مبيعات بعد</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      تفاصيل إضافية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">ضريبة القيمة المضافة</span>
                      <span className="font-mono text-sm">{formatCurrency(activeShift.totalVAT)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">الخصومات</span>
                      <span className="font-mono text-sm">{formatCurrency(activeShift.totalDiscounts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">المرتجعات</span>
                      <span className="font-mono text-sm">{formatCurrency(activeShift.totalRefunds)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">الطلبات الملغاة</span>
                      <span className="font-mono text-sm">{activeShift.totalCancelledOrders}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span className="text-sm">صافي الإيرادات</span>
                      <span className="font-mono text-sm text-primary">{formatCurrency(activeShift.netRevenue)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cash Movements */}
              {(activeShift.cashMovements || []).length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4" />
                      حركات الصندوق
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {activeShift.cashMovements.map((m, i) => (
                        <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            {m.type === 'cash_in' || m.type === 'paid_in' ? (
                              <ArrowUpCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDownCircle className="w-4 h-4 text-red-500" />
                            )}
                            <div>
                              <div className="text-sm font-medium">
                                {m.type === 'cash_in' ? 'إيداع' : m.type === 'cash_out' ? 'سحب' : m.type === 'paid_in' ? 'دفع وارد' : 'دفع صادر'}
                              </div>
                              <div className="text-xs text-muted-foreground">{m.reason}</div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div className={`font-mono text-sm font-medium ${m.type === 'cash_in' || m.type === 'paid_in' ? 'text-green-600' : 'text-red-600'}`}>
                              {m.type === 'cash_in' || m.type === 'paid_in' ? '+' : '-'}{formatCurrency(m.amount)}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatTime(m.timestamp)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-14 gap-2"
                  onClick={() => setShowCashMovementDialog(true)}
                >
                  <ArrowUpCircle className="w-5 h-5" />
                  حركة نقدية
                </Button>
                <Button
                  variant="destructive"
                  className="h-14 gap-2"
                  onClick={() => setShowCloseDialog(true)}
                >
                  <Square className="w-5 h-5" />
                  إغلاق الوردية
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        /* History Tab */
        <div className="space-y-3">
          {!shiftHistory || shiftHistory.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <History className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">لا يوجد سجل ورديات</p>
              </CardContent>
            </Card>
          ) : (
            shiftHistory.map((shift) => (
              <Card
                key={shift._id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => { setSelectedZReport(shift); setShowZReportDialog(true); }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                        {shift.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                      </Badge>
                      <span className="font-mono text-xs">{shift.shiftNumber}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(shift.openedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{shift.employeeName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-primary">{formatCurrency(shift.totalSales)}</span>
                      <span className="text-muted-foreground">{shift.totalOrders} طلب</span>
                    </div>
                  </div>
                  {shift.status === 'closed' && shift.cashDifference !== undefined && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                      <span>فرق الصندوق</span>
                      <span className={shift.cashDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {shift.cashDifference >= 0 ? '+' : ''}{formatCurrency(shift.cashDifference)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ))}

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              فتح وردية جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">رصيد الافتتاح (ر.س)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="text-lg text-center font-mono"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">أدخل المبلغ الموجود في الصندوق عند بدء الوردية</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">ملاحظات (اختياري)</label>
              <Textarea
                placeholder="أي ملاحظات عند فتح الوردية..."
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => openShiftMutation.mutate({ openingCash: Number(openingCash) || 0, notes: openingNotes })}
              disabled={openShiftMutation.isPending}
              className="gap-2"
            >
              {openShiftMutation.isPending ? "جاري الفتح..." : "فتح الوردية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5 text-red-500" />
              إغلاق الوردية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {activeShift && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>رصيد الافتتاح</span>
                  <span className="font-mono">{formatCurrency(activeShift.openingCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>المبيعات النقدية</span>
                  <span className="font-mono">{formatCurrency(activeShift.totalCashSales)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1">
                  <span>إجمالي المبيعات</span>
                  <span className="font-mono text-primary">{formatCurrency(activeShift.totalSales)}</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">الرصيد الفعلي في الصندوق (ر.س)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="text-lg text-center font-mono"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">عدّ النقود في الصندوق وأدخل المبلغ الفعلي</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">ملاحظات الإغلاق (اختياري)</label>
              <Textarea
                placeholder="أي ملاحظات عند إغلاق الوردية..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => closeShiftMutation.mutate({ closingCash: Number(closingCash) || 0, closingNotes })}
              disabled={closeShiftMutation.isPending}
              className="gap-2"
            >
              {closeShiftMutation.isPending ? "جاري الإغلاق..." : "إغلاق وطباعة التقرير"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Movement Dialog */}
      <Dialog open={showCashMovementDialog} onOpenChange={setShowCashMovementDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>حركة نقدية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'cash_in', label: 'إيداع', icon: ArrowUpCircle, color: 'text-green-600' },
                { value: 'cash_out', label: 'سحب', icon: ArrowDownCircle, color: 'text-red-600' },
              ].map(({ value, label, icon: Icon, color }) => (
                <Button
                  key={value}
                  variant={movementType === value ? 'default' : 'outline'}
                  className="h-16 flex-col gap-1"
                  onClick={() => setMovementType(value)}
                >
                  <Icon className={`w-5 h-5 ${movementType === value ? '' : color}`} />
                  {label}
                </Button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">المبلغ (ر.س)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="text-lg text-center font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">السبب</label>
              <Textarea
                placeholder="سبب الحركة النقدية..."
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashMovementDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => cashMovementMutation.mutate({
                type: movementType,
                amount: Number(movementAmount) || 0,
                reason: movementReason,
              })}
              disabled={cashMovementMutation.isPending || !movementAmount}
            >
              {cashMovementMutation.isPending ? "جاري التسجيل..." : "تسجيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Z-Report Dialog */}
      <Dialog open={showZReportDialog} onOpenChange={setShowZReportDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تقرير Z - {selectedZReport?.shiftNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedZReport && (
            <div className="space-y-4">
              {/* Shift Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>الكاشير</span><span className="font-medium">{selectedZReport.employeeName}</span></div>
                <div className="flex justify-between"><span>فتح الوردية</span><span>{formatTime(selectedZReport.openedAt)}</span></div>
                <div className="flex justify-between"><span>إغلاق الوردية</span><span>{selectedZReport.closedAt ? formatTime(selectedZReport.closedAt) : 'مفتوحة'}</span></div>
                <div className="flex justify-between"><span>المدة</span><span>{formatDuration(selectedZReport.openedAt, selectedZReport.closedAt)}</span></div>
              </div>

              {/* Sales Summary */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm flex items-center gap-1"><TrendingUp className="w-4 h-4 text-primary" /> ملخص المبيعات</h3>
                <div className="bg-primary/5 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>إجمالي المبيعات</span><span className="font-mono font-bold text-primary">{formatCurrency(selectedZReport.totalSales)}</span></div>
                  <div className="flex justify-between"><span>عدد الطلبات</span><span className="font-mono">{selectedZReport.totalOrders}</span></div>
                  <div className="flex justify-between"><span>ضريبة القيمة المضافة</span><span className="font-mono">{formatCurrency(selectedZReport.totalVAT)}</span></div>
                  <div className="flex justify-between"><span>الخصومات</span><span className="font-mono">{formatCurrency(selectedZReport.totalDiscounts)}</span></div>
                  <div className="flex justify-between"><span>المرتجعات</span><span className="font-mono">{formatCurrency(selectedZReport.totalRefunds)}</span></div>
                  <div className="flex justify-between"><span>الطلبات الملغاة</span><span className="font-mono">{selectedZReport.totalCancelledOrders}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>صافي الإيرادات</span><span className="font-mono text-primary">{formatCurrency(selectedZReport.netRevenue)}</span></div>
                </div>
              </div>

              {/* Cash Reconciliation */}
              {selectedZReport.status === 'closed' && (
                <div className="space-y-2">
                  <h3 className="font-bold text-sm flex items-center gap-1"><Banknote className="w-4 h-4" /> تسوية الصندوق</h3>
                  <div className={`rounded-lg p-3 space-y-1 text-sm ${
                    (selectedZReport.cashDifference || 0) === 0 ? 'bg-green-50 dark:bg-green-950/20' :
                    (selectedZReport.cashDifference || 0) > 0 ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-red-50 dark:bg-red-950/20'
                  }`}>
                    <div className="flex justify-between"><span>رصيد الافتتاح</span><span className="font-mono">{formatCurrency(selectedZReport.openingCash)}</span></div>
                    <div className="flex justify-between"><span>المبيعات النقدية</span><span className="font-mono">{formatCurrency(selectedZReport.totalCashSales)}</span></div>
                    <div className="flex justify-between"><span>الرصيد المتوقع</span><span className="font-mono">{formatCurrency(selectedZReport.expectedCash || 0)}</span></div>
                    <div className="flex justify-between"><span>الرصيد الفعلي</span><span className="font-mono">{formatCurrency(selectedZReport.closingCash || 0)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span className="flex items-center gap-1">
                        الفرق
                        {(selectedZReport.cashDifference || 0) === 0 ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                         (selectedZReport.cashDifference || 0) > 0 ? <TrendingUp className="w-4 h-4 text-blue-500" /> :
                         <AlertTriangle className="w-4 h-4 text-red-500" />}
                      </span>
                      <span className={`font-mono ${
                        (selectedZReport.cashDifference || 0) === 0 ? 'text-green-600' :
                        (selectedZReport.cashDifference || 0) > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {(selectedZReport.cashDifference || 0) >= 0 ? '+' : ''}{formatCurrency(selectedZReport.cashDifference || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm flex items-center gap-1"><CreditCard className="w-4 h-4" /> طرق الدفع</h3>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  {Object.entries(selectedZReport.paymentBreakdown || {}).map(([key, value]) => {
                    if (!value || value === 0) return null;
                    const labels: Record<string, string> = {
                      cash: 'نقدي', card: 'شبكة', loyalty: 'بطاقة مكان الشيف'
                    };
                    return (
                      <div key={key} className="flex justify-between">
                        <span>{labels[key] || key}</span>
                        <span className="font-mono">{formatCurrency(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Print Button */}
              <Button
                className="w-full gap-2"
                onClick={() => handlePrintZReport(selectedZReport)}
              >
                <Printer className="w-4 h-4" />
                طباعة تقرير Z
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
