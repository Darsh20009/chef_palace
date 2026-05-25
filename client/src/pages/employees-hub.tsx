import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import SarIcon from "@/components/sar-icon";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import {
  Users, Activity, ListChecks, AlertTriangle, Trophy, Shield,
  FileSpreadsheet, ArrowLeft, Plus, Search, Download, Trash2,
  Clock, CheckCircle2, Coffee, MapPin, TrendingUp, Award, X,
  Pause, Play, Calendar, ChevronRight, Filter
} from "lucide-react";

type Tab = "live" | "tasks" | "violations" | "performance" | "leaderboard" | "permissions" | "payroll";

const TABS: { id: Tab; labelAr: string; labelEn: string; Icon: any }[] = [
  { id: "live",        labelAr: "البث المباشر",  labelEn: "Live Status",   Icon: Activity },
  { id: "tasks",       labelAr: "المهام",         labelEn: "Tasks",         Icon: ListChecks },
  { id: "violations",  labelAr: "المخالفات",      labelEn: "Violations",    Icon: AlertTriangle },
  { id: "performance", labelAr: "الأداء",         labelEn: "Performance",   Icon: TrendingUp },
  { id: "leaderboard", labelAr: "الأفضل مبيعاً",  labelEn: "Leaderboard",   Icon: Trophy },
  { id: "permissions", labelAr: "الصلاحيات",      labelEn: "Permissions",   Icon: Shield },
  { id: "payroll",     labelAr: "كشف الرواتب",    labelEn: "Payroll",       Icon: FileSpreadsheet },
];

const ROLE_NAMES_AR: Record<string, string> = {
  cashier: "كاشير", barista: "باريستا", supervisor: "مشرف",
  branch_manager: "مدير فرع", owner: "مالك", admin: "مدير نظام",
  cleaner: "نظافة", driver: "سائق توصيل", accountant: "محاسب",
};
const ROLE_NAMES_EN: Record<string, string> = {
  cashier: "Cashier", barista: "Barista", supervisor: "Supervisor",
  branch_manager: "Branch Manager", owner: "Owner", admin: "System Admin",
  cleaner: "Cleaner", driver: "Delivery Driver", accountant: "Accountant",
};

export default function EmployeesHub() {
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [tab, setTab] = useState<Tab>("live");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top bar — minimal, sticky */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/manager/dashboard">
              <button className="p-2 -mr-2 rounded-lg hover:bg-gray-100" data-testid="button-back">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight">{tc('إدارة الموظفين', 'Employee Management')}</h1>
                <p className="text-[10px] text-gray-500 leading-tight">{tc('المركز الموحد', 'Unified Hub')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab strip — horizontal scroll, no animation */}
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-[1400px] mx-auto px-2 sm:px-4">
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {TABS.map(({ id, labelAr, labelEn, Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  data-testid={`tab-${id}`}
                  className={`shrink-0 px-4 py-2.5 flex items-center gap-2 text-sm border-b-2 transition-colors ${
                    tab === id
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{isAr ? labelAr : labelEn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {tab === "live"        && <LiveTab />}
        {tab === "tasks"       && <TasksTab />}
        {tab === "violations"  && <ViolationsTab />}
        {tab === "performance" && <PerformanceTab />}
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "permissions" && <PermissionsTab />}
        {tab === "payroll"     && <PayrollTab />}
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: LIVE STATUS                                                */
/* ════════════════════════════════════════════════════════════════ */
function LiveTab() {
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/employees/live-status"],
    refetchInterval: 15000,
  });

  if (isLoading) return <SkeletonRows />;
  const summary = data?.summary || {};
  const employees = data?.employees || [];

  return (
    <div className="space-y-4">
      {/* KPI strip — 4 numbers, no flair */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={tc('الكل', 'All')}          value={summary.total || 0}    Icon={Users}      tone="gray" />
        <Stat label={tc('في الوردية', 'On Shift')} value={summary.onShift || 0}  Icon={CheckCircle2} tone="green" />
        <Stat label={tc('في استراحة', 'On Break')} value={summary.onBreak || 0}  Icon={Coffee}     tone="gray" />
        <Stat label={tc('متأخر', 'Late')}          value={summary.late || 0}     Icon={Clock}      tone={summary.late > 0 ? "red" : "gray"} />
      </div>

      {/* Employee rows */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm">{tc('حالة الموظفين الآن', 'Employee Status Now')}</h2>
          <span className="text-xs text-gray-400">{tc('يحدّث تلقائياً', 'Auto-refreshing')}</span>
        </div>
        <div className="divide-y divide-gray-100">
          {employees.length === 0 && <EmptyRow label={tc('لا يوجد موظفون نشطون', 'No active employees')} />}
          {employees.map((e: any) => (
            <div key={e.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50" data-testid={`row-employee-${e.id}`}>
              <Avatar name={e.fullName} src={e.imageUrl} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{e.fullName}</p>
                <p className="text-xs text-gray-500">{(isAr ? ROLE_NAMES_AR[e.role] : ROLE_NAMES_EN[e.role]) || e.role} · {e.jobTitle}</p>
              </div>
              <StatusPill status={e.status} isLate={e.isLate} lateMinutes={e.lateMinutes} breakType={e.breakType} isAr={isAr} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: TASKS                                                       */
/* ════════════════════════════════════════════════════════════════ */
function TasksTab() {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const { data: tasks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/employee-tasks"] });
  const { data: emps = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const updateTask = useMutation({
    mutationFn: ({ id, ...body }: any) => apiRequest("PUT", `/api/employee-tasks/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/employee-tasks"] }),
  });
  const deleteTask = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employee-tasks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/employee-tasks"] }); toast({ title: "تم حذف المهمة" }); },
  });

  const filtered = useMemo(() => {
    if (!filter) return tasks;
    return tasks.filter((t: any) => t.status === filter);
  }, [tasks, filter]);

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter((t: any) => t.status === 'pending').length,
    in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
    completed: tasks.filter((t: any) => t.status === 'completed').length,
  }), [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
          {[
            { v: "", label: `الكل ${counts.all}` },
            { v: "pending", label: `قيد الانتظار ${counts.pending}` },
            { v: "in_progress", label: `جارية ${counts.in_progress}` },
            { v: "completed", label: `مكتملة ${counts.completed}` },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v)}
              data-testid={`filter-${o.v || 'all'}`}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filter === o.v ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} data-testid="button-new-task" className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> مهمة جديدة
        </button>
      </div>

      {showNew && <NewTaskInline employees={emps} onClose={() => setShowNew(false)} />}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && <SkeletonRows />}
        {!isLoading && filtered.length === 0 && <EmptyRow label="لا توجد مهام" />}
        <div className="divide-y divide-gray-100">
          {filtered.map((t: any) => {
            const emp = emps.find((e: any) => e.id === t.assignedTo);
            return (
              <div key={t.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50" data-testid={`row-task-${t.id}`}>
                <PriorityDot priority={t.priority} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : ''}`}>{t.title}</p>
                    {t.dueDate && <span className="text-[10px] text-gray-400">· {new Date(t.dueDate).toLocaleDateString('ar-SA')}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{emp?.fullName || t.assignedTo} · {t.category}</p>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => updateTask.mutate({ id: t.id, status: e.target.value })}
                  data-testid={`select-status-${t.id}`}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="in_progress">جارية</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
                <button onClick={() => { if (confirm("حذف؟")) deleteTask.mutate(t.id); }} className="p-2 text-gray-400 hover:text-red-600" data-testid={`button-delete-task-${t.id}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NewTaskInline({ employees, onClose }: { employees: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", assignedTo: "", priority: "normal", dueDate: "", category: "other", description: "" });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/employee-tasks", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-tasks"] });
      toast({ title: "تم إنشاء المهمة" });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">مهمة جديدة</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="عنوان المهمة *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          data-testid="input-task-title"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
        />
        <select
          value={form.assignedTo}
          onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          data-testid="select-task-assignee"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white"
        >
          <option value="">اختر الموظف *</option>
          {employees.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
        </select>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} data-testid="select-task-priority" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white">
          <option value="low">أولوية منخفضة</option>
          <option value="normal">عادية</option>
          <option value="high">عالية</option>
          <option value="urgent">عاجلة</option>
        </select>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="select-task-category" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white">
          <option value="cleaning">نظافة</option>
          <option value="inventory">مخزون</option>
          <option value="service">خدمة</option>
          <option value="maintenance">صيانة</option>
          <option value="training">تدريب</option>
          <option value="other">أخرى</option>
        </select>
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} data-testid="input-task-due" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
        <input type="text" placeholder="ملاحظات" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-task-desc" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200">إلغاء</button>
        <button
          onClick={() => create.mutate()}
          disabled={!form.title || !form.assignedTo || create.isPending}
          data-testid="button-save-task"
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >{create.isPending ? "..." : "إنشاء"}</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: VIOLATIONS                                                  */
/* ════════════════════════════════════════════════════════════════ */
function ViolationsTab() {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const { data: violations = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/employee-violations"] });
  const { data: emps = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employee-violations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/employee-violations"] }); toast({ title: "تم الحذف" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{violations.length} مخالفة مسجّلة</div>
        <button onClick={() => setShowNew(true)} data-testid="button-new-violation" className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> تسجيل مخالفة
        </button>
      </div>

      {showNew && <NewViolationInline employees={emps} onClose={() => setShowNew(false)} />}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading && <SkeletonRows />}
        {!isLoading && violations.length === 0 && <EmptyRow label="لا توجد مخالفات" />}
        <div className="divide-y divide-gray-100">
          {violations.map((v: any) => (
            <div key={v.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50" data-testid={`row-violation-${v.id}`}>
              <SeverityBadge severity={v.severity} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{v.employeeName} · <span className="text-gray-500 font-normal">{violationTypeLabel(v.type)}</span></p>
                <p className="text-xs text-gray-500 truncate">{v.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(v.occurredAt).toLocaleDateString('ar-SA')}</p>
              </div>
              {v.penaltyAmount > 0 && (
                <div className="text-left">
                  <p className="text-sm font-bold text-red-600">-{v.penaltyAmount} <SarIcon size={11} /></p>
                  <p className="text-[10px] text-gray-400">خصم</p>
                </div>
              )}
              <button onClick={() => { if (confirm("حذف؟")) del.mutate(v.id); }} className="p-2 text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function violationTypeLabel(t: string) {
  return ({
    tardiness: "تأخر", absence: "غياب", misconduct: "سوء سلوك",
    cash_shortage: "عجز نقدي", customer_complaint: "شكوى عميل",
    policy_breach: "مخالفة سياسة", other: "أخرى",
  } as any)[t] || t;
}

function NewViolationInline({ employees, onClose }: { employees: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ employeeId: "", type: "tardiness", severity: "minor", description: "", penaltyAmount: 0 });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/employee-violations", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/employee-violations"] }); toast({ title: "تم تسجيل المخالفة" }); onClose(); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">تسجيل مخالفة</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} data-testid="select-viol-employee" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">اختر الموظف *</option>
          {employees.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="select-viol-type" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="tardiness">تأخر</option>
          <option value="absence">غياب</option>
          <option value="misconduct">سوء سلوك</option>
          <option value="cash_shortage">عجز نقدي</option>
          <option value="customer_complaint">شكوى عميل</option>
          <option value="policy_breach">مخالفة سياسة</option>
          <option value="other">أخرى</option>
        </select>
        <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} data-testid="select-viol-severity" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="minor">بسيطة</option>
          <option value="moderate">متوسطة</option>
          <option value="major">كبيرة</option>
          <option value="critical">جسيمة</option>
        </select>
        <input type="number" placeholder="مبلغ الخصم (ر.س)" value={form.penaltyAmount} onChange={(e) => setForm({ ...form, penaltyAmount: parseFloat(e.target.value) || 0 })} data-testid="input-viol-penalty" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input type="text" placeholder="الوصف *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-viol-desc" className="border border-gray-200 rounded-lg px-3 py-2 text-sm md:col-span-2" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200">إلغاء</button>
        <button onClick={() => create.mutate()} disabled={!form.employeeId || !form.description || create.isPending} data-testid="button-save-violation" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
          {create.isPending ? "..." : "تسجيل"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: PERFORMANCE                                                 */
/* ════════════════════════════════════════════════════════════════ */
function PerformanceTab() {
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [period, setPeriod] = useState<string>("month");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/employees/performance", period], queryFn: () => fetch(`/api/employees/performance?period=${period}`).then(r => r.json()) });
  const employees = data?.employees || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-0.5 w-fit">
        {[
          { v: "week", labelAr: "أسبوع", labelEn: "Week" },
          { v: "month", labelAr: "شهر",  labelEn: "Month" },
          { v: "year", labelAr: "سنة",   labelEn: "Year" },
        ].map(o => (
          <button key={o.v} onClick={() => setPeriod(o.v)} data-testid={`period-${o.v}`} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${period === o.v ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            {isAr ? o.labelAr : o.labelEn}
          </button>
        ))}
      </div>

      {isLoading && <SkeletonRows />}
      {!isLoading && employees.length === 0 && <EmptyRow label={tc('لا توجد بيانات', 'No data available')} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {employees.map((e: any, idx: number) => (
          <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`card-perf-${e.id}`}>
            <div className="flex items-start gap-3">
              <div className="text-center">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                  e.rating === 'excellent' ? 'bg-primary/10 text-primary' :
                  e.rating === 'good'      ? 'bg-blue-50 text-blue-600' :
                  e.rating === 'average'   ? 'bg-gray-100 text-gray-600' :
                                             'bg-red-50 text-red-600'
                }`}>{e.score}</div>
                <p className="text-[10px] text-gray-400 mt-1">#{idx + 1}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{e.fullName}</p>
                <p className="text-xs text-gray-500">{(isAr ? ROLE_NAMES_AR[e.role] : ROLE_NAMES_EN[e.role]) || e.role}</p>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <MiniStat label={tc('حضور', 'Attendance')} value={e.attendance.score} sub={`${e.attendance.presentDays} ${tc('يوم', 'd')} · ${e.attendance.lateCount} ${tc('تأخر', 'late')}`} />
                  <MiniStat label={tc('مهام', 'Tasks')}      value={e.tasks.score} sub={`${e.tasks.completionRate}%`} />
                  <MiniStat label={tc('مبيعات', 'Sales')}    value={e.sales.score} sub={`${e.sales.orderCount} ${tc('طلب', 'orders')}`} />
                </div>
                {e.violations.count > 0 && (
                  <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {e.violations.count} {tc('مخالفة', 'violations')} · -{e.violations.totalPenalty} <SarIcon size={10} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: LEADERBOARD                                                 */
/* ════════════════════════════════════════════════════════════════ */
function LeaderboardTab() {
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [period, setPeriod] = useState<string>("month");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/employees/leaderboard", period], queryFn: () => fetch(`/api/employees/leaderboard?period=${period}`).then(r => r.json()) });
  const board = data?.leaderboard || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-0.5 w-fit">
        {[
          { v: "today", labelAr: "اليوم", labelEn: "Today" },
          { v: "week",  labelAr: "أسبوع", labelEn: "Week" },
          { v: "month", labelAr: "شهر",   labelEn: "Month" },
        ].map(o => (
          <button key={o.v} onClick={() => setPeriod(o.v)} data-testid={`lb-period-${o.v}`} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${period === o.v ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            {isAr ? o.labelAr : o.labelEn}
          </button>
        ))}
      </div>

      {isLoading && <SkeletonRows />}
      {!isLoading && board.length === 0 && <EmptyRow label={tc('لا توجد مبيعات في هذه الفترة', 'No sales in this period')} />}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {board.map((e: any, idx: number) => (
            <div key={e.id} className="px-4 py-3 flex items-center gap-3" data-testid={`row-lb-${e.id}`}>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                idx === 0 ? "bg-primary text-white" :
                idx === 1 ? "bg-gray-200 text-gray-700" :
                idx === 2 ? "bg-amber-100 text-amber-700" :
                "bg-gray-50 text-gray-500"
              }`}>{idx + 1}</div>
              <Avatar name={e.fullName} src={e.imageUrl} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{e.fullName}</p>
                <p className="text-xs text-gray-500">{(isAr ? ROLE_NAMES_AR[e.role] : ROLE_NAMES_EN[e.role]) || e.role} · {e.orderCount} {tc('طلب', 'orders')}</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">{e.sales.toLocaleString(isAr ? 'ar-SA' : 'en-US')} <SarIcon size={11} /></p>
                <p className="text-[10px] text-gray-400">{tc('متوسط', 'Avg')} {e.avgOrderValue} <SarIcon size={10} /></p>
              </div>
              {idx < 3 && <Award className={`h-5 w-5 ${idx === 0 ? "text-primary" : idx === 1 ? "text-gray-400" : "text-amber-500"}`} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: PERMISSIONS MATRIX                                          */
/* ════════════════════════════════════════════════════════════════ */
const PAGE_LABELS_AR: Record<string, string> = {
  dashboard: "لوحة التحكم", cashier: "الكاشير", pos: "نقطة البيع",
  shifts: "الورديات", orders: "الطلبات", kitchen: "المطبخ",
  tables: "الطاولات", menu_management: "إدارة المنيو", inventory: "المخزون",
  reports: "التقارير", accounting: "المحاسبة", employees: "الموظفون",
  settings: "الإعدادات", delivery: "التوصيل",
  unified_reports: "التقارير الموحدة", bi_analytics: "التحليلات الذكية",
};

function PermissionsTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/employees/permissions-matrix"] });
  const roles = data?.roles || [];

  if (isLoading) return <SkeletonRows />;

  // Collect all unique pages
  const allPages = Array.from(new Set(roles.flatMap((r: any) => r.accessiblePages))) as string[];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">صلاحيات الوصول للصفحات حسب الدور</p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-right px-4 py-3 font-semibold text-xs sticky right-0 bg-gray-50">الصفحة</th>
              {roles.map((r: any) => (
                <th key={r.role} className="text-center px-3 py-3 font-semibold text-xs whitespace-nowrap">{r.roleNameAr}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allPages.map((page) => (
              <tr key={page} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-medium sticky right-0 bg-white">{PAGE_LABELS_AR[page] || page}</td>
                {roles.map((r: any) => (
                  <td key={r.role} className="text-center px-3 py-2.5">
                    {r.accessiblePages.includes(page)
                      ? <CheckCircle2 className="h-4 w-4 text-primary inline" />
                      : <span className="text-gray-200">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: PAYROLL EXPORT                                              */
/* ════════════════════════════════════════════════════════════════ */
function PayrollTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/employees/payroll-export", month, year],
    queryFn: () => fetch(`/api/employees/payroll-export?month=${month}&year=${year}`).then(r => r.json()),
  });
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  const downloadCSV = () => {
    window.open(`/api/employees/payroll-export?month=${month}&year=${year}&format=csv`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} data-testid="select-payroll-month" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} data-testid="select-payroll-year" className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={downloadCSV} data-testid="button-download-csv" className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold">
          <Download className="h-4 w-4" /> تنزيل CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="إجمالي الصافي" value={`${(totals.totalNet || 0).toLocaleString('ar-SA')} ر.س`} Icon={FileSpreadsheet} tone="green" />
        <Stat label="إجمالي المبيعات" value={`${(totals.totalSales || 0).toLocaleString('ar-SA')} ر.س`} Icon={TrendingUp} tone="gray" />
        <Stat label="إجمالي الخصومات" value={`${(totals.totalDeductions || 0).toLocaleString('ar-SA')} ر.س`} Icon={AlertTriangle} tone={totals.totalDeductions > 0 ? "red" : "gray"} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {isLoading && <SkeletonRows />}
        {!isLoading && rows.length === 0 && <EmptyRow label="لا توجد بيانات للفترة المختارة" />}
        {!isLoading && rows.length > 0 && (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-right px-3 py-2 font-semibold">الموظف</th>
                <th className="text-center px-3 py-2 font-semibold">حضور</th>
                <th className="text-center px-3 py-2 font-semibold">ساعات</th>
                <th className="text-center px-3 py-2 font-semibold">طلبات</th>
                <th className="text-center px-3 py-2 font-semibold">مبيعات</th>
                <th className="text-center px-3 py-2 font-semibold">راتب أساس</th>
                <th className="text-center px-3 py-2 font-semibold">عمولة</th>
                <th className="text-center px-3 py-2 font-semibold">خصومات</th>
                <th className="text-center px-3 py-2 font-bold text-primary">الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r: any) => (
                <tr key={r.employeeId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.fullName}</td>
                  <td className="text-center px-3 py-2">{r.presentDays}</td>
                  <td className="text-center px-3 py-2">{r.totalHours}</td>
                  <td className="text-center px-3 py-2">{r.orderCount}</td>
                  <td className="text-center px-3 py-2">{r.totalSales}</td>
                  <td className="text-center px-3 py-2">{r.baseSalary}</td>
                  <td className="text-center px-3 py-2 text-primary">{r.commission}</td>
                  <td className="text-center px-3 py-2 text-red-600">{r.deductions > 0 ? `-${r.deductions}` : '0'}</td>
                  <td className="text-center px-3 py-2 font-bold">{r.netPay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  SHARED MICRO-COMPONENTS                                          */
/* ════════════════════════════════════════════════════════════════ */
function Stat({ label, value, Icon, tone = "gray" }: { label: string; value: any; Icon: any; tone?: "gray" | "green" | "red" }) {
  const toneCls = tone === "green" ? "bg-primary/10 text-primary" : tone === "red" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3" data-testid={`stat-${label}`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneCls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 truncate">{label}</p>
        <p className="font-bold text-base truncate">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="font-bold text-sm">{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) return <img src={src} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  return (
    <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
      {name?.charAt(0) || "?"}
    </div>
  );
}

function StatusPill({ status, isLate, lateMinutes, breakType, isAr = true }: any) {
  if (status === "on_break") {
    return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 flex items-center gap-1"><Coffee className="h-3 w-3" />{isAr ? 'استراحة' : 'On Break'}</span>;
  }
  if (status === "on_shift") {
    if (isLate === 1) {
      return <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 flex items-center gap-1"><Clock className="h-3 w-3" />{isAr ? `متأخر ${lateMinutes}د` : `Late ${lateMinutes}m`}</span>;
    }
    return <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{isAr ? 'في الوردية' : 'On Shift'}</span>;
  }
  return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-400">{isAr ? 'خارج الدوام' : 'Off Duty'}</span>;
}

function PriorityDot({ priority }: { priority: string }) {
  const cls = priority === 'urgent' ? 'bg-red-500' : priority === 'high' ? 'bg-amber-500' : priority === 'normal' ? 'bg-primary' : 'bg-gray-300';
  return <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cls}`} />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: any = {
    minor:    { label: "بسيطة",   cls: "bg-gray-100 text-gray-700" },
    moderate: { label: "متوسطة",  cls: "bg-amber-50 text-amber-700" },
    major:    { label: "كبيرة",   cls: "bg-orange-50 text-orange-700" },
    critical: { label: "جسيمة",   cls: "bg-red-50 text-red-700" },
  };
  const v = map[severity] || map.minor;
  return <span className={`text-[10px] px-2 py-1 rounded-md font-semibold ${v.cls} shrink-0`}>{v.label}</span>;
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-12 text-center text-sm text-gray-400">{label}</div>;
}
