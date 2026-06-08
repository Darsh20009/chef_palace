import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/phone-input";
import { Mail, Phone, User, ArrowRight, Eye, EyeOff, ArrowLeft } from "lucide-react";
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";

type Step =
  | "choice"
  | "email" | "phone" | "password"
  | "phone-only" | "name" | "phone-password";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();

  const [step, setStep] = useState<Step>("choice");

  const [email, setEmail] = useState("");
  const [emailPhone, setEmailPhone] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  const [phoneOnly, setPhoneOnly] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tc("نسيت كلمة المرور - مكان الشيف البخاري | إعادة تعيين", "Forgot Password - مكان الشيف البخاري | Reset");
  }, [tc]);

  const err = (msg: string) => toast({ title: tc("خطأ", "Error"), description: msg, variant: "destructive" });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err(tc("البريد الإلكتروني غير صحيح", "Invalid email address"));
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/check-email", { email });
      const data = await res.json();
      if (data.exists) {
        setVerifiedEmail(email);
        setStep("phone");
      } else {
        err(tc("البريد غير مسجل لدينا", "Email not registered"));
      }
    } catch (e: any) {
      err(e.message || tc("حدث خطأ", "An error occurred"));
    } finally { setLoading(false); }
  };

  const handleEmailPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emailPhone.trim().replace(/\s/g, "");
    if (!/^5\d{8}$/.test(clean)) {
      return err(tc("رقم الجوال يجب أن يبدأ بـ 5 (9 أرقام)", "Phone must start with 5 (9 digits)"));
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/verify-phone-email", { email: verifiedEmail, phone: clean });
      const data = await res.json();
      if (data.valid) {
        setStep("password");
      } else {
        err(tc("رقم الجوال غير مطابق للبريد", "Phone does not match the email"));
      }
    } catch (e: any) {
      err(e.message || tc("حدث خطأ", "An error occurred"));
    } finally { setLoading(false); }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailPassword.length < 4) return err(tc("كلمة المرور 4 أحرف على الأقل", "Password must be at least 4 characters"));
    if (emailPassword !== emailConfirm) return err(tc("كلمتا المرور غير متطابقتان", "Passwords do not match"));
    setLoading(true);
    const clean = emailPhone.trim().replace(/\s/g, "");
    try {
      await apiRequest("POST", "/api/customers/reset-password-direct", {
        email: verifiedEmail, phone: clean, newPassword: emailPassword,
      });
      toast({ title: tc("تم بنجاح!", "Success!"), description: tc("تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن", "Password changed. You can now log in") });
      setTimeout(() => navigate("/auth"), 1500);
    } catch (e: any) {
      err(e.message || tc("حدث خطأ", "An error occurred"));
    } finally { setLoading(false); }
  };

  const handlePhoneOnlySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneOnly.trim().replace(/\s/g, "");
    if (!/^5\d{8}$/.test(clean)) {
      return err(tc("رقم الجوال يجب أن يبدأ بـ 5 (9 أرقام)", "Phone must start with 5 (9 digits)"));
    }
    setVerifiedPhone(clean);
    setStep("name");
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      return err(tc("يرجى إدخال الاسم", "Please enter your name"));
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/verify-phone-name", {
        phone: verifiedPhone, name: customerName.trim(),
      });
      const data = await res.json();
      if (data.valid) {
        setStep("phone-password");
        toast({ title: tc("تم التحقق", "Verified"), description: tc("الآن أدخل كلمة المرور الجديدة", "Now enter your new password") });
      } else {
        err(tc("رقم الجوال أو الاسم غير صحيح", "Phone number or name is incorrect"));
      }
    } catch (e: any) {
      err(e.message || tc("حدث خطأ", "An error occurred"));
    } finally { setLoading(false); }
  };

  const handlePhonePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phonePassword.length < 4) return err(tc("كلمة المرور 4 أحرف على الأقل", "Password must be at least 4 characters"));
    if (phonePassword !== phoneConfirm) return err(tc("كلمتا المرور غير متطابقتان", "Passwords do not match"));
    setLoading(true);
    try {
      await apiRequest("POST", "/api/customers/reset-password-by-phone-name", {
        phone: verifiedPhone, name: customerName.trim(), newPassword: phonePassword,
      });
      toast({ title: tc("تم بنجاح!", "Success!"), description: tc("تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن", "Password changed. You can now log in") });
      setTimeout(() => navigate("/auth"), 1500);
    } catch (e: any) {
      err(e.message || tc("حدث خطأ", "An error occurred"));
    } finally { setLoading(false); }
  };

  const titles: Record<Step, string> = {
    choice: tc("نسيت كلمة المرور؟", "Forgot Password?"),
    email: tc("استرداد بالبريد الإلكتروني", "Recover via Email"),
    phone: tc("تحقق من رقم الجوال", "Verify Phone Number"),
    password: tc("كلمة المرور الجديدة", "New Password"),
    "phone-only": tc("استرداد برقم الجوال والاسم", "Recover via Phone & Name"),
    name: tc("تحقق من هويتك", "Verify Your Identity"),
    "phone-password": tc("كلمة المرور الجديدة", "New Password"),
  };

  const descs: Record<Step, string> = {
    choice: tc("اختر طريقة الاسترداد", "Choose a recovery method"),
    email: tc("أدخل بريدك الإلكتروني المسجل", "Enter your registered email"),
    phone: tc("أدخل رقم الجوال المرتبط بالبريد", "Enter the phone linked to the email"),
    password: tc("أدخل كلمة المرور الجديدة وتأكيدها", "Enter and confirm your new password"),
    "phone-only": tc("أدخل رقم جوالك المسجل", "Enter your registered phone number"),
    name: tc("أدخل الاسم المسجل في حسابك", "Enter the name registered in your account"),
    "phone-password": tc("أدخل كلمة المرور الجديدة وتأكيدها", "Enter and confirm your new password"),
  };

  const canGoBack = step !== "choice";
  const handleBack = () => {
    if (step === "email" || step === "phone-only") setStep("choice");
    else if (step === "phone") setStep("email");
    else if (step === "password") setStep("phone");
    else if (step === "name") setStep("phone-only");
    else if (step === "phone-password") setStep("name");
  };

  const SubmitButton = ({ label, testId }: { label: string; testId: string }) => (
    <Button
      type="submit"
      disabled={loading}
      className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all duration-300"
      data-testid={testId}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          <span>{tc("جارٍ التحقق...", "Verifying...")}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <ArrowRight className="w-5 h-5" />
        </div>
      )}
    </Button>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, hsl(165, 15%, 97%) 0%, hsl(165, 12%, 88%) 50%, hsl(165, 15%, 97%) 100%)" }}
     
    >
      <Card className="w-full max-w-md border-primary/30 bg-card backdrop-blur shadow-xl">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="flex justify-center mb-1">
            <img src={qiroxLogoStaff} alt="مكان الشيف" className="h-12 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">{titles[step]}</CardTitle>
          <CardDescription className="text-muted-foreground">{descs[step]}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">

          {step === "choice" && (
            <div className="space-y-3">
              <button
                onClick={() => setStep("email")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group text-right"
                data-testid="button-choice-email"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{tc("لدي بريد إلكتروني", "I have an email")}</p>
                  <p className="text-sm text-muted-foreground">{tc("استرداد عبر البريد الإلكتروني ورقم الجوال", "Recover via email and phone number")}</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => setStep("phone-only")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group text-right"
                data-testid="button-choice-phone"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{tc("ليس لدي بريد إلكتروني", "I don't have an email")}</p>
                  <p className="text-sm text-muted-foreground">{tc("استرداد عبر رقم الجوال واسم الحساب", "Recover via phone number and account name")}</p>
                </div>
                <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>
          )}

          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-foreground">
                  <Mail className="w-4 h-4" /> {tc("البريد الإلكتروني", "Email")}
                </Label>
                <Input
                  id="email" type="email" dir="ltr"
                  placeholder="example@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary border-border focus:border-primary focus:ring-primary/30"
                  data-testid="input-email" required
                />
              </div>
              <SubmitButton label={tc("التالي", "Next")} testId="button-submit-email" />
            </form>
          )}

          {step === "phone" && (
            <form onSubmit={handleEmailPhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailPhone" className="flex items-center gap-2 text-foreground">
                  <Phone className="w-4 h-4" /> {tc("رقم الجوال", "Phone Number")}
                </Label>
                <PhoneInput
                  id="emailPhone" value={emailPhone} onChange={(v) => setEmailPhone(v)}
                  placeholder="5xxxxxxxx" data-testid="input-phone" required
                />
                <p className="text-xs text-muted-foreground">{tc("رقم الجوال المرتبط بالبريد المدخل", "The phone linked to the entered email")}</p>
              </div>
              <SubmitButton label={tc("تحقق", "Verify")} testId="button-submit-phone" />
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">{tc("كلمة المرور الجديدة", "New Password")}</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"} placeholder={tc("أدخل كلمة المرور الجديدة", "Enter new password")}
                    value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)}
                    className="bg-secondary border-border focus:border-primary pl-10"
                    data-testid="input-new-password" required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{tc("تأكيد كلمة المرور", "Confirm Password")}</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"} placeholder={tc("أعد إدخال كلمة المرور", "Re-enter password")}
                    value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)}
                    className="bg-secondary border-border focus:border-primary pl-10"
                    data-testid="input-confirm-password" required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{tc("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters")}</p>
              </div>
              <SubmitButton label={tc("تغيير كلمة المرور", "Change Password")} testId="button-reset-password" />
            </form>
          )}

          {step === "phone-only" && (
            <form onSubmit={handlePhoneOnlySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneOnly" className="flex items-center gap-2 text-foreground">
                  <Phone className="w-4 h-4" /> {tc("رقم الجوال", "Phone Number")}
                </Label>
                <PhoneInput
                  id="phoneOnly" value={phoneOnly} onChange={(v) => setPhoneOnly(v)}
                  placeholder="5xxxxxxxx" data-testid="input-phone-only" required
                />
                <p className="text-xs text-muted-foreground">{tc("رقم الجوال المسجل في حسابك", "Phone number registered in your account")}</p>
              </div>
              <SubmitButton label={tc("التالي", "Next")} testId="button-submit-phone-only" />
            </form>
          )}

          {step === "name" && (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName" className="flex items-center gap-2 text-foreground">
                  <User className="w-4 h-4" /> {tc("اسم الحساب", "Account Name")}
                </Label>
                <Input
                  id="customerName"
                  placeholder={tc("أدخل اسمك كما هو مسجل في الحساب", "Enter your name as registered")}
                  value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-secondary border-border focus:border-primary focus:ring-primary/30"
                  data-testid="input-name" required
                />
                <p className="text-xs text-muted-foreground">
                  {tc("الاسم الذي أدخلته عند إنشاء حسابك", "The name you entered when creating your account")}
                </p>
              </div>
              <SubmitButton label={tc("تحقق من الهوية", "Verify Identity")} testId="button-submit-name" />
            </form>
          )}

          {step === "phone-password" && (
            <form onSubmit={handlePhonePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">{tc("كلمة المرور الجديدة", "New Password")}</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"} placeholder={tc("أدخل كلمة المرور الجديدة", "Enter new password")}
                    value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)}
                    className="bg-secondary border-border focus:border-primary pl-10"
                    data-testid="input-phone-new-password" required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{tc("تأكيد كلمة المرور", "Confirm Password")}</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"} placeholder={tc("أعد إدخال كلمة المرور", "Re-enter password")}
                    value={phoneConfirm} onChange={(e) => setPhoneConfirm(e.target.value)}
                    className="bg-secondary border-border focus:border-primary pl-10"
                    data-testid="input-phone-confirm-password" required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{tc("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters")}</p>
              </div>
              <SubmitButton label={tc("تغيير كلمة المرور", "Change Password")} testId="button-phone-reset-password" />
            </form>
          )}

          <div className="pt-2 flex items-center justify-between">
            {canGoBack ? (
              <button
                type="button" onClick={handleBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-back"
              >
                <ArrowRight className="w-4 h-4" />
                {tc("رجوع", "Back")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button" onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              data-testid="link-back-to-login"
            >
              {tc("تسجيل الدخول", "Login")}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
