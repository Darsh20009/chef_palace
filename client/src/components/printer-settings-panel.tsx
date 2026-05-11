import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Printer, Usb, Wifi, Network, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, Trash2, TestTube2, Settings2, Bluetooth, BluetoothConnected, BluetoothOff,
} from "lucide-react";
import {
  loadPrinterSettings,
  savePrinterSettings,
  isWebUSBSupported,
  requestUSBPrinter,
  reconnectSavedUSBPrinter,
  getSavedDeviceInfo,
  clearSavedDevice,
  getPrinterStatus,
  buildEscPosReceipt,
  thermalPrint,
  testNetworkPrinter,
  discoverNetworkPrinters,
  isBluetoothSupported,
  connectBluetoothPrinter,
  reconnectBluetoothPrinter,
  testBluetoothPrinter,
  forgetBluetoothPrinter,
  loadSavedBtDevice,
  getBluetoothState,
  isQZTrayAvailable,
  testRelayAgent,
  type PrinterSettings,
  type PrinterStatus,
} from "@/lib/thermal-printer";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";

export default function PrinterSettingsPanel() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [settings, setSettings] = useState<PrinterSettings>(loadPrinterSettings());
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [networkTesting, setNetworkTesting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  // Network discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<{ ip: string; port: number }[]>([]);
  const [discoverProgress, setDiscoverProgress] = useState<string | null>(null);
  const [subnetHint, setSubnetHint] = useState<string>(() => {
    // Pre-fill from saved IP if possible: "192.168.8.77" → "192.168.8."
    const saved = loadPrinterSettings().networkIp || '';
    const parts = saved.split('.');
    return parts.length === 4 ? parts.slice(0, 3).join('.') + '.' : '';
  });
  // QZ Tray state
  const [qzStatus, setQzStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);

  // Relay Agent state
  const [relayTesting, setRelayTesting] = useState(false);
  const [relayStatus, setRelayStatus] = useState<{ connected: boolean; message: string } | null>(null);

  // Bluetooth state
  const [btConnecting, setBtConnecting] = useState(false);
  const [btReconnecting, setBtReconnecting] = useState(false);
  const [btTesting, setBtTesting] = useState(false);
  const [btStatus, setBtStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [btState, setBtState] = useState<{ connected: boolean; deviceName: string | null }>(() => getBluetoothState());
  const savedBtDevice = loadSavedBtDevice();

  useEffect(() => {
    refreshStatus();
    // Auto-try silent BT reconnect on load if mode is bluetooth and device not connected
    if (loadPrinterSettings().mode === 'bluetooth' && !getBluetoothState().connected) {
      reconnectBluetoothPrinter()
        .then(name => {
          setBtState(getBluetoothState());
          toast({ title: `✅ تم إعادة الاتصال بـ "${name}" تلقائياً` });
        })
        .catch(() => { /* silent — user will see "reconnect" button */ });
    }
  }, []);

  // Check QZ Tray availability when in network mode
  useEffect(() => {
    if (settings.mode !== 'network') return;
    setQzStatus('checking');
    isQZTrayAvailable().then(ok => setQzStatus(ok ? 'available' : 'unavailable'));
  }, [settings.mode]);

  async function refreshStatus() {
    setLoading(true);
    const s = await getPrinterStatus();
    setStatus(s);
    setSettings(s.settings);
    setLoading(false);
  }

  function updateSetting<K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) {
    const updated = savePrinterSettings({ [key]: value });
    setSettings(updated);
  }

  async function handleConnectUSB() {
    if (!isWebUSBSupported()) {
      toast({ title: tc("غير مدعوم", "Not Supported"), description: tc("المتصفح لا يدعم WebUSB", "Browser does not support WebUSB"), variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      const device = await requestUSBPrinter();
      if (device) {
        savePrinterSettings({ mode: 'webusb' });
        toast({ title: tc("✅ تم الاتصال", "✅ Connected"), description: tc(`تم الاتصال بـ: ${device.productName || 'طابعة'}`, `Connected to: ${device.productName || 'Printer'}`) });
        await refreshStatus();
      } else {
        toast({ title: tc("لم يتم الاتصال", "Not Connected"), description: tc("لم يتم اختيار أي طابعة", "No printer selected"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: tc("خطأ في الاتصال", "Connection Error"), description: e?.message || tc("فشل الاتصال", "Failed to connect"), variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    clearSavedDevice();
    savePrinterSettings({ mode: 'browser' });
    await refreshStatus();
    toast({ title: tc("تم قطع الاتصال", "Disconnected"), description: tc("راجع إعدادات الطابعة واختر الوضع المناسب", "Check printer settings and choose the appropriate mode") });
  }

  /**
   * Normalize any IP-like string to a subnet prefix ending with a dot.
   * "192.168.8.77"  → "192.168.8."
   * "192.168.8."    → "192.168.8."
   * "192.168.8"     → "192.168.8."
   * "garbage"       → undefined
   */
  function normalizeSubnet(raw: string): string | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    // Already a valid subnet prefix (X.X.X.)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.$/.test(s)) return s;
    // Full IP address (X.X.X.X) — extract first 3 octets
    const fullIp = s.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
    if (fullIp) return fullIp[1] + '.';
    // Three octets without trailing dot (X.X.X)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s)) return s + '.';
    return undefined;
  }

  async function handleDiscoverPrinters() {
    setDiscovering(true);
    setDiscoverProgress(tc("جارٍ فحص الشبكة المحلية...", "Scanning local network..."));
    setDiscoveredPrinters([]);
    try {
      const port = settings.networkPort || 9100;
      const hint = normalizeSubnet(subnetHint);
      // If the user typed a full IP, update the hint field to show the corrected subnet
      if (hint && subnetHint.trim() !== hint) setSubnetHint(hint);
      const scanLabel = hint ? hint + '1-254' : tc("شبكة السيرفر", "server network");
      setDiscoverProgress(tc(`فحص ${scanLabel} على المنفذ ${port}...`, `Scanning ${scanLabel} on port ${port}...`));
      const found = await discoverNetworkPrinters(port, 300, hint);
      setDiscoveredPrinters(found);
      if (found.length > 0) {
        toast({
          title: tc(`✅ تم العثور على ${found.length} طابعة`, `✅ Found ${found.length} printer(s)`),
          description: found.map(p => p.ip).join(' • '),
        });
        // Auto-select if only one found
        if (found.length === 1) {
          updateSetting('networkIp', found[0].ip);
          updateSetting('networkPort', found[0].port);
          toast({ title: tc("✅ تم اختيار الطابعة تلقائياً", "✅ Printer auto-selected"), description: found[0].ip });
        }
      } else {
        toast({
          title: tc("لم يُعثر على طابعات", "No Printers Found"),
          description: hint
            ? tc(`لا توجد أجهزة على ${hint}1-254:${port}. تحقق من IP الطابعة والمنفذ.`, `No devices found on ${hint}1-254:${port}. Verify the printer IP and port.`)
            : tc(`لم يُعثر على شيء. جرّب كتابة نطاق الشبكة يدوياً (مثل 192.168.8.) ثم ابحث مجدداً.`, `Nothing found. Try entering the network subnet manually (e.g. 192.168.8.) then search again.`),
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: tc("خطأ في الاكتشاف", "Discovery Error"), description: e?.message, variant: "destructive" });
    } finally {
      setDiscovering(false);
      setDiscoverProgress(null);
    }
  }

  async function handleConnectBluetooth() {
    if (!isBluetoothSupported()) {
      toast({ title: tc("غير مدعوم", "Not Supported"), description: tc("Web Bluetooth يتطلب Chrome أو Edge على سطح المكتب أو Android", "Web Bluetooth requires Chrome or Edge on desktop or Android"), variant: "destructive" });
      return;
    }
    setBtConnecting(true);
    setBtStatus(null);
    try {
      const deviceName = await connectBluetoothPrinter();
      savePrinterSettings({ mode: 'bluetooth', bluetoothDeviceName: deviceName });
      setSettings(loadPrinterSettings());
      const state = getBluetoothState();
      setBtState(state);
      setBtStatus({ connected: true, message: `✅ ${tc("تم الاتصال بـ", "Connected to")} "${deviceName}"` });
      toast({ title: tc("✅ تم الاتصال بالبلوتوث", "✅ Bluetooth Connected"), description: `${tc("الطابعة", "Printer")}: ${deviceName}` });
    } catch (e: any) {
      setBtStatus({ connected: false, message: e?.message || tc("فشل الاتصال", "Connection failed") });
      toast({ title: tc("خطأ في البلوتوث", "Bluetooth Error"), description: e?.message || tc("فشل الاتصال بالطابعة", "Failed to connect to printer"), variant: "destructive" });
    } finally {
      setBtConnecting(false);
    }
  }

  async function handleReconnectBluetooth() {
    setBtReconnecting(true);
    setBtStatus(null);
    try {
      const deviceName = await reconnectBluetoothPrinter();
      const state = getBluetoothState();
      setBtState(state);
      setBtStatus({ connected: true, message: `✅ ${tc("تم إعادة الاتصال بـ", "Reconnected to")} "${deviceName}"` });
      toast({ title: tc("✅ تم إعادة الاتصال", "✅ Reconnected"), description: deviceName });
    } catch (e: any) {
      setBtStatus({ connected: false, message: e?.message || tc("فشل إعادة الاتصال", "Reconnect failed") });
      toast({ title: tc("فشل إعادة الاتصال", "Reconnect Failed"), description: e?.message || tc("اضغط 'ابحث عن طابعة' لإعادة الاقتران", "Press 'Search printer' to re-pair"), variant: "destructive" });
    } finally {
      setBtReconnecting(false);
    }
  }

  async function handleTestBluetooth() {
    setBtTesting(true);
    setBtStatus(null);
    try {
      const result = await testBluetoothPrinter();
      setBtStatus(result);
      toast({
        title: result.connected ? tc("✅ الطابعة متاحة", "✅ Printer Ready") : tc("❌ لا يمكن الاتصال", "❌ Cannot Connect"),
        description: result.message,
        variant: result.connected ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: tc("خطأ", "Error"), description: e?.message, variant: "destructive" });
    } finally {
      setBtTesting(false);
    }
  }

  function handleForgetBluetooth() {
    forgetBluetoothPrinter();
    savePrinterSettings({ mode: 'browser', bluetoothDeviceName: undefined, bluetoothDeviceId: undefined });
    setSettings(loadPrinterSettings());
    setBtState({ connected: false, deviceName: null });
    setBtStatus(null);
    toast({ title: tc("تم إزالة الطابعة", "Printer Removed"), description: tc("راجع إعدادات الطابعة واختر الوضع المناسب", "Check printer settings and choose the appropriate mode") });
  }

  async function handleTestRelayAgent() {
    const relayUrl = settings.relayAgentUrl?.trim();
    if (!relayUrl) {
      toast({ title: tc("خطأ", "Error"), description: tc("الرجاء إدخال رابط وكيل الطباعة", "Please enter the relay agent URL"), variant: "destructive" });
      return;
    }
    setRelayTesting(true);
    setRelayStatus(null);
    try {
      const result = await testRelayAgent(relayUrl, settings.networkIp?.trim(), settings.networkPort || 9100);
      setRelayStatus(result);
      toast({
        title: result.connected ? tc("✅ الوكيل جاهز", "✅ Relay Ready") : tc("❌ فشل الاتصال", "❌ Connection Failed"),
        description: result.message.split('\n')[0],
        variant: result.connected ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: tc("خطأ", "Error"), description: e?.message, variant: "destructive" });
    } finally {
      setRelayTesting(false);
    }
  }

  async function handleTestNetworkPrinter() {
    const ip = settings.networkIp?.trim();
    if (!ip) {
      toast({ title: tc("خطأ", "Error"), description: tc("الرجاء إدخال IP الطابعة", "Please enter printer IP"), variant: "destructive" });
      return;
    }
    setNetworkTesting(true);
    setNetworkStatus(null);
    try {
      const result = await testNetworkPrinter(ip, settings.networkPort || 9100);
      setNetworkStatus(result);
      toast({
        title: result.connected ? tc("✅ الطابعة متاحة", "✅ Printer Reachable") : tc("❌ لا يمكن الاتصال", "❌ Cannot Connect"),
        description: result.message,
        variant: result.connected ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: tc("خطأ", "Error"), description: e?.message, variant: "destructive" });
    } finally {
      setNetworkTesting(false);
    }
  }

  async function handleTestPrint() {
    setTesting(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

      const escData = buildEscPosReceipt({
        shopName: "مكان الشيف البخاري",
        vatNumber: '312718675800003',
        branchName: 'اختبار الطابعة',
        orderNumber: 'TEST-001',
        date: dateStr,
        cashierName: 'النظام',
        items: [
          { name: 'أرز بخاري دجاج', qty: 1, price: 35.00 },
          { name: 'كيك شوكولاتة', qty: 2, price: 12.00 },
        ],
        subtotal: 34.09,
        vat: 5.91,
        total: 40.00,
        paymentMethod: 'نقدي',
        paperWidth: settings.paperWidth,
        feedLines: settings.feedLines,
      });

      const result = await thermalPrint(escData, '', settings.paperWidth);

      if (result.success) {
        toast({
          title: tc("✅ طباعة ناجحة", "✅ Print Success"),
          description: settings.mode === 'network'
            ? tc(`تمت الطباعة على ${settings.networkIp}`, `Printed to ${settings.networkIp}`)
            : result.mode === 'webusb'
              ? tc("تمت الطباعة على الطابعة (USB)", "Printed directly via USB")
              : tc("تمت الطباعة عبر المتصفح", "Printed via browser dialog"),
        });
      } else {
        toast({ title: tc("فشلت الطباعة", "Print Failed"), description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: tc("خطأ في الطباعة", "Print Error"), description: e?.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  const webUsbAvailable = isWebUSBSupported();
  const btAvailable = isBluetoothSupported();
  const isUsbConnected = status?.isDeviceConnected;
  const savedDevice = status?.savedDevice;
  const isNetworkMode = settings.mode === 'network';
  const isBluetoothMode = settings.mode === 'bluetooth';
  const isRelayMode = settings.mode === 'relay';

  const statusBadgeColor = isRelayMode
    ? (relayStatus?.connected ? '#16a34a' : '#8b5cf6')
    : isNetworkMode
      ? (networkStatus?.connected ? '#16a34a' : '#f59e0b')
      : isBluetoothMode
        ? (btState.connected ? '#16a34a' : (savedBtDevice ? '#f59e0b' : '#e5e7eb'))
        : isUsbConnected
          ? '#16a34a'
          : '#e5e7eb';

  const statusBadgeLabel = isRelayMode
    ? (settings.relayAgentUrl ? `Relay: ${settings.relayAgentUrl.replace(/^https?:\/\//, '').split(':')[0]}` : tc("وكيل محلي", "Local Relay"))
    : isNetworkMode
      ? (settings.networkIp ? `LAN: ${settings.networkIp}` : tc("طابعة شبكية", "Network Printer"))
      : isBluetoothMode
        ? (btState.connected
            ? `BT: ${btState.deviceName || tc("متصلة", "Connected")}`
            : savedBtDevice
              ? `BT: ${savedBtDevice.name} (${tc("غير متصلة", "Disconnected")})`
              : tc("طابعة بلوتوث", "Bluetooth Printer"))
        : isUsbConnected
          ? tc("متصلة (USB)", "Connected (USB)")
          : settings.mode === 'browser'
            ? tc("طباعة المتصفح", "Browser Print")
            : tc("غير متصلة", "Disconnected");

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="border-2" style={{ borderColor: statusBadgeColor }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="w-5 h-5" />
            {tc("حالة الطابعة", "Printer Status")}
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin ml-auto" />
            ) : (
              <Badge
                className="ml-auto"
                variant="secondary"
                style={{ backgroundColor: statusBadgeColor, color: statusBadgeColor !== '#e5e7eb' ? 'white' : undefined }}
              >
                {statusBadgeLabel}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* WebUSB availability */}
          {!isNetworkMode && !isBluetoothMode && (
            <div className="flex items-center gap-2 text-sm">
              {webUsbAvailable ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className={webUsbAvailable ? 'text-green-700' : 'text-red-600'}>
                {webUsbAvailable
                  ? tc("المتصفح يدعم WebUSB (اتصال مباشر)", "Browser supports WebUSB (direct connection)")
                  : tc("المتصفح لا يدعم WebUSB — استخدم Chrome أو Edge", "Browser doesn't support WebUSB — use Chrome or Edge")
                }
              </span>
            </div>
          )}

          {/* Bluetooth availability */}
          {isBluetoothMode && (
            <div className="flex items-center gap-2 text-sm">
              {btAvailable ? (
                btState.connected
                  ? <BluetoothConnected className="w-4 h-4 text-green-600" />
                  : <Bluetooth className="w-4 h-4 text-blue-500" />
              ) : (
                <BluetoothOff className="w-4 h-4 text-red-500" />
              )}
              <span className={btAvailable ? (btState.connected ? 'text-green-700' : 'text-blue-600') : 'text-red-600'}>
                {btAvailable
                  ? btState.connected
                    ? tc(`متصلة بـ "${btState.deviceName}"`, `Connected to "${btState.deviceName}"`)
                    : tc("المتصفح يدعم Web Bluetooth — انقر للاقتران", "Browser supports Web Bluetooth — click to pair")
                  : tc("Web Bluetooth غير مدعوم — استخدم Chrome أو Edge", "Web Bluetooth not supported — use Chrome or Edge")
                }
              </span>
            </div>
          )}

          {/* USB device info */}
          {savedDevice && !isNetworkMode && !isBluetoothMode && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${isUsbConnected ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <Usb className={`w-4 h-4 ${isUsbConnected ? 'text-green-600' : 'text-amber-500'}`} />
              <span className={`flex-1 font-medium ${isUsbConnected ? 'text-green-800' : 'text-amber-700'}`}>
                {savedDevice.productName || tc("طابعة حرارية", "Thermal Printer")}
                <span className="text-xs font-mono mr-1 opacity-60">
                  [{savedDevice.vendorId.toString(16).padStart(4,'0')}:{savedDevice.productId.toString(16).padStart(4,'0')}]
                </span>
              </span>
              {isUsbConnected ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
            </div>
          )}

          {/* Windows USB driver warning — shown when device is saved but NOT usable */}
          {savedDevice && !isNetworkMode && !isBluetoothMode && !isUsbConnected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 text-xs text-red-800">
              <p className="font-bold text-sm">⚠️ {tc("الطابعة مُعرَّفة لكن لا تطبع — مشكلة درايفر Windows", "Printer detected but not printing — Windows driver conflict")}</p>
              <p>{tc("ويندوز يحتجز المنفذ USB ويمنع المتصفح من التحكم في الطابعة مباشرة. الحل:", "Windows holds the USB port and blocks the browser from controlling the printer directly. Fix:")}</p>
              <ol className="list-decimal list-inside space-y-1 mr-2">
                <li>{tc("حمّل برنامج Zadig (zadig.akeo.ie) مجاناً", "Download Zadig (zadig.akeo.ie) — free")}</li>
                <li>{tc("اختر طابعتك من القائمة → اضغط 'Replace Driver' → اختر WinUSB", "Select your printer → click 'Replace Driver' → choose WinUSB")}</li>
                <li>{tc("أعد تشغيل المتصفح واضغط 'اختر الطابعة (USB)' مجدداً", "Restart browser and click 'Select Printer (USB)' again")}</li>
              </ol>
              <p className="font-semibold text-red-700">
                {tc("أو بدلاً عن ذلك: بدّل وضع الطباعة إلى 'شبكة LAN' أو 'وكيل محلي' — أسهل وأكثر استقراراً.", "Or: Switch print mode to 'LAN Network' or 'Local Relay' — easier and more stable.")}
              </p>
            </div>
          )}

          {/* Bluetooth device info */}
          {isBluetoothMode && (savedBtDevice || btState.connected) && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${btState.connected ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              {btState.connected
                ? <BluetoothConnected className="w-4 h-4 text-green-600" />
                : <Bluetooth className="w-4 h-4 text-amber-600" />
              }
              <span className={`flex-1 font-medium ${btState.connected ? 'text-green-800' : 'text-amber-700'}`}>
                {btState.deviceName || savedBtDevice?.name || tc("طابعة بلوتوث", "Bluetooth Printer")}
              </span>
              {btState.connected
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <AlertCircle className="w-4 h-4 text-amber-500" />
              }
            </div>
          )}

          {/* BT test status */}
          {isBluetoothMode && btStatus && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${btStatus.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {btStatus.connected
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <XCircle className="w-4 h-4 text-red-500" />
              }
              <span className={`flex-1 font-medium ${btStatus.connected ? 'text-green-800' : 'text-red-700'}`}>{btStatus.message}</span>
            </div>
          )}

          {/* Network printer status */}
          {isNetworkMode && settings.networkIp && networkStatus && (
            <div className={`text-sm rounded-lg px-3 py-2 border ${networkStatus.connected ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-2">
                <Network className={`w-4 h-4 mt-0.5 flex-shrink-0 ${networkStatus.connected ? 'text-green-600' : 'text-amber-600'}`} />
                <span className={`flex-1 font-medium whitespace-pre-line leading-relaxed ${networkStatus.connected ? 'text-green-800' : 'text-amber-800'}`}>
                  {networkStatus.message}
                </span>
                {networkStatus.connected
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                }
              </div>
            </div>
          )}

          {/* Relay Agent status */}
          {isRelayMode && relayStatus && (
            <div className={`text-sm rounded-lg px-3 py-2 border ${relayStatus.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                <Network className={`w-4 h-4 mt-0.5 flex-shrink-0 ${relayStatus.connected ? 'text-green-600' : 'text-red-500'}`} />
                <span className={`flex-1 font-medium whitespace-pre-line leading-relaxed ${relayStatus.connected ? 'text-green-800' : 'text-red-700'}`}>
                  {relayStatus.message}
                </span>
                {relayStatus.connected
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                }
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {webUsbAvailable && !isNetworkMode && !isBluetoothMode && !isRelayMode && (
              <Button
                size="sm"
                onClick={handleConnectUSB}
                disabled={connecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-connect-usb-printer"
              >
                <Usb className="w-4 h-4 ml-1" />
                {connecting ? tc("جارٍ الاتصال...", "Connecting...") : tc("اختر الطابعة (USB)", "Select Printer (USB)")}
              </Button>
            )}
            {isBluetoothMode && btAvailable && (
              <Button
                size="sm"
                onClick={handleConnectBluetooth}
                disabled={btConnecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-connect-bluetooth-printer"
              >
                {btState.connected
                  ? <BluetoothConnected className="w-4 h-4 ml-1" />
                  : <Bluetooth className="w-4 h-4 ml-1" />
                }
                {btConnecting
                  ? tc("جارٍ الاقتران...", "Pairing...")
                  : btState.connected
                    ? tc("تغيير الطابعة", "Change Printer")
                    : tc("اقتران بطابعة بلوتوث", "Pair Bluetooth Printer")
                }
              </Button>
            )}
            {isBluetoothMode && btState.connected && (
              <Button
                size="sm"
                onClick={handleTestBluetooth}
                disabled={btTesting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-test-bluetooth-printer"
              >
                <TestTube2 className="w-4 h-4 ml-1" />
                {btTesting ? tc("جارٍ الفحص...", "Testing...") : tc("اختبار الاتصال", "Test Connection")}
              </Button>
            )}
            {isBluetoothMode && (savedBtDevice || btState.connected) && (
              <Button size="sm" variant="outline" onClick={handleForgetBluetooth} className="text-red-600 border-red-200" data-testid="button-forget-bluetooth-printer">
                <BluetoothOff className="w-4 h-4 ml-1" />
                {tc("إلغاء الاقتران", "Forget Printer")}
              </Button>
            )}
            {isRelayMode && (
              <Button
                size="sm"
                onClick={handleTestRelayAgent}
                disabled={relayTesting || !settings.relayAgentUrl?.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white"
                data-testid="button-test-relay-agent"
              >
                <Network className="w-4 h-4 ml-1" />
                {relayTesting ? tc("جارٍ الفحص...", "Testing...") : tc("اختبار الوكيل", "Test Relay")}
              </Button>
            )}
            {isNetworkMode && (
              <Button
                size="sm"
                onClick={handleTestNetworkPrinter}
                disabled={networkTesting || !settings.networkIp?.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-test-network-printer"
              >
                <Network className="w-4 h-4 ml-1" />
                {networkTesting ? tc("جارٍ الفحص...", "Testing...") : tc("اختبار الاتصال", "Test Connection")}
              </Button>
            )}
            {savedDevice && !isNetworkMode && !isBluetoothMode && !isRelayMode && (
              <Button size="sm" variant="outline" onClick={handleDisconnect} className="text-red-600 border-red-200" data-testid="button-disconnect-printer">
                <Trash2 className="w-4 h-4 ml-1" />
                {tc("إزالة الطابعة", "Remove Printer")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={refreshStatus} disabled={loading} data-testid="button-refresh-printer-status">
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
              {tc("تحديث", "Refresh")}
            </Button>
            <Button
              size="sm"
              onClick={handleTestPrint}
              disabled={testing}
              variant="outline"
              className="text-amber-700 border-amber-300"
              data-testid="button-test-print"
            >
              <TestTube2 className="w-4 h-4 ml-1" />
              {testing ? tc("جارٍ الطباعة...", "Printing...") : tc("طباعة تجريبية", "Test Print")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-5 h-5" />
            {tc("إعدادات الطباعة", "Print Settings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Print Mode */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">{tc("وضع الطباعة", "Print Mode")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings.mode === 'queue'
                  ? tc("طابور سحابي — الأفضل لتاب سينس وأندرويد", "Cloud Queue — Best for Tab Sense & Android")
                  : settings.mode === 'network'
                    ? tc("طابعة شبكية (LAN/WiFi) — ProPos، Epson، Xprinter", "Network printer (LAN/WiFi) — ProPos, Epson, Xprinter")
                    : settings.mode === 'bluetooth'
                      ? tc("طابعة بلوتوث (BLE) — Xprinter BT، MUNBYN، Rongta", "Bluetooth printer (BLE) — Xprinter BT, MUNBYN, Rongta")
                      : settings.mode === 'webusb'
                        ? tc("اتصال USB مباشر — بدون نوافذ طباعة", "Direct USB — no print dialogs")
                        : tc("طباعة عبر المتصفح — تظهر نافذة الطباعة", "Browser print — dialog will appear")
                }
              </p>
            </div>
            <Select value={settings.mode} onValueChange={(v: any) => { updateSetting('mode', v); setRelayStatus(null); setNetworkStatus(null); }}>
              <SelectTrigger className="w-40" data-testid="select-print-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queue">
                  <span className="flex items-center gap-1"><Network className="w-3 h-3 text-green-600" /> {tc("طابور سحابي ⭐", "Cloud Queue ⭐")}</span>
                </SelectItem>
                <SelectItem value="relay">
                  <span className="flex items-center gap-1"><Network className="w-3 h-3 text-violet-600" /> {tc("وكيل محلي", "Local Relay")}</span>
                </SelectItem>
                <SelectItem value="network">
                  <span className="flex items-center gap-1"><Network className="w-3 h-3" /> {tc("شبكة LAN", "Network LAN")}</span>
                </SelectItem>
                <SelectItem value="bluetooth">
                  <span className="flex items-center gap-1"><Bluetooth className="w-3 h-3" /> {tc("بلوتوث", "Bluetooth")}</span>
                </SelectItem>
                <SelectItem value="webusb">
                  <span className="flex items-center gap-1"><Usb className="w-3 h-3" /> USB</span>
                </SelectItem>
                <SelectItem value="browser">
                  <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> {tc("متصفح", "Browser")}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cloud Print Queue — Best for Tab Sense / Android */}
          {settings.mode === 'queue' && (
            <>
              <Separator />
              <div className="space-y-3 bg-green-50 border border-green-300 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
                  <Network className="w-4 h-4" />
                  {tc("الطابور السحابي ⭐ — الحل المثالي لتاب سينس وأندرويد", "Cloud Queue ⭐ — Perfect for Tab Sense & Android")}
                </div>

                <div className="text-xs text-green-700 bg-green-100 rounded-lg p-2.5 space-y-1">
                  <p className="font-bold">{tc("🚀 كيف يعمل؟", "🚀 How it works?")}</p>
                  <p>{tc(
                    "الكاشير يرسل أمر الطباعة للسيرفر. عامل الطباعة (يشتغل على أي جهاز قريب من الطابعة) يسحب الأمر تلقائياً ويطبع — بدون أي إعداد شبكة.",
                    "Cashier sends print job to the cloud server. The print agent (running on any device near the printer) picks it up automatically and prints — no network config needed."
                  )}</p>
                </div>

                {/* Printer IP & Port */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-green-700">{tc("IP الطابعة", "Printer IP")}</Label>
                    <Input
                      placeholder="192.168.8.77"
                      value={settings.networkIp || ''}
                      onChange={(e) => updateSetting('networkIp', e.target.value)}
                      className="font-mono text-sm border-green-300"
                      data-testid="input-queue-printer-ip"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-green-700">{tc("البورت", "Port")}</Label>
                    <Input
                      placeholder="9100"
                      value={String(settings.networkPort || 9100)}
                      onChange={(e) => updateSetting('networkPort', Number(e.target.value) || 9100)}
                      className="font-mono text-sm border-green-300"
                      data-testid="input-queue-printer-port"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Download pre-configured agent */}
                <div className="bg-white border-2 border-green-300 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-bold text-green-900">
                    {tc("خطوة واحدة فقط — على أي جهاز ويندوز في المطعم:", "One step only — on any Windows PC in the cafe:")}
                  </p>
                  <p className="text-xs text-green-700">
                    {tc("حمّل الملف التالي وشغّله بدبل كليك — يعمل تلقائياً بدون أي إعداد ويبدأ مع الويندوز", "Download this file and double-click — works automatically with no setup and starts with Windows")}
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/print-queue/agent-info');
                        const { serverUrl, agentKey } = await res.json();
                        const ip = settings.networkIp || '192.168.8.77';
                        const port = settings.networkPort || 9100;
                        const batContent = `@echo off\r\nchcp 65001 >nul 2>&1\r\ntitle QIROX - عامل الطباعة\r\necho.\r\necho  [QIROX] جارٍ التحقق من Node.js...\r\nnode --version >nul 2>&1\r\nif %errorlevel% neq 0 (\r\n  echo  [!] Node.js غير مثبت — حمّله من nodejs.org ثم أعد تشغيل هذا الملف\r\n  start https://nodejs.org\r\n  pause\r\n  exit /b 1\r\n)\r\necho  [✓] Node.js موجود\r\nif not exist print-agent.js (\r\n  echo  جارٍ تحميل عامل الطباعة...\r\n  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${serverUrl}/print-agent.js' -OutFile 'print-agent.js' -UseBasicParsing"\r\n)\r\nset QIROX_SERVER=${serverUrl}\r\nset QIROX_KEY=${agentKey}\r\nset PRINTER_IP=${ip}\r\nset PRINTER_PORT=${port}\r\nreg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "QIROXPrintAgent" /t REG_SZ /d "\\"%~f0\\"" /f >nul 2>&1\r\necho  [✓] سيبدأ تلقائياً مع كل تشغيل للويندوز\r\necho.\r\necho  الطابعة: ${ip}:${port}\r\necho  الطابور: ${serverUrl}\r\necho.\r\nnode print-agent.js --server ${serverUrl} --key ${agentKey} --ip ${ip} --port ${port}\r\npause\r\n`;
                        const blob = new Blob([batContent], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'chefsplace-print-agent.bat'; a.click();
                        URL.revokeObjectURL(url);
                      } catch (e: any) {
                        alert(tc('خطأ في تحميل الإعدادات: ' + e.message, 'Error fetching config: ' + e.message));
                      }
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors"
                    data-testid="button-download-print-agent"
                  >
                    ⬇ {tc("تحميل chefsplace-print-agent.bat (دبل كليك وخلاص)", "Download chefsplace-print-agent.bat (just double-click)")}
                  </button>
                  <p className="text-[11px] text-green-600 text-center">
                    {tc("الملف مُعدّ مسبقاً بكل الإعدادات — لا تحتاج لكتابة أي شيء", "Pre-configured with all settings — no typing required")}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Relay Agent Settings — for Tab Sense / Android / any device where QZ Tray is unavailable */}
          {isRelayMode && (
            <>
              <Separator />
              <div className="space-y-3 bg-violet-50 border border-violet-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                  <Network className="w-4 h-4" />
                  {tc("وكيل الطباعة المحلي — لأجهزة تاب سينس وأندرويد", "Local Print Relay — For Tab Sense & Android Devices")}
                </div>

                {/* Super simple 2-step setup */}
                <div className="space-y-3">

                  {/* Step 1 — Windows one-click */}
                  <div className="bg-white border-2 border-violet-300 rounded-xl p-3 space-y-2">
                    <p className="text-sm font-bold text-violet-900">
                      {tc("الخطوة 1 — على أي كمبيوتر ويندوز في المطعم:", "Step 1 — On any Windows PC in the cafe:")}
                    </p>
                    <p className="text-xs text-violet-700">
                      {tc("حمّل الملف التالي وشغّله بدبل كليك — سيعمل تلقائياً ويبدأ مع الويندوز كل مرة", "Download this file and double-click it — it runs automatically and starts with Windows every time")}
                    </p>
                    <a
                      href="/relay-setup.bat"
                      download="relay-setup.bat"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold transition-colors"
                      data-testid="link-download-relay-bat"
                    >
                      ⬇ {tc("تحميل relay-setup.bat (دبل كليك وخلاص)", "Download relay-setup.bat (just double-click)")}
                    </a>
                    <p className="text-[11px] text-violet-500 text-center">
                      {tc("بعد التشغيل ستظهر نافذة سوداء فيها رابط مثل: http://192.168.8.10:8089", "After running, a black window shows a URL like: http://192.168.8.10:8089")}
                    </p>
                  </div>

                  {/* Step 2 — Enter URL */}
                  <div className="bg-white border-2 border-violet-300 rounded-xl p-3 space-y-2">
                    <p className="text-sm font-bold text-violet-900">
                      {tc("الخطوة 2 — أدخل الرابط هنا:", "Step 2 — Enter the URL here:")}
                    </p>
                    <p className="text-xs text-violet-700">
                      {tc("انسخ الرابط الظاهر في النافذة السوداء والصقه أدناه", "Copy the URL shown in the black window and paste it below")}
                    </p>
                  </div>

                </div>

                <Separator className="border-violet-200" />

                {/* Relay Agent URL */}
                <div className="space-y-1">
                  <Label className="text-xs text-violet-700">{tc("رابط وكيل الطباعة (IP الجهاز الذي يشغّل الوكيل)", "Relay Agent URL (IP of the device running the relay)")}</Label>
                  <Input
                    placeholder="http://192.168.8.10:8089"
                    value={settings.relayAgentUrl || ''}
                    onChange={(e) => updateSetting('relayAgentUrl', e.target.value.trim())}
                    className="font-mono text-sm border-violet-300 focus:border-violet-500"
                    data-testid="input-relay-agent-url"
                    dir="ltr"
                  />
                  <p className="text-xs text-violet-500">{tc("مثال: http://192.168.8.10:8089 (IP الجهاز الذي يشغّل الوكيل + المنفذ 8089)", "Example: http://192.168.8.10:8089 (IP of relay device + port 8089)")}</p>
                </div>

                {/* Printer IP and Port */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-violet-700">{tc("IP الطابعة", "Printer IP")}</Label>
                    <Input
                      placeholder="192.168.8.77"
                      value={settings.networkIp || ''}
                      onChange={(e) => updateSetting('networkIp', e.target.value)}
                      className="font-mono text-sm border-violet-300"
                      data-testid="input-relay-printer-ip"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-violet-700">{tc("البورت", "Port")}</Label>
                    <Input
                      placeholder="9100"
                      value={String(settings.networkPort || 9100)}
                      onChange={(e) => updateSetting('networkPort', Number(e.target.value) || 9100)}
                      className="font-mono text-sm border-violet-300"
                      data-testid="input-relay-printer-port"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Test button */}
                <Button
                  onClick={handleTestRelayAgent}
                  disabled={relayTesting || !settings.relayAgentUrl?.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-test-relay-full"
                >
                  {relayTesting ? (
                    <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />{tc("جارٍ الفحص...", "Testing...")}</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 ml-2" />{tc("اختبار الاتصال بالوكيل والطابعة", "Test Relay & Printer Connection")}</>
                  )}
                </Button>

                <p className="text-xs text-violet-500 text-center">
                  {tc(
                    "💡 الوكيل والطابعة يجب أن يكونا على نفس الشبكة. الكاشير (تاب سينس) يتصل بالوكيل، والوكيل يتصل بالطابعة.",
                    "💡 The relay and printer must be on the same network. The cashier (Tab Sense) connects to the relay, which connects to the printer."
                  )}
                </p>
              </div>
            </>
          )}

          {/* Network Printer Settings (shown only in network mode) */}
          {isNetworkMode && (
            <>
              <Separator />
              <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <Network className="w-4 h-4" />
                    {tc("إعدادات الطابعة الشبكية (ProPos / LAN)", "Network Printer Settings (ProPos / LAN)")}
                  </div>
                </div>

                {/* Subnet hint input for discovery */}
                <div className="space-y-1">
                  <Label className="text-xs text-blue-700">{tc("نطاق الشبكة للبحث (اختياري)", "Network subnet to scan (optional)")}</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="192.168.8."
                      value={subnetHint}
                      onChange={(e) => setSubnetHint(e.target.value)}
                      className="font-mono text-sm flex-1"
                      data-testid="input-subnet-hint"
                      dir="ltr"
                    />
                    <span className="text-xs text-blue-500 whitespace-nowrap">{tc("مثال: 192.168.8.", "e.g. 192.168.8.")}</span>
                  </div>
                  <p className="text-xs text-blue-500">
                    {tc(
                      "إذا لم يجد البحث شيئاً، أدخل النطاق يدوياً (الأرقام الثلاثة الأولى من IP الطابعة + نقطة)",
                      "If auto-discover finds nothing, enter the subnet manually (first 3 numbers of printer IP + dot)"
                    )}
                  </p>
                </div>

                {/* Auto-discover button */}
                <Button
                  onClick={handleDiscoverPrinters}
                  disabled={discovering}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-discover-printers"
                >
                  {discovering ? (
                    <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />{tc("جارٍ البحث...", "Searching...")}</>
                  ) : (
                    <><Network className="w-4 h-4 ml-2" />{tc("🔍 بحث تلقائي عن الطابعة", "🔍 Auto-Discover Printer")}</>
                  )}
                </Button>

                {/* Scanning progress */}
                {discoverProgress && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-100 rounded px-2 py-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin flex-shrink-0" />
                    <span>{discoverProgress}</span>
                  </div>
                )}

                {/* Discovered printers list */}
                {discoveredPrinters.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-blue-800">
                      {tc(`✅ تم العثور على ${discoveredPrinters.length} طابعة — انقر لاختيارها:`, `✅ Found ${discoveredPrinters.length} printer(s) — click to select:`)}
                    </p>
                    {discoveredPrinters.map((p) => (
                      <button
                        key={p.ip}
                        onClick={() => { updateSetting('networkIp', p.ip); updateSetting('networkPort', p.port); setNetworkStatus(null); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${settings.networkIp === p.ip ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-blue-300 text-blue-800 hover:bg-blue-100'}`}
                        data-testid={`button-select-printer-${p.ip.replace(/\./g, '-')}`}
                      >
                        <div className="flex items-center gap-2">
                          <Printer className="w-4 h-4" />
                          <span className="font-mono font-bold">{p.ip}</span>
                        </div>
                        <span className="text-xs opacity-75">{tc(`منفذ ${p.port}`, `Port ${p.port}`)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {!discovering && discoveredPrinters.length === 0 && discoverProgress === null && (
                  <p className="text-xs text-blue-500 italic text-center">
                    {tc("انقر «بحث تلقائي» لفحص الشبكة، أو أدخل IP يدوياً", "Click 'Auto-Discover' to scan the network, or enter IP manually")}
                  </p>
                )}

                {/* Separator */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-blue-200" />
                  <span className="text-xs text-blue-400">{tc("أو أدخل يدوياً", "or enter manually")}</span>
                  <div className="flex-1 border-t border-blue-200" />
                </div>

                {/* Manual IP input */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-blue-700">{tc("عنوان IP الطابعة", "Printer IP Address")}</Label>
                    <Input
                      placeholder="192.168.1.100"
                      value={settings.networkIp || ''}
                      onChange={(e) => updateSetting('networkIp', e.target.value)}
                      className="font-mono text-sm"
                      data-testid="input-network-printer-ip"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-700">{tc("البورت", "Port")}</Label>
                    <Input
                      placeholder="9100"
                      value={String(settings.networkPort || 9100)}
                      onChange={(e) => updateSetting('networkPort', Number(e.target.value) || 9100)}
                      className="font-mono text-sm"
                      data-testid="input-network-printer-port"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600">
                  {tc(
                    "💡 البورت الافتراضي 9100. للطباعة المباشرة ESC/POS: أدخل رابط وكيل الطباعة أدناه.",
                    "💡 Default port is 9100. For direct ESC/POS printing: enter the relay agent URL below."
                  )}
                </p>

                {/* Relay Agent URL — visible in network mode for LAN routing */}
                <div className="space-y-1">
                  <Label className="text-xs text-blue-700 font-semibold">
                    {tc("رابط وكيل الطباعة (للطباعة المباشرة ESC/POS)", "Print Relay URL (for direct ESC/POS)")}
                  </Label>
                  <Input
                    placeholder="http://192.168.8.10:8089"
                    value={settings.relayAgentUrl || ''}
                    onChange={(e) => updateSetting('relayAgentUrl', e.target.value.trim())}
                    className="font-mono text-sm border-blue-300 focus:border-blue-500"
                    data-testid="input-network-relay-agent-url"
                    dir="ltr"
                  />
                  <p className="text-xs text-blue-500">
                    {tc(
                      "شغّل print-relay.js على أي جهاز بالشبكة، ثم أدخل رابطه هنا. مثال: http://192.168.8.10:8089",
                      "Run print-relay.js on any network device, then enter its URL here. e.g. http://192.168.8.10:8089"
                    )}
                  </p>
                </div>

                {/* LAN Printer guide — relay agent is required for LAN IPs */}
                {settings.networkIp && (
                  <div className={`rounded-lg border p-3 text-sm space-y-2 ${
                    settings.relayAgentUrl
                      ? 'bg-green-50 border-green-300'
                      : 'bg-amber-50 border-amber-300'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {settings.relayAgentUrl ? (
                        <><CheckCircle2 className="w-5 h-5 text-green-600" /><span className="text-green-800">{tc("وكيل الطباعة مكوّن ✓", "Print Relay Configured ✓")}</span></>
                      ) : (
                        <><AlertCircle className="w-5 h-5 text-amber-600" /><span className="text-amber-800">{tc("وكيل الطباعة مطلوب للطباعة المباشرة", "Print Relay Required for Direct Printing")}</span></>
                      )}
                    </div>
                    {settings.relayAgentUrl ? (
                      <p className="text-xs text-green-700 font-medium">
                        {tc(
                          "✅ الطباعة ستُرسَل مباشرةً عبر ESC/POS على المنفذ 9100 — بدون PDF وبدون نوافذ.",
                          "✅ Jobs sent directly via ESC/POS on port 9100 — no PDF, no dialogs."
                        )}
                      </p>
                    ) : (
                      <div className="space-y-2 text-xs text-amber-800">
                        <p className="font-semibold">{tc("لطباعة ESC/POS مباشرة على IP:9100، شغّل وكيل الطباعة المحلي:", "For direct ESC/POS printing to IP:9100, run the local print relay:")}</p>
                        <ol className="space-y-1 pr-3 list-decimal list-inside text-amber-700">
                          <li>{tc("ثبّت Node.js على جهاز الكاشير (nodejs.org)", "Install Node.js on the cashier device (nodejs.org)")}</li>
                          <li>{tc('حمّل ملف الوكيل: اضغط زر "⬇ الوكيل" أدناه', 'Download the relay file: click "⬇ Relay" below')}</li>
                          <li>{tc("شغّله: node print-relay.js", "Run it: node print-relay.js")}</li>
                          <li>{tc("أدخل رابطه هنا (مثال: http://192.168.8.10:8089)", "Enter its URL here (e.g. http://192.168.8.10:8089)")}</li>
                        </ol>
                        <a
                          href="/print-relay.js"
                          download="print-relay.js"
                          className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
                        >
                          {tc("⬇ تحميل وكيل الطباعة", "⬇ Download Print Relay")}
                        </a>
                        <p className="text-amber-600 pt-1 border-t border-amber-200 font-medium">
                          {tc("⚡ الوكيل يرسل ESC/POS مباشرة للطابعة عبر TCP — بدون PDF نهائياً.", "⚡ The relay sends ESC/POS directly to printer via TCP — zero PDF.")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bluetooth Printer Settings (shown only in bluetooth mode) */}
          {isBluetoothMode && (
            <>
              <Separator />
              <div className="space-y-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-800">
                  <Bluetooth className="w-4 h-4" />
                  {tc("إعدادات الطابعة اللاسلكية (BLE Bluetooth)", "Bluetooth Wireless Printer Settings (BLE)")}
                </div>

                {/* Device name display */}
                {(btState.deviceName || savedBtDevice?.name) && (
                  <div className="bg-white border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">
                        {btState.deviceName || savedBtDevice?.name}
                      </div>
                      {btState.connected
                        ? <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">● {tc("متصلة", "Connected")}</span>
                        : <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">○ {tc("غير متصلة", "Disconnected")}</span>
                      }
                    </div>
                    {!btState.connected && savedBtDevice && (
                      <Button
                        onClick={handleReconnectBluetooth}
                        disabled={btReconnecting || !btAvailable}
                        size="sm"
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        data-testid="button-reconnect-bluetooth"
                      >
                        {btReconnecting
                          ? <><RefreshCw className="w-3 h-3 ml-1.5 animate-spin" />{tc("جارٍ إعادة الاتصال...", "Reconnecting...")}</>
                          : <><RefreshCw className="w-3 h-3 ml-1.5" />{tc("أعد الاتصال بدون بحث", "Reconnect without scanning")}</>
                        }
                      </Button>
                    )}
                  </div>
                )}

                {/* Connection button */}
                <Button
                  onClick={handleConnectBluetooth}
                  disabled={btConnecting || !btAvailable}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-pair-bluetooth-printer-main"
                >
                  {btConnecting ? (
                    <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />{tc("جارٍ الاقتران...", "Pairing...")}</>
                  ) : btState.connected ? (
                    <><BluetoothConnected className="w-4 h-4 ml-2" />{tc("تغيير الطابعة / إعادة اقتران", "Change / Re-pair Printer")}</>
                  ) : (
                    <><Bluetooth className="w-4 h-4 ml-2" />{tc("ابحث عن طابعة بلوتوث", "Search for Bluetooth Printer")}</>
                  )}
                </Button>

                {/* Compatible printers */}
                <div className="text-xs text-purple-600 space-y-1">
                  <p className="font-semibold">{tc("🖨️ طابعات متوافقة:", "🖨️ Compatible printers:")}</p>
                  <p>• Xprinter XP-P300BT / XP-58BT / XP-80BT</p>
                  <p>• MUNBYN ITPP941 Bluetooth</p>
                  <p>• Rongta RPP300 / RPP200 BT</p>
                  <p>• EPSON TM-P20 / TM-P60II Bluetooth</p>
                  <p>• {tc("أي طابعة حرارية تدعم BLE ESC/POS", "Any thermal printer supporting BLE ESC/POS")}</p>
                </div>

                {/* Browser requirement */}
                {!btAvailable && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    <BluetoothOff className="w-3 h-3 flex-shrink-0" />
                    {tc(
                      "Web Bluetooth غير مدعوم في هذا المتصفح. استخدم Google Chrome أو Microsoft Edge على سطح المكتب أو Android.",
                      "Web Bluetooth is not supported in this browser. Use Google Chrome or Microsoft Edge on desktop or Android."
                    )}
                  </div>
                )}

                <p className="text-xs text-purple-600">
                  {tc(
                    "💡 تأكد من تشغيل البلوتوث على جهازك وأن الطابعة في وضع الاقتران قبل النقر على الزر أعلاه.",
                    "💡 Make sure Bluetooth is enabled on your device and the printer is in pairing mode before clicking the button above."
                  )}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Auto Print */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{tc("طباعة تلقائية عند إتمام الطلب", "Auto-print when order completes")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("يطبع الفاتورة فور إتمام الدفع", "Prints receipt immediately after payment")}</p>
            </div>
            <Switch
              checked={settings.autoPrint}
              onCheckedChange={(v) => updateSetting('autoPrint', v)}
              data-testid="switch-auto-print"
            />
          </div>

          <Separator />

          {/* Kitchen Copy */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{tc("نسخة المطبخ التلقائية", "Auto kitchen copy")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("يطبع نسخة للمطبخ مع فاتورة العميل", "Prints kitchen ticket alongside customer receipt")}</p>
            </div>
            <Switch
              checked={settings.autoKitchenCopy}
              onCheckedChange={(v) => updateSetting('autoKitchenCopy', v)}
              data-testid="switch-auto-kitchen"
            />
          </div>

          <Separator />

          {/* عدد نسخ فاتورة العميل */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">{tc("عدد نسخ فاتورة العميل", "Customer receipt copies")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("كم نسخة تطبع من فاتورة العميل لكل طلب", "How many customer receipts to print per order")}</p>
            </div>
            <Select
              value={String(settings.customerCopies ?? 1)}
              onValueChange={(v) => updateSetting('customerCopies', Number(v))}
            >
              <SelectTrigger className="w-24" data-testid="select-customer-copies">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {tc("نسخة", "copies")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* عدد نسخ المطبخ/الموظف */}
          <div className={`flex items-center justify-between gap-4 ${!settings.autoKitchenCopy ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <Label className="text-sm font-medium">{tc("عدد نسخ المطبخ/الموظف", "Kitchen copies")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("كم نسخة تطبع من تذكرة المطبخ", "How many kitchen tickets to print")}</p>
            </div>
            <Select
              value={String(settings.kitchenCopies ?? 1)}
              onValueChange={(v) => updateSetting('kitchenCopies', Number(v))}
              disabled={!settings.autoKitchenCopy}
            >
              <SelectTrigger className="w-24" data-testid="select-kitchen-copies">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {tc("نسخة", "copies")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* الرابط العام لتتبع الطلب */}
          <div className="flex flex-col gap-2">
            <div>
              <Label className="text-sm font-medium">{tc("رابط الموقع العام (لباركود التتبع)", "Public site URL (for tracking QR)")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("الرابط الذي يستخدمه العملاء (مثل https://chefsplace.online). إذا تركته فارغاً، سيستخدم نفس عنوان المتصفح.", "Public URL customers use (e.g. https://chefsplace.online). If empty, uses the current browser URL.")}</p>
            </div>
            <Input
              type="url"
              placeholder="https://example.com"
              value={settings.publicBaseUrl ?? ''}
              onChange={(e) => updateSetting('publicBaseUrl', e.target.value.trim())}
              data-testid="input-public-base-url"
              dir="ltr"
            />
          </div>

          <Separator />

          {/* Paper Width */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">{tc("عرض الورق", "Paper Width")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("حدد حجم ورق الطابعة الحرارية", "Select thermal printer paper size")}</p>
            </div>
            <Select value={settings.paperWidth} onValueChange={(v: any) => updateSetting('paperWidth', v)}>
              <SelectTrigger className="w-28" data-testid="select-paper-width">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58 مم</SelectItem>
                <SelectItem value="80mm">80 مم</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Feed Lines */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">{tc("أسطر تغذية قبل القطع", "Feed lines before cut")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("مسافة قبل قطع الورق", "Space before paper cut")}</p>
            </div>
            <Select value={String(settings.feedLines)} onValueChange={(v) => updateSetting('feedLines', Number(v))}>
              <SelectTrigger className="w-24" data-testid="select-feed-lines">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {tc("سطر", "lines")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{tc("تفعيل نظام الطباعة", "Enable print system")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{tc("تعطيل هذا الخيار يوقف جميع الطباعة", "Disabling stops all printing")}</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => updateSetting('enabled', v)}
              data-testid="switch-printer-enabled"
            />
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-2">
              {isRelayMode ? (
                <>
                  <p className="font-semibold">{tc("إعداد وكيل الطباعة المحلي (لتاب سينس وأندرويد):", "Local Print Relay Setup (for Tab Sense & Android):")}</p>
                  <ol className="list-decimal list-inside space-y-0.5 pr-2">
                    <li>{tc("ثبّت Node.js على أي جهاز (ويندوز/ماك/لينكس) في نفس الشبكة", "Install Node.js on any device (Win/Mac/Linux) on the same network")}</li>
                    <li>{tc("حمّل print-relay.js من الإعدادات أعلاه وشغّله بـ: node print-relay.js", "Download print-relay.js from settings above and run: node print-relay.js")}</li>
                    <li>{tc("انسخ IP الجهاز الذي يشغّل الوكيل (يظهر عند التشغيل)", "Copy the IP of the device running the relay (shown on startup)")}</li>
                    <li>{tc("أدخل رابط الوكيل: http://192.168.x.x:8089", "Enter relay URL: http://192.168.x.x:8089")}</li>
                    <li>{tc("أدخل IP الطابعة ثم اضغط 'اختبار الاتصال'", "Enter printer IP then click 'Test Connection'")}</li>
                  </ol>
                  <p>{tc("💡 الوكيل يعمل مع أي طابعة ESC/POS شبكية ويحل مشكلة تاب سينس والأجهزة الأندرويد", "💡 The relay works with any ESC/POS network printer and solves Tab Sense / Android printing issues")}</p>
                </>
              ) : isNetworkMode ? (
                <>
                  <p className="font-semibold">{tc("إعداد الطابعة الشبكية (ProPos / LAN):", "Network Printer Setup (ProPos / LAN):")}</p>
                  <ol className="list-decimal list-inside space-y-0.5 pr-2">
                    <li>{tc("تأكد أن الطابعة متصلة بنفس شبكة الـ WiFi أو الـ LAN", "Ensure printer is on the same WiFi/LAN network")}</li>
                    <li>{tc("افتح تطبيق ProPos أو لوحة الطابعة للحصول على IP", "Open ProPos app or printer panel to get the IP")}</li>
                    <li>{tc("أدخل IP الطابعة والبورت (الافتراضي 9100)", "Enter printer IP and port (default: 9100)")}</li>
                    <li>{tc("اضغط 'اختبار الاتصال' للتحقق", "Click 'Test Connection' to verify")}</li>
                    <li>{tc("اضغط 'طباعة تجريبية' للتأكد النهائي", "Click 'Test Print' to confirm")}</li>
                  </ol>
                  <p>{tc("💡 يعمل مع ProPos وEpson TM وXprinter NW وأي طابعة ESC/POS شبكية", "💡 Works with ProPos, Epson TM, Xprinter NW, and any ESC/POS network printer")}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{tc("إعداد الطابعة USB (WebUSB):", "USB Printer Setup (WebUSB):")}</p>
                  <ol className="list-decimal list-inside space-y-0.5 pr-2">
                    <li>{tc("استخدم متصفح Chrome أو Edge", "Use Chrome or Edge browser")}</li>
                    <li>{tc("وصّل الطابعة الحرارية بـ USB", "Connect thermal printer via USB")}</li>
                    <li>{tc("اضغط 'اختر الطابعة (USB)' واختر طابعتك", "Click 'Select Printer (USB)' and choose your printer")}</li>
                    <li>{tc("اضغط 'طباعة تجريبية' للتأكد", "Click 'Test Print' to verify")}</li>
                    <li>{tc("الآن كل طلب يُطبع تلقائياً بدون نوافذ", "Every order prints automatically without dialogs")}</li>
                  </ol>
                  <p>{tc("💡 لطابعة شبكية (ProPos/LAN) غيّر الوضع إلى 'شبكة LAN' من القائمة أعلاه", "💡 For network printer (ProPos/LAN), switch mode to 'Network LAN' above")}</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
