import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, CreditCard, University, Zap, Building, Banknote, Gift, Truck, Plus, Phone, Search, Coffee, Check, Clock } from "lucide-react";
import type { PaymentMethodInfo, PaymentMethod } from "@shared/schema";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useLoyaltyCard } from "@/hooks/useLoyaltyCard";
import { brand } from "@/lib/brand";
import { useTranslate } from "@/lib/useTranslate";

// Payment methods temporarily disabled — coming soon
const COMING_SOON_METHODS = ['neoleap', 'neoleap-apple-pay'];

// Detect Apple device (iPhone, iPad, Mac + Safari)
const isAppleDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) &&
    (/Safari/i.test(navigator.userAgent) || (window as any).ApplePaySession !== undefined);
};

interface PaymentMethodsProps {
 paymentMethods: PaymentMethodInfo[];
 selectedMethod: PaymentMethod | null;
 onSelectMethod: (method: PaymentMethod) => void;
 customerPhone?: string;
 loyaltyCard?: any;
 comingSoon?: boolean;
}

export default function PaymentMethods({
 paymentMethods,
 selectedMethod,
 onSelectMethod,
 customerPhone: propCustomerPhone,
 loyaltyCard: initialLoyaltyCard,
 comingSoon = false,
}: PaymentMethodsProps) {
 const { toast } = useToast();
 const tc = useTranslate();
  const [cardMode, setCardMode] = useState<'use' | 'add' | null>(null);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchCardNumber, setSearchCardNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const { card: autoCard, updateCardInCache } = useLoyaltyCard(propCustomerPhone);
  
  const foundCard = autoCard || initialLoyaltyCard;

  useEffect(() => {
    if (foundCard && cardMode === null) {
      setCardMode('use');
    }
  }, [foundCard, cardMode]);

 const getIcon = (iconName: string) => {
  switch (iconName) {
  case 'fas fa-gift':
  return <Gift className="w-6 h-6 text-primary" />;
  case 'fas fa-money-bill-wave':
  return <Banknote className="w-6 h-6 text-primary" />;
  case 'fas fa-truck':
  return <Truck className="w-6 h-6 text-primary" />;
  case 'fas fa-mobile-alt':
  return <Smartphone className="w-6 h-6 text-primary" />;
  case 'fas fa-credit-card':
  return <CreditCard className="w-6 h-6 text-primary" />;
  case 'fas fa-university':
  return <University className="w-6 h-6 text-primary" />;
  case 'fas fa-bolt':
  return <Zap className="w-6 h-6 text-primary" />;
  case 'fas fa-building-columns':
  return <Building className="w-6 h-6 text-primary" />;
  default:
  return <CreditCard className="w-6 h-6 text-primary" />;
  }
 };

 const handleSearchCard = async () => {
  if (!searchPhone && !searchCardNumber) {
   toast({
    variant: "destructive",
    title: tc("خطأ", "Error"),
    description: tc("يرجى إدخال رقم الجوال أو رقم البطاقة", "Please enter phone or card number"),
   });
   return;
  }

  setIsSearching(true);
  try {
   let url = "";
   if (searchPhone) {
    url = `/api/loyalty/cards/phone/${searchPhone}`;
   } else {
    url = `/api/loyalty/cards/number/${searchCardNumber}`;
   }

   const res = await fetch(url);
   if (!res.ok) throw new Error(tc("البطاقة غير موجودة", "Card not found"));
   const cardData = await res.json();
   updateCardInCache(cardData);
   setIsAddingCard(false);
   setCardMode('use');
   toast({
    title: tc("تم العثور على البطاقة", "Card found"),
    description: `${tc("أهلاً", "Welcome")} ${cardData.customerName || tc('عميلنا العزيز', 'Valued Customer')}`,
   });
  } catch (error) {
   toast({
    variant: "destructive",
    title: tc("خطأ", "Error"),
    description: tc("لم يتم العثور على بطاقة مرتبطة بهذه البيانات", "No card found with this information"),
   });
  } finally {
   setIsSearching(false);
  }
 };

 if (comingSoon) {
   return (
     <div className="space-y-4" data-testid="section-payment-methods">
       <h3 className="text-lg font-semibold text-foreground mb-4">{tc("اختر طريقة الدفع", "Choose Payment Method")}</h3>
       <div className="relative rounded-2xl overflow-hidden border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40">
         <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white/70 dark:bg-black/60 backdrop-blur-sm">
           <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 shadow-md">
             <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
           </div>
           <div className="text-center space-y-1 px-4">
             <p className="font-bold text-amber-800 dark:text-amber-300 text-base">{tc("خيارات الدفع قريباً", "Payment options coming soon")}</p>
             <p className="text-xs text-amber-600/80 dark:text-amber-400/70">{tc("سيتم تفعيل طرق الدفع في إصدار قادم", "Payment methods will be enabled in a future release")}</p>
           </div>
           <span className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
             <Clock className="w-3.5 h-3.5" />
             {tc("قريباً", "Coming Soon")}
           </span>
         </div>
         <div className="opacity-20 pointer-events-none select-none space-y-3 p-4">
           {paymentMethods.slice(0, 3).map((method) => (
             <Card key={method.id} className="rounded-2xl border-border/30 bg-white/50">
               <CardContent className="p-4">
                 <div className="flex items-center gap-3">
                   <div className="p-2.5 rounded-xl bg-muted">
                     <CreditCard className="w-5 h-5 text-muted-foreground" />
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-sm text-foreground">{method.nameAr}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">{method.details}</p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       </div>
     </div>
   );
 }

 return (
   <div className="space-y-4" data-testid="section-payment-methods">
     <h3 className="text-lg font-semibold text-foreground mb-4">{tc("اختر طريقة الدفع", "Choose Payment Method")}</h3>
     <div className="space-y-4">
     {paymentMethods.map((method) => {
    const isQahwaCard = (method.id as string) === 'qahwa-card';
    const isNeoLeap = (method.id as string) === 'neoleap';
    const isApplePay = (method.id as string) === 'apple_pay' || (method.id as string) === 'neoleap-apple-pay';
    const isStcPay = (method.id as string) === 'stc-pay';
    const isLoyaltyCard = (method.id as string) === 'loyalty-card';
    const isSelected = selectedMethod === method.id;
    const isComingSoon = COMING_SOON_METHODS.includes(method.id as string);

    // Filter for POS: Only Cash, Network (pos), and Qirox Card (qahwa-card)
    const allowedPosMethods = ['cash', 'pos', 'qahwa-card'];
    const isPosRoute = window.location.pathname.includes('/employee/pos');
    if (isPosRoute && !allowedPosMethods.includes(method.id as string)) {
      return null;
    }

    if (isLoyaltyCard) return null; // Always hide loyalty card from customer checkout

    // Filter custom methods by enabledForCustomer
    if ((method as any).isCustom && (method as any).enabledForCustomer === false) return null;

    // Hide mobile wallet (paymob-wallet) — not used in SA flow
    if ((method.id as string) === 'paymob-wallet') return null;

    const isPaymobApplePay = (method.id as string) === 'paymob-apple-pay';
    // Hide ALL Apple Pay variants on non-Apple devices
    if ((isApplePay || isPaymobApplePay) && !isAppleDevice()) return null;

    // Coming Soon: show disabled card with badge
    if (isComingSoon) {
      return (
        <div key={method.id} className="relative">
          <Card className="border-border/30 bg-muted/30 rounded-2xl overflow-hidden opacity-60 cursor-not-allowed select-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                  {isApplePay
                    ? <Smartphone className="w-6 h-6" />
                    : <CreditCard className="w-6 h-6" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-muted-foreground">{method.nameAr}</h4>
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                      <Clock className="w-3 h-3" />
                      {tc("قريباً", "Soon")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isApplePay ? tc("سيتوفر Apple Pay قريباً", "Apple Pay coming soon") : tc("الدفع بالبطاقة سيكون متاحاً قريباً", "Card payment coming soon")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // PayMob Apple Pay — official Apple Pay button design, visible on all devices
    if (isPaymobApplePay) {
      return (
        <div key={method.id}>
          <div
            onClick={() => onSelectMethod(method.id)}
            data-testid={`payment-method-${method.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              height: "54px",
              borderRadius: "12px",
              background: "#000",
              cursor: "pointer",
              boxShadow: isSelected
                ? "0 0 0 3px #fff, 0 0 0 5px #000"
                : "0 2px 8px rgba(0,0,0,0.18)",
              transform: isSelected ? "scale(1.01)" : "scale(1)",
              transition: "all 0.15s ease",
              userSelect: "none",
            }}
          >
            {/* Official Apple logo SVG */}
            <svg
              viewBox="0 0 170 170"
              style={{ height: "22px", width: "22px", fill: "#fff", flexShrink: 0 }}
            >
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929 0.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.else21 7.045-28.143 3.687-6.52 8.594-11.672 14.73-15.466 6.136-3.294 12.759-5.277 19.88-5.375 3.906 0 9.022 1.211 15.366 3.597 6.326 2.394 10.387 3.605 12.172 3.605 1.331 0 5.838-1.419 13.49-4.247 7.23-2.618 13.326-3.701 18.31-3.273 13.54 1.093 23.71 6.43 30.52 16.05-12.1 7.33-18.09 17.6-17.96 30.78 0.12 10.26 3.83 18.79 11.12 25.55 3.31 3.14 7.01 5.57 11.12 7.29-0.89 2.58-1.83 5.05-2.83 7.42zM119.11 7.24c0 8.042-2.94 15.551-8.81 22.507-7.079 8.273-15.644 13.05-24.92 12.294-0.119-0.965-0.18-1.98-0.18-3.047 0-7.72 3.361-15.994 9.336-22.752 2.984-3.43 6.7718-6.2877 11.185-8.5773 4.4012-2.2554 8.5656-3.5023 12.4884-3.7113 0.12 1.0327 0.17 2.0654 0.17 3.0877z"/>
            </svg>
            {/* Official "Pay" text with Apple styling */}
            <span style={{
              color: "#fff",
              fontSize: "24px",
              fontWeight: 600,
              fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}>
              Pay
            </span>
          </div>
          {isSelected && (
            <p style={{ textAlign: "center", fontSize: "11px", color: "#888", marginTop: "6px" }}>
              {tc("سيتم تحويلك إلى بوابة الدفع الآمنة", "You will be redirected to the secure payment gateway")}
            </p>
          )}
        </div>
      );
    }

    // PayMob Card — "الدفع بالبطاقة" with Mada/Visa/Mastercard logos
    if ((method.id as string) === 'paymob-card') {
      return (
        <div key={method.id}>
          <Card
            className={`cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden ${isSelected ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : 'border-border/50 hover:border-primary/30 hover:bg-primary/5'}`}
            onClick={() => onSelectMethod(method.id)}
            data-testid={`payment-method-${method.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Card network logos replace the icon */}
                <div className="flex-shrink-0 rounded-xl bg-white p-1.5 flex items-center justify-center border border-border/30">
                  <img src="/card-logos.png" alt="مدى، فيزا، ماستر كارد" className="h-8 w-auto object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-foreground text-sm">{tc("الدفع بالبطاقة", "Card Payment")}</h4>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in duration-300 flex-shrink-0">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">مدى · فيزا · ماستر كارد</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Apple Pay
    if (isApplePay) {
      return (
        <div key={method.id}>
          <div
            className={`h-12 px-4 rounded-xl bg-[#1c1c1e] flex items-center gap-2 hover:bg-[#2c2c2e] transition-all duration-150 shadow-sm cursor-pointer ${isSelected ? 'ring-2 ring-white/40 scale-[1.01]' : ''}`}
            onClick={() => onSelectMethod(method.id)}
            data-testid={`payment-method-${method.id}`}
          >
            <svg viewBox="0 0 20 24" className="h-5 w-auto fill-white flex-shrink-0">
              <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z" />
            </svg>
            <span className="text-white font-semibold text-sm">Pay</span>
            {isSelected && (
              <div className="mr-auto w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      );
    }

    // STC Pay
    if (isStcPay) {
      return (
        <div key={method.id}>
          <Card
            className={`cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden ${isSelected ? 'ring-2 ring-primary shadow-md scale-[1.01] bg-primary/5 border-primary' : 'border-border/50 hover:border-primary/30 hover:bg-primary/5'}`}
            onClick={() => onSelectMethod(method.id)}
            data-testid={`payment-method-${method.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #6B1FA8, #3DBE7C)" }}>
                  <span className="text-white font-black text-xs tracking-tight">STC</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm">STC Pay</h4>
                  <p className="text-xs text-muted-foreground">{tc("الدفع عبر محفظة STC", "Pay via STC wallet")}</p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in duration-300 flex-shrink-0">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div key={method.id} className="relative group">
        {(isQahwaCard || isNeoLeap) && (
         <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/30 via-yellow-500/30 to-orange-500/30 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
        )}
        <Card
         className={`cursor-pointer transition-all duration-500 relative overflow-hidden rounded-2xl ${
          (isQahwaCard || isNeoLeap)
          ? isSelected
           ? 'border-2 border-amber-400 shadow-2xl scale-[1.02] bg-white'
           : 'border-2 border-amber-200/50 hover:border-amber-400/80 shadow-lg hover:scale-[1.01] bg-white/80'
          : isSelected
           ? 'border-primary bg-primary/5 shadow-md'
           : 'border-border/50 hover:border-primary/30 hover:bg-primary/5 bg-white/50'
         }`}
         onClick={() => onSelectMethod(method.id)}
         data-testid={`payment-method-${method.id}`}
        >
         <CardContent className="p-0">
           {(isQahwaCard || isNeoLeap) && isSelected ? (
             <div className="space-y-4">
               <div className="min-h-80 relative overflow-visible rounded-3xl shadow-2xl border border-white/10" 
                 style={{
                   background: isNeoLeap 
                    ? `linear-gradient(135deg, #1a1a1a 0%, #333333 50%, #000000 100%)`
                    : `linear-gradient(135deg, #B8860B 0%, #D4A017 25%, #C4880F 50%, #8B6914 75%, #5C3D2E 100%)`,
                 }}>
                 <div className="absolute inset-0 opacity-10">
                   <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white" />
                   <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-white" />
                 </div>

                 <div className="relative flex flex-col justify-between text-white h-full py-8 px-8">
                   <div className="flex justify-between items-start flex-shrink-0">
                     <div className="space-y-1">
                       <p className="text-xs uppercase tracking-widest opacity-75">{brand.nameEn}</p>
                       <h4 className="text-2xl font-black">{isNeoLeap ? (method.id === 'neoleap-apple-pay' ? 'Apple Pay' : tc('بطاقة بنكية', 'Bank Card')) : tc('بطاقة الولاء', 'Loyalty Card')}</h4>
                     </div>
                     <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
                       {isNeoLeap ? <CreditCard className="w-6 h-6 text-white" /> : <Coffee className="w-6 h-6 text-white" />}
                     </div>
                   </div>

                   {isNeoLeap ? (
                     <div className="flex flex-col items-center justify-center my-auto text-center space-y-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                          <Zap className="w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                        <p className="text-lg font-bold">{method.id === 'neoleap-apple-pay' ? tc('دفع سريع عبر Apple Pay', 'Quick pay via Apple Pay') : tc('دفع آمن عبر NeoLeap', 'Secure pay via NeoLeap')}</p>
                        <p className="text-sm opacity-80">{tc("مدى، فيزا، ماستر كارد", "Mada, Visa, Mastercard")}</p>
                     </div>
                   ) : cardMode === null ? (
                     <div className="flex flex-col items-center justify-center my-auto">
                          <div className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3 text-center w-full">
                            <p className="text-sm opacity-90">{tc("كيف تريد استخدام بطاقتك؟", "How would you like to use your card?")}</p>
                            <div className="space-y-2">
                              <Button 
                                size="sm"
                                className="w-full bg-[#2D9B6E] hover:bg-[#2D9B6E]/90 text-white transition-all duration-300 shadow-lg border-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Logic for "Pay with Copy Card"
                                  onSelectMethod(method.id);
                                  toast({
                                    title: tc("تم اختيار الدفع بالبطاقة", "Card payment selected"),
                                    description: tc("سيتم خصم قيمة الطلب من رصيد بطاقة مكان الشيف الخاصة بك", "The order value will be deducted from your card balance"),
                                  });
                                }}
                              >
                                <Zap className="w-4 h-4 ml-2" />
                                {tc("ادفع ببطاقة مكان الشيف (كوبي)", "Pay with Chef's Card (Copy)")}
                              </Button>
                               {foundCard && (
                              <Button 
                                size="sm"
                                className="w-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur border-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCardMode('use');
                                }}
                              >
                                <Check className="w-4 h-4 ml-2" />
                                {tc("استخدام البطاقة المربوطة", "Use linked card")}
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              className="w-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardMode('add');
                              }}
                            >
                              <Plus className="w-4 h-4 ml-2" />
                              {tc("إضافة بطاقة أخرى", "Add another card")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : cardMode === 'use' && foundCard ? (
                      <div className="space-y-3 flex-1 flex flex-col justify-center">
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">{tc("رقم البطاقة", "Card Number")}</p>
                          <p className="text-lg font-mono tracking-widest font-bold">
                            {foundCard.cardNumber.replace(/(.{4})/g, '$1 ')}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">{tc("صاحب", "Owner")}</p>
                            <p className="font-bold">{foundCard.customerName?.split(' ')[0] || tc('عضو', 'Member')}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">{tc("مجاني", "Free")}</p>
                            <p className="font-bold text-base">{(foundCard.freeCupsEarned || 0) - (foundCard.freeCupsRedeemed || 0)}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">{tc("خصم", "Discount")}</p>
                            <p className="font-bold text-base">{foundCard.discountPercentage || 0}%</p>
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-2 backdrop-blur text-center mt-2">
                          <p className="text-xs opacity-70">{tc("رصيد المشروبات", "Drink Balance")}</p>
                          <p className="font-bold text-base">{(foundCard.freeCupsEarned || 0) - (foundCard.freeCupsRedeemed || 0)} {tc("مشروب مجاني", "free drink(s)")}</p>
                        </div>
                        <Button 
                          size="sm"
                          className="w-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur border-0 mt-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardMode(null);
                          }}
                        >
                          <Plus className="w-4 h-4 ml-2" />
                          {tc("تغيير البطاقة", "Change card")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {cardMode === 'add' && (
                  <div className="p-6 bg-white border-t border-amber-100 animate-in slide-in-from-top-4 duration-300" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-4">
                      <h4 className="font-bold text-amber-900 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        {tc("البحث عن بطاقتك", "Search for your card")}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-amber-800">{tc("رقم الجوال", "Phone Number")}</Label>
                          <div className="relative">
                            <Phone className="absolute right-3 top-2.5 w-4 h-4 text-amber-400" />
                            <Input 
                              placeholder="5XXXXXXXX" 
                              className="pr-9 border-amber-100 focus:ring-amber-400"
                              value={searchPhone}
                              onChange={(e) => setSearchPhone(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-amber-800">{tc("رقم البطاقة", "Card Number")}</Label>
                          <div className="relative">
                            <CreditCard className="absolute right-3 top-2.5 w-4 h-4 text-amber-400" />
                            <Input 
                              placeholder={tc("رقم البطاقة", "Card Number")} 
                              className="pr-9 border-amber-100 focus:ring-amber-400"
                              value={searchCardNumber}
                              onChange={(e) => setSearchCardNumber(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={handleSearchCard}
                          disabled={isSearching}
                        >
                          {isSearching ? tc("جاري البحث...", "Searching...") : tc("تأكيد الإضافة", "Confirm")}
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="text-primary hover:bg-primary/10"
                          onClick={() => setCardMode(null)}
                        >
                          {tc("إلغاء", "Cancel")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-all duration-300 ${
                    isQahwaCard 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg group-hover:scale-110' 
                      : 'bg-muted text-primary'
                  }`}>
                    {getIcon(method.icon)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-bold transition-colors ${
                        isQahwaCard 
                          ? 'font-amiri text-xl text-amber-900' 
                          : 'text-foreground group-hover:text-primary'
                      }`}>
                        {method.nameAr}
                      </h4>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in duration-300">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm mt-0.5 line-clamp-1 text-[#222429]">
                      {method.details}
                    </p>
                  </div>
                </div>
                {/* Bank Transfer IBAN Details */}
                {isSelected && ((method as any).requiresReceipt || (method as any).bankIban || (method as any).bankName) && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{tc("بيانات التحويل", "Transfer Details")}</p>
                    {(method as any).bankAccountHolder && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{tc("اسم الحساب", "Account Name")}</span>
                        <span className="text-xs font-semibold text-foreground">{(method as any).bankAccountHolder}</span>
                      </div>
                    )}
                    {(method as any).bankName && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{tc("البنك", "Bank")}</span>
                        <span className="text-xs font-semibold text-foreground">{(method as any).bankName}</span>
                      </div>
                    )}
                    {(method as any).bankIban && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{tc("رقم الآيبان", "IBAN")}</span>
                        <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 dir-ltr" dir="ltr">{(method as any).bankIban}</span>
                      </div>
                    )}
                    {!(method as any).bankIban && !(method as any).bankName && method.details && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{tc("رقم الحساب", "Account Number")}</span>
                        <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 dir-ltr" dir="ltr">{method.details}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                      {tc("يرجى التحويل وإرسال صورة الإيصال لإتمام الطلب", "Please transfer and send receipt photo to complete the order")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
         </Card>
       </div>
    );
     })}
     </div>
   </div>
 );
}
