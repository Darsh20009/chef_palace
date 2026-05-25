import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import SarIcon from "@/components/sar-icon";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import {
  Sparkles, Brain, TrendingUp, Package, Users, AlertTriangle, AlertCircle,
  ShieldAlert, Clock, ChevronLeft, RefreshCw, FileText, Zap, ArrowLeft, CheckCircle2,
} from "lucide-react";

const TABS = [
  { key: "suggestions", labelAr: "اقتراحات ذكية", labelEn: "Smart Suggestions", icon: Sparkles },
  { key: "report",      labelAr: "تقرير سردي",     labelEn: "Narrative Report",   icon: FileText },
  { key: "forecast",    labelAr: "تنبؤ المخزون",   labelEn: "Inventory Forecast", icon: Package },
];

export default function AIAutomation() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [tab, setTab] = useState<string>("suggestions");

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'} data-testid="page-ai-automation">
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
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-gray-900">{tc('الذكاء الاصطناعي والأتمتة', 'AI & Automation')}</h1>
              <p className="text-xs text-gray-500">{tc('اقتراحات · تقارير سرديّة · تنبؤات', 'Suggestions · Narrative reports · Forecasts')}</p>
            </div>
          </div>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-bold">{tc('المرحلة 6', 'Phase 6')}</span>
        </div>

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
                    active ? "border-primary text-primary" : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {isAr ? t.labelAr : t.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {tab === "suggestions" && <SuggestionsTab />}
        {tab === "report"      && <NarrativeTab />}
        {tab === "forecast"    && <ForecastTab />}
      </div>
    </div>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: SMART SUGGESTIONS                                          */
/* ════════════════════════════════════════════════════════════════ */
const ICON_MAP: Record<string, any> = {
  'package': Package,
  'alert-triangle': AlertTriangle,
  'users': Users,
  'trending-up': TrendingUp,
  'shield-alert': ShieldAlert,
  'alert-circle': AlertCircle,
  'clock': Clock,
};

const TYPE_STYLES: Record<string, any> = {
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-600',     badge: 'bg-red-600 text-white',     labelAr: 'حرج',    labelEn: 'Critical' },
  warning:  { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   badge: 'bg-amber-500 text-white',   labelAr: 'تحذير',  labelEn: 'Warning' },
  info:     { bg: 'bg-white',      border: 'border-gray-200',    icon: 'text-gray-700',    badge: 'bg-gray-200 text-gray-700', labelAr: 'معلومة', labelEn: 'Info' },
  success:  { bg: 'bg-primary/5',  border: 'border-primary/20',  icon: 'text-primary',     badge: 'bg-primary text-white',     labelAr: 'إيجابي', labelEn: 'Positive' },
};

function SuggestionsTab() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/ai/smart-suggestions"],
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton />;

  const suggestions = data?.suggestions || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700">{summary.critical || 0} {tc('حرج', 'Critical')}</span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">{summary.warning || 0} {tc('تحذير', 'Warning')}</span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-700">{summary.info || 0} {tc('معلومة', 'Info')}</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-suggestions"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {tc('تحديث', 'Refresh')}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-primary opacity-50" />
          <p className="font-bold text-gray-700">{tc('كل شيء على ما يرام', 'Everything is fine')}</p>
          <p className="text-sm">{tc('لا توجد اقتراحات حالياً — استمر في العمل الجيد', 'No suggestions right now — keep up the good work')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s: any) => {
            const Icon = ICON_MAP[s.icon] || Sparkles;
            const style = TYPE_STYLES[s.type] || TYPE_STYLES.info;
            return (
              <div
                key={s.id}
                className={`rounded-xl border ${style.bg} ${style.border} p-4`}
                data-testid={`suggestion-${s.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-white flex items-center justify-center ${style.icon} flex-shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-sm text-gray-900">{s.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${style.badge} flex-shrink-0`}>{isAr ? style.labelAr : style.labelEn}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{s.message}</p>

                    {s.extra?.next7 && (
                      <div className="mt-3 grid grid-cols-7 gap-1">
                        {s.extra.next7.map((d: any, i: number) => (
                          <div key={i} className="text-center bg-white rounded p-1.5">
                            <div className="text-[9px] text-gray-500">{d.dayName}</div>
                            <div className="text-[10px] font-bold text-gray-900 mt-0.5">{d.predictedRevenue}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {s.action && (
                      <button
                        onClick={() => setLocation(s.actionLink)}
                        data-testid={`button-action-${s.id}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        {s.action} <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.generatedAt && (
        <p className="text-[10px] text-gray-400 text-center">
          {tc('تم التوليد', 'Generated')}: {new Date(data.generatedAt).toLocaleString(isAr ? 'ar-SA' : 'en-US', { hour12: false })}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: AI NARRATIVE REPORT                                        */
/* ════════════════════════════════════════════════════════════════ */
function NarrativeTab() {
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [data, setData] = useState<any>(null);

  const periodLabels: Record<string, { ar: string; en: string }> = {
    today: { ar: 'اليوم', en: 'Today' },
    week:  { ar: 'الأسبوع', en: 'This Week' },
    month: { ar: 'الشهر', en: 'This Month' },
  };

  const mut = useMutation({
    mutationFn: async (p: string) => {
      const r = await apiRequest("POST", "/api/ai/narrative-report", { period: p });
      return r.json();
    },
    onSuccess: (d) => setData(d),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['today', 'week', 'month'] as const).map(p => (
          <button
            key={p}
            onClick={() => { setPeriod(p); mut.mutate(p); }}
            data-testid={`button-period-${p}`}
            className={`px-4 py-2 text-sm font-bold rounded-lg border transition-colors ${
              period === p && data
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-gray-200 hover:border-primary'
            }`}
          >
            {isAr ? periodLabels[p].ar : periodLabels[p].en}
          </button>
        ))}
        {!data && !mut.isPending && (
          <button
            onClick={() => mut.mutate(period)}
            data-testid="button-generate-report"
            className="px-4 py-2 bg-gradient-to-l from-violet-500 to-fuchsia-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            {tc('توليد التقرير', 'Generate Report')}
          </button>
        )}
      </div>

      {mut.isPending && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-3 animate-pulse">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <p className="font-bold text-gray-900">{tc('يحلّل البيانات...', 'Analyzing data...')}</p>
          <p className="text-xs text-gray-500 mt-1">{tc('جاري قراءة الطلبات والأنماط', 'Reading orders and patterns')}</p>
        </div>
      )}

      {data && (
        <>
          <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h3 className="font-bold text-base text-gray-900">{tc('تحليل الأداء', 'Performance Analysis')}</h3>
              <span className="text-[10px] bg-violet-200 text-violet-800 px-2 py-0.5 rounded font-bold">
                {data.source === 'ai' ? 'AI' : tc('تحليل ذكي', 'Smart Analysis')}
              </span>
            </div>
            <div className="prose prose-sm max-w-none text-gray-800 leading-loose whitespace-pre-line text-base">
              {data.narrative}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label={tc('الإيرادات', 'Revenue')} value={`${data.stats.currentRevenue.toLocaleString()} ر.س`} sub={`${tc('السابقة', 'Previous')}: ${data.stats.previousRevenue.toLocaleString()}`} />
            <Stat label={tc('النمو', 'Growth')} value={`${data.stats.growthPct > 0 ? '+' : ''}${data.stats.growthPct}%`} sub={tc('مقارنة بالفترة السابقة', 'vs previous period')} color={data.stats.growthPct > 0 ? 'primary' : 'red'} />
            <Stat label={tc('الطلبات', 'Orders')} value={data.stats.currentOrders.toLocaleString()} sub={`${tc('السابقة', 'Previous')}: ${data.stats.previousOrders}`} />
            <Stat label={tc('متوسط الطلب', 'Avg Order')} value={`${data.stats.avgOrder} ر.س`} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-bold text-sm mb-3">{tc('توزيع المبيعات حسب فترة اليوم', 'Sales by Time of Day')}</h4>
            <div className="space-y-2">
              {Object.entries(data.stats.hourBuckets).map(([k, v]: any) => {
                const labels: Record<string, { ar: string; en: string }> = {
                  morning:   { ar: 'الصباح', en: 'Morning' },
                  afternoon: { ar: 'العصر',  en: 'Afternoon' },
                  evening:   { ar: 'المساء', en: 'Evening' },
                  night:     { ar: 'الليل',  en: 'Night' },
                };
                const max = Math.max(...Object.values(data.stats.hourBuckets) as number[]);
                const pct = max ? (v / max) * 100 : 0;
                return (
                  <div key={k}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{isAr ? labels[k]?.ar : labels[k]?.en}</span>
                      <span className="font-bold">{v.toLocaleString()} <SarIcon size={12} /></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {data.stats.topItems?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-bold text-sm mb-3">{tc('أكثر المنتجات مبيعاً', 'Top Selling Products')}</h4>
              <div className="divide-y divide-gray-100">
                {data.stats.topItems.map(([name, count]: any, i: number) => (
                  <div key={i} className="py-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                      {name}
                    </span>
                    <span className="font-bold text-primary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!data && !mut.isPending && (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium text-gray-600">{tc('اختر فترة واضغط "توليد التقرير"', 'Select a period and click "Generate Report"')}</p>
          <p className="text-sm mt-1">{tc('سنحول الأرقام إلى قصة واضحة وقابلة للفهم', 'We\'ll turn numbers into a clear, readable story')}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color = "gray" }: any) {
  const colors: Record<string, string> = {
    gray: 'text-gray-900',
    primary: 'text-primary',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/*  TAB: SMART INVENTORY FORECASTING                                */
/* ════════════════════════════════════════════════════════════════ */
const URGENCY_STYLES: Record<string, any> = {
  critical: { bg: 'bg-red-50',    text: 'text-red-700',    labelAr: 'حرج',    labelEn: 'Critical', dot: 'bg-red-500' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', labelAr: 'عالي',   labelEn: 'High',     dot: 'bg-orange-500' },
  medium:   { bg: 'bg-amber-50',  text: 'text-amber-700',  labelAr: 'متوسط',  labelEn: 'Medium',   dot: 'bg-amber-500' },
  low:      { bg: 'bg-blue-50',   text: 'text-blue-700',   labelAr: 'منخفض',  labelEn: 'Low',      dot: 'bg-blue-500' },
  ok:       { bg: 'bg-primary/5', text: 'text-primary',    labelAr: 'مستقر',  labelEn: 'Stable',   dot: 'bg-primary' },
};

function ForecastTab() {
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [filter, setFilter] = useState<string>('all');
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/ai/inventory-forecast"],
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton />;

  const forecast = data?.forecast || [];
  const summary = data?.summary || {};
  const filtered = filter === 'all' ? forecast : forecast.filter((f: any) => f.urgency === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-700">{tc('حرج', 'Critical')} (≤3 {tc('أيام', 'days')})</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{summary.critical || 0}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs font-bold text-orange-700">{tc('عالي', 'High')} (≤7 {tc('أيام', 'days')})</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{summary.high || 0}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-700">{tc('متوسط', 'Medium')} (≤14 {tc('يوم', 'days')})</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.medium || 0}</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-xs font-bold text-primary">{tc('تكلفة الطلب الموصى', 'Recommended Reorder Cost')}</p>
          <p className="text-2xl font-bold text-primary mt-1">{Math.round(summary.totalReorderCost || 0).toLocaleString()} <SarIcon size={16} /></p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {['all', 'critical', 'high', 'medium', 'low', 'ok'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {f === 'all' ? tc('الكل', 'All') : (isAr ? URGENCY_STYLES[f].labelAr : URGENCY_STYLES[f].labelEn)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{tc('لا توجد عناصر بهذه الحالة', 'No items in this status')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">{tc('المنتج', 'Product')}</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">{tc('الحالة', 'Status')}</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">{tc('المخزون', 'Stock')}</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">{tc('يومياً', 'Daily')}</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">{tc('أيام متبقية', 'Days Left')}</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">{tc('يجب الطلب في', 'Reorder By')}</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">{tc('الكمية الموصى بها', 'Recommended Qty')}</th>
                <th className="text-center px-3 py-2.5 font-medium text-gray-600">{tc('التكلفة', 'Cost')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((f: any) => {
                const u = URGENCY_STYLES[f.urgency];
                return (
                  <tr key={f.id} className="hover:bg-gray-50" data-testid={`forecast-${f.id}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-xs">{isAr ? f.nameAr : (f.nameEn || f.nameAr)}</div>
                      <div className="text-[10px] text-gray-500">{f.code}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded ${u.bg} ${u.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} />
                        {isAr ? u.labelAr : u.labelEn}
                      </span>
                    </td>
                    <td className="text-center px-3 py-2.5 text-xs font-bold">{f.currentStock} {f.unit}</td>
                    <td className="text-center px-3 py-2.5 text-xs">{f.dailyConsumption || '—'}</td>
                    <td className={`text-center px-3 py-2.5 text-xs font-bold ${f.daysRemaining != null && f.daysRemaining <= 7 ? 'text-red-600' : 'text-gray-700'}`}>
                      {f.daysRemaining != null ? `${f.daysRemaining} ${tc('يوم', 'days')}` : '—'}
                    </td>
                    <td className="text-center px-3 py-2.5 text-[10px] text-gray-500 whitespace-nowrap">
                      {f.reorderDate ? new Date(f.reorderDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '—'}
                    </td>
                    <td className="text-center px-3 py-2.5 text-xs font-bold text-primary">
                      {f.recommendedOrderQty ? `${f.recommendedOrderQty} ${f.unit}` : '—'}
                    </td>
                    <td className="text-center px-3 py-2.5 text-xs">{f.estimatedCost ? <>{f.estimatedCost} <SarIcon size={10} /></> : '—'}</td>
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
