import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { AddonGroupsSelector, validateAddonGroups, calcAddonGroupsPrice, type SelectedAddonGroup } from "@/components/addon-groups-selector";
import type { AddonGroup } from "@/components/addon-groups-editor";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { CoffeeItem, IProductAddon } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

interface AddToCartModalProps {
  item: CoffeeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (itemData: any) => void;
  variants?: CoffeeItem[];
}

export function AddToCartModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  variants = [],
}: AddToCartModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<CoffeeItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedItemAddonIndices, setSelectedItemAddonIndices] = useState<number[]>([]);
  const [selectedBundledItems, setSelectedBundledItems] = useState<Record<number, string[]>>({});
  const [selectedReservationPackageIdx, setSelectedReservationPackageIdx] = useState<number | null>(null);
  const [selectedAddonGroups, setSelectedAddonGroups] = useState<SelectedAddonGroup[]>([]);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const resetModal = useCallback(() => {
    setQuantity(1);
    setSelectedSize(null);
    setSelectedAddons([]);
    setSelectedItemAddonIndices([]);
    setSelectedBundledItems({});
    setSelectedVariant(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen && item) {
      setSelectedVariant(item);
      setQuantity(1);
      setSelectedSize(null);
      setSelectedAddons([]);
      setSelectedItemAddonIndices([]);
      setSelectedBundledItems({});
      setSelectedReservationPackageIdx(null);
      setSelectedAddonGroups([]);
    }
  }, [isOpen, item]);

  const activeItem = selectedVariant || item;

  const { data: allAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/product-addons"],
    enabled: isOpen && !!activeItem,
  });

  const { data: specificAddons = [] } = useQuery<IProductAddon[]>({
    queryKey: ["/api/coffee-items", (activeItem as any)?.id, "addons"],
    enabled: isOpen && !!activeItem && !!(activeItem as any)?.id,
  });

  const { data: allCoffeeItems = [] } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    enabled: isOpen && !!activeItem,
  });

  const generalAddons = useMemo((): IProductAddon[] => {
    // Never show general addons as fallback — addons must be explicitly linked to the item
    return [];
  }, []);

  const drinkAddons = useMemo(() => {
    if (!activeItem) return [];
    return allAddons.filter(addon => addon.isAvailable === 1 && addon.isAddonDrink && addon.linkedCoffeeItemId);
  }, [activeItem, allAddons]);

  const getLinkedDrinkInfo = (addon: IProductAddon) => {
    if (!addon.linkedCoffeeItemId) return null;
    return allCoffeeItems.find(item => item.id === addon.linkedCoffeeItemId);
  };

  const itemAddons = useMemo(() => {
    const specificIds = new Set(specificAddons.map(a => a.id));
    const uniqueGeneralAddons = generalAddons.filter(a => !specificIds.has(a.id));
    return [...specificAddons, ...uniqueGeneralAddons].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [specificAddons, generalAddons]);

  const inlineAddons: Array<{nameAr: string; nameEn?: string; price: number}> = useMemo(() => {
    return (activeItem as any)?.addons || [];
  }, [activeItem]);

  const bundledSections: Array<{
    sectionTitle: string;
    selectionType: 'single' | 'multiple';
    minSelectable: number;
    maxSelectable: number;
    items: Array<{ productId: string; nameAr: string; nameEn?: string; imageUrl?: string; originalPrice: number; customPrice: number; }>;
  }> = useMemo(() => (activeItem as any)?.bundledItems || [], [activeItem]);

  const bundledItemsPrice = useMemo(() => {
    return bundledSections.reduce((total, section, secIdx) => {
      const selected = selectedBundledItems[secIdx] || [];
      return total + section.items
        .filter(it => selected.includes(it.productId))
        .reduce((s, it) => s + it.customPrice, 0);
    }, 0);
  }, [bundledSections, selectedBundledItems]);

  const handleAddToCart = () => {
    if (!activeItem) return;

    if (activeItem.availableSizes && activeItem.availableSizes.length > 0 && !selectedSize) {
      toast({
        title: isAr ? "تنبيه" : "Notice",
        description: isAr ? "يرجى اختيار حجم المشروب" : "Please select a drink size",
        variant: "destructive",
      });
      return;
    }

    if (activeItem.isAvailable === 0 || (activeItem.availabilityStatus !== 'available' && activeItem.availabilityStatus !== 'new' && !!activeItem.availabilityStatus)) {
      toast({
        title: isAr ? "غير متوفر" : "Unavailable",
        description: isAr ? "نعتذر، هذا المنتج غير متوفر للطلب حالياً" : "Sorry, this product is currently unavailable",
        variant: "destructive",
      });
      return;
    }

    const reservationPackages: Array<{packageName: string; description?: string; price: number; duration?: string; maxGuests?: number;}> = (activeItem as any)?.reservationPackages || [];
    if ((activeItem as any)?.isReservation && reservationPackages.length > 0 && selectedReservationPackageIdx === null) {
      toast({
        title: isAr ? "تنبيه" : "Notice",
        description: isAr ? "يرجى اختيار باقة الحجز" : "Please select a reservation package",
        variant: "destructive",
      });
      return;
    }

    const addonGroupsDef: AddonGroup[] = (activeItem as any)?.addonGroups || [];
    const groupValidErr = validateAddonGroups(addonGroupsDef, selectedAddonGroups);
    if (groupValidErr) {
      toast({ title: isAr ? "تنبيه" : "Notice", description: groupValidErr, variant: "destructive" });
      return;
    }

    for (let i = 0; i < bundledSections.length; i++) {
      const section = bundledSections[i];
      if (section.minSelectable > 0) {
        const selected = selectedBundledItems[i] || [];
        if (selected.length < section.minSelectable) {
          toast({
            title: isAr ? "تنبيه" : "Notice",
            description: isAr ? `يرجى اختيار ${section.minSelectable === 1 ? 'منتج' : section.minSelectable + ' منتجات'} من "${section.sectionTitle}"` : `Please select from "${section.sectionTitle}"`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const selectedItemAddons = selectedItemAddonIndices.map(idx => inlineAddons[idx]).filter(Boolean);

    const selectedBundledDetails = bundledSections.map((section, secIdx) => {
      const selectedIds = selectedBundledItems[secIdx] || [];
      return {
        sectionTitle: section.sectionTitle,
        selectedItems: section.items.filter(it => selectedIds.includes(it.productId)),
      };
    }).filter(s => s.selectedItems.length > 0);

    const selectedReservationPackage = (selectedReservationPackageIdx !== null && reservationPackages[selectedReservationPackageIdx])
      ? reservationPackages[selectedReservationPackageIdx] : null;

    const cartItem = {
      coffeeItemId: activeItem.id,
      quantity,
      selectedSize: selectedSize || "default",
      selectedAddons: selectedAddons,
      selectedItemAddons,
      selectedBundledItems: selectedBundledDetails,
      selectedAddonGroups,
      isReservation: !!(activeItem as any)?.isReservation,
      selectedReservationPackage,
    };

    onAddToCart(cartItem);
    resetModal();
  };

  if (!activeItem) return null;

  const addonGroupsDef: AddonGroup[] = (activeItem as any)?.addonGroups || [];
  const addonGroupsPrice = calcAddonGroupsPrice(selectedAddonGroups);

  const inlineAddonsPrice = selectedItemAddonIndices.reduce((sum, idx) => {
    return sum + (inlineAddons[idx]?.price ?? 0);
  }, 0);

  const productAddonPrice = selectedAddons.reduce((sum, addonId) => {
    const addon = allAddons.find((a) => a.id === addonId);
    return sum + (addon?.price ?? 0);
  }, 0);

  const reservationPkgs: Array<{packageName: string; price: number;}> = (activeItem as any)?.reservationPackages || [];
  const reservationPackagePrice = (selectedReservationPackageIdx !== null && reservationPkgs[selectedReservationPackageIdx])
    ? reservationPkgs[selectedReservationPackageIdx].price : null;

  const totalPrice = (activeItem as any)?.isReservation && reservationPackagePrice !== null
    ? reservationPackagePrice * quantity
    : (selectedSize
      ? activeItem.availableSizes?.find((s) => s.nameAr === selectedSize)?.price ??
        activeItem.price
      : activeItem.price) * quantity +
    (productAddonPrice + inlineAddonsPrice + bundledItemsPrice + addonGroupsPrice) * quantity;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetModal()}>
      <DialogContent className="max-w-sm bg-background border border-border rounded-2xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="relative h-28 flex-shrink-0 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
          {activeItem.imageUrl && (
            <img 
              src={activeItem.imageUrl.startsWith('/') || activeItem.imageUrl.startsWith('data:') || activeItem.imageUrl.startsWith('http') ? activeItem.imageUrl : `/${activeItem.imageUrl}`} 
              alt={isAr ? activeItem.nameAr : activeItem.nameEn || activeItem.nameAr} 
              className="w-20 h-20 rounded-xl object-cover border-4 border-background shadow-lg"
            />
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pb-2 space-y-4">
          <DialogHeader className="pt-2">
            <DialogTitle className="text-xl font-bold text-center text-foreground">
              {isAr ? activeItem.nameAr : activeItem.nameEn || activeItem.nameAr}
            </DialogTitle>
            {activeItem.description && (
              <p className="text-xs text-muted-foreground text-center line-clamp-2 mt-1">
                {activeItem.description}
              </p>
            )}
          </DialogHeader>

          {variants.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "اختر النوع" : "Select Type"}</Label>
              <div className="flex flex-wrap gap-3">
                {variants.map((variant) => {
                  const displayName = isAr 
                    ? (variant.nameAr.replace(activeItem.nameAr, '').trim() || variant.nameAr)
                    : ((variant.nameEn || variant.nameAr).replace(activeItem.nameEn || activeItem.nameAr, '').trim() || variant.nameEn || variant.nameAr);
                  
                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setSelectedSize(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        selectedVariant?.id === variant.id 
                          ? "bg-primary text-white shadow-md border-2 border-primary" 
                          : "bg-secondary text-foreground border-2 border-border hover:border-primary/50"
                      }`}
                    >
                      {isAr ? variant.nameAr : variant.nameEn || variant.nameAr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeItem.availableSizes && activeItem.availableSizes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "اختر الحجم" : "Select Size"}</Label>
              <div className="grid grid-cols-3 gap-2">
                {activeItem.availableSizes.map((size) => (
                  <button
                    key={size.nameAr}
                    onClick={() => setSelectedSize(size.nameAr)}
                    className={`p-2 rounded-xl text-center transition-all ${
                      selectedSize === size.nameAr
                        ? "bg-primary text-white shadow-md"
                        : "bg-secondary border border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xs font-semibold">{isAr ? size.nameAr : (size as any).nameEn || size.nameAr}</div>
                    <div className={`text-xs mt-0.5 ${selectedSize === size.nameAr ? "text-white/80" : "text-primary font-bold"}`}>
                      <span className="flex items-center justify-center gap-0.5">{size.price} <SarIcon /></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {inlineAddons.length > 0 && (
            <div className="space-y-3">
              {(() => {
                const sections: Record<string, number[]> = {};
                inlineAddons.forEach((addon, idx) => {
                  const sec = (addon as any).section || '';
                  if (!sections[sec]) sections[sec] = [];
                  sections[sec].push(idx);
                });
                return Object.entries(sections).map(([sec, indices]) => {
                  const isSingleSelect = indices.some(i => (inlineAddons[i] as any).selectionType === 'single');
                  return (
                  <div key={sec} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold text-foreground">
                        {sec || (isAr ? "الإضافات" : "Extras")}
                      </Label>
                      {isSingleSelect && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                          {isAr ? "اختر واحداً" : "Select one"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {indices.map((idx) => {
                        const addon = inlineAddons[idx];
                        const selected = selectedItemAddonIndices.includes(idx);
                        const imgSrc = (addon as any).imageUrl;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (isSingleSelect) {
                                setSelectedItemAddonIndices((prev) => {
                                  const withoutSection = prev.filter(i => !indices.includes(i));
                                  return prev.includes(idx) ? withoutSection : [...withoutSection, idx];
                                });
                              } else {
                                setSelectedItemAddonIndices((prev) =>
                                  prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                                );
                              }
                            }}
                            className={`rounded-xl text-xs font-medium transition-all flex items-center gap-2 px-3 py-2 ${
                              selected
                                ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                                : "bg-secondary text-foreground border border-border hover:border-primary/50"
                            }`}
                          >
                            {imgSrc && (
                              <img
                                src={imgSrc.startsWith('/') || imgSrc.startsWith('data:') || imgSrc.startsWith('http') ? imgSrc : '/' + imgSrc}
                                alt={addon.nameAr}
                                className="w-6 h-6 rounded object-cover"
                              />
                            )}
                            <span>{isAr ? addon.nameAr : ((addon as any).nameEn || addon.nameAr)}</span>
                            {addon.price > 0 && (
                              <span className={selected ? "text-white/80" : "text-primary font-bold"}>
                                +{addon.price}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  );
                });
              })()}
            </div>
          )}

          {addonGroupsDef.length > 0 && (
            <AddonGroupsSelector
              groups={addonGroupsDef}
              value={selectedAddonGroups}
              onChange={setSelectedAddonGroups}
            />
          )}

          {specificAddons.length > 0 && inlineAddons.length === 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "الإضافات" : "Addons"}</Label>
              <div className="flex flex-wrap gap-2">
                {specificAddons.map((addon) => (
                  <button
                    key={addon.id}
                    onClick={() => {
                      setSelectedAddons((prev) =>
                        prev.includes(addon.id)
                          ? prev.filter((id) => id !== addon.id)
                          : [...prev, addon.id]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      selectedAddons.includes(addon.id)
                        ? "bg-primary text-white shadow-md"
                        : "bg-secondary text-foreground border border-border hover:border-primary/50"
                    }`}
                  >
                    {isAr ? addon.nameAr : addon.nameEn || addon.nameAr}
                    <span className={selectedAddons.includes(addon.id) ? "text-white/80" : "text-primary"}>
                      +{addon.price}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {generalAddons.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{specificAddons.length > 0 ? (isAr ? "إضافات عامة" : "General Addons") : (isAr ? "إضافات عامة" : "General Addons")}</Label>
              <div className="flex flex-wrap gap-2">
                {generalAddons.slice(0, 6).map((addon) => (
                  <button
                    key={addon.id}
                    onClick={() => {
                      setSelectedAddons((prev) =>
                        prev.includes(addon.id)
                          ? prev.filter((id) => id !== addon.id)
                          : [...prev, addon.id]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      selectedAddons.includes(addon.id)
                        ? "bg-accent text-white shadow-md"
                        : "bg-secondary text-foreground border border-border hover:border-accent/50"
                    }`}
                  >
                    {isAr ? addon.nameAr : addon.nameEn || addon.nameAr}
                    <span className={selectedAddons.includes(addon.id) ? "text-white/80" : "text-accent"}>
                      +{addon.price}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {drinkAddons.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{isAr ? "إضافة مشروب" : "Add Drink"}</Label>
              <div className="flex flex-wrap gap-2">
                {drinkAddons.map((addon) => {
                  const linkedDrink = getLinkedDrinkInfo(addon);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => {
                        setSelectedAddons((prev) =>
                          prev.includes(addon.id)
                            ? prev.filter((id) => id !== addon.id)
                            : [...prev, addon.id]
                        );
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        selectedAddons.includes(addon.id)
                          ? "bg-primary text-white shadow-md ring-2 ring-primary/50"
                          : "bg-secondary text-foreground border border-border hover:border-primary/50"
                      }`}
                    >
                      {linkedDrink?.imageUrl && (
                        <img 
                          src={linkedDrink.imageUrl.startsWith('/') || linkedDrink.imageUrl.startsWith('data:') || linkedDrink.imageUrl.startsWith('http') ? linkedDrink.imageUrl : `/${linkedDrink.imageUrl}`}
                          alt={isAr ? addon.nameAr : addon.nameEn || addon.nameAr}
                          className="w-6 h-6 rounded object-cover"
                        />
                      )}
                      <span>{isAr ? addon.nameAr : addon.nameEn || addon.nameAr}</span>
                      <span className={selectedAddons.includes(addon.id) ? "text-white/80" : "text-primary font-bold"}>
                        +{addon.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(activeItem as any)?.isReservation && ((activeItem as any)?.reservationPackages || []).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🗓️</span>
                <Label className="text-sm font-semibold text-foreground">{isAr ? "اختر باقة الحجز" : "Select Reservation Package"}</Label>
                <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">{isAr ? "مطلوب" : "Required"}</span>
              </div>
              <div className="space-y-2">
                {((activeItem as any)?.reservationPackages || []).map((pkg: any, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedReservationPackageIdx(idx)}
                    className={`w-full text-right p-3 rounded-lg border-2 transition-all ${selectedReservationPackageIdx === idx ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-card hover:border-amber-300'}`}
                    data-testid={`btn-select-pkg-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold text-sm text-foreground">{pkg.packageName}</span>
                        {pkg.description && <span className="text-xs text-muted-foreground">{pkg.description}</span>}
                        <div className="flex items-center gap-3 mt-1">
                          {pkg.duration && <span className="text-xs text-amber-700 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">⏱️ {pkg.duration}</span>}
                          {pkg.maxGuests && <span className="text-xs text-blue-700 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">👥 {isAr ? `حتى ${pkg.maxGuests} أشخاص` : `Up to ${pkg.maxGuests} guests`}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`font-bold text-sm ${selectedReservationPackageIdx === idx ? 'text-amber-600' : 'text-primary'}`}>{pkg.price}</span>
                        <SarIcon className={`w-3.5 h-3.5 ${selectedReservationPackageIdx === idx ? 'text-amber-600' : 'text-primary'}`} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {bundledSections.length > 0 && bundledSections.some(s => s.items.length > 0) && (
            <div className="space-y-3">
              {bundledSections.filter(s => s.items.length > 0).map((section, secIdx) => (
                <div key={secIdx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold text-foreground">{section.sectionTitle || (isAr ? "منتجات مصاحبة" : "Add-on Products")}</Label>
                    {section.minSelectable > 0 && (
                      <span className="text-[10px] text-red-500 border border-red-200 rounded-full px-2 py-0.5">{isAr ? "إلزامي" : "Required"}</span>
                    )}
                    {section.selectionType === 'single' ? (
                      <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">{isAr ? "اختر واحداً" : "Select one"}</span>
                    ) : section.maxSelectable > 1 ? (
                      <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">{isAr ? `حتى ${section.maxSelectable}` : `Up to ${section.maxSelectable}`}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {section.items.map((bItem) => {
                      const selectedIds = selectedBundledItems[secIdx] || [];
                      const isSelected = selectedIds.includes(bItem.productId);
                      return (
                        <button
                          key={bItem.productId}
                          type="button"
                          onClick={() => {
                            setSelectedBundledItems(prev => {
                              const current = prev[secIdx] || [];
                              if (section.selectionType === 'single') {
                                return {...prev, [secIdx]: isSelected ? [] : [bItem.productId]};
                              } else {
                                const maxSel = section.maxSelectable || 99;
                                if (isSelected) return {...prev, [secIdx]: current.filter(id => id !== bItem.productId)};
                                if (current.length >= maxSel) return prev;
                                return {...prev, [secIdx]: [...current, bItem.productId]};
                              }
                            });
                          }}
                          className={`rounded-xl text-xs font-medium transition-all flex items-center gap-2 px-3 py-2 ${
                            isSelected
                              ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                              : "bg-secondary text-foreground border border-border hover:border-primary/50"
                          }`}
                          data-testid={`btn-bundle-item-${secIdx}-${bItem.productId}`}
                        >
                          {bItem.imageUrl && (
                            <img src={bItem.imageUrl.startsWith('/') || bItem.imageUrl.startsWith('data:') || bItem.imageUrl.startsWith('http') ? bItem.imageUrl : '/' + bItem.imageUrl} alt={bItem.nameAr} className="w-7 h-7 rounded object-cover" />
                          )}
                          <div className="text-right">
                            <div>{isAr ? bItem.nameAr : (bItem.nameEn || bItem.nameAr)}</div>
                            <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-primary font-bold'}`}>
                              {bItem.customPrice === 0 ? (isAr ? "مجاني 🎁" : "Free 🎁") : <span>+{bItem.customPrice} <SarIcon size={10} /></span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
            <Label className="text-sm font-semibold text-foreground">{isAr ? "الكمية" : "Quantity"}</Label>
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-8 w-8 rounded-lg border-border"
                data-testid="button-decrease-quantity"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-6 text-center font-bold text-lg text-foreground">{quantity}</span>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(quantity + 1)}
                className="h-8 w-8 rounded-lg border-border"
                data-testid="button-increase-quantity"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

        </div>
        </div>

        {/* ── Fixed footer: total + add button ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t bg-background">
          <div>
            <span className="text-xs text-muted-foreground">{isAr ? "الإجمالي" : "Total"}</span>
            <div className="text-2xl font-bold text-primary">
              {totalPrice.toFixed(2)} <span className="text-sm"><SarIcon /></span>
            </div>
          </div>
          <Button
            onClick={handleAddToCart}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-5 rounded-xl font-bold shadow-lg"
            data-testid="button-add-to-cart"
          >
            <ShoppingCart className="w-4 h-4 ml-2" />
            {isAr ? "إضافة" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
