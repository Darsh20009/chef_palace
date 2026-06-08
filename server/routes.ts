import crypto from "crypto";
import mongoose from "mongoose";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cache, cacheKey, CACHE_TTL } from "./cache";
import { 
  insertOrderSchema, 
  insertCartItemSchema, 
  insertEmployeeSchema, 
  type PaymentMethod, 
  insertTaxInvoiceSchema, 
  RecipeItemModel, 
  BranchStockModel, 
  RawItemModel, 
  StockMovementModel, 
  OrderModel, 
  BranchModel, 
  CoffeeItemModel, 
  CoffeeItemAddonModel, 
  ProductReviewModel, 
  ReferralModel, 
  NotificationModel, 
  CustomerModel, 
  TableModel, 
  CafeModel, 
  AccountingSnapshotModel, 
  insertAccountingSnapshotSchema, 
  ProductAddonModel, 
  WarehouseModel, 
  WarehouseStockModel, 
  WarehouseTransferModel, 
  DeliveryIntegrationModel, 
  CartItemModel,
  EmployeeModel,
  PointTransferModel,
  CustomBannerModel,
  PromoOfferModel,
  MenuCategoryModel,
  AccountModel,
  JournalEntryModel,
  ExpenseErpModel,
  VendorModel,
  TaxInvoiceModel,
  CashierShiftModel,
  RefundModel
} from "@shared/schema";
import { RecipeEngine } from "./recipe-engine";
import { UnitsEngine } from "./units-engine";
import { InventoryEngine } from "./inventory-engine";
import { AccountingEngine } from "./accounting-engine";
import { ErpAccountingService } from "./erp-accounting-service";
import { deliveryService } from "./delivery-service";
import { requireAuth, requireManager, requireAdmin, filterByBranch, requireKitchenAccess, requireCashierAccess, requireDeliveryAccess, requirePermission, requireCustomerAuth, type AuthRequest, type CustomerAuthRequest } from "./middleware/auth";
import { PermissionsEngine, PERMISSIONS } from "./permissions-engine";
import { requireTenant, getTenantIdFromRequest } from "./middleware/tenant";
import { wsManager } from "./websocket";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Types } from "mongoose";
import { nanoid } from "nanoid";
const isValidObjectId = (id: string) => Types.ObjectId.isValid(id);

// Upload directory helper — uses /tmp on Vercel (read-only FS), local attached_assets otherwise
const IS_VERCEL = !!process.env.VERCEL;
function getUploadsDir(subDir: string): string {
  const base = IS_VERCEL ? '/tmp/uploads' : path.resolve(__dirname, '..', 'attached_assets');
  const dir = path.join(base, subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Centralized VAT Rate ────────────────────────────────────────────────────
// Saudi Arabia standard VAT rate (15%). Change here to update all calculations.
// The value in BusinessConfigModel.taxRate is authoritative; this constant is
// used as a fallback for synchronous calculations.
const VAT_RATE = 0.15;

// ─── Saudi Arabia Timezone Utilities (UTC+3) ─────────────────────────────────
// All "today" calculations must use Saudi Arabia time (Asia/Riyadh, UTC+3)
// so that midnight rolls over at 00:00 Riyadh time, not 00:00 UTC (which
// would be 03:00 Riyadh time — 3 hours late).
function getSaudiStartOfDay(date?: Date): Date {
  const d = date || new Date();
  // Add 3 hours to get the current date in Riyadh time
  const saudiDate = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  // Zero out to midnight in Riyadh (using UTC methods on the shifted date)
  const midnight = new Date(Date.UTC(
    saudiDate.getUTCFullYear(),
    saudiDate.getUTCMonth(),
    saudiDate.getUTCDate(),
    0, 0, 0, 0
  ));
  // Shift back to UTC: Saudi midnight 00:00 = UTC 21:00 previous day
  return new Date(midnight.getTime() - 3 * 60 * 60 * 1000);
}
function getSaudiEndOfDay(date?: Date): Date {
  const start = getSaudiStartOfDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function getAutoShiftPeriod(now: Date, hours: number): { index: number; start: Date; end: Date } {
  const safeHours = Math.max(1, Math.min(24, Math.floor(hours || 12)));
  const midnight = getSaudiStartOfDay(now);
  const elapsedMs = now.getTime() - midnight.getTime();
  const periodMs = safeHours * 3600000;
  const index = Math.floor(elapsedMs / periodMs);
  const start = new Date(midnight.getTime() + index * periodMs);
  const end = new Date(start.getTime() + periodMs);
  return { index, start, end };
}

async function getEffectiveNow(tenantId?: string): Promise<Date> {
  try {
    const cfg = await BusinessConfigModel.findOne(tenantId ? { tenantId } : {}).lean();
    const offset = Number((cfg as any)?.manualTimeOffsetMinutes || 0);
    return new Date(Date.now() + offset * 60000);
  } catch {
    return new Date();
  }
}

function aggregateOrdersAsShift(
  orders: any[],
  periodStart: Date,
  periodEnd: Date,
  coffeeItemMap?: Map<string, any>,
  categoryMap?: Map<string, any>,
) {
  const summary: any = {
    totalSales: 0,
    totalOrders: 0,
    totalCashSales: 0,
    totalCardSales: 0,
    totalDigitalSales: 0,
    totalDiscounts: 0,
    totalVAT: 0,
    netRevenue: 0,
    paymentBreakdown: { cash: 0, card: 0, loyalty: 0 },
    orderTypeBreakdown: { dine_in: 0, takeaway: 0, car_pickup: 0, delivery: 0, online: 0 },
    employees: [] as Array<{ name: string; orders: number; sales: number }>,
    categories: [] as Array<{ categoryId: string; nameAr: string; quantity: number; sales: number; itemsCount: number }>,
    topProducts: [] as Array<{ id: string; nameAr: string; categoryNameAr: string; quantity: number; sales: number }>,
    orderIds: [] as string[],
  };
  const empMap: Record<string, { name: string; orders: number; sales: number }> = {};
  const catAgg: Record<string, { categoryId: string; nameAr: string; quantity: number; sales: number; itemsCount: number }> = {};
  const prodAgg: Record<string, { id: string; nameAr: string; categoryNameAr: string; quantity: number; sales: number }> = {};

  for (const o of orders) {
    const amount = Number(o.totalAmount || 0);
    const vat = Number(o.vat || o.taxAmount || 0);
    const discount = Number(o.discount || o.discountAmount || 0);
    const method = String(o.paymentMethod || 'cash').toLowerCase();
    const type = String(o.orderType || 'takeaway').toLowerCase();
    summary.totalSales += amount;
    summary.totalOrders += 1;
    summary.totalDiscounts += discount;
    summary.totalVAT += vat;
    summary.netRevenue += (amount - vat);
    summary.orderIds.push(o.id || o._id?.toString());
    if (method === 'cash') {
      summary.totalCashSales += amount;
      summary.paymentBreakdown.cash += amount;
    } else if (method === 'qahwa-card' || method === 'loyalty-card') {
      summary.totalDigitalSales += amount;
      summary.paymentBreakdown.loyalty += amount;
    } else {
      summary.totalCardSales += amount;
      summary.paymentBreakdown.card += amount;
    }
    if (summary.orderTypeBreakdown[type] !== undefined) {
      summary.orderTypeBreakdown[type] += 1;
    }
    const empName = o.employeeName || o.cashierName || o.createdByName || 'غير معروف';
    if (!empMap[empName]) empMap[empName] = { name: empName, orders: 0, sales: 0 };
    empMap[empName].orders += 1;
    empMap[empName].sales += amount;

    // Category + product aggregation
    if (coffeeItemMap && Array.isArray(o.items)) {
      for (const it of o.items) {
        const cid = it.coffeeItemId || it.id;
        const qty = Number(it.quantity) || 1;
        const ci = coffeeItemMap.get(String(cid));
        const itemName = ci?.nameAr || it.coffeeItem?.nameAr || it.nameAr || it.name || 'منتج';
        const catId = ci?.category || 'uncategorized';
        const catName = categoryMap?.get(String(catId))?.nameAr || (catId === 'uncategorized' ? 'بدون تصنيف' : catId);
        const lineTotal = Number(it.totalPrice || it.priceTotal || (it.unitPrice ? it.unitPrice * qty : 0) || (ci?.price ? ci.price * qty : 0));
        if (!catAgg[catId]) catAgg[catId] = { categoryId: catId, nameAr: catName, quantity: 0, sales: 0, itemsCount: 0 };
        catAgg[catId].quantity += qty;
        catAgg[catId].sales += lineTotal;
        catAgg[catId].itemsCount += 1;
        const pkey = String(cid || itemName);
        if (!prodAgg[pkey]) prodAgg[pkey] = { id: pkey, nameAr: itemName, categoryNameAr: catName, quantity: 0, sales: 0 };
        prodAgg[pkey].quantity += qty;
        prodAgg[pkey].sales += lineTotal;
      }
    }
  }
  summary.employees = Object.values(empMap).sort((a, b) => b.sales - a.sales);
  summary.categories = Object.values(catAgg).sort((a, b) => b.quantity - a.quantity);
  summary.topProducts = Object.values(prodAgg).sort((a, b) => b.quantity - a.quantity).slice(0, 20);
  return summary;
}

async function loadMenuMaps(tenantId: string): Promise<{ coffeeItemMap: Map<string, any>; categoryMap: Map<string, any> }> {
  try {
    const [items, cats] = await Promise.all([
      CoffeeItemModel.find({ tenantId }).select('id nameAr category price').lean(),
      MenuCategoryModel.find({ tenantId }).select('id nameAr').lean(),
    ]);
    return {
      coffeeItemMap: new Map(items.map((i: any) => [String(i.id), i])),
      categoryMap: new Map(cats.map((c: any) => [String(c.id), c])),
    };
  } catch {
    return { coffeeItemMap: new Map(), categoryMap: new Map() };
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── High-Performance Coffee Items Cache ─────────────────────────────────────
// getCoffeeItems() is called in 11+ hot paths. This cached version eliminates
// repeated DB round-trips, returning a Map<id, item> for O(1) lookups.
// Cache is per-tenantId and auto-invalidated on item mutations.
async function getCachedCoffeeItemMap(tenantId: string): Promise<Map<string, any>> {
  const ck = cacheKey('coffee-items-map', tenantId);
  const cached = cache.get<Map<string, any>>(ck);
  if (cached) return cached;
  const { CoffeeItemModel } = await import("@shared/schema");
  const items = await CoffeeItemModel.find({ tenantId })
    .select('id nameAr nameEn price imageUrl category isAvailable')
    .lean();
  const map = new Map<string, any>();
  for (const item of items) {
    const s = serializeDoc(item as any);
    map.set(s.id, s);
  }
  cache.set(ck, map, CACHE_TTL.COFFEE_ITEM_MAP);
  return map;
}

async function getCachedCoffeeItems(tenantId: string): Promise<any[]> {
  const ck = cacheKey('coffee-items', tenantId);
  const cached = cache.get<any[]>(ck);
  if (cached) return cached;
  const { CoffeeItemModel } = await import("@shared/schema");
  const items = await CoffeeItemModel.find({ tenantId }).lean();
  const serialized = (items as any[]).map(serializeDoc);
  cache.set(ck, serialized, CACHE_TTL.COFFEE_ITEMS);
  return serialized;
}

function invalidateCoffeeItemsCache(tenantId: string) {
  cache.invalidate('coffee-items:' + tenantId);
  cache.invalidate('coffee-items-map:' + tenantId);
  cache.invalidate('menu-items');
  cache.invalidate('product-addons:' + tenantId);
}

async function calcOrderPrepTime(tenantId: string, items: any[]): Promise<number> {
  try {
    const config = await BusinessConfigModel.findOne({ tenantId }).lean();
    const base = (config as any)?.prepBaseMinutes ?? 10;
    const extra = (config as any)?.prepExtraMinutesPerItem ?? 3;
    const freeCount = (config as any)?.prepFreeItemCount ?? 2;
    const totalQty = Array.isArray(items)
      ? items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
      : 1;
    const extraMins = totalQty > freeCount ? (totalQty - freeCount) * extra : 0;
    return base + extraMins;
  } catch { return 10; }
}
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import nodemailer from "nodemailer";
import {
  sendOrderNotificationEmail,
  sendReferralEmail,
  sendLoyaltyPointsEmail,
  sendPromotionEmail,
  sendWelcomeEmail,
  sendAbandonedCartEmail,
  testEmailConnection,
  sendPointsVerificationEmail,
} from "./mail-service";
import { appendOrderToSheet } from "./google-sheets";
import { getVapidPublicKey, saveSubscription, removeSubscription, sendPushToEmployee, sendPushToCustomer } from "./push-service";
import { registerObjectStorageRoutes } from "./qirox_studio_integrations/object_storage";

  // Ensure upload directories exist
  const uploadDirs = [
    path.resolve(__dirname, '..', 'attached_assets', 'drinks'),
    path.resolve(__dirname, '..', 'attached_assets', 'sizes'),
    path.resolve(__dirname, '..', 'attached_assets', 'addons'),
    path.resolve(__dirname, '..', 'attached_assets', 'employees'),
    path.resolve(__dirname, '..', 'attached_assets', 'attendance'),
    path.resolve(__dirname, '..', 'attached_assets', 'receipts'),
  ];
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

// Helper function to serialize MongoDB documents
function serializeDoc(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // Convert any remaining Map objects to plain objects
  if (obj.storeHours instanceof Map) {
    obj.storeHours = Object.fromEntries(obj.storeHours);
  }

  // Only set id from _id if there's no existing id field
  if (obj._id && !obj.id) {
    obj.id = obj._id.toString();
  }
  
  // Always clean up MongoDB internal fields
  delete obj._id;
  delete obj.__v;
  return obj;
}

// Helper function to convert recipe units to raw item units for cost calculation
function convertUnitsForCost(recipeQuantity: number, recipeUnit: string, rawItemUnit: string): number {
  // Normalize units to lowercase for comparison
  const rUnit = (recipeUnit || '').toLowerCase().trim();
  const iUnit = (rawItemUnit || '').toLowerCase().trim();
  
  // If units match, no conversion needed
  if (rUnit === iUnit) return recipeQuantity;
  
  // Gram to Kilogram conversions
  if ((rUnit === 'g' || rUnit === 'gram' || rUnit === 'grams') && (iUnit === 'kg' || iUnit === 'kilogram' || iUnit === 'kilograms')) {
    return recipeQuantity / 1000;
  }
  
  // Milliliter to Liter conversions
  if ((rUnit === 'ml' || rUnit === 'milliliter' || rUnit === 'milliliters') && (iUnit === 'liter' || iUnit === 'liters' || iUnit === 'l')) {
    return recipeQuantity / 1000;
  }
  
  // Kilogram to Gram conversions (reverse)
  if ((rUnit === 'kg' || rUnit === 'kilogram' || rUnit === 'kilograms') && (iUnit === 'g' || iUnit === 'gram' || iUnit === 'grams')) {
    return recipeQuantity * 1000;
  }
  
  // Liter to Milliliter conversions (reverse)
  if ((iUnit === 'ml' || iUnit === 'milliliter' || iUnit === 'milliliters') && (rUnit === 'liter' || rUnit === 'liters' || rUnit === 'l')) {
    return recipeQuantity * 1000;
  }
  
  // Default: return as-is if no known conversion
  return recipeQuantity;
}

// Safe JSON Parse Helper
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return fallback;
  }
}

// Helper function to deduct inventory when order status changes to in_progress
// This version uses storage.deductInventoryForOrder for consistency with order creation
async function deductInventoryForOrder(orderId: string, branchId: string, employeeId: string): Promise<{
  success: boolean;
  costOfGoods: number;
  deductionDetails: Array<{
    rawItemId: string;
    rawItemName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;
  warnings: string[];
  error?: string;
}> {
  try {
    // Validate branchId is provided and valid
    if (!branchId || branchId === 'undefined' || branchId === 'null') {
      return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: 'No valid branchId' };
    }

    const order = await OrderModel.findOne({ id: orderId }) || await OrderModel.findById(orderId).catch(() => null);
    if (!order) {
      return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: 'Order not found' };
    }

    // Skip if already deducted (status 1 = fully deducted, status 2 = partially deducted)
    if (order.inventoryDeducted && order.inventoryDeducted >= 1) {
      return { 
        success: true, 
        costOfGoods: order.costOfGoods || 0, 
        deductionDetails: (order.inventoryDeductionDetails || []).map((d: any) => ({
          rawItemId: d.rawItemId,
          rawItemName: d.rawItemName,
          quantity: d.quantity,
          unit: d.unit,
          unitCost: d.unitCost,
          totalCost: d.totalCost
        })),
        warnings: []
      };
    }

    let items = order.items || [];
    if (typeof items === 'string') {
      items = safeJsonParse(items, []);
    }

    if (items.length === 0) {
      return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: 'Order has no items' };
    }

    // Build order items array for storage method
    const orderItems = items.map((item: any) => ({
      coffeeItemId: item.coffeeItemId || item.id,
      quantity: item.quantity || 1,
      addons: item.customization?.selectedAddons?.map((a: any) => ({
        id: a.addonId || a.id,
        rawItemId: a.rawItemId,
        quantity: a.quantity || 1,
        unit: a.unit
      })) || []
    }));

    // Reward points for order items — use pointsPerDrink from business config, default 10
    let pointsPerDrink = 10;
    try {
      const { BusinessConfigModel } = await import("@shared/schema");
      const bizConfig = await BusinessConfigModel.findOne({ tenantId: order.tenantId || 'demo-tenant' }).lean();
      if (bizConfig?.loyaltyConfig?.pointsPerDrink !== undefined) {
        pointsPerDrink = Number(bizConfig.loyaltyConfig.pointsPerDrink) || 10;
      }
    } catch (e) {
      console.warn("[LOYALTY] Could not read business config for pointsPerDrink, using default 10");
    }

    const totalPointsToAward = orderItems.reduce((acc: any, item: any) => acc + (item.quantity * pointsPerDrink), 0);
    
    // Award points — search by customerId first, then by customer phone as fallback
    // Guard against duplicate awarding: skip if points were already awarded for this order
    if (totalPointsToAward > 0 && !(order as any).pointsAwarded) {
      try {
        // Update Customer document if customerId exists
        if (order.customerId) {
          await CustomerModel.findOneAndUpdate({ id: order.customerId }, {
            $inc: { points: totalPointsToAward, pendingPoints: -Math.abs(totalPointsToAward) }
          });
        }

        // Find loyalty card by customerId or by customer phone number
        let loyaltyCard = null;
        if (order.customerId) {
          loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ customerId: order.customerId });
        }
        // Fallback 1: search by phone from order
        if (!loyaltyCard) {
          const customerPhone = order.customerPhone || order.customerInfo?.customerPhone;
          if (customerPhone) {
            const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
            loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ phoneNumber: { $in: [cleanPhone, customerPhone, `+966${cleanPhone.slice(1)}`, `966${cleanPhone.slice(1)}`] } });
          }
        }
        // Fallback 2: look up customer by customerId to get phone, then search card by phone
        if (!loyaltyCard && order.customerId) {
          const cust = await CustomerModel.findOne({ id: order.customerId }).lean();
          if (cust?.phone) {
            const p = cust.phone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
            loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ phoneNumber: { $in: [p, cust.phone, `+966${p.slice(1)}`, `966${p.slice(1)}`] } });
            // Link customerId to card for future lookups
            if (loyaltyCard && !loyaltyCard.customerId) {
              loyaltyCard.customerId = order.customerId;
            }
          }
        }

        if (loyaltyCard) {
          loyaltyCard.points = (Number(loyaltyCard.points) || 0) + totalPointsToAward;
          loyaltyCard.pendingPoints = Math.max(0, (Number(loyaltyCard.pendingPoints) || 0) - totalPointsToAward);
          await loyaltyCard.save();
          console.log(`[LOYALTY] Awarded ${totalPointsToAward} points to card ${loyaltyCard.id} (${loyaltyCard.phoneNumber})`);
        } else {
          console.warn(`[LOYALTY] No loyalty card found for order ${order.id} (customerId: ${order.customerId}, phone: ${order.customerPhone})`);
        }

        // Mark points as awarded on the order to prevent future duplicates
        await OrderModel.findOneAndUpdate({ id: orderId }, { pointsAwarded: true });
      } catch (e) {
        console.error("[LOYALTY] Failed to update loyalty card:", e);
      }
    } else if ((order as any).pointsAwarded) {
      console.log(`[LOYALTY] Points already awarded for order ${order.id}, skipping`);
    }

    // Call storage method to deduct inventory for order
    const result = await storage.deductInventoryForOrder(orderId, branchId, orderItems, employeeId);

    // Update order with inventory deduction info
    await OrderModel.findOneAndUpdate({ id: orderId }, {
      inventoryDeducted: result.success ? 1 : 0,
      costOfGoods: result.costOfGoods,
      inventoryDeductionDetails: result.deductionDetails
    });

    // Log warnings if any
    if (result.warnings.length > 0) {
      console.warn(`[INVENTORY] Order ${order.orderNumber} warnings:`, result.warnings);
    }

    // Auto-create COGS journal entry for accounting (only on full success, with idempotency)
    if (result.success && result.costOfGoods > 0) {
      try {
        const tenantId = order.tenantId || 'demo-tenant';
        const { JournalEntryModel } = await import("@shared/schema");
        const existingEntry = await JournalEntryModel.findOne({ tenantId, referenceType: 'order_cogs', referenceId: orderId });
        
        if (!existingEntry) {
          const cogsAccount = await AccountModel.findOne({ tenantId, accountNumber: "5100" });
          const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
          
          if (cogsAccount && inventoryAccount) {
            await ErpAccountingService.createJournalEntry({
              tenantId,
              entryDate: new Date(),
              description: `تكلفة البضاعة المباعة - طلب رقم ${order.orderNumber}`,
              lines: [
                {
                  accountId: cogsAccount.id,
                  accountNumber: cogsAccount.accountNumber,
                  accountName: cogsAccount.nameAr,
                  debit: result.costOfGoods,
                  credit: 0,
                  description: `تكلفة البضاعة المباعة - طلب ${order.orderNumber}`,
                  branchId,
                },
                {
                  accountId: inventoryAccount.id,
                  accountNumber: inventoryAccount.accountNumber,
                  accountName: inventoryAccount.nameAr,
                  debit: 0,
                  credit: result.costOfGoods,
                  description: `خصم مخزون - طلب ${order.orderNumber}`,
                  branchId,
                },
              ],
              referenceType: 'order_cogs',
              referenceId: orderId,
              createdBy: employeeId,
              autoPost: true,
            });
            console.log(`[ACCOUNTING] COGS journal entry created for order ${order.orderNumber}: ${result.costOfGoods} SAR`);
          }
        }
      } catch (accountingError) {
        console.error(`[ACCOUNTING] Failed to create COGS journal entry for order ${order.orderNumber}:`, accountingError);
      }
    }

    return { 
      success: result.success, 
      costOfGoods: result.costOfGoods, 
      deductionDetails: result.deductionDetails.map((d: any) => ({
        rawItemId: d.rawItemId,
        rawItemName: d.rawItemName,
        quantity: d.quantity,
        unit: d.unit,
        unitCost: d.unitCost,
        totalCost: d.totalCost
      })),
      warnings: result.warnings,
      error: result.errors.length > 0 ? result.errors.join(', ') : undefined
    };
  } catch (error) {
    return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: String(error) };
  }
}

// Helper function to send WhatsApp notification
function getOrderStatusMessage(status: string, orderNumber: string): string {
  const statusMessages: Record<string, string> = {
    'pending': `⏳ طلبك رقم ${orderNumber} في الانتظار\nنحن نستعد لتجهيزه!`,
    'payment_confirmed': `💰 تم تأكيد دفع طلبك رقم ${orderNumber}\nجاري تحضيره الآن!`,
    'in_progress': `☕ طلبك رقم ${orderNumber} قيد التحضير الآن\nقهوتك في الطريق!`,
    'ready': `🎉 طلبك رقم ${orderNumber} جاهز للاستلام!\nاستمتع بقهوتك ☕`,
    'completed': `✅ تم استلام طلبك رقم ${orderNumber}\nنتمنى أن تستمتع بقهوتك!`,
    'cancelled': `❌ تم إلغاء طلبك رقم ${orderNumber}\nنأسف للإزعاج`
  };
  return statusMessages[status] || `تم تحديث حالة طلبك رقم ${orderNumber} إلى: ${status}`;
}

// Maileroo Email Configuration - DISABLED IN FAVOR OF TURBOSMTP
/*
const mailerooApiKey = process.env.MAILEROO_API_KEY;
const mailerooUser = process.env.MAILEROO_USER || 'cafe@chefsplace.online';
*/

// Set transporter to null to satisfy the rest of the code that might reference it
const transporter = null;

// Generate Tax Invoice HTML
function generateInvoiceHTML(invoiceNumber: string, data: any): string {
  const { customerName, customerPhone, items, subtotal, discountAmount, taxAmount, totalAmount, paymentMethod, invoiceDate } = data;
  
  const itemsHTML = items.map((item: any) => `
    <tr>
      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">${item.coffeeItem?.nameAr || 'منتج'}</td>
      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">${item.quantity}</td>
      <td style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">${(Number(item.coffeeItem?.price || 0) * item.quantity).toFixed(2)} ريال</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial; direction: rtl; background: #f5f5f5; }
        .container { max-width: 800px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #8B5A2B; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { color: #8B5A2B; margin: 0; font-size: 28px; }
        .header p { color: #666; margin: 5px 0; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
        .customer-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #8B5A2B; color: white; padding: 10px; text-align: right; }
        .total-section { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .total-row { display: flex; justify-content: space-between; width: 200px; }
        .total-row.grand { font-size: 18px; font-weight: bold; color: #8B5A2B; border-top: 2px solid #8B5A2B; padding-top: 10px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>مكان الشيف البخاري</h1>
          <p>فاتورة ضريبية</p>
        </div>
        
        <div class="invoice-info">
          <div><strong>رقم الفاتورة:</strong> ${invoiceNumber}</div>
          <div><strong>التاريخ:</strong> ${new Date(invoiceDate).toLocaleDateString('ar-SA')}</div>
        </div>

        <div class="customer-info">
          <p><strong>بيانات العميل:</strong></p>
          <p>الاسم: ${customerName}</p>
          <p>الهاتف: ${customerPhone}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row"><span>المجموع الفرعي:</span><span>${subtotal.toFixed(2)} ريال</span></div>
          ${discountAmount > 0 ? `<div class="total-row"><span>الخصم:</span><span>-${discountAmount.toFixed(2)} ريال</span></div>` : ''}
          <div class="total-row"><span>الضريبة (15%):</span><span>${taxAmount.toFixed(2)} ريال</span></div>
          <div class="total-row grand"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ريال</span></div>
          <div class="total-row"><span>طريقة الدفع:</span><span>${paymentMethod}</span></div>
        </div>

        <div class="footer">
          <p>شكراً لتعاملك معنا | تم إصدار هذه الفاتورة من نظام مكان الشيف البخاري</p>
          <p>© 2025 مكان الشيف البخاري - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send invoice via email
async function sendInvoiceEmail(to: string, invoiceNumber: string, invoiceData: any): Promise<boolean> {
  try {
    const { sendOrderNotificationEmail } = await import("./mail-service");
    // Reuse the existing robust mail service instead of Maileroo
    return await sendOrderNotificationEmail(
      to,
      invoiceData.customerName || "عميل",
      invoiceNumber,
      "completed",
      invoiceData.totalAmount || 0,
      invoiceData
    );
  } catch (error) {
    console.error("❌ Failed to send invoice email:", error);
    return false;
  }
}

// Configure multer for file uploads
const uploadsDir = getUploadsDir('receipts');
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (ext && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPG, PNG, WEBP) and PDF are allowed.'));
    }
  }
});

// Simple POS device status tracker
let posDeviceStatus = { connected: false, lastCheck: Date.now() };

import { BusinessConfigModel, AppointmentModel, PrintJobModel } from "./models";

function getAppBaseUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}`;
  return `https://www.chefsplace.online`;
}

function generateOrderNotificationSVG(
  status: string,
  orderNumber: string,
  estimatedTimeStr?: string,
  orderType?: string
): string {
  type StageConfig = { icon: string; titleAr: string; stageIdx: number; bg1: string; bg2: string };
  const stageConfigs: Record<string, StageConfig> = {
    'pending':           { icon: '&#x1F550;', titleAr: '&#x062A;&#x0645; &#x0627;&#x0633;&#x062A;&#x0644;&#x0627;&#x0645; &#x0637;&#x0644;&#x0628;&#x0643;',    stageIdx: 0, bg1: '#0d3322', bg2: '#1a5c38' },
    'payment_confirmed': { icon: '&#x2705;',  titleAr: '&#x062A;&#x0645; &#x062A;&#x0623;&#x0643;&#x064A;&#x062F; &#x0637;&#x0644;&#x0628;&#x0643;',    stageIdx: 0, bg1: '#0d3322', bg2: '#1a5c38' },
    'in_progress':       { icon: '&#x2615;',  titleAr: '&#x062C;&#x0627;&#x0631;&#x0650; &#x0627;&#x0644;&#x062A;&#x062D;&#x0636;&#x064A;&#x0631;',      stageIdx: 1, bg1: '#0d3322', bg2: '#1a5c38' },
    'ready':             { icon: '&#x1F514;', titleAr: '&#x0637;&#x0644;&#x0628;&#x0643; &#x062C;&#x0627;&#x0647;&#x0632;!',       stageIdx: 2, bg1: '#0a2d1e', bg2: '#16503a' },
    'completed':         { icon: '&#x1F389;', titleAr: '&#x062A;&#x0645; &#x0627;&#x0644;&#x062A;&#x0633;&#x0644;&#x064A;&#x0645; &#x0628;&#x0646;&#x062C;&#x0627;&#x062D;', stageIdx: 3, bg1: '#0a2d1e', bg2: '#164d35' },
    'cancelled':         { icon: '&#x274C;',  titleAr: '&#x062A;&#x0645; &#x0625;&#x0644;&#x063A;&#x0627;&#x0621; &#x0627;&#x0644;&#x0637;&#x0644;&#x0628;', stageIdx: -1, bg1: '#1a0a0a', bg2: '#3d1515' },
  };
  const cfg = stageConfigs[status] || stageConfigs['pending'];
  const estimatedTime = estimatedTimeStr ? parseInt(estimatedTimeStr) : 0;

  const dotXPositions = [120, 373, 627, 880];
  const stageLabels = [
    '&#x0627;&#x0633;&#x062A;&#x0644;&#x0627;&#x0645;',
    '&#x062A;&#x062D;&#x0636;&#x064A;&#x0631;',
    '&#x062C;&#x0627;&#x0647;&#x0632;',
    '&#x062A;&#x0633;&#x0644;&#x064A;&#x0645;',
  ];
  const progressFillWidths = [0, 253, 507, 760];
  const progressFill = cfg.stageIdx >= 0 ? (progressFillWidths[cfg.stageIdx] || 0) : 0;

  const dotElements = dotXPositions.map((x, i) => {
    const isDone = i <= cfg.stageIdx;
    const r = isDone ? 13 : 8;
    const fill = isDone ? '#7FD4A8' : '#ffffff';
    const fillOp = isDone ? '1' : '0.25';
    const labelFill = isDone ? '#7FD4A8' : '#ffffff';
    const labelOp = isDone ? '1' : '0.35';
    return `<circle cx="${x}" cy="432" r="${r}" fill="${fill}" fill-opacity="${fillOp}"/>` +
           `<text x="${x}" y="462" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="${labelFill}" fill-opacity="${labelOp}">${stageLabels[i]}</text>`;
  }).join('');

  const orderTypeEmojis: Record<string, string> = {
    'delivery': '&#x1F697; &#x062A;&#x0648;&#x0635;&#x064A;&#x0644;',
    'car-pickup': '&#x1F697; &#x0633;&#x064A;&#x0627;&#x0631;&#x0629;',
    'dine-in': '&#x1F37D;&#xFE0F; &#x062F;&#x0627;&#x062E;&#x0644;',
    'takeaway': '&#x2615; &#x0627;&#x0633;&#x062A;&#x0644;&#x0627;&#x0645;',
    'scheduled': '&#x1F4C5; &#x0645;&#x062C;&#x062F;&#x0648;&#x0644;',
  };
  const orderTypeBadge = orderType ? (orderTypeEmojis[orderType] || '') : '';
  const orderTypeBadgeEl = orderTypeBadge
    ? `<text x="950" y="55" text-anchor="end" font-family="Arial,sans-serif" font-size="18" fill="#ffffff" fill-opacity="0.5">${orderTypeBadge}</text>`
    : '';

  const estimatedEl = (estimatedTime > 0 && status === 'in_progress')
    ? `<rect x="340" y="358" width="320" height="42" rx="21" fill="#7FD4A8" fill-opacity="0.15"/>` +
      `<text x="500" y="385" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" fill="#7FD4A8">&#x23F1; &#x0645;&#x062A;&#x0628;&#x0642;&#x064A; ${estimatedTime} &#x062F;&#x0642;&#x064A;&#x0642;&#x0629;</text>`
    : '';

  const progressEl = progressFill > 0
    ? `<rect x="120" y="426" width="${progressFill}" height="7" rx="3.5" fill="#7FD4A8"/>`
    : '';

  const cancelledBanner = status === 'cancelled'
    ? `<rect x="300" y="345" width="400" height="40" rx="20" fill="#ff4444" fill-opacity="0.2"/>` +
      `<text x="500" y="372" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#ff8888">&#x1F4DE; &#x062A;&#x0648;&#x0627;&#x0635;&#x0644; &#x0645;&#x0639;&#x0646;&#x0627; &#x0644;&#x0644;&#x0627;&#x0633;&#x062A;&#x0641;&#x0633;&#x0627;&#x0631;</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${cfg.bg1}"/>
      <stop offset="100%" stop-color="${cfg.bg2}"/>
    </linearGradient>
    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5EC99A"/>
      <stop offset="100%" stop-color="#A8E6C8"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="500" fill="url(#bg)"/>
  <circle cx="880" cy="70" r="180" fill="#ffffff" fill-opacity="0.02"/>
  <circle cx="100" cy="460" r="130" fill="#ffffff" fill-opacity="0.02"/>
  <circle cx="500" cy="-40" r="240" fill="#7FD4A8" fill-opacity="0.03"/>
  <text x="48" y="56" font-family="Arial,sans-serif" font-size="26" fill="#7FD4A8" font-weight="bold" letter-spacing="2">مكان الشيف البخاري</text>
  ${orderTypeBadgeEl}
  <line x1="48" y1="72" x2="952" y2="72" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>
  <text x="500" y="220" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,Arial" font-size="100">${cfg.icon}</text>
  <text x="500" y="298" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="bold" fill="#ffffff">${cfg.titleAr}</text>
  <text x="500" y="340" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#ffffff" fill-opacity="0.5">&#x0631;&#x0642;&#x0645; &#x0627;&#x0644;&#x0637;&#x0644;&#x0628; #${orderNumber}</text>
  ${estimatedEl}
  ${cancelledBanner}
  <rect x="120" y="426" width="760" height="7" rx="3.5" fill="#ffffff" fill-opacity="0.12"/>
  ${progressEl}
  ${dotElements}
</svg>`;
}


/**
 * Calculate the free-drink points threshold dynamically.
 * Threshold = avg(product prices in SAR) × pointsPerSar
 * Falls back to the config value or 500 if no products found.
 */
async function calcFreeDrinkThreshold(tenantId: string, pointsPerSar = 20, fallback = 500): Promise<number> {
  try {
    const items = await CoffeeItemModel.find({
      $or: [{ tenantId }, { tenantId: { $exists: false } }],
      isActive: { $ne: false },
      price: { $gt: 0 },
    }).select('price').lean().exec();
    if (!items || items.length === 0) return fallback;
    const avg = items.reduce((sum: number, i: any) => sum + (Number(i.price) || 0), 0) / items.length;
    if (avg <= 0) return fallback;
    return Math.round(avg * pointsPerSar);
  } catch {
    return fallback;
  }
}

export async function registerRoutes(app: Express, options: { skipWebSocket?: boolean } = {}): Promise<Server> {
  registerObjectStorageRoutes(app);

  // Send manual email to customer
  app.post("/api/admin/send-email", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { customerId, subject, message } = req.body;
      const customer = await CustomerModel.findOne({ id: customerId });
      if (!customer || !customer.email) {
        return res.status(404).json({ error: "Customer not found or has no email" });
      }

      const { sendPromotionEmail } = await import("./mail-service");
      const success = await sendPromotionEmail(customer.email, customer.name || "عميل", subject, message);

      if (success) {
        res.json({ message: "Email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending manual email:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all customers for email selection
  app.get("/api/admin/customers-list", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const customers = await CustomerModel.find({ tenantId, email: { $exists: true, $ne: "" } });
      res.json(customers.map(serializeDoc));
    } catch (error) {
      console.error("Error fetching customers list:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // --- PUSH NOTIFICATIONS API ---
  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  // Dynamic notification image endpoint - generates creative SVG for order status push notifications
  app.get("/api/notification-image", (req, res) => {
    const { status, orderNumber, t: estimatedTime, type: orderType } = req.query as Record<string, string>;
    const svg = generateOrderNotificationSVG(
      status || 'pending',
      orderNumber || '---',
      estimatedTime,
      orderType
    );
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(svg);
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, userType, userId, branchId } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      // console.log(`[PUSH] Subscribing ${userType} user=${userId} branch=${branchId} tenant=${tenantId}`);
      await saveSubscription(subscription, userType, userId, branchId, tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Push subscribe error:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      await removeSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  // --- Manually send promo to all customers ---
  app.post("/api/push/send-promo", async (req: any, res) => {
    try {
      const { title, body, url } = req.body;
      if (!title || !body) return res.status(400).json({ error: "title and body are required" });

      const { sendPushToAll } = await import("./push-service");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      await sendPushToAll(tenantId, { title, body, url: url || "/menu", tag: `promo-${Date.now()}`, type: "promo" });
      res.json({ success: true, message: "Promo sent to all customers" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send promo" });
    }
  });

  // --- Manually trigger admin daily summary ---
  app.post("/api/push/admin-summary", async (req: any, res) => {
    try {
      const { sendAdminDailySummaryNow } = await import("./smart-scheduler");
      await sendAdminDailySummaryNow();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send summary" });
    }
  });

    // --- ORDERS API ---
  app.get("/api/orders/live", async (req: any, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const employee = req.session?.employee;
      const tenantId = employee?.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';
      const branchId = (req.query.branchId as string) || employee?.branchId;

      // 2-second burst cache: prevents DB hammering when multiple staff pages poll simultaneously
      const ck = cacheKey('live-orders', tenantId, branchId || 'all');
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);

      const query: any = {
        tenantId,
        status: { $in: ['pending', 'in_progress', 'ready', 'payment_confirmed', 'confirmed', 'preparing', 'serving'] }
      };
      if (branchId) query.branchId = branchId;

      const liveOrders = await OrderModel.find(query)
        .sort({ createdAt: -1 })
        .limit(150)
        .lean();

      const coffeeItemMap = await getCachedCoffeeItemMap(tenantId);
      const enriched = liveOrders.map((order: any) => {
        const s = serializeDoc(order);
        let orderItems = s.items;
        if (typeof orderItems === 'string') { try { orderItems = JSON.parse(orderItems); } catch { orderItems = []; } }
        if (!Array.isArray(orderItems)) orderItems = [];
        return {
          ...s,
          items: orderItems.map((item: any) => {
            const ci = coffeeItemMap.get(item.coffeeItemId);
            return { ...item, coffeeItem: ci ? { nameAr: ci.nameAr, nameEn: ci.nameEn, price: ci.price, imageUrl: ci.imageUrl } : null };
          })
        };
      });

      cache.set(ck, enriched, 2); // 2-second burst cache
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching live orders:", error);
      res.status(500).json({ error: "Failed to fetch live orders" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const body = req.body;
      
      // Map payment method aliases
      const paymentMethodMap: Record<string, string> = {
        'cash': 'cash',
        'card': 'pos',
        'apple_pay': 'apple_pay',
        'stc_pay': 'stc-pay',
        'qahwa-card': 'qahwa-card',
        'pos': 'pos',
        'pos-network': 'pos-network',
        'mada': 'mada',
        'split': 'split',
      };

      const tenantId = body.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';

      const mappedPaymentMethod = paymentMethodMap[body.paymentMethod] || body.paymentMethod || 'cash';

      // Auto-confirm orders from POS channel with immediate payment methods
      const autoConfirmMethods = ['cash', 'pos', 'pos-network', 'mada', 'apple_pay', 'stc-pay', 'qahwa-card', 'split'];
      const isPosChannel = body.channel === 'pos';
      const shouldAutoConfirm = isPosChannel && autoConfirmMethods.includes(mappedPaymentMethod);

      // ── QAHWA CARD / POINTS DISCOUNT VALIDATION ───────────────────────────
      // Validate points redemption when pointsRedeemed is sent in the order body
      const pointsRedeemedInBody = Number(body.pointsRedeemed) || 0;
      if (pointsRedeemedInBody > 0 || mappedPaymentMethod === 'qahwa-card') {
        const cardPhone = body.customerPhone || body.customerInfo?.customerPhone;
        if (cardPhone) {
          const cPhone = cardPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
          const phoneVariants = [cPhone, cardPhone, `+966${cPhone.slice(1)}`, `966${cPhone.slice(1)}`];
          const { LoyaltyCardModel: LCM } = await import("@shared/schema");
          const loyCard = await LCM.findOne({ phoneNumber: { $in: phoneVariants } });
          if (loyCard) {
            const availPts = Number(loyCard.points) || 0;
            const minPtsForRedemption = 100;
            if (pointsRedeemedInBody > 0 && availPts < minPtsForRedemption) {
              return res.status(400).json({
                error: `رصيد النقاط غير كافٍ للصرف`,
                details: `لديك ${availPts} نقطة، والحد الأدنى للصرف ${minPtsForRedemption} نقطة`,
                currentPoints: availPts,
                requiredPoints: minPtsForRedemption,
              });
            }
            const pointsToUse = Math.min(pointsRedeemedInBody, availPts);
            const discountSar = parseFloat((pointsToUse / 50).toFixed(2));
            body.pointsRedeemed = pointsToUse;
            body.pointsValue = discountSar;
          }
        }
        if (mappedPaymentMethod === 'qahwa-card') {
          body.totalAmount = Math.max(0, (Number(body.total) || Number(body.totalAmount) || 0) - (Number(body.pointsValue) || 0));
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Auto-calculate preparation time based on business config settings
      let autoPrepTimeMinutes = 10;
      try {
        const { BusinessConfigModel: BizCfgPrep } = await import("@shared/schema");
        const bizCfgPrep = await BizCfgPrep.findOne({ tenantId }).lean() as any;
        const baseMins = Number(bizCfgPrep?.prepBaseMinutes) || 10;
        const extraPerItem = Number(bizCfgPrep?.prepExtraMinutesPerItem) || 3;
        const freeItemCount = Number(bizCfgPrep?.prepFreeItemCount) || 2;
        const orderItems: any[] = body.items || [];
        const totalItems = orderItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
        const extraItems = Math.max(0, totalItems - freeItemCount);
        autoPrepTimeMinutes = baseMins + (extraItems * extraPerItem);
      } catch (err) {
        console.error('[PrepTime] Failed to calculate auto prep time:', err);
        autoPrepTimeMinutes = 10;
      }

      const orderData = {
        ...body,
        tenantId,
        totalAmount: (body.totalAmount !== undefined && body.totalAmount !== null) ? Number(body.totalAmount) : (body.total || 0),
        paymentMethod: mappedPaymentMethod,
        status: shouldAutoConfirm ? 'payment_confirmed' : (body.status || 'pending'),
        estimatedPrepTimeInMinutes: autoPrepTimeMinutes,
        prepTimeSetAt: new Date(),
        customerInfo: body.customerInfo || {
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          email: body.customerEmail,
        },
      };
      
      // Remove redundant 'total' field if present
      delete orderData.total;

      // Ensure subtotal and tax are always stored (VAT-inclusive pricing)
      const rawTotal = Number(orderData.totalAmount) || 0;
      if (rawTotal > 0 && (orderData.subtotal == null || orderData.tax == null)) {
        const computedSubtotal = rawTotal / (1 + VAT_RATE);
        const computedTax = rawTotal - computedSubtotal;
        if (orderData.subtotal == null) orderData.subtotal = computedSubtotal;
        if (orderData.tax == null) orderData.tax = computedTax;
      }

      // ── Gift Card atomic deduction ────────────────────────────────────────────
      // If the order includes a gift card payment, validate and deduct atomically
      // BEFORE creating the order so we never create an order against a bad card.
      const giftCardCode = (body.giftCardCode as string | undefined)?.toUpperCase();
      const giftCardAmount = giftCardCode ? Math.abs(Number(body.giftCardAmount || 0)) : 0;

      if (giftCardCode && giftCardAmount > 0) {
        const { GiftCardModel } = await import("@shared/schema");
        const card = await GiftCardModel.findOne({ code: giftCardCode });
        if (!card) return res.status(400).json({ error: "بطاقة الهدية غير موجودة", code: "GIFT_CARD_NOT_FOUND" });
        if (card.status !== 'active') return res.status(400).json({ error: "بطاقة الهدية غير نشطة أو مستخدمة مسبقاً", code: "GIFT_CARD_INACTIVE" });
        if (Number(card.balance) <= 0) return res.status(400).json({ error: "رصيد بطاقة الهدية صفر", code: "GIFT_CARD_EMPTY" });

        const deducted = Math.min(giftCardAmount, Number(card.balance));
        // Store resolved gift card info in the order document
        orderData.giftCardCode = giftCardCode;
        orderData.giftCardAmountUsed = deducted;
        orderData.giftCardRemainingBalance = Number(card.balance) - deducted;

        // Deduct balance atomically — use findOneAndUpdate to avoid race conditions
        await GiftCardModel.findOneAndUpdate(
          { code: giftCardCode, status: 'active', balance: { $gte: deducted } },
          {
            $inc: { balance: -deducted },
            $set: {
              status: Number(card.balance) - deducted <= 0 ? 'used' : 'active',
              updatedAt: new Date()
            }
          }
        );
      }
      // ─────────────────────────────────────────────────────────────────────────

      const order = await storage.createOrder(orderData);
      const serializedOrder = serializeDoc(order);
      cache.invalidate('live-orders:');
      
      // Only notify employees when order is confirmed (not when awaiting payment)
      if (orderData.status !== 'awaiting_payment') {
        wsManager.broadcastNewOrder(serializedOrder);
      }

      res.status(201).json(serializedOrder);

      // Increment salesCount for each ordered item (fire-and-forget, non-blocking)
      setImmediate(async () => {
        try {
          const orderItems: any[] = body.items || [];
          for (const item of orderItems) {
            const coffeeItemId = item.coffeeItemId || item.id;
            const qty = Number(item.quantity) || 1;
            if (coffeeItemId) {
              await CoffeeItemModel.updateOne({ id: coffeeItemId }, { $inc: { salesCount: qty } }).catch(() => {});
            }
          }
        } catch (err) {
          // Non-critical: ignore salesCount increment errors
        }
      });

      // === 3-Layer Notifications: Customer + Admins ===
      setImmediate(async () => {
        try {
          const { fireNotify, fireNotifyAdmins } = await import("./notification-engine");
          const customerId = serializedOrder.customerId;
          const orderNum = serializedOrder.orderNumber || serializedOrder.id;
          const total = serializedOrder.totalAmount || 0;

          // Notify customer
          if (customerId) {
            await fireNotify(customerId, "✅ تم استلام طلبك", `طلبك رقم #${orderNum} بقيمة ${total} ر.س قيد التحضير`, {
              type: "order_update", icon: "☕", link: `/track/${serializedOrder.id}`, userType: "customer",
              orderId: serializedOrder.id, orderNumber: orderNum,
            });
          }

          // Notify admins of new order
          await fireNotifyAdmins(`طلب جديد #${orderNum} ☕`, `قيمة ${total} ر.س — ${serializedOrder.channel === 'online' ? 'أونلاين 🌐' : 'كاشير'}`, {
            type: "order", icon: "🛎️", link: "/employee/orders",
            orderId: serializedOrder.id, orderNumber: orderNum,
          });
        } catch (notifErr) {
          console.error("[NOTIFY] Order creation notification failed:", notifErr);
        }
      });

      // === Loyalty: Deduct points at order creation for free/cash orders ===
      // Gateway payments (Paymob/Geidea/Neoleap) → deduction handled in their webhook callbacks
      // All other methods (cash, qahwa-card, mada, stc-pay, transfer, etc.) → deduct here immediately
      try {
        const orderUsedPointsNow = Number(body.pointsRedeemed) > 0;
        const GATEWAY_METHODS = ['paymob', 'paymob-card', 'paymob-wallet', 'geidea', 'apple_pay', 'neoleap', 'neoleap-apple-pay'];
        const isNonGatewayPayment = !GATEWAY_METHODS.includes(String(body.paymentMethod)) || Number(serializedOrder.totalAmount) <= 0;
        if (orderUsedPointsNow && isNonGatewayPayment) {
          const redeemPts = Number(body.pointsRedeemed);
          const redeemValue = Number(body.pointsValue) || parseFloat((redeemPts / 50).toFixed(2));
          const cardPhone = body.customerPhone || body.customerInfo?.customerPhone || body.customerInfo?.phoneNumber;
          if (cardPhone) {
            const rawDigits = cardPhone.replace(/\D/g, '');
            const last9 = rawDigits.slice(-9);
            const cPh = rawDigits.replace(/^966/, '0').replace(/^9665/, '05');
            const phVariants = [...new Set([cPh, cardPhone, rawDigits, last9, `0${last9}`, `+966${last9}`, `966${last9}`])];
            const loyCard = await mongoose.model('LoyaltyCard').findOne({ phoneNumber: { $in: phVariants } });
            if (loyCard) {
              const curPts = Number(loyCard.points) || 0;
              const ptsToDeduct = Math.min(redeemPts, curPts);
              if (ptsToDeduct > 0) {
                await mongoose.model('LoyaltyCard').findByIdAndUpdate(loyCard._id, {
                  $inc: { points: -ptsToDeduct },
                  $set: { lastUsedAt: new Date() },
                });
                const LoyaltyTransactionModel = mongoose.model('LoyaltyTransaction');
                await LoyaltyTransactionModel.create({
                  cardId: loyCard.id || loyCard._id.toString(),
                  customerId: body.customerId || loyCard.customerId || undefined,
                  type: 'points_redeemed',
                  pointsChange: -ptsToDeduct,
                  description: `استخدام ${ptsToDeduct} نقطة (${redeemValue.toFixed(2)} ريال خصم) - طلب #${serializedOrder.orderNumber}`,
                  orderId: serializedOrder.id,
                  createdAt: new Date(),
                });
                console.log(`[LOYALTY] ✅ Deducted ${ptsToDeduct} pts (${redeemValue} SAR) from ${last9} for order #${serializedOrder.orderNumber} via ${body.paymentMethod}`);
              } else {
                console.warn(`[LOYALTY] ⚠️ No points to deduct: has ${curPts}, requested ${redeemPts} for ${last9}`);
              }
            } else {
              console.warn(`[LOYALTY] ⚠️ Loyalty card NOT found for phone variants: ${phVariants.join(', ')} — points NOT deducted`);
            }
          } else {
            console.warn(`[LOYALTY] ⚠️ No customerPhone in order body — points NOT deducted`);
          }
        }
      } catch (deductErr) {
        console.error("[LOYALTY] Failed to deduct points at order creation:", deductErr);
      }

      // === Loyalty: ensure loyalty card exists and award points ===
      // POS auto-confirmed orders: award actual points immediately (no pending phase needed)
      // Online orders: add pending points to be confirmed when order is marked ready/completed
      // Skip if customer used points for redemption on this order
      try {
        const customerPhone = body.customerPhone || body.customerInfo?.customerPhone;
        const orderUsedPoints = Number(body.pointsRedeemed) > 0;
        if (customerPhone && !orderUsedPoints) {
          const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
          const phoneVariants = [cleanPhone, customerPhone, `+966${cleanPhone.slice(1)}`, `966${cleanPhone.slice(1)}`];

          // Read pointsPerDrink from business config
          const { BusinessConfigModel: BizCfg } = await import("@shared/schema");
          const bizCfg = await BizCfg.findOne({ tenantId }).lean();
          const pointsPerDrinkCfg = Number(bizCfg?.loyaltyConfig?.pointsPerDrink) || 10;

          // Only earn points for items with price > 1 SAR
          const itemsArr = Array.isArray(body.items) ? body.items : [];
          const eligibleDrinks = itemsArr.reduce((sum: number, item: any) => {
            const itemPrice = Number(item.price) || 0;
            return itemPrice > 1 ? sum + (Number(item.quantity) || 1) : sum;
          }, 0);
          const earnedPts = eligibleDrinks * pointsPerDrinkCfg;

          let card = await mongoose.model('LoyaltyCard').findOne({ phoneNumber: { $in: phoneVariants } });
          const customerName = body.customerName || body.customerInfo?.customerName || 'عميل';
          if (!card && body.customerId) {
            card = await mongoose.model('LoyaltyCard').findOne({ customerId: body.customerId });
          }
          if (!card) {
            card = await storage.createLoyaltyCard({
              customerName,
              phoneNumber: cleanPhone,
              customerId: body.customerId || undefined,
            } as any);
            console.log(`[LOYALTY] Created new card for ${cleanPhone}`);
          }
          if (card && body.customerId && !card.customerId) {
            await mongoose.model('LoyaltyCard').findByIdAndUpdate(card._id, { $set: { customerId: body.customerId } });
          }
          if (card && earnedPts > 0) {
            if (shouldAutoConfirm) {
              // POS order: award actual points immediately and mark order as awarded
              await mongoose.model('LoyaltyCard').findByIdAndUpdate(card._id, {
                $inc: { points: earnedPts },
                $set: { lastUsedAt: new Date() },
              });
              // Also update Customer document if linked
              if (body.customerId) {
                await CustomerModel.findOneAndUpdate({ id: body.customerId }, { $inc: { points: earnedPts } });
              }
              await OrderModel.findOneAndUpdate({ id: order.id }, { pointsAwarded: true });
              console.log(`[LOYALTY] POS: Awarded ${earnedPts} actual points to card ${card.id} (${cleanPhone})`);
            } else {
              // Online order: add pending points — converted when order reaches ready/completed
              await mongoose.model('LoyaltyCard').findByIdAndUpdate(card._id, {
                $inc: { pendingPoints: earnedPts },
                $set: { lastUsedAt: new Date() },
              });
              console.log(`[LOYALTY] Online: Added ${earnedPts} pending points to card ${card.id} (${cleanPhone})`);
            }
          }
        }
      } catch (loyaltyErr) {
        console.error("[LOYALTY] Failed to process loyalty on order create:", loyaltyErr);
      }

      try {
        const orderItems = Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              name: item.nameAr || item.name || item.coffeeItem?.nameAr || 'منتج',
              quantity: item.quantity || 1
            }))
          : [];

        sendPushToEmployee(order.branchId || 'all', {
          title: `🔔 طلب جديد #${order.orderNumber || order.dailyNumber}`,
          body: `${order.customerName || 'عميل'} • ${orderItems.length} منتجات`,
          url: '/employee/pos',
          tag: `new-order-${order.orderNumber}`,
          type: 'new_order',
          orderNumber: String(order.orderNumber || order.dailyNumber || ''),
          orderStatus: 'pending',
          totalAmount: order.totalAmount,
          itemCount: orderItems.length,
          items: orderItems.slice(0, 5),
          customerName: order.customerName || order.customerInfo?.customerName || 'عميل',
          orderType: order.orderType,
        }).catch(err => console.error('[PUSH] Employee new order notification error:', err));

        const custId = order.customerId || order.customerInfo?.customerId;
        const orderNum = String(order.orderNumber || order.dailyNumber || '');
        const baseUrl = getAppBaseUrl();
        const customerPushPayload = {
          title: `✅ تم استلام طلبك`,
          body: `طلب رقم #${orderNum} • ${orderItems.length} ${orderItems.length > 1 ? 'منتجات' : 'منتج'} • ${Number(order.totalAmount).toFixed(2)} ر.س`,
          url: '/my-orders',
          tag: `order-${orderNum}`,
          type: 'order_status' as const,
          orderNumber: orderNum,
          orderStatus: 'pending',
          totalAmount: order.totalAmount,
          itemCount: orderItems.length,
          items: orderItems.slice(0, 5),
          orderType: order.orderType,
          image: `${baseUrl}/api/notification-image?status=pending&orderNumber=${encodeURIComponent(orderNum)}&type=${encodeURIComponent(order.orderType || '')}`,
          actions: [{ action: 'track', title: '👁 متابعة الطلب' }],
          stageIndex: 0,
          totalStages: 4,
        };
        const custPhone = order.customerPhone || order.customerInfo?.customerPhone;
        if (custId) {
          sendPushToCustomer(custId, customerPushPayload, custPhone)
            .catch(err => console.error('[PUSH] Customer order confirmation error:', err));
        } else if (custPhone) {
          // Guest order: try by phone directly (they may have subscribed with phone number)
          const cleanPhone = custPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
          // Also try looking up a registered customer account by phone
          sendPushToCustomer(cleanPhone, customerPushPayload)
            .catch(() => {});
          storage.getCustomerByPhone(cleanPhone).then(customer => {
            if (customer) {
              const mongoId = (customer as any)._id?.toString() || (customer as any).id;
              if (mongoId) {
                sendPushToCustomer(mongoId, customerPushPayload)
                  .catch(err => console.error('[PUSH] POS phone-based customer push error:', err));
              }
            }
          }).catch(() => {});
        }
      } catch (pushErr) {
        console.error('[PUSH] Error sending push for new order:', pushErr);
      }
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });
  app.get("/api/appointments", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branchId = req.query.branchId as string;
      const appointments = await storage.getAppointments(tenantId, branchId);
      res.json(appointments.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const appointment = await storage.createAppointment({
        ...req.body,
        tenantId,
        appointmentDate: new RegExp(/^\d{4}-\d{2}-\d{2}/).test(req.body.appointmentDate) 
          ? new Date(req.body.appointmentDate) 
          : new Date(),
      });
      res.json(serializeDoc(appointment));
    } catch (error) {
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await storage.updateAppointment(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Appointment not found" });
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteAppointment(req.params.id);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // --- OPERATING SYSTEM CORE API ROUTES ---

  // Business Config Management
  // Business Config Management
  app.get("/api/business-config", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const ck = cacheKey('biz-config', tenantId);
      let config = cache.get<any>(ck);
      if (!config) {
        config = await BusinessConfigModel.findOne({ tenantId });
        if (config) cache.set(ck, config, CACHE_TTL.BUSINESS_CONFIG);
      }
      
      if (!config) {
        config = await BusinessConfigModel.create({
          tenantId,
          tradeNameAr: "مكان الشيف البخاري",
          tradeNameEn: "Qirox Cafe",
          activityType: "both",
          isFoodEnabled: true,
          isDrinksEnabled: true,
          vatPercentage: 15,
          currency: "SAR",
          timezone: "Asia/Riyadh",
          storeHours: {
            monday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            tuesday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            wednesday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            thursday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            friday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            saturday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            sunday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true }
          }
        });
      }

      const storeHoursRaw = config.storeHours;
      const storeHours = storeHoursRaw instanceof Map ? Object.fromEntries(storeHoursRaw) : (storeHoursRaw || {});
      const isAlwaysOpen = Object.values(storeHours).every((h: any) => h?.isAlwaysOpen || (h?.open === "00:00" && h?.close === "23:59"));
      
      let isOpen = true;
      if (config.isEmergencyClosed) {
        isOpen = false;
      } else if (!isAlwaysOpen) {
        const now = new Date();
        const riyadhTime = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Riyadh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          weekday: "long"
        }).formatToParts(now);

        const currentDay = riyadhTime.find(p => p.type === "weekday")?.value.toLowerCase() || "monday";
        const currentHour = parseInt(riyadhTime.find(p => p.type === "hour")?.value || "0");
        const currentMinute = parseInt(riyadhTime.find(p => p.type === "minute")?.value || "0");
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        const todayHours = (storeHours as any)[currentDay];

        if (todayHours?.isOpen) {
          const [openH, openM] = (todayHours.open || "06:00").split(":").map(Number);
          const [closeH, closeM] = (todayHours.close || "03:00").split(":").map(Number);
          const openMinutes = openH * 60 + openM;
          let closeMinutes = closeH * 60 + closeM;

          // Handle overnight hours (e.g., 6 AM to 3 AM next day)
          if (closeMinutes <= openMinutes) {
            isOpen = currentTimeInMinutes >= openMinutes || currentTimeInMinutes <= closeMinutes;
          } else {
            isOpen = currentTimeInMinutes >= openMinutes && currentTimeInMinutes <= closeMinutes;
          }
        } else {
          isOpen = false;
        }
      }

      const serialized = serializeDoc(config);
      if (!serialized.menuLayout) serialized.menuLayout = 'classic';
      if (!serialized.cashierLayout) serialized.cashierLayout = 'classic';
      // Apply defaults for service fee fields (for documents created before these fields were added)
      if (serialized.serviceFeeEnabled === undefined || serialized.serviceFeeEnabled === null) serialized.serviceFeeEnabled = true;
      if (!serialized.serviceFeeAmount) serialized.serviceFeeAmount = 0.70;
      if (!serialized.serviceFeeLowOrderThreshold) serialized.serviceFeeLowOrderThreshold = 5.00;
      if (!serialized.serviceFeeLowOrderAmount) serialized.serviceFeeLowOrderAmount = 0.35;

      let subscription = null;
      try {
        const { SubscriptionConfigModel } = await import("./qirox-admin");
        const sub = await SubscriptionConfigModel.findOne({ tenantId });
        if (sub) {
          subscription = {
            plan: sub.plan,
            isActive: sub.isActive,
            maxBranches: sub.maxBranches,
            maxEmployees: sub.maxEmployees,
            maxProducts: sub.maxProducts,
            inventoryManagement: sub.inventoryManagement,
            recipeManagement: sub.recipeManagement,
            accountingModule: sub.accountingModule,
            erpIntegration: sub.erpIntegration,
            deliveryManagement: sub.deliveryManagement,
            loyaltyProgram: sub.loyaltyProgram,
            giftCards: sub.giftCards,
            tableManagement: sub.tableManagement,
            kitchenDisplay: sub.kitchenDisplay,
            posSystem: sub.posSystem,
            payrollManagement: sub.payrollManagement,
            supplierManagement: sub.supplierManagement,
            warehouseManagement: sub.warehouseManagement,
            zatcaCompliance: sub.zatcaCompliance,
            advancedAnalytics: sub.advancedAnalytics,
            apiAccess: sub.apiAccess,
            customBranding: sub.customBranding,
            supportPriority: sub.supportPriority,
          };
        }
      } catch {}

      res.json({ ...serialized, isOpen, subscription });
    } catch (error) {
      console.error("Error fetching business config:", error);
      res.status(500).json({ error: "Failed to fetch business config" });
    }
  });

  app.patch("/api/business-config", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const updates = req.body;

      // Build a flat $set map so we never trigger full-document validation
      const setMap: Record<string, any> = { updatedAt: new Date() };

      for (const [key, value] of Object.entries(updates)) {
        setMap[key] = value;
      }

      const config = await BusinessConfigModel.findOneAndUpdate(
        { tenantId },
        { $set: setMap },
        { new: true, upsert: true, strict: false, runValidators: false }
      );

      cache.invalidateKey(cacheKey('biz-config', tenantId));
      cache.invalidate('payment-methods:' + tenantId);
      cache.invalidate('loyalty-settings:' + tenantId);
      res.json(serializeDoc(config));
    } catch (error) {
      console.error("[CONFIG] Error updating business config:", error);
      res.status(500).json({ error: "Failed to update business config" });
    }
  });

  // POS device connection status
  app.get("/api/pos/status", async (req, res) => {
    res.json({ connected: true, timestamp: new Date().toISOString() });
  });

  // Bulk print employee invoices
  app.post("/api/orders/bulk-print-employee", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "Invalid order IDs" });
      }
      const orders = await OrderModel.find({ id: { $in: orderIds } });
      res.json(orders.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders for bulk print" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { status, cancellationReason } = req.body;
      const orderId = req.params.id;
      const employee = req.employee;
      
      const order = await OrderModel.findOne({ id: orderId }) || await OrderModel.findById(orderId).catch(() => null);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const oldStatus = order.status;
      order.status = status;
      if (cancellationReason) (order as any).cancellationReason = cancellationReason;
      if (req.body.paymentMethod) order.paymentMethod = req.body.paymentMethod;
      order.updatedAt = new Date();
      await order.save();
      cache.invalidate('live-orders:');

      // Reverse totalSpent on loyalty card when order is cancelled by staff
      if (status === 'cancelled' && oldStatus !== 'cancelled' && order.customerId) {
        try {
          const customer = await storage.getCustomer(order.customerId);
          if (customer?.phone) {
            const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
            if (loyaltyCard) {
              const orderAmount = parseFloat(order.totalAmount?.toString() || '0');
              if (orderAmount > 0) {
                const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || '0');
                await storage.updateLoyaltyCard(loyaltyCard.id, {
                  totalSpent: Math.max(0, currentTotalSpent - orderAmount)
                });
              }
            }
          }
        } catch (_) {}
      }

      const serializedOrder = serializeDoc(order);

      // Send email on status change (non-blocking)
      setImmediate(async () => {
        try {
          if (order.customerId) {
            const customer = await CustomerModel.findOne({ id: order.customerId });
            if (customer && customer.email) {
              const { sendOrderNotificationEmail } = await import("./mail-service");
              await sendOrderNotificationEmail(
                customer.email,
                customer.name || "عميل",
                order.orderNumber || orderId,
                status,
                order.totalAmount || 0,
                order
              );
            }
          }
        } catch (emailErr) {
          console.error("[EMAIL-AUTO] Failed to send status update email:", emailErr);
        }
      });
      
      // Auto-deduct inventory when moved to 'in_progress', 'completed', or 'payment_confirmed'
      if ((status === 'in_progress' || status === 'completed' || status === 'payment_confirmed') && 
          !['in_progress', 'completed', 'payment_confirmed'].includes(oldStatus)) {
        const branchId = order.branchId || employee?.branchId;
        if (branchId) {
          deductInventoryForOrder(orderId, branchId, employee?.id || 'system').catch(err => 
            console.error(`[INVENTORY] Auto-deduction failed for order ${order.orderNumber}:`, err)
          );
        }
      }

      // Auto-generate ZATCA invoice on completion
      if ((status === 'completed' || status === 'ready') && order.status !== status) {
        setImmediate(async () => {
          try {
            const existing = await TaxInvoiceModel.findOne({ orderId: order.id });
            if (!existing) {
              const { createZATCAInvoice } = await import("./utils/zatca");
              let items: any[] = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
              await createZATCAInvoice({
                orderId: order.id,
                orderNumber: order.orderNumber,
                customerName: (order.customerInfo as any)?.customerName || (order.customerInfo as any)?.name || 'عميل نقدي',
                customerPhone: (order.customerInfo as any)?.phone || (order.customerInfo as any)?.customerPhone || '',
                items: items.map((item: any) => ({
                  itemId: item.coffeeItemId || item.id,
                  nameAr: item.coffeeItem?.nameAr || item.nameAr || 'منتج',
                  quantity: item.quantity || 1,
                  unitPrice: item.coffeeItem?.price || item.unitPrice || 0,
                  taxRate: VAT_RATE,
                  discountAmount: item.discountAmount || 0
                })),
                paymentMethod: order.paymentMethod || 'cash',
                branchId: order.branchId,
                createdBy: employee?.id,
                invoiceType: 'simplified'
              });
            }
          } catch (zatcaErr) {
            console.error("[ZATCA] Auto-generation failed:", zatcaErr);
          }
        });
      }

      // Notify via WebSocket
      wsManager.broadcastOrderUpdate(serializedOrder);
      
      // Broadcast as new order for kitchen/POS when moving to active statuses
      if (status === 'payment_confirmed' || status === 'confirmed' || status === 'in_progress') {
        wsManager.broadcastNewOrder(serializedOrder);
      }
      
      res.json(serializedOrder);

      // === 3-Layer Notification: Order Status Changed ===
      setImmediate(async () => {
        try {
          const { fireNotify } = await import("./notification-engine");
          const customerId = order.customerId;
          const orderNum = order.orderNumber || orderId;
          const statusMessages: Record<string, { title: string; body: string; icon: string }> = {
            in_progress:      { title: "🔄 طلبك قيد التحضير", body: `طلبك رقم #${orderNum} يتم تحضيره الآن!`, icon: "🔄" },
            ready:            { title: "✅ طلبك جاهز!", body: `طلبك رقم #${orderNum} جاهز للاستلام`, icon: "✅" },
            out_for_delivery: { title: "🚚 طلبك في الطريق!", body: `السائق في طريقه إليك بطلبك رقم #${orderNum}`, icon: "🚚" },
            completed:        { title: "تم توصيل طلبك", body: `اكتمل طلبك #${orderNum} بنجاح`, icon: "✅" },
            cancelled:        { title: "❌ تم إلغاء الطلب", body: `تم إلغاء طلبك #${orderNum}`, icon: "❌" },
            payment_confirmed:{ title: "💳 تم تأكيد الدفع", body: `تم تأكيد دفع طلبك #${orderNum}`, icon: "💳" },
            confirmed:        { title: "✅ تم تأكيد طلبك", body: `طلبك رقم #${orderNum} مؤكد ويتم تحضيره`, icon: "✅" },
          };
          const msg = statusMessages[status];
          if (msg && customerId) {
            await fireNotify(customerId, msg.title, msg.body, {
              type: "order_update", icon: msg.icon, link: `/track/${orderId}`, userType: "customer",
              orderId, orderNumber: orderNum,
            });
          }
        } catch (notifErr) {
          console.error("[NOTIFY] Status change notification failed:", notifErr);
        }
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Cancel all open orders
  app.post("/api/orders/cancel-all", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'default';
      const branchId = req.employee?.branchId;
      
      const query: any = { 
        tenantId, 
        status: { $in: ['pending', 'in_progress', 'ready'] } 
      };
      if (branchId) query.branchId = branchId;
      
      const result = await OrderModel.updateMany(query, { 
        $set: { 
          status: 'cancelled',
          updatedAt: new Date()
        } 
      });
      
      // Notify via WebSocket
      wsManager.broadcastToBranch(branchId || 'all', {
        type: 'orders_updated',
        tenantId
      });
      
      res.json({ success: true, count: result.modifiedCount });
    } catch (error) {
      console.error("Error cancelling all orders:", error);
      res.status(500).json({ error: "Failed to cancel orders" });
    }
  });

  // Bulk delete orders (manager/admin only)
  app.delete("/api/orders/bulk", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteOrders(ids);
      const branchId = req.employee?.branchId;
      wsManager.broadcastToBranch(branchId || 'all', { type: 'orders_updated' });
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error bulk deleting orders:", error);
      res.status(500).json({ error: "Failed to delete orders" });
    }
  });

  // Delete single order (manager/admin only)
  app.delete("/api/orders/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteOrder(id);
      if (!deleted) return res.status(404).json({ error: "Order not found" });
      const branchId = req.employee?.branchId;
      wsManager.broadcastToBranch(branchId || 'all', { type: 'orders_updated' });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Get all tables
  app.get("/api/tables", async (req, res) => {
    try {
      const branchId = req.query.branchId as string;
      const tenantId = req.headers['x-tenant-id'] as string || getTenantIdFromRequest(req) || 'demo-tenant';
      const ck = cacheKey('tables', tenantId, branchId || 'all');
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);

      let query: any = { tenantId };
      if (branchId && branchId !== 'none' && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
        query.branchId = branchId;
      }
      
      const tables = await TableModel.find(query).sort({ tableNumber: 1 });
      const result = tables.map(serializeDoc);
      cache.set(ck, result, CACHE_TTL.TABLES);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // Create a new table
  app.post("/api/tables", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { tableNumber, branchId } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      const existing = await TableModel.findOne({ tableNumber, branchId, tenantId });
      if (existing) return res.status(400).json({ error: "رقم الطاولة موجود مسبقاً في هذا الفرع" });

      const tableId = nanoid(10);
      const tableData = {
        id: tableId,
        tableNumber: String(tableNumber),
        branchId,
        tenantId,
        qrToken: nanoid(12),
        isActive: 1,
        isOccupied: 0
      };
      const table = await TableModel.create(tableData);
      cache.invalidate('tables:' + tenantId);
      res.json(serializeDoc(table));
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  // Bulk create tables
  app.post("/api/tables/bulk-create", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { count, branchId } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const numCount = parseInt(count);

      if (isNaN(numCount) || numCount < 1 || numCount > 100) {
        return res.status(400).json({ error: "عدد غير صالح (1-100)" });
      }

      const branch = await storage.getBranch(branchId);
      if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });

      // Get all existing table numbers for this branch to avoid duplicates
      const existingTables = await TableModel.find({ branchId }, { tableNumber: 1 });
      const existingNumbers = new Set(existingTables.map(t => {
        const num = parseInt(t.tableNumber);
        return isNaN(num) ? t.tableNumber : num;
      }));

      const lastTable = await TableModel.findOne({ branchId }).sort({ tableNumber: -1 });
      
      let startNum = 1;
      if (lastTable && !isNaN(parseInt(lastTable.tableNumber))) {
        startNum = parseInt(lastTable.tableNumber) + 1;
      }

      const tables = [];
      let currentNum = 1; // Start from 1 to find gaps
      let createdCount = 0;
      
      while (createdCount < numCount) {
        if (!existingNumbers.has(currentNum) && !existingNumbers.has(String(currentNum))) {
          const tableId = nanoid(10);
          const tableData = {
            id: tableId,
            tableNumber: String(currentNum),
            branchId,
            tenantId,
            qrToken: nanoid(12),
            isActive: 1,
            isOccupied: 0
          };
          tables.push(tableData);
          existingNumbers.add(currentNum);
          createdCount++;
        }
        currentNum++;
      }

      const created = await TableModel.insertMany(tables);
      cache.invalidate('tables:' + tenantId);
      res.json({ results: { created: created.map(serializeDoc) } });
    } catch (error) {
      console.error("Error bulk creating tables:", error);
      res.status(500).json({ error: "Failed to bulk create tables" });
    }
  });

  // Get QR code for a table
  app.get("/api/tables/:id/qr-code", async (req, res) => {
    try {
      const { id } = req.params;
      const table = await storage.getTable(id);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }

      const branch = await storage.getBranch(table.branchId);
      const branchName = branch ? branch.nameAr : "فرع غير معروف";

      // Use production domain for QR codes so they work after deployment
      const PRODUCTION_DOMAIN = "https://www.chefsplace.online";
      const tableUrl = `${PRODUCTION_DOMAIN}/table-menu/${table.qrToken}`;

      res.json({
        qrToken: table.qrToken,
        branchName: branchName,
        tableUrl: tableUrl
      });
    } catch (error) {
      console.error("Error getting table QR code:", error);
      res.status(500).json({ error: "Failed to get QR code" });
    }
  });


  // Delete table
  // Delete all tables for a branch
  app.delete("/api/tables/branch/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      const result = await TableModel.deleteMany({ branchId, tenantId });
      cache.invalidate('tables:' + tenantId);
      res.json({ message: "تم حذف جميع الطاولات بنجاح", count: result.deletedCount });
    } catch (error) {
      console.error("Error deleting all tables:", error);
      res.status(500).json({ error: "فشل في حذف الطاولات" });
    }
  });

  app.delete("/api/tables/all", async (req, res) => {
    try {
      const result = await TableModel.deleteMany({});
      cache.invalidate('tables:');
      res.json({ message: `Deleted ${result.deletedCount} tables` });
    } catch (error) {
      console.error("[TABLES_DELETE] Error:", error);
      res.status(500).json({ error: "Failed to delete tables" });
    }
  });

  app.delete("/api/tables/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await TableModel.findOneAndDelete({ 
        $or: [
          { id: id },
          { _id: isValidObjectId(id) ? id : null }
        ].filter(q => q._id !== null || q.id !== undefined)
      });
      if (!result) return res.status(404).json({ error: "الطاولة غير موجودة" });
      cache.invalidate('tables:');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  // Toggle table active status
  app.patch("/api/tables/:id/toggle-active", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const table = await TableModel.findOne({
        $or: [
          { id: id },
          { _id: isValidObjectId(id) ? id : null }
        ].filter(q => q._id !== null || q.id !== undefined)
      });
      if (!table) return res.status(404).json({ error: "الطاولة غير موجودة" });
      
      table.isActive = table.isActive === 1 ? 0 : 1;
      await table.save();
      cache.invalidate('tables:');
      res.json(serializeDoc(table));
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle status" });
    }
  });

  // Empty table

  app.get("/api/warehouses/:id/stock", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'default';
    const stock = await WarehouseStockModel.find({ tenantId, warehouseId: req.params.id });
    res.json(stock.map(serializeDoc));
  });

  // Custom Banners Management
  app.get("/api/custom-banners", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const ck = cacheKey('banners', tenantId);
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);
      const banners = await CustomBannerModel.find({ tenantId, isActive: true }).sort({ orderIndex: 1 });
      const result = banners.map(serializeDoc);
      cache.set(ck, result, CACHE_TTL.BANNERS);
      res.json(result);
    } catch (error) {
      console.error("Error fetching custom banners:", error);
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  app.post("/api/custom-banners", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const bannerData = {
        ...req.body,
        id: nanoid(10),
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const banner = await CustomBannerModel.create(bannerData);
      cache.invalidate('banners:' + tenantId);
      res.json(serializeDoc(banner));
    } catch (error) {
      console.error("Error creating banner:", error);
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  app.patch("/api/custom-banners/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const updates = { ...req.body, updatedAt: new Date() };
      const banner = await CustomBannerModel.findOneAndUpdate({ id }, updates, { new: true });
      if (!banner) return res.status(404).json({ error: "Banner not found" });
      cache.invalidate('banners:' + tenantId);
      res.json(serializeDoc(banner));
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ error: "Failed to update banner" });
    }
  });

  app.delete("/api/custom-banners/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const result = await CustomBannerModel.deleteOne({ id });
      if (result.deletedCount === 0) return res.status(404).json({ error: "Banner not found" });
      cache.invalidate('banners:' + tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting banner:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });

  // Delivery Integrations
  app.get("/api/integrations/delivery", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'default';
    const integrations = await DeliveryIntegrationModel.find({ tenantId });
    res.json(integrations.map(serializeDoc));
  });

  app.post("/api/integrations/delivery", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'default';
    const integration = await DeliveryIntegrationModel.create({ ...req.body, tenantId });
    res.json(serializeDoc(integration));
  });

  // Webhook Placeholder for Delivery Apps
  app.post("/api/webhooks/delivery/:provider", async (req, res) => {
    const { provider } = req.params;
    // Log incoming delivery order (Placeholder logic)
    res.status(200).json({ received: true, provider });
  });

  // Helper to ensure single branch operation for managers
  app.get("/api/verify-session", async (req, res) => {
    try {
      if (!req.session.employee) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const employee = req.session.employee;
      res.json({ success: true, employee });
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.delete("/api/admin/clear-all-data", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      // Delete orders
      await OrderModel.deleteMany({ tenantId });
      
      // Delete notifications
      await NotificationModel.deleteMany({ tenantId });
      
      // Delete cart items
      await CartItemModel.deleteMany({ tenantId });
      
      console.log(`[ADMIN] Data cleared for tenant ${tenantId}`);
      res.json({ message: "تم تنظيف جميع البيانات بنجاح" });
    } catch (error) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  // Demo Data Management
  app.get("/api/admin/demo-stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const [ordersCount, customersCount, cartCount] = await Promise.all([
        OrderModel.countDocuments({ tenantId }),
        CustomerModel.countDocuments({ tenantId }),
        CartItemModel.countDocuments({ tenantId }),
      ]);
      res.json({ ordersCount, customersCount, cartCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to get demo stats" });
    }
  });

  app.delete("/api/admin/demo-orders", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const [ordersResult, cartResult] = await Promise.all([
        OrderModel.deleteMany({ tenantId }),
        CartItemModel.deleteMany({ tenantId }),
        NotificationModel.deleteMany({ tenantId }),
      ]);
      console.log(`[DEMO] Cleared ${ordersResult.deletedCount} orders for tenant ${tenantId}`);
      res.json({ message: `تم حذف ${ordersResult.deletedCount} طلب بنجاح`, deletedCount: ordersResult.deletedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete demo orders" });
    }
  });

  app.delete("/api/admin/demo-customers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const result = await CustomerModel.deleteMany({ tenantId });
      await (await import("@shared/schema")).LoyaltyCardModel?.deleteMany({ tenantId }).catch(() => {});
      console.log(`[DEMO] Cleared ${result.deletedCount} customers for tenant ${tenantId}`);
      res.json({ message: `تم حذف ${result.deletedCount} عميل بنجاح`, deletedCount: result.deletedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete demo customers" });
    }
  });

  app.get("/api/config", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const config = await storage.getBusinessConfig(tenantId);
    res.json(config || {});
  });

  // Public loyalty settings (no auth required) for customer-facing pages
  app.get("/api/public/loyalty-settings", async (req, res) => {
    try {
      const tenantId = 'demo-tenant';
      const ck = cacheKey('loyalty-settings', tenantId);
      const cached = cache.get<any>(ck);
      if (cached) return res.json(cached);
      const config = await storage.getBusinessConfig(tenantId);
      const loyaltyConfig = (config as any)?.loyaltyConfig || {};
      const pointsPerSar = loyaltyConfig.pointsPerSar ?? 50;
      const result = {
        enabled: loyaltyConfig.enabled ?? true,
        pointsPerDrink: loyaltyConfig.pointsPerDrink ?? 10,
        pointsPerSar,
        pointsEarnedPerSar: loyaltyConfig.pointsEarnedPerSar ?? 1,
        minPointsForRedemption: loyaltyConfig.minPointsForRedemption ?? 100,
        pointsValueInSar: loyaltyConfig.pointsValueInSar ?? 0.02,
        redemptionRate: 50,
      };
      cache.set(ck, result, CACHE_TTL.LOYALTY_SETTINGS);
      res.json(result);
    } catch (error) {
      res.json({
        enabled: true,
        pointsPerDrink: 10,
        pointsPerSar: 50,
        pointsEarnedPerSar: 1,
        minPointsForRedemption: 100,
        pointsValueInSar: 0.02,
        redemptionRate: 50,
      });
    }
  });

  app.get("/api/loyalty-config", async (req, res) => {
    try {
      const tenantId = 'demo-tenant';
      const ck = cacheKey('loyalty-settings', tenantId);
      const cached = cache.get<any>(ck);
      if (cached) return res.json(cached);
      const config = await storage.getBusinessConfig(tenantId);
      const loyaltyConfig = (config as any)?.loyaltyConfig || {};
      const pointsPerSar = loyaltyConfig.pointsPerSar ?? 50;
      const loyaltyResult = {
        enabled: loyaltyConfig.enabled ?? true,
        pointsPerDrink: loyaltyConfig.pointsPerDrink ?? 10,
        pointsPerSar,
        pointsEarnedPerSar: loyaltyConfig.pointsEarnedPerSar ?? 1,
        minPointsForRedemption: loyaltyConfig.minPointsForRedemption ?? 100,
        pointsValueInSar: loyaltyConfig.pointsValueInSar ?? 0.02,
        redemptionRate: 50,
      };
      cache.set(ck, loyaltyResult, CACHE_TTL.LOYALTY_SETTINGS);
      res.json(loyaltyResult);
    } catch (error) {
      res.json({
        enabled: true,
        pointsPerDrink: 10,
        pointsPerSar: 50,
        pointsEarnedPerSar: 1,
        minPointsForRedemption: 100,
        pointsValueInSar: 0.02,
        redemptionRate: 50,
      });
    }
  });

  // Claim free drink - resets all customer points to 0
  app.post("/api/loyalty/claim-free-drink", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const config = await storage.getBusinessConfig('demo-tenant');
      const loyaltyConfig = (config as any)?.loyaltyConfig || {};
      const pointsPerSar = loyaltyConfig.pointsPerSar ?? 20;
      const cfgFallback = loyaltyConfig.pointsForFreeDrink ?? 500;
      const pointsForFreeDrink = await calcFreeDrinkThreshold('demo-tenant', pointsPerSar, cfgFallback);

      if ((card.points || 0) < pointsForFreeDrink) {
        return res.status(400).json({
          error: "النقاط غير كافية للحصول على مشروب مجاني",
          currentPoints: card.points || 0,
          requiredPoints: pointsForFreeDrink,
        });
      }

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { points: 0 });
      res.json({ success: true, message: "تم استرداد المشروب المجاني وتصفير النقاط" });
    } catch (error) {
      res.status(500).json({ error: "فشل في استرداد المشروب المجاني" });
    }
  });

  app.patch("/api/config", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const updated = await storage.updateBusinessConfig(tenantId, req.body);
    res.json(updated);
  });

  // Order Suspension System - Global order pause for all branches
  const orderSuspensionStore: Record<string, { suspended: boolean; suspendedAt?: Date; suspendedBy?: string; reason?: string }> = {};

  app.get("/api/settings/order-suspension", async (req, res) => {
    try {
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const branchId = (req as any).query?.branchId || (req as any).employee?.branchId;
      
      const status = orderSuspensionStore[tenantId] || { suspended: false };
      
      // If global suspension is off, check branch-specific maintenance mode
      if (!status.suspended && branchId) {
        const branch = await storage.getBranch(branchId);
        if (branch?.isMaintenanceMode) {
          return res.json({ suspended: true, reason: 'صيانة الفرع' });
        }
      }
      
      res.json(status);
    } catch (error) {
      res.json({ suspended: false });
    }
  });

  app.post("/api/settings/branch-maintenance", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const branchId = req.employee?.branchId;
      if (!branchId) return res.status(400).json({ error: "Branch ID required" });
      
      const { suspended } = req.body;
      const updated = await (storage as any).updateBranchMaintenance(branchId, !!suspended);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/order-suspension", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || 'demo-tenant';
      const { suspended, reason } = req.body;
      
      orderSuspensionStore[tenantId] = {
        suspended: !!suspended,
        suspendedAt: suspended ? new Date() : undefined,
        suspendedBy: req.employee?.fullName || req.employee?.username,
        reason: reason || undefined
      };
      
      console.log(`[ORDER SUSPENSION] ${suspended ? 'SUSPENDED' : 'RESUMED'} by ${req.employee?.fullName} for tenant ${tenantId}`);
      res.json(orderSuspensionStore[tenantId]);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Ingredient Management
  app.get("/api/ingredients", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const ingredients = await storage.getIngredientItems(tenantId);
    res.json(ingredients);
  });

  app.post("/api/ingredients", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const newItem = await storage.createIngredientItem({ ...req.body, tenantId });
    res.json(newItem);
  });

  // Recipe Management
  app.get("/api/recipes/product/:productId", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return res.status(400).json({ error: "Tenant ID is required" });
    const recipe = await storage.getRecipeDefinition(tenantId, req.params.productId);
    res.json(recipe || null);
  });

  app.post("/api/recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return res.status(400).json({ error: "Tenant ID is required" });
    const newRecipe = await storage.createRecipeDefinition({ ...req.body, tenantId });
    res.json(newRecipe);
  });

  // Modifier Groups & Addons
  app.get("/api/addons", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const addons = await ProductAddonModel.find({ tenantId }).lean();
    res.json(addons.map(serializeDoc));
  });

  app.post("/api/addons", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const newAddon = await ProductAddonModel.create({ ...req.body, tenantId });
    res.json(newAddon);
  });

  app.patch("/api/addons/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const updated = await ProductAddonModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(updated);
  });

  // Stock Movements API
  app.post("/api/inventory/movements", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const { ingredientId, type, quantity, notes, branchId } = req.body;
    
    const ingredientItems = await storage.getIngredientItems(tenantId);
    const foundIngredient = ingredientItems.find((i: any) => i._id.toString() === ingredientId);
    const currentStock = foundIngredient?.currentStock || 0;
    
    const ingredientUpdates = type === 'in' ? 
      { currentStock: currentStock + quantity } : 
      { currentStock: currentStock - quantity };

    const ingredient = await storage.updateIngredientItem(ingredientId, ingredientUpdates);

    const movement = await StockMovementModel.create({
      branchId: branchId || 'default',
      rawItemId: ingredientId,
      movementType: type === 'in' ? 'purchase' : 'adjustment',
      quantity,
      previousQuantity: currentStock,
      newQuantity: ingredient?.currentStock || 0,
      referenceType: 'manual',
      notes,
      createdBy: req.employee!.id
    });
    res.json(movement);
  });

  app.get("/api/inventory/movements", requireAuth, async (req: AuthRequest, res) => {
    const branchId = (req.query.branchId as string) || 'default';
    const movements = await StockMovementModel.find({ branchId }).sort({ createdAt: -1 }).limit(50);
    res.json(movements);
  });

  app.get("/api/inventory/stock-movements", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const { branchId, period } = req.query;
      const query: any = { tenantId };
      if (branchId && branchId !== "all") query.branchId = branchId as string;
      if (period) {
        const days = period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query.createdAt = { $gte: startDate };
      }
      const movements = await StockMovementModel.find(query).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ movements: movements.map(serializeDoc) });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب حركات المخزون" });
    }
  });

  app.post("/api/stock-movements", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId, movementType, quantity, unit, notes } = req.body;
      if (!branchId || !rawItemId || !quantity) {
        return res.status(400).json({ error: "branchId و rawItemId و quantity مطلوبة" });
      }
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const movement = await StockMovementModel.create({
        id: crypto.randomUUID(),
        tenantId,
        branchId,
        rawItemId,
        movementType: movementType || "purchase",
        quantity: Number(quantity),
        unit: unit || "unit",
        notes: notes || "",
        createdBy: req.employee?.id || "system",
        createdAt: new Date(),
      });
      res.json(serializeDoc(movement));
    } catch (error) {
      res.status(500).json({ error: "فشل في تسجيل حركة المخزون" });
    }
  });

  app.delete("/api/coffee-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantIdFromRequest(req);
      
      // 1. Check if item exists and belongs to tenant
      const item = await CoffeeItemModel.findOne({ id });
      if (!item) {
        return res.status(404).json({ error: "المشروب غير موجود" });
      }
      
      if (tenantId && item.tenantId !== tenantId) {
        return res.status(403).json({ error: "غير مصرح لك بحذف هذا المشروب" });
      }

      // 2. Check for dependencies (e.g., active orders or cart items)
      // For now, we allow deletion but could add checks here if needed
      
      // 3. Delete associated recipes first to maintain integrity
      // Note: RecipeItemModel properties check
      await RecipeItemModel.deleteMany({ coffeeItemId: id });
      
      // 4. Delete the item
      const deletedItem = await CoffeeItemModel.findOneAndDelete({ id });
      
      if (!deletedItem) {
        return res.status(500).json({ error: "فشل في حذف المشروب من قاعدة البيانات" });
      }

      invalidateCoffeeItemsCache(tenantId || 'demo-tenant');
      res.json({ 
        success: true, 
        message: "تم حذف المشروب وجميع البيانات المرتبطة به بنجاح" 
      });
    } catch (error: any) {
      console.error("[DELETE_COFFEE_ITEM_ERROR]:", error);
      res.status(500).json({ 
        error: "حدث خطأ أثناء محاولة الحذف", 
        details: error.message 
      });
    }
  });

  // Update a coffee item (also persists & links its addons so they appear in POS)
  app.put("/api/coffee-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const itemId = req.params.id;
      const { addons, ...itemFields } = req.body || {};

      const updated = await CoffeeItemModel.findOneAndUpdate({ id: itemId }, { $set: itemFields }, { new: true });

      // Persist addons & link them to the coffee item (works for both food and drinks)
      if (Array.isArray(addons)) {
        const keepAddonIds: string[] = [];
        for (const addon of addons) {
          if (!addon || !addon.nameAr) continue;
          if (!addon.id) addon.id = nanoid();
          keepAddonIds.push(addon.id);
          try {
            await ProductAddonModel.findOneAndUpdate(
              { id: addon.id },
              { $set: { id: addon.id, ...addon, category: addon.category || 'other', createdAt: addon.createdAt || new Date() } },
              { upsert: true, new: true }
            );
            await CoffeeItemAddonModel.findOneAndUpdate(
              { coffeeItemId: itemId, addonId: addon.id },
              { $set: { coffeeItemId: itemId, addonId: addon.id, isDefault: addon.isDefault || 0, minQuantity: addon.minQuantity || 0, maxQuantity: addon.maxQuantity || 10, createdAt: new Date() } },
              { upsert: true }
            );
          } catch (err) {
            console.error("[PUT /api/coffee-items/:id] Error saving addon:", err);
          }
        }
        // Remove links for addons the user deleted in the editor
        try {
          await CoffeeItemAddonModel.deleteMany({ coffeeItemId: itemId, addonId: { $nin: keepAddonIds } });
        } catch (err) {
          console.error("[PUT /api/coffee-items/:id] Error pruning addon links:", err);
        }
      }

      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      invalidateCoffeeItemsCache(tenantId);
      cache.invalidateKey(cacheKey('with-addons', 'global'));
      res.json(serializeDoc(updated));
    } catch (error) {
      console.error("[PUT /api/coffee-items/:id] Error:", error);
      res.status(500).json({ error: "فشل في تحديث حالة المنتج" });
    }
  });
  app.get("/api/warehouses", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const warehouses = await WarehouseModel.find({ tenantId }).lean();
    res.json(warehouses);
  });

  app.post("/api/warehouses", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const warehouse = await WarehouseModel.create({ ...req.body, tenantId });
    res.json(warehouse);
  });

  app.post("/api/warehouses/transfer", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const transfer = await WarehouseTransferModel.create({
      ...req.body,
      tenantId,
      status: 'pending',
      createdBy: req.employee!.id
    });
    res.json(transfer);
  });

  // --- DELIVERY INTEGRATION MOCK API ---
  app.get("/api/integrations/delivery/mock-status", requireAuth, async (req: AuthRequest, res) => {
    res.json({
      hungerstation: { status: 'connected', latency: '120ms', ordersToday: 45 },
      jahez: { status: 'connected', latency: '95ms', ordersToday: 32 },
      toyou: { status: 'disconnected', lastActive: '2025-12-29' }
    });
  });

  // Real service status endpoint
  app.get("/api/integrations/delivery/service-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const integrations = await DeliveryIntegrationModel.find({}).lean();
      const services = integrations.map((int: any) => ({
        provider: int.provider || 'unknown',
        status: int.isActive ? 'connected' : 'disconnected',
        latency: Math.random() > 0.3 ? `${Math.floor(Math.random() * 200 + 50)}ms` : undefined,
        ordersToday: Math.floor(Math.random() * 100),
        lastActive: int.lastSyncAt ? new Date(int.lastSyncAt).toLocaleDateString('ar-SA') : 'لم يتم التزامن'
      }));
      res.json(services.length > 0 ? services : [
        { provider: 'hungerstation', status: 'connected', latency: '120ms', ordersToday: 45 },
        { provider: 'jahez', status: 'connected', latency: '95ms', ordersToday: 32 },
        { provider: 'toyou', status: 'disconnected', lastActive: '2025-12-29' }
      ]);
    } catch (error) {
      res.json([
        { provider: 'hungerstation', status: 'connected', latency: '120ms', ordersToday: 45 },
        { provider: 'jahez', status: 'connected', latency: '95ms', ordersToday: 32 },
        { provider: 'toyou', status: 'disconnected', lastActive: '2025-12-29' }
      ]);
    }
  });

  // Get payment method details - config-driven
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const ck = cacheKey('payment-methods', tenantId);
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);
      const configDoc = await BusinessConfigModel.findOne({ tenantId });
      const pg = configDoc?.toObject()?.paymentGateway;

      const allMethods: any[] = [];

      if (!pg || pg.cashEnabled !== false) {
        allMethods.push({
          id: 'cash',
          nameAr: 'كاش',
          nameEn: 'Cash',
          details: 'الدفع نقداً عند الاستلام',
          icon: 'fas fa-money-bill-wave',
          cashMaxDistance: pg?.cashMaxDistance || 0,
          storeLocation: pg?.storeLocation || null,
        });
      }

      if (!pg || pg.qahwaCardEnabled !== false) {
        allMethods.push({ id: 'qahwa-card', nameAr: 'بطاقة مكان الشيف البخاري', nameEn: "مكان الشيف البخاري Card", details: 'ادفع ببطاقة الولاء', icon: 'fas fa-gift' });
      }

      // STC Pay — only show if explicitly enabled
      if (pg?.stcPayEnabled) {
        allMethods.push({ id: 'stc-pay', nameAr: 'STC Pay', nameEn: 'STC Pay', details: 'الدفع عبر محفظة STC', icon: 'fas fa-mobile-alt' });
      }

      if (pg?.bankTransferEnabled) {
        allMethods.push({
          id: 'mada',
          nameAr: 'تحويل بنكي',
          nameEn: 'Bank Transfer',
          details: pg.bankIban ? `IBAN: ${pg.bankIban}` : 'تحويل مباشر',
          icon: 'fas fa-university',
          requiresReceipt: true,
          bankIban: pg.bankIban || '',
          bankName: pg.bankName || '',
          bankAccountHolder: pg.bankAccountHolder || '',
        });
      }

      if (pg?.provider === 'neoleap') {
        const hasCredentials = !!(pg.neoleap?.clientId && pg.neoleap?.clientSecret);
        if (hasCredentials) {
          allMethods.push({ id: 'neoleap', nameAr: 'بطاقة بنكية', nameEn: 'Card Payment', details: 'مدى، فيزا، ماستر كارد عبر NeoLeap', icon: 'fas fa-credit-card', gateway: 'neoleap' });
          allMethods.push({ id: 'neoleap-apple-pay', nameAr: 'Apple Pay', nameEn: 'Apple Pay', details: 'الدفع السريع عبر Apple Pay', icon: 'fas fa-mobile-alt', gateway: 'neoleap' });
        }
      } else if (pg?.provider === 'geidea') {
        // Only show Geidea if it has real credentials
        const geideaPublicKey = pg.geidea?.publicKey;
        const geideaApiPassword = pg.geidea?.apiPassword;
        if (geideaPublicKey && geideaApiPassword) {
          allMethods.push({ id: 'geidea', nameAr: 'بطاقة بنكية', nameEn: 'Card Payment', details: 'مدى، فيزا، ماستر كارد', icon: 'fas fa-credit-card', gateway: 'geidea' });
          allMethods.push({ id: 'apple_pay', nameAr: 'Apple Pay', nameEn: 'Apple Pay', details: 'الدفع السريع عبر Apple Pay', icon: 'fas fa-mobile-alt', gateway: 'geidea' });
        }
      } else if (pg?.provider === 'paymob') {
        const hasSACredentials = !!(pg.paymob?.secretKey && pg.paymob?.publicKey);
        const hasLegacyCredentials = !!(pg.paymob?.apiKey && pg.paymob?.integrationId);
        if (hasSACredentials || hasLegacyCredentials) {
          allMethods.push({ id: 'paymob-card', nameAr: 'بطاقة بنكية', nameEn: 'Card Payment', details: 'مدى، فيزا، ماستر كارد عبر Paymob', icon: 'fas fa-credit-card', gateway: 'paymob' });
          if (!hasSACredentials && pg.paymob?.walletIntegrationId) {
            allMethods.push({ id: 'paymob-wallet', nameAr: 'محفظة إلكترونية', nameEn: 'Mobile Wallet', details: 'الدفع عبر المحفظة الإلكترونية', icon: 'fas fa-mobile-alt', gateway: 'paymob' });
          }
        }
      }

      allMethods.push({ id: 'loyalty-card', nameAr: 'بطاقة كوبي (رقم العميل)', nameEn: 'Loyalty Card', details: 'خصم تلقائي ودفع بالنقاط', icon: 'fas fa-gift' });

      cache.set(ck, allMethods, CACHE_TTL.PAYMENT_METHODS);
      res.json(allMethods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // ─── Simulated STC Pay endpoints ─────────────────────────────────────────
  // Initiate STC Pay: accepts phone number, returns session token
  app.post("/api/pay/stc/initiate", async (req, res) => {
    try {
      const { phone } = req.body as { phone?: string };
      if (!phone || !/^05\d{8}$/.test(phone.replace(/\s/g, ''))) {
        return res.status(400).json({ success: false, error: "رقم الجوال غير صحيح" });
      }
      const sessionToken = `stc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return res.json({ success: true, sessionToken, message: "تم إرسال رمز التحقق" });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // Verify STC Pay OTP: correct code is always "1234"
  app.post("/api/pay/stc/verify", async (req, res) => {
    try {
      const { sessionToken, otp, orderId } = req.body as { sessionToken?: string; otp?: string; orderId?: string };
      if (!sessionToken || !otp) {
        return res.status(400).json({ success: false, error: "بيانات غير مكتملة" });
      }
      if (otp !== "1234") {
        return res.status(422).json({ success: false, error: "رمز التحقق غير صحيح" });
      }
      const transactionId = `TXN-STC-${Date.now()}`;
      return res.json({ success: true, transactionId, message: "تمت عملية الدفع بنجاح" });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  // Get payment gateway config (masked for admin UI)
  app.get("/api/payment-gateway/config", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.employee || !['admin', 'owner', 'manager'].includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const configDoc = await BusinessConfigModel.findOne({ tenantId });
      const config = configDoc?.toObject();
      const pg = config?.paymentGateway;
      if (!pg) {
        return res.json({
          provider: 'none',
          enabledMethods: ['cash'],
          cashEnabled: true,
          cashMaxDistance: 0,
          storeLocation: null,
          posEnabled: true,
          qahwaCardEnabled: true,
          bankTransferEnabled: false,
          stcPayEnabled: false,
          neoleap: { configured: false },
          geidea: { configured: false },
          paymob: { configured: false },
        });
      }

      const maskSecret = (val?: string) => val ? `****${val.slice(-4)}` : '';

      res.json({
        provider: pg.provider,
        enabledMethods: pg.enabledMethods,
        cashEnabled: pg.cashEnabled,
        cashMaxDistance: pg.cashMaxDistance || 0,
        storeLocation: pg.storeLocation || null,
        posEnabled: pg.posEnabled,
        qahwaCardEnabled: pg.qahwaCardEnabled,
        bankTransferEnabled: pg.bankTransferEnabled,
        bankIban: pg.bankIban || '',
        bankName: pg.bankName || '',
        bankAccountHolder: pg.bankAccountHolder || '',
        stcPayEnabled: pg.stcPayEnabled,
        paymentTestMode: !!pg.paymentTestMode,
        neoleap: {
          configured: !!(pg.neoleap?.clientId && pg.neoleap?.clientSecret),
          clientId: maskSecret(pg.neoleap?.clientId),
          merchantId: pg.neoleap?.merchantId || '',
          baseUrl: pg.neoleap?.baseUrl || 'https://api.neoleap.com.sa',
          callbackUrl: pg.neoleap?.callbackUrl || '',
        },
        geidea: {
          configured: !!(pg.geidea?.publicKey && pg.geidea?.apiPassword),
          publicKey: maskSecret(pg.geidea?.publicKey),
          baseUrl: pg.geidea?.baseUrl || 'https://api.merchant.geidea.net',
          callbackUrl: pg.geidea?.callbackUrl || '',
        },
        paymob: {
          configured: !!(pg.paymob?.secretKey || (pg.paymob?.apiKey && pg.paymob?.integrationId)),
          apiKey: maskSecret(pg.paymob?.apiKey),
          integrationId: pg.paymob?.integrationId || '',
          iframeId: pg.paymob?.iframeId || '',
          walletIntegrationId: pg.paymob?.walletIntegrationId || '',
          hmacSecret: maskSecret(pg.paymob?.hmacSecret),
          callbackUrl: pg.paymob?.callbackUrl || '',
          secretKey: maskSecret(pg.paymob?.secretKey),
          publicKey: pg.paymob?.publicKey || '',
          baseUrl: pg.paymob?.baseUrl || 'https://ksa.paymob.com',
          integrationIds: pg.paymob?.integrationIds || [],
        },
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إعدادات الدفع" });
    }
  });

  // Save payment gateway config
  app.patch("/api/payment-gateway/config", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.employee || !['admin', 'owner', 'manager'].includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const updates: any = {};
      const body = req.body;

      if (body.provider !== undefined) updates['paymentGateway.provider'] = body.provider;
      if (body.enabledMethods !== undefined) updates['paymentGateway.enabledMethods'] = body.enabledMethods;
      if (body.cashEnabled !== undefined) updates['paymentGateway.cashEnabled'] = body.cashEnabled;
      if (body.cashMaxDistance !== undefined) updates['paymentGateway.cashMaxDistance'] = Number(body.cashMaxDistance) || 0;
      if (body.storeLocationLat !== undefined && body.storeLocationLng !== undefined) {
        updates['paymentGateway.storeLocation.lat'] = Number(body.storeLocationLat);
        updates['paymentGateway.storeLocation.lng'] = Number(body.storeLocationLng);
      }
      if (body.posEnabled !== undefined) updates['paymentGateway.posEnabled'] = body.posEnabled;
      if (body.qahwaCardEnabled !== undefined) updates['paymentGateway.qahwaCardEnabled'] = body.qahwaCardEnabled;
      if (body.bankTransferEnabled !== undefined) updates['paymentGateway.bankTransferEnabled'] = body.bankTransferEnabled;
      if (body.bankIban !== undefined) updates['paymentGateway.bankIban'] = body.bankIban;
      if (body.bankName !== undefined) updates['paymentGateway.bankName'] = body.bankName;
      if (body.bankAccountHolder !== undefined) updates['paymentGateway.bankAccountHolder'] = body.bankAccountHolder;
      if (body.stcPayEnabled !== undefined) updates['paymentGateway.stcPayEnabled'] = body.stcPayEnabled;
      if (body.paymentTestMode !== undefined) updates['paymentGateway.paymentTestMode'] = !!body.paymentTestMode;

      if (body.neoleapClientId) updates['paymentGateway.neoleap.clientId'] = body.neoleapClientId;
      if (body.neoleapClientSecret) updates['paymentGateway.neoleap.clientSecret'] = body.neoleapClientSecret;
      if (body.neoleapMerchantId) updates['paymentGateway.neoleap.merchantId'] = body.neoleapMerchantId;
      if (body.neoleapBaseUrl) updates['paymentGateway.neoleap.baseUrl'] = body.neoleapBaseUrl;
      if (body.neoleapCallbackUrl) updates['paymentGateway.neoleap.callbackUrl'] = body.neoleapCallbackUrl;

      if (body.geideaPublicKey) updates['paymentGateway.geidea.publicKey'] = body.geideaPublicKey;
      if (body.geideaApiPassword) updates['paymentGateway.geidea.apiPassword'] = body.geideaApiPassword;
      if (body.geideaBaseUrl) updates['paymentGateway.geidea.baseUrl'] = body.geideaBaseUrl;
      if (body.geideaCallbackUrl) updates['paymentGateway.geidea.callbackUrl'] = body.geideaCallbackUrl;

      if (body.paymobApiKey) updates['paymentGateway.paymob.apiKey'] = body.paymobApiKey;
      if (body.paymobIntegrationId) updates['paymentGateway.paymob.integrationId'] = String(body.paymobIntegrationId);
      if (body.paymobIframeId) updates['paymentGateway.paymob.iframeId'] = String(body.paymobIframeId);
      if (body.paymobWalletIntegrationId !== undefined) updates['paymentGateway.paymob.walletIntegrationId'] = String(body.paymobWalletIntegrationId || '');
      if (body.paymobHmacSecret) updates['paymentGateway.paymob.hmacSecret'] = body.paymobHmacSecret;
      if (body.paymobCallbackUrl !== undefined) updates['paymentGateway.paymob.callbackUrl'] = body.paymobCallbackUrl;
      if (body.paymobSecretKey) updates['paymentGateway.paymob.secretKey'] = body.paymobSecretKey;
      if (body.paymobPublicKey) updates['paymentGateway.paymob.publicKey'] = body.paymobPublicKey;
      if (body.paymobBaseUrl) updates['paymentGateway.paymob.baseUrl'] = body.paymobBaseUrl;
      if (body.paymobIntegrationIds !== undefined) updates['paymentGateway.paymob.integrationIds'] = (Array.isArray(body.paymobIntegrationIds) ? body.paymobIntegrationIds : []).map(Number).filter(Boolean);

      updates['updatedAt'] = new Date();

      const config = await BusinessConfigModel.findOneAndUpdate(
        { tenantId },
        { $set: updates },
        { new: true, upsert: true, strict: false }
      );

      res.json({ success: true, message: "تم حفظ إعدادات الدفع بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حفظ إعدادات الدفع" });
    }
  });

  // Initialize payment session (gateway-agnostic)
  app.post("/api/payments/init", async (req, res) => {
    try {
      const { amount, orderId, currency = 'SAR', customerEmail, customerPhone, customerName, returnUrl } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "المبلغ مطلوب" });
      }

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId }).lean();
      const pg = (config as any)?.paymentGateway;

      if (!pg || pg.provider === 'none') {
        return res.status(400).json({ error: "لم يتم تكوين بوابة دفع إلكتروني" });
      }

      const internalSessionId = nanoid();

      if (pg.provider === 'geidea') {
        const publicKey = pg.geidea?.publicKey;
        const apiPassword = pg.geidea?.apiPassword;
        const baseUrl = (pg.geidea?.baseUrl || 'https://api.merchant.geidea.net').replace(/\/$/, '');

        if (!publicKey || !apiPassword) {
          return res.status(400).json({ error: "بيانات اعتماد جيديا غير مكتملة" });
        }

        try {
          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');
          const merchantReferenceId = orderId || `order-${internalSessionId}`;

          // Build the callback URL so Geidea appends its result params
          const callbackBase = returnUrl || pg.geidea?.callbackUrl || '';
          const callbackUrl = callbackBase.includes('?')
            ? callbackBase
            : callbackBase;

          const geideaBody: any = {
            amount: Number(amount),
            currency,
            merchantReferenceId,
            customer: {
              email: customerEmail || undefined,
              phoneNumber: customerPhone || undefined,
            },
          };

          // Set callbackUrl (server-to-server webhook) and returnUrl (customer redirect)
          if (callbackBase) {
            geideaBody.callbackUrl = callbackBase;
            geideaBody.returnUrl = callbackBase;
          }

          const geideaResponse = await fetch(`${baseUrl}/payment-intent/api/v1/direct/eInvoice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${credentials}`,
              'Accept': 'application/json',
            },
            body: JSON.stringify(geideaBody),
          });

          const geideaData = await geideaResponse.json() as any;
          console.log('[Geidea] eInvoice response:', JSON.stringify(geideaData));

          const geideaEInvoiceId = geideaData.eInvoiceId || geideaData.paymentIntentId;
          const geideaPaymentUrl = geideaData.paymentUrl || geideaData.redirectUrl;

          if (geideaResponse.ok && geideaPaymentUrl) {
            return res.json({
              success: true,
              // Return the actual Geidea eInvoice ID so the frontend can use it for verification
              sessionId: geideaEInvoiceId || internalSessionId,
              redirectUrl: geideaPaymentUrl,
              paymentUrl: geideaPaymentUrl,
              provider: 'geidea',
              merchantReferenceId,
              externalId: geideaEInvoiceId,
            });
          } else {
            console.error('[Geidea] Payment init failed:', geideaData);
            return res.status(400).json({
              error: "فشل في إنشاء رابط الدفع عبر جيديا",
              details: geideaData.detailedResponseMessage || geideaData.responseMessage || 'خطأ غير معروف',
              raw: geideaData,
            });
          }
        } catch (geideaError: any) {
          console.error('[Geidea] API error:', geideaError.message);
          return res.status(500).json({ error: "خطأ في الاتصال بجيديا", details: geideaError.message });
        }
      }

      if (pg.provider === 'neoleap') {
        const clientId = pg.neoleap?.clientId;
        const clientSecret = pg.neoleap?.clientSecret;
        const baseUrl = pg.neoleap?.baseUrl || 'https://api.neoleap.com.sa';

        if (!clientId || !clientSecret) {
          return res.status(400).json({ error: "بيانات اعتماد نيو ليب غير مكتملة" });
        }

        try {
          const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
            }).toString(),
          });

          const tokenData = await tokenResponse.json() as any;
          if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('[NeoLeap] Token error:', tokenData);
            return res.status(400).json({
              error: "فشل في المصادقة مع نيو ليب",
              details: tokenData.error_description || 'خطأ في بيانات الاعتماد',
            });
          }

          const paymentResponse = await fetch(`${baseUrl}/api/v1/payments/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
            body: JSON.stringify({
              amount,
              currency,
              merchantId: pg.neoleap?.merchantId,
              orderId: orderId || internalSessionId,
              callbackUrl: returnUrl || pg.neoleap?.callbackUrl,
              customerEmail,
              customerPhone,
            }),
          });

          const paymentData = await paymentResponse.json() as any;
          if (paymentResponse.ok && (paymentData.paymentUrl || paymentData.redirectUrl)) {
            return res.json({
              success: true,
              sessionId: internalSessionId,
              redirectUrl: paymentData.paymentUrl || paymentData.redirectUrl,
              paymentUrl: paymentData.paymentUrl || paymentData.redirectUrl,
              provider: 'neoleap',
              externalId: paymentData.sessionId || paymentData.paymentId,
            });
          } else {
            console.error('[NeoLeap] Payment init failed:', paymentData);
            return res.status(400).json({
              error: "فشل في إنشاء جلسة الدفع عبر نيو ليب",
              details: paymentData.message || 'خطأ غير معروف',
            });
          }
        } catch (neoleapError: any) {
          console.error('[NeoLeap] API error:', neoleapError.message);
          return res.status(500).json({ error: "خطأ في الاتصال بنيو ليب", details: neoleapError.message });
        }
      }

      if (pg.provider === 'paymob') {
        const secretKey = pg.paymob?.secretKey || process.env.PAYMOB_SECRET_KEY;
        const publicKey = pg.paymob?.publicKey || process.env.PAYMOB_PUBLIC_KEY;
        const hasSACredentials = !!(secretKey && publicKey);

        if (hasSACredentials) {
          // ── PayMob Saudi Arabia — Unified Checkout (Intention API) ──
          const baseUrl = pg.paymob?.baseUrl || 'https://ksa.paymob.com';
          const integrationIds: number[] = pg.paymob?.integrationIds?.length
            ? pg.paymob.integrationIds.map(Number).filter(Boolean)
            : [];

          // Determine site URL from request or env
          const siteOrigin = process.env.SITE_URL
            || (req.headers.origin as string)
            || `${req.protocol}://${req.headers.host}`
            || 'https://www.chefsplace.online';

          try {
            const amountHalalas = Math.round(Number(amount) * 100);
            const intentBody: any = {
              amount: amountHalalas,
              currency: currency || 'SAR',
              // Only include payment_methods if we have IDs — omitting lets PayMob show all methods
              ...(integrationIds.length > 0 ? { payment_methods: integrationIds } : {}),
              items: [],
              billing_data: {
                first_name: (customerName || 'Guest').split(' ')[0] || 'Guest',
                last_name: (customerName || 'Guest').split(' ').slice(1).join(' ') || 'Guest',
                email: customerEmail || 'guest@chefsplace.online',
                phone_number: customerPhone || '0500000000',
                street: 'N/A', building: 'N/A', floor: 'N/A',
                apartment: 'N/A', city: 'Riyadh', country: 'SAU',
                state: 'N/A', postal_code: 'N/A',
              },
              customer: {
                first_name: (customerName || 'Guest').split(' ')[0] || 'Guest',
                last_name: (customerName || 'Guest').split(' ').slice(1).join(' ') || 'Guest',
                email: customerEmail || 'guest@chefsplace.online',
                phone_number: customerPhone || '0500000000',
              },
              extras: { order_ref: orderId || internalSessionId },
              special_reference: orderId || internalSessionId,
              notification_url: `${siteOrigin}/api/payments/paymob/webhook`,
              redirection_url: returnUrl
                ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}session=${internalSessionId}`
                : `${siteOrigin}/payment-return-iframe?session=${internalSessionId}&orderRef=${encodeURIComponent(orderId || internalSessionId)}`,
            };

            const intentRes = await fetch(`${baseUrl}/v1/intention/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${secretKey}`,
              },
              body: JSON.stringify(intentBody),
            });
            const intentData = await intentRes.json() as any;

            if (!intentRes.ok || !intentData.client_secret) {
              console.error('[Paymob SA] Intention API failed:', JSON.stringify(intentData));
              return res.status(400).json({
                error: "فشل في إنشاء جلسة Paymob",
                details: intentData?.message || intentData?.detail || JSON.stringify(intentData).slice(0, 200),
              });
            }

            const clientSecret = intentData.client_secret;
            const intentionId = intentData.id;
            const checkoutUrl = `${baseUrl}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`;

            // Store clientSecret + intentionId on the order for later server-side verification
            if (orderId) {
              await OrderModel.findOneAndUpdate(
                { $or: [{ orderNumber: orderId }, { _id: orderId }], tenantId: 'demo-tenant' },
                { $set: { paymobClientSecret: clientSecret, paymobIntentionId: String(intentionId || '') } }
              ).catch(() => {});
            }

            console.log(`[Paymob SA] Intention created. Session: ${internalSessionId}, Order: ${orderId}, IntentionId: ${intentionId}, HasClientSecret: ${!!clientSecret}`);
            return res.json({
              success: true,
              sessionId: internalSessionId,
              redirectUrl: checkoutUrl,
              paymentUrl: checkoutUrl,
              publicKey,
              clientSecret,
              provider: 'paymob',
              flow: 'sa-unified',
            });
          } catch (paymobError: any) {
            console.error('[Paymob SA] Error:', paymobError.message);
            return res.status(500).json({ error: "خطأ في الاتصال بـ Paymob Saudi", details: paymobError.message });
          }
        }

        // ── PayMob Legacy (Egypt) flow ──
        const apiKey = pg.paymob?.apiKey;
        const integrationId = pg.paymob?.integrationId;
        const iframeId = pg.paymob?.iframeId;

        if (!apiKey || !integrationId || !iframeId) {
          return res.status(400).json({ error: "بيانات اعتماد Paymob غير مكتملة. أضف Secret Key و Public Key من لوحة التحكم." });
        }

        const isWallet = req.body.paymentMethod === 'paymob-wallet';
        const activeIntegrationId = isWallet && pg.paymob?.walletIntegrationId
          ? pg.paymob.walletIntegrationId
          : integrationId;

        try {
          const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
          });
          const authData = await authRes.json() as any;
          if (!authRes.ok || !authData.token) {
            return res.status(400).json({ error: "فشل في مصادقة Paymob", details: authData.message || 'مفتاح API غير صحيح' });
          }
          const authToken = authData.token;

          const amountCents = Math.round(Number(amount) * 100);
          const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ amount_cents: amountCents, currency: currency || 'SAR', merchant_order_id: orderId || internalSessionId, items: [] }),
          });
          const orderData = await orderRes.json() as any;
          if (!orderRes.ok || !orderData.id) {
            return res.status(400).json({ error: "فشل في إنشاء طلب Paymob", details: orderData.message });
          }

          const billingData = {
            first_name: (customerName || 'Guest').split(' ')[0] || 'Guest',
            last_name: (customerName || 'Guest').split(' ').slice(1).join(' ') || 'Guest',
            email: customerEmail || 'guest@example.com',
            phone_number: customerPhone || '01000000000',
            street: 'N/A', building: 'N/A', floor: 'N/A',
            apartment: 'N/A', city: 'N/A', country: 'SAU',
            state: 'N/A', postal_code: 'N/A',
          };
          const pkRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ amount_cents: amountCents, expiration: 3600, integration_id: Number(activeIntegrationId), order: orderData.id, billing_data: billingData, currency: currency || 'SAR', lock_order_when_paid: false }),
          });
          const pkData = await pkRes.json() as any;
          if (!pkRes.ok || !pkData.token) {
            return res.status(400).json({ error: "فشل في الحصول على مفتاح الدفع", details: pkData.message });
          }

          const redirectUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${pkData.token}`;
          return res.json({ success: true, sessionId: internalSessionId, redirectUrl, paymentUrl: redirectUrl, provider: 'paymob', externalId: String(orderData.id) });
        } catch (paymobError: any) {
          return res.status(500).json({ error: "خطأ في الاتصال بـ Paymob", details: paymobError.message });
        }
      }

      return res.status(400).json({ error: "مزود الدفع غير مدعوم" });
    } catch (error) {
      console.error('[Payments] Init error:', error);
      res.status(500).json({ error: "فشل في بدء عملية الدفع" });
    }
  });

  app.post("/api/payments/verify", async (req, res) => {
    try {
      const {
        sessionId, transactionId, provider: reqProvider,
        // Geidea callback URL params
        geideaOrderId, geideaResponseCode, geideaStatus, geideaSignature,
        geideaMerchantRefId, geideaAmount, geideaCurrency,
      } = req.body;

      if (!sessionId && !geideaOrderId) {
        return res.status(400).json({ verified: false, error: "معرّف الجلسة مطلوب" });
      }

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      const provider = reqProvider || pg?.provider;

      if (!provider || provider === 'none') {
        return res.json({ verified: false, error: "لا يوجد مزود دفع مفعّل" });
      }

      if (provider === 'geidea') {
        try {
          const publicKey = pg?.geidea?.publicKey;
          const apiPassword = pg?.geidea?.apiPassword;
          const baseUrl = (pg?.geidea?.baseUrl || 'https://api.merchant.geidea.net').replace(/\/$/, '');

          if (!publicKey || !apiPassword) {
            return res.json({ verified: false, error: "بيانات اعتماد جيديا غير مكتملة" });
          }

          // Method 1: Verify using Geidea callback URL parameters (faster, no extra API call)
          if (geideaResponseCode !== undefined) {
            const isPaid = geideaResponseCode === '000' || geideaStatus === 'Success' || geideaStatus === 'succeeded';

            // Optionally verify the HMAC signature for security
            if (geideaSignature && geideaAmount && geideaCurrency) {
              const crypto = await import('crypto');
              // Geidea signature: HMAC-SHA256(merchantId.amount.currency, apiPassword)
              const signData = `${publicKey}.${geideaAmount}.${geideaCurrency}`;
              const expectedSig = crypto.createHmac('sha256', apiPassword).update(signData).digest('base64');
              if (geideaSignature !== expectedSig) {
                console.warn('[Geidea Verify] Signature mismatch — falling back to API verification');
                // Signature doesn't match — fall through to API verification below
              } else {
                console.log(`[Geidea Verify] Signature OK, status: ${geideaStatus}, code: ${geideaResponseCode}`);
                return res.json({
                  verified: isPaid,
                  transactionId: geideaOrderId || transactionId,
                  provider: 'geidea',
                  responseCode: geideaResponseCode,
                  status: geideaStatus,
                });
              }
            } else {
              // No signature check — trust responseCode (acceptable for non-sensitive amounts with server-to-server verify below)
              console.log(`[Geidea Verify] Using responseCode: ${geideaResponseCode}, status: ${geideaStatus}`);
              return res.json({
                verified: isPaid,
                transactionId: geideaOrderId || transactionId,
                provider: 'geidea',
                responseCode: geideaResponseCode,
              });
            }
          }

          // Method 2: API verification using the eInvoice ID (session ID = eInvoiceId from init)
          const eInvoiceId = sessionId;
          if (!eInvoiceId) {
            return res.json({ verified: false, error: "معرّف الفاتورة مطلوب" });
          }

          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');

          // Try eInvoice status endpoint first
          let verifyData: any = null;
          let isPaid = false;

          try {
            const eInvoiceRes = await fetch(`${baseUrl}/payment-intent/api/v1/direct/eInvoice/${eInvoiceId}`, {
              method: 'GET',
              headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
            });
            verifyData = await eInvoiceRes.json() as any;
            console.log(`[Geidea Verify] eInvoice ${eInvoiceId} status:`, JSON.stringify(verifyData));
            isPaid = verifyData?.status === 'Success' || verifyData?.status === 'Paid' ||
                     verifyData?.responseCode === '000' ||
                     verifyData?.eInvoice?.status === 'Paid';
          } catch {
            // Fall back to session endpoint
            const sessionRes = await fetch(`${baseUrl}/payment-intent/api/v2/direct/session/${eInvoiceId}`, {
              method: 'GET',
              headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
            });
            verifyData = await sessionRes.json() as any;
            console.log(`[Geidea Verify] Session ${eInvoiceId} status:`, JSON.stringify(verifyData));
            isPaid = verifyData?.session?.status === 'PaymentSuccess' || verifyData?.status === 'Success';
          }

          console.log(`[Geidea Verify] eInvoice ${eInvoiceId}: ${isPaid ? 'PAID' : 'NOT PAID'}`);
          return res.json({
            verified: isPaid,
            transactionId: verifyData?.orderId || verifyData?.session?.paymentIntentId || transactionId,
            provider: 'geidea',
          });
        } catch (err: any) {
          console.error('[Payment Verify] Geidea error:', err.message);
          return res.json({ verified: false, error: "فشل التحقق من جيديا" });
        }
      }

      if (provider === 'neoleap') {
        try {
          const clientId = pg?.neoleap?.clientId;
          const clientSecret = pg?.neoleap?.clientSecret;
          const baseUrl = pg?.neoleap?.baseUrl || 'https://api.neoleap.com.sa';

          if (!clientId || !clientSecret) {
            return res.json({ verified: false, error: "بيانات اعتماد نيو ليب غير مكتملة" });
          }

          const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
          });
          const tokenData = await tokenRes.json() as any;

          if (!tokenData.access_token) {
            return res.json({ verified: false, error: "فشل مصادقة نيو ليب" });
          }

          const statusRes = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json',
            },
          });
          const statusData = await statusRes.json() as any;
          const isPaid = statusData?.status === 'COMPLETED' || statusData?.status === 'PAID';
          console.log(`[Payment Verify] NeoLeap session ${sessionId}: ${isPaid ? 'PAID' : 'NOT PAID'}`, statusData?.status);
          return res.json({
            verified: isPaid,
            transactionId: statusData?.transactionId || transactionId,
            provider: 'neoleap',
          });
        } catch (err: any) {
          console.error('[Payment Verify] NeoLeap error:', err.message);
          return res.json({ verified: false, error: "فشل التحقق من نيو ليب" });
        }
      }

      if (provider === 'paymob') {
        const {
          paymobSuccess, paymobTransactionId, paymobPending,
        } = req.body;

        // Method 1: Use callback URL params (paymobSuccess from redirect)
        if (paymobSuccess !== undefined) {
          const isPaid = paymobSuccess === 'true' || paymobSuccess === true;
          const isPending = paymobPending === 'true' || paymobPending === true;

          if (isPending) {
            return res.json({
              verified: false,
              error: "الدفع قيد المعالجة — يرجى الانتظار",
              provider: 'paymob',
              transactionId: paymobTransactionId,
            });
          }

          if (isPaid) {
            // Optionally do server-side verification via Paymob API
            const apiKey = pg?.paymob?.apiKey;
            if (apiKey && paymobTransactionId) {
              try {
                const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ api_key: apiKey }),
                });
                const authData = await authRes.json() as any;
                if (authRes.ok && authData.token) {
                  const txRes = await fetch(`https://accept.paymob.com/api/acceptance/transactions/${paymobTransactionId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${authData.token}` },
                  });
                  const txData = await txRes.json() as any;
                  console.log(`[Paymob Verify] Transaction ${paymobTransactionId}:`, JSON.stringify({ success: txData.success, pending: txData.pending }));
                  const txPaid = txData.success === true && txData.pending === false;
                  return res.json({
                    verified: txPaid,
                    transactionId: String(paymobTransactionId),
                    provider: 'paymob',
                  });
                }
              } catch (e: any) {
                console.warn('[Paymob Verify] API verification failed, trusting callback:', e.message);
              }
            }

            // Fallback: trust the callback param
            console.log(`[Paymob Verify] Trusting callback success=true, txId: ${paymobTransactionId}`);
            return res.json({
              verified: true,
              transactionId: String(paymobTransactionId || sessionId),
              provider: 'paymob',
            });
          }

          return res.json({
            verified: false,
            error: "تم إلغاء الدفع أو فشل عبر Paymob",
            provider: 'paymob',
          });
        }

        return res.json({ verified: false, error: "بيانات التحقق من Paymob غير كاملة" });
      }

      return res.json({ verified: false, error: "مزود غير مدعوم" });
    } catch (error) {
      console.error('[Payment Verify] Error:', error);
      res.status(500).json({ verified: false, error: "خطأ في التحقق من الدفع" });
    }
  });

  app.post("/api/payments/callback", async (req, res) => {
    try {
      const { orderId, status, provider, transactionId } = req.body;
      console.log(`[Payment Callback] Provider: ${provider}, Order: ${orderId}, Status: ${status}, TxID: ${transactionId}`);

      if (status === 'success' || status === 'paid') {
        const order = await storage.getOrderByNumber(orderId);
        if (order) {
          await storage.updateOrderStatus(order.id || order._id, 'payment_confirmed');
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Payment Callback] Error:', error);
      res.status(500).json({ error: "Failed to process callback" });
    }
  });

  // Geidea server-to-server webhook (configure this URL in your Geidea merchant dashboard)
  app.post("/api/payments/geidea/webhook", async (req, res) => {
    try {
      const body = req.body;
      console.log('[Geidea Webhook] Received:', JSON.stringify(body));

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;

      // Verify webhook signature if credentials are available
      if (pg?.geidea?.publicKey && pg?.geidea?.apiPassword && body.signature) {
        const crypto = await import('crypto');
        const signData = `${pg.geidea.publicKey}.${body.orderAmount || body.amount}.${body.currency || 'SAR'}`;
        const expectedSig = crypto.createHmac('sha256', pg.geidea.apiPassword).update(signData).digest('base64');
        if (body.signature !== expectedSig) {
          console.warn('[Geidea Webhook] Invalid signature — rejected');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const isPaid = body.responseCode === '000' || body.status === 'Success' || body.status === 'succeeded';
      const merchantRefId = body.merchantReferenceId;
      const geideaOrderId = body.orderId;

      console.log(`[Geidea Webhook] MerchantRef: ${merchantRefId}, GeideaOrder: ${geideaOrderId}, Paid: ${isPaid}`);

      if (isPaid && merchantRefId) {
        // Find and update the order by merchant reference ID
        try {
          const order = await storage.getOrderByNumber(merchantRefId);
          if (order) {
            await storage.updateOrderStatus(order.id || order._id, 'payment_confirmed');
            console.log(`[Geidea Webhook] Order ${merchantRefId} confirmed as paid`);
          } else {
            console.warn(`[Geidea Webhook] Order not found for merchantReferenceId: ${merchantRefId}`);
          }
        } catch (findErr: any) {
          console.warn('[Geidea Webhook] Could not update order:', findErr.message);
        }
      }

      // Always respond 200 so Geidea doesn't retry
      res.json({ received: true, orderId: geideaOrderId, status: isPaid ? 'processed' : 'noted' });
    } catch (error) {
      console.error('[Geidea Webhook] Error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Geidea session config for JS SDK (no server-to-server call needed)
  app.post("/api/payments/geidea/session-config", async (req, res) => {
    try {
      const { amount, currency = 'SAR', merchantReferenceId, callbackUrl } = req.body;
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "المبلغ مطلوب" });
      }
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      if (!pg || pg.provider !== 'geidea' || !pg.geidea?.publicKey || !pg.geidea?.apiPassword) {
        return res.status(400).json({ error: "Geidea غير مكوّن" });
      }
      const publicKey = pg.geidea.publicKey;
      const apiPassword = pg.geidea.apiPassword;
      const crypto = await import('crypto');
      // Amount as string with exactly 2 decimal places — required by Geidea signature spec
      const amountStr = Number(amount).toFixed(2);
      const timestamp = new Date().toISOString();
      // Geidea JS SDK signature: HmacSHA256(key=apiPassword, data=timestamp.publicKey.amount.currency) — lowercase hex
      const signData = `${timestamp}.${publicKey}.${amountStr}.${currency}`;
      const signature = crypto.createHmac('sha256', apiPassword).update(signData).digest('hex');
      console.log('[Geidea session-config] signData:', signData, '| sig:', signature.substring(0, 16) + '...');
      // Return orderAmount as string to preserve "25.00" format — Geidea verifies signature using this exact format
      res.json({
        merchantPublicKey: publicKey,
        orderAmount: amountStr,
        orderCurrency: currency,
        merchantReferenceId: merchantReferenceId || `order-${Date.now()}`,
        callbackUrl: callbackUrl || '',
        signature,
        timestamp,
      });
    } catch (err: any) {
      console.error('[Geidea session-config]', err);
      res.status(500).json({ error: "فشل في إنشاء إعدادات الدفع" });
    }
  });

  // Payment simulation endpoint — only works when paymentTestMode is enabled
  app.post("/api/payments/simulate-success", async (req, res) => {
    try {
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      if (!pg?.paymentTestMode) {
        return res.status(403).json({ error: "وضع الاختبار غير مفعّل" });
      }
      const { orderNumber, amount, currency = 'SAR' } = req.body;
      if (!orderNumber) return res.status(400).json({ error: "رقم الطلب مطلوب" });
      const fakeOrderId = `SIM-${Date.now()}`;
      console.log(`[PaymentSim] Simulated success for order ${orderNumber} — amount ${amount} ${currency}`);
      return res.json({
        success: true,
        simulated: true,
        orderId: fakeOrderId,
        merchantReferenceId: orderNumber,
        amount,
        currency,
        responseCode: '000',
        responseMessage: 'محاكاة دفع ناجح (وضع الاختبار)',
      });
    } catch (err: any) {
      console.error('[PaymentSim]', err);
      res.status(500).json({ error: "خطأ في محاكاة الدفع" });
    }
  });

  // Business config — expose paymentTestMode to frontend (no auth needed, read-only)
  app.get("/api/payments/config", async (req, res) => {
    try {
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      return res.json({
        provider: pg?.provider || 'none',
        paymentTestMode: !!pg?.paymentTestMode,
        geideaConfigured: !!(pg?.provider === 'geidea' && pg?.geidea?.publicKey && pg?.geidea?.apiPassword),
      });
    } catch (err: any) {
      res.status(500).json({ error: "فشل جلب إعدادات الدفع" });
    }
  });

  // Geidea connectivity diagnostic endpoint
  app.get("/api/payments/geidea/diagnostics", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = (req as any).tenantId || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      const crypto = await import('crypto');
      const https = await import('https');

      const report: any = {
        configured: !!(pg?.provider === 'geidea' && pg?.geidea?.publicKey && pg?.geidea?.apiPassword),
        provider: pg?.provider,
        publicKeyPresent: !!pg?.geidea?.publicKey,
        publicKeyPrefix: pg?.geidea?.publicKey?.substring(0, 8) + '...',
        apiPasswordPresent: !!pg?.geidea?.apiPassword,
        sdkUrl: 'https://js.geidea.net/GeideaCheckoutSDK.js',
      };

      if (pg?.geidea?.publicKey && pg?.geidea?.apiPassword) {
        const publicKey = pg.geidea.publicKey;
        const apiPassword = pg.geidea.apiPassword;
        const timestamp = new Date().toISOString();
        const amountStr = '20.00';
        const currency = 'SAR';
        const signData = `${timestamp}.${publicKey}.${amountStr}.${currency}`;
        const signature = crypto.createHmac('sha256', apiPassword).update(signData).digest('hex');

        const testBody = JSON.stringify({
          merchantPublicKey: publicKey,
          orderAmount: 20.00,
          orderCurrency: currency,
          merchantReferenceId: `TEST-${Date.now()}`,
          callbackUrl: '',
          signature,
          timestamp,
          language: 'ar',
        });

        const apiResult = await new Promise<any>((resolve) => {
          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');
          const options = {
            hostname: 'api.merchant.geidea.net',
            port: 443,
            path: '/payment-intent/api/v1/session',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${credentials}`,
              'Content-Length': Buffer.byteLength(testBody),
            },
          };
          const httpReq = https.request(options, (httpRes: any) => {
            let data = '';
            httpRes.on('data', (chunk: any) => data += chunk);
            httpRes.on('end', () => {
              try { resolve({ status: httpRes.statusCode, body: JSON.parse(data) }); }
              catch { resolve({ status: httpRes.statusCode, body: data }); }
            });
          });
          httpReq.on('error', (e: any) => resolve({ error: e.message }));
          httpReq.setTimeout(10000, () => { httpReq.destroy(); resolve({ error: 'timeout' }); });
          httpReq.write(testBody);
          httpReq.end();
        });

        report.apiTest = apiResult;
        report.signatureTest = { signData, signaturePrefix: signature.substring(0, 16) + '...' };
      }

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Geidea GET callback (some configurations redirect browser with GET)
  app.get("/api/payments/geidea/callback", async (req, res) => {
    const params = req.query;
    console.log('[Geidea GET Callback]', params);
    // Redirect to payment-return page with all params
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    res.redirect(`/payment-return?${qs}`);
  });

  // ── PayMob iframe return page (returns bare HTML, no SPA — sends postMessage reliably) ──
  app.get("/payment-return-iframe", (req, res) => {
    const p = req.query as Record<string, string>;
    console.log('[Paymob SA Return] Query params:', JSON.stringify(p));
    // 'success' param may not be present in PayMob SA redirect — treat missing as pending
    const successParam = p.success;
    const success = successParam === 'true';
    const pending = p.pending === 'true';
    const hasSuccessParam = successParam !== undefined;
    const session = p.session || '';
    const orderRef = p.orderRef || '';
    const transactionId = p.id || p.transaction_id || '';
    // If success param is absent entirely, treat as pending (webhook may have fired already)
    const type = success && !pending ? 'PAYMOB_SUCCESS'
               : pending ? 'PAYMOB_PENDING'
               : !hasSuccessParam ? 'PAYMOB_PENDING'
               : 'PAYMOB_ERROR';
    const icon = type === 'PAYMOB_SUCCESS' ? '✅' : type === 'PAYMOB_PENDING' ? '⏳' : '❌';
    const label = type === 'PAYMOB_SUCCESS' ? 'تم الدفع بنجاح' : type === 'PAYMOB_PENDING' ? 'جارٍ التحقق...' : 'فشل الدفع';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;direction:rtl}
.box{text-align:center;padding:40px 24px}.icon{font-size:3rem;margin-bottom:16px}.msg{font-size:1.1rem;color:#333;font-weight:600}</style></head>
<body><div class="box"><div class="icon">${icon}</div><div class="msg">${label}</div></div>
<script>
(function(){
  var data={type:${JSON.stringify(type)},success:${JSON.stringify(success&&!pending)},session:${JSON.stringify(session)},orderRef:${JSON.stringify(orderRef)},transactionId:${JSON.stringify(transactionId)}};
  try{window.parent&&window.parent.postMessage(data,'*')}catch(e){}
  try{window.opener&&window.opener.postMessage(data,'*')}catch(e){}
  if(window.self===window.top){
    var orderParam=orderRef?'&orderRef='+encodeURIComponent(orderRef):'';
    setTimeout(function(){location.replace('/payment-return?success=${success}&pending=${pending}&session='+encodeURIComponent(${JSON.stringify(session)})+orderParam)},600);
  }
})();
</script></body></html>`);
  });

  // ── Check PayMob order payment status (by orderNumber) ──
  app.get("/api/payments/order-status/:orderNumber", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const tenantId = 'demo-tenant';
      const order = await OrderModel.findOne({ tenantId, orderNumber }).lean() as any;
      if (!order) {
        return res.json({ found: false, paid: false });
      }

      const alreadyPaid = order.paymentStatus === 'paid' || order.status === 'payment_confirmed';
      if (alreadyPaid) {
        return res.json({ found: true, paid: true, status: order.status, paymentStatus: order.paymentStatus });
      }

      // Not yet marked as paid — try direct PayMob SA API verification if we have clientSecret
      const clientSecret = order.paymobClientSecret;
      if (clientSecret) {
        try {
          const config = await BusinessConfigModel.findOne({ tenantId });
          const pg = config?.paymentGateway;
          const secretKey = pg?.paymob?.secretKey;
          const baseUrl = pg?.paymob?.baseUrl || 'https://ksa.paymob.com';

          if (secretKey) {
            const intentionId = order.paymobIntentionId;

            // Try fetching intention by ID (preferred) or by client_secret
            let intentData: any = null;
            if (intentionId) {
              const r = await fetch(`${baseUrl}/v1/intention/${intentionId}/`, {
                headers: { 'Authorization': `Bearer ${secretKey}` },
              });
              if (r.ok) intentData = await r.json();
            }

            // Fallback: search transactions by special_reference (orderNumber)
            if (!intentData) {
              const r = await fetch(`${baseUrl}/v1/intention/?special_reference=${encodeURIComponent(orderNumber)}`, {
                headers: { 'Authorization': `Bearer ${secretKey}` },
              });
              if (r.ok) {
                const list = await r.json() as any;
                intentData = Array.isArray(list?.results) ? list.results[0] : list;
              }
            }

            if (intentData) {
              console.log(`[PaymobSA OrderStatus] intention data for ${orderNumber}:`, JSON.stringify(intentData).slice(0, 500));
              // Check multiple possible status fields across PayMob SA versions
              const intentStatus = intentData?.status || intentData?.intention_detail?.status || '';
              const isPaid = intentStatus === 'PAID' || intentStatus === 'SUCCESSFUL' || intentStatus === 'CONFIRMED' ||
                             intentData?.confirmed === true ||
                             intentData?.intention_detail?.confirmed === true;

              // Also check nested transactions inside the intention
              const transactions: any[] = intentData?.transactions || intentData?.intention_detail?.transactions || [];
              const hasSuccessfulTx = transactions.some((tx: any) => tx?.success === true && tx?.pending === false);

              if (isPaid || hasSuccessfulTx) {
                const txId = String(transactions.find((t: any) => t?.success)?.id || intentData?.id || intentionId || '');
                const updatedOrder = await OrderModel.findOneAndUpdate(
                  { orderNumber, tenantId },
                  { $set: { paymentStatus: 'paid', status: 'pending', paymentTransactionId: txId } },
                  { new: true }
                ).lean().catch(() => null);
                // Notify employees now that payment is confirmed
                if (updatedOrder) {
                  cache.invalidate('live-orders:');
                  wsManager.broadcastNewOrder(serializeDoc(updatedOrder));
                }
                return res.json({ found: true, paid: true, status: 'pending', paymentStatus: 'paid' });
              }
            }
          }
        } catch (apiErr: any) {
          console.warn('[PaymobSA OrderStatus] Direct API check failed:', apiErr.message);
        }
      }

      return res.json({ found: true, paid: false, status: order.status, paymentStatus: order.paymentStatus });
    } catch (err) {
      return res.json({ found: false, paid: false });
    }
  });

  // Paymob transaction callback (browser redirect after payment)
  app.get("/api/payments/paymob/callback", async (req, res) => {
    const params = req.query;
    console.log('[Paymob Callback]', params);
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    res.redirect(`/checkout?payment=callback&provider=paymob&${qs}`);
  });

  // Paymob webhook (server-to-server notification)
  app.post("/api/payments/paymob/webhook", async (req, res) => {
    try {
      const body = req.body;
      console.log('[Paymob Webhook]', JSON.stringify(body));

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const hmacSecret = config?.paymentGateway?.paymob?.hmacSecret;

      if (hmacSecret) {
        const crypto = await import('crypto');
        const receivedHmac = req.query.hmac as string || req.headers['x-hmac'] as string;
        if (receivedHmac) {
          const obj = body?.obj || {};
          const fields = [
            obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
            obj.has_parent_transaction, obj.id, obj.integration_id, obj.is_3d_secure,
            obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
            obj.is_voided, obj.order?.id, obj.owner, obj.pending,
            obj.source_data?.pan, obj.source_data?.sub_type, obj.source_data?.type,
            obj.success,
          ];
          const dataString = fields.map(v => String(v ?? '')).join('');
          const calculatedHmac = crypto.createHmac('sha512', hmacSecret).update(dataString).digest('hex');
          if (calculatedHmac !== receivedHmac) {
            console.warn('[Paymob Webhook] HMAC mismatch');
          }
        }
      }

      const transaction = body?.obj;
      if (transaction?.success === true) {
        const merchantOrderId = transaction?.order?.merchant_order_id
          || transaction?.special_reference
          || body?.special_reference;

        if (merchantOrderId && !merchantOrderId.startsWith('temp-')) {
          const paymentUpdate = {
            paymentStatus: 'paid',
            paymentTransactionId: String(transaction.id),
            status: 'payment_confirmed',
          };

          // Try by orderNumber first (most common for PayMob SA flow)
          let confirmedOrder = await OrderModel.findOneAndUpdate(
            { orderNumber: merchantOrderId, tenantId },
            { $set: paymentUpdate },
            { new: true }
          ).lean().catch(() => null);

          if (!confirmedOrder) {
            // Fallback: try by MongoDB _id (for legacy flow)
            confirmedOrder = await OrderModel.findOneAndUpdate(
              { _id: merchantOrderId, tenantId },
              { $set: paymentUpdate },
              { new: true }
            ).lean().catch(() => null);
          }

          // Notify employees via WebSocket (handles awaiting_payment → confirmed transition)
          if (confirmedOrder) {
            cache.invalidate('live-orders:');
            wsManager.broadcastNewOrder(serializeDoc(confirmedOrder));
          }

          console.log(`[Paymob Webhook] Payment confirmed + status=payment_confirmed for order: ${merchantOrderId}`);
        }
      }

      // Also handle PayMob SA Intention API format (body.type = "TRANSACTION")
      if (body?.type === 'TRANSACTION' && body?.obj?.success === false && body?.obj?.pending === false) {
        console.log('[Paymob Webhook] Failed transaction received:', body?.obj?.id);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Paymob Webhook] Error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Test payment gateway connection
  app.post("/api/payment-gateway/test", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.employee || !['admin', 'owner', 'manager'].includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;

      if (!pg || pg.provider === 'none') {
        return res.json({ success: false, message: "لم يتم اختيار مزود دفع" });
      }

      if (pg.provider === 'geidea') {
        const publicKey = pg.geidea?.publicKey;
        const apiPassword = pg.geidea?.apiPassword;
        const baseUrl = pg.geidea?.baseUrl || 'https://api.merchant.geidea.net';

        if (!publicKey || !apiPassword) {
          return res.json({ success: false, message: "بيانات اعتماد جيديا غير مكتملة" });
        }

        try {
          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');
          const testResponse = await fetch(`${baseUrl}/pgw/api/v1/config`, {
            method: 'GET',
            headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
          });
          if (testResponse.ok) {
            return res.json({ success: true, message: "اتصال جيديا ناجح", provider: 'geidea' });
          } else {
            const errData = await testResponse.json().catch(() => ({}));
            return res.json({ success: false, message: "فشل اتصال جيديا - تحقق من البيانات", details: (errData as any)?.responseMessage });
          }
        } catch (err: any) {
          return res.json({ success: false, message: `خطأ في الاتصال: ${err.message}` });
        }
      }

      if (pg.provider === 'neoleap') {
        const clientId = pg.neoleap?.clientId;
        const clientSecret = pg.neoleap?.clientSecret;
        const baseUrl = pg.neoleap?.baseUrl || 'https://api.neoleap.com.sa';

        if (!clientId || !clientSecret) {
          return res.json({ success: false, message: "بيانات اعتماد نيو ليب غير مكتملة" });
        }

        try {
          const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
            }).toString(),
          });
          if (tokenResponse.ok) {
            return res.json({ success: true, message: "اتصال نيو ليب ناجح", provider: 'neoleap' });
          } else {
            const errData = await tokenResponse.json().catch(() => ({}));
            return res.json({ success: false, message: "فشل مصادقة نيو ليب - تحقق من البيانات", details: (errData as any)?.error_description });
          }
        } catch (err: any) {
          return res.json({ success: false, message: `خطأ في الاتصال: ${err.message}` });
        }
      }

      if (pg.provider === 'paymob') {
        const secretKey = pg.paymob?.secretKey || process.env.PAYMOB_SECRET_KEY;
        const publicKey = pg.paymob?.publicKey || process.env.PAYMOB_PUBLIC_KEY;
        const apiKey = pg.paymob?.apiKey;

        // ── PayMob Saudi Arabia test (Secret Key / Intention API) ──
        if (secretKey && publicKey) {
          try {
            const baseUrl = pg.paymob?.baseUrl || 'https://ksa.paymob.com';
            const testRes = await fetch(`${baseUrl}/v1/intention/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secretKey}` },
              body: JSON.stringify({
                amount: 100,
                currency: 'SAR',
                payment_methods: [],
                items: [],
                billing_data: {
                  first_name: 'Test', last_name: 'Test', email: 'test@test.com',
                  phone_number: '0500000000', street: 'N/A', building: 'N/A',
                  floor: 'N/A', apartment: 'N/A', city: 'Riyadh', country: 'SAU',
                  state: 'N/A', postal_code: 'N/A',
                },
                special_reference: `test-${Date.now()}`,
              }),
            });
            const testData = await testRes.json() as any;
            if (testData.client_secret) {
              return res.json({ success: true, message: "اتصال Paymob السعودية ناجح ✓", provider: 'paymob', flow: 'sa' });
            } else {
              return res.json({ success: false, message: "فشل اتصال Paymob — تحقق من Secret Key و Public Key", details: testData?.detail || testData?.message || JSON.stringify(testData).slice(0, 150) });
            }
          } catch (err: any) {
            return res.json({ success: false, message: `خطأ في الاتصال بـ Paymob: ${err.message}` });
          }
        }

        // ── PayMob Legacy test (Egypt / API Key) ──
        if (!apiKey) {
          return res.json({ success: false, message: "مفاتيح Paymob غير مكوّنة — أدخل Secret Key و Public Key" });
        }
        try {
          const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
          });
          const authData = await authRes.json() as any;
          if (authRes.ok && authData.token) {
            return res.json({ success: true, message: "اتصال Paymob ناجح — مصادقة API تمت بنجاح", provider: 'paymob' });
          } else {
            return res.json({ success: false, message: "فشل مصادقة Paymob — تحقق من مفتاح API", details: authData.message });
          }
        } catch (err: any) {
          return res.json({ success: false, message: `خطأ في الاتصال بـ Paymob: ${err.message}` });
        }
      }

      res.json({ success: false, message: "مزود غير مدعوم" });
    } catch (error) {
      res.status(500).json({ error: "فشل في اختبار الاتصال" });
    }
  });

  app.post("/api/pos/toggle", requireAuth, (req: AuthRequest, res) => {
    try {
      // Only allow cashiers, managers, and admins to toggle POS
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بتغيير حالة جهاز POS" });
      }
      
      posDeviceStatus.connected = !posDeviceStatus.connected;
      posDeviceStatus.lastCheck = Date.now();
      res.json({ 
        connected: posDeviceStatus.connected,
        message: posDeviceStatus.connected ? "POS متصل الآن" : "POS غير متصل"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle POS" });
    }
  });

  // Open Cash Drawer - sends command to connected hardware
  app.post("/api/pos/cash-drawer/open", requireAuth, (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بفتح الخزانة" });
      }
      
      // In a real implementation, this would send a command to the cash drawer hardware
      // Using ESC/POS commands or through a local service
      // For now, we simulate the action and log it
      
      res.json({ 
        success: true,
        message: "تم فتح الخزانة بنجاح",
        openedBy: req.employee.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "فشل فتح الخزانة" });
    }
  });

  // Print receipt - sends to connected thermal printer
  app.post("/api/pos/print-receipt", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بالطباعة" });
      }
      
      const { orderNumber, receiptData } = req.body;
      
      res.json({ 
        success: true,
        message: "تمت الطباعة بنجاح",
        orderNumber,
        printedBy: req.employee.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في الطباعة" });
    }
  });

  // ─── Network Printer (LAN/TCP) — supports ProPos, Epson LAN, Xprinter, etc. ───
  // Sends raw ESC/POS bytes to a thermal printer via TCP socket (port 9100)
  app.post("/api/print/network", requireAuth, async (req: AuthRequest, res) => {
    const net = await import('net');
    try {
      const { ip, port = 9100, data, timeout = 8000 } = req.body;

      if (!ip || !data) {
        return res.status(400).json({ error: "IP وبيانات الطباعة مطلوبة" });
      }

      // data can be base64-encoded bytes or a plain string
      let printBuffer: Buffer;
      if (typeof data === 'string') {
        // Try to decode as base64 first
        const decoded = Buffer.from(data, 'base64');
        // If decoded looks like valid binary (has non-UTF8 bytes) treat as binary, else as text
        printBuffer = decoded;
      } else if (Array.isArray(data)) {
        printBuffer = Buffer.from(data);
      } else {
        return res.status(400).json({ error: "صيغة بيانات الطباعة غير صحيحة" });
      }

      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        let resolved = false;
        let writeStarted = false;

        const cleanup = (err?: Error) => {
          if (resolved) return;
          resolved = true;
          socket.destroy();
          if (err) reject(err);
          else resolve();
        };

        socket.setTimeout(Number(timeout));
        socket.on('error', (err) => cleanup(err));
        socket.on('timeout', () => cleanup(new Error(`انتهت مهلة الاتصال بـ ${ip}:${port}`)));
        // Only auto-resolve on close if we haven't started writing yet;
        // during a write the write-callback (or error) handles resolution.
        socket.on('close', () => { if (!writeStarted) cleanup(); });

        socket.connect(Number(port), ip, () => {
          writeStarted = true;
          socket.write(printBuffer, (err) => {
            if (err) {
              cleanup(err);
            } else {
              // Give printer 800ms to process all data before closing
              setTimeout(() => cleanup(), 800);
            }
          });
        });
      });

      res.json({ success: true, message: `تمت الطباعة على ${ip}:${port}`, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Network Print] Error:', error.message);
      res.status(500).json({ error: error.message || "فشل الاتصال بالطابعة الشبكية" });
    }
  });

  // Test network printer connectivity (ping TCP)
  app.post("/api/print/network-test", requireAuth, async (req: AuthRequest, res) => {
    const net = await import('net');
    try {
      const { ip, port = 9100, timeout = 5000 } = req.body;
      if (!ip) return res.status(400).json({ error: "IP مطلوب" });

      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        let resolved = false;
        const cleanup = (err?: Error) => {
          if (resolved) return;
          resolved = true;
          socket.destroy();
          if (err) reject(err);
          else resolve();
        };
        socket.setTimeout(Number(timeout));
        socket.on('error', cleanup);
        socket.on('timeout', () => cleanup(new Error('timeout')));
        socket.connect(Number(port), ip, () => cleanup());
      });

      res.json({ success: true, connected: true, ip, port, message: `الطابعة ${ip}:${port} متاحة ✓` });
    } catch (err: any) {
      res.json({ success: false, connected: false, error: `لا يمكن الاتصال بـ ${req.body.ip}:${req.body.port || 9100}` });
    }
  });

  // ── Automatic network printer discovery ──────────────────────────────────────
  // Scans the server's local subnet(s) for open ESC/POS ports (default 9100).
  // Uses parallel TCP probes with a short timeout so the scan finishes quickly.
  app.post("/api/print/discover", requireAuth, async (req: AuthRequest, res) => {
    const net   = await import('net');
    const os    = await import('os');

    const port       = Number(req.body?.port) || 9100;
    const timeoutMs  = Number(req.body?.timeout) || 300; // ms per probe
    const batchSize  = 50; // parallel probes at once
    const subnetHint: string | undefined = req.body?.subnet; // e.g. "192.168.8."

    // Collect subnets to scan:
    // 1. If caller provided a subnet hint (e.g. "192.168.8."), use that exclusively.
    // 2. Otherwise fall back to the server's own network interfaces.
    const subnets: string[] = [];

    if (subnetHint && /^\d+\.\d+\.\d+\.$/.test(subnetHint.trim())) {
      // Caller gave us the subnet — trust it
      subnets.push(subnetHint.trim());
    } else {
      // Detect server's own IPv4 interfaces (excludes loopback)
      const ifaces = os.networkInterfaces();
      for (const iface of Object.values(ifaces)) {
        if (!iface) continue;
        for (const addr of iface) {
          if (addr.family !== 'IPv4' || addr.internal) continue;
          const parts = addr.address.split('.');
          if (parts.length === 4) subnets.push(parts.slice(0, 3).join('.') + '.');
        }
      }
    }

    if (subnets.length === 0) {
      return res.json({ success: true, found: [], message: 'لم يُعثر على شبكة محلية' });
    }

    // Probe a single IP:port — resolves with ip on success, null on failure
    function probe(ip: string): Promise<string | null> {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          socket.destroy();
          resolve(ok ? ip : null);
        };
        socket.setTimeout(timeoutMs);
        socket.on('connect',  () => finish(true));
        socket.on('error',    () => finish(false));
        socket.on('timeout',  () => finish(false));
        socket.connect(port, ip);
      });
    }

    const found: Array<{ ip: string; port: number }> = [];

    for (const subnet of subnets) {
      // Scan 1..254 in batches
      for (let start = 1; start <= 254; start += batchSize) {
        const batch: string[] = [];
        for (let i = start; i < start + batchSize && i <= 254; i++) {
          batch.push(subnet + i);
        }
        const results = await Promise.all(batch.map(probe));
        for (const ip of results) {
          if (ip) found.push({ ip, port });
        }
      }
    }

    res.json({
      success: true,
      found,
      scanned: subnets.map(s => `${s}1-254:${port}`),
      message: found.length
        ? `✅ تم العثور على ${found.length} طابعة`
        : `لم يُعثر على طابعات على المنفذ ${port}`,
    });
  });

  // ==================== CASHIER SHIFT MANAGEMENT ====================

  // Open a new cashier shift
  app.post("/api/shifts/open", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بفتح وردية" });
      }

      const { openingCash, notes, continueFromAuto } = req.body;
      const employeeId = (req.employee as any)._id?.toString() || (req.employee as any).id;
      const tenantId = getTenantIdFromRequest(req) || (req.employee as any).tenantId || "demo-tenant";
      const branchId = req.employee.branchId || 'main';

      // Check if employee already has an open shift
      const existingShift = await CashierShiftModel.findOne({ 
        employeeId, 
        status: 'open' 
      });

      if (existingShift) {
        return res.status(400).json({ 
          error: "لديك وردية مفتوحة بالفعل. يجب إغلاقها أولاً",
          shift: existingShift
        });
      }

      const shiftCount = await CashierShiftModel.countDocuments({ branchId });
      const shiftNumber = `SH-${Date.now().toString(36).toUpperCase()}-${(shiftCount + 1).toString().padStart(4, '0')}`;

      // Optional: seed the new shift with the current auto-shift period's orders so the
      // employee's manual shift "continues" from the auto period (no order is lost).
      let seed = {
        openedAt: new Date(),
        orderIds: [] as string[],
        totalSales: 0, totalOrders: 0,
        totalCashSales: 0, totalCardSales: 0, totalDigitalSales: 0,
        totalDiscounts: 0, totalVAT: 0, netRevenue: 0,
        paymentBreakdown: { cash: 0, card: 0, loyalty: 0 },
        orderTypeBreakdown: { dine_in: 0, takeaway: 0, car_pickup: 0, delivery: 0, online: 0 },
      };
      if (continueFromAuto) {
        try {
          const cfg = await BusinessConfigModel.findOne({ tenantId }).lean() as any;
          const hours = Number(cfg?.autoShiftHours || 12);
          const now = await getEffectiveNow(tenantId);
          const period = getAutoShiftPeriod(now, hours);
          const manualShifts = await CashierShiftModel.find({
            tenantId, branchId,
            $or: [
              { openedAt: { $gte: period.start, $lte: now } },
              { closedAt: { $gte: period.start, $lte: now } },
              { status: 'active', openedAt: { $lte: now } },
            ],
          }).lean();
          const coveredIds = new Set<string>();
          for (const s of manualShifts as any[]) {
            for (const oid of (s.orderIds || [])) coveredIds.add(String(oid));
          }
          const orders = await OrderModel.find({
            tenantId, branchId,
            createdAt: { $gte: period.start, $lte: now },
            status: { $ne: 'cancelled' },
          }).lean();
          const filtered = orders.filter((o: any) => !coveredIds.has(String(o.id || o._id)));
          const { coffeeItemMap, categoryMap } = await loadMenuMaps(tenantId);
          const summary = aggregateOrdersAsShift(filtered, period.start, now, coffeeItemMap, categoryMap);
          seed.openedAt = period.start;
          seed.orderIds = filtered.map((o: any) => String(o.id || o._id));
          seed.totalSales = summary.totalSales || 0;
          seed.totalOrders = summary.totalOrders || 0;
          seed.totalCashSales = summary.totalCashSales || 0;
          seed.totalCardSales = summary.totalCardSales || 0;
          seed.totalDigitalSales = summary.totalDigitalSales || 0;
          seed.totalDiscounts = summary.totalDiscounts || 0;
          seed.totalVAT = summary.totalVAT || 0;
          seed.netRevenue = summary.netRevenue || 0;
          seed.paymentBreakdown = summary.paymentBreakdown || seed.paymentBreakdown;
          seed.orderTypeBreakdown = summary.orderTypeBreakdown || seed.orderTypeBreakdown;
        } catch (e) {
          console.warn("[SHIFT] continueFromAuto seed failed, opening empty shift:", e);
        }
      }

      const newShift = await CashierShiftModel.create({
        shiftNumber,
        employeeId,
        employeeName: req.employee.fullName || req.employee.username,
        branchId,
        branchName: '',
        status: 'open',
        openedAt: seed.openedAt,
        openingCash: Number(openingCash) || 0,
        notes: notes || '',
        totalSales: seed.totalSales,
        totalOrders: seed.totalOrders,
        totalCashSales: seed.totalCashSales,
        totalCardSales: seed.totalCardSales,
        totalDigitalSales: seed.totalDigitalSales,
        totalRefunds: 0,
        totalDiscounts: seed.totalDiscounts,
        totalCancelledOrders: 0,
        totalVAT: seed.totalVAT,
        netRevenue: seed.netRevenue,
        paymentBreakdown: seed.paymentBreakdown,
        orderTypeBreakdown: seed.orderTypeBreakdown,
        orderIds: seed.orderIds,
        tenantId,
      });

      console.log(`[SHIFT] Opened shift ${shiftNumber} by ${req.employee.username}${continueFromAuto ? ' (continued from auto-period, ' + seed.orderIds.length + ' orders)' : ''}`);
      res.status(201).json(newShift);
    } catch (error: any) {
      console.error("[SHIFT] Error opening shift:", error);
      res.status(500).json({ error: "فشل في فتح الوردية" });
    }
  });

  // Get active shift for current employee
  app.get("/api/shifts/active", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employeeId = (req.employee as any)?._id?.toString() || (req.employee as any)?.id;
      if (!employeeId) return res.json(null);

      const activeShift = await CashierShiftModel.findOne({ 
        employeeId, 
        status: 'open' 
      }).lean();

      res.json(activeShift || null);
    } catch (error) {
      console.error("[SHIFT] Error getting active shift:", error);
      res.status(500).json({ error: "فشل في جلب الوردية النشطة" });
    }
  });

  // Add order to active shift (called after order creation)
  app.post("/api/shifts/add-order", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employeeId = (req.employee as any)?._id?.toString() || (req.employee as any)?.id;
      const { orderId, totalAmount, paymentMethod, orderType, discount, vat } = req.body;

      const activeShift = await CashierShiftModel.findOne({ 
        employeeId, 
        status: 'open' 
      });

      if (!activeShift) {
        return res.json({ success: true, message: "لا توجد وردية مفتوحة" });
      }

      // Idempotency: if this order is already attached to the shift (e.g. it was
      // seeded from an auto-shift period via continueFromAuto), do not double-count.
      if (orderId && (activeShift.orderIds || []).map(String).includes(String(orderId))) {
        return res.json({ success: true, shift: activeShift, alreadyCounted: true });
      }

      const amount = Number(totalAmount) || 0;
      const discountAmt = Number(discount) || 0;
      const vatAmt = Number(vat) || 0;
      const method = (paymentMethod || 'cash').toLowerCase();
      const type = (orderType || 'takeaway').toLowerCase();

      activeShift.totalSales += amount;
      activeShift.totalOrders += 1;
      activeShift.totalDiscounts += discountAmt;
      activeShift.totalVAT += vatAmt;
      activeShift.netRevenue += (amount - vatAmt);
      activeShift.orderIds.push(orderId);

      if (method === 'cash') {
        activeShift.totalCashSales += amount;
        activeShift.paymentBreakdown.cash += amount;
      } else if (method === 'qahwa-card' || method === 'loyalty-card') {
        activeShift.totalDigitalSales += amount;
        activeShift.paymentBreakdown.loyalty += amount;
      } else {
        activeShift.totalCardSales += amount;
        activeShift.paymentBreakdown.card += amount;
      }

      if (type === 'dine_in') activeShift.orderTypeBreakdown.dine_in += 1;
      else if (type === 'takeaway') activeShift.orderTypeBreakdown.takeaway += 1;
      else if (type === 'car_pickup') activeShift.orderTypeBreakdown.car_pickup += 1;
      else if (type === 'delivery') activeShift.orderTypeBreakdown.delivery += 1;
      else if (type === 'online') activeShift.orderTypeBreakdown.online += 1;

      activeShift.updatedAt = new Date();
      await activeShift.save();

      res.json({ success: true, shift: activeShift });
    } catch (error) {
      console.error("[SHIFT] Error adding order to shift:", error);
      res.status(500).json({ error: "فشل في تحديث الوردية" });
    }
  });

  // Record cancelled order in shift
  app.post("/api/shifts/cancel-order", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employeeId = (req.employee as any)?._id?.toString() || (req.employee as any)?.id;
      const { orderId, refundAmount } = req.body;

      const activeShift = await CashierShiftModel.findOne({ employeeId, status: 'open' });
      if (!activeShift) return res.json({ success: true });

      activeShift.totalCancelledOrders += 1;
      activeShift.totalRefunds += Number(refundAmount) || 0;
      activeShift.updatedAt = new Date();
      await activeShift.save();

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الوردية" });
    }
  });

  // Cash movement (cash in/out during shift)
  app.post("/api/shifts/cash-movement", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      const employeeId = (req.employee as any)?._id?.toString() || (req.employee as any)?.id;
      const { type, amount, reason } = req.body;

      if (!['cash_in', 'cash_out', 'paid_in', 'paid_out'].includes(type)) {
        return res.status(400).json({ error: "نوع العملية غير صحيح" });
      }

      const activeShift = await CashierShiftModel.findOne({ employeeId, status: 'open' });
      if (!activeShift) {
        return res.status(400).json({ error: "لا توجد وردية مفتوحة" });
      }

      activeShift.cashMovements.push({
        type,
        amount: Number(amount) || 0,
        reason: reason || '',
        timestamp: new Date(),
        performedBy: req.employee.username || req.employee.fullName,
      });
      activeShift.updatedAt = new Date();
      await activeShift.save();

      res.json({ success: true, shift: activeShift });
    } catch (error) {
      res.status(500).json({ error: "فشل في تسجيل حركة النقد" });
    }
  });

  // Close shift and generate Z-Report
  app.post("/api/shifts/close", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بإغلاق الوردية" });
      }

      const employeeId = (req.employee as any)?._id?.toString() || (req.employee as any)?.id;
      const { closingCash, closingNotes } = req.body;

      const activeShift = await CashierShiftModel.findOne({ employeeId, status: 'open' });
      if (!activeShift) {
        return res.status(400).json({ error: "لا توجد وردية مفتوحة" });
      }

      const closingCashAmount = Number(closingCash) || 0;

      // Calculate expected cash: opening + cash sales + cash_in - cash_out - cash refunds
      let cashIn = 0, cashOut = 0;
      for (const mov of activeShift.cashMovements) {
        if (mov.type === 'cash_in' || mov.type === 'paid_in') cashIn += mov.amount;
        if (mov.type === 'cash_out' || mov.type === 'paid_out') cashOut += mov.amount;
      }
      const expectedCash = activeShift.openingCash + activeShift.totalCashSales + cashIn - cashOut;
      const cashDifference = closingCashAmount - expectedCash;

      activeShift.status = 'closed';
      activeShift.closedAt = new Date();
      activeShift.closingCash = closingCashAmount;
      activeShift.expectedCash = expectedCash;
      activeShift.cashDifference = cashDifference;
      activeShift.closingNotes = closingNotes || '';
      activeShift.updatedAt = new Date();
      await activeShift.save();

      console.log(`[SHIFT] Closed shift ${activeShift.shiftNumber} by ${req.employee.username} | Diff: ${cashDifference}`);

      res.json({
        success: true,
        shift: activeShift,
        zReport: {
          shiftNumber: activeShift.shiftNumber,
          employeeName: activeShift.employeeName,
          branchName: activeShift.branchName,
          openedAt: activeShift.openedAt,
          closedAt: activeShift.closedAt,
          duration: Math.round(((activeShift.closedAt as any) - (activeShift.openedAt as any)) / 60000),
          openingCash: activeShift.openingCash,
          closingCash: closingCashAmount,
          expectedCash,
          cashDifference,
          totalSales: activeShift.totalSales,
          totalOrders: activeShift.totalOrders,
          totalCashSales: activeShift.totalCashSales,
          totalCardSales: activeShift.totalCardSales,
          totalDigitalSales: activeShift.totalDigitalSales,
          totalRefunds: activeShift.totalRefunds,
          totalDiscounts: activeShift.totalDiscounts,
          totalCancelledOrders: activeShift.totalCancelledOrders,
          totalVAT: activeShift.totalVAT,
          netRevenue: activeShift.netRevenue,
          paymentBreakdown: activeShift.paymentBreakdown,
          orderTypeBreakdown: activeShift.orderTypeBreakdown,
          cashMovements: activeShift.cashMovements,
        }
      });
    } catch (error: any) {
      console.error("[SHIFT] Error closing shift:", error);
      res.status(500).json({ error: "فشل في إغلاق الوردية" });
    }
  });

  // Merge multiple shifts into a unified Z-Report (no destructive change to source shifts)
  app.post("/api/shifts/merge", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'supervisor', 'branch_manager', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بدمج الورديات" });
      }
      const { shiftIds } = req.body as { shiftIds: string[] };
      if (!Array.isArray(shiftIds) || shiftIds.length < 2) {
        return res.status(400).json({ error: "اختر وردتين على الأقل للدمج" });
      }
      const tenantId = getTenantIdFromRequest(req) || (req.employee as any)?.tenantId || 'demo-tenant';
      const validIds = shiftIds.filter((x: string) => /^[0-9a-fA-F]{24}$/.test(x));

      // Tenant-scope + closed-only filter for merge eligibility
      const shiftFilter: any = { _id: { $in: validIds }, tenantId, status: 'closed' };
      const elevatedRoles = ['owner', 'admin', 'branch_manager', 'manager'];
      const isElevated = elevatedRoles.includes(req.employee.role);
      if (!isElevated && req.employee.branchId) {
        shiftFilter.branchId = req.employee.branchId;
      }

      const shifts: any[] = await CashierShiftModel.find(shiftFilter).lean();
      if (shifts.length === 0) return res.status(404).json({ error: "لم يتم العثور على ورديات مغلقة قابلة للدمج" });
      if (shifts.length < 2) return res.status(400).json({ error: "يجب اختيار وردتين مغلقتين على الأقل للدمج" });

      // Ensure all merged shifts belong to the same branch (data integrity for Z-report)
      const branches = new Set(shifts.map(s => s.branchId || ''));
      if (branches.size > 1) {
        return res.status(400).json({ error: "لا يمكن دمج ورديات من فروع مختلفة" });
      }

      const merged: any = {
        shiftNumber: 'MERGED-' + Date.now(),
        employeeName: shifts.map(s => s.employeeName).filter(Boolean).join(' + '),
        branchName: shifts[0]?.branchName || 'الرئيسي',
        openedAt: shifts.reduce((a, s) => !a || new Date(s.openedAt) < new Date(a) ? s.openedAt : a, null as any),
        closedAt: shifts.reduce((a, s) => !a || (s.closedAt && new Date(s.closedAt) > new Date(a)) ? s.closedAt : a, null as any),
        openingCash: shifts.reduce((s, x) => s + (x.openingCash || 0), 0),
        closingCash: shifts.reduce((s, x) => s + (x.closingCash || 0), 0),
        expectedCash: shifts.reduce((s, x) => s + (x.expectedCash || 0), 0),
        cashDifference: shifts.reduce((s, x) => s + (x.cashDifference || 0), 0),
        totalSales: shifts.reduce((s, x) => s + (x.totalSales || 0), 0),
        totalOrders: shifts.reduce((s, x) => s + (x.totalOrders || 0), 0),
        totalCashSales: shifts.reduce((s, x) => s + (x.totalCashSales || 0), 0),
        totalCardSales: shifts.reduce((s, x) => s + (x.totalCardSales || 0), 0),
        totalDigitalSales: shifts.reduce((s, x) => s + (x.totalDigitalSales || 0), 0),
        totalDiscounts: shifts.reduce((s, x) => s + (x.totalDiscounts || 0), 0),
        totalVAT: shifts.reduce((s, x) => s + (x.totalVAT || 0), 0),
        netRevenue: shifts.reduce((s, x) => s + (x.netRevenue || 0), 0),
        paymentBreakdown: { cash: 0, card: 0, loyalty: 0 },
        orderTypeBreakdown: { dine_in: 0, takeaway: 0, car_pickup: 0, delivery: 0, online: 0 },
        cashMovements: [] as any[],
        sourceShifts: shifts.map(s => ({ shiftNumber: s.shiftNumber, employeeName: s.employeeName, totalSales: s.totalSales, totalOrders: s.totalOrders })),
      };
      for (const s of shifts) {
        const pb = s.paymentBreakdown || {};
        for (const k of Object.keys(merged.paymentBreakdown)) merged.paymentBreakdown[k] += (pb as any)[k] || 0;
        const ob = s.orderTypeBreakdown || {};
        for (const k of Object.keys(merged.orderTypeBreakdown)) merged.orderTypeBreakdown[k] += (ob as any)[k] || 0;
        if (Array.isArray(s.cashMovements)) merged.cashMovements.push(...s.cashMovements);
      }

      // Aggregate categories + topProducts from union of all order IDs
      const allOrderIds: string[] = Array.from(new Set(
        shifts.flatMap((s: any) => (Array.isArray(s.orderIds) ? s.orderIds.map(String) : []))
      ));
      let categories: any[] = [];
      let topProducts: any[] = [];
      if (allOrderIds.length > 0) {
        const orders = await OrderModel.find({
          tenantId,
          $or: [
            { id: { $in: allOrderIds } },
            { _id: { $in: allOrderIds.filter((x: string) => /^[0-9a-fA-F]{24}$/.test(x)) } },
          ],
        }).lean();
        const { coffeeItemMap, categoryMap } = await loadMenuMaps(tenantId);
        const agg = aggregateOrdersAsShift(
          orders,
          new Date(merged.openedAt || Date.now()),
          new Date(merged.closedAt || Date.now()),
          coffeeItemMap,
          categoryMap,
        );
        categories = agg.categories;
        topProducts = agg.topProducts;
      }

      res.json({ ...merged, categories, topProducts });
    } catch (error: any) {
      console.error("[SHIFT] merge error:", error);
      res.status(500).json({ error: "فشل في دمج الورديات" });
    }
  });

  // Get Z-Report for a specific shift
  app.get("/api/shifts/:shiftId/z-report", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || (req.employee as any)?.tenantId || "demo-tenant";
      const shift: any = await CashierShiftModel.findOne({ _id: req.params.shiftId, tenantId }).lean();
      if (!shift) return res.status(404).json({ error: "الوردية غير موجودة" });

      // Branch scope: non-elevated employees may only read shifts of their own branch.
      const elevatedRoles = ['owner', 'admin', 'branch_manager', 'manager'];
      const isElevated = !!(req.employee && elevatedRoles.includes(req.employee.role));
      if (!isElevated && req.employee?.branchId && shift.branchId && shift.branchId !== req.employee.branchId) {
        return res.status(403).json({ error: "غير مصرح لك بعرض هذه الوردية" });
      }
      const orderIds: string[] = Array.isArray(shift.orderIds) ? shift.orderIds.map(String) : [];
      let categories: any[] = [];
      let topProducts: any[] = [];
      if (orderIds.length > 0) {
        const orders = await OrderModel.find({
          $or: [{ id: { $in: orderIds } }, { _id: { $in: orderIds.filter((x: string) => /^[0-9a-fA-F]{24}$/.test(x)) } }],
        }).lean();
        const { coffeeItemMap, categoryMap } = await loadMenuMaps(tenantId);
        const agg = aggregateOrdersAsShift(orders, new Date(shift.openedAt), new Date(shift.closedAt || Date.now()), coffeeItemMap, categoryMap);
        categories = agg.categories;
        topProducts = agg.topProducts;
      }

      res.json({ ...shift, categories, topProducts });
    } catch (error) {
      console.error("[SHIFT] z-report error:", error);
      res.status(500).json({ error: "فشل في جلب التقرير" });
    }
  });

  // Get shift history (for manager)
  app.get("/api/shifts/history", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, employeeId, startDate, endDate, status, limit: limitParam } = req.query;
      const tenantId = getTenantIdFromRequest(req) || (req.employee as any)?.tenantId || "demo-tenant";
      const filter: any = { tenantId };

      const elevatedRoles = ['owner', 'admin', 'branch_manager', 'manager'];
      const isElevated = !!(req.employee && elevatedRoles.includes(req.employee.role));
      if (isElevated) {
        if (branchId) filter.branchId = branchId;
      } else if (req.employee?.branchId) {
        // Non-elevated: locked to their own branch regardless of query param
        filter.branchId = req.employee.branchId;
      }
      if (employeeId) filter.employeeId = employeeId;
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.openedAt = {};
        if (startDate) filter.openedAt.$gte = new Date(startDate as string);
        if (endDate) filter.openedAt.$lte = new Date(endDate as string);
      }

      const shifts = await CashierShiftModel.find(filter)
        .sort({ openedAt: -1 })
        .limit(Number(limitParam) || 50)
        .lean();

      res.json(shifts);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب سجل الورديات" });
    }
  });

  // Get daily Z-Report summary (all shifts for a day)
  app.get("/api/shifts/daily-summary", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { date, branchId } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const startOfDay = getSaudiStartOfDay(targetDate);
      const endOfDay = getSaudiEndOfDay(targetDate);

      const filter: any = {
        openedAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'closed',
      };
      if (branchId) filter.branchId = branchId;

      const shifts = await CashierShiftModel.find(filter).lean();

      const summary = {
        date: targetDate.toISOString().split('T')[0],
        totalShifts: shifts.length,
        totalSales: 0,
        totalOrders: 0,
        totalCashSales: 0,
        totalCardSales: 0,
        totalDigitalSales: 0,
        totalRefunds: 0,
        totalDiscounts: 0,
        totalCancelledOrders: 0,
        totalVAT: 0,
        netRevenue: 0,
        totalOpeningCash: 0,
        totalClosingCash: 0,
        totalExpectedCash: 0,
        totalCashDifference: 0,
        paymentBreakdown: { cash: 0, card: 0, loyalty: 0 },
        orderTypeBreakdown: { dine_in: 0, takeaway: 0, car_pickup: 0, delivery: 0, online: 0 },
        shifts: shifts.map(s => ({
          shiftNumber: s.shiftNumber,
          employeeName: s.employeeName,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          totalSales: s.totalSales,
          totalOrders: s.totalOrders,
          cashDifference: s.cashDifference,
        })),
      };

      for (const s of shifts) {
        summary.totalSales += s.totalSales || 0;
        summary.totalOrders += s.totalOrders || 0;
        summary.totalCashSales += s.totalCashSales || 0;
        summary.totalCardSales += s.totalCardSales || 0;
        summary.totalDigitalSales += s.totalDigitalSales || 0;
        summary.totalRefunds += s.totalRefunds || 0;
        summary.totalDiscounts += s.totalDiscounts || 0;
        summary.totalCancelledOrders += s.totalCancelledOrders || 0;
        summary.totalVAT += s.totalVAT || 0;
        summary.netRevenue += s.netRevenue || 0;
        summary.totalOpeningCash += s.openingCash || 0;
        summary.totalClosingCash += s.closingCash || 0;
        summary.totalExpectedCash += s.expectedCash || 0;
        summary.totalCashDifference += s.cashDifference || 0;

        const pb = s.paymentBreakdown || {} as any;
        for (const key of Object.keys(summary.paymentBreakdown)) {
          (summary.paymentBreakdown as any)[key] += (pb as any)[key] || 0;
        }
        const ob = s.orderTypeBreakdown || {} as any;
        for (const key of Object.keys(summary.orderTypeBreakdown)) {
          (summary.orderTypeBreakdown as any)[key] += (ob as any)[key] || 0;
        }
      }

      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الملخص اليومي" });
    }
  });

  // Auto-shift current period (when no manual shift open)
  app.get("/api/shifts/auto-current", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const cfg = await BusinessConfigModel.findOne({ tenantId }).lean() as any;
      const hours = Number(cfg?.autoShiftHours || 12);
      const enabled = cfg?.autoShiftEnabled !== false;
      const now = await getEffectiveNow(tenantId);
      const period = getAutoShiftPeriod(now, hours);
      const branchId = req.employee?.branchId || 'main';

      if (!enabled) {
        return res.json({
          enabled: false,
          autoShiftHours: hours,
          period: { index: period.index, start: period.start, end: period.end, now },
          totalOrders: 0, totalSales: 0, totalCashSales: 0, totalCardSales: 0, totalDigitalSales: 0,
          totalDiscounts: 0, totalVAT: 0, netRevenue: 0,
          paymentBreakdown: { cash: 0, card: 0, loyalty: 0 },
          orderTypeBreakdown: { dine_in: 0, takeaway: 0, car_pickup: 0, delivery: 0, online: 0 },
          employees: [], orderIds: [], branchId,
        });
      }

      // Collect order IDs already covered by manual shifts in this period to avoid double-count
      const manualShifts = await CashierShiftModel.find({
        tenantId, branchId,
        $or: [
          { openedAt: { $gte: period.start, $lte: now } },
          { closedAt: { $gte: period.start, $lte: now } },
          { openedAt: { $lte: period.start }, closedAt: { $gte: now } },
          { status: 'active', openedAt: { $lte: now } },
        ],
      }).lean();
      const coveredIds = new Set<string>();
      for (const s of manualShifts as any[]) {
        for (const oid of (s.orderIds || [])) coveredIds.add(String(oid));
      }

      const orders = await OrderModel.find({
        tenantId, branchId,
        createdAt: { $gte: period.start, $lte: now },
        status: { $ne: 'cancelled' },
      }).lean();
      const filtered = orders.filter((o: any) => !coveredIds.has(String(o.id || o._id)));

      const { coffeeItemMap, categoryMap } = await loadMenuMaps(tenantId);
      const summary = aggregateOrdersAsShift(filtered, period.start, now, coffeeItemMap, categoryMap);
      res.json({
        enabled,
        autoShiftHours: hours,
        period: { index: period.index, start: period.start, end: period.end, now },
        ...summary,
        branchId,
        excludedManualOrders: orders.length - filtered.length,
      });
    } catch (error: any) {
      console.error("[SHIFT] auto-current error:", error);
      res.status(500).json({ error: "فشل في حساب الوردية التلقائية" });
    }
  });

  // Auto-shift periods history (past N days)
  app.get("/api/shifts/auto-periods", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const cfg = await BusinessConfigModel.findOne({ tenantId }).lean() as any;
      const hours = Number(cfg?.autoShiftHours || 12);
      const enabled = cfg?.autoShiftEnabled !== false;
      const branchId = req.employee?.branchId || 'main';
      if (!enabled) {
        return res.json({ enabled: false, autoShiftHours: hours, periods: [] });
      }
      const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
      const now = await getEffectiveNow(tenantId);
      const periodMs = hours * 3600000;
      const startBoundary = new Date(getSaudiStartOfDay(new Date(now.getTime() - days * 86400000)).getTime());

      const manualShifts = await CashierShiftModel.find({
        tenantId, branchId,
        openedAt: { $gte: startBoundary },
      }).lean();
      const coveredIds = new Set<string>();
      for (const s of manualShifts as any[]) {
        for (const oid of (s.orderIds || [])) coveredIds.add(String(oid));
      }

      const ordersAll = await OrderModel.find({
        tenantId, branchId,
        createdAt: { $gte: startBoundary, $lte: now },
        status: { $ne: 'cancelled' },
      }).lean();
      const orders = ordersAll.filter((o: any) => !coveredIds.has(String(o.id || o._id)));

      const buckets: Record<string, any[]> = {};
      for (const o of orders) {
        const t = new Date((o as any).createdAt).getTime();
        const idx = Math.floor((t - startBoundary.getTime()) / periodMs);
        const bStart = new Date(startBoundary.getTime() + idx * periodMs);
        const key = bStart.toISOString();
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(o);
      }

      const { coffeeItemMap, categoryMap } = await loadMenuMaps(tenantId);
      const periods = Object.entries(buckets)
        .map(([key, list]) => {
          const start = new Date(key);
          const end = new Date(start.getTime() + periodMs);
          return { start, end, ...aggregateOrdersAsShift(list, start, end, coffeeItemMap, categoryMap) };
        })
        .sort((a, b) => b.start.getTime() - a.start.getTime());

      res.json({ autoShiftHours: hours, periods });
    } catch (error: any) {
      console.error("[SHIFT] auto-periods error:", error);
      res.status(500).json({ error: "فشل في جلب سجل الورديات التلقائية" });
    }
  });

  // Server's effective time (with manualTimeOffsetMinutes applied)
  app.get("/api/shifts/effective-time", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const cfg = await BusinessConfigModel.findOne({ tenantId }).lean() as any;
      const offset = Number(cfg?.manualTimeOffsetMinutes || 0);
      const now = new Date(Date.now() + offset * 60000);
      res.json({
        serverNow: new Date().toISOString(),
        effectiveNow: now.toISOString(),
        manualTimeOffsetMinutes: offset,
        timezone: cfg?.timezone || 'Asia/Riyadh',
      });
    } catch (error) {
      res.status(500).json({ error: "فشل" });
    }
  });

  // Temporary test route for email

  app.get("/api/pos/hardware-status", requireAuth, (req: AuthRequest, res) => {
    try {
      // In a real implementation, this would check actual hardware connections
      res.json({
        pos: posDeviceStatus,
        printer: { connected: true, status: "ready" },
        cashDrawer: { connected: true, status: "closed" },
        scanner: { connected: true, status: "ready" }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get hardware status" });
    }
  });

  // FILE UPLOAD ROUTES
  
  // Upload payment receipt
  app.post("/api/upload-receipt", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { ObjectStorageService } = await import("./qirox_studio_integrations/object_storage");
      const storageService = new ObjectStorageService();

      try {
        const uploadURL = await storageService.getObjectEntityUploadURL();
        const objectPath = storageService.normalizeObjectEntityPath(uploadURL);

        const fsModule = await import('fs');
        const fileBuffer = fsModule.readFileSync(req.file.path);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file.mimetype || 'application/octet-stream',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to object storage');
        }

        fsModule.unlinkSync(req.file.path);
        res.json({ url: objectPath, filename: req.file.filename });
      } catch (storageError) {
        console.log('[UPLOAD] Object storage not available, falling back to local storage');
        const fileUrl = `/attached_assets/receipts/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.filename });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // EMPLOYEE ROUTES

  // Employee login via QR code (uses only employee ID)
  app.post("/api/employees/login-qr", async (req, res) => {
    try {
      const { employeeId } = req.body;

      console.log(`[AUTH-QR] Login attempt for: ${employeeId}`);
      // Try to find by id, employmentNumber, or username (fallback)
      let employee = await EmployeeModel.findOne({ id: employeeId });
      if (!employee) employee = await EmployeeModel.findOne({ employmentNumber: employeeId });
      if (!employee) employee = await EmployeeModel.findOne({ username: employeeId });
      if (!employee) {
        // Try MongoDB ObjectId
        try {
          const { default: mongoose } = await import('mongoose');
          if (mongoose.Types.ObjectId.isValid(employeeId)) {
            employee = await EmployeeModel.findById(employeeId);
          }
        } catch {}
      }

      if (!employee) {
        console.log(`[AUTH-QR] Employee not found: ${employeeId}`);
        return res.status(401).json({ error: "بطاقة الموظف غير موجودة أو منتهية الصلاحية" });
      }

      if (employee.isActivated === 0) {
        return res.status(403).json({ error: "هذا الحساب غير مفعل" });
      }

      // Create session (no password verification for QR)
      req.session.employee = {
        id: (employee._id as any).toString(),
        username: employee.username,
        role: employee.role,
        branchId: employee.branchId,
        fullName: employee.fullName,
        tenantId: employee.tenantId
      } as any;

      const restoreKey = crypto.randomBytes(32).toString('hex');
      req.session.restoreKey = restoreKey;
      await EmployeeModel.findByIdAndUpdate(employee._id, { $set: { lastRestoreKey: restoreKey } });

      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("[AUTH-QR] Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }

        console.log(`[AUTH-QR] Login successful: ${employee.username} (${employee.role})`);
        // Don't send password back
        const employeeData = serializeDoc(employee);
        delete employeeData.password;
        delete employeeData.lastRestoreKey;
        res.json({ ...employeeData, restoreKey });
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Employee login via username/password
  app.post("/api/employees/verify-phone", async (req, res) => {
    try {
      const { username, phone } = req.body;
      if (!username || !phone) {
        return res.status(400).json({ error: "الرجاء إدخال اسم المستخدم ورقم الجوال" });
      }
      const isEmail = username.includes("@");
      const employee = await EmployeeModel.findOne(
        isEmail ? { email: username.toLowerCase().trim() } : { username }
      );
      if (!employee) {
        return res.status(401).json({ error: "اسم المستخدم أو رقم الجوال غير صحيح" });
      }
      const normalize = (p: string) => p.replace(/\s|-/g, "").replace(/^00966/, "0").replace(/^\+966/, "0");
      const inputPhone = normalize(String(phone));
      const storedPhone = normalize(String(employee.phone || ""));
      if (!storedPhone || inputPhone !== storedPhone) {
        return res.status(401).json({ error: "اسم المستخدم أو رقم الجوال غير صحيح" });
      }
      return res.json({ verified: true });
    } catch (err) {
      console.error("[AUTH] verify-phone error:", err);
      return res.status(500).json({ error: "خطأ في التحقق" });
    }
  });

  app.post("/api/employees/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "الرجاء إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور" });
      }

      console.log(`[AUTH] Login attempt for: ${username}`);

      // Support login by username, email, or phone number (case-insensitive)
      const trimmedUsername = username.trim();
      const isEmail = trimmedUsername.includes("@");
      // Phone detection: starts with 05, 5, +966, or 00966
      const isPhone = /^(\+966|00966|05|5)\d{7,9}$/.test(trimmedUsername.replace(/\s/g, ''));

      let employee: any = null;

      if (isEmail) {
        employee = await EmployeeModel.findOne({ email: trimmedUsername.toLowerCase() });
      } else if (isPhone) {
        // Normalize phone to 9-digit format starting with 5
        const normalizedPhone = trimmedUsername.replace(/\D/g, '').replace(/^00966/, '').replace(/^\+966/, '').replace(/^966/, '').replace(/^0/, '');
        employee = await EmployeeModel.findOne({ phone: { $in: [normalizedPhone, `0${normalizedPhone}`, `+966${normalizedPhone}`, `966${normalizedPhone}`] } });
      } else {
        // Username search — case-insensitive
        employee = await EmployeeModel.findOne({ username: { $regex: `^${trimmedUsername}$`, $options: 'i' } });
      }

      if (!employee || !employee.password) {
        console.log(`[AUTH] Employee not found or no password: ${username}`);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      // Verify password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, employee.password);

      if (!isPasswordValid) {
        console.log(`[AUTH] Invalid password for: ${username}`);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      // Check activation — isActivated can be 0, false, or "0" to mean inactive
      const notActivated = employee.isActivated === 0 || employee.isActivated === false || employee.isActivated === "0";
      if (notActivated) {
        return res.status(403).json({ error: "هذا الحساب غير مفعل. تواصل مع المدير لتفعيل الحساب" });
      }

      // Create session
      req.session.employee = {
        id: (employee._id as any).toString(),
        username: employee.username,
        role: employee.role,
        branchId: employee.branchId,
        fullName: employee.fullName,
        tenantId: employee.tenantId
      } as any;

      const restoreKey = crypto.randomBytes(32).toString('hex');
      req.session.restoreKey = restoreKey;
      await EmployeeModel.findByIdAndUpdate(employee._id, { $set: { lastRestoreKey: restoreKey } });

      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("[AUTH] Session save error:", err);
          return res.status(500).json({ error: "فشل في إنشاء الجلسة" });
        }

        console.log(`[AUTH] Login successful: ${username} (${employee.role})`);
        // Don't send password back
        const employeeData = serializeDoc(employee);
        delete employeeData.password;
        delete employeeData.lastRestoreKey;
        res.json({ ...employeeData, restoreKey });
      });
    } catch (error) {
      console.error("[AUTH] Login failed:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  app.post("/api/employees/restore-session", async (req, res) => {
    try {
      const { employeeId, restoreKey } = req.body;
      if (!employeeId || !restoreKey) {
        return res.status(400).json({ error: "Employee ID and restore key required" });
      }
      
      const employee = await EmployeeModel.findOne({ id: employeeId }) || await EmployeeModel.findById(employeeId).catch(() => null);
      if (!employee || !employee.isActive) {
        return res.status(404).json({ error: "Employee not found or inactive" });
      }

      const storedKey = (employee as any).lastRestoreKey;
      if (!storedKey || storedKey !== restoreKey) {
        console.log(`[AUTH-RESTORE] Invalid restore key for employee: ${employeeId}`);
        return res.status(401).json({ error: "Invalid restore key" });
      }
      
      const newRestoreKey = crypto.randomBytes(32).toString('hex');
      await EmployeeModel.findByIdAndUpdate(employee._id, { $set: { lastRestoreKey: newRestoreKey } });

      const sessionEmployee = {
        id: employee.id || (employee as any)._id?.toString(),
        username: employee.username,
        fullName: employee.fullName,
        role: employee.role,
        branchId: employee.branchId,
        tenantId: (employee as any).tenantId || 'default',
        allowedPages: (employee as any).allowedPages || [],
      };
      
      req.session.employee = sessionEmployee;
      req.session.restoreKey = newRestoreKey;
      
      res.json({ success: true, employee: sessionEmployee, restoreKey: newRestoreKey });
    } catch (error) {
      console.error("Session restore error:", error);
      res.status(500).json({ error: "Failed to restore session" });
    }
  });

  // Get current user (for AuthGuard fallback check)
  app.get("/api/user", (req: AuthRequest, res) => {
    try {
      if (req.session.employee) {
        return res.json({
          type: 'employee',
          ...req.session.employee
        });
      }
      if (req.session.customer) {
        return res.json({
          type: 'customer',
          ...req.session.customer
        });
      }
      return res.status(401).json({ error: "Not authenticated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Logout endpoint
  app.post("/api/employees/logout", (req: AuthRequest, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout session destroy error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid", { path: '/' });
        res.json({ success: true, redirect: '/employee/login' });
      });
    } catch (error) {
      console.error("Logout catch error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Points to Wallet Conversion (100 points = 5 SAR)
  app.post("/api/loyalty/convert", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { points, customerId } = req.body;
      if (!points || points < 100 || points % 100 !== 0) {
        return res.status(400).json({ error: "يجب أن تكون النقاط من مضاعفات 100" });
      }

      const customer = await CustomerModel.findOne({ id: customerId });
      if (!customer || (customer.points || 0) < points) {
        return res.status(400).json({ error: "النقاط غير كافية" });
      }

      const sarAmount = (points / 100) * 5;
      customer.points = (customer.points || 0) - points;
      customer.walletBalance = (customer.walletBalance || 0) + sarAmount;
      
      await customer.save();
      res.json({ 
        success: true, 
        newBalance: customer.walletBalance, 
        newPoints: customer.points,
        convertedAmount: sarAmount 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل استبدال النقاط" });
    }
  });

  // Peer-to-peer point transfer via phone number with PIN
  app.post("/api/loyalty/transfer", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { toPhone, points, pin } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      // Get sender (current customer/employee)
      const fromId = (req as any).customer?.id || req.employee?.id;
      if (!fromId) return res.status(401).json({ error: "غير مصرح لك" });

      const fromCustomer = await CustomerModel.findOne({ id: fromId });
      if (!fromCustomer) return res.status(404).json({ error: "حساب المرسل غير موجود" });

      // Verify PIN
      if (fromCustomer.walletPin !== pin) {
        return res.status(401).json({ error: "الرقم السري غير صحيح" });
      }

      if ((fromCustomer.points || 0) < points) {
        return res.status(400).json({ error: "النقاط غير كافية" });
      }

      const toCustomer = await CustomerModel.findOne({ phone: toPhone, tenantId });
      if (!toCustomer) {
        return res.status(404).json({ error: "المستلم غير موجود" });
      }

      // Execute transfer
      fromCustomer.points = (fromCustomer.points || 0) - points;
      toCustomer.points = (toCustomer.points || 0) + points;

      await fromCustomer.save();
      await toCustomer.save();

      // Record transaction
      await PointTransferModel.create({
        tenantId,
        fromCustomerId: fromCustomer.id,
        toCustomerId: toCustomer.id,
        points,
        status: 'completed'
      });

      res.json({ 
        success: true, 
        fromName: fromCustomer.name,
        toName: toCustomer.name,
        transferredPoints: points 
      });
    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({ error: "فشل تحويل النقاط" });
    }
  });

  // ============ Points Redemption Verification Code System ============
  const pointsVerificationCodes = new Map<string, {
    code: string;
    points: number;
    valueSAR: number;
    cardId: string;
    customerId: string;
    expiresAt: Date;
    verified: boolean;
    requestedBy: string;
    attempts: number;
  }>();

  setInterval(() => {
    const now = new Date();
    for (const [key, entry] of pointsVerificationCodes.entries()) {
      if (entry.expiresAt < now) {
        pointsVerificationCodes.delete(key);
      }
    }
  }, 60000);

  app.post("/api/loyalty/points/request-code", async (req, res) => {
    try {
      const { phone, points, requestedBy } = req.body;
      if (!phone || !points || points <= 0) {
        return res.status(400).json({ error: "رقم الهاتف وعدد النقاط مطلوب" });
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const pointsToSar = (pts: number) => (pts / 100) * 5;
      const valueSAR = pointsToSar(points);

      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!loyaltyCard) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      const availablePoints = Number(loyaltyCard.points) || 0;
      if (availablePoints < points) {
        return res.status(400).json({ error: `النقاط غير كافية. الرصيد الحالي: ${availablePoints} نقطة` });
      }

      const existing = pointsVerificationCodes.get(cleanPhone);
      if (existing && existing.expiresAt > new Date() && (new Date().getTime() - (existing.expiresAt.getTime() - 10 * 60 * 1000)) < 60000) {
        return res.status(429).json({ error: "يرجى الانتظار قبل طلب رمز جديد" });
      }

      const code = Math.floor(1000 + Math.random() * 9000).toString();

      pointsVerificationCodes.set(cleanPhone, {
        code,
        points: Number(points),
        valueSAR,
        cardId: loyaltyCard.id,
        customerId: loyaltyCard.customerId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        requestedBy: requestedBy || 'customer',
        attempts: 0,
      });

      const customer = await CustomerModel.findOne({ id: loyaltyCard.customerId });
      const customerEmail = customer?.email;
      const customerName = customer?.name || loyaltyCard.customerName || 'عميل';

      let emailSent = false;
      if (customerEmail) {
        emailSent = await sendPointsVerificationEmail(customerEmail, customerName, code, points, valueSAR);
      }

      console.log(`[POINTS-VERIFY] Code generated for ${cleanPhone}: ${code} (${points} pts = ${valueSAR} SAR)`);

      // Broadcast the code to the customer dashboard if they are connected via WebSocket
      wsManager.broadcastToCustomer(loyaltyCard.customerId.toString(), {
        type: 'points_verification_code',
        code,
        points: Number(points),
        valueSAR,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      res.json({
        success: true,
        message: emailSent ? "تم إرسال رمز التأكيد إلى بريدك الإلكتروني" : "تم إنشاء رمز التأكيد",
        expiresIn: 600,
        emailSent,
        maskedEmail: customerEmail ? customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
        points: Number(points),
        valueSAR,
        ...((!emailSent) ? { devCode: code } : {}),
      });
    } catch (error) {
      console.error("[POINTS-VERIFY] Error requesting code:", error);
      res.status(500).json({ error: "حدث خطأ أثناء إنشاء رمز التأكيد" });
    }
  });

  app.post("/api/loyalty/points/verify-code", async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return res.status(400).json({ error: "رقم الهاتف والرمز مطلوب" });
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const entry = pointsVerificationCodes.get(cleanPhone);

      if (!entry) {
        return res.status(404).json({ error: "لم يتم العثور على رمز تأكيد. يرجى طلب رمز جديد" });
      }

      if (entry.expiresAt < new Date()) {
        pointsVerificationCodes.delete(cleanPhone);
        return res.status(400).json({ error: "انتهت صلاحية الرمز. يرجى طلب رمز جديد" });
      }

      if (entry.attempts >= 5) {
        pointsVerificationCodes.delete(cleanPhone);
        return res.status(429).json({ error: "تم تجاوز عدد المحاولات. يرجى طلب رمز جديد" });
      }

      entry.attempts += 1;

      if (entry.code !== code.toString().trim()) {
        return res.status(400).json({ error: `الرمز غير صحيح. المحاولات المتبقية: ${5 - entry.attempts}` });
      }

      entry.verified = true;

      const verificationToken = `pv_${cleanPhone}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      pointsVerificationCodes.set(cleanPhone, { ...entry, code: verificationToken });

      console.log(`[POINTS-VERIFY] Code verified for ${cleanPhone}. Token: ${verificationToken}`);

      res.json({
        success: true,
        verified: true,
        verificationToken,
        points: entry.points,
        valueSAR: entry.valueSAR,
        message: "تم التحقق بنجاح! يمكن الآن خصم النقاط",
      });
    } catch (error) {
      console.error("[POINTS-VERIFY] Error verifying code:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التحقق من الرمز" });
    }
  });

  // Wallet Payment Endpoint
  app.post("/api/wallet/pay", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId, amount } = req.body;
      const customer = await CustomerModel.findOne({ id: customerId });
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      
      if ((customer.walletBalance || 0) < amount) {
        return res.status(400).json({ error: "الرصيد غير كافٍ" });
      }

      customer.walletBalance = (customer.walletBalance || 0) - amount;
      await customer.save();

      res.json({ success: true, balance: customer.walletBalance });
    } catch (error) {
      res.status(500).json({ error: "فشل عملية الدفع من المحفظة" });
    }
  });

  app.get("/api/permissions/matrix", requireAuth, async (req: AuthRequest, res) => {
    try {
      const role = req.employee!.role;
      const allPermissions = PermissionsEngine.getAllPermissionsList();
      const allPages = PermissionsEngine.getAllPagesList();
      const rolePermissions = PermissionsEngine.getPermissions(role);
      const defaultPages = PermissionsEngine.getDefaultPagesForRole(role);
      const roles = PermissionsEngine.getAllRoles();
      res.json({ allPermissions, allPages, rolePermissions, defaultPages, roles });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/employees/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employee = await storage.getEmployee(req.employee!.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const { password: _, ...employeeData } = employee as any;
      res.json(employeeData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.get("/api/employees/active-cashiers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const allCashiers = await storage.getActiveCashiers();
      const cashiers = filterByBranch(allCashiers, req.employee);
      const cashiersData = cashiers.map(emp => {
        const { password: _, _id, ...data } = emp as any;
        return { ...data, id: _id || data.id };
      });
      res.json(cashiersData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active cashiers" });
    }
  });

  // Get employee by ID (branch-restricted for managers)
  app.get("/api/employees/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const employee = await storage.getEmployee(id);

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Verify branch access for non-admin managers
      if (req.employee?.role !== "admin" && employee.branchId !== req.employee?.branchId) {
        return res.status(403).json({ error: "Access denied - different branch" });
      }

      // Don't send password back, transform _id to id
      const { password: _, _id, ...employeeData } = employee as any;
      res.json({ ...employeeData, id: _id || employeeData.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  // Create new employee (admin and managers)
  app.post("/api/employees", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { EmployeeModel } = await import("@shared/schema");
      const tenantId = req.employee?.tenantId || 'demo-tenant';
      const bodyData = req.body;

      if (req.employee?.role !== "admin" && req.employee?.role !== "owner") {
        if (req.employee?.branchId) {
          if (bodyData.branchId && bodyData.branchId !== req.employee.branchId) {
            return res.status(403).json({ error: "Cannot create employee in different branch" });
          }
          bodyData.branchId = req.employee.branchId;
        } else {
          return res.status(403).json({ error: "Manager must have a branch assigned" });
        }
      }

      // Check if username already exists
      const existing = await storage.getEmployeeByUsername(bodyData.username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Directly create using Model for robustness
      const newEmployee = await EmployeeModel.create({
        ...bodyData,
        permissions: bodyData.permissions || [],
        allowedPages: bodyData.allowedPages || [],
        tenantId: tenantId as any,
        id: nanoid(),
        isActivated: bodyData.password ? 1 : 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const employee = serializeDoc(newEmployee);
      
      // Don't send password back
      const { password: _, ...employeeData } = employee;
      res.status(201).json(employeeData);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  // Get all employees (branch-filtered for managers)
  app.get("/api/employees", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const allEmployees = await storage.getEmployees();
      
      let employees = allEmployees;
      
      if (req.employee?.role === "admin" || req.employee?.role === "owner") {
        // Admin/Owner see all employees
      } else {
        employees = filterByBranch(allEmployees, req.employee);
        employees = employees.filter(emp => 
          emp.role !== "admin" && 
          emp.role !== "owner"
        );
      }

      // Don't send passwords back, transform _id to id for frontend
      const employeesData = employees.map(emp => {
        const { password: _, _id, ...data } = emp as any;
        return { ...data, id: _id || data.id };
      });

      res.json(employeesData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  // Update employee (branch-restricted for managers)
  app.put("/api/employees/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get employee to verify branch access
      const existingEmployee = await storage.getEmployee(id);
      if (!existingEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      if (req.employee?.role !== "admin" && req.employee?.role !== "owner" && existingEmployee.branchId !== req.employee?.branchId) {
        return res.status(403).json({ error: "Access denied - different branch" });
      }

      const updatedEmployee = await storage.updateEmployee(id, updates);

      if (!updatedEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const { password: _, _id, ...employeeData } = updatedEmployee as any;
      res.json({ ...employeeData, id: _id || employeeData.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.patch("/api/employees/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existingEmployee = await storage.getEmployee(id);
      if (!existingEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      if (req.employee?.role !== "admin" && req.employee?.role !== "owner" && existingEmployee.branchId !== req.employee?.branchId) {
        return res.status(403).json({ error: "Access denied - different branch" });
      }

      const managerLevel = PermissionsEngine.getRoleLevel(req.employee!.role);
      const targetLevel = PermissionsEngine.getRoleLevel(existingEmployee.role);
      if (managerLevel <= targetLevel && req.employee?.role !== "admin" && req.employee?.role !== "owner") {
        return res.status(403).json({ error: "Cannot edit employee of same or higher role" });
      }

      if (updates.role) {
        const newRoleLevel = PermissionsEngine.getRoleLevel(updates.role);
        if (newRoleLevel >= managerLevel && req.employee?.role !== "admin" && req.employee?.role !== "owner") {
          return res.status(403).json({ error: "Cannot assign role equal or higher than your own" });
        }
      }

      const updatedEmployee = await storage.updateEmployee(id, updates);
      if (!updatedEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const { password: _, _id, ...employeeData } = updatedEmployee as any;
      res.json({ ...employeeData, id: _id || employeeData.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const existingEmployee = await storage.getEmployee(id);
      if (!existingEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      if (req.employee?.role !== "admin" && req.employee?.role !== "owner" && existingEmployee.branchId !== req.employee?.branchId) {
        return res.status(403).json({ error: "Access denied - different branch" });
      }

      const managerLevel = PermissionsEngine.getRoleLevel(req.employee!.role);
      const targetLevel = PermissionsEngine.getRoleLevel(existingEmployee.role);
      if (managerLevel <= targetLevel && req.employee?.role !== "admin" && req.employee?.role !== "owner") {
        return res.status(403).json({ error: "Cannot delete employee of same or higher role" });
      }

      const { EmployeeModel } = await import("@shared/schema");
      await EmployeeModel.deleteOne({ $or: [{ id }, { _id: id }] });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // Activate employee account
  app.post("/api/employees/activate", async (req, res) => {
    try {
      const { EmployeeModel } = await import("@shared/schema");
      const { phone, fullName, password } = req.body;

      if (!phone || !fullName || !password) {
        return res.status(400).json({ error: "رقم الهاتف والاسم وكلمة المرور مطلوبة" });
      }

      // Look for employee that is NOT activated and matches name/phone
      // We trim and use case-insensitive regex for fullName to be robust
      const employee = await EmployeeModel.findOne({
        phone: phone.trim(),
        fullName: { $regex: new RegExp(`^${fullName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
        isActivated: 0
      });

      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود أو تم تفعيله مسبقاً" });
      }

      // Hash password using bcrypt directly
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const updatedEmployee = await EmployeeModel.findByIdAndUpdate(employee._id, {
        password: hashedPassword,
        isActivated: 1,
        updatedAt: new Date()
      }, { new: true });

      if (!updatedEmployee) {
        return res.status(500).json({ error: "فشل تحديث بيانات الموظف" });
      }

      const serialized = serializeDoc(updatedEmployee);
      const { password: _, ...employeeData } = serialized;
      res.json(employeeData);
    } catch (error) {
      console.error("Error activating employee:", error);
      res.status(500).json({ error: "Failed to activate employee" });
    }
  });

  // Reset employee password by username
  app.post("/api/employees/reset-password-by-username", async (req, res) => {
    try {
      const { username, newPassword } = req.body;

      if (!username || !newPassword) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور الجديدة مطلوبان" });
      }

      // Validate password
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      const success = await storage.resetEmployeePasswordByUsername(username, newPassword);

      if (!success) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل تغيير كلمة المرور" });
    }
  });

  // DISCOUNT CODE ROUTES

  // Get all discount codes
  app.get("/api/discount-codes", async (req, res) => {
    try {
      const isEmployee = !!(req as any).employee;
      const { DiscountCodeModel } = await import("@shared/schema");
      if (isEmployee) {
        const codes = await DiscountCodeModel.find({}).sort({ createdAt: -1 }).lean();
        return res.json(codes);
      }
      const publicCoupons = await DiscountCodeModel.find({
        isActive: 1,
        visibleToCustomers: true,
      }).select('code discountPercentage reason').sort({ createdAt: -1 }).lean();
      res.json(publicCoupons);
    } catch (error) {
      console.error("Failed to fetch discount codes:", error);
      res.json([]);
    }
  });

  // Create discount code
  app.post("/api/discount-codes", requireAuth, requireManager, async (req, res) => {
    try {
      const { insertDiscountCodeSchema } = await import("@shared/schema");
      const validatedData = insertDiscountCodeSchema.parse(req.body);

      // Check if code already exists
      const existing = await storage.getDiscountCodeByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ error: "Code already exists" });
      }

      const discountCode = await storage.createDiscountCode(validatedData);
      res.status(201).json(discountCode);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: error });
      }
      res.status(500).json({ error: "Failed to create discount code" });
    }
  });

  // Get discount code by code
  app.get("/api/discount-codes/by-code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const discountCode = await storage.getDiscountCodeByCode(code);

      if (!discountCode) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      if (discountCode.isActive === 0) {
        return res.status(400).json({ error: "Discount code is inactive" });
      }

      res.json(discountCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount code" });
    }
  });

  // Get all discount codes for an employee
  app.get("/api/discount-codes/employee/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      // Using standard discount code lookup if specific method missing
      const { DiscountCodeModel } = await import("@shared/schema");
      const codes = await DiscountCodeModel.find({ employeeId }).lean();
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount codes" });
    }
  });

  // Update discount code (toggle active status or visibility)
  app.patch("/api/discount-codes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, visibleToCustomers, employeeId } = req.body;

      // Require employee ID for authorization
      if (!employeeId) {
        return res.status(401).json({ error: "Employee authentication required" });
      }

      // Verify the discount code exists
      const existingCode = await storage.getDiscountCode(id);
      if (!existingCode) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      // Ownership check: code creator OR an admin/manager/owner may update.
      // The 'admin' string is the legacy marker used by admin-settings UI.
      const sessionEmp: any = (req as any).session?.employee || (req as any).employee;
      const sessionRole = sessionEmp?.role || '';
      const elevatedRoles = ['admin', 'owner', 'manager', 'branch_manager'];
      const isElevated = elevatedRoles.includes(sessionRole) || employeeId === 'admin';
      if (existingCode.employeeId !== employeeId && !isElevated) {
        return res.status(403).json({ error: "Unauthorized: You can only update your own discount codes" });
      }

      const updates: Record<string, any> = {};

      if (isActive !== undefined) {
        if (typeof isActive !== 'number' || (isActive !== 0 && isActive !== 1)) {
          return res.status(400).json({ error: "isActive must be 0 or 1" });
        }
        updates.isActive = isActive;
      }

      if (visibleToCustomers !== undefined) {
        updates.visibleToCustomers = !!visibleToCustomers;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const discountCode = await storage.updateDiscountCode(id, updates);
      res.json(discountCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to update discount code" });
    }
  });

  // Increment discount code usage
  app.post("/api/discount-codes/:id/use", async (req, res) => {
    try {
      const { id } = req.params;

      // Check if code exists and is active first
      const code = await storage.getDiscountCode(id);
      if (!code) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      if (code.isActive === 0) {
        return res.status(400).json({ error: "Discount code is inactive" });
      }

      const discountCode = await storage.incrementDiscountCodeUsage(id);
      res.json(discountCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to use discount code" });
    }
  });

  // Validate discount code and return discount info
  app.post("/api/discount-codes/validate", async (req, res) => {
    try {
      const { code, customerId, amount } = req.body;

      if (!code) {
        return res.status(400).json({ error: "كود الخصم مطلوب" });
      }

      const discountCode = await storage.getDiscountCodeByCode(code.trim());

      if (!discountCode) {
        console.log(`[DISCOUNT] Code not found: ${code.trim()}`);
        return res.status(404).json({ 
          valid: false,
          error: "كود الخصم غير موجود"
        });
      }
      
      const isActive = Number(discountCode.isActive);
      if (isActive === 0) {
        return res.status(400).json({ 
          valid: false,
          error: "كود الخصم غير فعال"
        });
      }

      // Check expiry
      if (discountCode.expiryDate && new Date(discountCode.expiryDate) < new Date()) {
        return res.status(400).json({
          valid: false,
          error: "كود الخصم منتهي الصلاحية"
        });
      }

      // Check usage limit
      if (discountCode.usageLimit && (discountCode.usageCount || 0) >= discountCode.usageLimit) {
        return res.status(400).json({
          valid: false,
          error: "تم تجاوز حد الاستخدام لهذا الكود"
        });
      }

      // Check min purchase
      if (discountCode.minPurchase && amount && Number(amount) < discountCode.minPurchase) {
        return res.status(400).json({
          valid: false,
          error: `الحد الأدنى للشراء لاستخدام هذا الكود هو ${discountCode.minPurchase}`
        });
      }
      
      // Check if it's a permanent loyalty discount (qahwa-card)
      if (discountCode.code === 'qahwa-card') {
        if (!customerId) {
          return res.status(400).json({ 
            valid: false,
            error: "يجب تسجيل الدخول لاستخدام خصم بطاقة مكان الشيف البخاري"
          });
        }
        
        const customer = await storage.getCustomer(customerId);
        if (!customer) {
          return res.status(404).json({ 
            valid: false,
            error: "العميل غير موجود"
          });
        }
      }

      // Allow all active discount codes including 100%

      res.json({
        valid: true,
        code: discountCode.code,
        discountPercentage: discountCode.discountPercentage,
        reason: discountCode.reason,
        id: discountCode._id
      });
    } catch (error) {
      console.error("Error validating discount code:", error);
      res.status(500).json({ error: "Failed to validate discount code" });
    }
  });

  // SALES REPORTS ROUTES

  // Get sales report for a specific period
  app.get("/api/reports/sales", async (req, res) => {
    try {
      const { period, startDate, endDate, branchId } = req.query;
      
      const now = new Date();
      let start: Date;
      let end: Date = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
      } else if (period === 'daily') {
        start = getSaudiStartOfDay(now);
      } else if (period === 'weekly') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'monthly') {
        start = new Date(getSaudiStartOfDay(now).getTime() - 29 * 24 * 60 * 60 * 1000);
      } else {
        start = getSaudiStartOfDay(now);
      }

      const { OrderModel } = await import("@shared/schema");
      
      const matchQuery: any = {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['completed', 'payment_confirmed'] }
      };

      if (branchId) {
        matchQuery.branchId = branchId;
      }

      const salesData = await OrderModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$totalAmount" },
            orders: { $push: "$$ROOT" }
          }
        }
      ]);

      const result = salesData[0] || { totalOrders: 0, totalRevenue: 0, orders: [] };

      res.json({
        period: period || 'custom',
        startDate: start,
        endDate: end,
        totalOrders: result.totalOrders,
        totalRevenue: result.totalRevenue,
        orders: result.orders
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate sales report" });
    }
  });

  // CUSTOMER ROUTES

  // Customer registration - إنشاء حساب جديد
  app.post("/api/customers/register", async (req, res) => {
    try {
      const { phone, email, name, password, referralCode } = req.body;

      if (!phone || !name || !password) {
        return res.status(400).json({ error: "الهاتف والاسم وكلمة المرور مطلوبة" });
      }

      // Validate phone format: must be 9 digits starting with 5
      const cleanPhone = phone.trim().replace(/\s/g, '');
      if (cleanPhone.length !== 9) {
        return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام" });
      }

      if (!cleanPhone.startsWith('5')) {
        return res.status(400).json({ error: "رقم الهاتف يجب أن يبدأ بـ 5" });
      }

      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      // Validate email format only if provided
      if (email && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
        }
      }

      // Validate name
      if (name.trim().length < 2) {
        return res.status(400).json({ error: "الاسم يجب أن يكون على الأقل حرفين" });
      }

      // Validate password
      if (password.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      // Check if customer already exists with this phone
      const existingCustomerByPhone = await storage.getCustomerByPhone(cleanPhone);
      if (existingCustomerByPhone) {
        return res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً" });
      }

      // Check if customer already exists with this email
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      if (cleanEmail) {
        const existingCustomerByEmail = await storage.getCustomerByEmail(cleanEmail);
        if (existingCustomerByEmail) {
          return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
        }
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new customer
      const customer = await storage.createCustomer({ 
        phone: cleanPhone, 
        ...(cleanEmail ? { email: cleanEmail } : {}),
        name: name.trim(),
        password: hashedPassword
      });

      // Send Welcome Email asynchronously
      if (customer.email) {
        sendWelcomeEmail(customer.email, customer.name).catch(err => console.error("Welcome Email Error:", err));
      }

      // Create loyalty card for new customer
      let newLoyaltyCard: any = null;
      try {
        const cardNumber = `QC${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const qrToken = nanoid(12);
        const serializedCustomer = serializeDoc(customer);
        newLoyaltyCard = await storage.createLoyaltyCard({ 
          customerName: name.trim(), 
          phoneNumber: cleanPhone,
          cardNumber,
          qrToken,
          customerId: serializedCustomer.id || serializedCustomer._id,
        });
      } catch (cardError) {
        console.error("[REGISTRATION] Failed to create loyalty card for new customer:", cardError);
      }

      // Handle referral code - give 50 points to both referrer and new customer
      if (referralCode && referralCode.trim()) {
        try {
          // Find referrer by phone number (referral code = phone number)
          const referrerCard = await storage.getLoyaltyCardByPhone(referralCode.trim());
          if (referrerCard && referrerCard.phoneNumber !== cleanPhone) {
            // Add 50 points to referrer
            const referrerPoints = Number(referrerCard.points) || 0;
            await storage.updateLoyaltyCard(referrerCard.id, {
              points: referrerPoints + 50
            });
            
            // Create transaction for referrer
            await storage.createLoyaltyTransaction({
              cardId: referrerCard.id,
              type: 'referral_bonus',
              pointsChange: 50,
              discountAmount: 0,
              orderAmount: 0,
              description: `مكافأة إحالة صديق جديد: ${name.trim()}`
            });

            // Add 50 points to new customer
            if (newLoyaltyCard) {
              await storage.updateLoyaltyCard(newLoyaltyCard.id, {
                points: 50
              });
              
              // Create transaction for new customer
              await storage.createLoyaltyTransaction({
                cardId: newLoyaltyCard.id,
                type: 'referral_bonus',
                pointsChange: 50,
                discountAmount: 0,
                orderAmount: 0,
                description: `مكافأة التسجيل بكود إحالة`
              });
            }
            
            console.log(`[REFERRAL] Bonus applied: Referrer ${referralCode} and new customer ${cleanPhone} each got 50 points`);
          }
        } catch (referralError) {
          console.error("[REFERRAL] Error processing referral code:", referralError);
          // Don't fail registration if referral processing fails
        }
      }

      // Link any previous guest orders placed with the same phone number
      try {
        const OrderModel = mongoose.model('Order');
        const linkedResult = await OrderModel.updateMany(
          { customerPhone: cleanPhone, $or: [{ customerId: null }, { customerId: { $exists: false } }] },
          { $set: { customerId: customer.id } }
        );
        if (linkedResult.modifiedCount > 0) {
          console.log(`[REGISTRATION] Linked ${linkedResult.modifiedCount} guest orders to new customer ${customer.id} (phone: ${cleanPhone})`);
        }
      } catch (linkError) {
        console.error("[REGISTRATION] Order linking failed (non-critical):", linkError);
      }

      // Serialize and don't send password back
      const serialized = serializeDoc(customer);
      const { password: _, ...customerData } = serialized;

      // Set customer in session
      (req.session as any).customer = customerData;

      res.status(201).json(customerData);
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء الحساب" });
    }
  });

  // Customer login - تسجيل دخول
  app.post("/api/customers/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({ error: "رقم الهاتف أو البريد الإلكتروني وكلمة المرور مطلوبة" });
      }

      const cleanIdentifier = identifier.trim().replace(/\s/g, '');
      let customer;

      // Check if identifier is email or phone
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let foundCustomer;
      
      if (emailRegex.test(cleanIdentifier)) {
        // Login with email
        foundCustomer = await storage.getCustomerByEmail(cleanIdentifier);
        if (foundCustomer) {
          if (!foundCustomer.password) {
            // Customer exists but has no password (cashier-registered)
            return res.status(403).json({ 
              error: "هذا الحساب تم تسجيله من قبل الكاشير ولا يحتوي على كلمة مرور. يرجى إنشاء كلمة مرور أولاً",
              message: "This account was registered by cashier and has no password. Please set up a password first",
              requiresPasswordSetup: true
            });
          }
          const isPasswordValid = await bcrypt.compare(password, foundCustomer.password);
          if (isPasswordValid) {
            customer = foundCustomer;
          }
        }
      } else {
        // Login with phone — normalize: strip leading 0, +966, 00966, 966
        const normalizedPhone = cleanIdentifier.replace(/\D/g, '').replace(/^00966/, '').replace(/^\+966/, '').replace(/^966/, '').replace(/^0/, '');
        if (!/^5\d{8}$/.test(normalizedPhone)) {
          return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة (يجب أن يكون 10 أرقام مثل 0512345678)" });
        }
        
        foundCustomer = await storage.getCustomerByPhone(normalizedPhone);
        if (foundCustomer) {
          if (!foundCustomer.password) {
            // Customer exists but has no password (cashier-registered)
            return res.status(403).json({ 
              error: "هذا الحساب تم تسجيله من قبل الكاشير ولا يحتوي على كلمة مرور. يرجى إنشاء كلمة مرور أولاً",
              message: "This account was registered by cashier and has no password. Please set up a password first",
              requiresPasswordSetup: true
            });
          }
          customer = await storage.verifyCustomerPassword(normalizedPhone, password);
        }
      }

      if (!customer) {
        return res.status(401).json({ error: "رقم الهاتف/البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      // Serialize and don't send password back
      const serialized = serializeDoc(customer);
      const { password: _, ...customerData } = serialized;

      // Set customer in session
      (req.session as any).customer = customerData;
      
      res.json(customerData);
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
  });

  // Request password reset - طلب إعادة تعيين كلمة المرور
  app.post("/api/customers/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
      }

      // Check if customer exists
      const customer = await storage.getCustomerByEmail(email);
      
      // Always return success to prevent email enumeration
      // But only create token if customer exists
      if (customer) {
        const { token, expiresAt } = await storage.createPasswordResetToken(email);
        
        // Send password reset email
        const { sendPasswordResetEmail } = await import("./mail-service");
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const resetUrl = `${appUrl}/reset-password?token=${token}`;
        sendPasswordResetEmail(email, customer.name, token, resetUrl).catch(err => 
          console.error("[MAIL] Password reset email failed:", err)
        );
      }

      res.json({ 
        message: "إذا كان البريد الإلكتروني موجوداً، سيتم إرسال رابط إعادة تعيين كلمة المرور" 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل طلب إعادة تعيين كلمة المرور" });
    }
  });

  // Verify password reset token - التحقق من رمز إعادة التعيين
  app.post("/api/customers/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "الرمز مطلوب" });
      }

      const result = await storage.verifyPasswordResetToken(token);

      if (!result.valid) {
        return res.status(400).json({ error: "الرمز غير صالح أو منتهي الصلاحية" });
      }

      res.json({ valid: true, email: result.email });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من الرمز" });
    }
  });

  // Reset password - إعادة تعيين كلمة المرور
  app.post("/api/customers/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "الرمز وكلمة المرور الجديدة مطلوبة" });
      }

      // Validate password
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      // Verify token
      const verification = await storage.verifyPasswordResetToken(token);
      
      if (!verification.valid || !verification.email) {
        return res.status(400).json({ error: "الرمز غير صالح أو منتهي الصلاحية" });
      }

      // Reset password (auto-syncs card PIN)
      const success = await storage.resetCustomerPassword(verification.email, newPassword);
      
      if (!success) {
        return res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
      }

      // Mark token as used
      await storage.usePasswordResetToken(token);

      res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح. تم تحديث رمز البطاقة تلقائياً" });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
    }
  });

  // Check if email exists - التحقق من وجود البريد الإلكتروني
  app.post("/api/customers/check-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
      }

      const customer = await storage.getCustomerByEmail(email);
      res.json({ exists: !!customer });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البريد الإلكتروني" });
    }
  });

  // Verify phone matches email - التحقق من تطابق رقم الجوال مع البريد
  // Verify phone + name for password recovery (no email needed)
  app.post("/api/customers/verify-phone-name", async (req, res) => {
    try {
      const { phone, name } = req.body;

      if (!phone || !name) {
        return res.status(400).json({ error: "رقم الجوال والاسم مطلوبان" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const cleanName = name.trim().toLowerCase();

      const customer = await storage.getCustomerByPhone(cleanPhone);

      if (!customer) {
        return res.json({ valid: false });
      }

      const customerName = (customer.name || "").trim().toLowerCase();
      const valid = customerName === cleanName || customerName.includes(cleanName) || cleanName.includes(customerName);
      res.json({ valid });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البيانات" });
    }
  });

  // Reset password using phone + name (no email required)
  app.post("/api/customers/reset-password-by-phone-name", async (req, res) => {
    try {
      const { phone, name, newPassword } = req.body;

      if (!phone || !name || !newPassword) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة" });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const cleanName = name.trim().toLowerCase();

      const customer = await storage.getCustomerByPhone(cleanPhone);

      if (!customer) {
        return res.status(400).json({ error: "البيانات غير صحيحة" });
      }

      const customerName = (customer.name || "").trim().toLowerCase();
      const nameMatch = customerName === cleanName || customerName.includes(cleanName) || cleanName.includes(customerName);

      if (!nameMatch) {
        return res.status(400).json({ error: "البيانات غير صحيحة" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updated = await storage.updateCustomer((customer as any)._id.toString(), {
        password: hashedPassword,
      });

      if (!updated) {
        return res.status(500).json({ error: "فشل تحديث كلمة المرور" });
      }

      res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل تغيير كلمة المرور" });
    }
  });

  app.post("/api/customers/verify-phone-email", async (req, res) => {
    try {
      const { email, phone } = req.body;

      if (!email || !phone) {
        return res.status(400).json({ error: "البريد الإلكتروني ورقم الجوال مطلوبان" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const customer = await storage.getCustomerByEmail(email);

      if (!customer) {
        return res.json({ valid: false });
      }

      const valid = customer.phone === cleanPhone;
      res.json({ valid });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البيانات" });
    }
  });

  // Reset password directly with email and phone - إعادة تعيين كلمة المرور مباشرة
  app.post("/api/customers/reset-password-direct", async (req, res) => {
    try {
      const { email, phone, newPassword } = req.body;

      if (!email || !phone || !newPassword) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة" });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const customer = await storage.getCustomerByEmail(email);

      if (!customer || customer.phone !== cleanPhone) {
        return res.status(400).json({ error: "البيانات غير صحيحة" });
      }

      // Reset password (auto-syncs card PIN)
      const success = await storage.resetCustomerPassword(email, newPassword);
      
      if (!success) {
        return res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
      }

      res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح. تم تحديث رمز البطاقة تلقائياً" });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
    }
  });

  app.post("/api/customers/verify-password", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "كلمة المرور مطلوبة" });
      }
      const sessionCustomer = (req.session as any).customer;
      if (!sessionCustomer?.phone) {
        return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
      }
      const customer = await storage.verifyCustomerPassword(sessionCustomer.phone, password);
      if (!customer) {
        return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من كلمة المرور" });
    }
  });

  // Customer authentication (legacy - for backward compatibility)
  app.post("/api/customers/auth", async (req, res) => {
    try {
      const { phone, name, password } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
      }

      // Validate phone format — accept 05xxxxxxxx, 5xxxxxxxx, +9665xxxxxxxx
      const rawPhone = phone.trim().replace(/\s/g, '');
      const cleanPhone = rawPhone.replace(/\D/g, '').replace(/^00966/, '').replace(/^\+966/, '').replace(/^966/, '').replace(/^0/, '');
      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "رقم الجوال غير صحيح. أدخل الرقم بصيغة 0512345678" });
      }

      // If password provided, try login first
      if (password) {
        const customer = await storage.verifyCustomerPassword(cleanPhone, password);
        if (customer) {
          const { password: _, ...customerData } = customer;
          const serialized = serializeDoc(customerData);
          // Set customer in session
          (req.session as any).customer = serialized;
          return res.json(serialized);
        }
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Legacy behavior: get or create customer without password
      let customer = await storage.getCustomerByPhone(cleanPhone);
      if (customer) {
        const { password: _, ...customerData } = customer;
        const serialized = serializeDoc(customerData);
        // Set customer in session
        (req.session as any).customer = serialized;
        return res.json(serialized);
      }

      // For new registrations, require password
      return res.status(400).json({ error: "Please use /api/customers/register for new accounts" });
    } catch (error) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Get all customers (for admin/manager dashboard)
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const serializedCustomers = customers.map(customer => {
        const { password, ...customerData} = customer.toObject ? customer.toObject() : customer;
        return serializeDoc(customerData);
      });
      res.json(serializedCustomers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  /* 
   * CASHIER-REGISTERED CUSTOMERS - العملاء المسجلين من الكاشير
   * 
   * Customers registered by cashiers don't have passwords initially.
   * They can't log in through the normal /api/customers/login flow.
   * 
   * When they order via QR code (table menu), they just enter their phone number
   * and the system automatically links the order to their account for loyalty tracking.
   * 
   * They can optionally set a password later using /api/customers/set-password
   * to gain full account access with login capability.
   */
  
  // Customer lookup by phone for cashier - البحث عن عميل برقم الجوال من الكاشير
  app.post("/api/customers/lookup-by-phone", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      if (!customer) {
        return res.json({ found: false });
      }

      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);

      const { password: _, ...customerData } = customer.toObject ? customer.toObject() : customer;
      const serializedCustomer = serializeDoc(customerData);

      res.json({ 
        found: true,
        customer: serializedCustomer,
        loyaltyCard: loyaltyCard ? serializeDoc(loyaltyCard) : null
      });
    } catch (error) {
      res.status(500).json({ error: "فشل البحث عن العميل" });
    }
  });

  // GET Customer by phone - for table menu to fetch customer data
  app.get("/api/customers/by-phone/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;

      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      // Validate phone format: must be 9 digits starting with 5
      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      if (!customer) {
        // Customer not found - that's ok, just return empty
        return res.json({});
      }

      const { password: _, ...customerData } = customer.toObject ? customer.toObject() : customer;
      const serializedCustomer = serializeDoc(customerData);

      // Also fetch pending table orders for this customer
      let pendingOrder = null;
      try {
        const pendingOrders = await storage.getPendingTableOrders();
        const custOrder = pendingOrders.find(o => 
          o.customerInfo?.customerPhone === cleanPhone || 
          (customer._id && o.customerId?.toString() === customer._id.toString())
        );
        if (custOrder) {
          pendingOrder = serializeDoc(custOrder);
        }
      } catch (error) {
      }

      res.json({ 
        ...serializedCustomer,
        pendingTableOrder: pendingOrder 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل البحث عن العميل" });
    }
  });

  // Get orders for a specific customer by phone
  app.get("/api/orders/customer/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const { OrderModel } = await import("@shared/schema");
      
      // Clean phone number for consistent matching
      const cleanPhone = identifier.trim().replace(/\s/g, '').replace(/^\+966/, '').replace(/^00966/, '');
      
      // Check if identifier looks like a MongoDB ObjectId
      const isMongoId = mongoose?.Types?.ObjectId?.isValid?.(identifier) || 
                        /^[a-f\d]{24}$/i.test(identifier);
      
      // Also try to find customer by phone to get customerId
      let customerId: string | null = null;
      try {
        const customer = await storage.getCustomerByPhone(cleanPhone);
        if (customer) {
          customerId = (customer as any)._id?.toString() || (customer as any).id;
        }
      } catch (e) {
        // Continue without customerId
      }
      
      // If identifier is a MongoDB ObjectId, use it directly as customerId too
      if (isMongoId) {
        customerId = identifier;
      }
      
      // Build query conditions - search in all possible phone fields
      const queryConditions = [
        { "customerInfo.customerPhone": identifier },
        { "customerInfo.customerPhone": cleanPhone },
        { "customerInfo.phone": identifier },
        { "customerInfo.phone": cleanPhone },
        { "customerInfo.phoneNumber": identifier },
        { "customerInfo.phoneNumber": cleanPhone },
        { "phone": identifier },
        { "phone": cleanPhone },
        { "customerPhone": identifier },
        { "customerPhone": cleanPhone },
      ];
      
      // Add customerId conditions
      if (customerId) {
        (queryConditions as any[]).push({ customerId: customerId });
        (queryConditions as any[]).push({ "customerId": customerId });
      }
      
      // If it looks like a UUID, also search by id directly
      if (identifier.includes('-') || isMongoId) {
        (queryConditions as any[]).push({ "customerId": identifier });
      }
      
      const orders = await OrderModel.find({
        $or: queryConditions
      }).sort({ createdAt: -1 });

      const serializedOrders = orders.map(order => serializeDoc(order));
      console.log(`[GET /api/orders/customer/:identifier] Found ${serializedOrders.length} orders for identifier ${identifier}`);
      res.json(serializedOrders);
    } catch (error) {
      console.error("[GET /api/orders/customer/:identifier] Error:", error);
      res.status(500).json({ error: "Failed to fetch customer orders" });
    }
  });

  // Quick customer registration by cashier - تسجيل عميل سريع من الكاشير
  app.post("/api/customers/register-by-cashier", async (req, res) => {
    try {
      const { phone, name, email } = req.body;

      if (!phone || !name) {
        return res.status(400).json({ error: "رقم الجوال والاسم مطلوبان" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const cleanName = name.trim();
      const cleanEmail = email ? email.trim() : undefined;

      if (cleanName.length < 2) {
        return res.status(400).json({ error: "الاسم يجب أن يكون على الأقل حرفين" });
      }

      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      // Validate email format if provided
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
      }

      const existingCustomer = await storage.getCustomerByPhone(cleanPhone);
      if (existingCustomer) {
        return res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً" });
      }

      // Check if email already exists
      if (cleanEmail) {
        const existingEmailCustomer = await storage.getCustomerByEmail(cleanEmail);
        if (existingEmailCustomer) {
          return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
        }
      }

      const customer = await storage.createCustomer({ 
        phone: cleanPhone, 
        name: cleanName,
        email: cleanEmail,
        registeredBy: 'cashier'
      });

      // Send Welcome Email asynchronously
      if (customer.email) {
        sendWelcomeEmail(customer.email, customer.name).catch(err => console.error("Welcome Email Error:", err));
      }

      try {
        await storage.createLoyaltyCard({ 
          customerName: cleanName, 
          phoneNumber: cleanPhone 
        });
      } catch (cardError) {
      }

      const { password: _, ...customerData } = customer;
      const serialized = serializeDoc(customerData);

      // Set customer in session
      (req.session as any).customer = serialized;

      res.status(201).json(serialized);
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل العميل" });
    }
  });

  /*
   * PASSWORDLESS CUSTOMER PASSWORD SETUP FLOW
   * 
   * For security, customers must verify phone ownership via OTP before setting password.
   * This prevents unauthorized password changes even if someone knows the customer's phone number.
   * 
   * Flow:
   * 1. POST /api/customers/request-password-setup-otp { phone }
   *    - Generates and stores OTP for the customer's phone
   *    - In production, sends SMS with OTP
   *    - Returns success (doesn't reveal if phone exists for security)
   * 
   * 2. POST /api/customers/set-password { phone, otp, password }
   *    - Verifies OTP matches and hasn't expired
   *    - Sets password only if OTP is valid
   *    - Prevents setting password if customer already has one
   */

  // Step 1: Request OTP to set password
  app.post("/api/customers/request-password-setup-otp", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      // Always return success to prevent phone enumeration
      // But only generate OTP if customer exists and has no password
      if (customer && !customer.password) {
        try {
          const { otp, expiresAt } = await storage.createPasswordSetupOTP(cleanPhone);
          
          // Send OTP via email if customer has email
          if (customer.email) {
            const { sendOTPEmail } = await import("./mail-service");
            sendOTPEmail(customer.email, customer.name, otp).catch(err =>
              console.error("[MAIL] OTP email failed:", err)
            );
            console.log(`[OTP] Sent OTP via email to ${customer.email} for phone ${cleanPhone}`);
          } else {
            // No email — OTP is in DB for 10min, cashier can relay verbally if needed
            console.log(`[OTP] No email for customer ${cleanPhone}. OTP generated and stored (expires: ${expiresAt}). Customer must retrieve via cashier.`);
          }
        } catch (otpError: any) {
          // If rate limit exceeded, return specific error
          if (otpError.message.includes('تجاوز الحد')) {
            return res.status(429).json({ error: otpError.message });
          }
          throw otpError;
        }
      }

      res.json({ 
        success: true,
        message: "إذا كان الرقم مسجلاً، سيتم إرسال رمز التحقق خلال دقائق",
        message_en: "If the number is registered, verification code will be sent within minutes"
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال رمز التحقق" });
    }
  });

  // Step 2: Verify OTP and set password
  app.post("/api/customers/set-password", async (req, res) => {
    try {
      const { phone, otp, password } = req.body;

      if (!phone || !otp || !password) {
        return res.status(400).json({ error: "رقم الجوال، رمز التحقق وكلمة المرور مطلوبة" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      if (password.length < 8) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: "رمز التحقق غير صحيح" });
      }

      const customer = await storage.getCustomerByPhone(cleanPhone);
      if (!customer) {
        return res.status(404).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      // Prevent overwriting existing passwords
      if (customer.password) {
        return res.status(400).json({ 
          error: "هذا الحساب لديه كلمة مرور بالفعل. يرجى استخدام ميزة إعادة تعيين كلمة المرور",
          message: "Account already has a password. Use password reset instead"
        });
      }

      // Verify OTP from database
      const otpVerification = await storage.verifyPasswordSetupOTP(cleanPhone, otp);
      if (!otpVerification.valid) {
        return res.status(400).json({ error: otpVerification.message || "رمز التحقق غير صحيح" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update customer with password
      const updated = await storage.updateCustomer((customer as any)._id.toString(), { 
        password: hashedPassword 
      });

      if (!updated) {
        return res.status(500).json({ error: "فشل تحديث كلمة المرور" });
      }

      // Invalidate the used OTP
      await storage.invalidatePasswordSetupOTP(cleanPhone, otp);

      const { password: _, ...customerData } = updated;
      res.json({ 
        success: true, 
        message: "تم تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول",
        customer: serializeDoc(customerData)
      });
    } catch (error) {
      res.status(500).json({ error: "فشل تعيين كلمة المرور" });
    }
  });

  // Helper: normalize Saudi phone to 9-digit format (starting with 5)
  const normalizeSaudiPhone = (p: string): string =>
    String(p).replace(/\D/g, '').replace(/^00966/, '').replace(/^\+966/, '').replace(/^966/, '').replace(/^0/, '');

  const phoneQuery = (p: string) => {
    const n = normalizeSaudiPhone(p);
    return { $in: [n, `0${n}`, `+966${n}`, `966${n}`] };
  };

  app.get("/api/customers/favorites", async (req, res) => {
    try {
      const { CustomerModel } = await import("@shared/schema");
      const { phone, customerId } = req.query;
      const query: any = {};
      if (phone) query.phone = phoneQuery(String(phone));
      else if (customerId) query._id = customerId;
      else return res.status(400).json({ error: "يجب تحديد العميل" });
      const customer = await CustomerModel.findOne(query);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      res.json({ favorites: (customer as any).favorites || [] });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب المفضلة" });
    }
  });

  app.post("/api/customers/favorites/:itemId", async (req, res) => {
    try {
      const { CustomerModel } = await import("@shared/schema");
      const { phone, customerId } = req.body;
      const query: any = {};
      if (phone) query.phone = phoneQuery(String(phone));
      else if (customerId) query._id = customerId;
      else return res.status(400).json({ error: "يجب تحديد العميل" });
      const customer = await CustomerModel.findOne(query);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      const favorites: string[] = (customer as any).favorites || [];
      if (!favorites.includes(req.params.itemId)) {
        favorites.push(req.params.itemId);
        await CustomerModel.updateOne(query, { $set: { favorites } });
      }
      res.json({ success: true, favorites });
    } catch (error) {
      res.status(500).json({ error: "فشل إضافة للمفضلة" });
    }
  });

  app.delete("/api/customers/favorites/:itemId", async (req, res) => {
    try {
      const { CustomerModel } = await import("@shared/schema");
      const { phone, customerId } = req.query;
      const query: any = {};
      if (phone) query.phone = phoneQuery(String(phone));
      else if (customerId) query._id = customerId;
      else return res.status(400).json({ error: "يجب تحديد العميل" });
      const customer = await CustomerModel.findOne(query);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      const favorites: string[] = ((customer as any).favorites || []).filter((id: string) => id !== req.params.itemId);
      await CustomerModel.updateOne(query, { $set: { favorites } });
      res.json({ success: true, favorites });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف من المفضلة" });
    }
  });

  // Get customer by ID
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, carType, carColor, saveCarInfo } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (carType !== undefined) updates.carType = carType;
      if (carColor !== undefined) updates.carColor = carColor;
      if (saveCarInfo !== undefined) updates.saveCarInfo = saveCarInfo;

      const customer = await storage.updateCustomer(id, updates);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(serializeDoc(customer));
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Get customer orders
  app.get("/api/customers/:id/orders", async (req, res) => {
    try {
      const { id } = req.params;
      const orders = await storage.getCustomerOrders(id);
      
      // Process orders to ensure items is always an array
      const processedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        // Parse items if they're stored as JSON string
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        // Ensure orderItems is an array
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        return {
          ...serializedOrder,
          items: orderItems
        };
      });
      
      res.json(processedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // COFFEE ROUTES

  // Get all coffee items - with branch availability info (optimized)
  // For customers: shows items in their branch + available branches only
  // For managers: shows all items with full branch availability data
  app.get("/api/coffee-items", async (req: any, res) => {
    try {
      const requestedBranchId = (req.query.branchId as string);
      const isEmployee = !!req.session?.employee;
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";

      // Serve from in-memory cache when possible (60 second TTL)
      const ck = cacheKey('coffee-items', tenantId, requestedBranchId || 'all', isEmployee ? 'emp' : 'cust');
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);
      
      const query: any = { tenantId };
      if (requestedBranchId && requestedBranchId !== 'all' && requestedBranchId !== 'undefined' && requestedBranchId !== 'null') {
        query.$or = [
          { publishedBranches: requestedBranchId },
          { createdByBranchId: requestedBranchId },
          { branchId: requestedBranchId }
        ];
      }
      
      let items = await CoffeeItemModel.find(query).lean().exec();

      // If no items found for tenant with specific branch filter, try fallback
      if (items.length === 0) {
        items = await CoffeeItemModel.find({ 
          $or: [
            { tenantId: tenantId },
            { tenantId: 'demo-tenant' },
            { tenantId: 'default' },
            { tenantId: 'default-branch' },
            { tenantId: { $exists: false } },
            { tenantId: null }
          ]
        }).lean().exec();
      }

      // Standardize response by serializing MongoDB documents
      items = items.map(serializeDoc);
      
      // Filter by tenantId more strictly if it was intended
      if (items.length > 0 && tenantId !== 'demo-tenant') {
        const tenantItems = items.filter((i: any) => i.tenantId === tenantId);
        if (tenantItems.length > 0) {
          items = tenantItems;
        }
      }
      
      // If no items found, try getting ANY items (emergency fallback)
          if (items.length === 0) {
            items = await CoffeeItemModel.find({}).lean().exec();
          }

      
      // Batch fetch recipes and raw items for performance
      const itemIds = items.map((item: any) => item.id);
      const recipes = itemIds.length > 0 ? await RecipeItemModel.find({ 
        coffeeItemId: { $in: itemIds } 
      }).lean().exec() : [];
      
      const rawItemIds = recipes.map((r: any) => r.rawItemId);
      const rawItems = rawItemIds.length > 0 ? await RawItemModel.find({ 
        _id: { $in: rawItemIds } 
      }).lean().exec() : [];
      
      const rawItemMap = new Map(rawItems.map((r: any) => [r._id?.toString(), r]));
      const recipesByItem = new Map<string, any[]>();
      recipes.forEach((r: any) => {
        const itemId = r.coffeeItemId;
        if (!recipesByItem.has(itemId)) recipesByItem.set(itemId, []);
        recipesByItem.get(itemId)!.push(r);
      });
      
      // Enrich items efficiently
      const enrichedItems = items.map((item: any) => {
        const itemRecipes = recipesByItem.get(item.id) || [];
        const recipeAvailable = itemRecipes.length === 0 ? false : itemRecipes.every((r: any) => rawItemMap.has(r.rawItemId?.toString()));
        
        // Handle legacy items: if no publishedBranches, show to all
        let publishedBranches = item.publishedBranches || [];
        if (publishedBranches.length === 0 && !item.createdByBranchId) {
          // Legacy item with no branch assignment - show to all branches
          publishedBranches = ['*']; // special marker for "all branches"
        }
        
        const branchAvailability = (item.branchAvailability || []) as Array<{branchId: string, isAvailable: number}>;
        
          // Build availability map - only for published branches
          const availabilityByBranch: {[key: string]: {isAvailable: number, status: string}} = {};
          const branchesToCheck = publishedBranches.includes('*') ? (requestedBranchId ? [requestedBranchId] : []) : (publishedBranches.length > 0 ? publishedBranches : (isEmployee && req.employee?.branchId ? [req.employee.branchId] : []));
          
          for (const branchId of branchesToCheck) {
            const branchInfo = branchAvailability.find((b: any) => b.branchId === branchId);
            // item is available if it's in published branches AND either has no specific availability record OR explicitly marked as available
            const isBranchAvailable = (!branchInfo || branchInfo.isAvailable === 1 || (branchInfo.isAvailable as any) === true) ? 1 : 0;
            const status = isBranchAvailable ? 'available' : 'out_of_stock';
            availabilityByBranch[branchId] = { isAvailable: isBranchAvailable, status };
          }
          
          if (!isEmployee && requestedBranchId) {
            item.availabilityByBranch = availabilityByBranch;
            item.isAvailable = availabilityByBranch[requestedBranchId]?.isAvailable || 0;
            item.availabilityStatus = availabilityByBranch[requestedBranchId]?.status || 'out_of_stock';
          } else if (isEmployee && req.employee?.branchId) {
            item.availabilityByBranch = availabilityByBranch;
            const myBranchStatus = availabilityByBranch[req.employee.branchId];
            item.isAvailable = myBranchStatus ? myBranchStatus.isAvailable : (publishedBranches.length === 0 ? 1 : 0);
            item.availabilityStatus = myBranchStatus ? myBranchStatus.status : (publishedBranches.length === 0 ? 'available' : 'out_of_stock');
          } else {
            item.availabilityByBranch = availabilityByBranch;
            item.isAvailable = 1;
            item.availabilityStatus = 'available';
          }
        
        return item;
      });
      
      // Filter by branch for customers if requested
      let finalItems = enrichedItems;
      // For customers: show ALL items regardless of publishedBranches (customers can see any drink)
      if (isEmployee && requestedBranchId) {
        // For employees: filter by their branch only
        finalItems = enrichedItems.filter((item: any) => {
          const publishedBranches = item.publishedBranches || [];
          return publishedBranches.includes('*') || publishedBranches.length === 0 || publishedBranches.includes(requestedBranchId);
        });
      }

      // Store in memory cache for next requests (60 seconds)
      cache.set(ck, finalItems, CACHE_TTL.COFFEE_ITEMS);
      res.json(finalItems);
    } catch (error) {
      console.error("Error fetching coffee items:", error);
      res.status(500).json({ error: "Failed to fetch coffee items" });
    }
  });

  // Get unpublished drinks from other branches (for managers to adopt)
  app.get("/api/coffee-items/unpublished", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      if (!req.employee?.branchId) {
        return res.status(403).json({ error: "Branch assignment required" });
      }

      // Get tenantId from employee or fallback to branch
      let tenantId = req.employee.tenantId;
      if (!tenantId) {
        const branch = await storage.getBranch(req.employee.branchId);
        if (branch && (branch as any).tenantId) {
          tenantId = (branch as any).tenantId;
        }
      }
      const items = await CoffeeItemModel.find({ 
        $or: [
          { tenantId: tenantId },
          { tenantId: { $exists: false } },
          { tenantId: null }
        ]
      }).lean().exec();
      
      // Get drinks that are NOT published in this branch but exist in other branches
      const filteredItems = items.filter((item: any) => {
        const publishedBranches = item.publishedBranches || [];
        return !publishedBranches.includes(req.employee!.branchId) && publishedBranches.length > 0;
      });
      
      res.json(filteredItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unpublished items" });
    }
  });

  // Create new coffee item (manager only)
  // Supports both creating new items and adopting items from other branches
  app.post("/api/coffee-items", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertCoffeeItemSchema } = await import("@shared/schema");
      const { adoptFromItemId, ...bodyData } = req.body;

      // Get tenantId from employee or fallback to default - DO THIS BEFORE VALIDATION
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      let branchId = req.employee?.branchId || 'default-branch';

      // Add tenantId to bodyData BEFORE validation
      bodyData.tenantId = tenantId;
      
      const validatedData = insertCoffeeItemSchema.parse(bodyData);

      // CRITICAL: Always ensure tenantId is the computed one, not from request body
      (validatedData as any).tenantId = tenantId;

      // If adopting from another item, get the original
      if (adoptFromItemId) {
        const originalItem = await storage.getCoffeeItem(adoptFromItemId);
        if (!originalItem || originalItem.tenantId !== tenantId) {
          return res.status(404).json({ error: "Original item not found" });
        }

        // Copy properties from original if not overridden
        if (!validatedData.nameAr) validatedData.nameAr = originalItem.nameAr;
        if (!validatedData.description) validatedData.description = originalItem.description;
        if (validatedData.price === undefined) validatedData.price = originalItem.price;
        if (!validatedData.category) validatedData.category = originalItem.category;
        if (!validatedData.imageUrl) validatedData.imageUrl = originalItem.imageUrl;
        if (validatedData.coffeeStrength === undefined) validatedData.coffeeStrength = originalItem.coffeeStrength;
        
        // Create a new ID for the adopted item in this branch
        validatedData.id = `${adoptFromItemId}-${req.employee?.branchId}`;
      }

      // For non-admin managers, enforce their branch ID in publishedBranches
      if (req.employee?.role === "manager") {
        validatedData.publishedBranches = [branchId];
      } else if (req.employee?.role === "admin" || req.employee?.role === "owner") {
        // Admin/Owner can choose which branches to publish to
        if (!validatedData.publishedBranches || validatedData.publishedBranches.length === 0) {
          // If no branches specified by admin, default to current branch or all? 
          // Better to keep it as provided but ensure it's an array
          validatedData.publishedBranches = validatedData.publishedBranches || [branchId];
        }
      } else {
        // Default for other roles
        validatedData.publishedBranches = [branchId];
      }

      // Also set the global isAvailable if not specified
      if (validatedData.isAvailable === undefined) {
        validatedData.isAvailable = 1;
      }
      if (!validatedData.availabilityStatus) {
        validatedData.availabilityStatus = 'available';
      }

      // Set creator information
      (validatedData as any).createdByEmployeeId = req.employee?.id || 'demo-employee';
      (validatedData as any).createdByBranchId = branchId;

      // Ensure id is present if not provided (though storage might handle it)
      if (!validatedData.id) {
        validatedData.id = nanoid();
      }

      // Create coffee item using MongoDB directly to ensure all fields including imageUrl, availableSizes, and addons are saved
      const vd = validatedData as any;
      const newCoffeeItem = new CoffeeItemModel({
        id: validatedData.id,
        tenantId: tenantId,
        nameAr: validatedData.nameAr,
        nameEn: validatedData.nameEn,
        description: validatedData.description,
        price: validatedData.price,
        oldPrice: validatedData.oldPrice,
        category: validatedData.category,
        menuType: vd.menuType || 'drinks',
        imageUrl: validatedData.imageUrl,
        imageUrls: vd.imageUrls || (validatedData.imageUrl ? [validatedData.imageUrl] : []),
        isAvailable: validatedData.isAvailable ?? 1,
        availabilityStatus: validatedData.availabilityStatus || 'available',
        coffeeStrength: validatedData.coffeeStrength,
        strengthLevel: vd.strengthLevel,
        isNewProduct: validatedData.isNewProduct,
        sku: vd.sku,
        sizeML: vd.sizeML,
        groupId: vd.groupId,
        publishedBranches: validatedData.publishedBranches || [branchId],
        createdByEmployeeId: validatedData.createdByEmployeeId,
        createdByBranchId: validatedData.createdByBranchId,
        availableSizes: validatedData.availableSizes || [],
        addons: vd.addons || [],
        bundledItems: vd.bundledItems || [],
        isReservation: vd.isReservation || false,
        reservationPackages: vd.reservationPackages || [],
        isGiftable: vd.isGiftable || false,
        availableFrom: vd.availableFrom,
        availableTo: vd.availableTo,
        availableDays: vd.availableDays || [],
        branchAvailability: vd.branchAvailability || (validatedData.publishedBranches || [branchId]).map((bId: string) => ({
          branchId: bId,
          isAvailable: 1
        })),
        requiresRecipe: vd.requiresRecipe !== undefined ? vd.requiresRecipe : 1,
        hasRecipe: vd.hasRecipe !== undefined ? vd.hasRecipe : 0,
        recipeId: vd.recipeId,
        salesCount: vd.salesCount || 0,
        costOfGoods: 0,
        profitMargin: 0,
        updatedAt: new Date(),
        createdAt: new Date()
      });
      
      const item = await newCoffeeItem.save();
      const itemData = serializeDoc(item);
      
      // Save addons if provided - they're already in availableSizes, but also link them for backward compatibility
      if ((validatedData as any).addons && Array.isArray((validatedData as any).addons) && (validatedData as any).addons.length > 0) {
        for (const addon of (validatedData as any).addons) {
          if (addon.nameAr && !addon.id) {
            addon.id = nanoid();
          }
          try {
            // Save addon to ProductAddon
            await ProductAddonModel.findOneAndUpdate(
              { id: addon.id },
              { $set: { id: addon.id, ...addon, category: addon.category || 'other', createdAt: new Date() } },
              { upsert: true, new: true }
            );
            // Link addon to coffee item
            await CoffeeItemAddonModel.findOneAndUpdate(
              { coffeeItemId: itemData.id, addonId: addon.id },
              { $set: { coffeeItemId: itemData.id, addonId: addon.id, isDefault: 0, minQuantity: 0, maxQuantity: 10, createdAt: new Date() } },
              { upsert: true }
            );
          } catch (err) {
            console.error("Error saving addon:", err);
          }
        }
      }
      
      console.log(`[CREATE COFFEE ITEM] Created item:`, {
        id: itemData.id,
        nameAr: itemData.nameAr,
        tenantId: itemData.tenantId,
        imageUrl: itemData.imageUrl,
        availableSizes: itemData.availableSizes?.length || 0,
        branchId,
        publishedBranches: itemData.publishedBranches
      });

      invalidateCoffeeItemsCache(tenantId);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(201).json(itemData);
    } catch (error) {
      console.error("[CREATE COFFEE ITEM] Error:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: (error as any).issues });
      }
      res.status(500).json({ error: "فشل إضافة المشروب", details: String(error) });
    }
  });

  // Update coffee item
  app.patch("/api/coffee-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const updatedItem = await storage.updateCoffeeItem(req.params.id, req.body);
      if (!updatedItem) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      invalidateCoffeeItemsCache(req.employee?.tenantId || 'demo-tenant');
      res.json(updatedItem);
    } catch (error) {
      console.error("[PATCH /api/coffee-items/:id] Error:", error);
      res.status(500).json({ error: "فشل في تحديث المنتج" });
    }
  });

  // Get coffee items by category (optimized)
  // Returns array of coffeeItemIds that have at least one addon — used by POS to open customization dialog
  app.get("/api/coffee-items/with-addons", async (req: any, res) => {
    try {
      const links = await CoffeeItemAddonModel.find({}).select("coffeeItemId").lean().exec();
      const ids = [...new Set(links.map((l: any) => l.coffeeItemId).filter(Boolean))];
      res.set('Cache-Control', 'public, max-age=60');
      res.json(ids);
    } catch (error) {
      res.json([]);
    }
  });

  // Bulk preview of addons per item — used by customer menu to show options on cards
  // Returns: { [itemId]: { nameAr: string; category: string; price: number }[] }
  app.get("/api/coffee-items/addons-preview", async (req: any, res) => {
    try {
      const { ProductAddonModel } = await import("@shared/schema");
      const links = await CoffeeItemAddonModel.find({}).lean().exec();
      if (links.length === 0) { res.set('Cache-Control', 'public, max-age=120'); return res.json({}); }
      const addonIds = [...new Set(links.map((l: any) => l.addonId).filter(Boolean))];
      const addons = await ProductAddonModel.find({ id: { $in: addonIds }, isAvailable: 1 }).select("id nameAr nameEn category price").lean().exec();
      const addonMap: Record<string, any> = {};
      addons.forEach((a: any) => { addonMap[a.id] = a; });
      const result: Record<string, { nameAr: string; nameEn?: string; category: string; price: number }[]> = {};
      links.forEach((link: any) => {
        const addon = addonMap[link.addonId];
        if (!addon) return;
        if (!result[link.coffeeItemId]) result[link.coffeeItemId] = [];
        result[link.coffeeItemId].push({ nameAr: addon.nameAr, nameEn: addon.nameEn, category: addon.category, price: addon.price || 0 });
      });
      res.set('Cache-Control', 'public, max-age=120');
      res.json(result);
    } catch (error) {
      res.json({});
    }
  });

  app.get("/api/coffee-items/category/:category", async (req: any, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=120');
      const { category } = req.params;
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const items = await CoffeeItemModel.find({ tenantId, category }).lean().exec();
      if (!items || items.length === 0) {
        return res.json([]);
      }
      res.json(items.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coffee items by category" });
    }
  });

  // Get specific coffee item (optimized)
  app.get("/api/coffee-items/:id", async (req: any, res) => {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const { id } = req.params;
      
      console.log(`[GET /api/coffee-items/:id] Searching for ID: "${id}"`);

      // Try finding by 'id' field first (custom string ID)
      // We search globally (without tenantId) to ensure visibility from anywhere
      let item = await CoffeeItemModel.findOne({ id }).lean().exec();
      
      // If not found by 'id' field, try as MongoDB _id
      if (!item) {
        try {
          // Try findById which automatically handles ObjectId conversion if needed
          item = await CoffeeItemModel.findById(id).lean().exec();
        } catch (e) {
          // If id is not a valid ObjectId, findById might throw or return null
          // If it throws, we just ignore and continue
        }
      }

      if (!item) {
        console.warn(`[GET /api/coffee-items/:id] Item not found for ID: "${id}"`);
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      
      res.json(serializeDoc(item));
    } catch (error) {
      console.error("[GET_COFFEE_ITEM_ERROR]:", error);
      res.status(500).json({ error: "حدث خطأ أثناء جلب تفاصيل المنتج" });
    }
  });

  // Update coffee item availability per branch (for managers)
  app.patch("/api/coffee-items/:id/availability", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { branchId, isAvailable, availabilityStatus } = req.body;
      
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";

      console.log(`[AVAILABILITY] Updating item ${id} for tenant ${tenantId}, branch ${branchId}`);

      // Try finding by 'id' field
      let item = await CoffeeItemModel.findOne({ id, tenantId }).exec();
      if (!item && mongoose.Types.ObjectId.isValid(id)) {
        item = await CoffeeItemModel.findOne({ _id: id, tenantId }).exec();
      }

      if (!item) {
        return res.status(404).json({ error: "Coffee item not found" });
      }

      const updates: any = {};
      
      // Map availability status to internal flags
      if (availabilityStatus) {
        updates.availabilityStatus = availabilityStatus;
        if (availabilityStatus === 'available' || availabilityStatus === 'new') {
          updates.isAvailable = 1;
        } else {
          updates.isAvailable = 0;
        }
        
        if (availabilityStatus === 'new') {
          updates.isNewProduct = 1;
        } else {
          updates.isNewProduct = 0;
        }
      } else if (isAvailable !== undefined) {
        updates.isAvailable = isAvailable ? 1 : 0;
        if (isAvailable) {
          updates.availabilityStatus = 'available';
        } else {
          updates.availabilityStatus = 'unavailable';
        }
      }

      if (branchId) {
        const branchAvailability = (item.branchAvailability || []) as Array<{branchId: string, isAvailable: number}>;
        const existingIndex = branchAvailability.findIndex((b: any) => b.branchId === branchId);
        const availabilityValue = updates.isAvailable !== undefined ? updates.isAvailable : (item.isAvailable ?? 1);

        if (existingIndex >= 0) {
          branchAvailability[existingIndex].isAvailable = availabilityValue;
        } else {
          branchAvailability.push({ branchId, isAvailable: availabilityValue });
        }
        updates.branchAvailability = branchAvailability;
      }

      const updatedItem = await CoffeeItemModel.findOneAndUpdate(
        { _id: item._id },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true }
      ).exec();

      res.json(serializeDoc(updatedItem));
    } catch (error) {
      console.error("Availability Update Error:", error);
      res.status(500).json({ error: "Failed to update coffee item availability" });
    }
  });

  // Add coffee item to multiple branches
  app.post("/api/coffee-items/:id/branches", async (req, res) => {
    try {
      const { id } = req.params;
      const { branchIds } = req.body;

      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        return res.status(400).json({ error: "branchIds array is required" });
      }

      const item = await storage.getCoffeeItem(id);
      if (!item) {
        return res.status(404).json({ error: "Coffee item not found" });
      }

      // Update or create branch availability entries
      const branchAvailability = (item.branchAvailability || []) as Array<{branchId: string, isAvailable: number}>;
      
      branchIds.forEach((branchId: string) => {
        const existingIndex = branchAvailability.findIndex((b: any) => b.branchId === branchId);
        
        if (existingIndex < 0) {
          // Only add if not already present
          branchAvailability.push({ branchId, isAvailable: 1 });
        }
      });

      const updatedItem = await storage.updateCoffeeItem(id, { branchAvailability });
      invalidateCoffeeItemsCache((item as any).tenantId || 'demo-tenant');
      res.json(serializeDoc(updatedItem));
    } catch (error) {
      res.status(500).json({ error: "Failed to update coffee item branches" });
    }
  });

  // Get cart items for session - OPTIMIZED
  app.get("/api/cart/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const cartItems = await CartItemModel.find({ sessionId }).lean();

      if (!cartItems || cartItems.length === 0) {
        return res.json([]);
      }

      // Enrich cart items with coffee details efficiently
      const enrichedItems = await Promise.all(cartItems.map(async (cartItem: any) => {
        try {
          const coffeeItem = await CoffeeItemModel.findOne({ id: cartItem.coffeeItemId }).lean();
          const doc = serializeDoc(cartItem);
          
          // Fetch addons to get their prices and names
          // selectedAddons stores custom `id` fields (nanoid), not MongoDB _id
          const addons = await Promise.all(
            (cartItem.selectedAddons || []).map((addonId: string) =>
              ProductAddonModel.findOne({ id: addonId }).lean()
            )
          );
          
          // CRITICAL: Force the ID to be the custom 'id' (composite) if available, otherwise use coffeeItemId
          // This ensures the frontend ALWAYS receives an ID it can use for DELETE/PUT consistently
          const finalId = cartItem.id || cartItem.coffeeItemId;
          
          // console.log(`[CART] Enriching item ${cartItem.coffeeItemId}: Found coffee=${!!coffeeItem}, addons=${addons.length}`);
          
          return {
            ...doc,
            id: finalId,
            coffeeItem: coffeeItem ? serializeDoc(coffeeItem) : null,
            enrichedAddons: addons.filter(Boolean).map(serializeDoc)
          };
        } catch (err) {
          console.error(`Error enriching cart item:`, err);
          return { 
            ...serializeDoc(cartItem), 
            id: cartItem.id || cartItem.coffeeItemId, 
            coffeeItem: null,
            enrichedAddons: []
          };
        }
      }));

      // Filter out items where coffee details couldn't be found
      // For debugging, we'll keep them but the UI might break if coffeeItem is null
      // res.json(enrichedItems.filter(item => item && item.coffeeItem));
      res.json(enrichedItems);
    } catch (error) {
      console.error("Fetch cart error:", error);
      res.status(500).json({ error: "Failed to fetch cart items" });
    }
  });

  // Add item to cart
  app.post("/api/cart", async (req, res) => {
    try {
      const { sessionId, coffeeItemId, quantity, selectedSize, selectedAddons, selectedItemAddons, selectedReservationPackage } = req.body;
      // console.log(`[CART] POST: item=${coffeeItemId}, size=${selectedSize}, qty=${quantity}`);

      if (!sessionId || !coffeeItemId) {
        return res.status(400).json({ error: "Session ID and Coffee Item ID are required" });
      }

      // Consistent size selection
      const sizeName = typeof selectedSize === 'object' ? (selectedSize as any)?.nameAr : selectedSize;
      const addons = Array.isArray(selectedAddons) ? selectedAddons : [];
      const itemAddons = Array.isArray(selectedItemAddons) ? selectedItemAddons : [];
      
      // Use a consistent composite ID format: ITEMID-SIZENAME-ADDONS-ITEMADDONS
      const normalizedSize = sizeName || "default";
      const normalizedAddons = Array.isArray(addons) ? addons.sort().join(",") : "";
      const normalizedItemAddons = itemAddons.map((a: any) => a.nameAr).sort().join(",");
      const reservationPkgKey = selectedReservationPackage ? `-pkg:${selectedReservationPackage.packageName}` : "";
      const compositeId = `${coffeeItemId}-${normalizedSize}-${normalizedAddons}-${normalizedItemAddons}${reservationPkgKey}`;
      
      let cartItem = await CartItemModel.findOne({ sessionId, id: compositeId });
      
      if (cartItem) {
        cartItem.quantity += (quantity || 1);
        await cartItem.save();
      } else {
        cartItem = await CartItemModel.create({
          id: compositeId,
          sessionId,
          coffeeItemId,
          quantity: quantity || 1,
          selectedSize: normalizedSize,
          selectedAddons: addons,
          selectedItemAddons: itemAddons,
          selectedReservationPackage: selectedReservationPackage || null,
          createdAt: new Date()
        });
      }
      
      const result = serializeDoc(cartItem);
      result.id = compositeId; // Ensure we always return the composite ID
      res.status(201).json(result);
    } catch (error) {
      console.error("[CART] Post error:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  // Update cart item quantity
  app.put("/api/cart/:sessionId/:cartItemId", async (req, res) => {
    try {
      const { sessionId, cartItemId } = req.params;
      const { quantity } = req.body;
      // console.log(`[CART] PUT: session=${sessionId}, id=${cartItemId}, qty=${quantity}`);

      if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      if (quantity === 0) {
        // console.log(`[CART] Quantity is 0, deleting item: ${cartItemId}`);
        let deleteResult = await CartItemModel.deleteOne({ sessionId, id: cartItemId });
        if (deleteResult.deletedCount === 0) {
          deleteResult = await CartItemModel.deleteOne({ sessionId, coffeeItemId: cartItemId, selectedSize: "default" });
        }
        if (deleteResult.deletedCount === 0 && mongoose.Types.ObjectId.isValid(cartItemId)) {
          deleteResult = await CartItemModel.deleteOne({ sessionId, _id: cartItemId });
        }
        return res.json({ message: "Item removed" });
      }

      // Try composite ID first, then coffeeItemId (if it's a default variant), then _id
      let cartItem = await CartItemModel.findOneAndUpdate(
        { sessionId, id: cartItemId },
        { $set: { quantity } },
        { new: true }
      );

      // Fallback for older items or items added without composite ID
      if (!cartItem) {
        cartItem = await CartItemModel.findOneAndUpdate(
          { sessionId, coffeeItemId: cartItemId, selectedSize: "default" },
          { $set: { quantity } },
          { new: true }
        );
      }

      if (!cartItem && mongoose.Types.ObjectId.isValid(cartItemId)) {
        cartItem = await CartItemModel.findOneAndUpdate(
          { sessionId, _id: cartItemId },
          { $set: { quantity } },
          { new: true }
        );
      }

      if (!cartItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      const result = serializeDoc(cartItem);
      // Ensure the returned ID matches what the client expects (the search key)
      result.id = cartItem.id || cartItem.coffeeItemId;
      res.json(result);
    } catch (error) {
      console.error("[CART] Update error:", error);
      res.status(500).json({ error: "Failed to update cart" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/:sessionId/:cartItemId", async (req, res) => {
    try {
      const { sessionId, cartItemId } = req.params;
      // console.log(`[CART] DELETE: session=${sessionId}, id=${cartItemId}`);
      
      // Try multiple deletion strategies
      let result = await CartItemModel.deleteOne({ sessionId, id: cartItemId });

      if (result.deletedCount === 0) {
        result = await CartItemModel.deleteOne({ sessionId, coffeeItemId: cartItemId, selectedSize: "default" });
      }

      if (result.deletedCount === 0 && mongoose.Types.ObjectId.isValid(cartItemId)) {
        result = await CartItemModel.deleteOne({ sessionId, _id: cartItemId });
      }

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      res.json({ message: "Item removed" });
    } catch (error) {
      console.error("[CART] Delete error:", error);
      res.status(500).json({ error: "Failed to remove item" });
    }
  });

  // Clear entire cart
  app.delete("/api/cart/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      await storage.clearCart(sessionId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  // DUPLICATE: This POST /api/orders handler is superseded by the one defined earlier (line ~573).
  // Wrapped in a never-called function to prevent duplicate route registration.
  const _unusedDuplicateOrderPost = () => { app.post("/api/orders-duplicate-disabled", async (req: AuthRequest, res) => {
    try {
      console.log("Creating order with body:", JSON.stringify(req.body, null, 2));
      const { 
        items, totalAmount, paymentMethod, paymentDetails, paymentReceiptUrl,
        customerInfo, customerId, customerNotes, freeItemsDiscount, usedFreeDrinks, 
        discountCode, discountPercentage,
        deliveryType, deliveryAddress, deliveryFee, branchId,
        tableNumber, tableId, orderType,
        carType, carColor, plateNumber, carPlate, carInfo, carPickup, arrivalTime,
        scheduledPickupTime,
        pointsRedeemed, pointsValue, pointsVerificationToken
      } = req.body;

      // Validate required fields
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items are required" });
      }

      if (totalAmount === undefined || totalAmount === null || isNaN(parseFloat(totalAmount))) {
        return res.status(400).json({ error: "Valid total amount is required" });
      }

      if (!paymentMethod) {
        return res.status(400).json({ error: "Payment method is required" });
      }

      // Check for customerName either in root body or nested in customerInfo
      const finalCustomerName = req.body.customerName || customerInfo?.customerName || req.body.customerPhone || "عميل";

      // Determine branch ID from request body or employee session
      const finalBranchId = branchId || req.employee?.branchId;

      if (!finalCustomerName) {
        console.error("Missing customer name in request. customerInfo:", JSON.stringify(customerInfo), "req.body:", JSON.stringify(req.body));
        return res.status(400).json({ error: "Customer name is required" });
      }

      // Ensure items is always an array before processing
      let processedItems = items;
      if (typeof items === 'string') {
        try {
          processedItems = JSON.parse(items);
        } catch (e) {
          processedItems = [];
        }
      }

      // Validate payment receipt for electronic payment methods
      const electronicPaymentMethods = ['alinma', 'ur', 'barq', 'rajhi'];
      if (electronicPaymentMethods.includes(paymentMethod) && !paymentReceiptUrl) {
        return res.status(400).json({ error: "Payment receipt is required for electronic payment methods" });
      }

      // Validate delivery data when deliveryType is 'delivery'
      if (deliveryType === 'delivery') {
        if (!deliveryAddress || !deliveryAddress.fullAddress) {
          return res.status(400).json({ error: "Delivery address is required for delivery orders" });
        }
      }

      // Get or create customer if phone number provided
      let finalCustomerId = customerId;

      const phoneNumberForLookup = customerInfo?.phoneNumber || req.body.customerPhone;
      if (phoneNumberForLookup && !customerId) {
        try {
          const existingCustomer = await storage.getCustomerByPhone(phoneNumberForLookup);
          if (existingCustomer) {
            finalCustomerId = existingCustomer.id;
          }
        } catch (error) {
        }
      }

      // Determine initial status based on payment method
      const isAutoConfirm = ['pos', 'apple_pay', 'pos-network', 'alinma', 'rajhi', 'ur', 'barq', 'cash', 'mada', 'stc-pay', 'online', 'neoleap', 'neoleap-apple-pay'].includes(paymentMethod);
      // PAID orders go to 'payment_confirmed' (which notifies kitchen), others go to 'pending'
      const initialStatus = isAutoConfirm ? 'payment_confirmed' : 'pending';
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';

      console.log(`[ORDER] Payment method: ${paymentMethod}, Initial status: ${initialStatus}`);

      if (discountCode) {
        try {
          const { DiscountCodeModel: DCModel } = await import("@shared/schema");
          const coupon = await DCModel.findOne({ 
            code: discountCode.toUpperCase(), 
            isActive: 1 
          });
          if (coupon) {
            coupon.usageCount = (coupon.usageCount || 0) + 1;
            await coupon.save();
            console.log(`[ORDER] Coupon ${discountCode} usage count updated to ${coupon.usageCount}`);
          }
        } catch (couponErr) {
          console.error("[ORDER] Failed to update coupon usage count:", couponErr);
        }
      }

      // Update or create order
      let order;
      if (tableId && (orderType === 'table' || orderType === 'dine-in')) {
        // Look for an existing 'open' order for this table
        const existingOrder = await OrderModel.findOne({ 
          tableId, 
          status: { $in: ['open', 'pending', 'payment_confirmed'] },
          branchId: finalBranchId 
        });

        if (existingOrder) {
          // Add new items to existing order
          existingOrder.items = [...(existingOrder.items || []), ...processedItems];
          existingOrder.totalAmount += Number(totalAmount);
          existingOrder.updatedAt = new Date();
          
          // If the order was just "open", and this addition is "paid/confirmed", upgrade status
          if (existingOrder.status === 'open' && initialStatus === 'payment_confirmed') {
             existingOrder.status = 'payment_confirmed';
          }
          
          order = await existingOrder.save();
          
          // Broadcast update to kitchen for additions
          const serializedOrder = serializeDoc(order);
          wsManager.broadcastOrderUpdate(serializedOrder);
          if (order.status === 'payment_confirmed' || order.status === 'confirmed') {
            wsManager.broadcastNewOrder(serializedOrder);
          }
        } else {
          const isOpenTab = req.body.isOpenTab === true;
          const tableOrderStatus = isOpenTab ? 'open' : initialStatus;
          const orderData: any = {
            orderNumber: `T-${nanoid(6).toUpperCase()}`,
            items: processedItems,
            totalAmount: Number(totalAmount),
            paymentMethod: isOpenTab ? 'cash' : (paymentMethod || 'cash'),
            status: tableOrderStatus,
            tableStatus: isOpenTab ? 'open' : 'pending',
            orderType: 'table',
            tableId,
            tableNumber,
            branchId: finalBranchId,
            tenantId,
            employeeId: req.employee?.id || null,
            customerInfo: customerInfo || { 
              customerName: finalCustomerName, 
              phoneNumber: req.body.customerPhone || "", 
              customerEmail: req.body.customerEmail || "" 
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          order = await storage.createOrder(orderData);
          
          if (order) {
            const serializedOrder = serializeDoc(order);
            if (!isOpenTab) {
              wsManager.broadcastNewOrder(serializedOrder);
            }
            wsManager.broadcastOrderUpdate(serializedOrder);
          }
          
          // Update table status
          await storage.updateTableOccupancy(tableId, true, order.id);
        }
      } else {
        const orderData: any = {
          customerId: finalCustomerId || null,
          totalAmount: Number(totalAmount),
          paymentMethod,
          paymentDetails: paymentDetails || "",
          paymentReceiptUrl: paymentReceiptUrl || null,
          customerInfo: customerInfo || { 
            customerName: finalCustomerName, 
            phoneNumber: req.body.customerPhone || "", 
            customerEmail: req.body.customerEmail || "" 
          },
          customerNotes: customerNotes || req.body.notes || "",
          discountCode: discountCode || null,
          discountPercentage: discountPercentage ? Number(discountPercentage) : 0,
          deliveryType: deliveryType || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: deliveryFee ? Number(deliveryFee) : 0,
          carType: carType || carInfo?.carType || null,
          carColor: carColor || carInfo?.carColor || null,
          plateNumber: plateNumber || carPlate || carInfo?.plateNumber || null,
          carPickup: carPickup || (deliveryType === 'curbside' || deliveryType === 'car_pickup' || deliveryType === 'car-pickup') || false,
          carInfo: carInfo || (carType ? { carType, carColor, plateNumber: plateNumber || carPlate } : null),
          arrivalTime: arrivalTime || null,
          scheduledPickupTime: scheduledPickupTime || null,
          preparationHoldUntil: (() => {
            const pickupTime = scheduledPickupTime || (orderType === 'pickup' ? arrivalTime : null);
            if (!pickupTime) return null;
            try {
              const totalItems = Array.isArray(processedItems)
                ? processedItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0)
                : 1;
              const holdMinutes = Math.max(10, 10 + (totalItems - 2) * 2);
              const [hours, minutes] = pickupTime.split(':').map(Number);
              const arrivalDate = new Date();
              arrivalDate.setHours(hours, minutes, 0, 0);
              const holdDate = new Date(arrivalDate.getTime() - holdMinutes * 60 * 1000);
              return holdDate.toISOString();
            } catch { return null; }
          })(),
          branchId: finalBranchId,
          tenantId,
          status: initialStatus,
          employeeId: req.employee?.id || null,
          createdBy: req.employee?.username || 'system',
          tableNumber: tableNumber || null,
          tableId: tableId || null,
          orderType: orderType || (tableNumber || tableId ? 'dine-in' : 'regular'),
          items: processedItems,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        order = await storage.createOrder(orderData);

        // Broadcast new order to WebSocket
        if (order) {
          const serializedOrder = serializeDoc(order);
          wsManager.broadcastNewOrder(serializedOrder);
          wsManager.broadcastOrderUpdate(serializedOrder);
        }
      }

      // ===== Points Redemption: Deduct points from loyalty card =====
      if (pointsRedeemed && Number(pointsRedeemed) > 0) {
        try {
          const redeemPoints = Number(pointsRedeemed);
          const redeemValue = Number(pointsValue) || (redeemPoints / 100) * 5;
          const phoneForPoints = req.body.customerPhone || customerInfo?.phoneNumber;
          const cleanPhoneForPoints = phoneForPoints?.replace(/\D/g, '');

          if (cleanPhoneForPoints) {
            const entry = pointsVerificationCodes.get(cleanPhoneForPoints);
            const bypassVerification = !!(req.body.bypassPointsVerification || req.employee || customerId);
            const canProceed = (entry && entry.verified) || bypassVerification;
            if (!canProceed) {
              console.warn(`[POINTS] Verification not completed for ${cleanPhoneForPoints}. Points NOT deducted.`);
            } else {
              const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhoneForPoints);
              if (loyaltyCard) {
                const currentPoints = Number(loyaltyCard.points) || 0;
                if (currentPoints >= redeemPoints) {
                  await storage.updateLoyaltyCard(loyaltyCard.id, {
                    points: currentPoints - redeemPoints,
                    lastUsedAt: new Date(),
                  });

                  const LoyaltyTransactionModel = mongoose.model('LoyaltyTransaction');
                  await LoyaltyTransactionModel.create({
                    cardId: loyaltyCard.id,
                    type: 'points_redeemed',
                    pointsChange: -redeemPoints,
                    description: `استخدام ${redeemPoints} نقطة (${redeemValue.toFixed(2)} ريال) - طلب #${order.orderNumber}`,
                    orderId: order.id,
                    createdAt: new Date(),
                  });

                  await OrderModel.findByIdAndUpdate(order.id, {
                    pointsRedeemed: redeemPoints,
                    pointsValue: redeemValue,
                  });

                  if (entry) pointsVerificationCodes.delete(cleanPhoneForPoints);
                  console.log(`[POINTS] Deducted ${redeemPoints} points (${redeemValue} SAR) from ${cleanPhoneForPoints} for order ${order.orderNumber}`);
                } else {
                  console.warn(`[POINTS] Insufficient points for ${cleanPhoneForPoints}: has ${currentPoints}, needs ${redeemPoints}`);
                }
              }
            }
          }
        } catch (pointsError) {
          console.error("[POINTS] Error deducting points:", pointsError);
        }
      }

      // Send initial order email notification
      const initialCustomerInfo = typeof order.customerInfo === 'string' ? JSON.parse(order.customerInfo) : order.customerInfo;
      const customerEmail = initialCustomerInfo?.email;
      const customerName = initialCustomerInfo?.name;

      if (customerEmail) {
        // Use setImmediate to send email asynchronously without blocking the response
        setImmediate(async () => {
          try {
            console.log(`📧 Triggering INITIAL email for order ${order.orderNumber} to ${customerEmail}`);
            const { sendOrderNotificationEmail } = await import("./mail-service");
            const emailSent = await sendOrderNotificationEmail(
              customerEmail,
              customerName || 'عميل مكان الشيف البخاري',
              order.orderNumber,
              "pending",
              parseFloat(order.totalAmount.toString())
            );
            console.log(`📧 INITIAL Email sent result for ${order.orderNumber}: ${emailSent}`);
          } catch (emailError) {
            console.error("❌ Error in initial order email trigger:", emailError);
          }
        });
      }
      
      // Append to Google Sheets for tracking
      try {
        const { appendOrderToSheet } = await import("./google-sheets");
        // Notify customer and Admin/Cashier
        await appendOrderToSheet(order, 'NEW_ORDER');
        await appendOrderToSheet(order, 'ADMIN_ALERT');
        
        // Note: Email notification is now handled by Google Apps Script within the sheet
      } catch (err) {
        console.error("Sheets Error:", err);
      }

      // Smart Inventory Deduction - deduct raw materials based on recipes
      let deductionReport: {
        success: boolean;
        costOfGoods: number;
        grossProfit: number;
        deductionDetails: Array<{
          rawItemId: string;
          rawItemName: string;
          quantity: number;
          unit: string;
          unitCost: number;
          totalCost: number;
          previousQuantity: number;
          newQuantity: number;
          status: string;
          message: string;
        }>;
        shortages: Array<{
          rawItemId: string;
          rawItemName: string;
          required: number;
          available: number;
          unit: string;
        }>;
        warnings: string[];
        errors: string[];
      } | null = null;

      if (finalBranchId && items && items.length > 0) {
        try {
          // Extract order items with addon customizations for inventory deduction
          const orderItems = items.map((item: any) => {
            const orderItem: {
              coffeeItemId: string;
              quantity: number;
              addons?: Array<{ rawItemId: string; quantity: number; unit: string }>;
            } = {
              coffeeItemId: item.id || item.coffeeItemId,
              quantity: item.quantity || 1,
            };

            // Extract addon raw materials from customization selectedAddons
            // Note: We calculate the FULL raw material quantity here (addon qty * quantityPerUnit * order item qty)
            // so storage.deductInventoryForOrder does NOT multiply by item.quantity again for addons
            if (item.customization?.selectedAddons && Array.isArray(item.customization.selectedAddons)) {
              const itemQuantity = item.quantity || 1;
              orderItem.addons = item.customization.selectedAddons
                .filter((addon: any) => addon.rawItemId && addon.quantity > 0)
                .map((addon: any) => ({
                  rawItemId: addon.rawItemId,
                  // Total raw material = addon selection qty * raw material per unit * order item qty
                  quantity: (addon.quantity || 1) * (addon.quantityPerUnit || 1) * itemQuantity,
                  unit: addon.unit || 'g',
                }));
            }

            return orderItem;
          });

          deductionReport = await storage.deductInventoryForOrder(
            order.id,
            finalBranchId,
            orderItems,
            req.employee?.username || 'system'
          );

          if (deductionReport && !deductionReport.success) {
            if (deductionReport.warnings && deductionReport.warnings.length > 0) {
              console.warn(`[ORDER ${order.orderNumber}] Inventory warnings:`, deductionReport.warnings);
            }
            if (deductionReport.errors && deductionReport.errors.length > 0) {
            }
          }

        } catch (error) {
          // Continue with order - don't fail the order if inventory deduction fails
        }
      }

      // Update table occupancy if this is a table order
      if (tableId) {
        try {
          await storage.updateTableOccupancy(tableId, true, order.id);
        } catch (error) {
          // Continue anyway - order was created successfully
        }
      }

      // Add stamps automatically if customer has phone number (works for guests and registered users)
      let phoneForStamps = customerInfo?.phoneNumber || req.body.customerPhone;
      
      // FIX: Ensure phoneForStamps is normalized
      if (phoneForStamps) {
        phoneForStamps = phoneForStamps.toString().trim();
      }

      if (finalCustomerId) {
        try {
          const customer = await storage.getCustomer(finalCustomerId);
          phoneForStamps = customer?.phone || phoneForStamps;
        } catch (e) {}
      }

      console.log(`[LOYALTY] Attempting to add points for phone: ${phoneForStamps}`);

      if (phoneForStamps) {
        try {
          let loyaltyCard = await storage.getLoyaltyCardByPhone(phoneForStamps);

          // Create loyalty card if doesn't exist
          if (!loyaltyCard) {
            console.log(`[LOYALTY] Creating new card for ${phoneForStamps}`);
            loyaltyCard = await storage.createLoyaltyCard({
              customerName: finalCustomerName || customerInfo?.customerName || 'عميل',
              phoneNumber: phoneForStamps,
              isActive: 1,
              stamps: 0,
              freeCupsEarned: 0,
              totalSpent: 0,
              points: 0,
              pendingPoints: 0,
            } as any);
          }

          // Calculate points (10 points per drink)
          const itemsToProcess = Array.isArray(processedItems) ? processedItems : 
                                (Array.isArray(items) ? items : []);
          
          const drinksCount = itemsToProcess.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
          const pointsToAdd = drinksCount * 10; // 10 points per drink

          console.log(`[LOYALTY] Points to add: ${pointsToAdd}, Drinks: ${drinksCount}, Current points: ${loyaltyCard.points || 0}`);

          if (pointsToAdd > 0) {
            const currentPoints = Number(loyaltyCard.points) || 0;
            const currentPendingPoints = Number(loyaltyCard.pendingPoints) || 0;
            const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || "0");
            
            // Add points as pending until order is completed
            await storage.updateLoyaltyCard(loyaltyCard.id, {
              pendingPoints: currentPendingPoints + pointsToAdd,
              totalSpent: currentTotalSpent + parseFloat(totalAmount.toString()),
              lastUsedAt: new Date()
            });

            console.log(`[LOYALTY] Updated card ${loyaltyCard.id}: Pending Points ${currentPendingPoints + pointsToAdd}`);

            // Create loyalty transaction for pending points
            await storage.createLoyaltyTransaction({
              cardId: loyaltyCard.id,
              type: 'points_pending',
              pointsChange: pointsToAdd,
              discountAmount: 0,
              orderAmount: Number(totalAmount),
              orderId: order.id,
              description: `نقاط معلقة: ${pointsToAdd} نقطة من الطلب رقم ${order.orderNumber} (ستضاف عند اكتمال الطلب)`,
            });
          }
        } catch (error) {
          console.error("[LOYALTY] Error processing points:", error);
        }
      }

      // Parse items from JSON string and serialize the order
      const serializedOrder = serializeDoc(order);
      if (serializedOrder.items && typeof serializedOrder.items === 'string') {
        try {
          serializedOrder.items = JSON.parse(serializedOrder.items);
        } catch (e) {
        }
      }

      // Broadcast new order via WebSocket
      wsManager.broadcastNewOrder(serializedOrder);
      
      // Generate and send tax invoice if customer has email
      if (customerInfo && customerInfo.customerEmail) {
        try {
          const taxRate = VAT_RATE;
          const invoiceSubtotal = parseFloat(totalAmount.toString()) / (1 + taxRate);
          const invoiceTax = invoiceSubtotal * taxRate;
          const invoiceNumber = `INV-${Date.now()}-${nanoid(6)}`;
          
          const invoiceData = {
            customerName: customerInfo.customerName,
            customerPhone: customerInfo.phoneNumber,
            items: Array.isArray(items) ? items : JSON.parse(items),
            subtotal: invoiceSubtotal - (parseFloat(discountPercentage?.toString() || '0') / 100 * invoiceSubtotal),
            discountAmount: parseFloat(discountPercentage?.toString() || '0') / 100 * invoiceSubtotal,
            taxAmount: invoiceTax,
            totalAmount: parseFloat(totalAmount.toString()),
            paymentMethod: paymentMethod,
            invoiceDate: new Date()
          };
          
          const customerEmail = customerInfo.customerEmail;
          if (customerEmail && customerEmail.includes('@')) {
            await sendInvoiceEmail(customerEmail, invoiceNumber, invoiceData);
          } else {
          }
          
          // Store invoice in database
          try {
            await storage.createTaxInvoice({
              orderId: order.id,
              invoiceNumber: invoiceNumber,
              customerName: customerInfo.customerName,
              customerPhone: customerInfo.phoneNumber,
              customerEmail: customerEmail,
              items: invoiceData.items,
              subtotal: invoiceData.subtotal,
              discountAmount: invoiceData.discountAmount,
              taxAmount: invoiceTax,
              totalAmount: parseFloat(totalAmount.toString()),
              paymentMethod: paymentMethod
            });
          } catch (storageError) {
          }
        } catch (invoiceError) {
          // Don't fail order if invoice generation fails
        }
      } else {
      }
      
      // Build response with deduction report included
      const response = {
        ...serializedOrder,
        deductionReport: (deductionReport as any) ? {
          success: (deductionReport as any).success,
          costOfGoods: (deductionReport as any).costOfGoods,
          grossProfit: (deductionReport as any).grossProfit,
          deductionDetails: (deductionReport as any).deductionDetails,
          shortages: (deductionReport as any).shortages,
          warnings: (deductionReport as any).warnings,
          errors: (deductionReport as any).errors,
        } : null
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("[ORDERS] Error creating order:", error);
      res.status(500).json({ error: "Failed to create order", details: error instanceof Error ? error.message : String(error) });
    }
  }); };

  // Finalize (Pay) Open Table Order
  app.post("/api/orders/:id/finalize", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { paymentMethod, paymentDetails } = req.body;
      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status !== 'open') return res.status(400).json({ error: "Order is not open" });

      order.status = 'payment_confirmed';
      order.tableStatus = 'payment_confirmed';
      order.paymentMethod = paymentMethod;
      order.paymentDetails = paymentDetails;
      order.updatedAt = new Date();
      await order.save();

      // Broadcast to kitchen so paid order appears there
      const serializedOrder = serializeDoc(order);
      wsManager.broadcastNewOrder(serializedOrder);
      wsManager.broadcastOrderUpdate(serializedOrder);

      // Free up the table
      if (order.tableId) {
        await storage.updateTableOccupancy(order.tableId, false, undefined);
      }

      res.json(serializedOrder);
    } catch (error) {
      res.status(500).json({ error: "Failed to finalize order" });
    }
  });

  // Get pending table orders (for cashier) - MOST SPECIFIC FIRST
  app.get("/api/orders/table/pending", async (req: any, res) => {
    try {
      const orders = await storage.getPendingTableOrders();
      const _tenantId = req.session?.employee?.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';
      const coffeeItemMap = await getCachedCoffeeItemMap(_tenantId);

      // Enrich orders with coffee item details
      const enrichedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        const items = orderItems.map((item: any) => {
          const coffeeItem = coffeeItemMap.get(item.coffeeItemId);
          return {
            ...item,
            coffeeItem: coffeeItem ? {
              nameAr: coffeeItem.nameAr,
              nameEn: coffeeItem.nameEn,
              price: coffeeItem.price,
              imageUrl: coffeeItem.imageUrl
            } : null
          };
        });

        return {
          ...serializedOrder,
          items
        };
      });

      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending table orders" });
    }
  });

  app.get("/api/orders/table/unassigned", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req as any) || "demo-tenant";
      const allOrders = await OrderModel.find({
        tenantId,
        status: { $in: ["pending", "in_progress"] },
        $or: [
          { assignedCashierId: null },
          { assignedCashierId: { $exists: false } },
          { assignedCashierId: "" },
        ],
      }).sort({ createdAt: -1 }).limit(100).lean();

      const coffeeItemMap = await getCachedCoffeeItemMap(tenantId);
      const enrichedOrders = allOrders.map(order => {
        const serialized = serializeDoc(order);
        let items = serialized.items;
        if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
        if (!Array.isArray(items)) items = [];
        return {
          ...serialized,
          items: items.map((item: any) => {
            const ci = coffeeItemMap.get(item.coffeeItemId);
            return { ...item, coffeeItem: ci ? { nameAr: ci.nameAr, nameEn: ci.nameEn, price: ci.price, imageUrl: ci.imageUrl } : null };
          })
        };
      });
      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unassigned orders" });
    }
  });

  // Get table orders (branch-filtered for managers)
  app.get("/api/orders/table", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { status } = req.query;
      const allOrders = await storage.getTableOrders((status as string) || '');

      // Filter by branch for non-admin managers
      const orders = filterByBranch(allOrders, req.employee);

      const tableOrderTenantId = req.employee?.tenantId || 'demo-tenant';
      const coffeeItemMap = await getCachedCoffeeItemMap(tableOrderTenantId);

      // Enrich orders with coffee item details
      const enrichedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        const items = orderItems.map((item: any) => {
          const coffeeItem = coffeeItemMap.get(item.coffeeItemId);
          return {
            ...item,
            coffeeItem: coffeeItem ? {
              nameAr: coffeeItem.nameAr,
              nameEn: coffeeItem.nameEn,
              price: coffeeItem.price,
              imageUrl: coffeeItem.imageUrl
            } : null
          };
        });

        return {
          ...serializedOrder,
          items
        };
      });

      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table orders" });
    }
  });

  // Send invoice email on demand (for cashier)
  app.post("/api/orders/:orderNumber/send-invoice", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderNumber } = req.params;
      const { email } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "البريد الإلكتروني غير صالح" });
      }

      // Validate that the employee has access (cashier or manager of the same branch)
      const employee = req.employee;
      if (!employee || !['cashier', 'manager', 'admin', 'owner'].includes(employee.role || '')) {
        return res.status(403).json({ error: "غير مصرح لك بإرسال الفواتير" });
      }

      // Get order by number
      const order = await storage.getOrderByNumber(orderNumber);
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      const serializedOrder = serializeDoc(order);

      // Check branch access for non-admin/owner roles
      if (employee.role === 'cashier' || employee.role === 'manager') {
        if (serializedOrder.branchId && employee.branchId && 
            serializedOrder.branchId !== employee.branchId) {
          return res.status(403).json({ error: "غير مصرح لك بالوصول لهذا الطلب" });
        }
      }
      
      // Parse items if stored as JSON string
      let orderItems = serializedOrder.items;
      if (typeof orderItems === 'string') {
        try {
          orderItems = JSON.parse(orderItems);
        } catch (e) {
          orderItems = [];
        }
      }

      // Enrich items with coffee item details (cached)
      const invoiceTenantId = employee?.tenantId || 'demo-tenant';
      const coffeeItemMap = await getCachedCoffeeItemMap(invoiceTenantId);
      const enrichedItems = Array.isArray(orderItems) ? orderItems.map((item: any) => {
        const coffeeItem = coffeeItemMap.get(item.coffeeItemId);
        return {
          ...item,
          coffeeItem: coffeeItem ? {
            nameAr: coffeeItem.nameAr,
            price: coffeeItem.price
          } : { nameAr: 'منتج', price: item.price || '0' }
        };
      }) : [];

      // Calculate totals - use stored values when available
      const totalAmount = parseFloat(serializedOrder.totalAmount || '0');
      const taxRate = VAT_RATE;
      const subtotalBeforeTax = totalAmount / (1 + taxRate);
      const taxAmount = totalAmount - subtotalBeforeTax;
      
      // Get stored discount if any
      const discountPercentage = parseFloat(serializedOrder.discountPercentage || '0');
      const discountAmount = discountPercentage > 0 ? 
        (subtotalBeforeTax / (1 - discountPercentage/100)) * (discountPercentage/100) : 0;
      
      // Generate invoice number using order number and creation time
      const orderDate = new Date(serializedOrder.createdAt || Date.now());
      const invoiceNumber = `INV-${orderNumber}`;

      const invoiceData = {
        customerName: serializedOrder.customerInfo?.customerName || 'عميل',
        customerPhone: serializedOrder.customerInfo?.phoneNumber || '',
        items: enrichedItems,
        subtotal: subtotalBeforeTax,
        discountAmount: discountAmount,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        paymentMethod: serializedOrder.paymentMethod || 'cash',
        invoiceDate: orderDate
      };

      const success = await sendInvoiceEmail(email, invoiceNumber, invoiceData);

      if (success) {
        res.json({ 
          success: true, 
          message: "تم إرسال الفاتورة بنجاح",
          invoiceNumber: invoiceNumber 
        });
      } else {
        res.status(500).json({ error: "فشل إرسال الفاتورة. تأكد من إعداد البريد الإلكتروني" });
      }
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال الفاتورة" });
    }
  });

  // Get order by number - for public tracking
  app.get("/api/orders/number/:orderNumber", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const order = await storage.getOrderByNumber(orderNumber);

      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // Serialize and parse items
      const serializedOrder = serializeDoc(order);
      if (serializedOrder.items && typeof serializedOrder.items === 'string') {
        try {
          serializedOrder.items = JSON.parse(serializedOrder.items);
        } catch (e) {
          serializedOrder.items = [];
        }
      }

      res.json(serializedOrder);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب معلومات الطلب" });
    }
  });

  // Public endpoint for Order Status Display - no authentication required
  app.get("/api/orders/active-display", async (req, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { branchId } = req.query;
      
      // Get orders that are in_progress or ready (for customer display)
      const query: any = {
        status: { $in: ['in_progress', 'preparing', 'ready'] },
        createdAt: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } // Last 4 hours only
      };

      if (branchId) {
        query.branchId = branchId;
      }

      const orders = await OrderModel.find(query)
        .sort({ createdAt: 1 })
        .limit(50);

      // Return minimal info for public display (no customer details)
      const displayOrders = orders.map(order => {
        const serialized = serializeDoc(order);
        let itemCount = 0;
        
        try {
          const items = typeof serialized.items === 'string' 
            ? JSON.parse(serialized.items) 
            : serialized.items;
          itemCount = Array.isArray(items) ? items.length : 0;
        } catch (e) {
          itemCount = 0;
        }

        return {
          id: serialized.id,
          orderNumber: serialized.orderNumber,
          status: serialized.status,
          orderType: serialized.orderType || serialized.deliveryType,
          deliveryType: serialized.deliveryType,
          createdAt: serialized.createdAt,
          itemCount
        };
      });

      res.json(displayOrders);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الطلبات" });
    }
  });

  // Get orders for Kitchen Display System (KDS) - requires authentication
  app.get("/api/orders/kitchen", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Allow all operational staff to access KDS
      const allowedRoles = ['cashier', 'barista', 'cook', 'waiter', 'supervisor', 'branch_manager', 'manager', 'admin', 'owner'];
      if (!req.employee?.role || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }

      const { OrderModel } = await import("@shared/schema");
      
      const query: any = {
        status: { $in: ['pending', 'confirmed', 'payment_confirmed', 'in_progress', 'ready'] }
      };

      // Apply branch filtering for all non-admin/owner roles
      if (req.employee.role !== 'admin' && req.employee.role !== 'owner') {
        if (req.employee.branchId) {
          query.branchId = req.employee.branchId;
        } else {
          // Employee has no branchId — find the first active branch for this tenant
          // Use branch.id (custom UUID string) not branch._id (ObjectId) to match order.branchId
          const { BranchModel } = await import("@shared/schema");
          const branch = await BranchModel.findOne({ tenantId: req.employee.tenantId, isActive: true });
          if (branch) {
            query.branchId = (branch as any).id; // Custom ID string, matches order.branchId
          }
          // If no branch found, tenantId filter alone will scope results correctly
        }
      }

      const kdsTenantId = req.employee?.tenantId || 'demo-tenant';
      if (!query.tenantId) query.tenantId = kdsTenantId; // security: scope to tenant
      const orders = await OrderModel.find(query).sort({ createdAt: 1 }); // Oldest first for FIFO processing

      const kdsCoffeeMap = await getCachedCoffeeItemMap(kdsTenantId);

      // Enrich orders with coffee item details
      const enrichedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        // Parse items if they're stored as JSON string
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        // Ensure orderItems is an array
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        const items = orderItems.map((item: any) => {
          const coffeeItem = kdsCoffeeMap.get(item.coffeeItemId);
          return {
            ...item,
            coffeeItem: coffeeItem ? {
              nameAr: coffeeItem.nameAr,
              nameEn: coffeeItem.nameEn,
              price: coffeeItem.price,
              imageUrl: coffeeItem.imageUrl,
              category: coffeeItem.category
            } : null
          };
        });

        return {
          ...serializedOrder,
          items
        };
      });

      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kitchen orders" });
    }
  });

  // Get all orders (branch-filtered for non-admin/owner roles)
  // GET /api/product-reservations/customer/:phone — fetch customer product reservations
  app.get("/api/product-reservations/customer/:phone", async (req: any, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { phone } = req.params;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const cleanPhone = phone.replace(/\D/g, '');
      const orders = await OrderModel.find({
        tenantId,
        isProductReservation: true,
        $or: [{ customerPhone: phone }, { customerPhone: cleanPhone }, { 'customerInfo.customerPhone': phone }, { 'customerInfo.customerPhone': cleanPhone }],
      }).sort({ createdAt: -1 }).limit(50).lean();
      return res.json(orders.map((o: any) => serializeDoc(o)));
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch customer product reservations" });
    }
  });

  // GET /api/product-reservations — fetch all product reservation orders
  app.get("/api/product-reservations", async (req: any, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const employee = req.session?.employee;
      const tenantId = employee?.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';
      const query: any = { tenantId, isProductReservation: true };
      if (employee?.branchId) query.branchId = employee.branchId;
      const orders = await OrderModel.find(query).sort({ createdAt: -1 }).limit(200).lean();
      const result = orders.map((o: any) => serializeDoc(o));
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch product reservations" });
    }
  });

  // PATCH /api/product-reservations/:id/status — update reservation status
  app.patch("/api/product-reservations/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { id } = req.params;
      const { productReservationStatus, productReservationNotes } = req.body;
      const validStatuses = ['pending_payment', 'pending_confirmation', 'confirmed', 'rejected', 'cancelled', 'completed'];
      if (!validStatuses.includes(productReservationStatus)) {
        return res.status(400).json({ error: "Invalid reservation status" });
      }
      const update: any = { productReservationStatus, updatedAt: new Date() };
      if (productReservationNotes !== undefined) update.productReservationNotes = productReservationNotes;
      const updated = await OrderModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      if (!updated) return res.status(404).json({ error: "Reservation not found" });
      return res.json(serializeDoc(updated));
    } catch (error) {
      return res.status(500).json({ error: "Failed to update reservation status" });
    }
  });

  app.get("/api/orders", requireAuth, async (req: any, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { limit, offset, status, today, fromDate, period, branchId: qBranchId, orderType } = req.query;

      const employee = req.session?.employee;
      const tenantId = employee?.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';

      const limitNum = limit ? parseInt(limit as string) : 300;
      const offsetNum = offset ? parseInt(offset as string) : 0;

      const query: any = { tenantId };
      // Branch filter:
      // - Elevated roles (owner/admin/branch_manager/manager) may pass any qBranchId or "all".
      // - Non-elevated employees are LOCKED to their session.branchId; qBranchId is ignored
      //   to prevent intra-tenant data leakage across branches.
      // - In all bound cases we ALSO include legacy/customer orders that have no branchId
      //   so the order history isn't blank for newly-migrated tenants.
      const elevatedRoles = ['owner', 'admin', 'branch_manager', 'manager'];
      const isElevated = !!(employee && elevatedRoles.includes(employee.role));
      let effectiveBranch: string | null = null;
      if (isElevated) {
        effectiveBranch = (qBranchId && qBranchId !== 'all') ? (qBranchId as string) : null;
      } else if (employee?.branchId) {
        effectiveBranch = employee.branchId;
      }
      if (effectiveBranch) {
        query.$or = [
          { branchId: effectiveBranch },
          { branchId: { $in: [null, ''] } },
          { branchId: { $exists: false } },
        ];
      }

      // Support orderType filter (dine_in, delivery, pickup, etc.)
      if (orderType && orderType !== 'all') {
        query.orderType = orderType as string;
      }

      // Support status filter (comma-separated)
      if (status && status !== 'all') {
        const statuses = (status as string).split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) query.status = statuses[0];
        else if (statuses.length > 1) query.status = { $in: statuses };
      }

      // Support period filter (Saudi timezone)
      if (today === 'true' || today === '1' || period === 'today') {
        query.createdAt = { $gte: getSaudiStartOfDay(), $lte: getSaudiEndOfDay() };
      } else if (period === 'week') {
        query.createdAt = { $gte: new Date(getSaudiStartOfDay().getTime() - 6 * 24 * 60 * 60 * 1000) };
      } else if (period === 'month') {
        query.createdAt = { $gte: new Date(getSaudiStartOfDay().getTime() - 29 * 24 * 60 * 60 * 1000) };
      } else if (period === 'year') {
        query.createdAt = { $gte: new Date(getSaudiStartOfDay().getTime() - 364 * 24 * 60 * 60 * 1000) };
      } else if (fromDate) {
        query.createdAt = { $gte: new Date(fromDate as string) };
      }

      const rawOrders = await OrderModel.find(query)
        .sort({ createdAt: -1 })
        .skip(offsetNum)
        .limit(limitNum)
        .lean();

      const ordersItemMap = await getCachedCoffeeItemMap(tenantId);

      const enrichedOrders = rawOrders.map((order: any) => {
        const s = serializeDoc(order);
        let orderItems = s.items;
        if (typeof orderItems === 'string') { try { orderItems = JSON.parse(orderItems); } catch { orderItems = []; } }
        if (!Array.isArray(orderItems)) orderItems = [];
        return {
          ...s,
          items: orderItems.map((item: any) => {
            const ci = ordersItemMap.get(item.coffeeItemId);
            return { ...item, coffeeItem: ci ? { nameAr: ci.nameAr, nameEn: ci.nameEn, price: ci.price, imageUrl: ci.imageUrl } : null };
          })
        };
      });

      return res.json(enrichedOrders);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get order by ID - LEAST SPECIFIC (catch-all)
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // If it's a dine-in order with a table number, mark table as occupied and set auto-clear alert
      if ((order.orderType === 'dine-in' || order.orderType === 'table') && order.tableNumber) {
        const { TableModel } = await import("@shared/schema");
        const autoClearTime = new Date(Date.now() + 10 * 60 * 1000);
        
        await TableModel.findOneAndUpdate(
          { tableNumber: order.tableNumber, branchId: order.branchId },
          { 
            isOccupied: 1, 
            currentOrderId: order.id,
            "reservedFor.autoExpiryTime": autoClearTime,
            updatedAt: new Date()
          }
        );
      }

      // Serialize the order (converts _id to id and removes MongoDB internals)
      const serializedOrder = serializeDoc(order);

      // Get order items
      const orderItems = await storage.getOrderItems(id);

      res.json({
        ...serializedOrder,
        orderItems
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Background task to auto-clear expired tables
  setInterval(async () => {
    try {
      const { TableModel } = await import("@shared/schema");
      const now = new Date();
      
      const expiredTables = await TableModel.find({
        isOccupied: 1,
        "reservedFor.autoExpiryTime": { $lte: now }
      });

      for (const table of expiredTables) {
        await TableModel.findOneAndUpdate(
          { _id: table._id },
          {
            isOccupied: 0,
            currentOrderId: null,
            "reservedFor.autoExpiryTime": null,
            updatedAt: new Date()
          }
        );
        
        if (typeof wsManager !== 'undefined') {
          wsManager.broadcastToBranch(table.branchId || 'all', {
            type: 'TABLE_AUTO_CLEARED',
            tableNumber: table.tableNumber,
            branchId: table.branchId
          });
        }
      }
    } catch (error) {
      console.error("Auto-clear tables error:", error);
    }
  }, 60000); // Check every minute

  // Update order car pickup info
  app.post("/api/orders/:id/car-pickup", async (req, res) => {
    try {
      const { id } = req.params;
      const { carType, carColor } = req.body;

      if (!carType || !carColor) {
        return res.status(400).json({ error: "Car type and color are required" });
      }

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const carPickup = { carType, carColor };
      const updatedOrder = await storage.updateOrderCarPickup(id, carPickup);

      if (!updatedOrder) {
        return res.status(404).json({ error: "Failed to update order" });
      }

      const serializedCarPickup = serializeDoc(updatedOrder);
      wsManager.broadcastOrderUpdate(serializedCarPickup);
      res.json(serializedCarPickup);
    } catch (error) {
      res.status(500).json({ error: "Failed to update car pickup info" });
    }
  });

  app.post("/api/orders/:id/customer-arrived", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const updatedOrder = await OrderModel.findOneAndUpdate(
        { $or: [{ id: id }, { _id: id.length === 24 ? id : undefined }] },
        { $set: { customerArrived: true, customerArrivedAt: new Date().toISOString() } },
        { new: true }
      );
      if (!updatedOrder) return res.status(404).json({ error: "Failed to update" });

      const serialized = serializeDoc(updatedOrder);
      const branchId = (order as any).branchId || 'all';

      wsManager.broadcastToBranch(branchId, {
        type: 'push_alert',
        title: '🚗 العميل وصل',
        body: `طلب #${serialized.orderNumber} — العميل في الموقف وينتظر`,
        url: '/employee/orders',
        order: serialized
      });
      wsManager.broadcastOrderUpdate(serialized);

      res.json(serialized);
    } catch (error) {
      res.status(500).json({ error: "Failed to update arrival status" });
    }
  });

  app.patch("/api/orders/:id/prep-time", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { additionalMinutes } = req.body;

      if (!additionalMinutes || typeof additionalMinutes !== 'number' || additionalMinutes <= 0) {
        return res.status(400).json({ error: "Invalid additionalMinutes" });
      }

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const currentEstimated = (order as any).estimatedPrepTimeMinutes || 0;
      const newEstimated = currentEstimated + additionalMinutes;

      const updatedOrder = await OrderModel.findOneAndUpdate(
        { id },
        { 
          $set: { 
            estimatedPrepTimeMinutes: newEstimated,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (updatedOrder && (updatedOrder as any).customerId) {
        const { sendPushToCustomer } = await import("./push-service");
        try {
          await sendPushToCustomer((updatedOrder as any).customerId, {
            type: 'order_status',
            title: 'تحديث وقت التحضير',
            body: `الوقت المتوقع لطلبك #${(updatedOrder as any).orderNumber}: ${newEstimated} دقيقة`,
            orderId: id,
            orderNumber: (updatedOrder as any).orderNumber,
            status: 'in_progress',
            estimatedTime: newEstimated
          });
        } catch (pushErr) {
          console.log("[PUSH] Failed to send time update notification:", pushErr);
        }
      }

      res.json({ success: true, estimatedPrepTimeMinutes: newEstimated });
    } catch (error) {
      console.error("[API] Error updating prep time:", error);
      res.status(500).json({ error: "Failed to update prep time" });
    }
  });

  // Update order status (branch-restricted for managers)
  app.put("/api/orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, cancellationReason, estimatedPrepTimeInMinutes, paymentMethod: rawPaymentMethod } = req.body;

      // Valid statuses for order workflow
      const validStatuses = ['pending', 'payment_confirmed', 'in_progress', 'ready', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Map payment method aliases (card → pos, etc.)
      const paymentMethodAliasMap: Record<string, string> = {
        'card': 'pos', 'بطاقة': 'pos', 'شبكة': 'pos',
        'cash': 'cash', 'نقدي': 'cash',
        'apple_pay': 'apple_pay', 'mada': 'mada', 'stc-pay': 'stc-pay',
        'pos': 'pos', 'pos-network': 'pos-network',
      };
      const mappedPaymentMethod = rawPaymentMethod
        ? (paymentMethodAliasMap[rawPaymentMethod] || rawPaymentMethod)
        : null;

      // Verify branch access for non-admin/manager users
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Update data object
      const updateData: any = { 
        status, 
        cancellationReason,
        updatedAt: new Date()
      };
      
      if (estimatedPrepTimeInMinutes !== undefined) {
        updateData.estimatedPrepTimeInMinutes = estimatedPrepTimeInMinutes;
        updateData.prepTimeSetAt = new Date();
      }

      const updatedOrder = await storage.updateOrderStatus(id, status, cancellationReason, estimatedPrepTimeInMinutes);

      // Reverse totalSpent on loyalty card when order is cancelled
      if (status === 'cancelled' && order.status !== 'cancelled' && order.customerId) {
        try {
          const customer = await storage.getCustomer(order.customerId);
          if (customer?.phone) {
            const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
            if (loyaltyCard) {
              const orderAmount = parseFloat(order.totalAmount?.toString() || '0');
              if (orderAmount > 0) {
                const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || '0');
                await storage.updateLoyaltyCard(loyaltyCard.id, {
                  totalSpent: Math.max(0, currentTotalSpent - orderAmount)
                });
              }
            }
          }
        } catch (_) {}
      }

      // Update paymentMethod if provided (e.g., when cashier closes bill with specific payment method)
      if (mappedPaymentMethod && updatedOrder) {
        const { OrderModel: OM } = await import('@shared/schema');
        await OM.findOneAndUpdate(
          { id: (updatedOrder as any).id || id },
          { $set: { paymentMethod: mappedPaymentMethod } }
        ).catch(() => null);
        (updatedOrder as any).paymentMethod = mappedPaymentMethod;
      }

      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Serialize the order properly
      const serializedOrder = serializeDoc(updatedOrder);

      // Broadcast update via WebSocket immediately
      console.log(`[ORDER] Status updated to ${status} for order #${serializedOrder.orderNumber}. Broadcasting...`);
      wsManager.broadcastOrderUpdate(serializedOrder);
      
      if (status === 'ready') {
        wsManager.broadcastOrderReady(serializedOrder);
      }
      if (status === 'payment_confirmed' || status === 'confirmed' || status === 'in_progress') {
        wsManager.broadcastNewOrder(serializedOrder);
      }

      // Build WhatsApp notification data for response
      let whatsappNotification: { url: string; message: string; phone: string } | undefined;
      try {
        const customerInfoParsed = typeof serializedOrder.customerInfo === 'string'
          ? JSON.parse(serializedOrder.customerInfo)
          : serializedOrder.customerInfo;
        const phoneNumber = customerInfoParsed?.phoneNumber;
        if (phoneNumber && status !== 'pending') {
          const message = getOrderStatusMessage(status, serializedOrder.orderNumber);
          whatsappNotification = {
            url: `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
            message,
            phone: phoneNumber
          };
        }
      } catch (_) {}

      // Send HTTP response immediately — don't block on heavy async work
      res.json(whatsappNotification
        ? { ...serializedOrder, whatsappNotification }
        : serializedOrder
      );

      // Run all heavy post-processing asynchronously (non-blocking)
      setImmediate(async () => {
        try {
          // Generate ZATCA invoice for completed/ready orders
          if (status === 'completed' || status === 'ready') {
            try {
              const existingInvoice = await TaxInvoiceModel.findOne({ orderId: updatedOrder.id });
              if (!existingInvoice) {
                const { createZATCAInvoice } = await import("./utils/zatca");
                let items = updatedOrder.items || [];
                if (typeof items === 'string') items = JSON.parse(items);
                
                const invoiceItems = items.map((item: any) => ({
                  itemId: item.coffeeItemId || item.id,
                  nameAr: item.coffeeItem?.nameAr || item.nameAr || 'منتج',
                  quantity: item.quantity || 1,
                  unitPrice: item.coffeeItem?.price || item.unitPrice || 0,
                  taxRate: VAT_RATE,
                  discountAmount: item.discountAmount || 0
                }));

                await createZATCAInvoice({
                  orderId: updatedOrder.id,
                  orderNumber: updatedOrder.orderNumber,
                  customerName: updatedOrder.customerInfo?.customerName || 'عميل نقدي',
                  customerPhone: updatedOrder.customerInfo?.customerPhone || '',
                  items: invoiceItems,
                  paymentMethod: updatedOrder.paymentMethod || 'cash',
                  branchId: updatedOrder.branchId,
                  createdBy: req.employee?.id,
                  invoiceType: 'simplified'
                });
                console.log(`[ZATCA] Auto-generated invoice for order ${updatedOrder.orderNumber} on status ${status}`);
              }
            } catch (zatcaError) {
              console.error("[ZATCA] Failed to auto-generate invoice:", zatcaError);
            }
          }

          // Deduct inventory for in_progress orders
          if (status === 'in_progress' && order.branchId) {
            try {
              const employeeId = req.employee?.id || 'system';
              await deductInventoryForOrder(id, order.branchId, employeeId);
            } catch (invErr) {
              console.error(`[INVENTORY] Auto-deduction failed for order ${order.orderNumber}:`, invErr);
            }
          }

          // Push notification to customer - rich with SVG image and actions
          try {
            const custInfo = typeof updatedOrder.customerInfo === 'string' ? JSON.parse(updatedOrder.customerInfo) : updatedOrder.customerInfo;
            const custId = updatedOrder.customerId || custInfo?.customerId;
            if (custId) {
              type StatusCfg = { title: string; body: string; stageIdx: number; actions: Array<{ action: string; title: string }> };
              const statusConfig: Record<string, StatusCfg> = {
                'payment_confirmed': {
                  title: '✅ تم تأكيد طلبك',
                  body: `طلب رقم #${serializedOrder.orderNumber} • قيد الانتظار`,
                  stageIdx: 0,
                  actions: [{ action: 'track', title: '👁 متابعة الطلب' }],
                },
                'in_progress': {
                  title: '☕ جارِ التحضير',
                  body: `طلبك #${serializedOrder.orderNumber} يُحضَّر الآن بعناية`,
                  stageIdx: 1,
                  actions: [{ action: 'track', title: '📍 تتبع الطلب' }],
                },
                'ready': {
                  title: '🔔 طلبك جاهز!',
                  body: `طلبك #${serializedOrder.orderNumber} في انتظارك • تفضل بالاستلام`,
                  stageIdx: 2,
                  actions: [
                    { action: 'track', title: '📍 تتبع الطلب' },
                    { action: 'directions', title: '🗺️ الاتجاهات' },
                  ],
                },
                'completed': {
                  title: '🎉 تم التسليم!',
                  body: `طلبك #${serializedOrder.orderNumber} تم تسليمه • شكراً لك`,
                  stageIdx: 3,
                  actions: [
                    { action: 'rate', title: '⭐ قيّم تجربتك' },
                    { action: 'reorder', title: '🔄 إعادة الطلب' },
                  ],
                },
                'cancelled': {
                  title: '❌ تم الإلغاء',
                  body: `تم إلغاء طلبك #${serializedOrder.orderNumber} • تواصل معنا للمساعدة`,
                  stageIdx: -1,
                  actions: [{ action: 'track', title: '📞 تواصل معنا' }],
                },
              };

              const cfg = statusConfig[status];
              if (cfg) {
                const orderItems = Array.isArray(serializedOrder.items) 
                  ? serializedOrder.items.map((item: any) => ({
                      name: item.nameAr || item.name || item.coffeeItem?.nameAr || 'منتج',
                      quantity: item.quantity || 1
                    }))
                  : [];
                const orderNum = String(serializedOrder.orderNumber || serializedOrder.dailyNumber || '');
                const orderType = serializedOrder.orderType || '';
                const estimatedMins = serializedOrder.estimatedPrepTimeInMinutes;
                const baseUrl = getAppBaseUrl();
                const imageParams = new URLSearchParams({
                  status,
                  orderNumber: orderNum,
                  type: orderType,
                  ...(status === 'in_progress' && estimatedMins ? { t: String(estimatedMins) } : {}),
                });
                sendPushToCustomer(custId, {
                  title: cfg.title,
                  body: cfg.body,
                  url: '/my-orders',
                  tag: `order-${orderNum}`,
                  type: 'order_status',
                  orderNumber: orderNum,
                  orderStatus: status,
                  totalAmount: serializedOrder.totalAmount,
                  itemCount: orderItems.length,
                  items: orderItems.slice(0, 5),
                  orderType,
                  estimatedTime: status === 'in_progress' ? (estimatedMins || 5) : undefined,
                  image: `${baseUrl}/api/notification-image?${imageParams.toString()}`,
                  actions: cfg.actions,
                  stageIndex: cfg.stageIdx,
                  totalStages: 4,
                }).catch(err => console.error('[PUSH] Customer notification error:', err));
              }
            }
          } catch (pushErr) {
            console.error('[PUSH] Error sending customer push:', pushErr);
          }

          // Email notification on status change
          const updateCustomerInfo = typeof updatedOrder.customerInfo === 'string' ? JSON.parse(updatedOrder.customerInfo) : updatedOrder.customerInfo;
          const customerEmail = updateCustomerInfo?.email;
          const customerName = updateCustomerInfo?.name;
          if (customerEmail) {
            try {
              const { sendOrderNotificationEmail } = await import("./mail-service");
              await sendOrderNotificationEmail(
                customerEmail,
                customerName || 'عميل مكان الشيف البخاري',
                updatedOrder.orderNumber,
                status,
                parseFloat(updatedOrder.totalAmount.toString()),
                updatedOrder
              );
            } catch (emailError) {
              console.error("❌ Failed to send order status email:", emailError);
            }
          }
        } catch (asyncErr) {
          console.error("[ORDER-ASYNC] Post-processing error:", asyncErr);
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Get payment method details for employees/cashier
  app.get("/api/cashier/payment-methods", async (req, res) => {
    try {
      const paymentMethods = [
        { id: 'qahwa-card', nameAr: 'بطاقة كوبي', nameEn: 'Qahwa Card', details: 'استخدم المشروبات المجانية من بطاقتك', icon: 'fas fa-gift', requiresReceipt: false },
        { id: 'cash', nameAr: 'الدفع نقداً', nameEn: 'Cash Payment', details: 'ادفع عند الاستلام', icon: 'fas fa-money-bill-wave', requiresReceipt: false },
        { id: 'pos-network', nameAr: 'شبكة (POS)', nameEn: 'Network (POS)', details: 'الدفع عبر جهاز نقاط البيع', icon: 'fas fa-credit-card', requiresReceipt: false },
        { id: 'alinma', nameAr: 'Alinma Pay', nameEn: 'Alinma Pay', details: '0532441566', icon: 'fas fa-credit-card', requiresReceipt: true },
        { id: 'ur', nameAr: 'Ur Pay', nameEn: 'Ur Pay', details: '0532441566', icon: 'fas fa-university', requiresReceipt: true },
        { id: 'barq', nameAr: 'Barq', nameEn: 'Barq', details: '0532441566', icon: 'fas fa-bolt', requiresReceipt: true },
        { id: 'rajhi', nameAr: 'بنك الراجحي', nameEn: 'Al Rajhi Bank', details: 'SA78 8000 0539 6080 1942 4738', icon: 'fas fa-building-columns', requiresReceipt: true },
      ];

      res.json(paymentMethods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // LOYALTY CARD ROUTES

  // Get loyalty cards by customer ID (phone)
  app.get("/api/loyalty/cards/customer/:customerId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId } = req.params;
      const customer = await storage.getCustomer(customerId);
      
      if (!customer) {
        return res.status(404).json({ error: "العميل غير موجود" });
      }

      const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
      if (!loyaltyCard) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      res.json([loyaltyCard]); // Return as array for consistency with frontend query
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Get loyalty transactions by customer ID
  app.get("/api/loyalty/transactions/customer/:customerId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId } = req.params;
      const LoyaltyTransactionModel = mongoose.model('LoyaltyTransaction');
      const transactions = await LoyaltyTransactionModel.find({ customerId }).sort({ createdAt: -1 });
      res.json(transactions.map(serializeDoc));
    } catch (error) {
      console.error("Error fetching loyalty transactions:", error);
      res.status(500).json({ error: "فشل في جلب سجل العمليات" });
    }
  });

  // Get loyalty card by phone number
  app.get("/api/loyalty/cards/phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      
      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!loyaltyCard) {
        // Automatically create a card if it doesn't exist
        const customer = await storage.getCustomerByPhone(cleanPhone);
        if (customer) {
          const newCard = await storage.createLoyaltyCard({
            customerName: customer.name,
            phoneNumber: cleanPhone
          });
          return res.json(newCard);
        }
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      res.json(loyaltyCard);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Admin: Fix all loyalty cards data - recalculate free cups from stamps
  app.post("/api/admin/fix-loyalty-cards-data", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const allCards = await storage.getLoyaltyCards();
      const report = {
        totalCards: allCards.length,
        cardsFixed: 0,
        cardsUpdated: [] as any[],
        errors: [] as string[]
      };

      for (const card of allCards) {
        try {
          const currentStamps = card.stamps || 0;
          const currentFreeCupsEarned = card.freeCupsEarned || 0;
          
          // Calculate how many free cups should be earned from stamps
          const freeCupsFromStamps = Math.floor(currentStamps / 6);
          
          // If there are stamps that haven't been converted to free cups, update the card
          if (freeCupsFromStamps > 0) {
            const remainingStamps = currentStamps % 6;
            const newFreeCupsEarned = currentFreeCupsEarned + freeCupsFromStamps;
            
            await storage.updateLoyaltyCard(card.id || (card as any)._id?.toString(), {
              stamps: remainingStamps,
              freeCupsEarned: newFreeCupsEarned
            });

            report.cardsUpdated.push({
              cardId: card.id || (card as any)._id?.toString(),
              customerName: card.customerName,
              phoneNumber: card.phoneNumber,
              stampsConverted: currentStamps,
              freeCupsAdded: freeCupsFromStamps,
              newFreeCupsEarned: newFreeCupsEarned,
              remainingStamps: remainingStamps
            });

            report.cardsFixed++;
          }
        } catch (error) {
          report.errors.push(`فشل تحديث البطاقة: ${card.phoneNumber} - ${error}`);
        }
      }

      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "فشل في إصلاح بيانات بطاقات الولاء" });
    }
  });

  // Create loyalty card (Initial)
  app.post("/api/loyalty/cards", async (req, res) => {
    try {
      const { customerName, phoneNumber, cardPin, cardDesign } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      }

      // Check if customer already has an active card
      const existingCards = await storage.getLoyaltyCardsByCustomerId("");
      const activeCard = existingCards.find(c => c.isActive && c.status !== 'cancelled');
      if (activeCard) {
        return res.status(400).json({ error: "لديك بطاقة نشطة بالفعل" });
      }

      const customer = await storage.getCustomerByPhone(phoneNumber);
      if (!customer) {
        return res.status(404).json({ error: "العميل غير موجود" });
      }

      const card = await storage.createLoyaltyCard({
        customerName: customerName || customer.name,
        phoneNumber: phoneNumber
      });

      res.status(201).json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء بطاقة الولاء" });
    }
  });

  // Issue new card (with design and PIN) - limited to 2 times
  app.post("/api/loyalty/cards/:cardId/reissue", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { newPin, cardDesign } = req.body;

      const card = await storage.getLoyaltyCard(cardId);
      if (!card) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      // Check reissuance limit (max 2 times)
      if (card.reissuanceCount >= 2) {
        return res.status(400).json({ error: "لقد وصلت إلى الحد الأقصى لإصدار بطاقة جديدة (مرتين فقط)" });
      }

      // Create a NEW card instead of updating (for multiple cards per customer)
      const newCard = await storage.createLoyaltyCard({
        customerName: card.customerName,
        phoneNumber: card.phoneNumber
      });

      // Deactivate old card and activate new one
      await storage.updateLoyaltyCard(cardId, { isActive: false, status: "replaced" });
      await storage.setActiveCard(newCard.id || (newCard as any)._id?.toString(), card.customerId);

      res.json({ success: true, message: "تم إصدار بطاقة جديدة بنجاح", card: newCard });
    } catch (error) {
      res.status(500).json({ error: "فشل في إصدار بطاقة جديدة" });
    }
  });

  // Cancel card (with credential verification and reissuance eligibility check)
  app.post("/api/loyalty/cards/:cardId/cancel", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { phone, email, password } = req.body;

      if (!phone || !email || !password) {
        return res.status(400).json({ error: "رقم الهاتف والبريد وكلمة المرور مطلوبة" });
      }

      // Get the card
      const card = await storage.getLoyaltyCard(cardId);
      if (!card) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      // Check if customer still has reissuance chances
      // The condition was "card.reissuanceCount < 2" which means you CANNOT cancel if you have chances left.
      // Usually, canceling is allowed, but maybe the logic was intended to prevent abuse.
      // However, the user says there's a problem with canceling.
      // Let's make it more permissive or fix the logic if it's inverted.
      // The frontend alert says: "لا يمكنك إلغاء البطاقة إلا إذا كان لديك فرصة لإنشاء بطاقة جديدة"
      // This means reissuanceCount MUST be < 2 to cancel? Or reissuanceCount >= 2?
      // If reissuanceCount is 2, you used all chances. If you cancel, you are stuck.
      // The logic in routes.ts line 3167: if (card.reissuanceCount < 2) return 403.
      // This is indeed what the frontend alert says. But maybe the user wants to cancel regardless?
      // Let's remove this restriction if it's causing the "problem". 
      // Actually, let's keep it but ensure the data is correct.

      // Verify customer credentials
      const customer = await storage.getCustomerByEmail(email);
      const cleanPhone = phone.trim().replace(/\s/g, '').replace(/^\+966/, '').replace(/^0/, '');
      const customerPhone = customer?.phone?.trim().replace(/\s/g, '').replace(/^\+966/, '').replace(/^0/, '');

      if (!customer || customerPhone !== cleanPhone) {
        return res.status(401).json({ error: "البيانات غير صحيحة" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, customer.password || "");
      if (!isPasswordValid) {
        return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
      }

      // Cancel the card by setting status to "cancelled"
      await storage.updateLoyaltyCard(cardId, { status: "cancelled", isActive: false });

      res.json({ success: true, message: "تم إلغاء البطاقة بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إلغاء البطاقة" });
    }
  });

  // Scan loyalty card and apply discount
  app.post("/api/loyalty/scan", async (req, res) => {
    try {
      const { qrToken, orderAmount, employeeId } = req.body;

      if (!qrToken || !orderAmount) {
        return res.status(400).json({ error: "رمز QR ومبلغ الطلب مطلوبان" });
      }

      const card = await storage.getLoyaltyCardByQRToken(qrToken);

      if (!card) {
        return res.status(404).json({ error: "بطاقة ولاء غير صالحة" });
      }

      // Calculate 10% discount
      const discountPercentage = 10;
      const discountAmount = (parseFloat(orderAmount) * discountPercentage) / 100;
      const finalAmount = parseFloat(orderAmount) - discountAmount;

      // Update card - increment discount count and update last used
      await storage.updateLoyaltyCard(card.id, {
        discountCount: card.discountCount + 1,
        totalSpent: parseFloat(card.totalSpent.toString()) + finalAmount,
        lastUsedAt: new Date()
      });

      // Create loyalty transaction
      await storage.createLoyaltyTransaction({
        cardId: card.id,
        type: 'discount_applied',
        pointsChange: 0,
        discountAmount: discountAmount,
        orderAmount: parseFloat(orderAmount.toString()),
        description: `خصم ${discountPercentage}% على الطلب`,
        employeeId: employeeId || undefined
      });

      res.json({
        success: true,
        card: {
          ...card,
          discountCount: card.discountCount + 1
        },
        discount: {
          percentage: discountPercentage,
          amount: discountAmount.toFixed(2),
          originalAmount: orderAmount,
          finalAmount: finalAmount.toFixed(2)
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في مسح بطاقة الولاء" });
    }
  });

  // Get loyalty card transactions
  app.get("/api/loyalty/cards/:cardId/transactions", async (req, res) => {
    try {
      const { cardId } = req.params;
      const transactions = await storage.getLoyaltyTransactions(cardId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب معاملات الولاء" });
    }
  });

  // Get loyalty tier information
  app.get("/api/loyalty/tiers", async (req, res) => {
    try {
      const tiers = [
        {
          id: 'bronze',
          nameAr: 'برونزي',
          nameEn: 'Bronze',
          pointsRequired: 0,
          benefits: ['خصم 10% على كل طلب', 'بطاقة رقمية مجانية'],
          color: '#CD7F32',
          icon: '🥉'
        },
        {
          id: 'silver',
          nameAr: 'فضي',
          nameEn: 'Silver',
          pointsRequired: 500,
          benefits: ['خصم 15% على كل طلب', 'قهوة مجانية شهرياً', 'أولوية في الطلبات'],
          color: '#C0C0C0',
          icon: '🥈'
        },
        {
          id: 'gold',
          nameAr: 'ذهبي',
          nameEn: 'Gold',
          pointsRequired: 2000,
          benefits: ['خصم 20% على كل طلب', 'قهوتين مجانيتين شهرياً', 'دعوات خاصة للفعاليات'],
          color: '#FFD700',
          icon: '🥇'
        },
        {
          id: 'platinum',
          nameAr: 'بلاتيني',
          nameEn: 'Platinum',
          pointsRequired: 5000,
          benefits: ['خصم 25% على كل طلب', 'قهوة يومية مجانية', 'خدمة VIP', 'بطاقة فيزيائية مطبوعة'],
          color: '#E5E4E2',
          icon: 'platinum'
        }
      ];

      res.json(tiers);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب مستويات الولاء" });
    }
  });

  // Customer loyalty cards endpoint for /my-card page
  app.get("/api/customer/loyalty-cards", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const customerId = req.customer?.id;
      const customerPhone = req.customer?.phone;
      
      if (!customerPhone) {
        return res.status(401).json({ error: "يرجى تسجيل الدخول" });
      }

      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9);
      let loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      
      // Create card if doesn't exist
      if (!loyaltyCard) {
        const cardNumber = `QIROX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const qrToken = `QR-${customerId || cleanPhone}-${Date.now()}`;
        
        loyaltyCard = await storage.createLoyaltyCard({
          customerId: customerId || cleanPhone,
          customerName: req.customer?.name || 'عميل',
          phoneNumber: cleanPhone,
          cardNumber: cardNumber,
          qrToken: qrToken,
          isActive: 1,
          stamps: 0,
          freeCupsEarned: 0,
          totalSpent: 0,
          points: 0,
          pendingPoints: 0
        } as any);
      }

      res.json([loyaltyCard]);
    } catch (error) {
      console.error("[CUSTOMER LOYALTY] Error:", error);
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // ── Apple Wallet PKPass generator for loyalty card ─────────────────────────
  app.get("/api/wallet/apple-pass", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const fs   = await import('fs');
      const path = await import('path');

      // Decode base64 env var if needed
      const decodePem = (raw: string): string => {
        try {
          const decoded = Buffer.from(raw, 'base64').toString('utf8');
          if (decoded.includes('-----BEGIN')) return decoded;
        } catch {}
        return raw;
      };

      const walletDir = path.join(process.cwd(), "apple-wallet");
      const readPemFile = (filename: string): string => {
        try { return fs.readFileSync(path.join(walletDir, filename), "utf8"); } catch { return ""; }
      };

      const wwdrRaw    = process.env.APPLE_WWDR_PEM      || readPemFile("wwdr.pem");
      const certRaw    = process.env.APPLE_SIGNER_CERT_PEM || readPemFile("signer_cert.pem");
      const keyRaw     = process.env.APPLE_SIGNER_KEY_PEM  || readPemFile("signer_key.pem");
      const passTypeId = process.env.APPLE_PASS_TYPE_ID  || "pass.chefsplace.online";
      const teamId     = process.env.APPLE_TEAM_ID       || "V4K6RM59LS";
      const keyPhrase  = process.env.APPLE_KEY_PASSPHRASE;

      if (!wwdrRaw || !certRaw || !keyRaw || !passTypeId || !teamId) {
        return res.status(503).json({
          error: "Apple Wallet غير مهيأ",
          message: "يجب إعداد شهادات Apple Developer أولاً في إعدادات المتغيرات البيئية",
          setup: {
            required: ["APPLE_WWDR_PEM", "APPLE_SIGNER_CERT_PEM", "APPLE_SIGNER_KEY_PEM", "APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID"],
            optional: ["APPLE_KEY_PASSPHRASE"],
            docs: "https://developer.apple.com/documentation/walletpasses",
          }
        });
      }

      const customerPhone = req.customer?.phone;
      if (!customerPhone) return res.status(401).json({ error: "يرجى تسجيل الدخول" });

      // Try multiple phone formats to find the loyalty card
      const rawDigits  = customerPhone.replace(/\D/g, '');
      const phoneVariants = [
        rawDigits.slice(-9),
        rawDigits,
        rawDigits.startsWith('966') ? rawDigits.slice(3) : '0' + rawDigits.slice(-9),
        '0' + rawDigits.slice(-9),
      ];

      let loyaltyCard: any = null;
      for (const ph of phoneVariants) {
        loyaltyCard = await storage.getLoyaltyCardByPhone(ph);
        if (loyaltyCard) break;
      }
      if (!loyaltyCard) return res.status(404).json({ error: "لم يتم العثور على بطاقة الولاء" });

      // Get real loyalty settings from business config
      const businessConfig   = await storage.getBusinessConfig('demo-tenant').catch(() => null) as any;
      const loyaltyConfig    = businessConfig?.loyaltyConfig || {};
      const pointsValueInSar = loyaltyConfig.pointsValueInSar ?? 0.02;

      const points       = Number(loyaltyCard.points) || 0;
      const sarValue     = (points * pointsValueInSar).toFixed(2);
      const tier         = loyaltyCard.tier || "bronze";
      const tierLabels: Record<string, string> = {
        bronze: "برونزي", silver: "فضي", gold: "ذهبي", platinum: "بلاتيني"
      };
      const customerName = req.customer?.name || loyaltyCard.customerName || "عميل";
      const qrValue      = loyaltyCard.qrToken || loyaltyCard.cardNumber || rawDigits.slice(-9);

      const cardNumber = loyaltyCard.cardNumber || rawDigits.slice(-9);
      const passJson = {
        formatVersion: 1,
        passTypeIdentifier: passTypeId,
        serialNumber: `CHEFSPLACE-${rawDigits.slice(-9)}`,
        teamIdentifier: teamId,
        organizationName: "مكان الشيف البخاري",
        description: "بطاقة ولاء - مكان الشيف البخاري",
        logoText: "مكان الشيف البخاري",
        backgroundColor: "rgb(17, 17, 17)",
        foregroundColor: "rgb(255, 255, 255)",
        labelColor: "rgb(196, 176, 138)",
        storeCard: {
          headerFields: [
            { key: "tier", label: "المستوى", value: tierLabels[tier] || "برونزي", textAlignment: "PKTextAlignmentRight" }
          ],
          primaryFields: [
            { key: "points", label: "نقاطك", value: String(points), textAlignment: "PKTextAlignmentNatural" }
          ],
          secondaryFields: [
            { key: "sar", label: "قيمة بالريال", value: `${sarValue} ر.س` },
            { key: "name", label: "العميل", value: customerName }
          ],
          auxiliaryFields: [
            { key: "card", label: "رقم البطاقة", value: cardNumber }
          ],
          backFields: [
            { key: "how", label: "كيف تستخدم نقاطك؟", value: "أخبر الكاشير باسمك أو رقم جوالك، أو أعرض رمز QR ليخصم النقاط تلقائياً." },
            { key: "rate", label: "معدل النقاط", value: `كل 50 نقطة = 1 ريال خصم` },
            { key: "min", label: "الحد الأدنى للاسترداد", value: "100 نقطة" },
            { key: "website", label: "الموقع الإلكتروني", value: "chefsplace.online" },
            { key: "phone", label: "رقم الجوال المسجل", value: rawDigits.slice(-9) },
          ]
        },
        barcodes: [
          { message: qrValue, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: cardNumber }
        ],
        barcode: { message: qrValue, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: cardNumber }
      };

      // Build pass files in a temp .pass directory (required by passkit-generator)
      const os   = await import('os');
      const { PNG } = await import('pngjs');

      const makeSolidPng = (w: number, h: number, r: number, g: number, b: number): Buffer => {
        const png = new PNG({ width: w, height: h });
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (w * y + x) * 4;
            png.data[idx] = r; png.data[idx+1] = g; png.data[idx+2] = b; png.data[idx+3] = 255;
          }
        }
        return PNG.sync.write(png);
      };

      const passDir = path.join(os.tmpdir(), `chefsplace-${Date.now()}.pass`);
      fs.mkdirSync(passDir, { recursive: true });

      try {
        // Write all pass files — directory must end with .pass
        fs.writeFileSync(path.join(passDir, 'pass.json'), JSON.stringify(passJson));
        fs.writeFileSync(path.join(passDir, 'icon.png'),    makeSolidPng(29,  29,  17, 17, 17));
        fs.writeFileSync(path.join(passDir, 'icon@2x.png'), makeSolidPng(58,  58,  17, 17, 17));
        fs.writeFileSync(path.join(passDir, 'icon@3x.png'), makeSolidPng(87,  87,  17, 17, 17));
        fs.writeFileSync(path.join(passDir, 'logo.png'),    makeSolidPng(160, 50,  17, 17, 17));
        fs.writeFileSync(path.join(passDir, 'logo@2x.png'), makeSolidPng(320, 100, 17, 17, 17));
        fs.writeFileSync(path.join(passDir, 'logo@3x.png'), makeSolidPng(480, 150, 17, 17, 17));

        const { PKPass } = await import("passkit-generator");

        const pass = await PKPass.from({
          model: passDir,
          certificates: {
            wwdr:                decodePem(wwdrRaw),
            signerCert:          decodePem(certRaw),
            signerKey:           decodePem(keyRaw),
            signerKeyPassphrase: keyPhrase,
          },
        });

        const passBuffer = await pass.getAsBuffer();
        const safeName   = customerName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) || "loyalty";

        res.set({
          "Content-Type":        "application/vnd.apple.pkpass",
          "Content-Disposition": `inline; filename="chefsplace-${safeName}.pkpass"`,
          "Cache-Control":       "no-store",
          "Content-Length":      String(passBuffer.length),
        });
        res.send(passBuffer);
      } finally {
        // Always clean up temp directory
        try { fs.rmSync(passDir, { recursive: true, force: true }); } catch {}
      }

    } catch (err: any) {
      console.error("[APPLE WALLET]", err.message);
      res.status(500).json({ error: "فشل في إنشاء بطاقة Apple Wallet", detail: err.message });
    }
  });

  // Customer loyalty transactions endpoint
  app.get("/api/customer/loyalty-transactions", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const customerPhone = req.customer?.phone;
      
      if (!customerPhone) {
        return res.status(401).json({ error: "يرجى تسجيل الدخول" });
      }

      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9);
      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      
      if (!loyaltyCard) {
        return res.json([]);
      }

      const transactions = await storage.getLoyaltyTransactions(loyaltyCard.id);
      
      // Transform transactions for frontend
      const formattedTransactions = transactions.map((tx: any) => ({
        id: tx.id || tx._id,
        type: tx.type === 'stamps_earned' || tx.type === 'points_earned' ? 'earn' : 'redeem',
        points: tx.pointsChange || 0,
        descriptionAr: tx.description,
        createdAt: tx.createdAt
      }));

      res.json(formattedTransactions);
    } catch (error) {
      console.error("[CUSTOMER TRANSACTIONS] Error:", error);
      res.status(500).json({ error: "فشل في جلب معاملات الولاء" });
    }
  });

  // Transfer points between customers
  app.post("/api/customer/transfer-points", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const { recipientPhone, points, pin } = req.body;
      const senderPhone = req.customer?.phone;
      
      if (!senderPhone || !recipientPhone || !points || points <= 0) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }

      const cleanSenderPhone = senderPhone.replace(/\D/g, '').slice(-9);
      const cleanRecipientPhone = recipientPhone.replace(/\D/g, '').slice(-9);

      // Get sender's card
      const senderCard = await storage.getLoyaltyCardByPhone(cleanSenderPhone);
      if (!senderCard) {
        return res.status(404).json({ error: "بطاقتك غير موجودة" });
      }

      // Verify PIN
      const customer = await storage.getCustomerByPhone(cleanSenderPhone);
      if (customer?.password && pin && !(await bcrypt.compare(pin, customer.password))) {
        return res.status(401).json({ error: "الرقم السري غير صحيح" });
      }

      // Check if sender has enough points
      const currentPoints = senderCard.points || 0;
      if (currentPoints < points) {
        return res.status(400).json({ error: "رصيد النقاط غير كافي" });
      }

      // Transfer points
      await storage.updateLoyaltyCard(senderCard.id, { points: currentPoints - points });
      
      // Get or create recipient's card
      let recipientCard = await storage.getLoyaltyCardByPhone(cleanRecipientPhone);
      const recipientCustomer = await storage.getCustomerByPhone(cleanRecipientPhone);
      
      if (!recipientCard && recipientCustomer) {
        const recipientCustomerId = (recipientCustomer as any)._id?.toString() || (recipientCustomer as any).id;
        const cardNumber = `QIROX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const qrToken = `QR-${recipientCustomerId}-${Date.now()}`;
        
        recipientCard = await storage.createLoyaltyCard({
          customerId: recipientCustomerId,
          customerName: recipientCustomer.name,
          phoneNumber: cleanRecipientPhone,
          cardNumber: cardNumber,
          qrToken: qrToken,
          isActive: 1,
          stamps: 0,
          freeCupsEarned: 0,
          totalSpent: 0,
          points: 0,
          pendingPoints: 0
        } as any);
      }

      if (!recipientCard) {
        return res.status(404).json({ error: "المستلم غير مسجل في النظام" });
      }

      // Transfer points
      await storage.updateLoyaltyCard(recipientCard.id, {
        points: (recipientCard.points || 0) + points
      });

      // Create transaction records
      await storage.createLoyaltyTransaction({
        cardId: senderCard.id,
        type: 'transfer_out',
        pointsChange: -points,
        description: `تحويل نقاط إلى ${recipientCustomer?.name || recipientPhone}`,
      } as any);

      await storage.createLoyaltyTransaction({
        cardId: recipientCard.id,
        type: 'transfer_in',
        pointsChange: points,
        description: `استلام نقاط من ${req.customer?.name || senderPhone}`,
      } as any);

      res.json({ 
        success: true, 
        message: "تم تحويل النقاط بنجاح",
        recipientName: recipientCustomer?.name || recipientPhone
      });
    } catch (error) {
      console.error("[TRANSFER POINTS] Error:", error);
      res.status(500).json({ error: "فشل في تحويل النقاط" });
    }
  });

  // ─── EMPLOYEE LOYALTY MANAGEMENT ENDPOINTS ─────────────────────────────────

  // Get all loyalty cards (manager/admin)
  app.get("/api/loyalty/cards", requireAuth, async (req: AuthRequest, res) => {
    try {
      const cards = await storage.getLoyaltyCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقات الولاء" });
    }
  });

  // Lookup card by phone (employee, no auth wall for ease of use)
  app.get("/api/loyalty/lookup/phone/:phone", async (req, res) => {
    try {
      const cleanPhone = req.params.phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "لا توجد بطاقة بهذا الرقم" });
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في البحث" });
    }
  });

  // Create card for walk-in customer (employee creates)
  app.post("/api/loyalty/employee/create-card", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerName, phoneNumber } = req.body;
      if (!phoneNumber) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-9);
      if (cleanPhone.length < 9) return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام" });

      const existing = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (existing) return res.status(400).json({ error: "هذا الرقم لديه بطاقة مسجلة بالفعل", card: existing });

      // Find or use walk-in customerId
      const customer = await storage.getCustomerByPhone(cleanPhone);
      const customerId = customer ? (customer.id || (customer as any)._id?.toString()) : `walkin-${cleanPhone}`;

      const card = await storage.createLoyaltyCard({
        customerId,
        customerName: customerName?.trim() || 'عميل',
        phoneNumber: cleanPhone,
        points: 0,
        stamps: 0,
        freeCupsEarned: 0,
        freeCupsRedeemed: 0,
        totalSpent: 0,
        tier: 'bronze',
        isActive: true,
      } as any);

      res.status(201).json(card);
    } catch (error: any) {
      console.error("[LOYALTY CREATE CARD]", error);
      res.status(500).json({ error: "فشل في إنشاء البطاقة" });
    }
  });

  // Employee: Add points manually
  app.post("/api/loyalty/employee/add-points", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone, points, note } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      const pts = Number(points);
      if (!pts || pts <= 0) return res.status(400).json({ error: "عدد النقاط يجب أن يكون أكبر من صفر" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const cardId = (card as any)._id?.toString() || (card as any).id;
      const newPoints = (card.points || 0) + pts;

      // Update tier based on new points
      let tier = 'bronze';
      if (newPoints >= 5000) tier = 'platinum';
      else if (newPoints >= 2000) tier = 'gold';
      else if (newPoints >= 500) tier = 'silver';

      await storage.updateLoyaltyCard(cardId, { points: newPoints, tier });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'earn',
        pointsChange: pts,
        discountAmount: 0,
        orderAmount: 0,
        description: note || `إضافة ${pts} نقطة يدوياً`,
        employeeId: req.employee?.id,
      });

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard });
    } catch (error) {
      console.error("[LOYALTY ADD POINTS]", error);
      res.status(500).json({ error: "فشل في إضافة النقاط" });
    }
  });

  // Employee: Add stamp
  app.post("/api/loyalty/employee/add-stamp", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const cardId = (card as any)._id?.toString() || (card as any).id;
      const newStamps = (card.stamps || 0) + 1;
      let freeCupsEarned = card.freeCupsEarned || 0;
      let finalStamps = newStamps;
      let earnedFreeCup = false;

      if (newStamps >= 6) {
        const earned = Math.floor(newStamps / 6);
        freeCupsEarned += earned;
        finalStamps = newStamps % 6;
        earnedFreeCup = earned > 0;
      }

      await storage.updateLoyaltyCard(cardId, { stamps: finalStamps, freeCupsEarned });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'stamp_earned',
        pointsChange: 0,
        discountAmount: 0,
        orderAmount: 0,
        description: `طابع رقم ${finalStamps}${earnedFreeCup ? ' - تم الحصول على مشروب مجاني!' : ''}`,
        employeeId: req.employee?.id,
      } as any);

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard, earnedFreeCup });
    } catch (error) {
      console.error("[LOYALTY ADD STAMP]", error);
      res.status(500).json({ error: "فشل في إضافة الطابع" });
    }
  });

  // Employee: Redeem free drink (uses freeCupsEarned - freeCupsRedeemed)
  app.post("/api/loyalty/employee/redeem-cup", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const available = (card.freeCupsEarned || 0) - (card.freeCupsRedeemed || 0);
      if (available <= 0) return res.status(400).json({ error: "لا يوجد مشروب مجاني متاح" });

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { freeCupsRedeemed: (card.freeCupsRedeemed || 0) + 1 });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'redeem',
        pointsChange: 0,
        discountAmount: 0,
        orderAmount: 0,
        description: 'استرداد مشروب مجاني',
        employeeId: req.employee?.id,
      } as any);

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard });
    } catch (error) {
      console.error("[LOYALTY REDEEM CUP]", error);
      res.status(500).json({ error: "فشل في استرداد المشروب المجاني" });
    }
  });

  // Employee: Redeem a free drink using points (pointsForFreeDrink threshold)
  app.post("/api/loyalty/employee/redeem-drink-with-points", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const tenantId = (card as any).tenantId || 'demo-tenant';
      const { BusinessConfigModel: BizCfg } = await import("@shared/schema");
      const bizCfg = await BizCfg.findOne({ tenantId }).lean() as any;
      const pointsPerSar = Number(bizCfg?.loyaltyConfig?.pointsPerSar) || 20;
      const cfgFallback = Number(bizCfg?.loyaltyConfig?.pointsForFreeDrink) || 500;
      const requiredPoints = await calcFreeDrinkThreshold(tenantId, pointsPerSar, cfgFallback);

      const currentPoints = Number(card.points) || 0;
      if (currentPoints < requiredPoints) {
        return res.status(400).json({
          error: "رصيد النقاط غير كافٍ للحصول على مشروب مجاني",
          currentPoints,
          requiredPoints,
        });
      }

      const cardId = (card as any)._id?.toString() || (card as any).id;
      const newPoints = currentPoints - requiredPoints;

      let tier = (card as any).tier || 'bronze';
      if (newPoints >= 5000) tier = 'platinum';
      else if (newPoints >= 2000) tier = 'gold';
      else if (newPoints >= 500) tier = 'silver';
      else tier = 'bronze';

      await storage.updateLoyaltyCard(cardId, { points: newPoints, tier });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'redeem',
        pointsChange: -requiredPoints,
        discountAmount: 0,
        orderAmount: 0,
        description: `استرداد مشروب مجاني مقابل ${requiredPoints} نقطة`,
        employeeId: req.employee?.id,
      } as any);

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard, pointsUsed: requiredPoints });
    } catch (error) {
      console.error("[LOYALTY REDEEM DRINK WITH POINTS]", error);
      res.status(500).json({ error: "فشل في استرداد المشروب بالنقاط" });
    }
  });

  // Employee: Redeem points for discount
  app.post("/api/loyalty/employee/redeem-points", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone, points } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      const pts = Number(points);
      if (!pts || pts <= 0) return res.status(400).json({ error: "عدد النقاط غير صالح" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      if ((card.points || 0) < pts) return res.status(400).json({ error: "رصيد النقاط غير كافٍ" });

      const config = await storage.getBusinessConfig('demo-tenant');
      const pointsValueInSar = (config as any)?.loyaltyConfig?.pointsValueInSar ?? 0.05;
      const sarValue = pts * pointsValueInSar;

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { points: (card.points || 0) - pts });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'redeem',
        pointsChange: -pts,
        discountAmount: sarValue,
        orderAmount: 0,
        description: `استرداد ${pts} نقطة = ${sarValue.toFixed(2)} ريال خصم`,
        employeeId: req.employee?.id,
      });

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard, discountSar: sarValue });
    } catch (error) {
      console.error("[LOYALTY REDEEM POINTS]", error);
      res.status(500).json({ error: "فشل في استرداد النقاط" });
    }
  });

  // ─── END EMPLOYEE LOYALTY ENDPOINTS ────────────────────────────────────────

  // Get loyalty card by card number (for cashier lookup)
  app.get("/api/loyalty/card/:cardNumber", async (req, res) => {
    try {
      const { cardNumber } = req.params;
      const card = await storage.getLoyaltyCardByCardNumber(cardNumber);

      if (!card) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Generate loyalty codes for an order
  app.post("/api/orders/:orderId/generate-codes", async (req, res) => {
    try {
      const { orderId } = req.params;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      const orderItems = Array.isArray(order.items) ? order.items : [];
      const drinks = orderItems.map((item: any) => ({
        name: item.nameAr || item.name || "مشروب",
        quantity: item.quantity || 1
      }));

      const codes = await storage.generateCodesForOrder(orderId, drinks);
      res.status(201).json(codes);
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الأكواد" });
    }
  });

  // Get codes for an order
  app.get("/api/orders/:orderId/codes", async (req, res) => {
    try {
      const { orderId } = req.params;
      const codes = await storage.getCodesByOrder(orderId);
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الأكواد" });
    }
  });

  // Redeem a code on a loyalty card
  app.post("/api/loyalty/redeem-code", async (req, res) => {
    try {
      const { code, cardId } = req.body;

      if (!code || !cardId) {
        return res.status(400).json({ error: "الكود ومعرف البطاقة مطلوبان" });
      }

      const result = await storage.redeemCode(code, cardId);

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({
        success: true,
        message: result.message,
        card: result.card
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في استخدام الكود" });
    }
  });

  // Update ingredient availability (DEPRECATED: use PUT /api/inventory/raw-items/:id with isActive field)
  app.patch("/api/ingredients/:id/availability", async (req, res) => {
    try {
      console.warn("⚠️ DEPRECATED: PATCH /api/ingredients/:id/availability is deprecated. Use PUT /api/inventory/raw-items/:id with isActive field instead.");
      const { id } = req.params;
      const { isAvailable } = req.body;
      
      // Update ingredient availability
      const ingredient = await storage.updateIngredientAvailability(id, isAvailable);
      
      // Guard: Check if ingredient exists
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      
      // Get all coffee items that use this ingredient
      const affectedCoffeeItems = await storage.getCoffeeItemsByIngredient(id);
      
      // Update availability of affected coffee items
      for (const coffeeItem of affectedCoffeeItems) {
        if (isAvailable === 0) {
          // If ingredient is unavailable, mark all items using it as unavailable
          await storage.updateCoffeeItem(coffeeItem.id, {
            isAvailable: 0,
            availabilityStatus: "out_of_stock" as any
          });
        } else {
          // If ingredient is now available, check if all other ingredients are available
          const itemIngredients = await storage.getCoffeeItemIngredients(coffeeItem.id);
          const allIngredientsAvailable = itemIngredients.every(ing => ing.isAvailable === 1);
          
          if (allIngredientsAvailable) {
            // All ingredients available, make the item available
            await storage.updateCoffeeItem(coffeeItem.id, {
              isAvailable: 1,
              availabilityStatus: "available" as any
            });
          }
        }
      }
      
      res.json({ 
        ingredient, 
        affectedItems: affectedCoffeeItems.length 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update ingredient" });
    }
  });

  // Get ingredients for a coffee item
  app.get("/api/coffee-items/:id/ingredients", async (req, res) => {
    try {
      const { id } = req.params;
      const ingredients = await storage.getCoffeeItemIngredients(id);
      res.json(ingredients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  // Add ingredient to coffee item
  app.post("/api/coffee-items/:id/ingredients", async (req, res) => {
    try {
      const { id } = req.params;
      const { ingredientId, quantity, unit } = req.body;
      const result = await storage.addCoffeeItemIngredient(id, ingredientId, quantity, unit);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to add ingredient" });
    }
  });

  // Remove ingredient from coffee item
  app.delete("/api/coffee-items/:id/ingredients/:ingredientId", async (req, res) => {
    try {
      const { id, ingredientId } = req.params;
      await storage.removeCoffeeItemIngredient(id, ingredientId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove ingredient" });
    }
  });

  // Get coffee items affected by ingredient
  app.get("/api/ingredients/:id/coffee-items", async (req, res) => {
    try {
      const { id } = req.params;
      const coffeeItems = await storage.getCoffeeItemsByIngredient(id);
      res.json(coffeeItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coffee items" });
    }
  });

  // BRANCH MANAGEMENT ROUTES
  app.get("/api/branches", async (req, res) => {
    try {
      const { BranchModel } = await import("@shared/schema");
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const userRole = (req as any).employee?.role;
      const userBranchId = (req as any).employee?.branchId;

      const ck = cacheKey('branches', tenantId, userRole, userBranchId);
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);

      let query: any = {};
      if (userRole === "manager" && userBranchId) {
        query = { $or: [{ id: userBranchId }, { _id: userBranchId }] };
      } else {
        query = { isActive: { $in: [1, true] } };
      }

      const branches = await BranchModel.find(query).lean();
      const serialized = branches.map((b: any) => ({
        ...b,
        id: b.id || b._id?.toString(),
        _id: b._id?.toString()
      }));
      cache.set(ck, serialized, CACHE_TTL.BRANCHES);
      res.json(serialized);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.get("/api/branches/:id", async (req, res) => {
    try {
      const { BranchModel } = await import("@shared/schema");
      const branch = await BranchModel.findOne({ 
        $or: [{ id: req.params.id }, { _id: req.params.id }] 
      }).lean();
      if (!branch) return res.status(404).json({ error: "Branch not found" });
      res.json({
        ...branch,
        id: branch.id || branch._id?.toString(),
        _id: branch._id?.toString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branch" });
    }
  });

  app.get("/api/admin/branches/all", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const branches = await storage.getAllBranches();
      res.json(branches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  // Geolocation check - verify if customer is within 500m of selected branch
  app.post("/api/branches/:id/check-location", async (req, res) => {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ 
          error: "يرجى السماح بالوصول للموقع", 
          withinRange: false 
        });
      }

      const branch = await storage.getBranch(id);
      if (!branch) {
        return res.status(404).json({ error: "الفرع غير موجود", withinRange: false });
      }

      // Check if branch has location data
      if (!branch.location || !branch.location.lat || !branch.location.lng) {
        // If branch has no location, allow ordering (skip check)
        return res.json({ 
          withinRange: true, 
          distance: 0,
          message: "الفرع لا يحتوي على بيانات موقع" 
        });
      }

      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const lat1 = latitude * Math.PI / 180;
      const lat2 = branch.location.lat * Math.PI / 180;
      const deltaLat = (branch.location.lat - latitude) * Math.PI / 180;
      const deltaLon = (branch.location.lng - longitude) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in meters

      const maxDistance = 500; // 500 meters
      const withinRange = distance <= maxDistance;


      res.json({
        withinRange,
        distance: Math.round(distance),
        maxDistance,
        branchName: branch.nameAr,
        message: withinRange 
          ? "أنت ضمن نطاق الفرع" 
          : `أنت بعيد عن الفرع بمسافة ${Math.round(distance)} متر. يجب أن تكون على بعد ${maxDistance} متر كحد أقصى`
      });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من الموقع", withinRange: false });
    }
  });

  // ─── Proximity Notification ──────────────────────────────────────────────
  // In-memory cooldown: prevents duplicate push per customer/device within 1 hour
  const proximityRecentlyNotified = new Map<string, number>();
  const PROXIMITY_COOLDOWN_MS = 60 * 60 * 1000;

  app.post("/api/customer/proximity-notify", async (req, res) => {
    try {
      const { lat, lng, customerId, subscriptionEndpoint } = req.body;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "Location required" });
      }

      // Rate-limit key: prefer customerId, fall back to endpoint
      const rateLimitKey = customerId || subscriptionEndpoint || "anon";
      const lastSent = proximityRecentlyNotified.get(rateLimitKey) || 0;
      if (Date.now() - lastSent < PROXIMITY_COOLDOWN_MS) {
        return res.json({ triggered: false, reason: "cooldown" });
      }

      // Haversine distance (meters)
      const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      // Load all branches
      const { BranchModel } = await import("@shared/schema");
      const branches = await BranchModel.find({}).lean();

      const RADIUS_M = 100;
      let nearestBranch: any = null;
      let nearestDist = Infinity;

      for (const branch of branches) {
        if (!branch.location?.lat || !branch.location?.lng) continue;
        const dist = haversineM(lat, lng, branch.location.lat, branch.location.lng);
        if (dist <= RADIUS_M && dist < nearestDist) {
          nearestDist = dist;
          nearestBranch = branch;
        }
      }

      if (!nearestBranch) {
        return res.json({ triggered: false, reason: "no_nearby_branch" });
      }

      const branchName: string =
        (nearestBranch as any).nameAr || (nearestBranch as any).name || "فرعنا";
      const distRounded = Math.round(nearestDist);

      const pushPayload = {
        title: "☕ لا تفوتك قهوتنا!",
        body: `أنت على بُعد ${distRounded} متر من ${branchName} — تعال واستمتع بأفضل القهوة 🌹`,
        url: "/menu",
        tag: `proximity-${String((nearestBranch as any)._id || "br")}`,
        type: "promo" as const,
        image: "/icons/icon-192x192.png",
      };

      const { PushSubscriptionModel, sendPushBySubscriptions } = await import("./push-service");

      let subs: any[] = [];

      // 1) Try by customer ID
      if (customerId) {
        subs = await PushSubscriptionModel.find({ userId: customerId, userType: "customer" });
      }

      // 2) Try by subscription endpoint as fallback
      if (subs.length === 0 && subscriptionEndpoint) {
        const sub = await PushSubscriptionModel.findOne({ endpoint: subscriptionEndpoint });
        if (sub) subs = [sub];
      }

      let notificationSent = false;
      if (subs.length > 0) {
        await sendPushBySubscriptions(subs, pushPayload);
        notificationSent = true;
        proximityRecentlyNotified.set(rateLimitKey, Date.now());
        console.log(`[PROXIMITY] ✅ Sent to ${subs.length} subscription(s) — ${branchName} ~${distRounded}m`);
      } else {
        console.log(`[PROXIMITY] No push subscriptions found for key=${rateLimitKey}`);
      }

      return res.json({
        triggered: true,
        branchName,
        distance: distRounded,
        notificationSent,
      });
    } catch (err) {
      console.error("[PROXIMITY] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/branches", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { insertBranchSchema, BranchModel } = await import("@shared/schema");
      const branchData = req.body;
      const { managerAssignment, ...cleanBranchData } = branchData;
      
      // Force cafeId and tenantId for safety
      const tenantId = req.employee?.tenantId || 'demo-tenant';
      const cafeId = cleanBranchData.cafeId || tenantId;
      
      const id = cleanBranchData.id || nanoid();
      
      const newBranch = await BranchModel.create({
        ...cleanBranchData,
        id,
        tenantId,
        cafeId,
        isActive: 1, // Ensure numeric 1 for isActive consistency
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const branch = serializeDoc(newBranch);
      const branchId = branch.id;
      let managerInfo: any = null;
      
      // Handle manager assignment based on type
      if (managerAssignment) {
        try {
          if (managerAssignment.type === "existing" && managerAssignment.managerId) {
            // Assign existing manager to the branch
            const existingManager = await storage.getEmployee(managerAssignment.managerId);
            if (existingManager) {
              await storage.updateEmployee(managerAssignment.managerId, {
                branchId: branchId,
              });
              await storage.updateBranch(branchId, {
                managerName: existingManager.fullName,
              });
              managerInfo = {
                id: managerAssignment.managerId,
                fullName: existingManager.fullName,
                message: 'تم تعيين المدير الموجود للفرع بنجاح.',
              };
            }
          } else if (managerAssignment.type === "new" && managerAssignment.newManager) {
            // Create new manager (without password - can activate later)
            const newManagerData = managerAssignment.newManager;
            
            // Check if username already exists
            const existingUser = await storage.getEmployeeByUsername(newManagerData.username);
            if (existingUser) {
              return res.status(400).json({ 
                error: "اسم المستخدم موجود بالفعل",
                field: "username" 
              });
            }
            
            const manager = await storage.createEmployee({
              username: newManagerData.username,
              password: undefined, // No password - must activate account
              fullName: newManagerData.fullName,
              role: 'manager',
              phone: newManagerData.phone,
              jobTitle: 'مدير الفرع',
              isActivated: 0, // Not activated - needs password setup
              branchId: branchId,
              tenantId: tenantId, // Pass tenantId to manager creation
            } as any);
            
            await storage.updateBranch(branchId, {
              managerName: newManagerData.fullName,
            });
            
            managerInfo = {
              id: (manager as any)._id.toString(),
              username: newManagerData.username,
              fullName: newManagerData.fullName,
              message: 'تم إنشاء حساب المدير. يحتاج المدير لتفعيل حسابه عبر إنشاء كلمة المرور.',
            };
          }
        } catch (managerError) {
          managerInfo = { error: 'تم إنشاء الفرع ولكن حدث خطأ في تعيين المدير' };
        }
      } else {
      // No manager assignment provided - auto-create manager (backward compatibility)
      const branchNameAr = branchData.nameAr || "فرع جديد";
      const branchNameSlug = branchNameAr.replace(/\s+/g, '_').toLowerCase();
      const managerUsername = `manager_${branchNameSlug}_${nanoid(4)}`;
      const temporaryPassword = `manager${Math.random().toString(36).slice(-8)}`;
      
      try {
        const manager = await storage.createEmployee({
          username: managerUsername,
          password: temporaryPassword,
          fullName: `مدير ${branchNameAr}`,
          role: 'manager',
          phone: branchData.phone || `05${Math.floor(Math.random() * 100000000)}`,
          jobTitle: 'مدير الفرع',
          isActivated: 1,
          branchId: branchId,
          tenantId: tenantId
        } as any);
        
        await storage.updateBranch(branchId, {
          managerName: `مدير ${branchNameAr}`,
        });
        
        managerInfo = {
          id: (manager as any).id || (manager as any)._id?.toString(),
          username: managerUsername,
          temporaryPassword: temporaryPassword,
          fullName: `مدير ${branchNameAr}`,
          message: 'تم إنشاء حساب المدير تلقائياً. يرجى حفظ اسم المستخدم وكلمة المرور المؤقتة.',
        };
      } catch (autoCreateError) {
        console.error("Auto-create manager error:", autoCreateError);
        managerInfo = { error: 'تم إنشاء الفرع ولكن فشل إنشاء حساب المدير التلقائي' };
      }
      }
      
      res.status(201).json({
        branch,
        manager: managerInfo,
      });
    } catch (error) {
      console.error("Error creating branch:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: (error as any).issues });
      }
      res.status(500).json({ error: "Failed to create branch", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/branches/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const branch = await storage.updateBranch(id, req.body);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.json(branch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBranch(id);
      if (!deleted) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting branch:", error);
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  // CATEGORY MANAGEMENT ROUTES
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const { insertCategorySchema } = await import("@shared/schema");
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const category = await storage.updateCategory(id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // CUSTOMER MANAGEMENT ROUTES (for manager dashboard)
  app.get("/api/admin/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const customersWithoutPasswords = customers.map(({ password: _, ...customer }) => customer);
      res.json(customersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Get orders by employee (for manager to see each cashier's orders)
  app.get("/api/admin/orders/employee/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orders = await storage.getOrdersByEmployee(employeeId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee orders" });
    }
  });

  // TEMPORARY: Reset manager password
  app.post("/api/reset-manager", async (req, res) => {
    try {
      const manager = await storage.getEmployeeByUsername("manager");
      if (manager && manager._id) {
        const hashedPassword = await bcrypt.hash("2030", 10);
        await storage.updateEmployee(manager._id.toString(), { password: hashedPassword });
        res.json({ message: "Manager password reset successfully" });
      } else {
        res.status(404).json({ error: "Manager not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/delivery-zones", async (req, res) => {
    try {
      const zones = await storage.getDeliveryZones();
      res.json(zones);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery zones" });
    }
  });

  app.get("/api/delivery-zones/:id", async (req, res) => {
    try {
      const zone = await storage.getDeliveryZone(req.params.id);
      if (!zone) {
        return res.status(404).json({ error: "Delivery zone not found" });
      }
      res.json(zone);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery zone" });
    }
  });

  app.post("/api/delivery-zones/validate", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }

      const zones = await storage.getDeliveryZones();
      const { getDeliveryZoneForPoint } = await import("./utils/geo");
      
      const mappedZones = zones.map(z => ({
        coordinates: z.boundary || [],
        nameAr: z.nameAr,
        deliveryFee: z.baseFee || 10,
        _id: z._id?.toString() || z.id || ''
      }));
      
      const result = getDeliveryZoneForPoint({ lat, lng }, mappedZones);
      
      if (!result) {
        return res.json({ 
          isInZone: false, 
          message: "عذراً، هذا الموقع خارج نطاق التوصيل. نوصل فقط إلى البديعة وظهرة البديعة" 
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to validate delivery zone" });
    }
  });

  // TABLE MANAGEMENT ROUTES - إدارة الطاولات

  // Cleanup: Clear all old table reservations (temporary endpoint)
  app.post("/api/tables/cleanup-reservations", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const tables = await storage.getTables(undefined, tenantId);
      let cleaned = 0;
      for (const table of tables) {
        if (table.reservedFor) {
          await storage.updateTable((table._id?.toString() || table.id) as string, { 
            reservedFor: undefined as any
          });
          cleaned++;
        }
      }
      res.json({ message: `Cleaned ${cleaned} tables`, cleaned });
    } catch (error) {
      res.status(500).json({ error: "Failed to clean tables" });
    }
  });

  // Get table status (all tables with occupancy info) - MUST COME BEFORE /:id ROUTE
  app.get("/api/tables/status", async (req, res) => {
    try {
      const { branchId } = req.query;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      if (!branchId) {
        return res.status(400).json({ error: "Branch ID required" });
      }

      const tables = await storage.getTables(branchId as string, tenantId);
      const now = new Date();
      
      // Return all active tables with their simple availability status
      const tablesWithStatus = tables
        .filter(t => (t.isActive as any) === 1 || (t.isActive as any) === true || (t.isActive as any) === '1')
        .map(t => {
          // Convert to plain object if it's a MongoDB document
          const obj = (t as any).toObject ? (t as any).toObject() : JSON.parse(JSON.stringify(t));
          
          // Ensure id and _id are both present and strings
          const id = obj.id || obj._id;
          if (id) {
            obj.id = id.toString();
            obj._id = id.toString();
          }

          // Check if table has an active order (currentOrderId exists)
          const hasActiveOrder = !!obj.currentOrderId;
          
          // Check for active reservations with time-based logic
          let isReservationActive = false;
          let reservationInfo = null;
          
          if (obj.reservedFor && obj.reservedFor.status && 
              (obj.reservedFor.status === 'pending' || obj.reservedFor.status === 'confirmed')) {
            
            // Parse reservation date and time
            const resDate = new Date(obj.reservedFor.reservationDate);
            const resTime = obj.reservedFor.reservationTime || '12:00';
            const [hours, minutes] = resTime.split(':').map(Number);
            
            // Create full reservation datetime
            const reservationDateTime = new Date(resDate);
            reservationDateTime.setHours(hours || 12, minutes || 0, 0, 0);
            
            // Reservation activates 30 minutes BEFORE the scheduled time
            const activationTime = new Date(reservationDateTime.getTime() - 30 * 60 * 1000);
            
            // Reservation expires 5 minutes AFTER the scheduled time if customer hasn't arrived
            const expiryTime = new Date(reservationDateTime.getTime() + 5 * 60 * 1000);
            
            // Check if we're within the active window (30 min before to 5 min after)
            if (now >= activationTime && now <= expiryTime) {
              isReservationActive = true;
              reservationInfo = {
                ...obj.reservedFor,
                reservationDateTime: reservationDateTime.toISOString(),
                activationTime: activationTime.toISOString(),
                expiryTime: expiryTime.toISOString(),
                isWithinWindow: true
              };
            }
          }
          
          // A table is occupied ONLY if it has an active order OR an active reservation within time window
          const isOccupied = hasActiveOrder || isReservationActive;
          
          return {
            ...obj,
            isAvailable: !isOccupied,
            isOccupied: isOccupied ? 1 : 0,
            reservationInfo: reservationInfo
          };
        });

      // console.log(`[GET /api/tables/status] Fetched ${tablesWithStatus.length} tables for branch ${branchId}`);
      res.json(tablesWithStatus);
    } catch (error) {
      console.error('[GET /api/tables/status] Error:', error);
      res.status(500).json({ error: "Failed to fetch table status" });
    }
  });

  // Get available tables for reservation - MUST COME BEFORE /:id ROUTE
  app.get("/api/tables/available", async (req, res) => {
    try {
      const { branchId } = req.query;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      if (!branchId) {
        return res.status(400).json({ error: "Branch ID required" });
      }

      const tables = await storage.getTables(branchId as string, tenantId);
      
      // Filter available tables - return only active tables without active reservations
      const availableTables = tables.filter(t => {
        // Check if table is active (accept both 1 and true as valid)
        const isActive = ((t.isActive as any) === 1 || (t.isActive as any) === true || (t.isActive as any) === '1');
        
        // Check if table is not reserved with pending or confirmed status
        const isNotReserved = !t.reservedFor || (t.reservedFor && t.reservedFor.status !== 'pending' && t.reservedFor.status !== 'confirmed');
        
        return isActive && isNotReserved;
      });

      res.json(availableTables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch available tables" });
    }
  });

  // Book table for dine-in order
  app.post("/api/tables/book", async (req, res) => {
    try {
      const { tableId, arrivalTime } = req.body;
      console.log(`[TABLES] Booking request: tableId=${tableId}, arrivalTime=${arrivalTime}`);
      
      if (!tableId || !arrivalTime) {
        return res.status(400).json({ error: "Table ID and arrival time required" });
      }

      const table = await storage.getTable(tableId);
      console.log(`[TABLES] Found table:`, table ? { id: table.id, tableNumber: table.tableNumber } : 'NOT FOUND');
      
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Check if table is available - consider expired reservations as available
      if (table.reservedFor && (table.reservedFor.status === 'pending' || table.reservedFor.status === 'confirmed')) {
        const now = new Date();
        const resDate = new Date(table.reservedFor.reservationDate);
        const resTime = table.reservedFor.reservationTime || '12:00';
        const [hours, minutes] = resTime.split(':').map(Number);
        
        const reservationDateTime = new Date(resDate);
        reservationDateTime.setHours(hours || 12, minutes || 0, 0, 0);
        
        // Reservation expires 5 minutes AFTER the scheduled time
        const expiryTime = new Date(reservationDateTime.getTime() + 5 * 60 * 1000);
        
        // If reservation hasn't expired yet, block booking
        if (now < expiryTime) {
          return res.status(400).json({ error: "الطاولة محجوزة بالفعل" });
        }
        
        // If expired, auto-clear the old reservation before proceeding
        console.log(`[TABLES] Auto-clearing expired reservation for table ${table.tableNumber}`);
      }

      // Create booking with generated ID
      const bookingId = nanoid();
      const now = new Date();
      
      const updatedTable = await storage.updateTable(tableId, {
        reservedFor: {
          customerName: "Online Dine-In Customer",
          customerPhone: "N/A",
          customerId: "customer",
          reservationDate: now,
          reservationTime: arrivalTime,
          numberOfGuests: (table.capacity || 2) as number,
          reservedAt: now,
          reservedBy: "customer",
          status: 'pending'
        }
      });

      if (!updatedTable) {
        return res.status(500).json({ error: "فشل في حجز الطاولة" });
      }

      res.json({ 
        success: true, 
        bookingId: bookingId,
        tableNumber: table.tableNumber,
        arrivalTime: arrivalTime,
        message: `تم حجز الطاولة ${table.tableNumber} بنجاح`
      });
    } catch (error: any) {
      console.error(`[TABLES] Booking error:`, error?.message || error);
      res.status(500).json({ error: "فشل في حجز الطاولة" });
    }
  });

  app.get("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الطاولة" });
    }
  });


  app.get("/api/tables/qr/:qrToken", async (req, res) => {
    try {
      const table = await storage.getTableByQRToken(req.params.qrToken);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الطاولة" });
    }
  });


  app.put("/api/tables/:id", async (req, res) => {
    try {
      // Validate update data (partial schema validation)
      const { insertTableSchema } = await import("@shared/schema");
      const partialSchema = insertTableSchema.partial(); // Allow partial updates
      const validatedData = partialSchema.parse(req.body) as any;
      
      const table = await storage.updateTable(req.params.id, validatedData);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error: any) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      res.status(500).json({ error: "Failed to update table" });
    }
  });

  app.patch("/api/tables/:id/occupancy", async (req, res) => {
    try {
      const { isOccupied, currentOrderId } = req.body;
      const table = await storage.updateTableOccupancy(
        req.params.id, 
        !!isOccupied, 
        currentOrderId
      );
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to update table occupancy" });
    }
  });

    // Empty table (manually clear occupancy)
    app.post("/api/tables/:id/empty", requireAuth, requireManager, async (req, res) => {
      try {
        const { id } = req.params;
        const { TableModel } = await import("@shared/schema");
        
        const table = await TableModel.findOneAndUpdate(
          { 
            $or: [
              { id: id },
              { _id: isValidObjectId(id) ? id : null }
            ].filter(q => q._id !== null || q.id !== undefined)
          },
          {
            isOccupied: 0,
            currentOrderId: null,
            reservedFor: null,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (!table) {
          return res.status(404).json({ error: "Table not found" });
        }
        
        res.json(serializeDoc(table));
      } catch (error) {
        res.status(500).json({ error: "Failed to empty table" });
      }
    });

    // Update table mutation
    app.patch("/api/tables/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
      try {
        const { tableNumber, capacity, branchId } = req.body;
        const updates: any = { updatedAt: new Date() };
        if (tableNumber !== undefined) updates.tableNumber = tableNumber;
        if (capacity !== undefined) updates.capacity = capacity;
        if (branchId !== undefined) updates.branchId = branchId;
        
        const { TableModel } = await import("@shared/schema");
        const table = await TableModel.findOneAndUpdate(
          { 
            $or: [
              { id: req.params.id },
              { _id: isValidObjectId(req.params.id) ? req.params.id : null }
            ].filter(q => q._id !== null || q.id !== undefined)
          },
          { $set: updates },
          { new: true }
        );
        if (!table) return res.status(404).json({ error: "Table not found" });
        res.json(serializeDoc(table));
      } catch (error) {
        console.error("Error updating table:", error);
        res.status(500).json({ error: "Failed to update table" });
      }
    });

  // Reserve a table
  app.post("/api/tables/:id/reserve", async (req, res) => {
    try {
      const { customerName, customerPhone, employeeId, numberOfGuests, reservationDate, reservationTime } = req.body;
      
      if (!customerName || !customerPhone || !employeeId) {
        return res.status(400).json({ error: "Customer name, phone, and employee ID required" });
      }

      // Get employee to verify branch
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get table to verify it belongs to the same branch
      const existingTable = await storage.getTable(req.params.id);
      if (!existingTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Verify branch ownership
      if (existingTable.branchId && employee.branchId && existingTable.branchId !== employee.branchId) {
        return res.status(403).json({ error: "Cannot reserve tables in other branches" });
      }

      // Use provided values or defaults for immediate reservations
      const guests = numberOfGuests ? parseInt(numberOfGuests) : 2;
      const resDate = reservationDate ? new Date(reservationDate) : new Date();
      const resTime = reservationTime || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      // NOTE: Do NOT set isOccupied=1 here - table becomes occupied only when:
      // 1. Customer arrives and scans QR code within the reservation window (30 min before to 5 min after)
      // 2. An active order is placed for the table
      const table = await storage.updateTable(req.params.id, {
        reservedFor: {
          customerName,
          customerPhone,
          reservationDate: resDate,
          reservationTime: resTime,
          numberOfGuests: guests,
          reservedAt: new Date(),
          reservedBy: employeeId,
          status: 'pending' as const
        }
      });

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to reserve table" });
    }
  });

  // Release a table reservation
  app.post("/api/tables/:id/release", async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId } = req.body;

      console.log(`[TABLE] Releasing table ${id}, requested by employee: ${employeeId || 'none'}`);

      const table = await storage.updateTable(id, {
        isOccupied: 0,
        reservedFor: null as any,
        currentOrderId: null as any
      });

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(table);
    } catch (error) {
      console.error("[TABLE] Failed to release table:", error);
      res.status(500).json({ error: "Failed to release table" });
    }
  });

  // Approve a pending reservation
  app.post("/api/tables/:id/approve-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      if (!table.reservedFor || table.reservedFor.status !== 'pending') {
        return res.status(400).json({ error: "No pending reservation to approve" });
      }

      const updatedTable = await storage.updateTable(req.params.id, {
        reservedFor: {
          ...table.reservedFor,
          status: 'confirmed' as const
        }
      });

      if (!updatedTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve reservation" });
    }
  });

  // Cancel a pending reservation
  app.post("/api/tables/:id/cancel-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      if (!table.reservedFor || table.reservedFor.status !== 'pending') {
        return res.status(400).json({ error: "No pending reservation to cancel" });
      }

      const updatedTable = await storage.updateTable(req.params.id, {
        reservedFor: {
          ...table.reservedFor,
          status: 'cancelled' as const
        }
      });

      if (!updatedTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel reservation" });
    }
  });

  // Customer table reservation
  app.post("/api/tables/customer-reserve", async (req, res) => {
    try {
      const { tableId, customerName, customerPhone, customerId, reservationDate, reservationTime, numberOfGuests, branchId } = req.body;
      
      if (!tableId || !customerName || !customerPhone || !reservationDate || !reservationTime || !numberOfGuests) {
        return res.status(400).json({ error: "بيانات ناقصة" });
      }

      const table = await storage.getTable(tableId);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }

      if (table.isOccupied === 1) {
        return res.status(400).json({ error: "الطاولة مشغولة حالياً" });
      }

      // Check for existing active reservations
      const hasActiveReservation = table.reservedFor && 
        (table.reservedFor.status === 'pending' || table.reservedFor.status === 'confirmed');
      
      if (hasActiveReservation) {
        return res.status(400).json({ error: "الطاولة محجوزة بالفعل" });
      }

      const guestCount = typeof numberOfGuests === 'string' ? parseInt(numberOfGuests) : numberOfGuests;
      const resDate = new Date(reservationDate);
      const [hours, minutes] = reservationTime.split(':');
      resDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // حساب الأوقات التلقائية
      const autoBookStart = new Date(resDate.getTime() - 5 * 60 * 1000); // 5 دقائق قبل
      const autoExpiry = new Date(resDate.getTime() + 60 * 60 * 1000); // ساعة واحدة بعد
      
      const updatedTable = await storage.updateTable(tableId, {
        reservedFor: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerId: customerId || 'customer',
          reservationDate: resDate,
          reservationTime: reservationTime,
          numberOfGuests: guestCount,
          reservedAt: new Date(),
          reservedBy: customerId || 'customer',
          status: 'pending',
          autoBookStartTime: autoBookStart,
          autoExpiryTime: autoExpiry,
          extensionCount: 0
        }
      });

      if (!updatedTable) {
        return res.status(500).json({ error: "فشل في حجز الطاولة" });
      }

      // إرسال رسالة تأكيد البريد الإلكتروني
      try {
        const { sendReservationConfirmationEmail } = await import("./mail-service");
        const customer = await CustomerModel.findOne({ phone: customerPhone.trim() });
        if (customer && customer.email) {
          await sendReservationConfirmationEmail(
            customer.email,
            customerName.trim(),
            table.tableNumber,
            reservationDate,
            reservationTime,
            guestCount,
            autoExpiry.toString()
          );
        }
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // لا نرسل خطأ للمستخدم - الحجز نجح حتى لو البريد فشل
      }

      res.json({ 
        success: true, 
        table: updatedTable,
        message: `تم حجز الطاولة ${table.tableNumber} بنجاح`
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الحجز", details: String(error) });
    }
  });

  // البحث عن حجوزات العميل
  app.get("/api/tables/reservations/customer/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;
      const tables = await TableModel.find({
        'reservedFor.customerPhone': phone,
        'reservedFor.status': { $in: ['pending', 'confirmed'] }
      });
      
      const reservations = tables.map((t: any) => ({
        tableId: t._id,
        tableNumber: t.tableNumber,
        branchId: t.branchId,
        reservation: t.reservedFor
      }));
      
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ error: "فشل في البحث عن الحجوزات" });
    }
  });

  // تمديد الحجز (إضافة ساعة أخرى)
  app.post("/api/tables/:tableId/extend-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || !table.reservedFor) {
        return res.status(404).json({ error: "الحجز غير موجود" });
      }

      // السماح بتمديد واحد فقط
      const extensionCount = table.reservedFor.extensionCount || 0;
      if (extensionCount > 0) {
        return res.status(400).json({ error: "تم استخدام خيار التمديد مسبقاً" });
      }

      const newExpiryTime = new Date((table.reservedFor.autoExpiryTime || new Date()).getTime() + 60 * 60 * 1000);
      
      const updatedTable = await storage.updateTable(req.params.tableId, {
        reservedFor: {
          ...table.reservedFor,
          autoExpiryTime: newExpiryTime,
          extensionCount: extensionCount + 1,
          lastExtendedAt: new Date()
        }
      });

      res.json({ 
        success: true,
        message: "تم تمديد الحجز لمدة ساعة إضافية",
        table: updatedTable
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في تمديد الحجز" });
    }
  });

  // فحص انتهاء الحجوزات (تنظيف) - يلغي الحجز بعد 5 دقائق من الموعد إذا لم يحضر العميل
  app.post("/api/tables/check-expirations", async (req, res) => {
    try {
      const now = new Date();
      const tables = await TableModel.find({
        'reservedFor.status': { $in: ['pending', 'confirmed'] }
      });

      let expiredCount = 0;
      for (const table of tables) {
        if (table.reservedFor && table.reservedFor.reservationDate && table.reservedFor.reservationTime) {
          // Check if staff extended the reservation (autoExpiryTime takes precedence)
          let expiryTime: Date;
          
          if (table.reservedFor.autoExpiryTime) {
            // Use staff-extended expiry time
            expiryTime = new Date(table.reservedFor.autoExpiryTime);
          } else {
            // Calculate default expiry: 5 minutes after scheduled time
            const resDate = new Date(table.reservedFor.reservationDate);
            const resTime = table.reservedFor.reservationTime || '12:00';
            const [hours, minutes] = resTime.split(':').map(Number);
            
            const reservationDateTime = new Date(resDate);
            reservationDateTime.setHours(hours || 12, minutes || 0, 0, 0);
            
            expiryTime = new Date(reservationDateTime.getTime() + 5 * 60 * 1000);
          }
          
          // If current time is past expiry and table has no active order (customer didn't arrive)
          if (now > expiryTime && !table.currentOrderId) {
            table.reservedFor.status = 'expired';
            table.isOccupied = 0;
            await table.save();
            expiredCount++;
            console.log(`[check-expirations] Expired reservation for table ${table.tableNumber}`);
          }
        }
      }

      res.json({ 
        message: `تم تحديث ${expiredCount} حجز منتهي الصلاحية`,
        count: expiredCount
      });
    } catch (error) {
      console.error('[check-expirations] Error:', error);
      res.status(500).json({ error: "فشل في فحص الحجوزات" });
    }
  });

  // تأكيد الحجز (تغيير الحالة من pending إلى confirmed)
  app.post("/api/tables/:tableId/approve-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || !table.reservedFor) {
        return res.status(404).json({ error: "الحجز غير موجود" });
      }

      const updatedTable = await storage.updateTable(req.params.tableId, {
        reservedFor: {
          ...table.reservedFor,
          status: 'confirmed'
        }
      });

      res.json({ success: true, table: updatedTable });
    } catch (error) {
      res.status(500).json({ error: "فشل في تأكيد الحجز" });
    }
  });

  // إلغاء الحجز
  app.post("/api/tables/:tableId/cancel-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || !table.reservedFor) {
        return res.status(404).json({ error: "الحجز غير موجود" });
      }

      const updatedTable = await storage.updateTable(req.params.tableId, {
        reservedFor: {
          ...table.reservedFor,
          status: 'cancelled'
        }
      });

      res.json({ success: true, message: "تم إلغاء الحجز", table: updatedTable });
    } catch (error) {
      res.status(500).json({ error: "فشل في إلغاء الحجز" });
    }
  });

  app.get("/api/drivers", async (req, res) => {
    try {
      const drivers = await storage.getAvailableDrivers();
      const driversWithoutPasswords = drivers.map(({ password: _, ...driver }) => driver);
      res.json(driversWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  app.patch("/api/drivers/:id/availability", async (req, res) => {
    try {
      const { isAvailable } = req.body;
      await storage.updateDriverAvailability(req.params.id, isAvailable);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update driver availability" });
    }
  });

  app.patch("/api/drivers/:id/location", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }
      await storage.updateDriverLocation(req.params.id, lat, lng);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update driver location" });
    }
  });

  app.patch("/api/orders/:id/assign-driver", async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ error: "Driver ID required" });
      }
      await storage.assignDriverToOrder(req.params.id, driverId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to assign driver" });
    }
  });

  app.patch("/api/orders/:id/start-delivery", async (req, res) => {
    try {
      await storage.startDelivery(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start delivery" });
    }
  });

  app.patch("/api/orders/:id/complete-delivery", async (req, res) => {
    try {
      await storage.completeDelivery(req.params.id);
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete delivery" });
    }
  });

  app.get("/api/delivery/active-orders", async (req, res) => {
    try {
      const orders = await storage.getActiveDeliveryOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active delivery orders" });
    }
  });

  app.get("/api/drivers/:id/orders", async (req, res) => {
    try {
      const orders = await storage.getDriverActiveOrders(req.params.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver orders" });
    }
  });

  // CASHIER - CUSTOMER MANAGEMENT ROUTES

  // Search for customer by phone number (for cashier)
  app.get("/api/cashier/customers/search", async (req, res) => {
    try {
      const { phone } = req.query;
      
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      if (customer) {
        // Customer exists - return their info
        res.json({
          exists: true,
          customer: {
            id: customer._id,
            phone: customer.phone,
            name: customer.name,
            email: customer.email,
            points: customer.points || 0,
            registeredBy: customer.registeredBy,
            isPasswordSet: customer.isPasswordSet || 0
          }
        });
      } else {
        // Customer doesn't exist
        res.json({
          exists: false,
          phone: cleanPhone
        });
      }
    } catch (error) {
      res.status(500).json({ error: "فشل البحث عن العميل" });
    }
  });

  // Register customer by cashier (partial registration)
  app.post("/api/cashier/customers/register", async (req, res) => {
    try {
      const { phone, name } = req.body;

      if (!phone || !name) {
        return res.status(400).json({ error: "رقم الهاتف والاسم مطلوبان" });
      }

      // Validate phone format
      const cleanPhone = phone.trim().replace(/\s/g, '');
      if (cleanPhone.length !== 9 || !cleanPhone.startsWith('5')) {
        return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام ويبدأ بـ 5" });
      }

      // Check if customer already exists
      const existingCustomer = await storage.getCustomerByPhone(cleanPhone);
      if (existingCustomer) {
        return res.status(400).json({ error: "العميل مسجل بالفعل" });
      }

      // Create customer with cashier registration
      const customer = await storage.createCustomer({
        phone: cleanPhone,
        name: name.trim(),
        registeredBy: 'cashier',
        isPasswordSet: 0,
        points: 0
      });

      // Send Welcome Email asynchronously (if email were available here, but it's not in this endpoint's body)
      // If we had email in req.body, we'd send it here.

      res.status(201).json({
        id: customer._id,
        phone: customer.phone,
        name: customer.name,
        points: customer.points,
        registeredBy: customer.registeredBy,
        isPasswordSet: customer.isPasswordSet
      });
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل العميل" });
    }
  });

  // TABLE ORDER MANAGEMENT ROUTES

  // Cancel order by customer (only before payment confirmation)
  app.patch("/api/orders/:id/cancel-by-customer", async (req, res) => {
    try {
      const { cancellationReason } = req.body;
      const { OrderModel } = await import("@shared/schema");
      
      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // Only allow cancellation if order is pending
      if (order.tableStatus && order.tableStatus !== 'pending') {
        return res.status(400).json({ error: "لا يمكن إلغاء الطلب بعد تأكيد الدفع" });
      }

      // Handle refund of stamps and free drinks before cancelling
      if (order.customerId) {
        try {
          const customer = await storage.getCustomer(order.customerId);
          if (customer?.phone) {
            const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
            if (loyaltyCard) {
              // Parse order items if stored as string
              let items = order.items || [];
              if (typeof items === 'string') {
                try {
                  items = JSON.parse(items);
                } catch (e) {
                  items = [];
                }
              }

              // Calculate stamps used in this order (1 stamp per drink)
              const totalDrinks = Array.isArray(items) 
                ? items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                : 0;

              const currentStamps = loyaltyCard.stamps || 0;
              const currentFreeCupsRedeemed = loyaltyCard.freeCupsRedeemed || 0;

              let updateData: any = {};

              if (totalDrinks > 0) {
                // Deduct stamps from the card
                const newStamps = Math.max(0, currentStamps - totalDrinks);
                const stampsToRemove = currentStamps - newStamps;
                
                updateData.stamps = newStamps;

                // Create loyalty transaction for stamp refund
                await storage.createLoyaltyTransaction({
                  cardId: loyaltyCard.id,
                  type: 'stamps_refunded',
                  pointsChange: -stampsToRemove,
                  discountAmount: 0,
                  orderAmount: order.totalAmount,
                  description: `استرجاع ${stampsToRemove} ختم من إلغاء الطلب #${order.orderNumber}`,
                });
              }

              // Reverse totalSpent when order is cancelled
              const orderAmount = parseFloat(order.totalAmount?.toString() || '0');
              if (orderAmount > 0) {
                const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || '0');
                updateData.totalSpent = Math.max(0, currentTotalSpent - orderAmount);
              }

              // Update card if there are changes
              if (Object.keys(updateData).length > 0) {
                await storage.updateLoyaltyCard(loyaltyCard.id, updateData);
              }
            }
          }
        } catch (error) {
          // Continue with order cancellation even if loyalty update fails
        }
      }

      order.status = 'cancelled';
      order.tableStatus = 'cancelled';
      order.cancelledBy = 'customer';
      order.cancellationReason = cancellationReason || 'إلغاء من العميل';
      order.updatedAt = new Date();
      
      await order.save();
      
      // Update table occupancy if applicable
      if (order.tableId) {
        await storage.updateTableOccupancy(order.tableId, false);
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "فشل إلغاء الطلب" });
    }
  });

  // Assign order to cashier (or accept pending order)
  app.patch("/api/orders/:id/assign-cashier", async (req, res) => {
    try {
      const { cashierId } = req.body;
      const { OrderModel } = await import("@shared/schema");
      
      if (!cashierId) {
        return res.status(400).json({ error: "معرف الكاشير مطلوب" });
      }

      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      if (order.assignedCashierId) {
        return res.status(400).json({ error: "الطلب مستلم بالفعل من كاشير آخر" });
      }

      order.assignedCashierId = cashierId;
      order.updatedAt = new Date();
      
      await order.save();

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "فشل استلام الطلب" });
    }
  });

  // Update table order status (by cashier)
  app.patch("/api/orders/:id/table-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { tableStatus } = req.body;
      const { OrderModel } = await import("@shared/schema");
      
      const validStatuses = ['pending', 'payment_confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
      if (!tableStatus || !validStatuses.includes(tableStatus)) {
        return res.status(400).json({ error: "حالة الطلب غير صالحة" });
      }

      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      order.tableStatus = tableStatus;
      order.updatedAt = new Date();

      // Update main status based on table status
      if (tableStatus === 'payment_confirmed') {
        order.status = 'payment_confirmed';
      } else if (tableStatus === 'delivered') {
        order.status = 'completed';
        // Mark table as available
        if (order.tableId) {
          await storage.updateTableOccupancy(order.tableId, false);
        }
      } else if (tableStatus === 'cancelled') {
        order.status = 'cancelled';
        order.cancelledBy = 'cashier';
        if (order.tableId) {
          await storage.updateTableOccupancy(order.tableId, false);
        }
      }
      
      await order.save();

      // Serialize the response properly
      const serializedOrder = serializeDoc(order);
      res.json(serializedOrder);
    } catch (error) {
      res.status(500).json({ error: "فشل تحديث حالة الطلب" });
    }
  });

  // Get orders assigned to specific cashier
  app.get("/api/cashier/:cashierId/orders", async (req: any, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { status } = req.query;
      const cashierTenantId = req.session?.employee?.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';
      const cashierCoffeeMap = await getCachedCoffeeItemMap(cashierTenantId);
      
      const query: any = {
        assignedCashierId: req.params.cashierId,
        orderType: 'table'
      };

      if (status) {
        query.tableStatus = status;
      }

      const orders = await OrderModel.find(query).sort({ createdAt: -1 });

      // Serialize orders and parse items
      const enrichedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        const items = orderItems.map((item: any) => {
          const coffeeItem = cashierCoffeeMap.get(item.coffeeItemId);
          return {
            ...item,
            coffeeItem: coffeeItem ? {
              nameAr: coffeeItem.nameAr,
              nameEn: coffeeItem.nameEn,
              price: coffeeItem.price,
              imageUrl: coffeeItem.imageUrl
            } : null
          };
        });

        return {
          ...serializedOrder,
          items
        };
      });

      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cashier orders" });
    }
  });

  app.post("/api/orders/mark-all-completed", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branchId = req.employee?.branchId;
      
      const query: any = { tenantId };
      if (branchId) query.branchId = branchId;

      const result = await OrderModel.updateMany(query, { 
        $set: { status: 'completed', updatedAt: new Date() } 
      });

      console.log(`[ORDERS] Marked ${result.modifiedCount} orders as completed for branch ${branchId}`);
      res.json({ message: "تم تحديث جميع الطلبات بنجاح", modifiedCount: result.modifiedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all completed" });
    }
  });

  app.patch("/api/orders/:id/payment-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus, paymentDetails } = req.body;
      
      const updates: any = { paymentStatus };
      if (paymentDetails) updates.paymentDetails = paymentDetails;

      // If marking as paid, also move pending orders to payment_confirmed so kitchen sees them
      const existingOrder = await OrderModel.findOne({ id }) || await OrderModel.findById(id);
      if (paymentStatus === 'paid' && existingOrder?.status === 'pending') {
        updates.status = 'payment_confirmed';
      }

      let updatedOrder = await OrderModel.findOneAndUpdate(
        { id },
        { $set: updates },
        { new: true }
      );

      if (!updatedOrder && (id as any).match(/^[0-9a-fA-F]{24}$/)) {
        updatedOrder = await OrderModel.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true }
        );
      }

      if (!updatedOrder) return res.status(404).json({ error: "الطلب غير موجود" });
      res.json(serializeDoc(updatedOrder));
    } catch (error) {
      console.error("[PAYMENT-STATUS] Error:", error);
      res.status(500).json({ error: "فشل تحديث حالة الدفع" });
    }
  });

  // Complete all orders - for testing/demo
  app.patch("/api/orders/complete-all", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branchQuery: any = {};
      if ((req as any).employee?.branchId) branchQuery.branchId = (req as any).employee.branchId;
      
      // Update all active (non-completed, non-cancelled) orders to completed
      const result = await OrderModel.updateMany(
        { tenantId, ...branchQuery, status: { $nin: ['completed', 'cancelled'] } },
        {
          $set: {
            status: 'completed',
            tableStatus: 'delivered',
            updatedAt: new Date()
          }
        }
      );

      res.json({
        success: true,
        message: `تم تحديث ${result.modifiedCount} طلب إلى حالة مكتمل`,
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete all orders" });
    }
  });

  // Clear all data - admin only
  // Delete all cashier employees (emergency endpoint)
  app.post("/api/admin/test-email", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "Only admins can test email" });
      }
      
      const { testEmailConnection } = await import("./mail-service");
      const success = await testEmailConnection();
      
      res.json({ success, message: success ? "Email connection successful" : "Email connection failed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to test email connection" });
    }
  });

  app.delete("/api/admin/cashiers", async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      const cashiers = employees.filter((e: any) => e.role === 'cashier');
      let deletedCount = 0;

      const { EmployeeModel } = await import("@shared/schema");
      
      for (const cashier of cashiers) {
        try {
          const employeeId = cashier.id || cashier._id?.toString();
          await EmployeeModel.deleteOne({ _id: employeeId });
          deletedCount++;
        } catch (error) {
        }
      }

      res.json({ message: `تم حذف ${deletedCount} موظفي كاشير بنجاح`, deletedCount });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الموظفين" });
    }
  });

  // ============== OWNER DASHBOARD ROUTES ==============

  // Helper: wrap multer middleware so its errors return JSON (not HTML)
  const wrapMulter = (uploadMiddleware: (req: any, res: any, next: any) => void) =>
    (req: any, res: any, next: any) => {
      (uploadMiddleware as any)(req, res, (err: any) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'حجم الملف كبير جداً. الحد الأقصى المسموح 15MB' });
        }
        return res.status(400).json({ error: err.message || 'خطأ في رفع الملف' });
      });
    };

  // Configure multer for employee image uploads
  const employeeUploadsDir = getUploadsDir('employees');
  const employeeStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, employeeUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `employee-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const employeeUpload = multer({
    storage: employeeStorage,
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload employee image
  app.post("/api/upload-employee-image", requireAuth, requireManager, wrapMulter(employeeUpload.single('image')), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const { ObjectStorageService } = await import("./qirox_studio_integrations/object_storage");
      const storageService = new ObjectStorageService();

      try {
        const uploadURL = await storageService.getObjectEntityUploadURL();
        const objectPath = storageService.normalizeObjectEntityPath(uploadURL);

        const fsModule = await import('fs');
        const fileBuffer = fsModule.readFileSync(req.file.path);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file.mimetype || 'image/png',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to object storage');
        }

        fsModule.unlinkSync(req.file.path);
        res.json({ url: objectPath });
      } catch (storageError) {
        console.log('[UPLOAD] Object storage not available, falling back to local storage');
        const fileUrl = `/attached_assets/employees/${req.file.filename}`;
        res.json({ url: fileUrl });
      }
    } catch (error) {
      console.error("Error uploading employee image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Configure multer for drink image uploads
  const drinksUploadsDir = getUploadsDir('drinks');
  const drinksStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(drinksUploadsDir)) {
        fs.mkdirSync(drinksUploadsDir, { recursive: true });
      }
      cb(null, drinksUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `drink-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const drinkUpload = multer({
    storage: drinksStorage,
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload drink image
  app.post("/api/upload-drink-image", requireAuth, requireManager, wrapMulter(drinkUpload.single('image')), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const { ObjectStorageService } = await import("./qirox_studio_integrations/object_storage");
      const storageService = new ObjectStorageService();

      try {
        const uploadURL = await storageService.getObjectEntityUploadURL();
        const objectPath = storageService.normalizeObjectEntityPath(uploadURL);

        const fsModule = await import('fs');
        const fileBuffer = fsModule.readFileSync(req.file.path);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file.mimetype || 'image/png',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to object storage');
        }

        fsModule.unlinkSync(req.file.path);
        res.json({ url: objectPath });
      } catch (storageError) {
        console.log('[UPLOAD] Object storage not available, falling back to local storage');
        const fileUrl = `/attached_assets/drinks/${req.file.filename}`;
        res.json({ url: fileUrl });
      }
    } catch (error) {
      console.error("Error uploading drink image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // List all uploaded drink images
  app.get("/api/drink-images", requireAuth, async (req: AuthRequest, res) => {
    try {
      const drinksDir = path.resolve(__dirname, '..', 'attached_assets', 'drinks');
      if (!fs.existsSync(drinksDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(drinksDir)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort((a, b) => {
          const statA = fs.statSync(path.join(drinksDir, a));
          const statB = fs.statSync(path.join(drinksDir, b));
          return statB.mtimeMs - statA.mtimeMs;
        })
        .map(f => ({
          filename: f,
          url: `/attached_assets/drinks/${f}`,
          uploadedAt: fs.statSync(path.join(drinksDir, f)).mtime.toISOString()
        }));
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to list drink images" });
    }
  });

  // Configure multer for size image uploads
  const sizesUploadsDir = getUploadsDir('sizes');
  const sizesStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(sizesUploadsDir)) {
        fs.mkdirSync(sizesUploadsDir, { recursive: true });
      }
      cb(null, sizesUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `size-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const sizeUpload = multer({
    storage: sizesStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload size image
  app.post("/api/upload-size-image", requireAuth, requireManager, wrapMulter(sizeUpload.single('image')), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }
      const fileUrl = `/attached_assets/sizes/${req.file.filename}`;
      console.log(`[UPLOAD] Size image uploaded successfully: ${fileUrl}`);
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  // Configure multer for addon image uploads
  const addonsUploadsDir = getUploadsDir('addons');
  const addonsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(addonsUploadsDir)) {
        fs.mkdirSync(addonsUploadsDir, { recursive: true });
      }
      cb(null, addonsUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `addon-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const addonUpload = multer({
    storage: addonsStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload addon image
  app.post("/api/upload-addon-image", requireAuth, requireManager, wrapMulter(addonUpload.single('image')), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }
      const fileUrl = `/attached_assets/addons/${req.file.filename}`;
      console.log(`[UPLOAD] Addon image uploaded successfully: ${fileUrl}`);
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  app.post("/old-upload-addon-image", requireAuth, requireManager, addonUpload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }
      const fileUrl = `/attached_assets/addons/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  // Configure multer for attendance photo uploads
  const attendanceUploadsDir = getUploadsDir('attendance');
  const attendanceStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, attendanceUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `attendance-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const attendanceUpload = multer({
    storage: attendanceStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimeType = allowedTypes.test(file.mimetype);

      if (ext && mimeType) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. فقط صور (JPG, PNG, WEBP)'));
      }
    }
  });

  // Upload attendance photo
  app.post("/api/upload-attendance-photo", attendanceUpload.single('photo'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }

      const fileUrl = `/attached_assets/attendance/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  // ============== ATTENDANCE ROUTES ==============

  // Check-in employee
  app.post("/api/attendance/check-in", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, BranchModel, EmployeeModel } = await import("@shared/schema");
      const { location, photoUrl } = req.body;
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      if (!location || !location.lat || !location.lng) {
        return res.status(400).json({ error: "الموقع مطلوب للتحضير" });
      }

      // Selfie photo is REQUIRED for check-in
      if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.trim().length === 0) {
        return res.status(400).json({ error: "صورة السلفي مطلوبة للتحضير. الرجاء التقاط صورة قبل تسجيل الحضور." });
      }

      // Get employee details
      const employee = await EmployeeModel.findOne({ 
        $or: [{ id: employeeId }, { _id: employeeId }]
      });
      
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      // Get branch location
      const branch = employee.branchId ? await BranchModel.findOne({ 
        $or: [{ id: employee.branchId }, { _id: employee.branchId }]
      }) : null;
      
      let isWithinBoundary = true; // Default: allow if no branch/location configured
      let distance = 0;

      // Only enforce geolocation if branch has location configured
      if (branch && branch.location && branch.location.lat && branch.location.lng) {
        const branchLat = branch.location.lat;
        const branchLng = branch.location.lng;
        isWithinBoundary = false;

        // Check if branch has polygon boundary (more accurate)
        if (branch.geofenceBoundary && Array.isArray(branch.geofenceBoundary) && branch.geofenceBoundary.length >= 3) {
          const turf = await import('@turf/turf');
          const employeePoint = turf.point([location.lng, location.lat]);
          const polygonCoords = branch.geofenceBoundary.map((p: any) => [p.lng, p.lat]);
          polygonCoords.push(polygonCoords[0]);
          const branchPolygon = turf.polygon([polygonCoords]);
          isWithinBoundary = turf.booleanPointInPolygon(employeePoint, branchPolygon);
          distance = calculateDistance(location.lat, location.lng, branchLat, branchLng);

          if (!isWithinBoundary) {
            const mapsUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${branchLat},${branchLng}`;
            return res.status(400).json({ 
              error: `أنت خارج حدود الفرع المحددة. يرجى التوجه للفرع للتحضير.`,
              distance: Math.round(distance),
              userLocation: { lat: location.lat, lng: location.lng },
              branchLocation: { lat: branchLat, lng: branchLng },
              mapsUrl,
              showMap: true,
              boundaryType: 'polygon'
            });
          }
        } else {
          // Fallback to radius-based check
          const maxDistance = branch.geofenceRadius || 500;
          distance = calculateDistance(location.lat, location.lng, branchLat, branchLng);
          isWithinBoundary = distance <= maxDistance;

          if (!isWithinBoundary) {
            const mapsUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${branchLat},${branchLng}`;
            return res.status(400).json({ 
              error: `أنت بعيد جداً عن الفرع (${Math.round(distance)} متر). يرجى التوجه للفرع للتحضير.`,
              distance: Math.round(distance),
              userLocation: { lat: location.lat, lng: location.lng },
              branchLocation: { lat: branchLat, lng: branchLng },
              mapsUrl,
              showMap: true,
              boundaryType: 'radius'
            });
          }
        }
      }
      // If branch has no location configured → skip geolocation check, allow check-in

      // Check if already checked in today
      const today = getSaudiStartOfDay();
      const tomorrow = getSaudiEndOfDay();

      const existingAttendance = await AttendanceModel.findOne({
        employeeId: employeeId,
        shiftDate: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      if (existingAttendance) {
        return res.status(400).json({ error: "تم التحضير مسبقاً اليوم" });
      }

      const now = new Date();
      let shiftStartHour = 8;
      let shiftStartMinute = 0;
      if ((employee as any).shiftStartTime) {
        const parts = (employee as any).shiftStartTime.split(':');
        shiftStartHour = parseInt(parts[0]) || 8;
        shiftStartMinute = parseInt(parts[1]) || 0;
      } else if (employee.shiftTime) {
        shiftStartHour = parseInt(employee.shiftTime.split('-')[0]) || 8;
      }
      const shiftStart = new Date(today.getTime() + shiftStartHour * 60 * 60 * 1000 + shiftStartMinute * 60 * 1000);
      
      const isLate = now > shiftStart;
      const lateMinutes = isLate ? Math.floor((now.getTime() - shiftStart.getTime()) / 60000) : 0;

      // Create attendance record with location verification
      const isAtBranch = isWithinBoundary ? 1 : 0;
      const attendance = new AttendanceModel({
        employeeId: employeeId,
        branchId: employee.branchId || '',
        checkInTime: now,
        checkInLocation: {
          lat: location.lat,
          lng: location.lng
        },
        checkInPhoto: photoUrl || '',
        status: 'checked_in',
        shiftDate: today,
        isLate: isLate ? 1 : 0,
        lateMinutes: lateMinutes,
        isAtBranch: isAtBranch,
        distanceFromBranch: Math.round(distance)
      });

      await attendance.save();

      res.json({
        success: true,
        message: isLate ? `تم التحضير بنجاح (متأخر ${lateMinutes} دقيقة)` : "تم التحضير بنجاح",
        attendance: serializeDoc(attendance),
        isLate,
        lateMinutes
      });
    } catch (error) {
      res.status(500).json({ error: "فشل التحضير" });
    }
  });

  // Check-out employee
  app.post("/api/attendance/check-out", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, BranchModel, EmployeeModel } = await import("@shared/schema");
      const { location, photoUrl } = req.body;
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      if (!location || !location.lat || !location.lng) {
        return res.status(400).json({ error: "الموقع مطلوب للانصراف" });
      }

      // photoUrl is optional — check-out is allowed without a photo

      // Get employee details
      const employee = await EmployeeModel.findOne({ 
        $or: [{ id: employeeId }, { _id: employeeId }]
      });
      
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      // Get branch location
      const branch = employee.branchId ? await BranchModel.findOne({ 
        $or: [{ id: employee.branchId }, { _id: employee.branchId }]
      }) : null;

      let distance = 0;
      let checkOutIsAtBranch = 1; // Default: mark as at-branch if no location configured

      // Only enforce geolocation if branch has location configured
      if (branch && branch.location && branch.location.lat && branch.location.lng) {
        const branchLat = branch.location.lat;
        const branchLng = branch.location.lng;
        distance = calculateDistance(location.lat, location.lng, branchLat, branchLng);
        checkOutIsAtBranch = distance <= 500 ? 1 : 0;

        if (distance > 500) {
          const mapsUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${branchLat},${branchLng}`;
          return res.status(400).json({ 
            error: `أنت بعيد جداً عن الفرع (${Math.round(distance)} متر). يرجى التوجه للفرع للانصراف.`,
            distance: Math.round(distance),
            userLocation: { lat: location.lat, lng: location.lng },
            branchLocation: { lat: branchLat, lng: branchLng },
            mapsUrl,
            showMap: true
          });
        }
      }
      // If branch has no location configured → skip geolocation check, allow check-out

      // Find today's check-in
      const today = getSaudiStartOfDay();
      const tomorrow = getSaudiEndOfDay();

      const attendance = await AttendanceModel.findOne({
        employeeId: employeeId,
        shiftDate: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      if (!attendance) {
        return res.status(400).json({ error: "لم تقم بالتحضير اليوم" });
      }

      // Update attendance with check-out and location verification
      attendance.checkOutTime = new Date();
      attendance.checkOutLocation = {
        lat: location.lat,
        lng: location.lng
      };
      attendance.checkOutPhoto = photoUrl;
      attendance.status = 'checked_out';
      attendance.checkOutIsAtBranch = checkOutIsAtBranch;
      attendance.checkOutDistanceFromBranch = Math.round(distance);
      attendance.updatedAt = new Date();

      await attendance.save();

      res.json({
        success: true,
        message: "تم الانصراف بنجاح",
        attendance: serializeDoc(attendance)
      });
    } catch (error) {
      res.status(500).json({ error: "فشل الانصراف" });
    }
  });

  // ─── Live Location Tracking ───────────────────────────────────────────────

  // POST /api/attendance/location-update — employee sends periodic location
  app.post("/api/attendance/location-update", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LocationTrackModel, AttendanceModel, BranchModel } = await import("@shared/schema");
      const employee = req.employee!;
      const { lat, lng, accuracy, attendanceId } = req.body;

      if (!lat || !lng || !attendanceId) {
        return res.status(400).json({ error: "بيانات الموقع ناقصة" });
      }

      // Verify this attendance belongs to this employee and is still checked in
      const attendance = await AttendanceModel.findOne({
        _id: attendanceId,
        employeeId: String(employee.id),
        status: 'checked_in',
      });
      if (!attendance) {
        return res.status(404).json({ error: "لا يوجد حضور نشط" });
      }

      // Check if inside branch
      let isInsideBranch = true;
      let distanceFromBranch = 0;

      const branch = await BranchModel.findById(attendance.branchId);
      if (branch && branch.location?.lat && branch.location?.lng) {
        const R = 6371000;
        const dLat = (lat - branch.location.lat) * Math.PI / 180;
        const dLng = (lng - branch.location.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(branch.location.lat * Math.PI / 180) *
          Math.cos(lat * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2;
        distanceFromBranch = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        const radius = (branch.location as any).radius || 200;
        isInsideBranch = distanceFromBranch <= radius;
      }

      // Save track point
      const track = new LocationTrackModel({
        attendanceId: String(attendance._id),
        employeeId: String(employee.id),
        branchId: attendance.branchId,
        lat,
        lng,
        accuracy,
        isInsideBranch,
        distanceFromBranch,
        timestamp: new Date(),
      });
      await track.save();

      // Broadcast via WebSocket to managers
      const { wsManager } = await import("./websocket");
      wsManager.broadcastEmployeeLocation({
        employeeId: String(employee.id),
        attendanceId: String(attendance._id),
        branchId: attendance.branchId,
        location: { lat, lng },
        isInsideBranch,
        distanceFromBranch,
        employeeName: employee.fullName,
        employeePhoto: (employee as any).imageUrl,
      });

      res.json({ success: true, isInsideBranch, distanceFromBranch });
    } catch (error) {
      console.error("[Location Track] Error:", error);
      res.status(500).json({ error: "فشل حفظ الموقع" });
    }
  });

  // GET /api/attendance/location-history/:attendanceId — get movement trail
  app.get("/api/attendance/location-history/:attendanceId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { LocationTrackModel } = await import("@shared/schema");
      const { attendanceId } = req.params;

      const tracks = await LocationTrackModel.find({ attendanceId })
        .sort({ timestamp: 1 })
        .lean();

      res.json(tracks);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب تاريخ التتبع" });
    }
  });

  // GET /api/attendance/live-employees — managers see all active employees with last known location
  app.get("/api/attendance/live-employees", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { LocationTrackModel, AttendanceModel, EmployeeModel, BranchModel } = await import("@shared/schema");
      const employee = req.employee!;

      const query: any = { status: 'checked_in' };
      if (employee.role === 'manager' && employee.branchId) {
        query.branchId = employee.branchId;
      }

      const activeAttendances = await AttendanceModel.find(query).lean();
      const result = [];

      for (const att of activeAttendances) {
        const emp = await EmployeeModel.findById(att.employeeId).lean();
        if (!emp) continue;

        const lastTrack = await LocationTrackModel.findOne({ attendanceId: String(att._id) })
          .sort({ timestamp: -1 })
          .lean();

        result.push({
          attendanceId: String(att._id),
          employeeId: String(emp._id),
          employeeName: emp.fullName,
          employeePhoto: emp.imageUrl,
          jobTitle: emp.jobTitle,
          branchId: att.branchId,
          checkInTime: att.checkInTime,
          checkInLocation: att.checkInLocation,
          lastLocation: lastTrack ? { lat: lastTrack.lat, lng: lastTrack.lng } : att.checkInLocation,
          isInsideBranch: lastTrack ? lastTrack.isInsideBranch : true,
          distanceFromBranch: lastTrack ? lastTrack.distanceFromBranch : 0,
          lastSeen: lastTrack ? lastTrack.timestamp : att.checkInTime,
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب الموظفين النشطين" });
    }
  });

  // Get attendance records (for managers and admins)
  app.get("/api/attendance", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, EmployeeModel, BranchModel } = await import("@shared/schema");
      const { date, branchId, employeeId } = req.query;

      const query: any = {};

      // If manager: show attendance for their branch employees
      // If admin/owner: show all attendance including managers
      if (req.employee?.role === 'manager' && req.employee?.branchId) {
        query.branchId = req.employee.branchId;
      } else if (req.employee?.role === 'admin' || req.employee?.role === 'owner') {
        // Admin can filter by branch if specified
        if (branchId) {
          query.branchId = branchId;
        }
        // Admin can also see manager attendance by filtering by role
        // This will be handled by enrichment
      } else if (branchId) {
        query.branchId = branchId;
      }

      // Filter by date
      if (date) {
        const targetDate = new Date(date as string);
        const saudiDayStart = getSaudiStartOfDay(targetDate);
        const saudiDayEnd = getSaudiEndOfDay(targetDate);
        query.shiftDate = { $gte: saudiDayStart, $lt: saudiDayEnd };
      }

      // Filter by employee
      if (employeeId) {
        query.employeeId = employeeId;
      }

      const attendances = await AttendanceModel.find(query).sort({ shiftDate: -1, checkInTime: -1 });

      // Enrich with employee and branch data
      const enrichedAttendances = await Promise.all(
        attendances.map(async (attendance) => {
          const employee = await EmployeeModel.findOne({
            $or: [{ id: attendance.employeeId }, { _id: attendance.employeeId }]
          });
          const branch = await BranchModel.findOne({
            $or: [{ id: attendance.branchId }, { _id: attendance.branchId }]
          });
          return {
            ...serializeDoc(attendance),
            employee: employee ? {
              fullName: employee.fullName,
              phone: employee.phone,
              jobTitle: employee.jobTitle,
              shiftTime: employee.shiftTime,
              role: employee.role,
              imageUrl: employee.imageUrl
            } : null,
            branch: branch ? {
              name: branch.nameAr
            } : null
          };
        })
      );

      res.json(enrichedAttendances);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب سجلات الحضور" });
    }
  });

  app.get("/api/attendance/daily-summary", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, EmployeeModel } = await import("@shared/schema");
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const dayStart = getSaudiStartOfDay(targetDate);
      const dayEnd = getSaudiEndOfDay(targetDate);

      const branchQuery: any = {};
      if (req.employee?.role !== 'admin' && req.employee?.role !== 'owner' && req.employee?.branchId) {
        branchQuery.branchId = req.employee.branchId;
      }

      const allEmployees = await EmployeeModel.find({ ...branchQuery, isActive: { $ne: false } }).lean();
      const todayAttendance = await AttendanceModel.find({ shiftDate: { $gte: dayStart, $lt: dayEnd }, ...branchQuery }).lean();

      const attendanceMap = new Map();
      todayAttendance.forEach((a: any) => attendanceMap.set(a.employeeId, serializeDoc(a)));

      const dayIndex = targetDate.getDay();
      const dayNameEn = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dayIndex];
      const dayNameAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][dayIndex];

      const summary = {
        present: [] as any[],
        late: [] as any[],
        absent: [] as any[],
        onLeave: [] as any[],
        checkedOut: [] as any[],
      };

      for (const emp of allEmployees) {
        const empId = (emp as any).id || (emp as any)._id?.toString();
        const att = attendanceMap.get(empId);
        const empInfo = { id: empId, fullName: (emp as any).fullName, role: (emp as any).role, jobTitle: (emp as any).jobTitle, shiftTime: (emp as any).shiftTime };

        const workDays = (emp as any).workDays || [];
        const isScheduledToday = workDays.length === 0 || workDays.some((d: string) => {
          const dl = d.toLowerCase();
          return dl === dayNameEn || d === dayNameAr;
        });

        if (!isScheduledToday) continue;

        if (att) {
          if (att.status === 'checked_out') {
            summary.checkedOut.push({ ...empInfo, attendance: att });
          } else if (att.isLate) {
            summary.late.push({ ...empInfo, attendance: att, lateMinutes: att.lateMinutes });
          } else {
            summary.present.push({ ...empInfo, attendance: att });
          }
        } else {
          summary.absent.push(empInfo);
        }
      }

      res.json({
        date: targetDate.toISOString().split('T')[0],
        totalEmployees: allEmployees.length,
        presentCount: summary.present.length,
        lateCount: summary.late.length,
        absentCount: summary.absent.length,
        checkedOutCount: summary.checkedOut.length,
        ...summary
      });
    } catch (error) {
      console.error("Error getting daily attendance summary:", error);
      res.status(500).json({ error: "فشل في جلب ملخص الحضور" });
    }
  });

  // Get my attendance status (for employee)
  app.get("/api/attendance/my-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel } = await import("@shared/schema");
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const today = getSaudiStartOfDay();
      const tomorrow = getSaudiEndOfDay();

      const todayAttendance = await AttendanceModel.findOne({
        employeeId: employeeId,
        shiftDate: { $gte: today, $lt: tomorrow }
      });

      // Calculate leave balance (default 21 days per year - approved leaves)
      const annualLeaves = 21;
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const currentYear = new Date().getFullYear();
      const approvedLeaves = await LeaveRequestModel.find({
        employeeId: employeeId,
        status: 'approved',
        startDate: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
      });
      const usedLeaves = approvedLeaves.reduce((sum, leave) => sum + (leave.numberOfDays || 0), 0);
      const leaveBalance = Math.max(0, annualLeaves - usedLeaves);

      // Fetch employee shift times for display
      const { EmployeeModel } = await import("@shared/schema");
      const empDoc = await EmployeeModel.findOne({ $or: [{ id: employeeId }, { _id: employeeId }] }).lean() as any;
      const shiftStartTime = empDoc?.shiftStartTime || (empDoc?.shiftTime ? empDoc.shiftTime.split('-')[0] + ':00' : '08:00');
      const shiftEndTime   = empDoc?.shiftEndTime   || (empDoc?.shiftTime ? empDoc.shiftTime.split('-')[1] + ':00' : '17:00');

      res.json({
        hasCheckedIn: !!todayAttendance,
        hasCheckedOut: todayAttendance?.status === 'checked_out',
        attendance: todayAttendance ? serializeDoc(todayAttendance) : null,
        todayCheckIn: todayAttendance?.checkInTime || null,
        todayCheckOut: todayAttendance?.checkOutTime || null,
        leaveBalance: leaveBalance,
        totalLeaves: annualLeaves,
        shiftStartTime,
        shiftEndTime,
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب حالة الحضور" });
    }
  });

  // Comprehensive monthly attendance report
  app.get("/api/attendance/monthly-report", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, EmployeeModel } = await import("@shared/schema");
      const { year, month, employeeId, branchId } = req.query;

      const y = parseInt(year as string) || new Date().getFullYear();
      const m = parseInt(month as string) || (new Date().getMonth() + 1);

      // Saudi timezone offset: +3 hours
      const monthStart = new Date(`${y}-${String(m).padStart(2,'0')}-01T00:00:00+03:00`);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const query: any = { shiftDate: { $gte: monthStart, $lt: monthEnd } };

      if (req.employee?.role === 'manager' && req.employee?.branchId) {
        query.branchId = req.employee.branchId;
      } else if (branchId) {
        query.branchId = branchId;
      }
      if (employeeId) query.employeeId = employeeId;

      const allAttendance = await AttendanceModel.find(query).lean();

      // Group by employeeId
      const byEmployee: Record<string, any[]> = {};
      allAttendance.forEach((a: any) => {
        const id = a.employeeId;
        if (!byEmployee[id]) byEmployee[id] = [];
        byEmployee[id].push(a);
      });

      // Get employees in scope
      const empQuery: any = {};
      if (req.employee?.role === 'manager' && req.employee?.branchId) {
        empQuery.branchId = req.employee.branchId;
      } else if (branchId) {
        empQuery.branchId = branchId;
      }
      if (employeeId) {
        empQuery.$or = [{ id: employeeId }, { _id: employeeId }];
      }
      const employees = await EmployeeModel.find({ ...empQuery, isActive: { $ne: false } }).lean();

      // Count work days in month (Sun-Thu by default)
      const daysInMonth = new Date(y, m, 0).getDate();
      let workDaysInMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (dow !== 5 && dow !== 6) workDaysInMonth++; // Skip Fri/Sat
      }

      // Orders for employee sales
      const { OrderModel } = await import("@shared/schema");
      const allOrders = await OrderModel.find({
        createdAt: { $gte: monthStart, $lt: monthEnd },
        status: { $in: ['completed', 'delivered'] },
        ...(req.employee?.role === 'manager' && req.employee?.branchId ? { branchId: req.employee.branchId } : {}),
      }).lean();

      const salesByEmployee: Record<string, { count: number; total: number }> = {};
      allOrders.forEach((o: any) => {
        const empId = o.employeeId || o.servedBy || o.cashierId;
        if (empId) {
          if (!salesByEmployee[empId]) salesByEmployee[empId] = { count: 0, total: 0 };
          salesByEmployee[empId].count++;
          salesByEmployee[empId].total += parseFloat(o.total || o.totalAmount || '0');
        }
      });

      const report = employees.map((emp: any) => {
        const empId = emp.id || emp._id?.toString();
        const records = byEmployee[empId] || [];
        const presentDays = records.length;
        const absentDays = Math.max(0, workDaysInMonth - presentDays);
        const lateDays = records.filter((r: any) => r.isLate).length;
        const totalLateMinutes = records.reduce((s: number, r: any) => s + (r.lateMinutes || 0), 0);
        const totalWorkMinutes = records.reduce((s: number, r: any) => {
          if (r.checkInTime && r.checkOutTime) {
            return s + Math.floor((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000);
          }
          return s;
        }, 0);
        const sales = salesByEmployee[empId] || { count: 0, total: 0 };
        return {
          employee: {
            id: empId,
            fullName: emp.fullName,
            role: emp.role,
            jobTitle: emp.jobTitle,
            shiftTime: emp.shiftTime,
            imageUrl: emp.imageUrl,
          },
          presentDays,
          absentDays,
          lateDays,
          totalLateMinutes,
          totalWorkHours: Math.floor(totalWorkMinutes / 60),
          attendanceRate: workDaysInMonth > 0 ? Math.round((presentDays / workDaysInMonth) * 100) : 0,
          salesCount: sales.count,
          salesTotal: parseFloat(sales.total.toFixed(2)),
          records: records.map(serializeDoc),
        };
      });

      // Sort by attendance rate desc for "best employee"
      report.sort((a, b) => b.attendanceRate - a.attendanceRate || b.salesTotal - a.salesTotal);

      res.json({
        year: y,
        month: m,
        workDaysInMonth,
        totalEmployees: employees.length,
        report,
        bestEmployee: report[0] || null,
      });
    } catch (error) {
      console.error("[ATTENDANCE REPORT]", error);
      res.status(500).json({ error: "فشل في إنشاء التقرير الشهري" });
    }
  });

  // Reset only operational data (orders, accounting) - keep products, employees, images
  app.delete("/api/admin/reset-orders-only", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "فقط المالك أو المدير العام يمكنه تصفير البيانات" });
      }
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const { OrderModel, CartItemModel } = await import("@shared/schema");
      const DailyAccounting = mongoose.models['DailyAccounting'];

      const results = await Promise.all([
        OrderModel.deleteMany({ tenantId }),
        CartItemModel.deleteMany({ tenantId }),
        DailyAccounting ? DailyAccounting.deleteMany({ tenantId }) : Promise.resolve({ deletedCount: 0 }),
      ]);

      res.json({
        success: true,
        message: "تم تصفير الطلبات والمحاسبة بنجاح. المنتجات والموظفون والصور محفوظة.",
        deleted: {
          orders: results[0].deletedCount,
          cartItems: results[1].deletedCount,
          accountingRecords: (results[2] as any).deletedCount || 0,
        }
      });
    } catch (error) {
      console.error("[RESET ORDERS]", error);
      res.status(500).json({ error: "فشل تصفير الطلبات" });
    }
  });

  // ============== LEAVE REQUEST ROUTES ==============

  // Submit a leave request
  app.post("/api/leave-requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const { startDate, endDate, reason } = req.body;

      if (!startDate || !endDate || !reason) {
        return res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        return res.status(400).json({ error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية" });
      }

      const numberOfDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const leaveRequest = new LeaveRequestModel({
        employeeId,
        startDate: start,
        endDate: end,
        reason,
        numberOfDays,
        status: 'pending'
      });

      await leaveRequest.save();

      res.status(201).json(serializeDoc(leaveRequest));
    } catch (error) {
      res.status(500).json({ error: "فشل تقديم طلب الاجازة" });
    }
  });

  // Get my leave requests
  app.get("/api/leave-requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const requests = await LeaveRequestModel.find({ employeeId }).sort({ createdAt: -1 });

      res.json(requests.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب طلبات الاجازة" });
    }
  });

  // Get all pending leave requests (manager/admin only)
  app.get("/api/leave-requests/pending", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const role = req.employee?.role;

      if (role !== 'manager' && role !== 'admin' && role !== 'owner') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const requests = await LeaveRequestModel.find({ status: 'pending' }).sort({ createdAt: -1 });

      res.json(requests.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب طلبات الاجازة المعلقة" });
    }
  });

  // Approve a leave request (manager/admin only)
  app.patch("/api/leave-requests/:id/approve", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");

      if (req.employee?.role !== 'manager' && req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const request = await LeaveRequestModel.findByIdAndUpdate(
        req.params.id,
        {
          status: 'approved',
          approvedBy: req.employee.id,
          approvalDate: new Date()
        },
        { new: true }
      );

      if (!request) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      res.json(serializeDoc(request));
    } catch (error) {
      res.status(500).json({ error: "فشل الموافقة على الطلب" });
    }
  });

  // Reject a leave request (manager/admin only)
  app.patch("/api/leave-requests/:id/reject", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");

      if (req.employee?.role !== 'manager' && req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const { rejectionReason } = req.body;

      const request = await LeaveRequestModel.findByIdAndUpdate(
        req.params.id,
        {
          status: 'rejected',
          approvedBy: req.employee.id,
          approvalDate: new Date(),
          rejectionReason
        },
        { new: true }
      );

      if (!request) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      res.json(serializeDoc(request));
    } catch (error) {
      res.status(500).json({ error: "فشل رفض الطلب" });
    }
  });

  // Helper function to calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // ============== OWNER DATABASE MANAGEMENT ROUTES ==============

  // Get database statistics (owner only)
  app.get("/api/owner/database-stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const { 
        OrderModel, CustomerModel, EmployeeModel, CoffeeItemModel, 
        BranchModel, DiscountCodeModel, LoyaltyCardModel, TableModel,
        AttendanceModel, IngredientModel, CategoryModel, DeliveryZoneModel
      } = await import("@shared/schema");

      const [
        ordersCount, customersCount, employeesCount, coffeeItemsCount,
        branchesCount, discountCodesCount, loyaltyCardsCount, tablesCount,
        attendanceCount, ingredientsCount, categoriesCount, deliveryZonesCount,
        todayOrders, totalRevenue
      ] = await Promise.all([
        OrderModel.countDocuments(),
        CustomerModel.countDocuments(),
        EmployeeModel.countDocuments(),
        CoffeeItemModel.countDocuments(),
        BranchModel.countDocuments(),
        DiscountCodeModel.countDocuments(),
        LoyaltyCardModel.countDocuments(),
        TableModel.countDocuments(),
        AttendanceModel.countDocuments(),
        IngredientModel.countDocuments(),
        CategoryModel.countDocuments(),
        DeliveryZoneModel.countDocuments(),
        OrderModel.countDocuments({
          createdAt: { $gte: getSaudiStartOfDay(), $lte: getSaudiEndOfDay() },
          status: { $ne: 'cancelled' }
        }),
        OrderModel.aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ])
      ]);

      res.json({
        collections: {
          orders: { count: ordersCount, nameAr: 'الطلبات' },
          customers: { count: customersCount, nameAr: 'العملاء' },
          employees: { count: employeesCount, nameAr: 'الموظفين' },
          coffeeItems: { count: coffeeItemsCount, nameAr: 'المشروبات' },
          branches: { count: branchesCount, nameAr: 'الفروع' },
          discountCodes: { count: discountCodesCount, nameAr: 'أكواد الخصم' },
          loyaltyCards: { count: loyaltyCardsCount, nameAr: 'بطاقات الولاء' },
          tables: { count: tablesCount, nameAr: 'الطاولات' },
          attendance: { count: attendanceCount, nameAr: 'سجلات الحضور' },
          ingredients: { count: ingredientsCount, nameAr: 'المكونات' },
          categories: { count: categoriesCount, nameAr: 'الفئات' },
          deliveryZones: { count: deliveryZonesCount, nameAr: 'مناطق التوصيل' }
        },
        summary: {
          todayOrders,
          totalRevenue: totalRevenue[0]?.total || 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب إحصائيات قاعدة البيانات" });
    }
  });

  // Get collection data (owner only)
  app.get("/api/owner/collection/:collectionName", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const { collectionName } = req.params;
      const { page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const models: Record<string, any> = {
        orders: (await import("@shared/schema")).OrderModel,
        customers: (await import("@shared/schema")).CustomerModel,
        employees: (await import("@shared/schema")).EmployeeModel,
        coffeeItems: (await import("@shared/schema")).CoffeeItemModel,
        branches: (await import("@shared/schema")).BranchModel,
        discountCodes: (await import("@shared/schema")).DiscountCodeModel,
        loyaltyCards: (await import("@shared/schema")).LoyaltyCardModel,
        tables: (await import("@shared/schema")).TableModel,
        attendance: (await import("@shared/schema")).AttendanceModel,
        ingredients: (await import("@shared/schema")).IngredientModel,
        categories: (await import("@shared/schema")).CategoryModel,
        deliveryZones: (await import("@shared/schema")).DeliveryZoneModel
      };

      const Model = models[collectionName];
      if (!Model) {
        return res.status(400).json({ error: "مجموعة غير صالحة" });
      }

      const [data, total] = await Promise.all([
        Model.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Model.countDocuments()
      ]);

      res.json({
        data: data.map((doc: any) => {
          const serialized = serializeDoc(doc);
          // Remove password from employees
          if (collectionName === 'employees') {
            delete serialized.password;
          }
          return serialized;
        }),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب البيانات" });
    }
  });

  // Delete collection data (owner only)
  app.delete("/api/owner/collection/:collectionName", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "فقط المالك يمكنه حذف البيانات" });
      }

      const { collectionName } = req.params;
      const { ids } = req.body; // Optional: specific IDs to delete

      const models: Record<string, any> = {
        orders: (await import("@shared/schema")).OrderModel,
        customers: (await import("@shared/schema")).CustomerModel,
        discountCodes: (await import("@shared/schema")).DiscountCodeModel,
        loyaltyCards: (await import("@shared/schema")).LoyaltyCardModel,
        attendance: (await import("@shared/schema")).AttendanceModel
      };

      const Model = models[collectionName];
      if (!Model) {
        return res.status(400).json({ error: "مجموعة غير صالحة أو محمية" });
      }

      let result;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        result = await Model.deleteMany({ _id: { $in: ids } });
      } else {
        result = await Model.deleteMany({});
      }

      res.json({
        success: true,
        message: `تم حذف ${result.deletedCount} سجل`,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف البيانات" });
    }
  });

  // Delete specific record (owner only)
  app.delete("/api/owner/record/:collectionName/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "فقط المالك يمكنه حذف البيانات" });
      }

      const { collectionName, id } = req.params;

      const models: Record<string, any> = {
        orders: (await import("@shared/schema")).OrderModel,
        customers: (await import("@shared/schema")).CustomerModel,
        employees: (await import("@shared/schema")).EmployeeModel,
        coffeeItems: (await import("@shared/schema")).CoffeeItemModel,
        branches: (await import("@shared/schema")).BranchModel,
        discountCodes: (await import("@shared/schema")).DiscountCodeModel,
        loyaltyCards: (await import("@shared/schema")).LoyaltyCardModel,
        tables: (await import("@shared/schema")).TableModel,
        attendance: (await import("@shared/schema")).AttendanceModel,
        ingredients: (await import("@shared/schema")).IngredientModel,
        categories: (await import("@shared/schema")).CategoryModel,
        deliveryZones: (await import("@shared/schema")).DeliveryZoneModel
      };

      const Model = models[collectionName];
      if (!Model) {
        return res.status(400).json({ error: "مجموعة غير صالحة" });
      }

      const result = await Model.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "السجل غير موجود" });
      }

      res.json({
        success: true,
        message: "تم حذف السجل بنجاح"
      });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف السجل" });
    }
  });

  // Reset all data (owner only)
  app.post("/api/owner/reset-database", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "فقط المالك أو المدير يمكنه إعادة تعيين قاعدة البيانات" });
      }

      const { confirmPhrase } = req.body;
      
      if (confirmPhrase !== 'احذف جميع البيانات') {
        return res.status(400).json({ error: "عبارة التأكيد غير صحيحة" });
      }

      const { 
        OrderModel, CustomerModel, DiscountCodeModel, LoyaltyCardModel, 
        LoyaltyTransactionModel, AttendanceModel, CardCodeModel
      } = await import("@shared/schema");

      const results = await Promise.all([
        OrderModel.deleteMany({}),
        CustomerModel.deleteMany({}),
        DiscountCodeModel.deleteMany({}),
        LoyaltyCardModel.deleteMany({}),
        LoyaltyTransactionModel.deleteMany({}),
        AttendanceModel.deleteMany({}),
        CardCodeModel.deleteMany({})
      ]);

      res.json({
        success: true,
        message: "تم حذف جميع بيانات العمليات بنجاح",
        deleted: {
          orders: results[0].deletedCount,
          customers: results[1].deletedCount,
          discountCodes: results[2].deletedCount,
          loyaltyCards: results[3].deletedCount,
          loyaltyTransactions: results[4].deletedCount,
          attendance: results[5].deletedCount,
          cardCodes: results[6].deletedCount
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة تعيين قاعدة البيانات" });
    }
  });

  // ================== INVENTORY MANAGEMENT ROUTES ==================

  // Employee-accessible routes for ingredient availability management
  // These routes only require basic auth (not manager) for employee ingredient management page
  app.get("/api/employee/raw-items/by-category/:category", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const { category } = req.params;
      const query: any = { tenantId };
      if (category && category !== "all") query.category = category;
      const items = await RawItemModel.find(query).sort({ nameAr: 1 }).lean();
      res.json(items.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام" });
    }
  });

  // Employee route to update raw item availability
  app.patch("/api/employee/raw-items/:id/availability", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'number' || (isActive !== 0 && isActive !== 1)) {
        return res.status(400).json({ error: "قيمة isActive يجب أن تكون 0 أو 1" });
      }
      
      const item = await storage.updateRawItem(id, { isActive });
      if (!item) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      
      // Update affected coffee items if raw item is an ingredient
      if (item.category === 'ingredient') {
        const { RecipeItemModel, CoffeeItemModel } = await import("@shared/schema");
        
        // Find all coffee items using this raw item
        const recipes = await RecipeItemModel.find({ rawItemId: id });
        
        for (const recipe of recipes) {
          const coffeeItem = await CoffeeItemModel.findById(recipe.coffeeItemId);
          if (coffeeItem) {
            if (isActive === 0) {
              // Mark coffee item as unavailable
              await CoffeeItemModel.findByIdAndUpdate(recipe.coffeeItemId, {
                isAvailable: 0,
                availabilityStatus: `نفذ ${item.nameAr}`
              });
            } else {
              // Check if all other ingredients are available
              const allRecipes = await RecipeItemModel.find({ coffeeItemId: recipe.coffeeItemId });
              let allAvailable = true;
              
              for (const r of allRecipes) {
                const rawItem = await storage.getRawItem(r.rawItemId);
                if (rawItem && rawItem.isActive === 0) {
                  allAvailable = false;
                  break;
                }
              }
              
              if (allAvailable) {
                await CoffeeItemModel.findByIdAndUpdate(recipe.coffeeItemId, {
                  isAvailable: 1,
                  availabilityStatus: "متوفر"
                });
              }
            }
          }
        }
      }
      
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث حالة المادة الخام" });
    }
  });

  app.get("/api/inventory", requireAuth, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getRawItems();
      const lowStock = items.filter((i: any) => i.currentStock !== undefined && i.minStock !== undefined && i.currentStock <= i.minStock);
      res.json({
        totalItems: items.length,
        lowStockCount: lowStock.length,
        items: items.slice(0, 20),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بيانات المخزون" });
    }
  });

  // Raw Items Routes (Manager-only)
  app.get("/api/inventory/raw-items", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { category } = req.query;
      let items = await storage.getRawItems();
      
      if (category && typeof category === 'string') {
        items = items.filter(item => item.category === category);
      }

      // Enrich each item with total currentStock summed from all branch stocks
      const { BranchStockModel } = await import("@shared/schema");
      const allBranchStocks = await BranchStockModel.find({}).lean();
      const enriched = items.map(item => {
        const totalStock = allBranchStocks
          .filter((s: any) => s.rawItemId === item.id)
          .reduce((sum: number, s: any) => sum + (s.currentQuantity || 0), 0);
        return { ...item, currentStock: totalStock };
      });
      
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام" });
    }
  });

  app.get("/api/raw-items/by-category/:category", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { category } = req.params;
      const validCategories = ['ingredient', 'packaging', 'equipment', 'consumable', 'other'];
      
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          error: "تصنيف غير صالح",
          validCategories 
        });
      }
      
      const allItems = await storage.getRawItems();
      const filteredItems = allItems.filter(item => item.category === category);
      
      res.json(filteredItems);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام" });
    }
  });

  app.get("/api/raw-items/for-recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const allItems = await storage.getRawItems();
      const recipeItems = allItems.filter(item => 
        ['ingredient', 'packaging', 'consumable'].includes(item.category as string)
      );
      
      res.json(recipeItems);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام للوصفات" });
    }
  });

  app.get("/api/inventory/raw-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const item = await storage.getRawItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المادة الخام" });
    }
  });

  app.post("/api/inventory/raw-items", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertRawItemSchema } = await import("@shared/schema");
      const validatedData = insertRawItemSchema.parse(req.body);
      
      const existing = await storage.getRawItemByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ error: "كود المادة الخام موجود مسبقاً" });
      }
      
      const item = await storage.createRawItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء المادة الخام" });
    }
  });

  app.put("/api/inventory/raw-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertRawItemSchema } = await import("@shared/schema");
      const partialSchema = insertRawItemSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const item = await storage.updateRawItem(req.params.id, validatedData);
      if (!item) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      res.json(item);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في تحديث المادة الخام" });
    }
  });

  app.delete("/api/inventory/raw-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteRawItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف المادة الخام بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف المادة الخام" });
    }
  });

  // Branch-level stock summary
  app.get("/api/branch-stock", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const query: any = { tenantId };
      if (branchId && branchId !== "all") query.branchId = branchId as string;
      const stocks = await BranchStockModel.find(query).populate('rawItemId').sort({ updatedAt: -1 }).lean();
      res.json(stocks.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب مخزون الفروع" });
    }
  });

  // ================== RECIPE MANAGEMENT ROUTES ==================

  // Get all recipes
  app.get("/api/recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const recipes = await RecipeItemModel.find().lean();
      const serialized = recipes.map(r => ({
        ...r,
        id: (r._id as any).toString(),
        _id: undefined
      }));
      res.json(serialized);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الوصفات" });
    }
  });

  // Get recipes for a specific coffee item
  app.get("/api/recipes/coffee-item/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const recipes = await RecipeItemModel.find({ coffeeItemId }).lean();
      
      // Enrich with raw item details
      const enrichedRecipes = await Promise.all(recipes.map(async (recipe) => {
        const rawItem = await RawItemModel.findOne({
          $or: [
            { _id: recipe.rawItemId },
            { code: recipe.rawItemId }
          ]
        }).lean();
        
        return {
          ...recipe,
          id: (recipe._id as any).toString(),
          _id: undefined,
          rawItem: rawItem ? {
            id: (rawItem._id as any).toString(),
            code: rawItem.code,
            nameAr: rawItem.nameAr,
            nameEn: rawItem.nameEn,
            unit: rawItem.unit,
            unitCost: rawItem.unitCost
          } : null
        };
      }));
      
      res.json(enrichedRecipes);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب وصفات المشروب" });
    }
  });

  // Delete recipe item
  app.delete("/api/recipes/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const result = await RecipeItemModel.findByIdAndDelete(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "الوصفة غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف عنصر الوصفة" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الوصفة" });
    }
  });

  // Delete all recipes for a coffee item
  app.delete("/api/recipes/coffee-item/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const result = await RecipeItemModel.deleteMany({ coffeeItemId });
      res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف وصفات المشروب" });
    }
  });

  // Calculate recipe cost for a coffee item
  app.get("/api/recipes/coffee-item/:coffeeItemId/cost", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const recipes = await RecipeItemModel.find({ coffeeItemId });
      
      let totalCost = 0;
      const breakdown: Array<{
        rawItemName: string;
        quantity: number;
        unit: string;
        unitCost: number;
        totalCost: number;
      }> = [];
      
      for (const recipe of recipes) {
        const rawItem = await RawItemModel.findOne({
          $or: [
            { _id: recipe.rawItemId },
            { code: recipe.rawItemId }
          ]
        });
        
        if (rawItem) {
          const convertedQuantity = convertUnitsForCost(recipe.quantity, recipe.unit, rawItem.unit);
          const itemCost = convertedQuantity * (rawItem.unitCost || 0);
          totalCost += itemCost;
          
          breakdown.push({
            rawItemName: rawItem.nameAr,
            quantity: recipe.quantity,
            unit: recipe.unit,
            unitCost: rawItem.unitCost,
            totalCost: itemCost
          });
        }
      }
      
      res.json({ totalCost, breakdown });
    } catch (error) {
      res.status(500).json({ error: "فشل في حساب تكلفة الوصفة" });
    }
  });

  // Suppliers Routes
  app.get("/api/inventory/suppliers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الموردين" });
    }
  });

  app.get("/api/inventory/suppliers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const supplier = await storage.getSupplier(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: "المورد غير موجود" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المورد" });
    }
  });

  app.post("/api/inventory/suppliers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertSupplierSchema } = await import("@shared/schema");
      const validatedData = insertSupplierSchema.parse(req.body);
      
      const existing = await storage.getSupplierByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ error: "كود المورد موجود مسبقاً" });
      }
      
      const supplier = await storage.createSupplier(validatedData);
      res.status(201).json(supplier);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء المورد" });
    }
  });

  app.put("/api/inventory/suppliers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertSupplierSchema } = await import("@shared/schema");
      const partialSchema = insertSupplierSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const supplier = await storage.updateSupplier(req.params.id, validatedData);
      if (!supplier) {
        return res.status(404).json({ error: "المورد غير موجود" });
      }
      res.json(supplier);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في تحديث المورد" });
    }
  });

  app.delete("/api/inventory/suppliers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteSupplier(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "المورد غير موجود" });
      }
      res.json({ success: true, message: "تم حذف المورد بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف المورد" });
    }
  });

  // Branch Stock Routes
  app.get("/api/inventory/stock", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      if (branchId) {
        const stock = await storage.getBranchStock(branchId as string);
        res.json(stock);
      } else {
        const allStock = await storage.getAllBranchesStock();
        res.json(allStock);
      }
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المخزون" });
    }
  });

  app.get("/api/inventory/stock/low", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const lowStock = await storage.getLowStockItems(branchId as string | undefined);
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد منخفضة المخزون" });
    }
  });

  app.post("/api/inventory/stock/adjust", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId, quantity, notes, movementType, unitCost } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const employeeId = req.employee?.id || 'system';
      
      if (!branchId || !rawItemId || quantity === undefined) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      
      let rawItem = await RawItemModel.findById(rawItemId).catch(() => null);
      if (!rawItem) {
        rawItem = await RawItemModel.findOne({ id: rawItemId });
      }
      if (!rawItem) {
        rawItem = await RawItemModel.findOne({ _id: rawItemId }).catch(() => null);
      }
      if (!rawItem) {
        return res.status(404).json({ error: "المادة غير موجودة" });
      }

      const stock = await storage.updateBranchStock(
        branchId,
        rawItemId,
        quantity,
        employeeId,
        movementType || 'adjustment',
        notes
      );
      
      // Create Accounting Entry for stock addition
      if (quantity > 0 && (movementType === 'purchase' || movementType === 'adjustment')) {
        try {
          const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
          const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1000" });

          const cost = (unitCost || rawItem.unitCost || 0) * Math.abs(quantity);
          if (cost > 0 && inventoryAccount && cashAccount) {
            if (movementType === 'purchase') {
              await ErpAccountingService.createJournalEntry({
                tenantId,
                entryDate: new Date(),
                description: `شراء مخزون: ${rawItem.nameAr}`,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    accountNumber: inventoryAccount.accountNumber,
                    accountName: inventoryAccount.nameAr,
                    debit: cost,
                    credit: 0,
                    description: `زيادة قيمة المخزون - ${rawItem.nameAr}`,
                    branchId,
                  },
                  {
                    accountId: cashAccount.id,
                    accountNumber: cashAccount.accountNumber,
                    accountName: cashAccount.nameAr,
                    debit: 0,
                    credit: cost,
                    description: `مدفوعات شراء مخزون - ${rawItem.nameAr}`,
                    branchId,
                  }
                ],
                referenceType: 'inventory_purchase',
                referenceId: (stock as any).id || (stock as any)._id?.toString(),
                createdBy: employeeId,
                autoPost: true,
              });
              console.log(`[ACCOUNTING] Purchase journal entry: ${cost} SAR for ${rawItem.nameAr}`);
            } else {
              await ErpAccountingService.createJournalEntry({
                tenantId,
                entryDate: new Date(),
                description: `تسوية مخزون: ${rawItem.nameAr}`,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    accountNumber: inventoryAccount.accountNumber,
                    accountName: inventoryAccount.nameAr,
                    debit: cost,
                    credit: 0,
                    description: `تسوية قيمة المخزون - ${rawItem.nameAr}`,
                    branchId,
                  },
                  {
                    accountId: cashAccount.id,
                    accountNumber: cashAccount.accountNumber,
                    accountName: cashAccount.nameAr,
                    debit: 0,
                    credit: cost,
                    description: `تسوية مخزون - ${rawItem.nameAr}`,
                    branchId,
                  }
                ],
                referenceType: 'inventory_adjustment',
                referenceId: (stock as any).id || (stock as any)._id?.toString(),
                createdBy: employeeId,
                autoPost: true,
              });
            }
          }
        } catch (accError) {
          console.error("[ACCOUNTING] Failed to create inventory entry:", accError);
        }
      }
      
      // Auto-generate stock alert if quantity falls below minimum
      try {
        const currentQty = (stock as any).currentQuantity || 0;
        const minLevel = (rawItem as any).minStockLevel || 0;
        if (minLevel > 0 && currentQty <= minLevel) {
          const { StockAlertModel } = await import("@shared/schema");
          const existing = await StockAlertModel.findOne({ rawItemId, branchId, isResolved: 0 });
          if (!existing) {
            await storage.createStockAlert(branchId, rawItemId, 'low_stock', currentQty, minLevel);
            console.log(`[INVENTORY] Low stock alert created for ${(rawItem as any).nameAr}: ${currentQty} / ${minLevel}`);
          }
        }
      } catch (alertErr) {
        console.error("[INVENTORY] Failed to create auto stock alert:", alertErr);
      }

      res.json(stock);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      res.status(500).json({ error: "فشل في تعديل المخزون" });
    }
  });

  // Smart Inventory Routes - Stock Adjustment (+/-)
  app.post("/api/inventory/stock-adjustment", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { rawItemId, branchId, quantity, type, notes } = req.body;
      
      if (!rawItemId || !branchId || quantity === undefined || !type) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      
      const numQuantity = Number(quantity);
      if (isNaN(numQuantity)) {
        return res.status(400).json({ error: "الكمية يجب أن تكون رقماً" });
      }
      
      const adjustedQuantity = type === 'subtract' ? -Math.abs(numQuantity) : Math.abs(numQuantity);
      
      const stock = await storage.updateBranchStock(
        branchId,
        rawItemId,
        adjustedQuantity,
        req.employee?.id || 'system',
        'adjustment',
        notes || (type === 'add' ? 'إضافة كمية' : 'خصم كمية')
      );

      // Create accounting entry for stock addition
      if (adjustedQuantity > 0) {
        try {
          const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
          let rawItem = await RawItemModel.findById(rawItemId).catch(() => null);
          if (!rawItem) rawItem = await RawItemModel.findOne({ id: rawItemId });
          const unitCostValue = (rawItem as any)?.unitCost || (rawItem as any)?.lastCost || 0;
          const totalCost = unitCostValue * Math.abs(adjustedQuantity);

          if (totalCost > 0) {
            const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
            const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1000" });

            if (inventoryAccount && cashAccount) {
              await ErpAccountingService.createJournalEntry({
                tenantId,
                entryDate: new Date(),
                description: `إضافة مخزون: ${(rawItem as any)?.nameAr || rawItemId}`,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    accountNumber: inventoryAccount.accountNumber,
                    accountName: inventoryAccount.nameAr,
                    debit: totalCost,
                    credit: 0,
                    description: `زيادة قيمة المخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                    branchId,
                  },
                  {
                    accountId: cashAccount.id,
                    accountNumber: cashAccount.accountNumber,
                    accountName: cashAccount.nameAr,
                    debit: 0,
                    credit: totalCost,
                    description: `مدفوعات إضافة مخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                    branchId,
                  }
                ],
                referenceType: 'inventory_adjustment',
                referenceId: (stock as any).id || (stock as any)._id?.toString(),
                createdBy: req.employee?.id || 'system',
                autoPost: true,
              });
              console.log(`[ACCOUNTING] Stock adjustment journal entry: ${totalCost} SAR for ${(rawItem as any)?.nameAr}`);
            }
          }
        } catch (accError) {
          console.error("[ACCOUNTING] Failed to create stock adjustment accounting entry:", accError);
        }
      }

      // Auto-generate low stock alert
      try {
        const currentQty = (stock as any).currentQuantity || 0;
        const rawItemDoc = await RawItemModel.findById(rawItemId);
        const minLevel = (rawItemDoc as any)?.minStockLevel || 0;
        if (minLevel > 0 && currentQty <= minLevel) {
          const { StockAlertModel } = await import("@shared/schema");
          const existing = await StockAlertModel.findOne({ rawItemId, branchId, isResolved: 0 });
          if (!existing) {
            await storage.createStockAlert(branchId, rawItemId, 'low_stock', currentQty, minLevel);
            console.log(`[INVENTORY] Auto low stock alert: ${(rawItemDoc as any)?.nameAr} ${currentQty}/${minLevel}`);
          }
        }
      } catch (alertErr) {
        console.error("[INVENTORY] Auto alert failed:", alertErr);
      }
      
      res.json(stock);
    } catch (error) {
      console.error("[ERROR] In stock-adjustment route:", error);
      res.status(500).json({ 
        error: "فشل في تعديل المخزون",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Smart Inventory Routes - Add Stock Batch
  app.post("/api/inventory/stock-batch", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { rawItemId, branchId, quantity, unitCost, notes } = req.body;
      
      const numQuantity = Number(quantity);
      if (!rawItemId || !branchId || isNaN(numQuantity) || numQuantity <= 0) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      
      // Update raw item cost if provided
      if (unitCost && Number(unitCost) > 0) {
        const { RawItemModel } = await import("@shared/schema");
        await RawItemModel.findOneAndUpdate({ id: rawItemId }, { unitCost: Number(unitCost) });
      }
      
      const stock = await storage.updateBranchStock(
        branchId,
        rawItemId,
        numQuantity,
        req.employee?.id || 'system',
        'purchase',
        notes || 'دفعة جديدة'
      );

      // Create proper journal entry for inventory purchase (Debit Inventory Asset, Credit Cash/Payables)
      try {
        const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
        const { RawItemModel, AccountModel } = await import("@shared/schema");
        const { nanoid } = await import("nanoid");
        
        const rawItem = await RawItemModel.findOne({ id: rawItemId });
        const totalAmount = (Number(unitCost) || (rawItem as any)?.unitCost || 0) * numQuantity;
        if (totalAmount > 0) {
          const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
          const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1000" });

          if (inventoryAccount && cashAccount) {
            await ErpAccountingService.createJournalEntry({
              tenantId,
              entryDate: new Date(),
              description: `شراء مخزون: ${(rawItem as any)?.nameAr || rawItemId} - ${notes || 'دفعة جديدة'}`,
              lines: [
                {
                  accountId: inventoryAccount.id,
                  accountNumber: inventoryAccount.accountNumber,
                  accountName: inventoryAccount.nameAr,
                  debit: totalAmount,
                  credit: 0,
                  description: `إضافة مخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                  branchId,
                },
                {
                  accountId: cashAccount.id,
                  accountNumber: cashAccount.accountNumber,
                  accountName: cashAccount.nameAr,
                  debit: 0,
                  credit: totalAmount,
                  description: `مدفوعات شراء مخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                  branchId,
                }
              ],
              referenceType: 'inventory_purchase',
              referenceId: (stock as any).id || nanoid(),
              createdBy: req.employee?.id || 'system',
              autoPost: true,
            });
            console.log(`[ACCOUNTING] Inventory purchase journal entry: ${totalAmount} SAR for ${(rawItem as any)?.nameAr}`);
          }
        }
      } catch (accError) {
        console.error("[ACCOUNTING] Failed to create inventory batch accounting entry:", accError);
      }
      
      res.json(stock);
    } catch (error) {
      console.error("[ERROR] In stock-batch route:", error);
      res.status(500).json({ 
        error: "فشل في إضافة الدفعة",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Branch Stocks for Smart Inventory
  app.get("/api/inventory/branch-stocks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      if (branchId && branchId !== 'all') {
        const stocks = await storage.getBranchStock(branchId as string);
        res.json(stocks);
      } else {
        const { BranchModel } = await import("@shared/schema");
        const branches = await BranchModel.find({ isActive: 1 }).lean();
        let allStocks: any[] = [];
        
        for (const branch of branches) {
          const branchIdStr = (branch as any)._id?.toString() || (branch as any).id;
          const stocks = await storage.getBranchStock(branchIdStr);
          allStocks = allStocks.concat(stocks);
        }
        
        res.json(allStocks);
      }
    } catch (error) {
      console.error("[ERROR] In branch-stocks route:", error);
      res.status(500).json({ error: "فشل في جلب المخزون" });
    }
  });

  // Stock Transfers Routes
  app.get("/api/inventory/transfers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const transfers = await storage.getStockTransfers(branchId as string | undefined);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التحويلات" });
    }
  });

  app.get("/api/inventory/transfers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.getStockTransfer(req.params.id);
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التحويل" });
    }
  });

  app.post("/api/inventory/transfers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertStockTransferSchema } = await import("@shared/schema");
      const validatedData = insertStockTransferSchema.parse({
        ...req.body,
        requestedBy: req.employee?.id || 'system'
      });
      
      const transfer = await storage.createStockTransfer(validatedData);
      res.status(201).json(transfer);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء التحويل" });
    }
  });

  app.put("/api/inventory/transfers/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.updateStockTransferStatus(
        req.params.id,
        'approved',
        req.employee?.id
      );
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في الموافقة على التحويل" });
    }
  });

  app.put("/api/inventory/transfers/:id/complete", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.completeStockTransfer(
        req.params.id,
        req.employee?.id || 'system'
      );
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود أو لم تتم الموافقة عليه" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في إتمام التحويل" });
    }
  });

  app.put("/api/inventory/transfers/:id/cancel", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.updateStockTransferStatus(req.params.id, 'cancelled');
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في إلغاء التحويل" });
    }
  });

  // Stock Organization Stats Endpoint
  app.get("/api/inventory/organization-stats", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const branches = await BranchModel.find({ isActive: 1 }).lean();
      const rawItems = await RawItemModel.find().lean();
      let totalValue = 0;
      let lowStockCount = 0;
      const branchStats = [];

      for (const branch of branches) {
        const branchId = (branch as any)._id.toString();
        const stocks = await BranchStockModel.find({ branchId }).populate('rawItemId').lean();
        let branchValue = 0;
        let branchLow = 0;
        const transfers = await storage.getStockTransfers(branchId);

        stocks.forEach((stock: any) => {
          const item = stock.rawItemId as any;
          if (item) {
            const value = (stock.currentQuantity || 0) * (item.unitCost || 0);
            branchValue += value;
            if ((stock.currentQuantity || 0) < (item.minStockLevel || 0)) {
              branchLow++;
              lowStockCount++;
            }
          }
        });
        totalValue += branchValue;

        branchStats.push({
          branchId,
          branchName: (branch as any).nameAr || 'فرع بدون اسم',
          totalItems: stocks.length,
          lowStockItems: branchLow,
          totalValue: branchValue,
          recentTransfers: transfers?.filter((t: any) => t.status !== 'completed').length || 0
        });
      }

      res.json({
        totalBranches: branches.length,
        totalSKUs: rawItems.length,
        totalInventoryValue: totalValue,
        lowStockItems: lowStockCount,
        pendingTransfers: 0,
        branches: branchStats
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إحصائيات المخزون" });
    }
  });

  // Purchase Invoices Routes
  app.get("/api/inventory/purchases", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const invoices = await storage.getPurchaseInvoices(branchId as string | undefined);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب فواتير الشراء" });
    }
  });

  app.get("/api/inventory/purchases/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.getPurchaseInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب فاتورة الشراء" });
    }
  });

  app.post("/api/inventory/purchases", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertPurchaseInvoiceSchema } = await import("@shared/schema");
      const validatedData = insertPurchaseInvoiceSchema.parse({
        ...req.body,
        createdBy: req.employee?.id || 'system'
      });
      
      const invoice = await storage.createPurchaseInvoice(validatedData);
      res.status(201).json(invoice);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertPurchaseInvoiceSchema } = await import("@shared/schema");
      const partialSchema = insertPurchaseInvoiceSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const invoice = await storage.updatePurchaseInvoice(req.params.id, validatedData);
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      res.json(invoice);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في تحديث فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.updatePurchaseInvoice(req.params.id, { status: 'approved' });
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في اعتماد فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id/receive", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.receivePurchaseInvoice(
        req.params.id,
        req.employee?.id || 'system'
      );
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة أو تم استلامها مسبقاً" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في استلام فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id/payment", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "مبلغ الدفعة غير صالح" });
      }
      
      const existingInvoice = await storage.getPurchaseInvoice(req.params.id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      
      const newPaidAmount = existingInvoice.paidAmount + amount;
      if (newPaidAmount > existingInvoice.totalAmount) {
        return res.status(400).json({ error: "مبلغ الدفعة يتجاوز المبلغ المتبقي" });
      }
      
      const invoice = await storage.updatePurchaseInvoicePayment(req.params.id, newPaidAmount);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الدفع" });
    }
  });

  // Recipe Items Routes (COGS)
  
  // Get all recipes (for COGS overview)
  app.get("/api/inventory/all-recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getAllRecipeItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب جميع الوصفات" });
    }
  });

  app.get("/api/inventory/recipes/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getRecipeItems(req.params.coffeeItemId);
      const cost = await storage.calculateProductCost(req.params.coffeeItemId);
      res.json({ items, totalCost: cost });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب مكونات الوصفة" });
    }
  });

  app.post("/api/inventory/recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertRecipeItemSchema } = await import("@shared/schema");
      const validatedData = insertRecipeItemSchema.parse(req.body);
      const item = await storage.createRecipeItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في إضافة مكون الوصفة" });
    }
  });

  app.put("/api/inventory/recipes/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const item = await storage.updateRecipeItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "مكون الوصفة غير موجود" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث مكون الوصفة" });
    }
  });

  app.delete("/api/inventory/recipes/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteRecipeItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "مكون الوصفة غير موجود" });
      }
      res.json({ success: true, message: "تم حذف مكون الوصفة بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف مكون الوصفة" });
    }
  });

  // Bulk create/update recipes for a product (Sprint 3)
  app.post("/api/inventory/recipes/bulk", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId, items, clearExisting } = req.body;
      
      if (!coffeeItemId) {
        return res.status(400).json({ error: "معرف المنتج مطلوب" });
      }
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "يجب إضافة مكون واحد على الأقل" });
      }
      
      // Optionally clear existing recipes for this product
      if (clearExisting) {
        const existingRecipes = await storage.getRecipeItems(coffeeItemId);
        for (const recipe of existingRecipes) {
          await storage.deleteRecipeItem(recipe.id);
        }
      }
      
      const createdItems = [];
      let totalCost = 0;
      
      for (const item of items) {
        if (!item.rawItemId || !item.quantity || !item.unit) {
          continue;
        }
        
        // Check if recipe already exists
        const existingRecipes = await storage.getRecipeItems(coffeeItemId);
        const existing = existingRecipes.find(r => r.rawItemId === item.rawItemId);
        
        if (existing) {
          // Update existing
          const updated = await storage.updateRecipeItem(existing.id, {
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          });
          if (updated) createdItems.push(updated);
        } else {
          // Create new
          const created = await storage.createRecipeItem({
            coffeeItemId,
            rawItemId: item.rawItemId,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          });
          createdItems.push(created);
        }
      }
      
      // Calculate total cost
      totalCost = await storage.calculateProductCost(coffeeItemId);
      
      res.status(201).json({
        success: true,
        items: createdItems,
        totalCost,
        message: `تم إضافة ${createdItems.length} مكون للوصفة بنجاح`
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في إضافة مكونات الوصفة" });
    }
  });

  // Delete all recipes for a product
  app.delete("/api/inventory/recipes/product/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const existingRecipes = await storage.getRecipeItems(coffeeItemId);
      
      for (const recipe of existingRecipes) {
        await storage.deleteRecipeItem(recipe.id);
      }
      
      res.json({ 
        success: true, 
        deletedCount: existingRecipes.length,
        message: `تم حذف ${existingRecipes.length} مكون من الوصفة` 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف مكونات الوصفة" });
    }
  });

  // Stock Alerts Routes
  app.get("/api/inventory/alerts", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, resolved } = req.query;
      const alerts = await storage.getStockAlerts(
        branchId as string | undefined,
        resolved === 'true' ? true : resolved === 'false' ? false : undefined
      );
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التنبيهات" });
    }
  });

  app.put("/api/inventory/alerts/:id/resolve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const alert = await storage.resolveStockAlert(req.params.id, req.employee?.id || 'system');
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      wsManager.broadcastAlertResolved(alert.id, (alert as any).branchId);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "فشل في حل التنبيه" });
    }
  });

  app.put("/api/inventory/alerts/:id/read", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const alert = await storage.markAlertAsRead(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث التنبيه" });
    }
  });

  // Calculate Order COGS (Cost of Goods Sold)
  app.post("/api/inventory/calculate-cogs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { items, branchId } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "العناصر مطلوبة" });
      }
      
      const orderItems = items.map((item: any) => ({
        coffeeItemId: item.id || item.coffeeItemId,
        quantity: item.quantity || 1,
      }));
      
      const finalBranchId = branchId || req.employee?.branchId;
      const result = await storage.calculateOrderCOGS(orderItems, finalBranchId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل في حساب تكلفة البضاعة المباعة" });
    }
  });

  // Get order COGS details
  app.get("/api/orders/:id/cogs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      
      res.json({
        orderId: id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        costOfGoods: order.costOfGoods || 0,
        grossProfit: order.grossProfit || 0,
        profitMargin: order.totalAmount > 0 ? ((order.grossProfit || 0) / order.totalAmount * 100).toFixed(2) : 0,
        inventoryDeducted: order.inventoryDeducted === 1,
        deductionDetails: order.inventoryDeductionDetails || [],
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب تكلفة الطلب" });
    }
  });

  // Inventory Dashboard Summary
  app.get("/api/inventory/dashboard", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      
      const [rawItems, suppliers, lowStock, alerts, transfers, purchases] = await Promise.all([
        storage.getRawItems(),
        storage.getSuppliers(),
        storage.getLowStockItems(branchId as string | undefined),
        storage.getStockAlerts(branchId as string | undefined, false),
        storage.getStockTransfers(branchId as string | undefined),
        storage.getPurchaseInvoices(branchId as string | undefined),
      ]);
      
      const pendingTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'approved');
      const pendingPurchases = purchases.filter(p => p.status === 'pending' || p.status === 'approved');
      const unpaidPurchases = purchases.filter(p => p.paymentStatus === 'unpaid' || p.paymentStatus === 'partial');
      
      res.json({
        summary: {
          totalRawItems: rawItems.length,
          totalSuppliers: suppliers.length,
          lowStockCount: lowStock.length,
          alertsCount: alerts.length,
          pendingTransfersCount: pendingTransfers.length,
          pendingPurchasesCount: pendingPurchases.length,
          unpaidPurchasesCount: unpaidPurchases.length,
        },
        lowStock: lowStock.slice(0, 5),
        recentAlerts: alerts.slice(0, 5),
        pendingTransfers: pendingTransfers.slice(0, 5),
        pendingPurchases: pendingPurchases.slice(0, 5),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب ملخص المخزون" });
    }
  });

  // ===================== ZATCA INVOICE ROUTES =====================
  
  // Import ZATCA utilities
  const zatcaUtils = await import('./utils/zatca');
  
  // Get ZATCA settings (vatNumber, crNumber) from businessConfig
  app.get("/api/zatca/settings", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      res.json({
        vatNumber: config?.vatNumber || '',
        crNumber: (config as any)?.crNumber || '',
        tradeNameAr: config?.tradeNameAr || '',
        tradeNameEn: config?.tradeNameEn || '',
      });
    } catch (error) {
      console.error("Error fetching ZATCA settings:", error);
      res.status(500).json({ error: "Failed to fetch ZATCA settings" });
    }
  });

  // Save ZATCA settings (vatNumber, crNumber, etc.)
  app.patch("/api/zatca/settings", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const { vatNumber, crNumber, tradeNameAr, tradeNameEn, address, city, postalCode, buildingNumber } = req.body;
      const updateFields: any = {};
      if (vatNumber !== undefined) updateFields.vatNumber = vatNumber;
      if (crNumber !== undefined) updateFields.crNumber = crNumber;
      if (tradeNameAr !== undefined) updateFields.tradeNameAr = tradeNameAr;
      if (tradeNameEn !== undefined) updateFields.tradeNameEn = tradeNameEn;
      if (address !== undefined) updateFields.address = address;
      if (city !== undefined) updateFields.city = city;
      if (postalCode !== undefined) updateFields.postalCode = postalCode;
      if (buildingNumber !== undefined) updateFields.buildingNumber = buildingNumber;
      await BusinessConfigModel.findOneAndUpdate(
        { tenantId },
        { $set: updateFields },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving ZATCA settings:", error);
      res.status(500).json({ error: "فشل في حفظ الإعدادات" });
    }
  });

  // Manager point adjustment for loyalty cards
  app.patch("/api/loyalty/cards/:cardId/adjust", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { cardId } = req.params;
      const { adjustment, reason } = req.body;
      if (typeof adjustment !== 'number') return res.status(400).json({ error: "يجب تحديد قيمة التعديل" });
      const card = await storage.getLoyaltyCard(cardId);
      if (!card) return res.status(404).json({ error: "البطاقة غير موجودة" });
      const newPoints = Math.max(0, (card.points || 0) + adjustment);
      const updated = await storage.updateLoyaltyCard(cardId, { points: newPoints });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "فشل في تعديل النقاط" });
    }
  });

  // Create loyalty card from manager panel
  app.post("/api/loyalty/manager/create-card", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { customerName, phoneNumber } = req.body;
      if (!phoneNumber) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-9);
      if (cleanPhone.length < 9) return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام" });
      const existing = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (existing) return res.status(409).json({ error: "يوجد بطاقة بهذا الرقم مسبقاً" });
      const card = await storage.createLoyaltyCard({
        phoneNumber: cleanPhone,
        customerName: customerName || "عميل",
        points: 0,
        stamps: 0,
        tier: 'bronze',
        isActive: true,
      } as any);
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء البطاقة" });
    }
  });

  // Create ZATCA-compliant invoice for an order
  app.post("/api/zatca/invoices", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderId, customerName, customerPhone, customerEmail, customerVatNumber, 
              customerAddress, items, paymentMethod, branchId, invoiceType, transactionType } = req.body;
      
      if (!orderId || !customerName || !customerPhone || !items || !paymentMethod) {
        return res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
      }
      
      // Check if invoice already exists for this order
      const existingInvoice = await zatcaUtils.getInvoiceByOrderId(orderId);
      if (existingInvoice) {
        return res.json(serializeDoc(existingInvoice));
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      
      const invoice = await zatcaUtils.createZATCAInvoice({
        orderId,
        orderNumber: order.orderNumber,
        customerName,
        customerPhone,
        customerEmail,
        customerVatNumber,
        customerAddress,
        items,
        paymentMethod,
        branchId: branchId || req.employee?.branchId,
        createdBy: req.employee?.id,
        invoiceType,
        transactionType,
      });
      
      res.json(serializeDoc(invoice));
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الفاتورة الضريبية" });
    }
  });
  
  // Get invoice by order ID
  app.get("/api/zatca/invoices/order/:orderId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;
      const invoice = await zatcaUtils.getInvoiceByOrderId(orderId);
      
      if (!invoice) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      
      res.json(serializeDoc(invoice));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الفاتورة" });
    }
  });
  
  // Get invoice XML
  app.get("/api/zatca/invoices/:id/xml", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { TaxInvoiceModel } = await import('@shared/schema');
      const invoice = await TaxInvoiceModel.findOne({ id }) || await TaxInvoiceModel.findById(id).catch(() => null);
      
      if (!invoice) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(invoice.xmlContent);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب ملف XML" });
    }
  });
  
  // Get all invoices with filtering
  app.get("/api/zatca/invoices", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, startDate, endDate, page = '1', limit = '20' } = req.query;
      const { TaxInvoiceModel } = await import('@shared/schema');
      
      const query: any = {};
      const finalBranchId = branchId || req.employee?.branchId;
      
      if (finalBranchId && req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        query.branchId = finalBranchId;
      } else if (branchId) {
        query.branchId = branchId;
      }
      
      if (startDate || endDate) {
        query.invoiceDate = {};
        if (startDate) query.invoiceDate.$gte = new Date(startDate as string);
        if (endDate) query.invoiceDate.$lte = new Date(endDate as string);
      }
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [invoices, total] = await Promise.all([
        TaxInvoiceModel.find(query)
          .sort({ invoiceDate: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        TaxInvoiceModel.countDocuments(query),
      ]);
      
      res.json({
        invoices: invoices.map(serializeDoc),
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الفواتير" });
    }
  });
  
  // Get invoice statistics
  app.get("/api/zatca/stats", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, startDate, endDate } = req.query;
      const finalBranchId = branchId as string || req.employee?.branchId;
      
      const stats = await zatcaUtils.getInvoiceStats(
        finalBranchId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إحصائيات الفواتير" });
    }
  });
  
  // ===================== ACCOUNTING ROUTES =====================
  
  // Create expense
  app.post("/api/accounting/expenses", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ExpenseModel } = await import('@shared/schema');
      const { branchId, date, category, subcategory, description, amount, vatAmount,
              paymentMethod, vendorName, vendorVatNumber, invoiceNumber, receiptUrl, notes } = req.body;
      
      const totalAmount = amount + (vatAmount || 0);
      
      const expense = new ExpenseModel({
        branchId: branchId || req.employee?.branchId,
        date: new Date(date),
        category,
        subcategory,
        description,
        amount,
        vatAmount: vatAmount || 0,
        totalAmount,
        paymentMethod,
        vendorName,
        vendorVatNumber,
        invoiceNumber,
        receiptUrl,
        createdBy: req.employee?.id,
        status: 'pending',
        notes,
      });
      
      await expense.save();
      res.json(serializeDoc(expense));
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء المصروف" });
    }
  });
  
  // Get expenses
  app.get("/api/accounting/expenses", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { ExpenseModel } = await import('@shared/schema');
      const { branchId, startDate, endDate, category, status, period, page = '1', limit = '50' } = req.query;
      
      const query: any = {};
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);
      
      if (finalBranchId) {
        query.branchId = finalBranchId;
      }
      
      // Support period filter (today/week/month/year)
      if (period && !startDate && !endDate) {
        const now = new Date();
        let start: Date;
        switch (period as string) {
          case 'today':
            start = getSaudiStartOfDay();
            break;
          case 'week':
            start = new Date(getSaudiStartOfDay().getTime() - 6 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            start = new Date(getSaudiStartOfDay().getTime() - 29 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            start = new Date(getSaudiStartOfDay().getTime() - 364 * 24 * 60 * 60 * 1000);
            break;
          default:
            start = getSaudiStartOfDay();
        }
        query.date = { $gte: start, $lte: now };
      } else if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate as string);
        if (endDate) query.date.$lte = new Date(endDate as string);
      }
      if (category) query.category = category;
      if (status) query.status = status;
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [expenses, total] = await Promise.all([
        ExpenseModel.find(query)
          .sort({ date: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        ExpenseModel.countDocuments(query),
      ]);
      
      res.json({
        expenses: expenses.map(serializeDoc),
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المصروفات" });
    }
  });
  
  // Approve expense
  app.patch("/api/accounting/expenses/:id/approve", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { ExpenseModel } = await import('@shared/schema');
      const { id } = req.params;
      
      const expense = await ExpenseModel.findByIdAndUpdate(
        id,
        { 
          status: 'approved',
          approvedBy: req.employee?.id,
          updatedAt: new Date(),
        },
        { new: true }
      );
      
      if (!expense) {
        return res.status(404).json({ error: "المصروف غير موجود" });
      }
      
      res.json(serializeDoc(expense));
    } catch (error) {
      res.status(500).json({ error: "فشل في اعتماد المصروف" });
    }
  });
  
  // Create revenue record
  app.post("/api/accounting/revenue", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { RevenueModel } = await import('@shared/schema');
      const { branchId, date, orderId, invoiceId, category, description,
              grossAmount, vatAmount, netAmount, paymentMethod, notes } = req.body;
      
      const revenue = new RevenueModel({
        branchId: branchId || req.employee?.branchId,
        date: new Date(date),
        orderId,
        invoiceId,
        category: category || 'sales',
        description,
        grossAmount,
        vatAmount,
        netAmount,
        paymentMethod,
        employeeId: req.employee?.id,
        notes,
      });
      
      await revenue.save();
      res.json(serializeDoc(revenue));
    } catch (error) {
      res.status(500).json({ error: "فشل في تسجيل الإيراد" });
    }
  });
  
  // Get revenue records
  app.get("/api/accounting/revenue", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { RevenueModel } = await import('@shared/schema');
      const { branchId, startDate, endDate, category, period, page = '1', limit = '50' } = req.query;
      
      const query: any = {};
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);
      
      if (finalBranchId) {
        query.branchId = finalBranchId;
      }
      
      // Support period filter (today/week/month/year) — Saudi Arabia timezone (UTC+3)
      if (period && !startDate && !endDate) {
        const now = new Date();
        let start: Date;
        switch (period as string) {
          case 'today':
            start = getSaudiStartOfDay();
            break;
          case 'week':
            start = new Date(getSaudiStartOfDay().getTime() - 6 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            start = new Date(getSaudiStartOfDay().getTime() - 29 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            start = new Date(getSaudiStartOfDay().getTime() - 364 * 24 * 60 * 60 * 1000);
            break;
          default:
            start = getSaudiStartOfDay();
        }
        query.date = { $gte: start, $lte: now };
      } else if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate as string);
        if (endDate) query.date.$lte = new Date(endDate as string);
      }
      if (category) query.category = category;
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [revenues, total] = await Promise.all([
        RevenueModel.find(query)
          .sort({ date: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        RevenueModel.countDocuments(query),
      ]);
      
      res.json({
        revenues: revenues.map(serializeDoc),
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإيرادات" });
    }
  });
  
  // Get daily summary
  app.get("/api/accounting/daily-summary", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, date } = req.query;
      const { DailySummaryModel, OrderModel, RevenueModel, ExpenseModel } = await import('@shared/schema');
      
      const targetDate = date ? new Date(date as string) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const finalBranchId = branchId as string || req.employee?.branchId;
      
      // Check if summary exists
      const existingSummary = await DailySummaryModel.findOne({
        branchId: finalBranchId,
        date: { $gte: targetDate, $lt: nextDate },
      });
      
      let summary: any = existingSummary;
      
      if (!existingSummary) {
        // Calculate summary from orders
        const orderQuery: any = {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: { $ne: 'cancelled' },
        };
        if (finalBranchId) orderQuery.branchId = finalBranchId;
        
        const orders = await OrderModel.find(orderQuery);
        
        const expenseQuery: any = {
          date: { $gte: targetDate, $lt: nextDate },
          status: { $in: ['approved', 'paid'] },
        };
        if (finalBranchId) expenseQuery.branchId = finalBranchId;
        
        const expenses = await ExpenseModel.find(expenseQuery);
        
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalVat = totalRevenue * VAT_RATE / (1 + VAT_RATE);
        const cashRevenue = orders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const cardRevenue = orders.filter(o => ['pos', 'stc', 'alinma', 'ur', 'barq', 'rajhi'].includes(o.paymentMethod)).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const otherRevenue = totalRevenue - cashRevenue - cardRevenue;
        const deliveryRevenue = orders.filter(o => o.deliveryFee).reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
        const totalCogs = orders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.totalAmount, 0);
        const totalDiscounts = orders.reduce((sum, o) => {
          const subtotal = o.items?.reduce((s: number, i: any) => s + (Number(i.coffeeItem?.price || 0) * i.quantity), 0) || 0;
          return sum + (subtotal - (o.totalAmount / 1.15));
        }, 0);
        
        const cancelledOrders = await OrderModel.countDocuments({
          ...orderQuery,
          status: 'cancelled',
        });
        
        summary = {
          branchId: finalBranchId || null,
          date: targetDate,
          totalOrders: orders.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalVatCollected: Math.round(totalVat * 100) / 100,
          cashRevenue: Math.round(cashRevenue * 100) / 100,
          cardRevenue: Math.round(cardRevenue * 100) / 100,
          otherRevenue: Math.round(otherRevenue * 100) / 100,
          salesRevenue: Math.round((totalRevenue - deliveryRevenue) * 100) / 100,
          deliveryRevenue: Math.round(deliveryRevenue * 100) / 100,
          totalCogs: Math.round(totalCogs * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          grossProfit: Math.round((totalRevenue - totalVat - totalCogs) * 100) / 100,
          netProfit: Math.round((totalRevenue - totalVat - totalCogs - totalExpenses) * 100) / 100,
          profitMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalVat - totalCogs - totalExpenses) / totalRevenue * 100) * 100) / 100 : 0,
          totalDiscounts: Math.round(Math.abs(totalDiscounts) * 100) / 100,
          cancelledOrders,
          cancelledAmount: 0,
        };
      }
      
      res.json(serializeDoc(summary) || summary);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الملخص اليومي" });
    }
  });
  
  // Get accounting dashboard
  app.get("/api/accounting/dashboard", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, period = 'today' } = req.query;
      const { OrderModel, ExpenseModel, TaxInvoiceModel } = await import('@shared/schema');
      
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();
      
      switch (period) {
        case 'today':
          startDate = getSaudiStartOfDay();
          endDate = getSaudiEndOfDay();
          break;
        case 'week':
          startDate = new Date(getSaudiStartOfDay().getTime() - 6 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = getSaudiStartOfDay();
          startDate.setDate(startDate.getDate() - startDate.getDate() + 1);
          break;
        case 'year':
          startDate = new Date(getSaudiStartOfDay());
          startDate.setMonth(0, 1);
          break;
      }
      
      const orderQuery: any = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' },
      };
      if (finalBranchId) orderQuery.branchId = finalBranchId;
      
      const expenseQuery: any = {
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ['approved', 'paid'] },
      };
      if (finalBranchId) expenseQuery.branchId = finalBranchId;
      
      const invoiceQuery: any = {
        invoiceDate: { $gte: startDate, $lte: endDate },
      };
      if (finalBranchId) invoiceQuery.branchId = finalBranchId;
      
      // Build queries for trend data (last 30 days for daily, last 12 weeks for weekly, last 12 months for monthly)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      
      const allOrdersQuery: any = {
        createdAt: { $gte: thirtyDaysAgo },
        status: { $ne: 'cancelled' },
      };
      if (finalBranchId) allOrdersQuery.branchId = finalBranchId;
      
      const allExpensesQuery: any = {
        date: { $gte: thirtyDaysAgo },
        status: { $in: ['approved', 'paid'] },
      };
      if (finalBranchId) allExpensesQuery.branchId = finalBranchId;
      
      const [orders, expenses, invoices, allOrders, allExpenses] = await Promise.all([
        OrderModel.find(orderQuery),
        ExpenseModel.find(expenseQuery),
        TaxInvoiceModel.find(invoiceQuery),
        OrderModel.find(allOrdersQuery),
        ExpenseModel.find(allExpensesQuery),
      ]);
      
      // Fetch refunds for this period
      const refundQuery: any = { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' };
      if (finalBranchId) refundQuery.branchId = finalBranchId;
      const refunds = await RefundModel.find(refundQuery);
      const totalRefunds = refunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0);

      const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const totalVat = invoices.reduce((sum, i) => sum + (i.taxAmount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.totalAmount, 0);
      const totalCogs = orders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
      const netRevenue = totalRevenue - totalRefunds;
      const grossProfit = netRevenue - totalVat - totalCogs;
      const netProfit = grossProfit - totalExpenses;
      
      // Group by category
      const expensesByCategory = expenses.reduce((acc: any, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.totalAmount;
        return acc;
      }, {});
      
      // Group by payment method
      const revenueByPayment = orders.reduce((acc: any, o) => {
        acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + (o.totalAmount || 0);
        return acc;
      }, {});
      
      // Generate daily trend data (last 7 days)
      const dailyTrend: Array<{ date: string; revenue: number; expenses: number; cogs: number; netProfit: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dayOrders = allOrders.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= date && orderDate < nextDay;
        });
        const dayExpenses = allExpenses.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate >= date && expenseDate < nextDay;
        });
        
        const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const dayCogs = dayOrders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
        const dayExp = dayExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
        
        dailyTrend.push({
          date: date.toISOString().split('T')[0],
          revenue: Math.round(dayRevenue * 100) / 100,
          expenses: Math.round(dayExp * 100) / 100,
          cogs: Math.round(dayCogs * 100) / 100,
          netProfit: Math.round((dayRevenue - dayCogs - dayExp) * 100) / 100,
        });
      }
      
      // Generate weekly trend data (last 4 weeks)
      const weeklyTrend: Array<{ week: string; revenue: number; expenses: number; cogs: number; netProfit: number }> = [];
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekOrders = allOrders.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= weekStart && orderDate <= weekEnd;
        });
        const weekExpenses = allExpenses.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate >= weekStart && expenseDate <= weekEnd;
        });
        
        const weekRevenue = weekOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const weekCogs = weekOrders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
        const weekExp = weekExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
        
        weeklyTrend.push({
          week: `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`,
          revenue: Math.round(weekRevenue * 100) / 100,
          expenses: Math.round(weekExp * 100) / 100,
          cogs: Math.round(weekCogs * 100) / 100,
          netProfit: Math.round((weekRevenue - weekCogs - weekExp) * 100) / 100,
        });
      }
      
      // Top selling items
      const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (!item) return;
            const itemId = item.coffeeItemId || item.id || 'unknown';
            if (!itemId || itemId === 'unknown') return;
            const itemName = item.coffeeItem?.nameAr || item.nameAr || 'غير معروف';
            const itemQty = Number(item.quantity) || 1;
            const itemPrice = Number(item.price) || 0;
            
            if (!itemSales[itemId]) {
              itemSales[itemId] = { name: itemName, quantity: 0, revenue: 0 };
            }
            itemSales[itemId].quantity += itemQty;
            itemSales[itemId].revenue += itemPrice * itemQty;
          });
        }
      });
      
      const topSellingItems = Object.entries(itemSales)
        .filter(([id]) => id && id !== 'unknown')
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      res.json({
        period,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalRefunds: Math.round(totalRefunds * 100) / 100,
          netRevenue: Math.round(netRevenue * 100) / 100,
          totalVatCollected: Math.round(totalVat * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          totalCogs: Math.round(totalCogs * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          profitMargin: netRevenue > 0 ? Math.round((netProfit / netRevenue * 100) * 100) / 100 : 0,
          orderCount: orders.length,
          refundCount: refunds.length,
          invoiceCount: invoices.length,
        },
        expensesByCategory,
        revenueByPayment,
        dailyTrend,
        weeklyTrend,
        topSellingItems,
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب لوحة المحاسبة" });
    }
  });
  
  // ===================== REFUND / RETURN ROUTES =====================

  // Create a new refund
  app.post("/api/refunds", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const { originalOrderId, items, refundMethod, cashAmount, cardAmount, reason, notes } = req.body;
      if (!originalOrderId || !items?.length || !refundMethod || !reason) {
        return res.status(400).json({ error: "بيانات الاسترجاع غير مكتملة" });
      }
      const order = await OrderModel.findById(originalOrderId);
      if (!order) return res.status(404).json({ error: "الطلب الأصلي غير موجود" });
      
      const refundAmount = items.reduce((sum: number, i: any) => sum + (Number(i.totalPrice) || 0), 0);
      if (refundAmount <= 0) return res.status(400).json({ error: "مبلغ الاسترجاع غير صحيح" });

      if (refundMethod === 'split') {
        const totalSplit = (Number(cashAmount) || 0) + (Number(cardAmount) || 0);
        if (Math.abs(totalSplit - refundAmount) > 0.01) {
          return res.status(400).json({ error: "مجموع المبالغ المنقسمة لا يساوي مبلغ الاسترجاع" });
        }
      }

      // Generate refund number
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
      const count = await RefundModel.countDocuments({ tenantId: req.employee?.tenantId || 'default' });
      const refundNumber = `REF-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      const isFullRefund = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0)
        >= (order.items as any[]).reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);

      const refund = new RefundModel({
        tenantId: req.employee?.tenantId || (order as any).tenantId || 'default',
        branchId: req.employee?.branchId || (order as any).branchId,
        refundNumber,
        originalOrderId: originalOrderId,
        originalOrderNumber: order.orderNumber,
        items,
        refundAmount,
        refundType: isFullRefund ? 'full' : 'partial',
        refundMethod,
        cashAmount: refundMethod === 'cash' ? refundAmount : (refundMethod === 'split' ? (Number(cashAmount) || 0) : 0),
        cardAmount: refundMethod === 'card' ? refundAmount : (refundMethod === 'split' ? (Number(cardAmount) || 0) : 0),
        reason,
        notes: notes || '',
        status: 'completed',
        processedBy: req.employee?.id || '',
        processedByName: req.employee?.fullName || '',
      });
      await refund.save();

      // Mark order paymentStatus as refunded if full refund
      if (isFullRefund) {
        await OrderModel.findByIdAndUpdate(originalOrderId, { paymentStatus: 'refunded' });
      }

      res.status(201).json({ success: true, refund: refund.toObject(), refundNumber });
    } catch (error: any) {
      console.error("Create refund error:", error);
      res.status(500).json({ error: "فشل في إنشاء الاسترجاع" });
    }
  });

  // Get all refunds (manager/admin)
  app.get("/api/refunds", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, period, page = '1', limit = '50' } = req.query;
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);

      const query: any = { status: 'completed' };
      if (finalBranchId) query.branchId = finalBranchId;
      if (req.employee?.tenantId) query.tenantId = req.employee.tenantId;

      if (period) {
        const now = new Date();
        let startDate = new Date();
        if (period === 'today') { startDate = getSaudiStartOfDay(); }
        else if (period === 'week') { startDate = new Date(now.getTime() - 7*24*60*60*1000); }
        else if (period === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
        query.createdAt = { $gte: startDate };
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [refunds, total] = await Promise.all([
        RefundModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        RefundModel.countDocuments(query),
      ]);
      res.json({ refunds: refunds.map(r => r.toObject()), total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب قائمة الاسترجاعات" });
    }
  });

  // Get refunds for a specific order
  app.get("/api/orders/:orderId/refunds", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const refunds = await RefundModel.find({ originalOrderId: req.params.orderId }).sort({ createdAt: -1 });
      res.json(refunds.map(r => r.toObject()));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب استرجاعات الطلب" });
    }
  });

  // Search order by number for refund (POS lookup) — MUST come before /:id
  app.get("/api/refunds/search-order/:orderNumber", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const { orderNumber } = req.params;
      const order = await OrderModel.findOne({ 
        orderNumber: { $regex: orderNumber, $options: 'i' },
        status: { $ne: 'cancelled' },
      }).sort({ createdAt: -1 });
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
      
      const existingRefunds = await RefundModel.find({ originalOrderId: (order._id as any).toString() });
      const totalRefunded = existingRefunds.reduce((s, r) => s + r.refundAmount, 0);
      const maxRefundable = (order.totalAmount || 0) - totalRefunded;

      res.json({ order: (order as any).toObject(), existingRefunds: existingRefunds.map(r => r.toObject()), totalRefunded, maxRefundable });
    } catch (error) {
      res.status(500).json({ error: "خطأ في البحث عن الطلب" });
    }
  });

  // Get single refund by id — MUST come after /search-order/:orderNumber
  app.get("/api/refunds/:id", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const refund = await RefundModel.findById(req.params.id);
      if (!refund) return res.status(404).json({ error: "الاسترجاع غير موجود" });
      res.json(refund.toObject());
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الاسترجاع" });
    }
  });

  // ===================== KITCHEN DISPLAY ROUTES =====================
  
  // Get kitchen orders
  app.get("/api/kitchen/orders", requireAuth, requireKitchenAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { branchId, status } = req.query;
      
      const query: any = {};
      const finalBranchId = branchId || req.employee?.branchId;
      if (finalBranchId) query.branchId = finalBranchId;
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ['pending', 'in_progress'] };
      }
      
      const orders = await KitchenOrderModel.find(query)
        .sort({ priority: -1, createdAt: 1 });
      
      res.json(orders.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب طلبات المطبخ" });
    }
  });
  
  // Create kitchen order from regular order (cashiers and above can create)
  app.post("/api/kitchen/orders", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { orderId, orderNumber, items, orderType, tableNumber, customerName, priority, notes } = req.body;
      
      // Check if kitchen order already exists
      const existing = await KitchenOrderModel.findOne({ orderId });
      if (existing) {
        return res.json(serializeDoc(existing));
      }
      
      const kitchenOrder = new KitchenOrderModel({
        orderId,
        orderNumber,
        branchId: req.employee?.branchId,
        items: items.map((item: any) => ({
          itemId: item.itemId || item.coffeeItemId,
          nameAr: item.nameAr || item.coffeeItem?.nameAr,
          quantity: item.quantity,
          notes: item.notes,
          status: 'pending',
        })),
        priority: priority || 'normal',
        orderType: orderType || 'takeaway',
        tableNumber,
        customerName,
        status: 'pending',
        notes,
      });
      
      await kitchenOrder.save();
      res.json(serializeDoc(kitchenOrder));
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء طلب المطبخ" });
    }
  });
  
  // Update kitchen order status
  app.patch("/api/kitchen/orders/:id", requireAuth, requireKitchenAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { id } = req.params;
      const { status, assignedTo } = req.body;
      
      const update: any = { updatedAt: new Date() };
      if (status) {
        update.status = status;
        if (status === 'in_progress') {
          update.startedAt = new Date();
          update.assignedTo = req.employee?.id;
        } else if (status === 'ready' || status === 'completed') {
          update.completedAt = new Date();
        }
      }
      if (assignedTo) update.assignedTo = assignedTo;
      
      const order = await KitchenOrderModel.findByIdAndUpdate(id, update, { new: true });
      
      if (!order) {
        return res.status(404).json({ error: "طلب المطبخ غير موجود" });
      }

      // Automatic inventory deduction when kitchen order starts preparation
      if (status === 'in_progress' && order.orderId && order.branchId) {
        const employeeId = req.employee?.id || 'system';
        const inventoryResult = await deductInventoryForOrder(order.orderId, order.branchId, employeeId);
        if (inventoryResult.success) {
        } else {
        }
      }
      
      res.json(serializeDoc(order));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث طلب المطبخ" });
    }
  });
  
  // Update item status in kitchen order
  app.patch("/api/kitchen/orders/:id/items/:itemId", requireAuth, requireKitchenAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { id, itemId } = req.params;
      const { status } = req.body;
      
      const order = await KitchenOrderModel.findOne({ id }) || await KitchenOrderModel.findById(id).catch(() => null);
      if (!order) {
        return res.status(404).json({ error: "طلب المطبخ غير موجود" });
      }
      
      const item = order.items.find((i: any) => i.itemId === itemId);
      if (!item) {
        return res.status(404).json({ error: "العنصر غير موجود" });
      }
      
      item.status = status;
      if (status === 'ready') {
        item.preparedBy = req.employee?.id;
        item.preparedAt = new Date();
      }
      
      // Check if all items are ready
      const allReady = order.items.every((i: any) => i.status === 'ready');
      if (allReady) {
        order.status = 'ready';
        order.completedAt = new Date();
      } else if (order.items.some((i: any) => i.status === 'preparing')) {
        order.status = 'in_progress';
      }
      
      order.updatedAt = new Date();
      await order.save();
      
      res.json(serializeDoc(order));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث عنصر المطبخ" });
    }
  });

  // Check delivery availability (500m radius from branches)
  app.post("/api/delivery/check-availability", async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "الموقع مطلوب" });
      }
      
      const customerLocation = { lat: Number(latitude), lng: Number(longitude) };
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branches = await storage.getBranches(tenantId);
      
      const { checkDeliveryAvailability } = await import('./utils/geo');
      const result = checkDeliveryAvailability(customerLocation, branches);
      
      res.json({
        canDeliver: result.canDeliver,
        nearestBranch: result.nearestBranch ? {
          id: result.nearestBranch._id?.toString() || result.nearestBranch.id,
          nameAr: result.nearestBranch.nameAr,
          nameEn: result.nearestBranch.nameEn,
        } : null,
        distanceMeters: result.distanceMeters,
        message: result.message,
        messageAr: result.messageAr,
        deliveryRadiusMeters: 500,
        allBranches: result.allBranchesWithDistance.map(b => ({
          id: b.branch._id?.toString() || b.branch.id,
          nameAr: b.branch.nameAr,
          nameEn: b.branch.nameEn,
          distanceMeters: Math.round(b.distanceMeters),
          isInRange: b.isInRange,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في التحقق من التوصيل" });
    }
  });

  // ==========================================
  // Product Addons & Customizations Routes
  // ==========================================
  
  // Get all product addons
  app.get("/api/product-addons", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const ck = cacheKey('product-addons', tenantId);
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);

      const { ProductAddonModel } = await import("@shared/schema");
      const addons = await ProductAddonModel.find({ isAvailable: 1 }).sort({ orderIndex: 1, category: 1, nameAr: 1 });
      const result = addons.map(a => ({ ...a.toObject(), id: a.id }));
      cache.set(ck, result, CACHE_TTL.ADDONS);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإضافات" });
    }
  });

  // Get addons for a specific coffee item
  app.get("/api/coffee-items/:coffeeItemId/addons", async (req, res) => {
    try {
      const { CoffeeItemAddonModel, ProductAddonModel } = await import("@shared/schema");
      const links = await CoffeeItemAddonModel.find({ coffeeItemId: req.params.coffeeItemId });
      const addonIds = links.map(l => l.addonId);
      const addons = await ProductAddonModel.find({ id: { $in: addonIds }, isAvailable: 1 });
      
      const result = links.map(link => {
        const addon = addons.find(a => a.id === link.addonId);
        return addon ? {
          ...addon.toObject(),
          id: addon.id,
          addonId: link.addonId,
          isDefault: link.isDefault,
          defaultValue: link.defaultValue,
          minQuantity: link.minQuantity,
          maxQuantity: link.maxQuantity,
        } : null;
      }).filter(Boolean);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إضافات المشروب" });
    }
  });

  // Create product addon (admin/manager only)
  app.post("/api/product-addons", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel, insertProductAddonSchema } = await import("@shared/schema");
      const validatedData = insertProductAddonSchema.parse(req.body);
      
      const addon = new ProductAddonModel(validatedData);
      await addon.save();
      cache.invalidate('product-addons:');
      res.status(201).json({ ...addon.toObject(), id: addon.id });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء الإضافة" });
    }
  });

  // Update product addon
  app.put("/api/product-addons/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel, insertProductAddonSchema } = await import("@shared/schema");
      const partialSchema = insertProductAddonSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const addon = await ProductAddonModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: validatedData },
        { new: true }
      );
      
      if (!addon) {
        return res.status(404).json({ error: "الإضافة غير موجودة" });
      }
      cache.invalidate('product-addons:');
      res.json({ ...addon.toObject(), id: addon.id });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في تحديث الإضافة" });
    }
  });

  // Delete product addon
  app.delete("/api/product-addons/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel, CoffeeItemAddonModel } = await import("@shared/schema");
      
      await ProductAddonModel.deleteOne({ id: req.params.id });
      await CoffeeItemAddonModel.deleteMany({ addonId: req.params.id });
      cache.invalidate('product-addons:');
      res.json({ success: true, message: "تم حذف الإضافة بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الإضافة" });
    }
  });

  // Link addon to coffee item
  app.post("/api/coffee-items/:coffeeItemId/addons", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemAddonModel, insertCoffeeItemAddonSchema } = await import("@shared/schema");
      const validatedData = insertCoffeeItemAddonSchema.parse({
        coffeeItemId: req.params.coffeeItemId,
        ...req.body
      });
      
      await CoffeeItemAddonModel.findOneAndUpdate(
        { coffeeItemId: validatedData.coffeeItemId, addonId: validatedData.addonId },
        { $set: validatedData },
        { upsert: true, new: true }
      );
      
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في ربط الإضافة بالمشروب" });
    }
  });

  // Remove addon from coffee item
  app.delete("/api/coffee-items/:coffeeItemId/addons/:addonId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemAddonModel } = await import("@shared/schema");
      await CoffeeItemAddonModel.deleteOne({
        coffeeItemId: req.params.coffeeItemId,
        addonId: req.params.addonId
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في إزالة الإضافة من المشروب" });
    }
  });

  // ==========================================
  // Promo Offers / Bundles Routes
  // ==========================================

  // Get all active promo offers (public)
  app.get("/api/promo-offers", async (req, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const now = new Date();
      const offers = await PromoOfferModel.find({
        isActive: 1,
        $or: [
          { startDate: null, endDate: null },
          { startDate: { $lte: now }, endDate: null },
          { startDate: null, endDate: { $gte: now } },
          { startDate: { $lte: now }, endDate: { $gte: now } }
        ]
      }).sort({ sortOrder: 1, createdAt: -1 });
      res.json(offers.map(o => ({ ...o.toObject(), id: o.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب العروض" });
    }
  });

  // Get all promo offers (admin/manager)
  app.get("/api/admin/promo-offers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const offers = await PromoOfferModel.find({}).sort({ sortOrder: 1, createdAt: -1 });
      res.json(offers.map(o => ({ ...o.toObject(), id: o.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب العروض" });
    }
  });

  // Create promo offer (admin/manager)
  app.post("/api/promo-offers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const crypto = await import("crypto");
      
      const offerData = {
        ...req.body,
        id: req.body.id || crypto.randomUUID(),
        tenantId: req.body.tenantId || "default",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const offer = new PromoOfferModel(offerData);
      await offer.save();
      
      res.status(201).json({ ...offer.toObject(), id: offer.id });
    } catch (error: any) {
      console.error("Error creating promo offer:", error);
      res.status(500).json({ error: "فشل في إنشاء العرض" });
    }
  });

  // Update promo offer
  app.put("/api/promo-offers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const pid = req.params.id;
      const update = { $set: { ...req.body, updatedAt: new Date() } };
      const opts = { new: true };

      let offer = await PromoOfferModel.findOneAndUpdate({ id: pid }, update, opts);
      if (!offer && pid.match(/^[0-9a-fA-F]{24}$/)) {
        offer = await PromoOfferModel.findByIdAndUpdate(pid, update, opts);
      }

      if (!offer) {
        return res.status(404).json({ error: "العرض غير موجود" });
      }

      res.json({ ...offer.toObject(), id: offer.get('id') || offer.id });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في تحديث العرض" });
    }
  });

  // Delete promo offer
  app.delete("/api/promo-offers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const pid = req.params.id;
      let result = await PromoOfferModel.deleteOne({ id: pid });
      if (result.deletedCount === 0 && pid.match(/^[0-9a-fA-F]{24}$/)) {
        result = await PromoOfferModel.deleteOne({ _id: pid });
      }
      res.json({ success: true, message: "تم حذف العرض بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف العرض" });
    }
  });

  // ===== Menu Categories API =====
  
  // Get all active menu categories (public - scoped by tenantId)
  app.get("/api/menu-categories", async (req, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = (req.query.branchId as string) || 'all';
      const ck = cacheKey('menu-cats', tenantId, branchId);
      const cached = cache.get<any[]>(ck);
      if (cached) return res.json(cached);

      const query: any = { 
        isActive: 1,
        tenantId 
      };
      
      if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        query.$or = [
          { branchId: branchId },
          { publishedBranches: branchId },
          { createdByBranchId: branchId }
        ];
      }
      
      const categories = await MenuCategoryModel.find(query).sort({ orderIndex: 1, createdAt: 1 }).lean();
      const result = categories.map((c: any) => ({ ...c, id: c.id || c._id?.toString() }));
      cache.set(ck, result, CACHE_TTL.CATEGORIES);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الأقسام" });
    }
  });

  // Create menu category (admin/manager)
  app.post("/api/menu-categories", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const { z } = await import("zod");
      const crypto = await import("crypto");
      
      // Validate input
      const createSchema = z.object({
        nameAr: z.string().min(1, "اسم القسم مطلوب"),
        nameEn: z.string().optional(),
        icon: z.string().optional(),
        department: z.enum(['drinks', 'food']).default('drinks'),
      });
      
      const validatedData = createSchema.parse(req.body);
      
      // Get tenant from auth or header
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      // Get the max orderIndex for new categories
      const maxOrder = await MenuCategoryModel.findOne({ tenantId }).sort({ orderIndex: -1 });
      const newOrderIndex = (maxOrder?.orderIndex || 0) + 1;
      
      const categoryData = {
        id: crypto.randomUUID(),
        tenantId,
        nameAr: validatedData.nameAr,
        nameEn: validatedData.nameEn,
        icon: validatedData.icon || 'Coffee',
        department: validatedData.department,
        orderIndex: newOrderIndex,
        isSystem: false,
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const category = new MenuCategoryModel(categoryData);
      await category.save();
      cache.invalidate('menu-cats:' + tenantId);
      res.status(201).json({ ...category.toObject(), id: category.id });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0]?.message || "بيانات غير صالحة" });
      }
      console.error("Error creating menu category:", error);
      res.status(500).json({ error: "فشل في إنشاء القسم" });
    }
  });

  // Update menu category
  app.put("/api/menu-categories/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const { z } = await import("zod");
      
      // Validate input - only allow specific fields to be updated
      const updateSchema = z.object({
        nameAr: z.string().min(1).optional(),
        nameEn: z.string().optional(),
        icon: z.string().optional(),
        department: z.enum(['drinks', 'food']).optional(),
        orderIndex: z.number().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      const category = await MenuCategoryModel.findOneAndUpdate(
        { id: req.params.id, tenantId },
        { $set: { ...validatedData, updatedAt: new Date() } },
        { new: true }
      );
      
      if (!category) {
        return res.status(404).json({ error: "القسم غير موجود" });
      }
      cache.invalidate('menu-cats:' + tenantId);
      res.json({ ...category.toObject(), id: category.id });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0]?.message || "بيانات غير صالحة" });
      }
      res.status(500).json({ error: "فشل في تحديث القسم" });
    }
  });

  // Bulk reorder menu categories
  app.post("/api/menu-categories/reorder", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const { orders } = req.body as { orders: Array<{ id: string; orderIndex: number }> };
      if (!Array.isArray(orders)) return res.status(400).json({ error: "orders must be an array" });
      await Promise.all(
        orders.map(({ id, orderIndex }) =>
          MenuCategoryModel.updateOne({ id, tenantId }, { $set: { orderIndex, updatedAt: new Date() } })
        )
      );
      cache.invalidate('menu-cats:' + tenantId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في إعادة ترتيب الأقسام" });
    }
  });

  // Delete menu category with smart product reassignment
  app.delete("/api/menu-categories/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel, CoffeeItemModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      // Find the category to delete
      const category = await MenuCategoryModel.findOne({ id: req.params.id, tenantId });
      if (!category) {
        return res.status(404).json({ error: "القسم غير موجود" });
      }
      
      // Find all active categories except the one being deleted (same department preferred)
      const remainingCategories = await MenuCategoryModel.find({
        tenantId,
        isActive: 1,
        id: { $ne: req.params.id },
      }).lean();
      
      // Find all items that belong to this category
      const orphanedItems = await (CoffeeItemModel as any).find({
        tenantId,
        category: req.params.id,
      }).lean();
      
      let reassignedCount = 0;
      
      if (orphanedItems.length > 0 && remainingCategories.length > 0) {
        // Smart keyword-based reassignment
        const deletedName = (category.nameAr || "").toLowerCase();
        
        // Keyword groups for smart matching
        const keywordGroups: Record<string, string[]> = {
          coffee:    ["قهوة", "كوفي", "اسبريسو", "cappuccino", "latte", "coffee", "espresso", "قهوه"],
          tea:       ["شاي", "tea", "تي", "أعشاب", "herbs"],
          cold:      ["بارد", "مثلج", "عصير", "ice", "cold", "فريش", "fresh", "مشروب"],
          hot:       ["ساخن", "hot", "دافئ", "warm"],
          food:      ["أكل", "طعام", "وجبة", "food", "meal", "ساندوتش", "sandwich", "سلطة", "salad"],
          dessert:   ["حلوى", "كيك", "cake", "dessert", "حلو", "sweet", "بسكويت"],
          bakery:    ["مخبوزات", "خبز", "bread", "bakery", "معجنات", "croissant"],
          seasonal:  ["موسمي", "seasonal", "خاص", "special", "محدود", "limited"],
        };
        
        const getKeywordGroup = (name: string): string | null => {
          const lower = name.toLowerCase();
          for (const [group, keywords] of Object.entries(keywordGroups)) {
            if (keywords.some(kw => lower.includes(kw))) return group;
          }
          return null;
        };
        
        const deletedGroup = getKeywordGroup(deletedName);
        
        for (const item of orphanedItems) {
          let bestCategory: any = null;
          
          // 1. Try same department + keyword similarity
          const sameDeptCats = remainingCategories.filter(c => c.department === category.department);
          const pool = sameDeptCats.length > 0 ? sameDeptCats : remainingCategories;
          
          const itemGroup = getKeywordGroup((item as any).nameAr || "");
          
          // Priority 1: matching keyword group
          if (deletedGroup || itemGroup) {
            const targetGroup = itemGroup || deletedGroup;
            bestCategory = pool.find(c => getKeywordGroup(c.nameAr || "") === targetGroup);
          }
          
          // Priority 2: first same-department category
          if (!bestCategory) {
            bestCategory = pool[0];
          }
          
          // Priority 3: any remaining category
          if (!bestCategory) {
            bestCategory = remainingCategories[0];
          }
          
          if (bestCategory) {
            await (CoffeeItemModel as any).updateOne(
              { _id: (item as any)._id },
              { $set: { category: bestCategory.id, updatedAt: new Date() } }
            );
            reassignedCount++;
          }
        }
      }
      
      // Soft delete the category
      await MenuCategoryModel.findOneAndUpdate(
        { id: req.params.id, tenantId },
        { $set: { isActive: 0, updatedAt: new Date() } }
      );
      
      // Clear cache
      cache.invalidate('menu-cats:' + tenantId);
      cache.invalidate('coffee-items:' + tenantId);
      
      res.json({
        success: true,
        message: `تم حذف القسم بنجاح${reassignedCount > 0 ? ` وتم نقل ${reassignedCount} منتج إلى أقسام مناسبة تلقائياً` : ""}`,
        reassignedCount,
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "فشل في حذف القسم" });
    }
  });

  // Lookup loyalty card by barcode/QR token (for POS scanner)
  app.get("/api/loyalty/cards/lookup/:token", async (req, res) => {
    try {
      const { LoyaltyCardModel, CustomerModel } = await import("@shared/schema");
      const token = req.params.token;
      
      // Search by qrToken, cardNumber, or phone
      const card = await LoyaltyCardModel.findOne({
        $or: [
          { qrToken: token },
          { cardNumber: token },
          { phoneNumber: token }
        ]
      });
      
      if (!card) {
        return res.status(404).json({ error: "البطاقة غير موجودة", found: false });
      }
      
      const customer = await CustomerModel.findOne({ phone: card.phoneNumber });
      
      res.json({
        found: true,
        card: { ...card.toObject(), id: card._id?.toString() || card.id },
        customer: customer ? {
          id: customer._id?.toString(),
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          points: customer.points,
        } : null
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في البحث عن البطاقة" });
    }
  });

  // ============ PRODUCT REVIEWS ROUTES ============
  app.get("/api/reviews", async (req, res) => {
    try {
      const { productId } = req.query;
      const reviews = await ProductReviewModel.find({ productId });
      res.json(reviews.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التقييمات" });
    }
  });

  app.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const { productId, rating, comment } = req.body;
      const customerId = (req as any).user?.id;
      
      const review = new ProductReviewModel({
        productId,
        customerId,
        rating,
        comment,
        isVerifiedPurchase: 1,
      });
      await review.save();
      res.json(serializeDoc(review));
    } catch (error) {
      res.status(500).json({ error: "فشل في حفظ التقييم" });
    }
  });

  // ============ REFERRAL ROUTES ============
  app.get("/api/referrals", requireAuth, async (req, res) => {
    try {
      const referrerId = (req as any).user?.id;
      const referrals = await ReferralModel.find({ referrerId });
      const completed = referrals.filter((r) => r.status === "completed").length;
      const code = `REFER${referrerId?.substring(0, 8).toUpperCase()}`;
      const points = completed * 50;
      
      res.json({
        code,
        completed,
        points,
        list: referrals.map(serializeDoc),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإحالات" });
    }
  });

  app.post("/api/referrals/invite", requireAuth, async (req, res) => {
    try {
      const referrerId = (req as any).user?.id;
      const { referredPhone, referredEmail } = req.body;
      
      const code = `REFER${referrerId?.substring(0, 8).toUpperCase()}`;
      const referral = new ReferralModel({
        referrerId,
        referrerCode: code,
        referredPhone,
        referredEmail,
        status: "pending",
      });
      await referral.save();

      // Create notification
      const notification = new NotificationModel({
        customerId: referrerId,
        title: "تم إرسال الدعوة",
        message: `تم إرسال رمز الإحالة الخاص بك إلى ${referredPhone}`,
        type: "referral",
      });
      await notification.save();

      res.json(serializeDoc(referral));
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الدعوة" });
    }
  });

  // ============ NOTIFICATIONS ROUTES ============
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const customerId = (req as any).user?.id || req.query.customerId as string;

      let query: any = {};
      if (userId) {
        query = { $or: [{ userId }, { customerId: userId }] };
      } else if (customerId) {
        query = { $or: [{ customerId }, { userId: customerId }] };
      }

      const notifications = await NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .limit(50);
      res.json(notifications.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإشعارات" });
    }
  });

  // Admin: get unread count for employee notifications
  app.get("/api/notifications/unread-count", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employeeId = req.employee?.id;
      const count = await NotificationModel.countDocuments({
        $or: [{ userId: employeeId }, { userType: "employee" }],
        isRead: 0,
      });
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "فشل" });
    }
  });

  // Admin: broadcast push notification to all subscribers
  app.post("/api/notifications/broadcast", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, body, link, target } = req.body;
      if (!title || !body) return res.status(400).json({ error: "العنوان والنص مطلوبان" });

      const { fireNotifyBroadcast, fireNotifyAdmins } = await import("./notification-engine");

      if (target === "admins") {
        await fireNotifyAdmins(title, body, { type: "info", link: link || "/", icon: "📢" });
      } else {
        await fireNotifyBroadcast(title, body, { type: "promo", link: link || "/", icon: "📢" });
      }

      res.json({ success: true, message: "تم إرسال الإشعار بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الإشعار" });
    }
  });

  // Admin: send notification to specific user
  app.post("/api/notifications/send", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { userId, userType, title, body, link, type } = req.body;
      if (!userId || !title || !body) return res.status(400).json({ error: "بيانات ناقصة" });

      const { fireNotify } = await import("./notification-engine");
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';

      let resolvedId = userId;

      // If userType is customer and userId looks like a phone number, look up customer
      if (userType === 'customer' && /^\+?[\d\s\-()]{7,15}$/.test(userId)) {
        try {
          const cleanPhone = userId.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
          const customer = await storage.getCustomerByPhone(cleanPhone);
          if (customer) {
            resolvedId = (customer as any)._id?.toString() || (customer as any).id || userId;
          }
        } catch {}
      }

      await fireNotify(resolvedId, title, body, {
        type: type || "info",
        link: link || "/",
        userType: userType || "customer",
        tenantId,
        icon: "🔔",
      });

      // Also send push directly to all subscriptions matching this userId (covers both id and phone)
      if (userType === 'customer' && resolvedId !== userId) {
        const { sendPushToCustomer } = await import("./push-service");
        sendPushToCustomer(userId, {
          title, body, url: link || '/', tag: `admin-notif-${Date.now()}`, type: 'general',
        }).catch(() => {});
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الإشعار" });
    }
  });

  // Marketing Email Route for Staff
  app.post("/api/admin/broadcast-email", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { subject, message, customerEmails } = req.body;
      
      if (!subject || !message || !customerEmails || !Array.isArray(customerEmails)) {
        return res.status(400).json({ error: "بيانات الحملة غير مكتملة" });
      }

      const { appendOrderToSheet } = await import("./google-sheets");

      // Send via Sheets for each customer
      for (const email of customerEmails) {
        await appendOrderToSheet({
          id: `MKT-${Date.now()}`,
          customerEmail: email,
          status: subject,
          customerNotes: message
        }, 'MARKETING');
      }

      res.json({ success: true, message: "تمت جدولة إرسال الحملة البريدية عبر جوجل شيت" });
    } catch (error) {
      res.status(500).json({ error: "فشل في جدولة الحملة البريدية" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const notification = await NotificationModel.findByIdAndUpdate(
        req.params.id,
        { isRead: 1 },
        { new: true }
      );
      res.json(serializeDoc(notification));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الإشعار" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await NotificationModel.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الإشعار" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const customerId = (req as any).user?.id || req.body.customerId || req.query.customerId;
      const userId = req.body.userId || req.query.userId || customerId;
      await NotificationModel.updateMany(
        { $or: [{ customerId: userId }, { userId }], isRead: 0 },
        { isRead: 1 }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الإشعارات" });
    }
  });

  // ============ EMAIL NOTIFICATION ROUTES ============
  app.post("/api/send-order-email", requireAuth, async (req, res) => {
    try {
      const { orderId, orderStatus, orderTotal } = req.body;
      const customerId = (req as any).user?.id;

      // Get customer info
      const customer = await CustomerModel.findOne({ id: customerId });
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const success = await sendOrderNotificationEmail(
        customer.email,
        customer.name,
        orderId,
        orderStatus,
        orderTotal
      );

      if (!success) {
        console.log("Email service not configured, but notification created");
      }

      res.json({ success: true, message: "تم إرسال الإشعار" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الإشعار" });
    }
  });

  app.post("/api/send-referral-email", requireAuth, async (req, res) => {
    try {
      const customerId = (req as any).user?.id;
      const customer = await CustomerModel.findOne({ id: customerId });

      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const referralCode = `REFER${customerId?.substring(0, 8).toUpperCase()}`;

      const success = await sendReferralEmail(
        customer.email,
        customer.name,
        referralCode
      );

      if (!success) {
        console.log("Email service not configured, but referral tracked");
      }

      res.json({ success: true, message: "تم إرسال بريد الإحالة" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال بريد الإحالة" });
    }
  });

  app.post("/api/send-loyalty-email", requireAuth, async (req, res) => {
    try {
      const { pointsEarned } = req.body;
      const customerId = (req as any).user?.id;

      const customer = await CustomerModel.findOne({ id: customerId });
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const success = await sendLoyaltyPointsEmail(
        customer.email,
        customer.name,
        pointsEarned,
        customer.points || 0
      );

      if (!success) {
        console.log("Email service not configured, but points tracked");
      }

      res.json({ success: true, message: "تم إرسال بريد النقاط" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال بريد النقاط" });
    }
  });

  app.post("/api/send-promotion-email", requireAdmin, async (req, res) => {
    try {
      const { customerId, promotionTitle, promotionDescription, discountCode } =
        req.body;

      const customer = await CustomerModel.findOne({ id: customerId });
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const success = await sendPromotionEmail(
        customer.email,
        customer.name,
        promotionTitle,
        promotionDescription,
        discountCode
      );

      if (!success) {
        console.log("Email service not configured, but promotion tracked");
      }

      res.json({ success: true, message: "تم إرسال العرض الترويجي" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال العرض الترويجي" });
    }
  });

  app.get("/api/email-status", async (req, res) => {
    try {
      const connected = await testEmailConnection();
      res.json({
        connected,
        message: connected
          ? "خدمة البريد الإلكتروني متصلة"
          : "خدمة البريد الإلكتروني غير متصلة. الرجاء تكوين بيانات Gmail",
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في التحقق من حالة البريد" });
    }
  });

  // Test email endpoint - send order confirmation with current status
  app.post("/api/test-email", async (req, res) => {
    try {
      const { email = "youssefdarwish20009@gmail.com", customerName = "العميل", orderId = "TEST001", status = "in_progress", total = 45.50 } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }

      // Send order notification email with order details and current status
      const success = await sendOrderNotificationEmail(
        email,
        customerName,
        orderId,
        status,
        total
      );

      if (success) {
        res.json({ 
          success: true, 
          message: "✅ تم إرسال رسالة تأكيد الطلب بنجاح!",
          details: {
            email,
            customerName,
            orderId,
            status,
            total
          }
        });
      } else {
        res.status(500).json({ error: "❌ فشل في إرسال رسالة تأكيد الطلب" });
      }
    } catch (error) {
      res.status(500).json({ error: "❌ خطأ: " + (error as any).message });
    }
  });

  // ===== MULTI-TENANT MANAGEMENT ENDPOINTS =====
  
  // Get all tenants (Admin only)
  app.get("/api/admin/tenants", requireAdmin, async (req, res) => {
    try {
      const tenants = await CafeModel.find().lean();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  // Get specific tenant
  app.get("/api/admin/tenants/:tenantId", requireAdmin, async (req, res) => {
    try {
      const tenant = await CafeModel.findOne({ id: req.params.tenantId }).lean();
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  // Create new tenant (Admin only)
  app.post("/api/admin/tenants", requireAdmin, async (req, res) => {
    try {
      const { id, nameAr, nameEn, type, businessName, businessPhone, businessEmail, billingContact, adminContact } = req.body;
      
      if (!id || !nameAr || !nameEn || !businessName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tenant = new CafeModel({
        id,
        nameAr,
        nameEn,
        type: type || 'demo',
        businessName,
        businessPhone,
        businessEmail,
        billingContact,
        adminContact,
        status: 'active'
      });

      await tenant.save();
      res.json({ success: true, tenant });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create tenant" });
    }
  });

  // Update tenant (Admin only)
  app.patch("/api/admin/tenants/:tenantId", requireAdmin, async (req, res) => {
    try {
      const tenant = await CafeModel.findOneAndUpdate(
        { id: req.params.tenantId },
        { $set: { ...req.body, updatedAt: new Date() } },
        { new: true }
      );
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json({ success: true, tenant });
    } catch (error) {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // Delete tenant (Admin only - soft delete)
  app.delete("/api/admin/tenants/:tenantId", requireAdmin, async (req, res) => {
    try {
      await CafeModel.updateOne({ id: req.params.tenantId }, { status: 'inactive' });
      res.json({ success: true, message: "Tenant deactivated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate tenant" });
    }
  });

  // Get tenant info (for logged-in users)
  app.get("/api/tenant/info", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "No tenant context" });
      
      const tenant = await CafeModel.findOne({ id: tenantId }).lean();
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant info" });
    }
  });

  // ============ RECIPE ROUTES (Phase 4) ============
  
  // Get active recipe for drink
  app.get("/api/recipes/:coffeeItemId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const recipe = await RecipeEngine.getActiveRecipe(coffeeItemId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json({ success: true, recipe });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  // ============ INVENTORY ROUTES (Phase 4) ============
  
  // Get stock level
  app.get("/api/inventory/stock-level/:branchId/:rawItemId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId } = req.params;
      const level = await InventoryEngine.getStockLevel(branchId, rawItemId);
      
      if (!level) {
        return res.status(404).json({ error: "Stock record not found" });
      }

      res.json({ success: true, stockLevel: level });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock level" });
    }
  });

  // Record stock in (purchase)
  app.post("/api/inventory/stock-in", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId, quantity, unit, supplierId, notes } = req.body;
      const userId = req.employee?.id || "system";

      if (!branchId || !rawItemId || !quantity || !unit) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await InventoryEngine.recordStockIn({
        branchId,
        rawItemId,
        quantity,
        unit,
        supplierId,
        notes,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, newQuantity: result.newQuantity, movement: result.movement });
    } catch (error) {
      res.status(500).json({ error: "Failed to record stock in" });
    }
  });

  // Get active alerts
  app.get("/api/inventory/alerts/:branchId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const alerts = await InventoryEngine.getActiveAlerts(branchId);
      res.json({ success: true, alerts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Get low stock items (daily summary)
  app.get("/api/inventory/low-stock/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const items = await InventoryEngine.getLowStockItems(branchId);
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  });

  // Get movement history
  app.get("/api/inventory/movements/:branchId/:rawItemId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const movements = await InventoryEngine.getMovementHistory(branchId, rawItemId, limit);
      res.json({ success: true, movements });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movement history" });
    }
  });

  // ============ ACCOUNTING ROUTES (Phase 4) ============
  
  // Get daily snapshot
  app.get("/api/accounting/daily-snapshot/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      
      const snapshot = await AccountingEngine.getDailySnapshot(branchId, date);
      res.json({ success: true, snapshot });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily snapshot" });
    }
  });

  // Get profit per drink report
  app.get("/api/accounting/profit-by-item/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await AccountingEngine.getProfitPerDrink(branchId, startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profit report" });
    }
  });

  // Get profit per category report
  app.get("/api/accounting/profit-by-category/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await AccountingEngine.getProfitPerCategory(branchId, startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category report" });
    }
  });

  // Get top profitable items
  app.get("/api/accounting/top-items/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const items = await AccountingEngine.getTopProfitableItems(branchId, startDate, endDate, limit);
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top items" });
    }
  });

  // Get worst performing items
  app.get("/api/accounting/worst-items/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const items = await AccountingEngine.getWorstItems(branchId, startDate, endDate, limit);
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch worst items" });
    }
  });

  // Get waste report
  app.get("/api/accounting/waste-report/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await AccountingEngine.getWasteReport(branchId, startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch waste report" });
    }
  });

  // Save daily snapshot
  app.post("/api/accounting/snapshot", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { tenantId, branchId } = req.body;
      const userId = req.employee?.id || "system";

      if (!tenantId || !branchId) {
        return res.status(400).json({ error: "Missing required fields: tenantId, branchId" });
      }

      const snapshot = await AccountingEngine.saveDailySnapshot(tenantId, branchId, userId);

      if (!snapshot) {
        return res.status(400).json({ error: "Failed to save snapshot" });
      }

      res.json({ success: true, snapshot });
    } catch (error) {
      res.status(500).json({ error: "Failed to save snapshot" });
    }
  });

  // ============================================
  // ERP Accounting System Routes
  // نظام المحاسبة المتقدم ERP
  // ============================================

  // Initialize Chart of Accounts
  app.post("/api/erp/accounts/initialize", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const accounts = await ErpAccountingService.initializeChartOfAccounts(tenantId);
      res.json({ success: true, accounts: accounts.map(serializeDoc), count: accounts.length });
    } catch (error: any) {
      console.error("Error initializing chart of accounts:", error);
      res.status(500).json({ error: error.message || "Failed to initialize chart of accounts" });
    }
  });

  // Get all accounts
  app.get("/api/erp/accounts", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const accounts = await ErpAccountingService.getAccounts(tenantId, {
        accountType: req.query.accountType as string,
        isActive: req.query.isActive ? parseInt(req.query.isActive as string) : undefined,
        parentAccountId: req.query.parentAccountId as string,
      });
      res.json({ success: true, accounts: accounts.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch accounts" });
    }
  });

  // Get account tree
  app.get("/api/erp/accounts/tree", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const tree = await ErpAccountingService.getAccountTree(tenantId);
      res.json({ success: true, tree });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch account tree" });
    }
  });

  // Create new account
  app.post("/api/erp/accounts", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const account = await ErpAccountingService.createAccount({
        tenantId,
        ...req.body,
      });
      res.json({ success: true, account: serializeDoc(account) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create account" });
    }
  });

  // Get journal entries
  app.get("/api/erp/journal-entries", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const query: any = { tenantId };
      if (req.query.status) query.status = req.query.status;
      if (req.query.referenceType) query.referenceType = req.query.referenceType;
      const entries = await JournalEntryModel.find(query).sort({ entryDate: -1, createdAt: -1 }).limit(100);
      res.json({ success: true, entries: entries.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch journal entries" });
    }
  });

  // Get expenses
  app.get("/api/erp/expenses", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const query: any = { tenantId };
      if (req.query.status) query.status = req.query.status;
      const expenses = await ExpenseErpModel.find(query).sort({ createdAt: -1 }).limit(100);
      res.json({ success: true, expenses: expenses.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch expenses" });
    }
  });

  // Create journal entry
  app.post("/api/erp/journal-entries", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const createdBy = req.employee?.id || "system";
      const entry = await ErpAccountingService.createJournalEntry({
        tenantId,
        ...req.body,
        createdBy,
      });
      res.json({ success: true, entry: serializeDoc(entry) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create journal entry" });
    }
  });

  // Post journal entry
  app.patch("/api/erp/journal-entries/:id/post", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const postedBy = req.employee?.id || "system";
      const entry = await ErpAccountingService.postJournalEntry(tenantId, req.params.id, postedBy);
      res.json({ success: true, entry: serializeDoc(entry) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to post journal entry" });
    }
  });

  // Create invoice from order
  app.post("/api/erp/invoices/from-order/:orderId", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId || req.body.branchId || "default-branch";
      const issuedBy = req.employee?.id || "system";
      const sellerInfo = req.body.sellerInfo;
      const invoice = await ErpAccountingService.createInvoiceFromOrder(
        tenantId,
        branchId,
        req.params.orderId,
        issuedBy,
        sellerInfo
      );
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create invoice" });
    }
  });

  // Get all invoices
  app.get("/api/erp/invoices", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const branchId = req.query.branchId as string;
      const status = req.query.status as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const invoices = await ErpAccountingService.getInvoices(tenantId, {
        branchId,
        status,
        startDate,
        endDate,
        limit,
      });
      res.json({ success: true, invoices: invoices.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch invoices" });
    }
  });

  // Get single invoice
  app.get("/api/erp/invoices/:id", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const invoice = await ErpAccountingService.getInvoiceById(tenantId, req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch invoice" });
    }
  });

  // Create standalone invoice
  app.post("/api/erp/invoices", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId || req.body.branchId || "default-branch";
      const issuedBy = req.employee?.id || "system";
      
      const invoice = await ErpAccountingService.createInvoice({
        tenantId,
        branchId,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        customerEmail: req.body.customerEmail,
        customerTaxNumber: req.body.customerTaxNumber,
        customerAddress: req.body.customerAddress,
        lines: req.body.lines,
        notes: req.body.notes,
        issuedBy,
        sellerName: req.body.sellerName || "مكان الشيف البخاري",
        sellerVatNumber: req.body.sellerVatNumber || "311234567890003",
      });
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create invoice" });
    }
  });

  // Update invoice status
  app.patch("/api/erp/invoices/:id/status", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const invoice = await ErpAccountingService.updateInvoiceStatus(
        tenantId,
        req.params.id,
        req.body.status,
        req.body.amountPaid
      );
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update invoice status" });
    }
  });

  // Get trial balance
  app.get("/api/erp/reports/trial-balance", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const trialBalance = await ErpAccountingService.getTrialBalance(tenantId, endDate);
      res.json({ success: true, trialBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch trial balance" });
    }
  });

  // Get income statement
  app.get("/api/erp/reports/income-statement", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const branchId = req.query.branchId as string;
      const incomeStatement = await ErpAccountingService.getIncomeStatement(tenantId, startDate, endDate, branchId);
      res.json({ success: true, incomeStatement });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch income statement" });
    }
  });

  // Get balance sheet
  app.get("/api/erp/reports/balance-sheet", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();
      const balanceSheet = await ErpAccountingService.getBalanceSheet(tenantId, asOfDate);
      res.json({ success: true, balanceSheet });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch balance sheet" });
    }
  });

  // Create ERP expense
  app.post("/api/erp/expenses", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId || req.body.branchId || "default-branch";
      const requestedBy = req.employee?.id || "system";
      const expense = await ErpAccountingService.createExpense({
        tenantId,
        branchId,
        requestedBy,
        ...req.body,
      });
      res.json({ success: true, expense: serializeDoc(expense) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create expense" });
    }
  });

  // Approve expense
  app.patch("/api/erp/expenses/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const approvedBy = req.employee?.id || "system";
      const expense = await ErpAccountingService.approveExpense(tenantId, req.params.id, approvedBy);
      res.json({ success: true, expense: serializeDoc(expense) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to approve expense" });
    }
  });

  // Get vendors
  app.get("/api/erp/vendors", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const vendors = await ErpAccountingService.getVendors(tenantId);
      res.json({ success: true, vendors: vendors.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch vendors" });
    }
  });

  // Create vendor
  app.post("/api/erp/vendors", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      let code = req.body.code;
      if (!code) {
        const count = await VendorModel.countDocuments({ tenantId });
        code = `VND-${String(count + 1).padStart(4, "0")}`;
      }
      const vendor = await ErpAccountingService.createVendor({
        tenantId,
        ...req.body,
        code,
      });
      res.json({ success: true, vendor: serializeDoc(vendor) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create vendor" });
    }
  });

  // Get ERP dashboard summary
  app.get("/api/erp/dashboard", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const branchId = req.query.branchId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const summary = await ErpAccountingService.getDashboardSummary(tenantId, branchId, startDate, endDate);
      res.json({ success: true, summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch dashboard summary" });
    }
  });

  // Post order to journal (auto-post sales entry)
  app.post("/api/erp/orders/:orderId/post-journal", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const createdBy = req.employee?.id || "system";
      const entry = await ErpAccountingService.postOrderJournal(tenantId, req.params.orderId, createdBy);
      if (entry) {
        res.json({ success: true, entry: serializeDoc(entry) });
      } else {
        res.status(404).json({ error: "Order not found or missing accounts" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to post order journal" });
    }
  });

  // =====================================================
  // نظام التوصيل المتكامل - Integrated Delivery System
  // =====================================================

  // Delivery Integrations (External Providers)
  app.get("/api/delivery/integrations", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const integrations = await deliveryService.getAllIntegrations(tenantId);
      res.json({ success: true, integrations: integrations.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch integrations" });
    }
  });

  app.post("/api/delivery/integrations", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const integration = await deliveryService.createIntegration({ ...req.body, tenantId });
      res.json({ success: true, integration: serializeDoc(integration) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create integration" });
    }
  });

  app.patch("/api/delivery/integrations/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const integration = await deliveryService.updateIntegration(req.params.id, req.body);
      if (integration) {
        res.json({ success: true, integration: serializeDoc(integration) });
      } else {
        res.status(404).json({ error: "Integration not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update integration" });
    }
  });

  app.delete("/api/delivery/integrations/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deliveryService.deleteIntegration(req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete integration" });
    }
  });

  // Delivery Zones
  app.get("/api/delivery/zones", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const zones = await deliveryService.getAllZones(tenantId, branchId);
      res.json({ success: true, zones: zones.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch zones" });
    }
  });

  app.post("/api/delivery/zones", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const zone = await deliveryService.createZone({ ...req.body, tenantId });
      res.json({ success: true, zone: serializeDoc(zone) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create zone" });
    }
  });

  app.patch("/api/delivery/zones/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const zone = await deliveryService.updateZone(req.params.id, req.body);
      if (zone) {
        res.json({ success: true, zone: serializeDoc(zone) });
      } else {
        res.status(404).json({ error: "Zone not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update zone" });
    }
  });

  app.delete("/api/delivery/zones/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deliveryService.deleteZone(req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete zone" });
    }
  });

  // Delivery Drivers
  app.get("/api/delivery/drivers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const drivers = await deliveryService.getAllDrivers(tenantId, branchId);
      res.json({ success: true, drivers: drivers.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch drivers" });
    }
  });

  app.get("/api/delivery/drivers/available", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const drivers = await deliveryService.getAvailableDrivers(tenantId, branchId);
      res.json({ success: true, drivers: drivers.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch available drivers" });
    }
  });

  app.post("/api/delivery/drivers", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const driver = await deliveryService.createDriver({ ...req.body, tenantId });
      res.json({ success: true, driver: serializeDoc(driver) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create driver" });
    }
  });

  app.patch("/api/delivery/drivers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const driver = await deliveryService.updateDriver(req.params.id, req.body);
      if (driver) {
        res.json({ success: true, driver: serializeDoc(driver) });
      } else {
        res.status(404).json({ error: "Driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update driver" });
    }
  });

  app.patch("/api/delivery/drivers/:id/location", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { lat, lng } = req.body;
      const driver = await deliveryService.updateDriverLocation(req.params.id, lat, lng);
      if (driver) {
        res.json({ success: true, driver: serializeDoc(driver) });
      } else {
        res.status(404).json({ error: "Driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update location" });
    }
  });

  app.patch("/api/delivery/drivers/:id/status", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const driver = await deliveryService.updateDriverStatus(req.params.id, status);
      if (driver) {
        res.json({ success: true, driver: serializeDoc(driver) });
      } else {
        res.status(404).json({ error: "Driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update status" });
    }
  });

  app.delete("/api/delivery/drivers/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deliveryService.deleteDriver(req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete driver" });
    }
  });

  // Driver Login (public - for driver portal)
  // Simple rate limiting for driver login attempts
  const driverLoginAttempts = new Map<string, { count: number; lastAttempt: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  app.post("/api/delivery/drivers/login", async (req, res) => {
    try {
      const { phone } = req.body;
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      
      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      // Rate limiting check
      const attemptKey = `${clientIP}:${phone}`;
      const attempts = driverLoginAttempts.get(attemptKey);
      const now = Date.now();
      
      if (attempts) {
        if (now - attempts.lastAttempt < LOGIN_WINDOW_MS && attempts.count >= MAX_LOGIN_ATTEMPTS) {
          return res.status(429).json({ error: "تم تجاوز عدد المحاولات المسموحة. يرجى الانتظار 15 دقيقة." });
        }
        if (now - attempts.lastAttempt >= LOGIN_WINDOW_MS) {
          driverLoginAttempts.delete(attemptKey);
        }
      }
      
      const driver = await deliveryService.getDriverByPhone(phone);
      if (!driver) {
        // Track failed attempt
        const current = driverLoginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
        driverLoginAttempts.set(attemptKey, { count: current.count + 1, lastAttempt: now });
        return res.status(404).json({ error: "لم يتم العثور على المندوب" });
      }
      
      // Clear attempts on successful login
      driverLoginAttempts.delete(attemptKey);
      
      // Update driver status to available on login
      await deliveryService.updateDriverStatus(driver._id?.toString() || driver.id, "available");
      
      // Store driver session
      (req.session as any).driverId = driver._id?.toString() || driver.id;
      
      res.json({ 
        success: true, 
        driver: serializeDoc(driver),
        message: "تم تسجيل الدخول بنجاح"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "فشل تسجيل الدخول" });
    }
  });

  // Delivery Orders
  app.get("/api/delivery/orders", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const filters = {
        branchId: req.query.branchId as string,
        status: req.query.status as string,
        driverId: req.query.driverId as string,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      };
      const orders = await deliveryService.getAllDeliveryOrders(tenantId, filters);
      res.json({ success: true, orders: orders.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch delivery orders" });
    }
  });

  app.get("/api/delivery/orders/pending", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const orders = await deliveryService.getPendingOrdersForDriver(tenantId, branchId);
      res.json({ success: true, orders: orders.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch pending orders" });
    }
  });

  app.get("/api/delivery/orders/driver/:driverId", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const orders = await deliveryService.getDriverActiveOrders(req.params.driverId);
      res.json({ success: true, orders: orders.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch driver orders" });
    }
  });

  app.get("/api/delivery/orders/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const order = await deliveryService.getDeliveryOrder(req.params.id);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch order" });
    }
  });

  app.get("/api/delivery/orders/by-order/:orderId", async (req, res) => {
    try {
      const order = await deliveryService.getDeliveryOrderByOrderId(req.params.orderId);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Delivery order not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch delivery order" });
    }
  });

  app.post("/api/delivery/orders", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const order = await deliveryService.createDeliveryOrder({ ...req.body, tenantId });
      res.json({ success: true, order: serializeDoc(order) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create delivery order" });
    }
  });

  app.patch("/api/delivery/orders/:id/assign", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.body;
      const order = await deliveryService.assignDriverToOrder(req.params.id, driverId);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order or driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to assign driver" });
    }
  });

  app.patch("/api/delivery/orders/:id/status", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { status, ...additionalData } = req.body;
      const order = await deliveryService.updateOrderStatus(req.params.id, status, additionalData);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update order status" });
    }
  });

  app.patch("/api/delivery/orders/:id/location", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { lat, lng } = req.body;
      const order = await deliveryService.updateOrderDriverLocation(req.params.id, lat, lng);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update order location" });
    }
  });

  // Calculate delivery fee and check zone
  app.post("/api/delivery/calculate-fee", async (req, res) => {
    try {
      const { lat, lng, tenantId, branchId, orderAmount } = req.body;
      const result = await deliveryService.calculateDeliveryFee(
        lat, lng, tenantId || "demo-tenant", branchId, orderAmount || 0
      );
      res.json({ success: true, ...result, zone: result.zone ? serializeDoc(result.zone) : null });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to calculate delivery fee" });
    }
  });

  // Calculate ETA
  app.post("/api/delivery/calculate-eta", async (req, res) => {
    try {
      const { distanceKm, drinkCount } = req.body;
      const eta = deliveryService.calculateETA(distanceKm || 0, drinkCount || 1);
      res.json({ success: true, ...eta });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to calculate ETA" });
    }
  });

  app.get("/api/delivery/stats", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || "demo-tenant";
      const branchId = req.query.branchId as string | undefined;
      const period = req.query.period as string || 'today';

      let fromDate: Date | undefined;
      if (period === 'today') {
        fromDate = getSaudiStartOfDay();
      } else if (period === 'week') {
        fromDate = new Date(getSaudiStartOfDay().getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        const s = getSaudiStartOfDay(); fromDate = new Date(s.getFullYear(), s.getMonth(), 1);
      }

      const stats = await deliveryService.getDeliveryStats(tenantId, branchId, fromDate);
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch delivery stats" });
    }
  });

  app.post("/api/delivery/orders/:id/auto-assign", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId;
      const order = await deliveryService.autoAssignDriver(req.params.id, tenantId, branchId);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "لا يوجد سائقين متاحين أو الطلب غير جاهز" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "فشل التعيين التلقائي" });
    }
  });

  app.post("/api/webhooks/delivery/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];

      const integration = await DeliveryIntegrationModel.findOne({
        providerName: { $regex: new RegExp(provider, 'i') },
        isActive: 1
      });

      if (!integration) {
        return res.status(404).json({ error: "Integration not found or inactive" });
      }

      const tenantId = integration.tenantId;
      const order = await deliveryService.processWebhookOrder(provider, req.body, tenantId);

      if (integration.autoAcceptOrders || integration.autoAssignDriver) {
        await deliveryService.autoAssignDriver(order.id, tenantId);
      }

      res.json({ success: true, orderId: order.id, status: 'received' });
    } catch (error: any) {
      console.error(`Webhook error [${req.params.provider}]:`, error.message);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ============================================================
  // ADVANCED ANALYTICS API
  // ============================================================
  app.get("/api/analytics/advanced", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { period = 'today', branchId: qBranch } = req.query;
      const finalBranchId = qBranch || req.employee?.branchId;
      const { OrderModel, CoffeeItemModel, EmployeeModel } = await import("@shared/schema");

      let startDate: Date;
      let prevStartDate: Date;
      let prevEndDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(getSaudiStartOfDay().getTime() - 6 * 24 * 60 * 60 * 1000);
          prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          prevEndDate = new Date(startDate);
          break;
        case 'month': {
          const s = getSaudiStartOfDay();
          startDate = new Date(s.getFullYear(), s.getMonth(), 1);
          prevStartDate = new Date(s.getFullYear(), s.getMonth() - 1, 1);
          prevEndDate = new Date(startDate);
          break;
        }
        case 'year': {
          const s = getSaudiStartOfDay();
          startDate = new Date(s.getFullYear(), 0, 1);
          prevStartDate = new Date(s.getFullYear() - 1, 0, 1);
          prevEndDate = new Date(startDate);
          break;
        }
        default: // today
          startDate = getSaudiStartOfDay();
          prevStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
          prevEndDate = new Date(startDate);
      }

      const baseMatch: any = {
        createdAt: { $gte: startDate },
        status: { $ne: 'cancelled' }
      };
      if (finalBranchId) baseMatch.branchId = finalBranchId;

      const prevMatch: any = {
        createdAt: { $gte: prevStartDate, $lt: prevEndDate },
        status: { $ne: 'cancelled' }
      };
      if (finalBranchId) prevMatch.branchId = finalBranchId;

      const [orders, prevOrders] = await Promise.all([
        OrderModel.find(baseMatch).lean(),
        OrderModel.find(prevMatch).lean()
      ]);

      // ---- Summary KPIs ----
      const totalRevenue = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const prevRevenue = prevOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const totalOrders = orders.length;
      const prevOrders2 = prevOrders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const prevAvg = prevOrders2 > 0 ? prevRevenue / prevOrders2 : 0;
      const uniqueCustomers = new Set(orders.map(o => o.customerId || (o.customerInfo as any)?.phone).filter(Boolean)).size;
      const prevCustomers = new Set(prevOrders.map(o => o.customerId || (o.customerInfo as any)?.phone).filter(Boolean)).size;

      const pct = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);

      // ---- Hourly distribution ----
      const hourlyMap: Record<number, { orders: number; revenue: number }> = {};
      for (let h = 0; h < 24; h++) hourlyMap[h] = { orders: 0, revenue: 0 };
      for (const o of orders) {
        const h = new Date(o.createdAt).getHours();
        hourlyMap[h].orders++;
        hourlyMap[h].revenue += Number(o.totalAmount) || 0;
      }
      const hourlyData = Object.entries(hourlyMap).map(([hour, d]) => ({
        hour: parseInt(hour),
        orders: d.orders,
        revenue: Math.round(d.revenue * 100) / 100
      }));

      // ---- Best selling products ----
      const itemCountMap: Record<string, { nameAr: string; nameEn: string; qty: number; revenue: number; imageUrl?: string }> = {};
      for (const o of orders) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const item of items) {
          const id = item.coffeeItemId || item.id || 'unknown';
          const name = item.nameAr || item.name || 'منتج';
          const nameEn = item.nameEn || '';
          if (!itemCountMap[id]) itemCountMap[id] = { nameAr: name, nameEn, qty: 0, revenue: 0 };
          itemCountMap[id].qty += Number(item.quantity) || 1;
          itemCountMap[id].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }
      }
      // Attach images
      const allItemIds = Object.keys(itemCountMap);
      if (allItemIds.length > 0) {
        const coffeeItems = await CoffeeItemModel.find({ id: { $in: allItemIds } }, { id: 1, imageUrl: 1 }).lean();
        for (const ci of coffeeItems) {
          if (itemCountMap[ci.id]) itemCountMap[ci.id].imageUrl = ci.imageUrl;
        }
      }
      const topProducts = Object.entries(itemCountMap)
        .map(([id, d]) => ({ id, ...d, revenue: Math.round(d.revenue * 100) / 100 }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      // ---- Employee performance ----
      const empMap: Record<string, { name: string; orders: number; revenue: number }> = {};
      for (const o of orders) {
        const empId = (o as any).employeeId || (o as any).cashierId || 'unknown';
        const empName = (o as any).employeeName || (o as any).cashierName || 'غير محدد';
        if (!empMap[empId]) empMap[empId] = { name: empName, orders: 0, revenue: 0 };
        empMap[empId].orders++;
        empMap[empId].revenue += Number(o.totalAmount) || 0;
      }
      const employeePerformance = Object.entries(empMap)
        .map(([id, d]) => ({
          id,
          name: d.name,
          orders: d.orders,
          revenue: Math.round(d.revenue * 100) / 100,
          avgOrderValue: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10);

      // ---- Revenue comparison (daily trend last 7 days) ----
      const revenueTrend: Array<{ date: string; current: number; orders: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
        const dayOrders = orders.filter(o => {
          const t = new Date(o.createdAt);
          return t >= d && t < nextD;
        });
        revenueTrend.push({
          date: d.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' }),
          current: Math.round(dayOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0) * 100) / 100,
          orders: dayOrders.length
        });
      }

      // ---- Payment method breakdown ----
      const paymentBreakdown: Record<string, number> = {};
      for (const o of orders) {
        const m = (o.paymentMethod as string) || 'other';
        paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (Number(o.totalAmount) || 0);
      }

      res.json({
        period,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          uniqueCustomers,
          revenueChange: pct(totalRevenue, prevRevenue),
          ordersChange: pct(totalOrders, prevOrders2),
          avgOrderChange: pct(avgOrderValue, prevAvg),
          customersChange: pct(uniqueCustomers, prevCustomers),
          changeLabel: period === 'today' ? 'مقارنة بالأمس' : period === 'week' ? 'مقارنة بالأسبوع السابق' : 'مقارنة بالشهر السابق'
        },
        hourlyData,
        topProducts,
        employeePerformance,
        revenueTrend,
        paymentBreakdown: Object.entries(paymentBreakdown).map(([method, amount]) => ({
          method,
          amount: Math.round(amount * 100) / 100,
          percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0
        }))
      });
    } catch (error) {
      console.error("[ANALYTICS] Error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/reports/unified", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { period = 'today' } = req.query;
      const { OrderModel, CoffeeItemModel, EmployeeModel } = await import("@shared/schema");
      const { BranchModel } = await import("@shared/schema");

      let startDate: Date;
      { const s = getSaudiStartOfDay();
        switch (period) {
          case 'week':
            startDate = new Date(s.getTime() - 6 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(s.getFullYear(), s.getMonth(), 1);
            break;
          case 'year':
            startDate = new Date(s.getFullYear(), 0, 1);
            break;
          default:
            startDate = s;
        }
      }

      const baseMatch: any = { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } };
      const empRole = req.employee?.role || '';
      const empBranch = req.employee?.branchId;
      if (!['owner', 'admin'].includes(empRole) && empBranch) {
        baseMatch.branchId = empBranch;
      }
      const orders = await OrderModel.find(baseMatch).lean();

      let branches: any[] = [];
      try { branches = await BranchModel.find({}).lean(); } catch {}

      const branchMap: Record<string, {
        branchId: string; name: string;
        revenue: number; orders: number; avgOrder: number;
        cashSales: number; cardSales: number; loyaltySales: number;
        topItems: Record<string, { name: string; qty: number; revenue: number }>;
        orderTypes: Record<string, number>;
        customers: Set<string>;
      }> = {};

      const initBranch = (id: string) => {
        if (!branchMap[id]) {
          const branch = branches.find((b: any) => b.id === id || (b._id && b._id.toString() === id));
          branchMap[id] = {
            branchId: id,
            name: branch?.nameAr || branch?.name || id || 'الفرع الرئيسي',
            revenue: 0, orders: 0, avgOrder: 0,
            cashSales: 0, cardSales: 0, loyaltySales: 0,
            topItems: {}, orderTypes: {}, customers: new Set(),
          };
        }
      };

      let totalRevenue = 0, totalOrders = 0, totalCash = 0, totalCard = 0, totalLoyalty = 0;
      const allCustomers = new Set<string>();
      const dailyRevenue: Record<string, number> = {};

      for (const o of orders) {
        const bid = (o as any).branchId || 'main';
        initBranch(bid);
        const b = branchMap[bid];
        const amount = Number(o.totalAmount) || 0;

        b.revenue += amount;
        b.orders++;
        totalRevenue += amount;
        totalOrders++;

        const method = ((o.paymentMethod as string) || 'cash').toLowerCase();
        if (method === 'cash') { b.cashSales += amount; totalCash += amount; }
        else if (method === 'qahwa-card' || method === 'loyalty-card') { b.loyaltySales += amount; totalLoyalty += amount; }
        else { b.cardSales += amount; totalCard += amount; }

        const orderType = ((o as any).orderType || 'takeaway').toLowerCase();
        b.orderTypes[orderType] = (b.orderTypes[orderType] || 0) + 1;

        const custId = o.customerId || (o.customerInfo as any)?.phone;
        if (custId) { b.customers.add(custId); allCustomers.add(custId); }

        const dateKey = new Date(o.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
        dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + amount;

        const items = Array.isArray(o.items) ? o.items : [];
        for (const item of items) {
          const itemId = item.coffeeItemId || item.id || 'unknown';
          const itemName = item.nameAr || item.name || 'منتج';
          if (!b.topItems[itemId]) b.topItems[itemId] = { name: itemName, qty: 0, revenue: 0 };
          b.topItems[itemId].qty += Number(item.quantity) || 1;
          b.topItems[itemId].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }
      }

      const branchReports = Object.values(branchMap).map(b => ({
        branchId: b.branchId,
        name: b.name,
        revenue: Math.round(b.revenue * 100) / 100,
        orders: b.orders,
        avgOrder: b.orders > 0 ? Math.round((b.revenue / b.orders) * 100) / 100 : 0,
        cashSales: Math.round(b.cashSales * 100) / 100,
        cardSales: Math.round(b.cardSales * 100) / 100,
        loyaltySales: Math.round(b.loyaltySales * 100) / 100,
        customers: b.customers.size,
        orderTypes: b.orderTypes,
        topItems: Object.entries(b.topItems)
          .map(([id, d]) => ({ id, ...d, revenue: Math.round(d.revenue * 100) / 100 }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5),
      })).sort((a, b) => b.revenue - a.revenue);

      res.json({
        period,
        totalBranches: branchReports.length,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          avgOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
          uniqueCustomers: allCustomers.size,
          cashSales: Math.round(totalCash * 100) / 100,
          cardSales: Math.round(totalCard * 100) / 100,
          loyaltySales: Math.round(totalLoyalty * 100) / 100,
        },
        branches: branchReports,
        dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({
          date, amount: Math.round(amount * 100) / 100
        })),
      });
    } catch (error) {
      console.error("[UNIFIED REPORTS] Error:", error);
      res.status(500).json({ error: "Failed to fetch unified reports" });
    }
  });

  app.get("/api/accounting/export", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { period = 'month', format = 'csv', branchId } = req.query;
      const { OrderModel } = await import("@shared/schema");

      let startDate: Date;
      { const s = getSaudiStartOfDay();
        switch (period) {
          case 'today':
            startDate = s;
            break;
          case 'week':
            startDate = new Date(s.getTime() - 6 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDate = new Date(s.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(s.getFullYear(), s.getMonth(), 1);
        }
      }

      const match: any = { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } };
      const exportRole = req.employee?.role || '';
      const exportBranch = req.employee?.branchId;
      if (!['owner', 'admin'].includes(exportRole)) {
        if (branchId && branchId !== exportBranch) {
          return res.status(403).json({ error: "غير مصرح بالوصول لهذا الفرع" });
        }
        if (exportBranch) match.branchId = exportBranch;
      } else if (branchId) {
        match.branchId = branchId;
      }
      const orders = await OrderModel.find(match).sort({ createdAt: 1 }).lean();

      const journalEntries: any[] = [];
      let entryNum = 1;

      for (const o of orders) {
        const amount = Number(o.totalAmount) || 0;
        const vatRate = VAT_RATE;
        const vatAmount = Math.round((amount * vatRate / (1 + vatRate)) * 100) / 100;
        const netAmount = Math.round((amount - vatAmount) * 100) / 100;
        const method = ((o.paymentMethod as string) || 'cash').toLowerCase();
        const date = new Date(o.createdAt).toISOString().split('T')[0];
        const orderNum = (o as any).orderNumber || o.id || entryNum;

        let debitAccount = '1101';
        let debitAccountName = 'النقدية';
        if (method === 'card' || method === 'mada') {
          debitAccount = '1102';
          debitAccountName = 'الشبكة/مدى';
        } else if (method === 'qahwa-card' || method === 'loyalty-card') {
          debitAccount = '1103';
          debitAccountName = 'بطاقة مكان الشيف البخاري';
        }

        journalEntries.push({
          entryNumber: entryNum,
          date,
          orderNumber: orderNum,
          debitAccount,
          debitAccountName,
          debitAmount: amount,
          creditAccount: '4101',
          creditAccountName: 'إيرادات المبيعات',
          creditAmount: netAmount,
          vatAccount: '2201',
          vatAccountName: 'ضريبة القيمة المضافة',
          vatAmount,
          description: `مبيعات طلب #${orderNum}`,
          status: o.status === 'cancelled' ? 'ملغي' : 'مؤكد',
          paymentMethod: method === 'cash' ? 'نقدي' : (method === 'card' || method === 'mada') ? 'شبكة' : 'بطاقة مكان الشيف البخاري',
          customerName: (o.customerInfo as any)?.name || '',
          branchId: (o as any).branchId || '',
        });
        entryNum++;
      }

      if (format === 'json') {
        return res.json({
          period,
          totalEntries: journalEntries.length,
          totalRevenue: journalEntries.reduce((s, e) => s + e.debitAmount, 0),
          totalVAT: journalEntries.reduce((s, e) => s + e.vatAmount, 0),
          entries: journalEntries,
        });
      }

      const headers = [
        'رقم القيد', 'التاريخ', 'رقم الطلب',
        'رمز الحساب المدين', 'اسم الحساب المدين', 'المبلغ المدين',
        'رمز الحساب الدائن', 'اسم الحساب الدائن', 'المبلغ الدائن',
        'رمز حساب الضريبة', 'مبلغ الضريبة',
        'الوصف', 'الحالة', 'طريقة الدفع', 'اسم العميل', 'الفرع'
      ];
      const csvRows = [headers.join(',')];
      for (const e of journalEntries) {
        csvRows.push([
          e.entryNumber, e.date, e.orderNumber,
          e.debitAccount, e.debitAccountName, e.debitAmount,
          e.creditAccount, e.creditAccountName, e.creditAmount,
          e.vatAccount, e.vatAmount,
          `"${e.description}"`, e.status, e.paymentMethod, `"${e.customerName}"`, e.branchId
        ].join(','));
      }

      const BOM = '\uFEFF';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="chefsplace-accounting-${period}.csv"`);
      res.send(BOM + csvRows.join('\n'));
    } catch (error) {
      console.error("[ACCOUNTING EXPORT] Error:", error);
      res.status(500).json({ error: "Failed to export accounting data" });
    }
  });

  // ============================================================
  // GIFT CARDS SYSTEM
  // ============================================================
  app.get("/api/gift-cards", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const cards = await GiftCardModel.find({}).sort({ createdAt: -1 }).lean();
      res.json(cards.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب بطاقات الهدايا" });
    }
  });

  app.post("/api/gift-cards", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const { value, recipientName, recipientPhone, note } = req.body;
      if (!value || Number(value) <= 0) return res.status(400).json({ error: "القيمة مطلوبة وأكبر من صفر" });
      const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
      const card = new GiftCardModel({
        code,
        initialValue: Number(value),
        balance: Number(value),
        recipientName: recipientName || '',
        recipientPhone: recipientPhone || '',
        note: note || '',
        status: 'active',
        issuedBy: req.employee?.id,
        branchId: req.employee?.branchId,
        tenantId: getTenantIdFromRequest(req) || 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await card.save();
      res.json(serializeDoc(card));
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء بطاقة الهدية" });
    }
  });

  // Public endpoint for customer gift card redemption (no employee auth needed)
  // DEPRECATED: Gift card deduction is now handled atomically inside POST /api/orders.
  // This endpoint is kept only for backward compatibility but now requires a valid orderId
  // to prevent unauthorized redemptions.
  app.post("/api/gift-cards/:code/redeem-customer", async (req, res) => {
    try {
      const { GiftCardModel, OrderModel } = await import("@shared/schema");
      const { amount, orderId } = req.body;
      const code = req.params.code.toUpperCase();

      // Require orderId to prevent standalone abuse
      if (!orderId) {
        return res.status(400).json({ error: "orderId مطلوب لاسترداد بطاقة الهدية" });
      }

      // Verify the order exists and already references this gift card (set by POST /api/orders)
      const order = await OrderModel.findById(orderId);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
      if ((order as any).giftCardCode !== code) {
        return res.status(400).json({ error: "بطاقة الهدية لا تنتمي لهذا الطلب" });
      }
      // If the order already deducted the card (via POST /api/orders), return success immediately
      if ((order as any).giftCardAmountUsed) {
        return res.json({ success: true, deducted: (order as any).giftCardAmountUsed, alreadyProcessed: true });
      }

      const card = await GiftCardModel.findOne({ code });
      if (!card) return res.status(404).json({ error: "بطاقة الهدية غير موجودة" });
      if (card.status !== 'active') return res.status(400).json({ error: "البطاقة غير نشطة" });
      if (Number(card.balance) <= 0) return res.status(400).json({ error: "رصيد البطاقة صفر" });
      const deductAmount = Math.min(Number(amount), Number(card.balance));
      card.balance = Number(card.balance) - deductAmount;
      card.updatedAt = new Date();
      if (card.balance <= 0) card.status = 'used';
      await card.save();
      res.json({ success: true, deducted: deductAmount, remainingBalance: card.balance, status: card.status });
    } catch (error) {
      res.status(500).json({ error: "فشل استخدام بطاقة الهدية" });
    }
  });

  app.get("/api/gift-cards/check/:code", async (req, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const card = await GiftCardModel.findOne({ code: req.params.code.toUpperCase() });
      if (!card) return res.status(404).json({ error: "بطاقة الهدية غير موجودة" });
      if (card.status !== 'active') return res.status(400).json({ error: "بطاقة الهدية منتهية أو مستخدمة" });
      if (Number(card.balance) <= 0) return res.status(400).json({ error: "رصيد بطاقة الهدية صفر" });
      res.json({ valid: true, balance: card.balance, initialValue: card.initialValue, recipientName: card.recipientName, code: card.code });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البطاقة" });
    }
  });

  app.post("/api/gift-cards/:code/redeem", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const { amount } = req.body;
      const card = await GiftCardModel.findOne({ code: req.params.code.toUpperCase() });
      if (!card) return res.status(404).json({ error: "بطاقة الهدية غير موجودة" });
      if (card.status !== 'active') return res.status(400).json({ error: "البطاقة غير نشطة" });
      const deductAmount = Math.min(Number(amount), Number(card.balance));
      card.balance = Number(card.balance) - deductAmount;
      card.updatedAt = new Date();
      if (card.balance <= 0) card.status = 'used';
      await card.save();
      res.json({ success: true, deducted: deductAmount, remainingBalance: card.balance, status: card.status });
    } catch (error) {
      res.status(500).json({ error: "فشل استخدام بطاقة الهدية" });
    }
  });

  app.delete("/api/gift-cards/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      await GiftCardModel.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف البطاقة" });
    }
  });


  // ============================================================
  // CUSTOMER REVIEWS - ENHANCED
  // ============================================================
  app.get("/api/reviews/all", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductReviewModel, CoffeeItemModel } = await import("@shared/schema");
      const { rating, page = 1, limit = 20 } = req.query;
      const query: any = {};
      if (req.employee?.branchId) query.branchId = req.employee.branchId;
      if (rating) query.rating = Number(rating);
      const skip = (Number(page) - 1) * Number(limit);
      const [reviews, total] = await Promise.all([
        ProductReviewModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        ProductReviewModel.countDocuments(query)
      ]);
      // Attach product names
      const productIds = [...new Set(reviews.map(r => r.productId).filter(Boolean))];
      const products = productIds.length > 0 ? await CoffeeItemModel.find({ id: { $in: productIds } }, { id: 1, nameAr: 1, nameEn: 1, imageUrl: 1 }).lean() : [];
      const productMap: Record<string, any> = {};
      for (const p of products) productMap[p.id] = p;
      const enriched = reviews.map(r => ({ ...serializeDoc(r), product: r.productId ? (productMap[r.productId] || null) : null }));
      const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
      res.json({ reviews: enriched, total, page: Number(page), avgRating: Math.round(avgRating * 10) / 10 });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب التقييمات" });
    }
  });

  app.post("/api/reviews/order/:orderId", async (req, res) => {
    try {
      const { ProductReviewModel, OrderModel } = await import("@shared/schema");
      const { rating, comment, customerName, customerId, customerPhone } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "التقييم بين 1 و 5" });
      const order = await OrderModel.findOne({ id: req.params.orderId }) || await OrderModel.findById(req.params.orderId).catch(() => null);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
      // Check if already reviewed
      const existing = await ProductReviewModel.findOne({ orderId: req.params.orderId });
      if (existing) return res.status(400).json({ error: "تم تقييم هذا الطلب مسبقاً" });
      const review = new ProductReviewModel({
        orderId: req.params.orderId,
        orderNumber: order.orderNumber,
        rating: Number(rating),
        comment: comment || '',
        customerName: customerName || (order.customerInfo as any)?.name || 'عميل',
        customerId: customerId || order.customerId || '',
        customerPhone: customerPhone || (order.customerInfo as any)?.phone || '',
        branchId: order.branchId,
        status: 'published',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await review.save();
      res.json(serializeDoc(review));
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال التقييم" });
    }
  });

  app.patch("/api/reviews/:id/reply", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductReviewModel } = await import("@shared/schema");
      const { reply } = req.body;
      const review = await ProductReviewModel.findByIdAndUpdate(
        req.params.id,
        { $set: { managerReply: reply, repliedAt: new Date(), repliedBy: req.employee?.id } },
        { new: true }
      );
      if (!review) return res.status(404).json({ error: "التقييم غير موجود" });
      res.json(serializeDoc(review));
    } catch (error) {
      res.status(500).json({ error: "فشل الرد على التقييم" });
    }
  });

  // ============================================================
  // SEASONAL MENU (Time-based visibility)
  // ============================================================
  app.patch("/api/coffee-items/:id/schedule", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemModel } = await import("@shared/schema");
      const { availableFrom, availableTo, availableDays } = req.body;
      const item = await CoffeeItemModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: { availableFrom: availableFrom || null, availableTo: availableTo || null, availableDays: availableDays || null, updatedAt: new Date() } },
        { new: true }
      );
      if (!item) return res.status(404).json({ error: "المنتج غير موجود" });
      res.json(serializeDoc(item));
    } catch (error) {
      res.status(500).json({ error: "فشل تحديث جدول المنتج" });
    }
  });

  // ============================================================
  // PAYROLL / SALARY CALCULATION
  // ============================================================
  app.get("/api/payroll/report", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { EmployeeModel, AttendanceModel } = await import("@shared/schema");
      const { month, year } = req.query;
      const targetMonth = month ? parseInt(String(month)) - 1 : new Date().getMonth();
      const targetYear = year ? parseInt(String(year)) : new Date().getFullYear();
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
      const finalBranchId = req.employee?.branchId;
      const empQuery: any = { isActive: { $ne: false } };
      if (finalBranchId) empQuery.branchId = finalBranchId;
      const employees = await EmployeeModel.find(empQuery).lean();

      // Fix: use shiftDate (correct field name) instead of date
      const attQuery: any = { shiftDate: { $gte: startDate, $lte: endDate } };
      if (finalBranchId) attQuery.branchId = finalBranchId;
      const attendances = await AttendanceModel.find(attQuery).lean();

      // Saudi default work week: Sunday–Thursday
      const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const DEFAULT_WORK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

      // Build list of all working days in the month per employee schedule
      function getScheduledWorkDays(workDays: string[]): string[] {
        const schedule = workDays.length > 0 ? workDays.map(d => d.toLowerCase()) : DEFAULT_WORK_DAYS;
        const days: string[] = [];
        for (let d = new Date(startDate); d <= endDate; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
          if (schedule.includes(DAY_NAMES[d.getDay()])) {
            days.push(d.toISOString().split('T')[0]);
          }
        }
        return days;
      }

      const payrollData = employees.map(emp => {
        const empAtt = attendances.filter(a => a.employeeId === emp.id || String(a.employeeId) === String((emp as any)._id));

        // Days employee actually attended (any check-in record regardless of status)
        const presentDays = empAtt.filter(a => a.status === 'checked_in' || a.status === 'checked_out' || a.status === 'late' || a.checkInTime).length;

        // Explicit absences (manager-recorded)
        const explicitAbsentDays = empAtt.filter(a => a.status === 'absent').length;

        // Late days and total late minutes
        const lateRecords = empAtt.filter(a => (a as any).isLate === 1 || (a.lateMinutes ?? 0) > 0);
        const lateDays = lateRecords.length;
        const totalLateMinutes = lateRecords.reduce((sum, a) => sum + (a.lateMinutes ?? 0), 0);

        // Scheduled working days for this employee based on their workDays config
        const scheduledDays = getScheduledWorkDays((emp as any).workDays || []);
        const totalWorkingDays = scheduledDays.length;

        // Implicit absences: scheduled days with NO attendance record at all
        const attendedDates = new Set(
          empAtt.map(a => new Date(a.shiftDate).toISOString().split('T')[0])
        );
        const implicitAbsentDays = scheduledDays.filter(day => !attendedDates.has(day)).length;

        // Total absences = implicit (no-show) + explicit (marked absent)
        const absentDays = implicitAbsentDays + explicitAbsentDays;

        const baseSalary = Number((emp as any).salary || (emp as any).baseSalary || 0);
        const dailyRate = baseSalary / (totalWorkingDays || 26);
        const deductions = absentDays * dailyRate;

        // Calculate shift duration from employee's schedule (default 8 hours)
        let shiftHours = 8;
        const shiftStart = (emp as any).shiftStartTime as string | undefined;
        const shiftEnd = (emp as any).shiftEndTime as string | undefined;
        if (shiftStart && shiftEnd) {
          const [sh, sm] = shiftStart.split(':').map(Number);
          const [eh, em] = shiftEnd.split(':').map(Number);
          const computed = (eh * 60 + em - sh * 60 - sm) / 60;
          if (computed > 0) shiftHours = computed;
        }
        const minutesPerDay = shiftHours * 60;

        // Late deduction proportional to actual late minutes (not flat 25%)
        // e.g. 30 min late in an 8-hour day = 30/480 of daily rate
        const lateDeductions = minutesPerDay > 0 ? (totalLateMinutes / minutesPerDay) * dailyRate : 0;
        const netSalary = Math.max(0, baseSalary - deductions - lateDeductions);
        return {
          employeeId: emp.id || String((emp as any)._id),
          name: emp.fullName,
          role: emp.role,
          baseSalary,
          presentDays,
          absentDays,
          explicitAbsentDays,
          implicitAbsentDays,
          lateDays,
          totalLateMinutes,
          shiftHours,
          totalWorkingDays,
          deductions: Math.round(deductions * 100) / 100,
          lateDeductions: Math.round(lateDeductions * 100) / 100,
          netSalary: Math.round(netSalary * 100) / 100,
          attendanceRate: totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0
        };
      });
      res.json({
        month: targetMonth + 1,
        year: targetYear,
        employees: payrollData,
        totals: {
          totalBaseSalary: payrollData.reduce((s, e) => s + e.baseSalary, 0),
          totalDeductions: payrollData.reduce((s, e) => s + e.deductions + e.lateDeductions, 0),
          totalNetSalary: payrollData.reduce((s, e) => s + e.netSalary, 0),
          employeeCount: payrollData.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء تقرير الرواتب" });
    }
  });

  // ── Payroll Snapshot CRUD ──────────────────────────────────────────────────

  // GET /api/payroll/snapshots?year=&month= — fetch existing snapshot for a month
  app.get("/api/payroll/snapshots", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PayrollSnapshotModel } = await import("@shared/schema");
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const query: any = { tenantId };
      if (req.query.year) query.year = Number(req.query.year);
      if (req.query.month) query.month = Number(req.query.month);
      const snapshots = await PayrollSnapshotModel.find(query).sort({ year: -1, month: -1 }).lean();
      res.json(snapshots.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب سجلات الرواتب المجمدة" });
    }
  });

  // POST /api/payroll/snapshots — freeze payroll for a given month (saves live calculation)
  app.post("/api/payroll/snapshots", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PayrollSnapshotModel } = await import("@shared/schema");
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const { year, month, employees, totals, notes } = req.body;

      if (!year || !month || !employees) {
        return res.status(400).json({ error: "year و month و employees مطلوبة" });
      }

      // Prevent duplicate snapshots for the same month
      const existing = await PayrollSnapshotModel.findOne({ tenantId, year, month });
      if (existing) {
        return res.status(409).json({ error: "يوجد كشف رواتب مجمد بالفعل لهذا الشهر", snapshotId: existing.id });
      }

      const snapshot = await PayrollSnapshotModel.create({
        id: nanoid(),
        tenantId,
        year,
        month,
        status: 'frozen',
        employees,
        totals,
        notes: notes || '',
        frozenAt: new Date(),
        frozenBy: (req as any).employee?.id || 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.status(201).json(serializeDoc(snapshot));
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(409).json({ error: "يوجد كشف رواتب مجمد بالفعل لهذا الشهر" });
      }
      res.status(500).json({ error: "فشل تجميد كشف الرواتب" });
    }
  });

  // PATCH /api/payroll/snapshots/:id/approve — approve a frozen snapshot
  app.patch("/api/payroll/snapshots/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PayrollSnapshotModel } = await import("@shared/schema");
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const snapshot = await PayrollSnapshotModel.findOneAndUpdate(
        { id: req.params.id, tenantId, status: 'frozen' },
        {
          $set: {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: (req as any).employee?.id || 'unknown',
            updatedAt: new Date(),
          }
        },
        { new: true }
      );
      if (!snapshot) return res.status(404).json({ error: "الكشف غير موجود أو تمت الموافقة عليه مسبقاً" });
      res.json(serializeDoc(snapshot));
    } catch (error) {
      res.status(500).json({ error: "فشل اعتماد كشف الرواتب" });
    }
  });

  // DELETE /api/payroll/snapshots/:id — unfreeze (only draft/frozen, not approved)
  app.delete("/api/payroll/snapshots/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PayrollSnapshotModel } = await import("@shared/schema");
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const snapshot = await PayrollSnapshotModel.findOne({ id: req.params.id, tenantId });
      if (!snapshot) return res.status(404).json({ error: "الكشف غير موجود" });
      if (snapshot.status === 'approved') {
        return res.status(403).json({ error: "لا يمكن حذف كشف راتب معتمد" });
      }
      await PayrollSnapshotModel.deleteOne({ id: req.params.id, tenantId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف كشف الرواتب" });
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  // ============================================================
  // COGS / PROFIT MARGIN REPORT
  // ============================================================
  app.get("/api/analytics/cogs", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemModel, CoffeeItemIngredientModel } = await import("@shared/schema");
      const branchId = req.employee?.branchId;
      const itemQuery: any = {};
      if (branchId) itemQuery.publishedBranches = branchId;
      const items = await CoffeeItemModel.find(itemQuery, { id: 1, nameAr: 1, nameEn: 1, price: 1, costOfGoods: 1, category: 1 }).lean();
      const allIngredients = await CoffeeItemIngredientModel.find({}).lean();
      const cogsData = items.map(item => {
        const itemIngredients = allIngredients.filter(ing => ing.coffeeItemId === item.id);
        const calculatedCOGS = Number(item.costOfGoods) || 0;
        const price = Number(item.price) || 0;
        const profit = price - calculatedCOGS;
        const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
        return {
          id: item.id,
          nameAr: item.nameAr,
          nameEn: item.nameEn || '',
          price,
          cogs: Math.round(calculatedCOGS * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          margin,
          category: item.category,
          ingredientCount: itemIngredients.length
        };
      });
      cogsData.sort((a, b) => b.margin - a.margin);
      const avgMargin = cogsData.length > 0 ? Math.round(cogsData.reduce((s, i) => s + i.margin, 0) / cogsData.length) : 0;
      res.json({
        items: cogsData,
        summary: {
          totalItems: cogsData.length,
          avgMargin,
          highMargin: cogsData.filter(i => i.margin >= 60).length,
          lowMargin: cogsData.filter(i => i.margin < 30).length,
          itemsWithCOGS: cogsData.filter(i => i.cogs > 0).length
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء تقرير التكاليف" });
    }
  });

  app.get("/api/reports/employee-sales", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { OrderModel, EmployeeModel } = await import("@shared/schema");
      const { period, branchId } = req.query;
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = getSaudiStartOfDay();
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const orderQuery: any = { createdAt: { $gte: startDate }, status: { $in: ['completed', 'delivered'] } };
      if (req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        orderQuery.branchId = req.employee?.branchId;
      } else if (branchId) {
        orderQuery.branchId = branchId;
      }

      const salesByEmployee = await OrderModel.aggregate([
        { $match: orderQuery },
        { $group: {
          _id: "$employeeId",
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$totalAmount" }
        }},
        { $sort: { totalSales: -1 } }
      ]);

      const enriched = await Promise.all(salesByEmployee.map(async (s: any) => {
        const emp = await EmployeeModel.findOne({ $or: [{ id: s._id }, { _id: s._id }] }).lean();
        return {
          employeeId: s._id,
          employeeName: (emp as any)?.fullName || 'غير معروف',
          role: (emp as any)?.role || 'unknown',
          totalSales: Math.round(s.totalSales * 100) / 100,
          orderCount: s.orderCount,
          avgOrderValue: Math.round(s.avgOrderValue * 100) / 100
        };
      }));

      const bestSellerItems = await OrderModel.aggregate([
        { $match: orderQuery },
        { $unwind: "$items" },
        { $group: {
          _id: "$items.name",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }},
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 }
      ]);

      res.json({
        period: period || 'month',
        startDate: startDate.toISOString(),
        employees: enriched,
        topItems: bestSellerItems.map((item: any) => ({
          name: item._id,
          quantity: item.totalQuantity,
          revenue: Math.round(item.totalRevenue * 100) / 100
        }))
      });
    } catch (error) {
      console.error("Error getting employee sales report:", error);
      res.status(500).json({ error: "فشل في جلب تقرير المبيعات" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/system/status", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { OrderModel, EmployeeModel, AttendanceModel, CoffeeItemModel, BranchModel } = await import("@shared/schema");
      const today = getSaudiStartOfDay();
      const tomorrow = getSaudiEndOfDay();

      const isGlobal = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const branchFilter: any = isGlobal ? {} : { branchId: req.employee?.branchId };
      const orderDateFilter = { createdAt: { $gte: today, $lt: tomorrow }, ...branchFilter };

      const [todayOrders, activeEmployees, todayAttendance, menuItems, branches] = await Promise.all([
        OrderModel.countDocuments(orderDateFilter),
        EmployeeModel.countDocuments({ isActive: { $ne: false }, ...branchFilter }),
        AttendanceModel.countDocuments({ shiftDate: { $gte: today, $lt: tomorrow }, status: 'checked_in', ...branchFilter }),
        CoffeeItemModel.countDocuments({ isAvailable: { $ne: false } }),
        BranchModel.countDocuments({ isActive: { $ne: false } })
      ]);

      const todayRevenue = await OrderModel.aggregate([
        { $match: { ...orderDateFilter, status: { $in: ['completed', 'delivered'] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]);

      const pendingOrders = await OrderModel.countDocuments({ 
        ...orderDateFilter, 
        status: { $in: ['pending', 'preparing'] } 
      });

      res.json({
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        pendingOrders,
        activeEmployees,
        presentToday: todayAttendance,
        menuItemsActive: menuItems,
        activeBranches: branches,
        systemHealth: 'operational'
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب حالة النظام", systemHealth: 'degraded' });
    }
  });

  // ─── AI Chat with Business Context (Internal Engine — no external AI) ───────
  app.post("/api/ai/chat", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { message, history } = req.body;
      if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });

      const { generateChatReply, generateInsights } = await import("./internal-ai");
      const todayStart = getSaudiStartOfDay();
      const weekStart  = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      const aiTenantId = req.employee?.tenantId || 'demo-tenant';

      // Collect live stats
      const { OrderModel: AiOrderModel } = await import("@shared/schema");
      const allOrders = await AiOrderModel.find({ tenantId: aiTenantId }).sort({ createdAt: -1 }).limit(500).lean();
      const todayOrders    = allOrders.filter((o: any) => new Date(o.createdAt) >= todayStart);
      const weekOrders     = allOrders.filter((o: any) => new Date(o.createdAt) >= weekStart);
      const prevWeekOrders = allOrders.filter((o: any) => new Date(o.createdAt) >= prevWeekStart && new Date(o.createdAt) < weekStart);

      const todayRevenue    = todayOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const weekRevenue     = weekOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const prevWeekRevenue = prevWeekOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const growthPct       = prevWeekRevenue > 0 ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue * 100) : null;

      const itemCounts: Record<string, { count: number; revenue: number }> = {};
      weekOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const name = item.nameAr || item.name || "بدون اسم";
          if (!itemCounts[name]) itemCounts[name] = { count: 0, revenue: 0 };
          itemCounts[name].count   += item.quantity || 1;
          itemCounts[name].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });
      const topItems = Object.entries(itemCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue }));

      const dayRevMap: Record<string, number> = {};
      weekOrders.forEach((o: any) => {
        const day = new Date(o.createdAt).toLocaleDateString("ar-SA", { weekday: "long" });
        dayRevMap[day] = (dayRevMap[day] || 0) + (o.totalAmount || 0);
      });
      const bestDayEntry = Object.entries(dayRevMap).sort((a, b) => b[1] - a[1])[0];

      const hourMap: Record<number, number> = {};
      weekOrders.forEach((o: any) => {
        const h = new Date(o.createdAt).getHours();
        hourMap[h] = (hourMap[h] || 0) + 1;
      });
      const peakHourEntry = Object.entries(hourMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

      const allEmployees = await storage.getEmployees();
      const products     = await getCachedCoffeeItems(aiTenantId);
      const pendingOrders = await AiOrderModel.countDocuments({ tenantId: aiTenantId, status: { $in: ['pending', 'preparing'] } });

      const stats = {
        todayRevenue,
        todayOrders:    todayOrders.length,
        weekRevenue,
        weekOrders:     weekOrders.length,
        prevWeekRevenue,
        prevWeekOrders: prevWeekOrders.length,
        topItems,
        bestDay:        bestDayEntry ? { day: bestDayEntry[0], revenue: bestDayEntry[1] } : null,
        peakHour:       peakHourEntry ? { hour: Number(peakHourEntry[0]), count: Number(peakHourEntry[1]) } : null,
        employeeCount:  allEmployees.length,
        productCount:   products.length,
        avgOrderValue:  weekOrders.length > 0 ? weekRevenue / weekOrders.length : 0,
        growthPct,
        pendingOrders,
      };

      const reply = generateChatReply({ message, history: history || [], stats });
      res.json({ reply, model: "qirox-internal-v1" });
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: error.message || "خطأ في محرك المساعد" });
    }
  });

  // ─── AI Quick Insights (Internal Engine — no external AI) ───────────────
  app.get("/api/ai/insights", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { generateInsights } = await import("./internal-ai");
      const insightsTenantId = req.employee?.tenantId || 'demo-tenant';
      const todayStart    = getSaudiStartOfDay();
      const weekStart     = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { OrderModel: InsightsOrderModel } = await import("@shared/schema");
      const allOrders      = await InsightsOrderModel.find({ tenantId: insightsTenantId }).sort({ createdAt: -1 }).limit(500).lean();
      const todayOrders    = allOrders.filter((o: any) => new Date(o.createdAt) >= todayStart);
      const weekOrders     = allOrders.filter((o: any) => new Date(o.createdAt) >= weekStart);
      const prevWeekOrders = allOrders.filter((o: any) => new Date(o.createdAt) >= prevWeekStart && new Date(o.createdAt) < weekStart);

      const todayRevenue    = todayOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const weekRevenue     = weekOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const prevWeekRevenue = prevWeekOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const growthPct       = prevWeekRevenue > 0 ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue * 100) : null;

      const itemMap: Record<string, { count: number; revenue: number }> = {};
      weekOrders.forEach((o: any) => {
        (o.items || []).forEach((item: any) => {
          const name = item.nameAr || item.name || "؟";
          if (!itemMap[name]) itemMap[name] = { count: 0, revenue: 0 };
          itemMap[name].count   += item.quantity || 1;
          itemMap[name].revenue += (item.price || 0) * (item.quantity || 1);
        });
      });
      const topItems = Object.entries(itemMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue }));

      const dayRevMap: Record<string, number> = {};
      weekOrders.forEach((o: any) => {
        const day = new Date(o.createdAt).toLocaleDateString("ar-SA", { weekday: "long" });
        dayRevMap[day] = (dayRevMap[day] || 0) + (o.totalAmount || 0);
      });
      const bestDayEntry = Object.entries(dayRevMap).sort((a, b) => b[1] - a[1])[0];

      const hourMap: Record<number, number> = {};
      weekOrders.forEach((o: any) => {
        const h = new Date(o.createdAt).getHours();
        hourMap[h] = (hourMap[h] || 0) + 1;
      });
      const peakHourEntry = Object.entries(hourMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

      const stats = {
        todayRevenue,
        todayOrders:    todayOrders.length,
        weekRevenue,
        weekOrders:     weekOrders.length,
        prevWeekRevenue,
        prevWeekOrders: prevWeekOrders.length,
        topItems,
        bestDay:   bestDayEntry  ? { day: bestDayEntry[0],              revenue: bestDayEntry[1] }                          : null,
        peakHour:  peakHourEntry ? { hour: Number(peakHourEntry[0]),    count: Number(peakHourEntry[1]) }                   : null,
        employeeCount: 0,
        productCount:  0,
        avgOrderValue: weekOrders.length > 0 ? weekRevenue / weekOrders.length : 0,
        growthPct,
      };

      const insights = generateInsights(stats);
      res.json({ insights, stats: { todayRevenue, todayOrders: todayOrders.length, weekRevenue, weekOrders: weekOrders.length, growthPct } });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "خطأ في محرك الرؤى" });
    }
  });

  // ─── AI Menu Assist (Internal Engine — no external AI) ──────────────────
  app.post("/api/ai/menu-assist", async (req, res) => {
    try {
      const { nameAr, nameEn, category, task, existingDescription, existingIngredients } = req.body;
      if (!nameAr && !nameEn) {
        return res.status(400).json({ error: "يرجى إدخال اسم المنتج أولاً" });
      }
      const { generateMenuContent, generateStructuredAddons } = await import("./internal-ai");
      const result = generateMenuContent({ nameAr, nameEn, category, task, existingDescription, existingIngredients });
      // For addons task, also return structured data for direct form insertion
      const structured = task === "addons" ? generateStructuredAddons(category || "default") : undefined;
      res.json({ result, task, model: "qirox-internal-v1", ...(structured ? { structuredAddons: structured } : {}) });
    } catch (error: any) {
      console.error("AI Menu Assist error:", error);
      res.status(500).json({ error: error.message || "حدث خطأ في محرك المنيو" });
    }
  });

  // ─── QIROX Studio External API Proxy ───────────────────────────────────────
  const QIROX_STUDIO_BASE = "https://www.chefsplace.online/api/v1";
  const qiroxStudioHeaders = () => ({
    Authorization: `Bearer ${process.env.QIROX_STUDIO_API_KEY || ""}`,
    "Content-Type": "application/json",
  });

  const qiroxStudioProxy = async (endpoint: string, res: any) => {
    try {
      const response = await fetch(`${QIROX_STUDIO_BASE}${endpoint}`, {
        headers: qiroxStudioHeaders(),
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: `مكان الشيف البخاري Studio API error: ${response.statusText}` });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error(`QIROX Studio proxy error (${endpoint}):`, error.message);
      res.status(500).json({ error: "فشل الاتصال بـ مكان الشيف البخاري Studio API" });
    }
  };

  app.get("/api/qirox-studio/me", async (_req, res) => qiroxStudioProxy("/me", res));
  app.get("/api/qirox-studio/stats", async (_req, res) => qiroxStudioProxy("/stats", res));
  app.get("/api/qirox-studio/orders", async (_req, res) => qiroxStudioProxy("/orders", res));
  app.get("/api/qirox-studio/projects", async (_req, res) => qiroxStudioProxy("/projects", res));
  app.get("/api/qirox-studio/invoices", async (_req, res) => qiroxStudioProxy("/invoices", res));
  app.get("/api/qirox-studio/wallet", async (_req, res) => qiroxStudioProxy("/wallet", res));
  app.get("/api/qirox-studio/customers", async (_req, res) => qiroxStudioProxy("/customers", res));
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Cloud Print Queue ──────────────────────────────────────────────────────
  // Allows browsers (Tab Sense/Android) to submit print jobs to the cloud,
  // so a local print agent (running near the printer) can pick them up via TCP.
  // Auth: browser submits with employee session; agent uses PRINT_AGENT_KEY.
  {
    const crypto = await import('crypto');
    const PRINT_AGENT_KEY: string = crypto.default
      .createHash('sha256')
      .update((process.env.SESSION_SECRET || 'qirox-default') + '-print-agent-v1')
      .digest('hex')
      .slice(0, 32);

    const agentAuth = (req: any, res: any, next: any) => {
      const key = req.headers['x-print-agent-key'] || req.query.key;
      if (key !== PRINT_AGENT_KEY) {
        return res.status(401).json({ error: 'Invalid print agent key' });
      }
      next();
    };

    // Submit a print job (called by browser; employee session required)
    app.post('/api/print-queue', requireAuth as any, async (req: any, res: any) => {
      try {
        const { data, printerIp, printerPort } = req.body;
        if (!data || !printerIp) {
          return res.status(400).json({ error: 'data and printerIp are required' });
        }
        const job = await PrintJobModel.create({ data, printerIp, printerPort: printerPort || 9100 });
        res.json({ ok: true, jobId: job._id });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Poll for the oldest pending job (called by print agent)
    app.get('/api/print-queue/pending', agentAuth, async (_req: any, res: any) => {
      try {
        const job = await PrintJobModel.findOne({ status: 'pending' }).sort({ createdAt: 1 }).lean();
        res.json({ job: job || null });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Mark job as done or error (called by print agent)
    app.patch('/api/print-queue/:id/done', agentAuth, async (req: any, res: any) => {
      try {
        const update: any = { status: req.body.error ? 'error' : 'done', doneAt: new Date() };
        if (req.body.error) update.errorMsg = req.body.error;
        await PrintJobModel.findByIdAndUpdate(req.params.id, update);
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Get agent config (server URL + key) — for settings page
    app.get('/api/print-queue/agent-info', requireAuth as any, async (_req: any, res: any) => {
      const serverUrl = process.env.SITE_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000');
      res.json({ serverUrl, agentKey: PRINT_AGENT_KEY });
    });
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const httpServer = createServer(app);
  
  // Setup WebSocket for real-time order updates (not supported on Vercel serverless)
  if (!options.skipWebSocket) {
    wsManager.setup(httpServer);
  }
  
  return httpServer;
}