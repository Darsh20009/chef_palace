import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
type Html2CanvasType = (el: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>;
import { ReceiptInvoice } from '@/components/receipt-invoice';

export interface PreviewOrderInput {
  orderNumber: string;
  createdAt: string | Date;
  tableNumber?: string;
  totalAmount: number | string;
  paymentMethod?: string;
  employeeName?: string;
  deliveryType?: string;
  orderType?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: Array<{
    nameAr?: string;
    nameEn?: string;
    quantity: number;
    price: number | string;
    selectedSize?: string;
    customization?: { selectedItemAddons?: Array<{ nameAr: string }> };
  }>;
}

/** Wait only for <img> tags to finish loading — no QR wait needed when pre-computed */
async function waitForImages(root: HTMLElement, timeoutMs = 800): Promise<void> {
  try { await (document as any).fonts?.ready; } catch {}
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    if (imgs.every(img => img.complete && img.naturalWidth > 0)) {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return;
    }
    await new Promise(r => setTimeout(r, 40));
  }
}

export async function renderReceiptPreviewToPng(input: PreviewOrderInput): Promise<string> {
  const totalAmount = parseFloat(String(input.totalAmount || 0));
  const vat = totalAmount - totalAmount / 1.15;

  // ── Pre-generate QR codes BEFORE rendering — eliminates useEffect delay ──
  const [trackingQr, zatcaQr] = await Promise.all([
    (async () => {
      try {
        const url = `${window.location.origin}/track/${encodeURIComponent(String(input.orderNumber))}`;
        return await QRCode.toDataURL(url, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
      } catch { return ''; }
    })(),
    (async () => {
      try {
        const ts = input.createdAt ? new Date(input.createdAt).toISOString() : new Date().toISOString();
        const payload = btoa(`\x01\x10مكان الشيف البخاري\x02\x0F310894802100003\x03\x14${ts}\x04\x08${totalAmount.toFixed(2)}\x05\x08${vat.toFixed(2)}`);
        return await QRCode.toDataURL(payload, { width: 180, margin: 1, errorCorrectionLevel: 'M' });
      } catch { return ''; }
    })(),
  ]);

  const fakeOrder: any = {
    id: 'preview',
    orderNumber: input.orderNumber,
    createdAt: input.createdAt,
    tableNumber: input.tableNumber,
    totalAmount: String(input.totalAmount),
    paymentMethod: input.paymentMethod || 'cash',
    employeeName: input.employeeName || '',
    deliveryType: input.deliveryType || input.orderType || '',
    orderType: input.orderType || input.deliveryType || '',
    customerName: input.customerName || '',
    customerPhone: input.customerPhone || '',
    notes: input.notes || '',
    items: input.items.map(it => ({
      nameAr: it.nameAr,
      nameEn: it.nameEn,
      quantity: it.quantity,
      price: String(it.price),
      selectedSize: it.selectedSize,
      customization: it.customization,
    })),
  };

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:absolute;left:-9999px;top:0;width:320px;background:#fff;z-index:-9999;pointer-events:none;overflow:visible;';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    // Pass pre-computed QRs directly — no useEffect delay inside the component
    root.render(
      <ReceiptInvoice
        order={fakeOrder}
        variant="button"
        precomputedTrackingQr={trackingQr}
        precomputedZatcaQr={zatcaQr}
      />
    );

    // Short wait for React paint + logo image to load
    await new Promise(r => setTimeout(r, 30));
    await waitForImages(host, 800);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const target = host.querySelector('[data-testid="invoice-preview"]') as HTMLElement | null;
    if (!target) throw new Error('Receipt preview did not mount');

    const fullWidth  = target.scrollWidth  || target.offsetWidth  || 320;
    const fullHeight = target.scrollHeight || target.offsetHeight || 600;

    // scale=2 is sharp enough for thermal paper and renders ~2× faster than scale=3
    const { default: html2canvasFn } = await import(/* @vite-ignore */ 'html2canvas') as { default: Html2CanvasType };
    const canvas = await html2canvasFn(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });
    return canvas.toDataURL('image/png');
  } finally {
    try { root.unmount(); } catch {}
    try { host.remove(); } catch {}
  }
}
