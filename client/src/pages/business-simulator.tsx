import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Building2, Package, Target, Calculator } from "lucide-react";

interface ScenarioInputs {
  currentRevenue: number;
  currentCogs: number;
  currentExpenses: number;
  newBranches: number;
  newEmployees: number;
  priceIncreasePercent: number;
  cogsReductionPercent: number;
  newProductsCount: number;
  revenueFromNewProducts: number;
}

function calcSimulation(inputs: ScenarioInputs) {
  const {
    currentRevenue, currentCogs, currentExpenses,
    newBranches, newEmployees, priceIncreasePercent,
    cogsReductionPercent, newProductsCount, revenueFromNewProducts,
  } = inputs;

  const currentProfit = currentRevenue - currentCogs - currentExpenses;
  const currentMargin = currentRevenue > 0 ? ((currentRevenue - currentCogs) / currentRevenue) * 100 : 0;

  // Price increase effect
  const revAfterPriceIncrease = currentRevenue * (1 + priceIncreasePercent / 100);
  // COGS reduction
  const newCogs = currentCogs * (1 - cogsReductionPercent / 100);
  // New branches cost (avg 50k SAR/month setup + operations)
  const branchCost = newBranches * 50000;
  // New employees cost (avg 3500 SAR/month each)
  const empCost = newEmployees * 3500;
  // New products revenue
  const newRev = newProductsCount * revenueFromNewProducts;

  const projectedRevenue = revAfterPriceIncrease + newRev + (newBranches * currentRevenue * 0.6);
  const projectedCogs = newCogs + (newBranches * currentCogs * 0.6 * (1 - cogsReductionPercent / 100));
  const projectedExpenses = currentExpenses + branchCost + empCost;
  const projectedProfit = projectedRevenue - projectedCogs - projectedExpenses;
  const projectedMargin = projectedRevenue > 0 ? ((projectedRevenue - projectedCogs) / projectedRevenue) * 100 : 0;

  // Break-even
  const fixedCosts = projectedExpenses;
  const contributionMarginRatio = projectedRevenue > 0 ? (projectedRevenue - projectedCogs) / projectedRevenue : 0;
  const breakEvenRevenue = contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : 0;

  // ROI (for investment made)
  const totalInvestment = branchCost * 3 + empCost * 6 + newProductsCount * 5000;
  const annualProfitGain = (projectedProfit - currentProfit) * 12;
  const roi = totalInvestment > 0 ? (annualProfitGain / totalInvestment) * 100 : 0;
  const paybackMonths = annualProfitGain > 0 ? (totalInvestment / (annualProfitGain / 12)) : 0;

  return {
    currentProfit, currentMargin,
    projectedRevenue, projectedCogs, projectedExpenses, projectedProfit, projectedMargin,
    breakEvenRevenue, roi, paybackMonths, totalInvestment,
    revenueDelta: projectedRevenue - currentRevenue,
    profitDelta: projectedProfit - currentProfit,
  };
}

function DeltaBadge({ value, suffix = "ر" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return (
    <Badge className={`text-xs ${positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {positive ? <TrendingUp className="w-3 h-3 ml-1 inline" /> : <TrendingDown className="w-3 h-3 ml-1 inline" />}
      {positive ? "+" : ""}{value.toFixed(0)} {suffix}
    </Badge>
  );
}

export default function BusinessSimulator() {
  const [, navigate] = useLocation();
  const [inputs, setInputs] = useState<ScenarioInputs>({
    currentRevenue: 100000,
    currentCogs: 35000,
    currentExpenses: 40000,
    newBranches: 0,
    newEmployees: 0,
    priceIncreasePercent: 0,
    cogsReductionPercent: 0,
    newProductsCount: 0,
    revenueFromNewProducts: 5000,
  });

  const result = calcSimulation(inputs);

  const set = (key: keyof ScenarioInputs) => (val: number[]) =>
    setInputs(prev => ({ ...prev, [key]: val[0] }));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/manager/dashboard")}>
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-primary" />
              محاكي قرارات الأعمال
            </h1>
            <p className="text-sm text-muted-foreground">محاكاة سيناريوهات العمل وحساب العائد على الاستثمار</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            {/* Baseline */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />الوضع الحالي (شهري)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "currentRevenue", label: "الإيراد", min: 10000, max: 500000, step: 5000 },
                  { key: "currentCogs", label: "تكلفة البضاعة (COGS)", min: 0, max: 200000, step: 2000 },
                  { key: "currentExpenses", label: "المصروفات التشغيلية", min: 0, max: 200000, step: 2000 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-sm text-primary font-bold">{(inputs[key as keyof ScenarioInputs] as number).toLocaleString()} ر</span>
                    </div>
                    <Slider min={min} max={max} step={step} value={[inputs[key as keyof ScenarioInputs] as number]} onValueChange={set(key as keyof ScenarioInputs)} data-testid={`slider-${key}`} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Scenarios */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-violet-600" />السيناريوهات</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />فروع جديدة</span>
                    <span className="text-sm font-bold text-violet-600">{inputs.newBranches}</span>
                  </div>
                  <Slider min={0} max={10} step={1} value={[inputs.newBranches]} onValueChange={set("newBranches")} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" />موظفون جدد</span>
                    <span className="text-sm font-bold text-violet-600">{inputs.newEmployees}</span>
                  </div>
                  <Slider min={0} max={50} step={1} value={[inputs.newEmployees]} onValueChange={set("newEmployees")} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />رفع الأسعار</span>
                    <span className="text-sm font-bold text-emerald-600">+{inputs.priceIncreasePercent}%</span>
                  </div>
                  <Slider min={0} max={30} step={1} value={[inputs.priceIncreasePercent]} onValueChange={set("priceIncreasePercent")} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />تخفيض التكلفة (COGS)</span>
                    <span className="text-sm font-bold text-emerald-600">-{inputs.cogsReductionPercent}%</span>
                  </div>
                  <Slider min={0} max={30} step={1} value={[inputs.cogsReductionPercent]} onValueChange={set("cogsReductionPercent")} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium flex items-center gap-1"><Package className="w-3.5 h-3.5" />منتجات جديدة</span>
                    <span className="text-sm font-bold text-violet-600">{inputs.newProductsCount}</span>
                  </div>
                  <Slider min={0} max={20} step={1} value={[inputs.newProductsCount]} onValueChange={set("newProductsCount")} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm">نتائج المحاكاة (شهرية)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "الإيراد المتوقع", value: result.projectedRevenue, delta: result.revenueDelta, color: "text-blue-600" },
                    { label: "صافي الربح المتوقع", value: result.projectedProfit, delta: result.profitDelta, color: result.projectedProfit >= 0 ? "text-emerald-600" : "text-red-600" },
                    { label: "هامش الربح الإجمالي", value: result.projectedMargin, delta: result.projectedMargin - result.currentMargin, color: "text-violet-600", suffix: "%" },
                    { label: "إجمالي التكاليف", value: result.projectedExpenses, delta: result.projectedExpenses - inputs.currentExpenses, color: "text-orange-600" },
                  ].map(({ label, value, delta, color, suffix = "ر" }) => (
                    <div key={label} className="bg-white dark:bg-card rounded-xl p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className={`text-xl font-bold ${color}`}>{value.toFixed(0)}{suffix}</p>
                      <DeltaBadge value={delta} suffix={suffix} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />نقطة التعادل والعائد</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">نقطة التعادل (إيراد شهري)</span>
                  <span className="font-bold">{result.breakEvenRevenue.toFixed(0)} ريال</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">إجمالي الاستثمار المطلوب</span>
                  <span className="font-bold">{result.totalInvestment.toFixed(0)} ريال</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm">العائد السنوي على الاستثمار (ROI)</span>
                  <span className={`font-bold ${result.roi >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {result.roi.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm">فترة استرداد الاستثمار</span>
                  <span className="font-bold">
                    {result.paybackMonths > 0 ? `${result.paybackMonths.toFixed(1)} شهر` : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Decision card */}
            <Card className={`border-2 ${result.projectedProfit > inputs.currentRevenue - inputs.currentCogs - inputs.currentExpenses ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20"}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  {result.projectedProfit > result.currentProfit ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-amber-600" />
                  )}
                  <p className="font-bold">
                    {result.projectedProfit > result.currentProfit
                      ? "✓ القرار مربح — يُنصح بالتطبيق"
                      : "⚠ القرار يزيد التكاليف — راجع السيناريو"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {result.profitDelta >= 0
                    ? `ستحقق ربحاً إضافياً قدره ${result.profitDelta.toFixed(0)} ريال/شهر (${(result.profitDelta * 12).toFixed(0)} ريال/سنة)`
                    : `ستتكبد خسارة إضافية ${Math.abs(result.profitDelta).toFixed(0)} ريال/شهر`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
