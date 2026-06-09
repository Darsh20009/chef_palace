import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/cart-store";
import { getCoffeeImage } from "@/lib/coffee-data-clean";
import { ArrowRight, ShoppingCart, Trash2, Plus, Minus, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import SarIcon from "@/components/sar-icon";
import { useCustomer } from "@/contexts/CustomerContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { customerStorage } from "@/lib/customer-storage";

export default function CartPage() {
  const translation = useTranslation();
  const t = translation?.t || ((key: string) => key);
  const i18n = translation?.i18n || { language: 'ar' };
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice } = useCartStore();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useCustomer();
  const { openAuthModal } = useAuthModal();
  const goCheckout = () => {
    const isGuest = customerStorage.isGuestMode() && !!customerStorage.getGuestInfo();
    if (isAuthenticated || isGuest) {
      setLocation("/delivery");
      return;
    }
    openAuthModal({ onSuccess: () => setLocation("/delivery") });
  };

  const isAr = i18n.language === 'ar';

  // Set SEO metadata
  useEffect(() => {
    document.title = isAr ? "سلة التسوق - مكان الشيف البخاري | اكتمل طلبك" : "Shopping Cart - مكان الشيف البخاري";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', isAr 
        ? 'سلة التسوق الخاصة بك في مكان الشيف البخاري - أضف المزيد من وجباتك المفضلة وانتقل للدفع' 
        : 'Your shopping cart at مكان الشيف البخاري - add more of your favorite Bukhari meals and proceed to checkout');
    }
  }, [isAr]);

  const totalPrice = getTotalPrice();

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-24 h-24 bg-accent/8 rounded-full blur-xl animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-10 w-20 h-20 bg-primary/8 rounded-full blur-lg animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="relative z-10">
          <header className="bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <Link href="/menu" className="flex items-center space-x-4 space-x-reverse text-muted-foreground hover:text-primary transition-colors group">
                  {isAr ? <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> : <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
                  <span className="text-lg font-semibold">{t("product.back")}</span>
                </Link>
                <h1 className="font-amiri text-2xl font-bold text-primary">{t("cart.title")}</h1>
              </div>
            </div>
          </header>

          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
            <ShoppingCart className="w-24 h-24 text-accent mb-6" />
            <h2 className="font-playfair text-3xl font-bold text-foreground mb-4">{t("cart.empty_title")}</h2>
            <p className="text-muted-foreground text-lg mb-8 text-center max-w-md leading-relaxed font-cairo">
              {t("cart.empty_desc")}
            </p>
            <Link href="/menu">
              <Button className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/95 hover:to-accent/85 text-accent-foreground px-8 py-4 text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl rounded-lg">
                {t("welcome.explore")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-24 h-24 bg-accent/8 rounded-full blur-xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-10 w-20 h-20 bg-primary/8 rounded-full blur-lg animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="relative z-10">
        <header className="bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/menu" className="flex items-center space-x-4 space-x-reverse text-muted-foreground hover:text-primary transition-colors group">
                {isAr ? <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> : <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
                <span className="text-lg font-semibold">{t("product.back")}</span>
              </Link>
              <h1 className="font-amiri text-2xl font-bold text-primary">{t("cart.title")}</h1>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-32 lg:pb-8">
          <div className="grid gap-4 sm:gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3 sm:space-y-6">
              <h2 className="font-playfair text-xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-8 flex items-center">
                <ShoppingCart className={`w-6 h-6 sm:w-8 sm:h-8 ${isAr ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3'}`} />
                {t("cart.selected_items")}
              </h2>

              {cartItems.map((item, index) => (
                <Card 
                  key={item.coffeeItemId} 
                  className="bg-card/90 border-primary/20 backdrop-blur-sm shadow-lg sm:shadow-xl hover:shadow-2xl transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-10 duration-500"
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="relative flex-shrink-0">
                          <img 
                            src={item.coffeeItem?.imageUrl || getCoffeeImage(item.coffeeItem?.id || '')}
                            alt={isAr ? item.coffeeItem?.nameAr : item.coffeeItem?.nameEn || item.coffeeItem?.nameAr}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl shadow-lg"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.src = "/images/brand-logo.png"; e.currentTarget.style.objectFit = "contain"; e.currentTarget.style.padding = "8px"; if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.background = "#1a1a1a";
                            }}
                          />
                          <div className={`absolute -top-1 sm:-top-2 w-5 h-5 sm:w-6 sm:h-6 bg-primary rounded-full flex items-center justify-center shadow-md ${isAr ? '-right-1 sm:-right-2' : '-left-1 sm:-left-2'}`}>
                            <span className="text-white text-[10px] sm:text-xs font-bold">{item.quantity}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-start">
                          <h3 className="font-amiri font-bold text-foreground text-base sm:text-xl mb-0.5 sm:mb-1 truncate">
                            {isAr ? item.coffeeItem?.nameAr : item.coffeeItem?.nameEn || item.coffeeItem?.nameAr}
                            {item.selectedSize && item.selectedSize !== 'default' && (
                              <span className="text-xs sm:text-sm text-muted-foreground mr-2 font-normal">
                                ({item.selectedSize})
                              </span>
                            )}
                          </h3>
                          <div className="flex flex-col">
                            <p className="text-primary font-bold text-sm sm:text-lg">
                              {(() => {
                                let price = Number(item.coffeeItem?.price || 0);
                                if (item.selectedSize && item.coffeeItem?.availableSizes) {
                                  const size = item.coffeeItem.availableSizes.find((s: any) => s.nameAr === item.selectedSize);
                                  if (size) price = size.price;
                                }
                                const addonsPrice = ((item as any).selectedItemAddons || []).reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
                                return (price + addonsPrice).toFixed(2);
                              })()} <SarIcon />
                            </p>
                            {((item as any).selectedItemAddons?.length > 0) && (
                              <p className="text-xs text-muted-foreground">
                                {(item as any).selectedItemAddons.map((a: any) => isAr ? a.nameAr : (a.nameEn || a.nameAr)).join('، ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <div className="flex items-center bg-background rounded-full p-0.5 sm:p-1 border border-primary">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                            className="h-9 w-9 sm:h-8 sm:w-8 text-foreground hover:bg-primary hover:text-primary-foreground rounded-full"
                            data-testid={`button-decrease-${item.coffeeItemId}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>

                          <span className="text-foreground font-bold text-base sm:text-lg w-10 sm:w-12 text-center">
                            {item.quantity}
                          </span>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-9 w-9 sm:h-8 sm:w-8 text-foreground hover:bg-primary hover:text-primary-foreground rounded-full"
                            data-testid={`button-increase-${item.coffeeItemId}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => removeFromCart(item.id)}
                          className="h-9 w-9 sm:h-10 sm:w-10 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-full"
                          data-testid={`button-remove-${item.coffeeItemId}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden lg:block lg:col-span-1">
              <Card className="bg-gradient-to-br from-card/95 to-background/80 border-primary/50 backdrop-blur-sm sticky top-24 shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
                  <CardTitle className="font-amiri text-2xl flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6" />
                    {t("checkout.order_summary")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="flex justify-between items-center text-foreground gap-2">
                    <span className="text-lg">{t("cart.items_count")}</span>
                    <Badge className="bg-primary text-primary-foreground text-lg px-3 py-1">
                      {t("cart.items_pcs", { count: cartItems.reduce((sum, item) => sum + item.quantity, 0) })}
                    </Badge>
                  </div>

                  <div className="border-t border-primary pt-6">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xl font-bold text-foreground">{t("cart.total_price")}</span>
                      <span className="text-2xl font-black text-primary">{totalPrice.toFixed(2)} <SarIcon /></span>
                    </div>
                  </div>

                  <Button 
                    onClick={goCheckout}
                    className="w-full bg-primary text-primary-foreground py-6 text-xl font-bold hover:bg-primary/90 transition-all duration-300 shadow-xl rounded-full"
                    data-testid="button-checkout"
                  >
                    {t("cart.checkout_now")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Summary for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl p-4 pb-safe z-50" style={{paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)'}}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col text-start">
              <span className="text-xs text-muted-foreground">{t("cart.total")} ({t("cart.items_pcs", { count: cartItems.reduce((sum, item) => sum + item.quantity, 0) })})</span>
              <span className="text-xl font-black text-primary">{totalPrice.toFixed(2)} <SarIcon /></span>
            </div>
            <Button 
              onClick={goCheckout}
              className="flex-1 max-w-[200px] bg-primary text-primary-foreground py-5 text-lg font-bold hover:bg-primary/90 rounded-full shadow-lg"
              data-testid="button-checkout-mobile"
            >
              {t("cart.checkout")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
