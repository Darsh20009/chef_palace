import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomerLayout } from "@/components/layouts/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Coffee, Clock, Gift, Percent, ArrowRight, Star, TrendingUp } from "lucide-react";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLocation } from "wouter";
import { useLoyaltyCard } from "@/hooks/useLoyaltyCard";
import { customerStorage } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";

interface PersonalizedOffer {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  discount: number;
  type: 'loyalty' | 'comeback' | 'birthday' | 'frequent' | 'new';
  expiresIn?: string;
  expiresInEn?: string;
  coffeeItemId?: string;
  coffeeItem?: any;
}

export default function MyOffersPage() {
  const { customer } = useCustomer();
  const [, setLocation] = useLocation();
  const { card: loyaltyCard } = useLoyaltyCard();
  const { toast } = useToast();
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const dir = isEn ? 'ltr' : 'rtl';

  const handleUseOffer = (offer: PersonalizedOffer) => {
    customerStorage.setActiveOffer({
      id: offer.id,
      title: isEn ? offer.titleEn : offer.title,
      description: isEn ? offer.descriptionEn : offer.description,
      discount: offer.discount,
      type: offer.type,
      coffeeItemId: offer.coffeeItemId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    
    toast({
      title: tc("تم تفعيل العرض!", "Offer Activated!"),
      description: `${isEn ? offer.titleEn : offer.title} - ${tc("سيتم تطبيقه عند الدفع", "Will be applied at checkout")}`,
    });
    
    setLocation("/menu");
  };

  const { data: coffeeItems = [] } = useQuery<any[]>({
    queryKey: ["/api/coffee-items"]
  });

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/customer", customer?.phone],
    enabled: !!customer?.phone
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  const offersConfig = businessConfig?.offersConfig;
  const loyaltyConfig = businessConfig?.loyaltyConfig;
  const ptsPerSar = loyaltyConfig?.pointsPerSar ?? 20;

  const offers = useMemo((): PersonalizedOffer[] => {
    const result: PersonalizedOffer[] = [];
    const points = loyaltyCard?.points || 0;
    const orderCount = orders.length;

    const pointsRedemption = offersConfig?.pointsRedemption;
    if (pointsRedemption?.enabled !== false) {
      const minPoints = pointsRedemption?.minPoints ?? 100;
      if (points >= minPoints) {
        const sarDiscount = (points / ptsPerSar).toFixed(0);
        result.push({
          id: 'points-discount',
          title: 'خصم نقاطك!',
          titleEn: 'Redeem Your Points!',
          description: `لديك ${points} نقطة يمكنك استخدامها للحصول على خصم ${sarDiscount} ريال`,
          descriptionEn: `You have ${points} points you can redeem for a ${sarDiscount} SAR discount`,
          discount: Math.floor(points / ptsPerSar),
          type: 'loyalty'
        });
      }
    }

    const firstOrderDiscount = offersConfig?.firstOrderDiscount;
    if (firstOrderDiscount?.enabled !== false && orderCount === 0) {
      const discountValue = firstOrderDiscount?.value ?? 15;
      const discountType = firstOrderDiscount?.discountType ?? 'percent';
      const expiresDays = firstOrderDiscount?.expiresDays ?? 7;
      const discountTextAr = discountType === 'amount' ? `خصم ${discountValue} ريال` : `خصم ${discountValue}%`;
      const discountTextEn = discountType === 'amount' ? `${discountValue} SAR discount` : `${discountValue}% discount`;
      
      result.push({
        id: 'first-order',
        title: 'عرض الترحيب!',
        titleEn: 'Welcome Offer!',
        description: `احصل على ${discountTextAr} على طلبك الأول كعميل جديد`,
        descriptionEn: `Get a ${discountTextEn} on your first order as a new customer`,
        discount: discountValue,
        type: 'new',
        expiresIn: `${expiresDays} أيام`,
        expiresInEn: `${expiresDays} days`
      });
    }

    const comebackDiscount = offersConfig?.comebackDiscount;
    if (comebackDiscount?.enabled !== false) {
      const minOrders = comebackDiscount?.minOrders ?? 0;
      const maxOrders = comebackDiscount?.maxOrders ?? 5;
      if (orderCount > minOrders && orderCount < maxOrders) {
        const discountValue = comebackDiscount?.value ?? 10;
        const discountType = comebackDiscount?.discountType ?? 'percent';
        const expiresDays = comebackDiscount?.expiresDays ?? 3;
        const discountTextAr = discountType === 'amount' ? `خصم ${discountValue} ريال` : `خصم ${discountValue}%`;
        const discountTextEn = discountType === 'amount' ? `${discountValue} SAR discount` : `${discountValue}% discount`;
        
        result.push({
          id: 'comeback',
          title: 'اشتقنا لك!',
          titleEn: "We Missed You!",
          description: `احصل على ${discountTextAr} على طلبك القادم`,
          descriptionEn: `Get a ${discountTextEn} on your next order`,
          discount: discountValue,
          type: 'comeback',
          expiresIn: `${expiresDays} أيام`,
          expiresInEn: `${expiresDays} days`
        });
      }
    }

    const frequentDiscount = offersConfig?.frequentDiscount;
    if (frequentDiscount?.enabled !== false) {
      const minOrders = frequentDiscount?.minOrders ?? 5;
      if (orderCount >= minOrders) {
        const discountValue = frequentDiscount?.value ?? 20;
        const discountType = frequentDiscount?.discountType ?? 'percent';
        const discountTextAr = discountType === 'amount' ? `خصم ${discountValue} ريال` : `خصم ${discountValue}%`;
        const discountTextEn = discountType === 'amount' ? `${discountValue} SAR discount` : `${discountValue}% discount`;
        
        result.push({
          id: 'frequent',
          title: 'عميل مميز!',
          titleEn: 'VIP Customer!',
          description: `كمكافأة لولائك، احصل على ${discountTextAr} على أي وجبة`,
          descriptionEn: `As a reward for your loyalty, get a ${discountTextEn} on any drink`,
          discount: discountValue,
          type: 'frequent'
        });
      }
    }

    const specialDrinkDiscount = offersConfig?.specialDrinkDiscount;
    if (specialDrinkDiscount?.enabled !== false && coffeeItems.length > 0) {
      const stableIndex = (customer?.phone?.length || 0) % coffeeItems.length;
      const featuredItem = coffeeItems[stableIndex];
      if (featuredItem) {
        const discountValue = specialDrinkDiscount?.value ?? 25;
        const discountType = specialDrinkDiscount?.discountType ?? 'percent';
        const discountTextAr = discountType === 'amount' ? `خصم ${discountValue} ريال على` : `خصم ${discountValue}% على`;
        const discountTextEn = discountType === 'amount' ? `${discountValue} SAR off` : `${discountValue}% off`;
        
        result.push({
          id: 'special-drink',
          title: 'عرض خاص على وجبتك المفضلة',
          titleEn: 'Special Offer on Your Favorite Drink',
          description: `${discountTextAr} ${featuredItem.nameAr}`,
          descriptionEn: `${discountTextEn} ${featuredItem.nameEn || featuredItem.nameAr}`,
          discount: discountValue,
          type: 'frequent',
          coffeeItemId: featuredItem.id,
          coffeeItem: featuredItem,
          expiresIn: 'اليوم فقط',
          expiresInEn: 'Today only'
        });
      }
    }

    const pointsRedemptionConfig = offersConfig?.pointsRedemption;
    const minPointsThreshold = pointsRedemptionConfig?.minPoints ?? 100;
    if (points >= 50 && points < minPointsThreshold) {
      const pointsNeeded = minPointsThreshold - points;
      const sarValue = pointsNeeded / ptsPerSar;
      
      result.push({
        id: 'almost-there',
        title: 'اقتربت من المكافأة!',
        titleEn: 'Almost There!',
        description: `تحتاج ${pointsNeeded} نقطة إضافية للحصول على خصم ${sarValue.toFixed(0)} ريال`,
        descriptionEn: `You need ${pointsNeeded} more points for a ${sarValue.toFixed(0)} SAR discount`,
        discount: 0,
        type: 'loyalty'
      });
    }

    return result;
  }, [loyaltyCard?.points, orders.length, coffeeItems, customer?.phone, offersConfig, loyaltyConfig, ptsPerSar]);

  const getOfferIcon = (type: PersonalizedOffer['type']) => {
    switch (type) {
      case 'loyalty': return <Star className="w-5 h-5" />;
      case 'comeback': return <Coffee className="w-5 h-5" />;
      case 'birthday': return <Gift className="w-5 h-5" />;
      case 'frequent': return <TrendingUp className="w-5 h-5" />;
      case 'new': return <Sparkles className="w-5 h-5" />;
      default: return <Percent className="w-5 h-5" />;
    }
  };

  const getOfferColor = (type: PersonalizedOffer['type']) => {
    switch (type) {
      case 'loyalty': return 'from-amber-500 to-orange-500';
      case 'comeback': return 'from-blue-500 to-cyan-500';
      case 'birthday': return 'from-pink-500 to-rose-500';
      case 'frequent': return 'from-green-500 to-emerald-500';
      case 'new': return 'from-purple-500 to-violet-500';
      default: return 'from-primary to-accent';
    }
  };

  if (!customer) {
    return (
      <CustomerLayout>
        <div className="container max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Sparkles className="w-12 h-12 text-primary" />
          <p className="font-ibm-arabic text-muted-foreground text-center">
            {tc("سجل دخولك لاكتشاف عروضك الخاصة", "Log in to discover your exclusive offers")}
          </p>
          <Button onClick={() => setLocation("/auth")} data-testid="button-login">
            {tc("تسجيل الدخول", "Log In")}
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container max-w-lg mx-auto p-4 pb-24" dir={dir}>
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/menu")}
            data-testid="button-back"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              {tc("عروضك الخاصة", "Your Exclusive Offers")}
            </h1>
            <p className="text-sm text-muted-foreground">{tc("عروض مخصصة لك بناءً على تفضيلاتك", "Offers tailored to your preferences")}</p>
          </div>
        </div>

        {offers.length === 0 ? (
          <Card className="text-center p-8">
            <CardContent>
              <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">{tc("لا توجد عروض حالياً", "No offers available")}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {tc("استمر في الطلب لفتح عروض خاصة بك", "Keep ordering to unlock special offers")}
              </p>
              <Button 
                onClick={() => setLocation("/menu")} 
                className="mt-4"
                data-testid="button-explore-menu"
              >
                {tc("استكشف القائمة", "Explore Menu")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <Card 
                key={offer.id} 
                className="overflow-hidden border-0 shadow-lg"
                data-testid={`offer-card-${offer.id}`}
              >
                <div className={`bg-gradient-to-r ${getOfferColor(offer.type)} p-4`}>
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      {getOfferIcon(offer.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{isEn ? offer.titleEn : offer.title}</h3>
                      {offer.expiresIn && (
                        <div className="flex items-center gap-1 text-xs text-white/80 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{tc("ينتهي خلال", "Expires in")} {isEn ? offer.expiresInEn : offer.expiresIn}</span>
                        </div>
                      )}
                    </div>
                    {offer.discount > 0 && (
                      <Badge className="bg-white text-foreground font-bold text-lg px-3 py-1">
                        {offer.type === 'loyalty' ? `${offer.discount} ${tc("ر.س", "SAR")}` : `${offer.discount}%`}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-foreground">{isEn ? offer.descriptionEn : offer.description}</p>
                  {offer.coffeeItem && (
                    <div className="mt-3 flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                      {offer.coffeeItem.imageUrl && (
                        <img 
                          src={offer.coffeeItem.imageUrl} 
                          alt={offer.coffeeItem.nameAr}
                          className="w-12 h-12 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{isEn ? (offer.coffeeItem.nameEn || offer.coffeeItem.nameAr) : offer.coffeeItem.nameAr}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="line-through">{offer.coffeeItem.price} <SarIcon /></span>
                          <span className="text-primary font-bold mr-2">
                            {(offer.coffeeItem.price * (1 - offer.discount / 100)).toFixed(2)} <SarIcon />
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => handleUseOffer(offer)}
                    disabled={offer.discount === 0}
                    data-testid={`button-use-offer-${offer.id}`}
                  >
                    {offer.discount > 0 ? tc("استخدم العرض", "Use Offer") : tc("استمر في جمع النقاط", "Keep Collecting Points")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              {tc("كيف تحصل على المزيد من العروض؟", "How to Get More Offers?")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• {tc("اطلب بانتظام لفتح عروض العملاء المميزين", "Order regularly to unlock VIP offers")}</p>
            <p>• {tc("اجمع النقاط واستبدلها بخصومات", "Collect points and redeem for discounts")}</p>
            <p>• {tc("ادعُ أصدقاءك واحصل على 50 نقطة لكل صديق", "Refer friends and earn 50 points per referral")}</p>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
