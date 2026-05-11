export const designTokens = {
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
  
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
    },
  },

  orderStatus: {
    pending: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
      label: 'قيد الانتظار',
    },
    confirmed: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/30',
      label: 'تم التأكيد',
    },
    payment_confirmed: {
      bg: 'bg-indigo-500/20',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500/30',
      label: 'تم الدفع',
    },
    in_progress: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-500/30',
      label: 'قيد التحضير',
    },
    ready: {
      bg: 'bg-green-500/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-500/30',
      label: 'جاهز للاستلام',
    },
    completed: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      label: 'مكتمل',
    },
    cancelled: {
      bg: 'bg-red-500/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-500/30',
      label: 'ملغي',
    },
    refunded: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-500/30',
      label: 'مسترجع',
    },
    delayed: {
      bg: 'bg-red-600/20',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-600/30',
      label: 'متأخر',
    },
  },

  deliveryType: {
    'dine-in': {
      icon: 'Store',
      label: 'طاولة',
      color: 'text-blue-500',
    },
    pickup: {
      icon: 'ShoppingBag',
      label: 'استلام',
      color: 'text-green-500',
    },
    delivery: {
      icon: 'Truck',
      label: 'توصيل',
      color: 'text-orange-500',
    },
  },

  slaThresholds: {
    warning: 5,
    delayed: 10,
  },
} as const;

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'payment_confirmed',
  'in_progress',
  'ready',
  'completed',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'payment_confirmed', 'cancelled'],
  confirmed: ['payment_confirmed', 'in_progress', 'cancelled'],
  payment_confirmed: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransitionTo(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  return ORDER_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export function getStatusStyle(status: string) {
  const statusKey = status as keyof typeof designTokens.orderStatus;
  return designTokens.orderStatus[statusKey] || designTokens.orderStatus.pending;
}

export function getDeliveryTypeInfo(type: string) {
  const typeKey = type as keyof typeof designTokens.deliveryType;
  return designTokens.deliveryType[typeKey] || designTokens.deliveryType.pickup;
}
