import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Users, TrendingUp, DollarSign, Calendar, Activity, Settings, Clock,
  ShoppingBag, CheckCircle2, Sparkles, ArrowUpRight, ArrowDownRight,
  BarChart3, Package, Zap, Target, Brain, ChefHat, ArrowRight, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { ManagerSidebar, MobileBottomNav } from "@/components/manager-sidebar";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ["#2D9B6E", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const tc = useTranslate();
  const [manager, setManager] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    document.title = tc("لوحة تحكم الإدارة", "Admin Dashboard") + " - مكان الشيف البخاري";
    const stored = localStorage.getItem("currentEmployee");
    if (stored) {
      try { setManager(JSON.parse(stored)); } catch {}
    }
  }, []);

  const { data: employees = [] } = useQuery<any[]>({ queryKey: ['/api/employees'] });
  const { data: orders = [] } = useQuery<any[]>({ queryKey: ['/api/orders'] });
  const { data: attendance = [] } = useQuery<any[]>({ queryKey: ['/api/attendance'], retry: false });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ['/api/leave-requests'], retry: false });
  const { data: businessConfig } = useQuery<any>({ queryKey: ['/api/business-config'] });

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    navigate("/manager/login");
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o: any) => {
    const d = o.createdAt ? new Date(o.createdAt) : null;
    return d && d >= today;
  });

  const yesterdayStart = new Date(today);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayOrders = orders.filter((o: any) => {
    const d = o.createdAt ? new Date(o.createdAt) : null;
    return d && d >= yesterdayStart && d < today;
  });

  const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
  const todayRevenue = todayOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
  const activeEmployees = employees.filter((e: any) => e.isActivated === 1).length;

  const revenueGrowth = yesterdayRevenue > 0
    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
    : null;

  const presentToday = Array.isArray(attendance)
    ? attendance.filter((a: any) => {
        const d = a.checkIn ? new Date(a.checkIn) : null;
        return d && d >= today;
      }).length
    : 0;

  const onLeave = Array.isArray(leaveRequests)
    ? leaveRequests.filter((lr: any) => {
        if (lr.status !== 'approved') return false;
        const start = lr.startDate ? new Date(lr.startDate) : null;
        const end = lr.endDate ? new Date(lr.endDate) : null;
        const now = new Date();
        return start && end && start <= now && end >= now;
      }).length
    : 0;

  const last7DaysData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);
    const dayOrders = orders.filter((o: any) => {
      const od = o.createdAt ? new Date(o.createdAt) : null;
      return od && od >= d && od < nextD;
    });
    return {
      day: d.toLocaleDateString('ar-SA', { weekday: 'short' }),
      revenue: Math.round(dayOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0)),
      orders: dayOrders.length,
    };
  });

  const ordersByStatus = [
    { name: tc("مكتمل", "Completed"), value: orders.filter((o: any) => o.status === 'completed').length },
    { name: tc("تحضير", "Preparing"), value: orders.filter((o: any) => o.status === 'preparing').length },
    { name: tc("معلق", "Pending"), value: orders.filter((o: any) => o.status === 'pending').length },
    { name: tc("ملغى", "Cancelled"), value: orders.filter((o: any) => o.status === 'cancelled').length },
  ].filter(s => s.value > 0);

  const topEmployees = employees
    .filter((e: any) => e.isActivated === 1)
    .map((emp: any) => {
      const empOrders = orders.filter((o: any) => o.employeeId === emp.id);
      return {
        name: (emp.fullName || '?').split(' ')[0],
        orders: empOrders.length,
        revenue: Math.round(empOrders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await apiRequest("GET", "/api/ai/insights");
      const data = await res.json();
      if (Array.isArray(data.insights)) {
        setAiInsights(data.insights.map((i: any) => i.text || i.content || String(i)));
      }
    } catch {
      setAiInsights([]);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  const KpiCard = ({ label, value, sub, icon: Icon, trend, cardBg, onClick }: any) => (
    <div
      className={`${cardBg || 'bg-emerald-600'} rounded-2xl p-4 lg:p-5 hover:shadow-lg hover:brightness-105 transition-all cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== null && trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 text-white`}>
            {Number(trend) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{Math.abs(Number(trend))}%</span>
          </div>
        )}
      </div>
      <p className="text-xs text-white/70 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={tc('rtl','ltr')} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <ManagerSidebar
        manager={manager}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        role={manager?.role}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-background">
        {/* Header */}
        <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(true)}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-foreground font-bold text-sm">{tc("مرحباً،", "Hello,")} <span className="text-[#2D9B6E]">{manager?.fullName || tc("المدير", "Manager")}</span></div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  manager?.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                  manager?.role === 'owner' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  'bg-[#2D9B6E]/15 text-[#2D9B6E] border-[#2D9B6E]/30'
                }`}>
                  {manager?.role === 'admin' ? tc('مدير عام', 'Admin') : manager?.role === 'owner' ? tc('مالك', 'Owner') : tc('مدير', 'Manager')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{tc("نظرة شاملة على أداء المطعم", "Complete restaurant overview")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium text-primary border-primary/20">
              {businessConfig?.businessName || "مكان الشيف البخاري"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/settings')}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 space-y-5 pb-20 lg:pb-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label={tc("إيرادات اليوم", "Today's Revenue")}
              value={<span className="flex items-center gap-1">{todayRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} <SarIcon /></span>}
              sub={`${todayOrders.length} ${tc("طلب", "orders")}`}
              icon={DollarSign}
              trend={revenueGrowth}
              cardBg="bg-emerald-600"
              onClick={() => navigate('/admin/reports')}
            />
            <KpiCard
              label={tc("إجمالي الموظفين", "Total Employees")}
              value={employees.length.toLocaleString('en-US')}
              sub={`${activeEmployees} ${tc("نشط", "active")}`}
              icon={Users}
              cardBg="bg-blue-600"
              onClick={() => navigate('/admin/employees')}
            />
            <KpiCard
              label={tc("الحضور اليوم", "Present Today")}
              value={presentToday.toLocaleString('en-US')}
              sub={`${tc("من", "of")} ${activeEmployees} ${tc("نشط", "active")}`}
              icon={CheckCircle2}
              cardBg="bg-amber-500"
              onClick={() => navigate('/manager/attendance')}
            />
            <KpiCard
              label={tc("متوسط الطلب", "Avg Order Value")}
              value={<span className="flex items-center gap-1">{avgOrderValue.toLocaleString('en-US', { maximumFractionDigits: 1 })} <SarIcon /></span>}
              sub={`${orders.length} ${tc("طلب إجمالاً", "total orders")}`}
              icon={Target}
              cardBg="bg-violet-600"
              onClick={() => navigate('/admin/reports')}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border border-border bg-card">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {tc("الإيرادات - آخر 7 أيام", "Revenue - Last 7 Days")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={last7DaysData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D9B6E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2D9B6E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
                      formatter={(v: any) => [`${v} ر.س`, tc("إيراد", "Revenue")]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2D9B6E" strokeWidth={2.5} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  {tc("حالة الطلبات", "Order Status")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-4">
                {ordersByStatus.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                          {ordersByStatus.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-1.5 w-full mt-1">
                      {ordersByStatus.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground truncate">{s.name}</span>
                          <span className="font-bold text-foreground ml-auto">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-36 text-muted-foreground">
                    <ShoppingBag className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs">{tc("لا توجد طلبات بعد", "No orders yet")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Employee Performance */}
            <Card className="lg:col-span-2 border border-border bg-card">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm text-foreground flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-pink-500" />
                  {tc("أداء الموظفين (الإيراد)", "Employee Performance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {topEmployees.length > 0 ? (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={topEmployees}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 11 }}
                        formatter={(v: any) => [`${v} ر.س`, tc("إيراد", "Revenue")]}
                      />
                      <Bar dataKey="revenue" fill="#2D9B6E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Users className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs">{tc("لا يوجد بيانات موظفين بعد", "No employee data yet")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-card">
              <CardHeader className="pb-2 px-5 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {tc("رؤى الذكاء الاصطناعي", "AI Insights")}
                  </CardTitle>
                  <button onClick={fetchInsights} disabled={loadingInsights} className="text-muted-foreground hover:text-primary transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2.5">
                {loadingInsights ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
                    <Brain className="w-4 h-4 animate-pulse text-primary" />
                    <span>{tc("جارٍ تحليل البيانات...", "Analyzing data...")}</span>
                  </div>
                ) : aiInsights.length > 0 ? (
                  aiInsights.slice(0, 3).map((insight, i) => (
                    <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                      <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed">{insight}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5 text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{tc("لا توجد رؤى متاحة", "No insights available")}</p>
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full text-primary border-primary/30 hover:bg-primary/10 text-xs mt-1" onClick={() => navigate('/manager/ai')}>
                  <Brain className="w-3.5 h-3.5 ml-1" />
                  {tc("فتح مركز الذكاء الاصطناعي", "Open AI Center")}
                  <ArrowRight className="w-3.5 h-3.5 mr-1" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links + Employee List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-border bg-card">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm text-foreground">{tc("روابط سريعة", "Quick Links")}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: tc("الموظفون", "Employees"), icon: Users, path: "/admin/employees", color: "#3b82f6" },
                    { label: tc("التقارير", "Reports"), icon: BarChart3, path: "/admin/reports", color: "#2D9B6E" },
                    { label: tc("الحضور", "Attendance"), icon: Clock, path: "/manager/attendance", color: "#f59e0b" },
                    { label: tc("الإعدادات", "Settings"), icon: Settings, path: "/admin/settings", color: "#8b5cf6" },
                    { label: tc("المخزون", "Inventory"), icon: Package, path: "/manager/inventory", color: "#ec4899" },
                    { label: tc("الذكاء الاصطناعي", "AI Center"), icon: Sparkles, path: "/manager/ai", color: "#2D9B6E" },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-primary/20 transition-all text-center"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${item.color}18` }}>
                        <item.icon className="w-4 h-4" style={{ color: item.color }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium leading-tight">{item.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card">
              <CardHeader className="pb-2 px-5 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    {tc("الموظفون", "Employees")}
                  </CardTitle>
                  <button onClick={() => navigate('/admin/employees')} className="text-xs text-primary hover:underline">
                    {tc("عرض الكل", "View All")}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {employees.length > 0 ? employees.slice(0, 4).map((emp: any) => (
                  <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-primary font-bold">{(emp.fullName || '?')[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{emp.fullName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{emp.jobTitle || emp.role}</p>
                    </div>
                    <Badge variant={emp.isActivated === 1 ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${emp.isActivated === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}`}>
                      {emp.isActivated === 1 ? tc("نشط", "Active") : tc("معطل", "Inactive")}
                    </Badge>
                  </div>
                )) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{tc("لا يوجد موظفون بعد", "No employees yet")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <MobileBottomNav manager={manager} />
      </div>
    </div>
  );
}
