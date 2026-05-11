import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Coffee, LogOut, MapPin, Camera, Clock, CheckCircle2, XCircle,
  Loader2, ArrowRight, Calendar, AlertCircle, RefreshCw, FileText, Briefcase,
  Shield, Eye, Navigation, WifiOff, Timer, TrendingUp, AlertTriangle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import LocationDistanceMap from "@/components/location-distance-map";
import type { Employee } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";

interface AttendanceStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  attendance: {
    id: string;
    checkInTime: string;
    checkOutTime?: string;
    isLate: number;
    lateMinutes?: number;
  } | null;
  todayCheckIn?: string;
  todayCheckOut?: string;
  leaveBalance?: number;
  totalLeaves?: number;
}

interface DistanceError {
  userLocation: { lat: number; lng: number };
  branchLocation: { lat: number; lng: number };
  distance: number;
  mapsUrl: string;
}

function getAuthHeaders(): Record<string, string> {
  const emp = localStorage.getItem("currentEmployee");
  if (!emp) return {};
  try {
    const e = JSON.parse(emp);
    const restoreKey = localStorage.getItem("restoreKey") || e.restoreKey || "";
    const id = e.id || e._id || "";
    if (id && restoreKey) return { "x-employee-id": id, "x-restore-key": restoreKey };
  } catch (_) {}
  return {};
}

function parseShiftTime(employee: Employee | null) {
  if (!employee) return { startH: 8, startM: 0, endH: 17, endM: 0 };
  let startH = 8, startM = 0, endH = 17, endM = 0;
  if ((employee as any).shiftStartTime) {
    const p = (employee as any).shiftStartTime.split(":");
    startH = parseInt(p[0]) || 8;
    startM = parseInt(p[1]) || 0;
  } else if (employee.shiftTime) {
    startH = parseInt(employee.shiftTime.split("-")[0]) || 8;
  }
  if ((employee as any).shiftEndTime) {
    const p = (employee as any).shiftEndTime.split(":");
    endH = parseInt(p[0]) || 17;
    endM = parseInt(p[1]) || 0;
  } else if (employee.shiftTime) {
    const parts = employee.shiftTime.split("-");
    if (parts[1]) endH = parseInt(parts[1]) || 17;
  }
  return { startH, startM, endH, endM };
}

function formatHM(h: number, m: number) {
  const period = h < 12 ? "ص" : "م";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} د`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} س ${m} د` : `${h} ساعة`;
}

export default function EmployeeAttendance() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [location, setLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [distanceError, setDistanceError] = useState<DistanceError | null>(null);
  const [now, setNow] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [showTrackingConsent, setShowTrackingConsent] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [pendingAttendanceId, setPendingAttendanceId] = useState<string | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackingWsRef = useRef<WebSocket | null>(null);

  // Live clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stopLiveTracking = useCallback(() => {
    if (trackingIntervalRef.current) { clearInterval(trackingIntervalRef.current); trackingIntervalRef.current = null; }
    if (trackingWsRef.current) { try { trackingWsRef.current.close(); } catch (_) {} trackingWsRef.current = null; }
    setIsTracking(false);
  }, []);

  const startLiveTracking = useCallback((attendanceId: string, emp: Employee) => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/orders`);
    trackingWsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", clientType: "employee-tracking", employeeId: String((emp as any)._id || (emp as any).id), attendanceId, branchId: emp.branchId }));
    };
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "employee_location_update", location: { lat, lng }, employeeName: emp.fullName }));
          fetch("/api/attendance/location-update", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, credentials: "include", body: JSON.stringify({ lat, lng, accuracy, attendanceId }) }).catch(() => {});
        }, () => {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    };
    sendLocation();
    trackingIntervalRef.current = setInterval(sendLocation, 30000);
    setIsTracking(true);
  }, []);

  const fetchAttendanceStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance/my-status", { credentials: "include", headers: getAuthHeaders() });
      if (response.ok) setAttendanceStatus(await response.json());
    } catch (_) {}
  }, []);

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      setEmployee(JSON.parse(storedEmployee));
      fetchAttendanceStatus();
    } else {
      setLocation("/employee/gateway");
    }
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      stopLiveTracking();
    };
  }, [setLocation, stopLiveTracking, fetchAttendanceStatus]);

  const getLocation = useCallback(() => {
    setLocationError(null);
    if (!navigator.geolocation) { setLocationError(tc("المتصفح لا يدعم تحديد الموقع", "Browser does not support geolocation")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocationState({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setLocationError(tc("تم رفض إذن الموقع — يرجى السماح من إعدادات المتصفح", "Location denied — allow it in browser settings"));
        else if (err.code === err.POSITION_UNAVAILABLE) setLocationError(tc("الموقع غير متاح", "Location unavailable"));
        else setLocationError(tc("انتهت مهلة طلب الموقع، حاول مجدداً", "Location timed out, try again"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [tc]);

  useEffect(() => { getLocation(); }, [getLocation]);

  const startCamera = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (_) {
      toast({ title: tc("خطأ", "Error"), description: tc("لا يمكن فتح الكاميرا", "Cannot access camera"), variant: "destructive" });
      setIsCapturing(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
    setCapturedPhoto(dataUrl);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setIsCapturing(false);

    const blob = await fetch(dataUrl).then(r => r.blob());
    const form = new FormData();
    form.append("photo", blob, "attendance.jpg");
    try {
      const r = await fetch("/api/upload-attendance-photo", { method: "POST", body: form, credentials: "include", headers: getAuthHeaders() });
      if (r.ok) setPhotoUrl((await r.json()).url);
      else throw new Error();
    } catch (_) {
      toast({ title: tc("خطأ", "Error"), description: tc("فشل رفع الصورة، يمكنك التحضير بدون صورة", "Photo upload failed, you can still check in"), variant: "destructive" });
    }
  };

  const retakePhoto = () => { setCapturedPhoto(null); setPhotoUrl(null); startCamera(); };

  const doCheckIn = async () => {
    if (!location) { toast({ title: tc("خطأ", "Error"), description: tc("يرجى تحديد الموقع أولاً", "Please get your location first"), variant: "destructive" }); return; }
    setIsLoading(true);
    try {
      const r = await fetch("/api/attendance/check-in", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ location, photoUrl: photoUrl || null }), credentials: "include" });
      const data = await r.json();
      if (!r.ok) {
        if (data.showMap && data.mapsUrl) {
          setDistanceError({ userLocation: data.userLocation, branchLocation: data.branchLocation, distance: data.distance, mapsUrl: data.mapsUrl });
        } else {
          toast({ title: tc("خطأ", "Error"), description: data.error || tc("فشل التحضير", "Check-in failed"), variant: "destructive", duration: 10000 });
        }
        return;
      }
      toast({ title: tc("✅ تم التحضير", "✅ Checked in"), description: data.message });
      await fetchAttendanceStatus();
      setCapturedPhoto(null); setPhotoUrl(null);
      const attId = data.attendance?.id || data.attendance?._id;
      if (attId) { setPendingAttendanceId(String(attId)); setShowTrackingConsent(true); }
    } catch (e: any) {
      toast({ title: tc("خطأ", "Error"), description: e.message || tc("فشل التحضير", "Check-in failed"), variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const doCheckOut = async () => {
    if (!location) { toast({ title: tc("خطأ", "Error"), description: tc("يرجى تحديد الموقع أولاً", "Please get your location first"), variant: "destructive" }); return; }
    setIsLoading(true);
    try {
      const r = await fetch("/api/attendance/check-out", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ location, photoUrl: photoUrl || null }), credentials: "include" });
      const data = await r.json();
      if (!r.ok) {
        if (data.showMap && data.mapsUrl) {
          setDistanceError({ userLocation: data.userLocation, branchLocation: data.branchLocation, distance: data.distance, mapsUrl: data.mapsUrl });
        } else {
          toast({ title: tc("خطأ", "Error"), description: data.error || tc("فشل الانصراف", "Check-out failed"), variant: "destructive", duration: 10000 });
        }
        return;
      }
      toast({ title: tc("✅ تم الانصراف", "✅ Checked out"), description: data.message });
      stopLiveTracking();
      await fetchAttendanceStatus();
      setCapturedPhoto(null); setPhotoUrl(null);
    } catch (e: any) {
      toast({ title: tc("خطأ", "Error"), description: e.message || tc("فشل الانصراف", "Check-out failed"), variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleLogout = () => { localStorage.removeItem("currentEmployee"); setLocation("/employee/gateway"); };

  if (!employee) return null;

  // ── Shift calculations ────────────────────────────────────────
  const { startH, startM, endH, endM } = parseShiftTime(employee);

  const todayBase = new Date(now);
  todayBase.setHours(0, 0, 0, 0);

  const shiftStartMs = todayBase.getTime() + startH * 3600000 + startM * 60000;
  const shiftEndMs   = todayBase.getTime() + endH   * 3600000 + endM   * 60000;
  const nowMs        = now.getTime();

  const minutesUntilStart = Math.floor((shiftStartMs - nowMs) / 60000);
  const minutesSinceStart = Math.floor((nowMs - shiftStartMs) / 60000);
  const minutesUntilEnd   = Math.floor((shiftEndMs - nowMs) / 60000);
  const minutesSinceEnd   = Math.floor((nowMs - shiftEndMs) / 60000);

  const shiftNotStarted  = nowMs < shiftStartMs;
  const inShift          = nowMs >= shiftStartMs && nowMs < shiftEndMs;
  const shiftEnded       = nowMs >= shiftEndMs;
  const isCurrentlyLate  = !attendanceStatus?.hasCheckedIn && minutesSinceStart > 0 && !shiftEnded;

  const formattedDate = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formattedTime = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background pb-nav" dir="rtl">
      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Coffee className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">{tc("تسجيل الحضور", "Attendance")}</h1>
              <p className="text-muted-foreground text-xs">{formattedDate}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive" data-testid="button-logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        {/* Live Clock */}
        <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-lg font-mono font-bold text-foreground" data-testid="text-live-clock">{formattedTime}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {tc("توقيت المملكة", "KSA Time")}
          </div>
        </div>

        {/* Employee Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-lg font-bold">{employee.fullName?.charAt(0) || "م"}</span>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-foreground" data-testid="text-employee-name">{employee.fullName}</h2>
                <p className="text-muted-foreground text-xs">{employee.jobTitle || tc("موظف", "Employee")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Shift Status Card ── */}
        <Card className={`border-2 ${
          attendanceStatus?.hasCheckedOut ? "border-green-400 bg-green-50 dark:bg-green-900/20"
          : attendanceStatus?.hasCheckedIn ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
          : isCurrentlyLate ? "border-red-400 bg-red-50 dark:bg-red-900/20"
          : shiftNotStarted ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
          : "border-border bg-card"
        }`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="w-4 h-4" />
              {tc("معلومات الدوام", "Shift Info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">

            {/* Shift times */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{tc("بداية الدوام", "Shift Start")}</p>
                <p className="font-bold text-foreground text-sm" data-testid="text-shift-start">{formatHM(startH, startM)}</p>
              </div>
              <div className="bg-white/60 dark:bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{tc("نهاية الدوام", "Shift End")}</p>
                <p className="font-bold text-foreground text-sm" data-testid="text-shift-end">{formatHM(endH, endM)}</p>
              </div>
            </div>

            {/* Dynamic status */}
            {attendanceStatus?.hasCheckedOut ? (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span data-testid="text-shift-status">{tc("✅ تم الانصراف — أحسنت!", "✅ Checked out — Well done!")}</span>
              </div>
            ) : attendanceStatus?.hasCheckedIn ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium text-sm">
                  <TrendingUp className="w-5 h-5 shrink-0" />
                  <span data-testid="text-shift-status">
                    {tc("أنت في الدوام", "You're on shift")}
                    {attendanceStatus.attendance?.isLate === 1 && attendanceStatus.attendance?.lateMinutes
                      ? ` (${tc("متأخر", "Late")} ${attendanceStatus.attendance.lateMinutes} ${tc("دقيقة", "min")})`
                      : ` — ${tc("في الوقت", "On time")}`}
                  </span>
                </div>
                {inShift && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span data-testid="text-time-remaining">{tc("متبقي", "Remaining")}: <strong>{formatDuration(minutesUntilEnd)}</strong></span>
                  </div>
                )}
                {shiftEnded && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{tc("انتهى وقت الدوام — سجّل انصرافك", "Shift ended — please check out")}</span>
                  </div>
                )}
              </div>
            ) : isCurrentlyLate ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span data-testid="text-shift-status">{tc("⚠️ أنت متأخر!", "⚠️ You are late!")}</span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 pr-7" data-testid="text-late-minutes">
                  {tc("تأخرت", "Late by")} <strong>{formatDuration(minutesSinceStart)}</strong> {tc("عن بداية الدوام", "from shift start")}
                </p>
                <p className="text-xs text-muted-foreground pr-7">{tc("حضّر الآن لتقليل التأخير المسجّل", "Check in now to minimize recorded lateness")}</p>
              </div>
            ) : shiftNotStarted ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                  <Clock className="w-5 h-5 shrink-0" />
                  <span data-testid="text-shift-status">{tc("دوامك لم يبدأ بعد", "Shift hasn't started yet")}</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 pr-7" data-testid="text-time-until-start">
                  {tc("يبدأ بعد", "Starts in")} <strong>{formatDuration(minutesUntilStart)}</strong>
                </p>
              </div>
            ) : shiftEnded ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <XCircle className="w-5 h-5 shrink-0" />
                <span data-testid="text-shift-status">{tc("انتهى وقت الدوام — لم تسجل حضورك اليوم", "Shift ended — no attendance recorded today")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <XCircle className="w-5 h-5 shrink-0" />
                <span data-testid="text-shift-status">{tc("لم يتم التحضير بعد", "Not checked in yet")}</span>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Distance Error Map */}
        {distanceError && (
          <LocationDistanceMap
            userLocation={distanceError.userLocation}
            branchLocation={distanceError.branchLocation}
            distance={distanceError.distance}
            mapsUrl={distanceError.mapsUrl}
            onClose={() => setDistanceError(null)}
          />
        )}

        {/* Today's Status & Leave Balance */}
        {attendanceStatus && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-primary flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                {tc("سجل اليوم والإجازات", "Today's Record & Leaves")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-primary/5 rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">{tc("وقت الحضور", "Check-in")}</p>
                  <p className="text-primary font-semibold text-sm" data-testid="text-checkin-time">
                    {attendanceStatus.todayCheckIn
                      ? new Date(attendanceStatus.todayCheckIn).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
                <div className="bg-primary/5 rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">{tc("وقت الانصراف", "Check-out")}</p>
                  <p className="text-primary font-semibold text-sm" data-testid="text-checkout-time">
                    {attendanceStatus.todayCheckOut
                      ? new Date(attendanceStatus.todayCheckOut).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  {tc("رصيد الإجازات", "Leave Balance")}
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {attendanceStatus.leaveBalance ?? 0} / {attendanceStatus.totalLeaves ?? 21} {tc("يوم", "days")}
                </Badge>
              </div>
              <Button onClick={() => setLocation("/employee/leave-request")} className="w-full gap-2 bg-[#2D9B6E] hover:bg-[#2D9B6E]/90 text-white" size="sm" data-testid="button-apply-leave">
                <FileText className="w-4 h-4" />
                {tc("طلب إجازة", "Request Leave")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              {tc("الموقع الجغرافي", "GPS Location")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationError ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-start gap-2 text-destructive text-sm flex-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{locationError}</span>
                </div>
                <Button variant="outline" size="sm" onClick={getLocation} className="border-primary/50 text-primary shrink-0" data-testid="button-retry-location">
                  <RefreshCw className="w-4 h-4 ml-1" />
                  {tc("إعادة", "Retry")}
                </Button>
              </div>
            ) : location ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span data-testid="text-location-status">{tc("✅ تم تحديد موقعك", "✅ Location obtained")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{tc("جاري تحديد موقعك...", "Getting your location...")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photo (optional) */}
        {!attendanceStatus?.hasCheckedOut && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-primary flex items-center gap-2 text-sm">
                <Camera className="w-4 h-4" />
                {tc("صورة الحضور", "Attendance Photo")}
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30 mr-1">{tc("اختياري", "Optional")}</Badge>
              </CardTitle>
              <CardDescription className="text-xs">{tc("التقط سيلفي للتوثيق (غير إلزامي)", "Take a selfie for verification (optional)")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isCapturing ? (
                <div className="space-y-3">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
                  <Button onClick={capturePhoto} className="w-full bg-primary hover:bg-primary/90" data-testid="button-capture">
                    <Camera className="w-4 h-4 ml-2" />
                    {tc("التقاط الصورة", "Capture")}
                  </Button>
                </div>
              ) : capturedPhoto ? (
                <div className="space-y-3">
                  <img src={capturedPhoto} alt="Captured" className="w-full rounded-xl" />
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={retakePhoto} className="flex-1 border-primary/50 text-primary" size="sm" data-testid="button-retake">
                      {tc("إعادة", "Retake")}
                    </Button>
                    {photoUrl && (
                      <div className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {tc("تم الرفع", "Uploaded")}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Button onClick={startCamera} variant="outline" className="w-full border-primary/50 text-primary" size="sm" data-testid="button-start-camera">
                  <Camera className="w-4 h-4 ml-2" />
                  {tc("فتح الكاميرا", "Open Camera")}
                </Button>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </CardContent>
          </Card>
        )}

        {/* ── Main Action Button ── */}
        {!attendanceStatus?.hasCheckedOut && (
          <div className="space-y-2">
            {!attendanceStatus?.hasCheckedIn ? (
              <>
                <Button
                  onClick={doCheckIn}
                  disabled={isLoading || !location}
                  className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 shadow-lg"
                  data-testid="button-check-in"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <CheckCircle2 className="w-5 h-5 ml-2" />}
                  {tc("تسجيل الحضور", "Check In")}
                </Button>
                {!location && (
                  <p className="text-xs text-center text-muted-foreground">
                    {locationError ? tc("⚠️ يجب تفعيل الموقع أولاً", "⚠️ Enable location first") : tc("⏳ انتظر تحديد الموقع...", "⏳ Waiting for location...")}
                  </p>
                )}
              </>
            ) : (
              <Button
                onClick={doCheckOut}
                disabled={isLoading || !location}
                className="w-full h-14 text-lg font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-lg"
                data-testid="button-check-out"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <ArrowRight className="w-5 h-5 ml-2" />}
                {tc("تسجيل الانصراف", "Check Out")}
              </Button>
            )}
          </div>
        )}

        {/* Live Tracking Indicator */}
        {isTracking && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600" />
            </span>
            <Navigation className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-400">{tc("جارٍ تتبع موقعك خلال الدوام", "Live location tracking active")}</span>
          </div>
        )}

        <Button variant="ghost" onClick={() => setLocation("/employee/home")} className="w-full text-muted-foreground hover:text-primary" data-testid="button-back-home">
          {tc("العودة للرئيسية", "Back to Home")}
        </Button>
      </div>

      {/* Tracking Consent Dialog */}
      <Dialog open={showTrackingConsent} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm mx-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Shield className="w-5 h-5 text-blue-600" />
              {tc("إشعار مراقبة الموقع", "Location Monitoring Notice")}
            </DialogTitle>
            <DialogDescription className="text-right space-y-3 pt-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <Eye className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <span>{tc("سيتم تتبع موقعك الجغرافي طوال فترة دوامك حتى تسجيل الانصراف.", "Your location will be tracked throughout your shift until check-out.")}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                  <span>{tc("سيتلقى المدير إشعاراً إذا خرجت عن نطاق الفرع.", "The manager will be alerted if you leave the branch area.")}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{tc("يتوقف التتبع تلقائياً عند تسجيل انصرافك.", "Tracking stops automatically when you check out.")}</span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" data-testid="button-decline-tracking"
              onClick={() => {
                setShowTrackingConsent(false);
                setPendingAttendanceId(null);
                toast({ title: tc("تم الرفض", "Declined"), description: tc("لن يتم تتبع موقعك", "Your location will not be tracked") });
              }}>
              {tc("رفض", "Decline")}
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" data-testid="button-accept-tracking"
              onClick={() => {
                setShowTrackingConsent(false);
                if (pendingAttendanceId && employee) startLiveTracking(pendingAttendanceId, employee);
                setPendingAttendanceId(null);
              }}>
              {tc("قبول", "Accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MobileBottomNav employeeRole={employee?.role} onLogout={handleLogout} />
    </div>
  );
}
