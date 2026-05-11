import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
const chefsplaceLogoStaff = "/logo.png";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    document.title = tc("إعادة تعيين كلمة المرور - مكان الشيف البخاري", "Reset Password - مكان الشيف البخاري");
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', tc('إعادة تعيين كلمة المرور على مكان الشيف البخاري - أدخل كلمة مرور جديدة آمنة', 'Reset your مكان الشيف البخاري password - enter a new secure password'));
  }, [tc]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token");

    if (!resetToken) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("رابط إعادة التعيين غير صالح", "Reset link is invalid"),
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    setToken(resetToken);
    verifyToken(resetToken);
  }, []);

  const verifyToken = async (resetToken: string) => {
    setVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/customers/verify-reset-token", { token: resetToken });
      const data = await res.json();

      if (data.valid) {
        setTokenValid(true);
      } else {
        toast({
          title: tc("خطأ", "Error"),
          description: tc("رابط إعادة التعيين غير صالح أو منتهي الصلاحية", "Reset link is invalid or expired"),
          variant: "destructive"
        });
        setTimeout(() => navigate("/forgot-password"), 2000);
      }
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("رابط إعادة التعيين غير صالح", "Reset link is invalid"),
        variant: "destructive"
      });
      setTimeout(() => navigate("/forgot-password"), 2000);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 4) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("كلمة المرور يجب أن تكون على الأقل 4 أحرف", "Password must be at least 4 characters"),
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("كلمة المرور غير متطابقة", "Passwords do not match"),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      await apiRequest("POST", "/api/customers/reset-password", { token, newPassword });

      setResetSuccess(true);
      toast({
        title: tc("نجح!", "Success!"),
        description: tc("تم تغيير كلمة المرور بنجاح", "Password changed successfully"),
      });

      setTimeout(() => navigate("/auth"), 3000);
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("حدث خطأ أثناء تغيير كلمة المرور", "An error occurred while changing the password"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(135deg, hsl(165, 15%, 97%) 0%, hsl(165, 12%, 88%) 50%, hsl(165, 15%, 97%) 100%)" }}
        dir="rtl"
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground">{tc("جارٍ التحقق من الرابط...", "Verifying link...")}</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, hsl(165, 15%, 97%) 0%, hsl(165, 12%, 88%) 50%, hsl(165, 15%, 97%) 100%)" }}
      dir="rtl"
    >
      <Card className="w-full max-w-md border-primary/30 bg-card backdrop-blur shadow-xl">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center mb-1">
            {resetSuccess ? (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
            ) : (
              <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري" className="h-12 object-contain" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">
            {resetSuccess ? tc("تم التغيير بنجاح!", "Changed Successfully!") : tc("إعادة تعيين كلمة المرور", "Reset Password")}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-lg">
            {resetSuccess ? tc("يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة", "You can now log in with the new password") : tc("أدخل كلمة المرور الجديدة", "Enter your new password")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!resetSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {tc("كلمة المرور الجديدة", "New Password")}
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder={tc("أدخل كلمة المرور الجديدة", "Enter new password")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30 pl-10"
                    data-testid="input-new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-new-password"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {tc("تأكيد كلمة المرور", "Confirm Password")}
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={tc("أعد إدخال كلمة المرور", "Re-enter password")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30 pl-10"
                    data-testid="input-confirm-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tc("كلمة المرور يجب أن تكون على الأقل 4 أحرف", "Password must be at least 4 characters")}
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-lg font-bold bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground shadow-lg shadow-accent/30 transition-all duration-300"
                data-testid="button-submit"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                    <span>{tc("جارٍ التغيير...", "Changing...")}</span>
                  </div>
                ) : (
                  tc("تغيير كلمة المرور", "Change Password")
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-lg bg-green-900/20 border border-green-700/30">
                <p className="text-green-300 text-sm">
                  {tc("تم تغيير كلمة المرور بنجاح! سيتم تحويلك لصفحة تسجيل الدخول...", "Password changed successfully! Redirecting to login...")}
                </p>
              </div>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-primary hover:bg-primary"
                data-testid="button-go-to-login"
              >
                {tc("الذهاب لتسجيل الدخول", "Go to Login")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
