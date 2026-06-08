import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Building2, TrendingUp, TrendingDown, Package,
  Users, DollarSign, AlertTriangle, CheckCircle, Sparkles,
  RefreshCw, Send, Loader2, BarChart3
} from "lucide-react";

interface BranchTwin {
  branchId: string;
  branchName: string;
  kpis: {
    revenue24h: number; revenue7d: number; revenue30d: number;
    orders24h: number; orders7d: number; orders30d: number;
    grossMargin: number; cogs30d: number;
    lowStockAlerts: number; employeeCount: number;
  };
  forecast: { next7dRevenue: number; dailyAvgRevenue: number };
  healthScore: number;
  risks: string[];
  opportunities: string[];
}

interface DigitalTwinData { branches: BranchTwin[]; generatedAt: string }

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-background border">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function DigitalTwin() {
  const [, navigate] = useLocation();
  const [aiInput, setAiInput] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<DigitalTwinData>({
    queryKey: ["/api/digital-twin"],
    queryFn: async () => {
      const r = await fetch("/api/digital-twin", { credentials: "include" });
      return r.json();
    },
    staleTime: 60_000,
  });

  const askMut = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/ai/ceo-chat", { question, history: [] });
      return res.json();
    },
    onSuccess: (d: any) => setAiResponse(d.answer),
  });

  const sortedBranches = [...(data?.branches ?? [])].sort((a, b) => b.healthScore - a.healthScore);
  const totalRev30 = sortedBranches.reduce((s, b) => s + b.kpis.revenue30d, 0);
  const totalOrders30 = sortedBranches.reduce((s, b) => s + b.kpis.orders30d, 0);
  const totalAlerts = sortedBranches.reduce((s, b) => s + b.kpis.lowStockAlerts, 0);
  const avgHealth = sortedBranches.length > 0 ? sortedBranches.reduce((s, b) => s + b.healthScore, 0) / sortedBranches.length : 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/manager/dashboard")}>
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              التوأم الرقمي للفروع
            </h1>
            <p className="text-sm text-muted-foreground">
              محاكاة حية لكل فرع — مبيعات، مخزون، أرباح، موظفون، تنبيهات
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-primary">{sortedBranches.length}</p>
                <p className="text-xs text-muted-foreground">الفروع النشطة</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{totalRev30.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">إيراد 30 يوم (ريال)</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{totalOrders30}</p>
                <p className="text-xs text-muted-foreground">طلبات 30 يوم</p>
              </CardContent></Card>
              <Card className={totalAlerts > 0 ? "border-red-200" : ""}>
                <CardContent className="pt-4 text-center">
                  <p className={`text-2xl font-bold ${totalAlerts > 0 ? "text-red-600" : "text-emerald-600"}`}>{totalAlerts}</p>
                  <p className="text-xs text-muted-foreground">تنبيهات مخزون</p>
                </CardContent>
              </Card>
            </div>

            {/* Branch cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {sortedBranches.map(branch => (
                <Card key={branch.branchId} className={`${branch.healthScore < 40 ? "border-red-200" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{branch.branchName}</CardTitle>
                          <p className="text-xs text-muted-foreground">صحة: {branch.healthScore}/100</p>
                        </div>
                      </div>
                      <Badge className={`text-xs ${branch.healthScore >= 70 ? "bg-emerald-100 text-emerald-700" : branch.healthScore >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {branch.healthScore >= 70 ? "ممتاز" : branch.healthScore >= 40 ? "متوسط" : "يحتاج انتباه"}
                      </Badge>
                    </div>
                    <HealthBar score={branch.healthScore} />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <KpiCard label="إيراد 24 ساعة" value={`${branch.kpis.revenue24h.toFixed(0)} ر`} icon={DollarSign} color="bg-blue-500" />
                      <KpiCard label="طلبات 24 ساعة" value={branch.kpis.orders24h} icon={BarChart3} color="bg-violet-500" />
                      <KpiCard label="هامش الربح" value={`${branch.kpis.grossMargin.toFixed(1)}%`} icon={TrendingUp} color={branch.kpis.grossMargin >= 30 ? "bg-emerald-500" : "bg-amber-500"} />
                      <KpiCard label="تنبيهات مخزون" value={branch.kpis.lowStockAlerts} icon={Package} color={branch.kpis.lowStockAlerts > 0 ? "bg-red-500" : "bg-emerald-500"} />
                    </div>

                    {/* Forecast */}
                    <div className="bg-muted/40 rounded-lg p-2 mb-2 flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">توقع 7 أيام القادمة:</span>
                      <span className="text-sm font-bold text-primary">{branch.forecast.next7dRevenue.toFixed(0)} ريال</span>
                    </div>

                    {/* Risks & opportunities */}
                    {branch.risks.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {branch.risks.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{r}
                          </div>
                        ))}
                      </div>
                    )}
                    {branch.opportunities.map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <CheckCircle className="w-3 h-3 shrink-0" />{o}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI predictions panel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  تنبيهات استباقية بالذكاء الاصطناعي
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!aiResponse && !askMut.isPending && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">اسأل الذكاء الاصطناعي عن مستقبل فروعك</p>
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      {[
                        "ما توقعاتك للأسبوع القادم بناءً على البيانات الحالية؟",
                        "ما الفرع الذي يحتاج تدخلاً فورياً ولماذا؟",
                        "كيف أحسن الأداء العام لجميع الفروع؟"
                      ].map((q, i) => (
                        <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => { setAiInput(q); askMut.mutate(q); }} data-testid={`button-ai-suggestion-${i}`}>
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {askMut.isPending && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">يحلل بيانات الفروع...</span>
                  </div>
                )}

                {aiResponse && (
                  <ScrollArea className="max-h-60 mb-3">
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-lg p-3">
                      {aiResponse}
                    </div>
                  </ScrollArea>
                )}

                <div className="flex gap-2">
                  <Textarea
                    placeholder="اسأل عن مستقبل فروعك..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    className="resize-none"
                    rows={2}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (aiInput.trim()) { askMut.mutate(aiInput); setAiInput(""); } } }}
                    data-testid="input-twin-question"
                  />
                  <Button className="self-end" onClick={() => { if (aiInput.trim()) { askMut.mutate(aiInput); setAiInput(""); } }} disabled={askMut.isPending} data-testid="button-twin-send">
                    {askMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
