import { useState, useEffect } from 'react';
import { useTranslate } from "@/lib/useTranslate";
import SarIcon from "@/components/sar-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Shield, Bell, Palette, Database, Plus, Store, Utensils, Coffee, AlertTriangle, Layout, ShieldAlert, Users, Loader2, Trash2, FolderTree, Flame, Snowflake, Star, Cake, Sparkles, GripVertical, Pencil, CreditCard, Wifi, WifiOff, Eye, EyeOff, ExternalLink, CheckCircle, XCircle, Banknote, Smartphone, Gift, Percent, Tag, Ticket, Download, Globe, Package, ChevronDown, ChevronUp, MonitorSmartphone, MapPin, Navigation, FlaskConical, ShoppingBag, Truck, Timer, Car, Clock, Zap, Volume2 } from 'lucide-react';
import { SoundSettingsPanel } from "@/components/sound-settings-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department: 'drinks' | 'food';
  orderIndex: number;
  isSystem?: boolean;
}

function ShiftTimeSettingsCard() {
  const tc = useTranslate();
  const { toast } = useToast();
  const { data: config } = useQuery<any>({ queryKey: ["/api/business-config"] });
  const [periods, setPeriods] = useState<Array<{start: number; end: number}>>([
    { start: 6, end: 18 },
    { start: 18, end: 6 },
  ]);
  const [tzOffset, setTzOffset] = useState<number>(3);
  const [manualLocalTime, setManualLocalTime] = useState("");
  const [computedOffset, setComputedOffset] = useState<number | null>(null);
  const [autoShiftsEnabled, setAutoShiftsEnabled] = useState<boolean>(true);
  const [dayShiftConfig, setDayShiftConfig] = useState<Record<number, Array<{start: number; end: number}>>>({});
  const [selectedDay, setSelectedDay] = useState<number>(-1);

  useEffect(() => {
    if (config?.shiftPeriods) setPeriods(config.shiftPeriods);
    if (config?.timezoneOffsetHours !== undefined) setTzOffset(Number(config.timezoneOffsetHours));
    if (config?.autoShiftsEnabled !== undefined) setAutoShiftsEnabled(config.autoShiftsEnabled);
    if (config?.dayShiftConfig) setDayShiftConfig(config.dayShiftConfig);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/business-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-config"] });
      toast({ title: tc("تم الحفظ", "Saved"), description: tc("تم تحديث إعدادات الورديات", "Shift settings updated") });
    },
    onError: () => toast({ title: tc("خطأ", "Error"), description: tc("فشل في الحفظ", "Save failed"), variant: "destructive" }),
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Current server UTC time
  const nowUtc = new Date();
  const currentComputedLocal = new Date(nowUtc.getTime() + tzOffset * 3600000);
  const computedLocalStr = currentComputedLocal.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });

  const handleComputeOffset = () => {
    if (!manualLocalTime) return;
    const [hStr, mStr] = manualLocalTime.split(':');
    const localH = Number(hStr);
    const localM = Number(mStr) || 0;
    const utcH = nowUtc.getUTCHours();
    const utcM = nowUtc.getUTCMinutes();
    let diff = (localH * 60 + localM) - (utcH * 60 + utcM);
    if (diff > 14 * 60) diff -= 24 * 60;
    if (diff < -14 * 60) diff += 24 * 60;
    const offsetHours = Math.round(diff / 60 * 2) / 2;
    setComputedOffset(offsetHours);
    setTzOffset(offsetHours);
    toast({ title: tc("تم الحساب", "Computed"), description: tc(`فارق التوقيت: UTC+${offsetHours}`, `Timezone offset: UTC+${offsetHours}`) });
  };

  return (
    <Card className="hover-elevate border-primary/10">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{tc("إعدادات الورديات التلقائية", "Automatic Shift Settings")}</CardTitle>
            <CardDescription>{tc("حدد أوقات الورديات وضبط التوقيت المحلي للمكان", "Define shift times and set the local timezone")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Timezone Offset Section ── */}
        <div className="border rounded-lg p-4 space-y-3 bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Clock className="w-4 h-4" />
            {tc("ضبط التوقيت المحلي", "Local Timezone Setup")}
          </div>
          <p className="text-xs text-muted-foreground">{tc("إذا كانت حسابات الوردية تظهر في وقت خاطئ، أدخل الوقت الحالي في مكانك لضبط الفارق تلقائياً.", "If shift calculations show the wrong time, enter your current local time to compute the offset automatically.")}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{tc("فارق التوقيت الحالي (ساعات)", "Current timezone offset (hours)")}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.5"
                  min="-12"
                  max="14"
                  value={tzOffset}
                  onChange={e => setTzOffset(Number(e.target.value))}
                  className="w-24 text-center font-mono"
                  dir="ltr"
                />
                <span className="text-xs text-muted-foreground">UTC +</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{tc("الوقت المحلي المحسوب الآن", "Current computed local time")}</label>
              <div className="flex items-center gap-2 h-10 border rounded-md px-3 bg-muted/30 font-mono text-sm text-foreground">
                {computedLocalStr}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">{tc("الوقت الحالي في مكانك (أدخله لحساب الفارق)", "Your current local time (enter to compute offset)")}</label>
              <Input
                type="time"
                value={manualLocalTime}
                onChange={e => setManualLocalTime(e.target.value)}
                className="font-mono"
                dir="ltr"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleComputeOffset} className="gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {tc("حساب الفارق", "Compute Offset")}
            </Button>
          </div>

          {computedOffset !== null && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded p-2 text-xs text-green-700 dark:text-green-300">
              {tc(`✓ الفارق المحسوب: UTC+${computedOffset} — سيُطبَّق على الورديات التلقائية عند الحفظ`, `✓ Computed offset: UTC+${computedOffset} — will be applied to auto shifts on save`)}
            </div>
          )}
        </div>

        {/* ── Shift Periods ── */}
        <div className="space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            {tc("فترات الورديات", "Shift Periods")}
          </div>
          {periods.map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
              <Zap className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-sm font-medium shrink-0">{tc(`وردية ${i + 1}`, `Shift ${i + 1}`)}</span>
              <div className="flex items-center gap-2 flex-1">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{tc("من", "From")}</label>
                  <select
                    value={p.start}
                    onChange={e => {
                      const updated = [...periods];
                      updated[i] = { ...updated[i], start: Number(e.target.value) };
                      setPeriods(updated);
                    }}
                    className="border rounded px-2 py-1 text-sm bg-background w-20"
                  >
                    {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                  </select>
                </div>
                <span className="text-muted-foreground mt-4">—</span>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{tc("إلى", "To")}</label>
                  <select
                    value={p.end}
                    onChange={e => {
                      const updated = [...periods];
                      updated[i] = { ...updated[i], end: Number(e.target.value) };
                      setPeriods(updated);
                    }}
                    className="border rounded px-2 py-1 text-sm bg-background w-20"
                  >
                    {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                  </select>
                </div>
                {p.end < p.start && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mt-4">{tc("تمتد لليوم التالي", "Extends to next day")}</span>
                )}
              </div>
              {periods.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:bg-red-50 shrink-0 mt-4"
                  onClick={() => setPeriods(periods.filter((_, j) => j !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPeriods([...periods, { start: 0, end: 12 }])}
          >
            <Plus className="w-4 h-4" />
            {tc("إضافة وردية", "Add Shift")}
          </Button>
          <Button
            size="sm"
            className="gap-2"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ shiftPeriods: periods, timezoneOffsetHours: tzOffset, autoShiftsEnabled, dayShiftConfig })}
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? tc("جاري الحفظ...", "Saving...") : tc("حفظ الإعدادات", "Save Settings")}
          </Button>
        </div>

        {/* ── Auto-shifts enable/disable toggle ── */}
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{tc("الورديات التلقائية", "Automatic Shifts")}</p>
              <p className="text-xs text-muted-foreground">{tc("تعطيل هذا الخيار يجعل الورديات يدوية فقط", "Disabling this makes shifts manual-only")}</p>
            </div>
            <Switch checked={autoShiftsEnabled} onCheckedChange={setAutoShiftsEnabled} />
          </div>
          {!autoShiftsEnabled && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Clock className="w-3 h-3 shrink-0" />
              {tc("الورديات التلقائية معطّلة — يجب فتح وردية يدوياً من شاشة الكاشير", "Auto-shifts disabled — cashier must open shifts manually")}
            </div>
          )}
        </div>

        {/* ── Per-day shift configuration ── */}
        <div className="space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Timer className="w-4 h-4 text-purple-500" />
            {tc("جدول الورديات حسب اليوم", "Per-Day Shift Schedule")}
          </div>
          <p className="text-xs text-muted-foreground">{tc("اختر يوماً لتخصيص أوقات ورديات مختلفة عن الافتراضي. أيام بدون تخصيص تستخدم الأوقات الافتراضية أعلاه.", "Select a day to set custom shift times. Days without custom config use the default periods above.")}</p>
          {(() => {
            const dayNames: Record<number, string> = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' };
            const dayNamesEn: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
            const currentDayPeriods: Array<{start: number; end: number}> = selectedDay === -1 ? periods : (dayShiftConfig[selectedDay] || []);
            const setCurrentDayPeriods = (newPeriods: Array<{start: number; end: number}>) => {
              if (selectedDay === -1) setPeriods(newPeriods);
              else setDayShiftConfig(prev => ({ ...prev, [selectedDay]: newPeriods }));
            };
            const resetDay = (day: number) => setDayShiftConfig(prev => { const next = {...prev}; delete next[day]; return next; });
            return (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedDay(-1)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${selectedDay === -1 ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'}`}
                  >{tc("الافتراضي", "Default")}</button>
                  {[0,1,2,3,4,5,6].map(day => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors relative ${selectedDay === day ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'}`}
                    >
                      {tc(dayNames[day], dayNamesEn[day])}
                      {dayShiftConfig[day] && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500" />
                      )}
                    </button>
                  ))}
                </div>
                {selectedDay !== -1 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{tc(`إعدادات: ${dayNames[selectedDay]}`, `Settings: ${dayNamesEn[selectedDay]}`)}</span>
                    {dayShiftConfig[selectedDay] && (
                      <button onClick={() => resetDay(selectedDay)} className="text-red-500 underline text-[10px]">
                        {tc("إعادة للافتراضي", "Reset to default")}
                      </button>
                    )}
                  </div>
                )}
                {currentDayPeriods.length === 0 && selectedDay !== -1 && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3 text-center">
                    {tc("هذا اليوم يستخدم الأوقات الافتراضية — أضف وردية لتخصيصه", "This day uses default times — add a shift to customize")}
                  </div>
                )}
                {currentDayPeriods.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                    <Timer className="w-4 h-4 text-purple-500 shrink-0" />
                    <span className="text-sm font-medium shrink-0">{tc(`وردية ${i + 1}`, `Shift ${i + 1}`)}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">{tc("من", "From")}</label>
                        <select value={p.start} onChange={e => { const u=[...currentDayPeriods]; u[i]={...u[i],start:Number(e.target.value)}; setCurrentDayPeriods(u); }} className="border rounded px-2 py-1 text-sm bg-background w-20">
                          {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                        </select>
                      </div>
                      <span className="text-muted-foreground mt-4">—</span>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">{tc("إلى", "To")}</label>
                        <select value={p.end} onChange={e => { const u=[...currentDayPeriods]; u[i]={...u[i],end:Number(e.target.value)}; setCurrentDayPeriods(u); }} className="border rounded px-2 py-1 text-sm bg-background w-20">
                          {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                        </select>
                      </div>
                      {p.end < p.start && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mt-4">{tc("تمتد لليوم التالي", "Extends to next day")}</span>
                      )}
                    </div>
                    {currentDayPeriods.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50 shrink-0 mt-4" onClick={() => setCurrentDayPeriods(currentDayPeriods.filter((_,j)=>j!==i))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(selectedDay === -1 || dayShiftConfig[selectedDay] !== undefined || currentDayPeriods.length === 0) && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setCurrentDayPeriods([...currentDayPeriods, { start: 0, end: 12 }])}>
                    <Plus className="w-4 h-4" />
                    {tc("إضافة وردية", "Add Shift")}
                  </Button>
                )}
                {selectedDay !== -1 && currentDayPeriods.length === 0 && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setCurrentDayPeriods([{ start: 0, end: 12 }])}>
                    <Plus className="w-4 h-4" />
                    {tc("إضافة وردية مخصصة", "Add custom shift")}
                  </Button>
                )}
              </>
            );
          })()}
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Zap className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{tc("الورديات التلقائية تُحسب من الطلبات المُسجَّلة في كل فترة. ضبط التوقيت يضمن أن الوردية تبدأ وتنتهي في الوقت الصحيح حسب موقعك.", "Automatic shifts are calculated from orders recorded in each period. Setting the timezone ensures shifts start and end at the correct local time.")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSettings() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  const { data: menuCategories = [], isLoading: categoriesLoading } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-categories"],
  });

  const drinkCategories = menuCategories.filter(c => c.department === 'drinks' || !c.department);
  const foodCategories = menuCategories.filter(c => c.department === 'food');

  // Debug for Admin Category Logic
  console.log('Admin Categories:', {
    total: menuCategories.length,
    drinks: drinkCategories.map(c => c.nameAr),
    food: foodCategories.map(c => c.nameAr)
  });

  const { data: pgConfig, isLoading: pgLoading } = useQuery<any>({
    queryKey: ["/api/payment-gateway/config"],
  });

  const [pgProvider, setPgProvider] = useState<string>('none');
  const [pgCashEnabled, setPgCashEnabled] = useState(true);
  const [pgCashMaxDistance, setPgCashMaxDistance] = useState(0);
  const [pgStoreLocationLat, setPgStoreLocationLat] = useState("");
  const [pgStoreLocationLng, setPgStoreLocationLng] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [pgPosEnabled, setPgPosEnabled] = useState(true);
  const [pgQahwaCardEnabled, setPgQahwaCardEnabled] = useState(true);
  const [pgBankTransferEnabled, setPgBankTransferEnabled] = useState(false);
  const [pgBankIban, setPgBankIban] = useState("");
  const [pgBankName, setPgBankName] = useState("");
  const [pgBankAccountHolder, setPgBankAccountHolder] = useState("");
  const [pgStcPayEnabled, setPgStcPayEnabled] = useState(false);
  const [pgPaymentTestMode, setPgPaymentTestMode] = useState(false);
  const [pgCustomPaymentMethods, setPgCustomPaymentMethods] = useState<any[]>([]);
  const [showAddCustomMethod, setShowAddCustomMethod] = useState(false);
  const [newCustomMethod, setNewCustomMethod] = useState({ nameAr: '', nameEn: '', icon: '💳', enabledForCustomer: true, enabledForPos: true });
  const [editCustomMethodId, setEditCustomMethodId] = useState<string | null>(null);
  const [neoleapClientId, setNeoleapClientId] = useState("");
  const [neoleapClientSecret, setNeoleapClientSecret] = useState("");
  const [neoleapMerchantId, setNeoleapMerchantId] = useState("");
  const [neoleapBaseUrl, setNeoleapBaseUrl] = useState("https://api.neoleap.com.sa");
  const [geideaPublicKey, setGeideaPublicKey] = useState("");
  const [geideaApiPassword, setGeideaApiPassword] = useState("");
  const [geideaBaseUrl, setGeideaBaseUrl] = useState("https://api.merchant.geidea.net");
  const [geideaDiagResult, setGeideaDiagResult] = useState<any>(null);
  const [geideaDiagLoading, setGeideaDiagLoading] = useState(false);
  const [paymobApiKey, setPaymobApiKey] = useState("");
  const [paymobIntegrationId, setPaymobIntegrationId] = useState("");
  const [paymobIframeId, setPaymobIframeId] = useState("");
  const [paymobWalletIntegrationId, setPaymobWalletIntegrationId] = useState("");
  const [paymobHmacSecret, setPaymobHmacSecret] = useState("");
  const [paymobCallbackUrl, setPaymobCallbackUrl] = useState("");
  const [paymobSecretKey, setPaymobSecretKey] = useState("");
  const [paymobPublicKey, setPaymobPublicKey] = useState("");
  const [paymobBaseUrl, setPaymobBaseUrl] = useState("https://ksa.paymob.com");
  const [paymobIntegrationIds, setPaymobIntegrationIds] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (pgConfig) {
      setPgProvider(pgConfig.provider || 'none');
      setPgCashEnabled(pgConfig.cashEnabled !== false);
      setPgCashMaxDistance(pgConfig.cashMaxDistance || 0);
      setPgStoreLocationLat(pgConfig.storeLocation?.lat ? String(pgConfig.storeLocation.lat) : "");
      setPgStoreLocationLng(pgConfig.storeLocation?.lng ? String(pgConfig.storeLocation.lng) : "");
      setPgPosEnabled(pgConfig.posEnabled !== false);
      setPgQahwaCardEnabled(pgConfig.qahwaCardEnabled !== false);
      setPgBankTransferEnabled(pgConfig.bankTransferEnabled || false);
      setPgBankIban(pgConfig.bankIban || '');
      setPgBankName(pgConfig.bankName || '');
      setPgBankAccountHolder(pgConfig.bankAccountHolder || '');
      setPgStcPayEnabled(pgConfig.stcPayEnabled || false);
      setPgPaymentTestMode(pgConfig.paymentTestMode || false);
      setPgCustomPaymentMethods(pgConfig.customPaymentMethods || []);
      if (pgConfig.neoleap) {
        setNeoleapMerchantId(pgConfig.neoleap.merchantId || '');
        setNeoleapBaseUrl(pgConfig.neoleap.baseUrl || 'https://api.neoleap.com.sa');
      }
      if (pgConfig.geidea) {
        setGeideaBaseUrl(pgConfig.geidea.baseUrl || 'https://api.merchant.geidea.net');
      }
      if (pgConfig.paymob) {
        setPaymobIntegrationId(pgConfig.paymob.integrationId || '');
        setPaymobIframeId(pgConfig.paymob.iframeId || '');
        setPaymobWalletIntegrationId(pgConfig.paymob.walletIntegrationId || '');
        setPaymobCallbackUrl(pgConfig.paymob.callbackUrl || '');
        setPaymobPublicKey(pgConfig.paymob.publicKey || '');
        setPaymobBaseUrl(pgConfig.paymob.baseUrl || 'https://ksa.paymob.com');
        setPaymobIntegrationIds((pgConfig.paymob.integrationIds || []).join(', '));
      }
    }
  }, [pgConfig]);

  const pgMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest("PATCH", "/api/payment-gateway/config", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-gateway/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({ title: tc("تم الحفظ","Saved"), description: tc("تم حفظ إعدادات الدفع بنجاح","Payment settings saved successfully") });
    },
    onError: (error: Error) => {
      toast({ title: tc("خطأ","Error"), description: error.message, variant: "destructive" });
    },
  });

  const handleSavePaymentConfig = () => {
    const updates: any = {
      provider: pgProvider,
      cashEnabled: pgCashEnabled,
      cashMaxDistance: pgCashMaxDistance,
      posEnabled: pgPosEnabled,
      qahwaCardEnabled: pgQahwaCardEnabled,
      bankTransferEnabled: pgBankTransferEnabled,
      bankIban: pgBankIban,
      bankName: pgBankName,
      bankAccountHolder: pgBankAccountHolder,
      stcPayEnabled: pgStcPayEnabled,
      paymentTestMode: pgPaymentTestMode,
      customPaymentMethods: pgCustomPaymentMethods,
    };
    if (pgStoreLocationLat && pgStoreLocationLng) {
      updates.storeLocationLat = parseFloat(pgStoreLocationLat);
      updates.storeLocationLng = parseFloat(pgStoreLocationLng);
    }

    if (neoleapClientId && !neoleapClientId.startsWith('****')) updates.neoleapClientId = neoleapClientId;
    if (neoleapClientSecret && !neoleapClientSecret.startsWith('****')) updates.neoleapClientSecret = neoleapClientSecret;
    if (neoleapMerchantId) updates.neoleapMerchantId = neoleapMerchantId;
    if (neoleapBaseUrl) updates.neoleapBaseUrl = neoleapBaseUrl;
    if (geideaPublicKey && !geideaPublicKey.startsWith('****')) updates.geideaPublicKey = geideaPublicKey;
    if (geideaApiPassword && !geideaApiPassword.startsWith('****')) updates.geideaApiPassword = geideaApiPassword;
    if (geideaBaseUrl) updates.geideaBaseUrl = geideaBaseUrl;

    if (paymobApiKey && !paymobApiKey.startsWith('****')) updates.paymobApiKey = paymobApiKey;
    if (paymobIntegrationId) updates.paymobIntegrationId = paymobIntegrationId;
    if (paymobIframeId) updates.paymobIframeId = paymobIframeId;
    updates.paymobWalletIntegrationId = paymobWalletIntegrationId;
    if (paymobHmacSecret && !paymobHmacSecret.startsWith('****')) updates.paymobHmacSecret = paymobHmacSecret;
    updates.paymobCallbackUrl = paymobCallbackUrl;
    if (paymobSecretKey && !paymobSecretKey.startsWith('****')) updates.paymobSecretKey = paymobSecretKey;
    if (paymobPublicKey) updates.paymobPublicKey = paymobPublicKey;
    if (paymobBaseUrl) updates.paymobBaseUrl = paymobBaseUrl;
    updates.paymobIntegrationIds = paymobIntegrationIds.split(',').map(s => s.trim()).filter(Boolean);

    pgMutation.mutate(updates);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/payment-gateway/test", {});
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: tc("فشل في الاتصال","Connection failed") });
    } finally {
      setIsTesting(false);
    }
  };

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryNameEn, setNewCategoryNameEn] = useState("");
  const [newCategoryDepartment, setNewCategoryDepartment] = useState<'drinks' | 'food'>('drinks');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Coffee');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editDepartment, setEditDepartment] = useState<'drinks' | 'food'>('drinks');
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory | null>(null);
  const [categoryItemsPreview, setCategoryItemsPreview] = useState<Array<{nameAr: string; category: string}>>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [isEmergencyClosed, setIsEmergencyClosed] = useState(false);
  const [storeHours, setStoreHours] = useState<any>(null);
  const [systemCountry, setSystemCountry] = useState("SA");
  const [systemTimezone, setSystemTimezone] = useState("Asia/Riyadh");
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    twitter: '',
    facebook: '',
    snapchat: '',
    tiktok: '',
    whatsapp: '',
  });
  const [menuLayout, setMenuLayout] = useState<'classic' | 'cards' | 'list'>('classic');
  const [cashierLayout, setCashierLayout] = useState<'classic' | 'pos' | 'split'>('classic');

  const mutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest("PATCH", "/api/business-config", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-config"] });
      toast({
        title: tc("تم التحديث","Updated"),
        description: tc("تم حفظ التغييرات بنجاح","Changes saved successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ","Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (config) {
      setIsEmergencyClosed(config.isEmergencyClosed || false);
      setStoreHours(config.storeHours || null);
      setSystemCountry(config.country || 'SA');
      setSystemTimezone(config.timezone || 'Asia/Riyadh');
      setSocialLinks(config.socialLinks || {
        instagram: '',
        twitter: '',
        facebook: '',
        snapchat: '',
        tiktok: '',
        whatsapp: '',
      });
      setMenuLayout(config.menuLayout || 'classic');
      setCashierLayout(config.cashierLayout || 'classic');
    }
  }, [config]);

  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(true);
  const [serviceFeeAmount, setServiceFeeAmount] = useState(0.70);
  const [serviceFeeLowOrderThreshold, setServiceFeeLowOrderThreshold] = useState(5.00);
  const [serviceFeeLowOrderAmount, setServiceFeeLowOrderAmount] = useState(0.35);

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [pointsPerDrink, setPointsPerDrink] = useState(10);
  const [pointsPerSar, setPointsPerSar] = useState(20);
  const [pointsEarnedPerSar, setPointsEarnedPerSar] = useState(1);
  const [minPointsForRedemption, setMinPointsForRedemption] = useState(100);
  const [pointsForFreeDrink, setPointsForFreeDrink] = useState(500);

  const [firstOrderEnabled, setFirstOrderEnabled] = useState(true);
  const [firstOrderDiscountType, setFirstOrderDiscountType] = useState<'percent' | 'amount'>('percent');
  const [firstOrderValue, setFirstOrderValue] = useState(15);
  const [firstOrderExpiresDays, setFirstOrderExpiresDays] = useState(7);

  const [comebackEnabled, setComebackEnabled] = useState(true);
  const [comebackDiscountType, setComebackDiscountType] = useState<'percent' | 'amount'>('percent');
  const [comebackValue, setComebackValue] = useState(10);
  const [comebackMinOrders, setComebackMinOrders] = useState(1);
  const [comebackMaxOrders, setComebackMaxOrders] = useState(4);
  const [comebackExpiresDays, setComebackExpiresDays] = useState(3);

  const [frequentEnabled, setFrequentEnabled] = useState(true);
  const [frequentDiscountType, setFrequentDiscountType] = useState<'percent' | 'amount'>('percent');
  const [frequentValue, setFrequentValue] = useState(20);
  const [frequentMinOrders, setFrequentMinOrders] = useState(5);

  const [specialDrinkEnabled, setSpecialDrinkEnabled] = useState(true);
  const [specialDrinkDiscountType, setSpecialDrinkDiscountType] = useState<'percent' | 'amount'>('percent');
  const [specialDrinkValue, setSpecialDrinkValue] = useState(25);

  const [pointsRedemptionEnabled, setPointsRedemptionEnabled] = useState(true);
  const [pointsRedemptionMinPoints, setPointsRedemptionMinPoints] = useState(100);

  useEffect(() => {
    setServiceFeeEnabled(config?.serviceFeeEnabled ?? true);
    setServiceFeeAmount(config?.serviceFeeAmount ?? 0.70);
    setServiceFeeLowOrderThreshold(config?.serviceFeeLowOrderThreshold ?? 5.00);
    setServiceFeeLowOrderAmount(config?.serviceFeeLowOrderAmount ?? 0.35);
    if (config?.loyaltyConfig) {
      setLoyaltyEnabled(config.loyaltyConfig.enabled ?? true);
      setPointsPerDrink(config.loyaltyConfig.pointsPerDrink ?? 10);
      setPointsPerSar(config.loyaltyConfig.pointsPerSar ?? 20);
      setPointsEarnedPerSar(config.loyaltyConfig.pointsEarnedPerSar ?? 1);
      setMinPointsForRedemption(config.loyaltyConfig.minPointsForRedemption ?? 100);
      setPointsForFreeDrink(config.loyaltyConfig.pointsForFreeDrink ?? 500);
    }
    if (config?.offersConfig) {
      const oc = config.offersConfig;
      if (oc.firstOrderDiscount) {
        setFirstOrderEnabled(oc.firstOrderDiscount.enabled ?? true);
        setFirstOrderDiscountType(oc.firstOrderDiscount.discountType ?? 'percent');
        setFirstOrderValue(oc.firstOrderDiscount.value ?? 15);
        setFirstOrderExpiresDays(oc.firstOrderDiscount.expiresDays ?? 7);
      }
      if (oc.comebackDiscount) {
        setComebackEnabled(oc.comebackDiscount.enabled ?? true);
        setComebackDiscountType(oc.comebackDiscount.discountType ?? 'percent');
        setComebackValue(oc.comebackDiscount.value ?? 10);
        setComebackMinOrders(oc.comebackDiscount.minOrders ?? 1);
        setComebackMaxOrders(oc.comebackDiscount.maxOrders ?? 4);
        setComebackExpiresDays(oc.comebackDiscount.expiresDays ?? 3);
      }
      if (oc.frequentDiscount) {
        setFrequentEnabled(oc.frequentDiscount.enabled ?? true);
        setFrequentDiscountType(oc.frequentDiscount.discountType ?? 'percent');
        setFrequentValue(oc.frequentDiscount.value ?? 20);
        setFrequentMinOrders(oc.frequentDiscount.minOrders ?? 5);
      }
      if (oc.specialDrinkDiscount) {
        setSpecialDrinkEnabled(oc.specialDrinkDiscount.enabled ?? true);
        setSpecialDrinkDiscountType(oc.specialDrinkDiscount.discountType ?? 'percent');
        setSpecialDrinkValue(oc.specialDrinkDiscount.value ?? 25);
      }
      if (oc.pointsRedemption) {
        setPointsRedemptionEnabled(oc.pointsRedemption.enabled ?? true);
        setPointsRedemptionMinPoints(oc.pointsRedemption.minPoints ?? 100);
      }
    }
  }, [config]);

  const handleSaveLoyaltyOffers = () => {
    mutation.mutate({
      loyaltyConfig: {
        enabled: loyaltyEnabled,
        pointsPerDrink,
        pointsPerSar,
        pointsEarnedPerSar,
        minPointsForRedemption,
        pointsForFreeDrink,
      },
      offersConfig: {
        firstOrderDiscount: {
          enabled: firstOrderEnabled,
          discountType: firstOrderDiscountType,
          value: firstOrderValue,
          expiresDays: firstOrderExpiresDays,
        },
        comebackDiscount: {
          enabled: comebackEnabled,
          discountType: comebackDiscountType,
          value: comebackValue,
          minOrders: comebackMinOrders,
          maxOrders: comebackMaxOrders,
          expiresDays: comebackExpiresDays,
        },
        frequentDiscount: {
          enabled: frequentEnabled,
          discountType: frequentDiscountType,
          value: frequentValue,
          minOrders: frequentMinOrders,
        },
        specialDrinkDiscount: {
          enabled: specialDrinkEnabled,
          discountType: specialDrinkDiscountType,
          value: specialDrinkValue,
        },
        pointsRedemption: {
          enabled: pointsRedemptionEnabled,
          minPoints: pointsRedemptionMinPoints,
        },
      },
    });
  };

  const { data: discountCodes = [], isLoading: codesLoading } = useQuery<any[]>({
    queryKey: ["/api/discount-codes"],
  });

  const [newCodeDialogOpen, setNewCodeDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCodeType, setNewCodeType] = useState<'percent' | 'amount'>('percent');
  const [newCodeValue, setNewCodeValue] = useState(10);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(100);
  const [newCodeVisible, setNewCodeVisible] = useState(false);
  const [showAppGuide, setShowAppGuide] = useState(false);

  const createCodeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/discount-codes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-codes"] });
      setNewCodeDialogOpen(false);
      setNewCode("");
      setNewCodeType('percent');
      setNewCodeValue(10);
      setNewCodeMaxUses(100);
      setNewCodeVisible(true);
      toast({ title: tc("تم إنشاء كود الخصم بنجاح","Discount code created successfully") });
    },
    onError: (error: Error) => {
      toast({ title: tc("خطأ","Error"), description: error.message, variant: "destructive" });
    },
  });

  const toggleCodeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/discount-codes/${id}`, { isActive: isActive ? 1 : 0, employeeId: 'admin' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-codes"] });
      toast({ title: tc("تم تحديث حالة الكود","Code status updated") });
    },
    onError: (error: Error) => {
      toast({ title: tc("خطأ","Error"), description: error.message, variant: "destructive" });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, visibleToCustomers }: { id: string; visibleToCustomers: boolean }) => {
      const res = await apiRequest("PATCH", `/api/discount-codes/${id}`, { visibleToCustomers, employeeId: 'admin' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discount-codes"] });
      toast({ title: tc("تم تحديث ظهور الكود","Code visibility updated") });
    },
    onError: (error: Error) => {
      toast({ title: tc("خطأ","Error"), description: error.message, variant: "destructive" });
    },
  });

  const handleCreateCode = () => {
    createCodeMutation.mutate({
      code: newCode.toUpperCase(),
      discountPercentage: newCodeType === 'percent' ? newCodeValue : 0,
      discountType: newCodeType,
      value: newCodeValue,
      maxUses: newCodeMaxUses,
      reason: `كود خصم - ${newCodeType === 'percent' ? newCodeValue + '%' : newCodeValue + ' ريال'}`,
      employeeId: 'admin',
      isActive: 1,
      visibleToCustomers: newCodeVisible,
    });
  };

  const handleSaveStoreManagement = () => {
    // Construct the payload correctly for Mongoose Map
    const payload: any = {
      isEmergencyClosed,
      socialLinks,
      country: systemCountry,
      timezone: systemTimezone,
    };

    if (storeHours) {
      payload.storeHours = storeHours;
    }

    mutation.mutate(payload);
  };

  const daysAr: Record<string, string> = {
    monday: tc("الإثنين", "Monday"),
    tuesday: tc("الثلاثاء", "Tuesday"),
    wednesday: tc("الأربعاء", "Wednesday"),
    thursday: tc("الخميس", "Thursday"),
    friday: tc("الجمعة", "Friday"),
    saturday: tc("السبت", "Saturday"),
    sunday: tc("الأحد", "Sunday"),
  };

  const [activeTab, setActiveTab] = useState<string>('store');
  const settingsTabs = [
    { key: 'store',      labelAr: 'المتجر',     labelEn: 'Store',      icon: Store },
    { key: 'operations', labelAr: 'التشغيل',    labelEn: 'Operations', icon: Truck },
    { key: 'menu',       labelAr: 'القائمة',    labelEn: 'Menu',       icon: Utensils },
    { key: 'payments',   labelAr: 'الدفع',      labelEn: 'Payments',   icon: CreditCard },
    { key: 'loyalty',    labelAr: 'الولاء',     labelEn: 'Loyalty',    icon: Gift },
    { key: 'sounds',     labelAr: 'الأصوات',    labelEn: 'Sounds',     icon: Volume2 },
  ];

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { nameAr: string; nameEn?: string; icon?: string; department: string }) => {
      return apiRequest("POST", "/api/menu-categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-categories"] });
      setIsAddingCategory(false);
      setNewCategoryName("");
      setNewCategoryNameEn("");
      setNewCategoryDepartment('drinks');
      setNewCategoryIcon('Coffee');
      toast({ title: tc("تم إضافة القسم الفرعي بنجاح","Sub-category added successfully") });
    },
    onError: () => {
      toast({ title: tc("فشل في إضافة القسم","Failed to add category"), variant: "destructive" });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/menu-categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-categories"] });
      setEditingCategoryId(null);
      toast({ title: tc("تم تحديث القسم بنجاح","Category updated successfully") });
    },
    onError: () => {
      toast({ title: tc("فشل في تحديث القسم","Failed to update category"), variant: "destructive" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const res = await apiRequest("DELETE", `/api/menu-categories/${categoryId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-categories"] });
      setDeletingCategory(null);
      const moved = data?.reassignedCount || 0;
      toast({
        title: tc("تم حذف القسم بنجاح","Category deleted successfully"),
        description: moved > 0
          ? tc(`تم نقل ${moved} صنف إلى أقسام مناسبة تلقائياً`, `${moved} item(s) automatically moved to suitable categories`)
          : tc("لم تكن هناك أصناف في هذا القسم","There were no items in this category"),
        className: "bg-green-600 text-white"
      });
    },
    onError: (error: any) => {
      const msg = error?.message || tc("فشل في حذف القسم","Failed to delete category");
      toast({ title: msg, variant: "destructive" });
    }
  });

  const openDeleteCategoryDialog = async (cat: MenuCategory) => {
    setDeletingCategory(cat);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/coffee-items/category/${encodeURIComponent(cat.id)}`);
      const data = await res.json();
      setCategoryItemsPreview(Array.isArray(data) ? data : []);
    } catch {
      setCategoryItemsPreview([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const iconOptions = [
    { value: 'Coffee', label: tc('قهوة','Coffee'), Icon: Coffee },
    { value: 'Flame', label: tc('ساخن','Hot'), Icon: Flame },
    { value: 'Snowflake', label: tc('بارد','Cold'), Icon: Snowflake },
    { value: 'Star', label: tc('مميز','Featured'), Icon: Star },
    { value: 'Cake', label: tc('حلويات','Desserts'), Icon: Cake },
    { value: 'Utensils', label: tc('مأكولات','Food'), Icon: Utensils },
    { value: 'Sparkles', label: tc('خاص','Special'), Icon: Sparkles },
  ];

  const getIconComponent = (iconName: string) => {
    const found = iconOptions.find(i => i.value === iconName);
    return found ? found.Icon : Coffee;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-background min-h-screen" dir={tc('rtl','ltr')}>

      {/* Smart Delete Category Dialog */}
      <Dialog open={!!deletingCategory} onOpenChange={(open) => { if (!open) setDeletingCategory(null); }}>
        <DialogContent className="max-w-md" dir={tc('rtl','ltr')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              {tc(`حذف القسم: ${deletingCategory?.nameAr || ''}`, `Delete Category: ${deletingCategory?.nameEn || deletingCategory?.nameAr || ''}`)}
            </DialogTitle>
            <DialogDescription>
              {tc("سيتم نقل الأصناف الموجودة في هذا القسم تلقائياً إلى أقسام مناسبة بناءً على نوعها.",
                  "Items in this category will be automatically moved to suitable categories based on their type.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
                {tc("جاري فحص الأصناف...","Scanning items...")}
              </div>
            ) : categoryItemsPreview.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {tc("لا توجد أصناف في هذا القسم، يمكن الحذف بأمان.","No items in this category — safe to delete.")}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {tc(`${categoryItemsPreview.length} صنف سيتم نقله تلقائياً:`, `${categoryItemsPreview.length} item(s) will be moved automatically:`)}
                </p>
                <div className="bg-amber-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {categoryItemsPreview.map((item, i) => (
                    <div key={i} className="text-sm text-amber-900 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      {item.nameAr}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{tc("سيقوم النظام بتحليل كل صنف وإعادة تصنيفه بذكاء للقسم الأنسب.","The system will analyze each item and intelligently reassign it to the most suitable category.")}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              variant="destructive"
              onClick={() => deletingCategory && deleteCategoryMutation.mutate(deletingCategory.id)}
              disabled={deleteCategoryMutation.isPending || loadingPreview}
              data-testid="button-confirm-delete-category"
            >
              {deleteCategoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Trash2 className="w-4 h-4 ml-1" />}
              {categoryItemsPreview.length > 0 ? tc("حذف ونقل الأصناف","Delete & Move Items") : tc("حذف القسم","Delete Category")}
            </Button>
            <Button variant="outline" onClick={() => setDeletingCategory(null)} data-testid="button-cancel-delete-category">
              {tc("إلغاء","Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-ibm-arabic">{tc("إدارة الموقع والنظام","Site & System Management")}</h1>
          <p className="text-muted-foreground mt-1 font-ibm-arabic text-sm">{tc("تخصيص كامل للهوية، نوع النشاط، وحالة النظام","Full customization of identity, business type, and system status")}</p>
        </div>
        <div className="bg-accent/10 p-3 rounded-full">
          <Layout className="w-6 h-6 text-accent" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-20 bg-white dark:bg-background border-b -mx-6 px-6 mb-6">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
          {settingsTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all shrink-0 ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tc(tab.labelAr, tab.labelEn)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab: Store ── */}
      {activeTab === 'store' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Store Hours & Social Links */}
        <Card className="hover-elevate border-primary/20 md:col-span-2 shadow-lg">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{tc("إدارة تشغيل المتجر","Store Operations")}</CardTitle>
                  <CardDescription>{tc("التحكم في ساعات العمل والروابط الاجتماعية","Control working hours and social links")}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-lg border shadow-sm">
                <div className="flex items-center gap-2 px-2 border-l ml-2">
                  <Label htmlFor="emergency-close" className="text-sm font-bold text-red-600 cursor-pointer">{tc("إغلاق طارئ","Emergency Close")}</Label>
                  <Switch
                    id="emergency-close"
                    checked={isEmergencyClosed}
                    onCheckedChange={setIsEmergencyClosed}
                    className="data-[state=checked]:bg-red-600"
                  />
                </div>
                <Button onClick={handleSaveStoreManagement} disabled={mutation.isPending} size="sm">
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
                  {tc("حفظ كافة التغييرات","Save All Changes")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Working Hours Column */}
              <div className="lg:col-span-3 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-primary border-b pb-2">
                  <Wifi className="w-5 h-5" />
                  {tc("ساعات العمل الأسبوعية","Weekly Working Hours")}
                </h3>
                <div className="space-y-3">
                  {storeHours && Object.keys(daysAr).map((day) => (
                    <div key={day} className={`p-4 rounded-xl border transition-all ${storeHours[day]?.isOpen ? 'bg-white dark:bg-gray-900 border-primary/20 shadow-sm' : 'bg-gray-50/50 dark:bg-gray-950/50 border-dashed opacity-60'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {daysAr[day].charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-base">{daysAr[day]}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Switch
                                id={`open-${day}`}
                                checked={!!storeHours[day]?.isOpen}
                                onCheckedChange={(checked) => {
                                  const updated = {
                                    ...storeHours,
                                    [day]: { ...storeHours[day], isOpen: checked }
                                  };
                                  setStoreHours(updated);
                                }}
                              />
                              <Label htmlFor={`open-${day}`} className={`text-xs cursor-pointer font-bold ${storeHours[day]?.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                                {storeHours[day]?.isOpen ? tc("مفتوح للعمل","Open") : tc("مغلق حالياً","Closed")}
                              </Label>
                            </div>
                          </div>
                        </div>

                        {storeHours[day]?.isOpen && (
                          <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 rounded-md border shadow-sm hover:border-primary/30 transition-colors">
                              <Switch
                                id={`always-open-${day}`}
                                checked={!!storeHours[day]?.isAlwaysOpen}
                                onCheckedChange={(checked) => setStoreHours({
                                  ...storeHours,
                                  [day]: { 
                                    ...storeHours[day], 
                                    isAlwaysOpen: checked, 
                                    open: checked ? '00:00' : (storeHours[day].open || '06:00'), 
                                    close: checked ? '23:59' : (storeHours[day].close || '03:00') 
                                  }
                                })}
                              />
                              <Label htmlFor={`always-open-${day}`} className="text-xs cursor-pointer font-bold">{tc("24 ساعة","24 Hours")}</Label>
                            </div>

                            {!storeHours[day]?.isAlwaysOpen && (
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-muted-foreground px-1">{tc("من","From")}</span>
                                  <Input
                                    type="time"
                                    className="w-32 h-9 text-sm font-medium focus:ring-primary/20"
                                    value={storeHours[day]?.open || "06:00"}
                                    onChange={(e) => setStoreHours({
                                      ...storeHours,
                                      [day]: { ...storeHours[day], open: e.target.value }
                                    })}
                                  />
                                </div>
                                <span className="text-primary/40 mt-4">←</span>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-muted-foreground px-1">{tc("إلى","To")}</span>
                                  <Input
                                    type="time"
                                    className="w-32 h-9 text-sm font-medium focus:ring-primary/20"
                                    value={storeHours[day]?.close || "03:00"}
                                    onChange={(e) => setStoreHours({
                                      ...storeHours,
                                      [day]: { ...storeHours[day], close: e.target.value }
                                    })}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Links Column */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-primary border-b pb-2">
                  <Smartphone className="w-5 h-5" />
                  {tc("حسابات التواصل الاجتماعي","Social Media Accounts")}
                </h3>
                <div className="grid gap-5 bg-primary/5 p-4 rounded-xl border border-primary/10">
                  {Object.keys(socialLinks).map((platform) => (
                    <div key={platform} className="space-y-2 group">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-bold capitalize flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-primary/40 group-focus-within:bg-primary transition-colors" />
                           {platform}
                        </Label>
                      </div>
                      <div className="relative">
                        <Input
                          value={(socialLinks as any)[platform]}
                          onChange={(e) => setSocialLinks({ ...socialLinks, [platform]: e.target.value })}
                          placeholder={`https://${platform}.com/qirox...`}
                          className="h-10 text-sm pl-10 bg-white dark:bg-gray-900 border-primary/10 focus:border-primary transition-all shadow-sm"
                          dir="ltr"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{tc("تأكد من وضع الروابط كاملة (مثال: https://instagram.com/qirox) لتظهر بشكل صحيح في أسفل الموقع للعملاء.","Make sure to enter full URLs (e.g. https://instagram.com/qirox) so they display correctly at the bottom of the customer site.")}</p>
                </div>

                {/* Country & Timezone */}
                <div className="mt-6 pt-6 border-t space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-primary border-b pb-2">
                    <Globe className="w-5 h-5" />
                    {tc("الدولة والتوقيت", "Country & Timezone")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold text-sm">{tc("الدولة", "Country")}</Label>
                      <Select value={systemCountry} onValueChange={(v) => {
                        setSystemCountry(v);
                        const tzMap: Record<string,string> = {
                          SA: 'Asia/Riyadh', AE: 'Asia/Dubai', EG: 'Africa/Cairo',
                          KW: 'Asia/Kuwait', BH: 'Asia/Bahrain', QA: 'Asia/Qatar',
                          OM: 'Asia/Muscat', JO: 'Asia/Amman', LB: 'Asia/Beirut',
                          TR: 'Europe/Istanbul', GB: 'Europe/London', US: 'America/New_York'
                        };
                        if (tzMap[v]) setSystemTimezone(tzMap[v]);
                      }}>
                        <SelectTrigger data-testid="select-system-country">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SA">🇸🇦 {tc("المملكة العربية السعودية","Saudi Arabia")}</SelectItem>
                          <SelectItem value="AE">🇦🇪 {tc("الإمارات","UAE")}</SelectItem>
                          <SelectItem value="EG">🇪🇬 {tc("مصر","Egypt")}</SelectItem>
                          <SelectItem value="KW">🇰🇼 {tc("الكويت","Kuwait")}</SelectItem>
                          <SelectItem value="BH">🇧🇭 {tc("البحرين","Bahrain")}</SelectItem>
                          <SelectItem value="QA">🇶🇦 {tc("قطر","Qatar")}</SelectItem>
                          <SelectItem value="OM">🇴🇲 {tc("عُمان","Oman")}</SelectItem>
                          <SelectItem value="JO">🇯🇴 {tc("الأردن","Jordan")}</SelectItem>
                          <SelectItem value="LB">🇱🇧 {tc("لبنان","Lebanon")}</SelectItem>
                          <SelectItem value="TR">🇹🇷 {tc("تركيا","Turkey")}</SelectItem>
                          <SelectItem value="GB">🇬🇧 {tc("المملكة المتحدة","UK")}</SelectItem>
                          <SelectItem value="US">🇺🇸 {tc("الولايات المتحدة","USA")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold text-sm">{tc("المنطقة الزمنية", "Timezone")}</Label>
                      <Select value={systemTimezone} onValueChange={setSystemTimezone}>
                        <SelectTrigger data-testid="select-system-timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Riyadh">Asia/Riyadh (UTC+3)</SelectItem>
                          <SelectItem value="Asia/Dubai">Asia/Dubai (UTC+4)</SelectItem>
                          <SelectItem value="Africa/Cairo">Africa/Cairo (UTC+2/3)</SelectItem>
                          <SelectItem value="Asia/Kuwait">Asia/Kuwait (UTC+3)</SelectItem>
                          <SelectItem value="Asia/Bahrain">Asia/Bahrain (UTC+3)</SelectItem>
                          <SelectItem value="Asia/Qatar">Asia/Qatar (UTC+3)</SelectItem>
                          <SelectItem value="Asia/Muscat">Asia/Muscat (UTC+4)</SelectItem>
                          <SelectItem value="Asia/Amman">Asia/Amman (UTC+2/3)</SelectItem>
                          <SelectItem value="Asia/Beirut">Asia/Beirut (UTC+2/3)</SelectItem>
                          <SelectItem value="Europe/Istanbul">Europe/Istanbul (UTC+3)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (UTC+0/1)</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (UTC-5/4)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{tc("يحدد هذا الإعداد المنطقة الزمنية المستخدمة في جميع تقارير وإحصاءات النظام. اختر المنطقة الزمنية الخاصة ببلدك لضمان دقة تقارير اليوم والفترات الزمنية.","This setting controls the timezone used across all system reports and statistics. Choose your country's timezone to ensure accurate daily reports and time-based filters.")}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shift Time Settings */}
        <ShiftTimeSettingsCard />

        {/* Layout Settings */}
        <Card className="hover-elevate border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MonitorSmartphone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{tc("تخطيط الواجهة","Interface Layout")}</CardTitle>
                  <CardDescription>{tc("اختر شكل عرض المنيو للعملاء وواجهة الكاشير","Choose the display style for the customer menu and cashier interface")}</CardDescription>
                </div>
              </div>
              <Button
                onClick={() => mutation.mutate({ menuLayout, cashierLayout })}
                disabled={mutation.isPending}
                size="sm"
                data-testid="button-save-layout"
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
                {tc("حفظ التخطيط","Save Layout")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {/* Menu Layout */}
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 text-primary border-b pb-2 mb-4">
                <Layout className="w-5 h-5" />
                {tc("تخطيط منيو العملاء","Customer Menu Layout")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { value: 'classic', label: tc('كلاسيك','Classic'), desc: tc('بطاقات أفقية — صورة يسار + تفاصيل يمين','Horizontal cards — image left + details right'), icon: '▤' },
                  { value: 'cards', label: tc('بطاقات','Cards'), desc: tc('شبكة عمودية — صورة فوق + تفاصيل أسفل','Vertical grid — image top + details bottom'), icon: '⊞' },
                  { value: 'list', label: tc('قائمة','List'), desc: tc('صفوف مضغوطة — صورة صغيرة + تفاصيل','Compact rows — small image + details'), icon: '☰' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMenuLayout(opt.value)}
                    data-testid={`button-menu-layout-${opt.value}`}
                    className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col gap-2 ${
                      menuLayout === opt.value
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="font-bold text-base">{opt.label}</span>
                      {menuLayout === opt.value && (
                        <CheckCircle className="w-4 h-4 text-primary mr-auto" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cashier Layout */}
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 text-primary border-b pb-2 mb-4">
                <MonitorSmartphone className="w-5 h-5" />
                {tc("تخطيط واجهة الكاشير","Cashier Interface Layout")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { value: 'classic', label: tc('كلاسيك','Classic'), desc: tc('شبكة 2 عمود — بطاقة مع اسم وسعر وزر إضافة','2-col grid — card with name, price & add button'), icon: '▤' },
                  { value: 'pos', label: 'POS', desc: tc('أزرار كبيرة 3-4 أعمدة — تصميم نقطة البيع','Large buttons 3-4 cols — POS design'), icon: '⊞' },
                  { value: 'split', label: tc('مقسّم','Split'), desc: tc('شريط فئات + عناصر + سلة — 3 أقسام','Category bar + items + cart — 3 sections'), icon: '⋮⊞' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCashierLayout(opt.value)}
                    data-testid={`button-cashier-layout-${opt.value}`}
                    className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col gap-2 ${
                      cashierLayout === opt.value
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="font-bold text-base">{opt.label}</span>
                      {cashierLayout === opt.value && (
                        <CheckCircle className="w-4 h-4 text-primary mr-auto" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Mode */}
        <Card className="hover-elevate border-orange-100 dark:border-orange-900/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">{tc("حالة النظام","System Status")}</CardTitle>
                  <CardDescription>{tc("تفعيل وضع الصيانة أو التحديث","Enable maintenance or update mode")}</CardDescription>
                </div>
              </div>
              <Switch
                checked={config?.isMaintenanceMode}
                onCheckedChange={(checked) => mutation.mutate({ isMaintenanceMode: checked })}
                disabled={mutation.isPending}
                className="data-[state=checked]:bg-orange-600"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg text-xs text-orange-800 dark:text-orange-300">
              {tc("عند التفعيل، سيتم تحويل جميع العملاء تلقائياً لصفحة التوقف المؤقت.","When enabled, all customers will be redirected to the maintenance page.")}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{tc("رسالة الحالة للعملاء","Customer Status Message")}</Label>
              <Select
                value={config?.maintenanceReason || "maintenance"}
                onValueChange={(value) => mutation.mutate({ maintenanceReason: value })}
                disabled={mutation.isPending}
              >
                <SelectTrigger className="font-ibm-arabic">
                  <SelectValue placeholder={tc("اختر السبب","Select reason")} />
                </SelectTrigger>
                <SelectContent className="font-ibm-arabic">
                  <SelectItem value="maintenance">{tc("الموقع خارج الخدمة حالياً (صيانة)","Site is currently out of service (maintenance)")}</SelectItem>
                  <SelectItem value="development">{tc("الموقع تحت التطوير حالياً","Site is currently under development")}</SelectItem>
                  <SelectItem value="update">{tc("جاري تحديث الموقع حالياً","Site is currently being updated")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Business Type */}
        <Card className="hover-elevate border-blue-100 dark:border-blue-900/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Store className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{tc("تخصيص النشاط","Business Customization")}</CardTitle>
                <CardDescription>{tc("تحديد نوع النظام والتحكم في الأقسام","Define the system type and manage sections")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{tc("نوع النشاط التجاري","Business Type")}</Label>
              <Select
                value={config?.activityType || "cafe"}
                onValueChange={(value) => mutation.mutate({ activityType: value })}
                disabled={mutation.isPending}
              >
                <SelectTrigger className="font-ibm-arabic">
                  <SelectValue placeholder={tc("اختر نوع النشاط","Select business type")} />
                </SelectTrigger>
                <SelectContent className="font-ibm-arabic">
                  <SelectItem value="cafe">{tc("نظام كافيه فقط","Café System Only")}</SelectItem>
                  <SelectItem value="restaurant">{tc("نظام مطعم فقط","Restaurant System Only")}</SelectItem>
                  <SelectItem value="both">{tc("نظام مطعم وكافيه معاً","Restaurant & Café System")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-blue-800 dark:text-blue-300">{tc("أقسام النظام المتاحة","Available System Sections")}</Label>
                <div className="flex gap-2">
                  {isAddingSection ? (
                    <div className="flex items-center gap-1 animate-in slide-in-from-left-2">
                      <Input 
                        size={1} 
                        className="h-7 text-xs w-24" 
                        placeholder={tc("اسم القسم...","Section name...")}
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                      />
                      <Button 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => {
                          if (newSectionName.trim()) {
                            toast({ title: "تمت الإضافة", description: `تم إضافة قسم ${newSectionName} بنجاح` });
                            setNewSectionName("");
                            setIsAddingSection(false);
                          }
                        }}
                      >{tc("حفظ","Save")}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsAddingSection(false)}>{tc("إلغاء","Cancel")}</Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs text-blue-700 hover:bg-blue-100"
                      onClick={() => setIsAddingSection(true)}
                    >
                      <Plus className="w-3 h-3 ml-1" />
                      {tc("إضافة قسم","Add Section")}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs">{tc("إدارة المأكولات","Food Management")}</span>
                  </div>
                  <Switch
                    checked={config?.isFoodEnabled}
                    onCheckedChange={(checked) => mutation.mutate({ isFoodEnabled: checked })}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs">{tc("إدارة المشروبات","Drinks Management")}</span>
                  </div>
                  <Switch
                    checked={config?.isDrinksEnabled}
                    onCheckedChange={(checked) => mutation.mutate({ isDrinksEnabled: checked })}
                    disabled={mutation.isPending}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ── Tab: Operations ── */}
      {activeTab === 'operations' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Order Methods Config */}
        <Card className="hover-elevate border-green-100 dark:border-green-900/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{tc("طرق الاستلام","Order Methods")}</CardTitle>
                <CardDescription>{tc("تحكم في أنواع الطلبات المتاحة للعملاء","Control the order types available to customers")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'enableTakeaway', icon: Store, label: tc('استلام من الفرع','Branch Pickup'), desc: tc('الاستلام المباشر من الفرع','Direct pickup from branch'), color: 'text-blue-600' },
              { key: 'enableDineIn', icon: Utensils, label: tc('داخل المطعم (طاولة)','Dine-in (Table)'), desc: tc('الجلوس والطلب من الطاولة','Sit and order at the table'), color: 'text-orange-600' },
              { key: 'enableCarPickup', icon: Car, label: tc('استلام من السيارة','Car Pickup'), desc: tc('توصيل الطلب للسيارة أمام الفرع','Deliver order to car in front of branch'), color: 'text-purple-600' },
              { key: 'enableDelivery', icon: Truck, label: tc('توصيل للمنزل','Home Delivery'), desc: tc('توصيل الطلب لعنوان العميل','Deliver order to customer address'), color: 'text-red-600' },
            ].map(({ key, icon: Icon, label, desc, color }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={config?.orderMethodsConfig?.[key as keyof typeof config.orderMethodsConfig] ?? true}
                  onCheckedChange={(checked) => mutation.mutate({
                    orderMethodsConfig: {
                      ...(config?.orderMethodsConfig || {}),
                      [key]: checked,
                    }
                  })}
                  disabled={mutation.isPending}
                  data-testid={`switch-${key}`}
                />
              </div>
            ))}

            {/* Delivery Fee Field */}
            {config?.orderMethodsConfig?.enableDelivery !== false && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/20">
                      <Truck className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{tc('رسوم التوصيل الثابتة','Fixed Delivery Fee')}</p>
                      <p className="text-xs text-muted-foreground">{tc('يضاف تلقائياً على طلبات توصيل المنزل','Added to home delivery orders')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-24 text-center h-9"
                      defaultValue={config?.orderMethodsConfig?.deliveryFeeAmount ?? 15}
                      onBlur={(e) => mutation.mutate({
                        orderMethodsConfig: {
                          ...(config?.orderMethodsConfig || {}),
                          deliveryFeeAmount: Number(e.target.value) || 0,
                        }
                      })}
                      data-testid="input-delivery-fee"
                    />
                    <span className="text-sm text-muted-foreground"><SarIcon size={13} /></span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prep Time Settings */}
        <Card className="hover-elevate border-amber-100 dark:border-amber-900/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Timer className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{tc('إعدادات وقت التحضير','Preparation Time Settings')}</CardTitle>
                <CardDescription>{tc('حدد وقت التحضير الأساسي والإضافي لكل طلب','Set base and extra preparation time per order')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold">{tc('وقت التحضير الأساسي','Base Prep Time')}</p>
                </div>
                <p className="text-xs text-muted-foreground">{tc('المدة الافتراضية لأي طلب (بالدقائق)','Default time for any order (minutes)')}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    className="w-20 text-center h-9"
                    defaultValue={config?.prepBaseMinutes ?? 10}
                    onBlur={(e) => mutation.mutate({ prepBaseMinutes: Number(e.target.value) || 10 })}
                    data-testid="input-prep-base-minutes"
                  />
                  <span className="text-sm text-muted-foreground">{tc('دقيقة','min')}</span>
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold">{tc('المنتجات المجانية','Free Item Count')}</p>
                </div>
                <p className="text-xs text-muted-foreground">{tc('عدد المنتجات قبل إضافة وقت إضافي','Items before extra time is added')}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    className="w-20 text-center h-9"
                    defaultValue={config?.prepFreeItemCount ?? 2}
                    onBlur={(e) => mutation.mutate({ prepFreeItemCount: Number(e.target.value) || 2 })}
                    data-testid="input-prep-free-items"
                  />
                  <span className="text-sm text-muted-foreground">{tc('منتج','items')}</span>
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold">{tc('وقت المنتج الإضافي','Extra Time per Item')}</p>
                </div>
                <p className="text-xs text-muted-foreground">{tc('دقائق تُضاف لكل منتج زائد','Minutes added per extra item')}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    className="w-20 text-center h-9"
                    defaultValue={config?.prepExtraMinutesPerItem ?? 3}
                    onBlur={(e) => mutation.mutate({ prepExtraMinutesPerItem: Number(e.target.value) || 3 })}
                    data-testid="input-prep-extra-per-item"
                  />
                  <span className="text-sm text-muted-foreground">{tc('دقيقة','min')}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <span className="font-bold">{tc('مثال: ','Example: ')}</span>
                {tc(
                  `طلب يحتوي على ${(config?.prepFreeItemCount ?? 2) + 2} منتجات = ${config?.prepBaseMinutes ?? 10} + (2 × ${config?.prepExtraMinutesPerItem ?? 3}) = ${(config?.prepBaseMinutes ?? 10) + 2 * (config?.prepExtraMinutesPerItem ?? 3)} دقيقة`,
                  `Order with ${(config?.prepFreeItemCount ?? 2) + 2} items = ${config?.prepBaseMinutes ?? 10} + (2 × ${config?.prepExtraMinutesPerItem ?? 3}) = ${(config?.prepBaseMinutes ?? 10) + 2 * (config?.prepExtraMinutesPerItem ?? 3)} min`
                )}
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
      )}

      {/* ── Tab: Menu ── */}
      {activeTab === 'menu' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Menu Categories Management */}
        <Card className="hover-elevate border-teal-100 dark:border-teal-900/30 md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg">
                  <FolderTree className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">{tc("إدارة الأقسام الفرعية","Menu Categories")}</CardTitle>
                  <CardDescription>{tc("إضافة وتعديل أقسام المنيو وتعيينها لإدارة المشروبات أو المأكولات","Add and edit menu categories and assign them to drinks or food")}</CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setIsAddingCategory(true)}
                disabled={isAddingCategory}
                data-testid="button-add-menu-category"
              >
                <Plus className="w-4 h-4 ml-1" />
                {tc("إضافة قسم","Add Category")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isAddingCategory && (
              <div className="p-4 bg-teal-50/50 dark:bg-teal-900/10 rounded-lg border border-teal-200 dark:border-teal-800 space-y-3">
                <Label className="text-sm font-bold text-teal-800 dark:text-teal-300">{tc("إضافة قسم فرعي جديد","Add New Category")}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{tc("اسم القسم (عربي)","Category Name (Arabic)")}</Label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="مثال: مشروبات خاصة"
                      className="text-right"
                      data-testid="input-new-category-name-ar"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{tc("اسم القسم (إنجليزي) - اختياري","Category Name (English) — optional")}</Label>
                    <Input
                      value={newCategoryNameEn}
                      onChange={(e) => setNewCategoryNameEn(e.target.value)}
                      placeholder="e.g. Special Drinks"
                      data-testid="input-new-category-name-en"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{tc("تابع لقسم","Department")}</Label>
                    <Select
                      value={newCategoryDepartment}
                      onValueChange={(v) => setNewCategoryDepartment(v as 'drinks' | 'food')}
                    >
                      <SelectTrigger data-testid="select-new-category-department">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drinks">
                          <div className="flex items-center gap-2">
                            <Coffee className="w-4 h-4" />
                            <span>{tc("المشروبات","Drinks")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="food">
                          <div className="flex items-center gap-2">
                            <Utensils className="w-4 h-4" />
                            <span>{tc("المأكولات","Food")}</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{tc("الأيقونة","Icon")}</Label>
                    <Select
                      value={newCategoryIcon}
                      onValueChange={setNewCategoryIcon}
                    >
                      <SelectTrigger data-testid="select-new-category-icon">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {iconOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.Icon className="w-4 h-4" />
                              <span>{opt.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryName("");
                      setNewCategoryNameEn("");
                    }}
                    data-testid="button-cancel-add-category"
                  >
                    {tc("إلغاء","Cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newCategoryName.trim()) {
                        createCategoryMutation.mutate({
                          nameAr: newCategoryName.trim(),
                          nameEn: newCategoryNameEn.trim() || undefined,
                          icon: newCategoryIcon,
                          department: newCategoryDepartment,
                        });
                      }
                    }}
                    disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                    data-testid="button-save-new-category"
                  >
                    {createCategoryMutation.isPending ? tc("جاري الحفظ...","Saving...") : tc("حفظ القسم","Save Category")}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1">
                  <Coffee className="w-4 h-4 text-teal-600" />
                  <Label className="text-sm font-bold">{tc("أقسام المشروبات","Drinks Categories")}</Label>
                  <Badge variant="secondary" className="text-[10px]">{drinkCategories.length}</Badge>
                </div>
                {drinkCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">{tc("لا توجد أقسام بعد","No categories yet")}</p>
                )}
                {drinkCategories.map(cat => {
                  const IconComp = getIconComponent(cat.icon || 'Coffee');
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-2.5 bg-card border rounded-lg group" data-testid={`category-item-${cat.id}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                          <IconComp className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{cat.nameAr}</span>
                          {cat.nameEn && <span className="text-xs text-muted-foreground mr-2">({cat.nameEn})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {editingCategoryId === cat.id ? (
                          <Select
                            value={editDepartment}
                            onValueChange={(v) => {
                              setEditDepartment(v as 'drinks' | 'food');
                              updateCategoryMutation.mutate({ id: cat.id, data: { department: v } });
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-edit-dept-${cat.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="drinks">{tc("المشروبات","Drinks")}</SelectItem>
                              <SelectItem value="food">{tc("المأكولات","Food")}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditDepartment(cat.department || 'drinks');
                            }}
                            data-testid={`button-edit-category-${cat.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteCategoryDialog(cat)}
                          data-testid={`button-delete-category-${cat.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1">
                  <Utensils className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-bold">{tc("أقسام المأكولات","Food Categories")}</Label>
                  <Badge variant="secondary" className="text-[10px]">{foodCategories.length}</Badge>
                </div>
                {foodCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">{tc("لا توجد أقسام بعد","No categories yet")}</p>
                )}
                {foodCategories.map(cat => {
                  const IconComp = getIconComponent(cat.icon || 'Utensils');
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-2.5 bg-card border rounded-lg group" data-testid={`category-item-${cat.id}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                          <IconComp className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{cat.nameAr}</span>
                          {cat.nameEn && <span className="text-xs text-muted-foreground mr-2">({cat.nameEn})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {editingCategoryId === cat.id ? (
                          <Select
                            value={editDepartment}
                            onValueChange={(v) => {
                              setEditDepartment(v as 'drinks' | 'food');
                              updateCategoryMutation.mutate({ id: cat.id, data: { department: v } });
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-edit-dept-${cat.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="drinks">{tc("المشروبات","Drinks")}</SelectItem>
                              <SelectItem value="food">{tc("المأكولات","Food")}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setEditDepartment(cat.department || 'food');
                            }}
                            data-testid={`button-edit-category-${cat.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteCategoryDialog(cat)}
                          data-testid={`button-delete-category-${cat.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      )}

      {/* ── Tab: Payments ── */}
      {activeTab === 'payments' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Payment Gateway Management */}
        <Card className="border-indigo-100 dark:border-indigo-900/30 md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">{tc("إدارة طرق الدفع وبوابة الدفع","Payment Methods & Gateway")}</CardTitle>
                  <CardDescription>{tc("اختر مزود الدفع الإلكتروني وادخل بيانات الاعتماد","Choose your payment provider and enter credentials")}</CardDescription>
                </div>
              </div>
              {pgConfig && (
                <Badge variant={pgConfig.provider !== 'none' && (pgConfig.neoleap?.configured || pgConfig.geidea?.configured || pgConfig.paymob?.configured) ? 'default' : 'secondary'}>
                  {pgConfig.provider === 'neoleap' ? 'NeoLeap' : pgConfig.provider === 'geidea' ? 'Geidea' : pgConfig.provider === 'paymob' ? 'Paymob' : tc('غير مفعّل','Inactive')}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-3">
              <Label className="text-sm font-bold">{tc("مزود الدفع الإلكتروني","Payment Provider")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'none', label: tc('بدون بوابة','No Gateway'), desc: tc('كاش فقط','Cash only'), icon: Banknote },
                  { id: 'neoleap', label: 'NeoLeap', desc: tc('مدى، فيزا، ماستر كارد','Mada, Visa, Mastercard'), icon: CreditCard },
                  { id: 'geidea', label: 'Geidea', desc: tc('مدى، فيزا، ماستر كارد','Mada, Visa, Mastercard'), icon: CreditCard },
                  { id: 'paymob', label: 'Paymob', desc: tc('بطاقات ومحافظ إلكترونية','Cards & e-wallets'), icon: CreditCard },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      pgProvider === opt.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                        : 'border-border hover:border-indigo-300'
                    }`}
                    onClick={() => setPgProvider(opt.id)}
                    data-testid={`payment-provider-${opt.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <opt.icon className={`w-4 h-4 ${pgProvider === opt.id ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-bold ${pgProvider === opt.id ? 'text-indigo-700 dark:text-indigo-400' : ''}`}>{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {pgProvider === 'neoleap' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{tc("إعدادات NeoLeap","NeoLeap Settings")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open('https://developers.neoleap.com.sa/', '_blank')}
                    data-testid="link-neoleap-portal"
                  >
                    <ExternalLink className="w-3 h-3 ml-1" />
                    {tc("بوابة المطورين","Developer Portal")}
                  </Button>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                  <p className="font-bold text-blue-800 dark:text-blue-300">كيف تحصل على بيانات الاعتماد:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                    <li>سجّل حساب مطور في <span className="font-mono">developers.neoleap.com.sa</span></li>
                    <li>فعّل حسابك عبر البريد الإلكتروني</li>
                    <li>اشترك في الخطة المناسبة وانتظر الموافقة</li>
                    <li>احصل على Client ID و Client Secret من لوحة التحكم</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Client ID</Label>
                    <div className="relative">
                      <Input
                        type={showSecrets ? 'text' : 'password'}
                        value={neoleapClientId}
                        onChange={(e) => setNeoleapClientId(e.target.value)}
                        placeholder={pgConfig?.neoleap?.configured ? pgConfig.neoleap.clientId : 'أدخل Client ID'}
                        className="text-xs font-mono"
                        data-testid="input-neoleap-client-id"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Client Secret</Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={neoleapClientSecret}
                      onChange={(e) => setNeoleapClientSecret(e.target.value)}
                      placeholder="أدخل Client Secret"
                      className="text-xs font-mono"
                      data-testid="input-neoleap-client-secret"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Merchant ID (اختياري)</Label>
                    <Input
                      value={neoleapMerchantId}
                      onChange={(e) => setNeoleapMerchantId(e.target.value)}
                      placeholder="معرّف التاجر"
                      className="text-xs font-mono"
                      data-testid="input-neoleap-merchant-id"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Base URL</Label>
                    <Input
                      value={neoleapBaseUrl}
                      onChange={(e) => setNeoleapBaseUrl(e.target.value)}
                      className="text-xs font-mono"
                      data-testid="input-neoleap-base-url"
                    />
                  </div>
                </div>

                {pgConfig?.neoleap?.configured && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    <span>{tc("بيانات الاعتماد محفوظة","Credentials saved")}</span>
                  </div>
                )}
              </div>
            )}

            {pgProvider === 'geidea' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{tc("إعدادات Geidea","Geidea Settings")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open('https://docs.geidea.net/docs/overview', '_blank')}
                    data-testid="link-geidea-docs"
                  >
                    <ExternalLink className="w-3 h-3 ml-1" />
                    {tc("وثائق جيديا","Geidea Docs")}
                  </Button>
                </div>

                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800 text-xs space-y-2">
                  <p className="font-bold text-red-800 dark:text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    مطلوب: تفعيل الدفع الإلكتروني لدى جيديا
                  </p>
                  <p className="text-red-700 dark:text-red-400">
                    بيانات الاعتماد وحدها لا تكفي — يجب تفعيل خدمة الدفع عبر الإنترنت من بوابة جيديا:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-red-700 dark:text-red-400">
                    <li>سجّل الدخول في <span className="font-mono">merchant.geidea.net</span></li>
                    <li>اذهب إلى <strong>Settings → E-Commerce / Online Payment</strong></li>
                    <li>فعّل خدمة الدفع الإلكتروني وأضف نطاق موقعك</li>
                    <li>أضف روابط Callback و Return URL (انظر أدناه)</li>
                    <li>أو تواصل مع جيديا: <span className="font-mono">support@geidea.net</span> أو <span className="font-mono">920000038</span></li>
                  </ol>
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    🔁 في انتظار تفعيل جيديا؟ استخدم <strong>وضع الاختبار</strong> أدناه لتجربة تدفق الطلبات كاملاً.
                  </p>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                  <p className="font-bold text-blue-800 dark:text-blue-300">كيف تحصل على بيانات الاعتماد:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                    <li>سجّل الدخول في بوابة التاجر من جيديا</li>
                    <li>اذهب إلى Payment Gateway ثم Gateway Settings</li>
                    <li>انسخ Public Key و API Password</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Public Key (المفتاح العام)</Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={geideaPublicKey}
                      onChange={(e) => setGeideaPublicKey(e.target.value)}
                      placeholder={pgConfig?.geidea?.configured ? pgConfig.geidea.publicKey : 'أدخل المفتاح العام'}
                      className="text-xs font-mono"
                      data-testid="input-geidea-public-key"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">API Password (كلمة مرور API)</Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={geideaApiPassword}
                      onChange={(e) => setGeideaApiPassword(e.target.value)}
                      placeholder="أدخل كلمة مرور API"
                      className="text-xs font-mono"
                      data-testid="input-geidea-api-password"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Base URL</Label>
                    <Input
                      value={geideaBaseUrl}
                      onChange={(e) => setGeideaBaseUrl(e.target.value)}
                      className="text-xs font-mono"
                      data-testid="input-geidea-base-url"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                  <p className="font-bold text-amber-800 dark:text-amber-300">روابط جيديا — أضفها في لوحة تحكم التاجر:</p>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-amber-700 dark:text-amber-400 block">Callback URL (رابط الإشعار الفوري – Server-to-Server)</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        readOnly
                        value={`${window.location.origin}/api/payments/geidea/webhook`}
                        className="text-[11px] font-mono bg-white dark:bg-black"
                        data-testid="input-geidea-webhook-url"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/payments/geidea/webhook`); }}
                        data-testid="button-copy-geidea-webhook"
                      >
                        {tc("نسخ","Copy")}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-amber-700 dark:text-amber-400 block">Return URL (رابط إعادة التوجيه بعد الدفع)</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        readOnly
                        value={`${window.location.origin}/checkout?payment=callback`}
                        className="text-[11px] font-mono bg-white dark:bg-black"
                        data-testid="input-geidea-return-url"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout?payment=callback`); }}
                        data-testid="button-copy-geidea-return-url"
                      >
                        {tc("نسخ","Copy")}
                      </Button>
                    </div>
                  </div>
                </div>

                {pgConfig?.geidea?.configured && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>{tc("بيانات الاعتماد محفوظة","Credentials saved")}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={geideaDiagLoading}
                        onClick={async () => {
                          setGeideaDiagLoading(true);
                          setGeideaDiagResult(null);
                          try {
                            const r = await fetch('/api/payments/geidea/diagnostics', { credentials: 'include' });
                            const d = await r.json();
                            setGeideaDiagResult(d);
                          } catch (e: any) {
                            setGeideaDiagResult({ error: e.message });
                          } finally {
                            setGeideaDiagLoading(false);
                          }
                        }}
                        data-testid="button-geidea-diagnostics"
                      >
                        {geideaDiagLoading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : null}
                        {tc("اختبار الاتصال","Test Connection")}
                      </Button>
                    </div>
                    {geideaDiagResult && (
                      <div className={`p-3 rounded text-xs font-mono border ${geideaDiagResult.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(geideaDiagResult, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {pgProvider === 'paymob' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{tc("إعدادات Paymob","Paymob Settings")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open('https://developers.paymob.com/docs/accept-standard-redirect', '_blank')}
                    data-testid="link-paymob-docs"
                  >
                    <ExternalLink className="w-3 h-3 ml-1" />
                    {tc("وثائق Paymob","Paymob Docs")}
                  </Button>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800 text-xs space-y-1">
                  <p className="font-bold text-green-800 dark:text-green-300">Paymob السعودية (الإعداد الجديد — ksa.paymob.com)</p>
                  <p className="text-green-700 dark:text-green-400">أدخل الـ Secret Key و Public Key من لوحة تحكم Paymob السعودية أدناه. هذا الإعداد يفعّل الـ Unified Checkout مباشرةً.</p>
                  <p className="text-green-600 dark:text-green-500 font-mono text-[10px]">Callback URL: {window.location.origin}/api/payments/paymob/webhook</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-green-50/30 dark:bg-green-950/10">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-bold text-green-700 dark:text-green-400">Paymob السعودية — Unified Checkout</Label>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Secret Key (المفتاح السري) <span className="text-red-500">*</span></Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={paymobSecretKey}
                      onChange={(e) => setPaymobSecretKey(e.target.value)}
                      placeholder={pgConfig?.paymob?.secretKey ? pgConfig.paymob.secretKey : 'sau_sk_live_...'}
                      className="text-xs font-mono"
                      data-testid="input-paymob-secret-key"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Public Key (المفتاح العام) <span className="text-red-500">*</span></Label>
                    <Input
                      type="text"
                      value={paymobPublicKey}
                      onChange={(e) => setPaymobPublicKey(e.target.value)}
                      placeholder="sau_pk_live_..."
                      className="text-xs font-mono"
                      data-testid="input-paymob-public-key"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">رابط الـ API (Base URL)</Label>
                    <Input
                      type="text"
                      value={paymobBaseUrl}
                      onChange={(e) => setPaymobBaseUrl(e.target.value)}
                      placeholder="https://ksa.paymob.com"
                      className="text-xs font-mono"
                      data-testid="input-paymob-base-url"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Integration IDs (اختياري، مفصولة بفاصلة)</Label>
                    <Input
                      type="text"
                      value={paymobIntegrationIds}
                      onChange={(e) => setPaymobIntegrationIds(e.target.value)}
                      placeholder="مثال: 123456, 789012"
                      className="text-xs font-mono"
                      data-testid="input-paymob-integration-ids"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">HMAC Secret (للـ Webhooks)</Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={paymobHmacSecret}
                      onChange={(e) => setPaymobHmacSecret(e.target.value)}
                      placeholder={pgConfig?.paymob?.hmacSecret ? pgConfig.paymob.hmacSecret : 'HMAC Secret من لوحة التحكم'}
                      className="text-xs font-mono"
                      data-testid="input-paymob-hmac-secret-sa"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                  <p className="font-bold text-blue-800 dark:text-blue-300">إعداد Paymob المصرية (القديم — accept.paymob.com)</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                    <li>سجّل الدخول في لوحة تحكم Paymob على <span className="font-mono">accept.paymob.com</span></li>
                    <li>اذهب إلى Settings ← Account Info للحصول على <strong>API Key</strong></li>
                    <li>اذهب إلى Developers ← Payment Integrations للحصول على <strong>Integration ID</strong></li>
                    <li>اذهب إلى Developers ← iFrame للحصول على <strong>iFrame ID</strong></li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">API Key (مفتاح API) <span className="text-red-500">*</span></Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={paymobApiKey}
                      onChange={(e) => setPaymobApiKey(e.target.value)}
                      placeholder={pgConfig?.paymob?.configured ? pgConfig.paymob.apiKey : 'أدخل مفتاح API'}
                      className="text-xs font-mono"
                      data-testid="input-paymob-api-key"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Integration ID (بطاقة) <span className="text-red-500">*</span></Label>
                    <Input
                      type="text"
                      value={paymobIntegrationId}
                      onChange={(e) => setPaymobIntegrationId(e.target.value)}
                      placeholder="مثال: 123456"
                      className="text-xs font-mono"
                      data-testid="input-paymob-integration-id"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">iFrame ID <span className="text-red-500">*</span></Label>
                    <Input
                      type="text"
                      value={paymobIframeId}
                      onChange={(e) => setPaymobIframeId(e.target.value)}
                      placeholder="مثال: 789012"
                      className="text-xs font-mono"
                      data-testid="input-paymob-iframe-id"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Wallet Integration ID (محفظة إلكترونية - اختياري)</Label>
                    <Input
                      type="text"
                      value={paymobWalletIntegrationId}
                      onChange={(e) => setPaymobWalletIntegrationId(e.target.value)}
                      placeholder="مثال: 456789 (اختياري)"
                      className="text-xs font-mono"
                      data-testid="input-paymob-wallet-integration-id"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">HMAC Secret (سر التحقق من Webhooks - اختياري)</Label>
                    <Input
                      type={showSecrets ? 'text' : 'password'}
                      value={paymobHmacSecret}
                      onChange={(e) => setPaymobHmacSecret(e.target.value)}
                      placeholder={pgConfig?.paymob?.hmacSecret ? pgConfig.paymob.hmacSecret : 'اختياري'}
                      className="text-xs font-mono"
                      data-testid="input-paymob-hmac-secret"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">رابط Callback (للإشعارات)</Label>
                    <Input
                      type="text"
                      value={paymobCallbackUrl}
                      onChange={(e) => setPaymobCallbackUrl(e.target.value)}
                      placeholder={`${window.location.origin}/api/payments/paymob/callback`}
                      className="text-xs font-mono"
                      data-testid="input-paymob-callback-url"
                    />
                  </div>
                </div>

                {pgConfig?.paymob?.configured && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    <span>{tc("بيانات الاعتماد محفوظة","Credentials saved")}</span>
                  </div>
                )}
              </div>
            )}

            {pgProvider !== 'none' && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                >
                  {showSecrets ? <EyeOff className="w-3 h-3 ml-1" /> : <Eye className="w-3 h-3 ml-1" />}
                  {showSecrets ? tc('إخفاء البيانات','Hide Credentials') : tc('إظهار البيانات','Show Credentials')}
                </Button>
              </div>
            )}

            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-sm font-bold">{tc("طرق الدفع المتاحة للعملاء","Available Payment Methods")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'cashEnabled', label: tc('الدفع نقداً','Cash'), icon: Banknote, value: pgCashEnabled, setter: setPgCashEnabled },
                  { key: 'posEnabled', label: tc('جهاز نقاط البيع','POS Device'), icon: Smartphone, value: pgPosEnabled, setter: setPgPosEnabled },
                  { key: 'qahwaCardEnabled', label: tc('بطاقة الولاء','Loyalty Card'), icon: CreditCard, value: pgQahwaCardEnabled, setter: setPgQahwaCardEnabled },
                  { key: 'stcPayEnabled', label: 'STC Pay', icon: Smartphone, value: pgStcPayEnabled, setter: setPgStcPayEnabled },
                  { key: 'bankTransferEnabled', label: tc('تحويل بنكي','Bank Transfer'), icon: CreditCard, value: pgBankTransferEnabled, setter: setPgBankTransferEnabled },
                ].map((method) => (
                  <div key={method.key} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                    <div className="flex items-center gap-2">
                      <method.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs">{method.label}</span>
                    </div>
                    <Switch
                      checked={method.value}
                      onCheckedChange={method.setter}
                      disabled={pgMutation.isPending}
                    />
                  </div>
                ))}
              </div>
              {/* Bank Transfer IBAN Details */}
              {pgBankTransferEnabled && (
                <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="w-4 h-4 text-blue-600" />
                    <Label className="text-sm font-bold text-blue-800 dark:text-blue-300">{tc("بيانات التحويل البنكي","Bank Transfer Details")}</Label>
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    هذه البيانات ستظهر للعميل عند اختيار الدفع بالتحويل البنكي
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">{tc("رقم الآيبان","IBAN Number")}</Label>
                      <Input
                        value={pgBankIban}
                        onChange={e => setPgBankIban(e.target.value)}
                        placeholder="SA00 0000 0000 0000 0000 0000"
                        className="font-mono text-sm"
                        dir="ltr"
                        data-testid="input-bank-iban"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">{tc("اسم البنك","Bank Name")}</Label>
                      <Input
                        value={pgBankName}
                        onChange={e => setPgBankName(e.target.value)}
                        placeholder="مثال: البنك الأهلي السعودي"
                        data-testid="input-bank-name"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-semibold">{tc("اسم صاحب الحساب","Account Holder Name")}</Label>
                      <Input
                        value={pgBankAccountHolder}
                        onChange={e => setPgBankAccountHolder(e.target.value)}
                        placeholder="الاسم الكامل كما هو في البنك"
                        data-testid="input-bank-account-holder"
                      />
                    </div>
                  </div>
                </div>
              )}
              {pgProvider !== 'none' && (
                <p className="text-[10px] text-muted-foreground">
                  البطاقة البنكية {pgProvider !== 'paymob' ? 'و Apple Pay' : ''} ستظهر تلقائياً عند تفعيل بوابة {pgProvider === 'neoleap' ? 'نيو ليب' : pgProvider === 'paymob' ? 'Paymob' : 'جيديا'} وإدخال البيانات
                </p>
              )}
            </div>

            {/* Custom Payment Methods */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">{tc("طرق دفع مخصصة","Custom Payment Methods")}</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{tc("أضف طرق دفع خارجية (مثل HungerStation، مدى اليدوي، إلخ)","Add external methods (e.g. HungerStation, manual Mada, etc.)")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setNewCustomMethod({ nameAr: '', nameEn: '', icon: '💳', enabledForCustomer: true, enabledForPos: true }); setEditCustomMethodId(null); setShowAddCustomMethod(true); }} data-testid="button-add-custom-payment-method">
                  <Plus className="w-3.5 h-3.5 ml-1" />
                  {tc("إضافة","Add")}
                </Button>
              </div>

              {pgCustomPaymentMethods.length === 0 && !showAddCustomMethod && (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">{tc("لا توجد طرق مخصصة بعد","No custom methods yet")}</p>
              )}

              <div className="space-y-2">
                {pgCustomPaymentMethods.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border">
                    <span className="text-xl">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{m.nameAr}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.enabledForCustomer && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{tc("عميل","Customer")}</span>}
                        {m.enabledForPos && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{tc("POS","POS")}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setNewCustomMethod({ nameAr: m.nameAr, nameEn: m.nameEn || '', icon: m.icon || '💳', enabledForCustomer: m.enabledForCustomer !== false, enabledForPos: m.enabledForPos !== false }); setEditCustomMethodId(m.id); setShowAddCustomMethod(true); }}>
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setPgCustomPaymentMethods(prev => prev.filter(x => x.id !== m.id))} data-testid={`button-delete-custom-method-${m.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {showAddCustomMethod && (
                <div className="border rounded-lg p-3 bg-white dark:bg-gray-900 space-y-3 mt-2">
                  <p className="text-sm font-bold">{editCustomMethodId ? tc("تعديل الطريقة","Edit Method") : tc("إضافة طريقة جديدة","Add New Method")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{tc("الاسم (عربي)","Name (Arabic)")}</Label>
                      <Input value={newCustomMethod.nameAr} onChange={e => setNewCustomMethod(p => ({ ...p, nameAr: e.target.value }))} placeholder="مثال: HungerStation" data-testid="input-custom-method-name-ar" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{tc("الاسم (إنجليزي)","Name (English)")}</Label>
                      <Input value={newCustomMethod.nameEn} onChange={e => setNewCustomMethod(p => ({ ...p, nameEn: e.target.value }))} placeholder="e.g. HungerStation" data-testid="input-custom-method-name-en" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tc("الأيقونة (إيموجي)","Icon (Emoji)")}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {['💳','💵','🏦','📱','🚗','🍔','⚡','🎁','💎','🌐'].map(em => (
                        <button key={em} type="button" onClick={() => setNewCustomMethod(p => ({ ...p, icon: em }))} className={`text-xl p-1.5 rounded border-2 transition-all ${newCustomMethod.icon === em ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted-foreground/40'}`}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newCustomMethod.enabledForCustomer} onChange={e => setNewCustomMethod(p => ({ ...p, enabledForCustomer: e.target.checked }))} className="w-4 h-4" data-testid="checkbox-custom-method-customer" />
                      <span className="text-xs">{tc("يظهر للعملاء","Show for customers")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newCustomMethod.enabledForPos} onChange={e => setNewCustomMethod(p => ({ ...p, enabledForPos: e.target.checked }))} className="w-4 h-4" data-testid="checkbox-custom-method-pos" />
                      <span className="text-xs">{tc("يظهر في نقاط البيع","Show in POS")}</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!newCustomMethod.nameAr.trim()} onClick={() => {
                      if (!newCustomMethod.nameAr.trim()) return;
                      if (editCustomMethodId) {
                        setPgCustomPaymentMethods(prev => prev.map(m => m.id === editCustomMethodId ? { ...m, ...newCustomMethod } : m));
                      } else {
                        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
                        setPgCustomPaymentMethods(prev => [...prev, { id, ...newCustomMethod }]);
                      }
                      setShowAddCustomMethod(false);
                      setEditCustomMethodId(null);
                    }} data-testid="button-save-custom-method">
                      {tc("حفظ","Save")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddCustomMethod(false); setEditCustomMethodId(null); }} data-testid="button-cancel-custom-method">
                      {tc("إلغاء","Cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Test Mode Toggle */}
            <div className={`p-4 rounded-lg border ${pgPaymentTestMode ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700' : 'bg-muted/30'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-600" />
                  <div>
                    <Label className="text-sm font-bold text-amber-800 dark:text-amber-300">{tc("وضع الاختبار","Test Mode")}</Label>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      {tc("عند التفعيل، تُحاكى المدفوعات بنجاح دون خصم حقيقي","When enabled, payments are simulated without real charges")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pgPaymentTestMode}
                  onCheckedChange={setPgPaymentTestMode}
                  disabled={pgMutation.isPending}
                  data-testid="switch-payment-test-mode"
                />
              </div>
              {pgPaymentTestMode && (
                <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/20 rounded text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  ⚠️ {tc("وضع الاختبار مفعّل — تذكر تعطيله قبل الاستخدام الفعلي","Test mode is active — remember to disable it before going live")}
                </div>
              )}
            </div>

            {pgCashEnabled && (
              <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <Label className="text-sm font-bold text-amber-800 dark:text-amber-300">{tc("قيود المسافة للدفع نقداً","Cash Payment Distance Limit")}</Label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  حدد الحد الأقصى للمسافة (بالمتر) التي يُقبل فيها الدفع نقداً. اضبط على 0 لتعطيل القيد وقبول الكاش من أي مكان.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{tc("الحد الأقصى للمسافة (متر)","Max Distance (meters)")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={50}
                        value={pgCashMaxDistance}
                        onChange={e => setPgCashMaxDistance(Number(e.target.value) || 0)}
                        placeholder="0 = بلا حد"
                        className="text-sm"
                        data-testid="input-cash-max-distance"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{tc("متر","m")}</span>
                    </div>
                    {pgCashMaxDistance > 0 && (
                      <p className="text-[10px] text-amber-600">
                        الكاش مقبول فقط ضمن {pgCashMaxDistance} متر من المتجر
                      </p>
                    )}
                  </div>
                </div>

                {pgCashMaxDistance > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">{tc("إحداثيات موقع المتجر","Store Location Coordinates")}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{tc("خط العرض","Latitude")}</Label>
                        <Input
                          type="number"
                          step="0.000001"
                          value={pgStoreLocationLat}
                          onChange={e => setPgStoreLocationLat(e.target.value)}
                          placeholder="24.7136"
                          className="text-xs"
                          data-testid="input-store-lat"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{tc("خط الطول","Longitude")}</Label>
                        <Input
                          type="number"
                          step="0.000001"
                          value={pgStoreLocationLng}
                          onChange={e => setPgStoreLocationLng(e.target.value)}
                          placeholder="46.6753"
                          className="text-xs"
                          data-testid="input-store-lng"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      disabled={isGettingLocation}
                      onClick={() => {
                        if (!navigator.geolocation) return;
                        setIsGettingLocation(true);
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setPgStoreLocationLat(String(pos.coords.latitude));
                            setPgStoreLocationLng(String(pos.coords.longitude));
                            setIsGettingLocation(false);
                          },
                          () => setIsGettingLocation(false),
                          { timeout: 8000 }
                        );
                      }}
                      data-testid="button-get-current-location"
                    >
                      {isGettingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                      {tc("استخدام موقعي الحالي","Use My Location")}
                    </Button>
                    {pgStoreLocationLat && pgStoreLocationLng && (
                      <p className="text-[10px] text-green-600">
                        الموقع المحدد: {Number(pgStoreLocationLat).toFixed(6)}, {Number(pgStoreLocationLng).toFixed(6)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-2">
              <Button
                onClick={handleSavePaymentConfig}
                disabled={pgMutation.isPending}
                data-testid="button-save-payment-config"
              >
                {pgMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
                {tc("حفظ إعدادات الدفع","Save Payment Settings")}
              </Button>
              {pgProvider !== 'none' && (
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  data-testid="button-test-payment-connection"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Wifi className="w-4 h-4 ml-1" />}
                  {tc("اختبار الاتصال","Test Connection")}
                </Button>
              )}
              {testResult && (
                <div className={`flex items-center gap-1 text-xs ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                  {testResult.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Branding & Visual Identity */}
        <Card className="hover-elevate border-purple-100 dark:border-purple-900/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{tc("الهوية البصرية","Visual Identity")}</CardTitle>
                <CardDescription>{tc("التحكم في الألوان والاسم والشعار","Control colors, name, and logo")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{tc("اسم المنشأة التجاري (عربي)","Business Name (Arabic)")}</Label>
              <Input
                value={config?.tradeNameAr || ""}
                onChange={(e) => mutation.mutate({ tradeNameAr: e.target.value })}
                placeholder="مثال: كلاوني كافيه"
                className="font-ibm-arabic"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">{tc("اللون الأساسي","Primary Color")}</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-10 h-10 p-1 rounded cursor-pointer" value="#8B5A2B" disabled />
                  <Input value="#8B5A2B" className="text-xs font-mono" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{tc("لون الخلفية","Background Color")}</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-10 h-10 p-1 rounded cursor-pointer" value="#F7F8F8" disabled />
                  <Input value="#F7F8F8" className="text-xs font-mono" disabled />
                </div>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="outline" className="w-full text-xs gap-2">
                <Palette className="w-3 h-3" />
                {tc("تخصيص شكل QR","Customize QR Style")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Management Quick Links */}
        <Card className="hover-elevate border-green-100 dark:border-green-900/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{tc("إدارة المستخدمين","User Management")}</CardTitle>
                <CardDescription>{tc("التحكم في الموظفين والعملاء","Manage employees and customers")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex flex-col gap-3">
              <Button 
                variant="outline" 
                className="justify-between group hover:border-accent font-ibm-arabic"
                onClick={() => navigate('/manager/employees')}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                  <span>{tc("إدارة طاقم العمل والموظفين","Manage Staff & Employees")}</span>
                </div>
                <div className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded-full">{tc("نشط","Active")}</div>
              </Button>
              <Button variant="outline" className="justify-start gap-2 group hover:border-accent font-ibm-arabic">
                <Users className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                <span>{tc("إدارة قاعدة العملاء والولاء","Manage Customer Database & Loyalty")}</span>
              </Button>
              <Button 
                variant="ghost" 
                className="text-xs text-muted-foreground hover:text-accent font-ibm-arabic"
                onClick={() => navigate('/admin/branches')}
              >
                {tc("إدارة الفروع والتراخيص →","Branches & Licenses →")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Service Fee Settings */}
        <Card className="hover-elevate border-orange-100 dark:border-orange-900/30 md:col-span-2 shadow-lg">
          <CardHeader className="bg-orange-50/50 dark:bg-orange-900/10 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <span className="text-xl">⚙️</span>
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{tc("رسوم الخدمة","Service Fees")} <span className="text-sm font-normal text-orange-600 dark:text-orange-400">{tc("(الطلبات الأونلاين فقط)","(Online orders only)")}</span></CardTitle>
                  <CardDescription>{tc("رسوم تُضاف تلقائياً على طلبات الأونلاين فقط — لا تُطبَّق على نقاط البيع","Fees added automatically to online orders only — not applied to POS")}</CardDescription>
                </div>
              </div>
              <Button
                onClick={() => mutation.mutate({
                  serviceFeeEnabled,
                  serviceFeeAmount,
                  serviceFeeLowOrderThreshold,
                  serviceFeeLowOrderAmount,
                })}
                disabled={mutation.isPending}
                data-testid="button-save-service-fee"
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                {tc("حفظ رسوم الخدمة","Save Service Fees")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
              <div>
                <Label htmlFor="service-fee-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل رسوم الخدمة للأونلاين","Enable Online Service Fee")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{tc("تُضاف تلقائياً على طلبات الأونلاين فقط — نقاط البيع معفاة دائماً","Added automatically to online orders only — POS is always exempt")}</p>
              </div>
              <Switch
                id="service-fee-enabled"
                checked={serviceFeeEnabled}
                onCheckedChange={setServiceFeeEnabled}
                data-testid="switch-service-fee-enabled"
              />
            </div>
            {serviceFeeEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-orange-700 dark:text-orange-400">{tc("رسوم الخدمة العادية (ريال)","Standard Service Fee (SAR)")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceFeeAmount}
                    onChange={(e) => setServiceFeeAmount(parseFloat(e.target.value) || 0)}
                    data-testid="input-service-fee-amount"
                  />
                  <p className="text-[10px] text-muted-foreground">الرسوم الافتراضية على الطلبات العادية</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-orange-700 dark:text-orange-400">{tc("حد الطلب المنخفض (ريال)","Low Order Threshold (SAR)")}</Label>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={serviceFeeLowOrderThreshold}
                    onChange={(e) => setServiceFeeLowOrderThreshold(parseFloat(e.target.value) || 0)}
                    data-testid="input-service-fee-threshold"
                  />
                  <p className="text-[10px] text-muted-foreground">الطلبات أقل من هذا المبلغ تحصل على رسوم مخفضة</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-orange-700 dark:text-orange-400">{tc("رسوم الطلب المنخفض (ريال)","Low Order Fee (SAR)")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceFeeLowOrderAmount}
                    onChange={(e) => setServiceFeeLowOrderAmount(parseFloat(e.target.value) || 0)}
                    data-testid="input-service-fee-low-amount"
                  />
                  <p className="text-[10px] text-muted-foreground">الرسوم للطلبات المنخفضة</p>
                </div>
              </div>
            )}
            {serviceFeeEnabled && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border">
                  {tc("مثال","Example")}: {tc("طلب بقيمة","Order of")} 8 {tc("ريال","SAR")} → {tc("رسوم","fee")} {serviceFeeAmount.toFixed(2)} {tc("ريال","SAR")} | {tc("طلب بقيمة","Order of")} {(serviceFeeLowOrderThreshold - 0.01).toFixed(2)} {tc("ريال","SAR")} → {tc("رسوم","fee")} {serviceFeeLowOrderAmount.toFixed(2)} {tc("ريال","SAR")}
                </div>
                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 rounded-lg p-2.5 border border-orange-200 dark:border-orange-900/30">
                  <span>🌐</span>
                  <span>{tc("تُطبَّق على الأونلاين فقط — طلبات نقاط البيع","Applied to online orders only — POS transactions")} <strong>{tc("لا تشمل","do not include")}</strong> {tc("رسوم الخدمة","service fees")}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      )}

      {/* ── Tab: Loyalty ── */}
      {activeTab === 'loyalty' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Loyalty & Offers Settings */}
        <Card className="hover-elevate border-amber-100 dark:border-amber-900/30 md:col-span-2 shadow-lg">
          <CardHeader className="bg-amber-50/50 dark:bg-amber-900/10 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                  <Gift className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{tc("بطاقة مكان الشيف والعروض","Loyalty Card & Offers")}</CardTitle>
                  <CardDescription>{tc("إدارة نظام النقاط والخصومات والعروض الترويجية","Manage points system, discounts, and promotions")}</CardDescription>
                </div>
              </div>
              <Button onClick={handleSaveLoyaltyOffers} disabled={mutation.isPending} data-testid="button-save-loyalty-offers">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                {tc("حفظ إعدادات الولاء والعروض","Save Loyalty & Offers Settings")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {/* Section A: نظام النقاط */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400 border-b pb-2">
                <Star className="w-5 h-5" />
                {tc("نظام النقاط","Points System")}
              </h3>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/30">
                <Label htmlFor="loyalty-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل نظام الولاء","Enable Loyalty System")}</Label>
                <Switch
                  id="loyalty-enabled"
                  checked={loyaltyEnabled}
                  onCheckedChange={setLoyaltyEnabled}
                  data-testid="switch-loyalty-enabled"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-amber-700 dark:text-amber-400">{tc("نقاط لكل مشروب","Points per Drink")} ☕</Label>
                  <Input
                    type="number"
                    value={pointsPerDrink}
                    onChange={(e) => setPointsPerDrink(Number(e.target.value))}
                    min={0}
                    data-testid="input-points-per-drink"
                  />
                  <p className="text-[10px] text-muted-foreground">{tc("كم نقطة يكسب العميل لكل مشروب يطلبه","How many points the customer earns per drink ordered")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("كل كم نقطة = ريال","Points per SAR (redemption)")}</Label>
                  <Input
                    type="number"
                    value={pointsPerSar}
                    onChange={(e) => setPointsPerSar(Number(e.target.value))}
                    min={1}
                    data-testid="input-points-per-sar"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("نقاط مكتسبة لكل ريال","Points Earned per SAR")}</Label>
                  <Input
                    type="number"
                    value={pointsEarnedPerSar}
                    onChange={(e) => setPointsEarnedPerSar(Number(e.target.value))}
                    min={1}
                    data-testid="input-points-earned-per-sar"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("الحد الأدنى لاستبدال النقاط","Minimum Points to Redeem")}</Label>
                  <Input
                    type="number"
                    value={minPointsForRedemption}
                    onChange={(e) => setMinPointsForRedemption(Number(e.target.value))}
                    min={1}
                    data-testid="input-min-points-redemption"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <Label className="text-xs font-bold text-green-700 dark:text-green-400">{tc("نقاط للحصول على مشروب مجاني","Points for Free Drink")} ☕🎁</Label>
                  <Input
                    type="number"
                    value={pointsForFreeDrink}
                    onChange={(e) => setPointsForFreeDrink(Number(e.target.value))}
                    min={1}
                    data-testid="input-points-for-free-drink"
                  />
                  <p className="text-[10px] text-muted-foreground">عند وصول العميل لهذا العدد من النقاط يحصل على مشروب مجاني ويتم خصم كل نقاطه</p>
                </div>
              </div>
            </div>

            {/* Section B: خصم الطلب الأول */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-green-700 dark:text-green-400 border-b pb-2">
                <Tag className="w-5 h-5" />
                {tc("خصم الطلب الأول","First Order Discount")}
              </h3>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30">
                <Label htmlFor="first-order-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل خصم الطلب الأول","Enable First Order Discount")}</Label>
                <Switch
                  id="first-order-enabled"
                  checked={firstOrderEnabled}
                  onCheckedChange={setFirstOrderEnabled}
                  data-testid="switch-first-order-enabled"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("نوع الخصم","Discount Type")}</Label>
                  <Select value={firstOrderDiscountType} onValueChange={(v: 'percent' | 'amount') => setFirstOrderDiscountType(v)}>
                    <SelectTrigger data-testid="select-first-order-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{tc("نسبة مئوية","Percentage")} (%)</SelectItem>
                      <SelectItem value="amount">{tc("مبلغ ثابت","Fixed Amount")} (<SarIcon size={11} />)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("قيمة الخصم","Discount Value")} {firstOrderDiscountType === 'percent' ? '(%)' : `(${tc("ريال","SAR")})`}</Label>
                  <Input
                    type="number"
                    value={firstOrderValue}
                    onChange={(e) => setFirstOrderValue(Number(e.target.value))}
                    min={0}
                    data-testid="input-first-order-value"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("صلاحية العرض بالأيام","Offer Validity (days)")}</Label>
                  <Input
                    type="number"
                    value={firstOrderExpiresDays}
                    onChange={(e) => setFirstOrderExpiresDays(Number(e.target.value))}
                    min={1}
                    data-testid="input-first-order-expires"
                  />
                </div>
              </div>
            </div>

            {/* Section C: خصم عد لنا */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400 border-b pb-2">
                <Ticket className="w-5 h-5" />
                {tc("خصم عد لنا","Comeback Discount")}
              </h3>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <Label htmlFor="comeback-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل خصم العودة","Enable Comeback Discount")}</Label>
                <Switch
                  id="comeback-enabled"
                  checked={comebackEnabled}
                  onCheckedChange={setComebackEnabled}
                  data-testid="switch-comeback-enabled"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("نوع الخصم","Discount Type")}</Label>
                  <Select value={comebackDiscountType} onValueChange={(v: 'percent' | 'amount') => setComebackDiscountType(v)}>
                    <SelectTrigger data-testid="select-comeback-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{tc("نسبة مئوية","Percentage")} (%)</SelectItem>
                      <SelectItem value="amount">{tc("مبلغ ثابت","Fixed Amount")} (<SarIcon size={11} />)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("قيمة الخصم","Discount Value")} {comebackDiscountType === 'percent' ? '(%)' : `(${tc("ريال","SAR")})`}</Label>
                  <Input
                    type="number"
                    value={comebackValue}
                    onChange={(e) => setComebackValue(Number(e.target.value))}
                    min={0}
                    data-testid="input-comeback-value"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("صلاحية العرض بالأيام","Offer Validity (days)")}</Label>
                  <Input
                    type="number"
                    value={comebackExpiresDays}
                    onChange={(e) => setComebackExpiresDays(Number(e.target.value))}
                    min={1}
                    data-testid="input-comeback-expires"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("عدد الطلبات الأدنى","Min Orders")}</Label>
                  <Input
                    type="number"
                    value={comebackMinOrders}
                    onChange={(e) => setComebackMinOrders(Number(e.target.value))}
                    min={0}
                    data-testid="input-comeback-min-orders"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("عدد الطلبات الأعلى","Max Orders")}</Label>
                  <Input
                    type="number"
                    value={comebackMaxOrders}
                    onChange={(e) => setComebackMaxOrders(Number(e.target.value))}
                    min={0}
                    data-testid="input-comeback-max-orders"
                  />
                </div>
              </div>
            </div>

            {/* Section D: خصم العميل المميز */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400 border-b pb-2">
                <Sparkles className="w-5 h-5" />
                {tc("خصم العميل المميز","VIP Customer Discount")}
              </h3>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-900/30">
                <Label htmlFor="frequent-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل خصم العميل المميز","Enable VIP Customer Discount")}</Label>
                <Switch
                  id="frequent-enabled"
                  checked={frequentEnabled}
                  onCheckedChange={setFrequentEnabled}
                  data-testid="switch-frequent-enabled"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("نوع الخصم","Discount Type")}</Label>
                  <Select value={frequentDiscountType} onValueChange={(v: 'percent' | 'amount') => setFrequentDiscountType(v)}>
                    <SelectTrigger data-testid="select-frequent-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{tc("نسبة مئوية","Percentage")} (%)</SelectItem>
                      <SelectItem value="amount">{tc("مبلغ ثابت","Fixed Amount")} (<SarIcon size={11} />)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("قيمة الخصم","Discount Value")} {frequentDiscountType === 'percent' ? '(%)' : `(${tc("ريال","SAR")})`}</Label>
                  <Input
                    type="number"
                    value={frequentValue}
                    onChange={(e) => setFrequentValue(Number(e.target.value))}
                    min={0}
                    data-testid="input-frequent-value"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("عدد الطلبات الأدنى","Min Orders")}</Label>
                  <Input
                    type="number"
                    value={frequentMinOrders}
                    onChange={(e) => setFrequentMinOrders(Number(e.target.value))}
                    min={1}
                    data-testid="input-frequent-min-orders"
                  />
                </div>
              </div>
            </div>

            {/* Section E: خصم مشروب خاص */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-rose-700 dark:text-rose-400 border-b pb-2">
                <Coffee className="w-5 h-5" />
                {tc("خصم مشروب خاص","Special Drink Discount")}
              </h3>
              <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-900/30">
                <Label htmlFor="special-drink-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل خصم مشروب خاص","Enable Special Drink Discount")}</Label>
                <Switch
                  id="special-drink-enabled"
                  checked={specialDrinkEnabled}
                  onCheckedChange={setSpecialDrinkEnabled}
                  data-testid="switch-special-drink-enabled"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("نوع الخصم","Discount Type")}</Label>
                  <Select value={specialDrinkDiscountType} onValueChange={(v: 'percent' | 'amount') => setSpecialDrinkDiscountType(v)}>
                    <SelectTrigger data-testid="select-special-drink-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{tc("نسبة مئوية","Percentage")} (%)</SelectItem>
                      <SelectItem value="amount">{tc("مبلغ ثابت","Fixed Amount")} (<SarIcon size={11} />)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tc("قيمة الخصم","Discount Value")} {specialDrinkDiscountType === 'percent' ? '(%)' : `(${tc("ريال","SAR")})`}</Label>
                  <Input
                    type="number"
                    value={specialDrinkValue}
                    onChange={(e) => setSpecialDrinkValue(Number(e.target.value))}
                    min={0}
                    data-testid="input-special-drink-value"
                  />
                </div>
              </div>
            </div>

            {/* Section F: استبدال النقاط */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-teal-700 dark:text-teal-400 border-b pb-2">
                <Gift className="w-5 h-5" />
                {tc("استبدال النقاط","Points Redemption")}
              </h3>
              <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/10 rounded-lg border border-teal-100 dark:border-teal-900/30">
                <Label htmlFor="points-redemption-enabled" className="text-sm font-bold cursor-pointer">{tc("تفعيل استبدال النقاط","Enable Points Redemption")}</Label>
                <Switch
                  id="points-redemption-enabled"
                  checked={pointsRedemptionEnabled}
                  onCheckedChange={setPointsRedemptionEnabled}
                  data-testid="switch-points-redemption-enabled"
                />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-xs">{tc("الحد الأدنى للنقاط","Minimum Points")}</Label>
                <Input
                  type="number"
                  value={pointsRedemptionMinPoints}
                  onChange={(e) => setPointsRedemptionMinPoints(Number(e.target.value))}
                  min={1}
                  data-testid="input-points-redemption-min"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discount Codes Management */}
        <Card className="hover-elevate border-indigo-100 dark:border-indigo-900/30 md:col-span-2 shadow-lg">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                  <Percent className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{tc("إدارة أكواد الخصم","Discount Codes")}</CardTitle>
                  <CardDescription>{tc("إنشاء وإدارة أكواد الخصم الترويجية","Create and manage promotional discount codes")}</CardDescription>
                </div>
              </div>
              <Dialog open={newCodeDialogOpen} onOpenChange={setNewCodeDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-discount-code">
                    <Plus className="w-4 h-4 ml-2" />
                    {tc("إضافة كود خصم جديد","Add Discount Code")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="font-ibm-arabic">
                  <DialogHeader>
                    <DialogTitle>{tc("إنشاء كود خصم جديد","Create New Discount Code")}</DialogTitle>
                    <DialogDescription>{tc("أدخل بيانات كود الخصم الجديد","Enter the details for the new discount code")}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tc("الكود","Code")}</Label>
                      <Input
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="مثال: WELCOME10"
                        className="font-mono uppercase"
                        dir="ltr"
                        data-testid="input-new-code"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tc("نوع الخصم","Discount Type")}</Label>
                      <Select value={newCodeType} onValueChange={(v: 'percent' | 'amount') => setNewCodeType(v)}>
                        <SelectTrigger data-testid="select-new-code-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">{tc("نسبة مئوية (%)","Percentage (%)")}</SelectItem>
                          <SelectItem value="amount">{tc("مبلغ ثابت (ريال)","Fixed Amount (SAR)")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tc("قيمة الخصم","Discount Value")} {newCodeType === 'percent' ? '(%)' : `(${tc("ريال","SAR")})`}</Label>
                      <Input
                        type="number"
                        value={newCodeValue}
                        onChange={(e) => setNewCodeValue(Number(e.target.value))}
                        min={0}
                        data-testid="input-new-code-value"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tc("الحد الأقصى للاستخدام","Max Uses")}</Label>
                      <Input
                        type="number"
                        value={newCodeMaxUses}
                        onChange={(e) => setNewCodeMaxUses(Number(e.target.value))}
                        min={1}
                        data-testid="input-new-code-max-uses"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">{tc("ظاهر للعملاء","Visible to Customers")}</p>
                        <p className="text-xs text-muted-foreground">{tc("يظهر الكود في صفحة الدفع للعملاء","Code appears on customer checkout page")}</p>
                      </div>
                      <Switch
                        checked={newCodeVisible}
                        onCheckedChange={setNewCodeVisible}
                        data-testid="switch-new-code-visible"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreateCode}
                      disabled={!newCode.trim() || createCodeMutation.isPending}
                      data-testid="button-create-code"
                    >
                      {createCodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
                      {tc("إنشاء الكود","Create Code")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {codesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : discountCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Percent className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{tc("لا توجد أكواد خصم حالياً","No discount codes yet")}</p>
                <p className="text-xs mt-1">{tc('اضغط على "إضافة كود خصم جديد" لإنشاء أول كود','Click "Add Discount Code" to create the first code')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {discountCodes.map((dc: any) => (
                  <div
                    key={dc._id || dc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-white dark:bg-gray-900 shadow-sm"
                    data-testid={`discount-code-row-${dc._id || dc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <Tag className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-sm" dir="ltr">{dc.code}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {dc.discountType === 'percent' ? `${dc.value}%` : `${dc.value} ${tc("ريال","SAR")}`}
                          </Badge>
                          {dc.usageCount !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              {tc("استخدام","Uses")}: {dc.usageCount}{dc.maxUses ? `/${dc.maxUses}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] text-muted-foreground">{tc("نشط","Active")}</span>
                        <Switch
                          checked={!!dc.isActive}
                          onCheckedChange={(checked) => toggleCodeMutation.mutate({ id: dc._id || dc.id, isActive: checked })}
                          disabled={toggleCodeMutation.isPending}
                          data-testid={`switch-code-active-${dc._id || dc.id}`}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] text-muted-foreground">{tc("ظاهر للعملاء","Visible")}</span>
                        <Switch
                          checked={!!dc.visibleToCustomers}
                          onCheckedChange={(checked) => toggleVisibilityMutation.mutate({ id: dc._id || dc.id, visibleToCustomers: checked })}
                          disabled={toggleVisibilityMutation.isPending}
                          data-testid={`switch-code-visible-${dc._id || dc.id}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* App Publishing Guide Section */}
      <div className="mt-8">
        <button
          data-testid="button-app-guide-toggle"
          onClick={() => setShowAppGuide(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 hover:border-indigo-400 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/40 dark:hover:to-purple-900/40 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 transition-colors">
              <MonitorSmartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-right">
              <p className="font-bold text-base text-gray-900 dark:text-gray-100">التطبيق</p>
              <p className="text-xs text-muted-foreground">نشر الموقع كتطبيق على App Store و Google Play</p>
            </div>
          </div>
          {showAppGuide
            ? <ChevronUp className="w-5 h-5 text-indigo-500" />
            : <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          }
        </button>

        {showAppGuide && (
          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">

            {/* Status: Ready as PWA */}
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-bold text-green-800 dark:text-green-300 mb-1">✅ موقعك جاهز للنشر كتطبيق</p>
                    <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                      الموقع مُعَد بالفعل كـ <strong>PWA (تطبيق ويب تقدمي)</strong> — يملك ملف manifest، أيقونات بجميع الأحجام، خدمة عمل أوفلاين، وإشعارات. كل ما تحتاجه هو تحزيمه للمتاجر.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PWABuilder Tool */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base">الأداة المُوصى بها: PWABuilder</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  أداة مجانية من Microsoft — تحوّل موقعك مباشرةً إلى حزمة جاهزة للـ Android و iOS بدون كتابة أي كود.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  data-testid="button-open-pwabuilder"
                  variant="default"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  onClick={() => window.open(`https://www.pwabuilder.com/`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  افتح PWABuilder.com
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  أدخل رابط موقعك: <span className="font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">{window.location.origin}</span>
                </p>
              </CardContent>
            </Card>

            {/* Android Guide */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white text-sm font-bold">▶</div>
                  <div>
                    <CardTitle className="text-base">Google Play Store (Android)</CardTitle>
                    <CardDescription className="text-xs">رسوم التسجيل: $25 مرة واحدة فقط</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {[
                  { step: '١', title: 'سجّل في Google Play Console', desc: 'اذهب إلى play.google.com/console وادفع رسوم التسجيل ($25)' },
                  { step: '٢', title: 'حمّل حزمة Android من PWABuilder', desc: 'بعد إدخال رابط موقعك، اختر Android ثم اضغط "Download Package"' },
                  { step: '٣', title: 'ارفع الملف على Google Play', desc: 'في Console: Create app → ارفع ملف AAB الذي حمّلته → أكمل بيانات التطبيق' },
                  { step: '٤', title: 'انشر التطبيق', desc: 'اختر "Internal Testing" أولاً للتجربة، ثم "Production" للنشر الرسمي' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 text-xs font-bold flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
                <Button
                  data-testid="button-open-play-console"
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                  onClick={() => window.open('https://play.google.com/console', '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                  افتح Google Play Console
                </Button>
              </CardContent>
            </Card>

            {/* iOS Guide */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-gray-700 flex items-center justify-center text-white text-sm font-bold"></div>
                  <div>
                    <CardTitle className="text-base">Apple App Store (iPhone & iPad)</CardTitle>
                    <CardDescription className="text-xs">رسوم التسجيل: $99 سنوياً — تحتاج جهاز Mac</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {[
                  { step: '١', title: 'سجّل في Apple Developer Program', desc: 'اذهب إلى developer.apple.com وادفع رسوم الاشتراك السنوية ($99)' },
                  { step: '٢', title: 'حمّل مشروع iOS من PWABuilder', desc: 'بعد إدخال رابط موقعك، اختر iOS ثم اضغط "Download Package" — ستحصل على مشروع XCode' },
                  { step: '٣', title: 'افتح المشروع على Mac بـ XCode', desc: 'افتح ملف .xcodeproj، تحقق من Bundle ID، وأضف Apple Developer Account في Signing & Capabilities' },
                  { step: '٤', title: 'ارفع التطبيق على App Store Connect', desc: 'من XCode: Product → Archive → Distribute App → App Store Connect. أكمل بيانات التطبيق وأرسله للمراجعة' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-bold flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Button
                    data-testid="button-open-apple-dev"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                    onClick={() => window.open('https://developer.apple.com/programs/', '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Apple Developer
                  </Button>
                  <Button
                    data-testid="button-open-appstore-connect"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                    onClick={() => window.open('https://appstoreconnect.apple.com', '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" />
                    App Store Connect
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-5">
                <p className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {tc("نصائح مهمة","Important Tips")}
                </p>
                <ul className="space-y-1.5 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <li>• <strong>Android</strong> {tc("أسرع في الموافقة (1-2 يوم) بينما","is faster to approve (1–2 days) while")} <strong>iOS</strong> {tc("تأخذ 1-3 أيام","takes 1–3 days")}</li>
                  <li>• {tc("استخدم نفس رابط الموقع في PWABuilder بالضبط","Use the exact same site URL in PWABuilder")}: <span className="font-mono" dir="ltr">{window.location.origin}</span></li>
                  <li>• {tc("تأكد أن الموقع يعمل بـ HTTPS وليس HTTP (مطلوب لكلا المتجرين)","Make sure the site runs on HTTPS, not HTTP (required for both stores)")}</li>
                  <li>• {tc("جهّز وصف التطبيق، لقطات شاشة (screenshots)، وأيقونة بدقة 1024×1024 قبل الرفع","Prepare the app description, screenshots, and a 1024×1024 icon before uploading")}</li>
                </ul>
              </CardContent>
            </Card>

          </div>
        )}
      </div>

      {/* ── Tab: Sounds ── */}
      {activeTab === 'sounds' && (
        <div className="max-w-lg mx-auto space-y-4">
          <Card className="hover-elevate border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Volume2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">{tc("إعدادات أصوات الطلبات", "Order Sound Settings")}</CardTitle>
                  <CardDescription>{tc("تخصيص صوت مستقل لكل نوع من طلبات نقطة البيع", "Customize an independent sound for each POS order type")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <SoundSettingsPanel />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer Info */}
      <div className="text-center pt-10 text-muted-foreground text-xs font-ibm-arabic">
        <p>{tc("جميع التغييرات يتم تطبيقها فوراً على واجهة العميل","All changes are applied immediately to the customer interface")}</p>
        {mutation.isPending && <p className="text-accent animate-pulse mt-2">{tc("جاري حفظ التعديلات...","Saving changes...")}</p>}
      </div>
    </div>
  );
}
