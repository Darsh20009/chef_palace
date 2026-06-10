import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PWAInstallButton } from "@/components/pwa-install";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLocation } from "wouter";
import { 
  ShoppingCart, 
  Flame, 
  Snowflake, 
  Star, 
  Cake, 
  User, 
  Plus, 
  Search, 
  QrCode, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Utensils, 
  Sparkles,
  Tag,
  Gift,
  Languages,
  Package,
  X,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import banner1 from "@assets/Screenshot_2026-06-10_at_2.11.54_PM_1781089962059.png";
import banner2 from "@assets/Screenshot_2026-06-10_at_2.11.54_PM_1781089962059.png";
import qiroxLogo from "@assets/qirox-logo-customer.png";
import type { CoffeeItem, IProductAddon, IPromoOffer } from "@shared/schema";
import { AddToCartModal } from "@/components/add-to-cart-modal";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ClassicMenuLayout, CardsMenuLayout, ListMenuLayout } from "@/components/menu-layouts";
import type { AddonPreview } from "@/components/menu-layouts";
import SarIcon from "@/components/sar-icon";

interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department?: 'drinks' | 'food';
  orderIndex: number;
  isSystem?: boolean;
}

export default function MenuPage() {
  const tc = useTranslate();
  const { cartItems, addToCart } = useCartStore();
  const { isAuthenticated, customer } = useCustomer();
  const queryClient = useQueryClient();

  const customerPhone = (customer as any)?.phone || (customer as any)?.phoneNumber;

  const { data: favData } = useQuery<{ favorites: string[] }>({
    queryKey: ['/api/customers/favorites', customerPhone],
    enabled: !!(isAuthenticated && customerPhone),
    queryFn: () => fetch('/api/customers/favorites?phone=' + encodeURIComponent(customerPhone || '')).then(r => r.json()),
  });
  const favoriteIds = new Set<string>(favData?.favorites || []);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const isFav = favoriteIds.has(itemId);
      if (isFav) {
        return fetch('/api/customers/favorites/' + itemId + '?phone=' + encodeURIComponent(customerPhone || ''), { method: 'DELETE' }).then(r => r.json());
      } else {
        return fetch('/api/customers/favorites/' + itemId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: customerPhone }) }).then(r => r.json());
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/customers/favorites', customerPhone] }),
  });

  const handleToggleFavorite = (itemId: string) => {
    if (!isAuthenticated || !customerPhone) {
      toast({ title: tc('يجب تسجيل الدخول لإضافة المفضلة', 'Please log in to add favorites'), variant: 'destructive' });
      return;
    }
    toggleFavoriteMutation.mutate(itemId);
  };
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<CoffeeItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  const { data: customBanners = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-banners"],
  });

  const isStoreOpen = () => {
    if (!businessConfig) return true;
    if (businessConfig.isEmergencyClosed) return false;

    const storeHours = businessConfig.storeHours || {};
    const isAlwaysOpenGlobal = Object.values(storeHours).every((h: any) => h?.isAlwaysOpen || (h?.open === "00:00" && h?.close === "23:59"));
    
    if (isAlwaysOpenGlobal) return true;

    const now = new Date();
    // Saudi Time is UTC+3
    const riyadhTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long'
    }).formatToParts(now);

    const currentDay = riyadhTime.find(p => p.type === 'weekday')?.value.toLowerCase() || 'monday';
    const currentHour = parseInt(riyadhTime.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(riyadhTime.find(p => p.type === 'minute')?.value || '0');
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const hours = businessConfig.storeHours?.[currentDay];

    if (!hours || !hours.isOpen) return false;
    if (hours.isAlwaysOpen || (hours.open === '00:00' && hours.close === '23:59')) return true;

    const [openH, openM] = (hours.open || '06:00').split(':').map(Number);
    const [closeH, closeM] = (hours.close || '03:00').split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;

    // Handle overnight hours (e.g., 6 AM to 3 AM next day)
    if (closeMinutes <= openMinutes) {
      if (currentTimeInMinutes >= openMinutes || currentTimeInMinutes <= closeMinutes) return true;
    } else {
      if (currentTimeInMinutes >= openMinutes && currentTimeInMinutes <= closeMinutes) return true;
    }

    return false;
  };

  const getStatusMessage = () => {
    if (!businessConfig) return null;
    if (businessConfig.isEmergencyClosed) return tc("نعتذر، المطعم مغلق حالياً لظروف طارئة", "Sorry, the restaurant is temporarily closed due to an emergency");
    
    const isOpen = isStoreOpen();
    if (isOpen) return null;

    const nextOpening = businessConfig.currentStatus?.nextOpeningTime;
    if (nextOpening) {
      const { hours, minutes } = nextOpening;
      let timeStr = "";
      if (hours > 0) timeStr += `${hours} ساعة `;
      if (minutes > 0) timeStr += `${minutes} دقيقة`;
      return `المطعم مغلق حالياً، يفتح بعد ${timeStr}`;
    }

    return tc("المطعم مغلق حالياً", "The restaurant is currently closed");
  };

  const { data: coffeeItems = [], isLoading } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const { data: allAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/product-addons"],
  });

  const { data: itemsWithAddonsList = [] } = useQuery<string[]>({
    queryKey: ["/api/coffee-items/with-addons"],
    staleTime: 5 * 60 * 1000,
  });
  const itemsWithAddonsSet = useMemo(() => new Set(itemsWithAddonsList), [itemsWithAddonsList]);

  const { data: itemAddonsMap = {} } = useQuery<Record<string, AddonPreview[]>>({
    queryKey: ["/api/coffee-items/addons-preview"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: promoOffers = [] } = useQuery<IPromoOffer[]>({
    queryKey: ["/api/promo-offers"],
  });

  const { data: dynamicCategories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-categories"],
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  // ── Active Order Banner ─────────────────────────────────────────────
  const [activeOrderNum, setActiveOrderNum] = useState<string | null>(() =>
    localStorage.getItem("br-active-order")
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: activeOrder, isLoading: activeOrderLoading } = useQuery<any>({
    queryKey: ["/api/orders/number", activeOrderNum],
    queryFn: async () => {
      if (!activeOrderNum) return null;
      const res = await fetch(`/api/orders/number/${encodeURIComponent(activeOrderNum)}`);
      if (!res.ok) { localStorage.removeItem("br-active-order"); return null; }
      return res.json();
    },
    enabled: !!activeOrderNum && !bannerDismissed,
    refetchInterval: 20000,
    retry: false,
  });

  // Clear banner once order is completed or cancelled
  useEffect(() => {
    if (activeOrder?.status === 'completed' || activeOrder?.status === 'cancelled') {
      localStorage.removeItem("br-active-order");
      setActiveOrderNum(null);
    }
  }, [activeOrder?.status]);

  const showActiveBanner = !bannerDismissed && !!activeOrder && 
    !['completed','cancelled'].includes(activeOrder.status);

  const getActiveOrderStatusLabel = (status: string) => {
    const labels: Record<string,string> = {
      pending: 'في الانتظار', awaiting_payment: 'بانتظار الدفع',
      payment_confirmed: 'تم الدفع', in_progress: 'قيد التحضير',
      ready: 'جاهز للاستلام ✅', out_for_delivery: 'في الطريق إليك 🚗',
    };
    return labels[status] || status;
  };
  // ────────────────────────────────────────────────────────────────────

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const isBothModes = false; // Unified categories — no food/drink tab separation

  // Construct dynamic banners — memoized to prevent infinite re-renders
  const bannerSlides = useMemo(() => {
    const slides: any[] = [];

    // 1. Add custom admin banners first
    if (customBanners.length > 0) {
      customBanners.forEach((banner: any) => {
        slides.push({
          image: banner.imageUrl,
          title: i18n.language === 'ar' ? banner.titleAr : (banner.titleEn || banner.titleAr),
          subtitle: i18n.language === 'ar' ? banner.subtitleAr : (banner.subtitleEn || banner.subtitleAr),
          badge: i18n.language === 'ar' ? banner.badgeAr : (banner.badgeEn || banner.badgeAr),
          linkType: banner.linkType,
          linkId: banner.linkId,
          externalUrl: banner.externalUrl,
          couponCode: banner.couponCode,
          couponImageUrl: banner.couponImageUrl
        });
      });
    }

    // 2. Add fixed banner slides
    slides.push({
      image: banner1,
      badge: t("menu.banner.default1.badge"),
      title: t("menu.banner.default1.title"),
      subtitle: t("menu.banner.default1.subtitle"),
      linkType: "offer",
      couponCode: undefined,
      couponImageUrl: undefined
    });
    slides.push({
      image: banner2,
      badge: t("menu.banner.default2.badge"),
      title: t("menu.banner.default2.title"),
      subtitle: t("menu.banner.default2.subtitle"),
      linkType: "offer",
      couponCode: undefined,
      couponImageUrl: undefined
    });

    // 3. Add dynamic "Smart" slides based on inventory/products
    if (coffeeItems.length > 0) {
      // Find cheapest drink
      const sortedByPrice = [...coffeeItems].sort((a, b) => {
        const priceA = typeof a.price === 'number' ? a.price : parseFloat(String(a.price));
        const priceB = typeof b.price === 'number' ? b.price : parseFloat(String(b.price));
        return priceA - priceB;
      });
      const cheapest = sortedByPrice[0];
      const cheapestName = i18n.language === 'ar' ? cheapest?.nameAr : (cheapest?.nameEn || cheapest?.nameAr);
      if (cheapest) {
        slides.push({
          image: banner1,
          title: t("menu.banner.smart.cheapest_title", { name: cheapestName }),
          subtitle: t("menu.banner.smart.cheapest_subtitle"),
          badge: t("menu.banner.smart.cheapest_badge"),
          linkType: 'product',
          linkId: (cheapest as any).id,
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        });
      }

      const newest = [...coffeeItems].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
      const newestName = i18n.language === 'ar' ? newest?.nameAr : (newest?.nameEn || newest?.nameAr);
      if (newest && (newest as any).id !== (cheapest as any).id) {
        slides.push({
          image: banner1,
          title: t("menu.banner.smart.newest_title"),
          subtitle: t("menu.banner.smart.newest_subtitle", { name: newestName }),
          badge: t("menu.banner.smart.newest_badge"),
          linkType: 'product',
          linkId: (newest as any).id,
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        });
      }
    }

    // 4. Fallback to default slides if nothing else
    if (slides.length === 0) {
      slides.push(
        {
          image: banner1,
          title: t("banner.1.title"),
          subtitle: t("banner.1.subtitle"),
          badge: t("banner.1.badge"),
          linkType: 'product',
          linkId: "matcha-latte",
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        },
        {
          image: banner2,
          title: t("banner.2.title"),
          subtitle: t("banner.2.subtitle"),
          badge: t("banner.2.badge"),
          linkType: 'product',
          linkId: "vanilla-latte",
          externalUrl: undefined,
          couponCode: undefined,
          couponImageUrl: undefined
        }
      );
    }

    return slides;
  }, [customBanners, coffeeItems, promoOffers, i18n.language]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % bannerSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [bannerSlides.length]);

  const iconMap: Record<string, any> = {
    Coffee: Utensils, Flame, Snowflake, Star, Cake, Utensils, Sparkles, UtensilsCrossed: Utensils
  };

  const allTab = { id: "all", name: tc("الكل", "All"), icon: Utensils };

  const categories = [
    allTab,
    ...dynamicCategories.map(c => ({
      id: c.id,
      name: i18n.language === 'ar' ? c.nameAr : (c.nameEn || c.nameAr),
      icon: iconMap[c.icon || 'Coffee'] || Utensils,
    })),
  ];

  const bestSellers = coffeeItems
    .filter(item => (item as any).isBestSeller || (item as any).salesCount > 10 || item.category === 'food' || item.category === 'bakery')
    .sort((a, b) => {
      // Prioritize food in best sellers if it matches
      const aIsFood = a.category === 'food' || a.category === 'bakery';
      const bIsFood = b.category === 'food' || b.category === 'bakery';
      if (aIsFood && !bIsFood) return -1;
      if (!aIsFood && bIsFood) return 1;
      return ((b as any).salesCount || 0) - ((a as any).salesCount || 0);
    })
    .slice(0, 8);


  const getGroupingKey = (item: CoffeeItem): string => {
    // 1. Explicit groupId has highest priority
    if ((item as any).groupId) return `${item.category}::${(item as any).groupId}`;

    const nameAr = item.nameAr || "";
    if (!nameAr || typeof nameAr !== 'string') return `${item.category}::unknown`;

    // Remove common diacritics to normalise names
    const cleaned = nameAr.trim().replace(/^[\u064B-\u0652]+/, '');

    // Group items sharing the same FIRST TWO words AND same category
    // (e.g. "قهوة عربية صغير" + "قهوة عربية كبير" → same group;
    //  but "قهوة تركية" stays separate)
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const prefix = parts.slice(0, 2).join(' ') || parts[0] || 'unknown';
    return `${item.category}::${prefix}`;
  };

  const groupedItems = coffeeItems.reduce((acc: Record<string, CoffeeItem[]>, item) => {
    const groupKey = getGroupingKey(item);
    
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {});

  const representativeItems = Object.values(groupedItems).map(group => {
    // Find the primary variant or just use the first one
    return group[0];
  });

  const filteredItems = representativeItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const name = i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());

    // Seasonal / time-based filtering
    const anyItem = item as any;
    if (anyItem.availableFrom || anyItem.availableTo || (anyItem.availableDays && anyItem.availableDays.length > 0)) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeNum = currentHour * 100 + currentMinute;
      const currentDay = now.getDay();
      if (anyItem.availableDays && anyItem.availableDays.length > 0 && !anyItem.availableDays.includes(currentDay)) {
        return false;
      }
      if (anyItem.availableFrom) {
        const [fh, fm] = (anyItem.availableFrom as string).split(':').map(Number);
        if (currentTimeNum < fh * 100 + fm) return false;
      }
      if (anyItem.availableTo) {
        const [th, tm] = (anyItem.availableTo as string).split(':').map(Number);
        if (currentTimeNum > th * 100 + tm) return false;
      }
    }
    
    return matchesCategory && matchesSearch;
  });

  const sortedFilteredItems = [...filteredItems].sort((a, b) => {
    if (selectedCategory !== "all") return 0;
    const categoryOrder = ['hot', 'cold', 'desserts', 'bakery', 'sandwiches'];
    const aIdx = categoryOrder.indexOf(a.category);
    const bIdx = categoryOrder.indexOf(b.category);
    const aPos = aIdx === -1 ? 99 : aIdx;
    const bPos = bIdx === -1 ? 99 : bIdx;
    return aPos - bPos;
  });

  // Auto-compute isBestSeller (top 3 items by salesCount with at least 1 sale)
  // and isNew from isNewProduct field
  const _allSalesCounts = coffeeItems
    .map(i => (i as any).salesCount || 0)
    .filter((c: number) => c > 0)
    .sort((a: number, b: number) => b - a);
  const _bestSellerThreshold = _allSalesCounts.length >= 3
    ? _allSalesCounts[2]  // value of 3rd highest
    : _allSalesCounts[0] || 1;
  const augmentedItems = sortedFilteredItems.map(item => ({
    ...item,
    isBestSeller: ((item as any).salesCount || 0) >= _bestSellerThreshold && _bestSellerThreshold > 0,
    isNew: (item as any).isNewProduct === 1,
  }));

  const cartHasReservationItem = cartItems.some(ci => (ci.coffeeItem as any)?.isReservation);
  const cartHasNonReservationItem = cartItems.some(ci => !(ci.coffeeItem as any)?.isReservation);

  const checkReservationIsolation = (isReservationProduct: boolean): boolean => {
    if (isReservationProduct && cartHasNonReservationItem) {
      toast({
        title: tc("تنبيه", "Notice"),
        description: tc("منتجات الحجز لا يمكن إضافتها مع منتجات أخرى. يرجى إفراغ السلة أولاً.", "Reservation products cannot be mixed with other items. Please clear your cart first."),
        variant: "destructive"
      });
      return false;
    }
    if (!isReservationProduct && cartHasReservationItem) {
      toast({
        title: tc("تنبيه", "Notice"),
        description: tc("لديك منتج حجز في السلة. لا يمكن إضافة منتجات أخرى معه.", "You have a reservation item in your cart. No other items can be added."),
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleAddToCartDirect = (item: CoffeeItem) => {
    if (!isStoreOpen()) {
      toast({
        title: tc("المتجر مغلق", "Store Closed"),
        description: tc("نعتذر، لا يمكن إضافة الطلبات حالياً بسبب إغلاق المتجر.", "Sorry, orders cannot be added right now as the store is closed."),
        variant: "destructive"
      });
      return;
    }
    const isAvailable = item.isAvailable !== 0 && (item.availabilityStatus === 'available' || item.availabilityStatus === 'new' || !item.availabilityStatus);
    if (!isAvailable) {
      toast({
        title: tc("غير متوفر", "Unavailable"),
        description: tc("نعتذر، هذا المنتج غير متوفر حالياً", "Sorry, this product is currently unavailable"),
        variant: "destructive"
      });
      return;
    }

    const name = i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr;
    const groupKey = getGroupingKey(item);
    const group = groupedItems[groupKey] || [item];
    const hasMultipleVariants = group.length > 1;
    const hasSizes = item.availableSizes && item.availableSizes.length > 0;
    const hasAddons = itemsWithAddonsSet.has((item as any).id);
    const hasBundledItems = (item as any).bundledItems?.some((s: any) => s.items?.length > 0);
    const isReservation = !!(item as any).isReservation;

    if (!checkReservationIsolation(isReservation)) return;

    if (isReservation || hasMultipleVariants || hasSizes || hasAddons || hasBundledItems) {
      setSelectedItem(item);
      setIsModalOpen(true);
    } else {
      addToCart((item as any).id, 1, "default", []);
      toast({
        title: t("menu.added_to_cart"),
        description: t("menu.added_to_cart_desc", { name }),
      });
    }
  };

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % bannerSlides.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    // document.documentElement updates are now handled globally in App.tsx
  };

  if (isLoading) {
    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Utensils className="w-10 h-10 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="fixed top-0 inset-x-0 z-[60] bg-black/60 backdrop-blur-md border-b border-white/10 flex items-end justify-between px-4 pb-3 min-h-[64px]" style={{paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)'}}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 p-1.5 flex items-center justify-center">
            <img src={qiroxLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            {(() => {
              const isCarMode = (() => {
                try { return sessionStorage.getItem("qirox_car_pickup_mode") === "1"; } catch { return false; }
              })();
              if (isCarMode) {
                return (
                  <>
                    <h1 className="text-base font-black text-white leading-tight" data-testid="text-car-menu-title">منيو السيارات</h1>
                    <span className="text-[10px] font-bold text-white/60 tracking-wider">استلام من السيارة 🚗</span>
                  </>
                );
              }
              return (
                <>
                  <h1 className="text-base font-black text-white leading-tight">مكان الشيف</h1>
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">البخاري</span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/profile")}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              title={t("menu.loyalty_card") || "بطاقتي"}
            >
              <QrCode className="w-4 h-4" />
            </Button>
          )}

          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/my-offers")}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              title={t("menu.discover_offers")}
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            <Languages className="w-4 h-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              const storedCustomer = localStorage.getItem("qahwa-customer") || localStorage.getItem("currentCustomer");
              if (isAuthenticated || customer || storedCustomer) {
                setLocation("/profile");
              } else {
                setLocation("/auth");
              }
            }} 
            className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            <User className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="space-y-6 pb-24 relative z-0" style={{paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 64px), 76px)'}}>

        <div ref={bannerRef} className="w-full" style={{marginTop: 'calc(-1 * max(calc(env(safe-area-inset-top, 0px) + 64px), 76px))'}}>

          <div className="relative h-[320px] sm:h-[400px] overflow-hidden shadow-lg border-b border-border/50">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentBannerIndex}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0"
              >
                  <div className="relative h-full w-full">
                    <img 
                      src={bannerSlides[currentBannerIndex].couponImageUrl || bannerSlides[currentBannerIndex].image} 
                      alt={bannerSlides[currentBannerIndex].title}
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                    {/* Dark overlay — matches splash screen dark atmosphere */}
                    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(20,10,0,0.60) 0%, rgba(0,0,0,0.88) 100%)" }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
                    
                    {bannerSlides[currentBannerIndex].couponCode && (
                      <div className="absolute top-4 right-4 z-20">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.1 }}
                          onClick={() => {
                            navigator.clipboard.writeText(bannerSlides[currentBannerIndex].couponCode!);
                            toast({ title: t("checkout.coupon_copied") || "تم نسخ الكود", description: bannerSlides[currentBannerIndex].couponCode });
                          }}
                          className="bg-primary/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl border-2 border-white/30 shadow-2xl flex items-center gap-2 cursor-pointer group transition-all"
                        >
                          <Tag className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                          <span className="text-sm font-black tracking-widest uppercase">{bannerSlides[currentBannerIndex].couponCode}</span>
                        </motion.div>
                      </div>
                    )}

                    <div className={`absolute bottom-0 inset-x-0 p-8 text-white flex flex-col items-start gap-4`}>
                      <div className="space-y-1">
                        <Badge className="bg-accent/90 text-white border-0 px-3 py-1 font-bold text-[10px] uppercase tracking-wider animate-pulse">
                          {bannerSlides[currentBannerIndex].badge}
                        </Badge>
                        <h2 className="text-2xl sm:text-4xl font-black tracking-tight drop-shadow-2xl">
                          {bannerSlides[currentBannerIndex].title}
                        </h2>
                        <p className="text-sm sm:text-lg text-white/90 font-medium max-w-md line-clamp-2 drop-shadow-xl">
                          {bannerSlides[currentBannerIndex].subtitle}
                        </p>
                      </div>
                      
                      <Button
                        disabled={!isStoreOpen()}
                        onClick={() => {
                          const slide = bannerSlides[currentBannerIndex];
                          if (slide.linkType === 'product' && slide.linkId) {
                            const product = coffeeItems.find(p => p.id === slide.linkId);
                            if (product) {
                              setSelectedItem(product);
                              setIsModalOpen(true);
                            }
                          } else if (slide.linkType === 'category' && slide.linkId) {
                            setSelectedCategory(slide.linkId);
                          } else if (slide.linkType === 'offer') {
                            setLocation("/my-offers");
                          } else if (slide.linkType === 'external' && slide.externalUrl) {
                            window.open(slide.externalUrl, '_blank');
                          }
                        }}
                        className="bg-white hover:bg-white/90 text-primary rounded-2xl px-8 h-12 text-base font-black shadow-2xl flex items-center gap-3 transition-all active:scale-95 group overflow-visible"
                      >
                        <span>{t("menu.add_to_cart")}</span>
                        <ChevronLeft className={`w-5 h-5 transition-transform ${i18n.language === 'ar' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1 rotate-180'}`} />
                      </Button>
                    </div>
                  </div>
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-6 right-6 flex gap-1.5 z-30">
              {bannerSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBannerIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentBannerIndex ? "w-8 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 space-y-6">

          {/* ── Active Order Banner ── */}
          <AnimatePresence>
            {showActiveBanner && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <div className={`relative rounded-2xl overflow-hidden shadow-lg border-2 ${
                  activeOrder.status === 'ready'
                    ? 'bg-green-50 dark:bg-green-950 border-green-400'
                    : activeOrder.status === 'in_progress'
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-400'
                    : 'bg-amber-50 dark:bg-amber-950 border-amber-400'
                }`}>
                  {/* Close (dismiss) button */}
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="absolute top-2 ltr:right-2 rtl:left-2 rounded-full bg-black/10 hover:bg-black/20 p-1 z-10"
                    aria-label="إغلاق"
                    data-testid="button-dismiss-active-order"
                  >
                    <X size={14} />
                  </button>

                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Status icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      activeOrder.status === 'ready' ? 'bg-green-500' :
                      activeOrder.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-500'
                    }`}>
                      {activeOrder.status === 'ready'
                        ? <CheckCircle size={18} className="text-white" />
                        : <Package size={18} className="text-white" />
                      }
                    </div>

                    {/* Text block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-gray-900 dark:text-gray-100">لديك طلب قائم</span>
                        <span className="font-mono font-bold text-sm bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 rounded-lg">
                          #{String(activeOrderNum).padStart(4, '0')}
                        </span>
                      </div>
                      <div className={`text-xs font-bold mt-0.5 ${
                        activeOrder.status === 'ready' ? 'text-green-700 dark:text-green-400' :
                        activeOrder.status === 'in_progress' ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'
                      }`}>
                        {getActiveOrderStatusLabel(activeOrder.status)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0 items-center ml-6">
                      <button
                        onClick={() => setLocation(`/track/${activeOrderNum}`)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl text-white flex items-center gap-1 whitespace-nowrap ${
                          activeOrder.status === 'ready' ? 'bg-green-600 hover:bg-green-700' :
                          activeOrder.status === 'in_progress' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                        data-testid="button-track-active-order"
                      >
                        تتبع طلبك
                        <ArrowLeft size={12} />
                      </button>
                      <button
                        onClick={() => {
                          localStorage.removeItem("br-active-order");
                          setActiveOrderNum(null);
                          setBannerDismissed(true);
                        }}
                        className="text-[11px] text-gray-500 hover:text-gray-700 text-center underline whitespace-nowrap"
                        data-testid="button-new-order"
                      >
                        طلب جديد
                      </button>
                    </div>
                  </div>

                  {/* Pulse bar for ready status */}
                  {activeOrder.status === 'ready' && (
                    <div className="bg-green-500 text-white text-xs font-bold text-center py-1.5 animate-pulse">
                      🎉 طلبك جاهز! تفضل للاستلام
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t("location.riyadh")}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            {!isStoreOpen() ? (
              <div className="flex items-center gap-2 text-red-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold">{i18n.language === 'ar' ? "المتجر مغلق حالياً" : "Store Closed"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">{t("status.open")}</span>
              </div>
            )}
          </div>

          {isAuthenticated && (
            <button
              onClick={() => setLocation("/my-offers")}
              className="w-full flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4 border border-primary/20 group hover:border-primary/40 transition-all"
              data-testid="button-my-offers-banner"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className={i18n.language === 'ar' ? 'text-right' : 'text-left'}>
                  <p className="font-bold text-foreground">{t("menu.discover_offers")}</p>
                  <p className="text-xs text-muted-foreground">{t("menu.personalized_offers")}</p>
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-primary group-hover:translate-x-[-4px] transition-transform" />
            </button>
          )}

          {promoOffers.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎁</span>
                  <h2 className="text-xl font-black text-foreground">عروضنا</h2>
                </div>
                <Badge variant="outline" className="text-xs text-primary border-primary/30 font-bold">
                  {promoOffers.length} عرض
                </Badge>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-3">
                {promoOffers.map((offer: any) => {
                  const discountPct = offer.originalPrice > offer.offerPrice
                    ? Math.round(((offer.originalPrice - offer.offerPrice) / offer.originalPrice) * 100)
                    : 0;
                  const offerName = i18n.language === 'ar' ? offer.nameAr : (offer.nameEn || offer.nameAr);

                  const handleOrderBundle = () => {
                    if (!isStoreOpen()) {
                      toast({ title: i18n.language === 'ar' ? "المتجر مغلق" : "Store Closed", variant: "destructive" });
                      return;
                    }
                    const items: Array<{coffeeItemId: string; quantity: number}> = offer.items || [];
                    if (items.length > 0) {
                      items.forEach((bi: {coffeeItemId: string; quantity: number}) => {
                        addToCart(bi.coffeeItemId, bi.quantity || 1);
                      });
                      toast({
                        title: `✅ ${offerName}`,
                        description: i18n.language === 'ar' ? "تمت إضافة الباقة للسلة" : "Bundle added to cart",
                        duration: 3000,
                      });
                    } else {
                      toast({
                        title: `🎁 ${offerName}`,
                        description: i18n.language === 'ar' ? `سعر الباقة: ${offer.offerPrice} ر.س` : `Bundle price: ${offer.offerPrice} SAR`,
                        duration: 4000,
                      });
                    }
                  };

                  return (
                    <motion.div
                      key={offer.id}
                      whileTap={{ scale: 0.97 }}
                      className="flex-shrink-0 w-[260px] snap-start rounded-2xl overflow-hidden border border-border/50 shadow-sm bg-card group"
                      data-testid={`card-offer-${offer.id}`}
                    >
                      {/* Image */}
                      <div className="relative h-36 bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden">
                        {offer.imageUrl ? (
                          <img
                            src={offer.imageUrl}
                            alt={offerName}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = 'none'; el.parentElement!.querySelector('.offer-fallback')?.classList.remove('hidden'); }}
                          />
                        ) : null}
                        <div className={`offer-fallback w-full h-full flex items-center justify-center text-5xl ${offer.imageUrl ? 'hidden' : ''}`}>🎁</div>
                        {/* Discount badge */}
                        {discountPct > 0 && (
                          <div className={`absolute top-2 ${i18n.language === 'ar' ? 'left-2' : 'right-2'} bg-primary text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg`}>
                            -{discountPct}%
                          </div>
                        )}
                        {/* Type badge */}
                        <div className={`absolute top-2 ${i18n.language === 'ar' ? 'right-2' : 'left-2'} bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                          {offer.offerType === 'bundle' ? '📦 باقة' : offer.offerType === 'bogo' ? '🎁 اشتر+احصل' : '🏷️ خصم'}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3 space-y-2">
                        <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-1">{offerName}</h3>
                        {offer.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{offer.description}</p>
                        )}

                        {/* Items list */}
                        {offer.items && offer.items.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {offer.items.slice(0, 3).map((bi: any, idx: number) => {
                              const item = coffeeItems.find((c: any) => c.id === bi.coffeeItemId);
                              return item ? (
                                <span key={idx} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">
                                  {item.nameAr} {bi.quantity > 1 ? `×${bi.quantity}` : ''}
                                </span>
                              ) : null;
                            })}
                            {offer.items.length > 3 && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">+{offer.items.length - 3}</span>
                            )}
                          </div>
                        )}

                        {/* Price */}
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-primary">
                            {offer.offerPrice.toFixed(2)} <SarIcon size={11} />
                          </span>
                          {offer.originalPrice !== offer.offerPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              {offer.originalPrice.toFixed(2)} <SarIcon size={11} />
                            </span>
                          )}
                        </div>

                        {/* Order button */}
                        <button
                          onClick={handleOrderBundle}
                          disabled={!isStoreOpen()}
                          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold py-2 rounded-xl transition-all active:scale-95"
                          data-testid={`btn-order-bundle-${offer.id}`}
                        >
                          {i18n.language === 'ar' ? 'اطلب الباقة' : 'Order Bundle'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="relative group">
            <Search className={`absolute ${i18n.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors`} />
            <input 
              type="text"
              placeholder={t("menu.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-12 ${i18n.language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm`}
              data-testid="input-search"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategory(cat.id);
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedCategory === cat.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-card text-foreground border-border hover:border-primary/30 hover:bg-secondary/50"
                }`}
                data-testid={`button-category-${cat.id}`}
              >
                <cat.icon className={`w-4 h-4 ${selectedCategory === cat.id ? "text-primary-foreground" : "text-primary"}`} />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{t("menu.featured")}</h2>
              <Button variant="ghost" size="sm" className="text-primary text-sm">
                {t("menu.view_all")}
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2">
              {representativeItems.slice(0, 6).map((item) => (
                <motion.div 
                  key={item.id} 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-shrink-0 w-[140px] snap-start bg-card rounded-2xl border border-border p-3 space-y-3 shadow-sm cursor-pointer group"
                  onClick={() => handleAddToCartDirect(item)}
                  data-testid={`card-featured-${item.id}`}
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
                    <img 
                      src={item.imageUrl || qiroxLogo} 
                      className={`transition-transform duration-500 group-hover:scale-110 ${item.imageUrl ? 'w-full h-full object-cover' : 'w-3/4 h-3/4 object-contain p-1'}`}
                      alt={i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr} 
                      onError={(e) => { const img = e.target as HTMLImageElement; img.src = qiroxLogo; img.className = img.className.replace('object-cover', 'object-contain') + ' p-1 w-3/4 h-3/4'; }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold truncate text-foreground">{i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-bold">
                        {(() => {
                          const sizes = (item as any).availableSizes;
                          if (sizes && sizes.length > 1) {
                            const prices = sizes.map((s: any) => Number(s.price)).filter((p: number) => !isNaN(p) && p > 0);
                            if (prices.length > 1) {
                              const min = Math.min(...prices), max = Math.max(...prices);
                              if (min !== max) return <>{min} - {max} <small className="text-xs font-normal text-muted-foreground">ر.س</small></>;
                              return <>{min} <small className="text-xs font-normal text-muted-foreground"><SarIcon /></small></>;
                            }
                          }
                          return <>{item.price} <small className="text-xs font-normal text-muted-foreground"><SarIcon /></small></>;
                        })()}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                        <Plus className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              {t("menu.all_items")}
            </h2>
            {businessConfig?.menuLayout === 'cards' ? (
              <CardsMenuLayout
                items={augmentedItems as any}
                onAddItem={handleAddToCartDirect as any}
                lang={i18n.language}
                currency=<SarIcon />
                favoriteIds={favoriteIds}
                onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
                itemAddonsMap={itemAddonsMap}
              />
            ) : businessConfig?.menuLayout === 'list' ? (
              <ListMenuLayout
                items={augmentedItems as any}
                onAddItem={handleAddToCartDirect as any}
                lang={i18n.language}
                currency=<SarIcon />
                favoriteIds={favoriteIds}
                onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
                itemAddonsMap={itemAddonsMap}
              />
            ) : (
              <ClassicMenuLayout
                items={augmentedItems as any}
                onAddItem={handleAddToCartDirect as any}
                lang={i18n.language}
                currency=<SarIcon />
                favoriteIds={favoriteIds}
                onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
                itemAddonsMap={itemAddonsMap}
              />
            )}
          </section>
        </div>
      </main>

      <AddToCartModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        variants={selectedItem ? (groupedItems[getGroupingKey(selectedItem)] || [selectedItem]) : []}
        onAddToCart={(data) => {
          if (!checkReservationIsolation(!!data.isReservation)) return;
          addToCart(data.coffeeItemId, data.quantity, data.selectedSize, data.selectedAddons, data.selectedItemAddons, data.selectedReservationPackage);
          setIsModalOpen(false);
          toast({ 
            title: t("menu.added_to_cart"), 
            description: t("menu.added_to_cart_desc", { name: i18n.language === 'ar' ? selectedItem?.nameAr : selectedItem?.nameEn || selectedItem?.nameAr }),
            className: "bg-card border-primary/20 text-foreground font-medium"
          });
        }}
      />

      {totalItems > 0 && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 inset-x-4 z-50"
        >
          <Button 
            onClick={() => setLocation("/cart")}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg flex items-center justify-between px-5"
            data-testid="button-view-cart"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-right">
                <p className="text-xs font-medium opacity-80">{t("menu.view_cart")}</p>
                <p className="text-sm font-bold">{t("menu.items_count", { count: totalItems })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {cartItems.reduce((sum, i) => {
                  let itemPrice = 0;
                  const basePrice = i.coffeeItem?.price || 0;

                  // Use size price if available
                  if (i.selectedSize && i.coffeeItem?.availableSizes) {
                    const size = i.coffeeItem.availableSizes.find(s => s.nameAr === i.selectedSize);
                    itemPrice = size ? size.price : basePrice;
                  } else {
                    itemPrice = basePrice;
                  }

                  // Handle price formats
                  let price = 0;
                  if (typeof itemPrice === 'number') {
                    price = itemPrice;
                  } else if (typeof itemPrice === 'string') {
                    price = parseFloat(itemPrice);
                  } else if (itemPrice && typeof itemPrice === 'object' && '$numberDecimal' in (itemPrice as any)) {
                    price = parseFloat((itemPrice as any).$numberDecimal);
                  } else {
                    price = parseFloat(String(itemPrice));
                  }

                  // Include inline addon prices
                  const inlineAddonPrices = ((i as any).selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                  
                  return sum + (isNaN(price) ? 0 : (price + inlineAddonPrices) * i.quantity);
                }, 0).toFixed(2)} <SarIcon />
              </span>
            </div>
          </Button>
        </motion.div>
      )}

      <footer className="text-center py-5 space-y-2">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
          <a
            href="tel:+966566507666"
            className="flex items-center gap-1 hover:text-primary transition-colors"
            data-testid="link-footer-call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.45 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.06-1.06a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/></svg>
            <span dir="ltr">+966 56 650 7666</span>
          </a>
          <span className="text-muted-foreground/30">•</span>
          <a
            href="https://maps.app.goo.gl/zhHFfQVjWRxVKEBn6?g_st=ic"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-primary transition-colors"
            data-testid="link-footer-maps"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>موقعنا</span>
          </a>
        </div>
        <div className="text-xs text-muted-foreground/40">
          made by{" "}
          <a
            href="https://www.chefsplace.online"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground/70 transition-colors underline underline-offset-2"
            data-testid="link-qirox-studio"
          >
            Qirox Studio
          </a>{" "}
          group
        </div>
      </footer>

    </div>
  );
}
