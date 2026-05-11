/**
 * ZATCA E-Invoicing Utilities
 * أدوات الفوترة الإلكترونية هيئة الزكاة والضريبة والجمارك
 * 
 * Implements Phase 1 ZATCA e-invoicing requirements:
 * - TLV (Tag-Length-Value) encoding
 * - Base64 encoding for QR codes
 * - QR code generation for simplified tax invoices (B2C)
 */

import QRCode from "qrcode";

/**
 * ZATCA TLV Tags
 */
const ZATCA_TAGS = {
  SELLER_NAME: 1,
  VAT_NUMBER: 2,
  TIMESTAMP: 3,
  TOTAL_WITH_VAT: 4,
  VAT_AMOUNT: 5,
} as const;

/**
 * Generate TLV (Tag-Length-Value) encoded data for ZATCA QR code
 * 
 * @param tag - Tag number (1-5)
 * @param value - String value to encode
 * @returns Buffer containing TLV encoded data
 */
function encodeTLV(tag: number, value: string): Buffer {
  const valueBytes = Buffer.from(value, "utf-8");
  const length = valueBytes.length;
  
  return Buffer.concat([
    Buffer.from([tag]),
    Buffer.from([length]),
    valueBytes,
  ]);
}

/**
 * Invoice data for ZATCA QR code generation
 */
export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  invoiceDate: Date;
  totalWithVat: number;
  vatAmount: number;
}

/**
 * Generate ZATCA-compliant Base64 encoded TLV string
 * 
 * @param data - Invoice data containing required ZATCA fields
 * @returns Base64 encoded TLV string for QR code
 */
export function generateZatcaTLV(data: ZatcaInvoiceData): string {
  const timestamp = data.invoiceDate.toISOString();
  const totalStr = data.totalWithVat.toFixed(2);
  const vatStr = data.vatAmount.toFixed(2);
  
  const tlvBuffer = Buffer.concat([
    encodeTLV(ZATCA_TAGS.SELLER_NAME, data.sellerName),
    encodeTLV(ZATCA_TAGS.VAT_NUMBER, data.vatNumber),
    encodeTLV(ZATCA_TAGS.TIMESTAMP, timestamp),
    encodeTLV(ZATCA_TAGS.TOTAL_WITH_VAT, totalStr),
    encodeTLV(ZATCA_TAGS.VAT_AMOUNT, vatStr),
  ]);
  
  return tlvBuffer.toString("base64");
}

/**
 * Decode ZATCA TLV Base64 string back to invoice data
 * 
 * @param base64String - Base64 encoded TLV string
 * @returns Decoded invoice data
 */
export function decodeZatcaTLV(base64String: string): ZatcaInvoiceData {
  const buffer = Buffer.from(base64String, "base64");
  const result: Partial<ZatcaInvoiceData> = {};
  
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer[offset];
    const length = buffer[offset + 1];
    const value = buffer.slice(offset + 2, offset + 2 + length).toString("utf-8");
    
    switch (tag) {
      case ZATCA_TAGS.SELLER_NAME:
        result.sellerName = value;
        break;
      case ZATCA_TAGS.VAT_NUMBER:
        result.vatNumber = value;
        break;
      case ZATCA_TAGS.TIMESTAMP:
        result.invoiceDate = new Date(value);
        break;
      case ZATCA_TAGS.TOTAL_WITH_VAT:
        result.totalWithVat = parseFloat(value);
        break;
      case ZATCA_TAGS.VAT_AMOUNT:
        result.vatAmount = parseFloat(value);
        break;
    }
    
    offset += 2 + length;
  }
  
  return result as ZatcaInvoiceData;
}

/**
 * Generate QR code image as Data URL for ZATCA invoice
 * 
 * @param data - Invoice data for QR code
 * @returns Promise resolving to QR code Data URL
 */
export async function generateZatcaQRCode(data: ZatcaInvoiceData): Promise<string> {
  const tlvBase64 = generateZatcaTLV(data);
  
  const qrDataUrl = await QRCode.toDataURL(tlvBase64, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
  
  return qrDataUrl;
}

/**
 * Generate QR code as SVG string for ZATCA invoice
 * 
 * @param data - Invoice data for QR code
 * @returns Promise resolving to QR code SVG string
 */
export async function generateZatcaQRCodeSVG(data: ZatcaInvoiceData): Promise<string> {
  const tlvBase64 = generateZatcaTLV(data);
  
  return QRCode.toString(tlvBase64, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
  });
}

/**
 * Validate Saudi VAT number format
 * 
 * @param vatNumber - VAT number to validate
 * @returns true if valid, false otherwise
 */
export function validateSaudiVATNumber(vatNumber: string): boolean {
  const cleaned = vatNumber.replace(/\s/g, "");
  return /^3\d{14}3$/.test(cleaned);
}

/**
 * Format Saudi VAT number for display
 * 
 * @param vatNumber - VAT number to format
 * @returns Formatted VAT number
 */
export function formatSaudiVATNumber(vatNumber: string): string {
  const cleaned = vatNumber.replace(/\s/g, "");
  if (cleaned.length === 15) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 11)} ${cleaned.slice(11, 15)}`;
  }
  return vatNumber;
}

/**
 * Calculate VAT amount from total (15% VAT rate in Saudi Arabia)
 * 
 * @param totalWithVat - Total amount including VAT
 * @returns VAT amount
 */
export function calculateVATFromTotal(totalWithVat: number): number {
  return totalWithVat * 0.15 / 1.15;
}

/**
 * Calculate total with VAT from net amount
 * 
 * @param netAmount - Amount before VAT
 * @returns Total amount including VAT
 */
export function calculateTotalWithVAT(netAmount: number): number {
  return netAmount * 1.15;
}

/**
 * Invoice type classification for ZATCA
 */
export type ZatcaInvoiceType = "simplified" | "standard";

/**
 * Determine invoice type based on customer information
 * - Simplified (B2C): No customer VAT number
 * - Standard (B2B): Customer has VAT number
 * 
 * @param customerVatNumber - Customer's VAT number (if any)
 * @returns Invoice type classification
 */
export function getInvoiceType(customerVatNumber?: string): ZatcaInvoiceType {
  if (customerVatNumber && validateSaudiVATNumber(customerVatNumber)) {
    return "standard";
  }
  return "simplified";
}
