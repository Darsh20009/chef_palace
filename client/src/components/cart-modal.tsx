import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/cart-store";
import { ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import SarIcon from "@/components/sar-icon";
import { useCustomer } from "@/contexts/CustomerContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { customerStorage } from "@/lib/customer-storage";

const CartModal = memo(() => {
  const { t, i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const { isAuthenticated } = useCustomer();
  const { openAuthModal } = useAuthModal();
  const {
    cartItems,
    isCartOpen,
    hideCart,
    updateQuantity,
    removeFromCart,
    getTotalPrice
  } = useCartStore();

  const handleCheckout = () => {
    const isGuest = customerStorage.isGuestMode() && !!customerStorage.getGuestInfo();
    if (isAuthenticated || isGuest) {
      hideCart();
      window.location.href = "/delivery";
      return;
    }
    hideCart();
    openAuthModal({ onSuccess: () => { window.location.href = "/delivery"; } });
  };

  return (
    <Dialog open={isCartOpen} onOpenChange={hideCart} data-testid="modal-cart">
      <DialogContent className="fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-w-md max-h-[90vh] overflow-y-auto backdrop-blur-md border-2 border-primary/30 bg-card text-card-foreground" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-bold text-foreground" data-testid="text-cart-modal-title">
            <ShoppingCart className="w-6 h-6 ml-2" />
            {t('cart.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-8" data-testid="section-cart-empty">
              <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground" data-testid="text-cart-empty">
                {t('cart.empty_title')}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4" data-testid="section-cart-items">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col bg-card/80 hover:bg-card/90 rounded-xl p-4 border border-primary/20 shadow-md backdrop-blur-sm transition-all duration-300"
                    data-testid={`cart-modal-item-${item.id}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground" data-testid={`text-cart-item-name-${item.id}`}>
                          {i18n.language === 'ar' ? item.coffeeItem?.nameAr : (item.coffeeItem?.nameEn || item.coffeeItem?.nameAr)}
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.selectedSize && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {t('cart.item_size')}: {item.selectedSize}
                            </Badge>
                          )}
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4">
                              {t('cart.item_addons')}: {item.selectedAddons.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary" data-testid={`text-cart-item-price-${item.id}`}>
                          {(() => {
                            let itemPrice = item.coffeeItem?.price || 0;
                            if (item.selectedSize && item.coffeeItem?.availableSizes) {
                              const size = item.coffeeItem.availableSizes.find(s => s.nameAr === item.selectedSize);
                              if (size) itemPrice = size.price;
                            }
                            const inlineAddonPrices = ((item as any).selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                            return ((Number(itemPrice) + inlineAddonPrices) * item.quantity).toFixed(2);
                          })()} <SarIcon />
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary/10">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="h-7 w-7 rounded-full"
                          data-testid={`button-cart-decrease-${item.id}`}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="font-semibold text-foreground w-6 text-center text-sm" data-testid={`text-cart-quantity-${item.id}`}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="h-7 w-7 rounded-full"
                          data-testid={`button-cart-increase-${item.id}`}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-cart-remove-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4" data-testid="section-cart-total">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-semibold text-foreground">{t('cart.total')}:</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-cart-total">
                    {getTotalPrice().toFixed(2)} <SarIcon />
                  </span>
                </div>
                <Button
                  onClick={handleCheckout}
                  size="lg"
                  className="w-full btn-primary text-accent-foreground py-3 text-lg font-semibold"
                  data-testid="button-cart-checkout"
                >
                  {t('checkout.complete_order')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default CartModal;
