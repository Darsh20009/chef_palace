import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, ShoppingCart, BookOpen, Package, Wallet, BarChart3,
  Sparkles, AlertTriangle, CheckCircle, XCircle, TrendingDown,
  Clock, ArrowDown, RefreshCw, Loader2
} from "lucide-react";
import SarIcon from "@/components/sar-icon";

interface CycleData {
  summary: {
    totalProducts: number;
    productsWithRecipe: number;
    productsWithoutRecipe: number;
    recipeCompletionRate: number;
    ordersToday: number;
    deductedOrders: number;
    notDeductedOrders: number;
    cogsToday: number;
    revenueToday: number;
    grossMarginToday: number;
    lowStockCount: number;
  };
  productsWithoutRecipe: Array<{ id: string; nameAr: string; price: number; category: string }>;
  stockLevels: Array<{ id: string; nameAr: string; unit: string; currentStock: number; minStock: number; dailyConsumption: number; daysRemaining: number | null; isLow: boolean; unitCost: number }>;
  lowStockItems: Array<{ id: string; nameAr: string; unit: string; currentStock: number; minStock: number; daysRemaining: number | null }>;
  topCogsItems: Array<{ id: string; nameAr: string; estimatedDailyCost: number }>;
  recentOrders: Array<{ orderNumber: string; totalAmount: number; costOfGoods: number; inventoryDeducted: number; paymentMethod: string; createdAt: string }>;
}

const CYCLE_STEPS = [
  { icon: ShoppingCart, label: "نقطة البيع", sub: "تسجيل الطلب", color: "bg-blue-500" },
  { icon: BarChart3, label: "المبيعات", sub: "قيد الإيراد", color: "bg-emerald-500" },
  { icon: BookOpen, label: "الوصفات", sub: "تحديد المكونات", color: "bg-violet-500" },
  { icon: Package, label: "المخزون", sub: "خصم تلقائي + هدر", color: "bg-orange-500" },
  { icon: Wallet, label: "المحاسبة", sub: "قيد COGS تلقائي", color: "bg-rose-500" },
  { icon: Sparkles, label: "التقارير", sub: "تحليل وتوصيات", color: "bg-amber-500" },
];

function StepArrow() {
  return <ArrowDown className="w-4 h-4 text-muted-foreground md:rotate-[-90deg] shrink-0" />;
}

export default function InventoryCycleDashboard() {
  const [, navigate] = useLocation();

  const { data, isLoading, refetch, isFetching } = useQuery<CycleData>({
    queryKey: ["/api/inventory/cycle-status"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/cycle-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load cycle status");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/manager/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">دورة المخزون الذكي</h1>
            <p className="text-sm text-muted-foreground">POS → مبيعات → وصفات → مخزون → محاسبة — كل شيء تلقائي</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh">
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : data ? (
          <>
            {/* Cycle visualization */}
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">دورة التشغيل الكاملة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-2 justify-between">
                  {CYCLE_STEPS.map((step, i) => (
                    <div key={i} className="flex flex-col md:flex-row items-center gap-2">
                      <div className="flex flex-col items-center gap-1 text-center min-w-[90px]">
                        <div className={`w-12 h-12 rounded-xl ${step.color} text-white flex items-center justify-center shadow`}>
                          <step.icon className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold">{step.label}</span>
                        <span className="text-[10px] text-muted-foreground">{step.sub}</span>
                      </div>
                      {i < CYCLE_STEPS.length - 1 && <StepArrow />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">ربط الوصفات</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-primary">{data.summary.recipeCompletionRate}%</span>
                  </div>
                  <Progress value={data.summary.recipeCompletionRate} className="mt-2 h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.summary.productsWithRecipe} من {data.summary.totalProducts} منتج مرتبط
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">الطلبات اليوم</p>
                  <span className="text-3xl font-bold">{data.summary.ordersToday}</span>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px]">
                      <CheckCircle className="w-3 h-3 ml-1" />{data.summary.deductedOrders} تم الخصم
                    </Badge>
                    {data.summary.notDeductedOrders > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                        <XCircle className="w-3 h-3 ml-1" />{data.summary.notDeductedOrders} لم يُخصم
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">COGS اليوم</p>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{data.summary.cogsToday.toFixed(0)}</span>
                    <SarIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    هامش: <span className={`font-semibold ${data.summary.grossMarginToday >= 50 ? "text-emerald-600" : "text-amber-600"}`}>{data.summary.grossMarginToday}%</span>
                  </p>
                  <p className="text-xs text-muted-foreground">إيراد: {data.summary.revenueToday.toFixed(0)} ر</p>
                </CardContent>
              </Card>

              <Card className={data.summary.lowStockCount > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">تنبيهات المخزون</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold ${data.summary.lowStockCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {data.summary.lowStockCount}
                    </span>
                    {data.summary.lowStockCount > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.summary.lowStockCount > 0 ? "مواد تحت الحد الأدنى" : "المخزون سليم"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Products without recipes */}
              <Card className={data.productsWithoutRecipe.length > 0 ? "border-amber-200" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    منتجات بدون وصفة
                    <Badge variant="secondary" className="mr-auto">{data.productsWithoutRecipe.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.productsWithoutRecipe.length === 0 ? (
                    <div className="flex flex-col items-center py-6 gap-2">
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                      <p className="text-sm text-emerald-600 font-medium">جميع المنتجات مرتبطة بوصفات ✓</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-52">
                      <div className="space-y-2">
                        {data.productsWithoutRecipe.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                            <span className="font-medium text-foreground">{p.nameAr}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">{p.price} ر</span>
                              <Button
                                size="sm" variant="outline"
                                className="h-6 text-[10px] px-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => navigate("/manager/inventory/recipes")}
                                data-testid={`button-add-recipe-${p.id}`}
                              >
                                ربط وصفة
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Stock levels */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    مستويات المخزون
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-52">
                    <div className="space-y-2.5">
                      {data.stockLevels.map(item => {
                        const pct = item.minStock > 0 ? Math.min(100, (item.currentStock / (item.minStock * 3)) * 100) : 60;
                        const urgency = item.daysRemaining !== null && item.daysRemaining < 3 ? "text-red-600" :
                          item.daysRemaining !== null && item.daysRemaining < 7 ? "text-amber-600" : "text-emerald-600";
                        return (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium truncate max-w-[130px]">{item.nameAr}</span>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>{item.currentStock.toFixed(1)} {item.unit}</span>
                                {item.daysRemaining !== null && (
                                  <span className={`font-semibold ${urgency}`}>
                                    <Clock className="w-3 h-3 inline ml-0.5" />{item.daysRemaining}ي
                                  </span>
                                )}
                              </div>
                            </div>
                            <Progress value={Math.max(0, pct)} className={`h-1.5 ${item.isLow ? "[&>div]:bg-red-500" : ""}`} />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Top COGS + Recent orders */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                      أعلى استهلاك COGS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.topCogsItems.slice(0, 6).map((item, i) => (
                        <div key={item.id} className="flex items-center gap-2 text-xs">
                          <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                          <span className="flex-1 truncate">{item.nameAr}</span>
                          <span className="font-semibold text-foreground">{item.estimatedDailyCost.toFixed(1)} ر</span>
                        </div>
                      ))}
                      {data.topCogsItems.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات كافية</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-500" />
                      آخر الطلبات (24 ساعة)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32">
                      <div className="space-y-1.5">
                        {data.recentOrders.map(order => (
                          <div key={order.orderNumber} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0">
                            <span className="font-mono text-muted-foreground">#{order.orderNumber}</span>
                            <span className="flex-1 text-right">{order.totalAmount?.toFixed(0)} ر</span>
                            {order.inventoryDeducted >= 1 ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </div>
                        ))}
                        {data.recentOrders.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">لا توجد طلبات اليوم</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Low stock alerts */}
            {data.lowStockItems.length > 0 && (
              <Card className="mt-6 border-red-200 bg-red-50 dark:bg-red-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    تنبيهات الإعادة الفورية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {data.lowStockItems.map(item => (
                      <div key={item.id} className="bg-white dark:bg-card rounded-lg p-3 border border-red-200 dark:border-red-800 text-center">
                        <p className="text-xs font-semibold text-foreground mb-1">{item.nameAr}</p>
                        <p className="text-lg font-bold text-red-600">{item.currentStock.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground">{item.unit} متبقي</p>
                        {item.daysRemaining !== null && (
                          <Badge variant="destructive" className="text-[9px] mt-1">
                            {item.daysRemaining <= 0 ? "نفد!" : `${item.daysRemaining} يوم`}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button
                      size="sm" variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-100 gap-1.5"
                      onClick={() => navigate("/manager/inventory/purchases")}
                      data-testid="button-create-purchase-order"
                    >
                      <Package className="w-3.5 h-3.5" />
                      إنشاء أوامر شراء
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
