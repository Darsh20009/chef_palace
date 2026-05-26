import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Trash2, Plus, Minus, ArrowLeft, Package, AlertTriangle,
  TrendingDown, TrendingUp, ChefHat, BarChart3, Flame, Layers,
  CheckCircle2, XCircle, Clock, PlayCircle, PauseCircle,
  ShoppingCart, Boxes, RefreshCw, DollarSign, Calendar,
  AlertOctagon, Leaf, Factory, Eye, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SarIcon from "@/components/sar-icon";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawItem {
  id: string; code: string; nameAr: string; nameEn?: string;
  category: string; unit: string; unitCost: number;
  currentStock?: number; currentStockLevel?: number;
  minStockLevel: number; maxStockLevel?: number;
  supplierId?: string; isActive: number;
}

interface WastageRecord {
  id: string; rawItemId: string; rawItemName: string; rawItemCode?: string;
  quantity: number; unit: string; reason: string; reasonNote?: string;
  unitCost: number; totalCost: number; recordedBy: string; recordedAt: string;
}

interface ProductionBatch {
  id: string; batchNumber: string; productName: string;
  quantity: number; unit: string;
  ingredients: Array<{ rawItemId: string; rawItemName: string; quantityUsed: number; unit: string; unitCost: number; totalCost: number }>;
  totalCost: number; status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  plannedDate: string; completedDate?: string; notes?: string; producedBy: string;
}

interface ForecastItem {
  id: string; nameAr: string; nameEn?: string; unit: string;
  currentStock: number; minStockLevel: number; maxStockLevel?: number; unitCost: number;
  totalDeducted: number; totalWasted: number;
  avgDailyUsage: number; daysUntilStockout: number;
  suggestedReorder: number; stockoutRisk: 'critical' | 'high' | 'medium' | 'low';
  reorderCost: number;
}

interface WastageSummary {
  totalCost: number; count: number;
  byReason: Record<string, number>;
  byItem: Record<string, { name: string; qty: number; cost: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WASTAGE_REASONS: Record<string, { labelAr: string; icon: string; color: string }> = {
  expired:      { labelAr: 'منتهي الصلاحية', icon: '⏰', color: 'text-red-500'    },
  damaged:      { labelAr: 'تالف',            icon: '💔', color: 'text-orange-500' },
  spoiled:      { labelAr: 'فاسد',            icon: '🦠', color: 'text-yellow-600' },
  over_portion: { labelAr: 'زيادة في التقديم',icon: '⚖️', color: 'text-blue-500'  },
  accident:     { labelAr: 'حادث',            icon: '🔥', color: 'text-red-600'    },
  other:        { labelAr: 'أخرى',            icon: '❓', color: 'text-gray-500'   },
};

const PROD_STATUS: Record<string, { labelAr: string; color: string; icon: any }> = {
  planned:     { labelAr: 'مجدول',    color: 'bg-blue-100 text-blue-700',    icon: Calendar },
  in_progress: { labelAr: 'جاري',     color: 'bg-yellow-100 text-yellow-700', icon: PlayCircle },
  completed:   { labelAr: 'مكتمل',   color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  cancelled:   { labelAr: 'ملغي',     color: 'bg-red-100 text-red-700',       icon: XCircle },
};

const RISK_CFG = {
  critical: { labelAr: 'حرج',    color: 'bg-red-500 text-white',          bar: 'bg-red-500' },
  high:     { labelAr: 'عالٍ',   color: 'bg-orange-500 text-white',       bar: 'bg-orange-500' },
  medium:   { labelAr: 'متوسط',  color: 'bg-yellow-500 text-black',       bar: 'bg-yellow-400' },
  low:      { labelAr: 'منخفض',  color: 'bg-green-500 text-white',        bar: 'bg-green-500' },
};

const UNIT_LABELS: Record<string, string> = {
  kg: 'كغ', g: 'جرام', liter: 'لتر', ml: 'مل', piece: 'قطعة', box: 'صندوق', bag: 'كيس',
};

type Tab = 'overview' | 'wastage' | 'production' | 'forecast';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InventoryHub() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Wastage state
  const [showWastageForm, setShowWastageForm] = useState(false);
  const [wRawItemId, setWRawItemId] = useState('');
  const [wQuantity, setWQuantity]   = useState('');
  const [wReason, setWReason]       = useState('');
  const [wNote, setWNote]           = useState('');

  // ── Production state
  const [showProdForm, setShowProdForm] = useState(false);
  const [pName, setPName]               = useState('');
  const [pQty, setPQty]                 = useState('');
  const [pUnit, setPUnit]               = useState('piece');
  const [pDate, setPDate]               = useState(new Date().toISOString().split('T')[0]);
  const [pNotes, setPNotes]             = useState('');
  const [pIngredients, setPIngredients] = useState<Array<{ rawItemId: string; rawItemName: string; quantityUsed: string; unit: string; unitCost: number }>>([]);
  const [pIngRaw, setPIngRaw]           = useState('');
  const [pIngQty, setPIngQty]           = useState('');

  // ── Filters
  const [wastageFilter, setWastageFilter]   = useState('all');
  const [productionFilter, setProdFilter]   = useState('all');
  const [forecastFilter, setForecastFilter] = useState('all');
  const [searchRaw, setSearchRaw]           = useState('');

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: rawItems = [], isLoading: loadingRaw } = useQuery<RawItem[]>({
    queryKey: ['/api/inventory/raw-items'],
  });

  const { data: wastageList = [], isLoading: loadingWastage } = useQuery<WastageRecord[]>({
    queryKey: ['/api/inventory/wastage'],
    enabled: activeTab === 'wastage' || activeTab === 'overview',
  });

  const { data: wastageSummary } = useQuery<WastageSummary>({
    queryKey: ['/api/inventory/wastage/summary'],
    enabled: activeTab === 'wastage' || activeTab === 'overview',
  });

  const { data: productionList = [], isLoading: loadingProd } = useQuery<ProductionBatch[]>({
    queryKey: ['/api/inventory/production'],
    enabled: activeTab === 'production' || activeTab === 'overview',
  });

  const { data: forecast, isLoading: loadingForecast } = useQuery<{ items: ForecastItem[]; summary: any }>({
    queryKey: ['/api/inventory/forecast'],
    enabled: activeTab === 'forecast' || activeTab === 'overview',
  });

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createWastage = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/inventory/wastage', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/wastage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/wastage/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/raw-items'] });
      toast({ title: tc('تم تسجيل الهدر', 'Wastage logged') });
      setShowWastageForm(false);
      setWRawItemId(''); setWQuantity(''); setWReason(''); setWNote('');
    },
    onError: (e: any) => toast({ title: tc('خطأ', 'Error'), description: e.message, variant: 'destructive' }),
  });

  const deleteWastage = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/inventory/wastage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/wastage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/wastage/summary'] });
      toast({ title: tc('تم الحذف', 'Deleted') });
    },
  });

  const createProduction = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/inventory/production', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production'] });
      toast({ title: tc('تم إنشاء دفعة الإنتاج', 'Production batch created') });
      setShowProdForm(false);
      setPName(''); setPQty(''); setPUnit('piece'); setPIngredients([]); setPNotes('');
    },
    onError: (e: any) => toast({ title: tc('خطأ', 'Error'), description: e.message, variant: 'destructive' }),
  });

  const updateProdStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest('PUT', `/api/inventory/production/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/raw-items'] });
      toast({ title: tc('تم تحديث الحالة', 'Status updated') });
    },
  });

  const deleteProduction = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/inventory/production/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/inventory/production'] }),
  });

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const lowStockItems = useMemo(() =>
    rawItems.filter(i => {
      const stock = i.currentStock ?? i.currentStockLevel ?? 0;
      return stock <= i.minStockLevel && i.isActive === 1;
    }), [rawItems]);

  const totalStockValue = useMemo(() =>
    rawItems.reduce((s, i) => s + ((i.currentStock ?? i.currentStockLevel ?? 0) * (i.unitCost || 0)), 0), [rawItems]);

  const filteredWastage = useMemo(() => {
    let list = wastageList;
    if (wastageFilter !== 'all') list = list.filter(w => w.reason === wastageFilter);
    return list;
  }, [wastageList, wastageFilter]);

  const filteredProduction = useMemo(() => {
    let list = productionList;
    if (productionFilter !== 'all') list = list.filter(p => p.status === productionFilter);
    return list;
  }, [productionList, productionFilter]);

  const filteredForecast = useMemo(() => {
    let list = forecast?.items || [];
    if (forecastFilter !== 'all') list = list.filter(f => f.stockoutRisk === forecastFilter);
    if (searchRaw) list = list.filter(f => f.nameAr.includes(searchRaw) || (f.nameEn || '').toLowerCase().includes(searchRaw.toLowerCase()));
    return list;
  }, [forecast, forecastFilter, searchRaw]);

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const getRawItem = (id: string) => rawItems.find(r => r.id === id);

  const addIngredient = () => {
    const raw = getRawItem(pIngRaw);
    if (!raw || !pIngQty) return;
    const qty = parseFloat(pIngQty);
    setPIngredients(prev => [...prev, {
      rawItemId: raw.id,
      rawItemName: raw.nameAr,
      quantityUsed: String(qty),
      unit: raw.unit,
      unitCost: raw.unitCost,
    }]);
    setPIngRaw(''); setPIngQty('');
  };

  const submitWastage = () => {
    if (!wRawItemId || !wQuantity || !wReason) {
      toast({ title: tc('يرجى ملء جميع الحقول المطلوبة', 'Fill required fields'), variant: 'destructive' });
      return;
    }
    createWastage.mutate({ rawItemId: wRawItemId, quantity: parseFloat(wQuantity), reason: wReason, reasonNote: wNote });
  };

  const submitProduction = () => {
    if (!pName || !pQty || !pDate) {
      toast({ title: tc('يرجى ملء جميع الحقول المطلوبة', 'Fill required fields'), variant: 'destructive' });
      return;
    }
    const ingredients = pIngredients.map(i => ({
      ...i,
      quantityUsed: i.quantityUsed,
      totalCost: (parseFloat(String(i.quantityUsed)) || 0) * i.unitCost,
    }));
    createProduction.mutate({ productName: pName, quantity: parseFloat(pQty), unit: pUnit, ingredients, plannedDate: pDate, notes: pNotes });
  };

  const selectedWasteItem = getRawItem(wRawItemId);
  const wasteEstimatedCost = selectedWasteItem && wQuantity
    ? (parseFloat(wQuantity) || 0) * (selectedWasteItem.unitCost || 0)
    : 0;

  const tabs: Array<{ key: Tab; labelAr: string; labelEn: string; icon: any; badge?: number; badgeColor?: string }> = [
    { key: 'overview',    labelAr: 'لوحة المراقبة',   labelEn: 'Overview',    icon: BarChart3 },
    { key: 'wastage',     labelAr: 'تسجيل الهدر',      labelEn: 'Wastage',     icon: Leaf,      badge: wastageList.length, badgeColor: 'bg-red-500' },
    { key: 'production',  labelAr: 'الإنتاج',           labelEn: 'Production',  icon: Factory,   badge: productionList.filter(p => p.status === 'in_progress').length, badgeColor: 'bg-yellow-500' },
    { key: 'forecast',    labelAr: 'التنبؤ بالمخزون',  labelEn: 'Forecasting', icon: TrendingDown, badge: (forecast?.summary?.critical || 0) + (forecast?.summary?.high || 0), badgeColor: 'bg-red-500' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation('/manager/inventory')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="bg-primary p-1.5 rounded-lg">
                <Boxes className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-black text-base">{tc('مركز المخزون المتقدم', 'Advanced Inventory Hub')}</h1>
                <p className="text-[10px] text-muted-foreground">{tc('وصفات · هدر · إنتاج · تنبؤ · موردين', 'Recipes · Wastage · Production · Forecast · Vendors')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lowStockItems.length > 0 && (
              <Badge className="bg-red-500 text-white animate-pulse text-xs">
                <AlertTriangle className="w-3 h-3 ml-1" />
                {lowStockItems.length} {tc('نقص', 'low')}
              </Badge>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLocation('/manager/inventory/raw-items')}>
              <Package className="w-3.5 h-3.5 ml-1" />
              {tc('المواد الخام', 'Raw Items')}
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 mt-3 border-b overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tc(tab.labelAr, tab.labelEn)}
              {!!tab.badge && tab.badge > 0 && (
                <span className={cn('rounded-full px-1.5 text-[9px] font-black text-white', tab.badgeColor || 'bg-primary')}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* ══════════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-0 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Package className="w-4 h-4 text-primary" />
                    <Badge variant="outline" className="text-[10px]">{tc('مواد', 'Items')}</Badge>
                  </div>
                  <p className="text-2xl font-black">{rawItems.filter(i => i.isActive === 1).length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tc('مادة خام نشطة', 'Active raw items')}</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <Badge className="bg-red-500 text-white text-[10px]">{tc('تنبيه', 'Alert')}</Badge>
                  </div>
                  <p className="text-2xl font-black text-red-600">{lowStockItems.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tc('نقص في المخزون', 'Low stock items')}</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Leaf className="w-4 h-4 text-orange-500" />
                    <Badge className="bg-orange-500 text-white text-[10px]">{tc('هدر', 'Waste')}</Badge>
                  </div>
                  <p className="text-2xl font-black text-orange-600">{(wastageSummary?.totalCost || 0).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tc('تكلفة الهدر (30 يوم) ر.س', 'Waste cost (30d) SAR')}</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <Badge className="bg-green-600 text-white text-[10px]">{tc('قيمة', 'Value')}</Badge>
                  </div>
                  <p className="text-2xl font-black text-green-700">{totalStockValue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tc('قيمة المخزون الإجمالية ر.س', 'Total stock value SAR')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { labelAr: 'تسجيل هدر',    icon: Leaf,         onClick: () => { setActiveTab('wastage'); setShowWastageForm(true); }, color: 'border-red-200 hover:bg-red-50' },
                { labelAr: 'دفعة إنتاج',   icon: Factory,      onClick: () => { setActiveTab('production'); setShowProdForm(true); }, color: 'border-yellow-200 hover:bg-yellow-50' },
                { labelAr: 'تنبؤ المخزون', icon: TrendingDown, onClick: () => setActiveTab('forecast'), color: 'border-blue-200 hover:bg-blue-50' },
                { labelAr: 'أمر شراء',     icon: ShoppingCart, onClick: () => setLocation('/manager/inventory/purchases'), color: 'border-green-200 hover:bg-green-50' },
              ].map(a => (
                <button key={a.labelAr} onClick={a.onClick} className={cn('rounded-xl border p-3 flex flex-col items-center gap-1.5 transition-colors text-xs font-bold', a.color)}>
                  <a.icon className="w-5 h-5" />
                  {tc(a.labelAr, a.labelAr)}
                </button>
              ))}
            </div>

            {/* Low Stock */}
            {lowStockItems.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                    <AlertOctagon className="w-4 h-4" />
                    {tc('مواد تحت الحد الأدنى', 'Below Minimum Stock')} ({lowStockItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {lowStockItems.slice(0, 6).map(item => {
                      const stock = item.currentStock ?? item.currentStockLevel ?? 0;
                      const pct = item.minStockLevel > 0 ? Math.min(100, (stock / item.minStockLevel) * 100) : 0;
                      return (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-bold truncate">{item.nameAr}</span>
                              <span className="text-[10px] text-red-600 font-bold shrink-0 ml-2">{stock} / {item.minStockLevel} {UNIT_LABELS[item.unit] || item.unit}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] shrink-0" onClick={() => setLocation('/manager/inventory/purchases')}>
                            <ShoppingCart className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Wastage */}
            {wastageList.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-orange-500" />
                    {tc('آخر تسجيلات الهدر', 'Recent Wastage')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab('wastage')}>
                    {tc('الكل', 'All')}
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-1.5">
                    {wastageList.slice(0, 4).map(w => (
                      <div key={w.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span>{WASTAGE_REASONS[w.reason]?.icon || '?'}</span>
                          <span className="font-bold">{w.rawItemName}</span>
                          <span className="text-muted-foreground">{w.quantity} {UNIT_LABELS[w.unit] || w.unit}</span>
                        </div>
                        <span className="text-red-600 font-bold">-{w.totalCost.toFixed(2)} <SarIcon size={11} /></span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation to other pages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {[
                { href: '/manager/inventory/recipes',   icon: ChefHat,        label: tc('الوصفات', 'Recipes') },
                { href: '/manager/inventory/transfers', icon: Layers,          label: tc('التحويلات', 'Transfers') },
                { href: '/manager/inventory/suppliers', icon: ShoppingCart,    label: tc('الموردين', 'Suppliers') },
                { href: '/manager/inventory/movements', icon: BarChart3,       label: tc('الحركات', 'Movements') },
                { href: '/manager/inventory/alerts',    icon: AlertTriangle,   label: tc('التنبيهات', 'Alerts') },
                { href: '/manager/inventory/stock',     icon: Boxes,           label: tc('المخزون', 'Stock') },
              ].map(link => (
                <button key={link.href} onClick={() => setLocation(link.href)} className="rounded-xl border p-3 flex items-center gap-2 text-xs font-bold hover:bg-muted/50 transition-colors text-right">
                  <link.icon className="w-4 h-4 text-primary shrink-0" />
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            WASTAGE TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'wastage' && (
          <div className="space-y-4">
            {/* Summary cards */}
            {wastageSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-0 bg-red-50">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">{tc('إجمالي الهدر (30 يوم)', 'Total Waste (30d)')}</p>
                    <p className="text-xl font-black text-red-600">{wastageSummary.totalCost.toFixed(2)} <SarIcon size={11} /></p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-orange-50">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground">{tc('عدد السجلات', 'Records Count')}</p>
                    <p className="text-xl font-black text-orange-600">{wastageSummary.count}</p>
                  </CardContent>
                </Card>
                {Object.entries(wastageSummary.byReason).slice(0, 2).map(([reason, cost]) => (
                  <Card key={reason} className="border-0 bg-muted/30">
                    <CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground">{WASTAGE_REASONS[reason]?.icon} {WASTAGE_REASONS[reason]?.labelAr}</p>
                      <p className="text-xl font-black">{(cost as number).toFixed(2)} <SarIcon size={11} /></p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Filters + Add Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => setShowWastageForm(true)} className="h-9 text-xs gap-1.5" data-testid="button-log-wastage">
                <Plus className="w-3.5 h-3.5" />
                {tc('تسجيل هدر جديد', 'Log Wastage')}
              </Button>
              <Select value={wastageFilter} onValueChange={setWastageFilter}>
                <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tc('جميع الأسباب', 'All Reasons')}</SelectItem>
                  {Object.entries(WASTAGE_REASONS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.icon} {v.labelAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Wastage List */}
            {loadingWastage ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filteredWastage.length === 0 ? (
              <Card className="p-12 text-center">
                <Leaf className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-bold text-muted-foreground">{tc('لا توجد سجلات هدر', 'No wastage records')}</p>
                <Button className="mt-3" onClick={() => setShowWastageForm(true)}>{tc('ابدأ التسجيل', 'Start Logging')}</Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredWastage.map(w => (
                  <Card key={w.id} className="border hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="text-2xl w-8 text-center shrink-0">{WASTAGE_REASONS[w.reason]?.icon || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{w.rawItemName}</span>
                          {w.rawItemCode && <span className="text-[10px] text-muted-foreground">#{w.rawItemCode}</span>}
                          <Badge className={cn('text-[10px]', WASTAGE_REASONS[w.reason]?.color, 'bg-transparent border-current border')}>{WASTAGE_REASONS[w.reason]?.labelAr}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>{w.quantity} {UNIT_LABELS[w.unit] || w.unit}</span>
                          <span>× {w.unitCost.toFixed(2)} <SarIcon size={11} /></span>
                          {w.reasonNote && <span className="text-amber-600">💬 {w.reasonNote}</span>}
                          <span>{new Date(w.recordedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span>{tc('بواسطة:', 'By:')} {w.recordedBy}</span>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="font-black text-red-600 text-sm">-{w.totalCost.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground"><SarIcon size={11} /></p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteWastage.mutate(w.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            PRODUCTION TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'production' && (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PROD_STATUS).map(([k, v]) => {
                const count = productionList.filter(p => p.status === k).length;
                return (
                  <Card key={k} className={cn('border-0 cursor-pointer', productionFilter === k ? 'ring-2 ring-primary' : '')} onClick={() => setProdFilter(productionFilter === k ? 'all' : k)}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-black">{count}</p>
                      <Badge className={cn('text-[10px] mt-1', v.color)}>{v.labelAr}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setShowProdForm(true)} className="h-9 text-xs gap-1.5" data-testid="button-new-production">
                <Plus className="w-3.5 h-3.5" />
                {tc('دفعة إنتاج جديدة', 'New Production Batch')}
              </Button>
              <Button variant="outline" className="h-9 text-xs" onClick={() => setProdFilter('all')}>{tc('الكل', 'All')}</Button>
            </div>

            {loadingProd ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filteredProduction.length === 0 ? (
              <Card className="p-12 text-center">
                <Factory className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-bold text-muted-foreground">{tc('لا توجد دفعات إنتاج', 'No production batches')}</p>
                <Button className="mt-3" onClick={() => setShowProdForm(true)}>{tc('أنشئ أول دفعة', 'Create First Batch')}</Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredProduction.map(batch => {
                  const cfg = PROD_STATUS[batch.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <Card key={batch.id} className="border hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-base">{batch.productName}</span>
                              <Badge className={cn('text-[10px]', cfg.color)}>
                                <StatusIcon className="w-3 h-3 ml-1" />
                                {cfg.labelAr}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-mono">{batch.batchNumber}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {batch.quantity} {UNIT_LABELS[batch.unit] || batch.unit} · {tc('تكلفة:', 'Cost:')} <span className="font-bold text-foreground">{batch.totalCost.toFixed(2)} <SarIcon size={11} /></span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">{tc('مجدول:', 'Planned:')} {new Date(batch.plannedDate).toLocaleDateString('ar-SA')}</p>
                            {/* Ingredients */}
                            {batch.ingredients.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {batch.ingredients.map((ing, i) => (
                                  <span key={i} className="text-[10px] bg-muted rounded-full px-2 py-0.5">
                                    {ing.rawItemName}: {ing.quantityUsed} {UNIT_LABELS[ing.unit] || ing.unit}
                                  </span>
                                ))}
                              </div>
                            )}
                            {batch.notes && <p className="text-[11px] text-amber-600 mt-1">💬 {batch.notes}</p>}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {batch.status === 'planned' && (
                              <Button size="sm" className="h-8 text-xs" onClick={() => updateProdStatus.mutate({ id: batch.id, status: 'in_progress' })} disabled={updateProdStatus.isPending}>
                                <PlayCircle className="w-3.5 h-3.5 ml-1" />{tc('ابدأ', 'Start')}
                              </Button>
                            )}
                            {batch.status === 'in_progress' && (
                              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => updateProdStatus.mutate({ id: batch.id, status: 'completed' })} disabled={updateProdStatus.isPending}>
                                <CheckCircle2 className="w-3.5 h-3.5 ml-1" />{tc('اكتمل', 'Complete')}
                              </Button>
                            )}
                            {(batch.status === 'planned' || batch.status === 'in_progress') && (
                              <Button size="sm" variant="outline" className="h-8 text-xs text-destructive" onClick={() => updateProdStatus.mutate({ id: batch.id, status: 'cancelled' })} disabled={updateProdStatus.isPending}>
                                <XCircle className="w-3.5 h-3.5 ml-1" />{tc('إلغاء', 'Cancel')}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => deleteProduction.mutate(batch.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            FORECASTING TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'forecast' && (
          <div className="space-y-4">
            {/* Summary */}
            {forecast?.summary && (
              <div className="grid grid-cols-4 gap-2">
                {(['critical','high','medium','low'] as const).map(risk => (
                  <Card key={risk} className={cn('border-0 cursor-pointer', forecastFilter === risk ? 'ring-2 ring-primary' : '')} onClick={() => setForecastFilter(forecastFilter === risk ? 'all' : risk)}>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-black">{forecast.summary[risk] || 0}</p>
                      <Badge className={cn('text-[10px] mt-1', RISK_CFG[risk].color)}>{RISK_CFG[risk].labelAr}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {forecast?.summary && (
              <Card className="border-0 bg-blue-50">
                <CardContent className="p-3 flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tc('تكلفة إعادة التخزين المقترحة', 'Suggested Reorder Cost')}</p>
                    <p className="font-black text-blue-700">{(forecast.summary.totalReorderCost || 0).toFixed(2)} <SarIcon size={11} /></p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search + Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Input
                  placeholder={tc('بحث عن مادة...', 'Search item...')}
                  value={searchRaw}
                  onChange={e => setSearchRaw(e.target.value)}
                  className="h-9 pr-8 text-xs"
                />
              </div>
              <Select value={forecastFilter} onValueChange={setForecastFilter}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tc('جميع المستويات', 'All Levels')}</SelectItem>
                  {(['critical','high','medium','low'] as const).map(r => (
                    <SelectItem key={r} value={r}>{RISK_CFG[r].labelAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/inventory/forecast'] })}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>

            {loadingForecast ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filteredForecast.length === 0 ? (
              <Card className="p-12 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-bold text-muted-foreground">{tc('لا توجد بيانات للتنبؤ حالياً', 'No forecast data available')}</p>
                <p className="text-xs text-muted-foreground mt-1">{tc('يتطلب بيانات حركة مخزون لآخر 30 يوم', 'Requires 30-day stock movement data')}</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredForecast.map(item => {
                  const risk = RISK_CFG[item.stockoutRisk];
                  const stockPct = item.maxStockLevel ? Math.min(100, (item.currentStock / item.maxStockLevel) * 100) : Math.min(100, (item.currentStock / Math.max(item.minStockLevel, 1)) * 100);
                  return (
                    <Card key={item.id} className={cn('border hover:shadow-sm transition-shadow', item.stockoutRisk === 'critical' ? 'border-red-300 bg-red-50/30' : item.stockoutRisk === 'high' ? 'border-orange-200' : '')}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-sm">{item.nameAr}</span>
                              {item.nameEn && <span className="text-[10px] text-muted-foreground">{item.nameEn}</span>}
                              <Badge className={cn('text-[10px]', risk.color)}>{risk.labelAr}</Badge>
                            </div>
                            <Progress value={stockPct} className={cn('h-2 mb-2', item.stockoutRisk === 'critical' ? '[&>div]:bg-red-500' : item.stockoutRisk === 'high' ? '[&>div]:bg-orange-500' : item.stockoutRisk === 'medium' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500')} />
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px]">
                              <div>
                                <span className="text-muted-foreground">{tc('المخزون:', 'Stock:')}</span>
                                <span className="font-bold mr-1">{item.currentStock} {UNIT_LABELS[item.unit] || item.unit}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{tc('استهلاك يومي:', 'Daily use:')}</span>
                                <span className="font-bold mr-1">{item.avgDailyUsage} {UNIT_LABELS[item.unit] || item.unit}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{tc('يكفي:', 'Lasts:')}</span>
                                <span className={cn('font-bold mr-1', item.daysUntilStockout < 7 ? 'text-red-600' : 'text-green-600')}>
                                  {item.daysUntilStockout === 999 ? tc('لا يُستهلك', 'N/A') : `${item.daysUntilStockout} ${tc('يوم', 'days')}`}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{tc('مقترح للطلب:', 'Reorder:')}</span>
                                <span className="font-bold mr-1">{item.suggestedReorder} {UNIT_LABELS[item.unit] || item.unit}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-xs text-muted-foreground">{tc('تكلفة الطلب', 'Reorder cost')}</p>
                            <p className="font-black text-primary">{item.reorderCost.toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground"><SarIcon size={11} /></p>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] mt-1 w-full" onClick={() => setLocation('/manager/inventory/purchases')}>
                              <ShoppingCart className="w-3 h-3 ml-1" />{tc('اطلب', 'Order')}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── LOG WASTAGE DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={showWastageForm} onOpenChange={setShowWastageForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-red-500" />
              {tc('تسجيل هدر جديد', 'Log New Wastage')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold mb-1 block">{tc('المادة الخام *', 'Raw Item *')}</Label>
              <Select value={wRawItemId} onValueChange={setWRawItemId}>
                <SelectTrigger className="h-9 text-xs" data-testid="select-wastage-item">
                  <SelectValue placeholder={tc('اختر المادة...', 'Select item...')} />
                </SelectTrigger>
                <SelectContent>
                  {rawItems.filter(i => i.isActive === 1).map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nameAr} — {(item.currentStock ?? item.currentStockLevel ?? 0).toFixed(2)} {UNIT_LABELS[item.unit] || item.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedWasteItem && (
              <div className="bg-muted/30 rounded-lg p-2 text-xs text-muted-foreground grid grid-cols-3 gap-2">
                <div><span className="font-bold block">{tc('المخزون', 'Stock')}</span>{(selectedWasteItem.currentStock ?? selectedWasteItem.currentStockLevel ?? 0).toFixed(2)} {UNIT_LABELS[selectedWasteItem.unit] || selectedWasteItem.unit}</div>
                <div><span className="font-bold block">{tc('سعر الوحدة', 'Unit Cost')}</span>{selectedWasteItem.unitCost.toFixed(2)} <SarIcon size={11} /></div>
                <div><span className="font-bold block">{tc('التكلفة المتوقعة', 'Est. Cost')}</span><span className="text-red-600 font-black">{wasteEstimatedCost.toFixed(2)} <SarIcon size={11} /></span></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold mb-1 block">{tc('الكمية *', 'Quantity *')}</Label>
                <Input type="number" min={0} step={0.01} value={wQuantity} onChange={e => setWQuantity(e.target.value)} className="h-9 text-sm" placeholder="0.00" data-testid="input-wastage-qty" />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">{tc('السبب *', 'Reason *')}</Label>
                <Select value={wReason} onValueChange={setWReason}>
                  <SelectTrigger className="h-9 text-xs" data-testid="select-wastage-reason"><SelectValue placeholder={tc('السبب...', 'Reason...')} /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(WASTAGE_REASONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.labelAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold mb-1 block">{tc('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
              <Input value={wNote} onChange={e => setWNote(e.target.value)} className="h-9 text-sm" placeholder={tc('وصف إضافي...', 'Additional details...')} data-testid="input-wastage-note" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowWastageForm(false)}>{tc('إلغاء', 'Cancel')}</Button>
            <Button onClick={submitWastage} disabled={createWastage.isPending} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-wastage">
              {createWastage.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Leaf className="w-4 h-4 ml-2" />}
              {tc('تسجيل الهدر', 'Log Wastage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── NEW PRODUCTION BATCH DIALOG ─────────────────────────────────────── */}
      <Dialog open={showProdForm} onOpenChange={setShowProdForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-yellow-600" />
              {tc('دفعة إنتاج جديدة', 'New Production Batch')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs font-bold mb-1 block">{tc('اسم المنتج *', 'Product Name *')}</Label>
                <Input value={pName} onChange={e => setPName(e.target.value)} className="h-9 text-sm" placeholder={tc('مثال: عجينة الكرواسون', 'e.g. Croissant Dough')} data-testid="input-prod-name" />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">{tc('الكمية *', 'Quantity *')}</Label>
                <Input type="number" min={0} step={0.01} value={pQty} onChange={e => setPQty(e.target.value)} className="h-9 text-sm" placeholder="0.00" data-testid="input-prod-qty" />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">{tc('الوحدة', 'Unit')}</Label>
                <Select value={pUnit} onValueChange={setPUnit}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">{tc('التاريخ المجدول *', 'Planned Date *')}</Label>
                <Input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className="h-9 text-sm" data-testid="input-prod-date" />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">{tc('ملاحظات', 'Notes')}</Label>
                <Input value={pNotes} onChange={e => setPNotes(e.target.value)} className="h-9 text-sm" placeholder={tc('اختياري', 'Optional')} />
              </div>
            </div>

            <Separator />
            <Label className="text-xs font-bold block">{tc('المكونات المستهلكة', 'Ingredients Consumed')}</Label>
            <div className="flex gap-2">
              <Select value={pIngRaw} onValueChange={setPIngRaw}>
                <SelectTrigger className="flex-1 h-9 text-xs"><SelectValue placeholder={tc('مادة خام...', 'Raw material...')} /></SelectTrigger>
                <SelectContent>
                  {rawItems.filter(i => i.isActive === 1).map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" min={0} step={0.01} value={pIngQty} onChange={e => setPIngQty(e.target.value)} className="w-24 h-9 text-sm" placeholder={tc('الكمية', 'Qty')} data-testid="input-prod-ing-qty" />
              <Button size="sm" variant="outline" className="h-9" onClick={addIngredient} data-testid="button-add-ingredient">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {pIngredients.length > 0 && (
              <div className="space-y-1.5 border rounded-lg p-2">
                {pIngredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-bold">{ing.rawItemName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{ing.quantityUsed} {UNIT_LABELS[ing.unit] || ing.unit}</span>
                      <span className="text-primary font-bold">{((parseFloat(String(ing.quantityUsed)) || 0) * ing.unitCost).toFixed(2)} <SarIcon size={11} /></span>
                      <button onClick={() => setPIngredients(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:opacity-70">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <Separator className="my-1" />
                <div className="flex justify-between text-xs font-black">
                  <span>{tc('إجمالي التكلفة', 'Total Cost')}</span>
                  <span className="text-primary">{pIngredients.reduce((s, i) => s + (parseFloat(String(i.quantityUsed)) || 0) * i.unitCost, 0).toFixed(2)} <SarIcon size={11} /></span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowProdForm(false)}>{tc('إلغاء', 'Cancel')}</Button>
            <Button onClick={submitProduction} disabled={createProduction.isPending} data-testid="button-confirm-production">
              {createProduction.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Factory className="w-4 h-4 ml-2" />}
              {tc('إنشاء الدفعة', 'Create Batch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
