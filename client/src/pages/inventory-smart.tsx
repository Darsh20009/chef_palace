import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate, tc } from "@/lib/useTranslate";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import SarIcon from "@/components/sar-icon";
import {
  Plus,
  Minus,
  Package,
  Search,
  Loader2,
  Coffee,
  Box,
  Wrench,
  Droplet,
  HelpCircle,
  AlertTriangle,
  TrendingDown,
  PackagePlus,
  Layers,
  BarChart3,
  Users,
  ShoppingCart,
  ArrowRightLeft,
  Bell,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Boxes,
  Warehouse,
  ChevronRight,
  Activity,
} from "lucide-react";

// ─── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CFG: Record<string, { labelAr: string; Icon: any; accent: string }> = {
  ingredient: { labelAr: "مكون أساسي", Icon: Coffee,    accent: "text-green-600" },
  packaging:  { labelAr: "تغليف",      Icon: Box,       accent: "text-blue-600"  },
  equipment:  { labelAr: "معدات",      Icon: Wrench,    accent: "text-orange-500"},
  consumable: { labelAr: "مستهلكات",  Icon: Droplet,   accent: "text-purple-600"},
  other:      { labelAr: "أخرى",       Icon: HelpCircle,accent: "text-gray-500"  },
};

const UNIT_LABELS: Record<string, string> = {
  kg: "كغ", g: "جرام", liter: "لتر", ml: "مل", piece: "قطعة", box: "صندوق", bag: "كيس",
};

const NAV_LINKS = [
  { href: "/manager/inventory/raw-items",  Icon: Coffee,       label: "المواد الخام",  desc: "إدارة المواد" },
  { href: "/manager/inventory/stock",      Icon: Boxes,        label: "مستوى المخزون",desc: "الكميات الحالية" },
  { href: "/manager/inventory/recipes",    Icon: BookOpen,     label: "الوصفات",       desc: "وصفات المنتجات" },
  { href: "/manager/inventory/suppliers",  Icon: Users,        label: "الموردين",      desc: "إدارة الموردين" },
  { href: "/manager/inventory/purchases",  Icon: ShoppingCart, label: "المشتريات",    desc: "أوامر الشراء" },
  { href: "/manager/inventory/transfers",  Icon: ArrowRightLeft,label:"التحويلات",    desc: "بين الفروع" },
  { href: "/manager/inventory/alerts",     Icon: Bell,         label: "التنبيهات",    desc: "تنبيهات المخزون", danger: true },
];

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface RawItem {
  id: string; code: string; nameAr: string; nameEn?: string;
  category: string; unit: string; unitCost: number;
  minStockLevel: number; maxStockLevel?: number; isActive: number;
}
interface BranchStock {
  id: string; branchId: string; rawItemId: string;
  currentQuantity: number; reservedQuantity: number; lastUpdated: string;
  rawItem?: RawItem;
}
interface Branch { id?: string; nameAr: string; }

// ─── Status helper ─────────────────────────────────────────────────────────────
function getStatus(item: RawItem, stock?: BranchStock) {
  const qty  = stock?.currentQuantity ?? 0;
  const min  = item.minStockLevel ?? 0;
  const max  = item.maxStockLevel ?? (min * 3 || 100);
  const pct  = max > 0 ? Math.min(100, (qty / max) * 100) : 0;
  if (qty <= 0)    return { key: "out",  label: "نفد المخزون", badge: "bg-red-100 text-red-700 border border-red-200",    bar: "bg-red-500",    pct };
  if (qty <= min)  return { key: "low",  label: "مخزون منخفض", badge: "bg-amber-100 text-amber-700 border border-amber-200", bar: "bg-amber-500",  pct };
  if (qty >= max * 0.8) return { key:"high", label:"وفير",      badge:"bg-green-100 text-green-700 border border-green-200", bar:"bg-green-500",  pct };
  return               { key: "ok",   label: "طبيعي",       badge: "bg-blue-100 text-blue-700 border border-blue-200",   bar: "bg-blue-500",   pct };
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function InventorySmartPage() {
  const { toast }       = useToast();
  const [, nav]         = useLocation();
  const [search, setSearch]                 = useState("");
  const [catFilter, setCatFilter]           = useState("all");
  const [branch, setBranch]                 = useState("all");
  const [adjustOpen, setAdjustOpen]         = useState(false);
  const [addBatchOpen, setAddBatchOpen]     = useState(false);
  const [target, setTarget]                 = useState<RawItem | null>(null);
  const [adjType, setAdjType]               = useState<"add"|"subtract">("add");
  const [adjQty, setAdjQty]                 = useState(1);
  const [batchData, setBatchData]           = useState({ rawItemId:"", quantity:0, unitCost:0, notes:"" });

  const { data: rawItems=[], isLoading: loadRI }   = useQuery<RawItem[]>({ queryKey:["/api/inventory/raw-items"], refetchInterval: 30000 });
  const { data: stocks=[], isLoading: loadSt, refetch } = useQuery<BranchStock[]>({
    queryKey:["/api/inventory/branch-stocks", branch],
    refetchInterval: 30000,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (branch && branch !== "all") p.append("branchId", branch);
      const r = await fetch(`/api/inventory/branch-stocks?${p}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  const { data: branches=[] } = useQuery<Branch[]>({ queryKey:["/api/branches"] });
  const { data: allRecipes=[] } = useQuery<any[]>({ queryKey:["/api/inventory/all-recipes"], staleTime: 60000 });

  // Build a set of rawItemIds that have recipes linked
  const rawItemsWithRecipes = new Set<string>((allRecipes || []).map((r: any) => r.rawItemId).filter(Boolean));

  const adjMutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST","/api/inventory/stock-adjustment", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:["/api/inventory/branch-stocks"] });
      setAdjustOpen(false); setAdjQty(1);
      toast({ title:"✅ تم تعديل المخزون", className:"bg-green-600 text-white" });
    },
    onError: (e:any) => toast({ title: e.message || "خطأ", variant:"destructive" }),
  });

  const batchMutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST","/api/inventory/stock-batch", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:["/api/inventory/branch-stocks"] });
      queryClient.invalidateQueries({ queryKey:["/api/inventory/raw-items"] });
      setAddBatchOpen(false);
      setBatchData({ rawItemId:"", quantity:0, unitCost:0, notes:"" });
      toast({ title:"✅ تمت إضافة الدفعة", className:"bg-green-600 text-white" });
    },
    onError: (e:any) => toast({ title: e.message || "خطأ", variant:"destructive" }),
  });

  const getStock = (itemId: string) => stocks.find(s => s.rawItemId === itemId);

  // Summary stats
  const totalItems    = rawItems.length;
  const lowStock      = rawItems.filter(i => { const s=getStock(i.id); const q=s?.currentQuantity??0; return q>0 && q<=i.minStockLevel; }).length;
  const outOfStock    = rawItems.filter(i => (getStock(i.id)?.currentQuantity??0) <= 0).length;
  const stockValue    = rawItems.reduce((s,i) => s + ((getStock(i.id)?.currentQuantity??0) * i.unitCost), 0);

  const filtered = rawItems.filter(i => {
    const q = search.toLowerCase();
    return (i.nameAr.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || (i.nameEn?.toLowerCase().includes(q)??false))
      && (catFilter === "all" || i.category === catFilter);
  });

  if (loadRI || loadSt) return (
    <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-5">
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 rounded-full border-4 border-green-100 border-t-green-600 animate-spin" />
          <Warehouse className="absolute inset-0 m-auto w-8 h-8 text-green-600" />
        </div>
        <p className="text-gray-700 font-semibold text-lg">جاري تحميل المخزون…</p>
        <p className="text-gray-400 text-sm">يُرجى الانتظار لحظة</p>
      </div>
    </div>
  );

  return (
    <PlanGate feature="inventoryManagement">
      <div className="min-h-screen bg-white" dir="rtl">

        {/* ─── Sticky header ───────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => nav("/manager/dashboard")}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
                  data-testid="btn-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-green-600 shadow-md shadow-green-200">
                    <Layers className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">نظام المخزون</h1>
                    <p className="text-xs text-gray-400">إدارة ذكية للمواد والمخزون</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Branch selector */}
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="w-40 border-gray-200 bg-white text-gray-700 text-sm" data-testid="select-branch">
                    <SelectValue placeholder="اختر فرعاً" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🏪 جميع الفروع</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id||""}>{b.nameAr}</SelectItem>)}
                  </SelectContent>
                </Select>

                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  تحديث
                </button>

                <Button
                  onClick={() => setAddBatchOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-200"
                  data-testid="button-add-stock-batch"
                >
                  <PackagePlus className="h-4 w-4 ml-1.5" />
                  إضافة دفعة
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

          {/* ─── Branch warning ──────────────────────────────────── */}
          {branch === "all" && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">اختر فرعاً محدداً لتعديل الكميات</p>
                <p className="text-xs text-amber-600 mt-0.5">أنت الآن في وضع عرض فقط — اختر فرعاً للإضافة أو الخصم</p>
              </div>
            </div>
          )}

          {/* ─── KPI cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label:"إجمالي الأصناف",  value: totalItems,           sub:"صنف مُسجَّل",     icon: Package,    color:"bg-blue-50  border-blue-100",  textColor:"text-blue-700" },
              { label:"مخزون منخفض",     value: lowStock,             sub:"يحتاج إعادة طلب", icon:TrendingDown, color:"bg-amber-50 border-amber-100", textColor:"text-amber-700"},
              { label:"نفد المخزون",     value: outOfStock,           sub:"تعبئة فورية",     icon:AlertTriangle,color:"bg-red-50   border-red-100",   textColor:"text-red-700"  },
              { label:"قيمة المخزون",    value:`${stockValue.toFixed(0)} ر.س`, sub:"التكلفة الإجمالية", icon:BarChart3, color:"bg-green-50 border-green-100",textColor:"text-green-700"},
            ].map(({ label, value, sub, icon: Icon, color, textColor }, i) => (
              <div key={i} className={`rounded-2xl border p-5 ${color} flex items-start gap-4`}>
                <div className="bg-white rounded-xl p-2.5 shadow-sm">
                  <Icon className={`h-6 w-6 ${textColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
                  <p className={`text-2xl font-black mt-0.5 ${textColor}`} data-testid={`kpi-${i}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Auto-deduction info strip ──────────────────────── */}
          {rawItems.length > 0 && (
            (() => {
              const withRecipes = rawItems.filter(i => rawItemsWithRecipes.has(i.id)).length;
              const withoutRecipes = rawItems.length - withRecipes;
              return withoutRecipes > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">الخصم التلقائي غير مفعّل لبعض المواد</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      {withoutRecipes} مادة لا تحتوي على وصفة مرتبطة — الخصم التلقائي يعمل فقط عند ربط وصفات الأطباق بالمواد الخام.
                      {withRecipes > 0 && ` (${withRecipes} مادة مربوطة وتُخصم تلقائياً)`}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">لربط الوصفات: اذهب إلى إدارة الأطباق ← أضف وصفة لكل طبق.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-3">
                  <div className="p-1.5 bg-green-100 rounded-xl flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-green-700 text-sm font-medium">جميع المواد مربوطة بوصفات — الخصم التلقائي يعمل عند بيع الأطباق</p>
                </div>
              );
            })()
          )}

          {/* ─── Quick Navigation ────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">الأقسام الفرعية</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {NAV_LINKS.map(({ href, Icon, label, desc, danger }) => (
                <Link key={href} href={href}>
                  <div className={`group bg-white border rounded-2xl p-4 flex flex-col items-center gap-2 text-center cursor-pointer transition-all duration-200 hover:shadow-md ${danger ? "border-red-100 hover:border-red-300" : "border-gray-200 hover:border-green-300"}`}>
                    <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 ${danger ? "bg-red-50" : "bg-green-50"}`}>
                      <Icon className={`h-5 w-5 ${danger ? "text-red-600" : "text-green-600"}`} />
                    </div>
                    <p className={`font-semibold text-xs ${danger ? "text-red-700" : "text-gray-800"}`}>{label}</p>
                    <p className="text-xs text-gray-400 hidden sm:block">{desc}</p>
                    <ChevronRight className={`h-3 w-3 ${danger ? "text-red-400" : "text-gray-400"} group-hover:translate-x-0.5 transition-transform hidden sm:block`} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ─── Alerts strip ────────────────────────────────────── */}
          {(lowStock > 0 || outOfStock > 0) && (
            <div className="bg-white border-2 border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <Bell className="h-4 w-4 text-amber-600 animate-pulse" />
                </div>
                <span className="font-bold text-gray-900 text-sm">تنبيهات عاجلة ({lowStock + outOfStock} صنف)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rawItems
                  .filter(i => { const q=getStock(i.id)?.currentQuantity??0; return q<=i.minStockLevel; })
                  .slice(0,8)
                  .map(i => {
                    const q = getStock(i.id)?.currentQuantity ?? 0;
                    const isOut = q <= 0;
                    return (
                      <button
                        key={i.id}
                        onClick={() => { setTarget(i); setAdjType("add"); setAdjQty(1); setAdjustOpen(true); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:scale-105 ${isOut ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{i.nameAr}</span>
                        <span className="opacity-70">{q} {UNIT_LABELS[i.unit]||""}</span>
                        <Plus className="h-3 w-3 opacity-60" />
                      </button>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* ─── Inventory grid ──────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ابحث بالاسم أو الكود…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[{key:"all",label:"الكل"}, ...Object.entries(CATEGORY_CFG).map(([k,v])=>({key:k,label:v.labelAr}))].map(({key,label})=>(
                  <button
                    key={key}
                    onClick={() => setCatFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter===key ? "bg-green-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-sm text-gray-400 mr-auto">{filtered.length} صنف</span>
            </div>

            {/* Grid */}
            <div className="p-5">
              {filtered.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Package className="h-10 w-10 text-gray-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">لا توجد مواد مطابقة</p>
                    <p className="text-sm text-gray-400 mt-1">أضف مواد خام أو غيّر فلتر البحث</p>
                  </div>
                  <Link href="/manager/inventory/raw-items">
                    <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-50">
                      <Plus className="h-4 w-4 ml-1" /> إضافة مادة خام
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map(item => {
                    const cfg   = CATEGORY_CFG[item.category] || CATEGORY_CFG.other;
                    const CIcon = cfg.Icon;
                    const stk   = getStock(item.id);
                    const st    = getStatus(item, stk);
                    const qty   = stk?.currentQuantity ?? 0;
                    const val   = qty * item.unitCost;

                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-green-200 transition-all duration-200 group"
                        data-testid={`card-item-${item.id}`}
                      >
                        {/* Status bar */}
                        <div className={`h-1 ${st.bar} transition-all duration-700`} />

                        <div className="p-4 space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-gray-50 border border-gray-100 rounded-xl group-hover:bg-green-50 group-hover:border-green-100 transition-colors">
                                <CIcon className={`h-4 w-4 ${cfg.accent} group-hover:text-green-600 transition-colors`} />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm leading-tight">{item.nameAr}</p>
                                <code className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">{item.code}</code>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${st.badge}`}>{st.label}</span>
                          </div>

                          {/* Quantity + progress */}
                          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                            <div className="flex items-end justify-between">
                              <div>
                                <span className="text-2xl font-black text-gray-900" data-testid={`qty-${item.id}`}>
                                  {qty < 1 && qty > 0 ? qty.toFixed(3) : qty.toFixed(1)}
                                </span>
                                <span className="text-xs text-gray-400 mr-1">{UNIT_LABELS[item.unit]||item.unit}</span>
                              </div>
                              <span className="text-xs text-gray-400">
                                حد أدنى: <span className="font-medium text-gray-600">{item.minStockLevel}</span>
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${st.bar} rounded-full transition-all duration-700`}
                                style={{ width:`${st.pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Value + recipe badge */}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>القيمة: <span className="font-semibold text-gray-800">{val.toFixed(2)} ر.س</span></span>
                            {rawItemsWithRecipes.has(item.id) ? (
                              <span className="flex items-center gap-1 text-green-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />وصفة مربوطة</span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-500 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />بدون وصفة</span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => { setTarget(item); setAdjType("add"); setAdjQty(1); setAdjustOpen(true); }}
                              disabled={branch === "all"}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              data-testid={`btn-add-${item.id}`}
                            >
                              <Plus className="h-3.5 w-3.5" /> إضافة
                            </button>
                            <button
                              onClick={() => { setTarget(item); setAdjType("subtract"); setAdjQty(1); setAdjustOpen(true); }}
                              disabled={branch === "all" || qty <= 0}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:border-red-300 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              data-testid={`btn-sub-${item.id}`}
                            >
                              <Minus className="h-3.5 w-3.5" /> خصم
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Quick Adjust Dialog ─────────────────────────────── */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent className="bg-white border-0 shadow-2xl rounded-2xl max-w-sm" dir="rtl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2.5 rounded-xl ${adjType==="add" ? "bg-green-100" : "bg-red-100"}`}>
                  {adjType === "add"
                    ? <Plus className="h-5 w-5 text-green-700" />
                    : <Minus className="h-5 w-5 text-red-700" />
                  }
                </div>
                <DialogTitle className="text-gray-900">{adjType==="add" ? "إضافة كمية" : "خصم كمية"}</DialogTitle>
              </div>
              {target && <p className="text-sm text-gray-500 font-medium">{target.nameAr} • <code className="bg-gray-100 px-1 rounded">{target.code}</code></p>}
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="text-gray-700 font-medium text-sm">الكمية ({UNIT_LABELS[target?.unit||""]||target?.unit||""})</Label>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setAdjQty(q => Math.max(0.1, q - 1))}
                    className="p-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-600 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    type="number"
                    min="0.001"
                    value={adjQty}
                    onChange={e => setAdjQty(parseFloat(e.target.value)||0)}
                    className="text-center text-xl font-black border-gray-200 text-gray-900"
                    data-testid="input-adjust-qty"
                  />
                  <button
                    onClick={() => setAdjQty(q => q + 1)}
                    className="p-2.5 rounded-xl border border-gray-200 hover:border-green-300 text-gray-600 hover:text-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {adjType === "add" && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700">
                  <Activity className="h-3.5 w-3.5 inline ml-1" />
                  سيتم تسجيل الإضافة في سجل حركة المخزون تلقائياً
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAdjustOpen(false)} className="border-gray-200 text-gray-700">إلغاء</Button>
              <Button
                onClick={() => {
                  if (!target || branch==="all") { toast({title:"⚠️ اختر فرعاً محدداً",variant:"destructive"}); return; }
                  if (!adjQty || adjQty<=0) { toast({title:"أدخل كمية صحيحة",variant:"destructive"}); return; }
                  adjMutation.mutate({ rawItemId:target.id, branchId:branch, quantity:adjQty, type:adjType });
                }}
                disabled={adjMutation.isPending}
                className={adjType==="add" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                data-testid="btn-confirm-adjust"
              >
                {adjMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (adjType==="add" ? "تأكيد الإضافة" : "تأكيد الخصم")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Add Batch Dialog ────────────────────────────────── */}
        <Dialog open={addBatchOpen} onOpenChange={setAddBatchOpen}>
          <DialogContent className="bg-white border-0 shadow-2xl rounded-2xl max-w-md" dir="rtl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-green-100 rounded-xl">
                  <PackagePlus className="h-5 w-5 text-green-700" />
                </div>
                <DialogTitle className="text-gray-900">إضافة دفعة جديدة</DialogTitle>
              </div>
              <p className="text-sm text-gray-500">أضف كميات جديدة من المواد الخام للمخزون</p>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="text-gray-700 font-medium text-sm">المادة الخام</Label>
                <Select value={batchData.rawItemId} onValueChange={v => setBatchData(d => ({...d, rawItemId:v}))}>
                  <SelectTrigger className="mt-1.5 border-gray-200 text-gray-900" data-testid="select-batch-item">
                    <SelectValue placeholder="اختر المادة…" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawItems.map(i => <SelectItem key={i.id} value={i.id}>{i.nameAr} ({i.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-700 font-medium text-sm">الفرع</Label>
                <Select value={branch!=="all"?branch:""} onValueChange={v => setBranch(v)}>
                  <SelectTrigger className="mt-1.5 border-gray-200 text-gray-900" data-testid="select-batch-branch">
                    <SelectValue placeholder="اختر الفرع…" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id||""}>{b.nameAr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-700 font-medium text-sm">الكمية</Label>
                  <Input
                    type="number"
                    min="0"
                    value={batchData.quantity||""}
                    onChange={e => setBatchData(d => ({...d, quantity:parseFloat(e.target.value)||0}))}
                    placeholder="0"
                    className="mt-1.5 border-gray-200 text-gray-900"
                    data-testid="input-batch-qty"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 font-medium text-sm">تكلفة الوحدة (اختياري)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={batchData.unitCost||""}
                    onChange={e => setBatchData(d => ({...d, unitCost:parseFloat(e.target.value)||0}))}
                    placeholder="ر.س"
                    className="mt-1.5 border-gray-200 text-gray-900"
                    data-testid="input-batch-cost"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-medium text-sm">ملاحظات (اختياري)</Label>
                <Input
                  value={batchData.notes}
                  onChange={e => setBatchData(d => ({...d, notes:e.target.value}))}
                  placeholder="مثال: طلبية من المورد..."
                  className="mt-1.5 border-gray-200 text-gray-900"
                  data-testid="input-batch-notes"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <CheckCircle2 className="h-3.5 w-3.5 inline ml-1" />
                سيتم تسجيل القيد المحاسبي تلقائياً عند إضافة الدفعة
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAddBatchOpen(false)} className="border-gray-200 text-gray-700">إلغاء</Button>
              <Button
                onClick={() => {
                  if (!batchData.rawItemId) { toast({title:"اختر المادة الخام",variant:"destructive"}); return; }
                  if (branch==="all") { toast({title:"اختر فرعاً محدداً",variant:"destructive"}); return; }
                  if (!batchData.quantity || batchData.quantity<=0) { toast({title:"أدخل كمية صحيحة",variant:"destructive"}); return; }
                  batchMutation.mutate({ ...batchData, branchId:branch });
                }}
                disabled={batchMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="btn-confirm-batch"
              >
                {batchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الإضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PlanGate>
  );
}
