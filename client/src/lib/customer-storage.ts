import { nanoid } from "nanoid";

// Customer Profile Types
export interface CardDesignPreference {
 designId: string;
 name: string;
 colors: {
 primary: string;
 secondary: string;
 accent: string;
 };
 preview: {
 bg: string;
 text: string;
 };
}

export interface CustomerProfile {
 id: string;
 name: string;
 phone: string;
 email?: string;
 createdAt: string;
 cardNumber?: string;
 stamps: number;
 freeDrinks: number;
 usedFreeDrinks?: number;
 cardDesign?: CardDesignPreference;
 cardPassword?: string;
 cardBalance?: number;
}

// Order Types
export interface LocalOrder {
 id: string;
 orderNumber: string;
 items: Array<{
 id: string;
 nameAr: string;
 quantity: number;
 price: number;
 }>;
 totalAmount: number;
 paymentMethod: string;
 transferOwnerName?: string;
 usedFreeDrink?: boolean;
 createdAt: string;
}

// Active Offer Interface
export interface ActiveOffer {
  id: string;
  title: string;
  description: string;
  discount: number;
  type: 'loyalty' | 'comeback' | 'birthday' | 'frequent' | 'new' | 'percentage' | 'fixed';
  coffeeItemId?: string;
  appliedAt: string;
  expiresAt?: string;
}

// Guest Info Interface
export interface GuestInfo {
  name: string;
  phone: string;
}

// Local Storage Keys
const STORAGE_KEYS = {
 CUSTOMER_PROFILE: 'qahwa-customer-profile',
 CUSTOMER_ORDERS: 'qahwa-customer-orders',
 CARD_NUMBERS_POOL: 'qahwa-card-numbers-pool',
 GUEST_MODE: 'qahwa-guest-mode',
 GUEST_INFO: 'qahwa-guest-info',
 CARD_DESIGN: 'qahwa-card-design',
 CARD_PASSWORD: 'qahwa-card-password',
 ACTIVE_OFFER: 'qahwa-active-offer'
};

// Pre-generated card numbers pool (10% discount cards)
const CARD_NUMBERS_POOL = [
 "CUP-1001", "CUP-1002", "CUP-1003", "CUP-1004", "CUP-1005",
 "CUP-1006", "CUP-1007", "CUP-1008", "CUP-1009", "CUP-1010",
 "CUP-1011", "CUP-1012", "CUP-1013", "CUP-1014", "CUP-1015",
 "CUP-1016", "CUP-1017", "CUP-1018", "CUP-1019", "CUP-1020",
 "CUP-1021", "CUP-1022", "CUP-1023", "CUP-1024", "CUP-1025",
 "CUP-1026", "CUP-1027", "CUP-1028", "CUP-1029", "CUP-1030",
 "CUP-1031", "CUP-1032", "CUP-1033", "CUP-1034", "CUP-1035",
 "CUP-1036", "CUP-1037", "CUP-1038", "CUP-1039", "CUP-1040",
 "CUP-1041", "CUP-1042", "CUP-1043", "CUP-1044", "CUP-1045",
 "CUP-1046", "CUP-1047", "CUP-1048", "CUP-1049", "CUP-1050"
];

// Initialize card numbers pool in localStorage if not exists
function initializeCardNumbersPool() {
  const stored = localStorage.getItem(STORAGE_KEYS.CARD_NUMBERS_POOL);
  if (!stored) {
    const pool = {
      available: [...CARD_NUMBERS_POOL],
      assigned: [] as string[]
    };
    localStorage.setItem(STORAGE_KEYS.CARD_NUMBERS_POOL, JSON.stringify(pool));
  }
}

// Get a card number from the pool
function assignCardNumber(): string {
  initializeCardNumbersPool();
  const stored = localStorage.getItem(STORAGE_KEYS.CARD_NUMBERS_POOL);
  if (!stored) return "CUP-0000";
  
  const pool = safeJsonParse(stored, { available: [], assigned: [] as string[] });
  if (pool.available.length === 0) {
    // If pool is empty, generate a new number
    const newNumber = `CUP-${2000 + pool.assigned.length}`;
    pool.assigned.push(newNumber);
    localStorage.setItem(STORAGE_KEYS.CARD_NUMBERS_POOL, JSON.stringify(pool));
    return newNumber;
  }
  
  const cardNumber = pool.available.pop();
  if (cardNumber) {
    pool.assigned.push(cardNumber);
    localStorage.setItem(STORAGE_KEYS.CARD_NUMBERS_POOL, JSON.stringify(pool));
    return cardNumber;
  }
  return "CUP-0000";
}

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

// Customer Profile Management
export const customerStorage = {
  // Check if guest mode
  isGuestMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.GUEST_MODE) === 'true';
  },

  setGuestMode(isGuest: boolean) {
    localStorage.setItem(STORAGE_KEYS.GUEST_MODE, isGuest ? 'true' : 'false');
  },

  setGuestInfo(name: string, phone: string) {
    localStorage.setItem(STORAGE_KEYS.GUEST_INFO, JSON.stringify({ name, phone }));
  },

  getGuestInfo(): GuestInfo | null {
    const stored = localStorage.getItem(STORAGE_KEYS.GUEST_INFO);
    return safeJsonParse<GuestInfo | null>(stored, null);
  },

  clearGuestInfo() {
    localStorage.removeItem(STORAGE_KEYS.GUEST_INFO);
  },

  // Get current customer profile
  getProfile(): CustomerProfile | null {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOMER_PROFILE);
    return safeJsonParse<CustomerProfile | null>(stored, null);
  },

  // Register or login customer
  registerCustomer(name: string, phone: string, email?: string): CustomerProfile {
    const profile: CustomerProfile = {
      id: nanoid(),
      name,
      phone,
      email,
      cardNumber: assignCardNumber(),
      stamps: 0,
      freeDrinks: 0,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_PROFILE, JSON.stringify(profile));
    this.setGuestMode(false);
    return profile;
  },

  // Update profile
  updateProfile(updates: Partial<CustomerProfile>) {
    const profile = this.getProfile();
    if (!profile) return null;
    
    const updated = { ...profile, ...updates };
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_PROFILE, JSON.stringify(updated));
    return updated;
  },

  // Logout
  logout() {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.CARD_PASSWORD);
    this.clearGuestInfo();
    this.setGuestMode(false);
  },

  // Add stamp (6 stamps = free drink)
  addStamp(): CustomerProfile | null {
    const profile = this.getProfile();
    if (!profile) return null;

    let newStamps = profile.stamps + 1;
    let newFreeDrinks = profile.freeDrinks;

    // Every 6 stamps = 1 free drink
    if (newStamps >= 6) {
      newFreeDrinks += 1;
      newStamps = 0; // Reset stamps after getting free drink
    }

    return this.updateProfile({ stamps: newStamps, freeDrinks: newFreeDrinks });
  },

  // Use free drink
  useFreeDrink(): CustomerProfile | null {
    const profile = this.getProfile();
    if (!profile || profile.freeDrinks <= 0) return null;

    return this.updateProfile({ freeDrinks: profile.freeDrinks - 1 });
  },

  // Orders Management
  getOrders(): LocalOrder[] {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOMER_ORDERS);
    return safeJsonParse<LocalOrder[]>(stored, []);
  },

  addOrder(order: Omit<LocalOrder, 'id' | 'createdAt'>): LocalOrder {
    const orders = this.getOrders();
    const newOrder: LocalOrder = {
      ...order,
      id: nanoid(),
      createdAt: new Date().toISOString()
    };
    orders.unshift(newOrder); // Add to beginning
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_ORDERS, JSON.stringify(orders));

    // Add stamp if customer is registered and not used free drink
    if (!this.isGuestMode() && !order.usedFreeDrink) {
      this.addStamp();
    }

    return newOrder;
  },

  clearOrders() {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_ORDERS);
  },

  // Card Design Management
  setCardDesign(design: CardDesignPreference): void {
    localStorage.setItem(STORAGE_KEYS.CARD_DESIGN, JSON.stringify(design));
    const profile = this.getProfile();
    if (profile) {
      this.updateProfile({ cardDesign: design });
    }
  },

  getCardDesign(): CardDesignPreference | null {
    const stored = localStorage.getItem(STORAGE_KEYS.CARD_DESIGN);
    return safeJsonParse<CardDesignPreference | null>(stored, null);
  },

  // Card Password Management (Security: removed plain storage in profile)
  setCardPassword(password: string): void {
    // Note: Plain text storage is insecure. In production, use hashing.
    localStorage.setItem(STORAGE_KEYS.CARD_PASSWORD, password);
  },

  getCardPassword(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CARD_PASSWORD);
  },

 // Card Balance Management
 getCardBalance(): number {
 const profile = this.getProfile();
 return profile?.cardBalance || 0;
 },

 setCardBalance(balance: number): void {
 const profile = this.getProfile();
 if (profile) {
 this.updateProfile({ cardBalance: Math.max(0, balance) });
 }
 },

 deductFromCard(amount: number): {success: boolean; newBalance: number; shortfall: number} {
 const balance = this.getCardBalance();
 if (balance >= amount) {
 const newBalance = balance - amount;
 this.setCardBalance(newBalance);
 return { success: true, newBalance, shortfall: 0 };
 }
 return { success: false, newBalance: balance, shortfall: amount - balance };
 },

  setActiveOffer(offer: Omit<ActiveOffer, 'appliedAt'>): void {
    const activeOffer: ActiveOffer = {
      ...offer,
      appliedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_OFFER, JSON.stringify(activeOffer));
  },

  getActiveOffer(): ActiveOffer | null {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_OFFER);
    if (!stored) return null;
    const offer = safeJsonParse<ActiveOffer | null>(stored, null);
    if (!offer) return null;
    
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      this.clearActiveOffer();
      return null;
    }
    return offer;
  },

  clearActiveOffer(): void {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_OFFER);
  }
};
