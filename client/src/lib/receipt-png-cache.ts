/**
 * Receipt PNG Pre-render Cache
 *
 * Pre-renders the receipt PNG immediately after an order is created.
 * By the time the user sees the receipt dialog and clicks "Print", the PNG is ready.
 * Cache is keyed by orderNumber. Entries auto-expire after 5 minutes.
 */

import type { PreviewOrderInput } from './render-receipt-preview';

const cache = new Map<string, Promise<string>>();
const TTL_MS = 5 * 60 * 1000;

export function preRenderReceiptPng(input: PreviewOrderInput): void {
  const key = String(input.orderNumber || '');
  if (!key || cache.has(key)) return;

  const promise = (async () => {
    try {
      const { renderReceiptPreviewToPng } = await import('./render-receipt-preview');
      return await renderReceiptPreviewToPng(input);
    } catch {
      return '';
    }
  })();

  cache.set(key, promise);

  // Auto-expire
  setTimeout(() => cache.delete(key), TTL_MS);
}

/**
 * Returns the cached PNG promise if available, otherwise null.
 * Calling this does NOT remove the entry — multiple callers can share it.
 */
export function getCachedReceiptPng(orderNumber: string | number): Promise<string> | null {
  return cache.get(String(orderNumber)) ?? null;
}

export function clearReceiptPngCache(orderNumber: string | number): void {
  cache.delete(String(orderNumber));
}
