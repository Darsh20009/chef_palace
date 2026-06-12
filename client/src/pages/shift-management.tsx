import { useState, useEffect, useCallback } from "react";
import SarIcon from "@/components/sar-icon";
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
  Zap,
  Layers,
  Download,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import { printHtmlInPage, printShiftThermal } from "@/lib/print-utils";
import { buildShiftPrintFragment, buildMergedPrintFragment } from "@/lib/shift-print-utils";
import { MobileBottomNav } from "@/components/MobileBottomNav";

// ── Export helpers ────────────────────────────────────────────────────────────
function exportPeriodsToExcel(periods: any[], dateLabel: string) {
  import('xlsx').then(XLSX => {
    const fmtT = (iso: string) => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
    const fmt = (n: number) => Number((n || 0).toFixed(2));

    // Sheet 1: summary per period
    const summaryRows = periods.map(p => ({
      'الفترة':         p.periodLabel || '',
      'من':             fmtT(p.windowStart),
      'إلى':            p.isOngoing ? 'جارية' : fmtT(p.windowEnd),
      'عدد الطلبات':    p.totalOrders || 0,
      'الإجمالي ر.س':   fmt(p.totalSales),
      'نقدي ر.س':       fmt(p.totalCash),
      'شبكة ر.س':       fmt(p.totalCard),
    }));
    // Totals row
    summaryRows.push({
      'الفترة':         'الإجمالي',
      'من':             '',
      'إلى':            '',
      'عدد الطلبات':    periods.reduce((s, p) => s + (p.totalOrders || 0), 0),
      'الإجمالي ر.س':   fmt(periods.reduce((s, p) => s + (p.totalSales || 0), 0)),
      'نقدي ر.س':       fmt(periods.reduce((s, p) => s + (p.totalCash  || 0), 0)),
      'شبكة ر.س':       fmt(periods.reduce((s, p) => s + (p.totalCard  || 0), 0)),
    });

    // Sheet 2: products
    const productRows: any[] = [];
    periods.forEach(p => {
      (p.productsByCategory || []).forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          productRows.push({
            'الفترة':     p.periodLabel || '',
            'الفئة':      cat.categoryNameAr || '',
            'المنتج':     item.nameAr || '',
            'الكمية':     item.quantity || 0,
            'الإجمالي ر.س': fmt(item.totalAmount || 0),
          });
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الورديات');

    if (productRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(productRows);
      ws2['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'المنتجات');
    }

    const filename = `ورديات-${dateLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  });
}

function exportShiftsHistoryToExcel(shifts: any[]) {
  import('xlsx').then(XLSX => {
    const fmtT = (iso: string) => iso ? new Date(iso).toLocaleString('ar-SA') : '';
    const fmt = (n: number) => Number((n || 0).toFixed(2));

    const rows = shifts.map(s => ({
      'رقم الوردية':     s.shiftNumber || '',
      'الكاشير':         s.employeeName || '',
      'الحالة':          s.status === 'open' ? 'مفتوحة' : 'مغلقة',
      'فتح الوردية':     fmtT(s.openedAt),
      'إغلاق الوردية':   fmtT(s.closedAt),
      'عدد الطلبات':     s.totalOrders || 0,
      'إجمالي المبيعات': fmt(s.totalSales),
      'نقدي ر.س':        fmt(s.totalCashSales),
      'شبكة ر.س':        fmt(s.totalCardSales),
      'ضريبة القيمة ر.س': fmt(s.totalVAT),
      'الخصومات ر.س':    fmt(s.totalDiscounts),
      'المرتجعات ر.س':   fmt(s.totalRefunds),
      'صافي الإيرادات':  fmt(s.netRevenue),
      'رصيد الافتتاح':   fmt(s.openingCash),
      'رصيد الإغلاق':    fmt(s.closingCash),
      'الفرق':           fmt(s.cashDifference),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Array(16).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الورديات');

    const filename = `سجل-الورديات-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  });
}

function sharePeriodsToWhatsApp(periods: any[], dateLabel: string) {
  const fmt = (n: number) => `${(n || 0).toFixed(2)} ر.س`;
  const fmtT = (iso: string) => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';

  const totalOrders = periods.reduce((s, p) => s + (p.totalOrders || 0), 0);
  const totalSales  = periods.reduce((s, p) => s + (p.totalSales  || 0), 0);
  const totalCash   = periods.reduce((s, p) => s + (p.totalCash   || 0), 0);
  const totalCard   = periods.reduce((s, p) => s + (p.totalCard   || 0), 0);

  let msg = `📊 *تقرير الورديات — ${dateLabel}*\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;

  periods.forEach((p, i) => {
    msg += `\n🔹 *${p.periodLabel || `وردية ${i + 1}`}*`;
    if (p.isOngoing) msg += ` 🟢`;
    msg += `\n`;
    msg += `   من: ${fmtT(p.windowStart)} — إلى: ${p.isOngoing ? 'جارية' : fmtT(p.windowEnd)}\n`;
    msg += `   الطلبات: ${p.totalOrders || 0} | الإجمالي: ${fmt(p.totalSales)}\n`;
    msg += `   نقدي: ${fmt(p.totalCash)} | شبكة: ${fmt(p.totalCard)}\n`;
  });

  msg += `\n━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 *الإجمالي اليومي*\n`;
  msg += `   عدد الطلبات: ${totalOrders}\n`;
  msg += `   إجمالي المبيعات: ${fmt(totalSales)}\n`;
  msg += `   نقدي: ${fmt(totalCash)} | شبكة: ${fmt(totalCard)}\n`;
  msg += `\n_تم التصدير من نظام مكان الشيف البخاري_`;

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function shareShiftToWhatsApp(shift: any) {
  const fmt = (n: number) => `${(n || 0).toFixed(2)} ر.س`;
  const fmtT = (iso: string) => iso ? new Date(iso).toLocaleString('ar-SA') : '';

  let msg = `📊 *تقرير وردية — ${shift.shiftNumber || ''}*\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 الكاشير: ${shift.employeeName || ''}\n`;
  msg += `🕐 فتح: ${fmtT(shift.openedAt)}\n`;
  if (shift.closedAt) msg += `🕐 إغلاق: ${fmtT(shift.closedAt)}\n`;
  msg += `\n💰 *ملخص المبيعات*\n`;
  msg += `   إجمالي: ${fmt(shift.totalSales)}\n`;
  msg += `   عدد الطلبات: ${shift.totalOrders || 0}\n`;
  msg += `   نقدي: ${fmt(shift.totalCashSales)} | شبكة: ${fmt(shift.totalCardSales)}\n`;
  if (shift.totalVAT) msg += `   ضريبة القيمة: ${fmt(shift.totalVAT)}\n`;
  if (shift.totalRefunds) msg += `   مرتجعات: ${fmt(shift.totalRefunds)}\n`;
  msg += `   صافي الإيرادات: ${fmt(shift.netRevenue)}\n`;
  if (shift.cashDifference !== undefined) {
    const diff = shift.cashDifference || 0;
    msg += `\n💵 فرق الصندوق: ${diff >= 0 ? '+' : ''}${fmt(diff)}\n`;
  }
  msg += `\n_تم التصدير من نظام مكان الشيف البخاري_`;

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

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

// ── Shared thermal-print fragment builders ────────────────────────────────────
// These return HTML *fragments* (no <html>/<body>) for use with printHtmlInPage()
// which feeds them through the same thermal-print queue used by the POS system.


function getTodayLocalStr() {
  // returns YYYY-MM-DD for client's local date
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateAr(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function AutoShiftPeriodsTab() {
  const todayStr = getTodayLocalStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showDateList, setShowDateList] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set());
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFromTime, setCustomFromTime] = useState("08:00");
  const [customToTime, setCustomToTime] = useState("16:00");
  const [customLoading, setCustomLoading] = useState(false);
  const { toast } = useToast();

  const isToday = selectedDate === todayStr;

  const { data: rawOrderDates, isLoading: datesLoading } = useQuery<string[]>({
    queryKey: ['/api/shifts/order-dates'],
    staleTime: 5 * 60 * 1000,
  });
  const orderDates: string[] = Array.isArray(rawOrderDates) ? rawOrderDates : [];

  const { data: rawPeriods, isLoading: periodsLoading } = useQuery<any[]>({
    queryKey: ['/api/shifts/auto-periods', selectedDate],
    queryFn: async () => {
      const params = isToday ? '' : `?date=${selectedDate}`;
      const res = await fetch(`/api/shifts/auto-periods${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: isToday ? 60000 : false,
  });
  const periods: any[] = Array.isArray(rawPeriods) ? rawPeriods : [];
  const isLoading = datesLoading || periodsLoading;

  const toggleSelect = (i: number) => setSelectedIdxs(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const toggleMergeMode = () => { setMergeMode(v => !v); setSelectedIdxs(new Set()); };

  const printPeriod = (p: any) => printShiftThermal(p);

  const printMerged = () => {
    const selected = [...selectedIdxs].sort((a, b) => a - b).map(i => periods[i]);
    const merged = selected.reduce((acc, p) => ({
      totalOrders: (acc.totalOrders || 0) + (p.totalOrders || 0),
      totalSales:  (acc.totalSales  || 0) + (p.totalSales  || 0),
      totalCash:   (acc.totalCash   || 0) + (p.totalCash   || 0),
      totalCard:   (acc.totalCard   || 0) + (p.totalCard   || 0),
      windowStart: acc.windowStart || p.windowStart,
      windowEnd:   p.windowEnd,
      periodLabel: selected.map(s => s.periodLabel).join(' | '),
      reportTitle: `تقرير مدمج — ${selected.length} ورديات`,
      productsByCategory: [],
    }), {} as any);
    printShiftThermal(merged);
  };

  const printFullDay = () => {
    const merged = periods.reduce((acc, p) => ({
      totalOrders: (acc.totalOrders || 0) + (p.totalOrders || 0),
      totalSales:  (acc.totalSales  || 0) + (p.totalSales  || 0),
      totalCash:   (acc.totalCash   || 0) + (p.totalCash   || 0),
      totalCard:   (acc.totalCard   || 0) + (p.totalCard   || 0),
      windowStart: acc.windowStart || p.windowStart,
      windowEnd:   p.windowEnd,
      reportTitle: `تقرير اليوم الكامل — ${periods.length} ورديات`,
      productsByCategory: [],
    }), {} as any);
    printShiftThermal(merged);
  };

  const changeDate = (d: string) => { setSelectedDate(d); setExpandedIdx(null); setShowDateList(false); setSelectedIdxs(new Set()); setMergeMode(false); };

  const printCustomRange = async () => {
    if (!customFromTime || !customToTime) {
      toast({ title: "يرجى تحديد وقت البداية والنهاية", variant: "destructive" });
      return;
    }
    setCustomLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate, fromTime: customFromTime, toTime: customToTime });
      const res = await fetch(`/api/shifts/custom-range?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل في جلب البيانات");
      const data = await res.json();
      if (data.totalOrders === 0) {
        toast({ title: "لا توجد طلبات في هذا النطاق الزمني", variant: "destructive" });
        return;
      }
      setShowCustomRange(false);
      printShiftThermal(data);
    } catch (err: any) {
      toast({ title: "حدث خطأ", description: err.message, variant: "destructive" });
    } finally {
      setCustomLoading(false);
    }
  };

  const currentIdx = orderDates.indexOf(selectedDate);
  const hasPrev = currentIdx >= 0 && currentIdx < orderDates.length - 1;
  const hasNext = currentIdx > 0;

  const dayTotal  = periods.reduce((s, p) => s + (p.totalSales || 0), 0);
  const dayOrders = periods.reduce((s, p) => s + (p.totalOrders || 0), 0);
  const dayCash   = periods.reduce((s, p) => s + (p.totalCash   || 0), 0);
  const dayCard   = periods.reduce((s, p) => s + (p.totalCard   || 0), 0);

  return (
    <div className="space-y-3">
      {/* ── Date Navigator ── */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => changeDate(orderDates[currentIdx + 1])} disabled={!hasPrev}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{isToday ? 'اليوم' : formatDateAr(selectedDate)}</span>
                {isToday && <Badge className="bg-primary text-white text-[10px] px-1.5 py-0 animate-pulse">مباشر</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{selectedDate}</div>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => changeDate(orderDates[currentIdx - 1])} disabled={!hasNext}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-2 border-t pt-2">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-6 gap-1" onClick={() => setShowDateList(v => !v)}>
              <Calendar className="w-3 h-3" />
              كل الأيام التي بها طلبات ({orderDates.length} يوم)
              <ChevronRight className={`w-3 h-3 transition-transform ${showDateList ? 'rotate-90' : ''}`} />
            </Button>
            {showDateList && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {orderDates.map(d => (
                  <div key={d} role="button" tabIndex={0}
                    onClick={() => changeDate(d)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && changeDate(d)}
                    className={`cursor-pointer text-xs px-2 py-1 rounded border transition-colors select-none ${d === selectedDate ? 'bg-primary text-white border-primary' : 'bg-background hover:bg-muted border-border'}`}>
                    {d === todayStr ? 'اليوم' : d}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Daily summary + action bar ── */}
      {dayOrders > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="text-base font-bold">{dayOrders}</div>
              <div className="text-[10px] text-muted-foreground">إجمالي الطلبات</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-primary">{dayTotal.toFixed(0)}</div>
              <div className="text-[10px] text-muted-foreground">إجمالي <SarIcon size={10} /></div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-green-700">{dayCash.toFixed(0)}</div>
              <div className="text-[10px] text-muted-foreground">نقدي</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2 text-center">
              <div className="text-base font-bold text-purple-700">{dayCard.toFixed(0)}</div>
              <div className="text-[10px] text-muted-foreground">شبكة</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {periods.length > 1 && (
              <Button size="sm" variant={mergeMode ? 'default' : 'outline'} className="flex-1 h-8 text-xs gap-1" onClick={toggleMergeMode}>
                <Layers className="w-3 h-3" />
                {mergeMode ? 'إلغاء الدمج' : 'دمج ورديات'}
              </Button>
            )}
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20" onClick={() => setShowCustomRange(true)}>
              <SlidersHorizontal className="w-3 h-3" />
              نطاق مخصص
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={printFullDay}>
              <Printer className="w-3 h-3" />
              طباعة اليوم
            </Button>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              className="flex-1 h-8 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
              onClick={() => exportPeriodsToExcel(periods, isToday ? 'اليوم' : selectedDate)}>
              <Download className="w-3 h-3" />
              تصدير Excel
            </Button>
            <Button size="sm" variant="outline"
              className="flex-1 h-8 text-xs gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              onClick={() => sharePeriodsToWhatsApp(periods, isToday ? 'اليوم' : selectedDate)}>
              <Share2 className="w-3 h-3" />
              واتساب
            </Button>
          </div>

          {/* Merge selection bar */}
          {mergeMode && (
            <div className={`flex items-center gap-2 rounded-lg p-2 border transition-all ${selectedIdxs.size >= 2 ? 'bg-primary/10 border-primary/30' : 'bg-muted/40 border-border'}`}>
              <span className="text-xs flex-1">
                {selectedIdxs.size === 0 ? 'اختر ورديتين أو أكثر للدمج' : `تم تحديد ${selectedIdxs.size} ورديات`}
              </span>
              {selectedIdxs.size >= 2 && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={printMerged}>
                  <Printer className="w-3 h-3" />
                  دمج وطباعة
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد بيانات لهذا اليوم</p>
            {orderDates.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">جرب تصفح الأيام السابقة</p>
            )}
          </CardContent>
        </Card>
      ) : (
        periods.map((p, i) => (
          <Card key={i} className={`transition-all ${p.isOngoing ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10' : ''} ${mergeMode && selectedIdxs.has(i) ? 'border-primary ring-2 ring-primary/30' : ''}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between mb-3 cursor-pointer"
                onClick={() => mergeMode ? toggleSelect(i) : setExpandedIdx(expandedIdx === i ? null : i)}>
                <div className="flex items-center gap-2">
                  {mergeMode && (
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selectedIdxs.has(i) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                      {selectedIdxs.has(i) && <span className="text-white text-[9px] font-bold">✓</span>}
                    </div>
                  )}
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">{p.periodLabel}</span>
                  {p.isOngoing && <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 animate-pulse">جارية</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {!mergeMode && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={e => { e.stopPropagation(); printPeriod(p); }}>
                      <Printer className="w-3 h-3" />طباعة
                    </Button>
                  )}
                  {!mergeMode && (
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedIdx === i ? 'rotate-90' : ''}`} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="bg-muted/50 rounded p-2 text-center">
                  <div className="text-lg font-bold">{p.totalOrders}</div>
                  <div className="text-xs text-muted-foreground">طلب</div>
                </div>
                <div className="bg-primary/5 rounded p-2 text-center">
                  <div className="text-lg font-bold text-primary">{(p.totalSales||0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">إجمالي <SarIcon size={10} /></div>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 rounded p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{(p.totalCash||0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">نقدي <SarIcon size={10} /></div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded p-2 text-center">
                  <div className="text-lg font-bold text-purple-700">{(p.totalCard||0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">شبكة <SarIcon size={10} /></div>
                </div>
              </div>

              {!mergeMode && expandedIdx === i && (
                <div className="mt-3 border-t pt-3 space-y-3">
                  {(!p.productsByCategory || p.productsByCategory.length === 0) ? (
                    <p className="text-xs text-muted-foreground text-center py-2">لا توجد بيانات منتجات</p>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />المنتجات المستهلكة
                      </div>
                      {p.productsByCategory.map((cat: any, ci: number) => (
                        <div key={ci} className="rounded-lg border overflow-hidden">
                          <div className="bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">{cat.categoryNameAr || 'أخرى'}</div>
                          <div className="divide-y">
                            {cat.items.map((item: any, ii: number) => (
                              <div key={ii} className="flex justify-between items-center px-3 py-1.5 text-xs">
                                <span>{item.nameAr}</span>
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">× {item.quantity}</Badge>
                                  <span className="text-muted-foreground font-mono">{(item.totalAmount||0).toFixed(1)} <SarIcon size={10} /></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* ── Custom Time-Range Dialog ────────────────────────────────── */}
      <Dialog open={showCustomRange} onOpenChange={setShowCustomRange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-violet-600" />
              دمج مخصص بنطاق زمني
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date label */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">التاريخ المحدد:</span>
              <span className="font-semibold">{selectedDate === getTodayLocalStr() ? 'اليوم' : selectedDate}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> من الساعة
                </label>
                <input
                  type="time"
                  value={customFromTime}
                  onChange={e => setCustomFromTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> إلى الساعة
                </label>
                <input
                  type="time"
                  value={customToTime}
                  onChange={e => setCustomToTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">اختصارات سريعة</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'الصبح', from: '06:00', to: '12:00' },
                  { label: 'الظهر', from: '12:00', to: '18:00' },
                  { label: 'المساء', from: '18:00', to: '00:00' },
                  { label: 'الليل', from: '00:00', to: '06:00' },
                  { label: 'النهار كامل', from: '06:00', to: '23:59' },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setCustomFromTime(preset.from); setCustomToTime(preset.to); }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      customFromTime === preset.from && customToTime === preset.to
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCustomRange(false)}>إلغاء</Button>
            <Button
              size="sm"
              className="gap-1 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={printCustomRange}
              disabled={customLoading || !customFromTime || !customToTime}
            >
              {customLoading
                ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />جارٍ التحميل...</>
                : <><Printer className="w-3 h-3" />طباعة التقرير</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
    const cashIn  = (shift.cashMovements || []).filter(m => m.type === 'cash_in'  || m.type === 'paid_in' ).reduce((s, m) => s + m.amount, 0);
    const cashOut = (shift.cashMovements || []).filter(m => m.type === 'cash_out' || m.type === 'paid_out').reduce((s, m) => s + m.amount, 0);
    const pb = shift.paymentBreakdown || {};
    const ob = (shift as any).orderTypeBreakdown || {};
    const diff = shift.cashDifference || 0;
    const row = (label: string, value: string, bold = false) =>
      `<div style="display:flex;justify-content:space-between;padding:2px 0;${bold ? 'font-weight:bold;' : ''}"><span>${label}</span><span>${value}</span></div>`;
    const sec = (title: string, body: string) =>
      `<div style="border-top:1px dashed #aaa;margin:5px 0;padding-top:5px;"><div style="font-weight:bold;color:#2D9B6E;margin-bottom:3px;font-size:12px;">${title}</div>${body}</div>`;

    const html = `<div style="font-family:'Cairo',Arial,sans-serif;font-size:12px;padding:5px 3px;direction:rtl;color:#000;background:#fff;">
  <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px;">
    <div style="font-size:15px;font-weight:bold;">مكان الشيف البخاري</div>
    <div style="font-size:11px;color:#555;">تقرير Z — إغلاق الوردية</div>
    <div style="font-size:11px;color:#555;">${shift.shiftNumber}</div>
  </div>
  ${row('الكاشير:', shift.employeeName)}
  ${row('الفرع:', (shift as any).branchName || 'الرئيسي')}
  ${row('فتح الوردية:', formatTime(shift.openedAt))}
  ${row('إغلاق الوردية:', shift.closedAt ? formatTime(shift.closedAt) : '-')}
  ${row('المدة:', formatDuration(shift.openedAt, shift.closedAt))}
  ${sec('ملخص المبيعات',
    row('إجمالي المبيعات:', formatCurrency(shift.totalSales)) +
    row('عدد الطلبات:', String(shift.totalOrders)) +
    row('ضريبة القيمة المضافة:', formatCurrency(shift.totalVAT)) +
    row('الخصومات:', formatCurrency(shift.totalDiscounts)) +
    row('المرتجعات:', formatCurrency(shift.totalRefunds)) +
    row('صافي الإيرادات:', formatCurrency(shift.netRevenue), true)
  )}
  ${sec('طرق الدفع',
    row('نقدي:', formatCurrency(pb.cash || 0)) +
    row('شبكة:', formatCurrency(pb.card || 0)) +
    ((pb.loyalty || 0) > 0 ? row('بطاقة:', formatCurrency(pb.loyalty)) : '')
  )}
  ${(ob.dine_in || ob.takeaway || ob.delivery) ? sec('أنواع الطلبات',
    ((ob.dine_in  || 0) > 0 ? row('محلي:',   String(ob.dine_in))  : '') +
    ((ob.takeaway || 0) > 0 ? row('سفري:',   String(ob.takeaway)) : '') +
    ((ob.delivery || 0) > 0 ? row('توصيل:',  String(ob.delivery)) : '')
  ) : ''}
  ${sec('حركة الصندوق',
    row('رصيد الافتتاح:', formatCurrency(shift.openingCash)) +
    (cashIn  > 0 ? row('إيداعات نقدية:', formatCurrency(cashIn))  : '') +
    (cashOut > 0 ? row('سحوبات نقدية:', formatCurrency(cashOut)) : '') +
    row('المبيعات النقدية:', formatCurrency(shift.totalCashSales)) +
    row('الرصيد المتوقع:', formatCurrency(shift.expectedCash || 0)) +
    row('الرصيد الفعلي:', formatCurrency(shift.closingCash || 0)) +
    `<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:bold;border-top:2px solid #000;margin-top:3px;padding-top:3px;"><span>الفرق:</span><span style="color:${diff >= 0 ? '#2D9B6E' : '#dc2626'}">${formatCurrency(diff)}</span></div>`
  )}
  ${shift.closingNotes ? sec('ملاحظات', `<p style="margin:0;font-size:11px;">${shift.closingNotes}</p>`) : ''}
  <div style="text-align:center;margin-top:8px;border-top:1px dashed #aaa;padding-top:6px;font-size:10px;color:#666;">
    مكان الشيف البخاري — chefsplace.online
  </div>
</div>`;
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) { alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير'); return; }
    win.document.write(`<!DOCTYPE html><html lang="ar"><head><meta charset="UTF-8">
<title>تقرير Z — ${shift.shiftNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', Arial, sans-serif; font-size: 13px; direction: rtl; color: #000; background: #fff; padding: 16px; max-width: 320px; margin: 0 auto; }
  @media print {
    body { max-width: 100%; padding: 4px; font-size: 12px; }
    .no-print { display: none !important; }
    @page { margin: 6mm; size: 80mm auto; }
  }
</style></head><body>
${html}
<div class="no-print" style="margin-top:20px;text-align:center;display:flex;gap:8px;justify-content:center;">
  <button onclick="window.print()" style="background:#2D9B6E;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-family:Cairo,Arial,sans-serif;font-weight:bold;cursor:pointer;">طباعة / حفظ PDF</button>
  <button onclick="window.close()" style="background:#eee;color:#333;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-family:Cairo,Arial,sans-serif;cursor:pointer;">إغلاق</button>
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(_) {} }, 300);
  }, []);

  if (loadingShift) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-20">
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
            variant={activeTab === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('history')}
          >
            <History className="w-4 h-4 ml-1" />
            السجل
          </Button>
          <Button
            variant={activeTab === 'auto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('auto')}
            className="gap-1"
          >
            <Zap className="w-4 h-4 ml-1" />
            تلقائية
          </Button>
        </div>
      </div>

      {activeTab === 'current' ? (
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
      ) : activeTab === 'auto' ? (
        /* Auto-Shift Periods Tab */
        <AutoShiftPeriodsTab />
      ) : (
        /* History Tab */
        <div className="space-y-3">
          {shiftHistory && shiftHistory.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                onClick={() => exportShiftsHistoryToExcel(shiftHistory)}>
                <Download className="w-3 h-3" />
                تصدير Excel
              </Button>
            </div>
          )}
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
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              فتح وردية جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">رصيد الافتتاح (<SarIcon size={12} />)</label>
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
        <DialogContent className="sm:max-w-md">
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
              <label className="text-sm font-medium mb-2 block">الرصيد الفعلي في الصندوق (<SarIcon size={12} />)</label>
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
        <DialogContent className="sm:max-w-md">
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
              <label className="text-sm font-medium mb-2 block">المبلغ (<SarIcon size={12} />)</label>
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2">
                <Button className="w-full gap-2" onClick={() => handlePrintZReport(selectedZReport)}>
                  <Printer className="w-4 h-4" />
                  طباعة تقرير Z
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline"
                    className="gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                    onClick={() => exportShiftsHistoryToExcel([selectedZReport])}>
                    <Download className="w-4 h-4" />
                    Excel
                  </Button>
                  <Button variant="outline"
                    className="gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() => shareShiftToWhatsApp(selectedZReport)}>
                    <Share2 className="w-4 h-4" />
                    واتساب
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <MobileBottomNav />
    </div>
  );
}
