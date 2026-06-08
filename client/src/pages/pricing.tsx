import { useState } from "react";
import { useLocation } from "wouter";
import SarIcon from "@/components/sar-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check, X, ArrowLeft, Zap, Crown, Infinity,
  Coffee, Users, BarChart3, Globe, Shield, Headphones,
  Smartphone, ChefHat, Star
} from "lucide-react";
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";

const tc = (ar: string, en: string) => ar;

const plans = [
  {
    id: "lite",
    nameAr: "لايت",
    nameEn: "Lite",
    priceMonthly: 499,
    priceYearly: 4490,
    icon: Zap,
    color: "#3b82f6",
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-200 dark:border-blue-800",
    badge: null,
    descriptionAr: "مثالي للكافيهات الناشئة والمشاريع الصغيرة",
    descriptionEn: "Perfect for startups and small cafes",
    features: [
      { label: "1 فرع", included: true },
      { label: "5 موظفين", included: true },
      { label: "نقاط البيع POS", included: true },
      { label: "إدارة الطلبات", included: true },
      { label: "قائمة رقمية", included: true },
      { label: "تقارير أساسية", included: true },
      { label: "KDS شاشة المطبخ", included: false },
      { label: "برنامج الولاء", included: false },
      { label: "طلبات التطبيق", included: false },
      { label: "ZATCA / فاتورة", included: false },
      { label: "تعدد الفروع", included: false },
      { label: "API للتكامل", included: false },
    ]
  },
  {
    id: "pro",
    nameAr: "برو",
    nameEn: "Pro",
    priceMonthly: 1499,
    priceYearly: 13490,
    icon: Crown,
    color: "#2D9B6E",
    gradient: "from-emerald-500/15 to-emerald-500/5",
    border: "border-emerald-300 dark:border-emerald-700",
    badge: "الأكثر شعبية",
    descriptionAr: "الأنسب للكافيهات المتنامية والسلاسل الصغيرة",
    descriptionEn: "Best for growing cafes and small chains",
    features: [
      { label: "3 فروع", included: true },
      { label: "20 موظفاً", included: true },
      { label: "نقاط البيع POS", included: true },
      { label: "إدارة الطلبات", included: true },
      { label: "قائمة رقمية", included: true },
      { label: "تقارير متقدمة", included: true },
      { label: "KDS شاشة المطبخ", included: true },
      { label: "برنامج الولاء", included: true },
      { label: "طلبات التطبيق", included: true },
      { label: "ZATCA / فاتورة", included: true },
      { label: "تعدد الفروع", included: false },
      { label: "API للتكامل", included: false },
    ]
  },
  {
    id: "infinity",
    nameAr: "إنفينيتي",
    nameEn: "Infinity",
    priceMonthly: 3999,
    priceYearly: 35990,
    icon: Infinity,
    color: "#8b5cf6",
    gradient: "from-violet-500/10 to-violet-500/5",
    border: "border-violet-200 dark:border-violet-800",
    badge: "الأفضل للسلاسل",
    descriptionAr: "للسلاسل الكبيرة والمشاريع المؤسسية",
    descriptionEn: "For large chains and enterprise projects",
    features: [
      { label: "فروع غير محدودة", included: true },
      { label: "موظفون غير محدودون", included: true },
      { label: "نقاط البيع POS", included: true },
      { label: "إدارة الطلبات", included: true },
      { label: "قائمة رقمية", included: true },
      { label: "تقارير + ذكاء اصطناعي", included: true },
      { label: "KDS شاشة المطبخ", included: true },
      { label: "برنامج الولاء المتقدم", included: true },
      { label: "طلبات التطبيق", included: true },
      { label: "ZATCA / فاتورة إلكترونية", included: true },
      { label: "تعدد الفروع", included: true },
      { label: "API للتكامل", included: true },
    ]
  }
];

const highlights = [
  { icon: Coffee, label: "نظام POS احترافي", color: "#2D9B6E" },
  { icon: BarChart3, label: "تقارير وتحليلات", color: "#3b82f6" },
  { icon: Smartphone, label: "تطبيق موبايل", color: "#f59e0b" },
  { icon: Globe, label: "طلبات أونلاين", color: "#ec4899" },
  { icon: Shield, label: "ZATCA معتمد", color: "#8b5cf6" },
  { icon: Headphones, label: "دعم فني 24/7", color: "#06b6d4" },
  { icon: ChefHat, label: "شاشة المطبخ KDS", color: "#ef4444" },
  { icon: Users, label: "إدارة الفريق", color: "#14b8a6" },
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/3 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={qiroxLogoStaff} alt="مكان الشيف" className="h-10 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 ml-1" />
              {tc("الرئيسية", "Home")}
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={() => navigate("/manager/login")}>
              {tc("تسجيل الدخول", "Login")}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="text-primary border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium">
            <Star className="w-3.5 h-3.5 ml-1 fill-primary" />
            {tc("خطط التسعير", "Pricing Plans")}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            {tc("اختر الخطة المناسبة", "Choose Your Plan")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {tc(
              "أسعار شفافة بدون رسوم خفية. جميع الخطط تشمل تحديثات مجانية ودعم فني متكامل.",
              "Transparent pricing with no hidden fees. All plans include free updates and full support."
            )}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {tc("شهري", "Monthly")}
            </span>
            <button
              onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${billing === 'yearly' ? 'right-0.5' : 'left-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${billing === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {tc("سنوي", "Yearly")}
              <Badge className="mr-2 text-xs bg-emerald-100 text-emerald-700 border-0">{tc("وفر 25%", "Save 25%")}</Badge>
            </span>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const Icon = plan.icon;
            const price = billing === 'monthly' ? plan.priceMonthly : Math.round(plan.priceYearly / 12);
            const isPro = plan.id === 'pro';
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 flex flex-col bg-gradient-to-b ${plan.gradient} ${plan.border} ${isPro ? 'scale-105 shadow-xl' : 'shadow-md'} transition-all hover:shadow-lg`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 right-1/2 translate-x-1/2">
                    <Badge className="text-xs px-3 py-1" style={{ background: plan.color, color: '#fff', border: 'none' }}>
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{plan.nameAr}</h3>
                      <p className="text-xs text-muted-foreground">{plan.nameEn}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">{plan.descriptionAr}</p>

                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-foreground">{price.toLocaleString('ar')}</span>
                    <div className="pb-1">
                      <SarIcon size={12} />
                      <p className="text-xs text-muted-foreground">{tc("/ شهرياً", "/ month")}</p>
                    </div>
                  </div>
                  {billing === 'yearly' && (
                    <p className="text-xs text-muted-foreground">
                      {tc(`${plan.priceYearly.toLocaleString('ar')} ر.س سنوياً`, `${plan.priceYearly.toLocaleString()} SAR/year`)}
                    </p>
                  )}
                </div>

                <Button
                  className="w-full mb-6 font-semibold"
                  style={isPro ? { background: plan.color, color: '#fff' } : {}}
                  variant={isPro ? "default" : "outline"}
                  onClick={() => navigate("/manager/login")}
                >
                  {tc("ابدأ الآن", "Get Started")}
                </Button>

                <div className="space-y-2.5 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: plan.color }} />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-foreground' : 'text-muted-foreground/60 line-through'}>
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Highlights */}
        <div className="text-center space-y-8">
          <h2 className="text-2xl font-bold text-foreground">{tc("كل ما تحتاجه لإدارة كافيهك", "Everything You Need")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {highlights.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${h.color}15` }}>
                  <h.icon className="w-6 h-6" style={{ color: h.color }} />
                </div>
                <p className="text-sm font-medium text-foreground text-center">{h.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ / Contact */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">{tc("هل تحتاج مساعدة في الاختيار؟", "Need Help Choosing?")}</h2>
          <p className="text-muted-foreground">
            {tc(
              "فريقنا جاهز لمساعدتك في اختيار الخطة الأنسب لاحتياجات كافيهك.",
              "Our team is ready to help you choose the best plan for your cafe."
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => navigate("/manager/support")}>
              {tc("تواصل معنا", "Contact Us")}
            </Button>
            <Button variant="outline" onClick={() => navigate("/manager/login")}>
              {tc("جرّب مجاناً", "Try Free")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {tc("لا يلزم بطاقة ائتمانية • 14 يوم تجربة مجانية", "No credit card required • 14-day free trial")}
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 text-center text-sm text-muted-foreground">
        <p>© 2025 مكان الشيف — الإدارة — {tc("جميع الحقوق محفوظة", "All rights reserved")}</p>
      </footer>
    </div>
  );
}
