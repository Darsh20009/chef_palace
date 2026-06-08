import { useState, useEffect } from "react";
import { PlanGate } from "@/components/plan-gate";
import SarIcon from "@/components/sar-icon";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronRight, Gift, Users, Coins, Coffee, Star, Crown,
  Award, Medal, Search, Settings, TrendingUp, Loader2, Save,
  Plus, Minus, History, UserPlus, Download, Phone, Eye,
  ArrowUp, ArrowDown, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const TIER_CONFIG: Record<string, { label: string; color: string; icon: any; min: number }> = {
  bronze:   { label: "برونزي",  color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Medal,  min: 0    },
  silver:   { label: "فضي",     color: "bg-slate-100 text-slate-700 border-slate-200",   icon: Star,   min: 500  },
  gold:     { label: "ذهبي",    color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Crown,  min: 2000 },
  platinum: { label: "بلاتيني", color: "bg-gray-100 text-gray-700 border-gray-200",     icon: Award,  min: 5000 },
};

function getTierBadge(tier: string) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const Icon = cfg.icon;
  return (
    <Badge className={`gap-1 border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

export default function LoyaltyProgram() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs state
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [newCardPhone, setNewCardPhone] = useState("");

  // All loyalty cards (for manager)
  const { data: cards = [], isLoading: cardsLoading } = useQuery<any[]>({
    queryKey: ["/api/loyalty/cards"],
  });

  // Loyalty settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
  });

  // Transaction history for selected card
  const { data: transactions = [], isLoading: txLoading } = useQuery<any[]>({
    queryKey: ["/api/loyalty/cards", selectedCard?.id || selectedCard?._id, "transactions"],
    queryFn: async () => {
      const id = selectedCard?.id || selectedCard?._id;
      if (!id) return [];
      const res = await fetch(`/api/loyalty/cards/${id}/transactions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCard && isHistoryOpen,
  });

  // Settings form state
  const [pointsEarnedPerSar, setPointsEarnedPerSar] = useState<string>("");
  const [pointsValueInSar, setPointsValueInSar] = useState<string>("");
  const [pointsForFreeDrink, setPointsForFreeDrink] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setPointsEarnedPerSar(String(settings.pointsEarnedPerSar ?? 1));
      setPointsValueInSar(String(settings.pointsValueInSar ?? 0.05));
      setPointsForFreeDrink(String(settings.pointsForFreeDrink ?? 500));
    }
  }, [settings]);

  // Save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/config", {
        loyaltyConfig: {
          enabled: true,
          pointsEarnedPerSar: Number(pointsEarnedPerSar),
          pointsValueInSar: Number(pointsValueInSar),
          pointsForFreeDrink: Number(pointsForFreeDrink),
          pointsPerSar: Number(pointsEarnedPerSar) ? Math.round(1 / Number(pointsEarnedPerSar)) : 20,
          pointsPerDrink: 10,
          minPointsForRedemption: 100,
          redemptionRate: 100,
        }
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/loyalty-settings"] });
      toast({ title: "✓ تم حفظ الإعدادات" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  // Adjust points
  const adjustMutation = useMutation({
    mutationFn: async ({ cardId, adjustment }: { cardId: string; adjustment: number }) => {
      return apiRequest("PATCH", `/api/loyalty/cards/${cardId}/adjust`, { adjustment, reason: adjustReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/cards"] });
      setIsAdjustOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
      toast({ title: "✓ تم تعديل النقاط بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  // Create card
  const createCardMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/loyalty/manager/create-card", {
        customerName: newCardName,
        phoneNumber: newCardPhone,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/cards"] });
      setIsCreateOpen(false);
      setNewCardName("");
      setNewCardPhone("");
      toast({ title: "✓ تم إنشاء البطاقة بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message }),
  });

  // Stats
  const totalMembers = cards.length;
  const totalPoints = cards.reduce((sum, c) => sum + (c.points || 0), 0);
  const totalFreeCupsRedeemed = cards.reduce((sum, c) => sum + (c.freeCupsRedeemed || 0), 0);
  const activeCards = cards.filter(c => c.isActive !== false && c.status !== 'cancelled').length;

  // Tier distribution
  const tierCounts = cards.reduce((acc, c) => {
    const tier = c.tier || 'bronze';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter by search
  const filtered = cards.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      (c.customerName || "").toLowerCase().includes(q) ||
      (c.phoneNumber || "").includes(q) ||
      (c.cardNumber || "").toLowerCase().includes(q)
    );
  });

  // Export CSV
  const exportCSV = () => {
    const headers = ["الاسم", "رقم الجوال", "النقاط", "الطوابع", "المستوى", "المشروبات المجانية", "تاريخ الإنشاء"];
    const rows = cards.map(c => [
      c.customerName || "",
      c.phoneNumber || "",
      c.points || 0,
      c.stamps || 0,
      TIER_CONFIG[c.tier || "bronze"]?.label || "برونزي",
      c.freeCupsRedeemed || 0,
      c.createdAt ? format(new Date(c.createdAt), "yyyy-MM-dd") : "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loyalty-members-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PlanGate feature="loyaltyProgram">
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="button-back">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Gift className="w-5 h-5 text-primary" />
            <h1 className="font-black text-xl">{tc("برنامج الولاء", "Loyalty Program")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-2" data-testid="button-export-csv">
              <Download className="w-4 h-4" />
              {tc("تصدير CSV", "Export CSV")}
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2" data-testid="button-create-card">
              <UserPlus className="w-4 h-4" />
              {tc("بطاقة جديدة", "New Card")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card data-testid="stat-members">
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-black">{totalMembers}</p>
              <p className="text-xs text-muted-foreground">{tc("إجمالي الأعضاء", "Total Members")}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-active">
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-green-600">{activeCards}</p>
              <p className="text-xs text-muted-foreground">{tc("بطاقات نشطة", "Active Cards")}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-points">
            <CardContent className="pt-4 pb-4 text-center">
              <Coins className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-amber-600">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{tc("مجموع النقاط", "Total Points")}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-redeemed">
            <CardContent className="pt-4 pb-4 text-center">
              <Coffee className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-black text-purple-600">{totalFreeCupsRedeemed}</p>
              <p className="text-xs text-muted-foreground">{tc("مشروبات مجانية", "Free Drinks")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tier distribution */}
        {totalMembers > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
              const count = tierCounts[key] || 0;
              const Icon = cfg.icon;
              return (
                <div key={key} className={`rounded-xl p-3 text-center border ${cfg.color}`} data-testid={`tier-stat-${key}`}>
                  <Icon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xl font-black">{count}</p>
                  <p className="text-xs font-medium">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        )}

        <Tabs defaultValue="members">
          <TabsList className="w-full">
            <TabsTrigger value="members" className="flex-1 gap-2">
              <Users className="w-4 h-4" />
              {tc("الأعضاء", "Members")} ({totalMembers})
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-2">
              <Settings className="w-4 h-4" />
              {tc("الإعدادات", "Settings")}
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الجوال أو رقم البطاقة..."
                className="pr-9"
                data-testid="input-search-members"
              />
            </div>

            {cardsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Users className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                <p className="text-muted-foreground">
                  {searchTerm ? "لا توجد نتائج" : "لا توجد بطاقات ولاء بعد"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    إنشاء أول بطاقة
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((card, i) => (
                  <div
                    key={card.id || card._id || i}
                    className="bg-card border rounded-xl px-4 py-3"
                    data-testid={`member-${i}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-sm">
                            {(card.customerName || "ع").charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">{card.customerName || "عميل"}</p>
                          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {card.phoneNumber}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {card.createdAt ? format(new Date(card.createdAt), "dd MMM yyyy", { locale: ar }) : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {getTierBadge(card.tier || "bronze")}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-primary">{(card.points || 0).toLocaleString()} نقطة</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-amber-600">{card.stamps || 0}/6 طابع</span>
                        </div>
                        {card.isActive === false || card.status === 'cancelled' ? (
                          <Badge variant="secondary" className="text-[10px]">معطّلة</Badge>
                        ) : null}
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 px-2"
                            onClick={() => { setSelectedCard(card); setIsHistoryOpen(true); }}
                            data-testid={`button-history-${i}`}
                          >
                            <History className="w-3 h-3" />
                            السجل
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 px-2 text-primary border-primary/30"
                            onClick={() => { setSelectedCard(card); setAdjustAmount(""); setAdjustReason(""); setIsAdjustOpen(true); }}
                            data-testid={`button-adjust-${i}`}
                          >
                            <Coins className="w-3 h-3" />
                            تعديل
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-center text-xs text-muted-foreground pt-2">
                  {filtered.length} من {totalMembers} عضو
                </p>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  إعدادات نظام النقاط
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-bold">نقاط لكل ريال ينفقه العميل</Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={pointsEarnedPerSar}
                          onChange={(e) => setPointsEarnedPerSar(e.target.value)}
                          data-testid="input-points-per-sar"
                        />
                        <p className="text-xs text-muted-foreground">مثال: 1 = نقطة واحدة لكل ريال</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold">قيمة النقطة بالريال</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={pointsValueInSar}
                          onChange={(e) => setPointsValueInSar(e.target.value)}
                          data-testid="input-points-value"
                        />
                        <p className="text-xs text-muted-foreground">مثال: 0.05 = 20 نقطة = ريال واحد</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold">نقاط للحصول على مشروب مجاني</Label>
                        <Input
                          type="number"
                          min="1"
                          value={pointsForFreeDrink}
                          onChange={(e) => setPointsForFreeDrink(e.target.value)}
                          data-testid="input-points-free-drink"
                        />
                        <p className="text-xs text-muted-foreground">عدد النقاط اللازمة للحصول على مشروب مجاني</p>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-sm">معاينة الإعدادات</p>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>• العميل الذي ينفق <span className="font-bold text-foreground">100 <SarIcon size={11} /></span> يكسب <span className="font-bold text-primary">{(100 * Number(pointsEarnedPerSar || 1)).toFixed(0)} نقطة</span></p>
                        <p>• <span className="font-bold text-foreground">100 نقطة</span> = <span className="font-bold text-primary">{(100 * Number(pointsValueInSar || 0.05)).toFixed(2)} <SarIcon size={11} /></span> خصم</p>
                        <p>• المشروب المجاني يتطلب <span className="font-bold text-foreground">{pointsForFreeDrink} نقطة</span></p>
                      </div>
                    </div>

                    {/* Tier thresholds info */}
                    <div className="border rounded-xl overflow-hidden">
                      <div className="bg-muted px-4 py-2 text-xs font-bold text-muted-foreground">مستويات العضوية (ثابتة)</div>
                      <div className="divide-y">
                        {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          return (
                            <div key={key} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-full border ${cfg.color}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-medium text-sm">{cfg.label}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {cfg.min === 0 ? "الانطلاق" : `${cfg.min.toLocaleString()}+ نقطة`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      onClick={() => saveSettingsMutation.mutate()}
                      disabled={saveSettingsMutation.isPending}
                      className="w-full gap-2"
                      data-testid="button-save-settings"
                    >
                      {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      حفظ الإعدادات
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Adjust Points Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              تعديل نقاط العميل
            </DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3 text-sm">
                <p className="font-bold">{selectedCard.customerName || "عميل"}</p>
                <p className="text-muted-foreground font-mono">{selectedCard.phoneNumber}</p>
                <p className="text-primary font-black mt-1">{(selectedCard.points || 0).toLocaleString()} نقطة حالية</p>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">قيمة التعديل</Label>
                <p className="text-xs text-muted-foreground">أدخل عدداً موجباً للإضافة، أو سالباً للخصم</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-200 gap-1"
                    onClick={() => setAdjustAmount(String(Math.abs(Number(adjustAmount) || 0)))}
                    data-testid="button-positive"
                  >
                    <ArrowUp className="w-3 h-3" /> إضافة
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 gap-1"
                    onClick={() => setAdjustAmount(String(-Math.abs(Number(adjustAmount) || 0)))}
                    data-testid="button-negative"
                  >
                    <ArrowDown className="w-3 h-3" /> خصم
                  </Button>
                </div>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="مثال: 50 أو -100"
                  data-testid="input-adjust-amount"
                />
                {adjustAmount && (
                  <p className="text-xs font-medium">
                    النقاط الجديدة: <span className="text-primary font-black">{Math.max(0, (selectedCard.points || 0) + Number(adjustAmount)).toLocaleString()}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="font-bold">السبب (اختياري)</Label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="مثال: تعويض خطأ، مكافأة خاصة..."
                  data-testid="input-adjust-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                const id = selectedCard?.id || selectedCard?._id;
                if (!id || !adjustAmount) return;
                adjustMutation.mutate({ cardId: id, adjustment: Number(adjustAmount) });
              }}
              disabled={adjustMutation.isPending || !adjustAmount || Number(adjustAmount) === 0}
              className="gap-2"
              data-testid="button-confirm-adjust"
            >
              {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
              تأكيد التعديل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              سجل معاملات {selectedCard?.customerName || "العميل"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {txLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>لا توجد معاملات بعد</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">النقاط</TableHead>
                    <TableHead className="text-right">الرصيد بعد</TableHead>
                    <TableHead className="text-right">ملاحظة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: any, i: number) => (
                    <TableRow key={tx.id || tx._id || i}>
                      <TableCell className="text-sm">
                        {tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yyyy HH:mm", { locale: ar }) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.type === 'earned' ? 'default' : 'secondary'} className="text-xs">
                          {tx.type === 'earned' ? 'اكتساب' : tx.type === 'redeemed' ? 'استرداد' : tx.type === 'adjusted' ? 'تعديل' : tx.type || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-bold text-sm ${(tx.points || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(tx.points || 0) > 0 ? '+' : ''}{(tx.points || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{(tx.balanceAfter || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tx.notes || tx.reason || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Card Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              إنشاء بطاقة ولاء جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">اسم العميل</Label>
              <Input
                value={newCardName}
                onChange={(e) => setNewCardName(e.target.value)}
                placeholder="محمد العمري"
                data-testid="input-new-card-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">رقم الجوال <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground font-mono">+966</span>
                <Input
                  value={newCardPhone}
                  onChange={(e) => setNewCardPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="5xxxxxxxx"
                  className="font-mono"
                  data-testid="input-new-card-phone"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createCardMutation.mutate()}
              disabled={createCardMutation.isPending || newCardPhone.length < 9}
              className="gap-2"
              data-testid="button-confirm-create-card"
            >
              {createCardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              إنشاء البطاقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PlanGate>
  );
}
