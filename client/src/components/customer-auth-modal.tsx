import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneInput } from "@/components/phone-input";
import { SmartIdentifierInput } from "@/components/smart-identifier-input";
import { Phone, User, Lock, Mail, Eye, EyeOff, ShoppingBag, LogIn, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { customerStorage } from "@/lib/customer-storage";
import { useCustomer } from "@/contexts/CustomerContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

type Mode = "guest" | "login" | "register";

export default function CustomerAuthModal() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { state, closeAuthModal, triggerSuccess } = useAuthModal();
  const { setCustomer } = useCustomer();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("guest");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.open) {
      setMode("guest");
      setIdentifier("");
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setLoading(false);
    }
  }, [state.open]);

  const validatePhone = (phone: string) => {
    const clean = phone.replace(/\s/g, "").trim();
    if (clean.length !== 9 || !clean.startsWith("5")) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "رقم الجوال يجب أن يبدأ بـ 5 ويتكون من 9 أرقام" : "Phone must start with 5 and be 9 digits",
        variant: "destructive",
      });
      return null;
    }
    return clean;
  };

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = validatePhone(identifier);
    if (!cleanPhone) return;
    if (!name.trim() || name.trim().length < 2) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "الاسم يجب أن يكون على الأقل حرفين" : "Name must be at least 2 characters",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      customerStorage.setGuestInfo(name.trim(), cleanPhone);
      customerStorage.setGuestMode(true);
      toast({
        title: isAr ? "تم!" : "Done!",
        description: isAr ? "يمكنك الآن إكمال طلبك" : "You can now complete your order",
      });
      triggerSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = identifier.replace(/\s/g, "").trim();
    if (!cleanIdentifier) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "يرجى إدخال رقم الجوال أو البريد الإلكتروني" : "Please enter phone or email",
        variant: "destructive",
      });
      return;
    }
    if (!password || password.length < 4) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "كلمة المرور 4 أحرف على الأقل" : "Password must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/login", {
        identifier: cleanIdentifier,
        password,
      });
      const customer = await res.json();
      setCustomer(customer);
      toast({
        title: isAr ? "مرحباً بك!" : "Welcome!",
        description: isAr ? `أهلاً ${customer.name}` : `Hello ${customer.name}`,
      });
      triggerSuccess();
    } catch (error: any) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: error.message || (isAr ? "بيانات الدخول غير صحيحة" : "Invalid credentials"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = validatePhone(identifier);
    if (!cleanPhone) return;
    if (!name.trim() || name.trim().length < 2) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "الاسم يجب أن يكون على الأقل حرفين" : "Name must be at least 2 characters",
        variant: "destructive",
      });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email",
        variant: "destructive",
      });
      return;
    }
    if (!password || password.length < 4) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: isAr ? "كلمة المرور 4 أحرف على الأقل" : "Password must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/register", {
        phone: cleanPhone,
        name: name.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        password,
      });
      const customer = await res.json();
      setCustomer(customer);
      customerStorage.clearGuestInfo();
      customerStorage.setGuestMode(false);
      toast({
        title: isAr ? "مرحباً بك!" : "Welcome!",
        description: isAr ? `تم إنشاء حسابك ${customer.name}` : `Account created for ${customer.name}`,
      });
      triggerSuccess();
    } catch (error: any) {
      toast({
        title: isAr ? "خطأ" : "Error",
        description: error.message || (isAr ? "حدث خطأ أثناء إنشاء الحساب" : "Failed to create account"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && closeAuthModal()}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto bg-card border-2 border-primary/30"
        dir={isAr ? "rtl" : "ltr"}
        data-testid="modal-customer-auth"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <ShoppingBag className="w-6 h-6 text-primary" />
            {isAr ? "إكمال الطلب" : "Complete Your Order"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAr
              ? "اختر طريقة المتابعة لإتمام طلبك"
              : "Choose how to proceed with your order"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3 bg-primary/10">
            <TabsTrigger value="guest" data-testid="tab-guest" className="gap-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="text-xs">{isAr ? "بدون تسجيل" : "Guest"}</span>
            </TabsTrigger>
            <TabsTrigger value="login" data-testid="tab-login-modal" className="gap-1">
              <LogIn className="w-3.5 h-3.5" />
              <span className="text-xs">{isAr ? "دخول" : "Login"}</span>
            </TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register-modal" className="gap-1">
              <UserPlus className="w-3.5 h-3.5" />
              <span className="text-xs">{isAr ? "حساب جديد" : "Sign Up"}</span>
            </TabsTrigger>
          </TabsList>

          {/* Guest */}
          <TabsContent value="guest" className="space-y-4 mt-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
              {isAr
                ? "أكمل طلبك بسرعة دون إنشاء حساب. سنحفظ بياناتك لتسجيلها لاحقاً."
                : "Complete your order quickly without registering. We'll save your info for future login."}
            </div>
            <form onSubmit={handleGuest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest-name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {isAr ? "الاسم" : "Name"}
                </Label>
                <Input
                  id="guest-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isAr ? "اسمك الكامل" : "Your full name"}
                  data-testid="input-guest-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {isAr ? "رقم الجوال" : "Phone Number"}
                </Label>
                <PhoneInput
                  id="guest-phone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e)}
                  placeholder="5xxxxxxxx"
                  data-testid="input-guest-phone"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base font-bold"
                data-testid="button-continue-guest"
              >
                {loading
                  ? (isAr ? "جارٍ المتابعة..." : "Continuing...")
                  : (isAr ? "متابعة الطلب" : "Continue to Order")}
              </Button>
            </form>
          </TabsContent>

          {/* Login */}
          <TabsContent value="login" className="space-y-4 mt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-id" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {isAr ? "الجوال أو البريد" : "Phone or Email"}
                </Label>
                <SmartIdentifierInput
                  id="login-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e)}
                  placeholder={isAr ? "5xxxxxxxx أو email@example.com" : "5xxxxxxxx or email@example.com"}
                  data-testid="input-login-identifier-modal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-pw" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {isAr ? "كلمة المرور" : "Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="login-pw"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isAr ? "كلمة المرور" : "Password"}
                    className={isAr ? "pl-10" : "pr-10"}
                    data-testid="input-login-password-modal"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${isAr ? "left-3" : "right-3"} top-2.5 text-muted-foreground`}
                    data-testid="button-toggle-pw-modal"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base font-bold"
                data-testid="button-submit-login-modal"
              >
                {loading
                  ? (isAr ? "جارٍ تسجيل الدخول..." : "Logging in...")
                  : (isAr ? "تسجيل دخول ومتابعة" : "Login & Continue")}
              </Button>
            </form>
          </TabsContent>

          {/* Register */}
          <TabsContent value="register" className="space-y-4 mt-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {isAr ? "الاسم" : "Name"}
                </Label>
                <Input
                  id="reg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isAr ? "اسمك" : "Your name"}
                  data-testid="input-register-name-modal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {isAr ? "رقم الجوال" : "Phone"}
                </Label>
                <PhoneInput
                  id="reg-phone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e)}
                  placeholder="5xxxxxxxx"
                  data-testid="input-register-phone-modal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {isAr ? "البريد (اختياري)" : "Email (optional)"}
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                  data-testid="input-register-email-modal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-pw" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {isAr ? "كلمة المرور" : "Password"}
                </Label>
                <Input
                  id="reg-pw"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isAr ? "4 أحرف على الأقل" : "Min 4 characters"}
                  data-testid="input-register-password-modal"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base font-bold"
                data-testid="button-submit-register-modal"
              >
                {loading
                  ? (isAr ? "جارٍ إنشاء الحساب..." : "Creating...")
                  : (isAr ? "إنشاء حساب ومتابعة" : "Create & Continue")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
