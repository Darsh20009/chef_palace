import crypto from 'crypto';
import { TaxInvoiceModel, type ITaxInvoice } from '@shared/schema';

// ZATCA Configuration from environment variables for security
const VAT_RATE = parseFloat(process.env.VAT_RATE || '0.15');
const SELLER_NAME = process.env.ZATCA_SELLER_NAME || "مكان الشيف البخاري";
const SELLER_NAME_EN = process.env.ZATCA_SELLER_NAME_EN || "Chef Bukhari's Place";
const SELLER_VAT_NUMBER = process.env.ZATCA_VAT_NUMBER || '311234567890003';
const SELLER_ADDRESS = process.env.ZATCA_SELLER_ADDRESS || 'الرياض، المملكة العربية السعودية';
const SELLER_CR_NUMBER = process.env.ZATCA_CR_NUMBER || '';
const SELLER_BUILDING_NUMBER = process.env.ZATCA_BUILDING_NUMBER || '';
const SELLER_POSTAL_CODE = process.env.ZATCA_POSTAL_CODE || '';
const SELLER_DISTRICT = process.env.ZATCA_DISTRICT || '';
const SELLER_CITY = process.env.ZATCA_CITY || 'الرياض';

// ZATCA Phase 2 Integration Settings
const ZATCA_API_URL = process.env.ZATCA_API_URL || 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
const ZATCA_COMPLIANCE_CSID = process.env.ZATCA_COMPLIANCE_CSID || '';
const ZATCA_PRODUCTION_CSID = process.env.ZATCA_PRODUCTION_CSID || '';
const ZATCA_SECRET = process.env.ZATCA_SECRET || '';

interface InvoiceItem {
  itemId: string;
  nameAr: string;
  nameEn?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
}

interface CreateInvoiceParams {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerVatNumber?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  paymentMethod: string;
  branchId?: string;
  createdBy?: string;
  invoiceType?: 'standard' | 'simplified' | 'debit_note' | 'credit_note';
  transactionType?: 'B2B' | 'B2C';
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateInvoiceNumber(counter: number): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(counter).padStart(6, '0');
  return `INV-${year}${month}${day}-${seq}`;
}

export function calculateItemTax(item: InvoiceItem): {
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const taxRate = item.taxRate ?? VAT_RATE;
  const discountAmount = item.discountAmount ?? 0;
  const subtotal = item.unitPrice * item.quantity;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * taxRate;
  const totalAmount = taxableAmount + taxAmount;
  
  return {
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export function generateTLV(tag: number, value: string): Buffer {
  const valueBytes = Buffer.from(value, 'utf8');
  const result = Buffer.alloc(2 + valueBytes.length);
  result[0] = tag;
  result[1] = valueBytes.length;
  valueBytes.copy(result, 2);
  return result;
}

export function generateZATCAQRCode(data: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatAmount: string;
  invoiceHash?: string;
}): string {
  const tlvBuffers: Buffer[] = [
    generateTLV(1, data.sellerName),
    generateTLV(2, data.vatNumber),
    generateTLV(3, data.timestamp),
    generateTLV(4, data.totalWithVat),
    generateTLV(5, data.vatAmount),
  ];
  
  if (data.invoiceHash) {
    tlvBuffers.push(generateTLV(6, data.invoiceHash));
  }
  
  const combined = Buffer.concat(tlvBuffers);
  return combined.toString('base64');
}

export function generateInvoiceHash(invoiceData: string, previousHash?: string): string {
  const dataToHash = previousHash ? `${previousHash}${invoiceData}` : invoiceData;
  return crypto.createHash('sha256').update(dataToHash).digest('base64');
}

export function formatDateISO(date: Date): string {
  return date.toISOString();
}

export function getPaymentMeansCode(paymentMethod: string): string {
  const codes: Record<string, string> = {
    'cash': '10',
    'pos': '30',
    'stc': '30',
    'alinma': '30',
    'ur': '30',
    'barq': '30',
    'rajhi': '30',
    'delivery': '10',
    'qahwa-card': '48',
  };
  return codes[paymentMethod] || '30';
}

export function generateZATCAXML(invoice: ITaxInvoice): string {
  const invoiceDate = new Date(invoice.invoiceDate);
  const dateStr = invoiceDate.toISOString().split('T')[0];
  const timeStr = invoiceDate.toISOString().split('T')[1].split('.')[0];
  
  const itemsXML = invoice.items.map((item: any, index: number) => {
    const taxableAmount = item.taxableAmount || 0;
    const taxAmount = item.taxAmount || 0;
    const totalAmount = item.totalAmount || 0;
    const taxRate = item.taxRate || 0.15;
    const unitPrice = item.unitPrice || 0;
    const discountAmount = item.discountAmount || 0;
    const quantity = item.quantity || 1;
    
    return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${taxableAmount.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${item.nameAr || 'منتج'}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${(taxRate * 100).toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${unitPrice.toFixed(2)}</cbc:PriceAmount>${discountAmount > 0 ? `
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="SAR">${discountAmount.toFixed(2)}</cbc:Amount>
        </cac:AllowanceCharge>` : ''}
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
  <cbc:UUID>${invoice.uuid}</cbc:UUID>
  <cbc:IssueDate>${dateStr}</cbc:IssueDate>
  <cbc:IssueTime>${timeStr}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${invoice.transactionType === 'B2B' ? '0100000' : '0200000'}">${invoice.invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:InvoiceDocumentReference>
    <cbc:ID>${invoice.invoiceCounter}</cbc:ID>
  </cac:InvoiceDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${invoice.invoiceCounter}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.previousInvoiceHash || ''}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.qrCode}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${invoice.sellerCrNumber || ''}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${invoice.sellerAddress}</cbc:StreetName>
        <cbc:BuildingNumber>${invoice.sellerBuildingNumber || ''}</cbc:BuildingNumber>
        <cbc:CityName>${invoice.sellerCity || 'الرياض'}</cbc:CityName>
        <cbc:PostalZone>${invoice.sellerPostalCode || ''}</cbc:PostalZone>
        <cbc:CountrySubentity>${invoice.sellerDistrict || ''}</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>${invoice.sellerCountry}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoice.sellerVatNumber}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${invoice.sellerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${invoice.customerVatNumber ? `
      <cac:PartyIdentification>
        <cbc:ID schemeID="VAT">${invoice.customerVatNumber}</cbc:ID>
      </cac:PartyIdentification>` : ''}
      <cac:PostalAddress>
        <cbc:StreetName>${invoice.customerAddress || ''}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${invoice.customerVatNumber ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoice.customerVatNumber}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${invoice.customerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${invoice.paymentMeans || '10'}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${invoice.taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${invoice.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${invoice.taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${invoice.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${invoice.taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${invoice.totalAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${invoice.totalDiscountAmount.toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="SAR">${invoice.totalAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${itemsXML}
</Invoice>`;
}

export async function createZATCAInvoice(params: CreateInvoiceParams): Promise<ITaxInvoice> {
  const lastInvoice = await TaxInvoiceModel.findOne().sort({ invoiceCounter: -1 });
  const invoiceCounter = (lastInvoice?.invoiceCounter || 0) + 1;
  
  const processedItems = params.items.map(item => {
    const taxCalc = calculateItemTax(item);
    return {
      itemId: item.itemId,
      nameAr: item.nameAr,
      nameEn: item.nameEn || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount || 0,
      taxableAmount: taxCalc.taxableAmount,
      taxRate: item.taxRate ?? VAT_RATE,
      taxAmount: taxCalc.taxAmount,
      totalAmount: taxCalc.totalAmount,
    };
  });
  
  const subtotal = processedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const totalDiscountAmount = processedItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const taxableAmount = processedItems.reduce((sum, item) => sum + item.taxableAmount, 0);
  const taxAmount = processedItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalAmount = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);
  
  const uuid = generateUUID();
  const invoiceNumber = generateInvoiceNumber(invoiceCounter);
  const invoiceDate = new Date();
  
  const invoiceDataForHash = JSON.stringify({
    uuid,
    invoiceNumber,
    invoiceCounter,
    invoiceDate: invoiceDate.toISOString(),
    totalAmount,
    taxAmount,
  });
  
  const previousHash = lastInvoice?.invoiceHash;
  const invoiceHash = generateInvoiceHash(invoiceDataForHash, previousHash);
  
  const qrCode = generateZATCAQRCode({
    sellerName: SELLER_NAME,
    vatNumber: SELLER_VAT_NUMBER,
    timestamp: formatDateISO(invoiceDate),
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: taxAmount.toFixed(2),
    invoiceHash,
  });
  
  const invoiceType = params.invoiceType || 'simplified';
  const transactionType = params.transactionType || (params.customerVatNumber ? 'B2B' : 'B2C');
  const invoiceTypeCode = invoiceType === 'standard' ? '388' : 
                          invoiceType === 'credit_note' ? '381' : 
                          invoiceType === 'debit_note' ? '383' : '388';
  
  const invoice = new TaxInvoiceModel({
    invoiceNumber,
    uuid,
    orderId: params.orderId,
    
    sellerName: SELLER_NAME,
    sellerNameEn: SELLER_NAME_EN,
    sellerVatNumber: SELLER_VAT_NUMBER,
    sellerAddress: SELLER_ADDRESS,
    sellerCity: SELLER_CITY,
    sellerCountry: 'SA',
    sellerCrNumber: SELLER_CR_NUMBER,
    sellerBuildingNumber: SELLER_BUILDING_NUMBER,
    sellerPostalCode: SELLER_POSTAL_CODE,
    sellerDistrict: SELLER_DISTRICT,
    branchId: params.branchId,
    
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
    customerVatNumber: params.customerVatNumber,
    customerAddress: params.customerAddress,
    
    invoiceType,
    invoiceTypeCode,
    transactionType,
    
    items: processedItems,
    
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    
    paymentMethod: params.paymentMethod,
    paymentMeans: getPaymentMeansCode(params.paymentMethod),
    
    invoiceCounter,
    previousInvoiceHash: previousHash,
    invoiceHash,
    qrCode,
    
    invoiceDate,
    supplyDate: invoiceDate,
    
    zatcaStatus: 'pending',
    
    createdBy: params.createdBy,
  });
  
  const xmlContent = generateZATCAXML(invoice);
  invoice.xmlContent = xmlContent;
  
  await invoice.save();
  
  return invoice;
}

export async function getInvoiceByOrderId(orderId: string): Promise<ITaxInvoice | null> {
  return TaxInvoiceModel.findOne({ orderId });
}

export async function getInvoicesByBranch(branchId: string, startDate?: Date, endDate?: Date): Promise<ITaxInvoice[]> {
  const query: any = { branchId };
  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = startDate;
    if (endDate) query.invoiceDate.$lte = endDate;
  }
  return TaxInvoiceModel.find(query).sort({ invoiceDate: -1 });
}

export async function getInvoiceStats(branchId?: string, startDate?: Date, endDate?: Date): Promise<{
  totalInvoices: number;
  totalRevenue: number;
  totalVat: number;
  averageInvoiceValue: number;
}> {
  const match: any = {};
  if (branchId) match.branchId = branchId;
  if (startDate || endDate) {
    match.invoiceDate = {};
    if (startDate) match.invoiceDate.$gte = startDate;
    if (endDate) match.invoiceDate.$lte = endDate;
  }
  
  const result = await TaxInvoiceModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalVat: { $sum: '$taxAmount' },
      },
    },
  ]);
  
  if (result.length === 0) {
    return {
      totalInvoices: 0,
      totalRevenue: 0,
      totalVat: 0,
      averageInvoiceValue: 0,
    };
  }
  
  return {
    totalInvoices: result[0].totalInvoices,
    totalRevenue: result[0].totalRevenue,
    totalVat: result[0].totalVat,
    averageInvoiceValue: result[0].totalRevenue / result[0].totalInvoices,
  };
}
