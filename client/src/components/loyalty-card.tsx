import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Wallet, Coffee, Award, Sparkles, Gift, Star, CreditCard, TrendingUp, Crown } from "lucide-react";
import type { LoyaltyCard } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import { brand } from "@/lib/brand";

interface LoyaltyCardProps {
  card: LoyaltyCard;
  showActions?: boolean;
  compact?: boolean;
  showTierProgress?: boolean;
}

const tierThresholds = {
  bronze: { min: 0, max: 499, next: 'silver' },
  silver: { min: 500, max: 1499, next: 'gold' },
  gold: { min: 1500, max: 4999, next: 'platinum' },
  platinum: { min: 5000, max: Infinity, next: null },
};

function getTierProgress(tier: string, totalSpent: number): { percentage: number; toNext: number; nextTier: string | null } {
  const currentTier = tierThresholds[tier as keyof typeof tierThresholds] || tierThresholds.bronze;
  const nextTier = currentTier.next;
  
  if (!nextTier) {
    return { percentage: 100, toNext: 0, nextTier: null };
  }
  
  const nextThreshold = tierThresholds[nextTier as keyof typeof tierThresholds]?.min || 0;
  const currentMin = currentTier.min;
  const range = nextThreshold - currentMin;
  const progress = totalSpent - currentMin;
  const percentage = Math.min(100, Math.max(0, (progress / range) * 100));
  const toNext = Math.max(0, nextThreshold - totalSpent);
  
  return { percentage, toNext, nextTier };
}

export default function LoyaltyCardComponent({ card, showActions = true, compact = false, showTierProgress = true }: LoyaltyCardProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const hasTierData = !!(card.tier && card.totalSpent !== undefined);
  const tierProgress = getTierProgress(card.tier || 'bronze', card.totalSpent || 0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>("");

  const availableFreeDishes = Math.max(0, (card.freeCupsEarned || 0) - (card.freeCupsRedeemed || 0));
  const stampsProgress = (card.stamps || 0) % 6;

  useEffect(() => {
    if (qrCanvasRef.current && card.qrToken) {
      const qrSize = compact ? 100 : 160;
      const cardUrl = `${window.location.origin}/loyalty-verify?token=${card.qrToken}`;
      QRCode.toCanvas(
        qrCanvasRef.current,
        cardUrl,
        {
          width: qrSize,
          margin: 1,
          color: {
            dark: "#1a1410",
            light: "#ffffff",
          },
          errorCorrectionLevel: 'H',
        },
        (error) => {
          if (error) console.error("QR Code generation error:", error);
        }
      );

      QRCode.toDataURL(cardUrl, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H',
      }).then((url) => {
        setQrDataUrl(url);
      }).catch(console.error);
    }
  }, [card.qrToken, compact]);

  useEffect(() => {
    const barcodeValue = card.cardNumber || card.qrToken;
    if (barcodeSvgRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5,
          background: "#ffffff",
          lineColor: "#1a1410",
        });

        const svgElement = barcodeSvgRef.current;
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        setBarcodeDataUrl(url);
      } catch (error) {
        console.error("Barcode generation error:", error);
      }
    }
  }, [card.cardNumber, card.qrToken]);

  const downloadCard = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 900;
    canvas.height = 550;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#d4a574');
    gradient.addColorStop(0.5, '#c8956c');
    gradient.addColorStop(1, '#a67c52');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.arc(-50, -50, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvas.width + 50, canvas.height + 50, 250, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a3728';
    ctx.font = 'bold 48px Cairo, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(brand.nameEn, canvas.width - 50, 70);

    ctx.font = '24px Georgia, serif';
    ctx.fillStyle = '#6b4f3c';
    ctx.fillText(brand.loyaltyTaglineEn, canvas.width - 50, 105);

    const tierColors: Record<string, string> = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2'
    };
    const tierNames: Record<string, string> = {
      bronze: 'برونزي',
      silver: 'فضي',
      gold: 'ذهبي',
      platinum: 'بلاتيني'
    };

    ctx.fillStyle = tierColors[card.tier] || tierColors.bronze;
    ctx.beginPath();
    ctx.roundRect(canvas.width - 150, 120, 100, 35, 17);
    ctx.fill();
    ctx.fillStyle = '#4a3728';
    ctx.font = 'bold 16px Cairo, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tierNames[card.tier] || 'برونزي', canvas.width - 100, 145);

    ctx.fillStyle = '#4a3728';
    ctx.font = 'bold 32px Cairo, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(card.customerName || 'عميل مميز', canvas.width - 50, 200);

    ctx.font = '20px Arial';
    ctx.fillStyle = '#6b4f3c';
    ctx.fillText(card.phoneNumber, canvas.width - 50, 235);

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(50, 280, 800, 220, 15);
    ctx.fill();

    if (qrDataUrl) {
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.onload = () => {
        ctx.drawImage(qrImage, 80, 310, 150, 150);

        ctx.fillStyle = '#4a3728';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(card.qrToken, 155, 475);

        drawStats();
        downloadCanvas();
      };
      qrImage.src = qrDataUrl;
    } else {
      drawStats();
      downloadCanvas();
    }

    function drawStats() {
      if (!ctx) return;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4a3728';
      
      ctx.font = 'bold 18px Cairo, Arial';
      ctx.fillText('الأختام', 400, 320);
      ctx.font = '14px Cairo, Arial';
      ctx.fillStyle = '#6b4f3c';
      ctx.fillText(`${card.stamps || 0} / 6`, 400, 345);

      const startX = 280;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * 25, 375, 10, 0, Math.PI * 2);
        if (i < (card.stamps || 0)) {
          ctx.fillStyle = '#d4a574';
          ctx.fill();
        } else {
          ctx.strokeStyle = '#d4a574';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = '#4a3728';
      ctx.font = 'bold 18px Cairo, Arial';
      ctx.fillText('وجبات مجانية متاحة', 600, 320);
      ctx.font = 'bold 36px Cairo, Arial';
      ctx.fillStyle = availableFreeDishes > 0 ? '#22c55e' : '#6b4f3c';
      ctx.fillText(String(availableFreeDishes), 600, 370);

      ctx.font = 'bold 18px Cairo, Arial';
      ctx.fillStyle = '#4a3728';
      ctx.fillText('إجمالي المشتريات', 800, 320);
      ctx.font = 'bold 24px Cairo, Arial';
      ctx.fillText(`${card.totalSpent || 0} ر.س`, 800, 355);

      ctx.font = 'bold 18px Cairo, Arial';
      ctx.fillText('مرات الاستخدام', 800, 410);
      ctx.font = 'bold 24px Cairo, Arial';
      ctx.fillText(String(card.discountCount || 0), 800, 445);
    }

    function downloadCanvas() {
      const link = document.createElement('a');
      link.download = `بطاقة-مكان-الشيف-${card.customerName || 'loyalty'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const tierInfo = {
    bronze: { nameAr: 'برونزي', color: 'from-amber-600 via-amber-700 to-amber-800', badgeColor: 'bg-amber-600' },
    silver: { nameAr: 'فضي', color: 'from-slate-400 via-slate-500 to-slate-600', badgeColor: 'bg-slate-500' },
    gold: { nameAr: 'ذهبي', color: 'from-yellow-500 via-amber-500 to-yellow-600', badgeColor: 'bg-yellow-500' },
    platinum: { nameAr: 'بلاتيني', color: 'from-gray-400 via-gray-300 to-gray-400', badgeColor: 'bg-gray-400' }
  };

  const currentTier = tierInfo[card.tier as keyof typeof tierInfo] || tierInfo.bronze;

  if (compact) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${currentTier.color} text-white shadow-xl`} data-testid="loyalty-card-compact">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative p-4 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-md">
            <canvas ref={qrCanvasRef} className="w-16 h-16" data-testid="canvas-qr-compact" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Coffee className="w-5 h-5" />
              <span className="font-bold text-lg">بطاقة مكان الشيف</span>
              <Badge className={`${currentTier.badgeColor} text-white text-xs`}>{currentTier.nameAr}</Badge>
            </div>
            <p className="text-sm opacity-90 truncate" data-testid="text-customer-name-compact">{card.customerName}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4" />
                {stampsProgress}/6 أختام
              </span>
              {availableFreeDishes > 0 && (
                <span className="flex items-center gap-1 text-green-300 font-bold">
                  <Gift className="w-4 h-4" />
                  {availableFreeDishes} مجاني
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="loyalty-card">
      <Card className={`relative overflow-hidden bg-gradient-to-br ${currentTier.color} text-white shadow-2xl`}>
        <div className="absolute inset-0 bg-black/15"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 translate-y-1/2"></div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2"></div>

        <div className="relative p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Coffee className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-bold" data-testid="text-brand">{brand.nameEn}</h3>
                <p className="text-sm opacity-80">بطاقة الولاء الذكية</p>
              </div>
            </div>
            <Badge className={`${currentTier.badgeColor} text-white px-3 py-1 text-sm`}>
              <Award className="w-4 h-4 ml-1" />
              <span data-testid="text-tier">{currentTier.nameAr}</span>
            </Badge>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-2xl font-bold" data-testid="text-customer-name">{card.customerName || 'عميل مميز'}</h4>
              <p className="text-sm opacity-80 flex items-center gap-2" data-testid="text-phone">
                <CreditCard className="w-4 h-4" />
                {card.phoneNumber}
              </p>
              <p className="text-xs opacity-60 font-mono" data-testid="text-card-number">
                رقم البطاقة: {card.cardNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 bg-white/10 rounded-xl p-4">
            <div className="bg-white p-2 rounded-lg shadow-lg">
              <canvas 
                ref={qrCanvasRef} 
                className="w-28 h-28"
                data-testid="canvas-qr"
              />
              <p className="text-xs text-center text-gray-600 mt-1 font-mono bg-white rounded px-1">
                {card.qrToken}
              </p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 text-center">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-5 h-5 text-yellow-300" />
                </div>
                <div className="text-2xl font-bold">{stampsProgress}/6</div>
                <div className="text-xs opacity-80">أختام</div>
                <div className="flex justify-center gap-1 mt-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3 h-3 rounded-full ${i < stampsProgress ? 'bg-yellow-300' : 'bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>

              <div className={`rounded-lg p-3 ${availableFreeDishes > 0 ? 'bg-green-500/30' : 'bg-white/10'}`}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gift className="w-5 h-5 text-green-300" />
                </div>
                <div className={`text-2xl font-bold ${availableFreeDishes > 0 ? 'text-green-300' : ''}`} data-testid="text-free-drinks">
                  {availableFreeDishes}
                </div>
                <div className="text-xs opacity-80">وجبة مجانية</div>
              </div>

              <div className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-xl font-bold" data-testid="text-discount-count">{card.discountCount || 0}</div>
                <div className="text-xs opacity-80">مرة استخدام</div>
              </div>

              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-xl font-bold" data-testid="text-total-spent">{card.totalSpent || 0}</div>
                <div className="text-xs opacity-80"><SarIcon /> إجمالي</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-2 overflow-hidden flex justify-center">
            <svg ref={barcodeSvgRef} data-testid="svg-barcode" />
          </div>

          {showTierProgress && hasTierData && tierProgress.nextTier && (
            <div className="bg-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">تقدم المستوى</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Crown className="w-3 h-3" />
                  <span>المستوى التالي: {tierProgress.nextTier === 'silver' ? 'فضي' : tierProgress.nextTier === 'gold' ? 'ذهبي' : 'بلاتيني'}</span>
                </div>
              </div>
              <Progress value={tierProgress.percentage} className="h-2" />
              <div className="flex justify-between text-xs opacity-80">
                <span>{tierProgress.percentage.toFixed(0)}% مكتمل</span>
                <span>متبقي {tierProgress.toNext} <SarIcon /> للترقية</span>
              </div>
            </div>
          )}

          {showTierProgress && hasTierData && !tierProgress.nextTier && (
            <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-yellow-300" />
                <span className="font-bold text-yellow-200">أعلى مستوى!</span>
              </div>
              <p className="text-xs opacity-80">أنت في المستوى البلاتيني - استمتع بجميع المزايا الحصرية</p>
            </div>
          )}
        </div>
      </Card>

      {showActions && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={downloadCard}
            variant="outline"
            className="gap-2"
            data-testid="button-download-card"
          >
            <Download className="w-4 h-4" />
            تحميل البطاقة
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            data-testid="button-apple-wallet"
            onClick={() => {
              const url = `https://www.chefsplace.online/api/loyalty/cards/${card.id}/apple-wallet-pass`;
              window.open(url, '_blank');
            }}
          >
            <Wallet className="w-4 h-4" />
            Apple Wallet
          </Button>
        </div>
      )}
    </div>
  );
}
