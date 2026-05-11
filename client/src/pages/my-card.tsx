import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, ArrowLeftRight, Star, Wallet } from "lucide-react";
import BlackRoseCard from "@/components/BlackRoseCard";
import { useCustomer } from "@/contexts/CustomerContext";
import { useLocation } from "wouter";
import { CustomerLayout } from "@/components/layouts/CustomerLayout";
import QRCodeLib from "qrcode";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import chefsplaceLogo from "@assets/blackrose-logo.png";

export default function MyCardPage() {
  const { customer } = useCustomer();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [addingToWallet, setAddingToWallet] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferPhone, setTransferPhone] = useState("");
  const [transferPoints, setTransferPoints] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const dir = i18n.language === "en" ? "ltr" : "rtl";

  const { data: loyaltyCards = [], isLoading: loadingCards } = useQuery<any[]>({
    queryKey: ["/api/customer/loyalty-cards"],
    enabled: !!customer,
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/loyalty-settings"],
  });

  const card = loyaltyCards[0];
  const points = card?.points ?? 0;
  const pointsValueInSar = settings?.pointsValueInSar ?? 0.02;
  const sarValueNum = parseFloat((points * pointsValueInSar).toFixed(2));

  useEffect(() => {
    const qrData = card?.qrToken || card?.cardNumber;
    if (!qrData) return;
    QRCodeLib.toDataURL(qrData, {
      width: 260,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [card?.qrToken, card?.cardNumber]);

  const transferMutation = useMutation({
    mutationFn: async (data: { recipientPhone: string; points: number; pin?: string }) =>
      apiRequest("POST", "/api/customer/transfer-points", data),
    onSuccess: () => {
      toast({
        title: tc("✅ تم التحويل بنجاح", "✅ Transfer successful"),
        description: tc(`تم تحويل ${transferPoints} نقطة`, `Transferred ${transferPoints} points`),
      });
      qc.invalidateQueries({ queryKey: ["/api/customer/loyalty-cards"] });
      qc.invalidateQueries({ queryKey: ["/api/customer/loyalty-transactions"] });
      setTransferPhone("");
      setTransferPoints("");
      setTransferPin("");
      setShowTransfer(false);
    },
    onError: (err: any) => {
      const msg = err?.message || tc("فشل التحويل", "Transfer failed");
      toast({ title: tc("خطأ", "Error"), description: msg, variant: "destructive" });
    },
  });

  const handleTransfer = () => {
    const pts = parseInt(transferPoints);
    if (!transferPhone || !pts || pts <= 0) {
      toast({ title: tc("خطأ", "Error"), description: tc("أدخل رقم الجوال والنقاط", "Enter phone and points"), variant: "destructive" });
      return;
    }
    if (pts > points) {
      toast({ title: tc("خطأ", "Error"), description: tc("النقاط غير كافية", "Insufficient points"), variant: "destructive" });
      return;
    }
    transferMutation.mutate({ recipientPhone: transferPhone, points: pts, pin: transferPin || undefined });
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const handleAddToAppleWallet = async () => {
    setAddingToWallet(true);
    try {
      if (isIOS) {
        toast({ title: tc("⏳ جارٍ التحضير...", "⏳ Preparing..."), description: tc("سيفتح Apple Wallet خلال ثوانٍ", "Opening Apple Wallet...") });
        await new Promise((r) => setTimeout(r, 400));
        window.location.href = "/api/wallet/apple-pass";
        return;
      }
      const resp = await fetch("/api/wallet/apple-pass", { method: "GET", credentials: "include" });
      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok || !contentType.includes("pkpass")) {
        let errMsg = tc("فشل إنشاء البطاقة", "Failed to generate pass");
        try { const err = await resp.json(); errMsg = err?.error || errMsg; } catch (_) {}
        toast({ title: tc("خطأ", "Error"), description: errMsg, variant: "destructive" });
        return;
      }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/vnd.apple.pkpass" }));
      const a = document.createElement("a");
      a.href = blobUrl; a.download = "chefsplace-loyalty.pkpass"; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
      toast({ title: tc("✅ تم التحميل", "✅ Downloaded"), description: tc("افتح ملف .pkpass لإضافته", "Open .pkpass to add to Wallet") });
    } catch (e: any) {
      toast({ title: tc("خطأ", "Error"), description: e?.message || tc("تعذّر الوصول للخادم", "Could not reach server"), variant: "destructive" });
    } finally {
      setAddingToWallet(false);
    }
  };

  /* ── Not logged in ── */
  if (!customer) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-5 p-8" style={{ background: "#0a0a0a" }} dir={dir}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(200,165,58,0.1)", border: "1px solid rgba(200,165,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Star style={{ color: "#C8A53A", width: 32, height: 32 }} />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">{tc("بطاقة الولاء", "Loyalty Card")}</p>
            <p className="text-white/40 text-sm">{tc("سجّل دخولك للوصول إلى بطاقتك", "Log in to access your card")}</p>
          </div>
          <Button onClick={() => setLocation("/auth")} data-testid="button-login" style={{ background: "#C8A53A", color: "#111", fontWeight: 700, height: 48, paddingInline: 32 }}>
            {tc("تسجيل الدخول", "Log In")}
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  /* ── Loading ── */
  if (loadingCards) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center min-h-screen" style={{ background: "#0a0a0a" }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#C8A53A", borderTopColor: "transparent" }} />
        </div>
      </CustomerLayout>
    );
  }

  /* ── Main card view ── */
  return (
    <CustomerLayout>
      <div className="min-h-screen flex flex-col pb-28" style={{ background: "#0a0a0a" }} dir={dir}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back" style={{ color: "rgba(255,255,255,0.4)" }}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em" }}>
            {tc("بطاقة الولاء", "Loyalty Card")}
          </p>
          <img src={chefsplaceLogo} alt="مكان الشيف البخاري" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
        </div>

        {/* ── Hero: greeting + points ── */}
        <div className="px-5 pt-4 pb-6">
          {/* Customer name */}
          <p style={{ color: "rgba(200,165,58,0.6)", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", margin: "0 0 4px", textTransform: "uppercase" }}>
            {tc("مرحباً،", "Welcome,")}
          </p>
          <p style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 20px", lineHeight: 1.1 }} data-testid="text-customer-name">
            {customer?.name || tc("عزيزي العميل", "Valued Customer")}
          </p>

          {/* Points stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "rgba(200,165,58,0.07)", border: "1px solid rgba(200,165,58,0.15)", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ color: "rgba(200,165,58,0.55)", fontSize: 10, letterSpacing: "0.2em", margin: "0 0 6px", textTransform: "uppercase" }}>
                {tc("نقاطي", "My Points")}
              </p>
              <p style={{ color: "#C8A53A", fontSize: 30, fontWeight: 900, margin: 0, lineHeight: 1, textShadow: "0 0 20px rgba(200,165,58,0.4)" }} data-testid="text-hero-points">
                {points.toLocaleString()}
              </p>
            </div>
            <div style={{ background: "rgba(190,24,69,0.07)", border: "1px solid rgba(190,24,69,0.15)", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ color: "rgba(190,24,69,0.6)", fontSize: 10, letterSpacing: "0.2em", margin: "0 0 6px", textTransform: "uppercase" }}>
                {tc("القيمة", "Value")}
              </p>
              <p style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                {sarValueNum.toFixed(2)}
                <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.45)", marginInlineStart: 4 }}>ر.س</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── The Card ── */}
        <div className="px-4 mb-7">
          <BlackRoseCard
            phone={customer?.phone}
            points={points}
            sarValue={sarValueNum}
            customerName={customer?.name || card?.customerName}
          />
        </div>

        {/* ── QR Code ── */}
        {qrCodeUrl ? (
          <div className="flex flex-col items-center mb-6 px-4" data-testid="barcode-section">
            <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 10px 50px rgba(0,0,0,0.6)", display: "inline-block" }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ width: 180, height: 180, display: "block" }} data-testid="img-qr-code" />
            </div>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 10, letterSpacing: "0.1em" }}>
              {tc("امسح لتسجيل نقاطك", "Scan to collect points")}
            </p>
          </div>
        ) : card ? (
          <div className="flex justify-center mb-6">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#C8A53A", borderTopColor: "transparent" }} />
          </div>
        ) : null}

        {/* ── Action Buttons ── */}
        <div className="px-4 flex flex-col gap-3">

          {/* Apple Wallet */}
          <button
            onClick={handleAddToAppleWallet}
            disabled={addingToWallet}
            data-testid="button-add-apple-wallet"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", height: 52, borderRadius: 14,
              background: addingToWallet ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.05)",
              color: "#fff", border: "1px solid rgba(255,255,255,0.1)",
              cursor: addingToWallet ? "wait" : "pointer",
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              transition: "all 0.2s", opacity: addingToWallet ? 0.6 : 1,
              fontSize: 15, fontWeight: 600,
            }}
          >
            {addingToWallet ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white/70" />
            ) : (
              <svg width="14" height="17" viewBox="0 0 814 1000" fill="white">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.5-317.3 71 0 130.3 46.4 174.1 46.4 42.8 0 109.7-49.2 192.7-49.2 31 0 108.2 2.6 168.1 80.6zM552.5 80.3c34.3-41.7 57.8-97.3 57.8-152.9 0-5.8-.7-11.7-1.3-17.5-55.2 2-120.2 37-158.6 83.5-33.7 39.5-63.7 94.8-63.7 151.1 0 6.4.7 12.9 1.3 14.9 3.2.7 8.4 1.3 13.6 1.3 49.8 0 109.7-33.1 150.9-80.4z" />
              </svg>
            )}
            {addingToWallet ? tc("جارٍ التحضير...", "Preparing...") : "Apple Wallet"}
          </button>

          {/* Transfer Points */}
          {points > 0 && (
            <div>
              {!showTransfer ? (
                <button
                  onClick={() => setShowTransfer(true)}
                  data-testid="button-open-transfer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", height: 52, borderRadius: 14, background: "none",
                    border: "1px solid rgba(200,165,58,0.2)", color: "rgba(200,165,58,0.7)",
                    cursor: "pointer", fontSize: 14, fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {tc("تحويل نقاط لصديق", "Transfer points to friend")}
                </button>
              ) : (
                <div style={{ background: "rgba(200,165,58,0.05)", border: "1px solid rgba(200,165,58,0.15)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ color: "#C8A53A", fontSize: 13, fontWeight: 700, margin: 0, letterSpacing: "0.05em" }}>
                    {tc("تحويل النقاط", "Transfer Points")}
                  </p>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">{tc("رقم جوال المستلم", "Recipient Phone")}</Label>
                    <Input placeholder="05xxxxxxxx" value={transferPhone} onChange={(e) => setTransferPhone(e.target.value)} dir="ltr"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 rounded-xl" data-testid="input-transfer-phone" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">{tc("عدد النقاط", "Points")}</Label>
                    <Input type="number" placeholder={tc("أدخل عدد النقاط", "Enter points")} value={transferPoints} onChange={(e) => setTransferPoints(e.target.value)}
                      min={1} max={points} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 rounded-xl" data-testid="input-transfer-points" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">{tc("كلمة المرور", "Password")}</Label>
                    <Input type="password" placeholder={tc("كلمة المرور", "Password")} value={transferPin} onChange={(e) => setTransferPin(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 rounded-xl" data-testid="input-transfer-pin" />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 h-11 rounded-xl font-bold" style={{ background: "#C8A53A", color: "#111" }}
                      onClick={handleTransfer} disabled={transferMutation.isPending || !transferPhone || !transferPoints} data-testid="button-confirm-transfer">
                      {transferMutation.isPending ? tc("جاري...", "Sending...") : tc("تأكيد التحويل", "Confirm")}
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl border-white/10 text-white/50 hover:bg-white/5"
                      onClick={() => setShowTransfer(false)} data-testid="button-cancel-transfer">
                      {tc("إلغاء", "Cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
