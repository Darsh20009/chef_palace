import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Code2, FileWarning, TestTube2, Radio, Layers,
  Sparkles, AlertTriangle, FileText, Package, Activity, CheckCircle2,
  PlayCircle, RefreshCw,
} from "lucide-react";

interface CQStats {
  summary: {
    totalFiles: number; totalLines: number; totalBytes: number;
    totalTodos: number; testFiles: number; oversizedFiles: number;
    avgLinesPerFile: number; healthScore: number;
  };
  largest: { path: string; lines: number; kb: number }[];
  todoFiles: { path: string; todos: number }[];
  oversized: { path: string; lines: number }[];
  modules: { name: string; files: number; lines: number; tests: number; coverage: number }[];
  tests: string[];
  eventBus: {
    totalEmitted: number; totalHandled: number; totalErrors: number;
    subscriptions: { name: string; subscribers: number }[];
    topEvents: { name: string; emitted: number; handled: number; errors: number }[];
  };
}

function healthColor(s: number) {
  if (s >= 80) return "text-emerald-600";
  if (s >= 60) return "text-primary";
  if (s >= 40) return "text-amber-600";
  return "text-red-600";
}

function linesColor(n: number) {
  if (n < 300) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (n < 800) return "bg-primary/10 text-primary border-primary/30";
  if (n < 1500) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export default function CodeQualityDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: stats, isLoading, refetch } = useQuery<CQStats>({
    queryKey: ["/api/code-quality/stats"],
  });

  const runTests = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/code-quality/run-tests")).json(),
    onSuccess: (d: any) => {
      toast({
        title: d.ok ? "✓ جميع الاختبارات نجحت" : "✗ فشلت بعض الاختبارات",
        description: `${d.passed} نجح · ${d.failed} فشل`,
        variant: d.ok ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/code-quality/stats"] });
    },
  });

  const h = stats?.summary.healthScore ?? 0;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <Code2 className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">جودة الكود</h1>
                <p className="text-sm text-gray-500">Modular · Event-driven · Typed · Tested</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runTests.mutate()}
              disabled={runTests.isPending}
              data-testid="button-run-tests"
            >
              <PlayCircle className="h-4 w-4 ml-2" />
              {runTests.isPending ? "جاري التشغيل..." : "تشغيل الاختبارات"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />تحديث
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Health hero */}
        <Card className="p-6 border border-violet-200 bg-gradient-to-l from-violet-50 to-white">
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none" strokeWidth="10" strokeLinecap="round"
                  stroke={h >= 80 ? "#10b981" : h >= 60 ? "#2D9B6E" : h >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeDasharray={`${(h / 100) * 251.2} 251.2`}
                />
              </svg>
              <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${healthColor(h)}`} data-testid="text-health-score">
                {h}
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">درجة صحة الكود</h2>
              <p className="text-sm text-gray-600 mb-3">حساب بناءً على حجم الملفات، عدد TODO/FIXME، وجود اختبارات، event bus.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="rounded bg-white border border-gray-200 p-2">
                  <div className="text-gray-500">إجمالي الملفات</div>
                  <div className="font-bold text-gray-900">{stats?.summary.totalFiles ?? 0}</div>
                </div>
                <div className="rounded bg-white border border-gray-200 p-2">
                  <div className="text-gray-500">إجمالي الأسطر</div>
                  <div className="font-bold text-gray-900">{(stats?.summary.totalLines ?? 0).toLocaleString("en")}</div>
                </div>
                <div className="rounded bg-white border border-gray-200 p-2">
                  <div className="text-gray-500">متوسط أسطر/ملف</div>
                  <div className="font-bold text-gray-900">{stats?.summary.avgLinesPerFile ?? 0}</div>
                </div>
                <div className="rounded bg-white border border-gray-200 p-2">
                  <div className="text-gray-500">حجم الكود</div>
                  <div className="font-bold text-gray-900">{Math.round((stats?.summary.totalBytes ?? 0) / 1024)} KB</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">ملفات ضخمة</span>
              <FileWarning className={`h-4 w-4 ${(stats?.summary.oversizedFiles || 0) > 5 ? "text-red-600" : "text-amber-600"}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900" data-testid="stat-oversized">{stats?.summary.oversizedFiles ?? 0}</div>
            <p className="text-xs text-gray-400 mt-1">أكثر من 800 سطر</p>
          </Card>
          <Card className="p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">TODO / FIXME</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900" data-testid="stat-todos">{stats?.summary.totalTodos ?? 0}</div>
            <p className="text-xs text-gray-400 mt-1">عبر {stats?.todoFiles.length ?? 0} ملف</p>
          </Card>
          <Card className="p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">ملفات اختبار</span>
              <TestTube2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600" data-testid="stat-tests">{stats?.summary.testFiles ?? 0}</div>
            <p className="text-xs text-gray-400 mt-1">tests/</p>
          </Card>
          <Card className="p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">أحداث منشورة</span>
              <Radio className="h-4 w-4 text-violet-600" />
            </div>
            <div className="text-2xl font-bold text-violet-600" data-testid="stat-events">{stats?.eventBus.totalEmitted ?? 0}</div>
            <p className="text-xs text-gray-400 mt-1">{stats?.eventBus.subscriptions.length ?? 0} مشترك</p>
          </Card>
        </div>

        <Tabs defaultValue="modules" className="space-y-4">
          <TabsList className="bg-gray-100 border border-gray-200">
            <TabsTrigger value="modules" data-testid="tab-modules"><Package className="h-4 w-4 ml-2" />الوحدات</TabsTrigger>
            <TabsTrigger value="largest" data-testid="tab-largest"><Layers className="h-4 w-4 ml-2" />أكبر الملفات</TabsTrigger>
            <TabsTrigger value="todos" data-testid="tab-todos"><AlertTriangle className="h-4 w-4 ml-2" />TODOs</TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events"><Radio className="h-4 w-4 ml-2" />Event Bus</TabsTrigger>
            <TabsTrigger value="tests" data-testid="tab-tests"><TestTube2 className="h-4 w-4 ml-2" />الاختبارات</TabsTrigger>
            <TabsTrigger value="arch" data-testid="tab-arch"><Sparkles className="h-4 w-4 ml-2" />Architecture</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-3">
            <Card className="p-5 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">تقسيم الكود حسب الوحدة</h3>
              {isLoading ? <p className="text-sm text-gray-400">جاري التحميل...</p> :
                <div className="space-y-3">
                  {stats?.modules.map((m, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3" data-testid={`row-module-${i}`}>
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-sm font-semibold text-gray-900">{m.name}</code>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{m.files} ملف</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{m.lines.toLocaleString("en")} سطر</span>
                          {m.tests > 0 && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">{m.tests} اختبار</Badge>}
                        </div>
                      </div>
                      <Progress value={Math.min(100, (m.lines / 5000) * 100)} className="h-1.5" />
                    </div>
                  ))}
                </div>
              }
            </Card>
          </TabsContent>

          <TabsContent value="largest" className="space-y-3">
            <Card className="p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900">أكبر 15 ملف — مرشحة لإعادة الهيكلة</h3>
              </div>
              <div className="space-y-1.5">
                {stats?.largest.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 text-sm" data-testid={`row-large-${i}`}>
                    <span className="text-gray-400 text-xs w-6">#{i + 1}</span>
                    <code className="text-xs text-gray-700 flex-1 truncate" title={f.path}>{f.path}</code>
                    <Badge variant="outline" className={`text-xs ${linesColor(f.lines)}`}>{f.lines.toLocaleString("en")} سطر</Badge>
                    <span className="text-xs text-gray-400 w-14 text-left">{f.kb} KB</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="todos" className="space-y-3">
            <Card className="p-5 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">ملفات بها TODO / FIXME / HACK</h3>
              {!stats?.todoFiles.length ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">لا توجد ملاحظات معلقة</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {stats.todoFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 text-sm">
                      <FileText className="h-3 w-3 text-amber-600" />
                      <code className="text-xs text-gray-700 flex-1 truncate">{f.path}</code>
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{f.todos}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Radio className="h-4 w-4 text-violet-600" />
                  <h3 className="text-sm font-bold text-gray-900">الاشتراكات النشطة</h3>
                </div>
                {!stats?.eventBus.subscriptions.length ? (
                  <p className="text-sm text-gray-400 py-6 text-center">لا توجد اشتراكات بعد</p>
                ) : (
                  <div className="space-y-1.5">
                    {stats.eventBus.subscriptions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 text-sm">
                        <code className="text-xs text-violet-700 flex-1">{s.name}</code>
                        <Badge variant="outline" className="text-xs">{s.subscribers} listener{s.subscribers > 1 ? "s" : ""}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-gray-900">الأحداث الأكثر نشاطاً</h3>
                </div>
                {!stats?.eventBus.topEvents.length ? (
                  <p className="text-sm text-gray-400 py-6 text-center">لم تُنشر أحداث بعد</p>
                ) : (
                  <div className="space-y-1.5">
                    {stats.eventBus.topEvents.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 text-sm">
                        <code className="text-xs text-gray-700 flex-1">{e.name}</code>
                        <span className="text-xs text-emerald-600">{e.emitted}↑</span>
                        <span className="text-xs text-gray-400">{e.handled}↓</span>
                        {e.errors > 0 && <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">{e.errors}!</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tests" className="space-y-3">
            <Card className="p-5 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900">ملفات الاختبار</h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => runTests.mutate()} disabled={runTests.isPending} data-testid="button-run-tests-tab">
                  <PlayCircle className="h-4 w-4 ml-2" />تشغيل
                </Button>
              </div>
              {!stats?.tests.length ? (
                <p className="text-sm text-gray-400 py-6 text-center">لا توجد ملفات اختبار</p>
              ) : (
                <div className="space-y-1">
                  {stats.tests.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <code className="text-xs text-gray-700">{t}</code>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="arch" className="space-y-3">
            <Card className="p-5 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">الطبقة الجديدة — Phase 9 Core</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="h-4 w-4 text-violet-600" />
                    <span className="font-semibold text-gray-900">Event Bus</span>
                    <Badge className="text-xs bg-violet-50 text-violet-700 border-violet-200">شغّال</Badge>
                  </div>
                  <code className="text-xs text-gray-600 block mb-1">server/core/event-bus.ts</code>
                  <code className="text-xs text-gray-600 block mb-1">client/src/lib/core/event-bus.ts</code>
                  <p className="text-xs text-gray-500 mt-2">نشر/اشتراك مفصول، 19 نوع حدث، إحصائيات حية</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-gray-900">Result&lt;T, E&gt;</span>
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/30">شغّال</Badge>
                  </div>
                  <code className="text-xs text-gray-600 block mb-1">server/core/result.ts</code>
                  <p className="text-xs text-gray-500 mt-2">معالجة أخطاء مكتوبة، AppError، tryAsync()</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-amber-600" />
                    <span className="font-semibold text-gray-900">Structured Logger</span>
                    <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200">شغّال</Badge>
                  </div>
                  <code className="text-xs text-gray-600 block mb-1">server/core/logger.ts</code>
                  <p className="text-xs text-gray-500 mt-2">JSON في الإنتاج، ملون في التطوير، child scopes</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="h-4 w-4 text-cyan-600" />
                    <span className="font-semibold text-gray-900">Typed API Client</span>
                    <Badge className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">شغّال</Badge>
                  </div>
                  <code className="text-xs text-gray-600 block mb-1">client/src/lib/core/typed-api.ts</code>
                  <p className="text-xs text-gray-500 mt-2">يعيد ApiResult&lt;T&gt;، لا يرمي أخطاء، يفرض المعالجة</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold text-gray-900">Shared Contracts</span>
                    <Badge className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">مصدر واحد للحقيقة</Badge>
                  </div>
                  <code className="text-xs text-gray-600 block mb-2">shared/core/contracts.ts</code>
                  <p className="text-xs text-gray-500">19 نوع حدث مكتوب بالكامل، EventName, EventPayloads, DomainEvent — مستخدم من الواجهة والخادم معاً.</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
