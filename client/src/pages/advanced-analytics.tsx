import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SarIcon from "@/components/sar-icon";
import { 
  ArrowLeft,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  Target,
  Zap,
  Award,
  BarChart3,
  Activity,
  Coffee,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  UserCheck,
  CreditCard,
  RefreshCw
} from "lucide-react";

interface AnalyticsResponse {
  period: string;
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    uniqueCustomers: number;
    revenueChange: number;
    ordersChange: number;
    avgOrderChange: number;
    customersChange: number;
    changeLabel: string;
  };
  hourlyData: { hour: number; orders: number; revenue: number }[];
  topProducts: { id: string; nameAr: string; nameEn: string; qty: number; revenue: number; imageUrl?: string }[];
  employeePerformance: { id: string; name: string; orders: number; revenue: number; avgOrderValue: number }[];
  revenueTrend: { date: string; current: number; orders: number }[];
  paymentBreakdown: { method: string; amount: number; percentage: number }[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: tc("نقدي", "Cash"), card: tc("بطاقة", "Card"), pos: tc("نقطة البيع", "POS"),
  loyalty: tc("نقاط ولاء", "Loyalty"), wallet: tc("محفظة", "Wallet"), online: tc("أونلاين", "Online"), other: tc("أخرى", "Other")
};

export default function AdvancedAnalyticsPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState("today");
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/analytics/advanced", period],
    queryFn: () => fetch(`/api/analytics/advanced?period=${period}`).then(r => r.json()),
  });

  const summary = data?.summary;
  const hourlyData = data?.hourlyData || [];
  const topProducts = data?.topProducts || [];
  const employeePerformance = data?.employeePerformance || [];
  const revenueTrend = data?.revenueTrend || [];
  const paymentBreakdown = data?.paymentBreakdown || [];

  const maxHourlyOrders = hourlyData.length > 0 ? Math.max(...hourlyData.map(h => h.orders), 1) : 1;
  const peakHour = hourlyData.filter(h => h.orders > 0).reduce(
    (max, h) => h.orders > max.orders ? h : max,
    { hour: 0, orders: 0, revenue: 0 }
  );
  const maxTrendRevenue = revenueTrend.length > 0 ? Math.max(...revenueTrend.map(t => t.current), 1) : 1;
  const maxEmpOrders = employeePerformance.length > 0 ? Math.max(...employeePerformance.map(e => e.orders), 1) : 1;

  const KPICard = ({ title, value, change, changeLabel, icon: Icon, gradient }: {
    title: string; value: string; change: number; changeLabel: string; icon: any; gradient: string;
  }) => {
    const isUp = change >= 0;
    return (
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-4">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
            <Icon className="w-5 h-5 text-foreground" />
          </div>
          <p className="text-muted-foreground text-xs mb-1">{title}</p>
          <p className="text-xl font-bold text-foreground mb-1">{value}</p>
          <div className={`flex items-center gap-1 text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{isUp ? '+' : ''}{change}% {changeLabel}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PlanGate feature="advancedAnalytics">
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button variant="ghost" onClick={() => setLocation("/manager/dashboard")} className="text-muted-foreground hover:text-foreground" data-testid="btn-back">
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-8 h-8 text-cyan-400" />التحليلات المتقدمة
          </h1>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36 bg-background border-border" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{tc("اليوم", "Today")}</SelectItem>
                <SelectItem value="week">{tc("آخر 7 أيام", "Last 7 Days")}</SelectItem>
                <SelectItem value="month">{tc("هذا الشهر", "This Month")}</SelectItem>
                <SelectItem value="year">{tc("هذه السنة", "This Year")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="border-border text-muted-foreground" onClick={() => refetch()} data-testid="btn-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-60">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KPICard title={tc("إجمالي الإيرادات", "Total Revenue")} value={`${(summary?.totalRevenue || 0).toLocaleString()} ر.س`} change={summary?.revenueChange || 0} changeLabel={summary?.changeLabel || ""} icon={DollarSign} gradient="from-green-500 to-emerald-600" />
              <KPICard title={tc("إجمالي الطلبات", "Total Orders")} value={(summary?.totalOrders || 0).toLocaleString()} change={summary?.ordersChange || 0} changeLabel={summary?.changeLabel || ""} icon={ShoppingCart} gradient="from-blue-500 to-indigo-600" />
              <KPICard title={tc("متوسط قيمة الطلب", "Avg Order Value")} value={`${(summary?.avgOrderValue || 0).toFixed(1)} ر.س`} change={summary?.avgOrderChange || 0} changeLabel={summary?.changeLabel || ""} icon={Target} gradient="from-purple-500 to-violet-600" />
              <KPICard title={tc("العملاء الفريدون", "Unique Customers")} value={(summary?.uniqueCustomers || 0).toLocaleString()} change={summary?.customersChange || 0} changeLabel={summary?.changeLabel || ""} icon={Users} gradient="from-primary to-primary/80" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 text-muted-foreground data-[state=active]:text-primary">
                  <BarChart3 className="w-4 h-4 ml-2" />نظرة عامة
                </TabsTrigger>
                <TabsTrigger value="products" className="data-[state=active]:bg-primary/20 text-muted-foreground data-[state=active]:text-primary">
                  <Coffee className="w-4 h-4 ml-2" />المنتجات
                </TabsTrigger>
                <TabsTrigger value="employees" className="data-[state=active]:bg-primary/20 text-muted-foreground data-[state=active]:text-primary">
                  <UserCheck className="w-4 h-4 ml-2" />الموظفون
                </TabsTrigger>
                <TabsTrigger value="payments" className="data-[state=active]:bg-primary/20 text-muted-foreground data-[state=active]:text-primary">
                  <CreditCard className="w-4 h-4 ml-2" />طرق الدفع
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border-blue-800">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div>
                        <p className="text-blue-300 text-sm">{tc("ساعة الذروة", "Peak Hour")}</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{peakHour.hour}:00</p>
                        <p className="text-blue-400 text-sm mt-1">{peakHour.orders} طلب</p>
                      </div>
                      <Zap className="w-12 h-12 text-blue-400" />
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-900/50 to-violet-900/50 border-purple-800">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div>
                        <p className="text-purple-300 text-sm">{tc("الأكثر مبيعاً", "Best Seller")}</p>
                        <p className="text-xl font-bold text-foreground mt-1">{topProducts[0]?.nameAr || '—'}</p>
                        <p className="text-purple-400 text-sm mt-1">{topProducts[0]?.qty || 0} حبة</p>
                      </div>
                      <Star className="w-12 h-12 text-purple-400" />
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-green-800">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div>
                        <p className="text-green-300 text-sm">أفضل موظف</p>
                        <p className="text-xl font-bold text-foreground mt-1">{employeePerformance[0]?.name || '—'}</p>
                        <p className="text-green-400 text-sm mt-1">{employeePerformance[0]?.orders || 0} طلب</p>
                      </div>
                      <Award className="w-12 h-12 text-green-400" />
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />مسار الإيرادات (آخر 7 أيام)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {revenueTrend.map((day, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs w-24 text-right">{day.date}</span>
                          <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg" style={{ width: `${(day.current / maxTrendRevenue) * 100}%` }} />
                            <span className="absolute inset-0 flex items-center px-2 text-xs text-foreground font-medium">{day.orders} طلب</span>
                          </div>
                          <span className="text-foreground text-sm font-medium w-24 text-left">{day.current.toLocaleString()} <SarIcon /></span>
                        </div>
                      ))}
                      {revenueTrend.length === 0 && <p className="text-muted-foreground text-center py-4">لا توجد بيانات</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-400" />توزيع الطلبات على مدار اليوم
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">ساعات العمل الأكثر نشاطاً</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 overflow-x-auto no-scrollbar pb-2" style={{ height: '120px' }}>
                      {hourlyData.filter(h => h.hour >= 6 && h.hour <= 23).map((h) => {
                        const heightPct = (h.orders / maxHourlyOrders) * 100;
                        const isPeak = h.hour === peakHour.hour;
                        return (
                          <div key={h.hour} className="flex flex-col items-center gap-1 flex-1 min-w-[28px] h-full justify-end">
                            <span className="text-muted-foreground text-[9px]">{h.orders || ''}</span>
                            <div
                              className={`w-full rounded-t transition-all ${isPeak ? 'bg-primary' : 'bg-muted-foreground'}`}
                              style={{ height: `${Math.max(heightPct, h.orders > 0 ? 4 : 0)}%` }}
                            />
                            <span className="text-muted-foreground text-[9px]">{h.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="products" className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-400" />أفضل المنتجات مبيعاً
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">ترتيب المنتجات حسب الكميات والإيرادات</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topProducts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">لا توجد بيانات مبيعات في هذه الفترة</p>
                    ) : (
                      <div className="space-y-3">
                        {topProducts.map((product, idx) => {
                          const maxQty = Math.max(...topProducts.map(p => p.qty), 1);
                          const pct = (product.qty / maxQty) * 100;
                          const medals = ['🥇', '🥈', '🥉'];
                          return (
                            <div key={product.id} className="flex items-center gap-4 p-3 bg-card/50 rounded-xl" data-testid={`row-product-${idx}`}>
                              <span className="text-2xl w-8 text-center">{medals[idx] || (idx + 1)}</span>
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <div>
                                    <p className="text-foreground font-medium">{product.nameAr}</p>
                                    {product.nameEn && <p className="text-muted-foreground text-xs">{product.nameEn}</p>}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-amber-400 font-bold">{product.qty} حبة</p>
                                    <p className="text-muted-foreground text-xs">{product.revenue.toLocaleString()} <SarIcon /></p>
                                  </div>
                                </div>
                                <Progress value={pct} className="h-1.5" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="employees" className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-green-400" />أداء الموظفين
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">ترتيب الموظفين حسب عدد الطلبات والإيرادات</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {employeePerformance.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">لا توجد بيانات موظفين لهذه الفترة</p>
                    ) : (
                      <div className="space-y-4">
                        {employeePerformance.map((emp, idx) => {
                          const pct = (emp.orders / maxEmpOrders) * 100;
                          const podiumColors = ['from-yellow-400 to-amber-500', 'from-muted to-muted-foreground', 'from-amber-700 to-amber-800'];
                          return (
                            <div key={emp.id} className="p-4 bg-card/50 rounded-xl" data-testid={`card-employee-${idx}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${podiumColors[idx] || 'from-slate-600 to-slate-700'} flex items-center justify-center text-foreground font-bold`}>
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="text-foreground font-semibold">{emp.name}</p>
                                    <p className="text-muted-foreground text-xs">متوسط الطلب: {emp.avgOrderValue} <SarIcon /></p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-green-400 font-bold text-lg">{emp.orders} طلب</p>
                                  <p className="text-muted-foreground text-sm">{emp.revenue.toLocaleString()} <SarIcon /></p>
                                </div>
                              </div>
                              <Progress value={pct} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {employeePerformance.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="bg-card border-border">
                      <CardContent className="p-4 text-center">
                        <p className="text-muted-foreground text-sm">الكاشيرات النشطون</p>
                        <p className="text-3xl font-bold text-foreground mt-2">{employeePerformance.length}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                      <CardContent className="p-4 text-center">
                        <p className="text-muted-foreground text-sm">متوسط طلبات / موظف</p>
                        <p className="text-3xl font-bold text-cyan-400 mt-2">
                          {Math.round(employeePerformance.reduce((s,e) => s + e.orders, 0) / employeePerformance.length)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                      <CardContent className="p-4 text-center">
                        <p className="text-muted-foreground text-sm">أعلى إيرادات فردية</p>
                        <p className="text-3xl font-bold text-green-400 mt-2">
                          {Math.max(...employeePerformance.map(e => e.revenue)).toLocaleString()}
                        </p>
                        <p className="text-muted-foreground text-xs"><SarIcon /></p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-400" />توزيع طرق الدفع
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">نسبة كل طريقة دفع من الإجمالي</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {paymentBreakdown.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">لا توجد بيانات دفع</p>
                    ) : (
                      <div className="space-y-4">
                        {paymentBreakdown.map((p, idx) => {
                          const barColors = ['from-blue-500 to-indigo-500','from-green-500 to-emerald-500','from-purple-500 to-violet-500','from-amber-500 to-orange-500','from-pink-500 to-rose-500'];
                          return (
                            <div key={idx} className="flex items-center gap-3" data-testid={`row-payment-${idx}`}>
                              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${barColors[idx % barColors.length]}`} />
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-muted-foreground text-sm">{PAYMENT_LABELS[p.method] || p.method}</span>
                                  <span className="text-foreground font-medium">{p.percentage}%</span>
                                </div>
                                <Progress value={p.percentage} className="h-2" />
                              </div>
                              <span className="text-muted-foreground text-sm w-24 text-left">{p.amount.toLocaleString()} <SarIcon /></span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {paymentBreakdown.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {paymentBreakdown.slice(0,3).map((p, idx) => (
                      <Card key={idx} className="bg-card border-border">
                        <CardContent className="p-4">
                          <p className="text-muted-foreground text-sm">{PAYMENT_LABELS[p.method] || p.method}</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{p.amount.toLocaleString()} <SarIcon /></p>
                          <Badge variant="outline" className="mt-2 border-slate-600 text-muted-foreground">{p.percentage}%</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
    </PlanGate>
  );
}
