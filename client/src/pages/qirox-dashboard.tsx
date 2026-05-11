import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ALL_FEATURES, PLAN_INFO, isFeatureInPlan, type PlanName } from "@/lib/plan-features";

interface DashboardData {
  stats: {
    totalTenants: number;
    totalEmployees: number;
    totalOrders: number;
    totalCustomers: number;
    totalBranches: number;
    todayOrders: number;
    totalRevenue: number;
    todayRevenue: number;
    monthRevenue: number;
  };
  planDistribution: { lite: number; pro: number; infinity: number };
  subscriptions: any[];
  recentLogs: any[];
}

interface AnalyticsData {
  dailyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: { _id: string; count: number; revenue: number }[];
  newCustomersWeek: number;
  paymentMethods: { _id: string; count: number; total: number }[];
}

interface Tenant {
  _id: string;
  tenantId?: string;
  name?: string;
  nameAr?: string;
  subscription: any;
  branchCount: number;
  employeeCount: number;
}

interface SystemHealth {
  database: { status: string; collections: number; dataSize: number; storageSize: number };
  server: { uptime: number; memory: any; nodeVersion: string };
}

const PLAN_FEATURES = {
  lite: {
    name: "Lite",
    nameAr: "لايت",
    color: "#6b7280",
    icon: "⚡",
    price: "499 SAR/mo",
    features: ["POS System", "Kitchen Display", "Customer App", "Basic Menu", "Multi-Language"],
  },
  pro: {
    name: "Pro",
    nameAr: "برو",
    color: "#2D9B6E",
    icon: "🚀",
    price: "1,499 SAR/mo",
    features: ["Everything in Lite", "Inventory Management", "Recipe Management", "Accounting Module", "Delivery Management", "Loyalty Program", "Gift Cards", "Table Management", "Payroll", "Supplier Management", "ZATCA Compliance", "Advanced Analytics", "Custom Branding", "Up to 5 Branches"],
  },
  infinity: {
    name: "Infinity",
    nameAr: "إنفينيتي",
    color: "#8b5cf6",
    icon: "♾️",
    price: "3,999 SAR/mo",
    features: ["Everything in Pro", "Unlimited Branches", "Unlimited Employees", "Unlimited Products", "API Access", "ERP Integration", "Warehouse Management", "Dedicated Support", "White-Label Option", "Custom Integrations"],
  },
};

function getToken() {
  return localStorage.getItem("qirox_token") || "";
}

function apiHeaders() {
  return { "Content-Type": "application/json", "x-qirox-token": getToken() };
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(val);
}

function formatNumber(val: number) {
  return new Intl.NumberFormat("en").format(val);
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

type Tab = "overview" | "tenants" | "subscriptions" | "analytics" | "system" | "logs" | "settings";

export default function QiroxDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    verifyAuth();
    loadDashboard();
  }, []);

  useEffect(() => {
    if (tab === "analytics" && !analytics) loadAnalytics();
    if (tab === "tenants" && tenants.length === 0) loadTenants();
    if (tab === "system" && !health) loadHealth();
  }, [tab]);

  async function verifyAuth() {
    try {
      const res = await fetch("/api/qirox/verify", { headers: apiHeaders() });
      if (!res.ok) {
        localStorage.removeItem("qirox_token");
        setLocation("/qirox");
      }
    } catch {
      setLocation("/qirox");
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch("/api/qirox/dashboard", { headers: apiHeaders() });
      const data = await res.json();
      setDashboard(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const res = await fetch("/api/qirox/analytics", { headers: apiHeaders() });
      setAnalytics(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  async function loadTenants() {
    try {
      const res = await fetch("/api/qirox/tenants", { headers: apiHeaders() });
      setTenants(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  async function loadHealth() {
    try {
      const res = await fetch("/api/qirox/system-health", { headers: apiHeaders() });
      setHealth(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  async function assignPlan(tenantId: string, plan: string) {
    setActionLoading(true);
    try {
      await fetch("/api/qirox/subscriptions", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ tenantId, plan }),
      });
      await loadTenants();
      await loadDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/qirox/logout", { method: "POST", headers: apiHeaders() });
    } catch {}
    localStorage.removeItem("qirox_token");
    setLocation("/qirox");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#2D9B6E] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#666] text-sm">Loading system data...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "tenants", label: "Tenants", icon: "🏢" },
    { id: "subscriptions", label: "Plans", icon: "💎" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "system", label: "System", icon: "⚙️" },
    { id: "logs", label: "Logs", icon: "📋" },
    { id: "settings", label: "Settings", icon: "🔧" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir="ltr">
      <header className="bg-[#111] border-b border-[#1e1e1e] sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#2D9B6E] to-[#1a7a4e] rounded-lg flex items-center justify-center shadow-lg shadow-[#2D9B6E]/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">QIROX</h1>
              <p className="text-[#555] text-[10px] uppercase tracking-wider">System Control</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-[#2D9B6E]/15 text-[#2D9B6E] border border-[#2D9B6E]/30"
                    : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="text-[#666] hover:text-red-400 text-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Logout
          </button>
        </div>

        <div className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-[#2D9B6E]/15 text-[#2D9B6E]"
                  : "text-[#888] hover:text-white"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {tab === "overview" && dashboard && <OverviewTab data={dashboard} />}
        {tab === "tenants" && (
          <TenantsTab
            tenants={tenants}
            onAssignPlan={assignPlan}
            loading={actionLoading}
            onRefresh={loadTenants}
          />
        )}
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "analytics" && analytics && <AnalyticsTab data={analytics} />}
        {tab === "system" && health && <SystemTab data={health} />}
        {tab === "logs" && dashboard && <LogsTab logs={dashboard.recentLogs} />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, color = "#2D9B6E", icon }: { label: string; value: string; sub?: string; color?: string; icon: string }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {sub && <span className="text-xs text-[#555] bg-[#1a1a1a] px-2 py-1 rounded-md">{sub}</span>}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[#666] text-sm mt-1">{label}</p>
    </div>
  );
}

function OverviewTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">System Overview</h2>
        <p className="text-[#666] text-sm">Real-time system metrics and performance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon="🏢" label="Total Tenants" value={formatNumber(data.stats.totalTenants)} color="#2D9B6E" />
        <StatCard icon="👥" label="Employees" value={formatNumber(data.stats.totalEmployees)} color="#3b82f6" />
        <StatCard icon="👤" label="Customers" value={formatNumber(data.stats.totalCustomers)} color="#8b5cf6" />
        <StatCard icon="🏪" label="Branches" value={formatNumber(data.stats.totalBranches)} color="#f59e0b" />
        <StatCard icon="📦" label="Total Orders" value={formatNumber(data.stats.totalOrders)} color="#ef4444" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon="💰" label="Today's Revenue" value={formatCurrency(data.stats.todayRevenue)} sub={`${data.stats.todayOrders} orders`} color="#2D9B6E" />
        <StatCard icon="📅" label="Month Revenue" value={formatCurrency(data.stats.monthRevenue)} color="#3b82f6" />
        <StatCard icon="💵" label="Total Revenue" value={formatCurrency(data.stats.totalRevenue)} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Plan Distribution</h3>
          <div className="space-y-4">
            {(["lite", "pro", "infinity"] as const).map((plan) => {
              const total = data.planDistribution.lite + data.planDistribution.pro + data.planDistribution.infinity;
              const count = data.planDistribution[plan];
              const pct = total > 0 ? (count / total) * 100 : 0;
              const info = PLAN_FEATURES[plan];
              return (
                <div key={plan} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>{info.icon}</span>
                      <span className="font-medium">{info.name}</span>
                    </span>
                    <span className="text-[#888] text-sm">{count} tenants</span>
                  </div>
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: info.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentLogs.slice(0, 10).map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  log.action.includes('fail') ? 'bg-red-500' :
                  log.action.includes('login') ? 'bg-blue-500' :
                  'bg-[#2D9B6E]'
                }`} />
                <div className="min-w-0">
                  <p className="text-[#ccc] truncate">{log.details}</p>
                  <p className="text-[#555] text-xs mt-0.5">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantsTab({ tenants, onAssignPlan, loading, onRefresh }: {
  tenants: Tenant[];
  onAssignPlan: (tenantId: string, plan: string) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Tenant Management</h2>
          <p className="text-[#666] text-sm">Manage all registered cafes and their subscriptions</p>
        </div>
        <button onClick={onRefresh} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm hover:bg-[#222] transition-colors">
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {tenants.map((tenant) => {
          const tid = tenant.tenantId || tenant._id?.toString() || "";
          const currentPlan = tenant.subscription?.plan || "none";
          return (
            <div key={tid} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 hover:border-[#2a2a2a] transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{tenant.nameAr || tenant.name || tid}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      currentPlan === "infinity" ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" :
                      currentPlan === "pro" ? "bg-[#2D9B6E]/15 text-[#2D9B6E] border border-[#2D9B6E]/30" :
                      currentPlan === "lite" ? "bg-gray-500/15 text-gray-400 border border-gray-500/30" :
                      "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}>
                      {currentPlan === "none" ? "No Plan" : currentPlan.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[#666] text-sm">
                    ID: {tid} • {tenant.branchCount} branches • {tenant.employeeCount} employees
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(["lite", "pro", "infinity"] as const).map((plan) => (
                    <button
                      key={plan}
                      disabled={loading || currentPlan === plan}
                      onClick={() => onAssignPlan(tid, plan)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        currentPlan === plan
                          ? "bg-[#2D9B6E]/15 text-[#2D9B6E] border border-[#2D9B6E]/30 cursor-default"
                          : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]"
                      }`}
                    >
                      {PLAN_FEATURES[plan].icon} {PLAN_FEATURES[plan].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {tenants.length === 0 && (
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-12 text-center">
            <p className="text-[#666]">No tenants found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionsTab() {
  const categories = [...new Set(ALL_FEATURES.map(f => f.category))];
  const LIMITS: Record<PlanName, Record<string, string>> = {
    lite:     { branches: "١ فرع", employees: "٥ موظفين", products: "٥٠ منتج" },
    pro:      { branches: "٥ فروع", employees: "٣٠ موظف", products: "٥٠٠ منتج" },
    infinity: { branches: "غير محدود", employees: "غير محدود", products: "غير محدود" },
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Subscription Plans</h2>
        <p className="text-[#666] text-sm">مميزات كل باقة وجدول المقارنة الشامل</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["lite", "pro", "infinity"] as const).map((plan) => {
          const info = PLAN_INFO[plan];
          const planFeatures = ALL_FEATURES.filter(f => isFeatureInPlan(f.plan, plan));
          const isPopular = plan === "pro";
          return (
            <div
              key={plan}
              className={`bg-[#111] border rounded-2xl p-6 relative ${
                isPopular
                  ? "border-[#2D9B6E]/50 shadow-lg shadow-[#2D9B6E]/10"
                  : plan === "infinity"
                  ? "border-purple-500/30"
                  : "border-[#1e1e1e]"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2D9B6E] text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <div className="text-center mb-4 pt-2">
                <span className="text-4xl mb-3 block">{info.icon}</span>
                <h3 className="text-2xl font-bold">{info.nameEn}</h3>
                <p className="text-[#888] text-sm font-arabic">{info.nameAr}</p>
                <p className="text-3xl font-bold mt-3" style={{ color: info.color }}>
                  {info.priceEn}
                </p>
                <p className="text-[#666] text-xs mt-1">{info.priceAr}</p>
              </div>

              <div className="bg-[#0d0d0d] rounded-xl p-3 mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div><div className="text-[#666]">Branches</div><div className="font-bold" style={{ color: info.color }}>{LIMITS[plan].branches}</div></div>
                <div><div className="text-[#666]">Employees</div><div className="font-bold" style={{ color: info.color }}>{LIMITS[plan].employees}</div></div>
                <div><div className="text-[#666]">Products</div><div className="font-bold" style={{ color: info.color }}>{LIMITS[plan].products}</div></div>
              </div>

              <div className="space-y-2 border-t border-[#1e1e1e] pt-4 max-h-64 overflow-y-auto pr-1">
                {planFeatures.map((f) => (
                  <div key={f.key} className="flex items-start gap-2 text-xs">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: info.color }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[#bbb]">{f.icon} {f.nameAr}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1e1e1e] flex items-center justify-between">
          <h3 className="text-lg font-semibold">🗂️ مقارنة المميزات الكاملة</h3>
          <span className="text-[#666] text-xs">{ALL_FEATURES.length} ميزة</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                <th className="text-right px-4 py-3 text-[#888] font-medium">الميزة</th>
                <th className="text-center px-4 py-3 text-[#888] font-medium">⚡ لايت</th>
                <th className="text-center px-4 py-3 font-bold" style={{ color: "#2D9B6E" }}>🚀 برو</th>
                <th className="text-center px-4 py-3 font-bold text-purple-400">♾️ إنفينيتي</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catFeatures = ALL_FEATURES.filter(f => f.category === cat);
                const catInfo = catFeatures[0];
                return (
                  <>
                    <tr key={`cat-${cat}`} className="bg-[#0a0a0a] border-b border-[#1e1e1e]">
                      <td colSpan={4} className="px-4 py-2">
                        <span className="text-[#666] text-xs font-bold uppercase tracking-wider">{catInfo?.categoryAr || cat}</span>
                      </td>
                    </tr>
                    {catFeatures.map(f => (
                      <tr key={f.key} className="border-b border-[#1e1e1e]/40 hover:bg-[#161616]">
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div>
                              <div className="text-[#ddd] text-xs">{f.nameAr}</div>
                              <div className="text-[#555] text-xs">{f.nameEn}</div>
                            </div>
                            <span className="text-base">{f.icon}</span>
                          </div>
                        </td>
                        {(["lite", "pro", "infinity"] as PlanName[]).map(plan => {
                          const has = isFeatureInPlan(f.plan, plan);
                          const planColor = PLAN_INFO[plan].color;
                          return (
                            <td key={plan} className="text-center px-4 py-3">
                              {has ? (
                                <svg className="w-4 h-4 mx-auto" style={{ color: planColor }} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 mx-auto text-[#333]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
              <tr className="bg-[#0a0a0a] border-b border-[#1e1e1e]">
                <td colSpan={4} className="px-4 py-2">
                  <span className="text-[#666] text-xs font-bold uppercase tracking-wider">الحدود</span>
                </td>
              </tr>
              {([
                ["فروع", "1", "5", "∞"],
                ["موظفون", "5", "30", "∞"],
                ["منتجات", "50", "500", "∞"],
                ["الدعم", "أساسي", "أولوية", "مخصص 24/7"],
              ] as [string, string, string, string][]).map(([label, l, p, i]) => (
                <tr key={label} className="border-b border-[#1e1e1e]/40 hover:bg-[#161616]">
                  <td className="px-4 py-3 text-right text-[#888] text-xs">{label}</td>
                  {[l, p, i].map((val, idx) => (
                    <td key={idx} className="text-center px-4 py-3">
                      <span className="font-bold text-xs" style={{ color: PLAN_INFO[(['lite','pro','infinity'] as PlanName[])[idx]].color }}>{val}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab({ data }: { data: AnalyticsData }) {
  const maxRevenue = Math.max(...data.dailyRevenue.map((d) => d.revenue), 1);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Analytics</h2>
        <p className="text-[#666] text-sm">30-day performance overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Revenue (30 days)</h3>
          <div className="flex items-end gap-1 h-48">
            {data.dailyRevenue.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#222] px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {formatCurrency(d.revenue)}
                  <br />
                  {d._id}
                </div>
                <div
                  className="w-full bg-[#2D9B6E] rounded-t hover:bg-[#34b07e] transition-colors cursor-pointer"
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Top Products</h3>
          <div className="space-y-3">
            {data.topProducts.slice(0, 8).map((p, i) => {
              const maxCount = data.topProducts[0]?.count || 1;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#ccc] truncate max-w-[60%]">{p._id || "Unknown"}</span>
                    <span className="text-[#888]">{p.count} sold • {formatCurrency(p.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2D9B6E] rounded-full"
                      style={{ width: `${(p.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {data.paymentMethods.map((pm, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                <span className="text-[#ccc] capitalize">{pm._id || "Unknown"}</span>
                <div className="text-right">
                  <p className="text-white font-medium">{formatCurrency(pm.total)}</p>
                  <p className="text-[#666] text-xs">{pm.count} transactions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <StatCard
          icon="👤"
          label="New Customers This Week"
          value={formatNumber(data.newCustomersWeek)}
          color="#8b5cf6"
        />
      </div>
    </div>
  );
}

function SystemTab({ data }: { data: SystemHealth }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">System Health</h2>
        <p className="text-[#666] text-sm">Server and database diagnostics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${data.database.status === 'connected' ? 'bg-[#2D9B6E]' : 'bg-red-500'}`} />
            Database
          </h3>
          <div className="space-y-3">
            <InfoRow label="Status" value={data.database.status} highlight />
            <InfoRow label="Collections" value={String(data.database.collections)} />
            <InfoRow label="Data Size" value={formatBytes(data.database.dataSize)} />
            <InfoRow label="Storage Size" value={formatBytes(data.database.storageSize)} />
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#2D9B6E]" />
            Server
          </h3>
          <div className="space-y-3">
            <InfoRow label="Uptime" value={formatUptime(data.server.uptime)} />
            <InfoRow label="Node.js" value={data.server.nodeVersion} />
            <InfoRow label="Heap Used" value={formatBytes(data.server.memory.heapUsed)} />
            <InfoRow label="Heap Total" value={formatBytes(data.server.memory.heapTotal)} />
            <InfoRow label="RSS" value={formatBytes(data.server.memory.rss)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e1e1e]/50 last:border-0">
      <span className="text-[#888] text-sm">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-[#2D9B6E]' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function LogsTab({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">System Logs</h2>
        <p className="text-[#666] text-sm">Recent system activity and events</p>
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="divide-y divide-[#1e1e1e]/50">
          {logs.map((log: any, i: number) => (
            <div key={i} className="px-6 py-4 hover:bg-[#1a1a1a] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    log.action.includes('fail') || log.action.includes('error') ? 'bg-red-500' :
                    log.action.includes('login') ? 'bg-blue-500' :
                    log.action.includes('delete') ? 'bg-orange-500' :
                    'bg-[#2D9B6E]'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{log.action.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-[#888] text-sm truncate">{log.details}</p>
                  </div>
                </div>
                <span className="text-[#555] text-xs whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="p-12 text-center text-[#666]">No logs yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/qirox/change-password", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("qirox_token", data.token);
        setMsg("Password changed successfully");
        setCurrentPw("");
        setNewPw("");
      } else {
        setMsg(data.error || "Failed");
      }
    } catch {
      setMsg("Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-[#666] text-sm">Super admin configuration</p>
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">Current Password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#2D9B6E]"
            />
          </div>
          <div>
            <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">New Password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#2D9B6E]"
            />
          </div>
          {msg && <p className={`text-sm ${msg.includes("success") ? "text-[#2D9B6E]" : "text-red-400"}`}>{msg}</p>}
          <button
            type="submit"
            disabled={loading || !currentPw || !newPw}
            className="w-full bg-[#2D9B6E] hover:bg-[#34b07e] disabled:opacity-40 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-2">System Info</h3>
        <div className="space-y-2 text-sm">
          <InfoRow label="Version" value="QIROX v3.0" />
          <InfoRow label="Environment" value={process.env.NODE_ENV || "production"} />
          <InfoRow label="Build" value="Production" />
        </div>
      </div>
    </div>
  );
}
