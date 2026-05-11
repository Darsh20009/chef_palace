import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomer } from "@/contexts/CustomerContext";

export interface LoyaltyCard {
  id?: string;
  _id?: string;
  customerName: string;
  phoneNumber: string;
  cardNumber: string;
  qrToken: string;
  stamps: number;
  freeCupsEarned: number;
  freeCupsRedeemed: number;
  points: number;
  pendingPoints: number;
  tier: string;
  totalSpent: number;
  discountCount: number;
  status: string;
  isActive: boolean;
  createdAt: string;
}

export function useLoyaltyCard(phoneNumber?: string) {
  const { customer } = useCustomer();
  const queryClient = useQueryClient();
  const phone = phoneNumber || customer?.phone;
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-9) : null;

  const { data: cardList, isLoading, error, refetch } = useQuery<LoyaltyCard[]>({
    queryKey: ["/api/customer/loyalty-cards"],
    enabled: !!customer && !phoneNumber,
    staleTime: 30000,
  });

  // For explicit phone lookup (e.g. payment-methods)
  const { data: phoneCard, isLoading: phoneLoading, refetch: phoneRefetch } = useQuery<LoyaltyCard | null>({
    queryKey: ["/api/loyalty/lookup/phone", cleanPhone],
    queryFn: async () => {
      if (!cleanPhone || cleanPhone.length < 9) return null;
      const res = await fetch(`/api/loyalty/lookup/phone/${cleanPhone}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch card");
      return res.json();
    },
    enabled: !!phoneNumber && !!cleanPhone && cleanPhone.length >= 9,
    staleTime: 30000,
  });

  const card = phoneNumber ? phoneCard : (cardList?.[0] ?? null);
  const cardLoading = phoneNumber ? phoneLoading : isLoading;

  const availableFreeDrinks = card ? Math.max(0, (card.freeCupsEarned || 0) - (card.freeCupsRedeemed || 0)) : 0;
  const stampsToNextFreeDrink = card ? Math.max(0, 6 - ((card.stamps || 0) % 6)) : 6;

  const updateCardInCache = (newCardData: Partial<LoyaltyCard>) => {
    // Update the customer loyalty cards cache
    queryClient.setQueryData<LoyaltyCard[]>(["/api/customer/loyalty-cards"], (old) => {
      if (!old) return old;
      return old.map((c) =>
        (c.id || (c as any)._id) === (newCardData.id || (newCardData as any)._id)
          ? { ...c, ...newCardData }
          : c
      );
    });
    // Also invalidate for refetch
    queryClient.invalidateQueries({ queryKey: ["/api/customer/loyalty-cards"] });
    if (cleanPhone) {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/lookup/phone", cleanPhone] });
    }
  };

  return {
    card,
    isLoading: cardLoading,
    error,
    refetch: phoneNumber ? phoneRefetch : refetch,
    availableFreeDrinks,
    stampsToNextFreeDrink,
    hasCard: !!card,
    updateCardInCache,
  };
}

export function useLoyaltyCardByPhone(phone: string | undefined) {
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-9) : null;

  const { data: card, isLoading, error, refetch } = useQuery<LoyaltyCard | null>({
    queryKey: ["/api/loyalty/lookup/phone", cleanPhone],
    queryFn: async () => {
      if (!cleanPhone || cleanPhone.length < 9) return null;
      const res = await fetch(`/api/loyalty/lookup/phone/${cleanPhone}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch card");
      return res.json();
    },
    enabled: !!cleanPhone && cleanPhone.length >= 9,
    staleTime: 10000,
  });

  return { card: card ?? null, isLoading, error, refetch };
}
