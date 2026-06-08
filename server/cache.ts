interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hits: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private cleanupInterval: NodeJS.Timeout;
  public totalHits = 0;
  public totalMisses = 0;
  public totalSets = 0;
  public totalInvalidations = 0;

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
    this.totalSets++;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this.totalMisses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.totalMisses++;
      return null;
    }
    entry.hits++;
    this.totalHits++;
    return entry.data as T;
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        this.totalInvalidations++;
      }
    }
  }

  invalidateKey(key: string): void {
    if (this.store.delete(key)) this.totalInvalidations++;
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
    const total = this.totalHits + this.totalMisses;
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      totalSets: this.totalSets,
      totalInvalidations: this.totalInvalidations,
      hitRate: total > 0 ? Math.round((this.totalHits / total) * 100) : 0,
      keys: [...this.store.keys()],
    };
  }

  topKeys(n = 10) {
    return [...this.store.entries()]
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, n)
      .map(([k, v]) => ({ key: k, hits: v.hits, ageMs: Math.max(0, v.expiresAt - Date.now()) }));
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export const cache = new MemoryCache(5000);

export const CACHE_TTL = {
  // Core data (relatively static)
  MENU_ITEMS: 90,
  CATEGORIES: 180,
  BUSINESS_CONFIG: 60,
  SUBSCRIPTION: 300,
  BRANCHES: 180,
  EMPLOYEES: 90,
  TABLES: 45,
  BANNERS: 180,
  ADDONS: 180,
  PAYMENT_METHODS: 120,
  COFFEE_ITEMS: 90,
  COFFEE_ITEM_MAP: 90,
  // Transactional (short TTL — changes frequently)
  LOYALTY_CARD: 15,
  LOYALTY_SETTINGS: 120,
  CART_SESSION: 12,
  ORDERS: 30,
  // Analytics & reports (expensive aggregates — longer TTL)
  ANALYTICS_TODAY: 90,       // today changes every order, 90s is fine
  ANALYTICS_WEEK: 300,       // week/month less volatile
  ANALYTICS_MONTH: 600,
  ANALYTICS_YEAR: 1800,
  REPORTS_UNIFIED: 120,      // unified multi-branch reports
  REPORTS_ATTENDANCE: 300,   // attendance is updated at check-in only
  COGS: 600,                 // cost-of-goods is slow-changing
  ACCOUNTING: 120,           // expenses/revenue summaries
  INVENTORY: 60,             // stock levels change on each order
  SUPPLIERS: 300,
};

export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter(Boolean).join(':');
}
