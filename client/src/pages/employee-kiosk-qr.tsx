// ─── Employee Kiosk QR Page — QR كود الكيوسك للموظف ──────────────────────────
// Employee shows this QR at the attendance kiosk to check in (refreshes every 30s)
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowLeft, Shield, Wifi, WifiOff, Clock } from "lucide-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";

export default function EmployeeKioskQR() {
  const [, navigate] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());

  // Fetch QR data from backend (refreshes on 30s boundary)
  const { data: qrData, refetch } = useQuery({
    queryKey: ["/api/attendance/employee-qr/me"],
    queryFn: async () => {
      const r = await fetch("/api/attendance/employee-qr/me", { credentials: "include" });
      if (!r.ok) throw new Error("فشل في توليد QR");
      return r.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });

  // Countdown timer synced to 30s window
  useEffect(() => {
    const update = () => {
      const s = Math.floor(Date.now() / 1000);
      setSecondsLeft(30 - (s % 30));
      setNow(new Date());
    };
    update();
    const t = setInterval(update, 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { clearInterval(t); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Render QR to canvas
  useEffect(() => {
    if (!qrData?.payload || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrData.payload, {
      width: 280, margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [qrData]);

  const urgentRefresh = async () => { await refetch(); };

  const timeStr = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const urgency = secondsLeft <= 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black flex flex-col items-center justify-center p-6 text-white" dir="rtl">
      {/* Back */}
      <button onClick={() => navigate("/employee/home")} className="absolute top-4 right-4 flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" />
        رجوع
      </button>

      {/* Network */}
      <div className={`absolute top-4 left-4 flex items-center gap-1.5 text-xs rounded-full px-2 py-1 ${online ? "text-emerald-400 bg-emerald-900/30" : "text-red-400 bg-red-900/30"}`}>
        {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {online ? "متصل" : "غير متصل"}
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">QR تسجيل الحضور</h1>
        <p className="text-gray-400 text-sm mt-1">وجّه هذا الرمز نحو كاميرا كيوسك الحضور</p>
      </div>

      {/* QR Canvas */}
      <div className={`relative rounded-3xl p-4 bg-white shadow-2xl mb-4 transition-all ${urgency ? "ring-4 ring-red-400 animate-pulse" : "ring-2 ring-primary/20"}`}>
        <canvas ref={canvasRef} className="rounded-xl" />
        {!qrData && (
          <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`text-4xl font-mono font-bold tabular-nums ${urgency ? "text-red-400" : "text-white"}`}>
          {String(secondsLeft).padStart(2, "0")}
        </div>
        <div className="text-gray-400 text-sm">
          <p>ثانية متبقية</p>
          <p className="text-xs">يتجدد تلقائياً</p>
        </div>
        <Button size="sm" variant="outline" onClick={urgentRefresh} className="border-white/20 text-white hover:bg-white/10">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Time + Date */}
      <div className="text-center text-gray-400">
        <p className="text-lg font-mono">{timeStr}</p>
        <p className="text-xs">{dateStr}</p>
      </div>

      {/* Security note */}
      <div className="mt-6 text-center text-xs text-gray-600 max-w-xs">
        <Shield className="w-3 h-3 inline ml-1 text-primary/50" />
        هذا الرمز موقّع رقمياً ولا يمكن نسخه أو تزويره — كل 30 ثانية يتغير تلقائياً
      </div>
    </div>
  );
}
