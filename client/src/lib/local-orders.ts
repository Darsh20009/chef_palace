export interface LocalOrder {
  orderNumber: string;
  createdAt: string;
}

const STORAGE_KEY = 'guest-orders';
const MAX_ORDERS = 50;

export function saveOrderLocally(orderNumber: string): void {
  try {
    const orders = getLocalOrders();
    
    const newOrder: LocalOrder = {
      orderNumber,
      createdAt: new Date().toISOString(),
    };
    
    orders.unshift(newOrder);
    
    const trimmedOrders = orders.slice(0, MAX_ORDERS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedOrders));
  } catch (error) {
    console.error('Error saving order locally:', error);
  }
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

export function getLocalOrders(): LocalOrder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return safeJsonParse<LocalOrder[]>(stored, []);
  } catch (error) {
    console.error('Error getting local orders:', error);
    return [];
  }
}

export function clearLocalOrders(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing local orders:', error);
  }
}

export function removeLocalOrder(orderNumber: string): void {
  try {
    const orders = getLocalOrders();
    const filtered = orders.filter(o => o.orderNumber !== orderNumber);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing local order:', error);
  }
}
