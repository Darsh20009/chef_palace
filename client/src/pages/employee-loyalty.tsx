import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ChevronRight, Search, Coffee, Gift, Star, Plus, CheckCircle2,
  UserPlus, Coins, Award, Medal, Crown, RefreshCw, Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";

const TIER_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; icon: any }> = {
  bronze:   { labelAr: "برونزي",  labelEn: "Bronze",   color: "text-amber-600 bg-amber-100",   icon: Medal  },
  silver:   { labelAr: "فضي",     labelEn: "Silver",   color: "text-slate-600 bg-slate-100",   icon: Star   },
  gold:     { labelAr: "ذهبي",    labelEn: "Gold",     color: "text-yellow-600 bg-yellow-100", icon: Crown  },
  platinum: { labelAr: "بلاتيني", labelEn: "Platinum", color: "text-gray-600 bg-gray-100",     icon: Award  },
};

function getTier(tier: string) {
  return TIER_CONFIG[tier] || TIER_CONFIG.bronze;
}

export default function EmployeeLoyalty() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [phone, setPhone] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddPointsDialog, setShowAddPointsDialog] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardPhone, setNewCardPhone] = useState("");
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [pointsNote, setPointsNote] = useState("");

  const { data: card, isLoading: lookupLoading, error: lookupError, refetch } = useQuery<any>({
    queryKey: ["/api/loyalty/lookup/phone", searchedPhone],
    queryFn: async () => {
      if (!searchedPhone) return null;
      const cleanPhone = searchedPhone.replace(/\D/g, '').slice(-9);
      const res = await fetch(`/api/loyalty/lookup/phone/${cleanPhone}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(tc("فشل في البحث", "Search failed"));
      return res.json();
    },
    enabled: !!searchedPhone && searchedPhone.replace(/\D/g, '').length >= 9,
    retry: false,
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
  });
  const pointsValueInSar = settings?.pointsValueInSar ?? 0.05;
  const pointsForFreeDrink = settings?.pointsForFreeDrink ?? 500;

  const handleSearch = () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 9) {
      toast({ variant: "destructive", title: tc("رقم الهاتف يجب أن يكون 9 أرقام على الأقل", "Phone number must be at least 9 digits") });
      return;
    }
    setSearchedPhone(phone);
  };

  const invalidateCard = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/loyalty/lookup/phone", searchedPhone] });
    refetch();
  };

  const addStampMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/add-stamp", { phone: searchedPhone });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateCard();
      if (data.earnedFreeCup) {
        toast({ title: tc("تهانينا!", "Congratulations!"), description: tc("حصل العميل على مشروب مجاني!", "Customer earned a free drink!") });
      } else {
        toast({ title: tc("✓ تم إضافة الطابع", "✓ Stamp Added"), description: `${tc("الطوابع:", "Stamps:")} ${data.card?.stamps ?? "-"} / 6` });
      }
    },
    onError: (e: any) => toast({ variant: "destructive", title: tc("خطأ", "Error"), description: e.message }),
  });

  const redeemCupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/redeem-cup", { phone: searchedPhone });
      return res.json();
    },
    onSuccess: () => {
      invalidateCard();
      toast({ title: tc("✓ تم استرداد المشروب المجاني", "✓ Free Drink Redeemed"), description: tc("يمكن للعميل الآن استلام مشروبه", "Customer can now collect their drink") });
    },
    onError: (e: any) => toast({ variant: "destructive", title: tc("خطأ", "Error"), description: e.message }),
  });

  const redeemDrinkWithPointsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/redeem-drink-with-points", { phone: searchedPhone });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateCard();
      toast({ title: tc("✓ تم استرداد المشروب بالنقاط", "✓ Drink Redeemed with Points"), description: `${tc("استُخدمت", "Used")} ${data.pointsUsed} ${tc("نقطة", "points")}` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: tc("خطأ", "Error"), description: e.message }),
  });

  const addPointsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/add-points", {
        phone: searchedPhone, points: Number(pointsToAdd), note: pointsNote
      });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateCard();
      setShowAddPointsDialog(false);
      setPointsToAdd("");
      setPointsNote("");
      toast({ title: `✓ ${tc("تمت إضافة", "Added")} ${pointsToAdd} ${tc("نقطة", "points")}`, description: `${tc("الرصيد الجديد:", "New balance:")} ${data.card?.points ?? "-"} ${tc("نقطة", "points")}` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: tc("خطأ", "Error"), description: e.message }),
  });

  const createCardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/employee/create-card", {
        customerName: newCardName, phoneNumber: newCardPhone
      });
      return res.json();
    },
    onSuccess: () => {
      setShowCreateDialog(false);
      setNewCardName("");
      setNewCardPhone("");
      toast({ title: tc("✓ تم إنشاء البطاقة بنجاح", "✓ Card Created"), description: tc("يمكن البحث عن العميل الآن", "You can now search for the customer") });
    },
    onError: (e: any) => toast({ variant: "destructive", title: tc("خطأ", "Error"), description: e.message }),
  });

  const availableCups = card ? Math.max(0, (card.freeCupsEarned || 0) - (card.freeCupsRedeemed || 0)) : 0;
  const tierCfg = card ? getTier(card.tier || "bronze") : null;
  const TierIcon = tierCfg?.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/employee/home")} data-testid="button-back">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <h1 className="font-black text-lg">{tc("بطاقة الولاء", "Loyalty Card")}</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5" data-testid="button-new-card">
            <UserPlus className="w-4 h-4" />
            {tc("بطاقة جديدة", "New Card")}
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{tc("ابحث عن العميل برقم الجوال", "Search customer by phone number")}</p>
          <div className="flex gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5xxxxxxxx"
              type="tel"
              dir="ltr"
              className="text-lg font-mono h-12"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-phone-search"
            />
            <Button onClick={handleSearch} className="h-12 px-5 gap-2" disabled={lookupLoading} data-testid="button-search">
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {tc("بحث", "Search")}
            </Button>
          </div>
        </div>

        {searchedPhone && !lookupLoading && (
          <>
            {lookupError || card === null ? (
              <div className="bg-card border rounded-2xl p-8 text-center space-y-3">
                <Search className="w-12 h-12 mx-auto text-muted-foreground opacity-30" />
                <p className="font-bold text-muted-foreground">{tc("لا توجد بطاقة بهذا الرقم", "No card found for this number")}</p>
                <p className="text-sm text-muted-foreground">{searchedPhone}</p>
                <Button
                  variant="outline"
                  onClick={() => { setNewCardPhone(searchedPhone); setShowCreateDialog(true); }}
                  className="gap-2"
                  data-testid="button-create-for-phone"
                >
                  <UserPlus className="w-4 h-4" />
                  {tc("إنشاء بطاقة لهذا الرقم", "Create card for this number")}
                </Button>
              </div>
            ) : card ? (
              <div className="space-y-4">
                <div className="bg-card border rounded-2xl overflow-hidden" data-testid="card-found">
                  <div className="bg-primary/5 border-b px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-black text-lg">{card.customerName || tc("عميل", "Customer")}</p>
                      <p className="text-sm text-muted-foreground font-mono">{card.phoneNumber}</p>
                    </div>
                    {tierCfg && TierIcon && (
                      <Badge className={`gap-1.5 ${tierCfg.color} border-none`} data-testid="badge-tier">
                        <TierIcon className="w-3.5 h-3.5" />
                        {tc(tierCfg.labelAr, tierCfg.labelEn)}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-x-reverse">
                    <div className="p-4 text-center">
                      <p className="text-2xl font-black text-primary" data-testid="text-points">{(card.points || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tc("نقطة", "Points")}</p>
                      <p className="text-[10px] text-muted-foreground">{((card.points || 0) * pointsValueInSar).toFixed(2)} <SarIcon size={10} /></p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-black text-amber-600" data-testid="text-stamps">{card.stamps || 0} / 6</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tc("طوابع", "Stamps")}</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className={`text-2xl font-black ${availableCups > 0 ? "text-green-600" : "text-muted-foreground"}`} data-testid="text-free-cups">
                        {availableCups}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tc("مجاني متاح", "Free available")}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border rounded-2xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">{tc("طوابع المشروبات (6 طوابع = مشروب مجاني)", "Drink stamps (6 stamps = free drink)")}</p>
                  <div className="flex gap-2 justify-center">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                          i < (card.stamps || 0)
                            ? "bg-primary border-primary text-white"
                            : "border-muted-foreground/30 text-muted-foreground/30"
                        }`}
                      >
                        <Coffee className="w-5 h-5" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => addStampMutation.mutate()}
                    disabled={addStampMutation.isPending}
                    className="h-14 gap-2 flex-col text-sm font-bold"
                    data-testid="button-add-stamp"
                  >
                    {addStampMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Coffee className="w-5 h-5" />}
                    {tc("إضافة طابع", "Add Stamp")}
                  </Button>

                  <Button
                    onClick={() => setShowAddPointsDialog(true)}
                    variant="outline"
                    className="h-14 gap-2 flex-col text-sm font-bold border-primary/40"
                    data-testid="button-add-points"
                  >
                    <Coins className="w-5 h-5 text-primary" />
                    {tc("إضافة نقاط", "Add Points")}
                  </Button>

                  <Button
                    onClick={() => redeemCupMutation.mutate()}
                    disabled={redeemCupMutation.isPending || availableCups <= 0}
                    variant={availableCups > 0 ? "default" : "outline"}
                    className={`h-14 gap-2 flex-col text-sm font-bold col-span-2 ${availableCups > 0 ? "bg-green-600 hover:bg-green-700" : ""}`}
                    data-testid="button-redeem-cup"
                  >
                    {redeemCupMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
                    {availableCups > 0
                      ? `${tc("استرداد مشروب مجاني", "Redeem Free Drink")} (${availableCups} ${tc("متاح", "available")})`
                      : tc("لا يوجد مشروب مجاني", "No Free Drink Available")}
                  </Button>

                  {(() => {
                    const currentPoints = card?.points || 0;
                    const canRedeemWithPoints = currentPoints >= pointsForFreeDrink;
                    return (
                      <Button
                        onClick={() => redeemDrinkWithPointsMutation.mutate()}
                        disabled={redeemDrinkWithPointsMutation.isPending || !canRedeemWithPoints}
                        variant={canRedeemWithPoints ? "default" : "outline"}
                        className={`h-14 gap-2 flex-col text-sm font-bold col-span-2 ${canRedeemWithPoints ? "bg-primary/90 hover:bg-primary" : ""}`}
                        data-testid="button-redeem-drink-points"
                      >
                        {redeemDrinkWithPointsMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                        {canRedeemWithPoints
                          ? `${tc("استرداد مشروب بالنقاط", "Redeem Drink with Points")} (${currentPoints.toLocaleString()} / ${pointsForFreeDrink.toLocaleString()})`
                          : `${tc("يحتاج", "Needs")} ${pointsForFreeDrink.toLocaleString()} ${tc("نقطة", "pts")} (${tc("لديه", "has")} ${currentPoints.toLocaleString()})`}
                      </Button>
                    );
                  })()}
                </div>

                <p className="text-center text-xs text-muted-foreground font-mono" data-testid="text-card-number">
                  {card.cardNumber}
                </p>
              </div>
            ) : null}
          </>
        )}

        {!searchedPhone && (
          <div className="text-center py-16 space-y-3">
            <Search className="w-16 h-16 mx-auto text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">{tc("ابحث عن رقم جوال العميل للبدء", "Search customer's phone number to begin")}</p>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-create-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {tc("إنشاء بطاقة ولاء جديدة", "Create New Loyalty Card")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tc("اسم العميل", "Customer Name")}</Label>
              <Input
                value={newCardName}
                onChange={(e) => setNewCardName(e.target.value)}
                placeholder={tc("محمد أحمد", "Mohammed Ahmed")}
                data-testid="input-new-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("رقم الجوال (9 أرقام)", "Phone Number (9 digits)")}</Label>
              <Input
                value={newCardPhone}
                onChange={(e) => setNewCardPhone(e.target.value)}
                placeholder="5xxxxxxxx"
                type="tel"
                dir="ltr"
                data-testid="input-new-phone"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => createCardMutation.mutate()}
              disabled={createCardMutation.isPending || !newCardPhone}
              data-testid="button-confirm-create"
            >
              {createCardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              {tc("إنشاء البطاقة", "Create Card")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddPointsDialog} onOpenChange={setShowAddPointsDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-add-points">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              {tc("إضافة نقاط يدوياً", "Add Points Manually")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tc("عدد النقاط", "Number of Points")}</Label>
              <Input
                value={pointsToAdd}
                onChange={(e) => setPointsToAdd(e.target.value)}
                type="number"
                min="1"
                placeholder="100"
                data-testid="input-points-amount"
              />
              {pointsToAdd && Number(pointsToAdd) > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {(Number(pointsToAdd) * pointsValueInSar).toFixed(2)} {tc("ريال قيمة خصم", "SAR discount value")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tc("ملاحظة (اختياري)", "Note (optional)")}</Label>
              <Input
                value={pointsNote}
                onChange={(e) => setPointsNote(e.target.value)}
                placeholder={tc("سبب الإضافة...", "Reason for adding...")}
                data-testid="input-points-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddPointsDialog(false)} data-testid="button-cancel-points">{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => addPointsMutation.mutate()}
              disabled={addPointsMutation.isPending || !pointsToAdd || Number(pointsToAdd) <= 0}
              data-testid="button-confirm-points"
            >
              {addPointsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              {tc("إضافة النقاط", "Add Points")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileBottomNav />
    </div>
  );
}
