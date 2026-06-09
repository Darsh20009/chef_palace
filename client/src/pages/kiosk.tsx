import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, ShoppingCart, Plus, Minus, X, Search,
  Store, ShoppingBag, Globe, CreditCard, Banknote, CheckCircle2, Loader2,
  Star, Sparkles, ArrowRight, User, Phone, Coffee, Trash2, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { brand } from "@/lib/brand";
import i18n from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import bannerImage1 from "@assets/image_1773902748715.png";
import bannerImage2 from "@assets/image_1773902748715.png";
import SarIcon from "@/components/sar-icon";

type Step = "splash" | "language" | "location" | "menu" | "cart" | "payment" | "processing" | "success";
type Location = "dine_in" | "takeaway";
type PaymentChoice = "online" | "counter_cash";

interface KioskItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  category: string;
  image?: string;
  isAvailable?: boolean;
  isBestSeller?: boolean;
  rating?: number;
  isReservation?: boolean;
}

interface KioskCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  order?: number;
}

interface KioskCartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

const VAT_RATE = 0.15;

export default function KioskPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/kiosk/:branchId");
  const branchId = params?.branchId;
  const { i18n: i18nHook } = useTranslation();
  const { toast } = useToast();

  // ───── State ─────
  const [step, setStep] = useState<Step>("splash");
  const [lang, setLang] = useState<"ar" | "en">(i18nHook.language === "en" ? "en" : "ar");
  const [diningLocation, setDiningLocation] = useState<Location | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<KioskCartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice | null>(null);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  // Apply language to i18n + html dir whenever kiosk language changes
  useEffect(() => {
    if (i18nHook.language !== lang) i18nHook.changeLanguage(lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang]);

  // Idle reset: any time the user is inactive for 3 minutes on a non-splash screen, return to splash
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (step !== "splash" && step !== "processing" && step !== "success") {
        idleTimerRef.current = setTimeout(() => resetSession(), 3 * 60 * 1000);
      }
    };
    const events = ["mousedown", "touchstart", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [step]);

  // Auto-go to success page → splash after 30s
  useEffect(() => {
    if (step === "success") {
      const t = setTimeout(() => resetSession(), 30 * 1000);
      return () => clearTimeout(t);
    }
  }, [step]);

  const resetSession = () => {
    setStep("splash");
    setDiningLocation(null);
    setActiveCategory("all");
    setSearch("");
    setCart([]);
    setShowCart(false);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentChoice(null);
    setOrderResult(null);
  };

  // ───── Data ─────
  const { data: itemsRaw = [], isLoading: itemsLoading } = useQuery<KioskItem[]>({
    queryKey: ["/api/coffee-items"],
    staleTime: 60_000,
  });

  const { data: categoriesRaw = [] } = useQuery<KioskCategory[]>({
    queryKey: ["/api/menu-categories"],
    staleTime: 60_000,
  });

  const items = useMemo(
    () => itemsRaw.filter((i) => i.isAvailable !== false && !i.isReservation),
    [itemsRaw]
  );

  const categories = useMemo(() => {
    const sorted = [...categoriesRaw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sorted;
  }, [categoriesRaw]);

  const bestSellers = useMemo(
    () => items.filter((i) => i.isBestSeller).slice(0, 8),
    [items]
  );

  const filteredItems = useMemo(() => {
    let arr = items;
    if (activeCategory !== "all" && activeCategory !== "best") {
      arr = arr.filter((i) => i.category === activeCategory);
    } else if (activeCategory === "best") {
      arr = arr.filter((i) => i.isBestSeller);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (i) =>
          i.nameAr.toLowerCase().includes(q) ||
          (i.nameEn || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [items, activeCategory, search]);

  // ───── Cart helpers ─────
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartSubtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartTax = cartSubtotal - cartSubtotal / (1 + VAT_RATE);
  const cartTotal = cartSubtotal;

  const addToCart = (item: KioskItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: isAr ? item.nameAr : item.nameEn || item.nameAr,
          price: Number(item.price) || 0,
          quantity: 1,
          image: item.image,
        },
      ];
    });
    toast({
      title: t("تمت الإضافة ✓", "Added to cart ✓"),
      description: isAr ? item.nameAr : item.nameEn || item.nameAr,
      duration: 1500,
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((c) => c.itemId !== id));

  // ───── Order submission ─────
  const validatePhone = (p: string) => /^(05\d{8}|5\d{8}|9665\d{8}|\+9665\d{8})$/.test(p.replace(/\s/g, ""));

  const submitOrder = async () => {
    if (!paymentChoice) return;
    if (!customerName.trim() || !validatePhone(customerPhone)) {
      toast({
        title: t("معلومات ناقصة", "Missing info"),
        description: t("الاسم ورقم الجوال مطلوبان", "Name and phone are required"),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    setStep("processing");

    try {
      const orderItems = cart.map((c) => ({
        coffeeItemId: c.itemId,
        productId: c.itemId,
        name: c.name,
        nameAr: c.name,
        quantity: c.quantity,
        unitPrice: c.price,
        price: c.price,
        totalPrice: c.price * c.quantity,
      }));

      const paymentMethod = paymentChoice === "counter_cash" ? "cash" : "card";

      const orderBody: any = {
        items: orderItems,
        customerInfo: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        },
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        totalAmount: cartTotal,
        subtotal: cartTotal / (1 + VAT_RATE),
        tax: cartTax,
        paymentMethod,
        orderType: diningLocation === "dine_in" ? "dine_in" : "takeaway",
        deliveryType: diningLocation === "dine_in" ? "dine_in" : "pickup",
        channel: "pos",
        source: "kiosk",
        status: paymentChoice === "counter_cash" ? "pending" : "pending",
        notes: t("طلب عبر الكيوسك الذاتي", "Self-order kiosk"),
        ...(branchId ? { branchId } : {}),
      };

      const orderRes = await apiRequest("POST", "/api/orders", orderBody);
      const order = await orderRes.json();

      if (!order?.id && !order?._id) {
        throw new Error(order?.error || "Order creation failed");
      }
      const orderId = order.id || order._id;
      const orderNumber = order.orderNumber || order.id;

      // ── Online payment via PayMob/Geidea ──
      if (paymentChoice === "online") {
        const returnUrl = `${window.location.origin}/kiosk?paid=1&order=${orderId}`;
        const payRes = await apiRequest("POST", "/api/payments/init", {
          amount: cartTotal,
          orderId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          returnUrl,
        });
        const pay = await payRes.json();
        if (pay?.redirectUrl || pay?.paymentUrl) {
          // Redirect to gateway. After payment, return URL handles confirmation.
          window.location.href = pay.redirectUrl || pay.paymentUrl;
          return;
        } else {
          throw new Error(pay?.error || t("تعذّر إنشاء رابط الدفع", "Failed to create payment link"));
        }
      }

      // ── Cash at cashier path ──
      setOrderResult({ orderId, orderNumber, total: cartTotal });
      setStep("success");
    } catch (err: any) {
      console.error("[Kiosk] submitOrder error:", err);
      toast({
        title: t("فشل إنشاء الطلب", "Order failed"),
        description: err?.message || t("حاول مرة أخرى", "Please try again"),
        variant: "destructive",
      });
      setStep("payment");
    } finally {
      setSubmitting(false);
    }
  };

  // ───── UI ─────
  return (
    <div dir={dir} className="min-h-screen bg-white text-foreground font-ibm-arabic select-none">
      <AnimatePresence mode="wait">
        {step === "splash" && <SplashScreen key="splash" onStart={() => setStep("language")} t={t} />}
        {step === "language" && (
          <LanguageScreen
            key="language"
            current={lang}
            onPick={(l) => {
              setLang(l);
              setStep("location");
            }}
            onBack={() => setStep("splash")}
            t={t}
          />
        )}
        {step === "location" && (
          <LocationScreen
            key="location"
            onPick={(loc) => {
              setDiningLocation(loc);
              setStep("menu");
            }}
            onBack={() => setStep("language")}
            t={t}
          />
        )}
        {step === "menu" && (
          <MenuScreen
            key="menu"
            t={t}
            isAr={isAr}
            items={filteredItems}
            allItems={items}
            bestSellers={bestSellers}
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            search={search}
            setSearch={setSearch}
            loading={itemsLoading}
            onAdd={addToCart}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onOpenCart={() => setStep("cart")}
            onBack={() => setStep("location")}
            diningLocation={diningLocation}
          />
        )}
        {step === "cart" && (
          <CartScreen
            key="cart"
            t={t}
            cart={cart}
            updateQty={updateQty}
            removeItem={removeItem}
            subtotal={cartSubtotal}
            tax={cartTax}
            total={cartTotal}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            onContinue={() => {
              if (!customerName.trim() || !validatePhone(customerPhone)) {
                toast({
                  title: t("معلومات ناقصة", "Missing info"),
                  description: t("الاسم ورقم جوال صحيح مطلوبان", "Valid name and phone required"),
                  variant: "destructive",
                });
                return;
              }
              setStep("payment");
            }}
            onBack={() => setStep("menu")}
            diningLocation={diningLocation}
          />
        )}
        {step === "payment" && (
          <PaymentScreen
            key="payment"
            t={t}
            choice={paymentChoice}
            setChoice={setPaymentChoice}
            total={cartTotal}
            onConfirm={submitOrder}
            onBack={() => setStep("cart")}
            submitting={submitting}
          />
        )}
        {step === "processing" && <ProcessingScreen key="processing" t={t} />}
        {step === "success" && (
          <SuccessScreen
            key="success"
            t={t}
            order={orderResult}
            paymentChoice={paymentChoice}
            onNew={resetSession}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          SPLASH SCREEN
// ═══════════════════════════════════════════════════════════════════
function SplashScreen({ onStart, t }: { onStart: () => void; t: (ar: string, en: string) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen relative flex flex-col"
      data-testid="kiosk-splash"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={bannerImage1} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/85" />
      </div>

      {/* Glow accents */}
      <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/25 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 text-center text-white">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="w-40 h-40 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-5 shadow-2xl">
            <img src={brand.logoCustomer} alt={brand.nameEn} className="w-full h-full object-contain" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-5xl md:text-7xl font-black tracking-tight mb-3"
        >
          {brand.nameEn}
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg md:text-xl text-white/80 mb-12 tracking-wide"
        >
          {brand.taglineEn}
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          data-testid="button-start-self-order"
          className="group relative px-12 py-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-2xl shadow-primary/40 flex items-center gap-4 text-2xl font-bold transition-all"
        >
          <Sparkles className="w-6 h-6" />
          <span>{t("ابدأ رحلتك للطلب الذاتي", "Start Your Self-Order Journey")}</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-sm text-white/60 tracking-widest uppercase"
        >
          {t("اضغط في أي مكان للبدء", "Touch anywhere to start")}
        </motion.p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          LANGUAGE SCREEN
// ═══════════════════════════════════════════════════════════════════
function LanguageScreen({
  current, onPick, onBack, t,
}: { current: "ar" | "en"; onPick: (l: "ar" | "en") => void; onBack: () => void; t: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="min-h-screen flex flex-col bg-gradient-to-br from-white via-slate-50 to-primary/5"
      data-testid="kiosk-language"
    >
      <KioskHeader onBack={onBack} title={t("اختر اللغة", "Select Language")} step={1} total={5} t={t} />

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          {[
            { code: "ar" as const, name: "العربية", english: "Arabic", flag: "🇸🇦" },
            { code: "en" as const, name: "English", english: "English", flag: "🇬🇧" },
          ].map((opt) => (
            <motion.button
              key={opt.code}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(opt.code)}
              data-testid={`button-lang-${opt.code}`}
              className={`group relative p-10 rounded-3xl border-2 transition-all shadow-md hover:shadow-2xl ${
                current === opt.code
                  ? "border-primary bg-primary/5 shadow-primary/20"
                  : "border-border bg-white hover:border-primary/50"
              }`}
            >
              <div className="text-7xl mb-5">{opt.flag}</div>
              <div className="text-3xl font-black text-foreground mb-1">{opt.name}</div>
              <div className="text-sm text-muted-foreground tracking-widest uppercase">{opt.english}</div>
              {current === opt.code && (
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          LOCATION SCREEN
// ═══════════════════════════════════════════════════════════════════
function LocationScreen({
  onPick, onBack, t,
}: { onPick: (loc: Location) => void; onBack: () => void; t: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="min-h-screen flex flex-col bg-gradient-to-br from-white via-slate-50 to-primary/5"
      data-testid="kiosk-location"
    >
      <KioskHeader onBack={onBack} title={t("أين ستتناول الطلب؟", "Where will you enjoy your order?")} step={2} total={5} t={t} />

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
          {[
            {
              id: "dine_in" as const,
              icon: Store,
              title: t("داخل المطعم", "Dine-In"),
              desc: t("استمتع بالطلب في المقهى", "Enjoy your order in the cafe"),
              gradient: "from-primary/15 to-emerald-100",
            },
            {
              id: "takeaway" as const,
              icon: ShoppingBag,
              title: t("خارج المطعم", "Takeaway"),
              desc: t("جاهز للأخذ معك", "Take it on the go"),
              gradient: "from-blue-100 to-cyan-100",
            },
          ].map((opt) => (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(opt.id)}
              data-testid={`button-location-${opt.id}`}
              className={`group relative p-12 rounded-3xl border-2 border-border bg-gradient-to-br ${opt.gradient} hover:border-primary transition-all shadow-md hover:shadow-2xl text-start`}
            >
              <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center mb-6">
                <opt.icon className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-3xl font-black text-foreground mb-2">{opt.title}</h3>
              <p className="text-base text-muted-foreground">{opt.desc}</p>
              <ArrowRight className="absolute top-1/2 -translate-y-1/2 end-6 w-8 h-8 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all rtl:rotate-180" />
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          MENU SCREEN
// ═══════════════════════════════════════════════════════════════════
function MenuScreen(props: any) {
  const {
    t, isAr, items, bestSellers, categories, activeCategory, setActiveCategory,
    search, setSearch, loading, onAdd, cartCount, cartTotal, onOpenCart, onBack, diningLocation,
  } = props;

  const banners = [bannerImage1, bannerImage2];
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBannerIdx((p) => (p + 1) % banners.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col bg-slate-50"
      data-testid="kiosk-menu"
    >
      <KioskHeader
        onBack={onBack}
        title={diningLocation === "dine_in" ? t("داخل المطعم", "Dine-In") : t("خارج المطعم", "Takeaway")}
        step={3}
        total={5}
        t={t}
      />

      {/* Hero Banner */}
      <div className="px-6 pt-6">
        <div className="relative h-44 md:h-56 rounded-3xl overflow-hidden shadow-lg">
          <AnimatePresence mode="wait">
            <motion.img
              key={bannerIdx}
              src={banners[bannerIdx]}
              alt=""
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-center px-8 text-white">
            <p className="text-sm font-bold text-primary mb-1 tracking-widest uppercase">{t("القائمة", "Menu")}</p>
            <h2 className="text-3xl md:text-4xl font-black mb-2">{t("اختر ما تشتهي ☕", "Pick your favorites ☕")}</h2>
            <p className="text-sm text-white/80">{t("جودة فاخرة • تحضير فوري", "Premium quality • Freshly prepared")}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 pt-4">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ابحث عن منتج...", "Search products...")}
            className="ps-12 h-14 rounded-2xl bg-white border-border text-base"
            data-testid="input-kiosk-search"
          />
        </div>
      </div>

      {/* Body: sidebar + items */}
      <div className="flex-1 flex gap-4 px-6 py-4 overflow-hidden">
        {/* Sidebar categories */}
        <aside className="w-44 md:w-52 shrink-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 pe-2">
              <CategoryPill
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
                label={t("الكل", "All")}
                icon="🍽️"
                count={items.length}
              />
              <CategoryPill
                active={activeCategory === "best"}
                onClick={() => setActiveCategory("best")}
                label={t("الأكثر مبيعاً", "Best Sellers")}
                icon="🔥"
                count={bestSellers.length}
                highlight
              />
              {categories.map((c: KioskCategory) => (
                <CategoryPill
                  key={c.id}
                  active={activeCategory === c.id}
                  onClick={() => setActiveCategory(c.id)}
                  label={isAr ? c.nameAr : c.nameEn || c.nameAr}
                  icon={c.icon || "☕"}
                />
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Items grid */}
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pe-2">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-64 rounded-2xl bg-white animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <Coffee className="w-20 h-20 text-muted-foreground mb-4" />
                <p className="text-lg font-bold text-muted-foreground">{t("لا توجد منتجات", "No products found")}</p>
              </div>
            ) : (
              <>
                {activeCategory === "all" && bestSellers.length > 0 && !search && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-primary fill-primary" />
                      <h3 className="text-lg font-black">{t("الأكثر مبيعاً", "Best Sellers")}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                      {bestSellers.slice(0, 4).map((it: KioskItem) => (
                        <ItemCard key={`best-${it.id}`} item={it} isAr={isAr} onAdd={onAdd} highlight />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-32">
                  {items.map((it: KioskItem) => (
                    <ItemCard key={it.id} item={it} isAr={isAr} onAdd={onAdd} />
                  ))}
                </div>
              </>
            )}
          </ScrollArea>
        </main>
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-30 px-6 pb-5"
        >
          <button
            onClick={onOpenCart}
            data-testid="button-open-cart"
            className="w-full max-w-3xl mx-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6 py-4 shadow-2xl shadow-primary/40 flex items-center justify-between gap-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-6 h-6" />
                <Badge className="absolute -top-2 -end-2 bg-white text-primary text-[10px] h-5 min-w-5 px-1 rounded-full font-black">
                  {cartCount}
                </Badge>
              </div>
              <span className="font-bold text-lg">{t("عرض السلة", "View Cart")}</span>
            </div>
            <div className="flex items-center gap-2 text-lg font-black">
              <span>{cartTotal.toFixed(2)}</span>
              <SarIcon />
              <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" />
            </div>
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

function CategoryPill({
  active, onClick, label, icon, count, highlight,
}: { active: boolean; onClick: () => void; label: string; icon: string; count?: number; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      data-testid={`category-${label}`}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-start transition-all border ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
          : highlight
          ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
          : "bg-white border-border hover:bg-slate-50 text-foreground"
      }`}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <span className="text-sm font-bold flex-1 truncate">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ItemCard({ item, isAr, onAdd, highlight }: { item: KioskItem; isAr: boolean; onAdd: (i: KioskItem) => void; highlight?: boolean }) {
  const name = isAr ? item.nameAr : item.nameEn || item.nameAr;
  const desc = isAr ? item.descriptionAr : item.descriptionEn || item.descriptionAr;
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onAdd(item)}
      data-testid={`item-${item.id}`}
      className={`group bg-white rounded-2xl overflow-hidden border ${
        highlight ? "border-primary/40 shadow-md shadow-primary/10" : "border-border"
      } hover:border-primary hover:shadow-xl transition-all text-start flex flex-col`}
    >
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Coffee className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        {item.isBestSeller && (
          <Badge className="absolute top-2 start-2 bg-primary text-primary-foreground text-[10px] font-black">
            <Star className="w-3 h-3 me-1 fill-current" />
            {isAr ? "الأكثر مبيعاً" : "Best Seller"}
          </Badge>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h4 className="font-bold text-sm line-clamp-1 mb-1">{name}</h4>
        {desc && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{desc}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 font-black text-primary">
            <span className="text-lg">{Number(item.price).toFixed(2)}</span>
            <SarIcon />
          </div>
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          CART SCREEN
// ═══════════════════════════════════════════════════════════════════
function CartScreen(props: any) {
  const {
    t, cart, updateQty, removeItem, subtotal, tax, total,
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    onContinue, onBack, diningLocation,
  } = props;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="min-h-screen flex flex-col bg-slate-50"
      data-testid="kiosk-cart"
    >
      <KioskHeader onBack={onBack} title={t("سلة الطلب", "Your Order")} step={4} total={5} t={t} />

      <div className="flex-1 px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl w-full mx-auto">
        {/* Items list */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="bg-white border-border">
            <CardContent className="p-5">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                {t("الأصناف", "Items")} ({cart.length})
              </h3>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-40" />
                  <p>{t("السلة فارغة", "Cart is empty")}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-3 pe-2">
                    {cart.map((c: KioskCartItem) => (
                      <div key={c.itemId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl" data-testid={`cart-item-${c.itemId}`}>
                        <div className="w-14 h-14 rounded-xl bg-white border border-border overflow-hidden shrink-0">
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Coffee className="w-6 h-6 text-muted-foreground/40" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {c.price.toFixed(2)} <SarIcon /> × {c.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-border p-1">
                          <button onClick={() => updateQty(c.itemId, -1)} className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center" data-testid={`button-decrease-${c.itemId}`}>
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-7 text-center font-bold text-sm">{c.quantity}</span>
                          <button onClick={() => updateQty(c.itemId, 1)} className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center" data-testid={`button-increase-${c.itemId}`}>
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="font-black text-primary text-sm flex items-center gap-1 w-20 justify-end">
                          {(c.price * c.quantity).toFixed(2)} <SarIcon />
                        </div>
                        <button onClick={() => removeItem(c.itemId)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center" data-testid={`button-remove-${c.itemId}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card className="bg-white border-border">
            <CardContent className="p-5">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {t("معلومات العميل", "Customer Info")}
                <Badge variant="destructive" className="text-[10px]">{t("مطلوب", "Required")}</Badge>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">
                    {t("الاسم", "Name")} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t("اسمك الكامل", "Your full name")}
                    className="h-12 text-base"
                    data-testid="input-customer-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">
                    {t("رقم الجوال", "Phone")} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    className="h-12 text-base"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="bg-white border-border sticky top-4">
            <CardContent className="p-5">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                {t("ملخص الطلب", "Order Summary")}
              </h3>
              <div className="space-y-2 mb-4 text-sm">
                <Row label={t("النوع", "Type")} value={diningLocation === "dine_in" ? t("داخل المطعم", "Dine-In") : t("خارج المطعم", "Takeaway")} />
                <Row label={t("عدد الأصناف", "Items")} value={cart.reduce((s: number, c: KioskCartItem) => s + c.quantity, 0).toString()} />
              </div>
              <Separator className="my-3" />
              <div className="space-y-2 text-sm">
                <RowAmount label={t("المجموع قبل الضريبة", "Subtotal")} amount={subtotal / (1 + 0.15)} />
                <RowAmount label={t("ضريبة القيمة المضافة 15%", "VAT 15%")} amount={tax} />
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between font-black text-xl">
                <span>{t("الإجمالي", "Total")}</span>
                <span className="flex items-center gap-1 text-primary">
                  {total.toFixed(2)} <SarIcon />
                </span>
              </div>
              <Button
                onClick={onContinue}
                disabled={cart.length === 0}
                className="w-full h-14 mt-5 text-lg font-bold"
                data-testid="button-continue-to-payment"
              >
                {t("متابعة الدفع", "Continue to Payment")}
                <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
function RowAmount({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold flex items-center gap-1">{amount.toFixed(2)} <SarIcon /></span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          PAYMENT SCREEN
// ═══════════════════════════════════════════════════════════════════
function PaymentScreen({
  t, choice, setChoice, total, onConfirm, onBack, submitting,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="min-h-screen flex flex-col bg-slate-50"
      data-testid="kiosk-payment"
    >
      <KioskHeader onBack={onBack} title={t("اختر طريقة الدفع", "Choose Payment Method")} step={5} total={5} t={t} />

      <div className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto">
        <div className="bg-white rounded-3xl border border-border p-6 mb-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">{t("الإجمالي المستحق", "Amount Due")}</p>
          <p className="text-5xl font-black text-primary flex items-center justify-center gap-2">
            {total.toFixed(2)} <SarIcon />
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PaymentOption
            active={choice === "online"}
            onClick={() => setChoice("online")}
            icon={CreditCard}
            title={t("الدفع الإلكتروني", "Pay Online")}
            desc={t("بطاقة بنكية / Apple Pay / مدى", "Card / Apple Pay / mada")}
            badge={t("PayMob", "PayMob")}
            color="primary"
            testid="payment-online"
          />
          <PaymentOption
            active={choice === "counter_cash"}
            onClick={() => setChoice("counter_cash")}
            icon={Banknote}
            title={t("ادفع عند الكاشير", "Pay at Counter")}
            desc={t("نقداً عند استلام الطلب", "Cash on pickup")}
            badge={t("نقدي", "Cash")}
            color="emerald"
            testid="payment-counter"
          />
        </div>

        <Button
          onClick={onConfirm}
          disabled={!choice || submitting}
          className="w-full h-16 mt-8 text-xl font-black"
          data-testid="button-confirm-payment"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 me-2 animate-spin" /> {t("جارٍ الإنشاء...", "Creating...")}</>
          ) : (
            <>{t("تأكيد الطلب", "Confirm Order")} <ArrowRight className="w-6 h-6 ms-2 rtl:rotate-180" /></>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function PaymentOption({ active, onClick, icon: Icon, title, desc, badge, color, testid }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={`button-${testid}`}
      className={`relative p-6 rounded-3xl border-2 bg-white text-start transition-all ${
        active ? "border-primary shadow-xl shadow-primary/20" : "border-border hover:border-primary/50"
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4`}>
        <Icon className="w-7 h-7 text-primary" />
      </div>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-xl font-black">{title}</h3>
        <Badge variant="outline" className="text-[10px]">{badge}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
      {active && (
        <div className="absolute top-4 end-4 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          PROCESSING SCREEN
// ═══════════════════════════════════════════════════════════════════
function ProcessingScreen({ t }: { t: any }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={brand.logoCustomer} alt="" className="w-16 h-16 object-contain" />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{t("جارٍ إنشاء طلبك...", "Creating your order...")}</p>
      <p className="text-sm text-muted-foreground mt-2">{t("لحظات من فضلك", "Just a moment please")}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════
function SuccessScreen({ t, order, paymentChoice, onNew }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white via-primary/5 to-emerald-50 p-6"
      data-testid="kiosk-success"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
        className="w-32 h-32 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/40 mb-6"
      >
        <CheckCircle2 className="w-20 h-20 text-primary-foreground" />
      </motion.div>

      <h2 className="text-4xl font-black text-foreground mb-2">{t("تم استلام طلبك بنجاح", "Order Received!")}</h2>
      <p className="text-muted-foreground mb-8">{t("سيتم تحضير طلبك حالاً", "Your order will be prepared shortly")}</p>

      <Card className="w-full max-w-md bg-white border-border shadow-xl mb-6">
        <CardContent className="p-6 space-y-3">
          <div className="text-center pb-3 border-b">
            <p className="text-xs text-muted-foreground mb-1">{t("رقم الطلب", "Order Number")}</p>
            <p className="text-3xl font-black text-primary" data-testid="text-order-number">
              #{order?.orderNumber || order?.orderId?.slice(-6).toUpperCase() || "—"}
            </p>
          </div>
          <Row label={t("الإجمالي", "Total")} value={`${(order?.total || 0).toFixed(2)} ر.س`} />
          {paymentChoice === "counter_cash" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-amber-900">
                💰 {t("توجّه إلى الكاشير لإتمام الدفع", "Please pay at the counter")}
              </p>
            </div>
          )}
          {paymentChoice === "online" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-emerald-900">
                ✓ {t("تم الدفع بنجاح", "Payment completed")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={onNew} size="lg" className="h-14 px-10 text-lg font-bold" data-testid="button-new-order">
        {t("طلب جديد", "New Order")}
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">{t("ستعود الشاشة تلقائياً بعد 30 ثانية", "Auto-resetting in 30 seconds")}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//                          KIOSK HEADER
// ═══════════════════════════════════════════════════════════════════
function KioskHeader({
  onBack, title, step, total, t,
}: { onBack: () => void; title: string; step: number; total: number; t: any }) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-border px-6 py-4">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <button
          onClick={onBack}
          data-testid="button-kiosk-back"
          className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-5 h-5 rtl:hidden" />
          <ChevronLeft className="w-5 h-5 ltr:hidden" />
        </button>

        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={brand.logoCustomer} alt="" className="w-7 h-7 object-contain" />
            <h2 className="text-base md:text-lg font-black truncate">{title}</h2>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i + 1 <= step ? "w-8 bg-primary" : "w-4 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-black text-primary">{step}/{total}</span>
        </div>
      </div>
    </header>
  );
}
