import { useState, useRef, useEffect, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Clock, Camera, CheckCircle2, AlertTriangle, XCircle, RefreshCw, QrCode, User, MapPin } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";
const chefsplaceLogoStaff = "/logo.png";

type Stage = "idle" | "identified" | "photo" | "submitting" | "success" | "late" | "error";

interface EmployeeInfo {
  id: string;
  _id?: string;
  fullName: string;
  jobTitle?: string;
  role?: string;
  shiftStartTime?: string;
  restoreKey?: string;
}

function getAuthHeaders(emp: EmployeeInfo | null, restoreKey: string): Record<string, string> {
  if (!emp) return {};
  const id = emp.id || emp._id || "";
  if (id && restoreKey) return { "x-employee-id": id, "x-restore-key": restoreKey };
  return {};
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function GeneralCheckin() {
  const tc = useTranslate();
  const now = useLiveClock();

  const [stage, setStage] = useState<Stage>("idle");
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [restoreKey, setRestoreKey] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(3);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const resetRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.title = tc("التحضير العام - مكان الشيف البخاري", "General Check-in - Chef Bukhari's Place");
  }, [tc]);

  const cleanupCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const resetAll = useCallback(() => {
    cleanupCamera();
    if (resetRef.current) clearTimeout(resetRef.current);
    setStage("idle");
    setEmployee(null);
    setRestoreKey("");
    setPhotoDataUrl(null);
    setPhotoUrl(null);
    setLateMinutes(0);
    setErrorMsg("");
    setCountdown(3);
  }, [cleanupCamera]);

  // Auto-reset after success/error
  const scheduleReset = useCallback((delayMs = 6000) => {
    resetRef.current = setTimeout(resetAll, delayMs);
  }, [resetAll]);

  useEffect(() => () => {
    cleanupCamera();
    if (resetRef.current) clearTimeout(resetRef.current);
  }, [cleanupCamera]);

  // Get location silently in background
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Open camera + start photo countdown
  const startCameraAndCountdown = useCallback(async () => {
    setStage("photo");
    setCountdown(3);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      let c = 3;
      countdownRef.current = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          captureAndSubmit();
        }
      }, 1000);
    } catch {
      // No camera — submit without photo
      captureAndSubmit(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureAndSubmit = useCallback(async (skipPhoto = false) => {
    let uploadedUrl: string | null = null;

    if (!skipPhoto && videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth || 640;
        canvasRef.current.height = videoRef.current.videoHeight || 480;
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
        setPhotoDataUrl(dataUrl);
        cleanupCamera();

        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const form = new FormData();
          form.append("photo", blob, "attendance.jpg");
          const r = await fetch("/api/upload-attendance-photo", {
            method: "POST",
            body: form,
            credentials: "include",
            headers: getAuthHeaders(employee, restoreKey),
          });
          if (r.ok) uploadedUrl = (await r.json()).url;
        } catch { /* photo upload optional */ }
      }
    } else {
      cleanupCamera();
    }

    setPhotoUrl(uploadedUrl);
    await doCheckIn(uploadedUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, restoreKey, cleanupCamera]);

  const doCheckIn = useCallback(async (uploadedPhotoUrl: string | null) => {
    setStage("submitting");
    try {
      const r = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(employee, restoreKey) },
        credentials: "include",
        body: JSON.stringify({ location: location || { lat: 0, lng: 0 }, photoUrl: uploadedPhotoUrl }),
      });
      const data = await r.json();

      if (!r.ok) {
        if (data.distance) {
          setErrorMsg(tc(`أنت خارج حدود الفرع بمسافة ${data.distance} متر`, `You are ${data.distance}m outside branch boundary`));
        } else {
          setErrorMsg(data.error || tc("فشل التحضير", "Check-in failed"));
        }
        setStage("error");
        scheduleReset(7000);
        return;
      }

      const mins = data.attendance?.lateMinutes || 0;
      setLateMinutes(mins);
      setStage(mins > 0 ? "late" : "success");
      scheduleReset(7000);
    } catch (e: any) {
      setErrorMsg(e.message || tc("حدث خطأ", "An error occurred"));
      setStage("error");
      scheduleReset(7000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, restoreKey, location, scheduleReset, tc]);

  // QR scanner mount/unmount
  useEffect(() => {
    if (stage !== "idle") return;
    const scannerId = "general-checkin-qr";
    const scanner = new Html5QrcodeScanner(scannerId, { fps: 10, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: false }, false);
    scannerRef.current = scanner;

    scanner.render(
      async (text) => {
        const scannedId = text.trim();
        if (!scannedId) return;
        scanner.clear().catch(() => {});

        try {
          const r = await fetch("/api/employees/login-qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ employeeId: scannedId }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || tc("بطاقة غير معروفة", "Unknown card"));

          const empData: EmployeeInfo = data;
          const key = data.restoreKey || "";
          if (key) localStorage.setItem("qirox-restore-key", key);
          delete empData.restoreKey;
          localStorage.setItem("currentEmployee", JSON.stringify(empData));

          setEmployee(empData);
          setRestoreKey(key);
          setStage("identified");
        } catch (e: any) {
          setErrorMsg(e.message);
          setStage("error");
          scheduleReset(5000);
        }
      },
      () => {}
    );

    return () => { scanner.clear().catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // After employee identified, auto-open camera
  useEffect(() => {
    if (stage === "identified") {
      const t = setTimeout(() => startCameraAndCountdown(), 500);
      return () => clearTimeout(t);
    }
  }, [stage, startCameraAndCountdown]);

  const formattedTime = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const formattedDate = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" dir="rtl">
      {/* Header clock */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gray-900/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={chefsplaceLogoStaff} alt="Logo" className="h-10 w-auto object-contain" />
          <div>
            <p className="text-xs text-gray-400">{tc("صفحة التحضير العامة", "General Check-in Terminal")}</p>
            <p className="text-sm font-bold text-white">{tc("امسح بطاقتك لتسجيل حضورك", "Scan your card to check in")}</p>
          </div>
        </div>
        <div className="text-left">
          <div className="text-3xl font-black tabular-nums text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            {formattedTime}
          </div>
          <p className="text-xs text-gray-400 text-left">{formattedDate}</p>
        </div>
      </header>

      {/* Main body */}
      <div className="flex-1 flex items-center justify-center p-6">

        {/* IDLE — QR scanner */}
        {stage === "idle" && (
          <div className="w-full max-w-sm text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
                <QrCode className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black mb-1">{tc("سجّل حضورك", "Register Attendance")}</h2>
              <p className="text-gray-400 text-sm">{tc("وجّه بطاقتك نحو الكاميرا", "Point your card at the camera")}</p>
            </div>
            <div
              id="general-checkin-qr"
              className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-black"
              style={{ minHeight: 320 }}
            />
            {location && (
              <p className="mt-3 text-xs text-green-400 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" />
                {tc("الموقع محدد ✓", "Location ready ✓")}
              </p>
            )}
            {!location && (
              <p className="mt-3 text-xs text-gray-500 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" />
                {tc("جاري تحديد الموقع...", "Getting location...")}
              </p>
            )}
          </div>
        )}

        {/* IDENTIFIED / PHOTO — camera feed */}
        {(stage === "identified" || stage === "photo") && (
          <div className="w-full max-w-md text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-lg font-black">{employee?.fullName}</p>
                <p className="text-sm text-gray-400">{employee?.jobTitle || employee?.role}</p>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border-2 border-primary/40 bg-black mb-4" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {stage === "photo" && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-7xl font-black text-white drop-shadow-lg">{countdown}</span>
                </div>
              )}
              {stage === "identified" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="text-center">
                    <Camera className="w-10 h-10 text-white mx-auto mb-2 animate-pulse" />
                    <p className="text-white text-sm">{tc("جاري تشغيل الكاميرا...", "Opening camera...")}</p>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-gray-400 text-sm">
              {stage === "photo" && countdown > 0
                ? tc(`سيتم تصويرك خلال ${countdown} ثانية`, `Photo in ${countdown} seconds`)
                : tc("جاري التصوير...", "Taking photo...")}
            </p>
          </div>
        )}

        {/* SUBMITTING */}
        {stage === "submitting" && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-6" />
            {photoDataUrl && (
              <img src={photoDataUrl} alt="photo" className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-primary/40" />
            )}
            <p className="text-xl font-bold text-gray-300">{tc("جاري تسجيل الحضور...", "Checking in...")}</p>
          </div>
        )}

        {/* SUCCESS */}
        {stage === "success" && (
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-14 h-14 text-green-400" />
            </div>
            {photoDataUrl && (
              <img src={photoDataUrl} alt="photo" className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-green-500/50" />
            )}
            <h2 className="text-3xl font-black text-green-400 mb-1">{tc("تم التحضير ✓", "Checked In ✓")}</h2>
            <p className="text-xl font-bold text-white mb-1">{employee?.fullName}</p>
            <p className="text-gray-400 text-sm mb-2">{employee?.jobTitle}</p>
            <p className="text-sm text-gray-500">
              {formattedTime} · {now.toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <div className="mt-4 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full animate-[shrink_7s_linear_forwards]" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {/* LATE */}
        {stage === "late" && (
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-14 h-14 text-amber-400" />
            </div>
            {photoDataUrl && (
              <img src={photoDataUrl} alt="photo" className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-amber-500/50" />
            )}
            <h2 className="text-3xl font-black text-amber-400 mb-1">{tc("تأخر في الحضور", "Late Arrival")}</h2>
            <p className="text-xl font-bold text-white mb-1">{employee?.fullName}</p>
            <p className="text-amber-300 font-bold text-lg mb-1">
              {tc(`متأخر ${lateMinutes} دقيقة`, `${lateMinutes} minutes late`)}
            </p>
            <p className="text-gray-400 text-sm">
              {formattedTime} · {now.toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <p className="mt-3 text-xs text-gray-500">{tc("تم تسجيل الحضور مع ملاحظة التأخر", "Attendance recorded with late note")}</p>
            <div className="mt-4 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-[shrink_7s_linear_forwards]" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {/* ERROR */}
        {stage === "error" && (
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-14 h-14 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-red-400 mb-2">{tc("حدث خطأ", "Error")}</h2>
            <p className="text-gray-300 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {tc("حاول مجدداً", "Try Again")}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-600">
        <span>مكان الشيف البخاري © {new Date().getFullYear()}</span>
        {stage !== "idle" && (
          <button onClick={resetAll} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw className="w-3 h-3" />
            {tc("إعادة تعيين", "Reset")}
          </button>
        )}
        <span>{tc("جهاز التحضير العام", "General Check-in Device")}</span>
      </footer>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
