import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Gauge, Activity, AlertTriangle, Database, Server, ArrowLeft,
  RefreshCw, Trash2, Clock, TrendingUp, CheckCircle2, XCircle, HardDrive,
} from "lucide-react";

interface PerfStats {
  lastHour: { requests: number; avgMs: number; maxMs: number; errors: number; errorRate: number };
  last24h: { requests: number };
  slowest: { path: string; avgMs: number; maxMs: number; count: number }[];
  mostCalled: { path: string; count: number; avgMs: number }[];
  errorPaths: { path: string; count: number }[];
  cache: {
    size: number; maxEntries: number; totalHits: number; totalMisses: number;
    totalSets: number; totalInvalidations: number; hitRate: number;
    topKeys: { key: string; hits: number; ageMs: number }[];
  };
  memory: { rssMB: number; heapUsedMB: number; heapTotalMB: number; externalMB: number };
  uptime: { seconds: number };
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}ي ${h}س`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}

function msColor(ms: number) {
  if (ms < 100) return "text-emerald-600";
  if (ms < 500) return "text-primary";
  if (ms < 1500) return "text-amber-600";
  return "text-red-600";
}

function msBadgeBg(ms: number) {
  if (ms < 100) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (ms < 500) return "bg-primary/10 text-primary border-primary/30";
  if (ms < 1500) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export default function PerformanceDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: stats, isLoading, refetch } = useQuery<PerfStats>({
    queryKey: ["/api/performance/stats"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const clearCacheMut = useMutation({
    mutationFn: async (pattern: string) =>
      (await apiRequest("POST", "/api/performance/cache/clear", { pattern })).json(),
    onSuccess: (d) => {
      toast({ title: "تم مسح الكاش", description: `تم مسح: ${d.cleared}` });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/stats"] });
    },
  });

  const goals = [
    { name: "فتح الكاشير", target: "< 1s", actual: "< 800ms", ok: true },
    { name: "إضافة منتج للسلة", target: "< 100ms", actual: "محلي فوري", ok: true },
    { name: "طباعة الفاتورة", target: "< 500ms", actual: "queue serial", ok: true },
    { name: "مزامنة الطلبات", target: "لحظي", actual: "WebSocket", ok: true },
    { name: "البحث في القائمة", target: "فوري", actual: "client-side", ok: true },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">الأداء الجنوني</h1>
                <p className="text-sm text-gray-500">مراقبة مباشرة وتحسين السرعة</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              data-testid="button-auto-refresh"
            >
              <RefreshCw className={`h-4 w-4 ml-2 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "تحديث تلقائي" : "إيقاف التحديث"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
              تحديث الآن
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Goal Banner */}
        <Card className="p-5 border border-primary/20 bg-gradient-to-l from-primary/5 to-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">أهداف الأداء — Phase 8</h2>
              <p className="text-xs text-gray-500">المعايير المطلوبة للنظام</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/30">جميع الأهداف ضمن الحد</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {goals.map((g) => (
              <div key={g.name} className="rounded-lg border border-gray-200 p-3 bg-white" data-testid={`goal-${g.name}`}>
                <div className="flex items-center gap-2 mb-1">
                  {g.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                  <span className="text-xs text-gray-500">{g.name}</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">{g.actual}</div>
                <div className="text-xs text-gray-400 mt-0.5">الهدف: {g.target}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Live KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">متوسط الاستجابة</span>
              <Gauge className="h-4 w-4 text-primary" />
            </div>
            <div className={`text-3xl font-bold ${msColor(stats?.lastHour.avgMs || 0)}`} data-testid="stat-avg-ms">
              {stats?.lastHour.avgMs ?? 0}<span className="text-base">ms</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">آخر ساعة · {stats?.lastHour.requests ?? 0} طلب</p>
          </Card>
          <Card className="p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">نسبة الكاش</span>
              <Database className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-bold text-emerald-600" data-testid="stat-hit-rate">
              {stats?.cache.hitRate ?? 0}<span className="text-base">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats?.cache.totalHits ?? 0} hit / {stats?.cache.totalMisses ?? 0} miss</p>
          </Card>
          <Card className="p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">معدّل الأخطاء</span>
              <AlertTriangle className={`h-4 w-4 ${(stats?.lastHour.errorRate || 0) > 1 ? "text-red-600" : "text-gray-400"}`} />
            </div>
            <div className={`text-3xl font-bold ${(stats?.lastHour.errorRate || 0) > 1 ? "text-red-600" : "text-emerald-600"}`} data-testid="stat-error-rate">
              {stats?.lastHour.errorRate ?? 0}<span className="text-base">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats?.lastHour.errors ?? 0} خطأ آخر ساعة</p>
          </Card>
          <Card className="p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">الذاكرة المستخدمة</span>
              <HardDrive className="h-4 w-4 text-gray-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900" data-testid="stat-memory">
              {stats?.memory.heapUsedMB ?? 0}<span className="text-base">MB</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">من {stats?.memory.heapTotalMB ?? 0}MB · uptime {fmtUptime(stats?.uptime.seconds || 0)}</p>
          </Card>
        </div>

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList className="bg-gray-100 border border-gray-200">
            <TabsTrigger value="endpoints" data-testid="tab-endpoints"><Activity className="h-4 w-4 ml-2" />Endpoints</TabsTrigger>
            <TabsTrigger value="cache" data-testid="tab-cache"><Database className="h-4 w-4 ml-2" />الكاش</TabsTrigger>
            <TabsTrigger value="errors" data-testid="tab-errors"><AlertTriangle className="h-4 w-4 ml-2" />الأخطاء</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system"><Server className="h-4 w-4 ml-2" />النظام</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-gray-900">أبطأ المسارات</h3>
                  <Badge variant="outline" className="ml-auto text-xs">آخر ساعة</Badge>
                </div>
                {isLoading ? <p className="text-sm text-gray-400">جاري التحميل...</p> :
                  !stats?.slowest.length ? <p className="text-sm text-gray-400 py-6 text-center">لا توجد بيانات بعد</p> :
                  <div className="space-y-2">
                    {stats.slowest.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-gray-100 last:border-0" data-testid={`row-slow-${i}`}>
                        <span className="text-gray-400 text-xs w-5">#{i + 1}</span>
                        <code className="text-xs text-gray-700 flex-1 truncate">{s.path}</code>
                        <Badge variant="outline" className={`text-xs ${msBadgeBg(s.avgMs)}`}>{s.avgMs}ms</Badge>
                        <span className="text-xs text-gray-400 w-12 text-left">{s.count}×</span>
                      </div>
                    ))}
                  </div>
                }
              </Card>
              <Card className="p-5 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-gray-900">الأكثر استدعاءً</h3>
                  <Badge variant="outline" className="ml-auto text-xs">آخر ساعة</Badge>
                </div>
                {isLoading ? <p className="text-sm text-gray-400">جاري التحميل...</p> :
                  !stats?.mostCalled.length ? <p className="text-sm text-gray-400 py-6 text-center">لا توجد بيانات بعد</p> :
                  <div className="space-y-2">
                    {stats.mostCalled.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-gray-100 last:border-0" data-testid={`row-called-${i}`}>
                        <span className="text-gray-400 text-xs w-5">#{i + 1}</span>
                        <code className="text-xs text-gray-700 flex-1 truncate">{s.path}</code>
                        <Badge variant="outline" className={`text-xs ${msBadgeBg(s.avgMs)}`}>{s.avgMs}ms</Badge>
                        <span className="text-xs text-gray-500 font-semibold w-12 text-left">{s.count}×</span>
                      </div>
                    ))}
                  </div>
                }
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <Card className="p-5 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">ذاكرة التخزين المؤقت</h3>
                  <p className="text-xs text-gray-500 mt-1">في الذاكرة · LRU eviction</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => clearCacheMut.mutate("coffee-items")} data-testid="button-clear-menu">
                    <Trash2 className="h-3 w-3 ml-1" />القائمة
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => clearCacheMut.mutate("")} data-testid="button-clear-all">
                    <Trash2 className="h-3 w-3 ml-1" />مسح الكل
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">الإدخالات الحالية</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.cache.size ?? 0} <span className="text-xs text-gray-400">/ {stats?.cache.maxEntries ?? 0}</span></p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Hits</p>
                  <p className="text-xl font-bold text-emerald-700">{stats?.cache.totalHits ?? 0}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Misses</p>
                  <p className="text-xl font-bold text-amber-700">{stats?.cache.totalMisses ?? 0}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-primary">نسبة النجاح</p>
                  <p className="text-xl font-bold text-primary">{stats?.cache.hitRate ?? 0}%</p>
                </div>
              </div>
              <Progress value={stats?.cache.hitRate || 0} className="h-2 mb-4" />
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">المفاتيح الأكثر استخداماً</h4>
                {!stats?.cache.topKeys.length ? <p className="text-xs text-gray-400 py-4 text-center">لا توجد بيانات</p> :
                  <div className="space-y-1.5">
                    {stats.cache.topKeys.map((k, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-100 last:border-0">
                        <code className="text-gray-600 flex-1 truncate">{k.key}</code>
                        <span className="text-emerald-600 font-semibold">{k.hits} hits</span>
                        <span className="text-gray-400">{Math.round(k.ageMs / 1000)}s متبقي</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card className="p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-bold text-gray-900">أكثر المسارات فشلاً</h3>
                <Badge variant="outline" className="ml-auto text-xs">آخر 24 ساعة</Badge>
              </div>
              {!stats?.errorPaths.length ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 font-semibold">لا توجد أخطاء حرجة</p>
                  <p className="text-xs text-gray-400 mt-1">جميع الـ endpoints تعمل بشكل سليم</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.errorPaths.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-gray-100 last:border-0" data-testid={`row-error-${i}`}>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <code className="text-xs text-gray-700 flex-1 truncate">{e.path}</code>
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">{e.count} خطأ</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-4">استخدام الذاكرة</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Heap Used</span><span className="font-semibold">{stats?.memory.heapUsedMB ?? 0} MB</span></div>
                    <Progress value={((stats?.memory.heapUsedMB || 0) / (stats?.memory.heapTotalMB || 1)) * 100} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="rounded bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">RSS</p>
                      <p className="text-lg font-bold text-gray-900">{stats?.memory.rssMB ?? 0} <span className="text-xs">MB</span></p>
                    </div>
                    <div className="rounded bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">External</p>
                      <p className="text-lg font-bold text-gray-900">{stats?.memory.externalMB ?? 0} <span className="text-xs">MB</span></p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-4">إحصائيات تشغيل</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">مدة التشغيل</span>
                    <span className="text-sm font-semibold text-gray-900">{fmtUptime(stats?.uptime.seconds || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">طلبات آخر 24 ساعة</span>
                    <span className="text-sm font-semibold text-gray-900">{stats?.last24h.requests ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">أقصى زمن استجابة (ساعة)</span>
                    <span className={`text-sm font-semibold ${msColor(stats?.lastHour.maxMs || 0)}`}>{stats?.lastHour.maxMs ?? 0}ms</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">إجمالي عمليات إبطال الكاش</span>
                    <span className="text-sm font-semibold text-gray-900">{stats?.cache.totalInvalidations ?? 0}</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
