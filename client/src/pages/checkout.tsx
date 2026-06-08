import { useState, useEffect, useRef } from "react";
import { brand } from "@/lib/brand";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useCartStore } from "@/lib/cart-store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PaymentMethods from "@/components/payment-methods";
import GeideaCheckoutWidget from "@/components/geidea-checkout";
import SimulatedCardPayment from "@/components/simulated-card-payment";
import PaymobCheckoutWidget from "@/components/paymob-checkout";
import { customerStorage } from "@/lib/customer-storage";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLoyaltyCard } from "@/hooks/useLoyaltyCard";
import { ErrorBoundary } from "@/components/error-boundary";
import { useTranslate, tc } from "@/lib/useTranslate";
import { User, Gift, CheckCircle, Sparkles, Loader2, Ticket, Tag, Wrench, Coffee, Award, CreditCard, Star, Coins, X, ChevronLeft, Upload, Camera, Truck, Printer, Navigation, MapPin, PackageCheck, Bell, ClipboardList } from "lucide-react";
import ChefBukhariCard from "@/components/ChefBukhariCard";
import { printTaxInvoice } from "@/lib/print-utils";
import { useTranslation } from "react-i18next";
import type { PaymentMethodInfo, PaymentMethod } from "@shared/schema";
import SarIcon from "@/components/sar-icon";


function LoyaltyCheckoutCard({
  loyaltyCard,
  loyaltyPoints,
  pointsPerSar,
  minPointsForRedemption,
  pointsToRedeem,
  onApplyPoints,
  onCancelPoints,
  baseTotal,
  pointsNeededForFree,
}: {
  loyaltyCard: any;
  loyaltyPoints: number;
  pointsPerSar: number;
  minPointsForRedemption: number;
  pointsToRedeem: number;
  onApplyPoints: (pts: number) => void;
  onCancelPoints: () => void;
  baseTotal: number;
  pointsNeededForFree: number;
}) {
  const isApplied = pointsToRedeem > 0;
  const totalPointsValue = parseFloat((loyaltyPoints / pointsPerSar).toFixed(2));
  const appliedDiscount = parseFloat((pointsToRedeem / pointsPerSar).toFixed(2));

  const canRedeem = loyaltyPoints >= minPointsForRedemption;
  const canMakeOrderFree = loyaltyPoints >= pointsNeededForFree;
  // Slider max: cap at points needed for free order (remaining stay with customer)
  const sliderMax = canMakeOrderFree ? pointsNeededForFree : loyaltyPoints;
  const [inputVal, setInputVal] = useState(() =>
    canRedeem ? minPointsForRedemption : 0
  );

  return (
    <div className="space-y-3" data-testid="loyalty-checkout-section">
      
      <ChefBukhariCard
        phone={loyaltyCard?.phoneNumber || loyaltyCard?.customerPhone}
        points={loyaltyPoints}
        sarValue={totalPointsValue}
        customerName={loyaltyCard?.customerName}
      />

      {/* Applied state */}
      {isApplied && (
        <div className="flex items-center justify-between gap-3 bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-xl p-3" data-testid="points-applied-banner">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 flex-1 min-w-0">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">{tc("تم تطبيق خصم النقاط ✓", "Points Discount Applied ✓")}</p>
              <p className="text-xs opacity-80">
                {pointsToRedeem.toLocaleString()} نقطة = <span className="font-black">{appliedDiscount.toFixed(2)} ريال</span> خصم
                {appliedDiscount >= baseTotal && <span className="text-green-600 font-bold mr-1">· يغطي المبلغ كاملاً!</span>}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 h-7 px-2 text-xs flex-shrink-0 gap-1"
            onClick={onCancelPoints}
            data-testid="button-cancel-points"
          >
            <X className="w-3 h-3" />
            إلغاء
          </Button>
        </div>
      )}

      {/* Redemption UI */}
      {!isApplied && canRedeem && (
        <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-3 bg-amber-50/50 dark:bg-amber-900/10" data-testid="points-redeem-section">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{tc("استخدم نقاطك كخصم", "Use Your Points as Discount")}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={minPointsForRedemption}
                max={sliderMax}
                step={Math.max(1, Math.floor(sliderMax / 100))}
                value={Math.min(inputVal, sliderMax)}
                onChange={e => setInputVal(Number(e.target.value))}
                className="flex-1 accent-amber-500"
                data-testid="slider-points"
              />
              <div className="text-right min-w-[80px]">
                <p className="text-sm font-black text-amber-700 dark:text-amber-400">{Math.min(inputVal, sliderMax).toLocaleString()}</p>
                <p className="text-[10px] text-amber-600/70">{tc("نقطة", "pts")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">{minPointsForRedemption} (الحد الأدنى)</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                = {parseFloat((Math.min(inputVal, sliderMax) / pointsPerSar).toFixed(2)).toFixed(2)} ريال خصم
              </span>
            </div>
            {canMakeOrderFree && loyaltyPoints > pointsNeededForFree && (
              <p className="text-[11px] text-center text-green-600 dark:text-green-400 font-medium">
                يُخصم {pointsNeededForFree.toLocaleString()} نقطة فقط • يبقى لك {(loyaltyPoints - pointsNeededForFree).toLocaleString()} نقطة
              </p>
            )}
          </div>

          {canMakeOrderFree && (
            <Button
              variant="outline"
              className="w-full border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 font-bold h-9 gap-2 text-sm"
              onClick={() => onApplyPoints(pointsNeededForFree)}
              data-testid="button-free-order"
            >
              <Star className="w-4 h-4" />
              اجعل الطلب مجانياً ({pointsNeededForFree.toLocaleString()} نقطة)
            </Button>
          )}

          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 gap-2"
            onClick={() => onApplyPoints(Math.min(inputVal, sliderMax))}
            data-testid="button-apply-points"
          >
            <Coins className="w-4 h-4" />
            طبّق خصم {parseFloat((Math.min(inputVal, sliderMax) / pointsPerSar).toFixed(2)).toFixed(2)} ريال
          </Button>
        </div>
      )}

      {!isApplied && !canRedeem && loyaltyPoints > 0 && (
        <div className="text-center px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            تحتاج {(minPointsForRedemption - loyaltyPoints).toLocaleString()} نقطة إضافية للاستبدال
          </p>
          <p className="text-[10px] text-amber-600/70 mt-0.5">الحد الأدنى: {minPointsForRedemption} نقطة</p>
        </div>
      )}

      {!isApplied && loyaltyPoints === 0 && (
        <div className="text-center px-3 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/50">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">اكسب نقاطك عند إتمام طلبك!</p>
          <p className="text-[11px] text-amber-600/70 mt-1">
            ابدأ باكتساب {minPointsForRedemption} نقطة للحصول على أول خصم بقيمة {(minPointsForRedemption / pointsPerSar).toFixed(2)} ريال
          </p>
        </div>
      )}
    </div>
  );
}

function getCartItemUnitPrice(i: any): number {
  let base = Number(i.coffeeItem?.price) || 0;
  if (i.selectedSize && i.coffeeItem?.availableSizes) {
    const size = i.coffeeItem.availableSizes.find((s: any) => s.nameAr === i.selectedSize);
    if (size) base = Number(size.price) || 0;
  }
  const enrichedAddonsPrice = (i.selectedAddons || []).reduce((sum: number, addonId: string) => {
    if (i.enrichedAddons) {
      const addon = i.enrichedAddons.find((a: any) => a.id === addonId || a._id === addonId);
      return sum + (Number(addon?.price) || 0);
    }
    return sum;
  }, 0);
  const inlineAddonsPrice = ((i as any).selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
  return base + enrichedAddonsPrice + inlineAddonsPrice;
}

export default function CheckoutPage() {
  const tc = useTranslate();
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { cartItems, clearCart, getFinalTotal, deliveryInfo } = useCartStore();
  const { toast } = useToast();
  const isAr = i18n.language === 'ar';

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [cashDistanceError, setCashDistanceError] = useState<string | null>(null);
  const [cashDistanceChecking, setCashDistanceChecking] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showInlineGeidea, setShowInlineGeidea] = useState(false);
  const [showSimulatedCard, setShowSimulatedCard] = useState(false);
  const [showPaymobCheckout, setShowPaymobCheckout] = useState(false);
  const [paymobCheckoutUrl, setPaymobCheckoutUrl] = useState("");
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showSuccessPage, setShowSuccessPage] = useState(false);
  const [wasReservationOrder, setWasReservationOrder] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [wantToRegister, setWantToRegister] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{code: string, percentage: number, isOffer?: boolean} | null>(null);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<{ code: string; balance: number; applied: number } | null>(null);
  const [isCheckingGiftCard, setIsCheckingGiftCard] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const { card: loyaltyCard, refetch: refetchLoyaltyCard } = useLoyaltyCard();

  const { data: loyaltySettings } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
    staleTime: 60000,
  });

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
    staleTime: 60000,
  });

  const { data: publicSettings } = useQuery<any>({
    queryKey: ["/api/public/settings"],
    staleTime: 120000,
  });

  const pointsPerSar: number = loyaltySettings?.pointsPerSar ?? 50;
  const minPointsForRedemption: number = loyaltySettings?.minPointsForRedemption ?? 100;
  const loyaltyPoints: number = loyaltyCard?.points || 0;

  const getBaseTotal = () => {
    let total = getFinalTotal();
    if (appliedDiscount) {
      total = total * (1 - appliedDiscount.percentage / 100);
    }
    return total;
  };

  const usePointsAsDiscount = pointsToRedeem > 0;
  const pointsDiscountSAR = pointsToRedeem > 0
    ? parseFloat((pointsToRedeem / pointsPerSar).toFixed(2))
    : 0;

  const orderDeliveryFee = deliveryInfo?.type === 'delivery' ? (deliveryInfo?.deliveryFee || 0) : 0;

  const getServiceFee = () => {
    if (!businessConfig?.serviceFeeEnabled) return 0;
    const subtotal = getFinalTotal();
    const threshold = businessConfig?.serviceFeeLowOrderThreshold ?? 5;
    const lowFee = businessConfig?.serviceFeeLowOrderAmount ?? 0.35;
    const normalFee = businessConfig?.serviceFeeAmount ?? 0.70;
    return subtotal < threshold ? lowFee : normalFee;
  };

  const serviceFee = getServiceFee();

  // Points can cover products + service fee (delivery is never covered by points)
  const totalCoverableByPoints = parseFloat((getBaseTotal() + serviceFee).toFixed(2));
  // Effective discount capped so we never deduct more points than needed
  const effectivePointsDiscountSAR = Math.min(pointsDiscountSAR, totalCoverableByPoints);
  // Actual points that will be deducted (may be less than selected if order is cheaper)
  const effectivePointsUsed = Math.round(effectivePointsDiscountSAR * pointsPerSar);
  // Points needed to make the whole order free (for smart button)
  const pointsNeededForFree = Math.ceil(totalCoverableByPoints * pointsPerSar);

  const getFinalTotalWithPoints = () => {
    const base = getBaseTotal();
    if (usePointsAsDiscount && pointsDiscountSAR > 0) {
      return Math.max(0, base + serviceFee - pointsDiscountSAR);
    }
    return base + serviceFee;
  };

  const giftCardDiscount = appliedGiftCard ? Math.min(appliedGiftCard.applied, getFinalTotalWithPoints()) : 0;

  const getFinalAmount = () => Math.max(0, getFinalTotalWithPoints() - giftCardDiscount) + orderDeliveryFee;

  const handleCheckGiftCard = async (code?: string) => {
    const codeToUse = code || giftCardCode.trim();
    if (!codeToUse) return;
    setIsCheckingGiftCard(true);
    try {
      const res = await fetch(`/api/gift-cards/check/${codeToUse.toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc("بطاقة غير صالحة", "Invalid gift card"));
      const currentTotal = getFinalTotalWithPoints();
      const applied = Math.min(Number(data.balance), currentTotal);
      setAppliedGiftCard({ code: data.code, balance: Number(data.balance), applied });
      toast({ title: tc("✅ بطاقة هدية مقبولة", "✅ Gift Card Accepted"), description: `سيتم خصم ${applied.toFixed(2)} ريال (الرصيد الكامل: ${data.balance} ريال)` });
    } catch (err: any) {
      toast({ variant: "destructive", title: tc("❌ خطأ", "❌ Error"), description: err.message });
    } finally {
      setIsCheckingGiftCard(false);
    }
  };
  const [isRegistering, setIsRegistering] = useState(false);
  const { customer, setCustomer } = useCustomer();
  const isGuestMode = !customer && customerStorage.isGuestMode();

  // Inline auth panel state (sign-in / register without leaving checkout)
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleInlineLogin = async () => {
    const id = authIdentifier.replace(/\s/g, '').trim();
    if (!id) {
      toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("أدخل رقم الجوال أو البريد", "Enter phone or email") });
      return;
    }
    if (!authPassword || authPassword.length < 4) {
      toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("كلمة المرور 4 أحرف على الأقل", "Password must be at least 4 chars") });
      return;
    }
    setAuthLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/login", { identifier: id, password: authPassword });
      const c = await res.json();
      setCustomer(c);
      customerStorage.clearGuestInfo();
      customerStorage.setGuestMode(false);
      setCustomerName(c.name);
      setCustomerPhone(c.phone);
      if (c.email) setCustomerEmail(c.email);
      setAuthPanelOpen(false);
      setAuthPassword('');
      toast({ title: tc("مرحباً بعودتك", "Welcome back"), description: c.name });
    } catch (e: any) {
      toast({ variant: "destructive", title: tc("فشل تسجيل الدخول", "Login failed"), description: e?.message || tc("بيانات غير صحيحة", "Invalid credentials") });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleInlineRegister = async () => {
    // Use guest info if present, otherwise use form fields
    const guestInfo = customerStorage.getGuestInfo();
    const phone = (guestInfo?.phone || authIdentifier).replace(/\s/g, '').trim();
    const fullName = (guestInfo?.name || authName).trim();
    if (!phone || phone.length !== 9 || !phone.startsWith('5')) {
      toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("رقم الجوال 9 أرقام يبدأ بـ 5", "Phone must be 9 digits starting with 5") });
      return;
    }
    if (!fullName || fullName.length < 2) {
      toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("الاسم حرفان على الأقل", "Name must be at least 2 chars") });
      return;
    }
    if (!authPassword || authPassword.length < 4) {
      toast({ variant: "destructive", title: tc("خطأ", "Error"), description: tc("كلمة المرور 4 أحرف على الأقل", "Password must be at least 4 chars") });
      return;
    }
    setAuthLoading(true);
    try {
      const res = await apiRequest("POST", "/api/customers/register", { phone, name: fullName, password: authPassword });
      const c = await res.json();
      setCustomer(c);
      customerStorage.clearGuestInfo();
      customerStorage.setGuestMode(false);
      setCustomerName(c.name);
      setCustomerPhone(c.phone);
      setAuthPanelOpen(false);
      setAuthPassword('');
      setAuthName('');
      toast({ title: tc("تم إنشاء حسابك ", "Account created ") + fullName, description: tc("تم ربط طلباتك السابقة", "Previous orders linked") });
    } catch (e: any) {
      toast({ variant: "destructive", title: tc("فشل التسجيل", "Registration failed"), description: e?.message || tc("حاول مرة أخرى", "Please try again") });
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone);
      if (customer.email) setCustomerEmail(customer.email);
    } else {
      const guestInfo = customerStorage.getGuestInfo();
      if (guestInfo) {
        setCustomerName(guestInfo.name);
        setCustomerPhone(guestInfo.phone);
      }
    }
  }, [customer]);

  // Reset payment method if invalid selection
  useEffect(() => {
    if (selectedPaymentMethod === 'qahwa-card') {
      setSelectedPaymentMethod(null);
    }
    setReceiptFile(null);
    setReceiptPreview(null);
  }, [selectedPaymentMethod]);

  // Auto-apply pending coupon (saved from /promo/:code link)
  const pendingCouponTriedRef = useRef(false);
  useEffect(() => {
    if (pendingCouponTriedRef.current) return;
    if (appliedDiscount) return;
    let pending: { code?: string } | null = null;
    try {
      const raw = localStorage.getItem("pendingCoupon");
      if (raw) pending = JSON.parse(raw);
    } catch (_) {}
    if (!pending?.code) return;
    pendingCouponTriedRef.current = true;
    setDiscountCode(pending.code);
    handleValidateDiscount(pending.code).finally(() => {
      try {
        localStorage.removeItem("pendingCoupon");
      } catch (_) {}
    });
  }, [appliedDiscount]);

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadReceiptToServer = async (file: File): Promise<string | null> => {
    try {
      setIsUploadingReceipt(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-receipt', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return data.url || null;
      }
      return null;
    } catch {
      return null;
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const pendingGeideaOrderData = useRef<any>(null);
  const geideaOrderNum = useRef<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentCallback = urlParams.get('payment') === 'callback';

    // Also detect Geidea's own callback params (they redirect directly with these params)
    const geideaResponseCode = urlParams.get('responseCode') || urlParams.get('Response') || urlParams.get('response_code');
    const geideaOrderId = urlParams.get('orderId') || urlParams.get('order_id');
    const geideaStatus = urlParams.get('status') || urlParams.get('Status');
    const geideaSignature = urlParams.get('signature') || urlParams.get('Signature');
    const geideaAmount = urlParams.get('amount') || urlParams.get('Amount') || urlParams.get('orderAmount');
    const geideaCurrency = urlParams.get('currency') || urlParams.get('Currency');
    const geideaMerchantRefId = urlParams.get('merchantReferenceId') || urlParams.get('MerchantReferenceId');

    const hasGeideaParams = !!(geideaResponseCode || geideaOrderId || geideaStatus);

    // Detect Paymob callback params
    const paymobProvider = urlParams.get('provider');
    const paymobSuccess = urlParams.get('success');
    const paymobTransactionId = urlParams.get('id');
    const paymobPending = urlParams.get('pending');
    const hasPaymobParams = paymobProvider === 'paymob' && paymobSuccess !== null;

    if (isPaymentCallback || hasGeideaParams || hasPaymobParams) {
      const storedOrderData = sessionStorage.getItem('pendingOrderData');
      const storedSessionId = sessionStorage.getItem('paymentSessionId');
      const storedProvider = sessionStorage.getItem('paymentProvider');

      if (storedOrderData && (storedSessionId || hasGeideaParams || hasPaymobParams)) {
        setIsVerifyingPayment(true);
        (async () => {
          try {
            const verifyPayload: Record<string, any> = {
              sessionId: storedSessionId,
              provider: storedProvider || paymobProvider,
            };

            // Pass Geidea's callback parameters for faster/more accurate verification
            if (hasGeideaParams) {
              if (geideaResponseCode) verifyPayload.geideaResponseCode = geideaResponseCode;
              if (geideaOrderId) verifyPayload.geideaOrderId = geideaOrderId;
              if (geideaStatus) verifyPayload.geideaStatus = geideaStatus;
              if (geideaSignature) verifyPayload.geideaSignature = geideaSignature;
              if (geideaAmount) verifyPayload.geideaAmount = geideaAmount;
              if (geideaCurrency) verifyPayload.geideaCurrency = geideaCurrency;
              if (geideaMerchantRefId) verifyPayload.geideaMerchantRefId = geideaMerchantRefId;
            }

            // Pass Paymob callback parameters
            if (hasPaymobParams) {
              verifyPayload.paymobSuccess = paymobSuccess;
              verifyPayload.paymobTransactionId = paymobTransactionId;
              verifyPayload.paymobPending = paymobPending;
            }

            const verifyRes = await apiRequest("POST", "/api/payments/verify", verifyPayload);
            const verifyData = await verifyRes.json();

            sessionStorage.removeItem('pendingOrderData');
            sessionStorage.removeItem('paymentSessionId');
            sessionStorage.removeItem('paymentProvider');

            if (verifyData.verified) {
              const orderData = JSON.parse(storedOrderData);
              orderData.paymentStatus = 'paid';
              orderData.transactionId = verifyData.transactionId || geideaOrderId || paymobTransactionId;
              createOrderMutation.mutate(orderData);
            } else {
              toast({
                variant: "destructive",
                title: t("checkout.payment_failed"),
                description: verifyData.error || t("checkout.payment_verification_failed"),
              });
            }
          } catch {
            sessionStorage.removeItem('pendingOrderData');
            sessionStorage.removeItem('paymentSessionId');
            sessionStorage.removeItem('paymentProvider');
            toast({ variant: "destructive", title: t("checkout.error"), description: t("checkout.payment_status_check_failed") });
          } finally {
            setIsVerifyingPayment(false);
          }
        })();
      }
      window.history.replaceState({}, '', '/checkout');
    }
  }, []);

  useEffect(() => {
    const activeOffer = customerStorage.getActiveOffer();
    if (activeOffer && activeOffer.discount > 0 && !appliedDiscount) {
      const discountPercentage = activeOffer.type === 'loyalty' 
        ? 0 
        : activeOffer.discount;
      
      if (discountPercentage > 0) {
        setAppliedDiscount({
          code: activeOffer.title,
          percentage: discountPercentage,
          isOffer: true
        });
        toast({
          title: t("points.offer_applied"),
          description: `${activeOffer.title} - ${t("points.discount")} ${discountPercentage}%`,
        });
      }
    }
  }, []);

  const { data: paymentMethods = [] } = useQuery<PaymentMethodInfo[]>({
    queryKey: ["/api/payment-methods"],
    queryFn: async () => {
      const res = await fetch(`/api/payment-methods`);
      return res.json();
    }
  });

  const cashMethod = paymentMethods.find(m => m.id === 'cash');

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    if (selectedPaymentMethod !== 'cash') {
      setCashDistanceError(null);
      return;
    }
    const maxDist = cashMethod?.cashMaxDistance || 0;
    const storeLoc = cashMethod?.storeLocation;
    if (!maxDist || maxDist <= 0 || !storeLoc?.lat || !storeLoc?.lng) {
      setCashDistanceError(null);
      return;
    }
    if (!navigator.geolocation) {
      setCashDistanceError(tc('متصفحك لا يدعم تحديد الموقع، لا يمكن التحقق من المسافة للدفع نقداً', 'Your browser does not support location detection. Cash payment distance check unavailable.'));
      return;
    }
    setCashDistanceChecking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, storeLoc.lat!, storeLoc.lng!);
        setCashDistanceChecking(false);
        if (dist > maxDist) {
          setCashDistanceError(`أنت بعيد عن المتجر (${Math.round(dist)} متر). الدفع نقداً متاح فقط ضمن ${maxDist} متر من المتجر.`);
        } else {
          setCashDistanceError(null);
        }
      },
      () => {
        setCashDistanceChecking(false);
        setCashDistanceError(tc('تعذّر تحديد موقعك. الرجاء السماح بالوصول للموقع للدفع نقداً.', 'Could not determine your location. Please allow location access for cash payment.'));
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [selectedPaymentMethod, cashMethod]);

  const paymobAutoTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    const isPaymob = selectedPaymentMethod === 'paymob-card' || selectedPaymentMethod === 'paymob-apple-pay';
    if (!isPaymob) {
      paymobAutoTriggeredRef.current = null;
      return;
    }
    if (paymobAutoTriggeredRef.current === selectedPaymentMethod) return;
    if (showPaymobCheckout) return;
    paymobAutoTriggeredRef.current = selectedPaymentMethod;
    initiatePaymobDirect();
  }, [selectedPaymentMethod, showPaymobCheckout]);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      if (!response.ok) {
        const error = await response.json();
        const msg = error.details ? `${error.error}: ${error.details}` : (error.error || "فشل إنشاء الطلب");
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: async (data) => {
      if (usePointsAsDiscount) {
        try { await refetchLoyaltyCard(); } catch {}
      }
      // Gift card is now redeemed atomically inside POST /api/orders — no separate call needed
      const hasReservationItem = cartItems.some(ci => (ci.coffeeItem as any)?.isReservation);
      setWasReservationOrder(hasReservationItem);
      setOrderDetails(data);
      clearCart();
      customerStorage.clearActiveOffer();
      setShowSuccessPage(true);
      setPointsToRedeem(0);
      setAppliedGiftCard(null);
      setGiftCardCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty/cards/phone"] });
      refetchLoyaltyCard();
      const displayNum = data.orderNumber;
      // Save active order number so the menu can show a tracking banner
      if (displayNum) {
        localStorage.setItem("br-active-order", String(displayNum));
      }
      toast({ title: t("checkout.order_success"), description: `${t("tracking.order_number")}: ${displayNum}` });
    },
    onError: (error) => toast({ variant: "destructive", title: t("checkout.order_error"), description: error.message }),
  });

  const handleValidateDiscount = async (codeOverride?: string) => {
    const codeToUse = codeOverride || discountCode.trim();
    if (!codeToUse) return;
    
    setIsValidatingDiscount(true);
    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: codeToUse, 
          customerId: customer?.id,
          amount: getFinalTotal()
        }),
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setAppliedDiscount({ code: data.code, percentage: data.discountPercentage });
        setDiscountCode(data.code);
        toast({
          title: t("checkout.coupon_applied"),
          description: `${t("checkout.discount")}: ${data.discountPercentage}%`,
        });
      } else {
        setAppliedDiscount(null);
        toast({ 
          variant: "destructive", 
          title: t("checkout.invalid_discount"),
          description: data.error || data.message
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t("checkout.error") });
    } finally { setIsValidatingDiscount(false); }
  };

  const handleProceedPayment = () => {
    const isFreeOrder = getFinalAmount() <= 0;

    if (isFreeOrder) {
      if (!selectedPaymentMethod) {
        setSelectedPaymentMethod('cash');
      }
      if (!customerName.trim()) {
        toast({ variant: "destructive", title: t("checkout.enter_customer_name") });
        return;
      }
      setShowConfirmation(true);
      return;
    }

    if (!selectedPaymentMethod) {
      toast({ variant: "destructive", title: t("checkout.select_payment") });
      return;
    }
    if (selectedPaymentMethod === 'cash' && cashDistanceError) {
      toast({ variant: "destructive", title: 'الدفع نقداً غير متاح', description: cashDistanceError });
      return;
    }
    if (selectedPaymentMethod === 'cash' && cashDistanceChecking) {
      toast({ variant: "destructive", title: 'جاري التحقق من موقعك...', description: 'الرجاء الانتظار' });
      return;
    }
    const selectedMethodInfo = paymentMethods.find(m => m.id === selectedPaymentMethod);
    if (selectedMethodInfo?.requiresReceipt && !receiptFile) {
      toast({ variant: "destructive", title: tc("يرجى رفع إيصال التحويل", "Please upload the payment receipt") });
      return;
    }
    if (!customerName.trim()) {
      toast({ variant: "destructive", title: t("checkout.enter_customer_name") });
      return;
    }
    if (isPaymobMethod(selectedPaymentMethod)) {
      initiatePaymobDirect();
      return;
    }
    if (isCardPaymentMethod(selectedPaymentMethod) || isOnlinePaymentMethod(selectedPaymentMethod)) {
      confirmAndCreateOrder();
      return;
    }
    setShowConfirmation(true);
  };

  const isCardPaymentMethod = (method: string | null) => {
    if (!method) return false;
    // paymob-card is handled separately with real PayMob flow
    const cardMethods = ['geidea', 'bank_card', 'credit_card', 'card', 'stc-pay', 'apple_pay', 'neoleap-apple-pay'];
    return cardMethods.includes(method);
  };

  const isPaymobMethod = (method: string | null) => {
    if (!method) return false;
    return ['paymob-card', 'paymob-wallet', 'paymob-apple-pay', 'neoleap'].includes(method);
  };

  const isOnlinePaymentMethod = (_method: string | null) => false;

  const buildOrderData = async (): Promise<{ orderData: any; activeCustomerId: string | undefined }> => {
    let activeCustomerId = customer?.id;
    if (!activeCustomerId && wantToRegister) {
      setIsRegistering(true);
      const regRes = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerName, phone: customerPhone, email: customerEmail, password: customerPassword })
      });
      if (regRes.ok) {
        const newC = await regRes.json();
        activeCustomerId = newC.id;
        setCustomer(newC);
      }
      setIsRegistering(false);
    }

    const finalTotal = getFinalAmount();
    const orderData: any = {
      customerId: activeCustomerId,
      customerName,
      customerPhone,
      customerEmail,
      items: cartItems.map(i => {
        const inlineAddons = (i as any).selectedItemAddons || [];
        const sel = (i as any).selectedSize || (i as any).customization?.selectedSize;
        const selAddons = (i as any).selectedAddons || [];
        const customization: any = {};
        if (inlineAddons.length > 0) customization.selectedItemAddons = inlineAddons;
        if (selAddons.length > 0) customization.selectedAddons = selAddons;
        if (sel) customization.selectedSize = sel;
        if ((i as any).notes) customization.notes = (i as any).notes;
        return {
          coffeeItemId: i.coffeeItemId,
          quantity: i.quantity,
          price: getCartItemUnitPrice(i),
          nameAr: i.coffeeItem?.nameAr || "",
          nameEn: i.coffeeItem?.nameEn || "",
          selectedSize: sel,
          selectedAddons: selAddons,
          selectedItemAddons: inlineAddons,
          customization: Object.keys(customization).length > 0 ? customization : undefined,
        };
      }),
      totalAmount: finalTotal,
      paymentMethod: selectedPaymentMethod as PaymentMethod,
      status: "pending",
      branchId: deliveryInfo?.branchId || "default",
      orderType: (deliveryInfo?.type === 'dine-in' || deliveryInfo?.dineIn) ? 'dine-in'
              : deliveryInfo?.type === 'car-pickup' ? 'car_pickup'
              : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup'
              : deliveryInfo?.type === 'delivery' ? 'delivery'
              : 'regular',
      deliveryType: (deliveryInfo?.type === 'dine-in' || deliveryInfo?.dineIn) ? 'dine-in'
               : deliveryInfo?.type === 'car-pickup' ? 'car_pickup'
               : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup'
               : deliveryInfo?.type || 'pickup',
      customerNotes,
      discountCode: appliedDiscount?.code,
      pointsRedeemed: usePointsAsDiscount ? effectivePointsUsed : 0,
      pointsValue: usePointsAsDiscount ? effectivePointsDiscountSAR : 0,
      bypassPointsVerification: true,
      ...(appliedGiftCard && giftCardDiscount > 0 ? { giftCardCode: appliedGiftCard.code, giftCardAmount: giftCardDiscount } : {}),
      ...(deliveryInfo?.type === 'car-pickup' && deliveryInfo?.carInfo ? {
        carType: deliveryInfo.carInfo.carType,
        carColor: deliveryInfo.carInfo.carColor,
        plateNumber: deliveryInfo.carInfo.plateNumber,
      } : {}),
      ...(deliveryInfo?.scheduledPickupTime ? {
        scheduledPickupTime: deliveryInfo.scheduledPickupTime,
        arrivalTime: deliveryInfo.scheduledPickupTime,
      } : {}),
      ...(deliveryInfo?.type === 'delivery' && deliveryInfo?.deliveryAddress ? {
        deliveryAddress: { fullAddress: deliveryInfo.deliveryAddress, lat: 0, lng: 0, zone: 'general' },
      } : {}),
      ...(deliveryInfo?.productReservationDate ? {
        isProductReservation: true,
        productReservationDate: deliveryInfo.productReservationDate,
        productReservationFromTime: deliveryInfo.productReservationFromTime,
        productReservationToTime: deliveryInfo.productReservationToTime,
        productReservationStatus: 'pending_payment',
      } : {}),
      channel: "online",
    };

    if (receiptFile) {
      const uploadedUrl = await uploadReceiptToServer(receiptFile);
      orderData.paymentReceiptUrl = uploadedUrl || receiptPreview || undefined;
    }

    return { orderData, activeCustomerId };
  };

  const initiatePaymobDirect = async () => {
    try {
      const { orderData } = await buildOrderData();

      const tempOrderRef = `PAY-${Date.now()}`;
      // returnUrl: PayMob will append ?success=...&id=...&pending=... to this
      const returnUrl = `${window.location.origin}/checkout?provider=paymob`;

      const payRes = await apiRequest("POST", "/api/payments/init", {
        orderId: tempOrderRef,
        amount: orderData.totalAmount,
        currency: "SAR",
        paymentMethod: selectedPaymentMethod,
        customerName,
        customerPhone,
        customerEmail,
        returnUrl,
      });
      const payData = await payRes.json();

      if (payData.success && payData.redirectUrl) {
        // Save order data BEFORE leaving the page (works for both redirect & iframe)
        sessionStorage.setItem('pendingOrderData', JSON.stringify(orderData));
        sessionStorage.setItem('paymentSessionId', payData.sessionId || tempOrderRef);
        sessionStorage.setItem('paymentProvider', 'paymob');

        // Mobile: redirect directly (popups are blocked, iframes unreliable on iOS/Android)
        // Desktop: show inline iframe widget
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          || window.innerWidth < 768;

        if (isMobile) {
          window.location.href = payData.redirectUrl;
        } else {
          pendingGeideaOrderData.current = orderData;
          setPaymobCheckoutUrl(payData.redirectUrl);
          setShowPaymobCheckout(true);
        }
      } else {
        toast({ variant: "destructive", title: "خطأ في بوابة الدفع", description: payData.error || payData.details || "فشل تهيئة بوابة الدفع" });
      }
    } catch (err: any) {
      sessionStorage.removeItem('pendingOrderData');
      sessionStorage.removeItem('paymentSessionId');
      sessionStorage.removeItem('paymentProvider');
      toast({ variant: "destructive", title: "خطأ", description: err.message || "حدث خطأ أثناء تهيئة الدفع" });
    }
  };

  const confirmAndCreateOrder = async () => {
    let finalTotal = getFinalAmount();

    if (selectedPaymentMethod === ('wallet' as any) && (customer?.walletBalance || 0) < finalTotal) {
      toast({ variant: "destructive", title: t("points.insufficient_wallet") });
      return;
    }

    let activeCustomerId = customer?.id;
    if (!activeCustomerId && wantToRegister) {
      setIsRegistering(true);
      const regRes = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerName, phone: customerPhone, email: customerEmail, password: customerPassword })
      });
      if (regRes.ok) {
        const newC = await regRes.json();
        activeCustomerId = newC.id;
        setCustomer(newC);
      }
      setIsRegistering(false);
    }

    const orderData = {
      customerId: activeCustomerId,
      customerName: customerName,
      customerPhone: customerPhone,
      customerEmail: customerEmail,
      items: cartItems.map(i => {
        const inlineAddons = (i as any).selectedItemAddons || [];
        const sel = (i as any).selectedSize || (i as any).customization?.selectedSize;
        const selAddons = (i as any).selectedAddons || [];
        const customization: any = {};
        if (inlineAddons.length > 0) customization.selectedItemAddons = inlineAddons;
        if (selAddons.length > 0) customization.selectedAddons = selAddons;
        if (sel) customization.selectedSize = sel;
        if ((i as any).notes) customization.notes = (i as any).notes;
        return {
          coffeeItemId: i.coffeeItemId,
          quantity: i.quantity,
          price: getCartItemUnitPrice(i),
          nameAr: i.coffeeItem?.nameAr || "",
          nameEn: i.coffeeItem?.nameEn || "",
          selectedSize: sel,
          selectedAddons: selAddons,
          selectedItemAddons: inlineAddons,
          customization: Object.keys(customization).length > 0 ? customization : undefined,
        };
      }),
      totalAmount: finalTotal,
      paymentMethod: selectedPaymentMethod as PaymentMethod,
      status: "pending",
      branchId: deliveryInfo?.branchId || "default",
      orderType: (deliveryInfo?.type === 'dine-in' || deliveryInfo?.dineIn) ? 'dine-in'
              : deliveryInfo?.type === 'car-pickup' ? 'car_pickup'
              : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup'
              : deliveryInfo?.type === 'delivery' ? 'delivery'
              : 'regular',
      deliveryType: (deliveryInfo?.type === 'dine-in' || deliveryInfo?.dineIn) ? 'dine-in'
               : deliveryInfo?.type === 'car-pickup' ? 'car_pickup'
               : deliveryInfo?.type === 'scheduled-pickup' ? 'pickup'
               : deliveryInfo?.type || 'pickup',
      customerNotes: customerNotes,
      discountCode: appliedDiscount?.code,
      pointsRedeemed: usePointsAsDiscount ? effectivePointsUsed : 0,
      pointsValue: usePointsAsDiscount ? effectivePointsDiscountSAR : 0,
      bypassPointsVerification: true,
      // Gift card — server will validate + deduct atomically
      ...(appliedGiftCard && giftCardDiscount > 0 ? {
        giftCardCode: appliedGiftCard.code,
        giftCardAmount: giftCardDiscount,
      } : {}),
      ...(deliveryInfo?.type === 'car-pickup' && deliveryInfo?.carInfo ? {
        carType: deliveryInfo.carInfo.carType,
        carColor: deliveryInfo.carInfo.carColor,
        plateNumber: deliveryInfo.carInfo.plateNumber,
      } : {}),
      ...(deliveryInfo?.scheduledPickupTime ? {
        scheduledPickupTime: deliveryInfo.scheduledPickupTime,
        arrivalTime: deliveryInfo.scheduledPickupTime,
      } : {}),
      ...(deliveryInfo?.type === 'delivery' && deliveryInfo?.deliveryAddress ? {
        deliveryAddress: { fullAddress: deliveryInfo.deliveryAddress, lat: 0, lng: 0, zone: 'general' },
      } : {}),
      ...(deliveryInfo?.productReservationDate ? {
        isProductReservation: true,
        productReservationDate: deliveryInfo.productReservationDate,
        productReservationFromTime: deliveryInfo.productReservationFromTime,
        productReservationToTime: deliveryInfo.productReservationToTime,
        productReservationStatus: 'pending_payment',
      } : {}),
      channel: "online",
    };

    if (receiptFile) {
      const uploadedUrl = await uploadReceiptToServer(receiptFile);
      if (uploadedUrl) {
        (orderData as any).paymentReceiptUrl = uploadedUrl;
      } else {
        (orderData as any).paymentReceiptUrl = receiptPreview || undefined;
      }
    }

    if (isCardPaymentMethod(selectedPaymentMethod)) {
      pendingGeideaOrderData.current = orderData;
      geideaOrderNum.current = `CLN-${Date.now()}`;
      setShowConfirmation(false);
      setShowSimulatedCard(true);
      return;
    }

    if (isOnlinePaymentMethod(selectedPaymentMethod)) {
      pendingGeideaOrderData.current = orderData;
      geideaOrderNum.current = `CLN-${Date.now()}`;
      setShowConfirmation(false);
      setShowInlineGeidea(true);
      return;
    }

    createOrderMutation.mutate(orderData);
  };

  if (isVerifyingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gray-950" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-sm w-full bg-white rounded-3xl p-10 shadow-2xl text-center space-y-6">
          <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
          <h2 className="text-2xl font-bold">{t("checkout.verifying_payment")}</h2>
          <p className="text-muted-foreground text-sm">{t("checkout.verifying_payment_desc")}</p>
        </div>
      </div>
    );
  }

  if (showSuccessPage) {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const notifPermission = 'Notification' in window ? Notification.permission : 'denied';
    const successCustomerId = customer?.id || (customer as any)?._id;
    const orderNum = orderDetails?.orderNumber || orderDetails?.dailyNumber || "—";
    const orderItems = orderDetails?.items || cartItems;
    const orderTotal = orderDetails?.totalAmount ?? getFinalAmount();

    const handlePrintInvoice = async () => {
      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const mappedItems = orderItems.map((i: any) => ({
          coffeeItem: {
            nameAr: i.nameAr || i.coffeeItem?.nameAr || "منتج",
            nameEn: i.nameEn || i.coffeeItem?.nameEn || "",
            price: String(i.price ?? i.coffeeItem?.price ?? 0),
          },
          quantity: i.quantity,
          customization: i.customization,
        }));
        await printTaxInvoice({
          orderNumber: orderNum,
          items: mappedItems,
          subtotal: orderTotal.toFixed(2),
          total: orderTotal.toFixed(2),
          customerName: customerName || orderDetails?.customerName || "عميل",
          customerPhone: customerPhone || orderDetails?.customerPhone || "",
          paymentMethod: selectedPaymentMethod || orderDetails?.paymentMethod || "نقدي",
          employeeName: "طلب إلكتروني",
          date: orderDetails?.createdAt || new Date().toISOString(),
          orderType: (orderDetails?.orderType === 'dine-in' ? 'dine_in' : orderDetails?.orderType === 'delivery' ? 'delivery' : 'takeaway') as any,
        }, { autoPrint: true });
      } catch (e) { console.error("Print error:", e); }
    };

    const handleNavigateToBranch = () => {
      window.open(brand.locationUrl, "_blank");
    };

    const handleWhatsAppReservation = () => {
      const rawPhone = businessConfig?.contactPhone || businessConfig?.socialLinks?.whatsapp?.replace(/\D/g, '') || '';
      const phone = rawPhone.replace(/\D/g, '').replace(/^0/, '966');
      const reservationItems = orderDetails?.items || [];
      const itemsText = reservationItems.map((i: any) => {
        const pkg = i.customization?.selectedReservationPackage;
        return `• ${i.nameAr || i.coffeeItem?.nameAr || 'منتج'} x${i.quantity}${pkg ? ` (${pkg.packageName})` : ''}`;
      }).join('\n');
      const resDate = orderDetails?.productReservationDate
        ? new Date(orderDetails.productReservationDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : '';
      const resTime = (orderDetails?.productReservationFromTime && orderDetails?.productReservationToTime)
        ? `من ${orderDetails.productReservationFromTime} إلى ${orderDetails.productReservationToTime}`
        : '';
      const resLine = resDate ? `\n📅 موعد الحجز: ${resDate}\n⏰ الوقت: ${resTime}` : '';
      const msg = encodeURIComponent(
        `🗓️ طلب تأكيد حجز\n\nرقم الطلب: ${orderNum}\n\n${itemsText}${resLine}\n\nالإجمالي: ${orderTotal.toFixed(2)} ر.س\n\nالاسم: ${customerName || orderDetails?.customerName || '—'}\nالجوال: ${customerPhone || orderDetails?.customerPhone || '—'}\n\nأرجو التأكيد على هذا الحجز`
      );
      window.open(`https://wa.me/${phone || brand.phoneWhatsapp}?text=${msg}`, '_blank');
    };

    return (
      <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full space-y-4">

          {/* Header card */}
          <div className="bg-white dark:bg-card rounded-3xl shadow-2xl overflow-hidden">
            {/* Green top band */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-white text-center space-y-2">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-white/30">
                <CheckCircle className="w-11 h-11 text-white" />
              </div>
              <h2 className="text-2xl font-black mt-3">تم استلام طلبك!</h2>
              <p className="text-green-100 text-sm">سيبدأ الفريق بتحضيره فوراً</p>
            </div>

            {/* Order number */}
            <div className="p-6 text-center border-b border-dashed">
              <p className="text-xs text-muted-foreground mb-1">رقم طلبك</p>
              <p className="text-5xl font-black text-primary tracking-wider" data-testid="text-order-number">{orderNum}</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 divide-x divide-x-reverse border-b">
              <button
                onClick={() => setLocation("/tracking")}
                className="flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-muted/50 transition-colors"
                data-testid="button-track-order"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-[11px] font-semibold text-center">تتبع الطلب</span>
              </button>
              <button
                onClick={handlePrintInvoice}
                className="flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-muted/50 transition-colors"
                data-testid="button-print-invoice"
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <Printer className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-[11px] font-semibold text-center">طباعة الفاتورة</span>
              </button>
              <button
                onClick={handleNavigateToBranch}
                className="flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-muted/50 transition-colors"
                data-testid="button-navigate-branch"
              >
                <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-[11px] font-semibold text-center">التوجه للفرع</span>
              </button>
            </div>

            {/* Order items summary */}
            <div className="p-4 space-y-2">
              {orderItems.slice(0, 4).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{item.quantity}</span>
                    <span className="text-foreground">{isAr ? (item.nameAr || item.coffeeItem?.nameAr) : (item.nameEn || item.coffeeItem?.nameEn)}</span>
                  </span>
                  <span className="font-semibold text-muted-foreground">{((item.price ?? item.coffeeItem?.price ?? 0) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {orderItems.length > 4 && (
                <p className="text-xs text-muted-foreground text-center">+{orderItems.length - 4} منتجات أخرى</p>
              )}
              <div className="pt-2 border-t flex items-center justify-between font-bold text-base">
                <span>الإجمالي</span>
                <span className="text-primary">{orderTotal.toFixed(2)} <SarIcon /></span>
              </div>
            </div>
          </div>

          {/* Contact Card */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="flex items-center divide-x divide-x-reverse divide-border">
              <a
                href={`tel:${brand.phoneIntl}`}
                className="flex-1 flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-muted/50 transition-colors"
                data-testid="link-call-cafe"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.45 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.06-1.06a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/></svg>
                </div>
                <span className="text-[11px] font-semibold text-center">اتصل بنا</span>
                <span className="text-[10px] text-muted-foreground" dir="ltr">{brand.phoneDisplay}</span>
              </a>
              <a
                href={brand.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-muted/50 transition-colors"
                data-testid="link-maps-cafe"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <span className="text-[11px] font-semibold text-center">موقعنا</span>
                <span className="text-[10px] text-muted-foreground text-center">عرض على الخريطة</span>
              </a>
            </div>
          </div>

          {/* Reservation confirmation banner */}
          {wasReservationOrder && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-600 rounded-3xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 flex items-center gap-2">
                <span className="text-xl">🗓️</span>
                <p className="font-black text-white text-base">طلب حجز مسبق</p>
              </div>
              <div className="p-5 space-y-4">
                {orderDetails?.productReservationDate && (
                  <div className="bg-amber-100 dark:bg-amber-900/40 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200">📅 موعد حجزك</p>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      {new Date(orderDetails.productReservationDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    {orderDetails.productReservationFromTime && (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        ⏰ من {orderDetails.productReservationFromTime} إلى {orderDetails.productReservationToTime}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  لإتمام حجزك يرجى اتخاذ الخطوتين التاليتين:
                </p>
                <div className="space-y-3">
                  <button
                    onClick={async () => { await handlePrintInvoice(); }}
                    className="w-full flex items-center justify-center gap-3 bg-white dark:bg-card border-2 border-amber-300 dark:border-amber-600 rounded-xl py-3 px-4 font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    data-testid="button-download-reservation-invoice"
                  >
                    <Printer className="w-5 h-5" />
                    <span>١. تحميل الفاتورة</span>
                  </button>
                  <button
                    onClick={handleWhatsAppReservation}
                    className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 px-4 font-bold transition-colors shadow"
                    data-testid="button-whatsapp-reservation"
                  >
                    <span className="text-xl">💬</span>
                    <span>٢. تأكيد الحجز عبر واتساب</span>
                  </button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">سيتواصل معك فريقنا لتأكيد الحجز وتفاصيله</p>
              </div>
            </div>
          )}

          {/* Push notification */}
          {!pushSubscribed && notifPermission !== 'granted' && notifPermission !== 'denied' && (
            pushSupported ? (
              isIOS && !isStandalone ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3 items-start">
                  <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-300 text-sm">فعّل إشعارات حالة طلبك</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">أضف التطبيق لشاشتك الرئيسية عبر زر المشاركة في Safari ثم افتحه منها</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const urlB64 = (b64: string) => {
                        const pad = '='.repeat((4 - b64.length % 4) % 4);
                        const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
                        const raw = window.atob(base);
                        const out = new Uint8Array(raw.length);
                        for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
                        return out;
                      };
                      const reg = await navigator.serviceWorker.ready;
                      const perm = await Notification.requestPermission();
                      if (perm !== 'granted') return;
                      const r = await fetch('/api/push/vapid-key');
                      const { publicKey } = await r.json();
                      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(publicKey) });
                      // Use customerId if available, fallback to phone number for guests
                      const pushUserId = successCustomerId || customerPhone || 'guest';
                      await fetch('/api/push/subscribe', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscription: sub.toJSON(), userType: 'customer', userId: pushUserId }),
                      });
                      setPushSubscribed(true);
                      toast({ title: "✅ تم تفعيل الإشعارات", description: "سنخبرك فوراً عند تحديث حالة طلبك" });
                    } catch (e) {
                      console.error('[PUSH]', e);
                      toast({ variant: "destructive", title: "تعذّر تفعيل الإشعارات", description: "يرجى التأكد من أذونات المتصفح" });
                    }
                  }}
                  className="w-full flex items-center gap-3 bg-white dark:bg-card border rounded-2xl p-4 hover:bg-muted/50 active:scale-[0.98] transition-all text-right"
                  data-testid="button-enable-push-success"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">تفعيل إشعارات الطلب</p>
                    <p className="text-xs text-muted-foreground">اعرف فوراً عندما يصبح طلبك جاهزاً</p>
                  </div>
                </button>
              )
            ) : null
          )}
          {pushSubscribed && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">✅ الإشعارات مفعّلة — سنبلغك فور تحديث طلبك</p>
            </div>
          )}

          {/* Guest register prompt */}
          {isGuestMode && (
            <div className="bg-white dark:bg-card border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-sm">احصل على نقاط مكافآت</p>
                <p className="text-xs text-muted-foreground">سجّل بنفس رقم جوالك لربط طلباتك</p>
              </div>
              <Button size="sm" onClick={() => { setAuthMode('register'); setAuthPanelOpen(true); }} data-testid="button-register-after-order" className="flex-shrink-0">
                سجّل
              </Button>
            </div>
          )}

          {/* Back to menu */}
          <Button onClick={() => setLocation("/menu")} className="w-full h-12" variant="outline" data-testid="button-back-to-menu">
            العودة للقائمة
          </Button>

        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen py-12 bg-gray-950" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white text-center mb-8">{t("nav.checkout")}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader><CardTitle>{t("checkout.order_summary")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center gap-2 text-sm" data-testid={`cart-item-${index}`}>
                    <span>{isAr ? item.coffeeItem?.nameAr : item.coffeeItem?.nameEn} × {item.quantity}</span>
                    <span className="font-bold">{((item.coffeeItem?.price || 0) * item.quantity).toFixed(2)} <SarIcon /></span>
                  </div>
                ))}
                {appliedDiscount && (
                  <div className="flex justify-between items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded">
                    <span>{t("points.discount")} ({appliedDiscount.percentage}%)</span>
                    <span>-{(getFinalTotal() * appliedDiscount.percentage / 100).toFixed(2)} <SarIcon /></span>
                  </div>
                )}
                {usePointsAsDiscount && pointsDiscountSAR > 0 && (
                  <div className="flex justify-between items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 rounded">
                    <span className="flex items-center gap-1.5">خصم النقاط ({pointsToRedeem.toLocaleString()} نقطة)</span>
                    <span className="font-bold">-{effectivePointsDiscountSAR.toFixed(2)} <SarIcon /></span>
                  </div>
                )}
                {appliedGiftCard && giftCardDiscount > 0 && (
                  <div className="flex justify-between items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 p-2 rounded">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      بطاقة هدية ({appliedGiftCard.code})
                    </span>
                    <span className="font-bold">-{giftCardDiscount.toFixed(2)} <SarIcon /></span>
                  </div>
                )}
                {orderDeliveryFee > 0 && (
                  <div className="flex justify-between items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2 rounded">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      رسوم التوصيل
                    </span>
                    <span className="font-bold">+{orderDeliveryFee.toFixed(2)} <SarIcon /></span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between items-center gap-2 text-sm border rounded-lg p-2.5"
                    style={{
                      background: usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)'
                        : 'linear-gradient(135deg, rgba(200,165,58,0.15) 0%, rgba(200,165,58,0.05) 100%)',
                      borderColor: usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints
                        ? 'rgba(34,197,94,0.4)'
                        : 'rgba(200,165,58,0.4)'
                    }}>
                    <span className="flex items-center gap-2 font-semibold"
                      style={{ color: usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints ? '#16a34a' : '#C8A53A' }}>
                      <span className="text-base">⚙️</span>
                      رسوم الخدمة
                      {usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints && (
                        <span className="text-xs font-bold text-green-600">(مشمولة بالنقاط ✓)</span>
                      )}
                    </span>
                    <span className="font-black text-base"
                      style={{ color: usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints ? '#16a34a' : '#C8A53A' }}>
                      {usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints ? '0.00' : `+${serviceFee.toFixed(2)}`} <SarIcon />
                    </span>
                  </div>
                )}
                <div className="pt-4 border-t font-bold text-xl flex justify-between gap-2">
                  <span>{t("cart.total")}:</span>
                  <span className={getFinalAmount() === 0 ? 'text-green-600' : 'text-primary'}>
                    {getFinalAmount().toFixed(2)} <SarIcon />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {customer ? (
                  <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-accent" />
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone}</p>
                      </div>
                    </div>
                  </div>
                ) : isGuestMode ? (
                  <div className="space-y-3">
                    <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{customerName}</p>
                          <p className="text-sm text-muted-foreground">{customerPhone}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLocation("/customer-login")}
                        className="text-xs text-accent hover:underline"
                        data-testid="link-change-guest"
                      >
                        تغيير
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-xs text-amber-800 dark:text-amber-300">{tc("سجّل الآن واحصل على نقاط ولاء وتتبع طلباتك", "Register now to earn loyalty points and track your orders")}</p>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('register'); setAuthPanelOpen(v => !v); }}
                        className="text-xs font-bold text-accent hover:underline whitespace-nowrap mr-2"
                        data-testid="link-register-now"
                      >
                        {authPanelOpen ? tc("إخفاء", "Hide") : tc("تسجيل ←", "Register ←")}
                      </button>
                    </div>

                    {/* Inline auth panel — sign-in / register without leaving page */}
                    {authPanelOpen && (
                      <div className="border rounded-lg p-4 space-y-3 bg-card" data-testid="panel-inline-auth">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAuthMode('login')}
                            className={`flex-1 text-sm py-2 rounded-lg transition-colors ${authMode === 'login' ? 'bg-accent text-accent-foreground font-bold' : 'bg-muted text-muted-foreground'}`}
                            data-testid="tab-auth-login"
                          >
                            {tc("تسجيل الدخول", "Sign In")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthMode('register')}
                            className={`flex-1 text-sm py-2 rounded-lg transition-colors ${authMode === 'register' ? 'bg-accent text-accent-foreground font-bold' : 'bg-muted text-muted-foreground'}`}
                            data-testid="tab-auth-register"
                          >
                            {tc("حساب جديد", "New Account")}
                          </button>
                        </div>

                        {authMode === 'login' ? (
                          <div className="space-y-2">
                            <Input
                              value={authIdentifier}
                              onChange={e => setAuthIdentifier(e.target.value)}
                              placeholder={tc("رقم الجوال أو البريد", "Phone or email")}
                              data-testid="input-auth-identifier"
                            />
                            <Input
                              type="password"
                              value={authPassword}
                              onChange={e => setAuthPassword(e.target.value)}
                              placeholder={tc("كلمة المرور", "Password")}
                              onKeyDown={e => e.key === 'Enter' && handleInlineLogin()}
                              data-testid="input-auth-password"
                            />
                            <Button
                              onClick={handleInlineLogin}
                              disabled={authLoading}
                              className="w-full"
                              data-testid="button-inline-login"
                            >
                              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("دخول", "Sign In")}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {tc(`سيتم استخدام: ${customerName} / ${customerPhone}`, `Using: ${customerName} / ${customerPhone}`)}
                            </p>
                            <Input
                              type="password"
                              value={authPassword}
                              onChange={e => setAuthPassword(e.target.value)}
                              placeholder={tc("اختر كلمة مرور (4 أحرف+)", "Choose password (4+ chars)")}
                              onKeyDown={e => e.key === 'Enter' && handleInlineRegister()}
                              data-testid="input-auth-new-password"
                            />
                            <Button
                              onClick={handleInlineRegister}
                              disabled={authLoading}
                              className="w-full"
                              data-testid="button-inline-register"
                            >
                              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("إنشاء حساب", "Create Account")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t("checkout.full_name")} data-testid="input-customer-name" />
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder={t("checkout.phone")} data-testid="input-customer-phone" />
                    <div className="flex items-center gap-2">
                      <Checkbox id="register" checked={wantToRegister} onCheckedChange={checked => setWantToRegister(!!checked)} data-testid="checkbox-register" />
                      <Label htmlFor="register">{t("checkout.want_to_register")}</Label>
                    </div>
                  </div>
                )}

                <PaymentMethods
                  paymentMethods={paymentMethods.filter(m => m.id !== 'qahwa-card')}
                  selectedMethod={selectedPaymentMethod}
                  onSelectMethod={setSelectedPaymentMethod}
                  comingSoon={false}
                />

                {/* Receipt Upload for bank transfer methods */}
                {selectedPaymentMethod && paymentMethods.find(m => m.id === selectedPaymentMethod)?.requiresReceipt && (
                  <div className="border border-border rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 space-y-3" data-testid="section-receipt-upload">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                        <Upload className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-300">{tc("ارفع إيصال التحويل", "Upload Transfer Receipt")}</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">{tc("مطلوب لتأكيد الدفع", "Required to confirm payment")}</p>
                      </div>
                    </div>
                    <input
                      ref={receiptInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReceiptFileChange}
                      data-testid="input-receipt-file"
                    />
                    {receiptPreview ? (
                      <div className="space-y-2">
                        <img src={receiptPreview} alt="إيصال التحويل" className="w-full max-h-48 object-contain rounded-lg border border-border bg-white" />
                        <button
                          type="button"
                          onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (receiptInputRef.current) receiptInputRef.current.value = ''; }}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          data-testid="button-remove-receipt"
                        >
                          <X className="w-3 h-3" />
                          {tc("إزالة الإيصال", "Remove receipt")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => receiptInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-2 py-5 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                        data-testid="button-upload-receipt"
                      >
                        <Camera className="w-8 h-8 text-amber-400" />
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{tc("انقر لرفع صورة الإيصال", "Tap to upload receipt image")}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-500">{tc("JPG, PNG مقبولة", "JPG, PNG accepted")}</span>
                      </button>
                    )}
                  </div>
                )}

                {selectedPaymentMethod === 'cash' && cashDistanceChecking && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-sm" data-testid="status-cash-distance-checking">
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    <span>{tc("جاري التحقق من موقعك للدفع نقداً...", "Checking your location for cash payment...")}</span>
                  </div>
                )}

                {selectedPaymentMethod === 'cash' && !cashDistanceChecking && cashDistanceError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm" data-testid="status-cash-distance-error">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <span>{cashDistanceError}</span>
                  </div>
                )}

                {appliedDiscount?.isOffer && (
                  <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-300">{appliedDiscount.code}</p>
                          <p className="text-sm text-green-600">{t("points.discount")} {appliedDiscount.percentage}% {t("points.applied")}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setAppliedDiscount(null);
                          customerStorage.clearActiveOffer();
                        }}
                        className="text-red-500"
                        data-testid="button-remove-offer"
                      >
                        {t("points.remove")}
                      </Button>
                    </div>
                  </div>
                )}

                <ErrorBoundary fallback={
                  <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-orange-400" />
                      <Label className="font-semibold text-muted-foreground">{t("checkout.have_discount")}</Label>
                    </div>
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                      <Wrench className="w-3 h-3" />
                      قيد التطوير
                    </Badge>
                  </div>
                }>
                <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/30 space-y-4">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-orange-600" />
                    <Label className="font-semibold">{t("checkout.have_discount")}</Label>
                  </div>

                  {/* Coupon code input — disabled when using points */}
                  {!usePointsAsDiscount && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={discountCode}
                          onChange={e => setDiscountCode(e.target.value)}
                          placeholder={t("checkout.enter_discount")}
                          disabled={!!appliedDiscount}
                          className="bg-white dark:bg-background"
                          data-testid="input-discount-code"
                        />
                        <Button
                          onClick={() => handleValidateDiscount()}
                          disabled={!!appliedDiscount || isValidatingDiscount}
                          data-testid="button-apply-discount"
                        >
                          {isValidatingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : t("checkout.apply")}
                        </Button>
                      </div>
                      {appliedDiscount && !appliedDiscount.isOffer && (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-green-600">{t("points.applied")}: {appliedDiscount.code} ({appliedDiscount.percentage}%)</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-red-500 hover:text-red-700 p-0"
                            onClick={() => { setAppliedDiscount(null); setDiscountCode(""); }}
                          >
                            {t("common.remove") || "إزالة"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </ErrorBoundary>

                {/* Gift Card Section */}
                <div className="border rounded-lg p-4 bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <Label className="font-semibold">{tc("بطاقة الهدية", "Gift Card")}</Label>
                  </div>
                  {appliedGiftCard ? (
                    <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-primary">{appliedGiftCard.code}</p>
                        <p className="text-xs text-muted-foreground">خصم {appliedGiftCard.applied.toFixed(2)} ريال من رصيد {appliedGiftCard.balance.toFixed(2)} ريال</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-red-500 hover:text-red-700 p-0"
                        onClick={() => { setAppliedGiftCard(null); setGiftCardCode(""); }}
                        data-testid="button-remove-gift-card"
                      >
                        إزالة
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder={tc("أدخل رمز بطاقة الهدية", "Enter gift card code")}
                        value={giftCardCode}
                        onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && handleCheckGiftCard()}
                        className="font-mono uppercase tracking-widest"
                        data-testid="input-gift-card-code"
                      />
                      <Button
                        onClick={() => handleCheckGiftCard()}
                        disabled={!giftCardCode.trim() || isCheckingGiftCard}
                        data-testid="button-apply-gift-card"
                        className="shrink-0"
                      >
                        {isCheckingGiftCard ? tc("جاري التحقق...", "Checking...") : tc("تطبيق", "Apply")}
                      </Button>
                    </div>
                  )}
                </div>

                {customer && loyaltyCard && (
                  <LoyaltyCheckoutCard
                    loyaltyCard={loyaltyCard}
                    loyaltyPoints={loyaltyPoints}
                    pointsPerSar={pointsPerSar}
                    minPointsForRedemption={minPointsForRedemption}
                    pointsToRedeem={pointsToRedeem}
                    onApplyPoints={(pts) => {
                      setPointsToRedeem(pts);
                      setAppliedDiscount(null);
                      setDiscountCode("");
                    }}
                    onCancelPoints={() => setPointsToRedeem(0)}
                    baseTotal={totalCoverableByPoints}
                    pointsNeededForFree={pointsNeededForFree}
                  />
                )}

                {/* Real PayMob checkout bottom sheet */}
                {showPaymobCheckout && paymobCheckoutUrl && (
                  <PaymobCheckoutWidget
                    orderNumber="—"
                    amount={pendingGeideaOrderData.current?.totalAmount || getFinalTotalWithPoints()}
                    checkoutUrl={paymobCheckoutUrl}
                    onSuccess={() => {
                      setShowPaymobCheckout(false);
                      const od = pendingGeideaOrderData.current;
                      if (od) {
                        createOrderMutation.mutate({
                          ...od,
                          paymentStatus: 'paid',
                          status: 'payment_confirmed',
                          paymentReference: `PAYMOB-${Date.now()}`,
                        });
                      } else {
                        clearCart();
                        setShowSuccessPage(true);
                        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
                      }
                    }}
                    onError={(msg) => {
                      toast({ variant: "destructive", title: "فشلت عملية الدفع", description: msg });
                      setShowPaymobCheckout(false);
                    }}
                    onCancel={() => {
                      setShowPaymobCheckout(false);
                      toast({ title: "تم إلغاء الدفع", description: "لم يتم إنشاء أي طلب. يمكنك المحاولة مرة أخرى." });
                    }}
                  />
                )}

                {/* Simulated card payment widget (for non-PayMob legacy methods only) */}
                {showSimulatedCard && (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-md" data-testid="section-simulated-card">
                    <SimulatedCardPayment
                      amount={pendingGeideaOrderData.current?.totalAmount || getFinalTotalWithPoints()}
                      paymentMethod={selectedPaymentMethod || "card"}
                      onSuccess={() => {
                        const od = pendingGeideaOrderData.current;
                        if (od) {
                          const confirmedOrder = { ...od, status: 'payment_confirmed', paymentReference: `CARD-SIM-${Date.now()}` };
                          createOrderMutation.mutate(confirmedOrder);
                        } else {
                          confirmAndCreateOrder();
                        }
                        setShowSimulatedCard(false);
                      }}
                      onCancel={() => setShowSimulatedCard(false)}
                    />
                  </div>
                )}

                {/* Inline Geidea payment widget — same page, no separate screen */}
                {!showSimulatedCard && showInlineGeidea ? (
                  <div className="space-y-3" data-testid="section-geidea-inline">
                    <div className="bg-primary rounded-xl px-4 py-3 text-white text-center">
                      <p className="text-xs opacity-75">{tc("إجمالي الطلب", "Order Total")}</p>
                      <p className="text-2xl font-black" data-testid="text-geidea-amount">
                        {pendingGeideaOrderData.current?.totalAmount?.toFixed(2)} ريال
                      </p>
                      <p className="text-[10px] opacity-60 mt-0.5">🔒 دفع آمن مشفّر بواسطة Geidea</p>
                    </div>
                    <GeideaCheckoutWidget
                      orderNumber={geideaOrderNum.current}
                      amount={pendingGeideaOrderData.current?.totalAmount || 0}
                      customerPhone={pendingGeideaOrderData.current?.customerPhone}
                      customerEmail={pendingGeideaOrderData.current?.customerEmail}
                      onSuccess={() => {
                        const od = pendingGeideaOrderData.current;
                        const confirmedOrder = { ...od, status: 'payment_confirmed', paymentReference: geideaOrderNum.current };
                        createOrderMutation.mutate(confirmedOrder);
                        setShowInlineGeidea(false);
                      }}
                      onError={(msg) => {
                        toast({ variant: "destructive", title: t("checkout.payment_error"), description: msg });
                      }}
                      onCancel={() => {
                        setShowInlineGeidea(false);
                        toast({ title: "تم إلغاء الدفع", description: "يمكنك المحاولة مرة أخرى" });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground text-xs"
                      onClick={() => setShowInlineGeidea(false)}
                      data-testid="button-cancel-geidea"
                    >
                      ← العودة للطلب
                    </Button>
                  </div>
                ) : !showSimulatedCard && !showPaymobCheckout ? (
                  <Button
                    onClick={handleProceedPayment}
                    className="w-full h-14 text-lg"
                    data-testid="button-proceed-payment"
                    disabled={
                      (selectedPaymentMethod === 'cash' && !!cashDistanceError) ||
                      (selectedPaymentMethod === 'cash' && cashDistanceChecking)
                    }
                  >
                    {selectedPaymentMethod === 'cash' && cashDistanceChecking ? (
                      <><Loader2 className="w-5 h-5 animate-spin ml-2" />جاري التحقق من الموقع...</>
                    ) : isPaymobMethod(selectedPaymentMethod) ? (
                      <><CreditCard className="w-5 h-5 ml-2" />اذهب للدفع</>
                    ) : (isCardPaymentMethod(selectedPaymentMethod) || isOnlinePaymentMethod(selectedPaymentMethod)) ? (
                      <><CreditCard className="w-5 h-5 ml-2" />ادفع الآن</>
                    ) : t("checkout.confirm_order")}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t("checkout.confirm_title")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-2">
            <p className="text-lg">{t("checkout.confirm_question")}</p>
            {(usePointsAsDiscount && pointsDiscountSAR > 0) || (appliedGiftCard && giftCardDiscount > 0) || orderDeliveryFee > 0 || serviceFee > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">{(usePointsAsDiscount && pointsDiscountSAR > 0) || (appliedGiftCard && giftCardDiscount > 0) ? 'قبل الخصم' : 'إجمالي الطلب'}: {(getBaseTotal() + (serviceFee > 0 && !(usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints) ? serviceFee : 0)).toFixed(2)} <SarIcon /></p>
                {usePointsAsDiscount && pointsDiscountSAR > 0 && (
                  <p className="text-sm text-amber-600 font-semibold">
                    خصم النقاط ({effectivePointsUsed.toLocaleString()} نقطة): -{effectivePointsDiscountSAR.toFixed(2)} <SarIcon />
                    {effectivePointsDiscountSAR >= totalCoverableByPoints && <span className="text-green-600 font-bold mr-1">· شامل رسوم الخدمة</span>}
                  </p>
                )}
                {appliedGiftCard && giftCardDiscount > 0 && (
                  <p className="text-sm text-primary font-semibold">بطاقة هدية: -{giftCardDiscount.toFixed(2)} <SarIcon /></p>
                )}
                {orderDeliveryFee > 0 && (
                  <p className="text-sm text-green-600 font-semibold">رسوم التوصيل: +{orderDeliveryFee.toFixed(2)} <SarIcon /></p>
                )}
                {serviceFee > 0 && !(usePointsAsDiscount && effectivePointsDiscountSAR >= totalCoverableByPoints) && (
                  <p className="text-sm font-bold" style={{ color: '#C8A53A' }}>⚙️ رسوم الخدمة: +{serviceFee.toFixed(2)} <SarIcon /></p>
                )}
                <p className="text-3xl font-black text-primary">{getFinalAmount().toFixed(2)} <SarIcon /></p>
                {getFinalAmount() === 0 && <p className="text-sm text-green-600 font-bold">🎉 تغطية كاملة بالنقاط!</p>}
              </>
            ) : (
              <p className="text-2xl font-bold text-primary">{getFinalAmount().toFixed(2)} <SarIcon /></p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmation(false)} className="flex-1" data-testid="button-cancel-order">{t("points.cancel")}</Button>
            <Button onClick={confirmAndCreateOrder} className="flex-1 bg-green-600" data-testid="button-confirm-order">{t("checkout.confirm_pay")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
