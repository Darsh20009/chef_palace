import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  CameraOff, 
  Search, 
  User, 
  Phone, 
  CreditCard, 
  Gift, 
  Star,
  X,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import SarIcon from "@/components/sar-icon";

interface CustomerLookupResult {
  found: boolean;
  card?: {
    id: string;
    customerName: string;
    phoneNumber: string;
    qrToken: string;
    cardNumber: string;
    stamps: number;
    freeCupsEarned: number;
    freeCupsRedeemed: number;
    points: number;
    tier: string;
    totalSpent: number;
    discountCount: number;
    status: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    points: number;
  };
  error?: string;
}

interface BarcodeScannerProps {
  onCustomerFound?: (result: CustomerLookupResult) => void;
  onClose?: () => void;
  showManualInput?: boolean;
}

export default function BarcodeScanner({ 
  onCustomerFound, 
  onClose,
  showManualInput = true 
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerLookupResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";

  const lookupCard = useCallback(async (code: string) => {
    if (!code.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/loyalty/cards/lookup/${encodeURIComponent(code.trim())}`);
      const data = await response.json();

      if (response.ok && data.found) {
        setResult(data);
        onCustomerFound?.(data);
      } else {
        setError(data.error || "البطاقة غير موجودة");
      }
    } catch (err) {
      setError("فشل في البحث عن البطاقة");
    } finally {
      setIsLoading(false);
    }
  }, [onCustomerFound]);

  const startScanner = useCallback(async () => {
    try {
      // Set scanning state first to render the container
      setIsScanning(true);
      setError(null);
      
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      // Wait for the DOM element to be available
      await new Promise(resolve => setTimeout(resolve, 100));

      const containerElement = document.getElementById(scannerContainerId);
      if (!containerElement) {
        throw new Error("Camera container not found");
      }

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ];

      const scanner = new Html5Qrcode(scannerContainerId, { formatsToSupport, verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        async (decodedText) => {
          try {
            await scanner.stop();
            setIsScanning(false);
            lookupCard(decodedText);
          } catch {}
        },
        () => {}
      );
    } catch (err: any) {
      console.error("Scanner error:", err);
      setError(err.message || "فشل في تشغيل الكاميرا. تأكد من السماح بالوصول للكاميرا.");
      setIsScanning(false);
    }
  }, [lookupCard]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleManualSearch = () => {
    lookupCard(manualCode);
  };

  const availableFreeDrinks = result?.card 
    ? Math.max(0, (result.card.freeCupsEarned || 0) - (result.card.freeCupsRedeemed || 0))
    : 0;

  const tierNames: Record<string, string> = {
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني'
  };

  return (
    <div className="w-full" data-testid="barcode-scanner">
      <div className="space-y-4">
        {showManualInput && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <label className="text-sm font-medium text-foreground block mb-2">بحث يدوي</label>
            <div className="flex gap-2">
              <Input
                placeholder="أدخل رقم البطاقة أو رقم الهاتف..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                className="flex-1"
                data-testid="input-manual-code"
              />
              <Button 
                onClick={handleManualSearch} 
                disabled={isLoading || !manualCode.trim()}
                data-testid="button-manual-search"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="relative w-full">
          <div 
            id={scannerContainerId} 
            className={`w-full h-80 bg-muted rounded-lg overflow-hidden ${!isScanning ? 'hidden' : ''}`}
          />

          {!isScanning && (
            <div className="flex flex-col items-center gap-4 py-8 px-4 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-muted-foreground/30">
                <Camera className="w-12 h-12 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground mb-2">ماسح رمز استجابة سريعة</p>
                <p className="text-sm text-muted-foreground mb-4">اضغط للبدء في مسح بطاقة العميل</p>
              </div>
              <Button 
                onClick={startScanner} 
                className="gap-2 px-6"
                data-testid="button-start-scan"
              >
                <Camera className="w-4 h-4" />
                تشغيل الماسح
              </Button>
            </div>
          )}

          {isScanning && (
            <Button 
              variant="outline" 
              onClick={stopScanner} 
              className="w-full gap-2 mt-2"
              data-testid="button-stop-scan"
            >
              <CameraOff className="w-4 h-4" />
              إيقاف الماسح
            </Button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-center text-sm" data-testid="text-error">
            {error}
          </div>
        )}

        {result?.found && result.card && (
          <div className="space-y-3 p-4 bg-muted rounded-lg" data-testid="customer-result">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-muted-foreground" />
                <span className="font-bold" data-testid="text-result-name">
                  {result.card.customerName || result.customer?.name || 'عميل'}
                </span>
              </div>
              <Badge variant="secondary" data-testid="text-result-tier">
                {tierNames[result.card.tier] || 'برونزي'}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span data-testid="text-result-phone">{result.card.phoneNumber}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center p-2 bg-background rounded-md">
                <Star className="w-4 h-4 mx-auto mb-1 text-yellow-500" />
                <div className="font-bold" data-testid="text-result-stamps">{result.card.stamps % 6}/6</div>
                <div className="text-xs text-muted-foreground">أختام</div>
              </div>

              <div className={`text-center p-2 rounded-md ${availableFreeDrinks > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-background'}`}>
                <Gift className="w-4 h-4 mx-auto mb-1 text-green-600" />
                <div className={`font-bold ${availableFreeDrinks > 0 ? 'text-green-600' : ''}`} data-testid="text-result-free">
                  {availableFreeDrinks}
                </div>
                <div className="text-xs text-muted-foreground">مجاني</div>
              </div>

              <div className="text-center p-2 bg-background rounded-md">
                <CreditCard className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <div className="font-bold" data-testid="text-result-spent">{result.card.totalSpent}</div>
                <div className="text-xs text-muted-foreground"><SarIcon /></div>
              </div>
            </div>

            {availableFreeDrinks > 0 && (
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-center text-green-700 dark:text-green-400 font-bold">
                هذا العميل لديه {availableFreeDrinks} مشروب مجاني!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
