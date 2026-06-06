import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import type { Order } from "@shared/schema";
import { brand } from "@/lib/brand";
import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import SarIcon from "@/components/sar-icon";
import { fmtOrderNum } from "@/lib/print-utils";

interface ReceiptInvoiceProps {
  order: Order;
  variant?: "button" | "auto";
}

export function ReceiptInvoice({ order, variant = "button" }: ReceiptInvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [trackingQrUrl, setTrackingQrUrl] = useState<string>("");
  const { data: bizConfig } = useQuery<any>({ queryKey: ["/api/business-config"] });
  const taxNumber = bizConfig?.vatNumber || brand.taxNumber;
  const commercialRegister = bizConfig?.commercialRegister || brand.commercialRegister;

  const getItemsArray = (): any[] => {
    try {
      if (!order || !order.items) return [];
      const items = order.items;
      if (Array.isArray(items)) return items;
      if (typeof items === 'string') {
        try {
          const parsed = JSON.parse(items);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      if (typeof items === 'object' && items !== null) {
        return Object.values(items);
      }
      return [];
    } catch (e) {
      console.error("Error parsing order items:", e, order?.items);
      return [];
    }
  };

  const items = getItemsArray();
  const safeOrder = order || {} as Order;

  useEffect(() => {
    const generateTrackingQR = async () => {
      if (!order || !order.orderNumber) return;
      try {
        const trackingUrl = `${window.location.origin}/track/${order.orderNumber}`;
        const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
          width: 150,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });
        setTrackingQrUrl(qrDataUrl);
      } catch (error) {
        console.error("Error generating tracking QR code:", error);
      }
    };
    generateTrackingQR();
  }, [order?.orderNumber]);

  // Early return if no valid order
  if (!order || !order.orderNumber) {
    return null;
  }

  const generatePDF = async () => {
    if (!invoiceRef.current) return;

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imgData;
      a.download = `فاتورة-${order.orderNumber}.png`;
      a.click();
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const printReceipt = async () => {
    if (!invoiceRef.current) return;
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><style>
        @page { size: 80mm auto; margin: 0; }
        * { margin: 0; padding: 0; }
        body { background: #fff; }
        img { width: 100%; display: block; }
      </style></head><body><img src="${imgData}" /></body></html>`);
      doc.close();
      setTimeout(() => {
        try { iframe.contentWindow!.print(); } catch {}
        const cleanup = () => { try { iframe.remove(); } catch {} };
        iframe.contentWindow!.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 8000);
      }, 400);
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  useEffect(() => {
    // Auto-print if variant is auto
    if (variant === "auto" && order && order.id) {
      const timer = setTimeout(() => {
        printReceipt();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [variant, order?.id]);

  const getPaymentMethodName = (method: string) => {
    const methods: Record<string, string> = {
      'cash': 'نقداً',
      'pos': 'جهاز نقاط البيع',
      'delivery': 'الدفع عند التوصيل',
      'stc': 'STC Pay',
      'alinma': 'الإنماء باي',
      'ur': 'يور باي',
      'barq': 'برق',
      'rajhi': 'الراجحي',
      'qahwa-card': 'بطاقة مكان الشيف'
    };
    return methods[method] || method;
  };

  // Early return if no valid order
  if (!order || !order.orderNumber) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Invoice Preview */}
      <div
        ref={invoiceRef}
        style={{ direction: "rtl", lineHeight: 1.6, border: 'none' }}
        className="bg-white rounded-none p-6 max-w-[80mm] mx-auto text-black [&_*]:!border-0 [&_*]:!border-none"
        data-testid="invoice-preview"
      >
        {/* Header */}
        <div className="text-center mb-3">
          <img
            src={brand.logoCustomer}
            alt={brand.nameEn}
            crossOrigin="anonymous"
            className="mx-auto mb-2"
            style={{ width: '70%', maxWidth: 180, height: 'auto', display: 'block' }}
          />
          <p className="text-[20px] font-bold uppercase tracking-tight mt-1">Tax Invoice - فاتورة ضريبية</p>
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-[20px]">
          <div className="space-y-2">
            <div className="flex justify-between gap-2">
              <span>رقم الفاتورة:</span>
              <span className="font-mono font-bold">{fmtOrderNum(order.orderNumber)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>التاريخ:</span>
              <span>{new Date(order.createdAt).toLocaleDateString('ar-SA')}</span>
            </div>
          </div>
          <div className="space-y-2 text-left">
            <div className="flex justify-between flex-row-reverse gap-2">
              <span>:الوقت</span>
              <span>{new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {(() => {
              const ot = String(order.orderType || order.deliveryType || '');
              const label = ot === 'dine-in' || ot === 'dine_in' ? 'محلي'
                : ot === 'pickup' || ot === 'takeaway' || ot === 'scheduled-pickup' ? 'سفري'
                : ot === 'delivery' ? 'توصيل'
                : ot === 'car-pickup' || ot === 'car_pickup' || ot === 'curbside' ? 'استلام بالسيارة'
                : ot === 'table' ? 'طاولة'
                : '';
              return label ? (
                <div className="flex justify-between flex-row-reverse gap-2" data-testid="text-order-type">
                  <span>:نوع الطلب</span>
                  <span className="font-bold">{label}</span>
                </div>
              ) : null;
            })()}
            {order.tableNumber && (String(order.orderType) === 'table' || String(order.deliveryType) === 'table') && (
              <div className="flex justify-between flex-row-reverse gap-2">
                <span>:الطاولة</span>
                <span className="font-bold">#{order.tableNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items List — neat with separators between items */}
        <div className="mb-3 text-[21px]">
          <div className="flex font-bold border-b-2 border-black pb-2 mb-2">
            <div className="flex-1 text-right">المنتج</div>
            <div className="w-12 text-center">كمية</div>
            <div className="w-20 text-left">المجموع</div>
          </div>
          {items.map((item: any, index: number) => {
            const cz = item.customization || {};
            const inlineAddons = cz.selectedItemAddons || cz.selectedAddons || [];
            const itemNameAr = item.nameAr || item.coffeeItem?.nameAr || item.name || '';
            const itemNameEn = item.nameEn || item.coffeeItem?.nameEn || '';
            const sz = item.selectedSize || cz.selectedSize || cz.size || '';
            const noteText = (cz.notes || item.notes || '').toString().trim();
            const hasExtras = sz || inlineAddons.length > 0 || noteText;
            return (
              <div
                key={index}
                className={`flex items-start py-3 ${index < items.length - 1 ? 'border-b border-dashed border-gray-400' : ''}`}
              >
                <div className="flex-1 text-right pr-1">
                  <div className="font-bold leading-relaxed">{itemNameAr}</div>
                  {itemNameEn && itemNameEn !== itemNameAr && (
                    <div className="text-[15px] mt-0.5 ltr text-right text-gray-600">{itemNameEn}</div>
                  )}
                  {hasExtras && (
                    <div className="mt-1.5 space-y-1 text-[16px] text-gray-700">
                      {sz && <div>📏 الحجم: <span className="font-semibold">{sz}</span></div>}
                      {inlineAddons.length > 0 && (
                        <div className="pr-2">
                          {inlineAddons.map((a: any, i: number) => (
                            <div key={i}>+ {a.nameAr || a.name || ''}</div>
                          ))}
                        </div>
                      )}
                      {noteText && <div className="italic">📝 {noteText}</div>}
                    </div>
                  )}
                </div>
                <div className="w-12 text-center font-bold">{item.quantity}</div>
                <div className="w-20 text-left font-bold">
                  {(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="space-y-2 text-[21px] mt-2">
          <div className="flex justify-between">
            <span>المجموع الفرعي:</span>
            <span className="font-medium">{(Number(order.totalAmount) / 1.15).toFixed(2)} <SarIcon /></span>
          </div>
          <div className="flex justify-between">
            <span>الضريبة (15%):</span>
            <span className="font-medium">{(Number(order.totalAmount) - (Number(order.totalAmount) / 1.15)).toFixed(2)} <SarIcon /></span>
          </div>
          <div className="flex justify-between text-[28px] font-black mt-2">
            <span>الإجمالي:</span>
            <span>{Number(order.totalAmount).toFixed(2)} <SarIcon /></span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-[20px] space-y-1">
          <p className="font-bold text-[22px]">شكراً لزيارتكم</p>
          <p>الرقم الضريبي: {taxNumber}</p>
          <p>السجل التجاري: {commercialRegister}</p>
          <p className="font-bold mt-2 tracking-tight">{brand.website}</p>
        </div>
      </div>

      {/* Action Buttons */}
      {variant === "button" && (
        <div className="flex gap-2 w-full no-print">
          <Button
            onClick={printReceipt}
            className="flex-1 bg-primary hover:bg-primary/90"
            data-testid="button-print-invoice"
          >
            <Printer className="ml-2 h-4 w-4" />
            طباعة الفاتورة
          </Button>
          <Button
            onClick={generatePDF}
            variant="outline"
            className="flex-1"
            data-testid="button-download-invoice"
          >
            <Download className="ml-2 h-4 w-4" />
            تحميل PDF
          </Button>
        </div>
      )}
    </div>
  );
}
