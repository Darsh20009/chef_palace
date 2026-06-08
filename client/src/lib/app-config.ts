// ============================================================
// ██████╗ ██╗██████╗  ██████╗ ██╗  ██╗    ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗
// ██╔═══██╗██║██╔══██╗██╔═══██╗╚██╗██╔╝    ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║
// ██║   ██║██║██████╔╝██║   ██║ ╚███╔╝     ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║
// ██║▄▄ ██║██║██╔══██╗██║   ██║ ██╔██╗     ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║
// ╚██████╔╝██║██║  ██║╚██████╔╝██╔╝ ██╗    ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║
//  ╚══▀▀═╝ ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝    ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝
//
// ╔═══════════════════════════════════════════════════════════════════════════════════════════╗
// ║  QIROX MASTER FRONTEND CONFIGURATION                                                     ║
// ║  File: client/src/lib/app-config.ts                                                      ║
// ║                                                                                           ║
// ║  🎯 THIS IS THE SINGLE SOURCE OF TRUTH FOR:                                              ║
// ║     • All client-side route definitions                                                   ║
// ║     • All navigation menus (manager, employee, customer)                                  ║
// ║     • Branding (re-exported from brand.ts)                                                ║
// ║     • Database model names & collection pointers                                          ║
// ║     • Feature flags & plan gating keys                                                    ║
// ║     • API endpoint prefixes                                                               ║
// ║                                                                                           ║
// ║  🔁 TO REBRAND: edit client/src/lib/brand.ts  (colors, names, logos)                     ║
// ║  🛣️  TO ADD A ROUTE: add it here + App.tsx + the relevant sidebar file                   ║
// ║  🗄️  DATABASE: server/routes.ts (APIs) · shared/schema.ts (models)                      ║
// ║  🔐 SECRETS: .replit [env] section (dev) · Replit Secrets panel (prod)                   ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════╝

import { brand } from "@/lib/brand";
export { brand };

// ─── TECH STACK INFO ────────────────────────────────────────────────────────
export const STACK = {
  frontend:  "React 18 + Vite + TailwindCSS + Radix UI + TanStack Query",
  backend:   "Express.js + TypeScript (tsx via Replit workflow)",
  database:  "MongoDB Atlas (Mongoose ODM) — URI in MONGODB_URI env var",
  auth:      "Express Session (cookie: qirox.sid) — SECRET in SESSION_SECRET",
  realtime:  "WebSocket on /ws/orders",
  pushNotif: "Web Push VAPID — keys in VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY",
  email:     "SMTP2GO — key in SMTP2GO_API_KEY, from: SMTP_FROM",
  ai:        "Kimi / Moonshot AI — key in KIMI_API_KEY",
  payments:  "Geidea (card + Apple Pay), Cash, QIROX Loyalty Card",
  port:      5000,
  workflow:  "Start application → npm run dev",
} as const;

// ─── DATABASE MODELS (shared/schema.ts) ─────────────────────────────────────
// Every Mongoose model lives in shared/schema.ts.
// To add a model: define Interface → Schema → model() → export.
export const DB_MODELS = {
  CoffeeItem:        "CoffeeItem",          // products (drinks + food)
  MenuCategory:      "MenuCategory",        // product categories
  ProductAddon:      "ProductAddon",        // add-ons (milk, syrup…)
  Order:             "Order",               // all orders (POS, delivery, kiosk…)
  OrderItem:         "OrderItem",           // individual order line items
  Customer:          "Customer",            // customer accounts
  Employee:          "Employee",            // staff (cashier, barista…)
  CashierShift:      "CashierShift",        // Z-report / shift data
  RawItem:           "RawItem",             // raw inventory materials
  BranchStock:       "BranchStock",         // per-branch stock levels
  StockMovement:     "StockMovement",       // stock in/out log
  RecipeItem:        "RecipeItem",          // product → raw item mapping
  PurchaseOrder:     "PurchaseOrder",       // supplier orders
  Supplier:          "Supplier",            // supplier accounts
  Wastage:           "Wastage",             // waste records
  Branch:            "Branch",              // physical locations
  TableReservation:  "TableReservation",    // table booking
  LoyaltyCard:       "LoyaltyCard",         // customer loyalty cards
  GiftCard:          "GiftCard",            // gift cards
  Expense:           "Expense",             // operational expenses
  PromoOffer:        "PromoOffer",          // promotional offers
  Notification:      "Notification",        // push notification log
  BusinessConfig:    "BusinessConfig",      // per-tenant settings
  CustomBanner:      "CustomBanner",        // homepage banners
  Review:            "Review",              // customer reviews
  StocktakeSession:  "StocktakeSession",    // inventory count sessions
  ErpJournalEntry:   "ErpJournalEntry",     // double-entry accounting
  Payroll:           "Payroll",             // employee payroll
  InventoryCycle:    "InventoryCycle",      // inventory cycle tracking
} as const;

// ─── API ENDPOINT PREFIXES ───────────────────────────────────────────────────
// All APIs are defined in server/routes.ts
export const API = {
  // Public (no auth)
  public: {
    menu:       "/api/coffee-items",
    categories: "/api/menu-categories",
    addons:     "/api/product-addons",
    banners:    "/api/custom-banners",
    loyalty:    "/api/public/loyalty-settings",
    giftCard:   "/api/gift-cards/:code/redeem-customer",
    kiosk:      "/api/kiosk",
    config:     "/api/business-config",
    track:      "/api/orders/:id/track",
  },
  // Customer auth required
  customer: {
    login:       "/api/customers/login",
    register:    "/api/customers/register",
    profile:     "/api/customers/profile",
    orders:      "/api/orders",
    cart:        "/api/cart",
    checkout:    "/api/checkout",
    loyalty:     "/api/loyalty",
    reservations:"/api/reservations",
  },
  // Employee/Manager auth required
  employee: {
    login:       "/api/employees/login",
    orders:      "/api/orders",
    kitchen:     "/api/orders/kitchen",
    pos:         "/api/pos/order",
    attendance:  "/api/attendance",
    shifts:      "/api/shifts",
    stocktake:   "/api/stocktake",
  },
  manager: {
    inventory:   "/api/inventory",
    analytics:   "/api/analytics",
    reports:     "/api/reports",
    employees:   "/api/employees",
    accounting:  "/api/accounting",
    payroll:     "/api/payroll",
    branches:    "/api/branches",
    ai:          "/api/ai",
    digitalTwin: "/api/digital-twin",
  },
  // AI endpoints (KIMI_API_KEY required)
  ai: {
    menuAssistant:     "/api/ai/menu-assistant",
    inventoryInsights: "/api/ai/inventory-insights",
    ceoChat:           "/api/ai/ceo-chat",
    smartReports:      "/api/ai/smart-reports",
  },
  // Super admin (QIROX internal)
  qirox: {
    login:      "/api/qirox/login",
    dashboard:  "/api/qirox/dashboard",
    tenants:    "/api/qirox/tenants",
    subs:       "/api/qirox/subscriptions",
    health:     "/api/qirox/system-health",
    logs:       "/api/qirox/logs",
  },
} as const;

// ─── ROUTE MAP ───────────────────────────────────────────────────────────────
// All client-side routes. Mirrors App.tsx exactly.
// To add a page: 1) add entry here, 2) add lazy import in App.tsx,
//                3) add <Route> in App.tsx, 4) add sidebar link if needed.
export const ROUTES = {
  // ── Public / Customer ──────────────────────────────────────────────────────
  home:              "/",
  menu:              "/menu",
  cart:              "/cart",
  checkout:          "/checkout",
  customerLogin:     "/customer-login",
  customerDashboard: "/customer-dashboard",
  customerOrders:    "/customer-orders",
  customerProfile:   "/customer-profile",
  loyaltyCard:       "/loyalty-card",
  trackOrder:        "/track/:orderId",
  tableMenu:         "/table/:tableId",
  kiosk:             "/kiosk",
  customerDelivery:  "/delivery",
  driveThrough:      "/drive-through",
  carOrder:          "/car-order",
  curbside:          "/curbside",
  reservations:      "/reservations",

  // ── Auth ───────────────────────────────────────────────────────────────────
  auth:              "/auth",
  employeeLogin:     "/employee/login",

  // ── Employee Portal ────────────────────────────────────────────────────────
  employeeHome:      "/employee/home",
  employeeDashboard: "/employee/dashboard",
  pos:               "/employee/pos",
  cashier:           "/employee/cashier",
  kitchen:           "/employee/kitchen",
  orders:            "/employee/orders",
  tables:            "/employee/tables",
  attendance:        "/employee/attendance",
  employeeMenu:      "/employee/menu",
  productReservations: "/employee/product-reservations",
  gateway:           "/employee/gateway",

  // ── Manager Portal ─────────────────────────────────────────────────────────
  managerDashboard:  "/manager/dashboard",
  analytics:         "/manager/analytics",
  advancedAnalytics: "/manager/advanced-analytics",
  biAnalytics:       "/manager/bi-analytics",
  reports:           "/admin/reports",
  unifiedReports:    "/manager/unified-reports",
  smartReports:      "/manager/smart-reports",
  tahalyli:          "/manager/tahalyli",

  // Inventory
  inventory:         "/manager/inventory",
  rawItems:          "/manager/inventory/raw-items",
  recipes:           "/manager/inventory/recipes",
  purchases:         "/manager/inventory/purchases",
  movements:         "/manager/inventory/movements",
  transfers:         "/manager/inventory/transfers",
  stockAlerts:       "/manager/inventory/alerts",
  inventoryCycle:    "/manager/inventory/cycle",
  stocktake:         "/manager/inventory/stocktake",  // عاشراً: الجرد الذكي
  inventoryAI:       "/manager/inventory/ai",          // الحادي عشر: ذكاء المخزون

  // Finance
  accounting:        "/manager/accounting",
  erpAccounting:     "/erp/accounting",
  zatca:             "/manager/zatca",
  payroll:           "/manager/payroll",

  // Team
  employees:         "/admin/employees",
  managerAttendance: "/manager/attendance",

  // Operations
  managerDelivery:   "/manager/delivery",
  drivers:           "/manager/drivers",
  tableManagement:   "/admin/tables",
  reservationsMgr:   "/manager/reservations",

  // AI Center
  ceoAI:             "/manager/ceo-ai",        // الثالث عشر: CEO AI
  simulator:         "/manager/simulator",      // الرابع عشر: محاكي الأعمال
  digitalTwin:       "/manager/digital-twin",   // الخامس عشر: التوأم الرقمي
  managerAI:         "/manager/ai",
  aiAutomation:      "/manager/ai-automation",

  // Settings & Config
  branches:          "/admin/branches",
  settings:          "/admin/settings",
  notifications:     "/admin/notifications",
  apiManagement:     "/admin/api",
  promotions:        "/manager/promotions",
  giftCards:         "/manager/gift-cards",
  loyalty:           "/manager/loyalty",
  integrations:      "/manager/integrations",
  warehouse:         "/manager/warehouse",
  suppliers:         "/manager/suppliers",

  // QIROX Super Admin (internal)
  qiroxLogin:        "/qirox",
  qiroxDashboard:    "/qirox/dashboard",
} as const;

// ─── FEATURE FLAGS / PLAN GATING ────────────────────────────────────────────
// Full list in client/src/lib/plan-features.ts
// Plan hook: client/src/hooks/usePlan.ts
// Gate component: client/src/components/plan-gate.tsx
export const PLAN_GATED_ROUTES: Record<string, "lite" | "pro" | "infinity"> = {
  [ROUTES.zatca]:          "pro",
  [ROUTES.accounting]:     "pro",
  [ROUTES.giftCards]:      "pro",
  [ROUTES.loyalty]:        "pro",
  [ROUTES.payroll]:        "pro",
  [ROUTES.suppliers]:      "pro",
  [ROUTES.inventory]:      "pro",
  [ROUTES.biAnalytics]:    "pro",
  [ROUTES.apiManagement]:  "infinity",
  [ROUTES.warehouse]:      "infinity",
  [ROUTES.erpAccounting]:  "infinity",
  [ROUTES.ceoAI]:          "infinity",
  [ROUTES.simulator]:      "infinity",
  [ROUTES.digitalTwin]:    "infinity",
  [ROUTES.inventoryAI]:    "infinity",
};

// ─── NAVIGATION MENUS ────────────────────────────────────────────────────────
// CANONICAL navigation structure — sidebars read from manager-sidebar.tsx and
// employee-sidebar.tsx. If you add a route, add it in ROUTES above AND in the
// relevant sidebar file.
//
// Sidebar files:
//   Manager → client/src/components/manager-sidebar.tsx
//   Employee → client/src/components/employee-sidebar.tsx
//   Customer → client/src/components/customer-footer.tsx (bottom nav)

export const NAV_SECTIONS = {
  manager: [
    "لوحة التحكم",
    "المخزون",
    "المالية",
    "الفريق",
    "التوصيل",
    "الذكاء الاصطناعي",
    "التحليلات والتقارير",
    "الإعدادات",
    "المتقدم",
  ],
  employee: [
    "الرئيسية",
    "الطلبات",
    "الصندوق",
    "المطبخ",
    "الطاولات",
    "الحضور",
    "القائمة",
    "الحجوزات",
  ],
} as const;

// ─── ENVIRONMENT VARIABLES REFERENCE ─────────────────────────────────────────
// Never hardcode secrets. All env vars are listed here for documentation only.
// DEV: .replit [env] section
// PROD: Replit Secrets panel (Settings → Secrets)
export const ENV_VARS_REFERENCE = {
  MONGODB_URI:         "MongoDB Atlas connection string",
  SESSION_SECRET:      "Express session signing secret",
  VAPID_PUBLIC_KEY:    "Web Push public key (VAPID)",
  VAPID_PRIVATE_KEY:   "Web Push private key (VAPID)",
  VAPID_SUBJECT:       "Web Push subject (mailto:...)",
  SMTP2GO_API_KEY:     "SMTP2GO email service key",
  SMTP_FROM:           "Sender email address",
  SMTP_USER:           "Sender display name",
  NOTIFICATION_EMAIL:  "Admin notification email",
  KIMI_API_KEY:        "Kimi/Moonshot AI API key (sk-...)",
  PAYMOB_SECRET_KEY:   "PayMob payment gateway secret",
  PAYMOB_PUBLIC_KEY:   "PayMob public key",
  PAYMOB_HMAC_SECRET:  "PayMob HMAC secret for webhooks",
} as const;

// ─── BRANDING QUICK REFERENCE ─────────────────────────────────────────────────
// Full branding config → client/src/lib/brand.ts
// To rebrand: ONLY edit brand.ts — it auto-applies to the entire system.
//
//   brand.nameEn / brand.nameAr         → System name
//   brand.colors.primary                → Primary color (HSL)
//   brand.logoCustomer / brand.logoStaff → Logo paths
//   brand.pointsBrandEn/Ar              → Loyalty points program name
//   brand.aiAssistantNameAr             → AI chat assistant name
//
// CSS variables are applied at startup via applyBrandColors() in main.tsx.
export { brand as BRAND } from "@/lib/brand";

// ─── FILE MAP FOR DEVELOPERS & AI ────────────────────────────────────────────
// Where to find everything in this codebase.
export const FILE_MAP = {
  // ── Core Config ─────────────────────────────────────────────────────────────
  "Master Frontend Config":   "client/src/lib/app-config.ts",          // ← YOU ARE HERE
  "Branding":                 "client/src/lib/brand.ts",
  "Color System (CSS vars)":  "client/src/index.css",
  "Tailwind Config":          "tailwind.config.ts",

  // ── Frontend Structure ───────────────────────────────────────────────────────
  "App Router (all routes)":  "client/src/App.tsx",
  "Manager Sidebar":          "client/src/components/manager-sidebar.tsx",
  "Employee Sidebar":         "client/src/components/employee-sidebar.tsx",
  "Customer Footer Nav":      "client/src/components/customer-footer.tsx",
  "Global Prompts (PWA/Push)":"client/src/components/global-prompts.tsx",
  "Pages Directory":          "client/src/pages/",
  "Components Directory":     "client/src/components/",
  "Hooks":                    "client/src/hooks/",
  "Lib / Utils":              "client/src/lib/",

  // ── Plan / Feature Gating ────────────────────────────────────────────────────
  "Feature Definitions":      "client/src/lib/plan-features.ts",
  "Plan Hook":                "client/src/hooks/usePlan.ts",
  "Plan Gate Component":      "client/src/components/plan-gate.tsx",

  // ── Backend ──────────────────────────────────────────────────────────────────
  "Server Entry":             "server/index.ts",
  "ALL API Routes":           "server/routes.ts",
  "Super Admin Routes":       "server/qirox-admin.ts",
  "Push Notifications":       "server/push-service.ts",
  "Email Templates":          "server/mail-service.ts",
  "Permissions Engine":       "server/permissions-engine.ts",
  "Delivery Service":         "server/delivery-service.ts",
  "ERP Accounting Service":   "server/erp-accounting-service.ts",
  "Smart Scheduler (cron)":   "server/smart-scheduler.ts",
  "Auth Middleware":          "server/middleware/auth.ts",

  // ── Shared ───────────────────────────────────────────────────────────────────
  "ALL Database Models":      "shared/schema.ts",             // ← ALL Mongoose models here

  // ── PWA / Service Worker ────────────────────────────────────────────────────
  "Service Worker":           "public/service-worker.js",
  "PWA Manifest":             "public/manifest.json",
  "Print Relay Agent":        "public/print-relay.js",

  // ── Assets ───────────────────────────────────────────────────────────────────
  "Logo (customer)":          "attached_assets/qirox-logo-customer.png",
  "Logo (staff/manager)":     "attached_assets/qirox-logo-staff.png",
  "Brand Banner 1":           "attached_assets/image_1773902463502.png",
  "Brand Banner 2":           "attached_assets/image_1773902748715.png",
} as const;
