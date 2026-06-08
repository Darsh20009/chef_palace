import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AtSign, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import type { Employee } from "@shared/schema";
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";
import { useTranslate } from "@/lib/useTranslate";

export default function ManagerLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const tc = useTranslate();

  // Auto-redirect if already logged in
  useState(() => {
    const stored = localStorage.getItem("currentEmployee");
    if (stored) {
      try {
        const emp = JSON.parse(stored);
        const managerRoles = ["admin", "owner", "manager", "branch_manager"];
        if (managerRoles.includes(emp.role)) {
          if (emp.role === "admin") setLocation("/admin/dashboard");
          else if (emp.role === "owner") setLocation("/owner/dashboard");
          else setLocation("/manager/dashboard");
        }
      } catch {}
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch("/api/employees/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      return response.json() as Promise<Employee>;
    },
    onSuccess: (employee: any) => {
      const managerRoles = ["admin", "owner", "manager", "branch_manager"];
      if (!managerRoles.includes(employee.role)) {
        setError(tc("هذا الحساب ليس حساب مدير", "This account does not have manager access"));
        setPassword("");
        return;
      }

      if (employee.restoreKey) {
        localStorage.setItem("qirox-restore-key", employee.restoreKey);
        delete employee.restoreKey;
      }
      localStorage.setItem("currentEmployee", JSON.stringify(employee));

      if (employee.role === "admin") {
        setLocation("/admin/dashboard");
      } else if (employee.role === "owner") {
        setLocation("/owner/dashboard");
      } else {
        setLocation("/manager/dashboard");
      }
    },
    onError: () => {
      setError(tc("اسم المستخدم أو كلمة المرور غير صحيحة", "Invalid username or password"));
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

    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center justify-center w-20 h-14 sm:w-32 sm:h-20 mb-2 sm:mb-3">
            <img src={qiroxLogoStaff} alt="مكان الشيف — الإدارة" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-playfair text-foreground mb-1">مكان الشيف البخاري</h1>
          <p className="text-muted-foreground text-sm font-cairo">{tc("تسجيل دخول المدير", "Manager Login")}</p>
        </div>

        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl text-center font-playfair text-foreground">
              {tc("لوحة تحكم المدير", "Manager Dashboard")}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {tc("أدخل بيانات حساب المدير للوصول", "Enter your manager credentials to access")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <AtSign className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={tc("اسم المستخدم أو البريد الإلكتروني", "Username or Email")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10"
                    data-testid="input-username"
                    autoComplete="username email"
                    autoFocus
                    disabled={loginMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={tc("كلمة المرور", "Password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10"
                    data-testid="input-password"
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLocation("/manager/forgot-password")}
                    className="text-xs text-primary hover:text-primary/80 underline"
                    data-testid="link-forgot-password"
                  >
                    {tc("نسيت كلمة المرور؟", "Forgot password?")}
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
                disabled={loginMutation.isPending}
                className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground font-semibold"
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    {tc("جاري تسجيل الدخول...", "Signing in...")}
                  </>
                ) : (
                  tc("دخول", "Sign In")
                )}
              </Button>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground text-center mb-2">{tc("موظف عادي؟", "Regular employee?")}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/employee/login")}
                  className="w-full"
                  data-testid="button-employee-login"
                >
                  {tc("تسجيل دخول الموظف", "Employee Login")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="link-back"
          >
            {tc("رجوع", "Back")}
          </Button>
        </div>
      </div>
    </div>
  );
}
