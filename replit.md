## Overview

**مكان الشيف البخاري** (Chef Bukhari's Place) is a comprehensive digital management system for a Bukhari rice restaurant in Riyadh, Saudi Arabia. Domain: chefsplace.online. MongoDB: chefsplace.zy8ckot.mongodb.net.

**Branch Contact:** +966 53 655 8528 (`brand.phoneDisplay`)
**Branch Location:** https://maps.app.goo.gl/XMZVc2cYWBkmgJZW6?g_st=ic (`brand.locationUrl`)

It has two portals:

## ⚡ Master Brand Configuration

**File:** `client/src/lib/brand.ts`

This is the **single source of truth** for ALL branding across the entire system. To rebrand the system, only this one file needs to be changed:

- `brand.nameEn` / `brand.nameAr` — System name (English + Arabic)
- `brand.shortNameEn` / `brand.shortNameAr` — Short name for tight spaces
- `brand.platformNameEn` / `brand.platformNameAr` — Staff/admin portal name
- `brand.taglineEn` / `brand.taglineAr` — Tagline shown under logo
- `brand.logoCustomer` — Customer-facing logo path (`/logo.png`)
- `brand.logoStaff` — Staff/employee portal logo path (`/employee-logo.png`)
- `brand.colors.primary` — Primary brand color (HSL values, auto-applied to CSS at startup)
- `brand.colors.accent` / `brand.colors.background` — Accent & background colors
- `brand.themeColor` — PWA/browser theme color (hex)
- `brand.website` / `brand.social` — Contact & social links
- `brand.pointsBrandEn` / `brand.pointsBrandAr` — Loyalty points program name
- `brand.cardBrandEn` / `brand.cardBrandAr` — Loyalty card name
- `brand.aiAssistantNameAr` — AI assistant name shown in the AI modal

**How it works:** `applyBrandColors()` is called in `main.tsx` and injects CSS custom properties from `brand.colors` at runtime, ensuring color changes in `brand.ts` instantly affect the entire UI without touching CSS files.

**Files connected to brand.ts:** admin-sidebar, employee-sidebar, customer-footer, receipt-print, tax-invoice-print, loyalty-card, global-prompts, CardCarousel, receipt-invoice, payment-methods, simulated-card-payment, table-qr-card, AIMenuAssistant, export-utils.

**Note for server-side branding** (email templates in `server/mail-service.ts`): These contain hardcoded brand strings that should be manually kept in sync with `brand.ts` values.

## Printing System — Local Relay Agent (April 2026)

### Problem Solved
Tab Sense (Android POS terminals) and other Android devices could not print to LAN thermal printers because:
- Browsers cannot open raw TCP sockets
- QZ Tray (the previous solution) requires a desktop app — doesn't work on Android
- The cloud server cannot reach private LAN IPs (192.168.x.x)

### Solution: Local Print Relay Agent
A lightweight Node.js HTTP server (`public/print-relay.js`) that runs on any device on the local network (Windows laptop, Raspberry Pi, etc.) and bridges browser → TCP printer.

**Architecture:**
```
Tab Sense browser → HTTP → Relay Agent (local network) → TCP → Thermal Printer
```

**Files changed:**
- `client/src/lib/thermal-printer.ts`: Added `relay` mode, `relayAgentUrl` setting, `relayAgentPrint()` and `testRelayAgent()` functions
- `client/src/components/printer-settings-panel.tsx`: Added "Local Relay 🆕" mode in the dropdown with full setup UI, download button, and test connection
- `public/print-relay.js`: The downloadable relay agent script (served at `/print-relay.js`)

**How users set it up:**
1. Download `print-relay.js` from printer settings (or `/print-relay.js`)
2. Install Node.js on any device on the local network
3. Run `node print-relay.js` — shows device IPs on startup
4. In printer settings: select "وكيل محلي" (Local Relay), enter relay URL + printer IP
5. Click "Test Connection" to verify

**Relay agent port:** 8089 (configurable via `PORT=xxxx node print-relay.js`)

## Latest Fixes (April 2026 - Attendance Report, Cleaner Role, Owner Dashboard)

### Changes Applied (April 5, 2026)

**1. Monthly Attendance Report in Manager Attendance Page**
`client/src/pages/manager-attendance.tsx` now has a tab switcher between "Daily Report" and "Monthly Report":
- Monthly report calls `/api/attendance/monthly-report?year=YYYY&month=M` (route already in server/routes.ts)
- Shows per-employee: present days, absent days, late days, late hours, work hours, attendance rate %
- Best Employee banner highlights top performer
- Employee ranking table sorted by attendance rate
- Summary cards: working days, total employees, total absences, total late minutes

**2. Cleaner Role Redirect to Attendance**
`client/src/pages/employee-login.tsx`: Employees with role `cleaner` are now automatically redirected to `/employee/attendance` instead of the full employee home — giving them an attendance-only interface.

**3. Owner/Admin Dashboard — Reset Orders Only**
`client/src/pages/owner-dashboard.tsx`:
- Both `owner` and `admin` roles can now access the danger zone (previously only `owner`)
- New "Reset Orders Only" button calls `DELETE /api/admin/reset-orders-only` — deletes orders + accounting while preserving products, employees, and images

**4. Branch Manager Fix in Attendance**
Fixed `manager-attendance.tsx` to allow `branch_manager` role (in addition to `manager`, `admin`, `owner`) — the role string `branch_manager` is the actual stored value.

## Latest Fixes (March 2026 - Timezone, Printing, Dashboard)

### Bug Fixes Applied (March 27, 2026)

**1. Saudi Arabia Timezone (UTC+3) - Day Boundary Fix**
All server-side "today" calculations previously used raw `setHours(0,0,0,0)` which relied on the server's local clock (UTC). This caused the day to roll over at 3 AM Riyadh time instead of midnight. All affected routes now use `getSaudiStartOfDay()` / `getSaudiEndOfDay()`:
- `GET /api/shifts/daily-summary` — Z-report date boundaries
- Expense/revenue period='daily' filter in analytics routes
- Attendance check-in / check-out "today" queries (3 instances)
- Attendance admin filter by date

**2. Thermal Printer Auto-Cut Between Customer & Staff Copies**
`printUnifiedReceipt` in `client/src/lib/print-utils.ts` now sends TWO separate print jobs to the queue instead of one combined HTML:
- Job 1: Customer copy (full tax invoice with ZATCA QR) → printer auto-cuts after
- Job 2: Staff prep copy (large item quantities for kitchen) → printer auto-cuts after
The existing `_drainPrintQueue` handles serial execution, ensuring the printer completes each job (and cuts) before starting the next.

**3. Employee Dashboard Routing Consistency**
Regular employees were redirected to `/employee/dashboard` (HR profile page) after login, while the mobile nav "Home" button went to `/employee/home` (quick-access portal) — causing inconsistency. Fixes:
- `employee-login.tsx`: All login redirects for non-manager employees now go to `/employee/home`
- 11 employee-facing pages (pos, cashier, orders, attendance, kitchen, tables, etc.): Back buttons now navigate to `/employee/home`
- 6 manager-facing pages (accounting, analytics, reports, executive, delivery, employees): Back buttons corrected to `/manager/dashboard`

## Latest Fixes (March 2026 Session)

### Bug Fixes Applied
- **Accounting Period Filter**: `GET /api/accounting/expenses` and `GET /api/accounting/revenue` now properly handle `period` query param (`today/week/month/year`) converting it to a date range. Previously the `period` param was ignored showing ALL records.
- **Expense Form Validation**: `handleAddExpense` now validates category, description, and amount before submitting.
- **Inventory UI Consistency**: All inventory pages (raw-items, purchases, alerts, movements, recipes, suppliers, transfers) now use `bg-white text-gray-900 min-h-screen` for consistent light theme.
- **Menu Category Sync**: `employee-menu-management.tsx` `filteredItems` now filters by `availableCatIds` (current department's categories only). Removed the `|| true` hack that caused all items to appear in all category sections.
- **Delivery System UI**: `manager-delivery.tsx` background changed from `bg-background` to `bg-white text-gray-900`.
- **In-Cafe Live Tracking**: Added `CafeInternalTracking` component that shows dine-in orders with real-time status tracking (pending/preparing/ready/serving), progress bars, and waiter assignment. Added `TrackingModeSelector` to toggle between in-cafe and external delivery tracking.
- **Smart Category Deletion**: Already implemented in backend at `DELETE /api/menu-categories/:id` with keyword-based reassignment of orphaned items.

## New Features (Session T001–T006)

### Foodics-Parity Additions
- **T001 – POS Keyboard Shortcuts**: `/` focuses search, `F2` clears search, `Escape` clears cart, `Ctrl+F` focuses search, `Ctrl+P` prints receipt
- **T002 – Gift Card in Checkout**: `/kiosk`-capable public endpoint `POST /api/gift-cards/:code/redeem-customer`; checkout.tsx has full gift card section: validate → show balance → deduct from total → redeem after order → display in summary and confirm dialog
- **T003 – Kiosk Mode** (`/kiosk`): Full-screen self-order terminal with category filter, item grid, cart sidebar, checkout modal, auto-reset idle timer (2 min), success screen with order number; no auth required
- **T004 – Promo Offers Management** (`/manager/promotions`): Full CRUD for bundle/discount/BOGO promo offers; uses existing `/api/admin/promo-offers` endpoints; toggle active; date range; discount % display
- **T005 – Offline POS Mode**: IndexedDB queue in `client/src/lib/offline-queue.ts`; when offline orders are queued locally; when back online they sync automatically with toast; service worker enhanced with `sync-offline-orders` background sync tag; offline indicator in POS cart panel
- **T006 – API Management** (`/admin/api`): API key generator (stored in localStorage for demo); public + authenticated endpoint documentation browser; copy endpoint URLs; code examples

### New Files
- `client/src/pages/kiosk.tsx` — Self-order kiosk
- `client/src/pages/promotions-management.tsx` — Promo offers CRUD
- `client/src/pages/api-management.tsx` — API key & docs management
- `client/src/lib/offline-queue.ts` — IndexedDB offline order queue

### New API Endpoints
- `POST /api/gift-cards/:code/redeem-customer` — Public gift card redemption for customer checkout

## Plan-Based Feature Gating System (March 2026)

### Architecture
- **`client/src/lib/plan-features.ts`** — Defines `ALL_FEATURES` (30+ features with `key`, `nameAr`, `nameEn`, `icon`, `category`, `categoryAr`, `plan: "lite"|"pro"|"infinity"`). Also exports `PLAN_INFO` (colors, icons, names, prices for each tier), `isFeatureInPlan()` helper, and `PlanName` type.
- **`client/src/hooks/usePlan.ts`** — React hook that reads `subscription.plan` from `/api/business-config`. Returns `{ plan, loading, hasFeature(key) }`.
- **`client/src/components/plan-gate.tsx`** — `<PlanGate feature="...">` wrapper component. If the user's plan doesn't include that feature, shows a branded upgrade UI with the required plan color, price, and a link to qirox.cafe/pricing.

### Subscription Tiers
| Tier | Price | Branches | Employees | Products |
|------|-------|----------|-----------|----------|
| Lite ⚡ | 499 SAR/mo | 1 | 5 | 50 |
| Pro 🚀 | 1,499 SAR/mo | 5 | 30 | 500 |
| Infinity ♾️ | 3,999 SAR/mo | ∞ | ∞ | ∞ |

### Pages Gated by Plan (16 total)
- **Infinity**: b2b-marketplace, partner-program, hardware-management, erp-accounting, bi-analytics, api-management, warehouse-management
- **Pro**: zatca-invoices, accounting-dashboard, gift-cards, loyalty-program, payroll, supplier-management, inventory-smart/dashboard, advanced-analytics

### Backend
- `server/qirox-admin.ts` has `PLAN_DEFAULTS` with full feature lists per tier and `SubscriptionConfigModel`.
- `POST /api/qirox/subscriptions` assigns plans to businesses.
- `GET /api/business-config` returns `subscription.plan` used by `usePlan()`.

### qirox-dashboard SubscriptionsTab
Fully dynamic plan management UI in the QIROX super admin panel:
- 3 plan cards (Lite/Pro/Infinity) with per-plan feature lists scrollable, color-coded badges, branch/employee/product limits at a glance.
- Full feature matrix table grouped by `category`, using `ALL_FEATURES` and `isFeatureInPlan()` — always in sync with `plan-features.ts`, no duplication.

## Recent Features (April 2026)

### Reservation Product Feature (يحتاج حجز مسبق)
- **Schema**: Added `isReservation: boolean` and `reservationPackages[]` (packageName, description, price, duration, maxGuests) to `ICoffeeItem` and `CoffeeItemSchema` in `shared/schema.ts`
- **Cart isolation**: Reservation products cannot be mixed with regular items. Enforced in `menu.tsx` via `checkReservationIsolation()` before adding to cart
- **Package selection**: `AddToCartModal` shows reservation package selector when product `isReservation=true`; validates package selection; price computed from selected package
- **Cart store**: `addToCart()` and POST `/api/cart` extended to accept `selectedReservationPackage`; composite cart ID includes package name to prevent collision
- **Delivery restriction**: `delivery-selection.tsx` detects `isReservationCart` and shows only "استلام / حضور في الفرع" option with reservation banner
- **Post-order flow**: `checkout.tsx` detects `wasReservationOrder`; success page shows prominent reservation banner with: date/time summary card, invoice download button + WhatsApp confirmation button that pre-fills order details including date/time
- **Management UI**: `employee-menu-management.tsx` has toggle + packages editor in both add and edit dialogs
- **Phase 2 — Reservation Date/Time (April 2026)**:
  - `delivery-selection.tsx`: date picker (tomorrow → +7 days) + from/to time range shown when `isReservationCart`. Validates: date required, from time required, to time required, from < to. Stored in `DeliveryInfo.productReservationDate/FromTime/ToTime`
  - `cart-store.ts`: `DeliveryInfo` extended with `productReservationDate`, `productReservationFromTime`, `productReservationToTime`
  - `checkout.tsx`: passes `isProductReservation`, `productReservationDate/FromTime/ToTime`, `productReservationStatus` to order data (both paths). WhatsApp message includes package name, formatted date, and time range
  - `shared/schema.ts` + `OrderSchema`: Added `isProductReservation`, `productReservationDate/FromTime/ToTime`, `productReservationStatus` (pending_payment→pending_confirmation→confirmed→rejected→cancelled→completed), `productReservationPackageName`, `productReservationNotes`
  - `server/routes.ts`: Added `GET /api/product-reservations` (employee), `GET /api/product-reservations/customer/:phone` (customer), `PATCH /api/product-reservations/:id/status` (employee)
  - `employee-product-reservations.tsx`: New page at `/employee/product-reservations` — shows all product reservations with status filter, search, expandable items, and status-change action buttons per workflow (e.g. pending_payment→confirm payment→pending_confirmation→confirm/reject)
  - `employee-dashboard.tsx`: Added "حجوزات المنتجات" button linking to the new page
  - `customer-reservations.tsx`: Now shows both table reservations and product reservations tabs after search; product tab shows date, time range, items, status, and "pay via WhatsApp" prompt for pending_payment status
  - Sample product `تجربة الرومانسية الخاصة` added to DB (id: `reservation-romance-001`, `isReservation: true`, 2 packages: Couple 250 SAR / Group 450 SAR)

## Recent Fixes (March 2026)

- **Payment "Coming Soon" Removed**: `comingSoon={false}` in `checkout.tsx` and `checkout-modal.tsx` — payment methods are now fully active
- **Product Add-ons Auto-confirm**: Products with no sizes, variants, or add-ons are added directly to cart without showing the customization dialog (`drink-customization-dialog.tsx`)
- **Design System Color Migration**: All pages migrated from old amber/golden brand colors to the new monochrome green design system (`hsl(155, 60%, 38%)`). 50+ pages fixed across the entire codebase.
- **`bg-background0` Bug Fixed**: Removed invalid CSS class `bg-background0` (typo) across 15+ files — replaced with `bg-primary`, `bg-primary/10`, `bg-primary/20`, etc. as appropriate.
- **Cart Addon CastError Fixed**: `ProductAddonModel.findOne({ id: addonId })` instead of `findById(addonId)` since `selectedAddons` stores nanoid strings, not MongoDB ObjectIds.
- **ForgotPassword Two-Path Flow**: Added email+phone path and phone+account-name path for users without email. Backend endpoints: `POST /api/customers/verify-phone-name` and `POST /api/customers/reset-password-by-phone-name`.
- **Fallback Image Fix**: Broken fallback `/placeholder-coffee.png` → `/images/default-coffee.png` in `table-menu.tsx`, `menu.tsx`, `menu-layouts.tsx`.
- **Missing Route Added**: `/manager/inventory/transfers` route added to App.tsx with lazy import for `InventoryTransfersPage`.
- **Green Color Fixes (Latest Session)**:
  - `order-card.tsx`: "Start Preparing" (بدء التحضير) buttons changed from `bg-amber-500` to `bg-primary`
  - `current-order-banner.tsx`: Coffee icon and heading text changed from amber to primary/foreground
  - `receipt-invoice.tsx`: Download PDF button amber styling removed (now uses standard outline)
  - `menu-layouts.tsx`: Best seller badges (الأكثر طلباً) changed from `bg-amber-500` to `bg-primary`
  - `pos-system.tsx`: Open bills count badge changed from `bg-orange-500` to `bg-primary`
- **PRESERVED intentional amber/orange**: Star rating stars, loyalty tier gold colors, payment gateway test mode banners, ZATCA warning text, order status "in transit" (orange), urgent order pulse badges, maintenance mode warning, promo notification type colors, low-stock warning indicators, "coming soon" payment method badges, kitchen delivery status indicators

## Replit Migration Notes (April 2026)

- Added `uuid` as a direct dependency because the server imports it at runtime during account setup.
- Replit dev preview uses the existing `Start application` workflow on port 5000 with `npm run dev`.
- Vite HMR is configured for Replit's proxied preview host in `vite.config.ts` and `server/vite.ts`.
- The app websocket server now handles only `/ws/orders` upgrades so it does not intercept Vite's development websocket.
- Service workers are unregistered/skipped in development to prevent stale cached bundles in the Replit preview while preserving production PWA behavior.
- PayMob automatic startup configuration now requires `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, and `PAYMOB_HMAC_SECRET` environment variables instead of hardcoded fallback credentials.

## Owner Menu Management Access (April 2026)

- Owner and admin roles can now fully access the menu management workflow for both drinks and food, including add/edit dialogs, branch availability, recipe/raw item editing, and category ordering.
- Owner dashboard includes direct buttons to open drinks management and food management.

## Quick Start

- **Dev**: `NODE_ENV=development node_modules/.bin/tsx server/index.ts` (starts server + Vite middleware on port 5000)
- **Build**: `npm run build` (builds frontend to dist/public/ and bundles server to dist/index.js)
- **Production**: `node dist/index.js` (serves pre-built assets)
- **Port**: 5000 (webview)
- **Workflow**: "Start application" workflow runs the dev command automatically on Replit

## Branding

- **Brand Name**: QIROX / QIROX Cafe / QIROX Systems
- **Tagline**: Build systems. Stay human.
- **Color Scheme**: White background, gray accents, black text, green (#2D9B6E) primary
- **Logo**: attached_assets/QIROX_LOGO_1773902267966.png
- **Customer Logo**: `@assets/qirox-logo-customer.png` (attached_assets/qirox-logo-customer.png)
- **Staff Logo**: `@assets/qirox-logo-staff.png` (attached_assets/qirox-logo-staff.png)
- **Receipt Logo**: `client/src/assets/qirox-logo.png`
- **Banner 1**: attached_assets/image_1773902463502.png
- **Banner 2**: attached_assets/image_1773902748715.png
- **Email Logo**: https://raw.githubusercontent.com/Darsh20009/QIROXsystem/main/client/public/logo.png
- **Service Worker Cache**: `blackrose-cache-v18`

## Environment Variables

- `MONGODB_URI` - MongoDB Atlas connection string
- `SESSION_SECRET` - Express session secret
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` - Web Push
- `SMTP2GO_API_KEY` - Email API key
- `SMTP_FROM` - `cafe@chefsplace.online`
- `SMTP_USER` - `Qirox`
- `NOTIFICATION_EMAIL` - `cafe@chefsplace.online`

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + Radix UI + TanStack Query + Framer Motion
- **Backend**: Express.js + TypeScript (tsx)
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Auth**: Express Session (cookie: qirox.sid)
- **Realtime**: WebSockets
- **Notifications**: Web Push (VAPID) + WebSocket + MongoDB
- **Security**: Helmet.js, rate limiting, HPP, mongo-sanitize
- **Payments**: Geidea (card/Apple Pay), Cash, QIROX Card (loyalty)
- **i18n**: Arabic (RTL) + English via react-i18next

## QIROX Super Admin Panel

- **URL**: `/qirox` (hidden, password-protected)
- **Password**: Configured in `server/qirox-admin.ts`
- **Features**: Full system control, tenant management, subscription management, analytics, system health, logs
- **API Routes**: `/api/qirox/*` (login, dashboard, tenants, subscriptions, analytics, system-health, logs)
- **Models**: QiroxAdmin, SubscriptionConfig, SystemLog (in `server/qirox-admin.ts`)

## Subscription Tiers

- **Lite** (لايت): POS, Kitchen Display, Customer App, Multi-Language, 1 branch, 5 employees
- **Pro** (برو): Everything in Lite + Inventory, Recipes, Accounting, Delivery, Loyalty, Gift Cards, Tables, Payroll, ZATCA, Analytics, 5 branches, 30 employees
- **Infinity** (إنفينيتي): Everything in Pro + Unlimited everything, API Access, ERP, Warehouse, Dedicated Support

## Project Structure

- `client/` - React frontend (Vite)
  - `client/src/pages/` - All page components
  - `client/src/pages/qirox-login.tsx` - Super admin login
  - `client/src/pages/qirox-dashboard.tsx` - Super admin dashboard
  - `client/src/components/` - Shared components + UI kit
  - `client/src/components/global-prompts.tsx` - Global notification + PWA install prompts (mounted in App.tsx)
  - `client/src/lib/` - Utilities, stores, hooks
  - `client/src/contexts/` - React contexts (Customer, Cart)
- `server/` - Express backend (TypeScript)
  - `server/index.ts` - Server entry point
  - `server/routes.ts` - All API routes (~15k lines)
  - `server/qirox-admin.ts` - Super admin routes, models, subscription system
  - `server/mail-service.ts` - Email templates
  - `server/smart-scheduler.ts` - Automated notifications
  - `client/src/pages/shift-management.tsx` - Cashier shift management & Z-Report UI
- `shared/` - Shared types and Mongoose schemas (includes CashierShiftModel)
- `public/` - Static assets, PWA manifests, service workers

## Design System

CSS Variables defined in `client/src/index.css`:
- Light mode: White bg (#fdfdfd), Black text (#171717), Green primary (#2D9B6E)
- Dark mode: Black bg (#0d0d0d), Light text (#f2f2f2), Green primary (#2D9B6E)
- Sidebar: Black (#141414)
- Font: IBM Plex Sans Arabic + Tajawal

## Payment Methods (Simplified)

- **نقدي** (Cash) - Default, always enabled
- **شبكة** (Card/Network) - Geidea مدى/فيزا/ماستر
- **بطاقة كيروكس** (QIROX Card) - Loyalty card balance

## Employee Permissions System

- **Permission Engine**: `server/permissions-engine.ts` — 42+ granular permissions, 14 page IDs, 6 roles
- **Roles**: cashier, barista, supervisor, branch_manager, owner, admin
- **Auth Middleware**: `server/middleware/auth.ts` — `requirePermission()` checks role defaults + employee-level overrides
- **Page Access**: `allowedPages` array on employee controls sidebar visibility; empty = role defaults
- **Permission Overrides**: `permissions` array on employee adds extra permissions on top of role defaults
- **Role Escalation Protection**: PATCH/DELETE enforce role hierarchy — managers cannot edit/delete same-or-higher roles
- **Admin UI**: `client/src/pages/admin-employees.tsx` — grouped permission checkboxes by category
- **Sidebar**: `client/src/components/employee-sidebar.tsx` — dynamically filters pages based on role + allowedPages

## Delivery Service Integration

- **Delivery Dashboard**: `client/src/pages/manager-delivery.tsx` — real stats, active orders, webhook URLs, driver status
- **Service Engine**: `server/delivery-service.ts` — zones, drivers, auto-assign, webhook processing, stats aggregation
- **Webhook Endpoint**: `POST /api/webhooks/delivery/:provider` — receives orders from HungerStation, Jahez, ToYou, Mrsool, etc.
- **Auto-Assign**: Nearest available driver is auto-assigned when integration has `autoAcceptOrders` or `autoAssignDriver` enabled
- **Stats API**: `GET /api/delivery/stats?period=today|week|month` — real-time delivery analytics
- **Providers**: noon_food, hunger_station, keeta, jahez, toyou, mrsool, careem, custom

## Multi-Branch Unified Reports

- **Unified Reports Page**: `client/src/pages/unified-reports.tsx` — 4 tabs: Overview, Branches, Trends, Export
- **API**: `GET /api/reports/unified?period=today|week|month|year` — aggregates all branches
- **Branch Comparison**: Side-by-side revenue, orders, avg order, customers per branch
- **Payment Breakdown**: Cash/Card/QIROX card split across branches
- **Daily Revenue Trend**: Line chart of revenue over period

## Accounting Export (قيود/دفترة)

- **Export API**: `GET /api/accounting/export?period=month&format=csv|json` — journal entries ready for import
- **Chart of Accounts**: 1101 (Cash), 1102 (Card/Mada), 1103 (QIROX Card), 4101 (Sales Revenue), 2201 (VAT)
- **VAT Calculation**: Automatic 15% VAT extraction from inclusive prices
- **Formats**: CSV (UTF-8 BOM for Excel/Arabic), JSON (for API integrations)
- **Compatible With**: قيود (Qoyod), دفترة (Daftra), زوهو (Zoho)

## BI Analytics

- **BI Analytics Page**: `client/src/pages/bi-analytics.tsx` — 4 tabs: Insights, Performance, Products, Patterns
- **Smart Insights**: Automatic analysis (revenue changes, peak hours, dead hours, low avg order)
- **Day Part Analysis**: Morning/Afternoon/Evening/Night breakdown
- **Product Mix**: Pie chart + ranked list with visual bars
- **Scatter Analysis**: Orders vs Revenue correlation by hour
- **Radar Chart**: Multi-branch comparison across 4 dimensions

---

## ALL FEATURES

### Customer Portal
1. Browse coffee menu with categories, search, and filters
2. Smart banner carousel with promotions
3. Add items to cart with size/addon customization
4. Multiple delivery modes: Branch Pickup, Home Delivery, Car Pickup (curbside)
5. Order tracking in real-time
6. Loyalty card with points, tiers, and free drinks
7. Referral program
8. Table QR ordering (scan QR → order from table)
9. Table reservations
10. Customer profile with order history
11. Favorites system
12. PWA install (installable app) with iOS guide + Android native prompt
13. Push notifications for order status (mandatory full-screen prompt on first visit via GlobalPrompts)
14. Multi-language (Arabic RTL / English)
15. Guest checkout (no registration required)

### Employee/Cashier Portal
1. POS system with product grid and cart
2. Kitchen Display System (KDS) for order preparation
3. Table management (assign, occupy, free)
4. Customer lookup by phone number
5. Loyalty point management (add/verify/redeem)
6. Order management and status updates
7. Attendance clock-in/clock-out with GPS verification
8. Leave request system
9. Menu item availability toggle
10. Reservation management
11. QR code login
12. Cash drawer control

### Manager Portal
1. Dashboard with KPIs (sales, orders, revenue)
2. Advanced analytics and reports
3. Employee management (add, edit, roles, permissions)
4. Inventory management (raw items, stock, alerts)
5. Recipe management (ingredients per menu item)
6. Supplier management
7. Purchase orders
8. Stock movements tracking
9. Accounting dashboard (sales, expenses, profit)
10. ERP with double-entry bookkeeping
11. ZATCA-compliant e-invoicing (Saudi VAT 15%)
12. Payroll management
13. Customer reviews and replies
14. Gift cards management
15. Loyalty program configuration
16. Delivery services management
17. Branch management (multi-location)
18. Table setup and QR codes
19. Warehouse management
20. External integrations

### Admin Portal
1. System-wide dashboard
2. All-branch management
3. Employee management across branches
4. Email marketing and templates
5. Business configuration (name, VAT, currency, hours)
6. Notification management
7. Role-based access control (Owner, Admin, Manager, Cashier, Kitchen, Driver)
8. Data management tools

### Driver Portal
1. Driver-specific login
2. Order assignment and pickup
3. Real-time GPS location updates
4. Delivery tracking
5. Delivery fee calculation based on distance/zone

---

## ALL CUSTOMER ROUTES

| Path | Page |
|------|------|
| `/` | Welcome/Landing page |
| `/welcome` | Welcome page |
| `/menu` | Coffee menu with categories |
| `/menu-view` | Alternative menu view |
| `/product/:id` | Product detail page |
| `/auth` | Customer login/register |
| `/customer-login` | Customer login |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset form |
| `/profile` | Customer profile |
| `/my-orders` | Order history |
| `/my-card` | Loyalty card |
| `/copy-card` | Card sharing |
| `/card-customization` | Card design |
| `/my-offers` | Available offers |
| `/referrals` | Referral program |
| `/cart` | Shopping cart |
| `/delivery` | Delivery mode selection |
| `/delivery/map` | Delivery map |
| `/checkout` | Checkout & payment |
| `/tracking` | Order tracking |
| `/delivery/track/:orderId` | Live delivery tracking |
| `/notifications` | Notifications list |
| `/payment-return` | Payment callback |
| `/table-menu/:qrToken` | Table QR menu |
| `/table-checkout/:tableId/:tableNumber` | Table checkout |
| `/table-reservation` | Book a table |
| `/my-reservations` | Customer reservations |
| `/table-order-tracking/:orderId` | Table order tracking |
| `/order-status` | Order status display |
| `/customer-display` | Customer-facing screen |

## ALL EMPLOYEE ROUTES

| Path | Page |
|------|------|
| `/employee` | Employee splash |
| `/0` | Employee splash (shortcut) |
| `/employee/gateway` | Employee gateway |
| `/employee/login` | Employee login |
| `/employee/forgot-password` | Password reset |
| `/employee/activate` | Account activation |
| `/employee/home` | Employee home |
| `/employee/dashboard` | Employee dashboard |
| `/employee/cashier` | Cashier interface |
| `/employee/pos` | POS system |
| `/employee/kitchen` | Kitchen display (KDS) |
| `/employee/tables` | Table management |
| `/employee/table-orders` | Table orders |
| `/employee/orders` | Order management |
| `/employee/orders-display` | Orders display board |
| `/employee/loyalty` | Loyalty management |
| `/employee/menu-management` | Menu editor (Manager+) |
| `/employee/ingredients` | Ingredients (Manager+) |
| `/employee/availability` | Item availability |
| `/employee/attendance` | Clock in/out |
| `/employee/leave-request` | Leave requests |
| `/employee/reservations` | Reservation management |

## ALL MANAGER ROUTES

| Path | Page |
|------|------|
| `/manager` | Manager login |
| `/manager/login` | Manager login |
| `/manager/forgot-password` | Password reset |
| `/manager/dashboard` | Manager dashboard |
| `/manager/employees` | Employee management |
| `/manager/drivers` | Driver management |
| `/manager/tables` | Table setup |
| `/manager/attendance` | Attendance reports |
| `/manager/inventory` | Inventory overview |
| `/manager/inventory/raw-items` | Raw materials |
| `/manager/inventory/suppliers` | Suppliers |
| `/manager/inventory/purchases` | Purchase orders |
| `/manager/inventory/recipes` | Recipes |
| `/manager/inventory/stock` | Stock levels |
| `/manager/inventory/alerts` | Low stock alerts |
| `/manager/inventory/movements` | Stock movements |
| `/manager/inventory/smart` | Smart inventory |
| `/manager/inventory/stock-organization` | Stock org |
| `/manager/accounting` | Accounting dashboard |
| `/manager/accounting/smart` | Smart accounting |
| `/manager/ingredients-recipes` | Ingredients & recipes |
| `/manager/os-inventory` | OS inventory |
| `/manager/unified-inventory` | Unified inventory |
| `/manager/zatca` | ZATCA invoices |
| `/manager/analytics` | Advanced analytics |
| `/manager/gift-cards` | Gift cards |
| `/manager/payroll` | Payroll |
| `/manager/reviews` | Customer reviews |
| `/manager/suppliers` | Supplier management |
| `/manager/loyalty` | Loyalty program |
| `/manager/integrations` | External integrations |
| `/manager/warehouse` | Warehouse management |
| `/manager/support` | Support system |
| `/manager/delivery-services` | Delivery services |
| `/manager/os-recipes` | OS recipes |
| `/manager/os-accounting` | OS accounting |
| `/manager/os-stock` | OS stock |
| `/manager/os-roles` | OS roles (Admin+) |
| `/manager/guide` | User guide |

## ALL ADMIN ROUTES

| Path | Page |
|------|------|
| `/admin/dashboard` | Admin dashboard |
| `/admin/employees` | Admin employees |
| `/admin/reports` | Admin reports |
| `/admin/settings` | Admin settings |
| `/admin/branches` | Branch management |
| `/admin/email` | Email management |
| `/admin/notifications` | Notification management |
| `/owner/dashboard` | Owner dashboard |
| `/executive` | Executive dashboard |

## ALL DRIVER ROUTES

| Path | Page |
|------|------|
| `/driver/login` | Driver login |
| `/driver/portal` | Driver portal |

## OTHER ROUTES

| Path | Page |
|------|------|
| `/guide` | User guide |
| `/unauthorized` | Unauthorized page |
| `/tenant/signup` | Tenant signup |
| `/recipes/management` | Recipe management |
| `/inventory/dashboard` | Inventory dashboard |
| `/accounting/dashboard` | Accounting dashboard |
| `/reports` | Reports page |
| `/stock-movements` | Stock movements |
| `/erp/accounting` | ERP accounting |

---

## KEY API ENDPOINTS

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/live` - Live orders
- `PATCH /api/orders/:id/status` - Update order status
- `GET /api/orders/kitchen` - Kitchen orders
- `GET /api/orders/active-display` - Customer display orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/car-pickup` - Car pickup details
- `DELETE /api/orders/bulk` - Bulk delete

### Menu & Products
- `GET /api/coffee-items` - Full menu
- `POST /api/coffee-items` - Add menu item
- `PATCH /api/coffee-items/:id/availability` - Toggle availability
- `GET /api/categories` - Menu categories

### Customers & Loyalty
- `POST /api/customers/register` - Register
- `POST /api/customers/login` - Login
- `GET /api/loyalty/cards/phone/:phone` - Lookup card
- `POST /api/loyalty/employee/add-points` - Add points
- `POST /api/loyalty/claim-free-drink` - Redeem reward
- `GET /api/customers/:id/orders` - Order history
- `POST /api/customers/favorites/:itemId` - Add favorite

### Employees & Attendance
- `POST /api/employees/login` - Login
- `POST /api/employees/login-qr` - QR login
- `POST /api/attendance/check-in` - Clock in
- `POST /api/attendance/check-out` - Clock out
- `GET /api/attendance/my-status` - Status

### Inventory & Recipes
- `GET /api/inventory/raw-items` - Raw items list
- `POST /api/inventory/raw-items` - Create raw item
- `GET /api/recipes/coffee-item/:coffeeItemId` - Get recipe
- `POST /api/recipes` - Create/update recipe
- `POST /api/inventory/movements` - Stock movements
- `GET /api/inventory/alerts` - Low stock alerts

### Accounting & ZATCA
- `GET /api/accounting/dashboard` - Financial overview
- `POST /api/accounting/expenses` - Record expense
- `GET /api/accounting/daily-summary` - Daily summary
- `POST /api/zatca/invoices` - Generate e-invoice

### Branches & Tables
- `GET /api/branches` - List branches
- `GET /api/tables` - List tables
- `POST /api/tables/book` - Reserve table
- `PATCH /api/tables/:id/occupancy` - Update occupancy
- `GET /api/tables/:id/qr-code` - Table QR code

### Delivery & Drivers
- `POST /api/delivery/drivers/login` - Driver login
- `PATCH /api/delivery/drivers/:id/location` - Update GPS
- `POST /api/delivery/calculate-fee` - Calculate fee
- `PATCH /api/orders/:id/assign-driver` - Assign driver

### System & Admin
- `GET /api/business-config` - Store settings
- `PATCH /api/business-config` - Update settings
- `POST /api/push/subscribe` - Push notification subscribe
- `POST /api/admin/send-email` - Send email
- `DELETE /api/admin/clear-all-data` - Clear database

### Notifications & Reviews
- `GET /api/notifications` - User notifications
- `POST /api/reviews/order/:orderId` - Submit review
- `PATCH /api/reviews/:id/reply` - Manager reply

### POS
- `GET /api/pos/status` - POS status
- `POST /api/pos/print-receipt` - Print receipt
- `POST /api/pos/cash-drawer/open` - Open cash drawer

## Bug Fixes (March 2026 Session)

### Fixed: Inventory Recipes Query URL
- `client/src/pages/inventory-recipes.tsx`: Added custom `queryFn` calling `/api/inventory/recipes/${coffeeItemId}` with `.items` extraction from `{ items, totalCost }` response

### Fixed: ERP Income Statement Fallback
- `server/erp-accounting-service.ts`: Added fallback to read directly from completed orders when no journal entries exist; also includes approved ERP expenses
- Route returns `{ success: true, incomeStatement: { source, totalRevenue, totalExpenses, cogs, grossProfit, netIncome, revenue, expenses } }`

### Fixed: ERP Expense Categories
- Added `operating` and `salary` to `IExpenseErp` interface, Mongoose schema enum, and `insertExpenseErpSchema` Zod (all 7 categories including 'operating' and 'salary' now work)

### Fixed: ERP Vendor Creation - Auto-generate Code
- `server/routes.ts` POST `/api/erp/vendors`: When `code` field not provided, auto-generates `VND-XXXX` format based on vendor count per tenant

### Fixed: Purchase Invoice Status Operations
- `server/storage.ts` methods `getPurchaseInvoice`, `updatePurchaseInvoice`, `receivePurchaseInvoice`, `updatePurchaseInvoicePayment`: Added fallback to `findById()` when `findOne({ id })` returns null (since PurchaseInvoiceSchema has no custom `id` field, only MongoDB `_id`)

### Fixed: Bank Transfer Receipt Upload Flow (Customer Checkout)
- `client/src/pages/checkout.tsx`: Added `receiptFile`/`receiptPreview`/`isUploadingReceipt` state, `handleReceiptFileChange`, `uploadReceiptToServer` function
- Added receipt upload UI (camera icon, file input, preview) that appears when a payment method with `requiresReceipt: true` is selected
- Added validation in `handleProceedPayment` to require receipt before proceeding
- Added `paymentReceiptUrl` to order data in `confirmAndCreateOrder` (uploads to `/api/upload-receipt` first, falls back to base64)

### Fixed: IBAN Display for Bank Transfer Methods
- `client/src/components/payment-methods.tsx`: Removed incorrect `method.id === 'mada'` condition — IBAN details now show for ANY method with `bankIban`/`bankName` field (including `rajhi`, `alinma`, etc.)

### Fixed: Receipt Display With Order
- `client/src/components/OrderMeta.tsx`: Re-enabled the "عرض الإيصال" button — was incorrectly commented out. Now shows when order has `paymentReceiptUrl`

### Fixed: Drive-Thru / Car Pickup UI Design
- `client/src/pages/delivery-selection.tsx`: Replaced dark neon/glow "DRIVE-THRU" design (lines 630-929) with clean professional card layout
- All functionality preserved: car brand selector, color picker, plate number (Saudi style), arrival time, save car, parking slot (1-12 grid), car summary

### Saudi Arabia Timezone (UTC+3)
- **Global utilities** in `server/routes.ts` (top of file, before `registerRoutes`): `getSaudiStartOfDay()` and `getSaudiEndOfDay()` return Date objects representing midnight/end-of-day in UTC+3
- These utilities are used across **all** date-filtered endpoints: accounting expenses/revenue, orders `today` filter, admin dashboard stats, delivery stats, analytics/advanced, reports/unified, accounting/export, and AI assistant context
- Zero `setHours(0,0,0,0)` UTC-based midnight calculations remain in routes.ts — every "today" boundary uses Saudi time

### `/api/orders` Endpoint Capabilities
- **DB-level filters**: `tenantId` (from session), `branchId` (query param OR session employee's branch), `status` (single or comma-separated), period (`today`/`week`/`month`/`year`), `fromDate`, `today=true`
- **Default limit**: 300 (override via `?limit=N`)
- `branchId` query param takes precedence over session branchId — allows admins to filter specific branches

### `/api/orders/live` Endpoint
- Uses `OrderModel.find()` directly (bypasses `storage.getOrders()`)
- Returns only active statuses: `pending, in_progress, ready, payment_confirmed, confirmed, preparing, serving`
- Default limit 150, DB-level tenant+branch filtering

### Key Known Behaviors
- Purchase invoice `invoiceNumber` auto-generation: creates `PO-YYYYMM-XXXXX` format
- ERP income statement source: `"orders"` when no journal entries, `"journal"` when accounts exist
- ERP expense approval flow: draft → pending_approval → approved → paid (via PATCH `/api/erp/expenses/:id/approve`)
- Dialog centering: `dialog.tsx` uses `inset-x-0 mx-auto` (not `left-[50%] translate-x-[-50%]`) to fix RTL/Arabic layout shift; close button uses `end-4` logical property

## Deployment

Configured for autoscale deployment:
- Build: `npm run build`
- Run: `node dist/index.js`
