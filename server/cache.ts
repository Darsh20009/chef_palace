interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hits: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  set<T>(key: string, data: T, ttlSeconds = 30): void {
    if (this.store.size >= this.maxEntries) {
      this.evictLRU();
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
      hits: 0,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.hits++;
    return entry.data as T;
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  invalidateKey(key: string): void {
    this.store.delete(key);
  }

  private evictLRU(): void {
    let oldestKey = '';
    let lowestHits = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if (entry.hits < lowestHits) {
        lowestHits = entry.hits;
        oldestKey = key;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      keys: [...this.store.keys()],
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export const cache = new MemoryCache(5000);

export const CACHE_TTL = {
  MENU_ITEMS: 90,
  CATEGORIES: 180,
  BUSINESS_CONFIG: 60,
  SUBSCRIPTION: 300,
  BRANCHES: 180,
  EMPLOYEES: 90,
  TABLES: 45,
  BANNERS: 180,
  ADDONS: 180,
  LOYALTY_CARD: 15,
  LOYALTY_SETTINGS: 120,
  PAYMENT_METHODS: 120,
  COFFEE_ITEMS: 90,
  COFFEE_ITEM_MAP: 90,
};

export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter(Boolean).join(':');
}
