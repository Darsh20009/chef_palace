import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { ReceiptInvoice } from '@/components/receipt-invoice';

export interface PreviewOrderInput {
  orderNumber: string;
  createdAt: string | Date;
  tableNumber?: string;
  totalAmount: number | string;
  items: Array<{
    nameAr?: string;
    nameEn?: string;
    quantity: number;
    price: number | string;
    customization?: { selectedItemAddons?: Array<{ nameAr: string }> };
  }>;
}

async function waitForFontsAndImages(root: HTMLElement, timeoutMs = 4000): Promise<void> {
  try { await (document as any).fonts?.ready; } catch {}
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    const allReady = imgs.every(img => img.complete && img.naturalWidth > 0);
    const hasQr = imgs.some(img => (img.src || '').startsWith('data:image'));
    if (allReady && (imgs.length === 0 || hasQr)) {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return;
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

export async function renderReceiptPreviewToPng(input: PreviewOrderInput): Promise<string> {
  const fakeOrder: any = {
    id: 'preview',
    orderNumber: input.orderNumber,
    createdAt: input.createdAt,
    tableNumber: input.tableNumber,
    totalAmount: String(input.totalAmount),
    items: input.items.map(it => ({
      nameAr: it.nameAr,
      nameEn: it.nameEn,
      quantity: it.quantity,
      price: String(it.price),
      customization: it.customization,
    })),
  };

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:80mm;background:#fff;z-index:-1;opacity:0;pointer-events:none;transform:translate(-200vw,0);';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(<ReceiptInvoice order={fakeOrder} variant="button" />);

    // wait for layout + fonts + QR generation
    await new Promise(r => setTimeout(r, 50));
    await waitForFontsAndImages(host, 4000);

    const target = host.querySelector('[data-testid="invoice-preview"]') as HTMLElement | null;
    if (!target) throw new Error('Receipt preview did not mount');

    const canvas = await html2canvas(target, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });
    return canvas.toDataURL('image/png');
  } finally {
    try { root.unmount(); } catch {}
    try { host.remove(); } catch {}
  }
}
