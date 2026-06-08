import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Ticket, LogIn, ShoppingBag, BadgePercent } from "lucide-react";
const chefsplaceLogo = "/logo.png";
import bannerImage1 from "@assets/image_1773902463502.png";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PromoData {
  code: string;
  discountPercentage: number;
  isActive?: number | boolean;
  reason?: string;
}

export default function PromoPage() {
  const [, params] = useRoute("/promo/:code");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const code = (params?.code || "").toUpperCase();

  const [promo, setPromo] = useState<PromoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("رمز الكوبون غير صحيح");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/discount-codes/by-code/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || "هذا الكوبون غير متاح");
        } else if (!data?.isActive) {
          setError("هذا الكوبون غير مفعّل حالياً");
        } else {
          setPromo(data);
        }
      } catch (_) {
        if (!cancelled) setError("تعذّر التحقق من الكوبون");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const persistAndGo = (target: string) => {
    if (promo) {
      try {
        localStorage.setItem(
          "pendingCoupon",
          JSON.stringify({ code: promo.code, percentage: promo.discountPercentage, savedAt: Date.now() }),
        );
      } catch (_) {}
      toast({
        title: "تم حفظ الكوبون",
        description: `سيُطبَّق ${promo.discountPercentage}% تلقائياً عند الدفع`,
      });
    }
    setLocation(target);
  };

  return (
    <div
      dir="rtl"
      className="relative min-h-[100dvh] w-full flex flex-col items-center px-5 py-8 font-ibm-arabic overflow-hidden"
      data-testid="page-promo"
    >
      {/* Background image with overlay (same as welcome/splash) */}
      <div className="absolute inset-0 z-0">
        <img
          src={bannerImage1}
          alt="Coffee Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
      </div>
      <div className="relative z-10 w-full flex flex-col items-center">
      {/* Logo (same as splash) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, type: "spring", stiffness: 140, damping: 14 }}
        className="mb-7 mt-6"
      >
        <div className="w-32 h-32 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl flex items-center justify-center p-4">
          <img
            src={chefsplaceLogo}
            alt="مكان الشيف البخاري"
            className="w-full h-full object-contain"
            data-testid="img-promo-logo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </motion.div>

      {/* Brand (same as splash) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center mb-6"
      >
        <h1 className="text-2xl font-black tracking-[0.3em] text-white uppercase">
          مكان الشيف البخاري
        </h1>
        <p className="text-[#BE1845] text-xs font-bold tracking-[0.45em] uppercase mt-0.5">
          مطعم
        </p>
      </motion.div>

      {/* Bouncing dots (same as splash) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-2 mb-8"
      >
        {[0, 150, 300].map((delay) => (
          <div
            key={delay}
            className="w-2 h-2 rounded-full bg-[#BE1845] animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative w-full max-w-md"
      >
        <div
          className="relative bg-[#fdf6ee] rounded-3xl shadow-2xl overflow-hidden"
          data-testid="card-coupon"
        >
          {/* Decorative ticket notches */}
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black" />
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black" />

          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <img src={chefsplaceLogo} alt="logo" className="h-12 w-12" />
              <div className="text-right">
                <p className="text-[11px] text-[#6b3a1a] font-semibold tracking-wide">
                  مكان الشيف البخاري
                </p>
                <p className="text-[11px] text-neutral-500">كوبون خصم مقدم لك</p>
              </div>
            </div>

            <div className="text-center mb-5">
              <p className="text-base text-neutral-700 mb-1">كوبون خصم خاص</p>
              <h1 className="text-2xl font-bold text-[#3a1f10]">
                خصم فوري على طلبك
              </h1>
            </div>

            {/* Coupon code box */}
            <div className="border-2 border-dashed border-[#b07a3a] rounded-2xl p-4 bg-white/60 mb-5">
              {loading ? (
                <div className="text-center py-6 text-neutral-500" data-testid="text-promo-loading">
                  جارٍ التحقق من الكوبون...
                </div>
              ) : error ? (
                <div className="text-center py-4 text-red-600 font-medium" data-testid="text-promo-error">
                  {error}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-[11px] text-neutral-500 mb-1">رمز الكوبون</p>
                    <p
                      className="text-2xl font-extrabold tracking-widest text-[#3a1f10]"
                      data-testid="text-coupon-code"
                    >
                      {promo!.code}
                    </p>
                  </div>
                  <div className="h-12 w-px bg-[#b07a3a]/40 mx-2" />
                  <div className="text-center flex-1">
                    <p className="text-[11px] text-neutral-500 mb-1">قيمة الخصم</p>
                    <p
                      className="text-3xl font-extrabold text-[#b07a3a]"
                      data-testid="text-coupon-percentage"
                    >
                      {promo!.discountPercentage}%
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed text-center mb-5">
              يُطبَّق الخصم تلقائياً عند الانتقال إلى صفحة الدفع. صالح للاستخدام
              مرة واحدة لكل عميل.
            </p>

            <div className="space-y-2">
              <Button
                size="lg"
                disabled={!promo}
                className="w-full bg-[#3a1f10] hover:bg-[#4a2410] text-white text-base font-semibold rounded-xl h-12"
                onClick={() => persistAndGo("/menu")}
                data-testid="button-use-coupon"
              >
                <ShoppingBag className="ml-2 h-5 w-5" />
                استخدام الكوبون
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={!promo}
                className="w-full border-[#3a1f10] text-[#3a1f10] hover:bg-[#3a1f10] hover:text-white text-base font-semibold rounded-xl h-12"
                onClick={() => persistAndGo("/auth")}
                data-testid="button-login-with-coupon"
              >
                <LogIn className="ml-2 h-5 w-5" />
                تسجيل الدخول
              </Button>
            </div>
          </div>

          <div className="bg-[#3a1f10] text-white text-[11px] text-center py-2 flex items-center justify-center gap-1">
            <BadgePercent className="h-3.5 w-3.5" />
            عرض حصري - مكان الشيف البخاري الرياض
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
