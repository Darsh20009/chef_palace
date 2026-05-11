import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Coffee, Clock, Package, Check, CheckCircle,
  ChevronRight, User, Star, Gift, ArrowLeft, Truck, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fmtOrderNum } from "@/lib/print-utils";
const chefsplaceLogo = "/logo.png";

interface OrderItem {
  coffeeItem?: { nameAr?: string; nameEn?: string; price?: number };
  name?: string;
  nameAr?: string;
  quantity: number;
  customization?: { selectedItemAddons?: Array<{ nameAr: string }> };
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

const STATUS_STEPS = [
  { key: 'pending',     label: 'تم الاستلام',    icon: Clock,         color: 'bg-amber-500',  ring: 'ring-amber-200'  },
  { key: 'in_progress', label: 'قيد التحضير',    icon: Coffee,        color: 'bg-blue-500',   ring: 'ring-blue-200'   },
  { key: 'ready',       label: 'جاهز للاستلام',  icon: Package,       color: 'bg-green-500',  ring: 'ring-green-200'  },
  { key: 'completed',   label: 'مكتمل',           icon: CheckCircle,   color: 'bg-gray-400',   ring: 'ring-gray-200'   },
];

const STATUS_MAP: Record<string, number> = {
  awaiting_payment: 0, payment_confirmed: 0, pending: 0,
  in_progress: 1,
  ready: 2, out_for_delivery: 2,
  completed: 3,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'في الانتظار', awaiting_payment: 'بانتظار الدفع',
  payment_confirmed: 'تم الدفع', in_progress: 'قيد التحضير',
  ready: 'جاهز للاستلام', out_for_delivery: 'في الطريق إليك',
  completed: 'مكتمل', cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:          { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-300' },
  awaiting_payment: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' },
  payment_confirmed:{ bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-300'  },
  in_progress:      { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-300'  },
  ready:            { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-300' },
  out_for_delivery: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300'},
  completed:        { bg: 'bg-gray-100',  text: 'text-gray-700',   border: 'border-gray-300'  },
  cancelled:        { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300'   },
};

function getOrderTypeName(type?: string) {
  const m: Record<string, string> = {
    dine_in: 'طاولة', 'dine-in': 'طاولة',
    takeaway: 'سفري', pickup: 'سفري',
    delivery: 'توصيل', car_pickup: 'سيارة',
    'car-pickup': 'سيارة', online: 'أونلاين',
    drive_thru: 'درايف ثرو',
  };
  return type ? (m[type] || type) : '';
}

function CountdownTimer({ estimatedMinutes, startTime }: { estimatedMinutes: number; startTime: string }) {
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
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [estimatedMinutes, startTime]);

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-blue-700">⏱ الوقت المتبقي للتحضير</span>
        <span className="text-2xl font-bold font-mono text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-200" dir="ltr">
          {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
      </div>
      <Progress value={progress} className="h-2 bg-blue-200 [&>div]:bg-blue-500" />
      <p className="text-xs text-center text-blue-500">وقت التحضير المتوقع: {estimatedMinutes} دقيقة</p>
    </div>
  );
}

export default function PublicOrderTrackPage() {
  const params = useParams<{ orderNumber: string }>();
  const [, navigate] = useLocation();
  const orderNumberRaw = params.orderNumber || '';
  const prevStatusRef = useRef('');
  const [showReadyAlert, setShowReadyAlert] = useState(false);

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

  // WebSocket live updates
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

  // Alert when order becomes ready
  useEffect(() => {
    if (order?.status === 'ready' && prevStatusRef.current && prevStatusRef.current !== 'ready') {
      setShowReadyAlert(true);
    }
    if (order) prevStatusRef.current = order.status;
  }, [order]);

  const stepIndex = order ? (STATUS_MAP[order.status] ?? 0) : 0;
  const statusColor = order ? (STATUS_COLORS[order.status] || STATUS_COLORS.pending) : STATUS_COLORS.pending;

  if (!orderNumberRaw) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-4">
          <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="h-16 mx-auto object-contain" />
          <p className="text-gray-500 text-lg">رقم الطلب غير موجود</p>
          <Button className="bg-black hover:bg-gray-800 text-white" onClick={() => navigate('/')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* ── Header ── */}
      <div className="bg-black text-white py-5 px-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
          <img
            src={chefsplaceLogo}
            alt="مكان الشيف البخاري"
            className="h-14 object-contain"
          />
          <h1 className="text-base font-bold tracking-widest text-white/90 uppercase">مكان الشيف البخاري</h1>
          <p className="text-xs text-gray-400">متابعة الطلب · Order Tracking</p>
        </div>
      </div>

      {/* ── Order number pill ── */}
      <div className="bg-black pt-0 pb-5">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-block bg-white text-black text-2xl font-bold font-mono px-8 py-2.5 rounded-2xl tracking-widest shadow-lg">
            {fmtOrderNum(orderNumberRaw)}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Ready alert */}
        {showReadyAlert && (
          <div className="bg-green-500 text-white rounded-2xl p-4 text-center font-bold text-lg shadow-lg animate-pulse border-2 border-green-300">
            🎉 طلبك جاهز للاستلام! تفضل
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-medium">جاري البحث عن طلبك...</p>
          </div>
        )}

        {/* Error / Not found */}
        {error && !isLoading && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto">
              <Package size={28} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-600 font-bold text-lg mb-1">الطلب غير موجود</p>
              <p className="text-gray-400 text-sm">تأكد من رقم الطلب وحاول مجدداً</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-gray-300 text-gray-600 gap-1.5"
            >
              <RefreshCw size={14} />
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* ── Main content when order found ── */}
        {order && (
          <>
            {/* Status card */}
            <div className={`rounded-2xl shadow-sm border-2 p-5 ${statusColor.bg} ${statusColor.border}`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">حالة الطلب</p>
                  <p className={`text-lg font-black ${statusColor.text}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </p>
                </div>
                {order.status === 'ready' && (
                  <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                    ✅ جاهز!
                  </div>
                )}
                {order.status === 'in_progress' && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    <span className="text-xs font-bold text-blue-600">يُحضَّر الآن</span>
                  </div>
                )}
              </div>

              {/* Progress steps */}
              <div className="relative flex items-start">
                {/* connector line background */}
                <div className="absolute top-4 right-4 left-4 h-0.5 bg-gray-200 z-0" />
                {/* connector line fill */}
                <div
                  className="absolute top-4 right-4 h-0.5 bg-black z-0 transition-all duration-700"
                  style={{
                    width: stepIndex === 0 ? '0%'
                      : stepIndex >= STATUS_STEPS.length - 1 ? 'calc(100% - 2rem)'
                      : `calc(${(stepIndex / (STATUS_STEPS.length - 1)) * 100}% - 2rem)`
                  }}
                />
                {STATUS_STEPS.map((step, idx) => {
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
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Countdown for in-progress */}
              {order.status === 'in_progress' && order.estimatedMinutes && order.createdAt && (
                <CountdownTimer estimatedMinutes={order.estimatedMinutes} startTime={order.createdAt} />
              )}
            </div>

            {/* Order details card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
                <Coffee size={16} className="text-gray-500" />
                تفاصيل الطلب
              </h3>

              {getOrderTypeName(order.orderType) && (
                <div className="flex justify-between text-sm mb-2 pb-2 border-b border-dashed border-gray-100">
                  <span className="text-gray-500">نوع الطلب</span>
                  <span className="font-bold bg-gray-100 px-2.5 py-0.5 rounded-full text-xs">{getOrderTypeName(order.orderType)}</span>
                </div>
              )}
              {order.tableNumber && (
                <div className="flex justify-between text-sm mb-3 pb-3 border-b border-dashed border-gray-100">
                  <span className="text-gray-500">الطاولة</span>
                  <span className="font-bold">طاولة {order.tableNumber}</span>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {(order.items || []).map((item, i) => {
                  const name = item.coffeeItem?.nameAr || item.nameAr || item.name || '';
                  const addons = (item.customization?.selectedItemAddons || []).map(a => a.nameAr).join('، ');
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
                <span className="font-bold text-gray-700">المجموع</span>
                <span className="font-black text-xl">{Number(order.totalAmount).toFixed(2)} <span className="text-sm font-bold text-gray-500">ر.س</span></span>
              </div>
            </div>

            {/* Loyalty invite card */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3 mb-4">
                <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="h-10 object-contain flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-base">انضم لعالم مكان الشيف ☕</h3>
                  <p className="text-xs text-gray-300 mt-0.5">نقاط لكل وجبة • عروض حصرية • وجبة مجانية</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: Gift, label: 'نقاط بكل طلب' },
                  { icon: Star, label: 'عروض حصرية' },
                  { icon: Coffee, label: 'وجبة مجانية' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                    <Icon size={16} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-300 font-medium leading-tight">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-white text-black hover:bg-gray-100 text-sm font-bold h-10"
                  onClick={() => navigate('/register')}
                >
                  <User size={14} className="ml-1.5" />
                  إنشاء حساب
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-white/30 text-white hover:bg-white/10 text-sm font-bold h-10"
                  onClick={() => navigate('/login')}
                >
                  تسجيل الدخول
                  <ChevronRight size={14} className="mr-1.5" />
                </Button>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 pb-4">
              "بخاري أصيل وضيافة كريمة" — مكان الشيف البخاري
            </p>
          </>
        )}
      </div>
    </div>
  );
}
