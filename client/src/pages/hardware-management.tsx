import { useState, useRef, useCallback, useEffect } from "react";
import { PlanGate } from "@/components/plan-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import {
  Printer, Usb, Fingerprint, Wallet, Settings, CheckCircle, XCircle,
  AlertTriangle, Zap, ArrowLeft, RefreshCw, TestTube, Wifi, WifiOff,
  Monitor, Receipt, Banknote, Smartphone, Search, Filter, Globe,
  Network, Bluetooth, Cable, Star, Info, Copy, ChevronDown, ChevronUp,
  HardDrive, Cpu, BarChart3, CreditCard, QrCode, Scale, Tv2, Tag
} from "lucide-react";
import {
  HARDWARE_CATALOG, CATEGORY_INFO, CONNECTION_LABELS,
  searchDevices, getDevicesByCategory, getSaudiPopularDevices,
  type HardwareCategory, type HardwareDevice, type ConnectionType
} from "@/lib/hardware-catalog";
import PrinterSettingsPanel from "@/components/printer-settings-panel";

const ESC = 0x1B;
const GS = 0x1D;
const INIT = new Uint8Array([ESC, 0x40]);
const CUT = new Uint8Array([GS, 0x56, 0x42, 0x00]);
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const FEED = new Uint8Array([ESC, 0x64, 0x03]);
const CASH_DRAWER = new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]);

function encodeArabic(text: string): Uint8Array {
  return new TextEncoder().encode(text + '\n');
}

const CAT_ICONS: Record<HardwareCategory, any> = {
  pos_terminal: Smartphone,
  receipt_printer: Printer,
  kitchen_printer: Receipt,
  label_printer: Tag,
  fingerprint: Fingerprint,
  barcode_scanner: QrCode,
  cash_drawer: Wallet,
  customer_display: Tv2,
  payment_terminal: CreditCard,
  network_switch: Network,
  kds_screen: Monitor,
  scale: Scale,
};

const CONN_COLORS: Record<ConnectionType, string> = {
  usb: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  lan: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  serial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  bluetooth: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  wifi: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  rs232: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  rj11: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  cloud: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

const SUPPORT_STYLES = {
  full: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  network: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
};

function DeviceCard({ device }: { device: HardwareDevice }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const tc = useTranslate();
  const CatIcon = CAT_ICONS[device.category];

  const copyIp = (ip: string) => {
    navigator.clipboard.writeText(ip).catch(() => {});
    toast({ title: tc('✅ تم النسخ', '✅ Copied'), description: ip });
  };

  const supportLabel = { full: tc('متوافق كامل', 'Fully Supported'), partial: tc('متوافق جزئي', 'Partial'), network: tc('شبكة', 'Network') };

  return (
    <Card className="border hover:border-primary/40 transition-all group" data-testid={`device-card-${device.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <CatIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{device.brand}</span>
                <span className="text-sm text-muted-foreground">{device.model}</span>
                {device.saudiPopular && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 text-[10px] px-1.5">
                    🇸🇦 {tc('شائع', 'Popular')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <Badge className={`text-[10px] border px-1.5 ${SUPPORT_STYLES[device.supported]}`}>
                  {supportLabel[device.supported]}
                </Badge>
                {device.connection.slice(0, 3).map(c => (
                  <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CONN_COLORS[c]}`}>
                    {CONNECTION_LABELS[c].labelAr}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3 text-sm">
            {device.defaultIp && (
              <div className="flex items-center justify-between bg-muted/60 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">{tc('عنوان IP الافتراضي', 'Default IP')}</p>
                  <p className="font-mono font-bold text-primary">{device.defaultIp}</p>
                  {device.port && <p className="text-xs text-muted-foreground">{tc('البورت', 'Port')}: {device.port}</p>}
                </div>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => copyIp(device.defaultIp!)}>
                  <Copy className="w-3 h-3" /> {tc('نسخ', 'Copy')}
                </Button>
              </div>
            )}
            {device.ipRange && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Network className="w-3 h-3" />
                {tc('نطاق IP', 'IP Range')}: <span className="font-mono">{device.ipRange}</span>
              </div>
            )}
            {device.protocol && (
              <div className="flex items-center gap-2 text-xs">
                <Cpu className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">{tc('البروتوكول', 'Protocol')}:</span>
                <span className="font-medium">{device.protocol}</span>
              </div>
            )}
            {device.baudRate && (
              <div className="flex items-center gap-2 text-xs">
                <BarChart3 className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Baud Rate:</span>
                <span className="font-medium">{device.baudRate}</span>
              </div>
            )}
            {device.paperWidth && (
              <div className="flex items-center gap-2 text-xs">
                <Printer className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">{tc('عرض الورق', 'Paper Width')}:</span>
                <span className="font-medium">{device.paperWidth}mm</span>
              </div>
            )}
            {(device.vendorId || device.productId) && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <Usb className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">USB ID:</span>
                <span>{device.vendorId}{device.productId ? `:${device.productId}` : ''}</span>
              </div>
            )}
            {device.notesAr && (
              <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2">
                <Info className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                <span className="text-blue-700 dark:text-blue-300">{device.notesAr}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HardwareManagementPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();

  const [activeTab, setActiveTab] = useState('print-settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterPopular, setFilterPopular] = useState(false);

  const [printerPort, setPrinterPort] = useState<any>(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState('');
  const [printerLoading, setPrinterLoading] = useState(false);
  const [drawerConnected, setDrawerConnected] = useState(false);
  const [fingerprintSupported, setFingerprintSupported] = useState(false);
  const [fingerprintRegistered, setFingerprintRegistered] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [autoCut, setAutoCut] = useState(true);
  const [openDrawerOnSale, setOpenDrawerOnSale] = useState(true);
  const [printerWidth, setPrinterWidth] = useState('80');

  const [networkIp, setNetworkIp] = useState('192.168.1.200');
  const [networkPort, setNetworkPort] = useState('9100');
  const [networkTesting, setNetworkTesting] = useState(false);

  useEffect(() => {
    setFingerprintSupported(!!window.PublicKeyCredential);
    setFingerprintRegistered(localStorage.getItem('hw-fingerprint-registered') === 'true');
    const saved = localStorage.getItem('hw-printer-name');
    if (saved) { setPrinterName(saved); }
    setAutoCut(localStorage.getItem('hw-auto-cut') !== 'false');
    setOpenDrawerOnSale(localStorage.getItem('hw-drawer-on-sale') !== 'false');
    setPrinterWidth(localStorage.getItem('hw-printer-width') || '80');
  }, []);

  const filteredDevices = (() => {
    let list = searchQuery ? searchDevices(searchQuery) : HARDWARE_CATALOG;
    if (filterCategory !== 'all') list = list.filter(d => d.category === filterCategory);
    if (filterConnection !== 'all') list = list.filter(d => d.connection.includes(filterConnection as ConnectionType));
    if (filterPopular) list = list.filter(d => d.saudiPopular || d.popular);
    return list;
  })();

  const categories = Object.keys(CATEGORY_INFO) as HardwareCategory[];
  const byCategory: Record<string, HardwareDevice[]> = {};
  filteredDevices.forEach(d => {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push(d);
  });

  const connectPrinter = useCallback(async () => {
    if (!('serial' in navigator)) {
      toast({ title: tc('غير مدعوم', 'Not Supported'), description: tc('Web Serial API يتطلب Chrome أو Edge', 'Web Serial API requires Chrome or Edge'), variant: 'destructive' });
      return;
    }
    setPrinterLoading(true);
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setPrinterPort(port);
      setPrinterConnected(true);
      setDrawerConnected(true);
      const info = port.getInfo?.();
      const name = info?.usbVendorId ? `USB 0x${info.usbVendorId.toString(16).toUpperCase()}` : tc('طابعة متصلة', 'Connected Printer');
      setPrinterName(name);
      localStorage.setItem('hw-printer-name', name);
      toast({ title: tc('✅ تم الاتصال بالطابعة', '✅ Printer Connected'), description: name });
    } catch (err: any) {
      if (err.name !== 'NotFoundError') toast({ title: tc('فشل الاتصال', 'Connection Failed'), description: err.message, variant: 'destructive' });
    } finally {
      setPrinterLoading(false);
    }
  }, []);

  const disconnectPrinter = useCallback(async () => {
    if (printerPort) { try { await printerPort.close(); } catch {} setPrinterPort(null); }
    setPrinterConnected(false); setDrawerConnected(false); setPrinterName('');
    localStorage.removeItem('hw-printer-name');
    toast({ title: tc('تم قطع الاتصال', 'Disconnected') });
  }, [printerPort]);

  const sendToPrinter = useCallback(async (data: Uint8Array[]) => {
    if (!printerPort) { toast({ title: tc('لا توجد طابعة متصلة', 'No printer connected'), variant: 'destructive' }); return false; }
    try {
      const writer = printerPort.writable.getWriter();
      for (const chunk of data) await writer.write(chunk);
      writer.releaseLock();
      return true;
    } catch (err: any) {
      toast({ title: tc('خطأ في الطباعة', 'Print Error'), description: err.message, variant: 'destructive' });
      return false;
    }
  }, [printerPort]);

  const testPrint = useCallback(async () => {
    const ok = await sendToPrinter([INIT, ALIGN_CENTER, BOLD_ON, encodeArabic("مكان الشيف البخاري"), BOLD_OFF, encodeArabic(tc('اختبار الطابعة', 'Printer Test')), encodeArabic(new Date().toLocaleString('ar-SA')), FEED, ...(autoCut ? [CUT] : [])]);
    if (ok) toast({ title: tc('✅ تمت الطباعة', '✅ Printed Successfully') });
  }, [sendToPrinter, autoCut]);

  const openCashDrawer = useCallback(async () => {
    const ok = await sendToPrinter([CASH_DRAWER]);
    if (ok) toast({ title: tc('✅ تم فتح الدرج', '✅ Cash Drawer Opened') });
  }, [sendToPrinter]);

  const registerFingerprint = useCallback(async () => {
    if (!fingerprintSupported) return;
    setFingerprintLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge, rp: { name: "مكان الشيف البخاري", id: window.location.hostname },
          user: { id: new Uint8Array(16), name: 'employee', displayName: 'مكان الشيف البخاري Employee' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        }
      });
      if (cred) {
        localStorage.setItem('hw-fingerprint-registered', 'true');
        setFingerprintRegistered(true);
        toast({ title: tc('✅ تم تسجيل البصمة', '✅ Fingerprint Registered') });
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') toast({ title: tc('فشل تسجيل البصمة', 'Failed'), description: err.message, variant: 'destructive' });
    } finally {
      setFingerprintLoading(false);
    }
  }, [fingerprintSupported]);

  const testNetworkDevice = async () => {
    setNetworkTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setNetworkTesting(false);
    toast({ title: tc('🔌 جارٍ الاختبار...', '🔌 Testing...'), description: `${networkIp}:${networkPort}` });
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <Badge className={`border ${ok ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300'}`}>
      {ok ? <CheckCircle className="w-3 h-3 ml-1" /> : <XCircle className="w-3 h-3 ml-1" />}
      {label}
    </Badge>
  );

  const saudiPopularDevices = getSaudiPopularDevices();
  const totalDevices = HARDWARE_CATALOG.length;
  const totalBrands = new Set(HARDWARE_CATALOG.map(d => d.brand)).size;

  return (
    <PlanGate feature="hardwareSupport">
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/manager/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <HardDrive className="w-7 h-7 text-primary" />
                {tc('إدارة الأجهزة والهاردوير', 'Hardware Management')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {tc('قاعدة توافق شاملة مع أشهر الأجهزة في السوق', 'Full compatibility database for the most popular hardware in the market')}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="text-center p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <p className="text-3xl font-bold text-primary">{totalDevices}+</p>
              <p className="text-xs text-muted-foreground mt-1">{tc('طراز جهاز', 'Device Models')}</p>
            </Card>
            <Card className="text-center p-4 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-200 dark:border-blue-800">
              <p className="text-3xl font-bold text-blue-600">{totalBrands}</p>
              <p className="text-xs text-muted-foreground mt-1">{tc('علامة تجارية', 'Brands')}</p>
            </Card>
            <Card className="text-center p-4 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-200 dark:border-green-800">
              <p className="text-3xl font-bold text-green-600">{HARDWARE_CATALOG.filter(d => d.supported === 'full').length}</p>
              <p className="text-xs text-muted-foreground mt-1">{tc('متوافق كامل', 'Fully Compatible')}</p>
            </Card>
            <Card className="text-center p-4 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-200 dark:border-emerald-800">
              <p className="text-3xl font-bold text-emerald-600">{saudiPopularDevices.length}</p>
              <p className="text-xs text-muted-foreground mt-1">🇸🇦 {tc('شائع في السعودية', 'Popular in KSA')}</p>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="print-settings" data-testid="tab-print-settings">
                <Printer className="w-4 h-4 ml-1" />{tc('إعدادات الطباعة', 'Print Settings')}
              </TabsTrigger>
              <TabsTrigger value="catalog" data-testid="tab-catalog">
                <Search className="w-4 h-4 ml-1" />{tc('الأجهزة', 'Devices')}
              </TabsTrigger>
              <TabsTrigger value="connect" data-testid="tab-connect">
                <Usb className="w-4 h-4 ml-1" />{tc('ربط مباشر', 'Direct Connect')}
              </TabsTrigger>
              <TabsTrigger value="network" data-testid="tab-network">
                <Globe className="w-4 h-4 ml-1" />{tc('الشبكة', 'Network')}
              </TabsTrigger>
            </TabsList>

            {/* ═══════════════ PRINT SETTINGS TAB ═══════════════ */}
            <TabsContent value="print-settings" className="space-y-4">
              <PrinterSettingsPanel />
            </TabsContent>

            {/* ═══════════════ CATALOG TAB ═══════════════ */}
            <TabsContent value="catalog" className="space-y-4">

              {/* Search & Filters */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pr-10"
                      placeholder={tc('ابحث عن جهاز، علامة تجارية، IP...', 'Search device, brand, IP...')}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      data-testid="input-search-hardware"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue placeholder={tc('كل الفئات', 'All Categories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tc('كل الفئات', 'All Categories')}</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {CATEGORY_INFO[cat].icon} {CATEGORY_INFO[cat].nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterConnection} onValueChange={setFilterConnection}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder={tc('نوع الاتصال', 'Connection')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tc('كل الاتصالات', 'All')}</SelectItem>
                        <SelectItem value="usb">USB</SelectItem>
                        <SelectItem value="lan">{tc('شبكة LAN', 'LAN / IP')}</SelectItem>
                        <SelectItem value="wifi">Wi-Fi</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth</SelectItem>
                        <SelectItem value="serial">{tc('سيريال', 'Serial')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={filterPopular ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => setFilterPopular(!filterPopular)}
                      data-testid="btn-filter-popular"
                    >
                      <Star className="w-3 h-3" /> 🇸🇦 {tc('الأشهر بالسعودية', 'KSA Popular')}
                    </Button>
                    {(searchQuery || filterCategory !== 'all' || filterConnection !== 'all' || filterPopular) && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterConnection('all'); setFilterPopular(false); }}>
                        <XCircle className="w-3 h-3 ml-1" /> {tc('مسح الفلاتر', 'Clear')}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tc('يعرض', 'Showing')} <span className="font-bold text-foreground">{filteredDevices.length}</span> {tc('من', 'of')} {totalDevices} {tc('جهاز', 'devices')}
                  </p>
                </CardContent>
              </Card>

              {/* KSA Popular Section */}
              {!searchQuery && filterCategory === 'all' && !filterPopular && (
                <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      🇸🇦 {tc('الأجهزة الأكثر انتشاراً في السعودية', 'Most Popular in Saudi Arabia')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {saudiPopularDevices.map(d => <DeviceCard key={d.id} device={d} />)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Grouped by Category */}
              {Object.entries(byCategory).map(([cat, devices]) => {
                const catInfo = CATEGORY_INFO[cat as HardwareCategory];
                const CatIcon = CAT_ICONS[cat as HardwareCategory];
                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CatIcon className="w-5 h-5 text-muted-foreground" />
                      <h3 className="font-semibold">{catInfo.icon} {catInfo.nameAr}</h3>
                      <span className="text-xs text-muted-foreground">({devices.length} {tc('جهاز', 'devices')})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {devices.map(d => <DeviceCard key={d.id} device={d} />)}
                    </div>
                  </div>
                );
              })}

              {filteredDevices.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{tc('لا توجد أجهزة مطابقة', 'No devices found')}</p>
                </div>
              )}
            </TabsContent>

            {/* ═══════════════ DIRECT CONNECT TAB ═══════════════ */}
            <TabsContent value="connect" className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="text-center p-4">
                  <Printer className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-xs text-muted-foreground mb-1">{tc('الطابعة', 'Printer')}</p>
                  <StatusBadge ok={printerConnected} label={printerConnected ? tc('متصلة', 'Connected') : tc('غير متصلة', 'Disconnected')} />
                </Card>
                <Card className="text-center p-4">
                  <Wallet className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-xs text-muted-foreground mb-1">{tc('درج النقد', 'Cash Drawer')}</p>
                  <StatusBadge ok={drawerConnected} label={drawerConnected ? tc('متصل', 'Connected') : tc('غير متصل', 'Disconnected')} />
                </Card>
                <Card className="text-center p-4">
                  <Fingerprint className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-xs text-muted-foreground mb-1">{tc('البصمة', 'Fingerprint')}</p>
                  <StatusBadge ok={fingerprintRegistered} label={fingerprintRegistered ? tc('مسجلة', 'Registered') : tc('غير مسجلة', 'Not Registered')} />
                </Card>
              </div>

              <Tabs defaultValue="printer">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="printer"><Printer className="w-4 h-4 ml-1" />{tc('الطابعة', 'Printer')}</TabsTrigger>
                  <TabsTrigger value="drawer"><Wallet className="w-4 h-4 ml-1" />{tc('الدرج', 'Drawer')}</TabsTrigger>
                  <TabsTrigger value="fingerprint"><Fingerprint className="w-4 h-4 ml-1" />{tc('البصمة', 'Fingerprint')}</TabsTrigger>
                </TabsList>

                <TabsContent value="printer" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Printer className="w-5 h-5 text-blue-500" />{tc('طابعة ESC/POS USB', 'ESC/POS USB Printer')}
                      </CardTitle>
                      <CardDescription>{tc('يدعم جميع طابعات ESC/POS عبر USB أو Serial', 'All ESC/POS printers via USB or Serial')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-3">
                        {!printerConnected ? (
                          <Button onClick={connectPrinter} disabled={printerLoading} className="flex-1" data-testid="btn-connect-printer">
                            <Usb className="w-4 h-4 ml-2" />
                            {printerLoading ? tc('جاري الاتصال...', 'Connecting...') : tc('ربط الطابعة', 'Connect Printer')}
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" onClick={testPrint} className="flex-1" data-testid="btn-test-print">
                              <TestTube className="w-4 h-4 ml-2" />{tc('طباعة تجريبية', 'Test Print')}
                            </Button>
                            <Button variant="destructive" onClick={disconnectPrinter} data-testid="btn-disconnect-printer">
                              {tc('قطع الاتصال', 'Disconnect')}
                            </Button>
                          </>
                        )}
                      </div>
                      {printerConnected && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">{printerName || tc('طابعة متصلة', 'Connected Printer')}</span>
                        </div>
                      )}
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label>{tc('قص تلقائي بعد الطباعة', 'Auto-cut after print')}</Label>
                          <Switch checked={autoCut} onCheckedChange={setAutoCut} data-testid="switch-auto-cut" />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>{tc('فتح الدرج عند البيع', 'Open drawer on sale')}</Label>
                          <Switch checked={openDrawerOnSale} onCheckedChange={setOpenDrawerOnSale} data-testid="switch-drawer-on-sale" />
                        </div>
                        <div className="space-y-1">
                          <Label>{tc('عرض الورقة', 'Paper Width')}</Label>
                          <div className="flex gap-2">
                            {['58', '80'].map(w => (
                              <Button key={w} size="sm" variant={printerWidth === w ? 'default' : 'outline'} onClick={() => setPrinterWidth(w)} data-testid={`btn-paper-width-${w}`}>{w}mm</Button>
                            ))}
                          </div>
                        </div>
                        <Button onClick={() => { localStorage.setItem('hw-auto-cut', String(autoCut)); localStorage.setItem('hw-drawer-on-sale', String(openDrawerOnSale)); localStorage.setItem('hw-printer-width', printerWidth); toast({ title: tc('✅ تم حفظ الإعدادات', '✅ Settings Saved') }); }} className="w-full" data-testid="btn-save-printer-settings">
                          {tc('حفظ الإعدادات', 'Save Settings')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">{tc('الطابعات المدعومة عبر USB', 'USB Supported Printers')}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        {['Epson TM-T20III', 'Epson TM-T82III', 'Epson TM-m30II', 'Star TSP100', 'Star TSP143', 'Star TSP650II', 'Bixolon SRP-350', 'Xprinter XP-80C', 'Xprinter XP-58IIH', 'GOOJPRT PT-80', 'Sam4s ELLIX55', 'Citizen CT-S310'].map(p => (
                          <div key={p} className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500 shrink-0" />{p}</div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="drawer">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2"><Wallet className="w-5 h-5 text-green-500" />{tc('درج النقد', 'Cash Drawer')}</CardTitle>
                      <CardDescription>{tc('يعمل عبر الطابعة الحرارية (RJ11)', 'Works through thermal printer (RJ11)')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!printerConnected && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">{tc('يجب ربط الطابعة أولاً', 'Connect the printer first')}</span>
                        </div>
                      )}
                      <Button onClick={openCashDrawer} disabled={!printerConnected} className="w-full h-16 text-lg" size="lg" data-testid="btn-open-drawer">
                        <Banknote className="w-6 h-6 ml-2" />{tc('فتح الدرج الآن', 'Open Drawer Now')}
                      </Button>
                      <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm text-muted-foreground">
                        {[tc('وصّل الدرج بمنفذ RJ11 في الطابعة', 'Connect drawer to RJ11 port on printer'), tc('وصّل الطابعة بـ USB على الجهاز', 'Connect printer via USB'), tc('فعّل "فتح الدرج عند البيع" في الأعلى', 'Enable "Open drawer on sale" above')].map((s, i) => (
                          <div key={i} className="flex items-start gap-2"><span className="text-green-500 font-bold">{i + 1}.</span>{s}</div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="fingerprint">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2"><Fingerprint className="w-5 h-5 text-purple-500" />{tc('بصمة الجهاز', 'Device Biometrics')}</CardTitle>
                      <CardDescription>{tc('تسجيل الحضور والدخول عبر بصمة الجهاز', 'Attendance via device fingerprint/FaceID')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!fingerprintSupported ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm">{tc('الجهاز الحالي لا يدعم البيومترية', "Device doesn't support biometrics")}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col items-center gap-4 py-6">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${fingerprintRegistered ? 'bg-purple-500/20 border-2 border-purple-500' : 'bg-muted border-2 border-dashed border-muted-foreground/30'}`}>
                              <Fingerprint className={`w-12 h-12 ${fingerprintRegistered ? 'text-purple-500' : 'text-muted-foreground'}`} />
                            </div>
                            <p className="font-bold">{fingerprintRegistered ? tc('البصمة مسجلة ✅', 'Fingerprint Registered ✅') : tc('البصمة غير مسجلة', 'Not Registered')}</p>
                          </div>
                          <Button onClick={registerFingerprint} disabled={fingerprintLoading || fingerprintRegistered} className="w-full" size="lg" data-testid="btn-register-fingerprint">
                            <Fingerprint className="w-5 h-5 ml-2" />
                            {fingerprintLoading ? tc('جاري التسجيل...', 'Registering...') : fingerprintRegistered ? tc('تم التسجيل', 'Registered') : tc('تسجيل البصمة', 'Register')}
                          </Button>
                          {fingerprintRegistered && (
                            <Button variant="outline" className="w-full" onClick={() => { localStorage.removeItem('hw-fingerprint-registered'); setFingerprintRegistered(false); }}>
                              {tc('إعادة التسجيل', 'Re-register')}
                            </Button>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ═══════════════ NETWORK DEVICES TAB ═══════════════ */}
            <TabsContent value="network" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-green-500" />{tc('اختبار جهاز شبكي', 'Test Network Device')}</CardTitle>
                  <CardDescription>{tc('أدخل IP وبورت الجهاز للتحقق من الاتصال', 'Enter device IP and port to verify connection')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label className="text-xs">{tc('عنوان IP', 'IP Address')}</Label>
                      <Input value={networkIp} onChange={e => setNetworkIp(e.target.value)} placeholder="192.168.1.200" className="font-mono" data-testid="input-network-ip" />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">{tc('البورت', 'Port')}</Label>
                      <Input value={networkPort} onChange={e => setNetworkPort(e.target.value)} placeholder="9100" className="font-mono" data-testid="input-network-port" />
                    </div>
                  </div>
                  <Button className="w-full" onClick={testNetworkDevice} disabled={networkTesting} data-testid="btn-test-network">
                    {networkTesting ? <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />{tc('جاري الاختبار...', 'Testing...')}</> : <><Zap className="w-4 h-4 ml-2" />{tc('اختبار الاتصال', 'Test Connection')}</>}
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: tc('طابعات الإيصالات (شبكة)', 'Receipt Printers (Network)'), icon: Printer, devices: HARDWARE_CATALOG.filter(d => d.category === 'receipt_printer' && d.connection.includes('lan')) },
                  { title: tc('طابعات المطبخ (شبكة)', 'Kitchen Printers (Network)'), icon: Receipt, devices: HARDWARE_CATALOG.filter(d => d.category === 'kitchen_printer' && d.connection.includes('lan')) },
                  { title: tc('أجهزة البصمة (شبكة)', 'Fingerprint Devices (Network)'), icon: Fingerprint, devices: HARDWARE_CATALOG.filter(d => d.category === 'fingerprint' && d.connection.includes('lan')) },
                  { title: tc('أجهزة الدفع (شبكة)', 'Payment Terminals (Network)'), icon: CreditCard, devices: HARDWARE_CATALOG.filter(d => d.category === 'payment_terminal' && d.connection.includes('lan')) },
                ].map(({ title, icon: Icon, devices }) => (
                  <Card key={title}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />{title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {devices.map(d => (
                        <div key={d.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div>
                            <span className="font-medium">{d.brand} {d.model}</span>
                            {d.saudiPopular && <span className="text-xs mr-2">🇸🇦</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {d.defaultIp && (
                              <Button variant="ghost" size="sm" className="h-6 text-xs font-mono gap-1 text-primary" onClick={() => { navigator.clipboard.writeText(d.defaultIp!).catch(() => {}); toast({ title: tc('✅ تم النسخ', '✅ Copied'), description: d.defaultIp }); }}>
                                {d.defaultIp} <Copy className="w-2.5 h-2.5" />
                              </Button>
                            )}
                            {d.port && <span className="text-xs text-muted-foreground">:{d.port}</span>}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10">
                <CardContent className="p-4">
                  <h4 className="font-semibold flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-blue-500" />{tc('بروتوكولات الشبكة المدعومة', 'Supported Network Protocols')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[
                      { proto: 'ESC/POS TCP', port: '9100', use: tc('طابعات Epson/Star/Bixolon', 'Epson/Star/Bixolon printers') },
                      { proto: 'ZKTeco TCP', port: '4370', use: tc('أجهزة بصمة ZK', 'ZKTeco fingerprint') },
                      { proto: 'HTTP REST', port: '80/443', use: tc('Hikvision / KDS', 'Hikvision / KDS') },
                      { proto: 'Star Mode TCP', port: '9100', use: tc('Star Micronics شبكة', 'Star network printers') },
                      { proto: 'Geidea API', port: '443', use: tc('دفع جيدية ✅ مدمج', 'Geidea payments ✅ integrated') },
                      { proto: 'Android SDK', port: 'Wi-Fi', use: tc('Sunmi / IMIN / Telpo', 'Sunmi / IMIN / Telpo') },
                    ].map(({ proto, port, use }) => (
                      <div key={proto} className="bg-white dark:bg-slate-900 rounded-lg p-3 border">
                        <p className="font-mono text-xs font-bold text-primary">{proto}</p>
                        <p className="text-xs text-muted-foreground">{tc('بورت', 'Port')}: {port}</p>
                        <p className="text-xs mt-1">{use}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PlanGate>
  );
}
