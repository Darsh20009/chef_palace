import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import SarIcon from "@/components/sar-icon";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Coffee, Clock, Package, CheckCircle,
  ChevronRight, User, Star, Gift, Truck, RefreshCw, PauseCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fmtOrderNum } from "@/lib/print-utils";
import qiroxLogo from "@assets/qirox-logo-customer.png";

interface OrderItem {
  coffeeItem?: { nameAr?: string; nameEn?: string; price?: number };
  name?: string;
  nameAr?: string;
  nameEn?: string;
  quantity: number;
  customization?: { selectedItemAddons?: Array<{ nameAr: string; nameEn?: string }> };
}

interface TrackOrder {
  _id?: string;
  orderNumber: string;
  dailyNumber?: number;
  status: string;
  items: OrderItem[];
  totalAmount: number;
  orderType?: string;
  tableNumber?: string;
  customerName?: string;
  createdAt?: string;
  estimatedMinutes?: number;
  branchId?: string;
}

const STATUS_STEP_KEYS = [
  { key: 'pending',     stepKey: 'tracking.step.received',   icon: Clock,         color: 'bg-amber-500',  ring: 'ring-amber-200'  },
  { key: 'in_progress', stepKey: 'tracking.step.preparing',  icon: Coffee,        color: 'bg-blue-500',   ring: 'ring-blue-200'   },
  { key: 'ready',       stepKey: 'tracking.step.ready',      icon: Package,       color: 'bg-green-500',  ring: 'ring-green-200'  },
  { key: 'delivered',   stepKey: 'tracking.step.on_the_way', icon: Truck,         color: 'bg-teal-500',   ring: 'ring-teal-200'   },
  { key: 'completed',   stepKey: 'tracking.step.completed',  icon: CheckCircle,   color: 'bg-gray-400',   ring: 'ring-gray-200'   },
];

const STATUS_MAP: Record<string, number> = {
  awaiting_payment: 0, payment_confirmed: 0, pending: 0, confirmed: 0,
  in_progress: 1,
  ready: 2,
  out_for_delivery: 3, delivered: 3,
  received: 4, completed: 4,
};

function CountdownTimer({ estimatedMinutes, startTime }: { estimatedMinutes: number; startTime: string }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const calc = () => {
      const start = new Date(startTime).getTime();
      const end = start + estimatedMinutes * 60 * 1000;
      const now = Date.now();
      const rem = Math.max(0, Math.floor((end - now) / 1000));
      const total = estimatedMinutes * 60;
      const elapsed = (now - start) / 1000;
      setTimeLeft(rem);
      setProgress(Math.max(0, Math.min(100, 100 - (elapsed / total) * 100)));
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [estimatedMinutes, startTime]);

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-blue-700">⏱ {t('tracking.time_remaining')}</span>
        <span className="text-2xl font-bold font-mono text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200" dir="ltr">
          {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
      </div>
      <Progress value={progress} className="h-2 bg-blue-200 [&>div]:bg-blue-500" />
      <p className="text-xs text-center text-blue-500">
        {t('tracking.est_prep_time')}: {estimatedMinutes} {t('tracking.minutes')}
      </p>
    </div>
  );
}

export default function PublicOrderTrackPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ orderNumber: string }>();
  const [, navigate] = useLocation();
  const orderNumberRaw = (() => {
    const raw = params.orderNumber || '';
    try { return decodeURIComponent(raw); } catch { return raw; }
  })();
  const prevStatusRef = useRef('');
  const [showReadyAlert, setShowReadyAlert] = useState(false);
  const [showDeliveredAlert, setShowDeliveredAlert] = useState(false);
  const isAr = i18n.language !== 'en';

  const { data: order, isLoading, error, refetch } = useQuery<TrackOrder>({
    queryKey: ['/api/orders/number', orderNumberRaw],
    queryFn: async () => {
      const res = await fetch(`/api/orders/number/${encodeURIComponent(orderNumberRaw)}`);
      if (!res.ok) throw new Error('not found');
      return res.json();
    },
    enabled: !!orderNumberRaw,
    refetchInterval: 15000,
    retry: 2,
  });

  useEffect(() => {
    if (!orderNumberRaw) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/orders`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (['order_status_update', 'new_order', 'order_update'].includes(msg.type)) {
          const num = msg.orderNumber || msg.data?.orderNumber || msg.order?.orderNumber;
          if (num === orderNumberRaw) refetch();
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [orderNumberRaw, refetch]);

  useEffect(() => {
    if (!order) return;
    const prev = prevStatusRef.current;
    if (order.status === 'ready' && prev && prev !== 'ready') setShowReadyAlert(true);
    if (order.status === 'delivered' && prev && prev !== 'delivered') setShowDeliveredAlert(true);
    prevStatusRef.current = order.status;
  }, [order]);

  const isCancelled = order?.status === 'cancelled' || order?.status === 'refunded';
  const isSuspended = order?.status === 'suspended';
  const stepIndex = order ? (STATUS_MAP[order.status] ?? 0) : 0;

  const getStatusLabel = (status: string) => {
    const key = `status.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
  };

  const getStatusColors = (status: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      pending:          { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-300'  },
      awaiting_payment: { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-300' },
      payment_confirmed:{ bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-300'   },
      confirmed:        { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-300'   },
      in_progress:      { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-300'   },
      ready:            { bg: 'bg-green-50',   text: 'text-green-800',   border: 'border-green-300'  },
      out_for_delivery: { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-300'   },
      delivered:        { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-300'   },
      received:         { bg: 'bg-gray-100',   text: 'text-gray-700',    border: 'border-gray-300'   },
      completed:        { bg: 'bg-gray-100',   text: 'text-gray-700',    border: 'border-gray-300'   },
      cancelled:        { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300'    },
      refunded:         { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-300' },
      suspended:        { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-300' },
    };
    return map[status] || map.pending;
  };

  const getOrderTypeName = (type?: string): string => {
    if (!type) return '';
    const key = `tracking.order_type.${type}`;
    const translated = t(key);
    return translated !== key ? translated : type;
  };

  const statusColor = getStatusColors(order?.status || 'pending');

  if (!orderNumberRaw) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="text-center space-y-4">
          <img src={qiroxLogo} alt="مكان الشيف البخاري" className="h-16 mx-auto object-contain" />
          <p className="text-gray-500 text-lg">{t('tracking.order_number_not_found')}</p>
          <Button className="bg-black hover:bg-gray-800 text-white" onClick={() => navigate('/')}>
            {t('tracking.back_home')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'}>

      <div className="bg-black text-white py-5 px-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
          <img src={qiroxLogo} alt="مكان الشيف البخاري" className="h-14 object-contain" />
          <h1 className="text-base font-bold tracking-widest text-white/90">مكان الشيف البخاري</h1>
          <p className="text-xs text-gray-400">{t('tracking.header')} · Order Tracking</p>
        </div>
      </div>

      <div className="bg-black pt-0 pb-5">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-block bg-white text-black text-2xl font-bold font-mono px-8 py-2.5 rounded-2xl tracking-widest shadow-lg">
            {fmtOrderNum(orderNumberRaw)}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {showReadyAlert && (
          <div className="bg-green-500 text-white rounded-2xl p-4 text-center font-bold text-lg shadow-lg animate-pulse border-2 border-green-300">
            🎉 {t('tracking.ready_alert')}
          </div>
        )}

        {showDeliveredAlert && (
          <div className="bg-teal-500 text-white rounded-2xl p-4 text-center font-bold text-lg shadow-lg animate-pulse border-2 border-teal-300">
            🚗 {t('tracking.delivered_alert')}
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
            <p className="font-bold text-red-700 text-lg">
              {order?.status === 'refunded'
                ? `❌ ${t('tracking.refunded_title')}`
                : `❌ ${t('tracking.cancelled_title')}`}
            </p>
          </div>
        )}

        {isSuspended && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 flex items-center gap-3">
            <PauseCircle className="w-8 h-8 text-orange-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-orange-800">{t('tracking.suspended_title')}</p>
              <p className="text-sm text-orange-600">{t('tracking.suspended_desc')}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-medium">{t('tracking.looking_up')}</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto">
              <Package size={28} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-600 font-bold text-lg mb-1">{t('tracking.not_found')}</p>
              <p className="text-gray-400 text-sm">{t('tracking.not_found_desc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-gray-300 text-gray-600 gap-1.5">
              <RefreshCw size={14} />
              {t('tracking.retry')}
            </Button>
          </div>
        )}

        {order && !isCancelled && (
          <>
            <div className={`rounded-2xl shadow-sm border-2 p-5 ${statusColor.bg} ${statusColor.border}`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">{t('tracking.order_status')}</p>
                  <p className={`text-lg font-black ${statusColor.text}`}>
                    {getStatusLabel(order.status)}
                  </p>
                </div>
                {order.status === 'ready' && (
                  <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                    ✅ {t('tracking.step.ready')}!
                  </div>
                )}
                {order.status === 'delivered' && (
                  <div className="flex items-center gap-1.5 bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    <Truck size={12} />
                    {t('tracking.step.on_the_way')}
                  </div>
                )}
                {order.status === 'in_progress' && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    <span className="text-xs font-bold text-blue-600">{t('tracking.preparing_now')}</span>
                  </div>
                )}
                {isSuspended && (
                  <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-300">
                    <PauseCircle size={12} />
                    {t('status.suspended')}
                  </div>
                )}
              </div>

              {!isSuspended && (
                <div className="relative flex items-start">
                  <div className="absolute top-4 right-4 left-4 h-0.5 bg-gray-200 z-0" />
                  <div
                    className="absolute top-4 right-4 h-0.5 bg-black z-0 transition-all duration-700"
                    style={{
                      width: stepIndex === 0 ? '0%'
                        : stepIndex >= STATUS_STEP_KEYS.length - 1 ? 'calc(100% - 2rem)'
                        : `calc(${(stepIndex / (STATUS_STEP_KEYS.length - 1)) * 100}% - 2rem)`
                    }}
                  />
                  {STATUS_STEP_KEYS.map((step, idx) => {
                    const StepIcon = step.icon;
                    const done = idx <= stepIndex;
                    const current = idx === stepIndex;
                    return (
                      <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5 z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-2
                          ${done ? `${step.color} border-white text-white shadow-md` : 'bg-white border-gray-300 text-gray-400'}
                          ${current ? `ring-4 ${step.ring}` : ''}`}>
                          <StepIcon size={14} />
                        </div>
                        <span className={`text-[9px] text-center leading-tight font-semibold ${done ? 'text-gray-700' : 'text-gray-400'}`}>
                          {t(step.stepKey)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {order.status === 'in_progress' && order.estimatedMinutes && order.createdAt && (
                <CountdownTimer estimatedMinutes={order.estimatedMinutes} startTime={order.createdAt} />
              )}

              {order.status === 'delivered' && (
                <div className="mt-4 p-3 bg-teal-50 rounded-xl border border-teal-200 flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                    <Truck size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-teal-800">{t('tracking.on_the_way_msg')}</p>
                    <p className="text-xs text-teal-600">{t('tracking.arriving_soon')}</p>
                  </div>
                </div>
              )}

              {(order.status === 'received' || order.status === 'completed') && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                  <CheckCircle size={22} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm font-bold text-gray-700">{t('tracking.completed_msg')}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
                <Coffee size={16} className="text-gray-500" />
                {t('tracking.order_details')}
              </h3>

              {getOrderTypeName(order.orderType) && (
                <div className="flex justify-between text-sm mb-2 pb-2 border-b border-dashed border-gray-100">
                  <span className="text-gray-500">{t('tracking.order_type_label')}</span>
                  <span className="font-bold bg-gray-100 px-2.5 py-0.5 rounded-full text-xs">{getOrderTypeName(order.orderType)}</span>
                </div>
              )}
              {order.tableNumber && (
                <div className="flex justify-between text-sm mb-3 pb-3 border-b border-dashed border-gray-100">
                  <span className="text-gray-500">{t('tracking.table_label')}</span>
                  <span className="font-bold">{t('tracking.table_label')} {order.tableNumber}</span>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {(order.items || []).map((item, i) => {
                  const name = isAr
                    ? (item.coffeeItem?.nameAr || item.nameAr || item.name || '')
                    : (item.coffeeItem?.nameEn || item.nameEn || item.coffeeItem?.nameAr || item.nameAr || item.name || '');
                  const addons = (item.customization?.selectedItemAddons || [])
                    .map(a => isAr ? a.nameAr : (a.nameEn || a.nameAr))
                    .join('، ');
                  return (
                    <div key={i} className="flex items-start justify-between py-2 border-b border-dashed border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{name}</p>
                        {addons && <p className="text-xs text-gray-400 mt-0.5">+ {addons}</p>}
                      </div>
                      <span className="bg-black text-white text-xs font-bold px-2.5 py-0.5 rounded-full mr-3 flex-shrink-0">
                        ×{item.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
                <span className="font-bold text-gray-700">{t('tracking.total')}</span>
                <span className="font-black text-xl">{Number(order.totalAmount).toFixed(2)} <SarIcon size={16} /></span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-4">
                <img src={qiroxLogo} alt="Black Rose" className="h-10 object-contain flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-base">{t('tracking.join_world')}</h3>
                  <p className="text-xs text-gray-300 mt-0.5">{t('tracking.loyalty_desc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: Gift,   key: 'tracking.points_per_order' },
                  { icon: Star,   key: 'tracking.exclusive_offers' },
                  { icon: Coffee, key: 'tracking.free_drink' },
                ].map(({ icon: Icon, key }) => (
                  <div key={key} className="bg-white/10 rounded-xl p-2.5 text-center">
                    <Icon size={16} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-300 font-medium leading-tight">{t(key)}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-white text-black hover:bg-gray-100 text-sm font-bold h-10"
                  onClick={() => navigate('/register')}
                >
                  <User size={14} className="ml-1.5" />
                  {t('tracking.create_account')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-white/30 text-white hover:bg-white/10 text-sm font-bold h-10"
                  onClick={() => navigate('/login')}
                >
                  {t('auth.login')}
                  <ChevronRight size={14} className="mr-1.5" />
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 pb-4">
              {t('tracking.footer_quote')} — مكان الشيف البخاري
            </p>
          </>
        )}

        {order && isCancelled && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
              <Coffee size={16} className="text-gray-500" />
              {t('tracking.order_details')}
            </h3>
            <div className="space-y-2 mb-4">
              {(order.items || []).map((item, i) => {
                const name = isAr
                  ? (item.coffeeItem?.nameAr || item.nameAr || item.name || '')
                  : (item.coffeeItem?.nameEn || item.nameEn || item.coffeeItem?.nameAr || item.nameAr || item.name || '');
                return (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-dashed border-gray-100 last:border-0">
                    <p className="font-semibold text-sm text-gray-500 line-through">{name}</p>
                    <span className="text-xs text-gray-400">×{item.quantity}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
              <span className="font-bold text-gray-500">{t('tracking.total')}</span>
              <span className="font-black text-xl text-gray-500">{Number(order.totalAmount).toFixed(2)} <SarIcon size={16} /></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
