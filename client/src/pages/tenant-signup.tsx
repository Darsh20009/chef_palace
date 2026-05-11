import { useState } from "react";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertCircle, Loader } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SarIcon from "@/components/sar-icon";
const chefsplaceLogo = "/logo.png";

const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    nameAr: tc("مجاني", "Free"),
    nameEn: "Free",
    price: "0",
    features: [tc("فرع واحد", "One Branch"), tc("100 طلب/شهر", "100 orders/month"), tc("بدون دعم", "No support")]
  },
  {
    id: "starter",
    nameAr: tc("مبتدئ", "Starter"),
    nameEn: "Starter",
    price: "299",
    features: [tc("فرعين", "2 Branches"), tc("1000 طلب/شهر", "1000 orders/month"), tc("بريد إلكتروني", "Email support")]
  },
  {
    id: "professional",
    nameAr: tc("احترافي", "Professional"),
    nameEn: "Professional",
    price: "999",
    features: [tc("5 فروع", "5 Branches"), tc("طلبات غير محدودة", "Unlimited orders"), tc("دعم كامل", "Full support")]
  },
  {
    id: "enterprise",
    nameAr: "enterprise",
    nameEn: "Enterprise",
    price: tc("يتم تحديده", "Custom"),
    features: [tc("فروع غير محدودة", "Unlimited branches"), tc("مميزات مخصصة", "Custom features"), tc("حساب مخصص", "Dedicated account")]
  }
];

export default function TenantSignup() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("professional");

  const [formData, setFormData] = useState({
    nameAr: "",
    nameEn: "",
    email: "",
    phone: "",
    plan: "professional",
    contactPersonAr: "",
    contactPersonEn: "",
    notes: ""
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.nameAr.trim()) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء إدخال اسم المتجر بالعربية", "Please enter the store name in Arabic"),
        variant: "destructive"
      });
      return;
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء إدخال بريد إلكتروني صحيح", "Please enter a valid email address"),
        variant: "destructive"
      });
      return;
    }

    if (!formData.phone.trim()) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء إدخال رقم الهاتف", "Please enter phone number"),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const tenantData = {
        nameAr: formData.nameAr,
        nameEn: formData.nameEn || formData.nameAr,
        type: "client",
        status: "active",
        subscription: {
          plan: formData.plan,
          status: "active",
          startDate: new Date(),
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        billing: {
          email: formData.email,
          phone: formData.phone,
          contactPersonAr: formData.contactPersonAr,
          contactPersonEn: formData.contactPersonEn,
          notes: formData.notes
        },
        features: {
          inventoryTracking: selectedPlan !== "free",
          loyaltyProgram: ["professional", "enterprise"].includes(selectedPlan),
          zatca: ["professional", "enterprise"].includes(selectedPlan),
          analytics: ["professional", "enterprise"].includes(selectedPlan),
          customTheme: selectedPlan === "enterprise"
        }
      };

      const response = await apiRequest("POST", "/api/admin/tenants", tenantData);
      const tenant = await response.json();

      setSuccess(true);
      toast({
        title: tc("تم الإنشاء بنجاح!", "Created Successfully!"),
        description: `تم إنشاء متجرك "${formData.nameAr}" بنجاح`
      });

      // Show success for 2 seconds then redirect
      setTimeout(() => {
        navigate("/");
      }, 2000);

    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("حدث خطأ أثناء إنشاء المتجر", "An error occurred while creating the store"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground dark:text-foreground mb-2">
              تم الإنشاء بنجاح!
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground mb-6">
              جاري إعادة التوجيه إلى الصفحة الرئيسية...
            </p>
            <Loader className="w-6 h-6 animate-spin text-accent mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="w-16 h-16 object-contain rounded-xl" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            انضم إلى مكان الشيف البخاري
          </h1>
          <p className="text-muted-foreground text-lg">
            أكمل البيانات الخاصة بمتجرك لبدء رحلتك مع نظام إدارة المقاهي الأفضل
          </p>
        </div>

        {/* Main Form */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <CardTitle>{tc("بيانات المتجر", "Store Details")}</CardTitle>
            <CardDescription>{tc("أدخل معلومات متجرك والخطة المناسبة لك", "Enter your store information and suitable plan")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Names */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nameAr" className="block mb-2 font-semibold">
                    اسم المتجر (عربي) *
                  </Label>
                  <Input
                    id="nameAr"
                    placeholder="مثال: مكان الشيف البخاري"
                    value={formData.nameAr}
                    onChange={(e) => handleInputChange("nameAr", e.target.value)}
                    className="text-right"
                    data-testid="input-business-name-ar"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="nameEn" className="block mb-2 font-semibold">
                    اسم المتجر (English)
                  </Label>
                  <Input
                    id="nameEn"
                    placeholder="e.g., Oasis Coffee"
                    value={formData.nameEn}
                    onChange={(e) => handleInputChange("nameEn", e.target.value)}
                    className="text-left"
                    data-testid="input-business-name-en"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="block mb-2 font-semibold">
                    البريد الإلكتروني *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    data-testid="input-email"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="block mb-2 font-semibold">
                    رقم الهاتف *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+966 50 xxx xxxx"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    data-testid="input-phone"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Contact Person */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPersonAr" className="block mb-2 font-semibold">
                    اسم جهة الاتصال (عربي)
                  </Label>
                  <Input
                    id="contactPersonAr"
                    placeholder="الاسم الكامل"
                    value={formData.contactPersonAr}
                    onChange={(e) => handleInputChange("contactPersonAr", e.target.value)}
                    className="text-right"
                    data-testid="input-contact-person-ar"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPersonEn" className="block mb-2 font-semibold">
                    جهة الاتصال (English)
                  </Label>
                  <Input
                    id="contactPersonEn"
                    placeholder="Full Name"
                    value={formData.contactPersonEn}
                    onChange={(e) => handleInputChange("contactPersonEn", e.target.value)}
                    className="text-left"
                    data-testid="input-contact-person-en"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Subscription Plan */}
              <div>
                <Label htmlFor="plan" className="block mb-4 font-semibold">
                  اختر الخطة المناسبة *
                </Label>
                <Select value={selectedPlan} onValueChange={(value) => {
                  setSelectedPlan(value);
                  handleInputChange("plan", value);
                }}>
                  <SelectTrigger data-testid="select-plan" disabled={loading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTION_PLANS.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex gap-2">
                          <span>{plan.nameAr}</span>
                          <span className="text-gray-500">({plan.nameEn})</span>
                          <span className="text-accent font-semibold">{plan.price} <SarIcon /></span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Plan Features */}
              {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan) && (
                <div className="bg-background dark:bg-card p-4 rounded-lg">
                  <h3 className="font-semibold text-foreground dark:text-foreground mb-3">
                    مميزات الخطة:
                  </h3>
                  <ul className="space-y-2">
                    {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="block mb-2 font-semibold">
                  ملاحظات إضافية
                </Label>
                <Textarea
                  id="notes"
                  placeholder="أي معلومات إضافية تود أن تخبرنا بها..."
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  className="text-right resize-none"
                  data-testid="textarea-notes"
                  disabled={loading}
                  rows={4}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary text-white font-bold py-3 text-lg"
                disabled={loading}
                data-testid="button-submit-signup"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    جاري الإنشاء...
                  </div>
                ) : (
                  "إنشاء متجري الآن"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white dark:bg-card">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-accent mb-2">100%</div>
              <p className="text-muted-foreground dark:text-muted-foreground">بدء فوري بدون انتظار</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-card">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-accent mb-2">24/7</div>
              <p className="text-muted-foreground dark:text-muted-foreground">دعم عملاء متواصل</p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-card">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-accent mb-2">∞</div>
              <p className="text-muted-foreground dark:text-muted-foreground">قابل للتوسع بلا حدود</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
