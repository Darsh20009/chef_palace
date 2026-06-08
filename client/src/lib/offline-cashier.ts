// Offline Cashier Utilities
  // Handles caching menu items and queuing orders when offline

  const OFFLINE_MENU_KEY = 'qirox-offline-menu';
  const OFFLINE_CONFIG_KEY = 'qirox-offline-config';
  const OFFLINE_PENDING_ORDERS_KEY = 'qirox-pending-orders';

  // ---- Menu Caching ----

  export function cacheMenuItems(items: any[]): void {
    try {
      localStorage.setItem(OFFLINE_MENU_KEY, JSON.stringify({ items, cachedAt: Date.now() }));
    } catch {}
  }

  export function getCachedMenuItems(): any[] {
    try {
      const raw = localStorage.getItem(OFFLINE_MENU_KEY);
      if (!raw) return [];
      const { items } = JSON.parse(raw);
      return Array.isArray(items) ? items : [];
    } catch { return []; }
  }

  export function cacheBusinessConfig(config: any): void {
    try {
      localStorage.setItem(OFFLINE_CONFIG_KEY, JSON.stringify(config));
    } catch {}
  }

  export function getCachedBusinessConfig(): any {
    try {
      const raw = localStorage.getItem(OFFLINE_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ---- Offline Order Queue ----

  export interface PendingOrder {
    id: string;
    payload: any;
    receiptData?: any;
    createdAt: string;
    synced: boolean;
  }

  export function savePendingOrder(payload: any): PendingOrder {
    const order: PendingOrder = {
      id: 'offline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      payload,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    try {
      const existing = getPendingOrders();
      existing.push(order);
      localStorage.setItem(OFFLINE_PENDING_ORDERS_KEY, JSON.stringify(existing));
    } catch {}
    return order;
  }

  export function updatePendingOrderReceiptData(id: string, receiptData: any): void {
    try {
      const orders = getPendingOrders();
      const idx = orders.findIndex(o => o.id === id);
      if (idx !== -1) {
        orders[idx].receiptData = receiptData;
        localStorage.setItem(OFFLINE_PENDING_ORDERS_KEY, JSON.stringify(orders));
      }
    } catch {}
  }

  export function getPendingOrders(): PendingOrder[] {
    try {
      const raw = localStorage.getItem(OFFLINE_PENDING_ORDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  export function markOrderSynced(id: string): void {
    try {
      const orders = getPendingOrders().filter(o => o.id !== id);
      localStorage.setItem(OFFLINE_PENDING_ORDERS_KEY, JSON.stringify(orders));
    } catch {}
  }

  export function getPendingOrdersCount(): number {
    return getPendingOrders().filter(o => !o.synced).length;
  }

  // ---- Sync Pending Orders ----

  export async function syncPendingOrders(onSuccess?: (order: PendingOrder) => void): Promise<void> {
    if (!navigator.onLine) return;
    const orders = getPendingOrders();
    for (const order of orders) {
      if (order.synced) continue;
      try {
        const storedEmployee = localStorage.getItem('currentEmployee');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (storedEmployee) {
          const emp = JSON.parse(storedEmployee);
          if (emp.restoreKey) headers['X-Restore-Key'] = emp.restoreKey;
          if (emp._id) headers['X-Employee-Id'] = emp._id;
        }
        const response = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify(order.payload) });
        if (response.ok) {
          markOrderSynced(order.id);
          onSuccess?.(order);
        }
      } catch {}
    }
  }

  // ---- Pre-cache on Login ----

  export async function preCacheOnLogin(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      const storedEmployee = localStorage.getItem('currentEmployee');
      const headers: Record<string, string> = {};
      if (storedEmployee) {
        const emp = JSON.parse(storedEmployee);
        if (emp.restoreKey) headers['X-Restore-Key'] = emp.restoreKey;
        if (emp._id) headers['X-Employee-Id'] = emp._id;
      }
      // Cache menu items
      const [itemsRes, configRes] = await Promise.allSettled([
        fetch('/api/coffee-items', { headers }),
        fetch('/api/business-config', { headers }),
      ]);
      if (itemsRes.status === 'fulfilled' && itemsRes.value.ok) {
        const items = await itemsRes.value.json();
        if (Array.isArray(items)) cacheMenuItems(items);
      }
      if (configRes.status === 'fulfilled' && configRes.value.ok) {
        const config = await configRes.value.json();
        cacheBusinessConfig(config);
      }
    } catch {}
  }
