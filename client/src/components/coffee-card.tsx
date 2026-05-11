import { useState, memo, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/cart-store";
import { getCoffeeImage } from "@/lib/coffee-data-clean";
import { Plus, Eye, ChevronDown, Check } from "lucide-react";
import type { CoffeeItem } from "@shared/schema";
import CoffeeStrengthBadge from "@/components/coffee-strength-badge";
import DrinkCustomizationDialog, { type DrinkCustomization } from "./drink-customization-dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface CoffeeCardProps {
  item: CoffeeItem;
  variants?: CoffeeItem[];
}

function CoffeeCard({ item, variants = [] }: CoffeeCardProps) {
  const [, setLocation] = useLocation();
  const { addToCart } = useCartStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<CoffeeItem>(item);

  // Use variants passed from props
  const allVariants = useMemo(() => {
    return variants.length > 0 ? variants : [item];
  }, [variants, item]);

  const discount = selectedVariant.oldPrice ? 
    Math.round(((Number(selectedVariant.oldPrice) - Number(selectedVariant.price)) / Number(selectedVariant.oldPrice)) * 100) : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCustomizing(true);
  };

  const handleConfirmCustomization = (customization: DrinkCustomization, quantity: number, variantFromDialog?: CoffeeItem) => {
    const activeItem = variantFromDialog || selectedVariant;
    const selectedSize = customization.notes?.match(/الحجم: (.*)/)?.[1] || null;
    const selectedAddonIds = customization.selectedAddons.map(a => a.addonId);
    
    addToCart(activeItem.id, quantity, selectedSize, selectedAddonIds);
    setIsAnimating(true);
    setIsCustomizing(false);
    setTimeout(() => setIsAnimating(false), 2000);
  };

  const handleViewDetails = () => {
    setIsCustomizing(true);
  };

  const hasSizes = Array.isArray(selectedVariant.availableSizes) && selectedVariant.availableSizes.length > 0;
  const displayPrice = hasSizes 
    ? Math.min(...selectedVariant.availableSizes!.map(s => Number(s.price)))
    : selectedVariant.price;

  const getStatusOverlay = () => {
    if (selectedVariant.availabilityStatus === 'out_of_stock') {
      return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
          <Badge className="bg-red-600 text-white text-base py-2 px-6 rounded-full shadow-2xl border-2 border-white/20">
            نفذت الكمية
          </Badge>
        </div>
      );
    }
    if (selectedVariant.availabilityStatus === 'coming_soon') {
      return (
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center z-20">
          <Badge className="bg-blue-600 text-white text-base py-2 px-6 rounded-full shadow-2xl border-2 border-white/20">
            قريباً
          </Badge>
        </div>
      );
    }
    if (selectedVariant.availabilityStatus === 'temporarily_unavailable' || selectedVariant.isAvailable === 0) {
      if (selectedVariant.availabilityStatus === 'available' || selectedVariant.availabilityStatus === 'new') {
         // If isAvailable is 0 but status says available, it's effectively unavailable
      } else {
        return (
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-20">
            <Badge className="bg-destructive text-destructive-foreground text-base py-2 px-6 rounded-full shadow-2xl border-2 border-white/20">
              غير متوفر حالياً
            </Badge>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <Card 
      className={`bg-gradient-to-br from-card/95 to-card/85 backdrop-blur-sm rounded-xl sm:rounded-2xl card-hover cursor-pointer overflow-hidden group transform transition-all duration-500 hover:scale-105 hover:shadow-xl sm:hover:shadow-2xl hover:shadow-primary/20 border border-card-border/50 hover:border-primary/30 ${selectedVariant.isAvailable === 0 ? 'grayscale-[0.5]' : ''}`}
      onClick={handleViewDetails}
      data-testid={`card-coffee-${selectedVariant.id}`}
    >
      <CardContent className="p-0">
        <div className="relative overflow-hidden">
          {getStatusOverlay()}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
          <img 
            src={selectedVariant.imageUrl ? (selectedVariant.imageUrl.startsWith('/') ? selectedVariant.imageUrl : `/${selectedVariant.imageUrl}`) : getCoffeeImage(selectedVariant.id)}
            alt={selectedVariant.nameAr}
            className="w-full h-40 sm:h-48 md:h-52 object-cover transition-all duration-700 group-hover:scale-110 brightness-95 group-hover:brightness-105"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.src = "/logo.png";
            }}
            data-testid={`img-coffee-${selectedVariant.id}`}
          />

          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1.5 sm:gap-2 z-30">
            {selectedVariant.availabilityStatus === 'new' && (
              <Badge className="bg-purple-600 text-white border-purple-400 animate-pulse shadow-lg">
                جديد
              </Badge>
            )}
            {allVariants.length > 1 && (
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                {allVariants.length} خيارات
              </Badge>
            )}
            {discount > 0 && (
              <Badge 
                variant="default" 
                className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg glow-effect"
                data-testid={`badge-discount-${selectedVariant.id}`}
              >
                خصم {discount}%
              </Badge>
            )}
          </div>

          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 sm:top-3 right-2 sm:right-3 w-8 h-8 sm:w-10 sm:h-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-card/90 backdrop-blur-sm border border-card-border hover:bg-primary hover:text-primary-foreground shadow-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleViewDetails();
            }}
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
          <div className="text-center border-b border-border/30 pb-2 sm:pb-3 space-y-1.5 sm:space-y-2">
            {allVariants.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" className="h-auto p-0 hover:bg-transparent group/title">
                    <h4 className="font-amiri text-base sm:text-lg md:text-xl font-bold text-primary mb-1 golden-gradient flex items-center gap-1">
                      {selectedVariant.nameAr}
                      <ChevronDown className="w-4 h-4 transition-transform group-hover/title:translate-y-0.5" />
                    </h4>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {allVariants.map((v) => (
                    <DropdownMenuItem 
                      key={v.id} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVariant(v);
                      }}
                      className="flex justify-between items-center"
                    >
                      <span>{v.nameAr}</span>
                      {selectedVariant.id === v.id && <Check className="w-4 h-4 ml-2" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <h4 className="font-amiri text-base sm:text-lg md:text-xl font-bold text-primary mb-1 golden-gradient">
                {selectedVariant.nameAr}
              </h4>
            )}

            <div className="flex justify-center">
              <CoffeeStrengthBadge 
                strength={selectedVariant.coffeeStrength ?? null} 
                strengthLevel={selectedVariant.strengthLevel ?? null}
                size="sm"
              />
            </div>

            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed line-clamp-2 pt-1">
              {selectedVariant.description}
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="text-right">
              {selectedVariant.oldPrice && (
                <div className="price-old text-xs sm:text-sm text-muted-foreground">
                  {selectedVariant.oldPrice} ريال
                </div>
              )}
              <div className="text-primary font-bold text-lg sm:text-xl md:text-2xl font-amiri">
                {displayPrice} ريال
              </div>
            </div>

            <Button
              onClick={handleAddToCart}
              size="sm"
              disabled={selectedVariant.isAvailable === 0 || (selectedVariant.availabilityStatus !== 'available' && selectedVariant.availabilityStatus !== 'new' && !!selectedVariant.availabilityStatus)}
              className={`bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:from-primary/90 hover:to-primary transition-all duration-300 transform hover:scale-110 shadow-md sm:shadow-lg hover:shadow-primary/30 rounded-full px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                isAnimating ? 'add-to-cart-animation glow-effect' : ''
              }`}
              data-testid={`button-add-${selectedVariant.id}`}
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              <span className="hidden sm:inline">
                {selectedVariant.availabilityStatus === 'out_of_stock' ? ' نفذت الكمية' :
                selectedVariant.availabilityStatus === 'coming_soon' ? ' قريباً' :
                selectedVariant.availabilityStatus === 'temporarily_unavailable' ? ' غير متوفر' :
                isAnimating ? ' تم الإضافة ' : 'تخصيص'}
              </span>
              <span className="sm:hidden">
                {selectedVariant.availabilityStatus === 'out_of_stock' ? 'نفذ' :
                selectedVariant.availabilityStatus === 'coming_soon' ? 'قريباً' :
                selectedVariant.availabilityStatus === 'temporarily_unavailable' ? '⏸' :
                isAnimating ? '' : 'تخصيص'}
              </span>
            </Button>
          </div>
        </div>
      </CardContent>
      <DrinkCustomizationDialog
        coffeeItem={selectedVariant}
        variants={allVariants}
        open={isCustomizing}
        onClose={() => setIsCustomizing(false)}
        onConfirm={handleConfirmCustomization}
      />
    </Card>
  );
}

export default memo(CoffeeCard);