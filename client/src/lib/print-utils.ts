import QRCode from "qrcode";
import { VAT_RATE } from "@/lib/constants";

// ── ZATCA QR pre-generation cache ────────────────────────────────────────────
// Key: `zatca:${orderNumber}:${total}` → SVG string
// Populated by prewarmZatcaQr() when an order is created, so printing is instant.
const _zatcaQrCache = new Map<string, string>();

/**
 * Pre-generates the ZATCA QR code in the background as soon as an order is
 * created. By the time the cashier clicks "Print", the QR is already cached
 * and buildReceiptPreviewHtml() returns instantly.
 */
export function prewarmZatcaQr(data: {
  orderNumber: string | number;
  total: string | number;
  date?: string;
  vatNumber?: string;
}): void {
  const totalAmount = typeof data.total === 'number' ? data.total : parseFloat(String(data.total).replace(/[^0-9.-]/g, '')) || 0;
  const subtotalBeforeVat = totalAmount / (1 + VAT_RATE);
  const vat = totalAmount - subtotalBeforeVat;
  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const cacheKey = `zatca:${data.orderNumber}:${totalAmount.toFixed(2)}`;
  if (_zatcaQrCache.has(cacheKey)) return;
  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vat.toFixed(2),
  });
  QRCode.toString(zatcaPayload, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' })
    .then(svgStr => {
      const svg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
      _zatcaQrCache.set(cacheKey, svg);
    })
    .catch(() => {});
}

/**
 * Formats an order number for employee display: #0042
 * Pads the numeric part to at least 4 digits with # prefix.
 */
export function fmtOrderNum(n: string | number): string {
  const str = String(n).trim();
  // Extract only digits for padding
  const digits = str.replace(/\D/g, '');
  if (!digits) return `#${str}`;
  return `#${digits.padStart(4, '0')}`;
}

interface OrderItem {
  coffeeItem: {
    nameAr: string;
    nameEn?: string;
    price: string;
  };
  quantity: number;
  selectedSize?: string;
  itemDiscount?: number;
  customization?: {
    selectedItemAddons?: Array<{ nameAr: string; nameEn?: string; price?: number }>;
    [key: string]: any;
  };
}

/** Returns the correct unit price for an order item.
 *  Prefers a top-level `price` field (stored in DB after our fix),
 *  falls back to coffeeItem.price so old orders still display correctly. */
function getItemUnitPrice(item: OrderItem): number {
  const stored = parseNumber((item as any).price ?? (item as any).unitPrice);
  if (stored > 0) return stored;
  return parseNumber(item.coffeeItem.price);
}

/** Returns the selected size label from top-level or inside customization (employee-cashier compat). */
function getItemSelectedSize(item: OrderItem): string | undefined {
  return item.selectedSize ?? (item as any).customization?.selectedSize ?? undefined;
}

/** Returns the addons array, checking both selectedItemAddons and legacy addons array. */
function getItemAddons(item: OrderItem): Array<{ nameAr: string }> {
  if (item.customization?.selectedItemAddons?.length) return item.customization.selectedItemAddons;
  const legacyAddons = (item as any).customization?.addons;
  if (Array.isArray(legacyAddons) && legacyAddons.length) {
    return legacyAddons.map((a: any) => ({ nameAr: a.nameAr || a.name || String(a) }));
  }
  return [];
}

interface TaxInvoiceData {
  orderNumber: string;
  invoiceNumber?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: string;
  discount?: {
    code: string;
    percentage: number;
    amount: string;
  };
  invoiceDiscount?: number | string;
  total: string;
  paymentMethod: string;
  splitPayment?: { cash: number; card: number };
  cashReceived?: number;
  employeeName: string;
  tableNumber?: string;
  orderType?: string;
  orderTypeName?: string;
  date: string;
  branchName?: string;
  branchAddress?: string;
  crNumber?: string;
  vatNumber?: string;
  carInfo?: { carType?: string; carColor?: string; plateNumber?: string };
  carColor?: string;
  plateNumber?: string;
  notes?: string;
}

interface PrintConfig {
  paperWidth?: '58mm' | '80mm';
  autoClose?: boolean;
  autoPrint?: boolean;
  showPrintButton?: boolean;
}

interface EmployeePrintData {
  employeeName: string;
  employeeId: string;
  employmentNumber: string;
  role: string;
  phone: string;
  branchName?: string;
  qrCode?: string;
}

interface KitchenOrderData {
  orderNumber: string;
  tableNumber?: string;
  items: OrderItem[];
  notes?: string;
  priority?: 'normal' | 'urgent';
  timestamp: string;
}

// ── iframe-based print queue (never touches the main page DOM during print) ──
let _printQueue: Array<{ html: string; paperWidth: string; isFullDoc: boolean }> = [];
let _isPrinting = false;
let _printWatchdog: ReturnType<typeof setTimeout> | null = null;

function _armPrintWatchdog() {
  if (_printWatchdog) clearTimeout(_printWatchdog);
  _printWatchdog = setTimeout(() => {
    if (_isPrinting) {
      console.warn('[Print] Watchdog: print job stuck >20s — resetting queue');
      _isPrinting = false;
      _printWatchdog = null;
      if (_printQueue.length > 0) setTimeout(_drainPrintQueue, 300);
    }
  }, 20000);
}

function _clearPrintWatchdog() {
  if (_printWatchdog) { clearTimeout(_printWatchdog); _printWatchdog = null; }
}

// Arabic-compatible font stack — works without network (system fonts)
const PRINT_FONT_STACK = "'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif";

function _buildFullDoc(html: string, paperWidth: string): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 4px; font-family: ${PRINT_FONT_STACK}; direction: rtl; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    img { max-width: 100%; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * Direct HTML iframe print — fast, accurate, no image conversion.
 * Uses browser's native rendering engine — Arabic text renders perfectly.
 */
async function _printDirectAsync(html: string, paperWidth: string, isFullDoc: boolean): Promise<void> {
  const fullHtml = isFullDoc ? html : _buildFullDoc(html, paperWidth);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // Give it a realistic width so layout matches paper — hidden off-screen
  const renderWidth = paperWidth === '58mm' ? 220 : 302;
  iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${renderWidth}px;height:1px;border:none;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    try { iframe.remove(); } catch {}
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 300);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  const iframeWin = iframe.contentWindow;
  if (!iframeWin) {
    try { iframe.remove(); } catch {}
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 300);
    return;
  }

  // No image waiting — receipts are image-free (SVG inline, text logo)
  // Brief layout settle only
  await new Promise(r => setTimeout(r, 20));

  return new Promise<void>(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        try { iframe.remove(); } catch {}
        resolve();
      }, 200);
    };

    iframeWin.addEventListener('afterprint', finish, { once: true });
    setTimeout(finish, 10000); // safety fallback

    try { iframeWin.focus(); iframeWin.print(); } catch { finish(); }
  });
}

function _drainPrintQueue() {
  if (_isPrinting || _printQueue.length === 0) return;
  _isPrinting = true;
  _armPrintWatchdog();
  const { html, paperWidth, isFullDoc } = _printQueue.shift()!;
  _printDirectAsync(html, paperWidth, isFullDoc)
    .catch(err => console.warn('[Print] Error:', err))
    .finally(() => {
      _clearPrintWatchdog();
      _isPrinting = false;
      if (_printQueue.length > 0) setTimeout(_drainPrintQueue, 80);
    });
}

/**
 * Write a full HTML document into an already-open popup window and auto-print it.
 * If the popup is null (blocked), falls back to the iframe queue.
 */
function _printInPopup(win: Window | null, html: string, delayMs: number): void {
  if (!win || win.closed) {
    // Popup was blocked — fall back to iframe queue
    _printQueue.push({ html, paperWidth: '80mm', isFullDoc: true });
    _drainPrintQueue();
    return;
  }
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    // cross-origin or other write error — silently ignore
  }
  setTimeout(() => {
    try { win.focus(); win.print(); } catch {}
    // Close the popup after printing (or after 8 s if afterprint never fires)
    const close = () => { try { if (!win.closed) win.close(); } catch {} };
    win.addEventListener('afterprint', close, { once: true });
    setTimeout(close, 8000);
  }, delayMs);
}

function openPrintWindow(html: string, _title: string, config: PrintConfig = {}): Window | null {
  const { paperWidth = '80mm', autoPrint = true, showPrintButton = true } = config;

  if (autoPrint) {
    // Determine if the provided HTML is a full document or a fragment
    const isFullDoc = /<html[\s>]/i.test(html);
    _printQueue.push({ html, paperWidth, isFullDoc });
    _drainPrintQueue();
    return null;
  }

  // autoPrint = false → open a popup window with a print button
  const dynamicStyles = `<style>
    @media print { @page { size: ${paperWidth} auto; margin: 0; } body { margin: 0; } .no-print { display: none !important; } }
  </style>`;
  let modifiedHtml = html.replace('</head>', `${dynamicStyles}</head>`);

  const printButtonHtml = showPrintButton ? `
    <div class="no-print" style="text-align:center;margin-top:20px;padding:20px;">
      <button onclick="window.print()" style="padding:12px 32px;font-size:16px;background:#b45309;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-left:10px;">طباعة</button>
      <button onclick="window.close()" style="padding:12px 32px;font-size:16px;background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer;">إغلاق</button>
    </div>` : '';

  if (showPrintButton && !modifiedHtml.includes('<div class="no-print"')) {
    modifiedHtml = modifiedHtml.replace('</body>', `${printButtonHtml}</body>`);
  }

  const printWindow = window.open('', '_blank', 'width=450,height=700,scrollbars=yes,resizable=yes');
  if (printWindow) {
    printWindow.document.write(modifiedHtml);
    printWindow.document.close();
    printWindow.document.title = _title;
  }
  return printWindow;
}

// Export for direct use from manual print buttons (user gesture context)
export function printHtmlInPage(html: string, paperWidth: string = '80mm'): void {
  // receipt-invoice sends raw HTML fragments (not full documents)
  _printQueue.push({ html, paperWidth, isFullDoc: false });
  _drainPrintQueue();
}

/**
 * Print a canvas PNG via a hidden iframe — same pipeline used by printTaxInvoice.
 * Shared helper for shift reports and refund receipts.
 */
function _printCanvasImage(imgSrc: string, paperWidth: '58mm' | '80mm' = '80mm'): void {
  const printFrame = document.createElement('iframe');
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(printFrame);
  const pdoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!pdoc) { try { printFrame.remove(); } catch {} return; }
  pdoc.open();
  pdoc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page { size: ${paperWidth} auto; margin: 0; }
    html,body { margin:0; padding:0; background:#fff; }
    img { width: ${paperWidth}; display: block; margin: 0; padding: 0; }
  </style></head><body><img src="${imgSrc}" /></body></html>`);
  pdoc.close();
  const img = pdoc.querySelector('img') as HTMLImageElement | null;
  let done = false;
  const finish = () => { if (done) return; done = true; setTimeout(() => { try { printFrame.remove(); } catch {} }, 200); };
  const doPrint = () => {
    try { printFrame.contentWindow?.focus(); printFrame.contentWindow?.print(); } catch {}
    printFrame.contentWindow?.addEventListener('afterprint', finish, { once: true });
    setTimeout(finish, 5000);
  };
  if (img && !img.complete) {
    img.onload = () => setTimeout(doPrint, 100);
    img.onerror = () => setTimeout(doPrint, 100);
  } else {
    setTimeout(doPrint, 200);
  }
}

/**
 * Print a shift / Z-report to the configured thermal printer.
 * Falls back to browser print (PDF dialog) only when mode='browser'.
 * `p` is the period/shift object from the shift bar or Z-report.
 */
export async function printShiftThermal(p: {
  periodLabel?: string;
  isOngoing?: boolean;
  windowStart?: string;
  windowEnd?: string;
  totalOrders: number;
  totalSales: number;
  totalCash?: number;
  totalCard?: number;
  totalCashSales?: number;
  totalCardSales?: number;
  paymentBreakdown?: Record<string, number>;
  productsByCategory?: Array<{ categoryNameAr: string; items: Array<{ nameAr: string; quantity: number }> }>;
  // Z-report / manual shift fields
  shiftNumber?: string;
  employeeName?: string;
  openedAt?: string;
  closedAt?: string;
  reportTitle?: string;
}, bizName = 'مكان الشيف البخاري'): Promise<void> {
  const { loadPrinterSettings, buildShiftReportEscPos, buildShiftReportCanvas, thermalPrint } = await import('./thermal-printer');
  const ps = loadPrinterSettings();

  const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
  const fmtD = (iso?: string) => iso ? new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  const startIso = p.openedAt || p.windowStart;
  const endIso   = p.closedAt  || p.windowEnd;
  const totalCash = p.totalCash ?? p.totalCashSales ?? (p.paymentBreakdown?.cash ?? 0);
  const totalCard = p.totalCard ?? p.totalCardSales ?? ((p.paymentBreakdown?.card ?? 0) + (p.paymentBreakdown?.network ?? 0));
  const totalLoyalty = p.paymentBreakdown?.loyalty ?? 0;

  const opts = {
    shopName: bizName,
    reportTitle: p.reportTitle ?? (p.shiftNumber ? 'تقرير Z — إغلاق الوردية' : (p.isOngoing ? 'تقرير وردية جارية' : 'تقرير وردية مكتملة')),
    shiftNumber: p.shiftNumber,
    dateLabel: fmtD(startIso),
    periodLabel: p.periodLabel,
    fromTime: fmtT(startIso),
    toTime: p.isOngoing ? 'جارية...' : fmtT(endIso),
    cashierName: p.employeeName,
    totalOrders: p.totalOrders || 0,
    totalSales: p.totalSales || 0,
    totalCash,
    totalCard,
    totalLoyalty,
    productsByCategory: p.productsByCategory,
    paperWidth: ps.paperWidth as '58mm' | '80mm',
  };

  const escData = await buildShiftReportEscPos(opts);
  const result = await thermalPrint(escData, '', ps.paperWidth as '58mm' | '80mm');

  if (!result.success) {
    // Thermal failed — fall back: Canvas → PNG → iframe (same pipeline as receipts)
    const canvas = await buildShiftReportCanvas(opts);
    const imgSrc = canvas.toDataURL('image/png');
    _printCanvasImage(imgSrc, ps.paperWidth as '58mm' | '80mm');
  }
}

/**
 * Print a refund / credit-note receipt to the configured thermal printer.
 * Falls back to browser print (Canvas → PNG → iframe) when thermal is unavailable.
 */
export async function printRefundThermal(opts: {
  shopName?: string;
  refundId: string;
  originalOrderNumber: string | number;
  items: Array<{ nameAr: string; nameEn?: string; quantity: number; unitPrice: number; subtotal: number }>;
  refundAmount: number;
  paymentMethod: 'cash' | 'card' | 'split';
  cashAmount?: number;
  cardAmount?: number;
  reason: string;
  employeeName?: string;
  date: string;
  originalPaymentMethod?: string;
}): Promise<void> {
  const { loadPrinterSettings, buildRefundEscPos, buildRefundCanvas, thermalPrint } = await import('./thermal-printer');
  const ps = loadPrinterSettings();

  const refundOpts = {
    shopName: opts.shopName || COMPANY_NAME,
    refundId: opts.refundId,
    originalOrderNumber: opts.originalOrderNumber,
    items: opts.items,
    refundAmount: opts.refundAmount,
    paymentMethod: opts.paymentMethod,
    cashAmount: opts.cashAmount,
    cardAmount: opts.cardAmount,
    reason: opts.reason,
    employeeName: opts.employeeName,
    date: opts.date,
    originalPaymentMethod: opts.originalPaymentMethod,
    paperWidth: ps.paperWidth as '58mm' | '80mm',
  };

  // Try hardware thermal first
  if (ps.enabled && ps.mode !== 'browser') {
    try {
      const escData = await buildRefundEscPos(refundOpts);
      const result = await thermalPrint(escData, '', ps.paperWidth as '58mm' | '80mm');
      if (result.success) return;
    } catch (e) {
      console.warn('[printRefundThermal] Hardware print failed:', e);
    }
  }

  // Browser print fallback: Canvas → PNG → iframe
  const canvas = await buildRefundCanvas(refundOpts);
  _printCanvasImage(canvas.toDataURL('image/png'), ps.paperWidth as '58mm' | '80mm');
}

export async function printEmployeeCard(data: EmployeePrintData): Promise<void> {
  let qrCodeSvg = "";
  if (data.qrCode) {
    try {
      const svgStr = await QRCode.toString(data.qrCode, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' });
      qrCodeSvg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>بطاقة الموظف - ${data.employeeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #000; direction: rtl; }
    .card { margin: 20px auto; padding: 24px; border: 2px solid #333; border-radius: 12px; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 16px; margin-bottom: 16px; }
    .company-name { font-size: 20px; font-weight: 700; color: #b45309; }
    .employee-title { font-size: 12px; color: #666; margin-top: 4px; }
    .employee-name { font-size: 18px; font-weight: 700; margin: 16px 0 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .info-label { color: #666; }
    .info-value { font-weight: 600; }
    .qr-section { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 2px dashed #333; }
    .qr-section img { width: 100px; height: 100px; }
    .qr-note { font-size: 10px; color: #888; margin-top: 8px; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="company-name">مكان الشيف البخاري</div>
      <div class="employee-title">بطاقة تعريف الموظف</div>
    </div>
    <div class="employee-name">${data.employeeName}</div>
    <div class="info-row"><span class="info-label">رقم الموظف:</span><span class="info-value">${data.employmentNumber}</span></div>
    <div class="info-row"><span class="info-label">المنصب:</span><span class="info-value">${data.role}</span></div>
    <div class="info-row"><span class="info-label">الجوال:</span><span class="info-value">${data.phone}</span></div>
    ${data.branchName ? `<div class="info-row"><span class="info-label">الفرع:</span><span class="info-value">${data.branchName}</span></div>` : ''}
    ${qrCodeSvg ? `
    <div class="qr-section">
      ${qrCodeSvg}
      <div class="qr-note">امسح للتسجيل السريع</div>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `;
  openPrintWindow(html, `بطاقة الموظف - ${data.employeeName}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: true });
}

export async function printKitchenOrder(data: KitchenOrderData): Promise<void> {
  const itemsHtml = data.items.map(item => `
    <div style="padding: 8px 0; border-bottom: 1px dashed #ccc; display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="flex: 1; padding-left: 8px; font-size: 16px;">
        ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
      </div>
      <div style="font-size: 24px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; flex-shrink: 0;">x${item.quantity}</div>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>طلب المطبخ - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ticket { margin: 0 auto; padding: 16px; }
    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .order-number { font-size: 28px; font-weight: 700; }
    .urgent { background: #dc2626; color: #fff; padding: 4px 12px; border-radius: 4px; display: inline-block; margin-top: 8px; animation: blink 1s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .table-info { font-size: 20px; font-weight: 700; color: #b45309; margin-top: 8px; }
    .timestamp { font-size: 12px; color: #666; }
    .items { margin: 16px 0; }
    .notes { background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 14px; }
    .notes-label { font-weight: 700; color: #92400e; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <div class="order-number">${fmtOrderNum(data.orderNumber)}</div>
      ${data.priority === 'urgent' ? '<div class="urgent">عاجل!</div>' : ''}
      ${data.tableNumber ? `<div class="table-info">طاولة ${data.tableNumber}</div>` : ''}
      <div class="timestamp">${data.timestamp}</div>
    </div>
    <div class="items">${itemsHtml}</div>
    ${data.notes ? `<div class="notes"><span class="notes-label">ملاحظات:</span> ${data.notes}</div>` : ''}
  </div>
</body>
</html>
  `;
  openPrintWindow(html, `طلب المطبخ - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true, autoClose: true, showPrintButton: false });
}

const VAT_NUMBER = "310894802100003";
const COMPANY_NAME = "مكان الشيف البخاري";
const COMPANY_NAME_EN = "مكان الشيف البخاري";
const COMPANY_CR = "7025559423";
const COMPANY_WEBSITE = "chefsplace.online";
const DEFAULT_BRANCH = "فرع المروج، الرياض";
const DEFAULT_ADDRESS = "الرياض، المملكة العربية السعودية";

function generateZATCAQRCode(data: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatAmount: string;
}): string {
  const tlv = (tag: number, value: string): Uint8Array => {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(value);
    const result = new Uint8Array(2 + valueBytes.length);
    result[0] = tag;
    result[1] = valueBytes.length;
    result.set(valueBytes, 2);
    return result;
  };

  const sellerNameTLV = tlv(1, data.sellerName);
  const vatNumberTLV = tlv(2, data.vatNumber);
  const timestampTLV = tlv(3, data.timestamp);
  const totalWithVatTLV = tlv(4, data.totalWithVat);
  const vatAmountTLV = tlv(5, data.vatAmount);

  const combined = new Uint8Array(
    sellerNameTLV.length + vatNumberTLV.length + timestampTLV.length + 
    totalWithVatTLV.length + vatAmountTLV.length
  );

  let offset = 0;
  combined.set(sellerNameTLV, offset); offset += sellerNameTLV.length;
  combined.set(vatNumberTLV, offset); offset += vatNumberTLV.length;
  combined.set(timestampTLV, offset); offset += timestampTLV.length;
  combined.set(totalWithVatTLV, offset); offset += totalWithVatTLV.length;
  combined.set(vatAmountTLV, offset);

  let binary = '';
  combined.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function renderItemName(nameAr: string, nameEn?: string): string {
  if (!nameEn || nameEn.trim() === '' || nameEn.trim() === nameAr.trim()) {
    return `<span style="font-weight:600;">${nameAr}</span>`;
  }
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
    <span style="direction:ltr;text-align:left;font-size:10px;color:#444;flex:1;word-break:break-word;">${nameEn}</span>
    <span style="direction:rtl;text-align:right;font-weight:600;flex:1;word-break:break-word;">${nameAr}</span>
  </div>`;
}

export async function printUnifiedReceipt(data: TaxInvoiceData): Promise<void> {
  // Delegate to the fully featured printTaxInvoice which handles two separate print jobs
  await printTaxInvoice(data, { autoPrint: true });
}

/**
 * Fast Canvas 2D receipt → ESC/POS bytes.
 * Same engine as kitchen tickets — no html2canvas, no PNG conversion, instant.
 * QR codes generated in parallel before rendering begins.
 */
async function _buildFastCustomerEscPos(
  data: TaxInvoiceData,
  orderTypeThermal: string,
  paperWidth: '58mm' | '80mm',
  feedLines: number,
): Promise<Uint8Array> {
  const { buildReceiptBitmapEscPos } = await import('./thermal-printer');

  const totalAmount = parseNumber(data.total);
  const subtotalBeforeVat = totalAmount / (1 + VAT_RATE);
  const vatAmount = totalAmount - subtotalBeforeVat;
  const disc = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;

  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);

  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
  });

  // Generate both QR codes in parallel — ~50ms total
  // Use plain daily-number in tracking URL so the QR has no %23 encoding issues
  const trackingNum = String(data.orderNumber).replace(/\D/g, '') || String(data.orderNumber);
  const [trackingQr, zatcaQr] = await Promise.all([
    (async () => {
      try {
        const url = `${window.location.origin}/track/${trackingNum}`;
        return await QRCode.toDataURL(url, { width: 180, margin: 1, errorCorrectionLevel: 'M' });
      } catch { return ''; }
    })(),
    (async () => {
      try {
        return await QRCode.toDataURL(zatcaPayload, { width: 140, margin: 1, errorCorrectionLevel: 'M' });
      } catch { return ''; }
    })(),
  ]);

  const payLabel = (() => {
    const m = (data.paymentMethod || '').toLowerCase();
    if (m === 'cash') return 'نقدي';
    if (m === 'apple_pay' || m === 'paymob-apple-pay' || m === 'neoleap-apple-pay') return 'Apple Pay';
    if (m === 'stc-pay' || m === 'stc_pay') return 'STC Pay';
    if (m === 'mada') return 'مدى';
    if (m === 'card' || m === 'network' || m === 'pos' || m === 'pos-network') return 'شبكة';
    if (m === 'loyalty' || m.includes('qirox') || m.includes('qahwa') || m === 'loyalty-card') return 'بطاقة ولاء';
    if (m === 'geidea' || m === 'paymob-card' || m === 'paymob') return 'بطاقة ائتمان';
    if (m === 'bank_transfer' || m === 'rajhi' || m === 'alinma') return 'تحويل بنكي';
    if (m === 'split') return 'نقدي + شبكة';
    return data.paymentMethod || 'غير محدد';
  })();

  return buildReceiptBitmapEscPos({
    shopName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    branchName: data.branchName || DEFAULT_BRANCH,
    orderNumber: data.orderNumber,
    orderDate: `${fmtDate} · ${fmtTime}`,
    cashierName: data.employeeName || '—',
    customerName: data.customerName && data.customerName !== 'عميل نقدي' ? data.customerName : undefined,
    tableNumber: data.tableNumber,
    orderType: orderTypeThermal || undefined,
    items: data.items.map(item => ({
      name: item.coffeeItem.nameAr,
      nameEn: (item.coffeeItem as any).nameEn || '',
      qty: item.quantity,
      price: getItemUnitPrice(item),
      addons: [
        ...(getItemSelectedSize(item) ? [`الحجم: ${getItemSelectedSize(item)}`] : []),
        ...getItemAddons(item).map((a: any) => a.nameAr),
      ].filter(Boolean),
    })),
    subtotal: subtotalBeforeVat,
    vat: vatAmount,
    total: totalAmount,
    discount: disc > 0 ? disc : undefined,
    splitPayment: data.splitPayment,
    paymentMethod: payLabel,
    ...(data.cashReceived ? { cashReceived: data.cashReceived } : {}),
    logoDataUrl: '/logo.png',
    trackingQrDataUrl: trackingQr || undefined,
    zatcaQrDataUrl: zatcaQr || undefined,
    paperWidth,
    feedLines,
  });
}

/**
 * Fast section-specific print: customer receipt only, kitchen ticket only, or both.
 * Routes through thermal printer when configured — falls back to browser HTML print.
 */
export async function printReceiptSection(
  data: TaxInvoiceData,
  section: 'customer' | 'kitchen' | 'both' = 'customer',
): Promise<void> {
  // ── Try thermal path first (ESC/POS) ─────────────────────────────────────
  try {
    const {
      loadPrinterSettings, thermalPrint,
      buildEscPosKitchenTicketBitmap, getProfilesForRole, thermalPrintWithProfile,
    } = await import('./thermal-printer');
    const ps = loadPrinterSettings();

    if (ps.enabled && ps.mode !== 'browser') {
      const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
      const orderTypeThermal =
        orderTypeStr === 'dine_in'    || orderTypeStr === 'dine-in'   ? 'محلي' :
        orderTypeStr === 'takeaway'   || orderTypeStr === 'pickup'    ? 'سفري' :
        orderTypeStr === 'delivery'                                    ? 'توصيل' :
        orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'استلام بالسيارة' :
        orderTypeStr || 'محلي';

      const carNote = (orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup')
        ? [
            data.carInfo?.carType,
            data.carInfo?.carColor || data.carColor,
            (data.carInfo?.plateNumber || data.plateNumber) ? `لوحة: ${data.carInfo?.plateNumber || data.plateNumber}` : '',
          ].filter(Boolean).join(' | ')
        : undefined;

      const receiptProfiles = getProfilesForRole('receipt');
      const kitchenProfiles = getProfilesForRole('kitchen');

      // ── Customer copy — Canvas 2D bitmap (instant, same engine as kitchen tickets) ──
      if (section === 'customer' || section === 'both') {
        const escData = await _buildFastCustomerEscPos(data, orderTypeThermal, ps.paperWidth as '58mm' | '80mm', ps.feedLines ?? 4);

        if (receiptProfiles.length > 0) {
          for (const profile of receiptProfiles) {
            await thermalPrintWithProfile(escData, profile);
          }
        } else {
          await thermalPrint(escData, '', ps.paperWidth);
        }
      }

      // ── Kitchen ticket ────────────────────────────────────────────────────
      if (section === 'kitchen' || section === 'both') {
        if (section === 'both') await new Promise(r => setTimeout(r, 1200));
        const kitchenEsc = await buildEscPosKitchenTicketBitmap({
          orderNumber: data.orderNumber,
          tableNumber: data.tableNumber,
          orderType: orderTypeThermal,
          cashierName: data.employeeName || '—',
          items: data.items.map(item => ({
            name: item.coffeeItem.nameAr,
            nameEn: (item.coffeeItem as any).nameEn || '',
            qty: item.quantity,
            addons: [
              ...(getItemSelectedSize(item) ? [`الحجم: ${getItemSelectedSize(item)}`] : []),
              ...getItemAddons(item).map((a: any) => a.nameAr),
            ],
          })),
          notes: [carNote, data.notes].filter(Boolean).join(' | ') || undefined,
          paperWidth: ps.paperWidth,
        });

        if (kitchenProfiles.length > 0) {
          for (const profile of kitchenProfiles) {
            await thermalPrintWithProfile(kitchenEsc, profile);
          }
        } else {
          await thermalPrint(kitchenEsc, '', ps.paperWidth);
        }
      }

      return; // thermal done ✓
    }
  } catch (e) {
    console.warn('[printReceiptSection] Thermal error, falling back to browser:', e);
  }

  // ── Browser HTML fallback ─────────────────────────────────────────────────
  if (section === 'customer' || section === 'both') {
    const customerHtml = await buildReceiptPreviewHtml(data);
    _printQueue.push({ html: customerHtml, paperWidth: '80mm', isFullDoc: true });
  }
  if (section === 'kitchen' || section === 'both') {
    const kitchenHtml = buildEmployeeReceiptPreviewHtml(data);
    _printQueue.push({ html: kitchenHtml, paperWidth: '80mm', isFullDoc: true });
  }
  _drainPrintQueue();
}

/**
 * Opens a side-by-side preview window with Customer + Kitchen receipts,
 * each with its own "Print" button. No auto-print — purely for review.
 */
export async function openReceiptPreviewWindow(data: TaxInvoiceData): Promise<void> {
  const orderNumDisplay = fmtOrderNum(data.orderNumber);

  // Open window SYNCHRONOUSLY first (before any await) so mobile browsers
  // don't treat it as a popup — the user gesture chain must not be broken.
  const win = window.open('', '_blank', 'width=900,height=900,scrollbars=yes,resizable=yes');
  if (!win) {
    // Popup blocked — fall back to inline print dialog
    await printReceiptSection(data, 'both');
    return;
  }

  // Now we can safely await async work
  const customerHtml = await buildReceiptPreviewHtml(data);
  const kitchenHtml = buildEmployeeReceiptPreviewHtml(data);
  // HTML-escape the order number for safe interpolation in the static shell.
  const safeOrderNum = String(orderNumDisplay).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

  // Static shell — contains ZERO untrusted data. Receipt HTML is injected
  // into iframe `srcdoc` from the opener side (no inline script needed).
  const wrapperHtml = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>معاينة فواتير الطلب #${safeOrderNum}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Cairo',Tahoma,Arial,sans-serif;background:#e8e8e8;padding:18px;text-align:center;color:#222;}
  .topbar{margin-bottom:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:center;}
  h2{font-size:18px;font-weight:900;margin-left:auto;margin-right:auto;color:#111;}
  .btn{padding:11px 22px;font-size:13px;border:none;border-radius:10px;cursor:pointer;font-weight:800;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,.1);}
  .btn-cust{background:#1e40af;color:#fff;}
  .btn-kit{background:#b45309;color:#fff;}
  .btn-both{background:#111;color:#fff;}
  .btn-close{background:#6b7280;color:#fff;}
  .frames{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;align-items:flex-start;}
  .col{display:flex;flex-direction:column;align-items:center;gap:10px;}
  .label{font-size:13px;font-weight:800;color:#222;background:#fff;padding:6px 18px;border-radius:20px;border:2px solid #ccc;}
  iframe{border:none;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);background:#fff;}
  @media print{
    body{background:#fff;padding:0;}
    .topbar,.label{display:none!important;}
    .frames{display:block;}
    .col{display:block;page-break-after:always;}
    .col:last-child{page-break-after:auto;}
    iframe{box-shadow:none;border-radius:0;width:80mm!important;height:auto!important;}
    @page{size:80mm auto;margin:0;}
  }
</style></head><body>
<div class="topbar">
  <h2>📄 معاينة فواتير الطلب #${safeOrderNum}</h2>
  <button class="btn btn-cust" id="btn-cust">🖨️ طباعة فاتورة العميل</button>
  <button class="btn btn-kit"  id="btn-kit">🍳 طباعة المطبخ</button>
  <button class="btn btn-both" id="btn-both">🖨️ طباعة الكل</button>
  <button class="btn btn-close" id="btn-close">✕ إغلاق</button>
</div>
<div class="frames">
  <div class="col">
    <div class="label">📄 نسخة العميل</div>
    <iframe id="cust" width="340" height="760" sandbox="allow-same-origin allow-modals"></iframe>
  </div>
  <div class="col">
    <div class="label">🍳 نسخة المطبخ</div>
    <iframe id="kit"  width="340" height="760" sandbox="allow-same-origin allow-modals"></iframe>
  </div>
</div>
</body></html>`;

  win.document.open();
  win.document.write(wrapperHtml);
  win.document.close();

  // Inject receipt HTML safely via srcdoc (no script-context interpolation),
  // and wire buttons from this side — no untrusted text touches inline JS.
  const wireUp = () => {
    try {
      const doc = win.document;
      const custEl = doc.getElementById('cust') as HTMLIFrameElement | null;
      const kitEl  = doc.getElementById('kit')  as HTMLIFrameElement | null;
      if (custEl) custEl.srcdoc = customerHtml;
      if (kitEl)  kitEl.srcdoc  = kitchenHtml;
      doc.getElementById('btn-cust')?.addEventListener('click', () => {
        try { custEl?.contentWindow?.focus(); custEl?.contentWindow?.print(); } catch {}
      });
      doc.getElementById('btn-kit')?.addEventListener('click', () => {
        try { kitEl?.contentWindow?.focus(); kitEl?.contentWindow?.print(); } catch {}
      });
      doc.getElementById('btn-both')?.addEventListener('click', () => {
        try { win.focus(); win.print(); } catch {}
      });
      doc.getElementById('btn-close')?.addEventListener('click', () => {
        try { win.close(); } catch {}
      });
    } catch (e) {
      console.warn('[openReceiptPreviewWindow] wireUp error:', e);
    }
  };
  // Run after document.write settles
  setTimeout(wireUp, 30);
}

export async function printBulkEmployeeInvoices(orders: any[]): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    .invoice-page { width: 80mm; padding: 10px; border-bottom: 2px dashed #000; page-break-after: always; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; }
    .content { margin-top: 10px; }
    .row { display: flex; justify-content: space-between; margin: 5px 0; }
    .total { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
  </style>
</head>
<body>
  ${orders.map(order => {
    const d = new Date(order.createdAt);
    const dateStr = d.toLocaleDateString('ar-SA');
    const timeStr = d.toLocaleTimeString('ar-SA');
    return `
    <div class="invoice-page">
      <div class="header">
        <h3>ملخص طلب موظف</h3>
        <div>رقم الطلب: ${fmtOrderNum(order.orderNumber)}</div>
        <div>التاريخ: ${dateStr} ${timeStr}</div>
      </div>
      <div class="content">
        ${(order.items || []).map((item: any) => `
          <div class="row">
            <span>${item.name || item.coffeeItem?.nameAr}</span>
            <span>${item.quantity}</span>
          </div>
        `).join('')}
        <div class="row total">
          <span>الإجمالي:</span>
          <span>${order.totalAmount} ر.س</span>
        </div>
      </div>
    </div>
    `;
  }).join('')}
</body>
</html>
  `;
  openPrintWindow(html, `Bulk Employee Invoices`, { paperWidth: '80mm', autoPrint: true });
}

function formatDate(dateStr: string): { date: string; time: string } {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr, time: '' };
    }
    return {
      date: d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      time: d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    };
  } catch {
    return { date: dateStr, time: '' };
  }
}

/** Build a visual HTML receipt for preview — image-free, instant print */
export async function buildReceiptPreviewHtml(data: TaxInvoiceData): Promise<string> {
  const totalAmount = parseNumber(data.total);
  const subtotalBeforeVat = totalAmount / (1 + VAT_RATE);
  const vat = totalAmount - subtotalBeforeVat;
  const disc = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);
  const orderNumDisplay = String(data.orderNumber).replace(/\D/g, '').padStart(4, '0') || data.orderNumber;

  const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
  const orderTypeLabel =
    orderTypeStr === 'dine_in'   || orderTypeStr === 'dine-in'   ? 'محلي' :
    orderTypeStr === 'takeaway'  || orderTypeStr === 'pickup'     ? 'سفري' :
    orderTypeStr === 'delivery'                                   ? 'توصيل' :
    orderTypeStr === 'car_pickup'|| orderTypeStr === 'car-pickup' ? '🚗 سيارة' :
    orderTypeStr;

    // ZATCA QR — inline SVG (zero network, zero image-load wait)
  // Uses pre-warmed cache if available (generated in background when order was created)
  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vat.toFixed(2),
  });
  const cacheKey = `zatca:${data.orderNumber}:${totalAmount.toFixed(2)}`;
  let zatcaQrSvg = _zatcaQrCache.get(cacheKey) || '';
  if (!zatcaQrSvg) {
    try {
      const svgStr = await QRCode.toString(zatcaPayload, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' });
      zatcaQrSvg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
      _zatcaQrCache.set(cacheKey, zatcaQrSvg);
    } catch {}
  }

  const totalQty = data.items.reduce((s, i) => s + (i.quantity || 1), 0);

  const solidLine = `<div style="border-top:2px solid #111;margin:0 10px;"></div>`;
  const dashLine  = `<div style="border-top:1px dashed #bbb;margin:8px 10px;"></div>`;

  // Items — name RIGHT, price LEFT, separator after each item
  const itemsHtml = data.items.map(item => {
    const up = getItemUnitPrice(item);
    const itemDisc = parseNumber(item.itemDiscount);
    const lineTotal = item.quantity * up - itemDisc;
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
    const sz = getItemSelectedSize(item);
    const extra = [sz ? `الحجم: ${sz}` : '', addons ? `+ ${addons}` : ''].filter(Boolean).join(' · ');
    return `
      <div style="padding:6px 10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:13px;line-height:1.7;">
          <span style="direction:ltr;flex-shrink:0;white-space:nowrap;font-weight:600;">﷼ ${lineTotal.toFixed(2)}</span>
          <span style="text-align:right;">
            ${item.coffeeItem.nameAr} &times;${item.quantity}
            ${extra ? `<br/><span style="font-size:11px;color:#666;">${extra}</span>` : ''}
            ${itemDisc > 0 ? `<br/><span style="font-size:11px;color:#16a34a;">خصم -﷼${itemDisc.toFixed(2)}</span>` : ''}
          </span>
        </div>
      </div>
      <div style="border-top:1px dashed #bbb;margin:6px 10px 0;"></div>`;
  }).join('');

  // Car info row (if car pickup)
  const isCarPickup = orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup';
  const carInfoHtml = isCarPickup ? (() => {
    const carType  = data.carInfo?.carType  || '';
    const carColor = data.carInfo?.carColor || data.carColor || '';
    const plate    = data.carInfo?.plateNumber || data.plateNumber || '';
    const parts = [carColor, carType, plate ? `لوحة: ${plate}` : ''].filter(Boolean);
    return parts.length ? `
    <div style="margin:0 10px 4px;background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:7px 10px;font-size:12px;font-weight:700;text-align:center;">
      🚗 ${parts.join(' | ')}
    </div>` : '';
  })() : '';

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Tahoma,Arial,'Segoe UI',sans-serif;direction:rtl;background:#e0ddd8;display:flex;justify-content:center;align-items:flex-start;padding:20px 10px;min-height:100vh;}
.paper{background:#fff;width:300px;box-shadow:0 4px 24px rgba(0,0,0,.22);font-size:13px;color:#111;line-height:1.5;padding-bottom:16px;}
@media print{
  @page{size:80mm auto;margin:0;}
  body{background:#fff!important;padding:0!important;}
  .paper{width:80mm!important;box-shadow:none!important;}
}
</style></head><body><div class="paper">

  <!-- ① مسافة علوية -->
  <div style="height:16px;"></div>

  <!-- ② رقم الطلب -->
  <div style="text-align:center;font-weight:900;font-size:26px;letter-spacing:3px;padding:6px 0 2px;">#${orderNumDisplay}</div>

  <!-- ③ اسم المنشأة + بيانات -->
  <div style="text-align:center;font-size:12px;line-height:1.9;padding:4px 10px 6px;">
    <div style="font-weight:900;font-size:16px;letter-spacing:1px;">${COMPANY_NAME}</div>
    <div style="font-size:11px;color:#555;">الرياض، المملكة العربية السعودية</div>
    <div style="direction:ltr;font-size:11px;color:#555;">${data.vatNumber || VAT_NUMBER}</div>
    <div style="direction:ltr;font-size:11px;">${fmtDate} · ${fmtTime}</div>
  </div>

  ${solidLine}

  <!-- ④ نوع الطلب -->
  <div style="text-align:center;font-size:13px;font-weight:700;padding:6px 0;">
    ${orderTypeLabel || 'طلب'}${data.tableNumber ? ` — طاولة ${data.tableNumber}` : ''}
  </div>

  ${solidLine}

  <!-- ⑤ عنوان الأصناف -->
  <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;font-weight:700;padding:5px 10px 3px;">
    <span>السعر</span><span>الصنف</span>
  </div>
  ${dashLine}

  <!-- ⑥ المنتجات -->
  ${itemsHtml}

  <!-- ⑦ عدد المنتجات -->
  <div style="text-align:center;font-size:12px;color:#444;padding:6px 0 4px;">عدد المنتجات: ${totalQty}</div>
  ${solidLine}

  <!-- ⑧ الحساب -->
  <div style="padding:6px 10px 4px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#555;">
      <span style="direction:ltr;">﷼ ${subtotalBeforeVat.toFixed(2)}</span>
      <span>المجموع قبل الضريبة</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#555;">
      <span style="direction:ltr;">﷼ ${vat.toFixed(2)}</span>
      <span>ضريبة القيمة المضافة 15%</span>
    </div>
    ${disc > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;color:#16a34a;">
      <span style="direction:ltr;">-﷼ ${disc.toFixed(2)}</span><span>الخصم</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;padding:7px 0 4px;border-top:2px solid #111;margin-top:6px;">
      <span style="direction:ltr;">﷼ ${totalAmount.toFixed(2)}</span>
      <span>الإجمالي</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
      <span style="font-weight:700;">${data.paymentMethod}</span>
      <span style="color:#555;">طريقة الدفع</span>
    </div>
    ${data.splitPayment ? `
    <div style="border-top:1px dashed #ccc;margin:4px 0 2px;"></div>
    ${data.splitPayment.cash > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:2px 0;">
      <span style="direction:ltr;">﷼ ${data.splitPayment.cash.toFixed(2)}</span><span>💵 نقدي</span>
    </div>` : ''}
    ${data.splitPayment.card > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:2px 0;">
      <span style="direction:ltr;">﷼ ${data.splitPayment.card.toFixed(2)}</span><span>💳 شبكة</span>
    </div>` : ''}
    <div style="border-top:1px dashed #ccc;margin:2px 0;"></div>` : ''}
    ${(data.cashReceived && data.cashReceived > 0 && !data.splitPayment) ? `
    <div style="border-top:1px dashed #ccc;margin:4px 0 2px;"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#555;padding:2px 0;">
      <span style="direction:ltr;font-weight:600;">﷼ ${data.cashReceived.toFixed(2)}</span><span>المبلغ المستلم</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#16a34a;padding:2px 0;font-weight:700;">
      <span style="direction:ltr;">﷼ ${Math.max(0, data.cashReceived - totalAmount).toFixed(2)}</span><span>↩ الباقي للعميل</span>
    </div>
    <div style="border-top:1px dashed #ccc;margin:2px 0;"></div>` : ''}
  </div>

  ${solidLine}

  <!-- بيانات السيارة (إن وُجدت) -->
  ${carInfoHtml}

  <!-- ملاحظات العميل -->
  ${(data as any).notes ? `
  <div style="margin:6px 10px 0;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;font-size:12px;line-height:1.7;">
    <span style="font-weight:700;color:#92400e;">ملاحظات: </span><span>${(data as any).notes}</span>
  </div>` : ''}

  <!-- الكاشير + شعار -->
  <div style="padding:8px 10px 4px;text-align:center;">
    ${data.employeeName ? `<div style="font-size:12px;color:#555;">تمت خدمتك من قبل: <strong>${data.employeeName}</strong></div>` : ''}
    <div style="font-size:12px;font-weight:800;padding:4px 0;">"قهوة تُقال .. وورد يُهدى"</div>
  </div>

  ${dashLine}

  <!-- Powered by -->
  <div style="text-align:center;font-size:11px;color:#aaa;padding:4px 0 6px;">
    Powered by <strong style="color:#2D9B6E;">QIROX STUDIO</strong>
  </div>


</div></body></html>`;
}

/** Build a visual HTML preview for the employee/kitchen copy — to be shown alongside the customer preview */
export function buildEmployeeReceiptPreviewHtml(data: TaxInvoiceData): string {
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);
  const orderNumDisplay = String(data.orderNumber).replace(/\D/g, '').padStart(4, '0') || data.orderNumber;

  const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
  const orderTypeLabel =
    orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in'
      ? (data.tableNumber ? `محلي — طاولة رقم ${data.tableNumber}` : 'محلي')
      : orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري'
      : orderTypeStr === 'delivery' ? 'توصيل'
      : orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'استلام بالسيارة'
      : orderTypeStr;

  const orderTypeBg =
    orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? '#dc2626' :
    orderTypeStr === 'delivery' ? '#2563eb' :
    orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in' ? '#7c3aed' : '#111';

  const itemsHtml = data.items.map((item, idx) => {
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
    const sz2 = getItemSelectedSize(item);
    return `
      <div style="padding:16px 0 12px 0;${idx > 0 ? 'border-top:2px dashed #bbb;margin-top:4px;' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="font-size:20px;font-weight:800;line-height:1.6;flex:1;">${item.coffeeItem.nameAr}</div>
          <div style="font-size:28px;font-weight:900;background:#111;color:#fff;padding:4px 14px;border-radius:8px;flex-shrink:0;">×${item.quantity}</div>
        </div>
        ${sz2 ? `<div style="font-size:16px;color:#2563eb;margin-top:8px;margin-bottom:6px;padding-right:6px;line-height:1.8;">▸ الحجم: ${sz2}</div>` : ''}
        ${addons ? `<div style="font-size:16px;color:#444;margin-top:8px;padding-right:6px;line-height:1.8;">▸ إضافات: ${addons}</div>` : ''}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;border:0!important;}
hr{display:none!important;}
body{font-family:'Cairo',Tahoma,Arial,sans-serif;direction:rtl;background:#e8e6e0;display:flex;justify-content:center;align-items:flex-start;padding:24px 10px;min-height:100vh;}
.paper{background:#fff;width:320px;box-shadow:0 4px 20px rgba(0,0,0,.2);}
.tape{height:14px;background:repeating-linear-gradient(90deg,#fff 0,#fff 12px,#e8e6e0 12px,#e8e6e0 24px);}
.body{padding:18px 16px;}
.c{text-align:center;}
.gap{height:10px;}
.row{display:flex;justify-content:space-between;padding:10px 0;font-size:16px;border-bottom:1px solid #eee;line-height:1.8;}
@media print{
  @page{size:80mm auto;margin:0;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;border:0!important;}
  hr{display:none!important;}
  body{display:block!important;background:#fff!important;padding:0!important;min-height:0!important;}
  .paper{width:76mm!important;max-width:76mm!important;margin:0!important;box-shadow:none!important;}
  .tape{display:none!important;}
  .body{padding:6px 4px 12px!important;}
}
</style></head><body><div class="paper">
<div class="tape"></div>
<div class="body">

  <!-- 2 blank lines at start of every invoice -->
  <div style="height:36px;"></div>

  <!-- Header -->
  <div class="c" style="font-size:20px;font-weight:900;padding-bottom:8px;border-bottom:3px double #000;">📋 نسخة الموظف / المطبخ</div>
  <div class="gap"></div>
  <div class="c" style="font-size:54px;font-weight:900;letter-spacing:4px;margin:6px 0;">#${orderNumDisplay}</div>

  <!-- Order type badge -->
  ${orderTypeLabel ? `<div class="c" style="margin:6px 0;"><span style="display:inline-block;background:${orderTypeBg};color:#fff;font-size:16px;font-weight:700;padding:5px 18px;border-radius:20px;">${orderTypeLabel}</span></div>` : ''}

  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:18px;"></div>

  <!-- Info rows -->
  <div class="row"><span style="color:#666;">الوقت:</span><span style="font-weight:700;">${fmtTime} — ${fmtDate}</span></div>
  ${data.employeeName ? `<div class="row"><span style="color:#666;">الكاشير:</span><span style="font-weight:700;">${data.employeeName}</span></div>` : ''}
  ${data.tableNumber && !(orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in') ? `<div class="row"><span style="color:#666;">الطاولة:</span><span style="font-weight:900;font-size:18px;">رقم ${data.tableNumber}</span></div>` : ''}

  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:18px;"></div>

  <!-- Items -->
  <div style="font-size:15px;font-weight:700;color:#666;margin-bottom:4px;">الأصناف (${data.items.length} صنف):</div>
  ${itemsHtml}

  <!-- ملاحظات الطلب -->
  ${(data as any).notes ? `
  <div style="height:18px;"></div>
  <div style="border-top:2px solid #000;width:100%;height:0;"></div>
  <div style="height:14px;"></div>
  <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:16px;line-height:1.8;">
    <div style="font-weight:900;color:#92400e;font-size:15px;margin-bottom:4px;">⚠ ملاحظات العميل:</div>
    <div style="font-weight:700;">${(data as any).notes}</div>
  </div>` : ''}

</div>
<div class="tape"></div>
</div></body></html>`;
}

export async function printTaxInvoice(data: TaxInvoiceData, config: PrintConfig = {}): Promise<void> {
  const shouldAutoPrint = config.autoPrint !== undefined ? config.autoPrint : true;

  // ── ESC/POS Thermal printing — Canvas 2D bitmap (instant, same engine as kitchen tickets) ──
  if (shouldAutoPrint) {
    try {
      const { loadPrinterSettings, buildEscPosKitchenTicketBitmap, thermalPrint } = await import('./thermal-printer');
      const printerSettings = loadPrinterSettings();

      if (printerSettings.enabled && printerSettings.mode !== 'browser') {

        // ── Order type label for kitchen ticket ───────────────────────────────
        const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
        const orderTypeThermal =
          orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in' ? 'محلي' :
          orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري' :
          orderTypeStr === 'delivery' ? 'توصيل' :
          orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'استلام بالسيارة' :
          orderTypeStr || 'محلي';

        // ── Car info note for kitchen ticket (car pickup) ─────────────────────
        const carType    = data.carInfo?.carType    || '';
        const carColor   = data.carInfo?.carColor   || data.carColor   || '';
        const carPlate   = data.carInfo?.plateNumber || data.plateNumber || '';
        const carNote = (orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup')
          ? [carType, carColor, carPlate ? `لوحة: ${carPlate}` : ''].filter(Boolean).join(' | ')
          : undefined;

        // ── Build receipt via Canvas 2D (instant — same engine as kitchen tickets) ──
        const escData = await _buildFastCustomerEscPos(
          data,
          orderTypeThermal,
          printerSettings.paperWidth as '58mm' | '80mm',
          printerSettings.feedLines ?? 4,
        );

        const customerCopies = Math.max(1, Math.min(5, printerSettings.customerCopies || 1));
        const kitchenCopies = Math.max(1, Math.min(5, printerSettings.kitchenCopies || 1));

        // ── Multi-printer profile routing ──────────────────────────────────────
        const { getProfilesForRole, thermalPrintWithProfile } = await import('./thermal-printer');
        const receiptProfiles = getProfilesForRole('receipt');
        const kitchenProfiles = getProfilesForRole('kitchen');

        // Print customer receipt — use role-specific profiles if configured, else fallback to primary
        let result = { success: false, mode: 'error', error: '' } as any;
        if (receiptProfiles.length > 0) {
          for (const profile of receiptProfiles) {
            for (let i = 0; i < customerCopies; i++) {
              if (i > 0) await new Promise(r => setTimeout(r, 1200));
              result = await thermalPrintWithProfile(escData, profile);
            }
          }
          result.success = true; // at least one profile attempted
        } else {
          result = await thermalPrint(escData, '', printerSettings.paperWidth);
          for (let i = 1; i < customerCopies && result.success; i++) {
            await new Promise(r => setTimeout(r, 1200));
            result = await thermalPrint(escData, '', printerSettings.paperWidth);
          }
        }

        if (result.success || receiptProfiles.length > 0) {
          if (printerSettings.autoKitchenCopy || kitchenProfiles.length > 0) {
            const kitchenEsc = await buildEscPosKitchenTicketBitmap({
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
              orderType: orderTypeThermal,
              cashierName: data.employeeName || '—',
              items: data.items.map(item => ({
                name: item.coffeeItem.nameAr,
                nameEn: (item.coffeeItem as any).nameEn || '',
                qty: item.quantity,
                addons: [
                  ...(getItemSelectedSize(item) ? [`الحجم: ${getItemSelectedSize(item)}`] : []),
                  ...getItemAddons(item).map((a: any) => a.nameAr),
                ],
              })),
              notes: [carNote, data.notes].filter(Boolean).join(' | ') || undefined,
              paperWidth: printerSettings.paperWidth,
            });
            await new Promise(r => setTimeout(r, 1200));
            if (kitchenProfiles.length > 0) {
              // Route kitchen copies to kitchen-role printers
              for (const profile of kitchenProfiles) {
                for (let i = 0; i < kitchenCopies; i++) {
                  if (i > 0) await new Promise(r => setTimeout(r, 1200));
                  await thermalPrintWithProfile(kitchenEsc, profile);
                }
              }
            } else if (printerSettings.autoKitchenCopy) {
              // Fallback: kitchen copies to primary printer
              for (let i = 0; i < kitchenCopies; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 1400));
                await thermalPrint(kitchenEsc, '', printerSettings.paperWidth);
              }
            }
          }
          return;
        }

        const errMsg = result.error || 'فشلت الطباعة الحرارية';
        console.error('[PrintTaxInvoice] Hardware print failed — mode:', printerSettings.mode, '— error:', errMsg);
        if (typeof window !== 'undefined' && (window as any).__qiroxPrintError !== undefined) {
          (window as any).__qiroxPrintError(errMsg);
        } else {
          window.dispatchEvent(new CustomEvent('qirox:print-error', { detail: { error: errMsg, mode: printerSettings.mode } }));
        }
        return;
      }
    } catch (e) {
      console.warn('[PrintTaxInvoice] Thermal print error:', e);
    }
  }

  const displayInvoiceNumber = fmtOrderNum(data.orderNumber);

  // Open preview window SYNCHRONOUSLY before any await so mobile browsers
  // honour the user-gesture chain and don't block the popup.
  let previewWin: Window | null = null;
  if (!shouldAutoPrint) {
    previewWin = window.open('', '_blank', 'width=820,height=860,scrollbars=yes,resizable=yes');
  }

  // ── Build HTML receipts (fast, no image conversion) ───────────────────────
  const customerHtml = await buildReceiptPreviewHtml(data);
  const employeeHtml = buildEmployeeReceiptPreviewHtml(data);

  // ── Helper: print one HTML document via a hidden iframe ───────────────────
  const printOneHtml = (html: string): Promise<void> => _printDirectAsync(html, '80mm', true);

  if (shouldAutoPrint) {
    const { loadPrinterSettings } = await import('./thermal-printer');
    const ps = loadPrinterSettings();
    const customerCopies = Math.max(1, Math.min(5, ps.customerCopies || 1));
    const kitchenCopies  = ps.autoKitchenCopy ? Math.max(1, Math.min(5, ps.kitchenCopies || 1)) : 0;

    // Print customer copies as HTML — fast, accurate, no image conversion
    for (let i = 0; i < customerCopies; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 150));
      await printOneHtml(customerHtml);
    }
    // Print kitchen copies as HTML (different design for kitchen staff)
    for (let i = 0; i < kitchenCopies; i++) {
      await new Promise(r => setTimeout(r, 150));
      await printOneHtml(employeeHtml);
    }
  } else {
    // Manual preview window — use the window already opened synchronously above
    const win = previewWin;
    if (win) {
      win.document.open();
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>فواتير الطلب - ${displayInvoiceNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Tahoma,Arial,sans-serif;background:#e8e8e8;padding:16px;text-align:center;}
  .toolbar{margin-bottom:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
  .btn{padding:10px 22px;font-size:14px;border:none;border-radius:8px;cursor:pointer;font-weight:700;}
  .btn-print{background:#1a1a1a;color:#fff;}
  .btn-cust{background:#1e40af;color:#fff;}
  .btn-emp{background:#b45309;color:#fff;}
  .btn-close{background:#6b7280;color:#fff;}
  .frames{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;align-items:flex-start;}
  .col{display:flex;flex-direction:column;align-items:center;}
  h3{font-size:12px;font-weight:700;color:#333;margin-bottom:8px;background:#fff;padding:4px 14px;border-radius:20px;border:1px solid #ccc;}
  iframe{border:none;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.15);}
  @media print{
    body{background:#fff;padding:0;}
    .toolbar,.no-print,h3{display:none!important;}
    .frames{display:block;}
    .col{display:block;page-break-after:always;}
    .col:last-child{page-break-after:auto;}
    iframe{box-shadow:none;border-radius:0;width:80mm!important;}
    @page{size:80mm auto;margin:0;}
  }
</style></head><body>
  <div class="toolbar no-print">
    <button class="btn btn-print" onclick="window.print()">طباعة النسختين</button>
    <button class="btn btn-cust" onclick="printOne('cust')">فاتورة العميل فقط</button>
    <button class="btn btn-emp" onclick="printOne('emp')">نسخة الموظف فقط</button>
    <button class="btn btn-close" onclick="window.close()">اغلاق</button>
  </div>
  <div class="frames">
    <div class="col" id="col-cust">
      <h3>فاتورة العميل</h3>
      <iframe id="fr-cust" width="320" height="700" srcdoc="${customerHtml.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"></iframe>
    </div>
    <div class="col" id="col-emp">
      <h3>نسخة الموظف</h3>
      <iframe id="fr-emp" width="320" height="700" srcdoc="${employeeHtml.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"></iframe>
    </div>
  </div>
  <script>
    function printOne(which){
      var hideId=which==='cust'?'col-emp':'col-cust';
      var el=document.getElementById(hideId);
      var prev=el.style.display;
      el.style.display='none';
      window.print();
      setTimeout(function(){el.style.display=prev;},500);
    }
  </script>
</body></html>`);
      win.document.close();
    }
    return;
  }
}

export async function printCustomerPickupReceipt(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  const _trackNum = String(data.orderNumber).replace(/\D/g, '') || String(data.orderNumber);
  const orderTrackingUrl = `${window.location.origin}/track/${_trackNum}`;
  
  let qrCodeSvg = "";
  try {
    const svgStr = await QRCode.toString(orderTrackingUrl, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' });
    qrCodeSvg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
  } catch (error) {
    console.error("Error generating order tracking QR:", error);
  }

  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const deliveryTypeAr = data.deliveryTypeAr || (data.deliveryType === 'dine-in' ? 'في الكافيه' : data.deliveryType === 'delivery' ? 'توصيل' : 'استلام');

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال استلام - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { max-width: 80mm; margin: 0 auto; padding: 16px; }
    .header { text-align: center; border-bottom: 3px solid #b45309; padding-bottom: 16px; margin-bottom: 16px; }
    .company-name { font-size: 28px; font-weight: 700; color: #b45309; }
    .order-badge { display: inline-block; background: #fef3c7; border: 2px solid #b45309; padding: 12px 24px; border-radius: 12px; margin: 16px 0; }
    .order-number { font-size: 32px; font-weight: 700; color: #b45309; }
    .order-type { display: inline-block; background: ${data.deliveryType === 'dine-in' ? '#8b5cf6' : data.deliveryType === 'delivery' ? '#10b981' : '#3b82f6'}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 16px; font-weight: 600; margin-top: 8px; }
    .section { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .items-section { background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .item-row:last-child { border-bottom: none; }
    .item-name { font-weight: 600; }
    .item-qty { background: #000; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 14px; }
    .total-section { background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 16px; }
    .total-amount { font-size: 28px; font-weight: 700; color: #b45309; }
    .qr-section { text-align: center; padding: 16px; border: 2px dashed #b45309; border-radius: 12px; background: #fffbeb; }
    .qr-title { font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
    .qr-container img { width: 120px; height: 120px; }
    .qr-note { font-size: 11px; color: #666; margin-top: 8px; }
    .footer { text-align: center; padding-top: 16px; font-size: 12px; color: #666; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="company-name">${COMPANY_NAME}</h1>
      <p style="color: #666; font-size: 14px;">إيصال الاستلام</p>
      <div class="order-badge">
        <div class="order-number">${fmtOrderNum(data.orderNumber)}</div>
      </div>
      <div class="order-type">${deliveryTypeAr}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>العميل:</span>
        <span style="font-weight: 600;">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${formattedDate} - ${formattedTime}</span>
      </div>
      ${data.tableNumber ? `
      <div class="info-row">
        <span>الطاولة:</span>
        <span style="font-weight: 700; font-size: 18px;">${data.tableNumber}</span>
      </div>
      ` : ''}
    </div>

    <div class="items-section">
      ${data.items.map(item => {
        const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
        return `
        <div class="item-row" style="align-items:flex-start;">
          <div class="item-name" style="flex:1;">
            ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
            ${addons ? `<div style="font-size:11px;color:#92400e;margin-top:2px;">+ ${addons}</div>` : ''}
          </div>
          <span class="item-qty">x${item.quantity}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="total-section">
      <p style="font-size: 14px; color: #92400e;">الإجمالي المدفوع</p>
      <p class="total-amount">${data.total} ر.س</p>
      <p style="font-size: 12px; color: #666; margin-top: 4px;">${data.paymentMethod}</p>
    </div>

    <div class="footer">
      <p style="font-weight: 600;">شكراً لزيارتكم</p>
      <p>نتمنى لكم تجربة ممتعة</p>
      <p style="margin-top: 8px;">@مكان الشيف البخاري</p>
    </div>
  </div>
</body>
</html>
  `;

  openPrintWindow(receiptHtml, `إيصال استلام - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: true });
}

export async function printCashierReceipt(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const deliveryTypeAr = data.deliveryTypeAr || (data.deliveryType === 'dine-in' ? 'في الكافيه' : data.deliveryType === 'delivery' ? 'توصيل' : 'استلام');
  const totalAmount = parseNumber(data.total);

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>نسخة الكاشير - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #000; direction: rtl; }
    .receipt { max-width: 80mm; margin: 0 auto; padding: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .title { font-size: 14px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; display: inline-block; margin-bottom: 8px; }
    .order-number { font-size: 24px; font-weight: 700; }
    .order-type { font-size: 14px; font-weight: 600; color: #666; }
    .section { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #999; font-size: 12px; }
    .info-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .items { font-size: 12px; }
    .item-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .totals { font-size: 12px; margin-top: 12px; }
    .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .total-grand { font-size: 16px; font-weight: 700; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
    .signature { margin-top: 24px; border-top: 1px solid #000; padding-top: 8px; }
    .signature-line { border-bottom: 1px solid #000; height: 30px; margin-top: 12px; }
    .footer { text-align: center; font-size: 10px; color: #666; margin-top: 12px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <span class="title">نسخة الكاشير</span>
      <div class="order-number">${fmtOrderNum(data.orderNumber)}</div>
      <div class="order-type">${deliveryTypeAr}</div>
    </div>

    <div class="section">
      <div class="info-row"><span>التاريخ:</span><span>${formattedDate}</span></div>
      <div class="info-row"><span>الوقت:</span><span>${formattedTime}</span></div>
      <div class="info-row"><span>الكاشير:</span><span>${data.employeeName}</span></div>
      <div class="info-row"><span>العميل:</span><span>${data.customerName}</span></div>
      <div class="info-row"><span>الجوال:</span><span>${data.customerPhone}</span></div>
      ${data.tableNumber ? `<div class="info-row"><span>الطاولة:</span><span>${data.tableNumber}</span></div>` : ''}
    </div>

    <div class="items">
      ${data.items.map(item => {
        const price = parseNumber(item.coffeeItem.price);
        const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
        return `
        <div class="item-row" style="align-items:flex-start;">
          <div style="flex:1;">
            ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}<span style="font-size:11px;color:#555;"> x${item.quantity}</span>
            ${addons ? `<div style="font-size:10px;color:#777;margin-top:2px;">+ ${addons}</div>` : ''}
          </div>
          <span style="flex-shrink:0;">${(price * item.quantity).toFixed(2)}</span>
        </div>
        `;
      }).join('')}
    </div>

    <div class="totals">
      <div class="total-row"><span>المجموع الفرعي:</span><span>${data.subtotal} ر.س</span></div>
      ${data.discount ? `<div class="total-row" style="color: green;"><span>الخصم (${data.discount.percentage}%):</span><span>-${data.discount.amount} ر.س</span></div>` : ''}
      <div class="total-row total-grand"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ر.س</span></div>
      <div class="total-row"><span>طريقة الدفع:</span><span>${data.paymentMethod}</span></div>
      ${data.splitPayment ? `
      ${data.splitPayment.cash > 0 ? `<div class="total-row" style="font-size:11px;font-weight:600;"><span>💵 نقدي:</span><span>${data.splitPayment.cash.toFixed(2)} ر.س</span></div>` : ''}
      ${data.splitPayment.card > 0 ? `<div class="total-row" style="font-size:11px;font-weight:600;"><span>💳 شبكة:</span><span>${data.splitPayment.card.toFixed(2)} ر.س</span></div>` : ''}` : ''}
      ${(data.cashReceived && data.cashReceived > 0 && !data.splitPayment) ? `
      <div class="total-row" style="font-size:11px;"><span>المبلغ المستلم:</span><span>${data.cashReceived.toFixed(2)} ر.س</span></div>
      <div class="total-row" style="font-size:11px;color:#16a34a;font-weight:700;"><span>↩ الباقي:</span><span>${Math.max(0, data.cashReceived - totalAmount).toFixed(2)} ر.س</span></div>` : ''}
    </div>

    <div class="signature">
      <p style="font-size: 11px;">توقيع العميل (للدفع بالبطاقة):</p>
      <div class="signature-line"></div>
    </div>

    <div class="footer">
      <p>تم الحفظ في ${formattedTime} - ${formattedDate}</p>
    </div>
  </div>
</body>
</html>
  `;

  openPrintWindow(receiptHtml, `نسخة الكاشير - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: true });
}

export async function printAllReceipts(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  // Try thermal printer (WebUSB) first
  try {
    const { loadPrinterSettings, buildEscPosReceipt, buildEscPosKitchenTicketBitmap, thermalPrint } = await import('./thermal-printer');
    const printerSettings = loadPrinterSettings();

    if (printerSettings.enabled && printerSettings.autoPrint) {
      const { date: fmtDate, time: fmtTime } = formatDate(data.date);
      const dateStr = `${fmtDate} ${fmtTime}`;
      const totalAmount = parseNumber(data.total);
      const subtotalBeforeTax = totalAmount / (1 + VAT_RATE);
      const vatAmount = totalAmount - subtotalBeforeTax;

      const orderTypeLabel = data.orderTypeName || (data.orderType === 'dine_in' ? 'محلي' : data.orderType === 'takeaway' ? 'سفري' : data.orderType === 'delivery' ? 'توصيل' : data.deliveryTypeAr || '');

      // Build ESC/POS receipt
      const escData = buildEscPosReceipt({
        shopName: COMPANY_NAME,
        vatNumber: data.vatNumber || VAT_NUMBER,
        branchName: data.branchName,
        address: data.branchAddress,
        orderNumber: data.orderNumber,
        date: dateStr,
        cashierName: data.employeeName,
        customerName: data.customerName !== 'عميل نقدي' ? data.customerName : undefined,
        tableNumber: data.tableNumber,
        orderType: orderTypeLabel || undefined,
        items: data.items.map(item => ({
          name: item.coffeeItem.nameAr,
          qty: item.quantity,
          price: parseNumber(item.coffeeItem.price),
          addons: getItemAddons(item).map((a: any) => a.nameAr),
        })),
        subtotal: subtotalBeforeTax,
        vat: vatAmount,
        total: totalAmount,
        discount: data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : undefined,
        paymentMethod: data.paymentMethod,
        paperWidth: printerSettings.paperWidth,
        feedLines: printerSettings.feedLines,
      });

      // pass empty fallbackHtml so browser fallback does nothing here —
      // we handle browser printing separately with the new format below
      const result = await thermalPrint(escData, '', printerSettings.paperWidth);
      console.log('[PrintAllReceipts] Result:', result.mode, result.success);

      if (result.mode === 'webusb' || result.mode === 'network') {
        // Hardware print succeeded — handle kitchen copy if needed
        if (result.mode === 'webusb' && printerSettings.autoKitchenCopy) {
          await new Promise(r => setTimeout(r, 1200));
          const kitchenEsc = await buildEscPosKitchenTicketBitmap({
            orderNumber: data.orderNumber,
            tableNumber: data.tableNumber,
            orderType: orderTypeLabel || undefined,
            cashierName: data.employeeName,
            items: data.items.map(item => ({
              name: item.coffeeItem.nameAr,
              qty: item.quantity,
              addons: getItemAddons(item).map((a: any) => a.nameAr),
            })),
            notes: data.notes || undefined,
            paperWidth: printerSettings.paperWidth,
          });
          const { thermalPrint: tp2 } = await import('./thermal-printer');
          await tp2(kitchenEsc, '', printerSettings.paperWidth);
        }
        return; // Hardware handled it — done
      }
      // mode === 'browser' or 'error': fall through to new-format HTML printing below
    }
  } catch (e) {
    console.error('[PrintAllReceipts] Thermal printer error, falling back:', e);
  }

  // Browser fallback — use the new ZATCA-compliant tax invoice format
  await printUnifiedReceipt(data as any);
}

export async function printSimpleReceipt(data: TaxInvoiceData): Promise<void> {
  const itemsHtml = data.items.map(item => {
    const unitPrice = parseNumber(item.coffeeItem.price);
    const lineTotal = unitPrice * item.quantity;
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
    return `
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 8px 4px;">
          ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
          ${addons ? `<div style="font-size:11px;color:#666;margin-top:2px;">+ ${addons}</div>` : ''}
        </td>
        <td style="padding: 8px 4px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 4px; text-align: left;">${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // No tracking QR — removed to keep printing instant (no image loading)

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Tahoma, Arial, 'Segoe UI', sans-serif;
      background: #fff;
      color: #000;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .receipt {
      max-width: 80mm;
      margin: 0 auto;
      padding: 16px;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #333;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    
    .company-name { font-size: 24px; font-weight: 700; }
    .company-name-en { font-size: 14px; color: #666; }
    .order-num-block { text-align: center; margin: 12px 0; padding: 10px; background: #f0f0f0; border-radius: 6px; border: 1.5px solid #ccc; }
    .order-num-label { font-size: 11px; color: #666; margin-bottom: 4px; }
    .order-num-value { font-size: 26px; font-weight: 700; letter-spacing: 1px; color: #000; font-family: monospace; direction: ltr; }
    
    .section {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #ccc;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 14px;
    }
    
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { padding: 8px 4px; font-weight: 700; border-bottom: 2px solid #333; }
    th:first-child { text-align: right; }
    th:nth-child(2) { text-align: center; }
    th:last-child { text-align: left; }
    
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.grand { font-size: 18px; font-weight: 700; border-top: 2px solid #333; padding-top: 12px; }
    
    .footer { text-align: center; padding-top: 16px; border-top: 2px dashed #333; }
    
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="company-name">${COMPANY_NAME}</h1>
      <p class="company-name-en">${COMPANY_NAME_EN}</p>
      <p style="margin-top: 8px; font-size: 12px;">فاتورة مبيعات</p>
    </div>

    <div class="order-num-block">
      <div class="order-num-label">رقم الطلب</div>
      <div class="order-num-value">${fmtOrderNum(data.orderNumber)}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${data.date}</span>
      </div>
      <div class="info-row">
        <span>العميل:</span>
        <span>${data.customerName}</span>
      </div>
      <div class="info-row">
        <span>الجوال:</span>
        <span>${data.customerPhone}</span>
      </div>
      ${data.tableNumber ? `
      <div class="info-row">
        <span>الطاولة:</span>
        <span>${data.tableNumber}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span>الكاشير:</span>
        <span>${data.employeeName}</span>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div>
      <div class="total-row">
        <span>المجموع الفرعي:</span>
        <span>${data.subtotal} ريال</span>
      </div>
      ${data.discount ? `
      <div class="total-row" style="color: #16a34a;">
        <span>الخصم (${data.discount.code} - ${data.discount.percentage}%):</span>
        <span>-${data.discount.amount} ريال</span>
      </div>
      ` : ''}
      <div class="total-row grand">
        <span>الإجمالي:</span>
        <span>${data.total} ريال</span>
      </div>
      <div class="total-row" style="margin-top: 12px;">
        <span>طريقة الدفع:</span>
        <span><strong>${data.paymentMethod}</strong></span>
      </div>
    </div>


    <div class="footer">
      <p>شكراً لزيارتكم</p>
      <p style="font-size: 12px; color: #666;">نتمنى لكم تجربة ممتعة</p>
      <p style="margin-top: 12px; font-size: 12px;">تابعونا على وسائل التواصل الاجتماعي</p>
      <p style="font-family: monospace;">@مكان الشيف البخاري</p>
    </div>
  </div>

</body>
</html>
  `;

  openPrintWindow(receiptHtml, `إيصال - ${data.orderNumber}`, { 
    paperWidth: '80mm', 
    autoPrint: true, 
    showPrintButton: true 
  });
}
