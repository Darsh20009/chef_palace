import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Phone, Zap, Star, ChevronRight } from "lucide-react";
import chefsplaceLogo from "@assets/blackrose-logo.png";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";
import { useTranslate } from "@/lib/useTranslate";

type Mode = 'choice' | 'quick';

export default function CustomerLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [mode, setMode] = useState<Mode>('choice');
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tc("مكان الشيف البخاري — ادخل الآن", "مكان الشيف البخاري — Enter Now");
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', tc('تسجيل دخول عملاء مكان الشيف البخاري — سجّل أو اطلب بسرعة', 'مكان الشيف البخاري customer login — sign up or order quickly'));
  }, [tc]);

  const handleQuickOrder = () => {
    const trimName = name.trim();
    const trimPhone = phone.trim().replace(/\s/g, '');

    if (!trimName || trimName.length < 2) {
      toast({ variant: "destructive", title: tc("الاسم مطلوب", "Name Required"), description: tc("أدخل اسمك (حرفان على الأقل)", "Enter your name (at least 2 characters)") });
      return;
    }
    if (!trimPhone || trimPhone.length !== 9 || !trimPhone.startsWith('5')) {
      toast({ variant: "destructive", title: tc("رقم الجوال غير صحيح", "Invalid Phone"), description: tc("أدخل 9 أرقام تبدأ بـ 5", "Enter 9 digits starting with 5") });
      return;
    }

    setLoading(true);
    customerStorage.setGuestInfo(trimName, trimPhone);
    customerStorage.setGuestMode(true);
    toast({ title: tc("أهلاً ", "Welcome ") + trimName, description: tc("اختر وجبتك وأكمل الطلب", "Choose your meal and complete your order") });
    setLocation("/menu");
  };

  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-2 mb-2">
            <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="h-16 object-contain" />
            <h1 className="text-3xl font-bold font-playfair text-foreground">مكان الشيف البخاري</h1>
          </div>
          <p className="text-muted-foreground text-lg font-cairo">{tc("لكل وجبة بخاري، لحظة نجاح", "For every coffee moment, a moment of success")}</p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <Card className="bg-card border-border/50 backdrop-blur shadow-lg">
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-2xl text-foreground font-playfair">{tc("مرحباً بك", "Welcome")}</CardTitle>
              <CardDescription className="text-muted-foreground">{tc("اختر طريقة المتابعة", "Choose how to continue")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full h-14 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground text-base font-semibold"
                data-testid="button-login"
              >
                <User className="ml-2 w-5 h-5" />
                <div className="text-right flex-1">
                  <div>{tc("تسجيل الدخول / حساب جديد", "Login / New Account")}</div>
                  <div className="text-xs opacity-80 font-normal">{tc("احصل على بطاقة ولاء ونقاط مكافآت", "Get a loyalty card and reward points")}</div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-60" />
              </Button>

              <div className="relative flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{tc("أو", "or")}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button
                onClick={() => setMode('quick')}
                variant="outline"
                className="w-full h-14 border-primary/30 text-foreground hover:bg-primary/5 text-base"
                data-testid="button-quick-order"
              >
                <Zap className="ml-2 w-5 h-5 text-accent" />
                <div className="text-right flex-1">
                  <div>{tc("طلب سريع بدون تسجيل", "Quick Order Without Registration")}</div>
                  <div className="text-xs text-muted-foreground font-normal">{tc("اسمك ورقمك فقط • الدفع بالبطاقة", "Name & phone only • Card payment")}</div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 text-center">
            <Star className="w-4 h-4 text-accent" />
            <p className="text-muted-foreground text-sm font-cairo">
              {tc("التسجيل يتيح لك: بطاقة ولاء • نقاط مكافآت • متابعة طلباتك", "Registration gives you: loyalty card • reward points • order tracking")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex flex-col items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md bg-card border-border/50 backdrop-blur shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-7 h-7 text-accent" />
            <CardTitle className="text-2xl text-foreground font-playfair">{tc("طلب سريع", "Quick Order")}</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            {tc("أدخل اسمك ورقمك لمتابعة الطلب", "Enter your name and number to continue")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="quick-name" className="text-foreground mb-1.5 block">{tc("الاسم", "Name")}</Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="quick-name"
                type="text"
                placeholder={tc("اسمك الكريم", "Your name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickOrder()}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 pr-10"
                data-testid="input-quick-name"
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label htmlFor="quick-phone" className="text-foreground mb-1.5 block">{tc("رقم الجوال (9 أرقام تبدأ بـ 5)", "Mobile number (9 digits starting with 5)")}</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">+966</div>
              <Input
                id="quick-phone"
                type="tel"
                placeholder="5xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickOrder()}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 pr-10 pl-14"
                data-testid="input-quick-phone"
              />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-0.5">{tc("ملاحظة", "Note")}</p>
            <p>{tc("الطلب السريع لا يشمل نقاط الولاء. يمكنك التسجيل لاحقاً بنفس رقم الجوال وسيتم ربط طلباتك تلقائياً.", "Quick orders don't include loyalty points. You can register later with the same number and your orders will be linked automatically.")}</p>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              onClick={handleQuickOrder}
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground font-semibold"
              data-testid="button-confirm-quick"
            >
              <Zap className="w-4 h-4 ml-2" />
              {tc("متابعة للقائمة", "Continue to Menu")}
            </Button>

            <Button
              onClick={() => setMode('choice')}
              variant="ghost"
              className="w-full text-foreground/70 hover:text-foreground hover:bg-primary/10"
              data-testid="button-back-quick"
            >
              {tc("رجوع", "Back")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
