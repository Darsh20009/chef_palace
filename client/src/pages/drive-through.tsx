import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslate } from "@/lib/useTranslate";
import { useCustomer } from "@/contexts/CustomerContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AddToCartModal } from "@/components/add-to-cart-modal";
import SarIcon from "@/components/sar-icon";
import chefsplaceLogo from "@assets/blackrose-logo.png";
import type { CoffeeItem } from "@shared/schema";
import {
  Car, ShoppingCart, X, Plus, Minus, ChevronRight,
  LogIn, UserPlus, Phone, Lock, User, Loader2,
  CheckCircle, Search, Coffee
} from "lucide-react";

interface CartEntry {
  item: CoffeeItem;
  quantity: number;
  selectedSize?: string;
  selectedAddons?: string[];
  notes?: string;
  unitPrice: number;
}

interface CarInfo {
  carType: string;
  carColor: string;
  plateNumber: string;
}

type ModalStep = "auth" | "car" | "confirm" | "done";
type AuthMode = "login" | "register";

export default function DriveThroughPage() {
  const tc = useTranslate();
  const { customer, setCustomer } = useCustomer();
  const { toast } = useToast();

  // Menu state
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [addToCartItem, setAddToCartItem] = useState<CoffeeItem | null>(null);
  const [showCart, setShowCart] = useState(false);

  // Modal flow state
  const [modalStep, setModalStep] = useState<ModalStep | null>(null);

  // Auth state
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Car info state
  const [carInfo, setCarInfo] = useState<CarInfo>({ carType: "", carColor: "", plateNumber: "" });
  const [carLoading, setCarLoading] = useState(false);

  // Order state
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const { data: items = [] } = useQuery<CoffeeItem[]>({ queryKey: ["/api/coffee-items"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/menu-categories"] });

  const categoryList = useMemo(() => {
    const cats = categories.map((c: any) => c.nameAr || c.name || c.id);
    return ["الكل", ...cats];
  }, [categories]);

  const filteredItems = useMemo(() => {
    let list = items.filter((it) => it.isAvailable !== 0);
    if (selectedCategory !== "الكل") {
      list = list.filter((it) => {
        const cat = categories.find((c: any) => c.id === it.category || c.nameAr === selectedCategory);
        return cat && (it.category === cat.id);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((it) => it.nameAr?.toLowerCase().includes(q) || it.nameEn?.toLowerCase().includes(q));
    }
    return list;
  }, [items, selectedCategory, searchQuery, categories]);

  const cartTotal = cart.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
  const cartCount = cart.reduce((sum, e) => sum + e.quantity, 0);

  function handleAddItem(cartData: any) {
    if (!addToCartItem) return;
    const item = addToCartItem;
    const qty = cartData.quantity || 1;
    const size = cartData.selectedSize !== "default" ? cartData.selectedSize : undefined;
    const addonIds = cartData.selectedAddons || [];
    const unitPrice = item.price || 0;
    setCart((prev) => {
      const key = `${item.id}-${size || ""}-${addonIds.join(",")}`;
      const existing = prev.find(
        (e) => `${e.item.id}-${e.selectedSize || ""}-${(e.selectedAddons || []).join(",")}` === key
      );
      if (existing) {
        return prev.map((e) =>
          `${e.item.id}-${e.selectedSize || ""}-${(e.selectedAddons || []).join(",")}` === key
            ? { ...e, quantity: e.quantity + qty }
            : e
        );
      }
      return [...prev, { item, quantity: qty, selectedSize: size, selectedAddons: addonIds, unitPrice }];
    });
    setAddToCartItem(null);
    toast({ title: tc("✅ أُضيف للسلة", "✅ Added to cart") });
  }

  function removeFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function changeQty(index: number, delta: number) {
    setCart((prev) =>
      prev
        .map((e, i) => (i === index ? { ...e, quantity: e.quantity + delta } : e))
        .filter((e) => e.quantity > 0)
    );
  }

  function handleCheckout() {
    if (cart.length === 0) {
      toast({ title: tc("السلة فارغة", "Cart is empty"), variant: "destructive" });
      return;
    }
    if (!customer) {
      setModalStep("auth");
    } else {
      setModalStep("car");
    }
  }

  async function handleAuth() {
    if (!authPhone.trim() || !authPassword.trim()) {
      toast({ title: tc("يرجى إدخال جميع البيانات", "Please fill all fields"), variant: "destructive" });
      return;
    }
    if (authMode === "register" && !authName.trim()) {
      toast({ title: tc("يرجى إدخال اسمك", "Please enter your name"), variant: "destructive" });
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        const res = await apiRequest("POST", "/api/customers/login", {
          phone: authPhone.trim(),
          password: authPassword.trim(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");
        setCustomer(data);
        if (data.carType || data.carColor || data.plateNumber) {
          setCarInfo({ carType: data.carType || "", carColor: data.carColor || "", plateNumber: data.plateNumber || "" });
        }
      } else {
        const res = await apiRequest("POST", "/api/customers/register", {
          name: authName.trim(),
          phone: authPhone.trim(),
          password: authPassword.trim(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");
        setCustomer(data);
      }
      setModalStep("car");
    } catch (err: any) {
      toast({ title: err.message || tc("خطأ في تسجيل الدخول", "Login error"), variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCarSubmit() {
    if (!carInfo.plateNumber.trim()) {
      toast({ title: tc("يرجى إدخال رقم اللوحة", "Please enter plate number"), variant: "destructive" });
      return;
    }
    setCarLoading(true);
    try {
      await apiRequest("PATCH", `/api/customers/${customer?.id}`, {
        carType: carInfo.carType,
        carColor: carInfo.carColor,
        plateNumber: carInfo.plateNumber,
      });
    } catch {
      // non-blocking
    } finally {
      setCarLoading(false);
    }
    setModalStep("confirm");
  }

  async function handlePlaceOrder() {
    setOrderLoading(true);
    try {
      const orderItems = cart.map((e) => ({
        itemId: e.item.id,
        name: e.item.nameAr || e.item.nameEn,
        quantity: e.quantity,
        price: e.unitPrice,
        selectedSize: e.selectedSize,
        selectedAddons: e.selectedAddons,
      }));

      const res = await apiRequest("POST", "/api/orders", {
        items: orderItems,
        totalAmount: cartTotal,
        orderType: "car-pickup",
        pickupType: "car",
        carPickup: true,
        carType: carInfo.carType,
        carColor: carInfo.carColor,
        plateNumber: carInfo.plateNumber,
        carInfo: { carType: carInfo.carType, carColor: carInfo.carColor, plateNumber: carInfo.plateNumber },
        customerInfo: {
          customerName: customer?.name || "",
          customerPhone: customer?.phone || "",
          customerId: customer?.id || "",
        },
        paymentMethod: "cash",
        paymentStatus: "pending",
        branchId: "default",
        notes: `Drive-Through - سيارة: ${carInfo.carType} ${carInfo.carColor} - لوحة: ${carInfo.plateNumber}`,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");
      setOrderNumber(data.orderNumber || data.id || "");
      setCart([]);
      setModalStep("done");
    } catch (err: any) {
      toast({ title: err.message || tc("حدث خطأ في الطلب", "Order error"), variant: "destructive" });
    } finally {
      setOrderLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="w-8 h-8 rounded-lg" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">مكان الشيف البخاري</p>
            <div className="flex items-center gap-1">
              <Car className="w-3 h-3 text-amber-400" />
              <p className="text-amber-400 text-xs font-medium">Drive-Through</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 bg-amber-500 hover:bg-amber-400 rounded-full transition-colors"
          data-testid="button-cart"
        >
          <ShoppingCart className="w-5 h-5 text-black" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -left-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-900/40 via-black to-black px-6 pt-10 pb-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 text-9xl">🚗</div>
          <div className="absolute bottom-2 left-4 text-6xl">☕</div>
        </div>
        <div className="relative">
          <Badge className="bg-amber-500 text-black font-bold mb-3 text-xs">🚘 اطلب من سيارتك</Badge>
          <h1 className="text-3xl font-black text-white mb-2 leading-tight">
            اطلب قهوتك<br />
            <span className="text-amber-400">بدون ما تنزل!</span>
          </h1>
          <p className="text-gray-400 text-sm">اختر طلبك وسنوصله لسيارتك مباشرةً</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-[#111]">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tc("ابحث عن منتج...", "Search...")}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 pr-9 text-sm"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-2 bg-[#111] overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {categoryList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-amber-500 text-black"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
              data-testid={`tab-category-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setAddToCartItem(item)}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl overflow-hidden text-right transition-all active:scale-95"
            data-testid={`card-item-${item.id}`}
          >
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.nameAr} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-amber-900/30 to-black flex items-center justify-center">
                <Coffee className="w-10 h-10 text-amber-600/50" />
              </div>
            )}
            <div className="p-3">
              <p className="text-white font-bold text-sm leading-tight mb-1">{item.nameAr}</p>
              {item.description && (
                <p className="text-gray-500 text-xs mb-2 line-clamp-1">{item.description}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <SarIcon className="w-3.5 h-3.5" />
                  {item.price}
                </div>
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 text-black" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Sticky Checkout Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-black/95 backdrop-blur border-t border-white/10 z-30">
          <Button
            onClick={handleCheckout}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-12 rounded-xl text-base"
            data-testid="button-checkout"
          >
            <ShoppingCart className="w-5 h-5 ml-2" />
            اطلب الآن — {cartTotal.toFixed(2)} ر.س
            <span className="mr-2 bg-black/20 rounded-full px-2 py-0.5 text-xs">{cartCount}</span>
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-[#111] rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-lg">🛒 سلة Drive-Through</h2>
                <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">السلة فارغة</p>
              ) : (
                <>
                  {cart.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 border-b border-white/10">
                      {entry.item.imageUrl ? (
                        <img src={entry.item.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-900/30 flex items-center justify-center">
                          <Coffee className="w-6 h-6 text-amber-600/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{entry.item.nameAr}</p>
                        {entry.selectedSize && <p className="text-gray-500 text-xs">{entry.selectedSize}</p>}
                        <p className="text-amber-400 text-sm font-bold">{(entry.unitPrice * entry.quantity).toFixed(2)} ر.س</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(i, -1)} className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white w-4 text-center">{entry.quantity}</span>
                        <button onClick={() => changeQty(i, 1)} className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center hover:bg-amber-400">
                          <Plus className="w-3 h-3 text-black" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-gray-400">الإجمالي</span>
                    <span className="text-amber-400 font-bold text-lg">{cartTotal.toFixed(2)} ر.س</span>
                  </div>
                  <Button
                    onClick={() => { setShowCart(false); handleCheckout(); }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-12 rounded-xl mt-4"
                    data-testid="button-cart-checkout"
                  >
                    متابعة الطلب
                    <ChevronRight className="w-5 h-5 mr-2" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add to Cart Modal (reuse existing) */}
      <AddToCartModal
        item={addToCartItem}
        isOpen={!!addToCartItem}
        onClose={() => setAddToCartItem(null)}
        onAddToCart={handleAddItem}
      />

      {/* ===== Auth Modal ===== */}
      <Dialog open={modalStep === "auth"} onOpenChange={(o) => !o && setModalStep(null)}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm mx-4" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" />
              {tc("تسجيل الدخول لإتمام الطلب", "Login to complete order")}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {authMode === "login"
                ? tc("ادخل رقم جوالك وكلمة المرور", "Enter your phone and password")
                : tc("أنشئ حساباً جديداً", "Create a new account")}
            </DialogDescription>
          </DialogHeader>

          {/* Tab Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => setAuthMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authMode === "login" ? "bg-amber-500 text-black" : "text-gray-400 hover:text-white"}`}
            >
              <LogIn className="w-4 h-4 inline ml-1" />
              دخول
            </button>
            <button
              onClick={() => setAuthMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${authMode === "register" ? "bg-amber-500 text-black" : "text-gray-400 hover:text-white"}`}
            >
              <UserPlus className="w-4 h-4 inline ml-1" />
              حساب جديد
            </button>
          </div>

          <div className="space-y-3">
            {authMode === "register" && (
              <div className="space-y-1">
                <Label className="text-gray-400 text-xs">الاسم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="اسمك الكامل"
                    className="bg-white/5 border-white/10 text-white pr-9"
                    data-testid="input-name"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs">رقم الجوال</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  type="tel"
                  className="bg-white/5 border-white/10 text-white pr-9"
                  data-testid="input-phone"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••"
                  type="password"
                  className="bg-white/5 border-white/10 text-white pr-9"
                  data-testid="input-password"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleAuth}
            disabled={authLoading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-11"
            data-testid="button-auth-submit"
          >
            {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === "login" ? "دخول" : "إنشاء حساب"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ===== Car Info Modal ===== */}
      <Dialog open={modalStep === "car"} onOpenChange={(o) => !o && setModalStep(null)}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm mx-4" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" />
              {tc("بيانات سيارتك", "Your Car Details")}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {tc("حتى نوصل طلبك لسيارتك بسرعة", "So we can deliver your order to your car")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs">نوع السيارة</Label>
              <Input
                value={carInfo.carType}
                onChange={(e) => setCarInfo((c) => ({ ...c, carType: e.target.value }))}
                placeholder="مثال: تويوتا كامري"
                className="bg-white/5 border-white/10 text-white"
                data-testid="input-car-type"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs">لون السيارة</Label>
              <Input
                value={carInfo.carColor}
                onChange={(e) => setCarInfo((c) => ({ ...c, carColor: e.target.value }))}
                placeholder="مثال: أبيض"
                className="bg-white/5 border-white/10 text-white"
                data-testid="input-car-color"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-400 text-xs">رقم اللوحة *</Label>
              <Input
                value={carInfo.plateNumber}
                onChange={(e) => setCarInfo((c) => ({ ...c, plateNumber: e.target.value }))}
                placeholder="مثال: ABC 1234"
                className="bg-white/5 border-amber-500/50 text-white"
                data-testid="input-plate"
              />
            </div>
          </div>

          <Button
            onClick={handleCarSubmit}
            disabled={carLoading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-11"
            data-testid="button-car-submit"
          >
            {carLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>متابعة <ChevronRight className="w-4 h-4 mr-1" /></>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ===== Order Confirmation Modal ===== */}
      <Dialog open={modalStep === "confirm"} onOpenChange={(o) => !o && setModalStep(null)}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm mx-4" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white">تأكيد الطلب</DialogTitle>
          </DialogHeader>

          <div className="bg-white/5 rounded-xl p-3 space-y-2">
            {cart.map((e, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-300">{e.item.nameAr} × {e.quantity}</span>
                <span className="text-amber-400">{(e.unitPrice * e.quantity).toFixed(2)} ر.س</span>
              </div>
            ))}
            <Separator className="bg-white/10" />
            <div className="flex justify-between font-bold">
              <span>الإجمالي</span>
              <span className="text-amber-400">{cartTotal.toFixed(2)} ر.س</span>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm space-y-1">
            <p className="text-amber-400 font-medium flex items-center gap-1"><Car className="w-4 h-4" /> سيارتك</p>
            <p className="text-gray-300">{carInfo.carType} • {carInfo.carColor}</p>
            <p className="text-gray-300 font-mono">{carInfo.plateNumber}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 text-sm">
            <p className="text-gray-400">العميل: <span className="text-white">{customer?.name}</span></p>
            <p className="text-gray-400">الجوال: <span className="text-white">{customer?.phone}</span></p>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={orderLoading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-12 text-base"
            data-testid="button-place-order"
          >
            {orderLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>✅ تأكيد الطلب — {cartTotal.toFixed(2)} ر.س</>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ===== Done Modal ===== */}
      <Dialog open={modalStep === "done"} onOpenChange={() => {}}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm mx-4 text-center" dir="rtl">
          <div className="py-4">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-white text-xl font-black mb-2">طلبك في الطريق! 🚗☕</h2>
            <p className="text-gray-400 text-sm mb-4">تفضل بالانتظار في سيارتك، سنوصلك طلبك قريباً</p>

            {orderNumber && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                <p className="text-amber-400 text-xs mb-1">رقم الطلب</p>
                <p className="text-white text-2xl font-black">#{orderNumber}</p>
              </div>
            )}

            <div className="bg-white/5 rounded-xl p-3 text-sm text-right space-y-1">
              <p className="text-gray-400">سيارتك: <span className="text-white">{carInfo.carType} {carInfo.carColor}</span></p>
              <p className="text-gray-400">اللوحة: <span className="text-white font-mono">{carInfo.plateNumber}</span></p>
            </div>

            <Button
              onClick={() => { setModalStep(null); }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-11 mt-4"
            >
              طلب آخر
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
