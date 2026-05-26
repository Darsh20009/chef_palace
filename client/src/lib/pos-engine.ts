/**
 * POS Engine — Professional Restaurant POS Business Logic
 * ════════════════════════════════════════════════════════
 * Pure TypeScript — no React, no side effects.
 * All state types and calculation functions for the POS system.
 *
 * Features:
 *   • Multi-cart (tabs)
 *   • Hold orders (parked carts)
 *   • Merge bills
 *   • Per-item discounts
 *   • Order-level manual discount
 *   • Service charge (% or fixed)
 *   • Split payment by items/persons
 *   • Full tax-inclusive totals breakdown
 */

export type OrderType    = "dine_in" | "takeaway" | "delivery" | "car_pickup";
export type PaymentMethod = "cash" | "card" | "qahwa-card" | "split";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineItemDiscount {
  type:  'percent' | 'amount';
  value: number;
}

export interface OrderDiscount {
  type:  'percent' | 'amount';
  value: number;
  reason?: string;
}

export interface ServiceCharge {
  enabled: boolean;
  type:    'percent' | 'fixed';
  value:   number;               // percent 0-100 or fixed SAR amount
}

/** Full cart snapshot — used for both tabs and held orders */
export interface PersonPayment {
  id: string;
  method: 'cash' | 'card' | 'mixed';
  amount: string;        // used when method is cash or card
  cashAmount?: string;   // used when method is mixed
  cardAmount?: string;   // used when method is mixed
}

export interface CartSnapshot {
  id:            string;
  name:          string;
  orderItems:    any[];
  orderType:     OrderType;
  tableNumber:   string;
  customerName:  string;
  customerPhone: string;
  orderNote:     string;
  paymentMethod: PaymentMethod;
  splitCashAmount: string;
  personPayments: PersonPayment[];
  itemDiscounts: Record<string, LineItemDiscount>;
  orderDiscount?: OrderDiscount;
  serviceCharge?: ServiceCharge;
  createdAt:     number;
}

export interface HeldCart extends CartSnapshot {
  heldAt:      number;
  totalAmount: number;  // snapshot of total at hold time
}

export interface CartTab {
  id:        string;
  name:      string;
  itemCount: number;
  total:     number;
  createdAt: number;
}

/** Complete breakdown of POS totals */
export interface POSTotals {
  rawTotal:         number;   // sum of item prices × qty (tax-inclusive)
  subtotal:         number;   // rawTotal / 1.15 (ex-VAT)
  tax:              number;   // rawTotal - subtotal
  itemDiscountAmt:  number;   // total per-item discounts
  pointsDiscount:   number;   // loyalty points deduction
  couponDiscount:   number;   // coupon code deduction
  orderDiscountAmt: number;   // manual order-level discount
  serviceChargeAmt: number;   // service charge addition
  grandTotal:       number;   // final payable amount
  change:           number;   // overpayment (for cash display)
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const VAT_RATE = 0.15;

// ── Calculation Helpers ───────────────────────────────────────────────────────

/** Compute the unit price of a POS line item (base + size + addons) */
export function computeUnitPrice(item: any): number {
  let base = Number(item.coffeeItem?.price) || 0;
  if (item.selectedSize && item.coffeeItem?.availableSizes) {
    const size = item.coffeeItem.availableSizes.find((s: any) => s.nameAr === item.selectedSize);
    if (size) base = Number(size.price) || 0;
  }
  const addons = (item.customization?.selectedItemAddons || [])
    .reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
  return base + addons;
}

/** Compute how much a per-item discount deducts from a line's total */
export function computeItemDiscountAmount(unitPrice: number, qty: number, discount?: LineItemDiscount): number {
  if (!discount) return 0;
  const lineTotal = unitPrice * qty;
  if (discount.type === 'percent') return Math.min(lineTotal, lineTotal * discount.value / 100);
  return Math.min(lineTotal, discount.value);
}

/** Sum of all per-item discount amounts */
export function computeTotalItemDiscounts(items: any[], discounts: Record<string, LineItemDiscount>): number {
  return items.reduce((sum, item) => {
    const d = discounts[item.lineItemId];
    return sum + computeItemDiscountAmount(computeUnitPrice(item), item.quantity, d);
  }, 0);
}

/** Compute service charge amount */
export function computeServiceChargeAmount(base: number, config?: ServiceCharge): number {
  if (!config?.enabled) return 0;
  if (config.type === 'fixed')   return Math.max(0, config.value);
  if (config.type === 'percent') return Math.max(0, base * config.value / 100);
  return 0;
}

/** Compute manual order discount amount */
export function computeOrderDiscountAmount(base: number, discount?: OrderDiscount): number {
  if (!discount) return 0;
  if (discount.type === 'amount')  return Math.min(base, Math.max(0, discount.value));
  if (discount.type === 'percent') return Math.min(base, base * Math.max(0, discount.value) / 100);
  return 0;
}

/**
 * Compute full POS totals breakdown.
 * All prices are tax-inclusive (VAT included in price).
 */
export function computePOSTotals(
  items:          any[],
  itemDiscounts:  Record<string, LineItemDiscount>,
  pointsDiscount: number,
  couponDiscount: number,
  orderDiscount?: OrderDiscount,
  serviceCharge?: ServiceCharge,
): POSTotals {
  // 1. Raw total (tax-inclusive)
  const rawTotal = items.reduce((s, item) => s + computeUnitPrice(item) * item.quantity, 0);

  // 2. Per-item discounts (applied first)
  const itemDiscountAmt = computeTotalItemDiscounts(items, itemDiscounts);

  // 3. After item discounts
  const afterItemDiscounts = Math.max(0, rawTotal - itemDiscountAmt);

  // 4. Points discount
  const afterPoints = Math.max(0, afterItemDiscounts - pointsDiscount);

  // 5. Coupon discount
  const afterCoupon = Math.max(0, afterPoints - couponDiscount);

  // 6. Manual order discount
  const orderDiscountAmt = computeOrderDiscountAmount(afterCoupon, orderDiscount);
  const afterOrderDiscount = Math.max(0, afterCoupon - orderDiscountAmt);

  // 7. Service charge
  const serviceChargeAmt = computeServiceChargeAmount(afterOrderDiscount, serviceCharge);

  // 8. Grand total
  const grandTotal = Math.max(0, afterOrderDiscount + serviceChargeAmt);

  // 9. VAT breakdown (tax-inclusive: subtotal = grandTotal / 1.15)
  const subtotal = grandTotal / (1 + VAT_RATE);
  const tax      = grandTotal - subtotal;

  return {
    rawTotal,
    subtotal,
    tax,
    itemDiscountAmt,
    pointsDiscount,
    couponDiscount,
    orderDiscountAmt,
    serviceChargeAmt,
    grandTotal,
    change: 0,
  };
}

// ── Cart ID Generator ─────────────────────────────────────────────────────────

export function newCartId(): string {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newLineId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// ── Cart Snapshot Utilities ───────────────────────────────────────────────────

/** Create a blank cart snapshot */
export function blankCart(id: string, name: string): CartSnapshot {
  return {
    id,
    name,
    orderItems:      [],
    orderType:       'dine_in',
    tableNumber:     '',
    customerName:    '',
    customerPhone:   '',
    orderNote:       '',
    paymentMethod:   'cash',
    splitCashAmount: '',
    personPayments: [{ id: '1', method: 'cash' as const, amount: '' }],
    itemDiscounts:   {},
    createdAt:       Date.now(),
  };
}

/** Merge items from two carts — matching items (same product + size + addons) have their quantities summed */
export function mergeCartItems(base: any[], incoming: any[]): any[] {
  const result = [...base];
  for (const inc of incoming) {
    const addonKey = JSON.stringify(inc.customization?.selectedItemAddons || []);
    const sizeKey  = inc.selectedSize || '';
    const existing = result.find(b =>
      b.coffeeItem.id === inc.coffeeItem.id &&
      (b.selectedSize || '') === sizeKey &&
      JSON.stringify(b.customization?.selectedItemAddons || []) === addonKey
    );
    if (existing) {
      existing.quantity += inc.quantity;
    } else {
      result.push({ ...inc, lineItemId: newLineId() });
    }
  }
  return result;
}

/** Split cart items for N people — returns N arrays of items */
export function splitCartByPersons(items: any[], persons: number): any[][] {
  if (persons <= 1) return [items];
  const result: any[][] = Array.from({ length: persons }, () => []);
  items.forEach((item, i) => {
    result[i % persons].push(item);
  });
  return result;
}

/** Calculate each person's share of the total */
export function computePersonShares(total: number, persons: number): number[] {
  if (persons <= 1) return [total];
  const share = Math.floor((total / persons) * 100) / 100;
  const shares = Array(persons).fill(share);
  // Assign any rounding difference to the last person
  shares[persons - 1] = Math.round((total - share * (persons - 1)) * 100) / 100;
  return shares;
}

/** Given items selected for combo pricing, compute the combo discount */
export function computeComboDiscount(selectedItems: any[], comboPrice: number): number {
  const fullPrice = selectedItems.reduce((s, i) => s + computeUnitPrice(i) * i.quantity, 0);
  return Math.max(0, fullPrice - comboPrice);
}
