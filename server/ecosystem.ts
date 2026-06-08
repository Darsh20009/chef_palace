import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

const KEY_PREFIX_LIVE = "qrx_live_";
const KEY_PREFIX_TEST = "qrx_test_";

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(env: "live" | "test" = "live"): { plain: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const plain = (env === "live" ? KEY_PREFIX_LIVE : KEY_PREFIX_TEST) + random;
  return { plain, prefix: plain.slice(0, 14), hash: hashKey(plain) };
}

export interface ApiKeyRequest extends Request {
  apiKey?: any;
  tenantId?: string;
  apiScopes?: string[];
}

// Middleware: authenticate via Authorization: Bearer qrx_xxx
export function requireApiKey(...requiredScopes: string[]) {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const auth = req.headers.authorization || "";
      const m = auth.match(/^Bearer\s+(qrx_(?:live|test)_[A-Za-z0-9_-]+)/);
      if (!m) return res.status(401).json({ error: "Missing or invalid API key", hint: "Use Authorization: Bearer qrx_live_..." });

      const { ApiKeyModel } = await import("@shared/schema");
      const hash = hashKey(m[1]);
      const key: any = await ApiKeyModel.findOne({ keyHash: hash, isActive: true }).lean();
      if (!key) return res.status(401).json({ error: "Invalid API key" });
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) return res.status(401).json({ error: "API key expired" });

      const scopes: string[] = key.scopes || [];
      if (!scopes.includes("*")) {
        for (const need of requiredScopes) {
          if (!scopes.includes(need)) return res.status(403).json({ error: `Missing scope: ${need}` });
        }
      }
      req.apiKey = key;
      req.tenantId = key.tenantId;
      req.apiScopes = scopes;

      ApiKeyModel.updateOne({ id: key.id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
      next();
    } catch (e: any) {
      res.status(500).json({ error: "Auth error: " + e.message });
    }
  };
}

export function signPayload(payload: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// ─── Execute automation rules triggered by an event ──────────────────────────
async function executeAutomations(event: string, data: any, tenantId?: string): Promise<number> {
  try {
    const { AutomationRuleModel } = await import("@shared/schema");
    const filter: any = { isActive: true, trigger: event };
    if (tenantId) filter.$or = [{ tenantId }, { tenantId: { $exists: false } }];
    const rules: any[] = await AutomationRuleModel.find(filter).lean();
    if (!rules.length) return 0;

    let ran = 0;
    await Promise.all(rules.map(async (rule: any) => {
      try {
        // Check conditions
        const conditionsMet = (rule.conditions || []).every((cond: any) => {
          const fieldValue = String(data[cond.field] ?? "");
          const condValue = String(cond.value ?? "");
          switch (cond.operator) {
            case "eq": return fieldValue === condValue;
            case "ne": return fieldValue !== condValue;
            case "gt": return parseFloat(fieldValue) > parseFloat(condValue);
            case "lt": return parseFloat(fieldValue) < parseFloat(condValue);
            case "contains": return fieldValue.toLowerCase().includes(condValue.toLowerCase());
            default: return true;
          }
        });
        if (!conditionsMet) return;

        // Execute each action
        for (const action of (rule.actions || [])) {
          await executeAction(action, event, data, tenantId).catch(e => console.error(`[automation action ${action.type}]`, e.message));
        }

        AutomationRuleModel.updateOne(
          { id: rule.id },
          { $inc: { runCount: 1 }, $set: { lastRunAt: new Date() } }
        ).catch(() => {});
        ran++;
      } catch (e: any) {
        AutomationRuleModel.updateOne({ id: rule.id }, { $set: { lastError: e.message } }).catch(() => {});
      }
    }));
    return ran;
  } catch (e: any) {
    console.error("[executeAutomations]", e.message);
    return 0;
  }
}

async function executeAction(action: any, event: string, data: any, tenantId?: string): Promise<void> {
  const { type, config } = action;
  const body = JSON.stringify({ event, data, tenantId, timestamp: new Date().toISOString() });

  if (type === "webhook") {
    if (!config.url) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "QIROX-Automation/1.0" },
      body,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));

  } else if (type === "telegram") {
    if (!config.botToken || !config.chatId) return;
    const text = interpolate(config.message || "🔔 حدث جديد: {{event}}", { event, ...data });
    await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: "HTML" }),
    });

  } else if (type === "slack") {
    if (!config.webhookUrl) return;
    const text = interpolate(config.message || "🔔 *{{event}}* triggered", { event, ...data });
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

  } else if (type === "whatsapp") {
    // WhatsApp template via WhatsApp Business Cloud API
    if (!config.phoneNumberId || !config.accessToken || !config.to) return;
    const text = interpolate(config.message || "🔔 {{event}}", { event, ...data });
    await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: config.to, type: "text", text: { body: text } }),
    });

  } else if (type === "email") {
    // Email via SMTP2GO API
    if (!config.to) return;
    const subject = interpolate(config.subject || "QIROX: {{event}}", { event, ...data });
    const bodyHtml = interpolate(config.message || "<p>حدث: {{event}}</p><pre>{{json}}</pre>", { event, json: JSON.stringify(data, null, 2), ...data });
    const apiKey = process.env.SMTP2GO_API_KEY;
    if (!apiKey) return;
    await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: [config.to],
        sender: process.env.SMTP_FROM || "cafe@qiroxstudio.online",
        subject,
        html_body: bodyHtml,
      }),
    });

  } else if (type === "google_sheets") {
    // Append to Google Sheets via webhook (Apps Script web app URL)
    if (!config.webhookUrl) return;
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    });

  } else if (type === "sms") {
    // SMS via Unifonic
    if (!config.appSid || !config.to) return;
    const text = interpolate(config.message || "QIROX: {{event}}", { event, ...data });
    await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ AppSid: config.appSid, Recipient: config.to, Body: text }),
    });
  }
}

function interpolate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`);
}

// ─── Log event to EventLog collection ────────────────────────────────────────
async function logEvent(event: string, data: any, tenantId: string | undefined, webhooksRan: number, automationsRan: number): Promise<void> {
  try {
    const { EventLogModel } = await import("@shared/schema");
    await EventLogModel.create({
      id: nanoid(),
      tenantId: tenantId || 'demo-tenant',
      event,
      data,
      webhooksRan,
      automationsRan,
      createdAt: new Date(),
    });
  } catch (e: any) {
    // Non-critical — don't throw
  }
}

// ─── Dispatch event: log + webhooks + automations ─────────────────────────────
export async function publishEvent(event: string, data: any, tenantId?: string): Promise<void> {
  try {
    const { WebhookModel, WebhookDeliveryModel } = await import("@shared/schema");
    const filter: any = { isActive: true, events: event };
    if (tenantId) filter.$or = [{ tenantId }, { tenantId: { $exists: false } }];
    const hooks: any[] = await WebhookModel.find(filter).lean();

    const payload = { event, data, tenantId, timestamp: new Date().toISOString(), id: nanoid() };
    const body = JSON.stringify(payload);

    const webhookResults = await Promise.all(hooks.map(async (hook: any) => {
      const sig = signPayload(body, hook.secret);
      const start = Date.now();
      let statusCode: number | undefined;
      let responseBody = "";
      let success = false;
      let errorMessage: string | undefined;

      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-QIROX-Signature": sig,
            "X-QIROX-Event": event,
            "X-QIROX-Delivery": payload.id,
            "User-Agent": "QIROX-Webhooks/1.0",
          },
          body,
          signal: ctrl.signal,
        });
        clearTimeout(t);
        statusCode = r.status;
        responseBody = (await r.text()).slice(0, 500);
        success = r.ok;
        if (!success) errorMessage = `HTTP ${r.status}`;
      } catch (e: any) {
        errorMessage = e.message || String(e);
      }

      const durationMs = Date.now() - start;
      WebhookDeliveryModel.create({
        id: nanoid(), webhookId: hook.id, tenantId: hook.tenantId,
        event, payload, url: hook.url, statusCode, responseBody,
        durationMs, success, attemptNumber: 1, errorMessage,
      }).catch(() => {});

      const update: any = { $set: { lastTriggeredAt: new Date() } };
      if (success) { update.$set.failureCount = 0; update.$set.lastError = null; }
      else { update.$inc = { failureCount: 1 }; update.$set.lastError = errorMessage; }
      const { WebhookModel: WM } = await import("@shared/schema");
      WM.updateOne({ id: hook.id }, update).catch(() => {});
      return success;
    }));

    const automationsRan = await executeAutomations(event, data, tenantId);
    logEvent(event, data, tenantId, webhookResults.length, automationsRan).catch(() => {});
  } catch (e: any) {
    console.error("[publishEvent]", e.message);
  }
}

// ─── Integration Catalog ───────────────────────────────────────────────────────
export const INTEGRATION_CATALOG = [
  // ERP
  { type: "sap", category: "erp", nameAr: "SAP Business One", nameEn: "SAP Business One", icon: "🏢", fields: ["apiUrl", "username", "password", "companyDb"], description: "ربط مع SAP لمزامنة الطلبات والمخزون" },
  { type: "oracle_netsuite", category: "erp", nameAr: "Oracle NetSuite", nameEn: "Oracle NetSuite", icon: "🔷", fields: ["accountId", "consumerKey", "consumerSecret", "tokenId", "tokenSecret"], description: "ERP سحابي شامل من Oracle" },
  { type: "microsoft_dynamics", category: "erp", nameAr: "Microsoft Dynamics 365", nameEn: "Microsoft Dynamics 365", icon: "🪟", fields: ["tenantId", "clientId", "clientSecret", "environment"], description: "تكامل ERP و CRM من Microsoft" },
  // Accounting
  { type: "zoho", category: "accounting", nameAr: "Zoho Books", nameEn: "Zoho Books", icon: "📊", fields: ["organizationId", "clientId", "clientSecret", "refreshToken"], description: "برنامج المحاسبة السحابي من Zoho" },
  { type: "qoyod", category: "accounting", nameAr: "قيود", nameEn: "Qoyod", icon: "📒", fields: ["apiKey", "organizationId"], description: "نظام محاسبة سعودي يدعم ZATCA" },
  { type: "daftra", category: "accounting", nameAr: "دفترة", nameEn: "Daftra", icon: "📕", fields: ["subdomain", "apiKey"], description: "محاسبة وفوترة للشركات العربية" },
  { type: "wave", category: "accounting", nameAr: "Wave Accounting", nameEn: "Wave", icon: "🌊", fields: ["apiKey", "businessId"], description: "محاسبة مجانية للمشاريع الصغيرة" },
  // Delivery
  { type: "jahez", category: "delivery", nameAr: "جاهز", nameEn: "Jahez", icon: "🛵", fields: ["apiKey", "branchId"], description: "منصة توصيل سعودية رائدة" },
  { type: "hungerstation", category: "delivery", nameAr: "هنقرستيشن", nameEn: "HungerStation", icon: "🍔", fields: ["partnerId", "apiKey"], description: "أكبر منصة توصيل طعام في السعودية" },
  { type: "mrsool", category: "delivery", nameAr: "مرسول", nameEn: "Mrsool", icon: "📦", fields: ["apiKey", "merchantId"], description: "توصيل سريع من أي مكان" },
  { type: "keeta", category: "delivery", nameAr: "كيتا", nameEn: "Keeta", icon: "🚴", fields: ["apiKey", "storeId"], description: "منصة توصيل طعام جديدة من Meituan" },
  { type: "noon_food", category: "delivery", nameAr: "نون فود", nameEn: "Noon Food", icon: "🌙", fields: ["apiKey", "restaurantId"], description: "توصيل طعام من نون" },
  // Messaging
  { type: "whatsapp", category: "messaging", nameAr: "واتساب أعمال", nameEn: "WhatsApp Business", icon: "💬", fields: ["phoneNumberId", "accessToken", "businessAccountId", "verifyToken"], description: "رسائل واتساب رسمية للعملاء" },
  { type: "telegram", category: "messaging", nameAr: "تيليغرام بوت", nameEn: "Telegram Bot", icon: "✈️", fields: ["botToken", "chatId"], description: "إشعارات فورية عبر بوت تيليغرام" },
  { type: "slack", category: "messaging", nameAr: "Slack", nameEn: "Slack", icon: "💼", fields: ["webhookUrl", "channel"], description: "تنبيهات الفريق عبر Slack" },
  { type: "sms_unifonic", category: "messaging", nameAr: "SMS - Unifonic", nameEn: "Unifonic SMS", icon: "📱", fields: ["appSid", "senderName"], description: "رسائل SMS عبر Unifonic للسعودية" },
  // E-commerce
  { type: "shopify", category: "ecommerce", nameAr: "Shopify", nameEn: "Shopify", icon: "🛍️", fields: ["shopUrl", "accessToken", "apiVersion"], description: "أشهر منصة تجارة إلكترونية عالمياً" },
  { type: "tiktok_shop", category: "ecommerce", nameAr: "TikTok Shop", nameEn: "TikTok Shop", icon: "🎵", fields: ["appKey", "appSecret", "shopId", "accessToken"], description: "بيع مباشر عبر TikTok" },
  { type: "salla", category: "ecommerce", nameAr: "سلة", nameEn: "Salla", icon: "🛒", fields: ["accessToken", "storeId"], description: "منصة التجارة السعودية الرائدة" },
  { type: "zid", category: "ecommerce", nameAr: "زد", nameEn: "Zid", icon: "🏪", fields: ["accessToken", "storeId"], description: "منصة تجارة إلكترونية عربية" },
  { type: "woocommerce", category: "ecommerce", nameAr: "WooCommerce", nameEn: "WooCommerce", icon: "🛕", fields: ["siteUrl", "consumerKey", "consumerSecret"], description: "تكامل مع متجر WordPress" },
  // Automation Platforms
  { type: "zapier", category: "automation", nameAr: "Zapier", nameEn: "Zapier", icon: "⚡", fields: ["webhookUrl"], description: "ربط QIROX بـ 5000+ تطبيق عبر Zapier" },
  { type: "make", category: "automation", nameAr: "Make (Integromat)", nameEn: "Make", icon: "🔄", fields: ["webhookUrl"], description: "أتمتة متقدمة عبر Make/Integromat" },
  { type: "n8n", category: "automation", nameAr: "n8n", nameEn: "n8n", icon: "🔀", fields: ["webhookUrl", "apiKey"], description: "أتمتة مفتوحة المصدر self-hosted" },
  { type: "google_sheets", category: "automation", nameAr: "Google Sheets", nameEn: "Google Sheets", icon: "📗", fields: ["webhookUrl"], description: "تصدير تلقائي للبيانات إلى Google Sheets" },
  // Loyalty & CRM
  { type: "mokafaa", category: "loyalty", nameAr: "مكافأة", nameEn: "Mokafaa", icon: "⭐", fields: ["partnerId", "apiKey", "apiSecret"], description: "برنامج الولاء الوطني السعودي" },
  { type: "salesforce", category: "loyalty", nameAr: "Salesforce CRM", nameEn: "Salesforce", icon: "☁️", fields: ["instanceUrl", "clientId", "clientSecret", "refreshToken"], description: "أشهر CRM في العالم" },
  // POS
  { type: "foodics", category: "pos", nameAr: "Foodics", nameEn: "Foodics", icon: "🍴", fields: ["apiToken", "branchId"], description: "نظام POS السحابي للمطاعم" },
  { type: "revel", category: "pos", nameAr: "Revel Systems", nameEn: "Revel", icon: "💹", fields: ["apiUrl", "apiKey", "apiSecret"], description: "نظام iPad POS للمطاعم" },
  // BNPL
  { type: "tamara", category: "payment_device", nameAr: "تمارا", nameEn: "Tamara", icon: "🔵", fields: ["apiKey", "merchantId", "notifyUrl"], description: "تقسيط بدون فوائد - تمارا" },
  { type: "tabby", category: "payment_device", nameAr: "تابي", nameEn: "Tabby", icon: "🟣", fields: ["apiKey", "merchantCode"], description: "اشتر الآن وادفع لاحقاً - تابي" },
  // Payment devices
  { type: "payment_device", category: "payment_device", nameAr: "أجهزة الدفع", nameEn: "Payment Devices", icon: "💳", fields: ["deviceModel", "serialNumber", "merchantId", "terminalId", "ipAddress"], description: "ربط أجهزة POS والدفع المادية" },
  // Generic
  { type: "generic_webhook", category: "messaging", nameAr: "Webhook مخصّص", nameEn: "Generic Webhook", icon: "🔗", fields: ["url", "secret"], description: "أرسل أحداث QIROX لأي نظام خارجي" },
];

export const ECOSYSTEM_EVENTS = [
  { key: "order.created", nameAr: "إنشاء طلب جديد", nameEn: "Order Created", category: "orders" },
  { key: "order.updated", nameAr: "تحديث حالة طلب", nameEn: "Order Updated", category: "orders" },
  { key: "order.completed", nameAr: "اكتمال الطلب", nameEn: "Order Completed", category: "orders" },
  { key: "order.cancelled", nameAr: "إلغاء طلب", nameEn: "Order Cancelled", category: "orders" },
  { key: "order.ready", nameAr: "الطلب جاهز", nameEn: "Order Ready", category: "orders" },
  { key: "customer.created", nameAr: "تسجيل عميل جديد", nameEn: "Customer Created", category: "customers" },
  { key: "customer.updated", nameAr: "تحديث بيانات عميل", nameEn: "Customer Updated", category: "customers" },
  { key: "loyalty.points_added", nameAr: "إضافة نقاط ولاء", nameEn: "Loyalty Points Added", category: "loyalty" },
  { key: "loyalty.points_redeemed", nameAr: "استبدال نقاط الولاء", nameEn: "Loyalty Points Redeemed", category: "loyalty" },
  { key: "loyalty.tier_upgraded", nameAr: "ترقية مستوى الولاء", nameEn: "Loyalty Tier Upgraded", category: "loyalty" },
  { key: "inventory.low_stock", nameAr: "تنبيه نقص المخزون", nameEn: "Low Stock Alert", category: "inventory" },
  { key: "inventory.updated", nameAr: "تحديث المخزون", nameEn: "Inventory Updated", category: "inventory" },
  { key: "inventory.out_of_stock", nameAr: "نفاد المخزون", nameEn: "Out of Stock", category: "inventory" },
  { key: "menu.item_created", nameAr: "إضافة منتج للمنيو", nameEn: "Menu Item Created", category: "menu" },
  { key: "menu.item_updated", nameAr: "تحديث منتج في المنيو", nameEn: "Menu Item Updated", category: "menu" },
  { key: "menu.item_disabled", nameAr: "إيقاف منتج في المنيو", nameEn: "Menu Item Disabled", category: "menu" },
  { key: "payment.received", nameAr: "استلام دفعة", nameEn: "Payment Received", category: "payments" },
  { key: "payment.failed", nameAr: "فشل الدفع", nameEn: "Payment Failed", category: "payments" },
  { key: "payment.refunded", nameAr: "استرداد دفعة", nameEn: "Payment Refunded", category: "payments" },
  { key: "shift.opened", nameAr: "فتح وردية", nameEn: "Shift Opened", category: "operations" },
  { key: "shift.closed", nameAr: "إغلاق وردية", nameEn: "Shift Closed", category: "operations" },
  { key: "employee.checked_in", nameAr: "حضور موظف", nameEn: "Employee Checked In", category: "operations" },
  { key: "employee.checked_out", nameAr: "انصراف موظف", nameEn: "Employee Checked Out", category: "operations" },
  { key: "reservation.created", nameAr: "حجز جديد", nameEn: "Reservation Created", category: "reservations" },
  { key: "reservation.confirmed", nameAr: "تأكيد حجز", nameEn: "Reservation Confirmed", category: "reservations" },
  { key: "webhook.test", nameAr: "اختبار Webhook", nameEn: "Webhook Test", category: "system" },
];

export const AUTOMATION_ACTION_TYPES = [
  { type: "webhook", nameAr: "إرسال Webhook", icon: "🔗", fields: [{ key: "url", label: "URL الوجهة", required: true }] },
  { type: "telegram", nameAr: "رسالة تيليغرام", icon: "✈️", fields: [{ key: "botToken", label: "Bot Token", required: true }, { key: "chatId", label: "Chat ID", required: true }, { key: "message", label: "الرسالة ({{event}}, {{orderId}}...)", required: false }] },
  { type: "slack", nameAr: "إشعار Slack", icon: "💼", fields: [{ key: "webhookUrl", label: "Slack Webhook URL", required: true }, { key: "message", label: "الرسالة", required: false }] },
  { type: "whatsapp", nameAr: "رسالة واتساب", icon: "💬", fields: [{ key: "phoneNumberId", label: "Phone Number ID", required: true }, { key: "accessToken", label: "Access Token", required: true }, { key: "to", label: "رقم المستلم", required: true }, { key: "message", label: "نص الرسالة", required: false }] },
  { type: "email", nameAr: "إرسال بريد إلكتروني", icon: "📧", fields: [{ key: "to", label: "بريد المستلم", required: true }, { key: "subject", label: "الموضوع", required: false }, { key: "message", label: "نص الرسالة (HTML)", required: false }] },
  { type: "google_sheets", nameAr: "تصدير لـ Google Sheets", icon: "📗", fields: [{ key: "webhookUrl", label: "Apps Script Webhook URL", required: true }] },
  { type: "sms", nameAr: "رسالة SMS", icon: "📱", fields: [{ key: "appSid", label: "Unifonic App SID", required: true }, { key: "to", label: "رقم المستلم", required: true }, { key: "message", label: "نص الرسالة", required: false }] },
];

export const API_SCOPES = [
  { key: "menu:read", nameAr: "قراءة المنيو" },
  { key: "menu:write", nameAr: "تعديل المنيو" },
  { key: "orders:read", nameAr: "قراءة الطلبات" },
  { key: "orders:write", nameAr: "إنشاء/تعديل الطلبات" },
  { key: "customers:read", nameAr: "قراءة العملاء" },
  { key: "customers:write", nameAr: "تعديل العملاء" },
  { key: "loyalty:read", nameAr: "قراءة الولاء" },
  { key: "loyalty:write", nameAr: "إدارة الولاء" },
  { key: "inventory:read", nameAr: "قراءة المخزون" },
  { key: "inventory:write", nameAr: "تعديل المخزون" },
  { key: "analytics:read", nameAr: "قراءة التحليلات" },
  { key: "employees:read", nameAr: "قراءة الموظفين" },
  { key: "webhooks:manage", nameAr: "إدارة Webhooks" },
  { key: "*", nameAr: "كل الصلاحيات" },
];
