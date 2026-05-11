// ─── Centralized VAT Rate ────────────────────────────────────────────────────
// Saudi Arabia standard VAT rate (15%). Change here to update all frontend
// calculations including receipts, invoices, and display labels.
export const VAT_RATE = 0.15;

// Helper: extract VAT from a VAT-inclusive total
export const vatAmount = (total: number, rate = VAT_RATE): number =>
  total * rate / (1 + rate);

// Helper: extract net amount from a VAT-inclusive total
export const netAmount = (total: number, rate = VAT_RATE): number =>
  total / (1 + rate);

// Display label (e.g. "15%")
export const VAT_RATE_LABEL = `${Math.round(VAT_RATE * 100)}%`;
