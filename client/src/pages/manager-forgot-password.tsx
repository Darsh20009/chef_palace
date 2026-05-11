import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import chefsplaceLogoStaff from "@assets/blackrose-logo.png";
import { useTranslate } from "@/lib/useTranslate";

export default function ManagerForgotPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'username' | 'password'>('username');

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || username.trim().length < 2) {
      toast({ title: tc("خطأ", "Error"), description: tc("يرجى إدخال اسم المستخدم", "Please enter your username"), variant: "destructive" });
      return;
    }
    setStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      toast({ title: tc("خطأ", "Error"), description: tc("كلمة المرور يجب أن تكون على الأقل 4 أحرف", "Password must be at least 4 characters"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: tc("خطأ", "Error"), description: tc("كلمة المرور غير متطابقة", "Passwords do not match"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/employees/reset-password-by-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword })
      });
      if (!response.ok) throw new Error(tc("فشل تغيير كلمة المرور", "Failed to change password"));
      toast({ title: tc("نجح!", "Success!"), description: tc("تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن", "Password changed successfully. You can sign in now") });
      setTimeout(() => navigate("/manager/login"), 2000);
    } catch (error: any) {
      toast({ title: tc("خطأ", "Error"), description: error.message || tc("حدث خطأ أثناء تغيير كلمة المرور", "An error occurred while changing the password"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center">
            <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري SYSTEMS" className="w-16 h-16 object-contain rounded-xl" />
          </div>
          <CardTitle className="text-2xl font-bold">{tc("نسيت كلمة المرور؟", "Forgot Password?")}</CardTitle>
          <CardDescription>
            {step === 'username' && tc('أدخل اسم المستخدم لتغيير كلمة المرور', 'Enter your username to change your password')}
            {step === 'password' && tc('أدخل كلمة المرور الجديدة', 'Enter your new password')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 'username' && (
            <form onSubmit={handleUsernameSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">{tc("اسم المستخدم", "Username")}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={tc("أدخل اسم المستخدم الخاص بك", "Enter your username")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-username"
                  required
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-submit-username">
                <Shield className="w-4 h-4 ml-2" />
                {tc("التحقق من الحساب", "Verify Account")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/manager/login")}
                data-testid="button-back-login"
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                {tc("العودة لتسجيل الدخول", "Back to Login")}
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{tc("كلمة المرور الجديدة", "New Password")}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder={tc("أدخل كلمة مرور جديدة", "Enter new password")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{tc("تأكيد كلمة المرور", "Confirm Password")}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={tc("أعد إدخال كلمة المرور", "Re-enter password")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    data-testid="input-confirm-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-password">
                <Lock className="w-4 h-4 ml-2" />
                {loading ? tc("جارٍ التغيير...", "Changing...") : tc("تغيير كلمة المرور", "Change Password")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep('username')}
                data-testid="button-back-step"
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                {tc("العودة", "Back")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
