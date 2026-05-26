import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Key, Webhook, Plug, Activity, Copy, Plus, Trash2, RefreshCw,
  ChevronLeft, CheckCircle2, AlertCircle, Clock, Send, Code2, ArrowLeft,
  Eye, EyeOff, ShieldCheck, Zap, X,
} from "lucide-react";

const TABS = [
  { key: "overview",     label: "نظرة عامة",    icon: Activity },
  { key: "api-keys",     label: "مفاتيح API",   icon: Key },
  { key: "webhooks",     label: "Webhooks",     icon: Webhook },
  { key: "integrations", label: "التكاملات",    icon: Plug },
  { key: "docs",         label: "الوثائق",      icon: Code2 },
];

export default function EcosystemHub() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-ecosystem">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/manager/dashboard")} data-testid="button-back" className="h-9 w-9 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-gray-900">منظومة التكامل</h1>
              <p className="text-xs text-gray-500">APIs · Webhooks · ERP · توصيل · واتساب · Shopify · TikTok</p>
            </div>
          </div>
          <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full font-bold">المرحلة 7</span>
        </div>
        <div className="border-t border-gray-100 overflow-x-auto">
          <div className="max-w-[1400px] mx-auto px-2 flex gap-0">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} data-testid={`tab-${t.key}`}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${active ? "border-primary text-primary" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {tab === "overview"     && <OverviewTab />}
        {tab === "api-keys"     && <ApiKeysTab />}
        {tab === "webhooks"     && <WebhooksTab />}
        {tab === "integrations" && <IntegrationsTab />}
        {tab === "docs"         && <DocsTab />}
      </div>
    </div>
  );
}

/* ═══════════════ OVERVIEW ═══════════════ */
function OverviewTab() {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/ecosystem/stats"], refetchInterval: 30_000 });
  const items = [
    { label: "مفاتيح API نشطة",   value: stats?.apiKeysActive ?? 0,        icon: Key,       color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Webhooks نشطة",     value: stats?.webhooksActive ?? 0,       icon: Webhook,   color: "text-purple-600", bg: "bg-purple-50" },
    { label: "تكاملات متصلة",     value: stats?.integrationsConnected ?? 0,icon: Plug,      color: "text-primary",    bg: "bg-primary/5" },
    { label: "API calls (24س)",   value: stats?.apiCalls24h ?? 0,          icon: Activity,  color: "text-cyan-600",   bg: "bg-cyan-50" },
    { label: "Webhook deliveries (24س)", value: stats?.deliveries24h ?? 0, icon: Send,      color: "text-amber-600",  bg: "bg-amber-50" },
    { label: "Webhooks فاشلة (24س)",      value: stats?.deliveriesFailed ?? 0, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3" data-testid={`stat-${i}`}>
              <div className={`h-10 w-10 rounded-xl ${it.bg} flex items-center justify-center`}><Icon className={`h-5 w-5 ${it.color}`} /></div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{it.label}</p>
                <p className="text-xl font-bold text-gray-900">{it.value.toLocaleString('ar-SA')}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2"><Zap className="h-5 w-5 text-cyan-600" /><h3 className="font-bold text-gray-900">واجهة مفتوحة</h3></div>
        <p className="text-sm text-gray-700 leading-relaxed">منصّة QIROX توفّر واجهات برمجية مفتوحة تتوافق مع أنظمة ERP العالمية، برامج المحاسبة، شركات التوصيل، WhatsApp Business، Shopify، TikTok Shop، وأجهزة الدفع الذكية. كل شيء مؤمّن بمفاتيح API وHMAC signatures.</p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <span className="text-[10px] font-bold bg-white border border-cyan-300 text-cyan-700 px-2 py-1 rounded">REST API</span>
          <span className="text-[10px] font-bold bg-white border border-cyan-300 text-cyan-700 px-2 py-1 rounded">Webhooks (HMAC SHA-256)</span>
          <span className="text-[10px] font-bold bg-white border border-cyan-300 text-cyan-700 px-2 py-1 rounded">OAuth-style scopes</span>
          <span className="text-[10px] font-bold bg-white border border-cyan-300 text-cyan-700 px-2 py-1 rounded">15 events</span>
        </div>
      </div>
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
    onSuccess: (d: any) => {
      setCreatedKey(d.plainKey);
      setForm({ name: "", environment: "live", scopes: [] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/api-keys"] });
    },
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
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد مفاتيح بعد</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {keys.map((k: any) => (
              <div key={k.id} className="p-4 flex items-center gap-3" data-testid={`api-key-${k.id}`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.environment === 'live' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'}`}>
                  <Key className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-gray-900">{k.name}</h4>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${k.environment === 'live' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'}`}>{k.environment.toUpperCase()}</span>
                    {!k.isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">معطّل</span>}
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 mt-0.5">{k.keyPrefix}••••••••</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{k.scopes?.length || 0} صلاحية · {k.lastUsedAt ? `آخر استخدام: ${new Date(k.lastUsedAt).toLocaleDateString('ar-SA')}` : 'لم يُستخدم'}</p>
                </div>
                <button onClick={() => toggleMut.mutate({ id: k.id, isActive: !k.isActive })} className="text-xs text-gray-600 hover:text-primary px-2 py-1">
                  {k.isActive ? "تعطيل" : "تفعيل"}
                </button>
                <button onClick={() => { if (confirm(`حذف ${k.name}؟`)) deleteMut.mutate(k.id); }} data-testid={`delete-key-${k.id}`} className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center">
                  <Trash2 className="h-4 w-4" />
                </button>
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
                  <button onClick={() => { navigator.clipboard.writeText(createdKey); toast({ title: "تم النسخ" }); }} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1.5">
                    <Copy className="h-4 w-4" /> نسخ
                  </button>
                  <button onClick={() => { setShowCreate(false); setCreatedKey(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-bold">تم</button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base">مفتاح API جديد</h3>
                  <button onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button>
                </div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الاسم</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-key-name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="مثل: Shopify Sync" />
                <label className="block text-xs font-bold text-gray-700 mb-1">البيئة</label>
                <div className="flex gap-2 mb-3">
                  {(["live", "test"] as const).map(env => (
                    <button key={env} onClick={() => setForm({ ...form, environment: env })} data-testid={`env-${env}`}
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{hooks.length} webhook</p>
        <button onClick={() => setShowCreate(true)} data-testid="button-create-webhook" className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-bold rounded-lg">
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
                      {h.events.slice(0, 4).map((e: string) => <span key={e} className="text-[9px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">{e}</span>)}
                      {h.events.length > 4 && <span className="text-[9px] text-gray-500">+{h.events.length - 4}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => testMut.mutate(h.id)} title="اختبار" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary flex items-center justify-center">
                      <Send className="h-4 w-4" />
                    </button>
                    <button onClick={() => setShowDeliveries(h.id)} title="السجل" className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-gray-600" />
                    </button>
                    <button onClick={() => { if (confirm(`حذف ${h.name}؟`)) deleteMut.mutate(h.id); }} className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Webhook جديد</h3>
                <button onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button>
              </div>
              <label className="block text-xs font-bold text-gray-700 mb-1">الاسم</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="مثل: Shopify Order Sync" />
              <label className="block text-xs font-bold text-gray-700 mb-1">URL</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 font-mono" placeholder="https://your-server.com/webhook" />
              <label className="block text-xs font-bold text-gray-700 mb-1">الأحداث</label>
              <div className="border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 mb-3">
                {(catalog?.events || []).map((ev: any) => (
                  <label key={ev.key} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={form.events.includes(ev.key)}
                      onChange={e => setForm({ ...form, events: e.target.checked ? [...form.events, ev.key] : form.events.filter(s => s !== ev.key) })} />
                    <span className="font-mono text-[10px] bg-gray-100 px-1 rounded">{ev.key}</span>
                    <span>{ev.nameAr}</span>
                  </label>
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base">آخر 50 محاولة إرسال</h3>
            <button onClick={onClose}><X className="h-5 w-5" /></button>
          </div>
          {deliveries.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">لا توجد محاولات بعد</p> :
            <div className="divide-y divide-gray-100">
              {deliveries.map((d: any) => (
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
const CAT_LABELS: Record<string, string> = {
  erp: "ERP", accounting: "محاسبة", delivery: "توصيل", messaging: "رسائل",
  ecommerce: "تجارة إلكترونية", pos: "POS", payment_device: "أجهزة دفع", loyalty: "ولاء",
};

function IntegrationsTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const { data: catalog } = useQuery<any>({ queryKey: ["/api/ecosystem/catalog"] });
  const { data: itemsRaw } = useQuery<any>({ queryKey: ["/api/ecosystem/integrations"] });
  const items: any[] = Array.isArray(itemsRaw) ? itemsRaw : [];

  const createMut = useMutation({
    mutationFn: async ({ type, config }: any) => (await apiRequest("POST", "/api/ecosystem/integrations", { type, config })).json(),
    onSuccess: () => { setShowAdd(null); setConfig({}); queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/integrations"] }); toast({ title: "تم الإضافة" }); },
  });
  const testMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/ecosystem/integrations/${id}/test`)).json(),
    onSuccess: (d: any) => { queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/integrations"] }); toast({ title: d.status === 'connected' ? "متصل ✓" : `خطأ: ${d.lastError}` }); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ecosystem/integrations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/integrations"] }),
  });

  const installed = new Set(items.map((i: any) => i.type));
  const grouped: Record<string, any[]> = {};
  for (const it of (catalog?.integrations || [])) (grouped[it.category] ||= []).push(it);

  const selectedMeta = showAdd ? (catalog?.integrations || []).find((i: any) => i.type === showAdd) : null;

  return (
    <div className="space-y-5">
      {/* Active integrations */}
      {items.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-gray-900 mb-2">المثبّتة ({items.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map((it: any) => {
              const meta = (catalog?.integrations || []).find((m: any) => m.type === it.type);
              const statusStyle: Record<string, string> = { connected: 'bg-primary/10 text-primary', error: 'bg-red-100 text-red-700', pending: 'bg-amber-100 text-amber-700', disconnected: 'bg-gray-100 text-gray-600' };
              return (
                <div key={it.id} className="bg-white border border-gray-200 rounded-xl p-3" data-testid={`integration-${it.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{meta?.icon || '🔌'}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{it.name}</h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusStyle[it.status]}`}>{it.status}</span>
                    </div>
                  </div>
                  {it.lastError && <p className="text-[10px] text-red-600 truncate mb-1">{it.lastError}</p>}
                  <div className="flex gap-1">
                    <button onClick={() => testMut.mutate(it.id)} className="flex-1 text-[11px] py-1 border border-gray-200 rounded font-bold hover:bg-gray-50">اختبار</button>
                    <button onClick={() => { if (confirm(`حذف ${it.name}؟`)) deleteMut.mutate(it.id); }} className="px-2 py-1 border border-red-200 text-red-500 rounded">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Catalog */}
      <div>
        <h3 className="font-bold text-sm text-gray-900 mb-2">المتاحة للتثبيت</h3>
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase">{CAT_LABELS[cat] || cat}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {list.map((it: any) => (
                <button key={it.type} onClick={() => { setShowAdd(it.type); setConfig({}); }} disabled={installed.has(it.type)}
                  data-testid={`catalog-${it.type}`}
                  className={`bg-white border rounded-xl p-3 text-right transition-colors ${installed.has(it.type) ? 'border-primary/30 bg-primary/5 cursor-default' : 'border-gray-200 hover:border-primary'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{it.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate">{it.nameAr}</p>
                      <p className="text-[10px] text-gray-500 truncate">{it.nameEn}</p>
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedMeta.icon}</span>
                  <h3 className="font-bold text-base">{selectedMeta.nameAr}</h3>
                </div>
                <button onClick={() => setShowAdd(null)}><X className="h-5 w-5" /></button>
              </div>
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

/* ═══════════════ DOCS ═══════════════ */
function DocsTab() {
  const { toast } = useToast();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const examples = [
    { method: "GET", path: "/api/v1/menu", scope: "menu:read", desc: "قائمة المنتجات" },
    { method: "GET", path: "/api/v1/orders?limit=20&status=pending", scope: "orders:read", desc: "آخر الطلبات" },
    { method: "POST", path: "/api/v1/orders", scope: "orders:write", desc: "إنشاء طلب من Shopify/TikTok", body: `{"items":[{"name":"Latte","price":18,"quantity":2}],"customerName":"Ali","source":"shopify"}` },
    { method: "GET", path: "/api/v1/customers?phone=05xxx", scope: "customers:read", desc: "بحث عن عميل" },
    { method: "GET", path: "/api/v1/loyalty/cards/05xxx", scope: "loyalty:read", desc: "بطاقة ولاء" },
    { method: "POST", path: "/api/v1/loyalty/cards/05xxx/points", scope: "loyalty:write", desc: "إضافة/خصم نقاط", body: `{"points":50,"reason":"birthday gift"}` },
    { method: "GET", path: "/api/v1/inventory", scope: "inventory:read", desc: "كل المخزون" },
    { method: "PATCH", path: "/api/v1/inventory/raw_xxx", scope: "inventory:write", desc: "تحديث المخزون", body: `{"currentStock":150}` },
  ];
  const methodColor: Record<string, string> = { GET: 'bg-blue-100 text-blue-700', POST: 'bg-primary/10 text-primary', PATCH: 'bg-amber-100 text-amber-700', DELETE: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-base mb-2">المصادقة</h3>
        <p className="text-sm text-gray-700 mb-3">استخدم Header التالي في كل طلب:</p>
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
                <code className="font-mono text-xs flex-1">{ex.path}</code>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{ex.scope}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}${ex.path}`); toast({ title: "تم النسخ" }); }}>
                  <Copy className="h-3.5 w-3.5 text-gray-500 hover:text-primary" />
                </button>
              </div>
              <p className="text-xs text-gray-600">{ex.desc}</p>
              {ex.body && <pre className="bg-gray-50 p-2 rounded mt-2 text-[10px] font-mono overflow-x-auto">{ex.body}</pre>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-base mb-2">التحقق من Webhooks</h3>
        <p className="text-sm text-gray-700 mb-3">كل webhook يتضمن header التوقيع التالي للتحقق من المصدر:</p>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto font-mono"><code>{`X-QIROX-Signature: sha256=<hmac>
X-QIROX-Event: order.created
X-QIROX-Delivery: <unique-id>

// Verify (Node.js):
const sig = "sha256=" + crypto.createHmac("sha256", SECRET)
  .update(rawBody).digest("hex");
if (sig !== req.header("X-QIROX-Signature")) reject();`}</code></pre>
      </div>

      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-700">يمكنك تجربة الـ API مباشرة من <code className="bg-white px-2 py-0.5 rounded font-mono">curl</code> أو Postman بعد إنشاء مفتاح من تبويب "مفاتيح API"</p>
      </div>
    </div>
  );
}
