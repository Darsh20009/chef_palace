import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, X, BookOpen, MapPin,
  Home, ShoppingCart, CreditCard, ClipboardList, ChefHat,
  Table2, Calendar, Clock, ToggleLeft, Coffee, Sparkles
} from "lucide-react";

const TOUR_KEY = "employee_tour_v2_completed";

interface TourStep {
  id: string;
  path: string;
  titleAr: string;
  descAr: string;
  tipsAr: string[];
  icon: React.ElementType;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "home",
    path: "/employee/home",
    titleAr: "الصفحة الرئيسية",
    descAr: "نقطة البداية الكاملة لكل خدمات البوابة. من هنا تصل لأي أداة في النظام بضغطة واحدة.",
    tipsAr: ["افتح البوابة في بداية كل وردية", "جميع الأدوات متاحة من هنا مباشرةً"],
    icon: Home,
    color: "bg-primary",
  },
  {
    id: "pos",
    path: "/employee/pos",
    titleAr: "نقطة البيع (POS)",
    descAr: "استقبل الطلبات، اختر المنتجات من القائمة، أضفها للسلة، وأتمم الدفع نقداً أو بطاقة أو بنقاط الولاء.",
    tipsAr: [
      "اضغط / للبحث السريع عن منتج",
      "يمكنك فتح أكثر من طلب في نفس الوقت",
      "اضغط Ctrl+P لطباعة الإيصال",
    ],
    icon: ShoppingCart,
    color: "bg-blue-600",
  },
  {
    id: "cashier",
    path: "/employee/cashier",
    titleAr: "الكاشير",
    descAr: "ابحث عن العميل برقم هاتفه، تحقق من نقاطه، أضف نقاط ولاء يدوياً، وطبّق خصومات الكوبونات.",
    tipsAr: [
      "أدخل رقم الهاتف كاملاً للبحث",
      "يمكن استبدال النقاط بمشروب مجاني",
    ],
    icon: CreditCard,
    color: "bg-emerald-600",
  },
  {
    id: "orders",
    path: "/employee/orders",
    titleAr: "الطلبات",
    descAr: "تابع جميع الطلبات من لحظة الاستلام حتى التسليم. حدّث الحالة: بانتظار ← يُحضَّر ← جاهز ← تم التسليم.",
    tipsAr: [
      "الطلبات تُرتَّب حسب الأقدم أولاً",
      "يمكن طباعة إيصال لأي طلب",
      "الطلبات الخارجية (هنجر ستيشن، نون) تظهر هنا أيضاً",
    ],
    icon: ClipboardList,
    color: "bg-violet-600",
  },
  {
    id: "kitchen",
    path: "/employee/kitchen",
    titleAr: "شاشة المطبخ (KDS)",
    descAr: "شاشة مخصصة للمطبخ لعرض الطلبات الجديدة وترتيبها حسب الأولوية. اضغط 'جاهز' بعد انتهاء التحضير.",
    tipsAr: [
      "الطلبات العاجلة تظهر باللون الأحمر",
      "وضع Rush Mode يعرض الأرقام بحجم كبير",
      "اضغط على الطلب لتفاصيله الكاملة",
    ],
    icon: ChefHat,
    color: "bg-orange-600",
  },
  {
    id: "tables",
    path: "/employee/table-orders",
    titleAr: "إدارة الطاولات",
    descAr: "راقب طلبات الصالة مباشرةً. كل طاولة تُعرض بحالتها وطلباتها الحية وعدد الزبائن.",
    tipsAr: [
      "الطاولة الخضراء = متاحة",
      "الطاولة البرتقالية = مشغولة",
      "اضغط على الطاولة لرؤية طلباتها",
    ],
    icon: Table2,
    color: "bg-cyan-600",
  },
  {
    id: "attendance",
    path: "/employee/attendance",
    titleAr: "الحضور والانصراف",
    descAr: "سجّل حضورك وانصرافك بالتحقق من موقعك الجغرافي. يُحسب الوقت تلقائياً ويُرسل للمدير.",
    tipsAr: [
      "يجب أن تكون داخل نطاق الفرع عند تسجيل الحضور",
      "لا تنسَ تسجيل الانصراف في نهاية الوردية",
    ],
    icon: Calendar,
    color: "bg-teal-600",
  },
  {
    id: "shifts",
    path: "/employee/shifts",
    titleAr: "الشيفتات",
    descAr: "افتح كاشير الشيفت في بداية الدوام وأغلقه في النهاية. اطبع تقرير Z بكل العمليات المالية.",
    tipsAr: [
      "افتح الشيفت بعد عد النقدية الأولية",
      "تقرير Z يُظهر إجمالي المبيعات وطرق الدفع",
      "يجب إغلاق الشيفت قبل مغادرة الوردية",
    ],
    icon: Clock,
    color: "bg-amber-600",
  },
  {
    id: "availability",
    path: "/employee/availability",
    titleAr: "توفر المنتجات",
    descAr: "بسرعة فعّل أو عطّل المنتجات المنتهية أو الغير متاحة. التغيير يظهر للعملاء فوراً.",
    tipsAr: [
      "عطّل المنتج لما ينتهي المخزون",
      "التغيير يُطبَّق على كل المنصات فوراً (موقع، كشك، طلب قرآن)",
    ],
    icon: ToggleLeft,
    color: "bg-rose-600",
  },
  {
    id: "menu",
    path: "/employee/menu-management",
    titleAr: "إدارة المنيو",
    descAr: "أضف منتجات جديدة، عدّل الأسعار والأحجام والإضافات، ورتّب الفئات حسب الأولوية.",
    tipsAr: [
      "يمكن إضافة أحجام متعددة لكل منتج",
      "ترتيب الفئات يتحكم في ظهورها في المنيو",
      "الإضافات تُضاف لكل منتج بشكل منفصل",
    ],
    icon: Coffee,
    color: "bg-indigo-600",
  },
  {
    id: "ai",
    path: "/employee/ai",
    titleAr: "المساعد الذكي",
    descAr: "اسأل المساعد الذكي عن أي شيء: وصفات المشروبات، سياسات العمل، كيفية استخدام النظام، والمزيد.",
    tipsAr: [
      "اسأله عن أي إجراء في النظام",
      "يدعم العربية والإنجليزية",
      "متاح 24/7 للدعم الفوري",
    ],
    icon: Sparkles,
    color: "bg-pink-600",
  },
];

interface EmployeeTourProps {
  onComplete?: () => void;
}

export function EmployeeTour({ onComplete }: EmployeeTourProps) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const goToStep = useCallback((idx: number) => {
    setStep(idx);
    navigate(TOUR_STEPS[idx].path);
  }, [navigate]);

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      goToStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) goToStep(step - 1);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  const Icon = current.icon;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Dim overlay */}
          <motion.div
            key="tour-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[9998] pointer-events-none"
          />

          {/* Tour Card — bottom-anchored */}
          <motion.div
            key="tour-card"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-4 pt-2"
          >
            <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border overflow-hidden">

              {/* Progress bar */}
              <div className="h-1 bg-gray-100 dark:bg-gray-800">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    جولة النظام • {step + 1} / {TOUR_STEPS.length}
                  </span>
                </div>
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                  data-testid="button-tour-skip"
                >
                  <X className="w-3.5 h-3.5" />
                  تخطي
                </button>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Page name + icon */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${current.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground leading-tight">
                          {current.titleAr}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {current.path}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-foreground leading-relaxed">
                      {current.descAr}
                    </p>

                    {/* Tips */}
                    <div className="space-y-1">
                      {current.tipsAr.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Step dots */}
              <div className="flex justify-center gap-1 pb-2">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToStep(i)}
                    className={`rounded-full transition-all ${
                      i === step
                        ? "w-4 h-1.5 bg-primary"
                        : "w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-primary/60"
                    }`}
                    data-testid={`button-tour-dot-${i}`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2 px-4 pb-4">
                <button
                  onClick={handlePrev}
                  disabled={isFirst}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-tour-prev"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                  data-testid="button-tour-next"
                >
                  {isLast ? "إنهاء الجولة ✓" : (
                    <>
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Hook to manually re-trigger tour */
export function useEmployeeTour() {
  const resetTour = () => {
    localStorage.removeItem(TOUR_KEY);
    window.location.reload();
  };
  const isTourCompleted = () => !!localStorage.getItem(TOUR_KEY);
  return { resetTour, isTourCompleted };
}
