import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AtSign, Lock, Phone, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";
const chefsplaceLogoStaff = "/logo.png";

type Step = "username" | "phone" | "password";

export default function EmployeeForgotPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();

  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const stepConfig = {
    username: { num: 1, label: tc("اسم المستخدم", "Username") },
    phone:    { num: 2, label: tc("رقم الجوال", "Phone") },
    password: { num: 3, label: tc("كلمة المرور الجديدة", "New Password") },
  };

  const verifyPhoneMutation = useMutation({
    mutationFn: async ({ username, phone }: { username: string; phone: string }) => {
      const res = await fetch("/api/employees/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || tc("رقم الجوال غير صحيح", "Incorrect phone number"));
      return data;
    },
    onSuccess: () => { setError(""); setStep("password"); },
    onError: (err: any) => setError(err?.message || tc("اسم المستخدم أو رقم الجوال غير صحيح", "Incorrect username or phone")),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/employees/reset-password-by-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || tc("فشل تغيير كلمة المرور", "Failed to change password"));
      return data;
    },
    onSuccess: () => {
      toast({ title: tc("تم بنجاح!", "Success!"), description: tc("تم تغيير كلمة المرور. سيتم تحويلك لتسجيل الدخول", "Password changed. Redirecting to login...") });
      setTimeout(() => navigate("/employee/login"), 2000);
    },
    onError: (err: any) => setError(err?.message || tc("حدث خطأ", "An error occurred")),
  });

  const handleUsernameNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError(tc("الرجاء إدخال اسم المستخدم", "Please enter your username")); return; }
    setStep("phone");
  };

  const handlePhoneNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone.trim()) { setError(tc("الرجاء إدخال رقم الجوال", "Please enter your phone number")); return; }
    verifyPhoneMutation.mutate({ username: username.trim().toLowerCase(), phone: phone.trim() });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newPassword || newPassword.length < 4) {
      setError(tc("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tc("كلمة المرور غير متطابقة", "Passwords do not match"));
      return;
    }
    resetMutation.mutate();
  };

  const goBack = () => {
    setError("");
    if (step === "phone") setStep("username");
    else if (step === "password") setStep("phone");
    else navigate("/employee/login");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-40 h-28 mb-4">
            <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 font-playfair">مكان الشيف البخاري</h1>
          <p className="text-muted-foreground font-cairo">{tc("استعادة كلمة المرور", "Password Recovery")}</p>
        </div>

        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center font-playfair text-foreground">
              {tc("نسيت كلمة المرور؟", "Forgot Password?")}
            </CardTitle>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 pt-2" dir="ltr">
              {(["username", "phone", "password"] as Step[]).map((s, i) => {
                const isDone = stepConfig[step].num > i + 1;
                const isActive = step === s;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                      ${isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    {i < 2 && <div className={`w-8 h-0.5 ${isDone ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
            <CardDescription className="text-center text-xs text-muted-foreground pt-1">
              {tc("الخطوة", "Step")} {stepConfig[step].num} {tc("من", "of")} 3 — {stepConfig[step].label}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Step 1: Username */}
            {step === "username" && (
              <form onSubmit={handleUsernameNext} className="space-y-4">
                <div className="relative">
                  <AtSign className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type="text"
                    placeholder={tc("اسم المستخدم أو البريد الإلكتروني", "Username or Email")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10 bg-background border-border"
                    data-testid="input-username"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
                {error && <p className="text-destructive text-sm text-right">{error}</p>}
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold" data-testid="button-next">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {tc("التالي", "Next")}
                </Button>
                <Button type="button" variant="ghost" onClick={goBack} className="w-full text-muted-foreground">
                  {tc("العودة لتسجيل الدخول", "Back to Login")}
                </Button>
              </form>
            )}

            {/* Step 2: Phone verification */}
            {step === "phone" && (
              <form onSubmit={handlePhoneNext} className="space-y-4">
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm flex items-center gap-2 border border-border">
                  <AtSign className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-foreground">{username}</span>
                </div>
                <div className="relative">
                  <Phone className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type="tel"
                    placeholder={tc("رقم الجوال المسجل (مثال: 0501234567)", "Registered phone (e.g. 0501234567)")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pr-10 bg-background border-border"
                    data-testid="input-phone"
                    autoFocus
                    autoComplete="tel"
                    disabled={verifyPhoneMutation.isPending}
                  />
                </div>
                {error && <p className="text-destructive text-sm text-right">{error}</p>}
                <Button type="submit" disabled={verifyPhoneMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold" data-testid="button-verify">
                  {verifyPhoneMutation.isPending
                    ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />{tc("جاري التحقق...", "Verifying...")}</>
                    : <><ArrowRight className="w-4 h-4 mr-2" />{tc("التالي", "Next")}</>
                  }
                </Button>
                <Button type="button" variant="ghost" onClick={goBack} className="w-full text-muted-foreground">
                  {tc("رجوع", "Back")}
                </Button>
              </form>
            )}

            {/* Step 3: New password */}
            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm flex items-center gap-2 border border-border">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{tc("تم التحقق من الهوية", "Identity verified")}</span>
                  <span className="font-medium text-foreground mr-auto">{username}</span>
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder={tc("كلمة المرور الجديدة", "New password")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10 pl-10 bg-background border-border"
                    data-testid="input-new-password"
                    autoFocus
                    autoComplete="new-password"
                    disabled={resetMutation.isPending}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute left-3 top-3 text-primary hover:text-primary/80">
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={tc("تأكيد كلمة المرور", "Confirm password")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10 pl-10 bg-background border-border"
                    data-testid="input-confirm-password"
                    autoComplete="new-password"
                    disabled={resetMutation.isPending}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute left-3 top-3 text-primary hover:text-primary/80">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {tc("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters")}
                </p>

                {error && <p className="text-destructive text-sm text-right">{error}</p>}

                <Button type="submit" disabled={resetMutation.isPending} className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground font-bold" data-testid="button-reset">
                  {resetMutation.isPending
                    ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />{tc("جاري الحفظ...", "Saving...")}</>
                    : tc("حفظ كلمة المرور الجديدة", "Save New Password")
                  }
                </Button>
                <Button type="button" variant="ghost" onClick={goBack} className="w-full text-muted-foreground">
                  {tc("رجوع", "Back")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
