import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ArrowLeft, TrendingUp, ShoppingCart, Users, DollarSign, Download, Building2, BarChart3, FileSpreadsheet, FileText, Loader2, CreditCard, Banknote, Wallet } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
import SarIcon from "@/components/sar-icon";

const COLORS = ['#2D9B6E', '#f97316', '#3b82f6', '#a855f7', '#ec4899', '#eab308', '#14b8a6'];

function formatCurrency(amount: number) {
  return `${amount.toFixed(2)} ر.س`;
}

function FC({ amount, size = 12 }: { amount: number; size?: number }) {
  return <>{(amount || 0).toFixed(2)} <SarIcon size={size} /></>;
}

export default function UnifiedReports() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [period, setPeriod] = useState("today");
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/reports/unified", period],
    queryFn: async () => {
      const res = await fetch(`/api/reports/unified?period=${period}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const exportAccounting = async (format: string) => {
    try {
      const url = `/api/accounting/export?period=${period}&format=${format}`;
      if (format === 'csv') {
        const link = document.createElement('a');
        link.href = url;
        link.download = `qirox-accounting-${period}.csv`;
        link.click();
        toast({ title: tc("جاري تحميل ملف CSV", "Downloading CSV file"), className: "bg-green-600 text-white" });
      } else {
        const res = await fetch(`${url}`);
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `qirox-accounting-${period}.json`;
        link.click();
        toast({ title: tc("جاري تحميل ملف JSON", "Downloading JSON file"), className: "bg-green-600 text-white" });
      }
    } catch {
      toast({ title: tc("فشل التصدير", "Export failed"), variant: "destructive" });
    }
  };

  const summary = data?.summary;
  const branches = data?.branches || [];

  return (
    <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/manager/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-[#2D9B6E]" />
              {tc("التقارير الموحدة", "Unified Reports")}
            </h1>
            <p className="text-sm text-muted-foreground">{tc("تقارير شاملة لجميع الفروع", "Comprehensive reports for all branches")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D9B6E]" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="overview">{tc("نظرة عامة", "Overview")}</TabsTrigger>
            <TabsTrigger value="branches">{tc("الفروع", "Branches")}</TabsTrigger>
            <TabsTrigger value="trends">{tc("الاتجاهات", "Trends")}</TabsTrigger>
            <TabsTrigger value="export">{tc("التصدير", "Export")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-[#2D9B6E]" />
                  <p className="text-2xl font-bold"><FC amount={summary?.totalRevenue || 0} size={18} /></p>
                  <p className="text-xs text-muted-foreground">{tc("إجمالي الإيرادات", "Total Revenue")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{summary?.totalOrders || 0}</p>
                  <p className="text-xs text-muted-foreground">{tc("إجمالي الطلبات", "Total Orders")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                  <p className="text-2xl font-bold"><FC amount={summary?.avgOrderValue || 0} size={18} /></p>
                  <p className="text-xs text-muted-foreground">{tc("متوسط الطلب", "Avg. Order")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold">{summary?.uniqueCustomers || 0}</p>
                  <p className="text-xs text-muted-foreground">{tc("عملاء فريدين", "Unique Customers")}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> {tc("توزيع طرق الدفع", "Payment Methods")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" /> {tc("نقدي", "Cash")}</span>
                      <span className="font-bold"><FC amount={summary?.cashSales || 0} /></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> {tc("شبكة", "Card")}</span>
                      <span className="font-bold"><FC amount={summary?.cardSales || 0} /></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-purple-600" /> {tc("بطاقة مكان الشيف", "مكان الشيف Card")}</span>
                      <span className="font-bold"><FC amount={summary?.loyaltySales || 0} /></span>
                    </div>
                  </div>
                  {summary && summary.totalRevenue > 0 && (
                    <div className="mt-4 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: tc('نقدي', 'Cash'), value: summary.cashSales },
                              { name: tc('شبكة', 'Card'), value: summary.cardSales },
                              { name: tc('بطاقة مكان الشيف', 'مكان الشيف Card'), value: summary.loyaltySales },
                            ].filter(d => d.value > 0)}
                            cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            <Cell fill="#2D9B6E" />
                            <Cell fill="#3b82f6" />
                            <Cell fill="#a855f7" />
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> {tc("أداء الفروع", "Branch Performance")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {branches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{tc("لا توجد بيانات", "No data available")}</p>
                  ) : (
                    <div className="space-y-3">
                      {branches.map((branch: any, idx: number) => {
                        const pct = summary?.totalRevenue > 0 ? (branch.revenue / summary.totalRevenue) * 100 : 0;
                        return (
                          <div key={branch.branchId} className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                {branch.name}
                              </span>
                              <span className="font-bold"><FC amount={branch.revenue} /></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="flex-1 h-2" />
                              <span className="text-xs text-muted-foreground w-10">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{branch.orders} {tc("طلب", "orders")}</span>
                              <span>{tc("متوسط", "avg")} <FC amount={branch.avgOrder} /></span>
                              <span>{branch.customers} {tc("عميل", "customers")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            {branches.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{tc("لا توجد بيانات فروع", "No branch data available")}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {branches.length > 1 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{tc("مقارنة إيرادات الفروع", "Branch Revenue Comparison")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={branches}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                            <Bar dataKey="revenue" fill="#2D9B6E" radius={[4, 4, 0, 0]} name={tc("الإيرادات", "Revenue")} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {branches.map((branch: any, idx: number) => (
                  <Card key={branch.branchId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          {branch.name}
                        </CardTitle>
                        <Badge className="bg-[#2D9B6E] text-white"><FC amount={branch.revenue} /></Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-lg font-bold">{branch.orders}</p>
                          <p className="text-xs text-muted-foreground">{tc("طلبات", "Orders")}</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-lg font-bold"><FC amount={branch.avgOrder} /></p>
                          <p className="text-xs text-muted-foreground">{tc("متوسط الطلب", "Avg. Order")}</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-lg font-bold">{branch.customers}</p>
                          <p className="text-xs text-muted-foreground">{tc("عملاء", "Customers")}</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <p className="text-lg font-bold"><FC amount={branch.cashSales} /></p>
                          <p className="text-xs text-muted-foreground">{tc("نقدي", "Cash")}</p>
                        </div>
                      </div>

                      {branch.topItems && branch.topItems.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-muted-foreground mb-2">{tc("الأصناف الأكثر مبيعاً", "Top Selling Items")}</p>
                          <div className="space-y-1">
                            {branch.topItems.map((item: any, i: number) => (
                              <div key={item.id} className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                                  {item.name}
                                </span>
                                <span className="text-muted-foreground">{item.qty}x — <FC amount={item.revenue} /></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            {data?.dailyRevenue && data.dailyRevenue.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("اتجاه الإيرادات اليومية", "Daily Revenue Trend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.dailyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Line type="monotone" dataKey="amount" stroke="#2D9B6E" strokeWidth={2} dot={{ r: 4 }} name={tc("الإيرادات", "Revenue")} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {branches.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{tc("مقارنة طرق الدفع بين الفروع", "Payment Methods by Branch")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branches}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="cashSales" stackId="a" fill="#2D9B6E" name={tc("نقدي", "Cash")} />
                        <Bar dataKey="cardSales" stackId="a" fill="#3b82f6" name={tc("شبكة", "Card")} />
                        <Bar dataKey="loyaltySales" stackId="a" fill="#a855f7" name={tc("بطاقة مكان الشيف", "مكان الشيف Card")} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#2D9B6E]" />
                  {tc("تصدير محاسبي (قيود يومية)", "Accounting Export (Daily Journals)")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {tc("تصدير قيود يومية جاهزة للاستيراد في أنظمة المحاسبة مثل قيود ودفترة وزوهو", "Export daily journals ready to import into accounting systems like Qoyod, Daftra, and Zoho")}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-dashed">
                    <CardContent className="p-4 text-center space-y-3">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-green-600" />
                      <p className="font-bold">{tc("تصدير CSV", "Export CSV")}</p>
                      <p className="text-xs text-muted-foreground">{tc("ملف يفتح في Excel وقابل للاستيراد في قيود/دفترة", "Opens in Excel and importable to Qoyod/Daftra")}</p>
                      <Button onClick={() => exportAccounting('csv')} className="w-full bg-[#2D9B6E] hover:bg-[#258a5e]">
                        <Download className="w-4 h-4 ml-2" />
                        {tc("تحميل CSV", "Download CSV")}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardContent className="p-4 text-center space-y-3">
                      <FileText className="w-10 h-10 mx-auto text-blue-600" />
                      <p className="font-bold">{tc("تصدير JSON", "Export JSON")}</p>
                      <p className="text-xs text-muted-foreground">{tc("للربط المباشر مع API أنظمة المحاسبة", "For direct API integration with accounting systems")}</p>
                      <Button onClick={() => exportAccounting('json')} variant="outline" className="w-full">
                        <Download className="w-4 h-4 ml-2" />
                        {tc("تحميل JSON", "Download JSON")}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-bold mb-2">{tc("هيكل القيد المحاسبي:", "Accounting Entry Structure:")}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• <strong>1101</strong> — {tc("النقدية (مدين)", "Cash (Debit)")}</p>
                    <p>• <strong>1102</strong> — {tc("الشبكة/مدى (مدين)", "Card/Mada (Debit)")}</p>
                    <p>• <strong>1103</strong> — {tc("بطاقة مكان الشيف (مدين)", "مكان الشيف Card (Debit)")}</p>
                    <p>• <strong>4101</strong> — {tc("إيرادات المبيعات (دائن)", "Sales Revenue (Credit)")}</p>
                    <p>• <strong>2201</strong> — {tc("ضريبة القيمة المضافة (دائن)", "VAT (Credit)")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
