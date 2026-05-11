import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslate } from "@/lib/useTranslate";
const chefsplaceLogoStaff = "/logo.png";

export default function EmployeeActivation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: tc("خطأ", "Error"),
        description: tc("كلمات المرور غير متطابقة", "Passwords do not match"),
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 4) {
      toast({
        variant: "destructive",
        title: tc("خطأ", "Error"),
        description: tc("كلمة المرور يجب أن تكون على الأقل 4 أحرف", "Password must be at least 4 characters"),
      });
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiRequest("POST", "/api/employees/activate", { phone, fullName, password });
      const response = await res.json();

      localStorage.setItem("currentEmployee", JSON.stringify(response));

      toast({
        title: tc("تم التفعيل بنجاح", "Activated Successfully"),
        description: tc("مرحباً بك! تم تفعيل حسابك بنجاح", "Welcome! Your account has been activated"),
      });

      setLocation("/employee/home");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: tc("فشل التفعيل", "Activation Failed"),
        description: error.message || tc("حدث خطأ أثناء تفعيل الحساب. تأكد من رقم الهاتف والاسم.", "An error occurred during activation. Check your phone number and name."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md border border-border bg-card shadow-xl">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="flex justify-center mb-1">
            <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري" className="h-12 object-contain" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">{tc("تفعيل حساب موظف جديد", "Activate New Employee Account")}</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              {tc("أدخل بياناتك التي سجلها المدير لإنشاء كلمة المرور الخاصة بك", "Enter your details registered by the manager to create your password")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName" className="text-foreground">
                {tc("الاسم الكامل", "Full Name")}
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder={tc("أدخل اسمك الكامل كما سجله المدير", "Enter your full name as registered by the manager")}
                className="bg-secondary border-border focus:border-primary focus:ring-primary/30"
                data-testid="input-fullname"
              />
              <p className="text-xs text-muted-foreground mt-1">{tc("يجب أن يطابق الاسم المسجل لدى المدير", "Must match the name registered by the manager")}</p>
            </div>

            <div>
              <Label htmlFor="phone" className="text-foreground">
                {tc("رقم الهاتف", "Phone Number")}
              </Label>
              <PhoneInput
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e)}
                placeholder="5xxxxxxxx"
                data-testid="input-phone"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">{tc("رقم الهاتف المسجل لدى المدير", "Phone number registered by the manager")}</p>
            </div>

            <div className="border-t border-border pt-4">
              <div className="mb-4">
                <Label htmlFor="password" className="text-foreground">
                  {tc("كلمة المرور الجديدة", "New Password")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={4}
                    placeholder={tc("أدخل كلمة مرور قوية", "Enter a strong password")}
                    className="bg-secondary border-border focus:border-primary focus:ring-primary/30 pl-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-foreground">
                  {tc("تأكيد كلمة المرور", "Confirm Password")}
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={4}
                    placeholder={tc("أعد إدخال كلمة المرور", "Re-enter password")}
                    className="bg-secondary border-border focus:border-primary focus:ring-primary/30 pl-10"
                    data-testid="input-confirm-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <UserPlus className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-foreground">
                  <p className="font-semibold mb-1">{tc("تعليمات مهمة:", "Important Instructions:")}</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{tc("تأكد من إدخال رقم الهاتف والاسم المسجلين لدى المدير بدقة", "Enter the phone number and name registered by the manager accurately")}</li>
                    <li>{tc("اختر كلمة مرور قوية لا تقل عن 4 أحرف", "Choose a strong password of at least 4 characters")}</li>
                    <li>{tc("احفظ كلمة المرور في مكان آمن", "Keep your password in a safe place")}</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              data-testid="button-activate"
            >
              {isLoading ? tc("جاري التفعيل...", "Activating...") : tc("تفعيل الحساب", "Activate Account")}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLocation("/employee/login")}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-back-to-login"
              >
                {tc("العودة إلى تسجيل الدخول", "Back to Login")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
