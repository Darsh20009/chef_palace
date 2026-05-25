import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles, ArrowLeft, FileText, TrendingUp, Users, Package,
  Download, RefreshCw, Loader2, Calendar, BarChart3, AlertCircle,
  CheckCircle2, LightbulbIcon, Target, Clock
} from "lucide-react";

type ReportType = "sales" | "employees" | "inventory" | "customers" | "full";

interface SmartReport {
  type: ReportType;
  period: string;
  generatedAt: string;
  summary: string;
  sections: Array<{
    title: string;
    icon: string;
    content: string;
    bullets?: string[];
    highlight?: string;
  }>;
  recommendations: string[];
  risks: string[];
  kpis: Array<{ label: string; value: string; trend: "up" | "down" | "flat" }>;
}

const REPORT_TYPES: Array<{ id: ReportType; labelAr: string; labelEn: string; icon: any; color: string; descAr: string; descEn: string }> = [
  { id: "sales",     labelAr: "تقرير المبيعات",   labelEn: "Sales Report",      icon: TrendingUp,  color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700", descAr: "تحليل الإيرادات والمنتجات والأداء",    descEn: "Revenue, products and performance analysis" },
  { id: "employees", labelAr: "تقرير الموظفين",   labelEn: "Employee Report",   icon: Users,       color: "bg-blue-500/10 border-blue-500/30 text-blue-700",         descAr: "الأداء والحضور والإنتاجية",            descEn: "Performance, attendance and productivity" },
  { id: "inventory", labelAr: "تقرير المخزون",    labelEn: "Inventory Report",  icon: Package,     color: "bg-amber-500/10 border-amber-500/30 text-amber-700",      descAr: "المستودع والنقص والهدر",               descEn: "Stock, shortages and waste" },
  { id: "customers", labelAr: "تقرير العملاء",    labelEn: "Customer Report",   icon: BarChart3,   color: "bg-purple-500/10 border-purple-500/30 text-purple-700",   descAr: "ولاء العملاء ومعدل التكرار",          descEn: "Customer loyalty and retention rate" },
  { id: "full",      labelAr: "تقرير شامل",       labelEn: "Full Report",       icon: FileText,    color: "bg-primary/10 border-primary/30 text-primary",            descAr: "كل شيء في تقرير واحد متكامل",         descEn: "Everything in one comprehensive report" },
];

const PERIODS = [
  { id: "today",  labelAr: "اليوم",    labelEn: "Today" },
  { id: "week",   labelAr: "الأسبوع",  labelEn: "This Week" },
  { id: "month",  labelAr: "الشهر",    labelEn: "This Month" },
];

function formatContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function TrendBadge({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <span className="text-xs text-emerald-600 font-bold">↑</span>;
  if (trend === "down") return <span className="text-xs text-red-500 font-bold">↓</span>;
  return <span className="text-xs text-muted-foreground font-bold">→</span>;
}

export default function ManagerSmartReports() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const tc = useTranslate();
  const isAr = i18n.language !== 'en';
  const [selectedType, setSelectedType] = useState<ReportType>("sales");
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [currentReport, setCurrentReport] = useState<SmartReport | null>(null);

  const reportMutation = useMutation({
    mutationFn: async ({ type, period }: { type: ReportType; period: string }) => {
      const res = await apiRequest("POST", "/api/ai/smart-report", { type, period });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentReport(data);
    },
  });

  const generateReport = () => {
    reportMutation.mutate({ type: selectedType, period: selectedPeriod });
  };

  const downloadReport = () => {
    if (!currentReport) return;
    const typeInfo = REPORT_TYPES.find(r => r.id === currentReport.type);
    const periodInfo = PERIODS.find(p => p.id === currentReport.period);
    const lines: string[] = [
      `${isAr ? typeInfo?.labelAr : typeInfo?.labelEn} — ${isAr ? periodInfo?.labelAr : periodInfo?.labelEn}`,
      `${isAr ? 'تاريخ الإنشاء' : 'Generated'}: ${new Date(currentReport.generatedAt).toLocaleString(isAr ? "ar-SA" : "en-US")}`,
      "=".repeat(60),
      "",
      `${isAr ? 'الملخص التنفيذي' : 'Executive Summary'}:`,
      currentReport.summary,
      "",
    ];
    if (currentReport.kpis?.length) {
      lines.push(`${isAr ? 'المؤشرات الرئيسية' : 'Key Indicators'}:`);
      currentReport.kpis.forEach(k => lines.push(`  • ${k.label}: ${k.value}`));
      lines.push("");
    }
    currentReport.sections.forEach(s => {
      lines.push(`${s.icon} ${s.title}:`);
      lines.push(s.content.replace(/<[^>]+>/g, ""));
      if (s.bullets?.length) s.bullets.forEach(b => lines.push(`  • ${b}`));
      if (s.highlight) lines.push(`  ⭐ ${s.highlight}`);
      lines.push("");
    });
    if (currentReport.recommendations?.length) {
      lines.push(`${isAr ? 'التوصيات' : 'Recommendations'}:`);
      currentReport.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
      lines.push("");
    }
    if (currentReport.risks?.length) {
      lines.push(`${isAr ? 'المخاطر والتحذيرات' : 'Risks & Warnings'}:`);
      currentReport.risks.forEach((r) => lines.push(`  ⚠️ ${r}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-report-${currentReport.type}-${selectedPeriod}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedTypeInfo = REPORT_TYPES.find(r => r.id === selectedType)!;
  const isGenerating = reportMutation.isPending;
  const hasError = reportMutation.isError;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="btn-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">{tc('تقارير الذكاء الاصطناعي', 'AI Smart Reports')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{tc('تقارير ذكية مولّدة بـ AI من بيانات الكافيه الحقيقية', 'Smart reports generated by AI from real cafe data')}</p>
            </div>
          </div>
          {currentReport && (
            <Button variant="outline" size="sm" onClick={downloadReport} data-testid="btn-download-report">
              <Download className={`w-4 h-4 ${isAr ? 'ml-1' : 'mr-1'}`} />
              {tc('تحميل', 'Download')}
            </Button>
          )}
        </div>

        {/* Config Panel */}
        <Card>
          <CardContent className="p-5 space-y-5">
            {/* Report Type */}
            <div>
              <p className="text-sm font-semibold mb-3 text-muted-foreground">{tc('نوع التقرير', 'Report Type')}</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {REPORT_TYPES.map(type => {
                  const Icon = type.icon;
                  const isActive = selectedType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      data-testid={`btn-report-type-${type.id}`}
                      className={`p-3 rounded-xl border ${isAr ? 'text-right' : 'text-left'} transition-all ${isActive ? type.color + " ring-2 ring-offset-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}
                    >
                      <Icon className={`w-4 h-4 mb-1.5 ${isActive ? "" : "text-muted-foreground"}`} />
                      <p className="text-xs font-semibold leading-tight">{isAr ? type.labelAr : type.labelEn}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period */}
            <div>
              <p className="text-sm font-semibold mb-3 text-muted-foreground">{tc('الفترة الزمنية', 'Time Period')}</p>
              <div className="flex gap-2">
                {PERIODS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p.id)}
                    data-testid={`btn-period-${p.id}`}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${selectedPeriod === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/30"}`}
                  >
                    {isAr ? p.labelAr : p.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={generateReport}
              disabled={isGenerating}
              className="w-full"
              data-testid="btn-generate-report"
            >
              {isGenerating ? (
                <><Loader2 className={`w-4 h-4 ${isAr ? 'ml-2' : 'mr-2'} animate-spin`} />{tc('جاري التوليد...', 'Generating...')}</>
              ) : (
                <><Sparkles className={`w-4 h-4 ${isAr ? 'ml-2' : 'mr-2'}`} />{tc('توليد التقرير', 'Generate Report')}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error State */}
        {hasError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                {tc('فشل توليد التقرير — تأكد من إعداد مفتاح Groq API أو حاول مرة أخرى.', 'Report generation failed — ensure your Groq API key is configured or try again.')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isGenerating && (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-primary animate-pulse" />
              </div>
              <p className="font-semibold">{tc('يحلل الذكاء الاصطناعي بياناتك...', 'AI is analyzing your data...')}</p>
              <p className="text-sm text-muted-foreground">{tc('قد يستغرق ذلك 10-20 ثانية', 'This may take 10-20 seconds')}</p>
            </CardContent>
          </Card>
        )}

        {/* Report Output */}
        {currentReport && !isGenerating && (
          <div className="space-y-4">
            {/* Report Header */}
            <Card className="bg-gradient-to-br from-violet-500/5 to-purple-500/10 border-violet-200 dark:border-violet-800">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs border-violet-400 text-violet-700">
                        {isAr ? REPORT_TYPES.find(r => r.id === currentReport.type)?.labelAr : REPORT_TYPES.find(r => r.id === currentReport.type)?.labelEn}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Calendar className={`w-3 h-3 ${isAr ? 'ml-1' : 'mr-1'}`} />
                        {isAr ? PERIODS.find(p => p.id === currentReport.period)?.labelAr : PERIODS.find(p => p.id === currentReport.period)?.labelEn}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{currentReport.summary}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(currentReport.generatedAt).toLocaleTimeString(isAr ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPIs */}
            {currentReport.kpis?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currentReport.kpis.map((kpi, i) => (
                  <Card key={i} className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-lg font-bold">{kpi.value}</p>
                      <TrendBadge trend={kpi.trend} />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Sections */}
            {currentReport.sections?.map((section, i) => (
              <Card key={i}>
                <CardHeader className="pb-3 pt-4 px-5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{section.icon}</span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatContent(section.content) }} />
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="space-y-1.5">
                      {section.bullets.map((b, j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <span className="text-primary mt-0.5 shrink-0">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.highlight && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                      <span className="text-amber-500 shrink-0">⭐</span>
                      {section.highlight}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Recommendations + Risks */}
            <div className="grid md:grid-cols-2 gap-4">
              {currentReport.recommendations?.length > 0 && (
                <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                      <LightbulbIcon className="w-4 h-4" />
                      {tc('التوصيات', 'Recommendations')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ol className="space-y-2">
                      {currentReport.recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-emerald-600 font-bold shrink-0">{i + 1}.</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {currentReport.risks?.length > 0 && (
                <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {tc('مخاطر وتحذيرات', 'Risks & Warnings')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ul className="space-y-2">
                      {currentReport.risks.map((risk, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-red-500 shrink-0">⚠️</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Regenerate */}
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={generateReport} data-testid="btn-regenerate">
                <RefreshCw className={`w-3.5 h-3.5 ${isAr ? 'ml-1.5' : 'mr-1.5'}`} />
                {tc('إعادة توليد', 'Regenerate')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
