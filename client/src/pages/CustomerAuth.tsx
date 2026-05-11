import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCustomer } from "@/contexts/CustomerContext";
const chefsplaceLogo = "/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneInput } from "@/components/phone-input";
import { SmartIdentifierInput } from "@/components/smart-identifier-input";
import { Phone, User, Lock, Mail, Eye, EyeOff, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { customerStorage } from "@/lib/customer-storage";

export default function CustomerAuth() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { setCustomer } = useCustomer();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [guestInfo, setGuestInfo] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    const info = customerStorage.getGuestInfo();
    if (info) {
      setGuestInfo(info);
      setName(info.name);
      setIdentifier(info.phone);
      setMode("register");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanIdentifier = identifier.replace(/\s/g, '').trim();
    
    if (!cleanIdentifier) {
      toast({
        title: i18n.language === 'ar' ? "خطأ" : "Error",
        description: i18n.language === 'ar' ? "يرجى إدخال رقم الجوال أو البريد الإلكتروني" : "Please enter phone number or email",
        variant: "destructive"
      });
      return;
    }

    if (!password || password.length < 4) {
      toast({
        title: i18n.language === 'ar' ? "خطأ" : "Error",
        description: i18n.language === 'ar' ? "كلمة المرور يجب أن تكون على الأقل 4 أحرف" : "Password must be at least 4 characters",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest("POST", "/api/customers/login", {
        identifier: cleanIdentifier,
        password
      });
      
      const customer = await res.json();
      setCustomer(customer);
      
      toast({
        title: i18n.language === 'ar' ? "مرحباً بك!" : "Welcome!",
        description: i18n.language === 'ar' ? `أهلاً ${customer.name}، تم تسجيل دخولك بنجاح` : `Hello ${customer.name}, you have logged in successfully`,
      });

      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: i18n.language === 'ar' ? "خطأ" : "Error",
        description: error.message || (i18n.language === 'ar' ? "العميل غير مسجل لدينا" : "Customer not found"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectivePhone = guestInfo ? guestInfo.phone : identifier.replace(/\s/g, '').trim();
    const effectiveName = guestInfo ? guestInfo.name : name.trim();
    
    const cleanPhone = effectivePhone;
    
    if (!guestInfo) {
      if (!cleanPhone || cleanPhone.length !== 9) {
        toast({
          title: i18n.language === 'ar' ? "خطأ" : "Error",
          description: i18n.language === 'ar' ? "يرجى إدخال رقم جوال مكون من 9 أرقام" : "Please enter a 9-digit phone number",
          variant: "destructive"
        });
        return;
      }

      if (!cleanPhone.startsWith('5')) {
        toast({
          title: i18n.language === 'ar' ? "خطأ" : "Error",
          description: i18n.language === 'ar' ? "رقم الجوال يجب أن يبدأ بالرقم 5" : "Phone number must start with 5",
          variant: "destructive"
        });
        return;
      }

      if (!effectiveName || effectiveName.length < 2) {
        toast({
          title: i18n.language === 'ar' ? "خطأ" : "Error",
          description: i18n.language === 'ar' ? "الاسم يجب أن يكون على الأقل حرفين" : "Name must be at least 2 characters",
          variant: "destructive"
        });
        return;
      }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: i18n.language === 'ar' ? "خطأ" : "Error",
        description: i18n.language === 'ar' ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email address format",
        variant: "destructive"
      });
      return;
    }

    if (!password || password.length < 4) {
      toast({
        title: i18n.language === 'ar' ? "خطأ" : "Error",
        description: i18n.language === 'ar' ? "كلمة المرور يجب أن تكون على الأقل 4 أحرف" : "Password must be at least 4 characters",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest("POST", "/api/customers/register", {
        phone: cleanPhone,
        name: effectiveName,
        ...(email.trim() ? { email: email.trim() } : {}),
        password,
      });
      
      const customer = await res.json();
      setCustomer(customer);

      if (guestInfo) {
        customerStorage.clearGuestInfo();
        customerStorage.setGuestMode(false);
        setGuestInfo(null);
      }

      toast({
        title: i18n.language === 'ar' ? "مرحباً بك!" : "Welcome!",
        description: i18n.language === 'ar'
          ? `أهلاً ${customer.name}، تم إنشاء حسابك وربط طلباتك السابقة`
          : `Hello ${customer.name}, your account was created and previous orders linked`,
      });

      navigate("/");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: i18n.language === 'ar' ? "خطأ" : "Error",
        description: error.message || (i18n.language === 'ar' ? "حدث خطأ أثناء إنشاء الحساب" : "An error occurred while creating your account"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, hsl(175 20% 10%) 0%, hsl(175 18% 18%) 50%, hsl(175 20% 10%) 100%)",
      }}
      dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
    >
      <Card className="w-full max-w-md border-primary/30 bg-gradient-to-br from-foreground/5 to-foreground/10 backdrop-blur shadow-2xl">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-accent/50 backdrop-blur-xl border border-white/20 bg-black/20">
              <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="w-full h-full object-cover rounded-2xl" />
            </div>
          </div>
          <CardTitle className="tracking-tight text-3xl font-bold text-foreground">
            {i18n.language === 'ar' ? "مرحباً بك في مكان الشيف البخاري" : "Welcome to مكان الشيف البخاري"}
          </CardTitle>
          <CardDescription className="text-lg text-[#b2babc]">
            {i18n.language === 'ar' ? "سجل دخولك للحصول على حسابك الخاص" : "Sign in to access your account"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")} className="w-full">
            <TabsList className="h-10 items-center justify-center rounded-md p-1 grid w-full grid-cols-2 bg-primary/20 text-primary">
              <TabsTrigger value="login" data-testid="tab-login">{i18n.language === 'ar' ? "تسجيل دخول" : "Login"}</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">{i18n.language === 'ar' ? "حساب جديد" : "New Account"}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-5 mt-5">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-identifier" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 text-[#1f2025]">
                    <Mail className="w-4 h-4" />
                    {i18n.language === 'ar' ? "رقم الجوال أو البريد الإلكتروني" : "Phone number or Email"}
                  </Label>
                  <SmartIdentifierInput
                    id="login-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e)}
                    placeholder={i18n.language === 'ar' ? "5xxxxxxxx أو email@example.com" : "5xxxxxxxx or email@example.com"}
                    data-testid="input-identifier"
                    required
                  />
                  <p className="text-xs text-card/70 mt-1">
                    {i18n.language === 'ar' ? "يمكنك تسجيل الدخول بالجوال (9 أرقام يبدأ بـ 5) أو البريد الإلكتروني" : "Login with phone (9 digits starting with 5) or email"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 text-[#1f2025]">
                    <Lock className="w-4 h-4" />
                    {i18n.language === 'ar' ? "كلمة المرور" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder={i18n.language === 'ar' ? "أدخل كلمة المرور" : "Enter password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`bg-primary/20 border-primary/50 text-card placeholder:text-card/60 focus:border-accent focus:ring-accent/30 ${i18n.language === 'ar' ? 'pl-10' : 'pr-10'}`}
                      data-testid="input-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute ${i18n.language === 'ar' ? 'left-3' : 'right-3'} top-2.5 text-accent hover:text-accent/80`}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-xs text-black hover:text-black/70 transition-colors underline-offset-4 hover:underline"
                    data-testid="link-forgot-password"
                  >
                    {i18n.language === 'ar' ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-card shadow-lg shadow-accent/50 transition-all duration-300 hover:scale-[1.02]"
                  data-testid="button-login"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{i18n.language === 'ar' ? "جارٍ تسجيل الدخول..." : "Logging in..."}</span>
                    </div>
                  ) : (
                    i18n.language === 'ar' ? "تسجيل الدخول" : "Login"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-5 mt-5">
              <form onSubmit={handleRegister} className="space-y-5">
                {guestInfo ? (
                  <div className="bg-green-950/40 border border-green-700/50 rounded-lg p-3 flex items-start gap-3">
                    <Zap className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-300 font-semibold text-sm">
                        {i18n.language === 'ar' ? `تسجيل حساب لـ ${guestInfo.name}` : `Creating account for ${guestInfo.name}`}
                      </p>
                      <p className="text-green-400/70 text-xs mt-0.5">
                        {i18n.language === 'ar'
                          ? `رقم ${guestInfo.phone} • أدخل البريد وكلمة المرور فقط وسنربط طلباتك السابقة`
                          : `Phone ${guestInfo.phone} • Enter email & password to link your previous orders`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="text-sm font-medium leading-none flex items-center gap-2 text-[#1f2025]">
                        <User className="w-4 h-4" />
                        {i18n.language === 'ar' ? "الاسم" : "Name"}
                      </Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder={i18n.language === 'ar' ? "أدخل اسمك" : "Enter your name"}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-primary/20 border-primary/50 text-card placeholder:text-card/60 focus:border-accent focus:ring-accent/30"
                        data-testid="input-name"
                        required={!guestInfo}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-phone" className="text-sm font-medium leading-none flex items-center gap-2 text-[#1f2025]">
                        <Phone className="w-4 h-4" />
                        {i18n.language === 'ar' ? "رقم الجوال" : "Phone Number"}
                      </Label>
                      <PhoneInput
                        id="register-phone"
                        value={identifier}
                        onChange={(e) => setIdentifier(e)}
                        placeholder="5xxxxxxxx"
                        data-testid="input-phone-register"
                        required={!guestInfo}
                      />
                      <p className="text-xs text-card/70 mt-1">
                        {i18n.language === 'ar' ? "ابدأ بـ 5 ثم باقي الأرقام (9 أرقام)" : "Start with 5 followed by remaining digits (9 digits)"}
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 text-[#1f2025]">
                    <Mail className="w-4 h-4" />
                    {i18n.language === 'ar' ? "البريد الإلكتروني (اختياري)" : "Email Address (optional)"}
                  </Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-primary/20 border-primary/50 text-card placeholder:text-card/60 focus:border-accent focus:ring-accent/30"
                    data-testid="input-email"
                    dir="ltr"
                  />
                  <p className="text-xs text-card/70 mt-1">
                    {i18n.language === 'ar' ? "يمكنك إضافته لاحقاً من ملفك الشخصي" : "You can add it later from your profile"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 text-[#1f2025]">
                    <Lock className="w-4 h-4" />
                    {i18n.language === 'ar' ? "كلمة المرور" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={i18n.language === 'ar' ? "أدخل كلمة المرور (4 أحرف على الأقل)" : "Enter password (min 4 characters)"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`bg-primary/20 border-primary/50 text-card placeholder:text-card/60 focus:border-accent focus:ring-accent/30 ${i18n.language === 'ar' ? 'pl-10' : 'pr-10'}`}
                      data-testid="input-password-register"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute ${i18n.language === 'ar' ? 'left-3' : 'right-3'} top-2.5 text-accent hover:text-accent/80`}
                      data-testid="button-toggle-password-register"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>


                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-[#2D9B6E] to-[#25845d] hover:from-[#25845d] hover:to-[#1f7350] text-white shadow-lg shadow-[#2D9B6E]/30 transition-all duration-300 hover:scale-[1.02]"
                  data-testid="button-register"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{i18n.language === 'ar' ? "جارٍ إنشاء الحساب..." : "Creating account..."}</span>
                    </div>
                  ) : (
                    i18n.language === 'ar' ? "إنشاء حساب" : "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>


          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-accent/70 hover:text-accent transition-colors text-sm underline-offset-4 hover:underline"
              data-testid="link-skip"
            >
              {i18n.language === 'ar' ? "تخطي وتصفح القائمة" : "Skip and explore menu"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
