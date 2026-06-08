import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { preCacheOnLogin } from "@/lib/offline-cashier";
import { requestAndSubscribeEmployee } from "@/lib/push-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AtSign, Lock, Loader2, Eye, EyeOff, QrCode, Download } from "lucide-react";
import type { Employee } from "@shared/schema";
import { Html5QrcodeScanner } from "html5-qrcode";
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";
import { useTranslate } from "@/lib/useTranslate";

function useAutoRedirectIfLoggedIn() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const stored = localStorage.getItem("currentEmployee");
    if (stored) {
      try {
        const emp = JSON.parse(stored);
        if (emp?.role) {
          if (emp.role === "admin") setLocation("/admin/dashboard");
          else if (emp.role === "owner") setLocation("/owner/dashboard");
          else if (emp.role === "manager" || emp.role === "branch_manager") setLocation("/manager/dashboard");
          else if (emp.role === "cleaner") setLocation("/employee/attendance");
          else setLocation("/employee/home");
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function EmployeeLogin() {
  useAutoRedirectIfLoggedIn();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const tc = useTranslate();
  const [rememberMe, setRememberMe] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    document.title = tc("تسجيل دخول الموظفين - مكان الشيف — الإدارة", "Employee Login - مكان الشيف — الإدارة");
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    const stored = localStorage.getItem("currentEmployee");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          const r = parsed.role;
          if (r === "admin" || r === "owner") window.location.href = "/admin/dashboard";
          else if (r === "manager" || r === "branch_manager") window.location.href = "/manager/dashboard";
          else if (r === "cleaner") window.location.href = "/employee/attendance";
          else window.location.href = "/employee/home";
          return;
        }
      } catch {}
    }
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username?: string; employeeId?: string; password?: string }) => {
      const isQRLogin = !!credentials.employeeId && !credentials.password;
      const endpoint = isQRLogin ? "/api/employees/login-qr" : "/api/employees/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || tc("فشل تسجيل الدخول", "Login failed"));
      return data as Employee;
    },
    onSuccess: (employee: any) => {
      if (employee.restoreKey) {
        localStorage.setItem("qirox-restore-key", employee.restoreKey);
        delete employee.restoreKey;
      }
      localStorage.setItem("currentEmployee", JSON.stringify(employee));
      preCacheOnLogin().catch(() => {});
      requestAndSubscribeEmployee(employee).catch(() => {});
      const role = employee.role;
      if (role === "admin") window.location.href = "/admin/dashboard";
      else if (role === "owner") window.location.href = "/owner/dashboard";
      else if (role === "manager" || role === "branch_manager") window.location.href = "/manager/dashboard";
      else if (role === "cleaner") window.location.href = "/employee/attendance";
      else window.location.href = "/employee/home";
    },
    onError: (err: any) => {
      setError(err?.message || tc("بيانات تسجيل الدخول غير صحيحة", "Invalid login credentials"));
      setPassword("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError(tc("الرجاء إدخال اسم المستخدم وكلمة المرور", "Please enter your username and password"));
      return;
    }
    loginMutation.mutate({ username: username.trim().toLowerCase(), password });
  };

  useEffect(() => {
    if (!showQRScanner) return;
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render(
      (decodedText) => {
        try {
          const scannedId = decodedText.trim();
          if (scannedId) {
            setError("");
            scanner.clear();
            setShowQRScanner(false);
            loginMutation.mutate({ employeeId: scannedId });
          } else {
            setError(tc("صيغة الباركود غير صحيحة", "Invalid QR code format"));
          }
        } catch {
          setError(tc("خطأ في قراءة الباركود", "Error reading QR code"));
        }
      },
      (err) => console.debug("QR scan error:", err)
    );
    qrScannerRef.current = scanner;
    return () => { qrScannerRef.current?.clear().catch(() => {}); };
  }, [showQRScanner]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center justify-center w-20 h-14 sm:w-32 sm:h-20 mb-2 sm:mb-3">
            <img src={qiroxLogoStaff} alt="مكان الشيف — الإدارة" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 font-playfair">مكان الشيف — الإدارة</h1>
          <p className="text-muted-foreground text-sm font-cairo">{tc("تسجيل دخول الموظف", "Employee Login")}</p>
        </div>

        {showQRScanner ? (
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl text-center font-playfair text-accent">
                {tc("مسح بطاقة الموظف", "Scan Employee Card")}
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                {tc("وجه الكاميرا نحو QR الكود الموجود على بطاقتك", "Point the camera at the QR code on your card")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div id="qr-reader" className="w-full overflow-hidden rounded-md border border-border" />
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
              <Button type="button" variant="outline" onClick={() => { setError(""); setShowQRScanner(false); }} className="w-full border-primary/20 text-primary">
                {tc("إلغاء", "Cancel")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl text-center font-playfair text-foreground">
                {tc("تسجيل الدخول", "Sign In")}
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                {tc("أدخل بيانات حسابك للوصول", "Enter your account credentials to access")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <AtSign className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type="text"
                    placeholder={tc("اسم المستخدم أو الجوال أو الإيميل", "Username, Phone or Email")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10 bg-white border-gray-300"
                    data-testid="input-username"
                    autoFocus
                    autoComplete="username email tel"
                    disabled={loginMutation.isPending}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={tc("كلمة المرور", "Password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 bg-white border-gray-300"
                    data-testid="input-password"
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-primary hover:text-primary/80"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember-me"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="remember-me" className="text-sm text-muted-foreground">{tc("تذكرني", "Remember me")}</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/employee/forgot-password")}
                    className="text-xs text-accent hover:text-accent/80 underline"
                    data-testid="link-forgot-password"
                  >
                    {tc("نسيت كلمة المرور؟", "Forgot password?")}
                  </button>
                </div>

                {error && (
                  <p className="text-destructive text-sm text-right" data-testid="text-error">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground font-bold"
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="ml-2 h-4 w-4 animate-spin" />{tc("جاري تسجيل الدخول...", "Signing in...")}</>
                  ) : tc("دخول", "Sign In")}
                </Button>

                <div className="pt-4 border-t border-border space-y-2">
                  <Button type="button" variant="secondary" onClick={() => { setError(""); setShowQRScanner(true); }} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground" data-testid="button-scan-qr">
                    <QrCode className="w-4 h-4 ml-2" />
                    {tc("مسح بطاقة الموظف", "Scan Employee Card")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setLocation("/employee/general-checkin")} className="w-full border-primary/30 text-primary hover:bg-primary/5" data-testid="button-general-checkin">
                    <QrCode className="w-4 h-4 ml-2" />
                    {tc("صفحة التحضير العامة", "General Check-in Terminal")}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">{tc("موظف جديد؟", "New employee?")}</p>
                  <Button type="button" variant="outline" onClick={() => setLocation("/employee/activate")} className="w-full border-primary/20 text-primary" data-testid="button-activate">
                    {tc("تفعيل حساب جديد", "Activate New Account")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={async () => {
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') setDeferredPrompt(null);
                    } else {
                      const ua = navigator.userAgent.toLowerCase();
                      if (/iphone|ipad|ipod/.test(ua)) {
                        alert(tc("لتثبيت النظام على iPhone: اضغط على زر 'مشاركة' ثم 'إضافة إلى الشاشة الرئيسية'", "To install on iPhone: tap 'Share' then 'Add to Home Screen'"));
                      } else {
                        alert(tc("لتثبيت النظام: اضغط على القائمة (⋮) ثم 'تثبيت التطبيق'", "To install: tap the menu (⋮) then 'Install App'"));
                      }
                    }
                  }} className="w-full text-primary font-bold hover:bg-primary/5">
                    <Download className="ml-2 h-4 w-4" />
                    {tc("تحميل نظام الموظفين", "Download Staff App")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => setLocation("/employee/gateway")} className="text-primary hover:text-primary/80" data-testid="link-back">
            {tc("رجوع للبوابة", "Back to Gateway")}
          </Button>
        </div>
      </div>
    </div>
  );
}
