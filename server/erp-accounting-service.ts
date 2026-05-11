/**
 * ERP Accounting Service - Professional Double-Entry Bookkeeping
 * خدمة المحاسبة المتقدمة - القيد المزدوج الاحترافي
 */

import { nanoid } from "nanoid";
import { generateZatcaTLV, generateZatcaQRCode, type ZatcaInvoiceData } from "./zatca-utils";
import {
  AccountModel,
  JournalEntryModel,
  InvoiceModel,
  ExpenseErpModel,
  VendorModel,
  PaymentRecordModel,
  TaxRateModel,
  CostCenterModel,
  FiscalPeriodModel,
  BankStatementModel,
  BankTransactionModel,
  OrderModel,
  type IAccount,
  type IJournalEntry,
  type IInvoice,
  type IExpenseErp,
  type IVendor,
  type ITaxRate,
  type ICostCenter,
  type IFiscalPeriod,
} from "@shared/schema";

// دليل الحسابات الافتراضي - Default Chart of Accounts
const DEFAULT_CHART_OF_ACCOUNTS = [
  // الأصول - Assets (1xxx)
  { accountNumber: "1000", nameAr: "الأصول", nameEn: "Assets", accountType: "asset" as const, normalBalance: "debit" as const, level: 1 },
  { accountNumber: "1100", nameAr: "الأصول المتداولة", nameEn: "Current Assets", accountType: "asset" as const, normalBalance: "debit" as const, level: 2, parentAccountNumber: "1000" },
  { accountNumber: "1110", nameAr: "النقدية", nameEn: "Cash", accountType: "asset" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "1100" },
  { accountNumber: "1111", nameAr: "الصندوق", nameEn: "Petty Cash", accountType: "asset" as const, normalBalance: "debit" as const, level: 4, parentAccountNumber: "1110", isSystemAccount: 1 },
  { accountNumber: "1112", nameAr: "البنك", nameEn: "Bank", accountType: "asset" as const, normalBalance: "debit" as const, level: 4, parentAccountNumber: "1110", isBankAccount: 1 },
  { accountNumber: "1120", nameAr: "الذمم المدينة", nameEn: "Accounts Receivable", accountType: "asset" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "1100", isSystemAccount: 1 },
  { accountNumber: "1130", nameAr: "المخزون", nameEn: "Inventory", accountType: "asset" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "1100", isSystemAccount: 1 },
  { accountNumber: "1140", nameAr: "مصروفات مدفوعة مقدماً", nameEn: "Prepaid Expenses", accountType: "asset" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "1100" },
  { accountNumber: "1200", nameAr: "الأصول الثابتة", nameEn: "Fixed Assets", accountType: "asset" as const, normalBalance: "debit" as const, level: 2, parentAccountNumber: "1000" },
  { accountNumber: "1210", nameAr: "المعدات", nameEn: "Equipment", accountType: "asset" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "1200" },
  { accountNumber: "1220", nameAr: "الأثاث", nameEn: "Furniture", accountType: "asset" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "1200" },

  // الخصوم - Liabilities (2xxx)
  { accountNumber: "2000", nameAr: "الخصوم", nameEn: "Liabilities", accountType: "liability" as const, normalBalance: "credit" as const, level: 1 },
  { accountNumber: "2100", nameAr: "الخصوم المتداولة", nameEn: "Current Liabilities", accountType: "liability" as const, normalBalance: "credit" as const, level: 2, parentAccountNumber: "2000" },
  { accountNumber: "2110", nameAr: "الذمم الدائنة", nameEn: "Accounts Payable", accountType: "liability" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "2100", isSystemAccount: 1 },
  { accountNumber: "2120", nameAr: "ضريبة القيمة المضافة المستحقة", nameEn: "VAT Payable", accountType: "liability" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "2100", isSystemAccount: 1 },
  { accountNumber: "2130", nameAr: "الرواتب المستحقة", nameEn: "Salaries Payable", accountType: "liability" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "2100" },
  { accountNumber: "2200", nameAr: "الخصوم طويلة الأجل", nameEn: "Long-term Liabilities", accountType: "liability" as const, normalBalance: "credit" as const, level: 2, parentAccountNumber: "2000" },
  { accountNumber: "2210", nameAr: "القروض", nameEn: "Loans", accountType: "liability" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "2200" },

  // حقوق الملكية - Equity (3xxx)
  { accountNumber: "3000", nameAr: "حقوق الملكية", nameEn: "Equity", accountType: "equity" as const, normalBalance: "credit" as const, level: 1 },
  { accountNumber: "3100", nameAr: "رأس المال", nameEn: "Capital", accountType: "equity" as const, normalBalance: "credit" as const, level: 2, parentAccountNumber: "3000", isSystemAccount: 1 },
  { accountNumber: "3200", nameAr: "الأرباح المحتجزة", nameEn: "Retained Earnings", accountType: "equity" as const, normalBalance: "credit" as const, level: 2, parentAccountNumber: "3000", isSystemAccount: 1 },

  // الإيرادات - Revenue (4xxx)
  { accountNumber: "4000", nameAr: "الإيرادات", nameEn: "Revenue", accountType: "revenue" as const, normalBalance: "credit" as const, level: 1 },
  { accountNumber: "4100", nameAr: "إيرادات المبيعات", nameEn: "Sales Revenue", accountType: "revenue" as const, normalBalance: "credit" as const, level: 2, parentAccountNumber: "4000", isSystemAccount: 1 },
  { accountNumber: "4110", nameAr: "مبيعات المشروبات", nameEn: "Beverage Sales", accountType: "revenue" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "4100" },
  { accountNumber: "4120", nameAr: "مبيعات الأطعمة", nameEn: "Food Sales", accountType: "revenue" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "4100" },
  { accountNumber: "4200", nameAr: "إيرادات أخرى", nameEn: "Other Revenue", accountType: "revenue" as const, normalBalance: "credit" as const, level: 2, parentAccountNumber: "4000" },
  { accountNumber: "4210", nameAr: "رسوم التوصيل", nameEn: "Delivery Fees", accountType: "revenue" as const, normalBalance: "credit" as const, level: 3, parentAccountNumber: "4200" },

  // المصروفات - Expenses (5xxx)
  { accountNumber: "5000", nameAr: "المصروفات", nameEn: "Expenses", accountType: "expense" as const, normalBalance: "debit" as const, level: 1 },
  { accountNumber: "5100", nameAr: "تكلفة البضاعة المباعة", nameEn: "Cost of Goods Sold", accountType: "expense" as const, normalBalance: "debit" as const, level: 2, parentAccountNumber: "5000", isSystemAccount: 1 },
  { accountNumber: "5200", nameAr: "مصروفات التشغيل", nameEn: "Operating Expenses", accountType: "expense" as const, normalBalance: "debit" as const, level: 2, parentAccountNumber: "5000" },
  { accountNumber: "5210", nameAr: "الرواتب والأجور", nameEn: "Salaries & Wages", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200" },
  { accountNumber: "5220", nameAr: "الإيجار", nameEn: "Rent", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200" },
  { accountNumber: "5230", nameAr: "المرافق", nameEn: "Utilities", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200" },
  { accountNumber: "5240", nameAr: "التسويق والإعلان", nameEn: "Marketing & Advertising", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200" },
  { accountNumber: "5250", nameAr: "الصيانة", nameEn: "Maintenance", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200" },
  { accountNumber: "5260", nameAr: "المستلزمات", nameEn: "Supplies", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200" },
  { accountNumber: "5270", nameAr: "الهدر والتالف", nameEn: "Waste & Spoilage", accountType: "expense" as const, normalBalance: "debit" as const, level: 3, parentAccountNumber: "5200", isSystemAccount: 1 },
  { accountNumber: "5300", nameAr: "مصروفات أخرى", nameEn: "Other Expenses", accountType: "expense" as const, normalBalance: "debit" as const, level: 2, parentAccountNumber: "5000" },
];

export class ErpAccountingService {
  /**
   * Initialize default chart of accounts for a tenant
   */
  static async initializeChartOfAccounts(tenantId: string): Promise<IAccount[]> {
    const existingAccounts = await AccountModel.find({ tenantId });
    if (existingAccounts.length > 0) {
      return existingAccounts;
    }

    const accountMap: Record<string, string> = {};
    const createdAccounts: IAccount[] = [];

    for (const accountDef of DEFAULT_CHART_OF_ACCOUNTS) {
      const accountId = nanoid();
      const parentAccountId = accountDef.parentAccountNumber
        ? accountMap[accountDef.parentAccountNumber]
        : undefined;

      const account = await AccountModel.create({
        id: accountId,
        tenantId,
        accountNumber: accountDef.accountNumber,
        nameAr: accountDef.nameAr,
        nameEn: accountDef.nameEn,
        accountType: accountDef.accountType,
        normalBalance: accountDef.normalBalance,
        parentAccountId,
        level: accountDef.level,
        path: parentAccountId ? `${accountDef.parentAccountNumber}/${accountDef.accountNumber}` : accountDef.accountNumber,
        isSystemAccount: (accountDef as any).isSystemAccount || 0,
        isBankAccount: (accountDef as any).isBankAccount || 0,
        currency: "SAR",
        isActive: 1,
        openingBalance: 0,
        currentBalance: 0,
      });

      accountMap[accountDef.accountNumber] = accountId;
      createdAccounts.push(account);
    }

    return createdAccounts;
  }

  /**
   * Get all accounts for a tenant
   */
  static async getAccounts(tenantId: string, filters?: {
    accountType?: string;
    isActive?: number;
    parentAccountId?: string;
  }): Promise<IAccount[]> {
    const query: any = { tenantId };
    if (filters?.accountType) query.accountType = filters.accountType;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.parentAccountId) query.parentAccountId = filters.parentAccountId;

    return AccountModel.find(query).sort({ accountNumber: 1 });
  }

  /**
   * Get account tree (hierarchical)
   */
  static async getAccountTree(tenantId: string): Promise<any[]> {
    const accounts = await AccountModel.find({ tenantId, isActive: 1 }).sort({ accountNumber: 1 });
    
    const accountMap: Record<string, any> = {};
    const rootAccounts: any[] = [];

    for (const account of accounts) {
      accountMap[account.id] = { ...account.toObject(), children: [] };
    }

    for (const account of accounts) {
      const node = accountMap[account.id];
      if (account.parentAccountId && accountMap[account.parentAccountId]) {
        accountMap[account.parentAccountId].children.push(node);
      } else {
        rootAccounts.push(node);
      }
    }

    return rootAccounts;
  }

  /**
   * Create a new account
   */
  static async createAccount(data: {
    tenantId: string;
    accountNumber: string;
    nameAr: string;
    nameEn?: string;
    accountType: string;
    parentAccountId?: string;
    normalBalance: "debit" | "credit";
    currency?: string;
    isBankAccount?: number;
    bankName?: string;
    bankAccountNumber?: string;
    iban?: string;
    openingBalance?: number;
    branchId?: string;
    costCenterId?: string;
    description?: string;
  }): Promise<IAccount> {
    const existing = await AccountModel.findOne({
      tenantId: data.tenantId,
      accountNumber: data.accountNumber,
    });

    if (existing) {
      throw new Error(`رقم الحساب ${data.accountNumber} موجود بالفعل`);
    }

    let level = 1;
    let path = data.accountNumber;

    if (data.parentAccountId) {
      const parent = await AccountModel.findOne({ id: data.parentAccountId, tenantId: data.tenantId });
      if (parent) {
        level = parent.level + 1;
        path = `${parent.path}/${data.accountNumber}`;
      }
    }

    return AccountModel.create({
      id: nanoid(),
      ...data,
      level,
      path,
      isActive: 1,
      isSystemAccount: 0,
      isBankAccount: data.isBankAccount || 0,
      currentBalance: data.openingBalance || 0,
      openingBalance: data.openingBalance || 0,
    });
  }

  /**
   * Create a journal entry with double-entry validation
   */
  static async createJournalEntry(data: {
    tenantId: string;
    entryDate: Date;
    description: string;
    lines: Array<{
      accountId: string;
      accountNumber: string;
      accountName: string;
      debit: number;
      credit: number;
      description?: string;
      costCenterId?: string;
      branchId?: string;
    }>;
    referenceType?: string;
    referenceId?: string;
    createdBy: string;
    autoPost?: boolean;
  }): Promise<IJournalEntry> {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`القيد غير متوازن: المدين ${totalDebit.toFixed(2)} لا يساوي الدائن ${totalCredit.toFixed(2)}`);
    }

    const entryNumber = await this.generateEntryNumber(data.tenantId);

    const journalEntry = await JournalEntryModel.create({
      id: nanoid(),
      tenantId: data.tenantId,
      entryNumber,
      entryDate: data.entryDate,
      description: data.description,
      lines: data.lines,
      totalDebit: parseFloat(totalDebit.toFixed(2)),
      totalCredit: parseFloat(totalCredit.toFixed(2)),
      isBalanced: 1,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      status: data.autoPost ? "posted" : "draft",
      isAutoPosted: data.autoPost ? 1 : 0,
      createdBy: data.createdBy,
      postedBy: data.autoPost ? data.createdBy : undefined,
      postedAt: data.autoPost ? new Date() : undefined,
    });

    if (data.autoPost) {
      await this.updateAccountBalances(data.tenantId, data.lines);
    }

    return journalEntry;
  }

  /**
   * Post a draft journal entry
   * Prevents double posting and validates fiscal period
   */
  static async postJournalEntry(tenantId: string, entryId: string, postedBy: string): Promise<IJournalEntry> {
    const entry = await JournalEntryModel.findOne({ id: entryId, tenantId });
    if (!entry) {
      throw new Error("القيد غير موجود");
    }

    // Guard: Prevent double posting
    if (entry.status === "posted") {
      throw new Error("تم ترحيل هذا القيد مسبقاً ولا يمكن ترحيله مرة أخرى");
    }

    if (entry.status !== "draft") {
      throw new Error("لا يمكن ترحيل قيد غير مسودة");
    }

    // Validate fiscal period is open (if fiscal period tracking is enabled)
    const entryDate = new Date(entry.entryDate);
    const fiscalPeriod = await FiscalPeriodModel.findOne({
      tenantId,
      startDate: { $lte: entryDate },
      endDate: { $gte: entryDate },
    });

    if (fiscalPeriod && fiscalPeriod.status === "locked") {
      throw new Error(`الفترة المحاسبية مغلقة ولا يمكن إضافة قيود جديدة فيها`);
    }

    entry.status = "posted";
    entry.postedBy = postedBy;
    entry.postedAt = new Date();
    await entry.save();

    await this.updateAccountBalances(tenantId, entry.lines);

    return entry;
  }

  /**
   * Update account balances based on journal lines
   */
  private static async updateAccountBalances(
    tenantId: string,
    lines: Array<{ accountId: string; debit: number; credit: number }>
  ): Promise<void> {
    for (const line of lines) {
      const account = await AccountModel.findOne({ id: line.accountId, tenantId });
      if (account) {
        let adjustment = 0;
        if (account.normalBalance === "debit") {
          adjustment = (line.debit || 0) - (line.credit || 0);
        } else {
          adjustment = (line.credit || 0) - (line.debit || 0);
        }
        account.currentBalance = (account.currentBalance || 0) + adjustment;
        await account.save();
      }
    }
  }

  /**
   * Generate unique entry number
   */
  private static async generateEntryNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await JournalEntryModel.countDocuments({
      tenantId,
      entryNumber: { $regex: `^JE-${year}-` },
    });
    return `JE-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  /**
   * Auto-post journal entry from order
   */
  static async postOrderJournal(tenantId: string, orderId: string, createdBy: string): Promise<IJournalEntry | null> {
    const order = await OrderModel.findOne({ id: orderId });
    if (!order) return null;

    const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1111" });
    const salesAccount = await AccountModel.findOne({ tenantId, accountNumber: "4100" });
    const vatAccount = await AccountModel.findOne({ tenantId, accountNumber: "2120" });
    const cogsAccount = await AccountModel.findOne({ tenantId, accountNumber: "5100" });
    const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });

    if (!cashAccount || !salesAccount || !vatAccount) {
      console.log("Missing required accounts for order journal posting");
      return null;
    }

    const totalAmount = order.totalAmount || 0;
    const vatAmount = totalAmount * 0.15 / 1.15;
    const netAmount = totalAmount - vatAmount;
    const cogs = order.costOfGoods || 0;

    const lines: any[] = [
      {
        accountId: cashAccount.id,
        accountNumber: cashAccount.accountNumber,
        accountName: cashAccount.nameAr,
        debit: totalAmount,
        credit: 0,
        description: `مبيعات - طلب ${order.orderNumber}`,
        branchId: order.branchId,
      },
      {
        accountId: salesAccount.id,
        accountNumber: salesAccount.accountNumber,
        accountName: salesAccount.nameAr,
        debit: 0,
        credit: netAmount,
        description: `إيراد مبيعات - طلب ${order.orderNumber}`,
        branchId: order.branchId,
      },
      {
        accountId: vatAccount.id,
        accountNumber: vatAccount.accountNumber,
        accountName: vatAccount.nameAr,
        debit: 0,
        credit: vatAmount,
        description: `ضريبة القيمة المضافة - طلب ${order.orderNumber}`,
        branchId: order.branchId,
      },
    ];

    if (cogs > 0 && cogsAccount && inventoryAccount) {
      lines.push({
        accountId: cogsAccount.id,
        accountNumber: cogsAccount.accountNumber,
        accountName: cogsAccount.nameAr,
        debit: cogs,
        credit: 0,
        description: `تكلفة البضاعة المباعة - طلب ${order.orderNumber}`,
        branchId: order.branchId,
      });
      lines.push({
        accountId: inventoryAccount.id,
        accountNumber: inventoryAccount.accountNumber,
        accountName: inventoryAccount.nameAr,
        debit: 0,
        credit: cogs,
        description: `خصم مخزون - طلب ${order.orderNumber}`,
        branchId: order.branchId,
      });
    }

    return this.createJournalEntry({
      tenantId,
      entryDate: order.createdAt || new Date(),
      description: `قيد مبيعات - طلب رقم ${order.orderNumber}`,
      lines,
      referenceType: "order",
      referenceId: orderId,
      createdBy,
      autoPost: true,
    });
  }

  /**
   * Create invoice from order with ZATCA QR code
   */
  static async createInvoiceFromOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    issuedBy: string,
    sellerInfo?: { name: string; vatNumber: string }
  ): Promise<IInvoice> {
    const order = await OrderModel.findOne({ id: orderId });
    if (!order) {
      throw new Error("الطلب غير موجود");
    }

    const invoiceNumber = await this.generateInvoiceNumber(tenantId, branchId);
    const invoiceDate = new Date();
    
    const lines = (order.items || []).map((item: any) => ({
      itemId: item.coffeeItemId || item.menuItemId,
      description: item.name || "منتج",
      quantity: item.quantity || 1,
      unitPrice: item.price || item.unitPrice || 0,
      discountAmount: 0,
      discountPercent: 0,
      taxRate: 15,
      taxAmount: ((item.price || item.unitPrice || 0) * (item.quantity || 1)) * 0.15,
      lineTotal: ((item.price || item.unitPrice || 0) * (item.quantity || 1)) * 1.15,
    }));

    const subtotal = lines.reduce((sum: number, line: any) => sum + (line.unitPrice * line.quantity), 0);
    const totalTax = lines.reduce((sum: number, line: any) => sum + line.taxAmount, 0);
    const grandTotal = subtotal + totalTax;

    let zatcaQRCode: string | undefined;
    let zatcaTLV: string | undefined;

    if (sellerInfo?.name && sellerInfo?.vatNumber) {
      const zatcaData: ZatcaInvoiceData = {
        sellerName: sellerInfo.name,
        vatNumber: sellerInfo.vatNumber,
        invoiceDate,
        totalWithVat: grandTotal,
        vatAmount: totalTax,
      };
      zatcaTLV = generateZatcaTLV(zatcaData);
      zatcaQRCode = await generateZatcaQRCode(zatcaData);
    }

    return InvoiceModel.create({
      id: nanoid(),
      tenantId,
      branchId,
      invoiceNumber,
      invoiceDate,
      invoiceType: "sales",
      status: "issued",
      customerId: order.customerId,
      customerName: order.customerInfo?.name || "عميل نقدي",
      customerPhone: order.customerInfo?.phone,
      orderId,
      lines,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalDiscount: 0,
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      amountPaid: grandTotal,
      amountDue: 0,
      currency: "SAR",
      exchangeRate: 1,
      paymentMethod: order.paymentMethod,
      issuedBy,
      issuedAt: invoiceDate,
      paidAt: invoiceDate,
      zatcaQrCode: zatcaQRCode,
      zatcaHash: zatcaTLV,
    });
  }

  /**
   * Create standalone invoice with ZATCA QR code
   */
  static async createInvoice(data: {
    tenantId: string;
    branchId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerTaxNumber?: string;
    customerAddress?: string;
    lines: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
    }>;
    notes?: string;
    issuedBy: string;
    sellerName: string;
    sellerVatNumber: string;
  }): Promise<IInvoice> {
    const invoiceNumber = await this.generateInvoiceNumber(data.tenantId, data.branchId);
    const invoiceDate = new Date();
    
    const processedLines = data.lines.map((line) => {
      const discountPercent = line.discountPercent || 0;
      const baseAmount = line.unitPrice * line.quantity;
      const discountAmount = baseAmount * (discountPercent / 100);
      const afterDiscount = baseAmount - discountAmount;
      const taxAmount = afterDiscount * 0.15;
      const lineTotal = afterDiscount + taxAmount;
      
      return {
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        discountPercent,
        taxRate: 15,
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        lineTotal: parseFloat(lineTotal.toFixed(2)),
      };
    });

    const subtotal = processedLines.reduce((sum, line) => sum + (line.unitPrice * line.quantity), 0);
    const totalDiscount = processedLines.reduce((sum, line) => sum + line.discountAmount, 0);
    const totalTax = processedLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const grandTotal = processedLines.reduce((sum, line) => sum + line.lineTotal, 0);

    const zatcaData: ZatcaInvoiceData = {
      sellerName: data.sellerName,
      vatNumber: data.sellerVatNumber,
      invoiceDate,
      totalWithVat: grandTotal,
      vatAmount: totalTax,
    };
    
    const zatcaTLV = generateZatcaTLV(zatcaData);
    const zatcaQRCode = await generateZatcaQRCode(zatcaData);

    return InvoiceModel.create({
      id: nanoid(),
      tenantId: data.tenantId,
      branchId: data.branchId,
      invoiceNumber,
      invoiceDate,
      invoiceType: "sales",
      status: "issued",
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      customerTaxNumber: data.customerTaxNumber,
      customerAddress: data.customerAddress,
      lines: processedLines,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      amountPaid: 0,
      amountDue: parseFloat(grandTotal.toFixed(2)),
      currency: "SAR",
      exchangeRate: 1,
      notes: data.notes,
      issuedBy: data.issuedBy,
      issuedAt: invoiceDate,
      zatcaQrCode: zatcaQRCode,
      zatcaHash: zatcaTLV,
    });
  }

  /**
   * Get invoices with filtering
   */
  static async getInvoices(
    tenantId: string,
    options?: {
      branchId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<IInvoice[]> {
    const query: any = { tenantId };
    
    if (options?.branchId) query.branchId = options.branchId;
    if (options?.status) query.status = options.status;
    if (options?.startDate || options?.endDate) {
      query.invoiceDate = {};
      if (options.startDate) query.invoiceDate.$gte = options.startDate;
      if (options.endDate) query.invoiceDate.$lte = options.endDate;
    }

    return InvoiceModel.find(query)
      .sort({ invoiceDate: -1 })
      .limit(options?.limit || 100);
  }

  /**
   * Get single invoice by ID
   */
  static async getInvoiceById(tenantId: string, invoiceId: string): Promise<IInvoice | null> {
    return InvoiceModel.findOne({ id: invoiceId, tenantId });
  }

  /**
   * Update invoice status
   */
  static async updateInvoiceStatus(
    tenantId: string,
    invoiceId: string,
    status: string,
    amountPaid?: number
  ): Promise<IInvoice | null> {
    const invoice = await InvoiceModel.findOne({ id: invoiceId, tenantId });
    if (!invoice) return null;

    invoice.status = status as any;
    if (amountPaid !== undefined) {
      invoice.amountPaid = amountPaid;
      invoice.amountDue = invoice.grandTotal - amountPaid;
      if (amountPaid >= invoice.grandTotal) {
        invoice.status = "paid";
        invoice.paidAt = new Date();
      } else if (amountPaid > 0) {
        invoice.status = "partially_paid";
      }
    }
    
    await invoice.save();
    return invoice;
  }

  /**
   * Generate unique invoice number
   */
  private static async generateInvoiceNumber(tenantId: string, branchId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await InvoiceModel.countDocuments({
      tenantId,
      branchId,
      invoiceNumber: { $regex: `^INV-${year}-` },
    });
    return `INV-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  /**
   * Get financial reports
   */
  static async getTrialBalance(
    tenantId: string,
    endDate: Date
  ): Promise<Array<{
    accountNumber: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
  }>> {
    const accounts = await AccountModel.find({ tenantId, isActive: 1 }).sort({ accountNumber: 1 });
    
    return accounts.map((account) => ({
      accountNumber: account.accountNumber,
      accountName: account.nameAr,
      accountType: account.accountType,
      debitBalance: account.normalBalance === "debit" ? account.currentBalance : 0,
      creditBalance: account.normalBalance === "credit" ? account.currentBalance : 0,
    }));
  }

  /**
   * Get income statement
   */
  static async getIncomeStatement(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    branchId?: string
  ): Promise<{
    revenue: Array<{ accountName: string; amount: number }>;
    totalRevenue: number;
    expenses: Array<{ accountName: string; amount: number }>;
    totalExpenses: number;
    cogs: number;
    grossProfit: number;
    netIncome: number;
    source: string;
  }> {
    const query: any = {
      tenantId,
      entryDate: { $gte: startDate, $lte: endDate },
      status: "posted",
    };

    const entries = await JournalEntryModel.find(query);

    const revenueAccounts: Record<string, number> = {};
    const expenseAccounts: Record<string, number> = {};
    let cogs = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (branchId && line.branchId !== branchId) continue;

        const account = await AccountModel.findOne({ id: line.accountId, tenantId });
        if (!account) continue;

        if (account.accountType === "revenue") {
          const amount = (line.credit || 0) - (line.debit || 0);
          revenueAccounts[account.nameAr] = (revenueAccounts[account.nameAr] || 0) + amount;
        } else if (account.accountType === "expense") {
          const amount = (line.debit || 0) - (line.credit || 0);
          if (account.accountNumber === "5100") {
            cogs += amount;
          } else {
            expenseAccounts[account.nameAr] = (expenseAccounts[account.nameAr] || 0) + amount;
          }
        }
      }
    }

    let revenue = Object.entries(revenueAccounts).map(([accountName, amount]) => ({ accountName, amount }));
    const expenses = Object.entries(expenseAccounts).map(([accountName, amount]) => ({ accountName, amount }));
    let totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    let totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    let source = "journal";

    // --- Fallback: Read directly from completed orders when no journal entries cover revenue ---
    // This ensures the income statement works even before the chart of accounts is initialized
    const { default: mongoose } = await import("mongoose");
    const OrderModel = mongoose.models["Order"] as any;
    if (OrderModel) {
      const orderQuery: any = {
        status: { $in: ["completed", "delivered", "paid", "payment_confirmed"] },
        createdAt: { $gte: startDate, $lte: endDate },
      };
      if (branchId) orderQuery.branchId = branchId;
      if (tenantId && tenantId !== "demo-tenant") orderQuery.tenantId = tenantId;

      const orders = await OrderModel.find(orderQuery).lean();

      if (orders.length > 0) {
        const orderRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || o.totalAmount || o.subtotal || 0), 0);
        const orderCogs = orders.reduce((sum: number, o: any) => sum + (o.costOfGoods || 0), 0);

        if (totalRevenue === 0 && orderRevenue > 0) {
          // No journal entries found — use order data directly
          totalRevenue = orderRevenue;
          cogs = orderCogs;
          revenue = [{ accountName: "إيرادات المبيعات", amount: orderRevenue }];
          source = "orders";
        } else if (totalRevenue > 0 && orderCogs > 0 && cogs === 0) {
          // Journal entries have revenue but COGS not journalized yet — fill from orders
          cogs = orderCogs;
          source = "hybrid";
        }

        // Also include approved ERP expenses in the period
        const ExpenseErpModel = mongoose.models["ExpenseErp"] as any;
        if (ExpenseErpModel && totalExpenses === 0) {
          const erpExpenses = await ExpenseErpModel.find({
            tenantId,
            status: "approved",
            createdAt: { $gte: startDate, $lte: endDate },
          }).lean();
          for (const exp of erpExpenses) {
            const key = exp.category || "مصروفات تشغيلية";
            const categoryLabel: Record<string, string> = {
              operating: "مصروفات تشغيلية",
              salary: "رواتب وأجور",
              rent: "إيجار",
              utilities: "مرافق",
              marketing: "تسويق",
              maintenance: "صيانة",
              other: "مصروفات أخرى",
            };
            const expKey = categoryLabel[key] || key;
            const existing = expenseAccounts[expKey] || 0;
            expenseAccounts[expKey] = existing + (exp.totalAmount || exp.amount || 0);
          }
          totalExpenses = Object.values(expenseAccounts).reduce((s, v) => s + v, 0);
        }
      }
    }

    const grossProfit = totalRevenue - cogs;
    const netIncome = grossProfit - totalExpenses;

    return {
      revenue,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      expenses: Object.entries(expenseAccounts).map(([accountName, amount]) => ({ accountName, amount })),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      cogs: parseFloat(cogs.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      netIncome: parseFloat(netIncome.toFixed(2)),
      source,
    };
  }

  /**
   * Get balance sheet
   */
  static async getBalanceSheet(
    tenantId: string,
    asOfDate: Date
  ): Promise<{
    assets: Array<{ accountName: string; balance: number }>;
    totalAssets: number;
    liabilities: Array<{ accountName: string; balance: number }>;
    totalLiabilities: number;
    equity: Array<{ accountName: string; balance: number }>;
    totalEquity: number;
  }> {
    const accounts = await AccountModel.find({ tenantId, isActive: 1, level: { $gte: 3 } });

    const assets: Array<{ accountName: string; balance: number }> = [];
    const liabilities: Array<{ accountName: string; balance: number }> = [];
    const equity: Array<{ accountName: string; balance: number }> = [];

    for (const account of accounts) {
      const balance = account.currentBalance || 0;
      if (balance === 0) continue;

      const item = { accountName: account.nameAr, balance };

      switch (account.accountType) {
        case "asset":
          assets.push(item);
          break;
        case "liability":
          liabilities.push(item);
          break;
        case "equity":
          equity.push(item);
          break;
      }
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

    return {
      assets,
      totalAssets: parseFloat(totalAssets.toFixed(2)),
      liabilities,
      totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
      equity,
      totalEquity: parseFloat(totalEquity.toFixed(2)),
    };
  }

  /**
   * Create expense with workflow
   */
  static async createExpense(data: {
    tenantId: string;
    branchId: string;
    category: string;
    description: string;
    amount: number;
    taxAmount?: number;
    paymentMethod: string;
    vendorName?: string;
    requestedBy: string;
    notes?: string;
  }): Promise<IExpenseErp> {
    const expenseNumber = await this.generateExpenseNumber(data.tenantId);
    const totalAmount = data.amount + (data.taxAmount || 0);

    return ExpenseErpModel.create({
      id: nanoid(),
      tenantId: data.tenantId,
      branchId: data.branchId,
      expenseNumber,
      expenseDate: new Date(),
      category: data.category,
      description: data.description,
      amount: data.amount,
      taxAmount: data.taxAmount || 0,
      totalAmount,
      paymentMethod: data.paymentMethod,
      vendorName: data.vendorName,
      requestedBy: data.requestedBy,
      status: "pending_approval",
      notes: data.notes,
      isRecurring: 0,
    });
  }

  /**
   * Approve expense
   */
  static async approveExpense(
    tenantId: string,
    expenseId: string,
    approvedBy: string
  ): Promise<IExpenseErp> {
    const expense = await ExpenseErpModel.findOne({ id: expenseId, tenantId });
    if (!expense) {
      throw new Error("المصروف غير موجود");
    }

    if (expense.status !== "pending_approval") {
      throw new Error("لا يمكن اعتماد هذا المصروف");
    }

    expense.status = "approved";
    expense.approvedBy = approvedBy;
    expense.approvedAt = new Date();
    await expense.save();

    return expense;
  }

  /**
   * Generate expense number
   */
  private static async generateExpenseNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await ExpenseErpModel.countDocuments({
      tenantId,
      expenseNumber: { $regex: `^EXP-${year}-` },
    });
    return `EXP-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  /**
   * Get vendors
   */
  static async getVendors(tenantId: string): Promise<IVendor[]> {
    return VendorModel.find({ tenantId, isActive: 1 }).sort({ nameAr: 1 });
  }

  /**
   * Create vendor
   */
  static async createVendor(data: {
    tenantId: string;
    code: string;
    nameAr: string;
    nameEn?: string;
    taxNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    bankName?: string;
    iban?: string;
    paymentTerms?: string;
    creditLimit?: number;
  }): Promise<IVendor> {
    return VendorModel.create({
      id: nanoid(),
      ...data,
      country: "SA",
      currentBalance: 0,
      isActive: 1,
    });
  }

  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    accountsReceivable: number;
    accountsPayable: number;
    cashBalance: number;
    pendingExpenses: number;
    invoiceCount: number;
    orderCount: number;
    usingOrderData: boolean;
  }> {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1);
    const end = endDate || new Date();

    const income = await this.getIncomeStatement(tenantId, start, end, branchId);

    // Also pull revenue directly from completed orders for accurate reporting
    const orderQuery: any = {
      tenantId,
      createdAt: { $gte: start, $lte: end },
      status: { $ne: "cancelled" },
    };
    if (branchId) orderQuery.branchId = branchId;
    const recentOrders = await OrderModel.find(orderQuery).lean();
    const orderRevenue = recentOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const orderCount = recentOrders.length;

    // Use journal entries if available, otherwise fall back to real order data
    const hasJournalData = income.totalRevenue > 0;
    const totalRevenue = hasJournalData ? income.totalRevenue : orderRevenue;
    const totalExpenses = income.totalExpenses + income.cogs;
    const netIncome = hasJournalData ? income.netIncome : (orderRevenue - totalExpenses);

    const [cashAccount, arAccount, apAccount, pendingExpenses, invoiceCount] = await Promise.all([
      AccountModel.findOne({ tenantId, accountNumber: "1111" }),
      AccountModel.findOne({ tenantId, accountNumber: "1120" }),
      AccountModel.findOne({ tenantId, accountNumber: "2110" }),
      ExpenseErpModel.countDocuments({ tenantId, status: "pending_approval" }),
      InvoiceModel.countDocuments(branchId ? { tenantId, branchId } : { tenantId }),
    ]);

    return {
      totalRevenue,
      totalExpenses,
      netIncome,
      accountsReceivable: arAccount?.currentBalance || 0,
      accountsPayable: apAccount?.currentBalance || 0,
      cashBalance: cashAccount?.currentBalance || 0,
      pendingExpenses,
      invoiceCount,
      orderCount,
      usingOrderData: !hasJournalData,
    };
  }
}
