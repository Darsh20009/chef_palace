import { useState, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { useCustomer } from "@/contexts/CustomerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";
import CardCustomizer, { CARD_DESIGNS, type CardDesign } from "@/components/card-customizer";
import { customerStorage } from "@/lib/customer-storage";

export default function CardCustomizationPage() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const { customer, isAuthenticated } = useCustomer();
  const [selectedDesign, setSelectedDesign] = useState<CardDesign | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    // Load saved design preference
    const savedDesign = customerStorage.getCardDesign();
    if (savedDesign) {
      const designObj = CARD_DESIGNS.find(d => d.id === savedDesign.designId);
      if (designObj) {
        setSelectedDesign(designObj);
      }
    } else {
      setSelectedDesign(CARD_DESIGNS[0]);
    }
  }, [isAuthenticated, navigate]);

  const handleSaveDesign = async (design: CardDesign) => {
    setIsSaving(true);
    try {
      // Save to local storage
      customerStorage.setCardDesign({
        designId: design.id,
        name: design.name,
        colors: design.colors,
        preview: design.preview
      });

      setSelectedDesign(design);

      // Show success message
      const event = new CustomEvent('toast', {
        detail: {
          title: tc('تم الحفظ بنجاح!', 'Saved Successfully!'),
          description: tc("تم حفظ التصميم", "Design saved"),
          duration: 3000
        }
      });
      window.dispatchEvent(event);

      // Navigate back after a short delay
      setTimeout(() => {
        navigate("/loyalty");
      }, 1500);
    } catch (error) {
      console.error('Error saving design:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{tc("تخصيص بطاقتك", "Customize Your Card")}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/my-card")}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative group animate-in fade-in-0 slide-in-from-top-10 duration-500">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
          <div className="relative bg-gradient-to-br from-primary/5 via-background to-background backdrop-blur-sm rounded-2xl p-8 border-2 border-primary/50 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary rounded-full text-primary-foreground shadow-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-accent mb-2">
                  اختر تصميم بطاقتك المفضل
                </h2>
                <p className="text-accent">
                  اختر من بين 8 تصاميم فريدة تعكس شخصيتك وتفضلاتك. يمكنك تغيير التصميم في أي وقت.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customizer Section */}
        <Card className="border-border shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              اختر التصميم
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <CardCustomizer
              selectedDesign={selectedDesign?.id}
              onDesignSelect={setSelectedDesign}
              customerName={customer.name}
              customerPhone={customer.phone}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/my-card")}
            className="text-base"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            الرجوع
          </Button>
          <Button
            onClick={() => selectedDesign && handleSaveDesign(selectedDesign)}
            disabled={isSaving || !selectedDesign}
            className="text-base"
          >
            {isSaving ? tc('جاري الحفظ...', 'Saving...') : tc('حفظ التصميم', 'Save Design')}
          </Button>
        </div>

        {/* Tips Section */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-900 mb-3">{tc("نصائح:", "Tips:")}</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>{tc("✓ اختر التصميم الذي يناسبك من القائمة", "✓ Choose a design that suits you from the list")}</li>
              <li>{tc("✓ انظر المعاينة لترى كيف ستبدو بطاقتك", "✓ View the preview to see how your card will look")}</li>
              <li>{tc("✓ يمكنك تغيير التصميم في أي وقت من هنا", "✓ You can change the design anytime from here")}</li>
              <li>{tc("✓ تصاميمك محفوظة على جهازك بشكل آمن", "✓ Your designs are saved securely on your device")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
