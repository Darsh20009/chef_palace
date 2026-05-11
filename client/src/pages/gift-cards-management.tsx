import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Gift, Plus, Trash2, Copy, CheckCircle, XCircle, Loader2, Search } from "lucide-react";
import SarIcon from "@/components/sar-icon";

interface GiftCard {
  _id: string;
  code: string;
  initialValue: number;
  balance: number;
  recipientName: string;
  recipientPhone: string;
  note: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: tc("نشطة", "Active"),    color: "bg-green-500/20 text-green-400 border-green-800" },
  used:     { label: tc("مستخدمة", "Used"), color: "bg-slate-500/20 text-muted-foreground border-border" },
  expired:  { label: tc("منتهية", "Expired"),  color: "bg-red-500/20 text-red-400 border-red-800" },
  cancelled:{ label: tc("ملغاة", "Cancelled"),   color: "bg-yellow-500/20 text-yellow-400 border-yellow-800" },
};

export default function GiftCardsManagementPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ value: "", recipientName: "", recipientPhone: "", note: "" });
  const [copied, setCopied] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery<GiftCard[]>({
    queryKey: ["/api/gift-cards"],
    queryFn: () => fetch("/api/gift-cards").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/gift-cards", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gift-cards"] });
      setOpen(false);
      setForm({ value: "", recipientName: "", recipientPhone: "", note: "" });
      toast({ title: tc("تم إنشاء بطاقة الهدية بنجاح", "Gift card created successfully") });
    },
    onError: () => toast({ title: tc("فشل إنشاء البطاقة", "Failed to create card"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gift-cards/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gift-cards"] });
      toast({ title: tc("تم حذف البطاقة", "Card deleted") });
    },
  });

  const filteredCards = cards.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.recipientName?.toLowerCase().includes(search.toLowerCase()) ||
    c.recipientPhone?.includes(search)
  );

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const stats = {
    total: cards.length,
    active: cards.filter(c => c.status === "active").length,
    totalValue: cards.reduce((s, c) => s + c.initialValue, 0),
    remaining: cards.reduce((s, c) => s + c.balance, 0),
  };

  return (
    <PlanGate feature="giftCards">
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setLocation("/manager/dashboard")} className="text-muted-foreground hover:text-foreground" data-testid="btn-back">
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gift className="w-7 h-7 text-pink-400" />بطاقات الهدايا
          </h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-600 hover:bg-pink-700 text-foreground" data-testid="btn-add-gift-card">
                <Plus className="w-4 h-4 ml-2" />بطاقة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-foreground">{tc("إنشاء بطاقة هدية جديدة", "Create New Gift Card")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">{tc("قيمة البطاقة", "Card Value")} (<SarIcon />) *</Label>
                  <Input
                    type="number" min="1"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    className="bg-background border-border mt-1"
                    placeholder="مثال: 100"
                    data-testid="input-gift-value"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">{tc("اسم المستفيد", "Recipient Name")}</Label>
                  <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} className="bg-background border-border mt-1" placeholder={tc("اختياري", "Optional")} data-testid="input-recipient-name" />
                </div>
                <div>
                  <Label className="text-muted-foreground">{tc("جوال المستفيد", "Recipient Phone")}</Label>
                  <Input value={form.recipientPhone} onChange={e => setForm(f => ({ ...f, recipientPhone: e.target.value }))} className="bg-background border-border mt-1" placeholder={tc("اختياري", "Optional")} data-testid="input-recipient-phone" />
                </div>
                <div>
                  <Label className="text-muted-foreground">{tc("ملاحظة / مناسبة", "Note / Occasion")}</Label>
                  <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="bg-background border-border mt-1" placeholder="مثال: عيد ميلاد سعيد" data-testid="input-gift-note" />
                </div>
                <Button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.value || createMutation.isPending}
                  className="w-full bg-pink-600 hover:bg-pink-700"
                  data-testid="btn-create-gift-card"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  إنشاء البطاقة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: tc("إجمالي البطاقات", "Total Cards"), value: stats.total, color: "text-foreground" },
            { label: tc("البطاقات النشطة", "Active Cards"), value: stats.active, color: "text-green-400" },
            { label: tc("إجمالي القيمة", "Total Value"), value: `${stats.totalValue.toLocaleString()} ر.س`, color: "text-primary" },
            { label: tc("الرصيد المتبقي", "Remaining Balance"), value: `${stats.remaining.toLocaleString()} ر.س`, color: "text-cyan-400" },
          ].map((s, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-muted-foreground text-xs mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tc("بحث بالكود أو الاسم أو الجوال...", "Search by code, name or phone...")}
            className="bg-background border-border pr-10"
            data-testid="input-search-cards"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-pink-400" /></div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Gift className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>لا توجد بطاقات هدايا</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCards.map(card => {
              const st = STATUS_LABEL[card.status] || { label: card.status, color: "" };
              const usedPct = card.initialValue > 0 ? ((card.initialValue - card.balance) / card.initialValue) * 100 : 0;
              return (
                <Card key={card._id} className="bg-card border-border" data-testid={`card-gift-${card._id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <code className="text-primary font-mono text-sm bg-muted px-2 py-0.5 rounded">{card.code}</code>
                          <button onClick={() => copyCode(card.code)} className="text-muted-foreground hover:text-foreground transition-colors" data-testid={`btn-copy-${card._id}`}>
                            {copied === card.code ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <Badge className={`text-xs border ${st.color}`}>{st.label}</Badge>
                        </div>
                        {card.recipientName && <p className="text-foreground text-sm font-medium">{card.recipientName}</p>}
                        {card.recipientPhone && <p className="text-muted-foreground text-xs">{card.recipientPhone}</p>}
                        {card.note && <p className="text-muted-foreground text-xs italic mt-1">"{card.note}"</p>}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-muted-foreground text-xs">القيمة: <span className="text-foreground font-medium">{card.initialValue} <SarIcon /></span></span>
                          <span className="text-muted-foreground text-xs">المتبقي: <span className="text-green-400 font-medium">{card.balance} <SarIcon /></span></span>
                        </div>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" style={{ width: `${usedPct}%` }} />
                        </div>
                        <p className="text-muted-foreground text-xs mt-1">استُخدم {usedPct.toFixed(0)}%</p>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => deleteMutation.mutate(card._id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                        data-testid={`btn-delete-card-${card._id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </PlanGate>
  );
}
