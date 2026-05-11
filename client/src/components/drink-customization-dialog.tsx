import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Coffee, Milk, Droplets, Plus, Minus, Check, Loader2,
  CandyOff, Candy, RotateCcw, Star
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CoffeeItem } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

interface ProductAddon {
  id: string;
  nameAr: string;
  nameEn?: string;
  category: 'sugar' | 'milk' | 'shot' | 'syrup' | 'topping' | 'size' | 'other';
  price: number;
  isAvailable: number;
  rawItemId?: string;
  quantityPerUnit?: number;
  unit?: string;
}

interface CoffeeItemAddon {
  coffeeItemId: string;
  addonId: string;
  isDefault: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface SelectedAddon {
  addonId: string;
  nameAr: string;
  quantity: number;
  price: number;
  category: string;
  rawItemId?: string;
  quantityPerUnit?: number;
  unit?: string;
}

export interface DrinkCustomization {
  selectedSize?: string;
  selectedAddons: SelectedAddon[];
  totalAddonsPrice: number;
  notes?: string;
}

interface DrinkCustomizationDialogProps {
  coffeeItem: CoffeeItem | null;
  variants?: CoffeeItem[];
  open: boolean;
  onClose: () => void;
  onConfirm: (customization: DrinkCustomization, quantity: number, selectedVariant?: CoffeeItem) => void;
  initialCustomization?: DrinkCustomization;
  initialQuantity?: number;
  modal?: boolean;
}

const CATEGORY_INFO: Record<string, { nameAr: string; nameEn: string; icon: typeof Coffee; descAr: string; descEn: string }> = {
  sugar: { nameAr: "السكر", nameEn: "Sugar", icon: Candy, descAr: "اختر مستوى السكر", descEn: "Choose sugar level" },
  milk: { nameAr: "الحليب", nameEn: "Milk", icon: Milk, descAr: "اختر نوع الحليب", descEn: "Choose milk type" },
  shot: { nameAr: "إضافة خاصة", nameEn: "Special Add-on", icon: Coffee, descAr: "إضافة خاصة للطبق", descEn: "Add special addon" },
  syrup: { nameAr: "النكهات", nameEn: "Flavors", icon: Droplets, descAr: "إضافة نكهة", descEn: "Add flavor" },
  topping: { nameAr: "الإضافات", nameEn: "Toppings", icon: Plus, descAr: "إضافات إضافية", descEn: "Extra toppings" },
  size: { nameAr: "الحجم", nameEn: "Size", icon: Coffee, descAr: "اختر الحجم", descEn: "Choose size" },
  other: { nameAr: "أخرى", nameEn: "Other", icon: Plus, descAr: "خيارات أخرى", descEn: "Other options" },
};

export default function DrinkCustomizationDialog({
  coffeeItem,
  variants = [],
  open,
  onClose,
  onConfirm,
  initialCustomization,
  initialQuantity = 1,
  modal = true,
}: DrinkCustomizationDialogProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, SelectedAddon>>(new Map());
  const [notes, setNotes] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<CoffeeItem | null>(coffeeItem);
  const activeItem = selectedVariant || coffeeItem;
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Reset all internal state whenever the product changes (user clicks a different product)
  useEffect(() => {
    setSelectedVariant(coffeeItem);
    setSelectedAddons(new Map());
    setNotes("");
    setQuantity(initialQuantity);
    setSelectedSize(null);
  }, [coffeeItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeItem?.availableSizes && activeItem.availableSizes.length > 0) {
      const defaultSize = activeItem.availableSizes[0];
      setSelectedSize(defaultSize.nameAr);
    }
  }, [activeItem?.id]); // Watch by ID to avoid infinite loop

  const { data: allAddons = [], isLoading: loadingAddons } = useQuery<ProductAddon[]>({
    queryKey: ["/api/product-addons"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/product-addons");
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }
  });

  const { data: coffeeAddons = [], isLoading: loadingCoffeeAddons } = useQuery<CoffeeItemAddon[]>({
    queryKey: ["/api/coffee-items", activeItem?.id, "addons"],
    enabled: !!activeItem?.id,
    queryFn: async () => {
      if (!activeItem?.id) return [];
      try {
        const res = await fetch(`/api/coffee-items/${activeItem.id}/addons`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }
  });

  useEffect(() => {
    if (initialCustomization?.selectedAddons) {
      const map = new Map<string, SelectedAddon>();
      initialCustomization.selectedAddons.forEach(addon => {
        map.set(addon.addonId, addon);
      });
      setSelectedAddons(map);
      setNotes(initialCustomization.notes || "");
    } else if (coffeeAddons.length > 0 && allAddons.length > 0) {
      const map = new Map<string, SelectedAddon>();
      coffeeAddons.forEach(link => {
        if (link.isDefault === 1) {
          const addon = allAddons.find(a => a.id === link.addonId);
          if (addon) {
            map.set(addon.id, {
              addonId: addon.id,
              nameAr: addon.nameAr,
              quantity: 1,
              price: addon.price,
              category: addon.category,
              rawItemId: addon.rawItemId,
              quantityPerUnit: addon.quantityPerUnit,
              unit: addon.unit,
            });
          }
        }
      });
      setSelectedAddons(map);
    }
  }, [coffeeAddons, allAddons, initialCustomization]);

  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  const itemMenuCategory = (activeItem as any)?.category || '';
  const availableAddons = allAddons.filter(addon => {
    if (addon.isAvailable !== 1) return false;
    if (!coffeeAddons.some(link => link.addonId === addon.id)) return false;
    // If addon has a menuCategory set, only show it when item's category matches
    if ((addon as any).menuCategory && itemMenuCategory) {
      return (addon as any).menuCategory === itemMenuCategory;
    }
    return true;
  });

  const groupedAddons = availableAddons.reduce((groups, addon) => {
    const category = addon.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(addon);
    return groups;
  }, {} as Record<string, ProductAddon[]>);

  const getAddonLink = (addonId: string) => {
    return coffeeAddons.find(link => link.addonId === addonId);
  };

  const toggleAddon = (addon: ProductAddon, isSingleSelect: boolean) => {
    const newSelection = new Map(selectedAddons);
    
    if (isSingleSelect) {
      availableAddons
        .filter(a => a.category === addon.category)
        .forEach(a => newSelection.delete(a.id));
    }
    
    if (selectedAddons.has(addon.id) && !isSingleSelect) {
      newSelection.delete(addon.id);
    } else {
      newSelection.set(addon.id, {
        addonId: addon.id,
        nameAr: addon.nameAr,
        quantity: 1,
        price: addon.price,
        category: addon.category,
        rawItemId: addon.rawItemId,
        quantityPerUnit: addon.quantityPerUnit,
        unit: addon.unit,
      });
    }
    
    setSelectedAddons(newSelection);
  };

  const updateAddonQuantity = (addonId: string, delta: number) => {
    const addon = selectedAddons.get(addonId);
    const link = getAddonLink(addonId);
    if (!addon || !link) return;

    const newQuantity = addon.quantity + delta;
    if (newQuantity < link.minQuantity) {
      const newSelection = new Map(selectedAddons);
      newSelection.delete(addonId);
      setSelectedAddons(newSelection);
    } else if (newQuantity <= link.maxQuantity) {
      const newSelection = new Map(selectedAddons);
      newSelection.set(addonId, { ...addon, quantity: newQuantity });
      setSelectedAddons(newSelection);
    }
  };

  const calculateAddonsPrice = () => {
    let total = 0;
    selectedAddons.forEach(addon => {
      total += addon.price * addon.quantity;
    });
    return total;
  };

  const handleCancel = () => {
    onClose();
  };

  const handleConfirm = () => {
    const customization: DrinkCustomization = {
      selectedSize: selectedSize || undefined,
      selectedAddons: Array.from(selectedAddons.values()),
      totalAddonsPrice: calculateAddonsPrice(),
      notes: notes.trim() || undefined,
    };
    if (selectedSize) {
      const sizeInfo = activeItem?.availableSizes?.find(s => s.nameAr === selectedSize);
      if (sizeInfo) {
        customization.notes = `${customization.notes ? customization.notes + ' - ' : ''}الحجم: ${sizeInfo.nameAr}`;
      }
    }
    onConfirm(customization, quantity, activeItem || undefined);
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleResetToDefault = () => {
    const map = new Map<string, SelectedAddon>();
    coffeeAddons.forEach(link => {
      if (link.isDefault === 1) {
        const addon = allAddons.find(a => a.id === link.addonId);
        if (addon) {
          map.set(addon.id, {
            addonId: addon.id,
            nameAr: addon.nameAr,
            quantity: 1,
            price: addon.price,
            category: addon.category,
            rawItemId: addon.rawItemId,
            quantityPerUnit: addon.quantityPerUnit,
            unit: addon.unit,
          });
        }
      }
    });
    setSelectedAddons(map);
    setNotes("");
  };

  const basePrice = selectedSize 
    ? Number(activeItem?.availableSizes?.find(s => s.nameAr === selectedSize)?.price || activeItem?.price || 0)
    : Number(activeItem?.price || 0);
  const addonsPrice = calculateAddonsPrice();
  const totalItemPrice = (basePrice + addonsPrice) * quantity;

  const isLoading = loadingAddons || loadingCoffeeAddons;

  // Auto-confirm if product has no sizes and no add-ons after loading
  useEffect(() => {
    if (!open || isLoading || !activeItem) return;
    const hasSizes = activeItem.availableSizes && activeItem.availableSizes.length > 0;
    const hasVariants = variants && variants.length > 1;
    const hasAddons = availableAddons.length > 0;
    if (!hasSizes && !hasVariants && !hasAddons) {
      const customization: DrinkCustomization = {
        selectedAddons: [],
        totalAddonsPrice: 0,
      };
      onConfirm(customization, quantity, activeItem);
      onClose();
    }
  }, [isLoading, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeItem) return null;

  return (
    <Dialog open={open} onOpenChange={onClose} modal={modal}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-customization">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Coffee className="w-5 h-5" />
            {isAr ? `تخصيص ${activeItem.nameAr}` : `Customize ${activeItem.nameEn || activeItem.nameAr}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-4 p-1">
              {variants.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Star className="w-4 h-4" />
                    <span>{isAr ? "النوع" : "Type"}</span>
                    <Badge variant="outline" className="text-xs">{isAr ? "اختر واحد" : "Select one"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {variants.map(v => (
                      <div
                        key={v.id}
                        className={`relative rounded-md border p-3 cursor-pointer transition-all ${
                          activeItem.id === v.id
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover-elevate'
                        }`}
                        onClick={() => setSelectedVariant(v)}
                        data-testid={`variant-${v.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{isAr ? v.nameAr : v.nameEn || v.nameAr}</p>
                            <p className="text-xs text-primary">{v.price} <SarIcon /></p>
                          </div>
                          {activeItem.id === v.id && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-3" />
                </div>
              )}

              {activeItem.availableSizes && activeItem.availableSizes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Coffee className="w-4 h-4" />
                    <span>{isAr ? "الحجم" : "Size"}</span>
                    <Badge variant="outline" className="text-xs">{isAr ? "اختر واحد" : "Select one"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeItem.availableSizes.map(size => (
                      <div
                        key={size.nameAr}
                        className={`relative rounded-md border p-3 cursor-pointer transition-all ${
                          selectedSize === size.nameAr
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover-elevate'
                        }`}
                        onClick={() => setSelectedSize(size.nameAr)}
                        data-testid={`size-${size.nameAr}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{isAr ? size.nameAr : (size as any).nameEn || size.nameAr}</p>
                            <p className="text-xs text-primary">{size.price} <SarIcon /></p>
                          </div>
                          {selectedSize === size.nameAr && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-3" />
                </div>
              )}

              {Object.entries(groupedAddons).map(([category, addons]) => {
                const categoryInfo = CATEGORY_INFO[category] || CATEGORY_INFO.other;
                const isSingleSelect = addons.some((a: any) => a.selectionType === 'single') || category === 'sugar' || category === 'milk' || category === 'size' || category.toLowerCase() === 'size';
                const CategoryIcon = categoryInfo.icon;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <CategoryIcon className="w-4 h-4" />
                      <span>{isAr ? categoryInfo.nameAr : categoryInfo.nameEn}</span>
                      {isSingleSelect && (
                        <Badge variant="outline" className="text-xs">{isAr ? "اختر واحد" : "Select one"}</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {addons.map(addon => {
                        const isSelected = selectedAddons.has(addon.id);
                        const selectedAddon = selectedAddons.get(addon.id);
                        const link = getAddonLink(addon.id);
                        const canHaveMultiple = link && link.maxQuantity > 1 && !isSingleSelect;

                        return (
                          <div
                            key={addon.id}
                            className={`relative rounded-md border p-3 cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/10' 
                                : 'border-border hover-elevate'
                            }`}
                            onClick={() => !canHaveMultiple && toggleAddon(addon, isSingleSelect)}
                            data-testid={`addon-${addon.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{isAr ? addon.nameAr : addon.nameEn || addon.nameAr}</p>
                                {addon.price > 0 && (
                                  <p className="text-xs text-primary">+{addon.price} <SarIcon /></p>
                                )}
                              </div>
                              
                              {isSelected && !canHaveMultiple && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                              
                              {canHaveMultiple && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        updateAddonQuantity(addon.id, -1);
                                      }
                                    }}
                                    data-testid={`button-decrease-${addon.id}`}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-6 text-center text-sm font-medium">
                                    {selectedAddon?.quantity || 0}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        updateAddonQuantity(addon.id, 1);
                                      } else {
                                        toggleAddon(addon, false);
                                      }
                                    }}
                                    data-testid={`button-increase-${addon.id}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <Separator className="mt-3" />
                  </div>
                );
              })}

              {Object.keys(groupedAddons).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <CandyOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{isAr ? "لا توجد خيارات تخصيص إضافية لهذا الطبق" : "No customization options available for this item"}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{isAr ? "الكمية" : "Quantity"}</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                data-testid="button-decrease-quantity"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-8 text-center font-semibold" data-testid="text-quantity">{quantity}</span>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(quantity + 1)}
                data-testid="button-increase-quantity"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{isAr ? "سعر الوجبة" : "Item Price"}</span>
            <span className="flex items-center gap-1">{basePrice.toFixed(2)} <SarIcon /></span>
          </div>
          
          {addonsPrice > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{isAr ? "الإضافات" : "Addons"}</span>
              <span className="text-primary">+{addonsPrice.toFixed(2)} <SarIcon /></span>
            </div>
          )}

          <Separator />
          
          <div className="flex items-center justify-between font-semibold">
            <span>{isAr ? "الإجمالي" : "Total"}</span>
            <span className="text-lg" data-testid="text-total-price">{totalItemPrice.toFixed(2)} <SarIcon /></span>
          </div>
        </div>

        <DialogFooter className="flex flex-row flex-wrap justify-between gap-2">
          <Button 
            variant="ghost" 
            onClick={handleResetToDefault} 
            className="gap-1"
            data-testid="button-reset-default"
          >
            <RotateCcw className="w-4 h-4" />
            {isAr ? "إعادة للافتراضي" : "Reset to Default"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleConfirm} data-testid="button-confirm">
              {isAr ? "إضافة للطلب" : "Add to Order"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
