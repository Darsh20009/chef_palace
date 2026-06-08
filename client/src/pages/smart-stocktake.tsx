import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, ClipboardList, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Loader2, Search, AlertTriangle, TrendingDown, TrendingUp,
  FileCheck, Send
} from "lucide-react";

type SessionStatus = "draft" | "submitted" | "approved" | "rejected";

interface StocktakeItem {
  rawItemId: string;
  rawItemName: string;
  unit: string;
  expectedQty: number;
  actualQty: number;
  difference: number;
  adjustmentReason: string;
  unitCost: number;
  adjustmentValue: number;
}

interface StocktakeSession {
  _id: string;
  id: string;
  branchId: string;
  branchName: string;
  status: SessionStatus;
  items: StocktakeItem[];
  notes: string;
  createdAt: string;
  totalAdjustmentValue: number;
}

const STATUS_MAP: Record<SessionStatus, { label: string; color: string; icon: typeof Clock }> = {
  draft:     { label: "مسودة",   color: "bg-gray-100 text-gray-700",    icon: Clock },
  submitted: { label: "بانتظار الاعتماد", color: "bg-amber-100 text-amber-700",  icon: Clock },
  approved:  { label: "معتمدة",  color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  rejected:  { label: "مرفوضة", color: "bg-red-100 text-red-700",       icon: XCircle },
};

export default function SmartStocktake() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeSession, setActiveSession] = useState<StocktakeSession | null>(null);
  const [counts, setCounts] = useState<Record<string, { actualQty: string; adjustmentReason: string }>>({});
  const [search, setSearch] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);

  const { data: sessions = [], isLoading } = useQuery<StocktakeSession[]>({
    queryKey: ["/api/stocktake"],
    queryFn: async () => {
      const r = await fetch("/api/stocktake", { credentials: "include" });
      return r.json();
    },
  });

  const startMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/stocktake/start", {}),
    onSuccess: async (res: any) => {
      const session = await res.json();
      setActiveSession(session);
      const initCounts: Record<string, { actualQty: string; adjustmentReason: string }> = {};
      for (const it of session.items) {
        initCounts[it.rawItemId] = { actualQty: "", adjustmentReason: "" };
      }
      setCounts(initCounts);
      qc.invalidateQueries({ queryKey: ["/api/stocktake"] });
    },
    onError: () => toast({ title: "فشل إنشاء جلسة الجرد", variant: "destructive" }),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, items }: { id: string; items: any[] }) =>
      apiRequest("PATCH", `/api/stocktake/${id}/items`, { items }),
    onSuccess: async (res: any) => {
      const updated = await res.json();
      setActiveSession(updated);
      toast({ title: "تم حفظ الكميات" });
    },
  });

  const submitMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiRequest("POST", `/api/stocktake/${id}/submit`, { notes }),
    onSuccess: async (res: any) => {
      const updated = await res.json();
      setActiveSession(updated);
      qc.invalidateQueries({ queryKey: ["/api/stocktake"] });
      toast({ title: "تم تقديم جلسة الجرد للاعتماد" });
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/stocktake/${id}/approve`, {}),
    onSuccess: async (res: any) => {
      const updated = await res.json();
      setActiveSession(updated);
      qc.invalidateQueries({ queryKey: ["/api/stocktake"] });
      toast({ title: "تم اعتماد الجرد وتطبيق التعديلات ✓" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/stocktake/${id}/reject`, { reason }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["/api/stocktake"] });
      setRejectDialogOpen(false);
      setActiveSession(null);
      toast({ title: "تم رفض جلسة الجرد" });
    },
  });

  const handleSave = () => {
    if (!activeSession) return;
    const items = Object.entries(counts).map(([rawItemId, v]) => ({
      rawItemId,
      actualQty: parseFloat(v.actualQty) || 0,
      adjustmentReason: v.adjustmentReason,
    }));
    saveMut.mutate({ id: activeSession.id, items });
  };

  const filteredItems = activeSession?.items.filter(it => {
    const matchSearch = it.rawItemName.includes(search) || search === "";
    const matchDiff = !showOnlyDiffs || it.difference !== 0;
    return matchSearch && matchDiff;
  }) ?? [];

  if (activeSession) {
    const isEditable = activeSession.status === "draft";
    const totalDiff = activeSession.items.reduce((s, it) => s + Math.abs(it.difference), 0);
    const negItems = activeSession.items.filter(it => it.difference < 0).length;

    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="container mx-auto p-4 max-w-5xl">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" onClick={() => setActiveSession(null)}>
              <ArrowLeft className="w-4 h-4 ml-2" />رجوع
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">جلسة جرد — {activeSession.branchName}</h1>
              <p className="text-xs text-muted-foreground">{new Date(activeSession.createdAt).toLocaleDateString("ar")}</p>
            </div>
            <Badge className={STATUS_MAP[activeSession.status].color}>
              {STATUS_MAP[activeSession.status].label}
            </Badge>
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{activeSession.items.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي المواد</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className={`text-2xl font-bold ${negItems > 0 ? "text-red-600" : "text-emerald-600"}`}>{negItems}</p>
              <p className="text-xs text-muted-foreground">مواد بعجز</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className={`text-xl font-bold ${(activeSession.totalAdjustmentValue || 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {(activeSession.totalAdjustmentValue || 0).toFixed(0)} ر
              </p>
              <p className="text-xs text-muted-foreground">قيمة التعديل</p>
            </CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pr-9" placeholder="بحث عن مادة..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant={showOnlyDiffs ? "default" : "outline"} size="sm" onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}>
              الفروقات فقط
            </Button>
          </div>

          <ScrollArea className="h-[450px]">
            <div className="space-y-2 pr-1">
              {filteredItems.map(item => {
                const current = counts[item.rawItemId] || { actualQty: item.actualQty > 0 ? String(item.actualQty) : "", adjustmentReason: item.adjustmentReason };
                const actualParsed = parseFloat(current.actualQty) || 0;
                const diff = actualParsed - item.expectedQty;
                return (
                  <Card key={item.rawItemId} className={`${Math.abs(diff) > 0 ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                    <CardContent className="py-3">
                      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.rawItemName}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>متوقع: <b className="text-foreground">{item.expectedQty.toFixed(2)} {item.unit}</b></span>
                            {diff !== 0 && (
                              <span className={`flex items-center gap-0.5 font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {diff > 0 ? "+" : ""}{diff.toFixed(2)} {item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">الفعلي:</span>
                            <Input
                              type="number"
                              className="w-28 h-8 text-sm"
                              placeholder={`0 ${item.unit}`}
                              value={current.actualQty}
                              disabled={!isEditable}
                              onChange={e => setCounts(prev => ({ ...prev, [item.rawItemId]: { ...prev[item.rawItemId], actualQty: e.target.value } }))}
                              data-testid={`input-actual-${item.rawItemId}`}
                            />
                          </div>
                          {Math.abs(diff) > 0 && (
                            <Input
                              className="h-8 text-sm md:w-48"
                              placeholder="سبب الفرق (إلزامي عند الفرق)"
                              value={current.adjustmentReason}
                              disabled={!isEditable}
                              onChange={e => setCounts(prev => ({ ...prev, [item.rawItemId]: { ...prev[item.rawItemId], adjustmentReason: e.target.value } }))}
                              data-testid={`input-reason-${item.rawItemId}`}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          {/* Action bar */}
          {isEditable && (
            <div className="mt-4 space-y-3">
              <Textarea
                placeholder="ملاحظات عامة على الجرد..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={handleSave} disabled={saveMut.isPending}>
                  {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  حفظ الكميات
                </Button>
                <Button className="flex-1 bg-primary" onClick={() => submitMut.mutate({ id: activeSession.id, notes })} disabled={submitMut.isPending}>
                  {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                  تقديم للاعتماد
                </Button>
              </div>
            </div>
          )}

          {activeSession.status === "submitted" && (
            <div className="mt-4 flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveMut.mutate(activeSession.id)} disabled={approveMut.isPending}>
                {approveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <FileCheck className="w-4 h-4 ml-2" />}
                اعتماد وتطبيق التعديلات
              </Button>
              <Button variant="destructive" onClick={() => { setRejectTargetId(activeSession.id); setRejectDialogOpen(true); }}>
                رفض
              </Button>
            </div>
          )}
        </div>

        {/* Reject dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>رفض جلسة الجرد</DialogTitle></DialogHeader>
            <Textarea placeholder="سبب الرفض..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => rejectMut.mutate({ id: rejectTargetId, reason: rejectReason })}>رفض</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/manager/dashboard")}>
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">الجرد الذكي</h1>
            <p className="text-sm text-muted-foreground">مقارنة المتوقع بالفعلي · احتساب الفروقات · اعتماد التعديلات</p>
          </div>
          <Button className="bg-primary gap-2" onClick={() => startMut.mutate()} disabled={startMut.isPending} data-testid="button-start-stocktake">
            {startMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            بدء جرد جديد
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">لا توجد جلسات جرد</p>
              <p className="text-sm text-muted-foreground mb-4">ابدأ جردًا جديدًا لمقارنة المخزون الفعلي بالمتوقع</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const S = STATUS_MAP[session.status];
              const diffItems = session.items?.filter(it => it.difference !== 0).length ?? 0;
              return (
                <Card key={session._id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSession(session)}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{session.branchName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleDateString("ar")} · {session.items?.length ?? 0} مادة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {diffItems > 0 && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            <AlertTriangle className="w-3 h-3 ml-1" />{diffItems} فرق
                          </Badge>
                        )}
                        <Badge className={S.color}>{S.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
