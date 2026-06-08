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

// Simple PDF generation using browser APIs and HTML canvas
export const generatePDF = async (
 order: Order,
 cartItems: CartItem[],
 paymentMethod: PaymentMethod
): Promise<Blob> => {
 // Generate QR code for website URL
 const websiteUrl = 'https://www.chefsplace.online';
 const qrCodeDataURL = await QRCode.toDataURL(websiteUrl, {
 width: 120,
 margin: 2,
 color: {
 dark: '#000000',
 light: '#FFFFFF'
 }
 });

 // Create a temporary div for PDF content
 const content = document.createElement('div');
 content.style.cssText = `
 width: 600px;
 padding: 40px;
 font-family: 'Cairo', sans-serif;
 direction: rtl;
 background: white;
 color: #000;
 font-size: 14px;
 line-height: 1.6;
 `;

  const paymentMethodNames: any = {
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

  const paymentDetails: any = {
    cash: 'دفع نقدي',
    pos: 'جهاز نقاط البيع',
    'pos-network': 'جهاز نقاط البيع',
    card: 'جهاز نقاط البيع',
    delivery: 'ادفع عند استلام الطلب',
    stc: '+966566507666',
    alinma: '+966566507666',
    ur: '+966566507666',
    barq: '+966566507666',
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

 content.innerHTML = `
 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 4px solid #D4AF37; padding-bottom: 25px; background: linear-gradient(135deg, #FFF8DC, #FFFBEB); border-radius: 15px 15px 0 0; padding: 25px 20px;">
 <div style="flex: 1; text-align: center;">
 <h1 style="font-family: 'Amiri', serif; font-size: 42px; color: #B8860B; margin: 0; font-weight: bold; text-shadow: 2px 2px 4px rgba(184, 134, 11, 0.2);">
  مكان الشيف البخاري 
 </h1>
 <p style="color: #8B6F47; font-size: 18px; margin: 12px 0 8px 0; font-weight: 600;"> تجربة قهوة استثنائية </p>
 <p style="color: #666; font-size: 16px; margin: 8px 0 0 0; font-style: italic; font-weight: 500;">
 "لكل لحظة قهوة ، لحظة نجاح"
 </p>
 </div>
 <div style="text-align: center; padding: 0 25px;">
 <img src="${qrCodeDataURL}" alt="QR Code" style="width: 110px; height: 110px; border: 3px solid #D4AF37; border-radius: 12px; box-shadow: 0 4px 8px rgba(212, 175, 55, 0.3);" />
 <p style="margin: 10px 0 0 0; color: #8B6F47; font-size: 11px; font-weight: bold;">
  امسح للوصول للموقع
 </p>
 </div>
 </div>

 <div style="margin-bottom: 30px;">
 <h2 style="color: #D4AF37; font-size: 28px; margin-bottom: 15px; font-weight: bold; text-align: center; background: linear-gradient(135deg, #D4AF37, #F4D03F); -webkit-background-clip: text; color: transparent; text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.3);"> فاتورة استلام الطلب </h2>
 
 <div style="background: linear-gradient(135deg, #FFF8DC, #FFFBEB); padding: 20px; border-radius: 12px; border: 2px solid #D4AF37; margin-bottom: 20px;">
 <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
 <span style="font-weight: bold; color: #8B6F47;">‍ اسم العميل:</span>
 <span style="font-weight: bold; color: #D4AF37; font-size: 18px;">${(order.customerInfo as any)?.customerName || 'غير محدد'}</span>
 </div>
 <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
 <span style="font-weight: bold; color: #8B6F47;"> رقم الطلب:</span>
 <span style="font-weight: bold; color: #D4AF37; font-size: 16px;">${order.orderNumber}</span>
 </div>
 <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
 <span style="font-weight: bold; color: #8B6F47;"> التاريخ :</span>
 <span>${new Date(order.createdAt).toLocaleDateString('ar-SA')}</span>
 </div>
 <div style="display: flex; justify-content: space-between;">
 <span style="font-weight: bold; color: #8B6F47;"> الوقت:</span>
 <span>${new Date(order.createdAt).toLocaleTimeString('ar-SA')}</span>
 </div>
 </div>
 </div>

 <div style="margin-bottom: 30px;">
 <h3 style="color: #D4AF37; font-size: 20px; margin-bottom: 15px; font-weight: bold;">تفاصيل الطلب</h3>
 <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
 <thead>
 <tr style="background-color: #f8f9fa;">
 <th style="padding: 12px; text-align: right; border: 1px solid #ddd; font-weight: bold;">المنتج</th>
 <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold;">الكمية </th>
 <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold;">السعر</th>
 <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold;">المجموع</th>
 </tr>
 </thead>
 <tbody>
 ${cartItems.map(item => `
 <tr>
 <td style="padding: 12px; border: 1px solid #ddd;">${item.coffeeItem?.nameAr || 'غير محدد'}</td>
 <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.quantity}</td>
 <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.coffeeItem?.price || '0'} ريال</td>
 <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${(parseFloat(item.coffeeItem?.price || '0') * item.quantity).toFixed(2)} ريال</td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>

 <div style="margin-bottom: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
 <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 18px;">
 <span style="font-weight: bold;">إجمالي المبلغ:</span>
 <span style="font-weight: bold; color: #D4AF37; font-size: 20px;">${order.totalAmount} ريال</span>
 </div>
 </div>

 <div style="margin-bottom: 30px;">
 <h3 style="color: #D4AF37; font-size: 20px; margin-bottom: 15px; font-weight: bold;">طريقة الدفع</h3>
 <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
 <span style="font-weight: bold;">الطريقة :</span>
 <span>${paymentMethodNames[paymentMethod]}</span>
 </div>
 <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
 <span style="font-weight: bold;">التفاصيل:</span>
 <span>${paymentDetails[paymentMethod]}</span>
 </div>
 </div>

 <!-- Company Information -->
 <div style="margin-bottom: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #D4AF37;">
 <h3 style="color: #D4AF37; font-size: 18px; margin-bottom: 15px; font-weight: bold;">معلومات التواصل</h3>
 <div style="text-align: center; font-size: 14px;">
 <p style="margin: 0 0 10px 0;"><span style="font-weight: bold;">الهاتف:</span> +966566507666</p>
 <p style="margin: 0 0 10px 0;"><span style="font-weight: bold;">الموقع الإلكتروني:</span> www.chefsplace.online</p>
 </div>
 </div>

 <!-- QR Code Information with Slogan -->
 <div style="margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #FFF8DC, #FFFFE0); border-radius: 12px; border: 2px solid #D4AF37; box-shadow: 0 4px 8px rgba(212, 175, 55, 0.2);">
 <p style="margin: 0 0 15px 0; font-size: 18px; text-align: center; color: #B8860B; font-weight: bold; font-family: 'Amiri', serif;">
  "لكل لحظة قهوة ، لحظة نجاح" 
 </p>
 <p style="margin: 0; font-size: 13px; text-align: center; color: #666; font-weight: 600;">
 <span style="font-weight: bold;"> رمز الاستجابة السريع:</span> يحتوي على رابط موقع مكان الشيف البخاري
 </p>
 <p style="margin: 8px 0 0 0; font-size: 12px; text-align: center; color: #8B6F47;">
 امسح الرمز للوصول إلى <span style="font-weight: bold; color: #D4AF37;">www.chefsplace.online</span> وطلب المزيد من منتجاتنا اللذيذة 
 </p>
 </div>

 <!-- Creative Footer -->
 <div style="text-align: center; margin-top: 35px; padding: 25px; border-top: 4px solid #D4AF37; background: linear-gradient(135deg, #FFF8DC, #FFFBEB); border-radius: 0 0 15px 15px; color: #8B6F47;">
 <p style="margin: 0; font-size: 20px; font-weight: bold; color: #B8860B;"> شكراً لاختياركم مكان الشيف البخاري </p>
 <p style="margin: 8px 0; font-size: 16px; font-style: italic; color: #8B6F47;"> "لكل لحظة قهوة ، لحظة نجاح" </p>
 <p style="margin: 15px 0 5px 0; font-size: 13px; color: #666; font-weight: 500;">
  تم إنشاء فاتورة الاستلام هذه إلكترونياً
 </p>
 <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">
  ${new Date().toLocaleDateString('ar-SA')} |  ${new Date().toLocaleTimeString('ar-SA')}
 </p>
 </div>
 `;

 // Add content to document temporarily
 content.style.position = 'absolute';
 content.style.left = '-9999px';
 document.body.appendChild(content);

 try {
 // Use html2canvas if available, otherwise create a simple text-based PDF
 if (window.html2canvas) {
 const canvas = await window.html2canvas(content, {
 scale: 2,
 useCORS: true,
 allowTaint: true,
 backgroundColor: '#ffffff'
 });

 // Convert canvas to PDF using jsPDF
 const { jsPDF } = await import(/* @vite-ignore */ 'jspdf');
 const pdf = new jsPDF('p', 'mm', 'a4');
 
 const imgData = canvas.toDataURL('image/png');
 const imgWidth = 210; // A4 width in mm
 const pageHeight = 295; // A4 height in mm
 const imgHeight = (canvas.height * imgWidth) / canvas.width;
 let heightLeft = imgHeight;

 let position = 0;

 pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
 heightLeft -= pageHeight;

 while (heightLeft >= 0) {
 position = heightLeft - imgHeight;
 pdf.addPage();
 pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
 heightLeft -= pageHeight;
 }

 return pdf.output('blob');
 } else {
 // Fallback: Create a simple text-based PDF
 const { jsPDF } = await import(/* @vite-ignore */ 'jspdf');
 const pdf = new jsPDF('p', 'mm', 'a4');
 
 // Add Arabic font support if available
 pdf.setFont('helvetica');
 pdf.setFontSize(16);
 
 let yPosition = 20;
 const lineHeight = 7;
 
 // Header
 pdf.text('مكان الشيف البخاري - Coffee Invoice', 105, yPosition, { align: 'center' });
 yPosition += lineHeight * 2;
 
 // Order details
 pdf.setFontSize(12);
 pdf.text(`Order Number: ${order.orderNumber}`, 20, yPosition);
 yPosition += lineHeight;
 pdf.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 20, yPosition);
 yPosition += lineHeight;
 pdf.text(`Time: ${new Date(order.createdAt).toLocaleTimeString()}`, 20, yPosition);
 yPosition += lineHeight * 2;
 
 // Items
 pdf.text('Order Items:', 20, yPosition);
 yPosition += lineHeight;
 
 cartItems.forEach(item => {
 const itemText = `${item.coffeeItem?.nameEn || item.coffeeItem?.nameAr || 'Item'} x${item.quantity} - ${(parseFloat(item.coffeeItem?.price || '0') * item.quantity).toFixed(2)} SAR`;
 pdf.text(itemText, 25, yPosition);
 yPosition += lineHeight;
 });
 
 yPosition += lineHeight;
 pdf.setFontSize(14);
 pdf.text(`Total: ${order.totalAmount} SAR`, 20, yPosition);
 yPosition += lineHeight * 2;
 
 // Payment method
 pdf.setFontSize(12);
 pdf.text(`Payment Method: ${paymentMethodNames[paymentMethod]}`, 20, yPosition);
 yPosition += lineHeight;
 pdf.text(`Details: ${paymentDetails[paymentMethod]}`, 20, yPosition);
 
 return pdf.output('blob');
 }
 } finally {
 // Clean up
 document.body.removeChild(content);
 }
};

// Declare global types for external libraries
declare global {
 interface Window {
 html2canvas?: any;
 jsPDF?: any;
 }
}

// Dynamically load required libraries
export const loadPDFLibraries = async (): Promise<void> => {
 // Load jsPDF
 if (!window.jsPDF) {
 await import(/* @vite-ignore */ 'jspdf');
 }
 
 // Load html2canvas for better PDF generation
 if (!window.html2canvas) {
 try {
 const html2canvas = await import(/* @vite-ignore */ 'html2canvas');
 window.html2canvas = html2canvas.default;
 } catch (error) {
 console.warn('html2canvas not available, using fallback PDF generation');
 }
 }
};

// Initialize libraries on module load
loadPDFLibraries().catch(console.error);
