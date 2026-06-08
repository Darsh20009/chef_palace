import { useState, useMemo } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, ScatterChart, Scatter, ZAxis
} from "recharts";
import {
  ArrowLeft, Brain, TrendingUp, Target, Clock, Zap,
  AlertTriangle, ThumbsUp, ThumbsDown, Loader2,
  Activity, Coffee, Users, ShoppingCart, Calendar,
  Flame, Snowflake, Sun, Moon
} from "lucide-react";
import { useLocation } from "wouter";

const COLORS = ['#2D9B6E', '#f97316', '#3b82f6', '#a855f7', '#ec4899', '#eab308', '#14b8a6', '#ef4444'];

function formatCurrency(amount: number) {
  return `${amount.toFixed(2)} ر.س`;
}

export default function BIAnalytics() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState("month");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/advanced", period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/advanced?period=${period}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: unified } = useQuery({
    queryKey: ["/api/reports/unified", period],
    queryFn: async () => {
      const res = await fetch(`/api/reports/unified?period=${period}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const insights = useMemo(() => {
    if (!data) return [];
    const result: { type: 'positive' | 'warning' | 'info'; icon: any; text: string }[] = [];

    if (data.summary?.revenueChange > 10) {
      result.push({ type: 'positive', icon: TrendingUp, text: `نمو في الإيرادات بنسبة ${data.summary.revenueChange}%` });
    } else if (data.summary?.revenueChange < -10) {
      result.push({ type: 'warning', icon: AlertTriangle, text: `انخفاض في الإيرادات بنسبة ${Math.abs(data.summary.revenueChange)}%` });
    }

    if (data.hourlyData) {
      const peak = data.hourlyData.reduce((max: any, h: any) => h.orders > (max?.orders || 0) ? h : max, null);
      if (peak) {
        result.push({ type: 'info', icon: Clock, text: `ساعة الذروة: ${peak.hour}:00 (${peak.orders} طلب)` });
      }
      const dead = data.hourlyData.filter((h: any) => h.hour >= 6 && h.hour <= 23 && h.orders === 0);
      if (dead.length > 0) {
        result.push({ type: 'warning', icon: Snowflake, text: `${dead.length} ساعات بدون طلبات أثناء وقت العمل` });
      }
    }

    if (data.topProducts?.length > 0) {
      const topItem = data.topProducts[0];
      result.push({ type: 'positive', icon: Flame, text: `المنتج الأول: ${topItem.nameAr} (${topItem.qty} وحدة)` });
    }

    if (data.summary?.avgOrderValue < 20) {
      result.push({ type: 'warning', icon: Target, text: `متوسط الطلب منخفض (${formatCurrency(data.summary.avgOrderValue)}) — فكّر بالعروض المجمعة` });
    }

    if (data.summary?.ordersChange > 20) {
      result.push({ type: 'positive', icon: Zap, text: `ارتفاع في عدد الطلبات بنسبة ${data.summary.ordersChange}%` });
    }

    return result;
  }, [data]);

  const dayPartData = useMemo(() => {
    if (!data?.hourlyData) return [];
    const parts = [
      { name: tc('صباحاً (6-12)', 'Morning (6-12)'), hours: [6,7,8,9,10,11], icon: Sun },
      { name: tc('ظهراً (12-17)', 'Afternoon (12-17)'), hours: [12,13,14,15,16], icon: Sun },
      { name: tc('مساءً (17-22)', 'Evening (17-22)'), hours: [17,18,19,20,21], icon: Moon },
      { name: tc('ليلاً (22-6)', 'Night (22-6)'), hours: [22,23,0,1,2,3,4,5], icon: Moon },
    ];
    return parts.map(p => ({
      name: p.name,
      orders: data.hourlyData.filter((h: any) => p.hours.includes(h.hour)).reduce((s: number, h: any) => s + h.orders, 0),
      revenue: data.hourlyData.filter((h: any) => p.hours.includes(h.hour)).reduce((s: number, h: any) => s + h.revenue, 0),
    }));
  }, [data]);

  const productMix = useMemo(() => {
    if (!data?.topProducts) return [];
    const total = data.topProducts.reduce((s: number, p: any) => s + p.revenue, 0);
    return data.topProducts.slice(0, 6).map((p: any) => ({
      name: p.nameAr,
      value: p.revenue,
      qty: p.qty,
      pct: total > 0 ? Math.round((p.revenue / total) * 100) : 0,
    }));
  }, [data]);

  return (
    <PlanGate feature="biAnalytics">
    <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/manager/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-7 h-7 text-[#2D9B6E]" />
              {tc("تحليلات BI المتقدمة", "Advanced BI Analytics")}
            </h1>
            <p className="text-sm text-muted-foreground">{tc("ذكاء الأعمال والرؤى التحليلية", "Business intelligence and analytical insights")}</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{tc("اليوم", "Today")}</SelectItem>
            <SelectItem value="week">{tc("الأسبوع", "Week")}</SelectItem>
            <SelectItem value="month">{tc("الشهر", "Month")}</SelectItem>
            <SelectItem value="year">{tc("السنة", "Year")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D9B6E]" />
        </div>
      ) : (
        <Tabs defaultValue="insights">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="insights">{tc("الرؤى", "Insights")}</TabsTrigger>
            <TabsTrigger value="performance">{tc("الأداء", "Performance")}</TabsTrigger>
            <TabsTrigger value="products">{tc("المنتجات", "Products")}</TabsTrigger>
            <TabsTrigger value="patterns">{tc("الأنماط", "Patterns")}</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-[#2D9B6E]/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Activity className="w-5 h-5 text-[#2D9B6E]" />
                    {data?.summary?.revenueChange !== undefined && (
                      <Badge variant={data.summary.revenueChange >= 0 ? "default" : "destructive"} className={data.summary.revenueChange >= 0 ? "bg-[#2D9B6E]" : ""}>
                        {data.summary.revenueChange >= 0 ? '+' : ''}{data.summary.revenueChange}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(data?.summary?.totalRevenue || 0)}</p>
                  <p className="text-xs text-muted-foreground">{tc("الإيرادات", "Revenue")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                    {data?.summary?.ordersChange !== undefined && (
                      <Badge variant={data.summary.ordersChange >= 0 ? "default" : "destructive"} className={data.summary.ordersChange >= 0 ? "bg-blue-500" : ""}>
                        {data.summary.ordersChange >= 0 ? '+' : ''}{data.summary.ordersChange}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold">{data?.summary?.totalOrders || 0}</p>
                  <p className="text-xs text-muted-foreground">{tc("الطلبات", "Orders")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5 text-primary" />
                    {data?.summary?.avgOrderChange !== undefined && (
                      <Badge variant={data.summary.avgOrderChange >= 0 ? "default" : "destructive"} className={data.summary.avgOrderChange >= 0 ? "bg-primary" : ""}>
                        {data.summary.avgOrderChange >= 0 ? '+' : ''}{data.summary.avgOrderChange}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(data?.summary?.avgOrderValue || 0)}</p>
                  <p className="text-xs text-muted-foreground">{tc("متوسط الطلب", "Avg Order")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    {data?.summary?.customersChange !== undefined && (
                      <Badge variant={data.summary.customersChange >= 0 ? "default" : "destructive"} className={data.summary.customersChange >= 0 ? "bg-purple-500" : ""}>
                        {data.summary.customersChange >= 0 ? '+' : ''}{data.summary.customersChange}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold">{data?.summary?.uniqueCustomers || 0}</p>
                  <p className="text-xs text-muted-foreground">{tc("العملاء", "Customers")}</p>
                </CardContent>
              </Card>
            </div>

            {insights.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#2D9B6E]" /> {tc("رؤى ذكية", "Smart Insights")}
                  </CardTitle>
                  <CardDescription>{tc("تحليل تلقائي لأداء المتجر", "Automatic store performance analysis")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.map((insight, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                        insight.type === 'positive' ? 'bg-green-50 dark:bg-green-950/20' :
                        insight.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20' :
                        'bg-blue-50 dark:bg-blue-950/20'
                      }`}>
                        <insight.icon className={`w-5 h-5 mt-0.5 ${
                          insight.type === 'positive' ? 'text-green-600' :
                          insight.type === 'warning' ? 'text-amber-600' :
                          'text-blue-600'
                        }`} />
                        <span className="text-sm">{insight.text}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data?.revenueTrend && data.revenueTrend.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("اتجاه الإيرادات", "Revenue Trend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Area type="monotone" dataKey="current" stroke="#2D9B6E" fill="#2D9B6E" fillOpacity={0.15} strokeWidth={2} name="الإيرادات" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {data?.hourlyData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("خريطة الطلبات بالساعة", "Hourly Orders Map")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.hourlyData.filter((h: any) => h.hour >= 6 && h.hour <= 23)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" fontSize={11} tickFormatter={(h: number) => `${h}:00`} />
                        <YAxis fontSize={11} />
                        <Tooltip
                          labelFormatter={(h: number) => `${h}:00`}
                          formatter={(v: number, name: string) => [name === 'revenue' ? formatCurrency(v) : v, name === 'revenue' ? 'الإيرادات' : 'الطلبات']}
                        />
                        <Bar dataKey="orders" fill="#2D9B6E" radius={[3, 3, 0, 0]} name="orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {dayPartData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("توزيع الفترات", "Day-Part Distribution")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {dayPartData.map((part, idx) => (
                      <div key={idx} className="p-4 bg-muted/50 rounded-lg text-center">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{part.name}</p>
                        <p className="text-lg font-bold">{part.orders}</p>
                        <p className="text-xs text-muted-foreground">{tc("طلب", "orders")}</p>
                        <p className="text-sm font-bold text-[#2D9B6E] mt-1">{formatCurrency(part.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data?.employeePerformance && data.employeePerformance.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("أداء الموظفين", "Employee Performance")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.employeePerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={11} />
                        <YAxis dataKey="name" type="category" fontSize={11} width={80} />
                        <Tooltip formatter={(v: number, name: string) => [name === 'revenue' ? formatCurrency(v) : v, name === 'revenue' ? 'الإيرادات' : 'الطلبات']} />
                        <Bar dataKey="orders" fill="#3b82f6" radius={[0, 4, 4, 0]} name="orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            {productMix.length > 0 && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{tc("مزيج المنتجات (إيرادات)", "Product Mix (Revenue)")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={productMix} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                            label={({ name, pct }) => `${name} (${pct}%)`}
                          >
                            {productMix.map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{tc("ترتيب المنتجات", "Product Ranking")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data?.topProducts?.map((item: any, i: number) => {
                        const maxQty = data.topProducts[0]?.qty || 1;
                        return (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium flex items-center gap-2">
                                {i === 0 && <Flame className="w-4 h-4 text-orange-500" />}
                                <span className="text-muted-foreground w-6">{i + 1}.</span>
                                {item.nameAr}
                              </span>
                              <div className="text-left">
                                <span className="text-sm font-bold">{item.qty}x</span>
                                <span className="text-xs text-muted-foreground mr-2">{formatCurrency(item.revenue)}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: `${(item.qty / maxQty) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length]
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            {data?.paymentBreakdown && data.paymentBreakdown.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("توزيع طرق الدفع", "Payment Methods Distribution")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.paymentBreakdown.map((p: any) => ({
                          ...p,
                          name: p.method === 'cash' ? tc('نقدي','Cash') : p.method === 'card' ? tc('شبكة','Card') : p.method === 'qahwa-card' || p.method === 'qirox-card' ? tc('بطاقة ولاء','Loyalty Card') : p.method === 'apple_pay' || p.method?.includes('apple') ? 'Apple Pay' : p.method,
                        }))} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="amount"
                          label={({ name, percentage }) => `${name} ${percentage}%`}
                        >
                          {data.paymentBreakdown.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {data?.hourlyData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("العلاقة بين الطلبات والإيرادات بالساعة", "Orders vs Revenue by Hour")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="orders" name="الطلبات" fontSize={11} />
                        <YAxis dataKey="revenue" name="الإيرادات" fontSize={11} />
                        <ZAxis dataKey="hour" name="الساعة" />
                        <Tooltip formatter={(v: number, name: string) => [name === 'الإيرادات' ? formatCurrency(v) : v, name]} />
                        <Scatter data={data.hourlyData.filter((h: any) => h.orders > 0)} fill="#2D9B6E" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {unified?.branches && unified.branches.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("مقارنة الفروع — رادار", "Branch Comparison — Radar")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={[
                        { metric: tc('الإيرادات','Revenue'), ...Object.fromEntries(unified.branches.map((b: any) => [b.name, b.revenue])) },
                        { metric: tc('الطلبات','Orders'), ...Object.fromEntries(unified.branches.map((b: any) => [b.name, b.orders * 100])) },
                        { metric: tc('العملاء','Customers'), ...Object.fromEntries(unified.branches.map((b: any) => [b.name, b.customers * 100])) },
                        { metric: tc('المتوسط','Avg'), ...Object.fromEntries(unified.branches.map((b: any) => [b.name, b.avgOrder * 10])) },
                      ]}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" fontSize={11} />
                        {unified.branches.map((b: any, i: number) => (
                          <Radar key={b.branchId} name={b.name} dataKey={b.name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                        ))}
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
    </PlanGate>
  );
}
