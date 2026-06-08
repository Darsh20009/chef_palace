export const ORDER_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  IN_PROGRESS: 'in_progress',
  READY: 'ready',
  DELIVERED: 'delivered',
  RECEIVED: 'received',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  SUSPENDED: 'suspended',
} as const;

export const TABLE_ORDER_STATES = {
  PENDING: 'pending',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  PREPARING: 'preparing',
  DELIVERING_TO_TABLE: 'delivering_to_table',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATES[keyof typeof ORDER_STATES];
export type TableOrderStatus = typeof TABLE_ORDER_STATES[keyof typeof TABLE_ORDER_STATES];

export const ORDER_STATUS_CONFIG: Record<OrderStatus, {
  labelAr: string;
  labelEn: string;
  color: string;
  bgColor: string;
  canTransitionTo: OrderStatus[];
}> = {
  pending: {
    labelAr: 'جديد',
    labelEn: 'New',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    canTransitionTo: ['confirmed', 'payment_confirmed', 'in_progress', 'cancelled', 'suspended'],
  },
  confirmed: {
    labelAr: 'مؤكد',
    labelEn: 'Confirmed',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    canTransitionTo: ['in_progress', 'cancelled', 'suspended'],
  },
  payment_confirmed: {
    labelAr: 'الدفع مؤكد',
    labelEn: 'Payment Confirmed',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    canTransitionTo: ['in_progress', 'cancelled', 'refunded', 'suspended'],
  },
  in_progress: {
    labelAr: 'قيد التحضير',
    labelEn: 'In Progress',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    canTransitionTo: ['ready', 'cancelled', 'suspended'],
  },
  ready: {
    labelAr: 'جاهز',
    labelEn: 'Ready',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    canTransitionTo: ['delivered', 'completed', 'cancelled'],
  },
  delivered: {
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    canTransitionTo: ['received', 'completed', 'cancelled'],
  },
  received: {
    labelAr: 'تم الاستلام',
    labelEn: 'Received',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    canTransitionTo: ['completed', 'refunded'],
  },
  completed: {
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    canTransitionTo: ['refunded'],
  },
  cancelled: {
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    canTransitionTo: [],
  },
  refunded: {
    labelAr: 'مسترد',
    labelEn: 'Refunded',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    canTransitionTo: [],
  },
  suspended: {
    labelAr: 'معلق',
    labelEn: 'Suspended',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    canTransitionTo: ['pending', 'confirmed', 'cancelled'],
  },
};

export const DELIVERY_TYPES = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
  DINE_IN: 'dine-in',
  CAR_PICKUP: 'car_pickup',
} as const;

export type DeliveryType = typeof DELIVERY_TYPES[keyof typeof DELIVERY_TYPES];

export const DELIVERY_TYPE_CONFIG: Record<DeliveryType, {
  labelAr: string;
  labelEn: string;
  icon: string;
  color: string;
}> = {
  'pickup': {
    labelAr: 'استلام من الفرع',
    labelEn: 'Pickup',
    icon: 'Store',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  },
  'delivery': {
    labelAr: 'توصيل',
    labelEn: 'Delivery',
    icon: 'Truck',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  },
  'dine-in': {
    labelAr: 'محلي',
    labelEn: 'Dine-in',
    icon: 'MapPin',
    color: 'bg-green-500/20 text-green-400 border-green-500/50',
  },
  'car_pickup': {
    labelAr: 'استلام من السيارة',
    labelEn: 'Car Pickup',
    icon: 'Car',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  },
};

export function canTransition(currentStatus: OrderStatus, newStatus: OrderStatus, hasAdminPrivilege: boolean = false): boolean {
  if (hasAdminPrivilege) {
    return newStatus !== currentStatus;
  }

  const config = ORDER_STATUS_CONFIG[currentStatus];
  if (!config) return false;

  return config.canTransitionTo.includes(newStatus);
}

export function getStatusLabel(status: string, language: 'ar' | 'en' = 'ar'): string {
  const config = ORDER_STATUS_CONFIG[status as OrderStatus];
  if (!config) return status;
  return language === 'ar' ? config.labelAr : config.labelEn;
}

export function getStatusColor(status: string): { color: string; bgColor: string } {
  const config = ORDER_STATUS_CONFIG[status as OrderStatus];
  if (!config) {
    return { color: 'text-gray-600', bgColor: 'bg-gray-100' };
  }
  return { color: config.color, bgColor: config.bgColor };
}

/** Canonical Apple Pay method IDs — used to identify Apple Pay orders consistently */
export const APPLE_PAY_METHODS = new Set([
  'apple_pay',
  'paymob-apple-pay',
  'neoleap-apple-pay',
]);

/** Map any payment method ID to a canonical display name (Arabic) */
export function getPaymentMethodLabel(method: string | undefined | null, lang: 'ar' | 'en' = 'ar'): string {
  const m = (method || '').toLowerCase();
  if (lang === 'ar') {
    if (m === 'cash') return 'نقدي';
    if (m === 'pos' || m === 'pos-network' || m === 'card' || m === 'network') return 'شبكة';
    if (m === 'apple_pay' || m === 'paymob-apple-pay' || m === 'neoleap-apple-pay') return 'Apple Pay';
    if (m === 'stc-pay' || m === 'stc_pay') return 'STC Pay';
    if (m === 'mada') return 'مدى';
    if (m === 'split') return 'دفع مختلط';
    if (m === 'qahwa-card' || m === 'qirox-card') return 'بطاقة ولاء';
    if (m === 'loyalty-card' || m === 'loyalty') return 'بطاقة ولاء';
    if (m === 'paymob-card' || m === 'paymob') return 'بطاقة ائتمان';
    if (m === 'geidea') return 'بطاقة ائتمان';
    if (m === 'bank_transfer' || m === 'rajhi' || m === 'alinma') return 'تحويل بنكي';
    return method || 'غير محدد';
  } else {
    if (m === 'cash') return 'Cash';
    if (m === 'pos' || m === 'pos-network' || m === 'card' || m === 'network') return 'Card';
    if (m === 'apple_pay' || m === 'paymob-apple-pay' || m === 'neoleap-apple-pay') return 'Apple Pay';
    if (m === 'stc-pay' || m === 'stc_pay') return 'STC Pay';
    if (m === 'mada') return 'Mada';
    if (m === 'split') return 'Split Payment';
    if (m === 'qahwa-card' || m === 'qirox-card') return 'Loyalty Card';
    if (m === 'loyalty-card' || m === 'loyalty') return 'Loyalty Card';
    if (m === 'paymob-card' || m === 'paymob') return 'Credit Card';
    if (m === 'geidea') return 'Credit Card';
    if (m === 'bank_transfer' || m === 'rajhi' || m === 'alinma') return 'Bank Transfer';
    return method || 'Unknown';
  }
}

/** Returns 'cash' | 'card' | 'loyalty' bucket for analytics aggregation */
export function getPaymentBucket(method: string | undefined | null): 'cash' | 'card' | 'loyalty' {
  const m = (method || '').toLowerCase();
  if (m === 'cash') return 'cash';
  if (m === 'qahwa-card' || m === 'qirox-card' || m === 'loyalty-card' || m === 'loyalty') return 'loyalty';
  return 'card'; // Apple Pay, STC Pay, Mada, pos, paymob-card, etc.
}

export const SLA_THRESHOLDS = {
  WARNING_MINUTES: 5,
  DELAYED_MINUTES: 10,
  CRITICAL_MINUTES: 15,
} as const;

export function getOrderSLAStatus(createdAt: string | Date): 'normal' | 'warning' | 'delayed' | 'critical' {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const minutes = Math.floor((now - created) / (1000 * 60));

  if (minutes >= SLA_THRESHOLDS.CRITICAL_MINUTES) return 'critical';
  if (minutes >= SLA_THRESHOLDS.DELAYED_MINUTES) return 'delayed';
  if (minutes >= SLA_THRESHOLDS.WARNING_MINUTES) return 'warning';
  return 'normal';
}

export function getElapsedMinutes(createdAt: string | Date): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60));
}
