/**
 * Thermal Printer Service
 * Supports: WebUSB (ESC/POS) → silent auto-print, no dialog
 *           Browser Print fallback (window.print via iframe)
 */

const ESC = 0x1b;
const GS  = 0x1d;

function fmtOrderNum(n: string | number): string {
  const digits = String(n).replace(/\D/g, '');
  if (!digits) return `#${n}`;
  return `#${digits.padStart(4, '0')}`;
}

const CMD = {
  INIT:          [ESC, 0x40],
  ALIGN_LEFT:    [ESC, 0x61, 0x00],
  ALIGN_CENTER:  [ESC, 0x61, 0x01],
  ALIGN_RIGHT:   [ESC, 0x61, 0x02],
  BOLD_ON:       [ESC, 0x45, 0x01],
  BOLD_OFF:      [ESC, 0x45, 0x00],
  DOUBLE_SIZE:   [GS,  0x21, 0x11],
  LARGE_TEXT:    [GS,  0x21, 0x01],
  NORMAL_SIZE:   [GS,  0x21, 0x00],
  LINE_FEED:     [0x0a],
  FEED_3:        [ESC, 0x64, 0x03],
  FEED_5:        [ESC, 0x64, 0x05],
  // Multi-variant cut for maximum compatibility:
  // GS V 65 (0x41) = full cut after feed — works on Xprinter, Epson, most clones
  // GS V 66 n (0x42 n) = partial cut after n-dot feed
  // We use full cut (65) as primary
  CUT_PAPER:     [GS,  0x56, 0x41, 0x03],  // GS V 65 3 — feed 3 lines + FULL CUT
  PARTIAL_CUT:   [GS,  0x56, 0x42, 0x01],  // GS V 66 1 — partial cut (fallback)
  UNDERLINE_ON:  [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  CHARSET_PC864: [ESC, 0x74, 0x1b],  // Arabic PC864
  CHARSET_UTF8:  [ESC, 0x74, 0x1a],  // UTF-8 (code page 26 — Xprinter/Epson modern)
  SET_WIDTH_58:  [GS,  0x57, 0xd2, 0x00], // 58mm = 210 dots
  SET_WIDTH_80:  [GS,  0x57, 0x50, 0x01], // 80mm = 576 dots
};

export interface PrinterSettings {
  enabled: boolean;
  mode: 'webusb' | 'network' | 'bluetooth' | 'browser' | 'relay' | 'queue';
  paperWidth: '58mm' | '80mm';
  autoPrint: boolean;
  autoKitchenCopy: boolean;
  /** عدد نسخ فاتورة العميل (1-5) */
  customerCopies: number;
  /** عدد نسخ نسخة المطبخ/الموظف (1-5). يُستخدم فقط إذا autoKitchenCopy مفعّل */
  kitchenCopies: number;
  vendorId?: number;
  productId?: number;
  printerName?: string;
  fontSize: 'small' | 'normal';
  cuttingMode: 'auto' | 'manual';
  feedLines: number;
  // Network printer (LAN/TCP) — ProPos, Epson TM-T88 LAN, Xprinter NW, etc.
  // (legacy single-printer — used as fallback if multi-printer IPs not set)
  networkIp?: string;
  networkPort?: number;
  // ── Multi-Printer Support (3 ProPos PP9000E printers) ──────────────────────
  // طابعة العميل — Customer receipt printer
  customerPrinterIp?: string;   // e.g. 192.168.3.22
  customerPrinterPort?: number; // default 9100
  // طابعة المطبخ 1 — Kitchen printer 1
  kitchen1PrinterIp?: string;   // e.g. 192.168.1.114
  kitchen1PrinterPort?: number; // default 9100
  // طابعة المطبخ 2 — Kitchen printer 2 (3rd printer)
  kitchen2PrinterIp?: string;   // e.g. 192.168.1.xxx
  kitchen2PrinterPort?: number; // default 9100
  // Bluetooth printer
  bluetoothDeviceName?: string;
  bluetoothDeviceId?: string;
  // Local Relay Agent — for Android/TabSense devices that can't use QZ Tray
  // The relay agent is a small Node.js server running on the local network.
  // Download: /print-relay.js  — run with: node print-relay.js
  relayAgentUrl?: string; // e.g. "http://192.168.1.5:8089"
  /** الرابط العام للمتجر (يُستخدم لباركود تتبع الطلب)
   *  مثال: https://chefsplace.online
   *  إذا تُرك فارغاً يستخدم window.location.origin */
  publicBaseUrl?: string;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  enabled: true,
  mode: 'relay',             // ← Local relay agent — required for LAN printers on cloud-hosted app
  paperWidth: '80mm',
  autoPrint: true,
  autoKitchenCopy: true,
  customerCopies: 1,
  kitchenCopies: 1,
  fontSize: 'normal',
  cuttingMode: 'auto',
  feedLines: 3,
  // Legacy single-printer (kept for backward compatibility)
  networkIp: '192.168.3.22',
  networkPort: 9100,
  // ── 3 ProPos PP9000E printers ──────────────────────────────────────────────
  customerPrinterIp:   '192.168.3.22',   // طابعة العميل (Customer Receipt)
  customerPrinterPort: 9100,
  kitchen1PrinterIp:   '192.168.1.114',  // طابعة المطبخ 1 (Kitchen 1)
  kitchen1PrinterPort: 9100,
  kitchen2PrinterIp:   '',               // طابعة المطبخ 2 — أضف IP الطابعة الثالثة
  kitchen2PrinterPort: 9100,
  relayAgentUrl: '',           // ← User must set relay agent URL after installing print-relay.js
};

const SETTINGS_KEY = 'qirox-printer-settings';
const DEVICE_KEY   = 'qirox-printer-device';

// ─── Settings persistence ────────────────────────────────────────────────────

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Migration: if no networkIp saved, fill in the default printer
      if (!saved.networkIp) saved.networkIp = DEFAULT_SETTINGS.networkIp;
      if (!saved.networkPort) saved.networkPort = DEFAULT_SETTINGS.networkPort;
      // Migration: if mode was 'browser' and no explicit mode override, switch to 'network'
      // (Only applies if user never explicitly set the mode to browser themselves)
      if (saved.mode === 'browser' && !saved._modeExplicitlySet) {
        saved.mode = 'network';
      }
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function savePrinterSettings(s: Partial<PrinterSettings>): PrinterSettings {
  const merged = { ...loadPrinterSettings(), ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

// ─── WebUSB helpers ──────────────────────────────────────────────────────────

export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

let _usbDevice: USBDevice | null = null;

export async function requestUSBPrinter(): Promise<USBDevice | null> {
  if (!isWebUSBSupported()) return null;
  try {
    const device = await (navigator as any).usb.requestDevice({ filters: [] });
    await _openDevice(device);
    localStorage.setItem(DEVICE_KEY, JSON.stringify({
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName || 'Thermal Printer',
    }));
    _usbDevice = device;
    return device;
  } catch {
    return null;
  }
}

// Last USB error — exposed so thermalPrint can include it in the failure message
let _usbLastError: string | null = null;

export function getUSBLastError(): string | null { return _usbLastError; }

export async function reconnectSavedUSBPrinter(): Promise<USBDevice | null> {
  if (!isWebUSBSupported()) return null;
  _usbLastError = null;
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (!saved) return null;
    const { vendorId, productId } = JSON.parse(saved);
    const devices = await (navigator as any).usb.getDevices();
    const device = devices.find((d: USBDevice) => d.vendorId === vendorId && d.productId === productId);
    if (!device) {
      _usbLastError = 'الطابعة غير موجودة — تأكد من توصيل كابل USB وتشغيل الطابعة';
      return null;
    }
    await _openDevice(device); // May throw if interface cannot be claimed
    _usbDevice = device;
    return device;
  } catch (e: any) {
    _usbLastError = e?.message || 'فشل فتح الطابعة USB';
    _usbDevice = null;
    _claimedInterface = null;
    return null;
  }
}

// Tracks the interface number that was successfully claimed (per device)
let _claimedInterface: number | null = null;

async function _openDevice(device: USBDevice): Promise<void> {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  // Try to claim each interface — stop at the first success.
  // "already claimed" by us is treated as success (device already open from this session).
  _claimedInterface = null;
  const interfaces = device.configuration?.interfaces ?? [];

  for (const iface of interfaces) {
    try {
      await device.claimInterface(iface.interfaceNumber);
      _claimedInterface = iface.interfaceNumber;
      break; // Claimed successfully
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('already claimed') || msg.includes('already been claimed')) {
        // Interface was already claimed in this browser session — treat as success
        _claimedInterface = iface.interfaceNumber;
        break;
      }
      // SecurityError / OS driver conflict — continue trying other interfaces
    }
  }

  // If still null: try to find any claimed interface by testing transferOut feasibility
  // (some browsers don't report interfaces as claimed even when they are)
  if (_claimedInterface === null) {
    for (const iface of interfaces) {
      if (iface.claimed) {
        _claimedInterface = iface.interfaceNumber;
        break;
      }
    }
  }

  if (_claimedInterface === null) {
    // On Windows: OS driver holds the interface → user must install Zadig/WinUSB
    // On Android: OS may hold interface but transferOut can still work on some devices
    // → DON'T throw on Android (navigator.userAgent contains "Android")
    // → DO throw on Windows (non-Android desktop)
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (!isAndroid) {
      throw new Error(
        'لا يمكن الاستئثار بالطابعة USB — على Windows استخدم Zadig لتثبيت درايفر WinUSB، أو استخدم وضع الشبكة (LAN) بدلاً من USB'
      );
    }
    // Android fallback: attempt to use interface 0 (standard printer class)
    console.warn('[Printer] Could not claim interface on Android — attempting fallback to interface 0');
    _claimedInterface = 0;
  }
}

export function getSavedDeviceInfo(): { vendorId: number; productId: number; productName: string } | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedDevice(): void {
  localStorage.removeItem(DEVICE_KEY);
  _usbDevice = null;
}

async function _sendToUSB(data: Uint8Array): Promise<boolean> {
  if (!_usbDevice) return false;

  // If the interface was lost (e.g. device reopened), re-open
  if (_claimedInterface === null) {
    try {
      await _openDevice(_usbDevice);
    } catch (err) {
      console.error('[Printer] USB re-open failed:', err);
      _usbDevice = null;
      return false;
    }
  }

  try {
    // Only look at the claimed interface, not all interfaces
    for (const iface of _usbDevice.configuration!.interfaces) {
      if (_claimedInterface !== null && iface.interfaceNumber !== _claimedInterface) continue;
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out' && ep.type === 'bulk') {
            await _usbDevice.transferOut(ep.endpointNumber, data);
            return true;
          }
        }
      }
    }
    // No bulk-out endpoint found in claimed interface — try all (older devices with alternate settings)
    for (const iface of _usbDevice.configuration!.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out' && ep.type === 'bulk') {
            await _usbDevice.transferOut(ep.endpointNumber, data);
            return true;
          }
        }
      }
    }
    return false;
  } catch (err) {
    console.error('[Printer] USB transfer error:', err);
    _usbDevice = null;
    _claimedInterface = null;
    return false;
  }
}

// ─── ESC/POS receipt builder ─────────────────────────────────────────────────

function bytes(...cmds: number[][]): Uint8Array {
  const flat = ([] as number[]).concat(...cmds);
  return new Uint8Array(flat);
}

function textBytes(text: string): number[] {
  // Use TextEncoder for UTF-8 — most modern thermal printers support it
  return Array.from(new TextEncoder().encode(text));
}

function line(text: string): number[] {
  return [...textBytes(text), 0x0a];
}

/**
 * Center a text string for ESC/POS printers.
 * For Arabic/multilingual text the printer's ESC a 1 center command may miscalculate
 * because UTF-8 bytes ≠ display columns. We pad manually instead.
 * Arabic characters: 2 UTF-8 bytes each but 1 display column → divide byte length by 2.
 */
function centerLine(text: string, width: number = 48): number[] {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  // Estimate display width: ASCII = 1 col, non-ASCII (Arabic) ≈ 1 col per 2 bytes
  let displayWidth = 0;
  for (let i = 0; i < encoded.length; ) {
    const b = encoded[i];
    if (b < 0x80) { displayWidth += 1; i += 1; }       // ASCII
    else if (b < 0xe0) { displayWidth += 1; i += 2; }  // 2-byte UTF-8 (Arabic, Latin ext)
    else if (b < 0xf0) { displayWidth += 1; i += 3; }  // 3-byte UTF-8
    else               { displayWidth += 1; i += 4; }  // 4-byte UTF-8
  }
  const pad = Math.max(0, Math.floor((width - displayWidth) / 2));
  // Use printer center-align command — more reliable on most printers
  return [...CMD.ALIGN_CENTER, ...textBytes(text), 0x0a];
}

function dottedLine(width: number = 48): number[] {
  return [...CMD.ALIGN_LEFT, ...textBytes('='.repeat(width)), 0x0a];
}

function thinLine(width: number = 48): number[] {
  return [...CMD.ALIGN_LEFT, ...textBytes('-'.repeat(width)), 0x0a];
}

function padRow(label: string, value: string, width: number = 48): number[] {
  // label is Arabic (RTL), value is LTR numbers — space between them
  const labelBytes = new TextEncoder().encode(label).length;
  const valueBytes = new TextEncoder().encode(value).length;
  // Estimate display widths (Arabic chars: 2 bytes = 1 col)
  const labelCols = Math.ceil(labelBytes / 2);
  const valueCols = value.length; // numbers/ASCII = 1 col each
  const space = Math.max(1, width - labelCols - valueCols);
  const row = label + ' '.repeat(space) + value;
  return [...CMD.ALIGN_LEFT, ...textBytes(row), 0x0a];
}

export interface EscPosReceiptData {
  shopName: string;
  vatNumber: string;
  branchName?: string;
  address?: string;
  orderNumber: string;
  date: string;
  cashierName: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    addons?: string[];
  }>;
  subtotal: number;
  vat: number;
  total: number;
  discount?: number;
  splitPayment?: { cash: number; card: number };
  paymentMethod: string;
  paperWidth: '58mm' | '80mm';
  feedLines?: number;
  skipCut?: boolean; // if true, skip feed+cut at end (so caller can append more data)
}

export function buildEscPosReceipt(data: EscPosReceiptData): Uint8Array {
  // Standard ESC/POS widths:
  // 58mm paper → 32 chars per line (standard is actually 32 at 12-dot font)
  // 80mm paper → 48 chars per line (standard is 48 at 12-dot font, 203 DPI)
  const w = data.paperWidth === '58mm' ? 32 : 48;
  const buf: number[] = [];

  // ── Init printer ──────────────────────────────────────────────────────────
  buf.push(...CMD.INIT);
  // Enable UTF-8 code page (0x1A = page 26) — supported by Xprinter NW series & modern Epson clones
  // This allows Arabic Unicode characters to print correctly instead of showing garbage symbols
  buf.push(...CMD.CHARSET_UTF8);
  // Also set Arabic international charset via ESC R 40 (for printers that use this instead)
  buf.push(ESC, 0x52, 0x28);

  // ── Shop header (centered) ────────────────────────────────────────────────
  buf.push(...CMD.ALIGN_CENTER);
  buf.push(...CMD.BOLD_ON, ...CMD.DOUBLE_SIZE);
  buf.push(...textBytes(data.shopName), 0x0a);
  buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);

  if (data.branchName) buf.push(...centerLine(data.branchName, w));
  if (data.address)    buf.push(...centerLine(data.address, w));
  buf.push(...CMD.ALIGN_CENTER, ...textBytes(`VAT: ${data.vatNumber}`), 0x0a);
  buf.push(...dottedLine(w));

  // ── Invoice label ─────────────────────────────────────────────────────────
  buf.push(...CMD.ALIGN_CENTER, ...CMD.BOLD_ON, ...CMD.DOUBLE_SIZE);
  buf.push(...textBytes('فاتورة ضريبية مبسطة'), 0x0a);
  buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);

  // ── Spacing between invoice label and order number (3 blank lines) ───────
  buf.push(0x0a, 0x0a, 0x0a);

  // ── Order number (large, centered) ───────────────────────────────────────
  buf.push(...CMD.DOUBLE_SIZE, ...CMD.BOLD_ON, ...CMD.ALIGN_CENTER);
  buf.push(...textBytes(fmtOrderNum(data.orderNumber)), 0x0a);
  buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);
  buf.push(0x0a);

  buf.push(...thinLine(w));

  // ── Info block ────────────────────────────────────────────────────────────
  buf.push(...CMD.ALIGN_LEFT);
  buf.push(...line(`التاريخ : ${data.date}`));
  buf.push(...line(`الكاشير : ${data.cashierName}`));
  if (data.customerName && data.customerName !== 'عميل نقدي') {
    buf.push(...line(`العميل  : ${data.customerName}`));
  }
  if (data.tableNumber) buf.push(...line(`الطاولة : ${data.tableNumber}`));
  if (data.orderType)   buf.push(...line(`النوع   : ${data.orderType}`));
  buf.push(...thinLine(w));

  // ── Items ─────────────────────────────────────────────────────────────────
  for (const item of data.items) {
    const itemTotal = (item.qty * item.price).toFixed(2);
    buf.push(...CMD.BOLD_ON);
    buf.push(...CMD.ALIGN_LEFT, ...textBytes(item.name), 0x0a);
    buf.push(...CMD.BOLD_OFF);
    buf.push(...padRow(`  ${item.qty} x ${item.price.toFixed(2)}`, `${itemTotal} ر.س`, w));
    if (item.addons?.length) {
      for (const addon of item.addons) {
        buf.push(...line(`    + ${addon}`));
      }
    }
  }

  buf.push(...dottedLine(w));

  // ── Totals ────────────────────────────────────────────────────────────────
  buf.push(...padRow('المجموع قبل الضريبة :', `${data.subtotal.toFixed(2)} ر.س`, w));
  buf.push(...padRow('ضريبة القيمة 15%    :', `${data.vat.toFixed(2)} ر.س`, w));
  if (data.discount && data.discount > 0) {
    buf.push(...padRow('الخصم               :', `-${data.discount.toFixed(2)} ر.س`, w));
  }

  buf.push(...dottedLine(w));
  buf.push(...CMD.BOLD_ON, ...CMD.DOUBLE_SIZE, ...CMD.ALIGN_CENTER);
  buf.push(...textBytes(`الاجمالي : ${data.total.toFixed(2)} ر.س`), 0x0a);
  buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);
  buf.push(...dottedLine(w));

  buf.push(...CMD.ALIGN_LEFT);
  buf.push(...line(`طريقة الدفع : ${data.paymentMethod}`));
  if (data.splitPayment) {
    buf.push(...line(`  نقدي  : ${data.splitPayment.cash.toFixed(2)} ر.س`));
    buf.push(...line(`  شبكة  : ${data.splitPayment.card.toFixed(2)} ر.س`));
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  buf.push(...CMD.ALIGN_CENTER);
  buf.push(...CMD.BOLD_ON);
  buf.push(...textBytes('** شكراً لزيارتكم **'), 0x0a);
  buf.push(...CMD.BOLD_OFF);
  buf.push(...textBytes('الاسعار شاملة ضريبة القيمة المضافة'), 0x0a);
  buf.push(...textBytes("مكان الشيف البخاري"), 0x0a);

  if (data.skipCut) {
    // Caller will append more data (e.g. QR raster) before cutting
    return new Uint8Array(buf);
  }

  // ── Feed then FULL CUT ────────────────────────────────────────────────────
  buf.push(ESC, 0x64, 4);
  buf.push(...CMD.CUT_PAPER);

  return new Uint8Array(buf);
}

/**
 * Convert a QR/image data URL to ESC/POS GS v 0 raster bytes.
 * Draws the image centered on paper, returns ESC/POS bytes (no init, no cut).
 */
export async function dataUrlToEscPosRaster(
  dataUrl: string,
  paperWidth: '58mm' | '80mm',
  targetPx: number = 200,
): Promise<Uint8Array> {
  const dotWidth = paperWidth === '58mm' ? 384 : 576;
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>(res => {
    if (img.complete && img.naturalWidth > 0) { res(); return; }
    img.onload = () => res();
    img.onerror = () => res();
    setTimeout(res, 3000);
  });

  const size = Math.min(targetPx, dotWidth);
  const canvas = document.createElement('canvas');
  canvas.width = dotWidth;
  canvas.height = size + 10;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const x = Math.floor((dotWidth - size) / 2);
  ctx.drawImage(img, x, 5, size, size);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const bpl = Math.ceil(w / 8);
  const buf: number[] = [];

  buf.push(0x1d, 0x76, 0x30, 0x00);
  buf.push(bpl & 0xff, (bpl >> 8) & 0xff);
  buf.push(h & 0xff, (h >> 8) & 0xff);

  for (let y = 0; y < h; y++) {
    for (let bx = 0; bx < bpl; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = bx * 8 + bit;
        if (px < w) {
          const i = (y * w + px) * 4;
          const lum = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
          if (lum < 128) byte |= 1 << (7 - bit);
        }
      }
      buf.push(byte);
    }
  }
  return new Uint8Array(buf);
}

/**
 * Canvas 2D receipt renderer → ESC/POS raster bytes.
 * Draws the complete receipt using the browser's own text engine (Arabic works perfectly).
 * Output is pixel-for-pixel identical to the HTML preview.
 */
export interface ReceiptBitmapOpts {
  shopName: string;
  vatNumber: string;
  branchName?: string;
  tagline?: string;
  orderNumber: string;
  orderDate: string;
  cashierName: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items: Array<{ name: string; qty: number; price: number; addons?: string[] }>;
  subtotal: number;
  vat: number;
  total: number;
  discount?: number;
  splitPayment?: { cash: number; card: number };
  paymentMethod: string;
  logoDataUrl?: string;
  trackingQrDataUrl?: string;
  zatcaQrDataUrl?: string;
  paperWidth: '58mm' | '80mm';
  feedLines?: number;
}

/**
 * Renders a complete receipt to a Canvas 2D bitmap with native Arabic shaping.
 * Returns the trimmed canvas — pixel-perfect, no HTML, no font loading races,
 * no encoding issues. Used by both ESC/POS thermal printing and browser printing.
 */
export async function buildReceiptCanvas(opts: ReceiptBitmapOpts): Promise<HTMLCanvasElement> {
  const DW = opts.paperWidth === '58mm' ? 384 : 576;
  const PAD = Math.round(DW * 0.04);   // ~4% side padding
  const CONTENT_W = DW - PAD * 2;
  const FS = opts.paperWidth === '58mm' ? 24 : 30;  // base font size (enlarged per request)

  // ── Helper: load an image from dataUrl ───────────────────────────────────
  const loadImg = (src: string): Promise<HTMLImageElement> =>
    new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(img);
      setTimeout(() => res(img), 4000);
      img.src = src;
    });

  // ── Pre-load images ───────────────────────────────────────────────────────
  const [logoImg, trackImg, zatcaImg] = await Promise.all([
    opts.logoDataUrl ? loadImg(opts.logoDataUrl) : Promise.resolve(null),
    opts.trackingQrDataUrl ? loadImg(opts.trackingQrDataUrl) : Promise.resolve(null),
    opts.zatcaQrDataUrl ? loadImg(opts.zatcaQrDataUrl) : Promise.resolve(null),
  ]);

  // ── Build drawing queue (y-position auto-managed) ────────────────────────
  type DrawOp =
    | { type: 'img'; img: HTMLImageElement; size: number; }
    | { type: 'text'; text: string; align: 'center' | 'left' | 'right'; fs: number; bold: boolean; color?: string; }
    | { type: 'row'; label: string; value: string; fs: number; boldLabel?: boolean; boldValue?: boolean; color?: string; }
    | { type: 'line'; thick?: boolean; dashed?: boolean; }
    | { type: 'gap'; h: number; };

  const ops: DrawOp[] = [];

  const addGap   = (h = 6) => ops.push({ type: 'gap', h });
  // Lines/dividers removed per request — replaced with a small spacing gap
  const addLine  = (_thick = false, _dashed = false) => ops.push({ type: 'gap', h: 6 });
  const addText  = (text: string, align: 'center'|'left'|'right' = 'center', fs = FS, bold = false, color?: string) =>
    ops.push({ type: 'text', text, align, fs, bold, color });
  const addRow   = (label: string, value: string, fs = FS, boldLabel = false, boldValue = false, color?: string) =>
    ops.push({ type: 'row', label, value, fs, boldLabel, boldValue, color });
  const addImg   = (img: HTMLImageElement | null, size: number) => {
    if (img && img.naturalWidth > 0) ops.push({ type: 'img', img, size });
  };

  // ── RECEIPT LAYOUT ────────────────────────────────────────────────────────
  addGap(8);

  // Logo
  addImg(logoImg, Math.round(DW * 0.25));
  addGap(4);

  // Shop name
  addText(opts.shopName, 'center', Math.round(FS * 1.5), true);
  if (opts.branchName) addText(opts.branchName, 'center', FS);
  if (opts.tagline)    addText(opts.tagline, 'center', Math.round(FS * 0.9), false, '#444');
  addText(`VAT: ${opts.vatNumber}`, 'center', Math.round(FS * 0.85), false, '#555');

  addLine(true);

  addText('فاتورة ضريبية مبسطة', 'center', Math.round(FS * 1.15), true);
  addGap(Math.round(FS * 2.5));

  // Order number (no label, just the number — large and bold)
  const orderNumFmt = String(opts.orderNumber).replace(/\D/g, '').padStart(4, '0') || opts.orderNumber;
  addText(`#${orderNumFmt}`, 'center', Math.round(FS * 2.8), true);
  addGap(Math.round(FS * 0.6));

  addLine(false, true);

  // Info block
  addRow('التاريخ:', opts.orderDate, FS);
  addRow('الكاشير:', opts.cashierName, FS);
  if (opts.customerName && opts.customerName !== 'عميل نقدي') addRow('العميل:', opts.customerName, FS);
  if (opts.tableNumber) addRow('الطاولة:', opts.tableNumber, FS);
  if (opts.orderType)   addRow('نوع الطلب:', opts.orderType, FS);

  addLine(true);

  // Items
  for (const item of opts.items) {
    addText(item.name, 'right', FS, true);
    addRow(`${item.qty} × ${item.price.toFixed(2)} ر.س`, `${(item.qty * item.price).toFixed(2)} ر.س`, Math.round(FS * 0.9));
    if (item.addons?.length) {
      for (const a of item.addons) addText(`+ ${a}`, 'right', Math.round(FS * 0.82), false, '#555');
    }
    addLine(false, true);
  }

  addLine(false, true);

  // Totals
  addRow('قبل الضريبة:', `${opts.subtotal.toFixed(2)} ر.س`, FS);
  addRow('ضريبة القيمة المضافة 15%:', `${opts.vat.toFixed(2)} ر.س`, FS);
  if (opts.discount && opts.discount > 0)
    addRow('الخصم:', `-${opts.discount.toFixed(2)} ر.س`, FS, false, false, '#16a34a');

  addLine(true);

  // Total — normal weight per user request
  addRow('الإجمالي:', `${opts.total.toFixed(2)} ر.س`, Math.round(FS * 1.2));

  addLine(false, true);

  // Payment
  addRow('طريقة الدفع:', opts.paymentMethod, FS);
  if (opts.splitPayment) {
    addRow('  نقدي:', `${opts.splitPayment.cash.toFixed(2)} ر.س`, Math.round(FS * 0.9));
    addRow('  شبكة:', `${opts.splitPayment.card.toFixed(2)} ر.س`, Math.round(FS * 0.9));
  }

  // Tracking QR — LARGE (primary action for the customer)
  if (trackImg && trackImg.naturalWidth > 0) {
    addLine(true);
    addGap(8);
    addImg(trackImg, Math.round(DW * 0.60));   // large
    addGap(Math.round(FS * 1.2));              // breathing room before label
    addText('امسح للتتبع وتسجيل النقاط', 'center', Math.round(FS * 0.9), true, '#333');
    addGap(Math.round(FS * 2));                // ~2 lines of empty space below the tracking QR block
  }

  addLine(true);

  // Footer
  addText('** شكراً لزيارتكم **', 'center', Math.round(FS * 1.1), true);
  addText('الأسعار شاملة ضريبة القيمة المضافة 15%', 'center', Math.round(FS * 0.82), false, '#444');
  if (opts.tagline) addText(opts.tagline, 'center', Math.round(FS * 0.9), false, '#444');
  addText(opts.shopName, 'center', FS, true);

  // ZATCA QR — smaller (compliance only)
  if (zatcaImg && zatcaImg.naturalWidth > 0) {
    addLine(false, true);
    addGap(6);
    addImg(zatcaImg, Math.round(DW * 0.32));   // small
    addText('ZATCA · باركود الضريبة', 'center', Math.round(FS * 0.75), false, '#555');
    addGap(6);
  }

  addGap(opts.feedLines ? opts.feedLines * 8 : 24);

  // ── Render to canvas ─────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = 5000;  // will be trimmed
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, DW, 5000);

  let y = 0;

  const measureTextH = (fs: number) => Math.ceil(fs * 1.45);

  for (const op of ops) {
    if (op.type === 'gap') {
      y += op.h;
    } else if (op.type === 'line') {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = op.thick ? 2.5 : 1;
      ctx.setLineDash(op.dashed ? [6, 5] : []);
      ctx.beginPath();
      ctx.moveTo(PAD, y + 4);
      ctx.lineTo(DW - PAD, y + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      y += 10;
    } else if (op.type === 'text') {
      const lh = measureTextH(op.fs);
      ctx.font = `${op.bold ? '700' : '400'} ${op.fs}px Tahoma, Arial, sans-serif`;
      ctx.fillStyle = op.color || '#000';
      ctx.direction = 'rtl';
      if (op.align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(op.text, DW / 2, y);
      } else if (op.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(op.text, DW - PAD, y);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(op.text, PAD, y);
      }
      y += lh;
    } else if (op.type === 'row') {
      const lh = measureTextH(op.fs);
      // Label (right side)
      ctx.font = `${op.boldLabel ? '700' : '400'} ${op.fs}px Tahoma, Arial, sans-serif`;
      ctx.fillStyle = op.color || '#000';
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillText(op.label, DW - PAD, y);
      // Value (left side)
      ctx.font = `${op.boldValue ? '700' : '400'} ${op.fs}px Tahoma, Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.fillText(op.value, PAD, y);
      y += lh;
    } else if (op.type === 'img') {
      const size = Math.min(op.size, CONTENT_W);
      const x = Math.floor((DW - size) / 2);
      ctx.drawImage(op.img, x, y, size, size);
      y += size + 4;
    }
  }

  // Trim canvas to actual content height
  const finalH = Math.min(y + 10, 5000);
  const trimmed = document.createElement('canvas');
  trimmed.width = DW;
  trimmed.height = finalH;
  const tctx = trimmed.getContext('2d')!;
  tctx.drawImage(canvas, 0, 0);
  return trimmed;
}

/**
 * Builds the receipt as a Canvas 2D bitmap, then converts to ESC/POS GS v 0 raster bytes
 * for direct thermal printer transmission. Arabic-safe — uses native browser text shaping.
 */
export async function buildReceiptBitmapEscPos(opts: ReceiptBitmapOpts): Promise<Uint8Array> {
  const canvas = await buildReceiptCanvas(opts);
  const DW = canvas.width;
  const finalH = canvas.height;
  const ctx = canvas.getContext('2d')!;

  // ── Convert to ESC/POS GS v 0 raster bytes ───────────────────────────────
  const imgData = ctx.getImageData(0, 0, DW, finalH);
  const bpl = Math.ceil(DW / 8);
  const raster: number[] = [];

  // Init + GS v 0 header
  raster.push(0x1b, 0x40);  // ESC @ init
  raster.push(0x1d, 0x76, 0x30, 0x00);
  raster.push(bpl & 0xff, (bpl >> 8) & 0xff);
  raster.push(finalH & 0xff, (finalH >> 8) & 0xff);

  for (let row = 0; row < finalH; row++) {
    for (let bx = 0; bx < bpl; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = bx * 8 + bit;
        if (px < DW) {
          const i = (row * DW + px) * 4;
          const lum = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
          if (lum < 128) byte |= 1 << (7 - bit);
        }
      }
      raster.push(byte);
    }
  }

  // Feed + full cut
  raster.push(0x1b, 0x64, 4);    // ESC d 4 — feed 4 lines
  raster.push(0x1d, 0x56, 0x41, 0x03);  // GS V A 3 — full cut

  return new Uint8Array(raster);
}

/**
 * Renders a compact "Employee Copy" / kitchen ticket as a Canvas 2D bitmap.
 * Same Arabic-safe pipeline as the main receipt — no HTML, no encoding issues.
 */
export interface EmployeeCopyOpts {
  orderNumber: string;
  tableNumber?: string;
  orderType?: string;
  cashierName: string;
  items: Array<{ name: string; qty: number; addons?: string[] }>;
  notes?: string;
  total?: number;
  orderDate?: string;
  paperWidth: '58mm' | '80mm';
}

export async function buildEmployeeCopyCanvas(opts: EmployeeCopyOpts): Promise<HTMLCanvasElement> {
  const DW = opts.paperWidth === '58mm' ? 384 : 576;
  const PAD = Math.round(DW * 0.04);
  const FS = opts.paperWidth === '58mm' ? 20 : 26;

  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = 4000;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, DW, 4000);

  let y = 18;
  const lh = (fs: number) => Math.ceil(fs * 1.6);

  const drawCenter = (text: string, fs: number, bold = false) => {
    ctx.font = `${bold ? '700' : '400'} ${fs}px Tahoma, Arial, sans-serif`;
    ctx.fillStyle = '#000';
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillText(text, DW / 2, y);
    y += lh(fs);
  };
  const drawRight = (text: string, fs: number, bold = false) => {
    ctx.font = `${bold ? '700' : '400'} ${fs}px Tahoma, Arial, sans-serif`;
    ctx.fillStyle = '#000';
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText(text, DW - PAD, y);
    y += lh(fs);
  };

  // ── HEADER: نسخة الموظف ──
  drawCenter('نسخة الموظف', Math.round(FS * 1.2), true);
  y += 8;

  // ── Order number (large, no box) ──
  const orderFmt = `#${String(opts.orderNumber).replace(/\D/g, '').padStart(4, '0') || opts.orderNumber}`;
  drawCenter(orderFmt, Math.round(FS * 2.2), true);
  y += 12;

  // ── Items: each on a single line "qty × name" ──
  for (const item of opts.items) {
    drawRight(`${item.qty} × ${item.name}`, Math.round(FS * 1.1), true);
    if (item.addons?.length) {
      for (const a of item.addons) {
        drawRight(`+ ${a}`, Math.round(FS * 0.9));
      }
    }
    y += 4;
  }

  y += 32; // feed

  // Trim
  const finalH = Math.min(y + 10, 4000);
  const trimmed = document.createElement('canvas');
  trimmed.width = DW;
  trimmed.height = finalH;
  trimmed.getContext('2d')!.drawImage(canvas, 0, 0);
  return trimmed;
}

/**
 * Arabic-safe kitchen/employee ticket via Canvas 2D bitmap.
 * Replaces the legacy raw-text builder which produced garbled Arabic on most thermal printers.
 */
export async function buildEscPosKitchenTicketBitmap(data: {
  orderNumber: string;
  tableNumber?: string;
  orderType?: string;
  cashierName: string;
  items: Array<{ name: string; qty: number; addons?: string[] }>;
  notes?: string;
  paperWidth: '58mm' | '80mm';
}): Promise<Uint8Array> {
  const canvas = await buildEmployeeCopyCanvas({
    orderNumber: data.orderNumber,
    tableNumber: data.tableNumber,
    orderType: data.orderType,
    cashierName: data.cashierName,
    items: data.items,
    notes: data.notes,
    paperWidth: data.paperWidth,
  });
  const DW = canvas.width;
  const finalH = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, DW, finalH);
  const bpl = Math.ceil(DW / 8);
  const raster: number[] = [];
  raster.push(0x1b, 0x40);
  raster.push(0x1d, 0x76, 0x30, 0x00);
  raster.push(bpl & 0xff, (bpl >> 8) & 0xff);
  raster.push(finalH & 0xff, (finalH >> 8) & 0xff);
  for (let row = 0; row < finalH; row++) {
    for (let bx = 0; bx < bpl; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = bx * 8 + bit;
        if (px < DW) {
          const i = (row * DW + px) * 4;
          const lum = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
          if (lum < 128) byte |= 1 << (7 - bit);
        }
      }
      raster.push(byte);
    }
  }
  raster.push(0x1b, 0x64, 4);
  raster.push(0x1d, 0x56, 0x41, 0x03);
  return new Uint8Array(raster);
}

export function buildEscPosKitchenTicket(data: {
  orderNumber: string;
  tableNumber?: string;
  orderType?: string;
  cashierName: string;
  items: Array<{ name: string; qty: number; addons?: string[] }>;
  notes?: string;
  paperWidth: '58mm' | '80mm';
}): Uint8Array {
  const w = data.paperWidth === '58mm' ? 32 : 48;
  const buf: number[] = [];

  // ── Init ───────────────────────────────────────────────────────────────────
  buf.push(...CMD.INIT);
  buf.push(...CMD.CHARSET_UTF8);
  buf.push(ESC, 0x52, 0x28);

  // ── Kitchen header ─────────────────────────────────────────────────────────
  buf.push(...CMD.ALIGN_CENTER, ...CMD.BOLD_ON, ...CMD.DOUBLE_SIZE);
  buf.push(...textBytes('*** نسخة المطبخ ***'), 0x0a);
  buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);

  // ── Order number (extra large) ─────────────────────────────────────────────
  buf.push(...CMD.DOUBLE_SIZE, ...CMD.ALIGN_CENTER);
  buf.push(...textBytes(fmtOrderNum(data.orderNumber)), 0x0a);
  buf.push(...CMD.NORMAL_SIZE);

  if (data.tableNumber) {
    buf.push(...CMD.LARGE_TEXT, ...CMD.ALIGN_CENTER, ...CMD.BOLD_ON);
    buf.push(...textBytes(`طاولة رقم: ${data.tableNumber}`), 0x0a);
    buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);
  }
  if (data.orderType) {
    buf.push(...CMD.ALIGN_CENTER);
    buf.push(...textBytes(`[ ${data.orderType} ]`), 0x0a);
  }
  buf.push(...dottedLine(w));

  // ── Items (large text for kitchen readability) ─────────────────────────────
  buf.push(...CMD.ALIGN_LEFT);
  for (const item of data.items) {
    buf.push(...CMD.BOLD_ON, ...CMD.LARGE_TEXT);
    buf.push(...textBytes(`${item.qty}x  ${item.name}`), 0x0a);
    buf.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);
    if (item.addons?.length) {
      for (const addon of item.addons) {
        buf.push(...line(`     --> ${addon}`));
      }
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (data.notes) {
    buf.push(...dottedLine(w));
    buf.push(...CMD.BOLD_ON);
    buf.push(...line('*** ملاحظات ***'));
    buf.push(...CMD.BOLD_OFF);
    buf.push(...line(data.notes));
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  buf.push(...dottedLine(w));
  buf.push(...CMD.ALIGN_CENTER);
  buf.push(...textBytes(`الكاشير: ${data.cashierName}`), 0x0a);

  // ── Feed then FULL CUT ─────────────────────────────────────────────────────
  buf.push(ESC, 0x64, 4);      // Feed 4 lines
  buf.push(...CMD.CUT_PAPER);  // GS V 65 3 — full cut

  return new Uint8Array(buf);
}

// ─── Image-based receipt builder ─────────────────────────────────────────────
// Renders HTML to a canvas then encodes as ESC/POS raster image.
// This is the most reliable approach for Arabic text — no encoding issues at all.
// Works with any thermal printer regardless of installed code pages.

export async function buildEscPosImageReceipt(
  html: string,
  paperWidth: '58mm' | '80mm',
  feedLines: number = 4,
): Promise<Uint8Array> {
  // Printer dot widths at 203 dpi: 58mm → 384 dots, 80mm → 576 dots
  const dotWidth = paperWidth === '58mm' ? 384 : 576;

  // Strip Google Fonts @import — use only system Arabic fonts (Tahoma/Arial)
  // so rendering works even without internet access
  let safeHtml = html
    .replace(/@import\s+url\([^)]*fonts\.googleapis[^)]*\)[^;]*;/gi, '')
    .replace(/font-family\s*:\s*['"]?Cairo['"]?\s*,?/gi, 'font-family: Tahoma, Arial,');

  // Use position:absolute (NOT fixed) — fixed breaks scrollHeight/offsetHeight calculation
  // Place far off-screen horizontally but at top:0 so the full height is measurable
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    `width:${dotWidth}px`,
    'position:absolute',
    'left:-99999px',
    'top:0',
    'background:#fff',
    'color:#000',
    'visibility:visible',
    'pointer-events:none',
    'overflow:visible',
  ].join(';');

  // Insert a scoped <style> block that resets page width
  const scopeStyle = `<style>
    html,body{margin:0;padding:0;background:#fff;color:#000;}
    *{box-sizing:border-box;}
  </style>`;
  wrapper.innerHTML = scopeStyle + safeHtml;
  document.body.appendChild(wrapper);

  // Wait for ALL images to finish loading before measuring or capturing
  const images = Array.from(wrapper.querySelectorAll('img'));
  await Promise.all(images.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>(res => {
      const done = () => res();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 4000); // safety timeout per image
    });
  }));

  // Brief extra delay to let flexbox / layout settle after images load
  await new Promise(r => setTimeout(r, 200));

  // Measure full rendered height — offsetHeight works correctly for absolute elements
  const contentHeight = Math.max(wrapper.offsetHeight, wrapper.scrollHeight, 300);

  let canvas: HTMLCanvasElement;
  try {
    const { default: html2canvas } = await import('html2canvas');
    canvas = await html2canvas(wrapper, {
      width: dotWidth,
      height: contentHeight,
      scale: 1,
      backgroundColor: '#ffffff',
      useCORS: false,
      logging: false,
      allowTaint: true,
      imageTimeout: 5000,
      removeContainer: false,
      // Ensure background colors (black boxes etc.) are captured
      onclone: (_doc: Document, el: HTMLElement) => {
        el.style.overflow = 'visible';
      },
    });
  } finally {
    wrapper.remove();
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height } = canvas;
  const actualBpl = Math.ceil(width / 8);

  // Build ESC/POS bytes ───────────────────────────────────────────────────────
  const buf: number[] = [];

  // Init printer
  buf.push(ESC, 0x40);

  // GS v 0 — Raster bit image (most compatible across Xprinter / Epson clones)
  // Format: GS v 0 m xL xH yL yH d...
  // m = 0 (normal), xL/xH = bytes per line, yL/yH = number of dot rows
  buf.push(GS, 0x76, 0x30, 0x00);
  buf.push(actualBpl & 0xff, (actualBpl >> 8) & 0xff);
  buf.push(height & 0xff, (height >> 8) & 0xff);

  // Rasterize: luminance threshold 128 (dark pixel → bit=1, MSB first)
  for (let y = 0; y < height; y++) {
    for (let bx = 0; bx < actualBpl; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = bx * 8 + bit;
        if (px < width) {
          const i = (y * width + px) * 4;
          const lum = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
          if (lum < 128) byte |= 1 << (7 - bit);
        }
      }
      buf.push(byte);
    }
  }

  // Feed lines then full cut
  buf.push(ESC, 0x64, Math.max(1, feedLines));
  buf.push(GS, 0x56, 0x41, 0x03);

  return new Uint8Array(buf);
}

// ─── Main print function ──────────────────────────────────────────────────────

export type PrintJobType = 'receipt' | 'kitchen' | 'employee-card';

export interface PrintResult {
  success: boolean;
  mode: 'webusb' | 'bluetooth' | 'network' | 'browser' | 'error';
  error?: string;
}

// ─── QZ Tray Integration ─────────────────────────────────────────────────────
// QZ Tray is a free desktop app that creates a local WebSocket bridge (wss://localhost:8181).
// The browser sends ESC/POS commands to QZ Tray, and QZ Tray forwards them directly
// to the LAN printer via raw TCP — this bypasses the cloud server entirely.
//
// Download & install: https://qz.io/download/
// Works with any ESC/POS thermal printer (Xprinter, Epson TM, Star, etc.)

let _qzLoadPromise: Promise<any> | null = null;
let _qzConnected = false;

async function _loadQZScript(): Promise<any> {
  if ((window as any).qz) return (window as any).qz;
  if (_qzLoadPromise) return _qzLoadPromise;

  _qzLoadPromise = new Promise<any>((resolve, reject) => {
    if (document.querySelector('script[data-qz-tray]')) {
      const poll = setInterval(() => {
        if ((window as any).qz) { clearInterval(poll); resolve((window as any).qz); }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error('QZ timeout')); }, 10000);
      return;
    }
    const s = document.createElement('script');
    s.setAttribute('data-qz-tray', '1');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.async = true;
    s.onload = () => (window as any).qz ? resolve((window as any).qz) : reject(new Error('qz not found'));
    s.onerror = () => reject(new Error('QZ script load failed'));
    document.head.appendChild(s);
  });
  return _qzLoadPromise;
}

async function _connectQZ(timeoutMs = 4000): Promise<any> {
  const qz = await _loadQZScript();
  if (_qzConnected && qz.websocket.isActive()) return qz;
  qz.security.setCertificatePromise((res: (v: any) => void) => res(''));
  qz.security.setSignaturePromise((_: string, res: (v: any) => void) => res(''));
  await Promise.race([
    qz.websocket.connect({ retries: 1, delay: 1 }),
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), timeoutMs)),
  ]);
  _qzConnected = true;
  return qz;
}

/** Check if QZ Tray desktop app is running on this machine */
export async function isQZTrayAvailable(): Promise<boolean> {
  try {
    const qz = await Promise.race([
      _loadQZScript(),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 4000)),
    ]);
    if (qz.websocket.isActive()) return true;
    await _connectQZ(3000);
    return true;
  } catch {
    return false;
  }
}

/** Print raw ESC/POS data directly to a LAN printer via QZ Tray (no cloud server needed) */
export async function qzTrayNetworkPrint(escData: Uint8Array, ip: string, port = 9100): Promise<PrintResult> {
  try {
    const qz = await _connectQZ(5000);
    const config = qz.configs.create({ host: ip, port: { primary: port } });
    const b64 = btoa(Array.from(escData, b => String.fromCharCode(b)).join(''));
    await qz.print(config, [{ type: 'raw', format: 'base64', data: b64 }]);
    return { success: true, mode: 'network' };
  } catch (err: any) {
    return { success: false, mode: 'error', error: `QZ Tray: ${err?.message || 'فشل'}` };
  }
}

/** Returns true for private LAN IP ranges — cloud servers can never reach these */
function _isPrivateLanIP(ip: string): boolean {
  const t = ip.trim();
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(t) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(t) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(t) ||
    /^169\.254\.\d{1,3}\.\d{1,3}$/.test(t)
  );
}

/**
 * Send ESC/POS data to a network printer (LAN/TCP).
 *
 * Priority:
 *   1. QZ Tray — if already connected (set up via printer settings)
 *   2. Server-side TCP — only for public IPs; skipped for private LAN IPs
 *      (cloud servers physically cannot reach 192.168.x.x etc.)
 *   3. Returns failure immediately so the caller can fall back to browser print
 *
 * QZ Tray is never auto-loaded here to keep printing fast with no side-effects.
 */
export async function networkPrint(escData: Uint8Array, ip: string, port: number = 9100): Promise<PrintResult> {
  // 1. Use QZ Tray if already connected (no CDN loading during print time)
  if (_qzConnected && (window as any).qz?.websocket?.isActive()) {
    const qzResult = await qzTrayNetworkPrint(escData, ip, port);
    if (qzResult.success) return qzResult;
    console.warn('[NetworkPrint] QZ Tray failed:', qzResult.error);
  }

  // 2. For private LAN IPs: use relay agent if configured (cloud server can't reach LAN IPs)
  if (_isPrivateLanIP(ip)) {
    const settings = loadPrinterSettings();
    if (settings.relayAgentUrl) {
      console.info(`[NetworkPrint] LAN IP ${ip} — routing via relay agent: ${settings.relayAgentUrl}`);
      return relayAgentPrint(escData, settings.relayAgentUrl, ip, port);
    }
    // No relay agent — fail fast (avoid 4-8s timeout freezing the UI)
    console.info(`[NetworkPrint] LAN IP ${ip} — no relay agent configured`);
    return { success: false, mode: 'error', error: `الطابعة (${ip}) على الشبكة المحلية — فعّل وكيل الطباعة في الإعدادات` };
  }

  // 3. Server-side TCP — for public/accessible IPs (local server deployments)
  try {
    const base64Data = btoa(Array.from(escData, b => String.fromCharCode(b)).join(''));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const resp = await fetch('/api/print/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port, data: base64Data, timeout: 3500 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        return { success: false, mode: 'error', error: result.error || 'فشلت الطباعة الشبكية' };
      }
      return { success: true, mode: 'network' as any };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    return { success: false, mode: 'error', error: err.name === 'AbortError' ? 'انتهت مهلة الاتصال' : (err.message || 'خطأ في الاتصال') };
  }
}

// ─── Local Relay Agent ────────────────────────────────────────────────────────
// A tiny Node.js HTTP server that runs on the local network (Windows / Mac / Pi)
// and bridges browser → TCP printer. Perfect for Android (Tab Sense) devices
// where QZ Tray is not available.
//
// Download the relay script from the app: /print-relay.js
// Run with: node print-relay.js
//
// The browser calls http://RELAY_IP:8089/print with base64 ESC/POS data.
// The relay opens a raw TCP socket to the printer and forwards the bytes.

/**
 * Send ESC/POS data to a LAN printer via the local relay agent.
 * The relay agent runs on the same local network as the printer.
 */
export async function relayAgentPrint(escData: Uint8Array, relayUrl: string, printerIp: string, printerPort = 9100): Promise<PrintResult> {
  try {
    const base = relayUrl.replace(/\/+$/, '');
    const b64  = btoa(Array.from(escData, b => String.fromCharCode(b)).join(''));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(`${base}/print`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ip: printerIp, port: printerPort, data: b64 }),
        signal:  controller.signal,
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        return { success: false, mode: 'error', error: result.error || 'فشل وكيل الطباعة المحلي' };
      }
      return { success: true, mode: 'network' };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return { success: false, mode: 'error', error: 'انتهت مهلة الاتصال بوكيل الطباعة' };
    return { success: false, mode: 'error', error: `وكيل الطباعة: ${err?.message || 'لا يمكن الاتصال'}` };
  }
}

/**
 * Test connection to the relay agent (and optionally to the printer through it).
 */
export async function testRelayAgent(relayUrl: string, printerIp?: string, printerPort = 9100): Promise<{ connected: boolean; message: string }> {
  try {
    const base = relayUrl.replace(/\/+$/, '');

    // 1. Ping the relay agent itself
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${base}/status`, { signal: controller.signal });
    if (!resp.ok) throw new Error(`الوكيل أجاب بخطأ ${resp.status}`);
    const info = await resp.json();

    // 2. If printer IP provided, also test printer reachability through the relay
    if (printerIp) {
      const c2 = new AbortController();
      setTimeout(() => c2.abort(), 6000);
      const r2 = await fetch(`${base}/test`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ip: printerIp, port: printerPort }),
        signal:  c2.signal,
      });
      const t2 = await r2.json();
      if (!t2.success) {
        return {
          connected: false,
          message:   `✅ وكيل الطباعة يعمل — لكن الطابعة ${printerIp}:${printerPort} لا تستجيب.\n${t2.error || ''}`,
        };
      }
      return {
        connected: true,
        message:   `✅ وكيل الطباعة جاهز (${info.localIPs?.join(' / ') || relayUrl})\n✅ الطابعة ${printerIp}:${printerPort} تستجيب — جاهزة للطباعة`,
      };
    }

    return {
      connected: true,
      message:   `✅ وكيل الطباعة يعمل (v${info.version || '?'}) على ${info.localIPs?.join(' / ') || relayUrl}`,
    };
  } catch (err: any) {
    const isNetErr = err.name === 'AbortError' || err.message?.includes('fetch') || err.message?.includes('network');
    return {
      connected: false,
      message:   isNetErr
        ? `❌ لا يمكن الوصول لوكيل الطباعة على ${relayUrl}\nتأكد أن البرنامج يعمل وأن الجهاز والكاشير على نفس الشبكة.`
        : `❌ ${err.message}`,
    };
  }
}

/**
 * Scan the local network for printers on a given port.
 * Calls the server-side discovery endpoint which probes the full /24 subnet.
 * @param subnetHint  Optional subnet prefix to scan, e.g. "192.168.8." — overrides
 *                    the server's auto-detected interface subnets. Useful when the
 *                    server is on a different subnet than the printer.
 */
export async function discoverNetworkPrinters(
  port: number = 9100,
  timeoutMs: number = 300,
  subnetHint?: string,
): Promise<{ ip: string; port: number }[]> {
  const resp = await fetch('/api/print/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port, timeout: timeoutMs, subnet: subnetHint }),
  });
  if (!resp.ok) throw new Error('فشل طلب الاكتشاف');
  const data = await resp.json();
  return data.found ?? [];
}

/**
 * Test network printer connectivity.
 * 1. Try QZ Tray first (browser-side — works for local LAN printers)
 * 2. Fall back to server-side TCP test (only succeeds if server is on same LAN)
 */
export async function testNetworkPrinter(ip: string, port: number = 9100): Promise<{ connected: boolean; message: string }> {
  // 1. QZ Tray path — browser connects directly to the LAN printer
  try {
    const qz = await _connectQZ(4000);
    const config = qz.configs.create({ host: ip, port: { primary: port } });
    // ESC INIT (0x1B 0x40) — safe no-op reset, just tests TCP reachability
    const initCmd = btoa(String.fromCharCode(0x1B, 0x40));
    await qz.print(config, [{ type: 'raw', format: 'base64', data: initCmd }]);
    return { connected: true, message: `✅ الطابعة ${ip}:${port} تعمل — تم الاتصال عبر QZ Tray` };
  } catch (qzErr: any) {
    const msg: string = qzErr?.message ?? '';
    // If QZ Tray connected but the printer itself rejected the connection
    if (!msg.includes('timeout') && !msg.includes('WebSocket') && !msg.includes('QZ script') && !msg.includes('qz not found') && !msg.includes('QZ Tray') && !msg.includes('load')) {
      return { connected: false, message: `❌ QZ Tray متصل لكن الطابعة ${ip}:${port} لا تستجيب — تحقق من IP والمنفذ` };
    }
    // QZ Tray not installed or not running — fall through to server-side test
  }

  // 2. Server-side TCP test (fails if server is cloud-hosted)
  try {
    const resp = await fetch('/api/print/network-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, timeout: 4000 }),
    });
    const result = await resp.json();
    if (result.connected) {
      return { connected: true, message: result.message || `✅ الطابعة ${ip}:${port} متاحة` };
    }
    // Server couldn't reach the printer — explain why
    return {
      connected: false,
      message: `⚠️ السيرفر لا يصل للطابعة المحلية (${ip}:${port}).\nالحل: ثبّت برنامج QZ Tray على جهاز الكاشير ليتصل المتصفح بالطابعة مباشرةً.`,
    };
  } catch {
    return {
      connected: false,
      message: `⚠️ لا يمكن الاتصال بـ ${ip}:${port}.\nالسيرفر السحابي لا يصل للطابعة المحلية. ثبّت QZ Tray على جهاز الكاشير.`,
    };
  }
}

// ─── Bluetooth (BLE) Printer ──────────────────────────────────────────────────
// Works with any ESC/POS BLE printer: Xprinter XP-P300BT, MUNBYN BT, Rongta, etc.
// Uses Web Bluetooth API — Chrome/Edge desktop & Android only.

/** Known BLE printer service UUIDs (ordered by prevalence) */
const BT_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic BLE SPP (most common)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Bluetooth printer SP service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic custom FF00
  '00001101-0000-1000-8000-00805f9b34fb', // SPP (classic, limited BLE support)
];

/** Known write characteristic UUIDs */
const BT_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Generic BLE write
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // BLE printer write
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // ISSC UART write
  '0000ff02-0000-1000-8000-00805f9b34fb', // FF00 write char
  '0000ff01-0000-1000-8000-00805f9b34fb', // FF00 write alt
];

const BT_DEVICE_KEY = 'qirox-bt-printer';

/** Cache connected BLE device & write characteristic */
let _btDevice: BluetoothDevice | null = null;
let _btCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

/** Is Web Bluetooth supported in this browser? */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** Save BT device name/id to localStorage */
function saveBtDevice(name: string, id: string) {
  try { localStorage.setItem(BT_DEVICE_KEY, JSON.stringify({ name, id })); } catch {}
}

/** Load saved BT device info */
export function loadSavedBtDevice(): { name: string; id: string } | null {
  try {
    const raw = localStorage.getItem(BT_DEVICE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/** Forget the paired BT printer */
export function forgetBluetoothPrinter() {
  _btDevice = null;
  _btCharacteristic = null;
  try { localStorage.removeItem(BT_DEVICE_KEY); } catch {}
}

/**
 * Reconnect to a previously paired BLE printer WITHOUT showing the device picker.
 * Uses navigator.bluetooth.getDevices() (Chrome 85+) to get permitted devices.
 * Call this on page load or after the user taps a "Reconnect" button.
 * Returns the device name on success, or throws an error.
 */
export async function reconnectBluetoothPrinter(): Promise<string> {
  if (!isBluetoothSupported()) throw new Error('Web Bluetooth غير مدعوم');

  const bt = (navigator as any).bluetooth as Bluetooth;

  // getDevices() returns previously permitted devices (no user gesture needed)
  if (typeof bt.getDevices !== 'function') {
    throw new Error('إعادة الاتصال التلقائي غير مدعوم في هذا الإصدار من Chrome — اضغط "ابحث عن طابعة" بدلاً من ذلك');
  }

  const saved = loadSavedBtDevice();
  const devices: BluetoothDevice[] = await bt.getDevices();

  if (devices.length === 0) {
    throw new Error('لا توجد طابعات مسموح بها — اضغط "ابحث عن طابعة" أولاً');
  }

  // Find the device matching the saved name/id (if any), otherwise use the first one
  const target = saved
    ? (devices.find(d => d.id === saved.id || d.name === saved.name) ?? devices[0])
    : devices[0];

  if (!target.gatt) throw new Error('GATT غير متوفر لهذا الجهاز');

  const server = await target.gatt.connect();
  const characteristic = await _findWriteCharacteristic(server);
  if (!characteristic) throw new Error('لم يُعثر على طابعة BLE متوافقة');

  _btDevice = target;
  _btCharacteristic = characteristic;
  saveBtDevice(target.name ?? target.id, target.id);

  target.addEventListener('gattserverdisconnected', () => {
    _btDevice = null;
    _btCharacteristic = null;
  });

  return target.name ?? target.id;
}

/**
 * Open the OS Bluetooth device picker and connect to the selected BLE printer.
 * Returns the device name on success, or throws an error.
 */
export async function connectBluetoothPrinter(): Promise<string> {
  if (!isBluetoothSupported()) throw new Error('Web Bluetooth غير مدعوم في هذا المتصفح — استخدم Chrome أو Edge');

  const bt = (navigator as any).bluetooth as Bluetooth;

  const device: BluetoothDevice = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: BT_SERVICE_UUIDS,
  });

  if (!device.gatt) throw new Error('GATT غير متوفر لهذا الجهاز');

  const server = await device.gatt.connect();
  const characteristic = await _findWriteCharacteristic(server);
  if (!characteristic) throw new Error('لم يُعثر على طابعة BLE متوافقة — تأكد من دعم الطابعة لـ ESC/POS');

  _btDevice = device;
  _btCharacteristic = characteristic;
  saveBtDevice(device.name ?? device.id, device.id);

  device.addEventListener('gattserverdisconnected', () => {
    _btDevice = null;
    _btCharacteristic = null;
  });

  return device.name ?? device.id;
}

/** Attempt to find a writable GATT characteristic across known service UUIDs. */
async function _findWriteCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const svcUuid of BT_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      // Try known char UUIDs first
      for (const charUuid of BT_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char.properties.write || char.properties.writeWithoutResponse) return char;
        } catch {}
      }
      // Fall back: enumerate all characteristics
      try {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) return char;
        }
      } catch {}
    } catch {}
  }
  return null;
}

/** Reconnect if the device is known but disconnected. */
async function _ensureBtConnected(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_btCharacteristic && _btDevice?.gatt?.connected) return _btCharacteristic;

  // Try to reconnect to cached device
  if (_btDevice && _btDevice.gatt) {
    try {
      const server = await _btDevice.gatt.connect();
      const char = await _findWriteCharacteristic(server);
      if (char) { _btCharacteristic = char; return char; }
    } catch {}
  }
  throw new Error('الطابعة البلوتوث غير متصلة — أعد الاقتران من الإعدادات');
}

/**
 * Send ESC/POS bytes to connected BLE printer.
 * Automatically chunks data into 512-byte packets (BLE MTU limit).
 */
export async function bluetoothPrint(escData: Uint8Array): Promise<PrintResult> {
  try {
    const char = await _ensureBtConnected();
    const useWriteWithoutResponse = char.properties.writeWithoutResponse && !char.properties.write;
    const CHUNK = 512;
    for (let i = 0; i < escData.length; i += CHUNK) {
      const chunk = escData.slice(i, i + CHUNK);
      if (useWriteWithoutResponse) {
        await char.writeValueWithoutResponse(chunk);
      } else {
        await char.writeValue(chunk);
      }
      // Small delay between chunks to avoid buffer overflow
      if (i + CHUNK < escData.length) await new Promise(r => setTimeout(r, 20));
    }
    return { success: true, mode: 'bluetooth' };
  } catch (err: any) {
    return { success: false, mode: 'error', error: err.message || 'خطأ في الطباعة عبر البلوتوث' };
  }
}

/**
 * Test BLE connection by sending a blank line + beep.
 */
export async function testBluetoothPrinter(): Promise<{ connected: boolean; message: string }> {
  try {
    const char = await _ensureBtConnected();
    // Just ping with ESC @  (printer init — safe no-op)
    const ping = new Uint8Array([0x1B, 0x40, 0x0A]);
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(ping);
    } else {
      await char.writeValue(ping);
    }
    const name = _btDevice?.name ?? 'الطابعة';
    return { connected: true, message: `✅ متصل بـ "${name}" — الطابعة جاهزة` };
  } catch (err: any) {
    return { connected: false, message: err.message || 'الطابعة غير متاحة' };
  }
}

/** Return current BT connection state */
export function getBluetoothState(): { connected: boolean; deviceName: string | null } {
  return {
    connected: !!(_btDevice?.gatt?.connected && _btCharacteristic),
    deviceName: _btDevice?.name ?? null,
  };
}

/**
 * High-level print function.
 * 1. Tries Relay Agent (local Node.js bridge) if mode=relay and relay URL is configured
 * 2. Tries Network (LAN/TCP) if mode=network and IP is configured
 * 3. Tries Bluetooth (BLE) if mode=bluetooth
 * 4. Tries WebUSB if device is connected + mode=webusb
 * 5. Falls back to browser print dialog
 */
/**
 * Cloud Print Queue mode — posts the job to the QIROX server.
 * A local print-agent.js running near the printer picks up the job and prints.
 */
export async function queuePrint(escData: Uint8Array, printerIp: string, printerPort = 9100): Promise<PrintResult> {
  try {
    const b64 = btoa(Array.from(escData, b => String.fromCharCode(b)).join(''));
    const resp = await fetch('/api/print-queue', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ data: b64, printerIp, printerPort }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.ok) {
      return { success: false, mode: 'error', error: result.error || 'فشل إرسال طلب الطباعة' };
    }
    return { success: true, mode: 'network' };
  } catch (err: any) {
    return { success: false, mode: 'error', error: `طابور الطباعة: ${err?.message || 'خطأ'}` };
  }
}

export async function thermalPrint(escData: Uint8Array, fallbackHtml: string, fallbackPaper: '58mm' | '80mm' = '80mm'): Promise<PrintResult> {
  const settings = loadPrinterSettings();

  if (!settings.enabled) return { success: false, mode: 'error', error: 'الطابعة معطّلة في الإعدادات' };

  // ── Cloud Queue mode ── send to server, local print agent picks up and prints
  if (settings.mode === 'queue') {
    if (!settings.networkIp) {
      return { success: false, mode: 'error', error: 'لم يتم تحديد IP الطابعة' };
    }
    const result = await queuePrint(escData, settings.networkIp, settings.networkPort || 9100);
    if (result.success) return result;
    console.error('[QueuePrint] Failed:', result.error);
    return result; // No PDF fallback — return error directly
  }

  // ── Relay Agent mode ── local Node.js bridge (ESC/POS direct → TCP)
  if (settings.mode === 'relay') {
    if (!settings.relayAgentUrl) {
      return { success: false, mode: 'error', error: 'لم يتم تحديد رابط وكيل الطباعة المحلي' };
    }
    if (!settings.networkIp) {
      return { success: false, mode: 'error', error: 'لم يتم تحديد IP الطابعة' };
    }
    const result = await relayAgentPrint(escData, settings.relayAgentUrl, settings.networkIp, settings.networkPort || 9100);
    if (result.success) return result;
    console.error('[RelayAgent] ESC/POS print failed:', result.error);
    return result; // No PDF fallback — ESC/POS or nothing
  }

  // ── Network (LAN/TCP) mode ── direct ESC/POS via TCP socket
  // For LAN IPs, networkPrint() auto-routes through relay agent if configured
  if (settings.mode === 'network') {
    if (!settings.networkIp) {
      return { success: false, mode: 'error', error: 'لم يتم تحديد IP الطابعة الشبكية' };
    }
    const result = await networkPrint(escData, settings.networkIp, settings.networkPort || 9100);
    if (result.success) return result;
    console.error('[NetworkPrint] ESC/POS print failed:', result.error);
    return result; // No PDF fallback — raw ESC/POS only
  }

  // ── Bluetooth (BLE) mode ── ESC/POS over BLE
  if (settings.mode === 'bluetooth') {
    const result = await bluetoothPrint(escData);
    if (result.success) return result;
    console.error('[BluetoothPrint] ESC/POS print failed:', result.error);
    return result; // No PDF fallback
  }

  // ── WebUSB mode ── ESC/POS direct to USB printer
  if (settings.mode === 'webusb') {
    if (!_usbDevice) {
      await reconnectSavedUSBPrinter();
    }
    if (_usbDevice) {
      const ok = await _sendToUSB(escData);
      if (ok) return { success: true, mode: 'webusb' };
      _usbDevice = null; // Device lost — clear cache
    }
    const usbErr = getUSBLastError();
    const errMsg = usbErr
      ? usbErr
      : 'الطابعة USB غير متصلة — تأكد من توصيل الكابل وتشغيل الطابعة، ثم افتح إعدادات الطابعة وأعد التوصيل';
    return { success: false, mode: 'error', error: errMsg };
  }

  // ── Browser mode ── HTML print via iframe (explicit opt-in only)
  if (settings.mode === 'browser') {
    if (fallbackHtml && fallbackHtml.trim()) {
      const { printHtmlInPage } = await import('./print-utils');
      printHtmlInPage(fallbackHtml, fallbackPaper);
      return { success: true, mode: 'browser' };
    }
    return { success: false, mode: 'error', error: 'لا يوجد محتوى للطباعة عبر المتصفح' };
  }

  return { success: false, mode: 'error', error: 'وضع الطباعة غير محدد — تحقق من إعدادات الطابعة' };
}

/**
 * Auto-print receipt + kitchen ticket after a completed order.
 * Multi-printer routing:
 *   - Customer receipt  → customerPrinterIp  (relay role: "customer")
 *   - Kitchen copy      → kitchen1 + kitchen2 in parallel (relay role: "kitchen1" / "kitchen2")
 * Falls back to single-printer mode if multi-printer IPs not configured.
 */
export async function autoPrintOrder(receiptEsc: Uint8Array, kitchenEsc: Uint8Array | null, receiptHtml: string, paperWidth: '58mm' | '80mm'): Promise<void> {
  const settings = loadPrinterSettings();
  if (!settings.autoPrint) return;

  const isRelay = settings.mode === 'relay' && !!settings.relayAgentUrl;
  const hasMultiPrinter = isRelay && !!(settings.customerPrinterIp || settings.kitchen1PrinterIp);

  if (hasMultiPrinter) {
    // ── Multi-printer path: route each job to the right printer ───────────
    const relayUrl = settings.relayAgentUrl!;

    // 1. Customer receipt → customerPrinterIp
    const custIp   = settings.customerPrinterIp || settings.networkIp || '';
    const custPort = settings.customerPrinterPort || 9100;
    if (custIp) {
      const r = await relayAgentPrint(receiptEsc, relayUrl, custIp, custPort);
      if (r.success) {
        console.info('[AutoPrint] ✅ Customer receipt printed to', custIp);
      } else {
        console.error('[AutoPrint] ❌ Customer receipt failed:', r.error);
      }
    }

    // 2. Kitchen copies → kitchen1 + kitchen2 in PARALLEL (fast, no delay between them)
    if (kitchenEsc && settings.autoKitchenCopy) {
      const kitchenJobs: Promise<PrintResult>[] = [];

      const k1Ip   = settings.kitchen1PrinterIp || '';
      const k1Port = settings.kitchen1PrinterPort || 9100;
      if (k1Ip) {
        kitchenJobs.push(relayAgentPrint(kitchenEsc, relayUrl, k1Ip, k1Port));
      }

      const k2Ip   = settings.kitchen2PrinterIp || '';
      const k2Port = settings.kitchen2PrinterPort || 9100;
      if (k2Ip) {
        kitchenJobs.push(relayAgentPrint(kitchenEsc, relayUrl, k2Ip, k2Port));
      }

      if (kitchenJobs.length > 0) {
        const kitchenResults = await Promise.allSettled(kitchenJobs);
        kitchenResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.success) {
            console.info(`[AutoPrint] ✅ Kitchen${i + 1} printed`);
          } else {
            const err = r.status === 'rejected' ? r.reason : (r.value as any).error;
            console.error(`[AutoPrint] ❌ Kitchen${i + 1} failed:`, err);
          }
        });
      }
    }
  } else {
    // ── Legacy single-printer path ─────────────────────────────────────────
    const receiptResult = await thermalPrint(receiptEsc, '', paperWidth);
    if (!receiptResult.success) {
      console.error('[AutoPrint] Receipt failed:', receiptResult.error);
    }

    if (kitchenEsc && settings.autoKitchenCopy) {
      await new Promise(r => setTimeout(r, 1500));
      const kitchenResult = await thermalPrint(kitchenEsc, '', paperWidth);
      if (!kitchenResult.success) {
        console.error('[AutoPrint] Kitchen copy failed:', kitchenResult.error);
      }
    }
  }
}

/**
 * Test a specific named printer role through the relay agent.
 * Returns { connected, message } suitable for showing in the UI.
 */
export async function testRelayPrinterRole(
  relayUrl: string,
  role: 'customer' | 'kitchen1' | 'kitchen2',
  printerIp: string,
  printerPort: number = 9100,
): Promise<{ connected: boolean; message: string }> {
  if (!relayUrl) {
    return { connected: false, message: '❌ أدخل رابط وكيل الطباعة أولاً' };
  }
  if (!printerIp) {
    return { connected: false, message: `❌ أدخل IP طابعة ${role === 'customer' ? 'العميل' : role === 'kitchen1' ? 'المطبخ 1' : 'المطبخ 2'} أولاً` };
  }
  return testRelayAgent(relayUrl, printerIp, printerPort);
}

// ─── Printer status ───────────────────────────────────────────────────────────

export interface PrinterStatus {
  isWebUSBSupported: boolean;
  isDeviceConnected: boolean;
  savedDevice: { vendorId: number; productId: number; productName: string } | null;
  settings: PrinterSettings;
}

export async function getPrinterStatus(): Promise<PrinterStatus> {
  const settings = loadPrinterSettings();
  const savedDevice = getSavedDeviceInfo();
  let isDeviceConnected = false;

  if (_usbDevice) {
    isDeviceConnected = true;
  } else if (savedDevice && isWebUSBSupported()) {
    const reconnected = await reconnectSavedUSBPrinter();
    isDeviceConnected = !!reconnected;
  }

  return {
    isWebUSBSupported: isWebUSBSupported(),
    isDeviceConnected,
    savedDevice,
    settings,
  };
}
