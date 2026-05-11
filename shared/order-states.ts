export const ORDER_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed', 
  PAYMENT_CONFIRMED: 'payment_confirmed',
  IN_PROGRESS: 'in_progress',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
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
    labelAr: 'في الانتظار',
    labelEn: 'Pending',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    canTransitionTo: ['confirmed', 'payment_confirmed', 'cancelled'],
  },
  confirmed: {
    labelAr: 'مؤكد',
    labelEn: 'Confirmed',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    canTransitionTo: ['in_progress', 'cancelled'],
  },
  payment_confirmed: {
    labelAr: 'الدفع مؤكد',
    labelEn: 'Payment Confirmed',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    canTransitionTo: ['in_progress', 'cancelled', 'refunded'],
  },
  in_progress: {
    labelAr: 'قيد التحضير',
    labelEn: 'In Progress',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    canTransitionTo: ['ready', 'cancelled'],
  },
  ready: {
    labelAr: 'جاهز',
    labelEn: 'Ready',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    canTransitionTo: ['completed', 'cancelled'],
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
