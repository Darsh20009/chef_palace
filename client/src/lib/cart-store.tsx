import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { CoffeeItem } from "@shared/schema";

// Enhanced cart item type with coffee details
interface EnrichedCartItem {
  id: string; // Unique ID for each cart entry (productId + size + addons)
  coffeeItemId: string;
  quantity: number;
  sessionId: string;
  coffeeItem?: CoffeeItem;
  selectedSize?: string;
  selectedAddons?: string[];
  enrichedAddons?: any[];
  selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null;
}

export interface DeliveryInfo {
  type: 'pickup' | 'delivery' | 'dine-in' | 'car-pickup' | 'scheduled-pickup';
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  productReservationDate?: string;
  productReservationFromTime?: string;
  productReservationToTime?: string;
  dineIn?: boolean;
  tableId?: string;
  tableNumber?: string;
  arrivalTime?: string;
  scheduledPickupTime?: string;
  carPickup?: boolean;
  carInfo?: {
    carType: string;
    carColor: string;
    plateNumber: string;
    parkingSlot?: string;
  };
  address?: {
    fullAddress: string;
    lat: number;
    lng: number;
    zone: string;
  };
  deliveryFee?: number;
  deliveryAddress?: string;
}

interface CartContextType {
  // State
  cartItems: EnrichedCartItem[];
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  sessionId: string;
  isLoading: boolean;
  deliveryInfo: DeliveryInfo | null;

  // Actions
  addToCart: (coffeeItemId: string, quantity?: number, selectedSize?: string | null, selectedAddons?: string[], selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>, selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
 
 // Delivery Actions
 setDeliveryInfo: (info: DeliveryInfo) => void;
 clearDeliveryInfo: () => void;
 
 // UI Actions
 showCart: () => void;
 hideCart: () => void;
 showCheckout: () => void;
 hideCheckout: () => void;

 // Computed
 getTotalPrice: () => number;
 getTotalItems: () => number;
 getFinalTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCartStore = (): CartContextType => {
 const context = useContext(CartContext);
 if (!context) {
 throw new Error("useCartStore must be used within a CartProvider");
 }
 return context;
};

// Safe JSON Parse Helper
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return fallback;
  }
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryInfo, setDeliveryInfoState] = useState<DeliveryInfo | null>(() => {
    const saved = localStorage.getItem("delivery-info");
    return safeJsonParse<DeliveryInfo | null>(saved, null);
  });
 const [sessionId] = useState(() => {
 // Get or create session ID
 let id = localStorage.getItem("coffee-session-id");
 if (!id) {
 id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
 localStorage.setItem("coffee-session-id", id);
 }
 return id;
 });

 const queryClient = useQueryClient();

 // Fetch cart items - always enabled so cart updates are immediately visible
 const { data: cartItems = [], isLoading } = useQuery<EnrichedCartItem[]>({
 queryKey: ["/api/cart", sessionId],
 enabled: true, // Always fetch to show cart updates immediately
 refetchOnWindowFocus: false,
 staleTime: 30000, // 30 seconds
 });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ coffeeItemId, quantity, selectedSize, selectedAddons, selectedItemAddons, selectedReservationPackage }: { coffeeItemId: string; quantity: number; selectedSize?: string | null; selectedAddons?: string[]; selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>; selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null }) => {
      console.log(`[CART] Adding to cart: item=${coffeeItemId}, size=${selectedSize}, addons=${selectedAddons}`);
      const response = await apiRequest("POST", "/api/cart", {
        sessionId,
        coffeeItemId,
        quantity,
        selectedSize: selectedSize || "default",
        selectedAddons: selectedAddons || [],
        selectedItemAddons: selectedItemAddons || [],
        selectedReservationPackage: selectedReservationPackage || null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log("[CART] Successfully added to cart:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
    },
    onError: (error) => {
      console.error("[CART] Add to cart error:", error);
    }
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => {
      console.log(`Updating quantity for ${cartItemId} to ${quantity}`);
      const response = await apiRequest("PUT", `/api/cart/${sessionId}/${cartItemId}`, {
        quantity,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
    },
  });

  // Remove from cart mutation
  const removeFromCartMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      console.log(`Removing item ${cartItemId} from cart`);
      const response = await apiRequest("DELETE", `/api/cart/${sessionId}/${cartItemId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
    },
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
  mutationFn: async () => {
  const response = await apiRequest("DELETE", `/api/cart/${sessionId}`);
  return response.json();
  },
  onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
  },
  });

  // Cart actions
  const addToCart = (coffeeItemId: string, quantity: number = 1, selectedSize?: string | null, selectedAddons?: string[], selectedItemAddons?: Array<{nameAr: string; nameEn?: string; price: number}>, selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null) => {
    // FIX: Ensure addons are properly formatted
    const formattedAddons = Array.isArray(selectedAddons) ? selectedAddons.map(id => String(id)) : [];
    addToCartMutation.mutate({ coffeeItemId, quantity, selectedSize, selectedAddons: formattedAddons, selectedItemAddons: selectedItemAddons || [], selectedReservationPackage: selectedReservationPackage || null });
  };

  const removeFromCart = (cartItemId: string) => {
  removeFromCartMutation.mutate(cartItemId);
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
  if (quantity <= 0) {
  removeFromCart(cartItemId);
  } else {
  updateQuantityMutation.mutate({ cartItemId, quantity });
  }
  };

 const clearCart = () => {
 clearCartMutation.mutate();
 clearDeliveryInfo();
 };

 // Delivery actions
 const setDeliveryInfo = (info: DeliveryInfo) => {
 setDeliveryInfoState(info);
 localStorage.setItem("delivery-info", JSON.stringify(info));
 };

 const clearDeliveryInfo = () => {
 setDeliveryInfoState(null);
 localStorage.removeItem("delivery-info");
 };

 // UI actions
 const showCart = () => setIsCartOpen(true);
 const hideCart = () => setIsCartOpen(false);
 const showCheckout = () => setIsCheckoutOpen(true);
 const hideCheckout = () => setIsCheckoutOpen(false);

    // Computed values
    const getTotalPrice = (): number => {
      return cartItems.reduce((total, item) => {
        if (!item.coffeeItem?.price) return total;
        
        let itemPrice = 0;
        const basePrice = item.coffeeItem.price;

        // Use size price if available
        if (item.selectedSize && item.coffeeItem.availableSizes) {
          const size = item.coffeeItem.availableSizes.find(s => s.nameAr === item.selectedSize);
          itemPrice = size ? size.price : basePrice;
        } else if (item.coffeeItem.price) {
          itemPrice = item.coffeeItem.price;
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

        // Calculate addons price
        const addonsPrice = (item.selectedAddons || []).reduce((sum, addonId) => {
          if (item.enrichedAddons) {
            const addon = item.enrichedAddons.find((a: any) => (a.id === addonId || a._id === addonId));
            return sum + (addon?.price || 0);
          }
          return sum;
        }, 0);

        // Include inline item addon prices
        const inlineAddonsPrice = ((item as any).selectedItemAddons || []).reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
        
        return total + ((isNaN(price) ? 0 : price) + addonsPrice + inlineAddonsPrice) * item.quantity;
      }, 0);
    };

 const getTotalItems = (): number => {
 return cartItems.reduce((total, item) => total + item.quantity, 0);
 };

 const getFinalTotal = (): number => {
 const subtotal = getTotalPrice();
 const deliveryFee = deliveryInfo?.deliveryFee || 0;
 return subtotal + deliveryFee;
 };

 // Auto-close cart when checkout opens
 useEffect(() => {
 if (isCheckoutOpen) {
 setIsCartOpen(false);
 }
 }, [isCheckoutOpen]);

 const contextValue: CartContextType = {
 cartItems,
 isCartOpen,
 isCheckoutOpen,
 sessionId,
 isLoading,
 deliveryInfo,
 addToCart,
 removeFromCart,
 updateQuantity,
 clearCart,
 setDeliveryInfo,
 clearDeliveryInfo,
 showCart,
 hideCart,
 showCheckout,
 hideCheckout,
 getTotalPrice,
 getTotalItems,
 getFinalTotal,
 };

 return (
   <CartContext.Provider value={contextValue}>
     {children}
   </CartContext.Provider>
 );
};
