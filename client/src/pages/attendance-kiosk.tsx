// ═══════════════════════════════════════════════════════════════════════════
// QIROX Attendance Kiosk — شاشة الحضور الذكية
// Full-screen terminal: Face Recognition + Dynamic QR + Manual
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  loadFaceModels, isLoaded, buildMatcher, detectFaceInVideo,
  matchDescriptor, createLivenessTracker, type EmployeeFaceEntry, type FaceMatchResult
} from "@/lib/face-recognition";
import { brand } from "@/lib/brand";
import {
  Wifi, WifiOff, Camera, QrCode, Keyboard, CheckCircle, XCircle,
  Clock, Users, AlertTriangle, UserCheck, Loader2, RefreshCw, Shield,
  Scan, ChevronRight, Timer, Star, LogOut
} from "lucide-react";
import QRCode from "qrcode";

// ─── Hijri Date ────────────────────────────────────────────────────────────
function toHijri(date: Date): string {
  try {
    return date.toLocaleDateString("ar-SA-u-ca-islamic", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch { return ""; }
}

// ─── Types ─────────────────────────────────────────────────────────────────
type Mode = "face" | "qr" | "manual";
interface KioskStats { present: number; late: number; absent: number; total: number; checkedOut: number }
interface RecentEntry {
  employeeId: string; fullName: string; jobTitle: string; imageUrl?: string;
  checkInTime: string; isLate: number; lateMinutes: number; checkInMethod: string;
}
interface CheckInResult {
  success: boolean;
  employee: { fullName: string; jobTitle: string; role: string; imageUrl?: string };
  isLate: number; lateMinutes: number; earlyMinutes?: number;
  checkInTime: string; shiftStart: string; confidence?: number;
}

// ─── Check-in Result Overlay ───────────────────────────────────────────────
function ResultOverlay({ result, onClose }: { result: CheckInResult | null; onClose: () => void }) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [result, onClose]);

  if (!result) return null;
  const { isLate, lateMinutes, earlyMinutes = 0, employee, checkInTime, shiftStart, confidence } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-[480px] rounded-3xl p-10 text-center shadow-2xl border-2 ${isLate ? "bg-gradient-to-b from-orange-950 to-black border-orange-500/50" : "bg-gradient-to-b from-emerald-950 to-black border-emerald-500/50"}`} onClick={e => e.stopPropagation()}>
        {/* Avatar */}
        <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center border-4 overflow-hidden ${isLate ? "border-orange-400" : "border-emerald-400"}`}>
          {employee.imageUrl ? (
            <img src={employee.imageUrl} alt={employee.fullName} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-4xl font-bold ${isLate ? "bg-orange-900 text-orange-400" : "bg-emerald-900 text-emerald-400"}`}>
              {employee.fullName[0]}
            </div>
          )}
        </div>

        {/* Status Icon */}
        <div className="mb-4">
          {isLate ? (
            <div className="text-6xl">⚠️</div>
          ) : (
            <div className="text-6xl">✅</div>
          )}
        </div>

        {/* Name */}
        <h2 className="text-3xl font-bold text-white mb-1">
          {isLate ? "" : "مرحباً"} {employee.fullName}
        </h2>
        <p className={`text-lg mb-6 ${isLate ? "text-orange-400" : "text-emerald-400"}`}>
          {employee.jobTitle}
        </p>

        {/* Details */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-3 text-right mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">وقت الدوام</span>
            <span className="text-white font-bold">{shiftStart}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">وقت التسجيل</span>
            <span className="text-white font-bold">{checkInTime}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">الحالة</span>
            <span className={`font-bold ${isLate ? "text-orange-400" : "text-emerald-400"}`}>
              {isLate ? `متأخر ${lateMinutes} دقيقة` : earlyMinutes > 0 ? `مبكر ${earlyMinutes} دقيقة` : "في الوقت"}
            </span>
          </div>
          {confidence !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">دقة التعرف</span>
              <span className="text-blue-400 font-bold">{confidence}%</span>
            </div>
          )}
        </div>

        <button className="text-gray-400 text-sm hover:text-white transition-colors" onClick={onClose}>
          اضغط للإغلاق أو سيُغلق تلقائياً بعد 6 ثوانٍ
        </button>
      </div>
    </div>
  );
}

// ─── Face Recognition Panel ────────────────────────────────────────────────
function FacePanel({ onSuccess }: { onSuccess: (r: CheckInResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "detecting" | "matched" | "error">("loading");
  const [message, setMessage] = useState("جارٍ تحميل نماذج الذكاء الاصطناعي...");
  const [liveness, setLiveness] = useState(false);
  const matcherRef = useRef<any>(null);
  const employeesRef = useRef<EmployeeFaceEntry[]>([]);
  const trackerRef = useRef(createLivenessTracker());
  const detectingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: faceEmps } = useQuery<EmployeeFaceEntry[]>({
    queryKey: ["/api/attendance/face-employees"],
    queryFn: async () => { const r = await fetch("/api/attendance/face-employees"); return r.json(); },
    staleTime: 60000,
  });

  const checkInMut = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/attendance/face-checkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.success) onSuccess(data);
      else { setStatus("error"); setMessage(data.error || "فشل التسجيل"); setTimeout(() => { setStatus("detecting"); setMessage("حرّك وجهك قليلاً للتحقق من الحضور..."); }, 3000); }
    },
  });

  // Load models + start camera
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        setMessage("جارٍ تحميل نماذج التعرف على الوجه...");
        await loadFaceModels();
        if (!active) return;
        setMessage("جارٍ فتح الكاميرا...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("detecting");
        setMessage("انظر للكاميرا وحرّك رأسك قليلاً...");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message?.includes("Permission") ? "لم يتم السماح بالكاميرا — يرجى السماح من إعدادات المتصفح" : err.message || "خطأ في الكاميرا");
      }
    }
    init();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Build matcher when employees load
  useEffect(() => {
    if (!faceEmps) return;
    employeesRef.current = faceEmps;
    matcherRef.current = buildMatcher(faceEmps, 0.5);
    if (faceEmps.length === 0) {
      setMessage("لا يوجد موظفون مسجلة بصماتهم — يجب تسجيل بصمات الوجه من ملف الموظف");
    }
  }, [faceEmps]);

  // Detection loop
  useEffect(() => {
    if (status !== "detecting") return;
    let frameId: number;
    let lastMatchTime = 0;

    async function loop() {
      if (!videoRef.current || !isLoaded() || detectingRef.current) {
        frameId = requestAnimationFrame(loop);
        return;
      }
      detectingRef.current = true;
      try {
        const result = await detectFaceInVideo(videoRef.current);
        if (result) {
          trackerRef.current.addFrame(result.detection);
          const livenessOk = trackerRef.current.isPassed();
          setLiveness(livenessOk);

          if (matcherRef.current && livenessOk && Date.now() - lastMatchTime > 1500) {
            lastMatchTime = Date.now();
            const match = matchDescriptor(result.descriptor, matcherRef.current, employeesRef.current);
            if (match.found) {
              // Capture frame photo
              const canvas = canvasRef.current;
              let photoUrl = "";
              if (canvas && videoRef.current) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
                photoUrl = canvas.toDataURL("image/jpeg", 0.8);
              }
              setStatus("matched");
              checkInMut.mutate({ employeeId: match.employeeId, photoUrl, confidence: match.confidence, location: { lat: 0, lng: 0 } });
            } else {
              setMessage("وجه موجود — جارٍ المطابقة...");
            }
          } else if (!livenessOk) {
            setMessage("حرّك رأسك قليلاً يميناً أو يساراً للتحقق من الحضور...");
          }
        } else {
          setMessage("انظر للكاميرا...");
          setLiveness(false);
        }
      } finally { detectingRef.current = false; }
      frameId = requestAnimationFrame(loop);
    }
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [status]);

  const retry = () => { trackerRef.current.reset(); setStatus("detecting"); setMessage("حرّك وجهك قليلاً...");};

  return (
    <div className="flex flex-col items-center gap-4 h-full">
      {/* Camera */}
      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border-2 border-primary/40 bg-black">
        <video ref={videoRef} className="w-full h-full object-cover mirror" muted playsInline autoPlay style={{ transform: "scaleX(-1)" }} />
        <canvas ref={canvasRef} className="hidden" />

        {/* Face overlay frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-60 rounded-full border-2 border-dashed border-primary/60 opacity-60" />
        </div>

        {/* Liveness indicator */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${liveness ? "bg-emerald-500/90 text-white" : "bg-gray-800/90 text-gray-300"}`}>
          <div className={`w-2 h-2 rounded-full ${liveness ? "bg-white animate-pulse" : "bg-gray-500"}`} />
          {liveness ? "حضور مؤكد" : "في الانتظار"}
        </div>

        {/* Status overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        )}
        {status === "matched" && (
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-16 h-16 text-emerald-400 animate-bounce" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center flex-col gap-3">
            <XCircle className="w-10 h-10 text-red-400" />
            <Button variant="outline" size="sm" onClick={retry} className="text-white border-white/30">
              <RefreshCw className="w-4 h-4 ml-1" />إعادة المحاولة
            </Button>
          </div>
        )}
      </div>

      {/* Status message */}
      <div className={`text-center px-4 py-2 rounded-xl text-sm font-medium ${status === "error" ? "text-red-400 bg-red-900/20" : status === "matched" ? "text-emerald-400 bg-emerald-900/20" : "text-blue-300 bg-blue-900/20"}`}>
        {message}
      </div>

      {/* Employees count */}
      <div className="text-xs text-gray-500 text-center">
        {faceEmps ? `${faceEmps.length} موظف مسجل في قاعدة البيانات` : "جارٍ التحميل..."}
      </div>
    </div>
  );
}

// ─── QR Scanner Panel ──────────────────────────────────────────────────────
function QRPanel({ onSuccess }: { onSuccess: (r: CheckInResult) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const qrRef = useRef<any>(null);
  const divRef = useRef<HTMLDivElement>(null);

  const checkInMut = useMutation({
    mutationFn: async (payload: string) => {
      const r = await fetch("/api/attendance/qr-checkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.success) { stopScanner(); onSuccess(data); }
      else setError(data.error || "فشل التحقق");
    },
  });

  const stopScanner = useCallback(() => {
    try { qrRef.current?.clear(); qrRef.current?.stop(); } catch {}
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError("");
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader-kiosk");
      qrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text: string) => { stopScanner(); checkInMut.mutate(text); },
        () => {}
      );
    } catch (err: any) {
      setError("لا يمكن فتح الكاميرا: " + err.message);
      setScanning(false);
    }
  }, [stopScanner, checkInMut]);

  useEffect(() => { startScanner(); return stopScanner; }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div id="qr-reader-kiosk" ref={divRef} className="w-80 h-64 rounded-2xl overflow-hidden bg-black border-2 border-primary/30" />
        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {scanning && (
        <div className="flex items-center gap-2 text-sm text-blue-400 animate-pulse">
          <Scan className="w-4 h-4" />
          وجّه الكاميرا نحو QR الخاص بك
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm text-center bg-red-900/20 rounded-xl px-4 py-2">
          {error}
          <button className="block mx-auto mt-2 text-primary underline text-xs" onClick={startScanner}>إعادة المحاولة</button>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center max-w-xs">
        افتح تطبيق QIROX من هاتفك ← ملفي ← اعرض QR الكيوسك
      </div>
    </div>
  );
}

// ─── Manual Panel ──────────────────────────────────────────────────────────
function ManualPanel({ onSuccess }: { onSuccess: (r: CheckInResult) => void }) {
  const [empNum, setEmpNum] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!empNum.trim()) return;
    setLoading(true); setError("");
    try {
      const empRes = await fetch(`/api/employees?q=${empNum}`, { credentials: "include" });
      const emps = await empRes.json();
      const emp = Array.isArray(emps) ? emps.find((e: any) => e.employmentNumber === empNum || e.id === empNum) : null;
      if (!emp) { setError("الرقم الوظيفي غير موجود"); setLoading(false); return; }

      const r = await fetch("/api/attendance/face-checkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.id, photoUrl: emp.imageUrl || "", location: { lat: 0, lng: 0 }, confidence: 0 }),
      });
      const data = await r.json();
      if (data.success) { setEmpNum(""); onSuccess(data); }
      else setError(data.error || "فشل التسجيل");
    } catch { setError("خطأ في الاتصال بالخادم"); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
        <Keyboard className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-white font-semibold">أدخل الرقم الوظيفي</h3>
      <Input
        className="text-center text-xl bg-white/10 border-white/20 text-white h-14 rounded-2xl"
        placeholder="EMP-001"
        value={empNum}
        onChange={e => setEmpNum(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        autoFocus
        dir="ltr"
        data-testid="input-emp-number"
      />
      {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-1">{error}</p>}
      <Button
        className="w-full h-14 text-lg rounded-2xl bg-primary"
        onClick={handleSubmit}
        disabled={loading || !empNum.trim()}
        data-testid="button-manual-checkin"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserCheck className="w-5 h-5 ml-2" />تسجيل الحضور</>}
      </Button>
      <p className="text-gray-500 text-xs">يمكنك إدخال الرقم الوظيفي أو معرف الموظف</p>
    </div>
  );
}

// ─── Main Kiosk Page ───────────────────────────────────────────────────────
export default function AttendanceKiosk() {
  const [mode, setMode] = useState<Mode>("face");
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const qc = useQueryClient();

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { clearInterval(t); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const { data: stats } = useQuery<KioskStats>({
    queryKey: ["/api/attendance/kiosk-stats"],
    queryFn: async () => { const r = await fetch("/api/attendance/kiosk-stats"); return r.json(); },
    refetchInterval: 30000,
  });

  const { data: recent = [] } = useQuery<RecentEntry[]>({
    queryKey: ["/api/attendance/recent-checkins"],
    queryFn: async () => { const r = await fetch("/api/attendance/recent-checkins"); return r.json(); },
    refetchInterval: 15000,
  });

  const handleSuccess = useCallback((result: CheckInResult) => {
    setCheckInResult(result);
    qc.invalidateQueries({ queryKey: ["/api/attendance/kiosk-stats"] });
    qc.invalidateQueries({ queryKey: ["/api/attendance/recent-checkins"] });
    // Play different sounds based on status
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = result.isLate ? 350 : 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }, [qc]);

  const timeStr = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const hijriStr = toHijri(now);

  const METHOD_ICONS = { face: Camera, qr: QrCode, manual: Keyboard };
  const METHOD_LABELS = { face: "بصمة الوجه", qr: "QR Code", manual: "الرقم الوظيفي" };

  return (
    <div className="fixed inset-0 bg-[#060910] text-white overflow-hidden flex" dir="rtl">
      {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-white/5 bg-gradient-to-b from-[#0b0f18] to-[#080b12] p-5 gap-4">
        {/* Logo + Brand */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{brand.nameAr}</p>
            <p className="text-[10px] text-primary">نظام تسجيل الحضور الذكي</p>
          </div>
          <div className="mr-auto">
            <div className={`flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 ${online ? "text-emerald-400 bg-emerald-900/30" : "text-red-400 bg-red-900/30"}`}>
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {online ? "متصل" : "غير متصل"}
            </div>
          </div>
        </div>

        {/* Live Clock */}
        <div className="text-center">
          <div className="text-5xl font-mono font-bold text-white tabular-nums tracking-wide" style={{ fontVariantNumeric: "tabular-nums" }}>
            {timeStr}
          </div>
          <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
          <p className="text-[10px] text-primary/70 mt-0.5">{hijriStr}</p>
        </div>

        {/* Today Stats */}
        <div className="bg-white/3 rounded-2xl p-3 space-y-2 border border-white/5">
          <p className="text-[10px] text-gray-500 text-center mb-2 uppercase tracking-widest">إحصائيات اليوم</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "حاضر", value: stats?.present ?? "—", color: "text-emerald-400", bg: "bg-emerald-900/30", icon: CheckCircle },
              { label: "متأخر", value: stats?.late ?? "—", color: "text-orange-400", bg: "bg-orange-900/30", icon: Timer },
              { label: "غائب", value: stats?.absent ?? "—", color: "text-red-400", bg: "bg-red-900/30", icon: XCircle },
              { label: "انصرف", value: stats?.checkedOut ?? "—", color: "text-blue-400", bg: "bg-blue-900/30", icon: LogOut },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} className={`${bg} rounded-xl p-2 text-center`}>
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[9px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Check-ins */}
        <div className="flex-1 overflow-hidden">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">آخر التسجيلات</p>
          <div className="space-y-1.5 overflow-y-auto max-h-[320px] pr-1">
            {recent.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">لا توجد تسجيلات اليوم</p>
            ) : recent.map((entry, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 border ${entry.isLate ? "bg-orange-900/10 border-orange-800/20" : "bg-emerald-900/10 border-emerald-800/20"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${entry.isLate ? "bg-orange-800 text-orange-200" : "bg-emerald-800 text-emerald-200"}`}>
                  {entry.imageUrl ? <img src={entry.imageUrl} alt="" className="w-full h-full object-cover" /> : entry.fullName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{entry.fullName}</p>
                  <p className="text-[9px] text-gray-400">{new Date(entry.checkInTime).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} · {entry.checkInMethod === "face" ? "📷" : entry.checkInMethod === "qr" ? "📱" : "⌨️"}</p>
                </div>
                {entry.isLate ? (
                  <span className="text-[9px] text-orange-400 shrink-0">+{entry.lateMinutes}د</span>
                ) : (
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (Main) ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        {/* Title */}
        <div className="text-center relative z-10">
          <h1 className="text-3xl font-bold text-white mb-1">تسجيل الحضور الذكي</h1>
          <p className="text-gray-400 text-sm">اختر طريقة التسجيل</p>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/10 relative z-10">
          {(["face", "qr", "manual"] as Mode[]).map(m => {
            const Icon = METHOD_ICONS[m];
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === m ? "bg-primary text-white shadow-lg shadow-primary/30" : "text-gray-400 hover:text-white"}`}
                data-testid={`button-mode-${m}`}
              >
                <Icon className="w-4 h-4" />
                {METHOD_LABELS[m]}
              </button>
            );
          })}
        </div>

        {/* Active Panel */}
        <div className="w-full max-w-lg relative z-10">
          {mode === "face" && <FacePanel onSuccess={handleSuccess} />}
          {mode === "qr" && <QRPanel onSuccess={handleSuccess} />}
          {mode === "manual" && <ManualPanel onSuccess={handleSuccess} />}
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 text-[10px] text-gray-600 relative z-10">
          <Shield className="w-3 h-3 text-primary/50" />
          محمي بالذكاء الاصطناعي · تسجيل مشفر · مكافحة التزوير
        </div>
      </div>

      {/* Check-in result overlay */}
      <ResultOverlay result={checkInResult} onClose={() => setCheckInResult(null)} />
    </div>
  );
}
