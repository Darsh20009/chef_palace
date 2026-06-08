import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Eye, EyeOff, Shield, ArrowLeft, Lock } from "lucide-react";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
const stcLogoPath = "/images/stc-pay.png";
const visaMadaLogoPath = "/images/visa-mada.png";

type CardType = "mada" | "visa" | "mastercard" | "amex" | "unknown";
type PaymentStep = "form" | "processing" | "success";
type StcStep = "phone" | "otp" | "processing" | "success";

interface Props {
  amount: number;
  paymentMethod?: string;
  onSuccess: (txId?: string) => void;
  onCancel: () => void;
}

// ─── Card type detection ────────────────────────────────────────────────────
function detectCardType(num: string): CardType {
  const clean = num.replace(/\s/g, "");
  if (/^(4002|4007|4009|4030|4082|4083|4084|4085|4086|4087|4088|4089|4218|4264|4342|4400|4407|4408|4429|4434|4436|4439|4440|4443|4445|4449|4450|4451|4453|4455|4456|4458|4459|4462|4464|4467|4469|4472|4473|4475|4477|4479|4481|4482|4483|4485|4486|4487|4489|4491|4495|4497|4502|4562|4580|4652|4776|4777|4900|4901)/.test(clean)) return "mada";
  if (/^3[47]/.test(clean)) return "amex";
  if (/^5[1-5]|^2[2-7]/.test(clean)) return "mastercard";
  if (/^4/.test(clean)) return "visa";
  return "unknown";
}

function formatCardNumber(value: string, type: CardType): string {
  const clean = value.replace(/\D/g, "");
  if (type === "amex") {
    return [clean.slice(0, 4), clean.slice(4, 10), clean.slice(10, 15)].filter(Boolean).join(" ");
  }
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

const CARD_GRADIENTS: Record<CardType, string> = {
  mada: "from-[#006c35] via-[#008a45] to-[#004d26]",
  visa: "from-[#1A1F71] via-[#243299] to-[#0d1255]",
  mastercard: "from-[#1a1a1a] via-[#2a2a2a] to-[#0d0d0d]",
  amex: "from-[#2c6b5a] via-[#3d8a72] to-[#1a4d3f]",
  unknown: "from-[#1c2340] via-[#2a3460] to-[#0f1429]",
};

const CARD_TYPE_LABELS: Record<CardType, string> = {
  mada: "مدى", visa: "Visa", mastercard: "Mastercard", amex: "Amex", unknown: "",
};

// ─── 3D Card Visual ─────────────────────────────────────────────────────────
function CardVisual({ cardNumber, cardName, expiry, cvv, cardType, isFlipped }: {
  cardNumber: string; cardName: string; expiry: string; cvv: string;
  cardType: CardType; isFlipped: boolean;
}) {
  const grad = CARD_GRADIENTS[cardType];
  const displayNum = cardNumber || "•••• •••• •••• ••••";
  return (
    <div className="w-full" style={{ perspective: "1000px" }}>
      <div
        className="relative w-full h-44 transition-transform duration-700"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${grad} text-white p-5 shadow-2xl flex flex-col justify-between`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex justify-between items-start">
            <div className="w-10 h-7 bg-yellow-400/80 rounded-md" />
            {cardType !== "unknown" && (
              <span className="text-xs font-bold bg-white/20 rounded px-2 py-0.5">{CARD_TYPE_LABELS[cardType]}</span>
            )}
          </div>
          <div>
            <p className="font-mono tracking-widest text-lg font-bold" dir="ltr">{displayNum}</p>
            <div className="flex justify-between mt-2 text-xs">
              <span className="opacity-70">{cardName.trim() || "CARD HOLDER"}</span>
              <span className="opacity-70">{expiry || "MM/YY"}</span>
            </div>
          </div>
        </div>
        {/* Back */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${grad} text-white p-5 shadow-2xl flex flex-col justify-center gap-3`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="bg-black/40 h-8 w-full rounded" />
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs opacity-60">CVV</span>
            <div className="bg-white/90 text-black font-mono font-bold px-3 py-1 rounded text-sm tracking-widest">
              {cvv ? cvv.replace(/./g, "•") : "•••"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Payment ────────────────────────────────────────────────────────────
function CardPayment({ amount, onSuccess, onCancel }: { amount: number; onSuccess: (tx: string) => void; onCancel: () => void }) {
  const { toast } = useToast();
  const tc = useTranslate();
  const [step, setStep] = useState<PaymentStep>("form");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCvv, setShowCvv] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardType = detectCardType(cardNumber);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const maxLen = detectCardType(raw) === "amex" ? 15 : 16;
    setCardNumber(formatCardNumber(raw.slice(0, maxLen), detectCardType(raw)));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length <= 2) setExpiry(raw);
    else setExpiry(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`);
  };

  const handlePay = () => {
    const cleanNum = cardNumber.replace(/\s/g, "");
    const minLen = cardType === "amex" ? 15 : 16;
    if (cleanNum.length < minLen) { toast({ variant: "destructive", title: tc("رقم البطاقة غير مكتمل", "Incomplete card number") }); return; }
    if (!cardName.trim()) { toast({ variant: "destructive", title: tc("يرجى إدخال اسم حامل البطاقة", "Please enter cardholder name") }); return; }
    if (expiry.length < 5) { toast({ variant: "destructive", title: tc("تاريخ الانتهاء غير صحيح", "Invalid expiry date") }); return; }
    const cvvLen = cardType === "amex" ? 4 : 3;
    if (cvv.length < cvvLen) { toast({ variant: "destructive", title: tc(`رمز CVV يجب أن يكون ${cvvLen} أرقام`, `CVV must be ${cvvLen} digits`) }); return; }
    setStep("processing");
    setTimeout(() => { setStep("success"); setTimeout(() => onSuccess(`CARD-${Date.now()}`), 1200); }, 1800);
  };

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-bold text-foreground text-base">{tc("جاري معالجة الدفع...", "Processing payment...")}</p>
          <p className="text-sm text-muted-foreground mt-1">{tc("يُرجى الانتظار، لا تُغلق الصفحة", "Please wait, do not close the page")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          <Shield className="w-3.5 h-3.5 text-green-600" />
          {tc("دفع آمن ومشفّر", "Secure & encrypted payment")}
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-300">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <div className="text-center">
          <p className="font-bold text-green-700 text-lg">{tc("تمّت عملية الدفع بنجاح ✓", "Payment successful ✓")}</p>
          <p className="text-sm text-muted-foreground mt-1">{tc("جاري تأكيد طلبك...", "Confirming your order...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-foreground text-base">{tc("بطاقة بنكية", "Bank Card")}</h3>
        <img src={visaMadaLogoPath} alt="Visa Mada Mastercard" className="h-6 object-contain" />
      </div>
      <CardVisual cardNumber={cardNumber} cardName={cardName} expiry={expiry} cvv={cvv} cardType={cardType} isFlipped={isFlipped} />
      <div className="space-y-3 pt-1">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{tc("رقم البطاقة", "Card Number")}</Label>
          <div className="relative">
            <Input
              value={cardNumber}
              onChange={handleCardNumberChange}
              onFocus={() => setIsFlipped(false)}
              placeholder="0000 0000 0000 0000"
              dir="ltr"
              className="font-mono tracking-widest text-base pl-24"
              maxLength={cardType === "amex" ? 17 : 19}
              inputMode="numeric"
              data-testid="input-card-number"
            />
            {cardType !== "unknown" && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {CARD_TYPE_LABELS[cardType]}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{tc("اسم حامل البطاقة", "Cardholder Name")}</Label>
          <Input
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            onFocus={() => setIsFlipped(false)}
            placeholder="CARD HOLDER NAME"
            dir="ltr"
            className="font-mono tracking-wide uppercase"
            data-testid="input-card-name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tc("تاريخ الانتهاء", "Expiry Date")}</Label>
            <Input
              value={expiry}
              onChange={handleExpiryChange}
              onFocus={() => setIsFlipped(false)}
              placeholder="MM/YY"
              dir="ltr"
              className="font-mono tracking-widest"
              maxLength={5}
              inputMode="numeric"
              data-testid="input-expiry"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tc("رمز CVV", "CVV Code")}</Label>
            <div className="relative">
              <Input
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, cardType === "amex" ? 4 : 3))}
                onFocus={() => setIsFlipped(true)}
                onBlur={() => setIsFlipped(false)}
                placeholder={cardType === "amex" ? "0000" : "000"}
                type={showCvv ? "text" : "password"}
                dir="ltr"
                className="font-mono tracking-widest pl-10"
                maxLength={cardType === "amex" ? 4 : 3}
                inputMode="numeric"
                data-testid="input-cvv"
              />
              <button
                type="button"
                onClick={() => setShowCvv(!showCvv)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{tc("المبلغ المستحق", "Amount Due")}</span>
        <span className="text-lg font-black text-primary">{Number(amount).toFixed(2)} <SarIcon size={14} /></span>
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel} className="flex-shrink-0 rounded-xl border" data-testid="button-cancel-payment">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button onClick={handlePay} className="flex-1 h-12 text-base font-bold" data-testid="button-pay-now">
          <Lock className="w-4 h-4 ml-2" />
          {tc("ادفع الآن", "Pay Now")} — {Number(amount).toFixed(2)} <SarIcon size={14} className="inline-block align-middle" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Shield className="w-3 h-3 text-green-600" />
        {tc("بيئة محاكاة — أي بيانات بطاقة مقبولة", "Simulation — any card data accepted")}
      </p>
    </div>
  );
}

// ─── STC Pay ─────────────────────────────────────────────────────────────────
function StcPayment({ amount, onSuccess, onCancel }: { amount: number; onSuccess: (tx: string) => void; onCancel: () => void }) {
  const { toast } = useToast();
  const tc = useTranslate();
  const [step, setStcStep] = useState<StcStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [sessionToken, setSessionToken] = useState("demo-session");
  const [timeLeft, setTimeLeft] = useState(300);
  const [sending, setSending] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = () => {
    setTimeLeft(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; });
    }, 1000);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleSendOtp = async () => {
    if (!/^05\d{8}$/.test(phone)) {
      toast({ variant: "destructive", title: tc("رقم الجوال غير صحيح", "Invalid phone number"), description: tc("يجب أن يبدأ بـ 05 ويتكون من 10 أرقام", "Must start with 05 and be 10 digits") });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/pay/stc/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setSessionToken(data.sessionToken || "demo-session");
    } catch {
      setSessionToken("demo-session");
    } finally {
      setSending(false);
      setStcStep("otp");
      startTimer();
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 3) otpRefs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== "")) verifyOtp(newOtp.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const verifyOtp = async (code: string) => {
    setStcStep("processing");
    try {
      const res = await fetch("/api/pay/stc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, otp: code }),
      });
      const data = await res.json();
      if (data.success) {
        setStcStep("success");
        setTimeout(() => onSuccess(data.transactionId || `STC-${Date.now()}`), 1200);
      } else {
        toast({ variant: "destructive", title: tc("رمز التحقق غير صحيح", "Invalid OTP"), description: tc("الرمز الصحيح هو 1234", "The correct code is 1234") });
        setOtp(["", "", "", ""]);
        setStcStep("otp");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch {
      toast({ variant: "destructive", title: tc("حدث خطأ في التحقق", "Verification error") });
      setOtp(["", "", "", ""]);
      setStcStep("otp");
    }
  };

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl" style={{ background: "linear-gradient(135deg, #6B1FA8, #3DBE7C)" }}>
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <p className="font-bold">{tc("جاري التحقق من الرمز...", "Verifying code...")}</p>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-300">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <div className="text-center">
          <p className="font-bold text-green-700 text-lg">{tc("تمّ الدفع عبر STC Pay ✓", "STC Pay payment successful ✓")}</p>
          <p className="text-sm text-muted-foreground mt-1">{tc("جاري تأكيد طلبك...", "Confirming your order...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-foreground text-base">STC Pay</h3>
        <img src={stcLogoPath} alt="STC Pay" className="h-8 object-contain" />
      </div>

      {step === "phone" && (
        <>
          <div className="bg-muted/40 rounded-xl p-4 text-center space-y-0.5">
            <p className="text-xs text-muted-foreground">{tc("المبلغ المستحق", "Amount Due")}</p>
            <p className="text-2xl font-black text-primary">{Number(amount).toFixed(2)} <SarIcon size={18} /></p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tc("رقم الجوال المرتبط بـ STC Pay", "Phone linked to STC Pay")}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="05XXXXXXXX"
              dir="ltr"
              className="font-mono tracking-widest text-base text-center"
              inputMode="numeric"
              data-testid="input-stc-phone"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="icon" onClick={onCancel} className="flex-shrink-0 rounded-xl border" data-testid="button-cancel-stc">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSendOtp}
              disabled={sending || phone.length < 10}
              className="flex-1 h-12 text-base font-bold text-white border-0"
              style={{ background: "linear-gradient(135deg, #6B1FA8, #3DBE7C)" }}
              data-testid="button-send-otp"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("إرسال رمز التحقق", "Send OTP")}
            </Button>
          </div>
        </>
      )}

      {step === "otp" && (
        <>
          <div className="text-center space-y-0.5">
            <p className="text-sm text-muted-foreground">{tc("تم إرسال رمز التحقق إلى", "OTP sent to")}</p>
            <p className="font-bold text-foreground font-mono" dir="ltr">{phone}</p>
          </div>
          <div className="flex items-center justify-center gap-3 py-2" dir="ltr">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="w-14 h-14 text-center text-2xl font-bold border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none bg-background transition-colors"
                data-testid={`input-otp-${index}`}
              />
            ))}
          </div>
          <div className="text-center space-y-2">
            {timeLeft > 0 ? (
              <p className="text-sm text-muted-foreground">
                {tc("ينتهي الرمز خلال", "Code expires in")}{" "}
                <span className="font-bold text-primary font-mono">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => { setOtp(["", "", "", ""]); setStcStep("phone"); }}
                className="text-sm text-primary font-bold hover:underline"
              >
                {tc("طلب رمز جديد", "Request new code")}
              </button>
            )}
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-amber-700">{tc("رمز الاختبار:", "Test code:")}</span>
              <span className="font-bold font-mono text-amber-900 tracking-widest">1 2 3 4</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setOtp(["", "", "", ""]); setStcStep("phone"); }}
            className="w-full text-muted-foreground"
            data-testid="button-back-stc"
          >
            <ArrowLeft className="w-3.5 h-3.5 ml-1" />
            {tc("العودة", "Back")}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Apple Pay ───────────────────────────────────────────────────────────────
function ApplePayment({ amount, onSuccess, onCancel }: { amount: number; onSuccess: (tx: string) => void; onCancel: () => void }) {
  const tc = useTranslate();
  const [step, setStep] = useState<"idle" | "processing" | "success">("idle");

  const handleApplePay = () => {
    setStep("processing");
    setTimeout(() => { setStep("success"); setTimeout(() => onSuccess(`APPLE-${Date.now()}`), 1200); }, 1500);
  };

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <div className="w-20 h-20 rounded-full bg-[#1c1c1e] flex items-center justify-center shadow-2xl">
          <Loader2 className="w-9 h-9 text-white animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-bold text-foreground text-base">{tc("جاري المصادقة البيومترية...", "Biometric authentication...")}</p>
          <p className="text-sm text-muted-foreground mt-1">{tc("انظر إلى الشاشة أو ضع إصبعك", "Look at the screen or place your finger")}</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-300">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <div className="text-center">
          <p className="font-bold text-green-700 text-lg">{tc("تمّ الدفع عبر Apple Pay ✓", "Apple Pay payment successful ✓")}</p>
          <p className="text-sm text-muted-foreground mt-1">{tc("جاري تأكيد طلبك...", "Confirming your order...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="font-bold text-foreground text-base text-center">Apple Pay</h3>
      <div className="bg-muted/40 rounded-xl p-4 text-center space-y-0.5">
        <p className="text-xs text-muted-foreground">{tc("المبلغ المستحق", "Amount Due")}</p>
        <p className="text-2xl font-black text-primary">{Number(amount).toFixed(2)} <SarIcon size={18} /></p>
      </div>
      <button
        onClick={handleApplePay}
        className="w-full h-14 rounded-2xl bg-[#1c1c1e] hover:bg-[#2c2c2e] active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2.5 shadow-xl"
        data-testid="button-apple-pay"
      >
        <svg viewBox="0 0 20 24" className="h-5 w-auto fill-white flex-shrink-0">
          <path d="M13.23 3.02C14.28 1.71 14.94 0 14.94 0s-1.71.28-2.76 1.59c-.96 1.21-1.57 2.86-1.47 3.64.97.07 2.53-.3 3.52-2.21zM16.44 8.74c-1.77-.07-3.28 1-4.13 1-.85 0-2.14-.94-3.55-.91-1.82.03-3.5 1.06-4.43 2.71-1.9 3.28-.49 8.15 1.35 10.82.9 1.31 1.97 2.77 3.38 2.72 1.35-.05 1.86-.87 3.49-.87 1.62 0 2.09.87 3.51.84 1.46-.03 2.39-1.32 3.29-2.63.97-1.47 1.37-2.9 1.4-2.97-.03-.01-2.71-1.04-2.74-4.13-.03-2.59 2.11-3.83 2.21-3.9-1.2-1.78-3.08-1.68-3.78-1.68z" />
        </svg>
        <span className="text-white font-semibold text-base">Pay with Face ID / Touch ID</span>
      </button>
      <Button variant="ghost" size="sm" onClick={onCancel} className="w-full text-muted-foreground" data-testid="button-cancel-apple-pay">
        <ArrowLeft className="w-3.5 h-3.5 ml-1" />
        {tc("إلغاء", "Cancel")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{tc("محاكاة Apple Pay — لا يوجد خصم حقيقي", "Apple Pay simulation — no real charge")}</p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function SimulatedCardPayment({ amount, paymentMethod = "card", onSuccess, onCancel }: Props) {
  const isStc = paymentMethod === "stc-pay";
  const isApple = paymentMethod === "apple_pay" || paymentMethod === "neoleap-apple-pay";

  return (
    <div className="space-y-4">
      {isStc ? (
        <StcPayment amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
      ) : isApple ? (
        <ApplePayment amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
      ) : (
        <CardPayment amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
      )}
    </div>
  );
}
