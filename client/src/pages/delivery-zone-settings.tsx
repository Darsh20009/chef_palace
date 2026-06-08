import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import SarIcon from "@/components/sar-icon";
import {
  MapPin, Plus, Trash2, Edit2, ArrowRight,
  Settings, Navigation, Clock, Package,
  ChevronRight, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle, Truck
} from "lucide-react";
import { nanoid } from "nanoid";

const RIYADH_DISTRICTS = [
  { nameAr: "حي العليا", nameEn: "Al Olaya", baseFee: 15, feePerKm: 2 },
  { nameAr: "حي النزهة", nameEn: "Al Nuzha", baseFee: 12, feePerKm: 2 },
  { nameAr: "حي الملقا", nameEn: "Al Malqa", baseFee: 18, feePerKm: 2.5 },
  { nameAr: "حي الورود", nameEn: "Al Wurud", baseFee: 12, feePerKm: 2 },
  { nameAr: "حي الروضة", nameEn: "Al Rawdah", baseFee: 14, feePerKm: 2 },
  { nameAr: "حي قرطبة", nameEn: "Qurtuba", baseFee: 16, feePerKm: 2.5 },
  { nameAr: "حي حطين", nameEn: "Hittin", baseFee: 20, feePerKm: 3 },
  { nameAr: "حي الشميسي", nameEn: "Al Shumaisi", baseFee: 10, feePerKm: 1.5 },
  { nameAr: "حي الديرة", nameEn: "Al Dirah", baseFee: 10, feePerKm: 1.5 },
  { nameAr: "حي البطحاء", nameEn: "Al Bathaa", baseFee: 10, feePerKm: 1.5 },
  { nameAr: "حي السليمانية", nameEn: "Al Sulaimaniya", baseFee: 13, feePerKm: 2 },
  { nameAr: "حي النسيم", nameEn: "Al Naseem", baseFee: 15, feePerKm: 2 },
  { nameAr: "حي المروج", nameEn: "Al Muruj", baseFee: 17, feePerKm: 2.5 },
  { nameAr: "حي الربيع", nameEn: "Al Rabee", baseFee: 22, feePerKm: 3 },
  { nameAr: "حي الياسمين", nameEn: "Al Yasmin", baseFee: 25, feePerKm: 3.5 },
  { nameAr: "حي الرحمانية", nameEn: "Al Rahmaniya", baseFee: 20, feePerKm: 3 },
  { nameAr: "حي أم الحمام", nameEn: "Umm Al Hamam", baseFee: 12, feePerKm: 2 },
  { nameAr: "حي عرقة", nameEn: "Irqah", baseFee: 20, feePerKm: 3 },
  { nameAr: "حي الخليج", nameEn: "Al Khaleej", baseFee: 18, feePerKm: 2.5 },
  { nameAr: "حي الضباب", nameEn: "Al Dhabab", baseFee: 22, feePerKm: 3 },
];

interface ZoneForm {
  nameAr: string;
  nameEn: string;
  zoneType: "district" | "radius";
  district: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  baseFee: string;
  feePerKm: string;
  minOrderAmount: string;
  freeDeliveryThreshold: string;
  estimatedMinMinutes: string;
  estimatedMaxMinutes: string;
}

const EMPTY_FORM: ZoneForm = {
  nameAr: "", nameEn: "", zoneType: "district", district: "",
  centerLat: "24.7136", centerLng: "46.6753", radiusKm: "5",
  baseFee: "15", feePerKm: "2", minOrderAmount: "0",
  freeDeliveryThreshold: "", estimatedMinMinutes: "20", estimatedMaxMinutes: "45",
};

export default function DeliveryZoneSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM);
  const [showPresetsSection, setShowPresetsSection] = useState(false);

  useEffect(() => { document.title = "إعدادات مناطق التوصيل"; }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/delivery/zones"],
    select: (d: any) => d?.zones || [],
  });
  const zones: any[] = data || [];
  const activeZones = zones.filter((z) => z.isActive === 1 || z.isActive === true);

  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/delivery/zones", body),
    onSuccess: () => {
      toast({ title: "✅ تمت إضافة المنطقة" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/zones"] });
      setIsDialogOpen(false);
      setEditingZone(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiRequest("PATCH", `/api/delivery/zones/${id}`, body),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث المنطقة" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/zones"] });
      setIsDialogOpen(false);
      setEditingZone(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/delivery/zones/${id}`),
    onSuccess: () => {
      toast({ title: "🗑️ تم حذف المنطقة" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/zones"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: number }) =>
      apiRequest("PATCH", `/api/delivery/zones/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/delivery/zones"] }),
  });

  function openCreate() {
    setEditingZone(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  }

  function openEdit(zone: any) {
    setEditingZone(zone);
    setForm({
      nameAr: zone.nameAr || "",
      nameEn: zone.nameEn || "",
      zoneType: zone.zoneType || "district",
      district: zone.district || "",
      centerLat: String(zone.centerLat || "24.7136"),
      centerLng: String(zone.centerLng || "46.6753"),
      radiusKm: String(zone.radiusKm || "5"),
      baseFee: String(zone.baseFee || "15"),
      feePerKm: String(zone.feePerKm || "2"),
      minOrderAmount: String(zone.minOrderAmount || "0"),
      freeDeliveryThreshold: String(zone.freeDeliveryThreshold || ""),
      estimatedMinMinutes: String(zone.estimatedMinMinutes || "20"),
      estimatedMaxMinutes: String(zone.estimatedMaxMinutes || "45"),
    });
    setIsDialogOpen(true);
  }

  function handlePreset(preset: typeof RIYADH_DISTRICTS[0]) {
    setForm({
      ...EMPTY_FORM,
      nameAr: preset.nameAr,
      nameEn: preset.nameEn,
      district: preset.nameAr,
      baseFee: String(preset.baseFee),
      feePerKm: String(preset.feePerKm),
      zoneType: "district",
    });
    setShowPresetsSection(false);
    setIsDialogOpen(true);
  }

  function handleSave() {
    const body = {
      id: editingZone?.id || nanoid(),
      branchId: "main-branch",
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      zoneType: form.zoneType,
      district: form.district,
      centerLat: parseFloat(form.centerLat) || 24.7136,
      centerLng: parseFloat(form.centerLng) || 46.6753,
      radiusKm: parseFloat(form.radiusKm) || 5,
      baseFee: parseFloat(form.baseFee) || 0,
      feePerKm: parseFloat(form.feePerKm) || 0,
      minOrderAmount: parseFloat(form.minOrderAmount) || 0,
      freeDeliveryThreshold: form.freeDeliveryThreshold ? parseFloat(form.freeDeliveryThreshold) : undefined,
      estimatedMinMinutes: parseInt(form.estimatedMinMinutes) || 20,
      estimatedMaxMinutes: parseInt(form.estimatedMaxMinutes) || 45,
      isActive: 1,
    };
    if (!body.nameAr) {
      toast({ title: "أدخل اسم المنطقة", variant: "destructive" });
      return;
    }
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-white text-gray-900" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => history.back()} className="text-gray-500 hover:text-gray-900">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-xl text-gray-900">إعدادات مناطق التوصيل</h1>
            <p className="text-gray-500 text-xs mt-0.5">الرياض — {zones.length} منطقة ({activeZones.length} نشطة)</p>
          </div>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 h-9 text-sm">
            <Plus className="w-4 h-4 ml-1.5" />
            منطقة جديدة
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-primary">{zones.length}</p>
            <p className="text-xs text-gray-600 mt-1">إجمالي المناطق</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-green-600">{activeZones.length}</p>
            <p className="text-xs text-gray-600 mt-1">مناطق نشطة</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-gray-700">{zones.length - activeZones.length}</p>
            <p className="text-xs text-gray-600 mt-1">مناطق معطلة</p>
          </div>
        </div>

        {/* Notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-900 text-sm font-semibold">كيف يعمل نظام مناطق التوصيل؟</p>
            <p className="text-blue-700 text-xs mt-1">عند اختيار العميل لموقعه على الخريطة، يُحسب سعر التوصيل تلقائياً بناءً على المنطقة. إذا كان الموقع خارج جميع المناطق النشطة، يظهر للعميل رسالة "خارج نطاق التوصيل".</p>
          </div>
        </div>

        {/* Presets */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <button
            onClick={() => setShowPresetsSection(!showPresetsSection)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-bold text-gray-900">أحياء الرياض الجاهزة</span>
              <Badge variant="secondary" className="text-xs">{RIYADH_DISTRICTS.length} حي</Badge>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showPresetsSection ? "rotate-90" : ""}`} />
          </button>
          {showPresetsSection && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RIYADH_DISTRICTS.map((d) => {
                const alreadyAdded = zones.some((z) => z.nameAr === d.nameAr || z.district === d.nameAr);
                return (
                  <button
                    key={d.nameAr}
                    onClick={() => !alreadyAdded && handlePreset(d)}
                    disabled={alreadyAdded}
                    className={`text-right p-3 rounded-lg border text-sm transition-all ${
                      alreadyAdded
                        ? "bg-green-50 border-green-200 text-green-700 cursor-not-allowed"
                        : "bg-white border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-900"
                    }`}
                  >
                    <p className="font-medium text-xs">{d.nameAr}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{d.baseFee} ر.س + {d.feePerKm}/كم</p>
                    {alreadyAdded && <p className="text-green-600 text-xs">✓ مضاف</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Zones List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <MapPin className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">لا توجد مناطق توصيل بعد</p>
            <p className="text-gray-400 text-sm">أضف مناطق التوصيل لتحديد أسعار التوصيل لكل منطقة</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={openCreate} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 ml-1.5" />
                إضافة منطقة
              </Button>
              <Button variant="outline" onClick={() => setShowPresetsSection(true)}>
                أحياء الرياض الجاهزة
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => {
              const isActive = zone.isActive === 1 || zone.isActive === true;
              return (
                <div key={zone.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${
                  isActive ? "border-gray-200" : "border-dashed border-gray-300 opacity-70"
                }`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{zone.nameAr}</span>
                          {zone.nameEn && <span className="text-gray-400 text-xs">{zone.nameEn}</span>}
                          <Badge variant={isActive ? "default" : "secondary"} className={`text-xs ${isActive ? "bg-green-100 text-green-700 border-green-200" : ""}`}>
                            {isActive ? "نشطة" : "معطلة"}
                          </Badge>
                          {zone.zoneType && (
                            <Badge variant="outline" className="text-xs">
                              {zone.zoneType === "district" ? "حي" : zone.zoneType === "radius" ? "دائرة" : zone.zoneType}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <p className="text-xs text-gray-500">رسوم أساسية</p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">{zone.baseFee} <SarIcon size={10} className="inline" /></p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <p className="text-xs text-gray-500">سعر الكيلو</p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">{zone.feePerKm} <SarIcon size={10} className="inline" /></p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <p className="text-xs text-gray-500">الحد الأدنى</p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">{zone.minOrderAmount || 0} <SarIcon size={10} className="inline" /></p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                            <p className="text-xs text-gray-500">الوقت</p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">{zone.estimatedMinMinutes}–{zone.estimatedMaxMinutes} د</p>
                          </div>
                        </div>

                        {zone.freeDeliveryThreshold > 0 && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            توصيل مجاني عند {zone.freeDeliveryThreshold} ر.س
                          </p>
                        )}

                        {zone.zoneType === "radius" && zone.radiusKm && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            نطاق {zone.radiusKm} كم من الفرع
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: zone.id, isActive: checked ? 1 : 0 })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(zone)}
                        className="h-8 text-xs"
                      >
                        <Edit2 className="w-3 h-3 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`هل تريد حذف منطقة "${zone.nameAr}"؟`)) {
                            deleteMutation.mutate(zone.id);
                          }
                        }}
                        className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingZone(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingZone ? `تعديل: ${editingZone.nameAr}` : "إضافة منطقة توصيل"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم المنطقة (عربي) *</Label>
                <Input
                  placeholder="حي العليا"
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اسم المنطقة (إنجليزي)</Label>
                <Input
                  placeholder="Al Olaya"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                />
              </div>
            </div>

            {/* Zone Type */}
            <div className="space-y-2">
              <Label className="text-xs">نوع المنطقة</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["district", "radius"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, zoneType: t })}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      form.zoneType === t
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    {t === "district" ? (
                      <><MapPin className="w-4 h-4 mx-auto mb-1" />حي / منطقة</>
                    ) : (
                      <><Navigation className="w-4 h-4 mx-auto mb-1" />دائرة بالكيلو</>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* District name if district type */}
            {form.zoneType === "district" && (
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الحي</Label>
                <Input
                  placeholder="حي العليا"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </div>
            )}

            {/* Radius fields */}
            {form.zoneType === "radius" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">خط العرض</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.centerLat}
                    onChange={(e) => setForm({ ...form, centerLat: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">خط الطول</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.centerLng}
                    onChange={(e) => setForm({ ...form, centerLng: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">النطاق (كم)</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.radiusKm}
                    onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <SarIcon size={14} />
                أسعار التوصيل
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الرسوم الأساسية (ر.س)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.baseFee}
                    onChange={(e) => setForm({ ...form, baseFee: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">سعر الكيلومتر (ر.س)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.feePerKm}
                    onChange={(e) => setForm({ ...form, feePerKm: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الحد الأدنى للطلب (ر.س)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">توصيل مجاني من (ر.س)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    placeholder="اتركه فارغاً لتعطيله"
                    value={form.freeDeliveryThreshold}
                    onChange={(e) => setForm({ ...form, freeDeliveryThreshold: e.target.value })}
                  />
                </div>
              </div>

              {/* Preview */}
              {form.baseFee && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-gray-700">
                  <p className="font-medium text-primary mb-1">مثال على الحساب:</p>
                  <p>توصيل 3 كم = {parseFloat(form.baseFee || "0") + 3 * parseFloat(form.feePerKm || "0")} ر.س</p>
                  <p>توصيل 7 كم = {parseFloat(form.baseFee || "0") + 7 * parseFloat(form.feePerKm || "0")} ر.س</p>
                  {form.freeDeliveryThreshold && <p className="text-green-600">توصيل مجاني عند طلب {form.freeDeliveryThreshold} ر.س+</p>}
                </div>
              )}
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">وقت التوصيل من (دقيقة)</Label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={form.estimatedMinMinutes}
                  onChange={(e) => setForm({ ...form, estimatedMinMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">وقت التوصيل إلى (دقيقة)</Label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={form.estimatedMaxMinutes}
                  onChange={(e) => setForm({ ...form, estimatedMaxMinutes: e.target.value })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isPending ? "جاري الحفظ..." : editingZone ? "حفظ التغييرات" : "إضافة المنطقة"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setIsDialogOpen(false); setEditingZone(null); setForm(EMPTY_FORM); }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
