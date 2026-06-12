import type { Order } from "@shared/schema";
import type { PaymentMethod } from "@shared/schema";
import QRCode from "qrcode";

interface CartItem {
  coffeeItemId: string;
  quantity: number;
  coffeeItem?: {
    nameAr: string;
    nameEn: string | null;
    price: string;
  };
}

const paymentMethodNames: Record<string, string> = {
  cash: 'نقدي',
  pos: 'شبكة',
  'pos-network': 'شبكة',
  card: 'شبكة',
  network: 'شبكة',
  delivery: 'الدفع عند التوصيل',
  stc: 'STC Pay',
  alinma: 'Alinma Pay',
  ur: 'Ur Pay',
  barq: 'Barq',
  rajhi: 'بنك الراجحي',
  mada: 'تحويل بنكي (مدى)',
  bank_transfer: 'تحويل بنكي',
  apple_pay: 'Apple Pay',
  'neoleap-apple-pay': 'Apple Pay',
  'paymob-apple-pay': 'Apple Pay',
  geidea: 'بطاقة ائتمان',
  paymob: 'بطاقة ائتمان',
  'paymob-card': 'بطاقة ائتمان',
  split: 'نقدي + شبكة',
  'qahwa-card': 'بطاقة ولاء',
  'qirox-card': 'بطاقة ولاء',
  loyalty: 'بطاقة ولاء',
};

const paymentDetails: Record<string, string> = {
  cash: 'دفع نقدي',
  pos: 'جهاز نقاط البيع',
  'pos-network': 'جهاز نقاط البيع',
  card: 'جهاز نقاط البيع',
  delivery: 'ادفع عند استلام الطلب',
  stc: '+966536558528',
  alinma: '+966536558528',
  ur: '+966536558528',
  barq: '+966536558528',
  rajhi: 'SA78 8000 0539 6080 1942 4738',
  mada: 'تحويل بنكي',
  bank_transfer: 'تحويل بنكي',
  apple_pay: 'Apple Pay',
  'neoleap-apple-pay': 'Apple Pay',
  'paymob-apple-pay': 'Apple Pay',
  geidea: 'بطاقة ائتمان إلكترونية',
  paymob: 'بطاقة ائتمان إلكترونية',
  'paymob-card': 'بطاقة ائتمان إلكترونية',
  split: 'دفع مختلط',
  'qahwa-card': 'مشروب مجاني من بطاقة الولاء',
  'qirox-card': 'بطاقة ولاء',
  loyalty: 'بطاقة ولاء',
};

// Simple PDF generation using browser print API
export const generatePDF = async (
  order: Order,
  cartItems: CartItem[],
  paymentMethod: PaymentMethod
): Promise<Blob> => {
  const websiteUrl = 'https://www.chefsplace.online';
  const qrCodeDataURL = await QRCode.toDataURL(websiteUrl, {
    width: 120,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Cairo', sans-serif; direction: rtl; background: white; color: #000; font-size: 14px; line-height: 1.6; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 4px solid #D4AF37; padding-bottom: 25px; background: linear-gradient(135deg, #FFF8DC, #FFFBEB); border-radius: 15px 15px 0 0; padding: 25px 20px; }
        h1 { font-size: 36px; color: #B8860B; margin: 0; font-weight: bold; }
        h2 { color: #D4AF37; font-size: 24px; margin-bottom: 15px; font-weight: bold; text-align: center; }
        h3 { color: #D4AF37; font-size: 18px; margin-bottom: 10px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: right; border: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
        .total { font-size: 18px; font-weight: bold; color: #D4AF37; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; border-top: 4px solid #D4AF37; background: linear-gradient(135deg, #FFF8DC, #FFFBEB); }
        .info-box { background: linear-gradient(135deg, #FFF8DC, #FFFBEB); padding: 15px; border-radius: 10px; border: 2px solid #D4AF37; margin-bottom: 20px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .label { font-weight: bold; color: #8B6F47; }
        .value { font-weight: bold; color: #D4AF37; }
        img { border: 3px solid #D4AF37; border-radius: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="flex:1; text-align:center;">
          <h1>مكان الشيف البخاري</h1>
          <p style="color:#8B6F47; font-size:16px; margin:8px 0; font-weight:600;">تجربة قهوة استثنائية</p>
          <p style="color:#666; font-size:14px; font-style:italic;">"لكل لحظة قهوة ، لحظة نجاح"</p>
        </div>
        <div style="text-align:center; padding:0 20px;">
          <img src="${qrCodeDataURL}" alt="QR" width="100" height="100" />
          <p style="margin:5px 0 0; color:#8B6F47; font-size:11px; font-weight:bold;">امسح للوصول للموقع</p>
        </div>
      </div>

      <h2>فاتورة استلام الطلب</h2>

      <div class="info-box">
        <div class="row"><span class="label">اسم العميل:</span><span class="value">${(order.customerInfo as any)?.customerName || 'غير محدد'}</span></div>
        <div class="row"><span class="label">رقم الطلب:</span><span class="value">${order.orderNumber}</span></div>
        <div class="row"><span class="label">التاريخ:</span><span>${new Date(order.createdAt).toLocaleDateString('ar-SA')}</span></div>
        <div class="row"><span class="label">الوقت:</span><span>${new Date(order.createdAt).toLocaleTimeString('ar-SA')}</span></div>
      </div>

      <h3>تفاصيل الطلب</h3>
      <table>
        <thead>
          <tr><th>المنتج</th><th style="text-align:center;">الكمية</th><th style="text-align:center;">السعر</th><th style="text-align:center;">المجموع</th></tr>
        </thead>
        <tbody>
          ${cartItems.map(item => `
            <tr>
              <td>${item.coffeeItem?.nameAr || 'غير محدد'}</td>
              <td style="text-align:center;">${item.quantity}</td>
              <td style="text-align:center;">${item.coffeeItem?.price || '0'} ريال</td>
              <td style="text-align:center;">${(parseFloat(item.coffeeItem?.price || '0') * item.quantity).toFixed(2)} ريال</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin:20px 0; padding:15px; background:#f8f9fa; border-radius:8px;">
        <div class="row"><span style="font-weight:bold;font-size:16px;">إجمالي المبلغ:</span><span class="total">${order.totalAmount} ريال</span></div>
      </div>

      <h3>طريقة الدفع</h3>
      <div class="info-box">
        <div class="row"><span class="label">الطريقة:</span><span>${paymentMethodNames[paymentMethod] || paymentMethod}</span></div>
        <div class="row"><span class="label">التفاصيل:</span><span>${paymentDetails[paymentMethod] || ''}</span></div>
      </div>

      <div class="info-box">
        <h3>معلومات التواصل</h3>
        <p style="text-align:center;"><strong>الهاتف:</strong> +966536558528</p>
        <p style="text-align:center;"><strong>الموقع الإلكتروني:</strong> www.chefsplace.online</p>
      </div>

      <div class="footer">
        <p style="font-size:18px; font-weight:bold; color:#B8860B;">شكراً لاختياركم مكان الشيف البخاري</p>
        <p style="font-style:italic; color:#8B6F47;">"لكل لحظة قهوة ، لحظة نجاح"</p>
        <p style="font-size:12px; color:#888;">${new Date().toLocaleDateString('ar-SA')} | ${new Date().toLocaleTimeString('ar-SA')}</p>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  return blob;
};

declare global {
  interface Window {
    html2canvas?: any;
    jsPDF?: any;
  }
}

export const loadPDFLibraries = async (): Promise<void> => {
  // Libraries loaded via CDN if needed
};
