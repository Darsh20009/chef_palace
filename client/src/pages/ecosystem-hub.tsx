import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Key, Webhook, Plug, Activity, Copy, Plus, Trash2, RefreshCw,
  ChevronLeft, CheckCircle2, AlertCircle, Clock, Send, Code2,
  Eye, EyeOff, ShieldCheck, Zap, X, Play, ToggleLeft, ToggleRight,
  Radio, Filter, ChevronDown, Settings, ArrowRight, Layers,
} from "lucide-react";

const TABS = [
  { key: "overview",     label: "نظرة عامة",    icon: Activity },
  { key: "automations",  label: "الأتمتة",       icon: Zap },
  { key: "webhooks",     label: "Webhooks",     icon: Webhook },
  { key: "integrations", label: "التكاملات",    icon: Plug },
  { key: "api-keys",     label: "مفاتيح API",   icon: Key },
  { key: "events",       label: "سجل الأحداث",  icon: Radio },
  { key: "docs",         label: "الوثائق",      icon: Code2 },
];

export default function EcosystemHub() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" data-testid="page-ecosystem">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/manager/dashboard")} data-testid="button-back"
              className="h-9 w-9 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-gray-900">منظومة التكامل</h1>
              <p className="text-xs text-gray-500">Webhooks · Automations · APIs · ERP · واتساب · Shopify · Zapier</p>
            </div>
          </div>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-bold">المرحلة 8</span>
        </div>
        <div className="border-t border-gray-100 overflow-x-auto">
          <div className="max-w-[1400px] mx-auto px-2 flex gap-0">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} data-testid={`tab-${t.key}`}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${active ? "border-primary text-primary" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {tab === "overview"     && <OverviewTab onTabSwitch={setTab} />}
        {tab === "automations"  && <AutomationsTab />}
        {tab === "webhooks"     && <WebhooksTab />}
        {tab === "integrations" && <IntegrationsTab />}
        {tab === "api-keys"     && <ApiKeysTab />}
        {tab === "events"       && <EventsTab />}
        {tab === "docs"         && <DocsTab />}
      </div>
    </div>
  );
}

/* ═══════════════ OVERVIEW ═══════════════ */
function OverviewTab({ onTabSwitch }: { onTabSwitch: (t: string) => void }) {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/ecosystem/stats"], refetchInterval: 30_000 });
  const { data: rulesRaw } = useQuery<any>({ queryKey: ["/api/ecosystem/automations"] });
  const { data: eventsRaw } = useQuery<any>({ queryKey: ["/api/ecosystem/events/recent"], queryFn: async () => (await fetch("/api/ecosystem/events/recent?limit=5")).json() });

  const rules: any[] = Array.isArray(rulesRaw) ? rulesRaw : [];
  const events: any[] = Array.isArray(eventsRaw) ? eventsRaw : [];

  const statCards = [
    { label: "قواعد الأتمتة", value: rules.length, sub: `${rules.filter(r => r.isActive).length} نشطة`, icon: Zap, color: "text-violet-600", bg: "bg-violet-50", tab: "automations" },
    { label: "Webhooks نشطة", value: stats?.webhooksActive ?? 0, sub: `${stats?.deliveries24h ?? 0} إرسال (24س)`, icon: Webhook, color: "text-purple-600", bg: "bg-purple-50", tab: "webhooks" },
    { label: "تكاملات متصلة", value: stats?.integrationsConnected ?? 0, sub: "من الكتالوج", icon: Plug, color: "text-primary", bg: "bg-primary/5", tab: "integrations" },
    { label: "مفاتيح API نشطة", value: stats?.apiKeysActive ?? 0, sub: `${stats?.apiCalls24h ?? 0} طلب (24س)`, icon: Key, color: "text-blue-600", bg: "bg-blue-50", tab: "api-keys" },
    { label: "أحداث اليوم", value: events.length, sub: "من سجل الأحداث", icon: Radio, color: "text-cyan-600", bg: "bg-cyan-50", tab: "events" },
    { label: "Webhooks فاشلة", value: stats?.deliveriesFailed ?? 0, sub: "خلال 24 ساعة", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", tab: "webhooks" },
  ];

  const CAT_ICONS: Record<string, string> = {
    orders: "🛒", customers: "👤", loyalty: "⭐", inventory: "📦",
    menu: "🍽️", payments: "💳", operations: "⚙️", reservations: "📅", system: "🔧",
  };

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage:"radial-gradient(circle at 20% 50%, #a78bfa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #22d3ee 0%, transparent 50%)"}} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center"><Zap className="h-4 w-4 text-violet-300" /></div>
            <span className="text-xs text-gray-400 font-mono">QIROX Integration Engine v2.0</span>
          </div>
          <h2 className="text-xl font-bold mb-1">اربط نظامك بالعالم</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            30+ تكامل جاهز · قواعد أتمتة مرئية · API مفتوح · Webhooks آنية · أحداث مباشرة
          </p>
          <div className="flex flex-wrap gap-2">
            {["Zapier", "n8n", "Shopify", "WhatsApp", "Telegram", "Slack", "Google Sheets", "SAP", "Jahez"].map(s => (
              <span key={s} className="text-[10px] font-bold bg-white/10 border border-white/20 text-gray-200 px-2 py-0.5 rounded">{s}</span>
            ))}
            <span className="text-[10px] font-bold bg-violet-500/30 border border-violet-400/30 text-violet-200 px-2 py-0.5 rounded">+24 أكثر</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {statCards.map((it, i) => {
          const Icon = it.icon;
          return (
            <button key={i} onClick={() => onTabSwitch(it.tab)} data-testid={`stat-card-${i}`}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 hover:shadow-sm transition-all text-right w-full">
              <div className={`h-10 w-10 rounded-xl ${it.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`h-5 w-5 ${it.color}`} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-gray-900">{it.value.toLocaleString('ar-SA')}</p>
                <p className="text-xs text-gray-500 truncate">{it.label}</p>
                <p className="text-[10px] text-gray-400">{it.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent Events */}
      {events.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-900">آخر الأحداث</h3>
            <button onClick={() => onTabSwitch("events")} className="text-xs text-primary">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {events.map((ev: any, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-base">{CAT_ICONS[ev.event?.split('.')[0]] || '⚡'}</span>
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{ev.event}</span>
                {ev.automationsRan > 0 && <span className="bg-violet-100 text-violet-700 text-[9px] px-1.5 py-0.5 rounded font-bold">{ev.automationsRan} أتمتة</span>}
                {ev.webhooksRan > 0 && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded font-bold">{ev.webhooksRan} webhook</span>}
                <span className="text-gray-400 mr-auto">{new Date(ev.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Zap, label: "إنشاء قاعدة أتمتة", sub: "If X → Do Y", color: "violet", tab: "automations" },
          { icon: Webhook, label: "إضافة Webhook", sub: "أرسل أحداث لنظامك", color: "purple", tab: "webhooks" },
          { icon: Plug, label: "تثبيت تكامل", sub: "من 30+ خيار", color: "cyan", tab: "integrations" },
        ].map((a, i) => {
          const Icon = a.icon;
          return (
            <button key={i} onClick={() => onTabSwitch(a.tab)}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all text-right w-full">
              <div className={`h-10 w-10 rounded-xl bg-${a.color}-100 flex items-center justify-center`}><Icon className={`h-5 w-5 text-${a.color}-600`} /></div>
              <div>
                <p className="font-bold text-sm text-gray-900">{a.label}</p>
                <p className="text-xs text-gray-500">{a.sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 mr-auto" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════ AUTOMATIONS ═══════════════ */
const CONDITION_OPERATORS = [
  { key: "eq", label: "يساوي" }, { key: "ne", label: "لا يساوي" },
  { key: "gt", label: "أكبر من" }, { key: "lt", label: "أصغر من" },
  { key: "contains", label: "يحتوي" },
];

function AutomationsTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: rulesRaw, isLoading } = useQuery<any>({ queryKey: ["/api/ecosystem/automations"] });
  const { data: catalog } = useQuery<any>({ queryKey: ["/api/ecosystem/catalog"] });
  const { data: actionTypes } = useQuery<any>({ queryKey: ["/api/ecosystem/automation-types"] });

  const rules: any[] = Array.isArray(rulesRaw) ? rulesRaw : [];
  const events: any[] = catalog?.events || [];

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ecosystem/automations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/automations"] }); toast({ title: "تم الحذف" }); },
  });
  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: any) => apiRequest("PATCH", `/api/ecosystem/automations/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/automations"] }),
  });
  const testMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/ecosystem/automations/${id}/test`)).json(),
    onSuccess: () => toast({ title: "✅ تم إرسال حدث اختبار" }),
  });

  const ACTION_ICONS: Record<string, string> = {
    webhook: "🔗", telegram: "✈️", slack: "💼", whatsapp: "💬",
    email: "📧", google_sheets: "📗", sms: "📱",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{rules.length} قاعدة · {rules.filter(r => r.isActive).length} نشطة</p>
          <p className="text-xs text-gray-400 mt-0.5">إذا حدث X في النظام → افعل Y تلقائياً</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditId(null); }} data-testid="button-create-automation"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90">
          <Plus className="h-4 w-4" />قاعدة جديدة
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
        <Zap className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-violet-900 mb-0.5">كيف تعمل الأتمتة؟</p>
          <p className="text-xs text-violet-700 leading-relaxed">حدد <strong>حدثاً مُثيراً</strong> (مثل: إنشاء طلب)، أضف <strong>شروطاً اختيارية</strong> (مثل: المبلغ أكبر من 100)، ثم حدد <strong>الإجراءات</strong> (مثل: أرسل رسالة تيليغرام + سجّل في Google Sheets). كل شيء يحدث تلقائياً بدون كود.</p>
        </div>
      </div>

      {/* Rules List */}
      {isLoading ? <div className="h-40 bg-gray-100 rounded-xl animate-pulse" /> :
        rules.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
            <Zap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-700 mb-1">لا توجد قواعد أتمتة بعد</p>
            <p className="text-sm text-gray-500 mb-4">أنشئ أول قاعدة لربط النظام بتطبيقاتك</p>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold">إنشاء أول قاعدة</button>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule: any) => (
              <div key={rule.id} className={`bg-white border rounded-xl p-4 ${rule.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`} data-testid={`automation-${rule.id}`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${rule.isActive ? 'bg-violet-100' : 'bg-gray-100'}`}>
                    <Zap className={`h-5 w-5 ${rule.isActive ? 'text-violet-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-gray-900">{rule.name}</h4>
                      {!rule.isActive && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">متوقف</span>}
                      {rule.lastError && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">خطأ</span>}
                    </div>
                    {/* Trigger → Actions visual flow */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] bg-cyan-100 text-cyan-700 font-mono px-1.5 py-0.5 rounded">{rule.trigger}</span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      {(rule.actions || []).map((a: any, i: number) => (
                        <span key={i} className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-bold">
                          {ACTION_ICONS[a.type] || '⚡'} {a.label || a.type}
                        </span>
                      ))}
                    </div>
                    {rule.conditions?.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-1">📋 {rule.conditions.length} شرط · شُغّل {rule.runCount || 0} مرة {rule.lastRunAt ? `· آخر تشغيل: ${new Date(rule.lastRunAt).toLocaleDateString('ar-SA')}` : ''}</p>
                    )}
                    {!rule.conditions?.length && <p className="text-[10px] text-gray-400 mt-0.5">بدون شروط · شُغّل {rule.runCount || 0} مرة</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => testMut.mutate(rule.id)} title="اختبار" className="h-8 w-8 rounded-lg hover:bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Play className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleMut.mutate({ id: rule.id, isActive: !rule.isActive })} title="تفعيل/إيقاف" className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                      {rule.isActive ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                    </button>
                    <button onClick={() => { if (confirm(`حذف "${rule.name}"؟`)) deleteMut.mutate(rule.id); }} className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {rule.lastError && <p className="text-[10px] text-red-600 bg-red-50 rounded p-1.5 mt-2">{rule.lastError}</p>}
              </div>
            ))}
          </div>
        )}

      {showCreate && (
        <AutomationBuilderModal
          events={events}
          actionTypes={actionTypes || []}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function AutomationBuilderModal({ events, actionTypes, onClose }: { events: any[]; actionTypes: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1=trigger, 2=conditions, 3=actions, 4=review
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [conditions, setConditions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [addingActionType, setAddingActionType] = useState<string | null>(null);
  const [actionConfig, setActionConfig] = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/ecosystem/automations", d)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/automations"] });
      toast({ title: "✅ تم إنشاء قاعدة الأتمتة" });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const eventsByCategory: Record<string, any[]> = {};
  for (const ev of events) (eventsByCategory[ev.category || "other"] ||= []).push(ev);

  const selectedAction = actionTypes.find((a: any) => a.type === addingActionType);

  function addAction() {
    if (!addingActionType || !selectedAction) return;
    const required = (selectedAction.fields || []).filter((f: any) => f.required);
    const missing = required.filter((f: any) => !actionConfig[f.key]);
    if (missing.length) { toast({ title: `يرجى إكمال: ${missing.map((f: any) => f.label).join(', ')}` }); return; }
    setActions(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      type: addingActionType,
      label: selectedAction.nameAr,
      config: { ...actionConfig },
    }]);
    setAddingActionType(null);
    setActionConfig({});
  }

  const CAT_NAMES: Record<string, string> = {
    orders: "الطلبات", customers: "العملاء", loyalty: "الولاء",
    inventory: "المخزون", menu: "المنيو", payments: "المدفوعات",
    operations: "العمليات", reservations: "الحجوزات", system: "النظام",
  };

  const ACTION_ICONS_BIG: Record<string, string> = {
    webhook: "🔗", telegram: "✈️", slack: "💼", whatsapp: "💬",
    email: "📧", google_sheets: "📗", sms: "📱",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Steps Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base">بناء قاعدة أتمتة جديدة</h3>
            <button onClick={onClose}><X className="h-5 w-5" /></button>
          </div>
          <div className="flex gap-0">
            {["الحدث", "الشروط", "الإجراءات", "المراجعة"].map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step > i+1 ? 'bg-primary text-white' : step === i+1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>{step > i+1 ? '✓' : i+1}</div>
                <span className={`text-[10px] font-medium ${step === i+1 ? 'text-primary' : 'text-gray-400'}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: Trigger */}
          {step === 1 && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">اسم القاعدة</label>
              <input value={name} onChange={e => setName(e.target.value)} data-testid="input-automation-name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="مثل: إشعار طلب جديد على تيليغرام" />
              <label className="block text-xs font-bold text-gray-700 mb-2">اختر الحدث المُثير</label>
              <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {Object.entries(eventsByCategory).map(([cat, evs]) => (
                  <div key={cat}>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1.5">{CAT_NAMES[cat] || cat}</p>
                    <div className="space-y-1">
                      {evs.map((ev: any) => (
                        <label key={ev.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${trigger === ev.key ? 'bg-primary/10 border border-primary/30' : 'hover:bg-gray-50'}`}>
                          <input type="radio" name="trigger" value={ev.key} checked={trigger === ev.key}
                            onChange={() => setTrigger(ev.key)} className="accent-primary" />
                          <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{ev.key}</span>
                          <span className="text-sm">{ev.nameAr}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button disabled={!name.trim() || !trigger} onClick={() => setStep(2)}
                className="w-full mt-4 py-2.5 bg-primary text-white rounded-lg font-bold text-sm disabled:opacity-40">
                التالي: الشروط ←
              </button>
            </div>
          )}

          {/* Step 2: Conditions */}
          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700">الشروط (اختياري)</label>
                  <p className="text-[10px] text-gray-500 mt-0.5">فلترة — تعمل القاعدة فقط إذا تحقق الشرط</p>
                </div>
                <button onClick={() => setConditions(prev => [...prev, { field: "", operator: "eq", value: "" }])}
                  className="flex items-center gap-1 text-xs text-primary font-bold">
                  <Plus className="h-3.5 w-3.5" />إضافة شرط
                </button>
              </div>
              {conditions.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                  <Filter className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">بدون شروط — القاعدة تعمل على كل الأحداث</p>
                  <button onClick={() => setConditions([{ field: "", operator: "eq", value: "" }])}
                    className="mt-2 text-xs text-primary font-bold">إضافة شرط</button>
                </div>
              ) : (
                <div className="space-y-2 mb-3">
                  {conditions.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input placeholder="الحقل (مثل: total)" value={c.field} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                      <select value={c.operator} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, operator: e.target.value } : x))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        {CONDITION_OPERATORS.map(op => <option key={op.key} value={op.key}>{op.label}</option>)}
                      </select>
                      <input placeholder="القيمة" value={c.value} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                      <button onClick={() => setConditions(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-lg font-bold text-sm">← السابق</button>
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm">التالي: الإجراءات ←</button>
              </div>
            </div>
          )}

          {/* Step 3: Actions */}
          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700">الإجراءات</label>
                  <p className="text-[10px] text-gray-500 mt-0.5">ما الذي يحدث عند تفعيل القاعدة؟</p>
                </div>
              </div>

              {/* Added Actions */}
              {actions.length > 0 && (
                <div className="space-y-2 mb-3">
                  {actions.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg p-2">
                      <span className="text-lg">{ACTION_ICONS_BIG[a.type] || '⚡'}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-violet-800">{a.label}</p>
                        <p className="text-[10px] text-violet-600">{Object.values(a.config || {}).slice(0, 2).join(' · ')}</p>
                      </div>
                      <button onClick={() => setActions(prev => prev.filter((_, j) => j !== i))} className="text-red-400"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Type Picker */}
              {!addingActionType ? (
                <div>
                  <p className="text-xs text-gray-600 mb-2">اختر نوع الإجراء:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {actionTypes.map((at: any) => (
                      <button key={at.type} onClick={() => { setAddingActionType(at.type); setActionConfig({}); }}
                        className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2 hover:border-violet-300 hover:bg-violet-50 transition-colors text-right">
                        <span className="text-xl">{ACTION_ICONS_BIG[at.type] || '⚡'}</span>
                        <span className="text-xs font-bold text-gray-800">{at.nameAr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : selectedAction ? (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ACTION_ICONS_BIG[addingActionType] || '⚡'}</span>
                      <h4 className="font-bold text-sm">{selectedAction.nameAr}</h4>
                    </div>
                    <button onClick={() => { setAddingActionType(null); setActionConfig({}); }}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-2">
                    {(selectedAction.fields || []).map((f: any) => (
                      <div key={f.key}>
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">{f.label}{f.required && ' *'}</label>
                        <input value={actionConfig[f.key] || ""} onChange={e => setActionConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                          type={/token|secret|password/i.test(f.key) ? "password" : "text"}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono bg-white"
                          placeholder={f.label} />
                      </div>
                    ))}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500">💡 يمكنك استخدام المتغيرات: <code className="bg-gray-100 px-1 rounded">{'{{event}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{orderId}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{total}}'}</code></p>
                    </div>
                    <button onClick={addAction} className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-bold">إضافة الإجراء</button>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-200 rounded-lg font-bold text-sm">← السابق</button>
                <button disabled={actions.length === 0} onClick={() => setStep(4)} className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm disabled:opacity-40">مراجعة ←</button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-violet-600" />
                  <span className="font-bold text-sm">{name}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500">الحدث:</span>
                  <span className="font-mono text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">{trigger}</span>
                </div>
                {conditions.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">الشروط ({conditions.length}):</p>
                    {conditions.map((c, i) => (
                      <p key={i} className="text-[10px] font-mono bg-white border border-gray-200 rounded px-2 py-1 mb-1">{c.field} {c.operator} {c.value}</p>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">الإجراءات ({actions.length}):</p>
                  {actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{ACTION_ICONS_BIG[a.type] || '⚡'}</span>
                      <span className="text-xs font-bold">{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 border border-gray-200 rounded-lg font-bold text-sm">← السابق</button>
                <button onClick={() => createMut.mutate({ name, trigger, conditions, actions })} disabled={createMut.isPending}
                  className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {createMut.isPending ? "جاري الحفظ..." : "✅ إنشاء القاعدة"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ WEBHOOKS ═══════════════ */
function WebhooksTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });

  const { data: hooksRaw, isLoading } = useQuery<any>({ queryKey: ["/api/ecosystem/webhooks"] });
  const hooks: any[] = Array.isArray(hooksRaw) ? hooksRaw : [];
  const { data: catalog } = useQuery<any>({ queryKey: ["/api/ecosystem/catalog"] });

  const createMut = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/ecosystem/webhooks", d)).json(),
    onSuccess: () => { setShowCreate(false); setForm({ name: "", url: "", events: [] }); queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/webhooks"] }); toast({ title: "تم إنشاء Webhook" }); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ecosystem/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/webhooks"] }),
  });
  const testMut = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/ecosystem/webhooks/${id}/test`),
    onSuccess: () => toast({ title: "تم إرسال الاختبار" }),
  });

  const eventsByCat: Record<string, any[]> = {};
  for (const ev of (catalog?.events || [])) (eventsByCat[ev.category || "other"] ||= []).push(ev);

  const CAT_NAMES: Record<string, string> = {
    orders: "الطلبات", customers: "العملاء", loyalty: "الولاء",
    inventory: "المخزون", menu: "المنيو", payments: "المدفوعات",
    operations: "العمليات", reservations: "الحجوزات", system: "النظام",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">{hooks.length} webhook</p>
          <p className="text-xs text-gray-400 mt-0.5">HMAC SHA-256 موقّعة · تلقائية الإرسال</p>
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="button-create-webhook"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-bold rounded-lg">
          <Plus className="h-4 w-4" />Webhook جديد
        </button>
      </div>

      {isLoading ? <div className="h-40 bg-gray-100 rounded-xl animate-pulse" /> :
        hooks.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
            <Webhook className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>لا توجد Webhooks بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hooks.map((h: any) => (
              <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`webhook-${h.id}`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${h.failureCount > 0 ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                    <Webhook className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm">{h.name}</h4>
                      {h.failureCount > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{h.failureCount} فشل</span>}
                    </div>
                    <p className="text-[11px] font-mono text-gray-500 truncate mt-0.5">{h.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.events.slice(0, 5).map((e: string) => <span key={e} className="text-[9px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">{e}</span>)}
                      {h.events.length > 5 && <span className="text-[9px] text-gray-500">+{h.events.length - 5}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => testMut.mutate(h.id)} title="اختبار" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary flex items-center justify-center"><Send className="h-4 w-4" /></button>
                    <button onClick={() => setShowDeliveries(h.id)} title="السجل" className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><Clock className="h-4 w-4 text-gray-600" /></button>
                    <button onClick={() => { if (confirm(`حذف ${h.name}؟`)) deleteMut.mutate(h.id); }} className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-base">Webhook جديد</h3><button onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button></div>
              <label className="block text-xs font-bold text-gray-700 mb-1">الاسم</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="مثل: Shopify Order Sync" />
              <label className="block text-xs font-bold text-gray-700 mb-1">URL</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 font-mono" placeholder="https://your-server.com/webhook" />
              <label className="block text-xs font-bold text-gray-700 mb-2">الأحداث</label>
              <div className="border border-gray-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-3 mb-3">
                {Object.entries(eventsByCat).map(([cat, evs]) => (
                  <div key={cat}>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1.5">{CAT_NAMES[cat] || cat}</p>
                    <div className="space-y-1">
                      {evs.map((ev: any) => (
                        <label key={ev.key} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={form.events.includes(ev.key)}
                            onChange={e => setForm({ ...form, events: e.target.checked ? [...form.events, ev.key] : form.events.filter(s => s !== ev.key) })} />
                          <span className="font-mono text-[10px] bg-gray-100 px-1 rounded">{ev.key}</span>
                          <span>{ev.nameAr}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => createMut.mutate(form)} disabled={!form.name || !form.url || !form.events.length || createMut.isPending}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-bold text-sm disabled:opacity-50">
                {createMut.isPending ? "جاري الإنشاء..." : "إنشاء Webhook"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeliveries && <DeliveriesModal webhookId={showDeliveries} onClose={() => setShowDeliveries(null)} />}
    </div>
  );
}

function DeliveriesModal({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const { data: deliveries = [] } = useQuery<any[]>({ queryKey: ["/api/ecosystem/webhooks", webhookId, "deliveries"], queryFn: async () => (await fetch(`/api/ecosystem/webhooks/${webhookId}/deliveries`)).json() });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-base">آخر 50 محاولة إرسال</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div>
          {(deliveries as any[]).length === 0 ? <p className="text-sm text-gray-500 text-center py-8">لا توجد محاولات بعد</p> :
            <div className="divide-y divide-gray-100">
              {(deliveries as any[]).map((d: any) => (
                <div key={d.id} className="py-2 flex items-center gap-2 text-xs">
                  {d.success ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{d.event}</span>
                  <span className="font-bold">{d.statusCode || '—'}</span>
                  <span className="text-gray-500">{d.durationMs}ms</span>
                  <span className="text-gray-400 mr-auto">{new Date(d.createdAt).toLocaleString('ar-SA', { hour12: false })}</span>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ INTEGRATIONS ═══════════════ */
const CAT_LABELS: Record<string, { label: string; icon: string }> = {
  erp: { label: "ERP", icon: "🏢" }, accounting: { label: "محاسبة", icon: "📊" },
  delivery: { label: "توصيل", icon: "🛵" }, messaging: { label: "رسائل وإشعارات", icon: "💬" },
  ecommerce: { label: "تجارة إلكترونية", icon: "🛍️" }, automation: { label: "أتمتة وتكامل", icon: "⚡" },
  loyalty: { label: "ولاء وCRM", icon: "⭐" }, pos: { label: "أنظمة POS", icon: "🍴" },
  payment_device: { label: "دفع وتمويل", icon: "💳" },
};

function IntegrationsTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [catFilter, setCatFilter] = useState<string>("all");
  const { data: catalog } = useQuery<any>({ queryKey: ["/api/ecosystem/catalog"] });
  const { data: itemsRaw } = useQuery<any>({ queryKey: ["/api/ecosystem/integrations"] });
  const items: any[] = Array.isArray(itemsRaw) ? itemsRaw : [];

  const createMut = useMutation({
    mutationFn: async ({ type, config }: any) => (await apiRequest("POST", "/api/ecosystem/integrations", { type, config })).json(),
    onSuccess: () => { setShowAdd(null); setConfig({}); queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/integrations"] }); toast({ title: "تم التثبيت" }); },
  });
  const testMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/ecosystem/integrations/${id}/test`)).json(),
    onSuccess: (d: any) => { queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/integrations"] }); toast({ title: d.status === 'connected' ? "✅ متصل" : `⚠️ خطأ: ${d.lastError}` }); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ecosystem/integrations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/integrations"] }),
  });

  const allIntegrations: any[] = catalog?.integrations || [];
  const installed = new Set(items.map((i: any) => i.type));

  const categories = ["all", ...Object.keys(CAT_LABELS).filter(c => allIntegrations.some(i => i.category === c))];
  const filtered = catFilter === "all" ? allIntegrations : allIntegrations.filter(i => i.category === catFilter);
  const grouped: Record<string, any[]> = {};
  for (const it of filtered) (grouped[it.category] ||= []).push(it);

  const selectedMeta = showAdd ? allIntegrations.find((i: any) => i.type === showAdd) : null;
  const statusStyle: Record<string, string> = { connected: 'bg-primary/10 text-primary', error: 'bg-red-100 text-red-700', pending: 'bg-amber-100 text-amber-700', disconnected: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-5">
      {/* Active integrations */}
      {items.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-gray-900 mb-2">المثبّتة ({items.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map((it: any) => {
              const meta = allIntegrations.find((m: any) => m.type === it.type);
              return (
                <div key={it.id} className="bg-white border border-gray-200 rounded-xl p-3" data-testid={`integration-${it.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{meta?.icon || '🔌'}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{it.name}</h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusStyle[it.status] || 'bg-gray-100'}`}>{it.status}</span>
                    </div>
                  </div>
                  {it.lastError && <p className="text-[10px] text-red-600 truncate mb-1">{it.lastError}</p>}
                  <div className="flex gap-1">
                    <button onClick={() => testMut.mutate(it.id)} className="flex-1 text-[11px] py-1 border border-gray-200 rounded font-bold hover:bg-gray-50">اختبار</button>
                    <button onClick={() => { if (confirm(`حذف ${it.name}؟`)) deleteMut.mutate(it.id); }} className="px-2 py-1 border border-red-200 text-red-500 rounded"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${catFilter === c ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-primary/40'}`}>
            {c === "all" ? "🌐 الكل" : `${CAT_LABELS[c]?.icon || ''} ${CAT_LABELS[c]?.label || c}`}
          </button>
        ))}
      </div>

      {/* Catalog */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-gray-900">الكتالوج ({filtered.length})</h3>
          <span className="text-xs text-gray-500">{installed.size} مثبّت</span>
        </div>
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-5">
            <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
              <span>{CAT_LABELS[cat]?.icon || '📦'}</span>{CAT_LABELS[cat]?.label || cat}
              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-normal">{list.length}</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {list.map((it: any) => (
                <button key={it.type} onClick={() => { if (!installed.has(it.type)) { setShowAdd(it.type); setConfig({}); } }}
                  disabled={installed.has(it.type)}
                  data-testid={`catalog-${it.type}`}
                  className={`bg-white border rounded-xl p-3 text-right transition-all ${installed.has(it.type) ? 'border-primary/30 bg-primary/5 cursor-default' : 'border-gray-200 hover:border-primary hover:shadow-sm cursor-pointer'}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{it.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate">{it.nameAr}</p>
                      <p className="text-[10px] text-gray-400 truncate">{it.nameEn}</p>
                      {it.description && <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{it.description}</p>}
                    </div>
                    {installed.has(it.type) && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAdd && selectedMeta && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowAdd(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><span className="text-2xl">{selectedMeta.icon}</span><h3 className="font-bold text-base">{selectedMeta.nameAr}</h3></div>
                <button onClick={() => setShowAdd(null)}><X className="h-5 w-5" /></button>
              </div>
              {selectedMeta.description && <p className="text-xs text-gray-500 mb-3 border-b pb-3">{selectedMeta.description}</p>}
              {selectedMeta.fields.map((f: string) => (
                <div key={f} className="mb-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1 font-mono">{f}</label>
                  <input value={config[f] || ""} onChange={e => setConfig({ ...config, [f]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                    type={/secret|password|token|key/i.test(f) ? "password" : "text"} />
                </div>
              ))}
              <button onClick={() => createMut.mutate({ type: showAdd, config })} disabled={createMut.isPending}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-bold text-sm disabled:opacity-50 mt-2">
                {createMut.isPending ? "جاري الحفظ..." : "تثبيت التكامل"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ API KEYS ═══════════════ */
const SCOPE_LABELS: Record<string, string> = {
  "menu:read": "قراءة المنيو", "menu:write": "تعديل المنيو",
  "orders:read": "قراءة الطلبات", "orders:write": "إنشاء طلبات",
  "customers:read": "قراءة العملاء", "customers:write": "تعديل العملاء",
  "loyalty:read": "قراءة الولاء", "loyalty:write": "إدارة الولاء",
  "inventory:read": "قراءة المخزون", "inventory:write": "تعديل المخزون",
  "analytics:read": "قراءة التحليلات", "employees:read": "قراءة الموظفين",
  "webhooks:manage": "إدارة Webhooks", "*": "كل الصلاحيات",
};

function ApiKeysTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", environment: "live" as "live" | "test", scopes: [] as string[] });

  const { data: keysRaw, isLoading } = useQuery<any>({ queryKey: ["/api/ecosystem/api-keys"] });
  const keys: any[] = Array.isArray(keysRaw) ? keysRaw : [];

  const createMut = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/ecosystem/api-keys", d)).json(),
    onSuccess: (d: any) => { setCreatedKey(d.plainKey); setForm({ name: "", environment: "live", scopes: [] }); queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/api-keys"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ecosystem/api-keys/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/api-keys"] }); toast({ title: "تم الحذف" }); },
  });
  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }: any) => apiRequest("PATCH", `/api/ecosystem/api-keys/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/api-keys"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{keys.length} مفتاح</p>
        <button onClick={() => { setShowCreate(true); setCreatedKey(null); }} data-testid="button-create-key"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90">
          <Plus className="h-4 w-4" />مفتاح جديد
        </button>
      </div>

      {isLoading ? <div className="h-40 bg-gray-100 rounded-xl animate-pulse" /> :
        keys.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>لا توجد مفاتيح بعد</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {keys.map((k: any) => (
              <div key={k.id} className="p-4 flex items-center gap-3" data-testid={`api-key-${k.id}`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.environment === 'live' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'}`}><Key className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-gray-900">{k.name}</h4>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${k.environment === 'live' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'}`}>{k.environment.toUpperCase()}</span>
                    {!k.isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">معطّل</span>}
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 mt-0.5">{k.keyPrefix}••••••••</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{k.scopes?.length || 0} صلاحية · {k.lastUsedAt ? `آخر استخدام: ${new Date(k.lastUsedAt).toLocaleDateString('ar-SA')}` : 'لم يُستخدم'}</p>
                </div>
                <button onClick={() => toggleMut.mutate({ id: k.id, isActive: !k.isActive })} className="text-xs text-gray-600 hover:text-primary px-2 py-1">{k.isActive ? "تعطيل" : "تفعيل"}</button>
                <button onClick={() => { if (confirm(`حذف ${k.name}؟`)) deleteMut.mutate(k.id); }} className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setShowCreate(false); setCreatedKey(null); }}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {createdKey ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
                <h3 className="font-bold text-lg mb-2">تم إنشاء المفتاح</h3>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">⚠️ احفظه الآن — لن تتمكن من رؤيته مرة أخرى</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 break-all text-left font-mono text-xs">{createdKey}</div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(createdKey); toast({ title: "تم النسخ" }); }} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1.5"><Copy className="h-4 w-4" /> نسخ</button>
                  <button onClick={() => { setShowCreate(false); setCreatedKey(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-bold">تم</button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-base">مفتاح API جديد</h3><button onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button></div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الاسم</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-key-name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="مثل: Shopify Sync" />
                <label className="block text-xs font-bold text-gray-700 mb-1">البيئة</label>
                <div className="flex gap-2 mb-3">
                  {(["live", "test"] as const).map(env => (
                    <button key={env} onClick={() => setForm({ ...form, environment: env })}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border ${form.environment === env ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-700'}`}>
                      {env === 'live' ? 'إنتاج' : 'اختبار'}
                    </button>
                  ))}
                </div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الصلاحيات</label>
                <div className="border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 mb-3">
                  {Object.entries(SCOPE_LABELS).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.scopes.includes(k)}
                        onChange={e => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, k] : form.scopes.filter(s => s !== k) })} />
                      <span className="font-mono text-[10px] bg-gray-100 px-1 rounded">{k}</span>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <button onClick={() => createMut.mutate(form)} disabled={!form.name || form.scopes.length === 0 || createMut.isPending} data-testid="button-confirm-create"
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {createMut.isPending ? "جاري الإنشاء..." : "إنشاء المفتاح"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ EVENTS MONITOR ═══════════════ */
const CAT_COLORS: Record<string, string> = {
  orders: "bg-blue-100 text-blue-700", customers: "bg-green-100 text-green-700",
  loyalty: "bg-amber-100 text-amber-700", inventory: "bg-orange-100 text-orange-700",
  menu: "bg-teal-100 text-teal-700", payments: "bg-primary/10 text-primary",
  operations: "bg-gray-100 text-gray-700", reservations: "bg-pink-100 text-pink-700",
  system: "bg-violet-100 text-violet-700",
};
const CAT_ICONS_MAP: Record<string, string> = {
  orders: "🛒", customers: "👤", loyalty: "⭐", inventory: "📦",
  menu: "🍽️", payments: "💳", operations: "⚙️", reservations: "📅", system: "🔧",
};

function EventsTab() {
  const [filter, setFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: eventsRaw, refetch, isLoading } = useQuery<any>({
    queryKey: ["/api/ecosystem/events/recent"],
    queryFn: async () => (await fetch("/api/ecosystem/events/recent?limit=100")).json(),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const allEvents: any[] = Array.isArray(eventsRaw) ? eventsRaw : [];
  const categories = ["all", ...Array.from(new Set(allEvents.map(e => e.event?.split('.')[0]).filter(Boolean)))];
  const filtered = filter === "all" ? allEvents : allEvents.filter(e => e.event?.startsWith(filter));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm text-gray-600">{allEvents.length} حدث في الذاكرة</p>
          <p className="text-xs text-gray-400 mt-0.5">آخر 100 حدث · يتحدث تلقائياً</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${autoRefresh ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white border-gray-200 text-gray-600'}`}>
            <Radio className="h-3.5 w-3.5" />{autoRefresh ? "مباشر" : "متوقف"}
          </button>
          <button onClick={() => refetch()} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-600" /></button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${filter === cat ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {cat === "all" ? "🌐 الكل" : `${CAT_ICONS_MAP[cat] || '⚡'} ${cat}`}
          </button>
        ))}
      </div>

      {isLoading ? <div className="h-40 bg-gray-100 rounded-xl animate-pulse" /> :
        filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
            <Radio className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-bold mb-1">لا توجد أحداث بعد</p>
            <p className="text-sm text-gray-400">الأحداث تظهر هنا فور حدوثها في النظام</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filtered.map((ev: any, i) => {
                const cat = ev.event?.split('.')[0] || "system";
                return (
                  <div key={ev.id || i} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${CAT_COLORS[cat] || 'bg-gray-100'}`}>
                      {CAT_ICONS_MAP[cat] || '⚡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{ev.event}</span>
                        {ev.automationsRan > 0 && <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-bold">⚡ {ev.automationsRan} أتمتة</span>}
                        {ev.webhooksRan > 0 && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">🔗 {ev.webhooksRan} webhook</span>}
                      </div>
                      {ev.data && Object.keys(ev.data).length > 0 && (
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate font-mono">
                          {Object.entries(ev.data).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                      {new Date(ev.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

/* ═══════════════ DOCS ═══════════════ */
function DocsTab() {
  const { toast } = useToast();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const examples = [
    { method: "GET", path: "/api/v1/menu", scope: "menu:read", desc: "قائمة المنتجات" },
    { method: "GET", path: "/api/v1/orders?limit=20&status=pending", scope: "orders:read", desc: "آخر الطلبات المعلقة" },
    { method: "POST", path: "/api/v1/orders", scope: "orders:write", desc: "إنشاء طلب من Shopify/TikTok", body: `{"items":[{"name":"Latte","price":18,"quantity":2}],"customerName":"Ali","source":"shopify"}` },
    { method: "GET", path: "/api/v1/customers?phone=05xxx", scope: "customers:read", desc: "بحث عن عميل بالهاتف" },
    { method: "GET", path: "/api/v1/loyalty/cards/05xxx", scope: "loyalty:read", desc: "عرض بطاقة الولاء" },
    { method: "POST", path: "/api/v1/loyalty/cards/05xxx/points", scope: "loyalty:write", desc: "إضافة/خصم نقاط", body: `{"points":50,"reason":"birthday gift"}` },
    { method: "GET", path: "/api/v1/inventory", scope: "inventory:read", desc: "كل المخزون" },
    { method: "PATCH", path: "/api/v1/inventory/raw_xxx", scope: "inventory:write", desc: "تحديث مستوى المخزون", body: `{"currentStock":150}` },
    { method: "GET", path: "/api/v1/analytics/summary", scope: "analytics:read", desc: "ملخص الأداء اليومي" },
  ];
  const methodColor: Record<string, string> = { GET: 'bg-blue-100 text-blue-700', POST: 'bg-primary/10 text-primary', PATCH: 'bg-amber-100 text-amber-700', DELETE: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-base mb-2">المصادقة</h3>
        <p className="text-sm text-gray-700 mb-3">استخدم Header التالي في كل طلب API:</p>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto font-mono"><code>Authorization: Bearer qrx_live_xxxxxxxxxxxx</code></pre>
        <p className="text-[11px] text-gray-500 mt-2">Base URL: <span className="font-mono">{baseUrl}</span></p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-base mb-3">Endpoints</h3>
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${methodColor[ex.method]}`}>{ex.method}</span>
                <code className="font-mono text-xs flex-1 truncate">{ex.path}</code>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{ex.scope}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}${ex.path}`); toast({ title: "تم النسخ" }); }}><Copy className="h-3.5 w-3.5 text-gray-500 hover:text-primary" /></button>
              </div>
              <p className="text-xs text-gray-600">{ex.desc}</p>
              {ex.body && <pre className="bg-gray-50 p-2 rounded mt-2 text-[10px] font-mono overflow-x-auto">{ex.body}</pre>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-base mb-2">التحقق من Webhooks (HMAC)</h3>
        <p className="text-sm text-gray-700 mb-3">كل webhook يتضمن header للتحقق من مصدره:</p>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto font-mono"><code>{`X-QIROX-Signature: sha256=<hmac>
X-QIROX-Event: order.created
X-QIROX-Delivery: <unique-id>

// التحقق Node.js:
const sig = "sha256=" + crypto.createHmac("sha256", SECRET)
  .update(rawBody).digest("hex");
if (sig !== req.header("X-QIROX-Signature")) reject();`}</code></pre>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-base mb-2">متغيرات قوالب الأتمتة</h3>
        <p className="text-sm text-gray-700 mb-3">استخدم هذه المتغيرات في رسائل الأتمتة:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["{{event}}", "اسم الحدث (order.created)"],
            ["{{orderId}}", "معرف الطلب"],
            ["{{total}}", "إجمالي الطلب"],
            ["{{customerName}}", "اسم العميل"],
            ["{{phoneNumber}}", "رقم الهاتف"],
            ["{{points}}", "عدد النقاط"],
            ["{{json}}", "كل البيانات كـ JSON"],
            ["{{timestamp}}", "وقت الحدث"],
          ].map(([v, d]) => (
            <div key={v} className="bg-gray-50 rounded-lg p-2">
              <code className="text-[10px] text-primary font-mono">{v}</code>
              <p className="text-[10px] text-gray-500 mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-violet-50 to-cyan-50 border border-violet-200 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-700">جرّب الـ API مباشرة من <code className="bg-white px-2 py-0.5 rounded font-mono">Postman</code> أو <code className="bg-white px-2 py-0.5 rounded font-mono">curl</code> بعد إنشاء مفتاح من تبويب "مفاتيح API"</p>
      </div>
    </div>
  );
}
