import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

export default function EmployeeGateway() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const tc = useTranslate();

  useEffect(() => {
    document.title = tc("بوابة الموظفين - مكان الشيف البخاري | نظام الإدارة", "Staff Gateway - مكان الشيف البخاري | Management System");
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', tc("بوابة دخول الموظفين لنظام إدارة مكان الشيف البخاري", "Staff login gateway for مكان الشيف البخاري management system"));
  }, []);

  useEffect(() => {
    const gatewayPassed = localStorage.getItem("qirox-gateway-passed");
    if (gatewayPassed === "true") {
      setLocation("/employee/login");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.toLowerCase() === "c2030") {
      localStorage.setItem("qirox-gateway-passed", "true");
      setLocation("/employee/login");
    } else {
      setError(tc("كلمة المرور غير صحيحة", "Incorrect password"));
      setPassword("");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 font-playfair">مكان الشيف البخاري</h1>
          <p className="text-muted-foreground font-cairo">{tc("بوابة الموظفين", "Staff Portal")}</p>
        </div>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary font-playfair">
              {tc("دخول الموظفين", "Staff Access")}
            </CardTitle>
            <CardDescription className="text-center font-cairo">
              {tc("أدخل كلمة المرور العامة للوصول", "Enter the access password to continue")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={tc("كلمة المرور العامة", "Access password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 text-right bg-white border-gray-300"
                    data-testid="input-gateway-password"
                    autoFocus
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
                {error && (
                  <p className="text-destructive text-sm text-right" data-testid="text-error">
                    {error}
                  </p>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                data-testid="button-gateway-submit"
              >
                {tc("دخول", "Enter")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="text-primary hover:text-primary/80"
            data-testid="link-back-home"
          >
            {tc("العودة للصفحة الرئيسية", "Back to Home")}
          </Button>
        </div>
      </div>
    </div>
  );
}
