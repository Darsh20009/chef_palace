import QRCode from "qrcode";
import { VAT_RATE } from "@/lib/constants";
import { brand } from "@/lib/brand";

// ── Logo cache ────────────────────────────────────────────────────────────────
// Embed the logo as a Base64 data URL so it renders immediately in the print
// popup/iframe without waiting for a network request (fixes missing logo issue).
let _cachedLogoBase64: string = '';

// Candidate logo paths — tries each in order until one succeeds
const LOGO_PATHS = [
  '/logo.png',
  '/logo-192.png',
  '/logo-512.png',
];

async function _fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchLogoBase64(): Promise<string> {
  if (_cachedLogoBase64) return _cachedLogoBase64;
  for (const path of LOGO_PATHS) {
    try {
      const b64 = await _fetchImageAsBase64(path);
      if (b64 && b64.startsWith('data:image')) {
        _cachedLogoBase64 = b64;
        return _cachedLogoBase64;
      }
    } catch {
      // try next path
    }
  }
  return '';
}
// Pre-warm the cache on module load so it's ready by the time a receipt is printed
if (typeof window !== 'undefined') {
  fetchLogoBase64().catch(() => {});
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
  itemDiscount?: number;
  customization?: {
    selectedItemAddons?: Array<{ nameAr: string; nameEn?: string; price?: number }>;
    [key: string]: any;
  };
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
  employeeName: string;
  tableNumber?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  orderTypeName?: string;
  date: string;
  branchName?: string;
  branchAddress?: string;
  crNumber?: string;
  vatNumber?: string;
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

// ── Unified item-display extractor ───────────────────────────────────────────
// Pulls size + addons + notes out of any cart/order item shape so receipts
// always render the same regardless of source (live cart, saved order, etc).
function _extractItemDisplay(item: any): { size: string; addons: Array<{ nameAr: string; price?: number }>; notes: string } {
  const cz = item?.customization || {};
  // ── size ────────────────────────────────────────────────────────────────
  let size = '';
  const rawSize = item?.selectedSize || cz.selectedSize || cz.size;
  if (rawSize && rawSize !== 'default' && String(rawSize).trim()) {
    size = String(rawSize).trim();
  } else if (item?.coffeeItem?.availableSizes && item?.selectedSize) {
    const found = item.coffeeItem.availableSizes.find((s: any) => s.nameAr === item.selectedSize || s.id === item.selectedSize);
    if (found) size = found.nameAr;
  }

  // ── addons (try every known shape, dedupe by name) ──────────────────────
  const addonMap = new Map<string, { nameAr: string; price?: number }>();
  const sources: any[] = [
    cz.selectedAddons,        // saved-order shape: [{addonId,nameAr,price,...}]
    cz.selectedItemAddons,    // legacy
    item?.selectedItemAddons, // live cart inline addons
  ];
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const a of src) {
      if (!a) continue;
      const nameAr = a.nameAr || a.name || a.nameEn;
      if (!nameAr) continue;
      const key = String(nameAr).trim();
      if (!addonMap.has(key)) {
        addonMap.set(key, { nameAr: key, price: typeof a.price === 'number' ? a.price : (a.price ? Number(a.price) : undefined) });
      }
    }
  }
  // string-id addons enriched via item.enrichedAddons
  if (Array.isArray(item?.selectedAddons) && Array.isArray(item?.enrichedAddons)) {
    for (const id of item.selectedAddons) {
      const a = item.enrichedAddons.find((x: any) => x?.id === id || x?._id === id);
      if (a?.nameAr && !addonMap.has(a.nameAr)) {
        addonMap.set(a.nameAr, { nameAr: a.nameAr, price: typeof a.price === 'number' ? a.price : undefined });
      }
    }
  }
  const addons = Array.from(addonMap.values());

  const notes = (cz.notes || item?.notes || '').toString().trim();
  return { size, addons, notes };
}

function _renderItemExtras(item: any, opts: { fontSize?: number; color?: string; showPrices?: boolean } = {}): string {
  const { size, addons, notes } = _extractItemDisplay(item);
  if (!size && addons.length === 0 && !notes) return '';
  const fs = opts.fontSize ?? 14;
  const color = opts.color ?? '#444';
  const lines: string[] = [];
  if (size) {
    lines.push(`<div style="font-size:${fs}px;color:${color};margin-top:5px;">📏 الحجم: <strong>${size}</strong></div>`);
  }
  if (addons.length > 0) {
    const addonLines = addons.map(a => {
      const priceStr = (opts.showPrices && a.price && a.price > 0) ? ` <span style="color:#888;">(+${a.price.toFixed(2)})</span>` : '';
      return `<div style="font-size:${fs}px;color:${color};margin-top:3px;padding-right:10px;">+ ${a.nameAr}${priceStr}</div>`;
    }).join('');
    lines.push(`<div style="margin-top:5px;">${addonLines}</div>`);
  }
  if (notes) {
    lines.push(`<div style="font-size:${fs}px;color:#666;margin-top:5px;font-style:italic;">📝 ${notes}</div>`);
  }
  return lines.join('');
}

// ── iframe-based print queue (never touches the main page DOM during print) ──
let _printQueue: Array<{ html: string; paperWidth: string; isFullDoc: boolean }> = [];
let _isPrinting = false;

function _buildFullDoc(html: string, paperWidth: string): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: 'Cairo', Arial, sans-serif; direction: rtl; color: #000; background: #fff; }
    .no-print { display: none !important; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * Render HTML to an image using html2canvas, then print the image.
 * This fixes Arabic text encoding issues on thermal printers — the image
 * is pixel-perfect regardless of printer code page or font support.
 */
async function _printViaImageAsync(html: string, paperWidth: string, isFullDoc: boolean): Promise<void> {
  // Paper widths in pixels at 96 DPI: 58mm ≈ 220px, 80mm ≈ 302px
  const renderWidth = paperWidth === '58mm' ? 220 : 302;
  const fullHtml = isFullDoc ? html : _buildFullDoc(html, paperWidth);

  // ── Step 1: Render HTML in a hidden iframe ────────────────────────────────
  const renderFrame = document.createElement('iframe');
  renderFrame.setAttribute('aria-hidden', 'true');
  renderFrame.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderWidth}px;height:3000px;border:none;opacity:0;pointer-events:none;`;
  document.body.appendChild(renderFrame);

  const iframeDoc = renderFrame.contentDocument || renderFrame.contentWindow?.document;
  if (!iframeDoc) {
    renderFrame.remove();
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 500);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // Wait for fonts and QR images to load
  await new Promise(r => setTimeout(r, 900));
  try { await (iframeDoc as any).fonts?.ready; } catch {}

  let imgDataUrl = '';
  try {
    const html2canvas = (await import('html2canvas')).default;
    const captureEl = iframeDoc.body;
    const canvas = await html2canvas(captureEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: renderWidth,
      windowWidth: renderWidth,
      logging: false,
    });
    imgDataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[Print] html2canvas failed, falling back to direct HTML print:', err);
    renderFrame.remove();
    // Fallback: direct HTML print (original method)
    _printDirectHtml(fullHtml, paperWidth);
    return;
  }

  renderFrame.remove();

  // ── Step 2: Print the captured image ─────────────────────────────────────
  const printFrame = document.createElement('iframe');
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(printFrame);

  const printDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!printDoc) {
    printFrame.remove();
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 500);
    return;
  }

  printDoc.open();
  printDoc.write(`<!DOCTYPE html><html><head><style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; }
    img { width: 100%; display: block; }
  </style></head><body><img src="${imgDataUrl}" /></body></html>`);
  printDoc.close();

  await new Promise(r => setTimeout(r, 300));

  const printWin = printFrame.contentWindow;
  if (!printWin) {
    printFrame.remove();
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 500);
    return;
  }

  let cleanupDone = false;
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    setTimeout(() => {
      try { printFrame.remove(); } catch {}
      _isPrinting = false;
      setTimeout(_drainPrintQueue, 800);
    }, 150);
  };

  printWin.addEventListener('afterprint', cleanup, { once: true });
  try { printWin.print(); } catch {}
  setTimeout(cleanup, 8000);
}

/** Original direct-HTML iframe print — used as fallback when html2canvas fails */
function _printDirectHtml(fullHtml: string, paperWidth: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    iframe.remove();
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 500);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  const iframeWin = iframe.contentWindow;
  if (!iframeWin) {
    iframe.remove();
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 500);
    return;
  }

  let cleanupDone = false;
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    setTimeout(() => {
      try { iframe.remove(); } catch {}
      _isPrinting = false;
      setTimeout(_drainPrintQueue, 800);
    }, 150);
  };

  iframeWin.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    try { iframeWin.print(); } catch {}
    setTimeout(cleanup, 6000);
  }, 500);
}

function _drainPrintQueue() {
  if (_isPrinting || _printQueue.length === 0) return;
  _isPrinting = true;
  const { html, paperWidth, isFullDoc } = _printQueue.shift()!;
  _printViaImageAsync(html, paperWidth, isFullDoc).catch(() => {
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 500);
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

export async function printEmployeeCard(data: EmployeePrintData): Promise<void> {
  let qrCodeUrl = "";
  if (data.qrCode) {
    try {
      qrCodeUrl = await QRCode.toDataURL(data.qrCode, {
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
      });
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
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; }
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
    ${qrCodeUrl ? `
    <div class="qr-section">
      <img src="${qrCodeUrl}" alt="QR Code" />
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
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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

const VAT_NUMBER = brand.taxNumber;
const COMPANY_NAME = brand.nameAr;
const COMPANY_NAME_EN = brand.nameEn;
const COMPANY_CR = brand.commercialRegister;
const COMPANY_WEBSITE = brand.website?.replace(/^https?:\/\//, '').replace(/^www\./, '') || '';
const DEFAULT_BRANCH = "الفرع الرئيسي - الرياض";
const DEFAULT_ADDRESS = brand.locationDisplay || "الرياض، المملكة العربية السعودية";

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

export async function printBulkEmployeeInvoices(orders: any[]): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    body { font-family: 'Cairo', sans-serif; direction: rtl; }
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

/** Build a visual HTML receipt for preview — matches Canvas 2D printer output exactly */
export async function buildReceiptPreviewHtml(data: TaxInvoiceData): Promise<string> {
  const totalAmount = parseNumber(data.total);
  const subtotal = totalAmount / (1 + VAT_RATE);
  const vat = totalAmount - subtotal;
  const disc = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);
  const orderNumDisplay = String(data.orderNumber).replace(/\D/g, '').padStart(4, '0') || data.orderNumber;
  const TAGLINE = brand.taglineAr;

  const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
  const orderTypeLabel =
    orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in' ? 'محلي' :
    orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري' :
    orderTypeStr === 'delivery' ? 'توصيل' :
    orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'سيارة' :
    orderTypeStr;

  // ZATCA QR
  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vat.toFixed(2),
  });
  let zatcaQrUrl = '';
  try { zatcaQrUrl = await QRCode.toDataURL(zatcaPayload, { width: 220, margin: 1, errorCorrectionLevel: 'M' }); } catch {}

  // Tracking QR
  const trackingUrl = `${window.location.origin}/track/${data.orderNumber}`;
  let trackingQrUrl = '';
  try { trackingQrUrl = await QRCode.toDataURL(trackingUrl, { width: 160, margin: 1, errorCorrectionLevel: 'M' }); } catch {}

  // Logo — embed as base64 so print popups render it correctly (no cross-origin issues)
  const logoB64 = await fetchLogoBase64().catch(() => '');
  const logoSrc = logoB64 || '/logo.png';

  const itemsHtml = data.items.map((item, idx) => {
    const up = parseNumber(item.coffeeItem.price);
    const itemDisc = parseNumber(item.itemDiscount);
    const lineTotal = item.quantity * up - itemDisc;
    const extras = _renderItemExtras(item, { fontSize: 15, color: '#444', showPrices: true });
    const sep = idx > 0 ? 'border-top:1px dashed #ccc;' : '';
    return `
      <div style="padding:14px 0;${sep}">
        <div style="font-weight:700;font-size:19px;line-height:1.5;">${item.coffeeItem.nameAr}${itemDisc > 0 ? ` <span style="font-size:14px;color:#16a34a;">(-${itemDisc.toFixed(2)})</span>` : ''}</div>
        ${extras}
        <table style="width:100%;margin-top:8px;border-collapse:collapse;border:0;"><tr>
          <td style="font-size:17px;color:#222;border:0;">${item.quantity} × ${up.toFixed(2)} ر.س</td>
          <td style="text-align:left;font-size:17px;font-weight:700;border:0;">${lineTotal.toFixed(2)} ر.س</td>
        </tr></table>
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;border:0;border-color:transparent;}
hr{display:none!important;}
table,tr,td,th,thead,tbody{border:0!important;border-collapse:collapse!important;}
/* ── Screen: paper tape look ─────────────────────────────── */
body{font-family:'Cairo',Tahoma,Arial,sans-serif;direction:rtl;background:#e8e6e0;display:flex;justify-content:center;align-items:flex-start;padding:24px 10px;min-height:100vh;}
.paper{background:#fff;width:320px;box-shadow:0 4px 20px rgba(0,0,0,.2);}
.tape{height:14px;background:repeating-linear-gradient(90deg,#fff 0,#fff 12px,#e8e6e0 12px,#e8e6e0 24px);}
.body{padding:16px 14px;}
.c{text-align:center;}
.gap{height:8px;}
.tbl{width:100%;table-layout:fixed;}
.tbl td{padding:4px 0;font-size:18px;vertical-align:middle;word-break:break-word;}
.tbl td:first-child{width:55%;white-space:nowrap;}
.tbl td:last-child{text-align:left;width:45%;}
/* ── Print: clean thermal layout ────────────────────────── */
@media print{
  @page{size:80mm auto;margin:0;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;border:0!important;}
  hr{display:none!important;}
  body{display:block!important;background:#fff!important;padding:0!important;min-height:0!important;}
  .paper{width:76mm!important;max-width:76mm!important;margin:0!important;box-shadow:none!important;}
  .tape{display:none!important;}
  .body{padding:5px 4px 10px!important;}
}
</style></head><body><div class="paper">
<div class="tape"></div>
<div class="body">

  <!-- Header -->
  <div class="c" style="padding-bottom:6px;">
    <img src="${logoSrc}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto 8px;"
      onerror="this.style.display='none'" />
    <div style="font-size:24px;font-weight:900;letter-spacing:1px;">${COMPANY_NAME}</div>
    ${data.branchName ? `<div style="font-size:16px;color:#333;margin-top:2px;">${data.branchName}</div>` : ''}
    <div style="font-size:14px;color:#444;margin-top:3px;font-style:italic;">${TAGLINE}</div>
    <div style="font-size:14px;color:#333;margin-top:3px;">VAT: ${data.vatNumber || VAT_NUMBER}</div>
  </div>

  <div class="gap"></div>

  <!-- Invoice label + Order number (3-line gap between them) -->
  <div class="c" style="font-size:18px;font-weight:700;">فاتورة ضريبية مبسطة</div>
  <div style="height:54px;"></div>
  <div class="c" style="font-size:48px;font-weight:900;letter-spacing:5px;line-height:1.1;">#${orderNumDisplay}</div>

  <!-- Decorative separator between order number and date (3-line gap above & below) -->
  <div style="height:54px;"></div>
  <div style="border-top:2px solid #111;width:100%;height:0;"></div>
  <div style="height:54px;"></div>

  <!-- Info rows -->
  <table class="tbl">
    <tr><td>التاريخ:</td><td>${fmtDate} ${fmtTime}</td></tr>
    <tr><td>الكاشير:</td><td>${data.employeeName || '—'}</td></tr>
    ${data.customerName && data.customerName !== 'عميل نقدي' ? `<tr><td>العميل:</td><td>${data.customerName}</td></tr>` : ''}
    ${data.tableNumber ? `<tr><td>الطاولة:</td><td>${data.tableNumber}</td></tr>` : ''}
    ${orderTypeLabel ? `<tr><td>نوع الطلب:</td><td>${orderTypeLabel}</td></tr>` : ''}
  </table>

  <div class="gap"></div>

  <!-- Items -->
  ${itemsHtml}

  <div class="gap"></div>

  <!-- Totals -->
  <table class="tbl">
    <tr><td>قبل الضريبة:</td><td>${subtotal.toFixed(2)} ر.س</td></tr>
    <tr><td>ضريبة القيمة المضافة 15%:</td><td>${vat.toFixed(2)} ر.س</td></tr>
    ${disc > 0 ? `<tr><td style="color:#16a34a;">الخصم:</td><td style="color:#16a34a;">-${disc.toFixed(2)} ر.س</td></tr>` : ''}
  </table>

  <div class="gap"></div>

  <!-- Total -->
  <table class="tbl">
    <tr>
      <td style="font-size:24px;font-weight:900;">الإجمالي:</td>
      <td style="font-size:24px;font-weight:900;text-align:left;">${totalAmount.toFixed(2)} ر.س</td>
    </tr>
  </table>

  <div class="gap"></div>

  <!-- Payment -->
  <table class="tbl">
    <tr><td>طريقة الدفع:</td><td>${data.paymentMethod}</td></tr>
    ${data.splitPayment ? `
    <tr><td style="padding-right:6px;font-size:16px;">نقدي:</td><td style="font-size:16px;">${data.splitPayment.cash.toFixed(2)} ر.س</td></tr>
    <tr><td style="padding-right:6px;font-size:16px;">شبكة:</td><td style="font-size:16px;">${data.splitPayment.card.toFixed(2)} ر.س</td></tr>` : ''}
  </table>

  <!-- Decorative separator after payment (3-line gap above & below) -->
  <div style="height:54px;"></div>
  <div style="border-top:2px solid #111!important;width:100%;height:0;"></div>
  <div style="height:54px;"></div>

  ${trackingQrUrl ? `
  <div class="gap"></div>
  <div class="c" style="padding:6px 0;">
    <img src="${trackingQrUrl}" style="width:140px;height:140px;display:block;margin:0 auto;" />
    <div style="font-size:14px;color:#333;margin-top:4px;">امسح للتتبع وتسجيل النقاط</div>
  </div>` : ''}

  <div class="gap"></div>

  <!-- Footer -->
  <div class="c" style="font-size:20px;font-weight:700;margin:6px 0;">** شكراً لزيارتكم **</div>
  <div class="c" style="font-size:14px;color:#333;">الأسعار شاملة ضريبة القيمة المضافة 15%</div>
  <div class="c" style="font-size:14px;color:#444;font-style:italic;margin-top:3px;">${TAGLINE}</div>
  <div class="c" style="font-size:18px;font-weight:700;margin-top:4px;">${COMPANY_NAME}</div>

  ${zatcaQrUrl ? `
  <div class="gap"></div>
  <div class="c" style="padding:8px 0;">
    <img src="${zatcaQrUrl}" style="width:180px;height:180px;display:block;margin:0 auto;" />
    <div style="font-size:14px;color:#444;margin-top:4px;">ZATCA · باركود الضريبة</div>
  </div>` : ''}

</div>
<div class="tape"></div>
</div></body></html>`;
}

/** Build a visual HTML preview for the employee/kitchen copy — to be shown alongside the customer preview */
export function buildEmployeeReceiptPreviewHtml(data: TaxInvoiceData): string {
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);
  const orderNumDisplay = String(data.orderNumber).replace(/\D/g, '').padStart(4, '0') || data.orderNumber;

  const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
  const orderTypeLabel =
    orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in' ? 'محلي' :
    orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري' :
    orderTypeStr === 'delivery' ? 'توصيل' :
    orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'سيارة' :
    orderTypeStr;

  const itemsHtml = data.items.map((item, idx) => {
    const extras = _renderItemExtras(item, { fontSize: 16, color: '#333', showPrices: false });
    const sep = idx > 0 ? 'border-top:1px dashed #ccc;' : '';
    return `
      <div style="padding:14px 0;${sep}">
        <div style="font-size:22px;font-weight:800;line-height:1.5;">${item.quantity} × ${item.coffeeItem.nameAr}</div>
        ${extras}
      </div>`;
  }).join('');

  const orderTypeRow = orderTypeLabel
    ? `<div class="c" style="font-size:18px;font-weight:700;background:#f3f4f6;padding:6px 0;margin:6px 0 10px;">نوع الطلب: ${orderTypeLabel}</div>`
    : '';

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
  <div class="c" style="font-size:24px;font-weight:900;">نسخة الموظف</div>
  <div class="gap"></div>
  <div class="c" style="font-size:48px;font-weight:900;letter-spacing:4px;">#${orderNumDisplay}</div>
  ${orderTypeRow}
  <div class="gap"></div>
  ${itemsHtml}
</div>
<div class="tape"></div>
</div></body></html>`;
}

export async function printTaxInvoice(data: TaxInvoiceData, config: PrintConfig = {}): Promise<void> {
  const shouldAutoPrint = config.autoPrint !== undefined ? config.autoPrint : true;

  // ── ESC/POS Thermal printing — Canvas 2D bitmap (Arabic-safe, matches preview) ──
  if (shouldAutoPrint) {
    try {
      const { loadPrinterSettings, buildReceiptBitmapEscPos, buildEscPosKitchenTicketBitmap, thermalPrint } = await import('./thermal-printer');
      const printerSettings = loadPrinterSettings();

      if (printerSettings.enabled && printerSettings.mode !== 'browser') {
        const totalAmountThermal = parseNumber(data.total);
        const subtotalThermal = totalAmountThermal / (1 + VAT_RATE);
        const vatThermal = totalAmountThermal - subtotalThermal;
        const { date: fmtDate, time: fmtTime } = formatDate(data.date);
        const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
        const orderTypeThermal =
          orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in' ? 'محلي' :
          orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري' :
          orderTypeStr === 'delivery' ? 'توصيل' :
          orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'سيارة' :
          orderTypeStr;
        const discThermal = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;

        // ── Generate ZATCA QR ──────────────────────────────────────────────────
        const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
        const zatcaPayload = generateZATCAQRCode({
          sellerName: COMPANY_NAME,
          vatNumber: data.vatNumber || VAT_NUMBER,
          timestamp: invoiceTs,
          totalWithVat: totalAmountThermal.toFixed(2),
          vatAmount: vatThermal.toFixed(2),
        });
        let zatcaQrDataUrl = '';
        try { zatcaQrDataUrl = await QRCode.toDataURL(zatcaPayload, { width: 250, margin: 1, errorCorrectionLevel: 'M' }); } catch {}

        // ── Generate tracking QR (public /track/:orderNumber URL) ─────────────
        // IMPORTANT: orderNumber may contain '#' (e.g. "ORD#0042") which would be
        // interpreted as a URL fragment by browsers and break the route lookup.
        // Always URL-encode the segment.
        const trackingBase = (printerSettings.publicBaseUrl?.replace(/\/+$/, '')) || window.location.origin;
        const trackingUrl = `${trackingBase}/track/${encodeURIComponent(String(data.orderNumber))}`;
        let trackingQrDataUrl = '';
        try { trackingQrDataUrl = await QRCode.toDataURL(trackingUrl, { width: 400, margin: 1, errorCorrectionLevel: 'H' }); } catch {}

        // ── Logo (cached base64) ───────────────────────────────────────────────
        const logoDataUrl = await fetchLogoBase64().catch(() => '');

        // ── Build raster receipt via Canvas 2D ────────────────────────────────
        const escData = await buildReceiptBitmapEscPos({
          shopName: COMPANY_NAME,
          vatNumber: data.vatNumber || VAT_NUMBER,
          branchName: data.branchName,
          tagline: brand.taglineAr,
          orderNumber: data.orderNumber,
          orderDate: `${fmtDate} ${fmtTime}`,
          cashierName: data.employeeName || '—',
          customerName: data.customerName,
          tableNumber: data.tableNumber,
          orderType: orderTypeThermal,
          items: data.items.map(item => ({
            name: item.coffeeItem.nameAr,
            qty: item.quantity,
            price: parseNumber(item.coffeeItem.price),
            addons: (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr),
          })),
          subtotal: subtotalThermal,
          vat: vatThermal,
          total: totalAmountThermal,
          discount: discThermal,
          splitPayment: data.splitPayment,
          paymentMethod: data.paymentMethod,
          logoDataUrl: logoDataUrl || undefined,
          trackingQrDataUrl: trackingQrDataUrl || undefined,
          zatcaQrDataUrl: zatcaQrDataUrl || undefined,
          paperWidth: printerSettings.paperWidth,
          feedLines: printerSettings.feedLines ?? 4,
        });

        const customerCopies = Math.max(1, Math.min(5, printerSettings.customerCopies || 1));
        const kitchenCopies = Math.max(1, Math.min(5, printerSettings.kitchenCopies || 1));

        let result = await thermalPrint(escData, '', printerSettings.paperWidth);
        // طباعة نسخ إضافية لفاتورة العميل
        for (let i = 1; i < customerCopies && result.success; i++) {
          await new Promise(r => setTimeout(r, 1400));
          result = await thermalPrint(escData, '', printerSettings.paperWidth);
        }

        if (result.success) {
          if (printerSettings.autoKitchenCopy) {
            const kitchenEsc = await buildEscPosKitchenTicketBitmap({
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
              orderType: orderTypeThermal,
              cashierName: data.employeeName || '—',
              items: data.items.map(item => ({
                name: item.coffeeItem.nameAr,
                qty: item.quantity,
                addons: (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr),
              })),
              notes: undefined,
              paperWidth: printerSettings.paperWidth,
            });
            for (let i = 0; i < kitchenCopies; i++) {
              await new Promise(r => setTimeout(r, 1400));
              await thermalPrint(kitchenEsc, '', printerSettings.paperWidth);
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

  const totalAmount = parseNumber(data.total);
  const displayInvoiceNumber = fmtOrderNum(data.orderNumber);
  const orderTypeLabel = data.orderTypeName || (
    (data.orderType as string) === 'dine_in' || (data.orderType as string) === 'dine-in' ? 'محلي' :
    (data.orderType as string) === 'takeaway' || (data.orderType as string) === 'pickup' ? 'سفري' :
    (data.orderType as string) === 'delivery' ? 'توصيل' :
    (data.orderType as string) === 'car_pickup' || (data.orderType as string) === 'car-pickup' ? 'سيارة' :
    (data.orderType as string) === 'online' ? 'أونلاين' :
    (data.orderType as string) === 'drive_thru' ? 'درايف ثرو' : ''
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PURE CANVAS 2D RENDERING — لا HTML, لا html2canvas, لا تكسير عربي
  //  نفس مولّد الصورة المستخدم للطابعة الحرارية → صورة واحدة → طباعة واحدة
  //  حل جذري: لا يوجد أي مسار يرسل HTML للطابعة، إطلاقاً.
  // ══════════════════════════════════════════════════════════════════════════
  const subtotalAmt = totalAmount / (1 + VAT_RATE);
  const vatAmt = totalAmount - subtotalAmt;
  const discAmt = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);

  // QR codes
  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vatAmt.toFixed(2),
  });
  let zatcaQrDataUrl = '';
  try { zatcaQrDataUrl = await QRCode.toDataURL(zatcaPayload, { width: 250, margin: 1, errorCorrectionLevel: 'M' }); } catch {}

  const ps2 = (await import('./thermal-printer')).loadPrinterSettings();
  const trackingBase2 = (ps2.publicBaseUrl?.replace(/\/+$/, '')) || window.location.origin;
  const trackingUrl = `${trackingBase2}/track/${encodeURIComponent(String(data.orderNumber))}`;
  let trackingQrDataUrl = '';
  try { trackingQrDataUrl = await QRCode.toDataURL(trackingUrl, { width: 400, margin: 1, errorCorrectionLevel: 'H' }); } catch {}

  const logoDataUrl = await fetchLogoBase64().catch(() => '');

  const { buildEmployeeCopyCanvas } = await import('./thermal-printer');
  const { renderReceiptPreviewToPng } = await import('./render-receipt-preview');

  // ── فاتورة العميل = نفس مكوّن المعاينة بالظبط (rendered → captured) ──
  const receiptPng = await renderReceiptPreviewToPng({
    orderNumber: data.orderNumber,
    createdAt: new Date(),
    tableNumber: data.tableNumber,
    totalAmount: totalAmount,
    items: data.items.map(item => ({
      nameAr: item.coffeeItem.nameAr,
      nameEn: (item.coffeeItem as any).nameEn,
      quantity: item.quantity,
      price: parseNumber(item.coffeeItem.price),
      customization: item.customization,
    })),
  });

  // ── نسخة الموظف — Canvas منفصل (نفس الأنبوب الآمن، بلا HTML) ──
  const employeeCanvas = await buildEmployeeCopyCanvas({
    orderNumber: data.orderNumber,
    tableNumber: data.tableNumber,
    orderType: orderTypeLabel,
    cashierName: data.employeeName || '—',
    items: data.items.map(item => ({
      name: item.coffeeItem.nameAr,
      qty: item.quantity,
      addons: (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr),
    })),
    total: totalAmount,
    orderDate: `${fmtDate} ${fmtTime}`,
    paperWidth: '80mm',
  });
  const employeePng = employeeCanvas.toDataURL('image/png');

  // ── طباعة صورة في iframe واحد ──
  const printOneImage = (imgSrc: string): Promise<void> => new Promise(resolve => {
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(printFrame);
    const pdoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!pdoc) { try { printFrame.remove(); } catch {} ; resolve(); return; }
    pdoc.open();
    pdoc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: 80mm auto; margin: 0; }
      html,body { margin:0; padding:0; background:#fff; }
      img { width: 80mm; display: block; margin: 0; padding: 0; }
    </style></head><body><img src="${imgSrc}" /></body></html>`);
    pdoc.close();
    const img = pdoc.querySelector('img') as HTMLImageElement | null;
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      setTimeout(() => { try { printFrame.remove(); } catch {} ; resolve(); }, 200);
    };
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
  });

  if (shouldAutoPrint) {
    // قراءة عدد النسخ من الإعدادات (يعمل أيضاً في وضع المتصفح)
    const { loadPrinterSettings } = await import('./thermal-printer');
    const ps = loadPrinterSettings();
    const customerCopies = Math.max(1, Math.min(5, ps.customerCopies || 1));
    const kitchenCopies = ps.autoKitchenCopy ? Math.max(1, Math.min(5, ps.kitchenCopies || 1)) : 0;

    // طباعة فاتورة العميل N مرة
    for (let i = 0; i < customerCopies; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 800));
      await printOneImage(receiptPng);
    }
    // ثم نسخة الموظف N مرة
    for (let i = 0; i < kitchenCopies; i++) {
      await new Promise(r => setTimeout(r, 800));
      await printOneImage(employeePng);
    }
  } else {
    // وضع المعاينة: نافذة تعرض النسختين جنباً إلى جنب مع أزرار طباعة
    const win = window.open('', '_blank', 'width=820,height=860,scrollbars=yes,resizable=yes');
    if (win) {
      win.document.open();
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فواتير الطلب - ${displayInvoiceNumber}</title><style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Tahoma, Arial, sans-serif; background: #e8e8e8; padding: 16px; min-height: 100vh; text-align: center; }
        .toolbar { margin-bottom: 16px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .btn { padding: 12px 24px; font-size: 14px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; }
        .btn-print { background: #1a1a1a; color: #fff; }
        .btn-cust { background: #1e40af; color: #fff; }
        .btn-emp { background: #b45309; color: #fff; }
        .btn-close { background: #6b7280; color: #fff; }
        .frames { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: flex-start; }
        .col { display: flex; flex-direction: column; align-items: center; }
        h3 { font-size: 12px; font-weight: 700; color: #333; margin-bottom: 8px; background: #fff; padding: 4px 14px; border-radius: 20px; border: 1px solid #ccc; }
        .receipt { display: inline-block; background: #fff; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,.15); }
        .receipt img { display: block; width: 320px; height: auto; }
        @media print {
          body { background: #fff; padding: 0; margin: 0; }
          .toolbar, .no-print, h3 { display: none !important; }
          .frames { display: block; }
          .col { display: block; page-break-after: always; }
          .col:last-child { page-break-after: auto; }
          .receipt { box-shadow: none; border-radius: 0; }
          .receipt img { width: 80mm; }
          @page { size: 80mm auto; margin: 0; }
        }
      </style></head><body>
        <div class="toolbar no-print">
          <button class="btn btn-print" onclick="window.print()">🖨️ طباعة النسختين</button>
          <button class="btn btn-cust" onclick="printOne('cust')">🧾 العميل فقط</button>
          <button class="btn btn-emp" onclick="printOne('emp')">📋 الموظف فقط</button>
          <button class="btn btn-close" onclick="window.close()">✕ إغلاق</button>
        </div>
        <div class="frames">
          <div class="col" id="col-cust"><h3>🧾 فاتورة العميل</h3><div class="receipt"><img src="${receiptPng}" alt="فاتورة العميل" /></div></div>
          <div class="col" id="col-emp"><h3>📋 نسخة الموظف</h3><div class="receipt"><img src="${employeePng}" alt="نسخة الموظف" /></div></div>
        </div>
        <script>
          function printOne(which) {
            var hideId = which === 'cust' ? 'col-emp' : 'col-cust';
            var el = document.getElementById(hideId);
            var prev = el.style.display;
            el.style.display = 'none';
            window.print();
            setTimeout(function(){ el.style.display = prev; }, 500);
          }
        </script>
      </body></html>`);
      win.document.close();
    }
    return;
  }
}

export async function printCustomerPickupReceipt(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  const orderTrackingUrl = `${window.location.origin}/order/${data.orderNumber}`;
  
  let qrCodeUrl = "";
  try {
    qrCodeUrl = await QRCode.toDataURL(orderTrackingUrl, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("Error generating order tracking QR:", error);
  }

  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const deliveryTypeAr = data.deliveryTypeAr || (data.deliveryType === 'dine-in' ? 'في المطعم' : data.deliveryType === 'delivery' ? 'توصيل' : 'استلام');

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال استلام - ${data.orderNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
      ${data.items.map((item, idx) => {
        const extras = _renderItemExtras(item, { fontSize: 12, color: '#92400e', showPrices: false });
        const sep = idx > 0 ? 'border-top:1px dashed #ddd;padding-top:10px;' : '';
        return `
        <div class="item-row" style="align-items:flex-start;padding:10px 0;${sep}">
          <div class="item-name" style="flex:1;">
            ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
            ${extras}
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

    <div class="qr-section">
      <p class="qr-title">امسح لتتبع طلبك</p>
      ${qrCodeUrl ? `<div class="qr-container"><img src="${qrCodeUrl}" alt="Order Tracking QR" /></div>` : ''}
      <p class="qr-note">أو زر الرابط: chefsplace.online/order/${data.orderNumber}</p>
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
  const deliveryTypeAr = data.deliveryTypeAr || (data.deliveryType === 'dine-in' ? 'في المطعم' : data.deliveryType === 'delivery' ? 'توصيل' : 'استلام');
  const totalAmount = parseNumber(data.total);

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>نسخة الكاشير - ${data.orderNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; }
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
      ${data.items.map((item, idx) => {
        const price = parseNumber(item.coffeeItem.price);
        const extras = _renderItemExtras(item, { fontSize: 11, color: '#555', showPrices: true });
        const sep = idx > 0 ? 'border-top:1px dashed #ddd;' : '';
        return `
        <div class="item-row" style="align-items:flex-start;padding:10px 0;${sep}">
          <div style="flex:1;">
            ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}<span style="font-size:11px;color:#555;"> x${item.quantity}</span>
            ${extras}
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
      <div class="total-row" style="font-size:11px;"><span>نقدي:</span><span>${data.splitPayment.cash.toFixed(2)} ر.س</span></div>
      <div class="total-row" style="font-size:11px;"><span>شبكة:</span><span>${data.splitPayment.card.toFixed(2)} ر.س</span></div>` : ''}
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
      // Ensure browser fallback (printUnifiedReceipt) also sees the label
      if (!data.orderTypeName && orderTypeLabel) (data as any).orderTypeName = orderTypeLabel;

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
          addons: (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr),
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
              addons: (item.customization?.selectedItemAddons || []).map((a: any) => a.nameAr),
            })),
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
    const extras = _renderItemExtras(item, { fontSize: 11, color: '#666', showPrices: true });
    return `
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 12px 4px;">
          ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
          ${extras}
        </td>
        <td style="padding: 8px 4px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 4px; text-align: left;">${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const trackingUrl = `${window.location.origin}/tracking?order=${data.orderNumber}`;
  let trackingQRCode = "";
  try {
    trackingQRCode = await QRCode.toDataURL(trackingUrl, {
      width: 100,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("Error generating tracking QR code:", error);
  }

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال - ${data.orderNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Cairo', sans-serif;
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

    ${trackingQRCode ? `
    <div style="text-align: center; padding: 16px 0; border-top: 2px dashed #333; margin-top: 16px;">
      <p style="font-size: 12px; color: #666; margin-bottom: 8px;">امسح لتتبع طلبك</p>
      <img src="${trackingQRCode}" alt="تتبع الطلب" style="width: 80px; height: 80px;" />
      <p style="font-size: 10px; color: #888; margin-top: 4px;">رقم الطلب: ${fmtOrderNum(data.orderNumber)}</p>
    </div>
    ` : ''}

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
  const shopName = opts.shopName || COMPANY_NAME;
  const payMethodLabel =
    opts.paymentMethod === 'cash' ? 'نقدي' :
    opts.paymentMethod === 'card' ? 'بطاقة' : 'مقسّم';

  const itemsRows = opts.items.map(it =>
    `<tr>
      <td style="padding:2px 4px;text-align:right;">${it.nameAr}</td>
      <td style="padding:2px 4px;text-align:center;">${it.quantity}</td>
      <td style="padding:2px 4px;text-align:left;">${it.subtotal.toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Tahoma, Arial, sans-serif; font-size:12px; color:#000; width:80mm; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .line { border-top:1px dashed #000; margin:4px 0; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:#eee; padding:2px 4px; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:16px;margin-bottom:4px;">${shopName}</div>
  <div class="center" style="font-size:13px;font-weight:bold;color:#c00;">استرجاع / مرتجع</div>
  <div class="line"></div>
  <div>رقم الاسترجاع: <b>${opts.refundId}</b></div>
  <div>الطلب الأصلي: <b>#${opts.originalOrderNumber}</b></div>
  <div>التاريخ: ${opts.date}</div>
  ${opts.employeeName ? `<div>الموظف: ${opts.employeeName}</div>` : ''}
  <div class="line"></div>
  <table>
    <thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="line"></div>
  <div class="bold" style="font-size:14px;">إجمالي الاسترجاع: ${opts.refundAmount.toFixed(2)} ر.س</div>
  <div>طريقة الاسترداد: ${payMethodLabel}</div>
  ${opts.paymentMethod === 'split' ? `<div>نقدي: ${(opts.cashAmount||0).toFixed(2)} | بطاقة: ${(opts.cardAmount||0).toFixed(2)}</div>` : ''}
  <div>السبب: ${opts.reason}</div>
  <div class="line"></div>
  <div class="center" style="margin-top:6px;">شكراً لتعاملكم معنا</div>
</body>
</html>`;

  openPrintWindow(html, `استرجاع - ${opts.refundId}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: false });
}
