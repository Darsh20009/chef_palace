import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, RotateCw, Trash2,
  Database, Zap, Shield, Server, Cpu, Clock, ArrowRight, Bell,
  Printer, RefreshCcw, ChevronLeft, Search, Filter, FileText, Wifi,
} from "lucide-react";

const TABS = [
  { key: "health",   label: "صحة النظام",     icon: Activity },
  { key: "audit",    label: "سجل التدقيق",    icon: Shield },
  { key: "queue",    label: "الطوابير",       icon: Zap },
  { key: "crash",    label: "استرداد الجلسات", icon: RefreshCcw },
  { key: "perf",     label: "أداء الـ APIs",  icon: Server },
  { key: "devices",  label: "الأجهزة",        icon: Cpu },
];

export default function ReliabilityHub() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<string>("health");

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-reliability-hub">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/manager/dashboard")}
              data-testid="button-back"
              className="h-9 w-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-base text-gray-900">مركز الموثوقية</h1>
              <p className="text-xs text-gray-500">سجلات ومراقبة وطوابير واسترداد</p>
            </div>
          </div>
          <HealthBadge />
        </div>

        {/* Tab bar */}
        <div className="border-t border-gray-100 overflow-x-auto">
          <div className="max-w-[1400px] mx-auto px-2 flex gap-0">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  data-testid={`tab-${t.key}`}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {tab === "health"   && <HealthTab />}
        {tab === "audit"    && <AuditTab />}
        {tab === "queue"    && <QueueTab />}
        {tab === "crash"    && <CrashTab />}
        {tab === "perf"     && <PerfTab />}
        {tab === "devices"  && <DevicesTab />}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
function HealthBadge() {
  const { data } = useQuery<any>({
    queryKey: ["/api/system/health"],
    refetchInterval: 30000,
  });
  if (!data) return null;
  const colors: Record<string, string> = {
    healthy:  "bg-primary/10 text-primary",
    warning:  "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    healthy: "سليم", warning: "تحذير", critical: "حرج",
  };
  return (
    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${colors[data.status]}`} data-testid="badge-health-status">
      <span className={`h-2 w-2 rounded-full ${data.status === 'healthy' ? 'bg-primary' : data.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
      {labels[data.status]}
    </div>
  );
}

function StatCard({ label, value, sub, color = "primary" }: any) {
  const map: Record<string, string> = {
    primary: "text-primary bg-primary/5 border-primary/20",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    red: "text-red-700 bg-red-50 border-red-200",
    gray: "text-gray-700 bg-gray-50 border-gray-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${map[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: any) {
  return (
    <div className="text-center py-16 text-gray-400" data-testid="empty-state">
      <Icon className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="font-medium text-gray-600">{title}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: SYSTEM HEALTH                                              */
/* ════════════════════════════════════════════════════════════════ */
function HealthTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/system/health"],
    refetchInterval: 15000,
  });

  if (isLoading || !data) return <Skeleton rows={4} />;

  const errColor = data.errorRate > 5 ? "red" : data.errorRate > 1 ? "amber" : "primary";
  const latColor = data.p95Latency > 3000 ? "red" : data.p95Latency > 1500 ? "amber" : "primary";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="معدل الأخطاء" value={`${data.errorRate}%`} sub={`${data.totalErrors} من ${data.totalRequests} طلب`} color={errColor} />
        <StatCard label="P95 زمن الاستجابة" value={`${data.p95Latency} ms`} sub={`متوسط ${data.avgLatency}ms`} color={latColor} />
        <StatCard label="مهام فاشلة" value={data.failedQueueJobs} sub="آخر ساعة" color={data.failedQueueJobs > 0 ? "red" : "primary"} />
        <StatCard label="جلسات معلّقة" value={data.activeCrashSessions} sub="بحاجة استرداد" color={data.activeCrashSessions > 0 ? "amber" : "primary"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">موارد الخادم</h3>
          </div>
          <div className="space-y-3">
            <Bar label="الذاكرة المستخدمة" value={data.memory.heapUsedMB} max={data.memory.heapTotalMB} unit="MB" />
            <Bar label="ذاكرة العملية" value={data.memory.rssMB} max={data.memory.rssMB * 2} unit="MB" muted />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">مدة التشغيل</span>
              <span className="font-bold">{data.uptimeHours} ساعة</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">حركة الطلبات (آخر ساعة)</h3>
          </div>
          <div className="space-y-3">
            <Row label="إجمالي الطلبات" value={data.totalRequests.toLocaleString()} />
            <Row label="أخطاء الخادم" value={data.totalErrors} bad={data.totalErrors > 0} />
            <Row label="متوسط زمن الاستجابة" value={`${data.avgLatency} ms`} />
            <Row label="P95" value={`${data.p95Latency} ms`} bad={data.p95Latency > 1500} />
            <Row label="P99" value={`${data.p99Latency} ms`} bad={data.p99Latency > 3000} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" /> آخر الأخطاء
        </h3>
        <RecentErrors />
      </div>
    </div>
  );
}

function Bar({ label, value, max, unit = "", muted = false }: any) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold">{value} / {max} {unit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${muted ? 'bg-gray-400' : pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Row({ label, value, bad }: any) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-bold ${bad ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function RecentErrors() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/system/recent-errors"],
    refetchInterval: 30000,
  });
  if (isLoading) return <Skeleton rows={3} />;
  if (!data || data.length === 0) return <EmptyState icon={CheckCircle2} title="لا توجد أخطاء حديثة" />;
  return (
    <div className="divide-y divide-gray-100">
      {data.slice(0, 8).map((e: any) => (
        <div key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <code className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">{e.method}</code>
            <span className="font-mono text-xs truncate">{e.path}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
            <span className="font-bold text-red-600">{e.statusCode}</span>
            <span>{e.durationMs}ms</span>
            <span>{new Date(e.createdAt).toLocaleTimeString('ar-SA', { hour12: false })}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: AUDIT LOGS                                                 */
/* ════════════════════════════════════════════════════════════════ */
const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء", update: "تعديل", delete: "حذف", print: "طباعة",
  cancel: "إلغاء", refund: "استرداد", login: "دخول", logout: "خروج",
  discount: "خصم", void: "إلغاء عملية", export: "تصدير",
};

function AuditTab() {
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/audit-logs", { action, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100', action, search });
      const r = await fetch(`/api/audit-logs?${params}`, { credentials: 'include' });
      return r.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرقم"
            data-testid="input-audit-search"
            className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-primary outline-none"
          />
        </div>
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          data-testid="select-action-filter"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-white"
        >
          <option value="all">كل العمليات</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading ? <Skeleton /> : !data?.logs?.length ? (
        <EmptyState icon={Shield} title="لا توجد سجلات" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">الوقت</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">الفاعل</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">العملية</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">الكيان</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50" data-testid={`row-log-${l.id}`}>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString('ar-SA', { hour12: false })}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-xs">{l.actorName || '—'}</div>
                    <div className="text-[10px] text-gray-500">{l.actorRole || l.actorType}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-bold text-primary">{ACTION_LABELS[l.action] || l.action}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs">{l.entityType}</div>
                    {l.entityLabel && <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{l.entityLabel}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-[10px] text-gray-500 font-mono">{l.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.total != null && (
        <p className="text-xs text-gray-500 text-center">إجمالي: {data.total.toLocaleString()} سجل</p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: QUEUE                                                      */
/* ════════════════════════════════════════════════════════════════ */
const QUEUE_TYPE_META: Record<string, { label: string; icon: any }> = {
  print:        { label: "طباعة",     icon: Printer },
  sync:         { label: "مزامنة",    icon: RefreshCcw },
  notification: { label: "إشعارات",   icon: Bell },
  kitchen:      { label: "المطبخ",    icon: Activity },
  webhook:      { label: "Webhook",   icon: Wifi },
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:    { label: "قيد الانتظار", cls: "bg-gray-100 text-gray-700" },
  processing: { label: "جاري التنفيذ", cls: "bg-blue-100 text-blue-700" },
  completed:  { label: "مكتمل",       cls: "bg-primary/10 text-primary" },
  failed:     { label: "فشل",         cls: "bg-red-100 text-red-700" },
  retrying:   { label: "إعادة محاولة", cls: "bg-amber-100 text-amber-700" },
};

function QueueTab() {
  const [type, setType]     = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const { toast } = useToast();

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/queue-jobs/stats"],
    refetchInterval: 10000,
  });
  const { data: jobs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/queue-jobs", { type, status }],
    queryFn: async () => {
      const params = new URLSearchParams({ type, status, limit: '100' });
      const r = await fetch(`/api/queue-jobs?${params}`, { credentials: 'include' });
      return r.json();
    },
    refetchInterval: 10000,
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/queue-jobs/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue-jobs"] });
      toast({ title: "تم", description: "أعيدت المهمة للطابور" });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/queue-jobs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/queue-jobs"] }),
  });

  return (
    <div className="space-y-4">
      {/* Per-type stats */}
      {stats?.byType && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(QUEUE_TYPE_META).map(([k, m]) => {
            const Icon = m.icon;
            const s = stats.byType[k] || { total: 0, pending: 0, completed: 0, failed: 0, avgDuration: 0 };
            return (
              <div key={k} className="bg-white rounded-xl border border-gray-200 p-4" data-testid={`stat-queue-${k}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-gray-700">{m.label}</span>
                </div>
                <div className="text-xl font-bold">{s.total}</div>
                <div className="flex gap-1.5 mt-1.5 text-[10px]">
                  {s.pending > 0 && <span className="text-gray-600">{s.pending} منتظر</span>}
                  {s.failed > 0 && <span className="text-red-600 font-bold">{s.failed} فاشل</span>}
                  {s.avgDuration > 0 && <span className="text-gray-500">~{s.avgDuration}ms</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" data-testid="select-queue-type">
          <option value="all">كل الأنواع</option>
          {Object.entries(QUEUE_TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" data-testid="select-queue-status">
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      {isLoading ? <Skeleton /> : !jobs?.length ? (
        <EmptyState icon={Zap} title="لا توجد مهام" sub="الطوابير فارغة" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">النوع</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">الحالة</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">المحاولات</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">المدة</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">الخطأ</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">الوقت</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((j: any) => {
                const meta = QUEUE_TYPE_META[j.type];
                const stMeta = STATUS_META[j.status];
                const Icon = meta?.icon || Zap;
                return (
                  <tr key={j.id} className="hover:bg-gray-50" data-testid={`row-job-${j.id}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium">{meta?.label || j.type}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stMeta?.cls || 'bg-gray-100'}`}>
                        {stMeta?.label || j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{j.attempts}/{j.maxAttempts}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{j.durationMs ? `${j.durationMs}ms` : '—'}</td>
                    <td className="px-3 py-2.5 text-[10px] text-red-600 truncate max-w-[200px]">{j.lastError || '—'}</td>
                    <td className="px-3 py-2.5 text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(j.createdAt).toLocaleString('ar-SA', { hour12: false })}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {(j.status === 'failed' || j.status === 'pending') && (
                          <button
                            onClick={() => retryMut.mutate(j.id)}
                            data-testid={`button-retry-${j.id}`}
                            className="h-7 w-7 rounded hover:bg-primary/10 flex items-center justify-center text-primary"
                            title="إعادة"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMut.mutate(j.id)}
                          data-testid={`button-delete-job-${j.id}`}
                          className="h-7 w-7 rounded hover:bg-red-50 flex items-center justify-center text-red-500"
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: CRASH RECOVERY                                             */
/* ════════════════════════════════════════════════════════════════ */
function CrashTab() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/crash-sessions/all"],
    refetchInterval: 15000,
  });
  const { toast } = useToast();
  const recoverMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/crash-sessions/${id}/recover`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crash-sessions/all"] });
      toast({ title: "تم الاسترداد", description: "تمت استعادة الجلسة" });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/crash-sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crash-sessions/all"] }),
  });

  if (isLoading) return <Skeleton />;
  if (!data?.length) return <EmptyState icon={CheckCircle2} title="لا جلسات معلّقة" sub="جميع الأجهزة تعمل بطبيعتها" />;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-bold">جلسات بحاجة لاسترداد</p>
          <p className="text-xs mt-0.5">تم حفظها تلقائياً قبل الانهيار. يمكن للموظف استرداد عمله.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.map((s: any) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4" data-testid={`crash-${s.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{s.page}</span>
                  <span className="text-sm font-bold">{s.ownerName || s.ownerId}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  محفوظة: {new Date(s.updatedAt).toLocaleString('ar-SA', { hour12: false })}
                </p>
                {s.deviceId && <p className="text-[10px] text-gray-400 font-mono">{s.deviceId}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => recoverMut.mutate(s.id)}
                  data-testid={`button-recover-${s.id}`}
                  className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  استرداد
                </button>
                <button
                  onClick={() => deleteMut.mutate(s.id)}
                  data-testid={`button-discard-${s.id}`}
                  className="h-7 w-7 rounded hover:bg-red-50 flex items-center justify-center text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-900">عرض البيانات المحفوظة</summary>
              <pre className="mt-2 p-2 bg-gray-50 rounded text-[10px] overflow-auto max-h-40 font-mono">
                {JSON.stringify(s.sessionData, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: API PERFORMANCE                                            */
/* ════════════════════════════════════════════════════════════════ */
function PerfTab() {
  const [hours, setHours] = useState<number>(24);
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/system/api-performance", hours],
    queryFn: async () => {
      const r = await fetch(`/api/system/api-performance?hours=${hours}`, { credentials: 'include' });
      return r.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {data?.totalRequests?.toLocaleString() || 0} طلب · مرتب بالأبطأ أولاً
        </p>
        <select value={hours} onChange={e => setHours(parseInt(e.target.value))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" data-testid="select-perf-hours">
          <option value={1}>آخر ساعة</option>
          <option value={6}>آخر 6 ساعات</option>
          <option value={24}>آخر 24 ساعة</option>
          <option value={168}>آخر أسبوع</option>
        </select>
      </div>

      {isLoading ? <Skeleton /> : !data?.rows?.length ? (
        <EmptyState icon={Server} title="لا توجد بيانات أداء بعد" sub="ستظهر بعد بدء حركة الطلبات" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">المسار</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">الطلبات</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">الأخطاء</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">معدل الفشل</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">المتوسط</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">P95</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">الأقصى</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.rows.map((r: any) => (
                <tr key={r.route} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <code className="text-xs font-mono">{r.route}</code>
                  </td>
                  <td className="text-center px-3 py-2.5 text-xs">{r.count.toLocaleString()}</td>
                  <td className={`text-center px-3 py-2.5 text-xs font-bold ${r.errors > 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.errors}</td>
                  <td className={`text-center px-3 py-2.5 text-xs font-bold ${r.errorRate > 5 ? 'text-red-600' : r.errorRate > 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {r.errorRate}%
                  </td>
                  <td className={`text-center px-3 py-2.5 text-xs font-bold ${r.avgMs > 1000 ? 'text-amber-600' : 'text-gray-700'}`}>{r.avgMs}ms</td>
                  <td className={`text-center px-3 py-2.5 text-xs font-bold ${r.p95Ms > 1500 ? 'text-red-600' : 'text-gray-700'}`}>{r.p95Ms}ms</td>
                  <td className="text-center px-3 py-2.5 text-xs text-gray-500">{r.maxMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: DEVICES                                                    */
/* ════════════════════════════════════════════════════════════════ */
function DevicesTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/system/devices"],
    refetchInterval: 30000,
  });

  if (isLoading) return <Skeleton />;
  if (!data?.rows?.length) return <EmptyState icon={Cpu} title="لا توجد بيانات أجهزة" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{data.rows.length} جهاز نشط · مرتب بالأكثر مشاكل</p>
      {data.rows.map((d: any, i: number) => {
        const ua = (d.userAgent || '').toLowerCase();
        const browser = ua.includes('chrome') ? 'Chrome' : ua.includes('safari') ? 'Safari' : ua.includes('firefox') ? 'Firefox' : 'Other';
        const platform = ua.includes('android') ? 'Android' : ua.includes('iphone') || ua.includes('ipad') ? 'iOS' : ua.includes('windows') ? 'Windows' : ua.includes('mac') ? 'Mac' : 'Other';
        return (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between" data-testid={`device-${i}`}>
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${d.healthy ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600'}`}>
                {d.healthy ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-bold text-sm">{d.userId}</p>
                <p className="text-xs text-gray-500">{platform} · {browser} · IP: {d.ipAddress}</p>
              </div>
            </div>
            <div className="text-left text-xs">
              <p><span className="font-bold">{d.count}</span> طلب</p>
              {d.errors > 0 && <p className="text-red-600 font-bold">{d.errors} خطأ ({d.errorRate}%)</p>}
              <p className="text-gray-400">{new Date(d.lastSeen).toLocaleTimeString('ar-SA', { hour12: false })}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
