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
    title: "خطأ",
    description: "يرجى إدخال رقم الجوال أو رقم البطاقة",
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
   if (!res.ok) throw new Error("البطاقة غير موجودة");
   const cardData = await res.json();
   updateCardInCache(cardData);
   setIsAddingCard(false);
   setCardMode('use');
   toast({
    title: "تم العثور على البطاقة",
    description: `أهلاً ${cardData.customerName || 'عميلنا العزيز'}`,
   });
  } catch (error) {
   toast({
    variant: "destructive",
    title: "خطأ",
    description: "لم يتم العثور على بطاقة مرتبطة بهذه البيانات",
   });
  } finally {
   setIsSearching(false);
  }
 };

 if (comingSoon) {
   return (
     <div className="space-y-4" data-testid="section-payment-methods">
       <h3 className="text-lg font-semibold text-foreground mb-4">اختر طريقة الدفع</h3>
       <div className="relative rounded-2xl overflow-hidden border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40">
         <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white/70 dark:bg-black/60 backdrop-blur-sm">
           <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 shadow-md">
             <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
           </div>
           <div className="text-center space-y-1 px-4">
             <p className="font-bold text-amber-800 dark:text-amber-300 text-base">خيارات الدفع قريباً</p>
             <p className="text-xs text-amber-600/80 dark:text-amber-400/70">سيتم تفعيل طرق الدفع في إصدار قادم</p>
           </div>
           <span className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
             <Clock className="w-3.5 h-3.5" />
             قريباً
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
     <h3 className="text-lg font-semibold text-foreground mb-4">اختر طريقة الدفع</h3>
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

    // Hide mobile wallet (paymob-wallet) — not used in SA flow
    if ((method.id as string) === 'paymob-wallet') return null;

    // Hide Apple Pay on non-Apple devices
    const isPaymobApplePay = (method.id as string) === 'paymob-apple-pay';
    if (isPaymobApplePay && !isAppleDevice()) return null;
    if (isApplePay && !isAppleDevice()) return null;

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
                      قريباً
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isApplePay ? "سيتوفر Apple Pay قريباً" : "الدفع بالبطاقة سيكون متاحاً قريباً"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // PayMob Apple Pay (only shown on Apple devices — already filtered above)
    if (isPaymobApplePay) {
      return (
        <div key={method.id}>
          <div
            className={`h-14 px-4 rounded-2xl bg-[#1c1c1e] flex items-center gap-2 hover:bg-[#2c2c2e] transition-all duration-150 shadow-sm cursor-pointer ${isSelected ? 'ring-2 ring-white/40 scale-[1.01]' : ''}`}
            onClick={() => onSelectMethod(method.id)}
            data-testid={`payment-method-${method.id}`}
          >
            <svg viewBox="0 0 20 24" className="h-5 w-auto fill-white flex-shrink-0">
              <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z" />
            </svg>
            <span className="text-white font-semibold text-sm flex-1">Apple Pay</span>
            {isSelected && (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
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
                    <h4 className="font-bold text-foreground text-sm">الدفع بالبطاقة</h4>
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
                  <p className="text-xs text-muted-foreground">الدفع عبر محفظة STC</p>
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
                       <h4 className="text-2xl font-black">{isNeoLeap ? (method.id === 'neoleap-apple-pay' ? 'Apple Pay' : 'بطاقة بنكية') : 'بطاقة الولاء'}</h4>
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
                        <p className="text-lg font-bold">{method.id === 'neoleap-apple-pay' ? 'دفع سريع عبر Apple Pay' : 'دفع آمن عبر NeoLeap'}</p>
                        <p className="text-sm opacity-80">مدى، فيزا، ماستر كارد</p>
                     </div>
                   ) : cardMode === null ? (
                     <div className="flex flex-col items-center justify-center my-auto">
                          <div className="bg-white/10 backdrop-blur rounded-lg p-4 space-y-3 text-center w-full">
                            <p className="text-sm opacity-90">كيف تريد استخدام بطاقتك؟</p>
                            <div className="space-y-2">
                              <Button 
                                size="sm"
                                className="w-full bg-[#2D9B6E] hover:bg-[#2D9B6E]/90 text-white transition-all duration-300 shadow-lg border-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Logic for "Pay with Copy Card"
                                  onSelectMethod(method.id);
                                  toast({
                                    title: "تم اختيار الدفع بالبطاقة",
                                    description: "سيتم خصم قيمة الطلب من رصيد بطاقة مكان الشيف الخاصة بك",
                                  });
                                }}
                              >
                                <Zap className="w-4 h-4 ml-2" />
                                ادفع ببطاقة مكان الشيف
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
                                استخدام البطاقة المربوطة
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
                              إضافة بطاقة أخرى
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : cardMode === 'use' && foundCard ? (
                      <div className="space-y-3 flex-1 flex flex-col justify-center">
                        <div className="space-y-1">
                          <p className="text-xs opacity-75">رقم البطاقة</p>
                          <p className="text-lg font-mono tracking-widest font-bold">
                            {foundCard.cardNumber.replace(/(.{4})/g, '$1 ')}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">صاحب</p>
                            <p className="font-bold">{foundCard.customerName?.split(' ')[0] || 'عضو'}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">مجاني</p>
                            <p className="font-bold text-base">{(foundCard.freeCupsEarned || 0) - (foundCard.freeCupsRedeemed || 0)}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                            <p className="text-xs opacity-70">خصم</p>
                            <p className="font-bold text-base">{foundCard.discountPercentage || 0}%</p>
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-2 backdrop-blur text-center mt-2">
                          <p className="text-xs opacity-70">رصيد الوجبات</p>
                          <p className="font-bold text-base">{(foundCard.freeCupsEarned || 0) - (foundCard.freeCupsRedeemed || 0)} وجبة مجانية</p>
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
                          تغيير البطاقة
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
                        البحث عن بطاقتك
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-amber-800">رقم الجوال</Label>
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
                          <Label className="text-xs text-amber-800">رقم البطاقة</Label>
                          <div className="relative">
                            <CreditCard className="absolute right-3 top-2.5 w-4 h-4 text-amber-400" />
                            <Input 
                              placeholder="رقم البطاقة" 
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
                          {isSearching ? "جاري البحث..." : "تأكيد الإضافة"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="text-primary hover:bg-primary/10"
                          onClick={() => setCardMode(null)}
                        >
                          إلغاء
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
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300">بيانات التحويل</p>
                    {(method as any).bankAccountHolder && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">اسم الحساب</span>
                        <span className="text-xs font-semibold text-foreground">{(method as any).bankAccountHolder}</span>
                      </div>
                    )}
                    {(method as any).bankName && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">البنك</span>
                        <span className="text-xs font-semibold text-foreground">{(method as any).bankName}</span>
                      </div>
                    )}
                    {(method as any).bankIban && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">رقم الآيبان</span>
                        <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 dir-ltr" dir="ltr">{(method as any).bankIban}</span>
                      </div>
                    )}
                    {!(method as any).bankIban && !(method as any).bankName && method.details && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">رقم الحساب</span>
                        <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 dir-ltr" dir="ltr">{method.details}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                      يرجى التحويل وإرسال صورة الإيصال لإتمام الطلب
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
