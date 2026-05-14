import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight, ArrowLeft, Printer, Wifi, Download, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, Play, Network, Cpu, Globe,
  Terminal, ChevronRight, Loader2, Search
} from "lucide-react";
import {
  loadPrinterSettings,
  savePrinterSettings,
  testRelayAgent,
  testRelayPrinterRole,
  discoverNetworkPrinters,
} from "@/lib/thermal-printer";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  { id: 1, label: "طريقة الاتصال" },
  { id: 2, label: "تحميل الوكيل" },
  { id: 3, label: "ربط الوكيل" },
  { id: 4, label: "إعداد الطابعات" },
  { id: 5, label: "تأكيد الاتصال" },
];

type PrinterRole = "customer" | "kitchen1" | "kitchen2";

interface PrinterConfig {
  ip: string;
  port: number;
  status: "idle" | "testing" | "ok" | "fail";
  message: string;
}

export default function EthernetPrinterSetup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Step 3 state
  const [relayUrl, setRelayUrl] = useState(() => loadPrinterSettings().relayAgentUrl || "");
  const [relayStatus, setRelayStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [relayMessage, setRelayMessage] = useState("");
  const [autoScanning, setAutoScanning] = useState(false);

  // Step 4 state
  const [printers, setPrinters] = useState<Record<PrinterRole, PrinterConfig>>(() => {
    const s = loadPrinterSettings();
    return {
      customer: { ip: s.customerPrinterIp || "192.168.3.22", port: s.customerPrinterPort || 9100, status: "idle", message: "" },
      kitchen1: { ip: s.kitchen1PrinterIp || "192.168.1.114", port: s.kitchen1PrinterPort || 9100, status: "idle", message: "" },
      kitchen2: { ip: s.kitchen2PrinterIp || "", port: s.kitchen2PrinterPort || 9100, status: "idle", message: "" },
    };
  });

  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{ ip: string; port: number }[]>([]);

  function updatePrinter(role: PrinterRole, patch: Partial<PrinterConfig>) {
    setPrinters(prev => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  async function handleTestRelay() {
    const url = relayUrl.trim();
    if (!url) {
      toast({ title: "أدخل رابط الوكيل", variant: "destructive" });
      return;
    }
    setRelayStatus("testing");
    setRelayMessage("");
    const result = await testRelayAgent(url);
    setRelayStatus(result.connected ? "ok" : "fail");
    setRelayMessage(result.message);
    if (result.connected) {
      savePrinterSettings({ relayAgentUrl: url, mode: "relay" });
      toast({ title: "✅ وكيل الطباعة يعمل" });
    }
  }

  async function handleAutoDetectRelay() {
    setAutoScanning(true);
    setRelayMessage("جارٍ البحث عن وكيل الطباعة تلقائياً...");
    setRelayStatus("testing");

    const commonSubnets = ["192.168.1.", "192.168.0.", "192.168.3.", "192.168.8.", "10.0.0.", "10.0.1."];
    const port = 8089;

    for (const subnet of commonSubnets) {
      // Try a few likely addresses in each subnet
      for (const host of [1, 2, 5, 10, 100, 200]) {
        const ip = `${subnet}${host}`;
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 1500);
          const resp = await fetch(`http://${ip}:${port}/status`, { signal: controller.signal });
          if (resp.ok) {
            const info = await resp.json();
            if (info.name?.includes("Print Relay") || info.status === "running") {
              const foundUrl = `http://${ip}:${port}`;
              setRelayUrl(foundUrl);
              setRelayStatus("ok");
              setRelayMessage(`✅ تم العثور على وكيل الطباعة على ${foundUrl}`);
              savePrinterSettings({ relayAgentUrl: foundUrl, mode: "relay" });
              toast({ title: `✅ تم اكتشاف الوكيل على ${ip}` });
              setAutoScanning(false);
              return;
            }
          }
        } catch { /* skip */ }
      }
    }

    setRelayStatus("fail");
    setRelayMessage("لم يُعثر على وكيل الطباعة تلقائياً. أدخل الرابط يدوياً.");
    setAutoScanning(false);
  }

  async function handleTestPrinter(role: PrinterRole) {
    const url = relayUrl.trim() || loadPrinterSettings().relayAgentUrl || "";
    const cfg = printers[role];
    if (!cfg.ip) {
      toast({ title: "أدخل IP الطابعة", variant: "destructive" });
      return;
    }
    updatePrinter(role, { status: "testing", message: "" });
    const result = await testRelayPrinterRole(url, role, cfg.ip, cfg.port);
    updatePrinter(role, {
      status: result.connected ? "ok" : "fail",
      message: result.message,
    });
    if (result.connected) {
      savePrinterSettings({
        ...(role === "customer" ? { customerPrinterIp: cfg.ip, customerPrinterPort: cfg.port } : {}),
        ...(role === "kitchen1" ? { kitchen1PrinterIp: cfg.ip, kitchen1PrinterPort: cfg.port } : {}),
        ...(role === "kitchen2" ? { kitchen2PrinterIp: cfg.ip, kitchen2PrinterPort: cfg.port } : {}),
      });
    }
  }

  async function handleDiscoverPrinters() {
    const url = relayUrl.trim();
    if (!url) {
      toast({ title: "فعّل وكيل الطباعة أولاً في الخطوة السابقة", variant: "destructive" });
      return;
    }
    setDiscovering(true);
    setDiscovered([]);
    try {
      // Scan using saved subnet hints from existing IPs
      const hints: string[] = [];
      const ips = [printers.customer.ip, printers.kitchen1.ip].filter(Boolean);
      ips.forEach(ip => {
        const parts = ip.split(".");
        if (parts.length === 4) hints.push(parts.slice(0, 3).join(".") + ".");
      });
      const subnet = hints[0] || undefined;
      const found = await discoverNetworkPrinters(9100, 300, subnet);
      setDiscovered(found);
      if (found.length > 0) {
        toast({ title: `✅ تم العثور على ${found.length} طابعة`, description: found.map(p => p.ip).join(" • ") });
      } else {
        toast({ title: "لم يُعثر على طابعات", description: "تأكد أن الطابعات مشغّلة ومتصلة بالشبكة", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  }

  function handleSaveAndFinish() {
    savePrinterSettings({
      mode: "relay",
      relayAgentUrl: relayUrl.trim(),
      customerPrinterIp: printers.customer.ip,
      customerPrinterPort: printers.customer.port,
      kitchen1PrinterIp: printers.kitchen1.ip,
      kitchen1PrinterPort: printers.kitchen1.port,
      kitchen2PrinterIp: printers.kitchen2.ip,
      kitchen2PrinterPort: printers.kitchen2.port,
    });
    toast({ title: "✅ تم حفظ إعدادات الطابعات" });
    navigate("/manager/dashboard");
  }

  const canProceed = (s: number) => {
    if (s === 3) return relayStatus === "ok";
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/manager/dashboard")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-base font-bold">إعداد طابعات الإيثرنت</h1>
          <p className="text-xs text-gray-500">ربط طابعات الشبكة بنظام QIROX</p>
        </div>
        <Badge className="mr-auto bg-primary/10 text-primary border-0">
          الخطوة {step} / {STEPS.length}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <div
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  step > s.id ? "bg-primary" : step === s.id ? "bg-primary/60" : "bg-gray-200"
                }`}
              />
              {i < STEPS.length - 1 && <div className="w-1" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          {STEPS.map(s => (
            <span key={s.id} className={`text-[10px] ${step === s.id ? "text-primary font-semibold" : "text-gray-400"}`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── Step 1: Architecture explanation ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Network className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold">كيف تعمل طابعات الإيثرنت؟</h2>
              <p className="text-sm text-gray-500">فهم المشكلة وطريقة الحل</p>
            </div>

            {/* Problem */}
            <Card className="border-red-100 bg-red-50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                  <XCircle className="w-4 h-4 shrink-0" />
                  المشكلة: لماذا لا تتصل الطابعة مباشرة؟
                </div>
                <div className="text-xs text-red-600 space-y-1 mr-6">
                  <p>• النظام يعمل على سيرفر سحابي (Replit / Cloud)</p>
                  <p>• السيرفر لا يمكنه الوصول لـ 192.168.x.x (شبكة محلية)</p>
                  <p>• المتصفح لا يستطيع فتح TCP socket مباشرة للطابعة</p>
                </div>
              </CardContent>
            </Card>

            {/* Architecture flow */}
            <Card className="border-primary/20 bg-white">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">الحل: وكيل الطباعة المحلي</p>
                <div className="flex items-center justify-between text-center gap-1">
                  {[
                    { icon: Globe, label: "متصفح الكاشير", color: "bg-blue-100 text-blue-700" },
                    { icon: ChevronRight, label: "HTTP", color: "", arrow: true },
                    { icon: Cpu, label: "وكيل الطباعة\n(جهاز محلي)", color: "bg-primary/10 text-primary" },
                    { icon: ChevronRight, label: "TCP 9100", color: "", arrow: true },
                    { icon: Printer, label: "الطابعة", color: "bg-green-100 text-green-700" },
                  ].map((item, i) => (
                    item.arrow ? (
                      <div key={i} className="flex flex-col items-center gap-0.5 shrink-0">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-[9px] text-gray-400">{item.label}</span>
                      </div>
                    ) : (
                      <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] text-gray-600 whitespace-pre-line leading-tight">{item.label}</span>
                      </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Solution */}
            <Card className="border-green-100 bg-green-50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  الحل: برنامج وكيل الطباعة
                </div>
                <div className="text-xs text-green-600 space-y-1 mr-6">
                  <p>• برنامج صغير يعمل على أي جهاز في الشبكة (ويندوز / ماك / راسبري باي)</p>
                  <p>• يستقبل أوامر الطباعة من النظام ويرسلها للطابعة عبر TCP</p>
                  <p>• يعمل في الخلفية ويدعم 3 طابعات مختلفة</p>
                  <p>• مجاني 100% ومرفق مع النظام</p>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full bg-primary" onClick={() => setStep(2)}>
              فهمت — ابدأ الإعداد
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Download relay agent ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Download className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold">تحميل وتشغيل الوكيل</h2>
              <p className="text-sm text-gray-500">على أي جهاز في الشبكة المحلية</p>
            </div>

            {/* Prerequisites */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">المتطلبات</p>
                <div className="space-y-2">
                  {[
                    { label: "Node.js 16+", sub: "من nodejs.org — مجاني", ok: true },
                    { label: "جهاز ويندوز / ماك / لينكس", sub: "في نفس الشبكة مع الطابعات", ok: true },
                    { label: "الطابعات تدعم TCP Port 9100", sub: "Epson / Xprinter / ProPos / Sunmi", ok: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Downloads */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">الخطوات</p>

              {[
                {
                  step: "1",
                  title: "تحميل ملف الوكيل",
                  desc: "ملف JavaScript واحد — لا يحتاج تثبيت",
                  action: (
                    <a href="/print-relay.js" download="print-relay.js">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        print-relay.js
                      </Button>
                    </a>
                  ),
                },
                {
                  step: "2",
                  title: "تحميل مُثبّت ويندوز (اختياري)",
                  desc: "سكريبت يثبّت Node.js ويشغّل الوكيل تلقائياً",
                  action: (
                    <a href="/install-print-relay.bat" download="install-print-relay.bat">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        install-print-relay.bat
                      </Button>
                    </a>
                  ),
                },
                {
                  step: "3",
                  title: "تشغيل الوكيل",
                  desc: null,
                  action: null,
                  code: "node print-relay.js",
                },
              ].map((item) => (
                <Card key={item.step} className="border-gray-200">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {item.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.desc && <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>}
                        {item.code && (
                          <div className="mt-2 bg-gray-900 text-green-400 rounded px-3 py-2 flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 shrink-0" />
                            <code className="text-xs font-mono">{item.code}</code>
                          </div>
                        )}
                        {item.action && <div className="mt-2">{item.action}</div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Expected output */}
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="p-3">
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  الناتج المتوقع عند التشغيل:
                </p>
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap">{`╔═══════════════════════════════════╗
║  QIROX Print Relay Agent v3.0    ║
╠═══════════════════════════════════╣
║  روابط الوكيل:                   ║
║    http://192.168.1.5:8089       ║
╚═══════════════════════════════════╝

✅ الحالة : يعمل — في انتظار الطباعة`}</pre>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowRight className="w-4 h-4 ml-1" />
                رجوع
              </Button>
              <Button className="flex-1 bg-primary" onClick={() => setStep(3)}>
                شغّلت الوكيل — التالي
                <ArrowLeft className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Connect relay ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Wifi className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold">ربط وكيل الطباعة</h2>
              <p className="text-sm text-gray-500">أدخل رابط الوكيل الذي ظهر في الطرفية</p>
            </div>

            {/* Auto detect */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">اكتشاف تلقائي</p>
                <p className="text-xs text-gray-500">يبحث النظام عن وكيل الطباعة تلقائياً في الشبكة المحلية</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={handleAutoDetectRelay}
                  disabled={autoScanning}
                >
                  {autoScanning ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ البحث...</>
                  ) : (
                    <><Search className="w-3.5 h-3.5" /> ابحث تلقائياً</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Separator className="my-1" />
            <p className="text-xs text-center text-gray-400">أو أدخل الرابط يدوياً</p>

            {/* Manual entry */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">رابط وكيل الطباعة</label>
              <div className="flex gap-2">
                <Input
                  dir="ltr"
                  placeholder="http://192.168.1.5:8089"
                  value={relayUrl}
                  onChange={e => { setRelayUrl(e.target.value); setRelayStatus("idle"); }}
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">
                الرابط يظهر عند تشغيل الوكيل — انظر السطر <code className="bg-gray-100 px-1 rounded">http://xxx.xxx.xxx.xxx:8089</code>
              </p>
            </div>

            <Button
              className="w-full bg-primary gap-2"
              onClick={handleTestRelay}
              disabled={relayStatus === "testing" || !relayUrl.trim()}
            >
              {relayStatus === "testing" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الاختبار...</>
              ) : (
                <><Play className="w-4 h-4" /> اختبر الاتصال</>
              )}
            </Button>

            {/* Status */}
            {relayStatus !== "idle" && (
              <Card className={`border ${relayStatus === "ok" ? "border-green-200 bg-green-50" : relayStatus === "fail" ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                <CardContent className="p-3 flex items-start gap-2">
                  {relayStatus === "ok" && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                  {relayStatus === "fail" && <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
                  {relayStatus === "testing" && <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />}
                  <p className={`text-xs whitespace-pre-line ${relayStatus === "ok" ? "text-green-700" : relayStatus === "fail" ? "text-red-700" : "text-gray-600"}`}>
                    {relayMessage}
                  </p>
                </CardContent>
              </Card>
            )}

            {relayStatus === "fail" && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    تحقق من التالي:
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5 mr-5 list-disc">
                    <li>الوكيل يعمل؟ تحقق من الطرفية (لا تُغلقها)</li>
                    <li>جهاز الكاشير والوكيل على نفس الشبكة الواي فاي؟</li>
                    <li>IP صحيح؟ راجع ما ظهر عند تشغيل الوكيل</li>
                    <li>جدار الحماية (Firewall) لا يمنع المنفذ 8089؟</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                <ArrowRight className="w-4 h-4 ml-1" />
                رجوع
              </Button>
              <Button
                className="flex-1 bg-primary"
                onClick={() => setStep(4)}
                disabled={relayStatus !== "ok"}
              >
                التالي
                <ArrowLeft className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Configure printers ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Printer className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold">إعداد الطابعات</h2>
              <p className="text-sm text-gray-500">أدخل IP كل طابعة واختبر الاتصال</p>
            </div>

            {/* Auto-discover */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">اكتشاف الطابعات تلقائياً</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={handleDiscoverPrinters}
                    disabled={discovering}
                  >
                    {discovering ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الفحص...</>
                    ) : (
                      <><Search className="w-3.5 h-3.5" /> ابحث عن طابعات</>
                    )}
                  </Button>
                </div>
                {discovered.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">اضغط IP لنسخه في حقل الطابعة:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {discovered.map(p => (
                        <button
                          key={p.ip}
                          className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-mono hover:bg-primary/20 transition-colors"
                          onClick={() => {
                            const roles: PrinterRole[] = ["customer", "kitchen1", "kitchen2"];
                            const empty = roles.find(r => !printers[r].ip);
                            if (empty) updatePrinter(empty, { ip: p.ip });
                            else toast({ title: "انسخ IP وألصقه يدوياً", description: p.ip });
                          }}
                        >
                          {p.ip}:{p.port}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Printer rows */}
            {(["customer", "kitchen1", "kitchen2"] as PrinterRole[]).map((role) => {
              const labels: Record<PrinterRole, string> = {
                customer: "🧾 طابعة فاتورة العميل",
                kitchen1: "🍳 طابعة المطبخ 1",
                kitchen2: "🍳 طابعة المطبخ 2",
              };
              const cfg = printers[role];
              return (
                <Card key={role} className={`border ${cfg.status === "ok" ? "border-green-200" : cfg.status === "fail" ? "border-red-200" : "border-gray-200"}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{labels[role]}</p>
                      {cfg.status === "ok" && <Badge className="bg-green-100 text-green-700 border-0 text-xs">✅ متصلة</Badge>}
                      {cfg.status === "fail" && <Badge className="bg-red-100 text-red-700 border-0 text-xs">❌ خطأ</Badge>}
                      {cfg.status === "testing" && <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">جارٍ...</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          dir="ltr"
                          placeholder="192.168.1.50"
                          value={cfg.ip}
                          onChange={e => updatePrinter(role, { ip: e.target.value, status: "idle" })}
                          className="font-mono text-sm h-8"
                        />
                      </div>
                      <Input
                        dir="ltr"
                        placeholder="9100"
                        value={cfg.port}
                        onChange={e => updatePrinter(role, { port: Number(e.target.value) || 9100, status: "idle" })}
                        className="w-20 font-mono text-sm h-8"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 gap-1"
                        onClick={() => handleTestPrinter(role)}
                        disabled={cfg.status === "testing" || !cfg.ip}
                      >
                        {cfg.status === "testing" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                    {cfg.message && (
                      <p className={`text-xs ${cfg.status === "ok" ? "text-green-600" : "text-red-600"}`}>
                        {cfg.message.split("\n").slice(-1)[0]}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Card className="border-gray-200 bg-gray-50">
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
                  طابعة المطبخ 2 اختيارية. اتركها فارغة إذا لم يكن لديك طابعة ثالثة.
                </p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                <ArrowRight className="w-4 h-4 ml-1" />
                رجوع
              </Button>
              <Button
                className="flex-1 bg-primary"
                onClick={() => setStep(5)}
              >
                التالي
                <ArrowLeft className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Summary & finish ── */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">الإعداد مكتمل!</h2>
              <p className="text-sm text-gray-500">ملخص إعدادات الطابعات</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-primary" />
                    وكيل الطباعة
                  </span>
                  <span className="text-sm font-mono text-gray-800 flex items-center gap-1">
                    {relayUrl || loadPrinterSettings().relayAgentUrl || "—"}
                    {relayStatus === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  </span>
                </div>
                {(["customer", "kitchen1", "kitchen2"] as PrinterRole[]).map(role => {
                  const labels: Record<PrinterRole, string> = {
                    customer: "طابعة العميل",
                    kitchen1: "المطبخ 1",
                    kitchen2: "المطبخ 2",
                  };
                  const cfg = printers[role];
                  return (
                    <div key={role} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-gray-400" />
                        {labels[role]}
                      </span>
                      <span className="text-sm font-mono text-gray-800 flex items-center gap-1">
                        {cfg.ip ? `${cfg.ip}:${cfg.port}` : "—"}
                        {cfg.ip && cfg.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        {cfg.ip && cfg.status === "fail" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="border-blue-100 bg-blue-50">
              <CardContent className="p-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-800">نصائح مهمة</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc mr-4">
                  <li>تأكد أن الوكيل يعمل دائماً عند فتح المطعم</li>
                  <li>يمكن جعل الوكيل يعمل تلقائياً عند بدء تشغيل الجهاز</li>
                  <li>على ويندوز: اضغط مرتين على install-print-relay.bat للتثبيت كخدمة</li>
                  <li>افتح <code className="bg-blue-100 px-0.5 rounded">http://IP:8089</code> في المتصفح لرؤية حالة الطابعات</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                <ArrowRight className="w-4 h-4 ml-1" />
                تعديل
              </Button>
              <Button className="flex-1 bg-primary" onClick={handleSaveAndFinish}>
                <CheckCircle2 className="w-4 h-4 ml-1" />
                حفظ والإنهاء
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
