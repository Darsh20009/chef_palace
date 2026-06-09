import { useState, useEffect, useMemo } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coffee, ShoppingCart, Flame, Snowflake, Star, Cake, User, Plus, Search, ChevronLeft, MapPin, Clock, Utensils, Sparkles, AlertCircle } from "lucide-react";
import type { CoffeeItem, IProductAddon } from "@shared/schema";
import { AddToCartModal } from "@/components/add-to-cart-modal";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import qiroxLogo from "@assets/qirox-logo-customer.png";
import SarIcon from "@/components/sar-icon";
import type { AddonPreview } from "@/components/menu-layouts";
import { OptionPills } from "@/components/menu-layouts";

interface ITable {
  id: string;
  tableNumber: string;
  qrToken: string;
  branchId: string;
  isActive: number;
  isOccupied: number;
  currentOrderId?: string;
  reservedFor?: {
    customerName: string;
    customerPhone: string;
    reservationTime?: string;
    status?: string;
    autoExpiryTime?: string;
    extensionCount?: number;
  };
}

interface IPendingOrder {
  id: string;
  status: string;
  tableNumber?: string;
  customerInfo?: {
    customerName: string;
  };
}

interface CartItem {
  id: string;
  item: CoffeeItem;
  quantity: number;
  selectedSize?: string;
  selectedAddons?: string[];
}

interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department?: 'drinks' | 'food';
  orderIndex: number;
  isSystem?: boolean;
}

export default function TableMenuNew() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/table-menu/:qrToken");
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [reservationPhoneVerified, setReservationPhoneVerified] = useState(false);
  const [reservationPhoneInput, setReservationPhoneInput] = useState("");
  const [reservationStatus, setReservationStatus] = useState<"valid" | "before_window" | "after_window" | null>(null);
  const [selectedItem, setSelectedItem] = useState<CoffeeItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const qrToken = params?.qrToken;

  const checkReservationWindow = (reservationTime: string | undefined) => {
    if (!reservationTime) return "valid";
    const reservation = new Date(reservationTime);
    const now = new Date();
    const diffMinutes = (reservation.getTime() - now.getTime()) / (1000 * 60);
    if (diffMinutes >= -30 && diffMinutes <= 5) return "valid";
    if (diffMinutes < -30) return "after_window";
    return "before_window";
  };

  const { data: table, isLoading: tableLoading, isError: tableError } = useQuery<ITable>({
    queryKey: ["/api/tables/qr", qrToken],
    enabled: !!qrToken,
    retry: 1,
    queryFn: async () => {
      const response = await fetch(`/api/tables/qr/${qrToken}`);
      if (!response.ok) throw new Error(tc("الطاولة غير موجودة", "Table not found"));
      return response.json();
    },
  });

  useEffect(() => {
    if (table?.reservedFor?.reservationTime) {
      const status = checkReservationWindow(table.reservedFor.reservationTime);
      setReservationStatus(status as any);
    }
  }, [table]);

  const { data: pendingOrder } = useQuery<IPendingOrder>({
    queryKey: ["/api/orders", table?.id],
    enabled: !!table?.currentOrderId,
    queryFn: async () => {
      const response = await fetch(`/api/orders/${table?.currentOrderId}`);
      if (!response.ok) throw new Error(tc("الطلب غير موجود", "Order not found"));
      return response.json();
    },
  });

  const { data: coffeeItems = [], isLoading: menuLoading } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const { data: dynamicCategories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-categories"],
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
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

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isBothModes = businessConfig?.activityType === "both";
  const [activeMode, setActiveMode] = useState<"drinks" | "food">("drinks");
  const [initModeSet, setInitModeSet] = useState(false);

  useEffect(() => {
    if (businessConfig?.activityType === "both" && !initModeSet) {
      setActiveMode("drinks");
      setInitModeSet(true);
    }
  }, [businessConfig, initModeSet]);

  const iconMap: Record<string, any> = {
    Coffee, Flame, Snowflake, Star, Cake, Utensils, Sparkles
  };

  const allTab = { id: "all", name: t("menu.categories.all"), icon: Coffee };

  const filteredDynamic = dynamicCategories.filter(c => {
    if (!isBothModes) return true;
    return !c.department || c.department === activeMode;
  });

  const categories = [
    allTab,
    ...filteredDynamic.map(c => ({
      id: c.id,
      name: i18n.language === 'ar' ? c.nameAr : (c.nameEn || c.nameAr),
      icon: iconMap[c.icon || 'Coffee'] || Coffee,
    })),
  ];

  const getGroupingKey = (item: CoffeeItem): string => {
    if ((item as any).groupId) return (item as any).groupId;
    const nameAr = item.nameAr || "";
    if (!nameAr || typeof nameAr !== 'string') return 'unknown';
    const cleaned = nameAr.trim()
      .replace(/^[\u064B-\u0652]+/, '')
      .replace(/^(بارد|حار)\s+/i, '');
    const words = cleaned.split(/\s+/);
    if (words.length >= 2) return `${words[0]} ${words[1]}`;
    return words[0] || 'unknown';
  };

  const groupedItems = coffeeItems.reduce((acc: Record<string, CoffeeItem[]>, item) => {
    const groupKey = getGroupingKey(item);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {});

  const representativeItems = Object.values(groupedItems).map(group => group[0]);

  const drinkCategoryIds = dynamicCategories.filter(c => c.department === 'drinks').map(c => c.id);
  const foodCategoryIds = dynamicCategories.filter(c => c.department === 'food').map(c => c.id);

  const filteredItems = representativeItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const name = i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMode = !isBothModes || (
      selectedCategory !== "all"
        ? (activeMode === "drinks" ? drinkCategoryIds.includes(item.category) : foodCategoryIds.includes(item.category))
        : true
    );

    return matchesCategory && matchesSearch && matchesMode;
  });

  const sortedFilteredItems = [...filteredItems].sort((a, b) => {
    if (!isBothModes || selectedCategory !== "all") return 0;
    const aMatchesMode = activeMode === "drinks" ? drinkCategoryIds.includes(a.category) : foodCategoryIds.includes(a.category);
    const bMatchesMode = activeMode === "drinks" ? drinkCategoryIds.includes(b.category) : foodCategoryIds.includes(b.category);
    if (aMatchesMode && !bMatchesMode) return -1;
    if (!aMatchesMode && bMatchesMode) return 1;
    return 0;
  });

  useEffect(() => {
    if (table?.id) {
      const savedCart = sessionStorage.getItem(`cart_${table.id}`);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          const normalizedCart = parsedCart.map((ci: any) => {
            if (ci.item) return ci;
            if (ci.coffeeItem) {
              return {
                id: ci.id,
                item: ci.coffeeItem,
                quantity: ci.quantity,
                selectedSize: ci.selectedSize,
                selectedAddons: ci.selectedAddons || [],
              };
            }
            return ci;
          }).filter((ci: any) => ci.item);
          setCart(normalizedCart);
        } catch (e) {
          console.error("Error parsing saved cart:", e);
        }
      }
    }
  }, [table?.id]);

  const addToCart = async (item: CoffeeItem, selectedSize?: string, selectedAddons: string[] = [], selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>) => {
    const sizeName = selectedSize || "default";
    const inlineKey = (selectedItemAddons || []).map(a => a.nameAr).join(",");
    const cartItemId = `${item.id}-${sizeName}-${selectedAddons.sort().join(",")}-${inlineKey}`;
    const sId = table?.id ? `table-${table.id}` : "guest";

    try {
      setCart((prev) => {
        const existing = prev.find((ci) => ci.id === cartItemId);
        let updatedCart;
        if (existing) {
          updatedCart = prev.map((ci) =>
            ci.id === cartItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
          );
        } else {
          updatedCart = [...prev, { id: cartItemId, item, quantity: 1, selectedSize: sizeName, selectedAddons, selectedItemAddons: selectedItemAddons || [] }];
        }
        sessionStorage.setItem(`cart_${table?.id}`, JSON.stringify(updatedCart));
        return updatedCart;
      });

      await apiRequest("POST", "/api/cart", {
        sessionId: sId,
        coffeeItemId: item.id,
        quantity: 1,
        selectedSize: sizeName,
        selectedAddons,
        selectedItemAddons: selectedItemAddons || [],
      });

      queryClient.invalidateQueries({ queryKey: [`/api/cart/${sId}`] });

      const name = i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr;
      toast({
        title: t("menu.added_to_cart"),
        description: t("menu.added_to_cart_desc", { name }),
      });
    } catch (error) {
      console.error("Add to cart error:", error);
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل في إضافة المنتج للسلة", "Failed to add product to cart"),
        variant: "destructive"
      });
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    const sId = table?.id ? `table-${table.id}` : "guest";
    try {
      const existingItem = cart.find(ci => ci.id === cartItemId);
      if (!existingItem) return;

      setCart((prev) => {
        let updatedCart;
        if (existingItem.quantity > 1) {
          updatedCart = prev.map((ci) =>
            ci.id === cartItemId ? { ...ci, quantity: ci.quantity - 1 } : ci
          );
        } else {
          updatedCart = prev.filter((ci) => ci.id !== cartItemId);
        }
        sessionStorage.setItem(`cart_${table?.id}`, JSON.stringify(updatedCart));
        return updatedCart;
      });

      if (existingItem.quantity > 1) {
        await apiRequest("PUT", `/api/cart/${sId}/${cartItemId}`, {
          quantity: existingItem.quantity - 1
        });
      } else {
        await apiRequest("DELETE", `/api/cart/${sId}/${cartItemId}`);
      }

      queryClient.invalidateQueries({ queryKey: [`/api/cart/${sId}`] });
    } catch (error) {
      console.error("Remove from cart error:", error);
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, ci) => {
      let itemPrice = ci.item.price;
      const sizes = (ci.item as any).sizes;
      const sizeToMatch = ci.selectedSize || "default";
      if (sizeToMatch !== "default" && sizes) {
        const sizeInfo = sizes.find((s: any) => s.nameAr === sizeToMatch);
        if (sizeInfo) itemPrice = sizeInfo.price;
      }
      return total + itemPrice * ci.quantity;
    }, 0);
  };

  const handleExtendReservation = async () => {
    if (!table?.id) return;
    try {
      const response = await fetch(`/api/tables/${table.id}/extend-reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        toast({
          title: tc("تم التمديد", "Extended"),
          description: tc("تم تمديد الحجز لمدة ساعة إضافية", "Reservation extended by one hour"),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/tables/qr", qrToken] });
      }
    } catch (error) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل تمديد الحجز", "Failed to extend reservation"),
        variant: "destructive"
      });
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: tc("السلة فارغة", "Cart Empty"),
        description: tc("الرجاء إضافة عناصر للسلة أولاً", "Please add items to cart first"),
        variant: "destructive",
      });
      return;
    }

    if (table?.reservedFor?.customerName) {
      if (reservationStatus === "after_window") {
        toast({
          title: tc("انتهاء فترة الحجز", "Reservation Expired"),
          description: tc("آسفون، فترة الحجز قد انتهت. يمكنك عمل طلب عادي جديد.", "Sorry, reservation has expired. You can place a new regular order."),
          variant: "destructive",
        });
        return;
      }

      if (reservationStatus === "before_window") {
        toast({
          title: tc("الحجز في وقت لاحق", "Reservation Not Started"),
          description: tc("الحجز لم يبدأ بعد. يمكنك عمل طلب عادي الآن.", "Reservation has not started yet. You can place a regular order now."),
        });
        setReservationPhoneVerified(true);
        return;
      }

      if (!reservationPhoneVerified) {
        const phoneToVerify = reservationPhoneInput.trim();
        if (!phoneToVerify) {
          toast({
            title: tc("التحقق من الحجز", "Verify Reservation"),
            description: tc("الرجاء إدخال رقم الجوال المسجل في الحجز", "Please enter the phone number registered for this reservation"),
            variant: "destructive",
          });
          return;
        }

        const reservationPhone = table.reservedFor.customerPhone.replace(/^0/, "");
        const inputPhone = phoneToVerify.replace(/^0/, "");

        if (reservationPhone !== inputPhone && reservationPhone !== phoneToVerify) {
          toast({
            title: tc("خطأ في التحقق", "Verification Error"),
            description: tc("رقم الجوال غير مطابق للحجز", "Phone number does not match reservation"),
            variant: "destructive",
          });
          return;
        }

        setReservationPhoneVerified(true);
        return;
      }
    }

    if (table?.id) {
      try {
        await fetch(`/api/tables/${table.id}/occupancy`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOccupied: 1 }),
        });
      } catch (error) {
        console.error("Error updating table occupancy:", error);
      }
    }

    sessionStorage.setItem(`cart_${table?.id}`, JSON.stringify(cart));
    sessionStorage.setItem(`branchId_${table?.id}`, table?.branchId || "");
    navigate(`/table-checkout/${table?.id}/${table?.tableNumber}`);
  };

  const handleAddToCartDirect = (item: CoffeeItem) => {
    const isAvailable = item.isAvailable !== 0 && (item.availabilityStatus === 'available' || item.availabilityStatus === 'new' || !item.availabilityStatus);
    if (!isAvailable) {
      toast({
        title: tc("غير متوفر", "Unavailable"),
        description: tc("نعتذر، هذا المنتج غير متوفر حالياً", "Sorry, this product is currently unavailable"),
        variant: "destructive"
      });
      return;
    }

    const groupKey = getGroupingKey(item);
    const group = groupedItems[groupKey] || [item];
    const hasMultipleVariants = group.length > 1;
    const hasSizes = item.availableSizes && item.availableSizes.length > 0;
    const hasAddons = itemsWithAddonsSet.has(item.id);
    const hasBundledItems = (item as any).bundledItems?.some((s: any) => s.items?.length > 0);

    if (hasMultipleVariants || hasSizes || hasAddons || hasBundledItems) {
      setSelectedItem(item);
      setIsModalOpen(true);
    } else {
      addToCart(item);
    }
  };

  if ((tableLoading && !tableError) || menuLoading) {
    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Coffee className="w-10 h-10 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Coffee className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{tc("طاولة غير موجودة", "Table Not Found")}</h2>
          <p className="text-muted-foreground">{tc("عذراً، لم نتمكن من العثور على هذه الطاولة.", "Sorry, we could not find this table.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="fixed top-0 inset-x-0 z-[60] h-16 bg-black/60 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 p-1.5 flex items-center justify-center">
            <img src={qiroxLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-black text-white leading-tight">مكان الشيف</h1>
            <span className="text-[10px] font-bold text-white/60 tracking-wider">البخاري</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-white/10 px-3 py-1">
            <MapPin className="w-3 h-3 ml-1" />
            طاولة {table.tableNumber}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCheckout}
            className="h-9 w-9 rounded-xl bg-white/10 text-white border border-white/10 relative"
            data-testid="button-cart"
          >
            <ShoppingCart className="w-4 h-4" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="pt-16 space-y-6 pb-24 relative z-0">
        <div className="px-4 space-y-6 pt-4">
          <div className="flex items-center gap-4 bg-secondary/50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">طاولة {table.tableNumber}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{t("status.open") || "مفتوح"}</span>
            </div>
          </div>

          {table?.reservedFor?.status === 'pending' && (
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">معلومات الحجز</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    الحجز باسم: <strong className="text-foreground">{table.reservedFor.customerName}</strong>
                  </p>
                  {table.reservedFor.autoExpiryTime && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ينتهي الحجز في: <strong className="text-foreground">{new Date(table.reservedFor.autoExpiryTime).toLocaleTimeString('ar')}</strong>
                    </p>
                  )}
                  {table.reservedFor.extensionCount === 0 && (
                    <Button
                      onClick={handleExtendReservation}
                      size="sm"
                      className="mt-3"
                      data-testid="button-extend-reservation"
                    >
                      تمديد الحجز ساعة إضافية
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {pendingOrder && pendingOrder.status !== 'completed' && (
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-foreground mb-1">لديك طلب معلق!</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    لديك طلب تم طلبه سابقاً من هذه الطاولة ولا يزال في الانتظار.
                  </p>
                  <Button
                    onClick={() => navigate(`/table-order-tracking/${table?.currentOrderId}`)}
                    size="sm"
                    data-testid="button-view-pending-order"
                  >
                    متابعة الطلب السابق
                  </Button>
                </div>
              </div>
            </div>
          )}

          {table?.reservedFor?.customerName && (
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              {reservationStatus === "after_window" ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-destructive" />
                    <h3 className="font-bold text-foreground">انتهت فترة الحجز</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    الحجز لـ: <strong className="text-foreground">{table.reservedFor.customerName}</strong> قد انتهت فترته.
                  </p>
                  <p className="text-sm text-muted-foreground">يمكنك تقديم طلب عادي جديد.</p>
                </>
              ) : reservationStatus === "before_window" ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">الحجز لم يبدأ بعد</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    هناك حجز باسم: <strong className="text-foreground">{table.reservedFor.customerName}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">يمكنك تقديم طلب عادي حالياً.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-foreground">التحقق من الحجز</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    هذه الطاولة محجوزة باسم: <strong className="text-foreground">{table.reservedFor.customerName}</strong>
                  </p>
                  {!reservationPhoneVerified && (
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="أدخل رقم الجوال المسجل في الحجز"
                        value={reservationPhoneInput}
                        onChange={(e) => setReservationPhoneInput(e.target.value)}
                        className="flex-1 px-3 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        maxLength={9}
                        data-testid="input-reservation-phone"
                      />
                      <Button
                        onClick={() => {
                          const phoneToVerify = reservationPhoneInput.trim();
                          const reservationPhone = table.reservedFor!.customerPhone.replace(/^0/, "");
                          const inputPhone = phoneToVerify.replace(/^0/, "");

                          if (reservationPhone === inputPhone || reservationPhone === phoneToVerify) {
                            setReservationPhoneVerified(true);
                            toast({
                              title: "تم التحقق",
                              description: "تم التحقق من الحجز بنجاح",
                            });
                          } else {
                            toast({
                              title: tc("خطأ", "Error"),
                              description: "رقم الجوال غير مطابق",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid="button-verify-phone"
                      >
                        تحقق
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {isBothModes && (
            <div className="flex p-1 bg-secondary/30 rounded-2xl">
              <button
                onClick={() => { setActiveMode("drinks"); setSelectedCategory("all"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeMode === "drinks" ? "bg-primary text-white shadow-lg" : "text-muted-foreground"
                }`}
                data-testid="button-mode-drinks"
              >
                <Coffee className="w-4 h-4" />
                <span>{t("menu.mode.drinks")}</span>
              </button>
              <button
                onClick={() => { setActiveMode("food"); setSelectedCategory("all"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeMode === "food" ? "bg-primary text-white shadow-lg" : "text-muted-foreground"
                }`}
                data-testid="button-mode-food"
              >
                <Utensils className="w-4 h-4" />
                <span>{t("menu.mode.food")}</span>
              </button>
            </div>
          )}

          <div className="relative group">
            <Search className={`absolute ${i18n.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors`} />
            <input
              type="text"
              placeholder={isBothModes && activeMode === 'food' ? t("menu.search_placeholder_food") : t("menu.search_placeholder")}
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
                  <div className="aspect-square rounded-xl overflow-hidden bg-secondary">
                    <img
                      src={item.imageUrl}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      alt={i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement; img.src = "/images/brand-logo.png"; img.style.objectFit = "contain"; img.style.padding = "8px"; if (img.parentElement) img.parentElement.style.background = "#1a1a1a";
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold truncate text-foreground">{i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-bold">{item.price} <small className="text-xs font-normal text-muted-foreground"><SarIcon /></small></span>
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
              {isBothModes
                ? (activeMode === 'food' ? t("menu.all_items_food") : t("menu.all_items_drinks"))
                : t("menu.all_items")
              }
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {sortedFilteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="bg-card rounded-2xl border border-border p-3 flex gap-4 items-center shadow-sm cursor-pointer group"
                    onClick={() => handleAddToCartDirect(item)}
                    data-testid={`card-menu-${item.id}`}
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                      <img
                        src={item.imageUrl}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        alt={i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement; img.src = "/images/brand-logo.png"; img.style.objectFit = "contain"; img.style.padding = "8px"; if (img.parentElement) img.parentElement.style.background = "#1a1a1a";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="text-base font-semibold truncate text-foreground mb-0.5">{i18n.language === 'ar' ? item.nameAr : item.nameEn || item.nameAr}</h3>
                      <p className="text-xs text-muted-foreground truncate">{item.description || t("menu.default_desc")}</p>
                      <OptionPills item={item as any} addons={itemAddonsMap[item.id]} lang={i18n.language} />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-primary font-bold text-lg">{item.price} <small className="text-xs font-normal text-muted-foreground"><SarIcon /></small></span>
                        <Button
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg bg-primary hover:bg-primary/90"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCartDirect(item);
                          }}
                          data-testid={`button-add-${item.id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {sortedFilteredItems.length === 0 && (
              <div className="text-center py-12">
                <Coffee className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground text-lg">
                  لا توجد منتجات في هذه الفئة
                </p>
              </div>
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
          const itemToAdd = coffeeItems.find(ci => ci.id === data.coffeeItemId);
          if (itemToAdd) {
            addToCart(itemToAdd, data.selectedSize, data.selectedAddons, data.selectedItemAddons);
          }
          setIsModalOpen(false);
        }}
      />

      {totalItems > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 inset-x-4 z-50"
        >
          <Button
            onClick={handleCheckout}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg flex items-center justify-between px-5"
            data-testid="button-checkout"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className={i18n.language === 'ar' ? 'text-right' : 'text-left'}>
                <p className="text-xs font-medium opacity-80">{t("menu.view_cart") || "عرض السلة"}</p>
                <p className="text-sm font-bold">{t("menu.items_count", { count: totalItems }) || `${totalItems} عنصر`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {getTotalPrice().toFixed(2)} <SarIcon />
              </span>
            </div>
          </Button>
        </motion.div>
      )}
    </div>
  );
}
