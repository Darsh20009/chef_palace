import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Coffee, ChevronRight, X, Loader2 } from "lucide-react";
import chefsplaceLogo from "@assets/blackrose-logo.png";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";

interface MenuItem {
  _id: string;
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
  imageUrl?: string;
  category?: string;
  isAvailable?: boolean;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

function SarIcon() {
  return <span className="font-arabic text-sm font-bold">ر.س</span>;
}

function itemKey(item: MenuItem): string {
  return item._id || item.id || '';
}

const ALL_CATEGORY = "__all__";

export default function KioskPage() {
  const { toast } = useToast();
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [idleTimer, setIdleTimer] = useState<NodeJS.Timeout | null>(null);

  const { data: menuItems = [], isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const availableItems = (menuItems as MenuItem[]).filter(i =>
    i.isAvailable !== false && (i as any).availabilityStatus !== 'out_of_stock'
  );

  const categories = [ALL_CATEGORY, ...Array.from(new Set(availableItems.map(i => i.category).filter((c): c is string => !!c)))];

  const filteredItems = selectedCategory === ALL_CATEGORY
    ? availableItems
    : availableItems.filter(i => i.category === selectedCategory);

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    const t = setTimeout(() => {
      if (!showSuccess) {
        setCart([]);
        setShowCart(false);
        setShowCheckout(false);
        setCustomerName("");
        setSelectedCategory(ALL_CATEGORY);
      }
    }, 120000);
    setIdleTimer(t);
  };

  useEffect(() => {
    resetIdle();
    return () => { if (idleTimer) clearTimeout(idleTimer); };
  }, []);

  const addToCart = (item: MenuItem) => {
    resetIdle();
    setCart(prev => {
      const key = itemKey(item);
      const existing = prev.find(c => itemKey(c.item) === key);
      if (existing) return prev.map(c => itemKey(c.item) === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1 }];
    });
    setSelectedItem(null);
    toast({ title: tc("✅ تمت الإضافة", "✅ Added"), description: isEn ? item.nameEn : item.nameAr });
  };

  const removeFromCart = (id: string) => {
    resetIdle();
    setCart(prev => {
      const existing = prev.find(c => itemKey(c.item) === id);
      if (!existing || existing.quantity <= 1) return prev.filter(c => itemKey(c.item) !== id);
      return prev.map(c => itemKey(c.item) === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/orders", {
        customerName: customerName || tc("زبون الكشك", "Kiosk Customer"),
        items: cart.map(c => ({
          coffeeItemId: c.item._id || c.item.id,
          quantity: c.quantity,
          price: c.item.price,
          nameAr: c.item.nameAr,
          nameEn: c.item.nameEn,
        })),
        totalAmount: cartTotal,
        paymentMethod: "cash",
        status: "pending",
        channel: "kiosk",
        orderType: "dine-in",
        branchId: "default",
      });
      if (!res.ok) throw new Error(tc("فشل إرسال الطلب", "Failed to place order"));
      return res.json();
    },
    onSuccess: (data) => {
      setOrderNumber(data.orderNumber || data._id?.slice(-4) || "0000");
      setShowCheckout(false);
      setShowCart(false);
      setCart([]);
      setCustomerName("");
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedCategory(ALL_CATEGORY);
      }, 8000);
    },
    onError: () => toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("تعذّر إرسال الطلب. حاول مجدداً.", "Failed to place order. Please try again.") }),
  });

  if (showSuccess) {
    return (
      <div className="h-screen bg-primary flex flex-col items-center justify-center text-white text-center p-8" data-testid="kiosk-success">
        <CheckCircle className="w-32 h-32 mb-6 animate-bounce" />
        <h1 className="text-5xl font-black mb-4">{tc("شكراً لطلبك!", "Thank you for your order!")}</h1>
        <p className="text-3xl font-bold mb-2">{tc("رقم الطلب", "Order Number")}</p>
        <div className="text-8xl font-black bg-white text-primary rounded-3xl px-10 py-6 mb-6">#{orderNumber}</div>
        <p className="text-2xl text-white/80">{tc("سنُخبرك عند جاهزية طلبك", "We'll notify you when your order is ready")}</p>
        <div className="mt-8 text-lg text-white/60">{tc("سيعود الشاشة تلقائياً خلال ثوانٍ...", "Screen will reset in a few seconds...")}</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" onClick={resetIdle} data-testid="kiosk-page" dir={isEn ? "ltr" : "rtl"}>
      {/* Header */}
      <div className="bg-primary text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="h-10 object-contain brightness-0 invert" />
        <div className="text-center">
          <p className="text-lg font-bold">{tc("نظام الطلب الذاتي", "Self-Order Kiosk")}</p>
          <p className="text-xs text-white/70">{tc("Self-Order Kiosk", "اطلب بنفسك")}</p>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative bg-white text-primary rounded-2xl px-5 py-2 font-bold flex items-center gap-2 text-lg hover:bg-white/90 transition-colors"
          data-testid="button-kiosk-cart"
        >
          <ShoppingCart className="w-6 h-6" />
          <span>{cartTotal.toFixed(2)} <SarIcon /></span>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-black">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Category Bar */}
      <div className="bg-card border-b px-4 py-3 flex gap-3 overflow-x-auto scrollbar-none shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            data-testid={`button-category-${cat}`}
            className={`shrink-0 px-6 py-2 rounded-full text-base font-bold transition-all ${
              selectedCategory === cat
                ? "bg-primary text-white shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat === ALL_CATEGORY ? tc("الكل", "All") : cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <ScrollArea className="flex-1 p-4">
        {menuLoading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">{tc("جاري تحميل القائمة...", "Loading menu...")}</p>
          </div>
        )}
        {!menuLoading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Coffee className="w-16 h-16 text-primary/30" />
            <p className="text-muted-foreground font-medium text-lg">{tc("لا توجد منتجات متاحة", "No items available")}</p>
            <p className="text-muted-foreground/60 text-sm">{tc("يرجى التواصل مع الموظف", "Please contact staff")}</p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
          {filteredItems.map(item => {
            const key = itemKey(item);
            const cartItem = cart.find(c => itemKey(c.item) === key);
            return (
              <Card
                key={key}
                className="overflow-hidden cursor-pointer hover:shadow-xl transition-all active:scale-95 select-none"
                onClick={() => setSelectedItem(item)}
                data-testid={`card-kiosk-item-${key}`}
              >
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={isEn ? item.nameEn : item.nameAr}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <Coffee className="w-16 h-16 text-primary/40" />
                    </div>
                  )}
                  {cartItem && (
                    <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm">
                      {cartItem.quantity}
                    </div>
                  )}
                </div>
                <div className="p-3 text-center">
                  <p className="font-bold text-base leading-tight mb-1">{isEn ? item.nameEn : item.nameAr}</p>
                  <p className="text-xs text-muted-foreground mb-2">{isEn ? item.nameAr : item.nameEn}</p>
                  <Badge className="bg-primary/10 text-primary border-0 font-black text-sm">
                    {item.price.toFixed(2)} <SarIcon />
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Item Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {selectedItem ? (isEn ? selectedItem.nameEn : selectedItem.nameAr) : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="text-center space-y-4">
              <div className="aspect-video rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {selectedItem.imageUrl ? (
                  <img
                    src={selectedItem.imageUrl}
                    alt={isEn ? selectedItem.nameEn : selectedItem.nameAr}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = 'none';
                      t.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <Coffee className={`w-20 h-20 text-primary/30 fallback-icon ${selectedItem.imageUrl ? 'hidden' : ''}`} />
              </div>
              <p className="text-muted-foreground">{isEn ? selectedItem.nameAr : selectedItem.nameEn}</p>
              <p className="text-3xl font-black text-primary">{selectedItem.price.toFixed(2)} <SarIcon /></p>
              <Button
                size="lg"
                className="w-full text-lg py-6"
                onClick={() => addToCart(selectedItem)}
                data-testid="button-kiosk-add-to-cart"
              >
                <Plus className="w-5 h-5 mr-2" /> {tc("إضافة للطلب", "Add to Order")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Sidebar */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShoppingCart className="w-6 h-6 text-primary" /> {tc(`طلبك (${cartCount})`, `Your Order (${cartCount})`)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">{tc("طلبك فارغ", "Your cart is empty")}</p>
              </div>
            ) : (
              <div className="space-y-3 p-1">
                {cart.map(c => (
                  <div key={itemKey(c.item)} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3" data-testid={`kiosk-cart-item-${itemKey(c.item)}`}>
                    <div className="flex-1">
                      <p className="font-bold">{isEn ? c.item.nameEn : c.item.nameAr}</p>
                      <p className="text-sm text-muted-foreground">{(c.item.price * c.quantity).toFixed(2)} <SarIcon /></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(itemKey(c.item))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-red-100">
                        {c.quantity === 1 ? <Trash2 className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4" />}
                      </button>
                      <span className="w-6 text-center font-bold">{c.quantity}</span>
                      <button onClick={() => addToCart(c.item)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20">
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {cart.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between font-black text-xl">
                <span>{tc("الإجمالي:", "Total:")}</span>
                <span className="text-primary">{cartTotal.toFixed(2)} <SarIcon /></span>
              </div>
              <Button size="lg" className="w-full text-lg py-6" onClick={() => { setShowCart(false); setShowCheckout(true); }} data-testid="button-kiosk-checkout">
                {tc("متابعة الطلب", "Continue")} <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{tc("تأكيد الطلب", "Confirm Order")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-muted-foreground block mb-1">{tc("اسمك (اختياري)", "Your name (optional)")}</label>
              <Input
                placeholder={tc("اكتب اسمك لمناداتك عند الجاهزية", "Enter your name so we can call you")}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="text-lg py-5"
                data-testid="input-kiosk-name"
              />
            </div>
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              {cart.map(c => (
                <div key={itemKey(c.item)} className="flex justify-between text-sm">
                  <span>{isEn ? c.item.nameEn : c.item.nameAr} × {c.quantity}</span>
                  <span className="font-bold">{(c.item.price * c.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-black text-lg">
                <span>{tc("الإجمالي", "Total")}</span>
                <span className="text-primary">{cartTotal.toFixed(2)} <SarIcon /></span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">{tc("الدفع عند الاستلام نقداً أو بطاقة", "Pay at counter — cash or card")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" onClick={() => { setShowCheckout(false); setShowCart(true); }} data-testid="button-kiosk-back">
                <X className="w-4 h-4 mr-2" /> {tc("تعديل", "Edit")}
              </Button>
              <Button size="lg" onClick={() => placeOrderMutation.mutate()} disabled={placeOrderMutation.isPending} data-testid="button-kiosk-confirm">
                {placeOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {tc("تأكيد", "Confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
