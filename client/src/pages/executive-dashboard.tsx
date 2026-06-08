import { useEffect, useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/states";
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, 
  Coffee, Package, BarChart3, Calendar, ArrowUpRight, ArrowDownRight,
  Wallet, CreditCard, Building2, ChefHat, Settings, LogOut,
  FileText, PieChart, Activity, Target, Award, Sparkles,
  GitCompare, UserCheck, Clock, Briefcase, Menu
} from "lucide-react";
import { ManagerSidebar, MobileBottomNav } from "@/components/manager-sidebar";
import { 
  AreaChart, Area, BarChart, Bar, 
  PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line
} from "recharts";
import type { Employee, Order } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

export default function ExecutiveDashboard() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [manager, setManager] = useState<Employee | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "year">("month");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role !== "manager" && emp.role !== "admin" && emp.role !== "owner") {
        setLocation("/manager/dashboard");
        return;
      }
      setManager(emp);
    } else {
      setLocation("/manager/login");
    }
  }, [setLocation]);

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!manager,
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: !!manager,
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    enabled: !!manager,
  });

  if (!manager) {
    return <LoadingState message={tc("جاري التحميل...", "Loading...")} />;
  }

  const getFilteredOrders = () => {
    const now = new Date();
    return orders.filter(order => {
      if (!order.createdAt) return dateFilter === "year";
      const orderDate = new Date(order.createdAt);
      if (isNaN(orderDate.getTime())) return false;
      
      switch (dateFilter) {
        case "today":
          return orderDate.toDateString() === now.toDateString();
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        case "year":
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return orderDate >= yearAgo;
        default:
          return true;
      }
    });
  };

  const filteredOrders = getFilteredOrders();
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const completedOrders = filteredOrders.filter(o => o.status === "completed");
  const completedRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  const todayOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    return d.toDateString() === new Date().toDateString();
  });
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const dailyData = (() => {
    const days: Record<string, { revenue: number; orders: number }> = {};
    filteredOrders.forEach(order => {
      if (!order.createdAt) return;
      const date = new Date(order.createdAt);
      if (isNaN(date.getTime())) return;
      const key = date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
      if (!days[key]) days[key] = { revenue: 0, orders: 0 };
      days[key].revenue += Number(order.totalAmount || 0);
      days[key].orders += 1;
    });
    return Object.entries(days)
      .map(([date, data]) => ({ date, ...data }))
      .slice(-14);
  })();

  const paymentData = (() => {
    const methods: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const method = o.paymentMethod === 'cash' ? tc('نقدي', 'Cash') : 
                     o.paymentMethod === 'card' ? tc('بطاقة', 'Card') : 
                     o.paymentMethod === 'mada' ? tc('مدى', 'Mada') : o.paymentMethod;
      methods[method] = (methods[method] || 0) + Number(o.totalAmount || 0);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  })();

  const topProducts = (() => {
    const items: Record<string, { count: number; revenue: number }> = {};
    filteredOrders.forEach(order => {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      orderItems.forEach((item: any) => {
        const name = item.coffeeItem?.nameAr || item.nameAr || tc('منتج', 'Product');
        if (!items[name]) items[name] = { count: 0, revenue: 0 };
        items[name].count += item.quantity || 1;
        items[name].revenue += (item.quantity || 1) * Number(item.price || 0);
      });
    });
    return Object.entries(items)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  })();

  const CHART_COLORS = ['#2D9B6E', '#2D3748', '#38A169', '#E53E3E', '#805AD5'];

  const branchAnalytics = (() => {
    const analytics: Record<string, { 
      name: string; 
      revenue: number; 
      orders: number; 
      avgOrder: number;
      growth: number;
      previousRevenue: number;
    }> = {};
    
    const getPreviousPeriodOrders = () => {
      const now = new Date();
      return orders.filter(order => {
        if (!order.createdAt) return false;
        const orderDate = new Date(order.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        
        switch (dateFilter) {
          case "today":
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            return orderDate.toDateString() === yesterday.toDateString();
          case "week":
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return orderDate >= twoWeeksAgo && orderDate < oneWeekAgo;
          case "month":
            const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return orderDate >= twoMonthsAgo && orderDate < oneMonthAgo;
          case "year":
            const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
            const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            return orderDate >= twoYearsAgo && orderDate < oneYearAgo;
          default:
            return false;
        }
      });
    };
    
    const previousOrders = getPreviousPeriodOrders();
    
    branches.forEach((branch: any) => {
      const branchOrders = filteredOrders.filter((o: any) => o.branchId === branch.id);
      const prevBranchOrders = previousOrders.filter((o: any) => o.branchId === branch.id);
      const revenue = branchOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
      const prevRevenue = prevBranchOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
      const orderCount = branchOrders.length;
      const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      
      analytics[branch.id] = {
        name: branch.name || branch.nameAr || tc('فرع', 'Branch'),
        revenue,
        orders: orderCount,
        avgOrder: orderCount > 0 ? revenue / orderCount : 0,
        growth,
        previousRevenue: prevRevenue
      };
    });
    
    return Object.values(analytics).sort((a, b) => b.revenue - a.revenue);
  })();

  const laborAnalytics = (() => {
    const roles: Record<string, { count: number; costEstimate: number }> = {};
    const roleSalaries: Record<string, number> = {
      'cashier': 4500,
      'barista': 4000,
      'manager': 8000,
      'admin': 10000,
      'owner': 0,
      'driver': 3500,
      'kitchen': 4000,
      'waiter': 3800
    };
    
    employees.forEach((emp: any) => {
      const role = emp.role || 'other';
      if (!roles[role]) roles[role] = { count: 0, costEstimate: 0 };
      roles[role].count += 1;
      roles[role].costEstimate += roleSalaries[role] || 3500;
    });
    
    const totalMonthlyLaborCost = Object.values(roles).reduce((sum, r) => sum + r.costEstimate, 0);
    
    const getMonthlyProjectedRevenue = () => {
      const daysInPeriod = dateFilter === 'today' ? 1 : 
                          dateFilter === 'week' ? 7 : 
                          dateFilter === 'month' ? 30 : 365;
      return (totalRevenue / daysInPeriod) * 30;
    };
    
    const projectedMonthlyRevenue = getMonthlyProjectedRevenue();
    const laborCostPercent = projectedMonthlyRevenue > 0 ? (totalMonthlyLaborCost / projectedMonthlyRevenue) * 100 : 0;
    
    return {
      byRole: Object.entries(roles).map(([role, data]) => ({
        role: role === 'cashier' ? tc('كاشير', 'Cashier') : 
              role === 'barista' ? tc('باريستا', 'Barista') :
              role === 'manager' ? tc('مدير', 'Manager') :
              role === 'admin' ? tc('مشرف', 'Admin') :
              role === 'driver' ? tc('سائق', 'Driver') :
              role === 'kitchen' ? tc('مطبخ', 'Kitchen') :
              role === 'waiter' ? tc('نادل', 'Waiter') : role,
        ...data
      })),
      totalCost: totalMonthlyLaborCost,
      laborPercent: laborCostPercent,
      projectedMonthlyRevenue,
      totalEmployees: employees.length,
      avgCostPerEmployee: employees.length > 0 ? totalMonthlyLaborCost / employees.length : 0,
      isMonthlyEstimate: true
    };
  })();

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    setLocation("/employee/gateway");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <ManagerSidebar
        manager={manager as any}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        role={manager?.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <header className="flex-shrink-0 bg-background border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <div className="text-foreground font-bold text-sm">{tc("مرحباً،", "Hello,")} <span className="text-[#2D9B6E]">{manager.fullName}</span></div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                manager.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                manager.role === 'owner' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                'bg-[#2D9B6E]/15 text-[#2D9B6E] border-[#2D9B6E]/30'
              }`}>
                {manager.role === 'admin' ? tc('مدير عام', 'Admin') : manager.role === 'owner' ? tc('مالك', 'Owner') : tc('مدير', 'Manager')}
              </span>
            </div>
            <div className="text-muted-foreground text-xs">{tc("لوحة المتابعة التنفيذية", "Executive Dashboard")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="h-8 w-36 text-xs bg-muted/50 border-border text-foreground/70">
              <Calendar className="w-3 h-3 ml-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{tc("اليوم", "Today")}</SelectItem>
              <SelectItem value="week">{tc("هذا الأسبوع", "This Week")}</SelectItem>
              <SelectItem value="month">{tc("هذا الشهر", "This Month")}</SelectItem>
              <SelectItem value="year">{tc("هذا العام", "This Year")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
      <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                <TrendingUp className="w-3 h-3" />
                +12.5%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{tc("إجمالي الإيرادات", "Total Revenue")}</p>
            <p className="text-2xl font-bold text-foreground">{totalRevenue.toLocaleString('ar-SA')} <span className="text-sm font-normal"><SarIcon /></span></p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <Badge className="bg-[#2D9B6E]/15 text-[#2D9B6E] border-[#2D9B6E]/30 text-[10px]">
                <Activity className="w-3 h-3" />
                مكتمل
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">الإيرادات المحصلة</p>
            <p className="text-2xl font-bold text-foreground">{completedRevenue.toLocaleString('ar-SA')} <span className="text-sm font-normal"><SarIcon /></span></p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">عدد الطلبات</p>
            <p className="text-2xl font-bold text-foreground">{filteredOrders.length.toLocaleString('ar-SA')}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">متوسط قيمة الطلب</p>
            <p className="text-2xl font-bold text-foreground">{avgOrderValue.toFixed(0)} <span className="text-sm font-normal"><SarIcon /></span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-card border border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">تحليل الإيرادات</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D9B6E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2D9B6E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    formatter={(value: number) => [`${value.toLocaleString('ar-SA')} ر.س`, 'الإيرادات']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#2D9B6E" 
                    strokeWidth={2}
                    fill="url(#revenueGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">طرق الدفع</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toLocaleString('ar-SA')} ر.س`, '']}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">أفضل المنتجات</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                      ${index === 0 ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground' : 
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-[#2D9B6E]/20 text-[#2D9B6E]' :
                        'bg-slate-100 text-slate-600'}`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.count} طلب</p>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{product.revenue.toLocaleString('ar-SA')} <SarIcon /></p>
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">نظرة سريعة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary">الفروع</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{branches.length}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">الموظفين</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{employees.length}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Coffee className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">طلبات اليوم</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{todayOrders.length}</p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">إيراد اليوم</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{todayRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Comparison Section */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <GitCompare className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg text-foreground">مقارنة أداء الفروع</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {branchAnalytics.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={branchAnalytics} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ 
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toLocaleString('ar-SA')} ر.س`, 'الإيرادات']}
                    />
                    <Bar dataKey="revenue" fill="#2D9B6E" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">الفرع</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">الإيرادات</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">الطلبات</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">متوسط الطلب</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">النمو</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchAnalytics.slice(0, 5).map((branch, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{branch.name}</td>
                          <td className="py-3 px-4">{branch.revenue.toLocaleString('ar-SA')} <SarIcon /></td>
                          <td className="py-3 px-4">{branch.orders}</td>
                          <td className="py-3 px-4">{branch.avgOrder.toFixed(0)} <SarIcon /></td>
                          <td className="py-3 px-4">
                            <Badge className={branch.growth >= 0 ? 'bg-[#2D9B6E]/15 text-[#2D9B6E] border-[#2D9B6E]/30 text-[10px]' : 'bg-red-500/15 text-red-500 border-red-500/30 text-[10px]'}>
                              {branch.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(branch.growth).toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">لا توجد بيانات فروع متاحة</p>
            )}
          </CardContent>
        </Card>

        {/* Labor Cost Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">تحليل تكلفة العمالة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary">التكلفة الشهرية (تقديرية)</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {laborAnalytics.totalCost.toLocaleString('ar-SA')} <span className="text-sm font-normal"><SarIcon /></span>
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">نسبة من الإيرادات المتوقعة</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                    {laborAnalytics.laborPercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                    (إيراد شهري متوقع: {laborAnalytics.projectedMonthlyRevenue.toLocaleString('ar-SA')} <SarIcon />)
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={laborAnalytics.byRole}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="role" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'count' ? `${value} موظف` : `${value.toLocaleString('ar-SA')} ر.س`,
                      name === 'count' ? 'العدد' : 'التكلفة'
                    ]}
                  />
                  <Bar dataKey="costEstimate" fill="#2D9B6E" radius={[4, 4, 0, 0]} name="التكلفة" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">توزيع الموظفين</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">إجمالي الموظفين</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{laborAnalytics.totalEmployees}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">متوسط التكلفة</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                    {laborAnalytics.avgCostPerEmployee.toFixed(0)} <span className="text-sm font-normal"><SarIcon /></span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {laborAnalytics.byRole.map((roleData, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{roleData.role}</div>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                        style={{ 
                          width: `${(roleData.count / laborAnalytics.totalEmployees) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-left">{roleData.count} موظف</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            onClick={() => setLocation("/manager/dashboard")}
            className="h-20 flex flex-col gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <BarChart3 className="w-6 h-6" />
            <span>لوحة التحكم</span>
          </Button>
          <Button 
            onClick={() => setLocation("/employee/pos")}
            variant="outline"
            className="h-20 flex flex-col gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <Package className="w-6 h-6 text-primary" />
            <span>نقاط البيع</span>
          </Button>
          <Button 
            onClick={() => setLocation("/manager/inventory")}
            variant="outline"
            className="h-20 flex flex-col gap-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            <ChefHat className="w-6 h-6 text-emerald-600" />
            <span>المخزون</span>
          </Button>
          <Button 
            onClick={() => setLocation("/os/accounting")}
            variant="outline"
            className="h-20 flex flex-col gap-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <FileText className="w-6 h-6 text-blue-600" />
            <span>المحاسبة</span>
          </Button>
        </div>
      </div>
      </main>
      <MobileBottomNav manager={manager as any} />
      </div>
    </div>
  );
}
