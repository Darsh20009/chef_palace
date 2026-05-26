import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SarIcon from "@/components/sar-icon";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Clock, Banknote, CreditCard, ShoppingCart, AlertTriangle, Zap, History, Printer, ChevronRight, ChevronLeft, Calendar, Lock, Eye, EyeOff } from "lucide-react";
import { printShiftThermal } from "@/lib/print-utils";

const FINANCIALS_PASSWORD = "b2030";
const PRIVILEGED_ROLES = ["owner", "admin", "manager", "branch_manager"];

function getEmployeeRole(): string {
  try {
    const emp = JSON.parse(localStorage.getItem("currentEmployee") || "{}");
    return emp.role || "";
  } catch { return ""; }
}

interface CashierShift {
  _id: string;
  shiftNumber: string;
  employeeName: string;
  openedAt: string;
  totalOrders: number;
  totalSales: number;
  totalCashSales: number;
  totalCardSales: number;
  totalDigitalSales: number;
  paymentBreakdown: Record<string, number>;
  status: string;
}

interface ProductCategory {
  categoryNameAr: string;
  items: Array<{ nameAr: string; quantity: number; totalAmount: number }>;
}

interface AutoShift {
  isAuto: true;
  windowStart: string;
  windowEnd: string;
  totalOrders: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalDigital: number;
  periodLabel: string;
  productsByCategory?: ProductCategory[];
}

function fmt(n: number) { return <>{(n || 0).toFixed(2)} <SarIcon size={12} /></>; }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(start: string) {
  const mins = Math.floor((Date.now() - new Date(start).getTime()) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDateAr(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Shift History Dialog (embedded in POS bar) ──────────────────────────────
function ShiftHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const todayStr = getTodayStr();
  const [histDate, setHistDate] = useState(todayStr);
  const isToday = histDate === todayStr;

  const { data: rawDates } = useQuery<string[]>({
    queryKey: ['/api/shifts/order-dates'],
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const orderDates: string[] = Array.isArray(rawDates) ? rawDates : [];

  const { data: rawPeriods, isLoading } = useQuery<any[]>({
    queryKey: ['/api/shifts/auto-periods', histDate],
    queryFn: async () => {
      const params = isToday ? '' : `?date=${histDate}`;
      const res = await fetch(`/api/shifts/auto-periods${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    enabled: open,
    refetchInterval: isToday ? 60000 : false,
  });
  const periods: any[] = Array.isArray(rawPeriods) ? rawPeriods : [];

  const curIdx = orderDates.indexOf(histDate);
  const hasPrev = curIdx >= 0 && curIdx < orderDates.length - 1;
  const hasNext = curIdx > 0;

  const changeDate = (d: string) => setHistDate(d);

  const dayTotal  = periods.reduce((s, p) => s + (p.totalSales || 0), 0);
  const dayOrders = periods.reduce((s, p) => s + (p.totalOrders || 0), 0);
  const dayCash   = periods.reduce((s, p) => s + (p.totalCash   || 0), 0);
  const dayCard   = periods.reduce((s, p) => s + (p.totalCard   || 0), 0);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل الورديات
          </DialogTitle>
        </DialogHeader>

        {/* Date navigator */}
        <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => changeDate(orderDates[curIdx + 1])} disabled={!hasPrev}>
            <ChevronRight className="w-3 h-3" />
          </Button>
          <div className="flex-1 text-center">
            <div className="font-semibold text-sm flex items-center justify-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {isToday ? 'اليوم' : fmtDateAr(histDate)}
              {isToday && <Badge className="bg-primary text-white text-[9px] px-1 py-0 animate-pulse">مباشر</Badge>}
            </div>
            <div className="text-[10px] text-muted-foreground">{histDate}</div>
          </div>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => changeDate(orderDates[curIdx - 1])} disabled={!hasNext}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
        </div>

        {/* Day totals */}
        {dayOrders > 0 && (
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className="bg-muted/50 rounded p-1.5">
              <div className="font-bold text-sm">{dayOrders}</div>
              <div className="text-muted-foreground text-[10px]">طلب</div>
            </div>
            <div className="bg-primary/5 rounded p-1.5">
              <div className="font-bold text-sm text-primary">{dayTotal.toFixed(0)}</div>
              <div className="text-muted-foreground text-[10px]"><SarIcon size={10} /></div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 rounded p-1.5">
              <div className="font-bold text-sm text-green-700">{dayCash.toFixed(0)}</div>
              <div className="text-muted-foreground text-[10px]">نقدي</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded p-1.5">
              <div className="font-bold text-sm text-purple-700">{dayCard.toFixed(0)}</div>
              <div className="text-muted-foreground text-[10px]">شبكة</div>
            </div>
          </div>
        )}

        {/* Print full day */}
        {periods.length > 0 && (
          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1"
            onClick={() => {
              const merged = periods.reduce((acc: any, p: any) => ({
                totalOrders: (acc.totalOrders || 0) + (p.totalOrders || 0),
                totalSales:  (acc.totalSales  || 0) + (p.totalSales  || 0),
                totalCash:   (acc.totalCash   || 0) + (p.totalCash   || 0),
                totalCard:   (acc.totalCard   || 0) + (p.totalCard   || 0),
                windowStart: acc.windowStart || p.windowStart,
                windowEnd:   p.windowEnd,
                reportTitle: `تقرير اليوم الكامل — ${periods.length} ورديات`,
                productsByCategory: [],
              }), {});
              printShiftThermal(merged);
            }}>
            <Printer className="w-3 h-3" />
            طباعة يوم كامل ({periods.length} ورديات)
          </Button>
        )}

        {/* Periods list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : periods.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
            لا توجد ورديات لهذا اليوم
          </div>
        ) : (
          <div className="space-y-2">
            {periods.map((p, i) => (
              <div key={i} className={`rounded-lg border p-3 ${p.isOngoing ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-semibold text-sm">{p.periodLabel}</span>
                    {p.isOngoing && <Badge className="bg-blue-500 text-white text-[9px] px-1 py-0 animate-pulse">جارية</Badge>}
                  </div>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                    onClick={() => printShiftThermal(p)}>
                    <Printer className="w-2.5 h-2.5" />طباعة
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                  <div className="bg-muted/40 rounded px-1 py-0.5">
                    <div className="font-bold">{p.totalOrders}</div><div className="text-muted-foreground">طلب</div>
                  </div>
                  <div className="bg-primary/5 rounded px-1 py-0.5">
                    <div className="font-bold text-primary">{(p.totalSales||0).toFixed(0)}</div><div className="text-muted-foreground"><SarIcon size={10} /></div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 rounded px-1 py-0.5">
                    <div className="font-bold text-green-700">{(p.totalCash||0).toFixed(0)}</div><div className="text-muted-foreground">نقدي</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 rounded px-1 py-0.5">
                    <div className="font-bold text-purple-700">{(p.totalCard||0).toFixed(0)}</div><div className="text-muted-foreground">شبكة</div>
                  </div>
                </div>
                {/* Products */}
                {p.productsByCategory && p.productsByCategory.length > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    {p.productsByCategory.map((cat: any, ci: number) => (
                      <div key={ci}>
                        <div className="text-[10px] font-bold text-primary">{cat.categoryNameAr}</div>
                        {cat.items.map((item: any, ii: number) => (
                          <div key={ii} className="flex justify-between text-[10px] px-2 text-muted-foreground">
                            <span>{item.nameAr}</span><span>× {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main POS Shift Bar ───────────────────────────────────────────────────────
export function PosShiftBar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showAutoDialog, setShowAutoDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  // ── Financials visibility (hidden by default for non-privileged roles) ──────
  const isPrivileged = PRIVILEGED_ROLES.includes(getEmployeeRole());
  const [financialsVisible, setFinancialsVisible] = useState(isPrivileged);
  const [showPassDialog, setShowPassDialog] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const handleUnlockFinancials = () => {
    if (passInput === FINANCIALS_PASSWORD) {
      setFinancialsVisible(true);
      setShowPassDialog(false);
      setPassInput("");
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  // Masked value — shows ** with lock icon for employees, real value for managers
  const MV = ({ children }: { children: React.ReactNode }) => {
    if (financialsVisible) return <>{children}</>;
    return (
      <span
        className="cursor-pointer select-none tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity"
        onClick={() => { setPassInput(""); setPassError(false); setShowPassDialog(true); }}
        title="انقر لعرض البيانات"
      >**</span>
    );
  };

  // Password unlock dialog
  const passDialog = (
    <Dialog open={showPassDialog} onOpenChange={v => { setShowPassDialog(v); if (!v) { setPassInput(""); setPassError(false); } }}>
      <DialogContent className="sm:max-w-xs" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            عرض البيانات المالية
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-muted-foreground">أدخل كلمة المرور لعرض الأرقام المالية</p>
          <Input
            type="password"
            placeholder="كلمة المرور"
            value={passInput}
            onChange={e => { setPassInput(e.target.value); setPassError(false); }}
            onKeyDown={e => e.key === "Enter" && handleUnlockFinancials()}
            className={passError ? "border-red-500 focus-visible:ring-red-500" : ""}
            dir="ltr"
            autoFocus
          />
          {passError && <p className="text-xs text-red-500">كلمة المرور غير صحيحة</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowPassDialog(false)}>إلغاء</Button>
          <Button onClick={handleUnlockFinancials}>عرض</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Hide button (shown after unlocking for non-privileged users)
  const HideBtn = () => (!isPrivileged && financialsVisible) ? (
    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setFinancialsVisible(false)} title="إخفاء البيانات">
      <EyeOff className="w-3 h-3" />
    </Button>
  ) : null;

  const { data: activeShift } = useQuery<CashierShift | null>({
    queryKey: ['/api/shifts/active'],
    refetchInterval: 15000,
  });

  const { data: autoShift } = useQuery<AutoShift | null>({
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
      toast({ title: "تم فتح الوردية بنجاح", description: "يمكنك الآن استقبال الطلبات" });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/active'] });
      setShowOpenDialog(false);
      setOpeningCash(""); setOpeningNotes("");
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e.message || "فشل في فتح الوردية", variant: "destructive" });
    },
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
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/auto-current'] });
      setShowCloseDialog(false);
      setClosingCash(""); setClosingNotes("");
      if (data.shift) printZReport(data.shift);
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e.message || "فشل في إغلاق الوردية", variant: "destructive" });
    },
  });

  const handleStartShiftClick = () => {
    if (autoShift && autoShift.totalOrders > 0) {
      setShowAutoDialog(true);
    } else {
      setShowOpenDialog(true);
    }
  };

  const printZReport = (shift: CashierShift) => {
    const pb = shift.paymentBreakdown || {};
    printShiftThermal({
      shiftNumber:  shift.shiftNumber,
      employeeName: shift.employeeName,
      openedAt:     shift.openedAt,
      totalOrders:  shift.totalOrders,
      totalSales:   shift.totalSales,
      totalCash:    pb.cash  || shift.totalCashSales  || 0,
      totalCard:    pb.card  || shift.totalCardSales   || 0,
      paymentBreakdown: pb,
    });
  };

  // Shared dialogs JSX
  const openDialog = (
    <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Play className="w-5 h-5 text-primary" />فتح وردية جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">رصيد الافتتاح (<SarIcon size={12} />)</label>
            <Input type="number" placeholder="0.00" value={openingCash} onChange={e => setOpeningCash(e.target.value)} className="text-center font-mono text-lg" dir="ltr" />
            <p className="text-xs text-muted-foreground mt-1">المبلغ الموجود في الصندوق عند بدء الوردية</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">ملاحظات (اختياري)</label>
            <Textarea placeholder="أي ملاحظات..." value={openingNotes} onChange={e => setOpeningNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowOpenDialog(false)}>إلغاء</Button>
          <Button disabled={openMutation.isPending} onClick={() => openMutation.mutate({ openingCash: Number(openingCash) || 0, notes: openingNotes })}>
            {openMutation.isPending ? "جاري الفتح..." : "فتح الوردية"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Active manual shift bar ────────────────────────────────────────────────
  if (activeShift) {
    return (
      <>
        {passDialog}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-xs" dir="rtl">
          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 animate-pulse shrink-0">● مفتوحة</Badge>
          <span className="font-medium shrink-0">{activeShift.employeeName}</span>
          <span className="text-green-600 dark:text-green-400 shrink-0">|</span>
          <Clock className="w-3 h-3 shrink-0" />
          <span className="shrink-0">{fmtTime(activeShift.openedAt)} ({fmtDuration(activeShift.openedAt)})</span>
          <span className="text-green-600 dark:text-green-400 shrink-0">|</span>
          <ShoppingCart className="w-3 h-3 shrink-0" />
          <span className="shrink-0"><MV>{activeShift.totalOrders} طلب</MV></span>
          <Banknote className="w-3 h-3 shrink-0" />
          <span className="shrink-0"><MV>{fmt(activeShift.totalCashSales)}</MV></span>
          <CreditCard className="w-3 h-3 shrink-0" />
          <span className="shrink-0"><MV>{fmt((activeShift.paymentBreakdown?.card || 0) + (activeShift.totalDigitalSales || 0))}</MV></span>
          <HideBtn />
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-400 text-green-700 hover:bg-green-100 dark:hover:bg-green-900 shrink-0"
            onClick={() => setShowHistoryDialog(true)}>
            <History className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-green-400 text-green-700 hover:bg-green-100 dark:hover:bg-green-900 shrink-0"
            onClick={() => setShowCloseDialog(true)}>
            <Square className="w-3 h-3 ml-1" />
            غلق الوردية
          </Button>
        </div>

        {/* Close Shift Dialog */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Square className="w-5 h-5 text-red-500" />
                إغلاق الوردية
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>المبيعات الإجمالية</span><span className="font-mono font-bold text-primary">{fmt(activeShift.totalSales)}</span></div>
                <div className="flex justify-between"><span>نقدي</span><span className="font-mono">{fmt(activeShift.totalCashSales)}</span></div>
                <div className="flex justify-between"><span>شبكة</span><span className="font-mono">{fmt((activeShift.paymentBreakdown?.card || 0))}</span></div>
                <div className="flex justify-between"><span>عدد الطلبات</span><span className="font-mono">{activeShift.totalOrders}</span></div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">الرصيد الفعلي في الصندوق (<SarIcon size={12} />)</label>
                <Input type="number" placeholder="0.00" value={closingCash} onChange={e => setClosingCash(e.target.value)} className="text-center font-mono text-lg" dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">ملاحظات (اختياري)</label>
                <Textarea placeholder="أي ملاحظات..." value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>إلغاء</Button>
              <Button variant="destructive" disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate({ closingCash: Number(closingCash) || 0, closingNotes })}>
                {closeMutation.isPending ? "جاري الإغلاق..." : "إغلاق وطباعة التقرير"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ShiftHistoryDialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)} />
      </>
    );
  }

  // ─── Auto-shift bar (no manual shift open) ──────────────────────────────────
  if (autoShift && autoShift.totalOrders > 0) {
    return (
      <>
        {passDialog}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs" dir="rtl">
          <Zap className="w-3 h-3 shrink-0" />
          <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 shrink-0">وردية تلقائية</Badge>
          <span className="shrink-0">{fmtTime(autoShift.windowStart)} — {fmtTime(autoShift.windowEnd)}</span>
          <span className="text-blue-400 shrink-0">|</span>
          <ShoppingCart className="w-3 h-3 shrink-0" />
          <span className="shrink-0"><MV>{autoShift.totalOrders} طلب</MV></span>
          <Banknote className="w-3 h-3 shrink-0" />
          <span className="shrink-0"><MV>{fmt(autoShift.totalCash)}</MV></span>
          <CreditCard className="w-3 h-3 shrink-0" />
          <span className="shrink-0"><MV>{fmt(autoShift.totalCard)}</MV></span>
          <HideBtn />
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-400 text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 shrink-0"
            onClick={() => setShowHistoryDialog(true)}>
            <History className="w-3 h-3" />
          </Button>
          <Button size="sm" className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={handleStartShiftClick}>
            <Play className="w-3 h-3 ml-1" />
            بدأ وردية
          </Button>
        </div>

        {/* Auto-shift dialog: resume or start new */}
        <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                وردية تلقائية نشطة
              </DialogTitle>
            </DialogHeader>
            <div className="py-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                الوردية التلقائية تعمل منذ الساعة <span className="font-bold text-foreground">{fmtTime(autoShift.windowStart)}</span> وبها <span className="font-bold">{autoShift.totalOrders}</span> طلبات بإجمالي <span className="font-bold text-primary">{fmt(autoShift.totalSales)}</span>.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-green-50 dark:bg-green-950/20 rounded p-2 text-center">
                  <div className="font-bold text-green-700">{fmt(autoShift.totalCash)}</div>
                  <div className="text-muted-foreground">نقدي</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded p-2 text-center">
                  <div className="font-bold text-purple-700">{fmt(autoShift.totalCard)}</div>
                  <div className="text-muted-foreground">شبكة</div>
                </div>
              </div>
              {autoShift.productsByCategory && autoShift.productsByCategory.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    المنتجات المستهلكة
                  </div>
                  {autoShift.productsByCategory.map((cat, ci) => (
                    <div key={ci} className="rounded border text-xs overflow-hidden">
                      <div className="bg-primary/5 px-2 py-1 font-semibold text-primary">{cat.categoryNameAr}</div>
                      {cat.items.map((item, ii) => (
                        <div key={ii} className="flex justify-between items-center px-2 py-1 border-t">
                          <span>{item.nameAr}</span>
                          <span className="font-mono text-muted-foreground">× {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
                هل تريد فتح وردية يدوية جديدة، أم الاستمرار في تتبع الوردية التلقائية؟
              </div>
            </div>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => setShowAutoDialog(false)}>
                استمرار التلقائية
              </Button>
              <Button className="flex-1" onClick={() => { setShowAutoDialog(false); setShowOpenDialog(true); }}>
                <Play className="w-4 h-4 ml-1" />
                فتح وردية يدوية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {openDialog}
        <ShiftHistoryDialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)} />
      </>
    );
  }

  // ─── No shift at all — minimal bar with start button ────────────────────────
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b text-muted-foreground text-xs" dir="rtl">
        <Clock className="w-3 h-3 shrink-0" />
        <span className="shrink-0">لا توجد وردية مفتوحة</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowHistoryDialog(true)}>
          <History className="w-3 h-3" />
        </Button>
        <Button size="sm" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowOpenDialog(true)}>
          <Play className="w-3 h-3 ml-1" />
          بدأ وردية
        </Button>
      </div>

      {openDialog}
      <ShiftHistoryDialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)} />
    </>
  );
}
