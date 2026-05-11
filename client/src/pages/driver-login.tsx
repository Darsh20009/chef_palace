import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Truck, Phone, ArrowLeft } from "lucide-react";
const chefsplaceLogoStaff = "/logo.png";
import { useTranslate } from "@/lib/useTranslate";

export default function DriverLogin() {
  const [, setLocation] = useLocation();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const tc = useTranslate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast({ title: tc("خطأ", "Error"), description: tc("يرجى إدخال رقم الجوال", "Please enter your phone number"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/delivery/drivers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || tc("فشل تسجيل الدخول", "Login failed"));
      }

      localStorage.setItem("currentDriver", JSON.stringify(data.driver));
      toast({ title: tc("مرحباً", "Welcome"), description: `${tc("أهلاً", "Hello")} ${data.driver.fullName}` });
      setLocation("/driver/portal");
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل تسجيل الدخول", "Login failed"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري" className="w-14 h-14 object-contain rounded-xl" />
          </div>
          <div className="w-14 h-14 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Truck className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">{tc("بوابة المندوب", "Driver Portal")}</CardTitle>
          <CardDescription>{tc("سجل دخولك لإدارة طلبات التوصيل", "Sign in to manage your delivery orders")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{tc("رقم الجوال", "Phone Number")}</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pr-10 text-left"
                  dir="ltr"
                  data-testid="input-phone"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? tc("جاري الدخول...", "Signing in...") : tc("تسجيل الدخول", "Sign In")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 ml-2" />
              {tc("العودة للرئيسية", "Back to Home")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
