import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import compression from "compression";
import path from "path";
import { cache } from "./cache";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { registerQiroxRoutes } from "./qirox-admin";
import { storage } from "./storage";
import { initWebPush } from "./push-service";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = (process.env.MONGODB_URI || "mongodb+srv://Vercel-Admin-atlas-crimson-desert:IijZOj693svjVN4f@atlas-crimson-desert.j0ix2zv.mongodb.net/?retryWrites=true&w=majority").trim();

// Track database connection status
let isDbConnected = false;
let isInitializing = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;

// Connect to MongoDB with robust error handling and retries
async function connectDatabase() {
  if (isInitializing) return;
  isInitializing = true;
  
  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 2,
    waitQueueTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    maxIdleTimeMS: 60000,
    retryWrites: true,
    retryReads: true,
  };

  try {
    console.log(`🔌 Attempting MongoDB connection (Attempt ${connectionRetries + 1})...`);
    await mongoose.connect(MONGODB_URI!, options);
    isDbConnected = true;
    connectionRetries = 0;
    console.log("✅ MongoDB connected successfully");
    // Drop old unique index on orderNumber (allows wrap-around counter at 1000)
    try {
      const { OrderModel } = await import("@shared/schema");
      await OrderModel.collection.dropIndex("orderNumber_1").catch(() => {});
      console.log("✅ Order number uniqueness migrated to allow counter wrap-around");
    } catch (_) {}
    // Ensure admin/owner accounts exist with correct credentials and full permissions
    try {
      const bcrypt = await import("bcryptjs");
      const { v4: uuidv4 } = await import("uuid");
      const { EmployeeModel } = await import("@shared/schema");

      const allPermissions = [
        'order.create','order.view','order.void','order.refund','order.apply_discount','order.modify',
        'kitchen.view_queue','kitchen.update_status',
        'inventory.view','inventory.stock_in','inventory.stock_out','inventory.waste','inventory.adjustment',
        'menu.view','menu.create','menu.edit','menu.delete',
        'recipe.view','recipe.create','recipe.edit',
        'reports.daily','reports.branch','reports.all_branches','reports.export',
        'employees.view','employees.create','employees.edit','employees.delete',
        'settings.branch','settings.cafe','settings.billing',
        'shift.open','shift.close','shift.view_history','shift.cash_movement',
        'pos.open_drawer','pos.apply_coupon',
        'tables.manage','delivery.manage',
        'accounting.view','accounting.export'
      ];
      const allPages = [
        'dashboard','cashier','pos','shifts','orders','kitchen','tables',
        'menu_management','inventory','reports','accounting','employees','settings',
        'delivery','unified_reports','bi_analytics','promotions','kiosk','notifications'
      ];

      const mongoose = await import("mongoose");
      const branch = await mongoose.default.connection.collection('branches').findOne({}, { projection: { id: 1 } });
      const branchId = (branch as any)?.id || '';

      // Sync OWNER account — password: 123456
      const ownerPassword = await bcrypt.hash("123456", 10);
      const ownerExists = await EmployeeModel.findOne({ username: "owner" });
      if (!ownerExists) {
        await EmployeeModel.create({
          id: uuidv4(), tenantId: "demo-tenant", username: "owner",
          password: ownerPassword, fullName: "المالك", role: "owner",
          phone: "0000000001", jobTitle: "المالك",
          branchId, permissions: allPermissions, allowedPages: allPages,
          isActivated: 1, isActive: 1,
        });
        console.log(`✅ Owner account created`);
      } else {
        await EmployeeModel.updateOne(
          { username: "owner" },
          { $set: { password: ownerPassword, role: "owner", branchId, permissions: allPermissions, allowedPages: allPages, isActivated: 1, isActive: 1 } }
        );
        console.log(`✅ Portal account 'owner' synced`);
      }

      // Sync ADMIN account — password: admin
      const adminPassword = await bcrypt.hash("admin", 10);
      const adminExists = await EmployeeModel.findOne({ username: "admin" });
      if (!adminExists) {
        await EmployeeModel.create({
          id: uuidv4(), tenantId: "demo-tenant", username: "admin",
          password: adminPassword, fullName: "المسؤول", role: "admin",
          phone: "0000000002", jobTitle: "مسؤول النظام",
          branchId, permissions: allPermissions, allowedPages: allPages,
          isActivated: 1, isActive: 1,
        });
        console.log(`✅ Admin account created`);
      } else {
        await EmployeeModel.updateOne(
          { username: "admin" },
          { $set: { password: adminPassword, role: "admin", branchId, permissions: allPermissions, allowedPages: allPages, isActivated: 1, isActive: 1 } }
        );
        console.log(`✅ Portal account 'admin' synced`);
      }
    } catch (err) { console.error("Owner/Admin sync error:", err); }
    // Ensure demo-tenant has Infinity plan — all features unlocked
    try {
      const { SubscriptionConfigModel } = await import("./qirox-admin");
      await SubscriptionConfigModel.findOneAndUpdate(
        { tenantId: 'demo-tenant' },
        {
          $set: {
            plan: 'infinity',
            isActive: true,
            maxBranches: 999,
            maxEmployees: 9999,
            maxProducts: 9999,
            maxOrders: 999999,
            customBranding: true,
            apiAccess: true,
            advancedAnalytics: true,
            multiLanguage: true,
            inventoryManagement: true,
            recipeManagement: true,
            accountingModule: true,
            erpIntegration: true,
            deliveryManagement: true,
            loyaltyProgram: true,
            giftCards: true,
            tableManagement: true,
            kitchenDisplay: true,
            customerApp: true,
            posSystem: true,
            payrollManagement: true,
            supplierManagement: true,
            warehouseManagement: true,
            zatcaCompliance: true,
            supportPriority: 'dedicated',
            activatedBy: 'system',
            updatedAt: new Date(),
          }
        },
        { upsert: true, new: true }
      );
      console.log("✅ Subscription: Infinity plan — all features unlocked");
    } catch (_) {}
    // Seed promotional discount code CHEFSPLACE10 (10% off, shareable promo link)
    // Hidden from customers by default — admin can toggle visibility from admin settings.
    try {
      const { DiscountCodeModel } = await import("@shared/schema");
      await DiscountCodeModel.findOneAndUpdate(
        { code: "CHEFSPLACE10" },
        {
          $setOnInsert: {
            code: "CHEFSPLACE10",
            discountPercentage: 10,
            reason: "كوبون ترويجي 10% - رابط خاص",
            employeeId: "system",
            isActive: 1,
            usageCount: 0,
            visibleToCustomers: false,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      // One-time migration: hide previously auto-visible seeded code without
      // overriding any subsequent manual change (marker prevents re-applying).
      await DiscountCodeModel.updateOne(
        { code: "CHEFSPLACE10", _seedHiddenV1: { $exists: false } },
        { $set: { visibleToCustomers: false, _seedHiddenV1: true } }
      );
      console.log("✅ Promo code CHEFSPLACE10 (10% off) is ready (hidden by default)");
    } catch (err) {
      console.error("CHEFSPLACE10 seed error:", err);
    }
    // Seed discount code CHEF10 — خصم موظفي مكان الشيف (10% off, POS use)
    // Hidden from customers by default — admin can toggle visibility from admin settings.
    try {
      const { DiscountCodeModel } = await import("@shared/schema");
      await DiscountCodeModel.findOneAndUpdate(
        { code: "TECH10" },
        {
          $setOnInsert: {
            code: "TECH10",
            discountPercentage: 10,
            reason: "خصم موظفي مكان الشيف",
            employeeId: "system",
            isActive: 1,
            usageCount: 0,
            visibleToCustomers: false,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      // One-time migration: hide previously auto-visible seeded code without
      // overriding any subsequent manual change (marker prevents re-applying).
      await DiscountCodeModel.updateOne(
        { code: "TECH10", _seedHiddenV1: { $exists: false } },
        { $set: { visibleToCustomers: false, _seedHiddenV1: true } }
      );
      console.log("✅ Discount code TECH10 (خصم موظفي مكان الشيف — 10% off) is ready (hidden by default)");
    } catch (err) {
      console.error("TECH10 seed error:", err);
    }
  } catch (error) {
    isDbConnected = false;
    console.error("❌ MongoDB connection error:", error);
    
    if (connectionRetries < MAX_RETRIES) {
      connectionRetries++;
      const delay = Math.min(1000 * Math.pow(2, connectionRetries), 30000);
      console.log(`🔄 Retrying in ${delay / 1000}s...`);
      setTimeout(() => {
        isInitializing = false;
        connectDatabase();
      }, delay);
    } else {
      console.error("❌ Max retries reached. Database functionality will be unavailable.");
    }
  } finally {
    isInitializing = false;
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('📡 MongoDB disconnected. Attempting to reconnect...');
  isDbConnected = false;
  connectDatabase();
});

mongoose.connection.on('error', (err) => {
  console.error('📡 MongoDB error:', err);
  isDbConnected = false;
});

// Start database connection in background
connectDatabase();

// Initialize Web Push
initWebPush();

// Start smart notification scheduler (runs after 5s to allow DB to connect)
import("./smart-scheduler").then(({ startSmartScheduler }) => {
  setTimeout(startSmartScheduler, 5000);
}).catch((err) => console.error("[SCHEDULER] Failed to load:", err));

// Scheduled task: Clean up expired table reservations and send notifications
let isMaintenanceRunning = false;
setInterval(async () => {
  if (isMaintenanceRunning || !isDbConnected) return;
  
  isMaintenanceRunning = true;
  try {
    const { TableModel, CustomerModel } = await import("@shared/schema");
    const { sendReservationExpiryWarningEmail } = await import("./mail-service");

    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

    // 1. Check for expired reservations
    const expiredTables = await TableModel.find({
      'reservedFor.status': { $in: ['pending', 'confirmed'] },
      'reservedFor.autoExpiryTime': { $lt: now }
    });

    let expiredCount = 0;
    for (const table of expiredTables) {
      if (table.reservedFor) {
        table.reservedFor.status = 'expired';
        await table.save();
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`🔄 Cleaned ${expiredCount} expired reservations`);
    }

    // 2. Send expiry warnings (15 minutes before expiry)
    const warningTables = await TableModel.find({
      'reservedFor.status': { $in: ['pending', 'confirmed'] },
      'reservedFor.autoExpiryTime': {
        $gte: now,
        $lte: fifteenMinutesFromNow
      },
      'reservedFor.emailNotificationSent': { $ne: true }
    });

    for (const table of warningTables) {
      if (table.reservedFor && table.reservedFor.autoExpiryTime) {
        try {
          const customer = await CustomerModel.findOne({
            phone: table.reservedFor.customerPhone
          });

          if (customer && customer.email) {
            const emailSent = await sendReservationExpiryWarningEmail(
              customer.email,
              table.reservedFor.customerName,
              table.tableNumber,
              table.reservedFor.autoExpiryTime.toString()
            );

            if (emailSent) {
              table.reservedFor.emailNotificationSent = true;
              await table.save();
              console.log(`📧 Expiry warning sent to ${customer.email}`);
            }
          }
        } catch (error) {
          console.error(`Failed to send expiry warning for table ${table.tableNumber}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Maintenance task error:", error);
  } finally {
    isMaintenanceRunning = false;
  }
}, 60000); // Run every 60 seconds (1 minute)

const app = express();

// ─── SECURITY LAYER ────────────────────────────────────────────────────────────

// 1. Helmet: Sets 14 security HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
// Skip helmet in development to avoid CSP conflicts with Vite dev server
if (process.env.NODE_ENV === 'development') {
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
} else {
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://*.geidea.net",
          "https://*.paymob.com",
          "blob:",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.geidea.net", "https://*.paymob.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://*.geidea.net", "https://*.paymob.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          "https://*.geidea.net",
          "https://*.paymob.com",
        ],
        frameSrc: [
          "'self'",
          "https://*.geidea.net",
          "https://js.geidea.net",
          "https://*.paymob.com",
          "https://accept.paymob.com",
          "https://ksa.paymob.com",
        ],
        frameAncestors: ["'self'", "https://*.paymob.com"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
}

// 2. Rate limiting — strict for auth, relaxed for general API
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  skip: (req) => process.env.NODE_ENV === "development",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => process.env.NODE_ENV === "development",
});

app.use("/api/employees/login", authLimiter);
app.use("/api/customers/login", authLimiter);
app.use("/api/customers/register", authLimiter);
app.use("/api", apiLimiter);

// 3. Enable gzip compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// 4. NoSQL Injection protection (strips $ and . from request body/query/params)
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Sanitized suspicious key "${key}" from ${req.ip}`);
  },
}));

// 5. HTTP Parameter Pollution protection
app.use(hpp());

// Trust proxy - required for QIROX Studio and other reverse proxy services
app.set('trust proxy', 1);

// Configure allowed hosts for QIROX Studio
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, x-employee-id, x-restore-key');
  next();
});

// 6. Disable X-Powered-By header
app.disable('x-powered-by');

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false, 
    name: 'qirox.sid', // custom cookie name
    store: MongoStore.create({
      mongoUrl: MONGODB_URI!,
      collectionName: 'sessions',
      ttl: 30 * 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 3600,
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', 
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: "/",
    },
  })
);

// Session debug middleware — only active in development
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_SESSION === 'true') {
    if (req.path.startsWith('/api/orders') || req.path.startsWith('/api/employees/login')) {
      console.log(`  - Session ID:`, req.sessionID);
      console.log(`  - Employee:`, req.session?.employee ? 'EXISTS' : 'MISSING');
      console.log(`  - Cookie:`, req.headers.cookie ? 'PRESENT' : 'MISSING');
    }
  }
  next();
});

// Health check endpoint for Render and other hosting services
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    pool: { max: 50, min: 10 },
    cache: cache.stats(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Middleware to ensure DB connection for API routes
app.use('/api', (req, res, next) => {
  if (!isDbConnected && mongoose.connection.readyState !== 1) {
    console.error(`🚨 API Request failed: Database not connected (State: ${mongoose.connection.readyState})`);
    // Attempt to reconnect in background
    connectDatabase();
    return res.status(503).json({ 
      message: "خدمة قاعدة البيانات غير متوفرة حالياً، يرجى المحاولة مرة أخرى خلال ثوانٍ.",
      retryAfter: 5
    });
  }
  next();
});

// IMPORTANT: Ensure /api, /attached_assets, and health routes are handled BEFORE SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/attached_assets') || 
      req.path === '/healthz' || 
      req.path === '/health') {
    return next();
  }
  next();
});

// Serve attached assets for both development and production
app.use('/attached_assets', express.static(path.resolve(__dirname, '..', 'attached_assets'), {
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400'); // 7 days
    if (filePath.endsWith('.png')) res.set('Content-Type', 'image/png');
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.set('Content-Type', 'image/jpeg');
    if (filePath.endsWith('.webp')) res.set('Content-Type', 'image/webp');
  }
}));

// Serve public static files (audio, images, icons) explicitly so Vite dev middleware doesn't intercept
app.use(express.static(path.resolve(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4') || filePath.endsWith('.mp3') || filePath.endsWith('.ogg') || filePath.endsWith('.wav')) {
      res.set('Content-Type', filePath.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=604800'); // 7 days
    } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.webp') || filePath.endsWith('.ico') || filePath.endsWith('.svg')) {
      res.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400'); // 7 days
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  registerQiroxRoutes(app);
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Error:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, "0.0.0.0", async () => {
    log(`serving on port ${port}`);

    // Auto-configure PayMob Saudi Arabia payment gateway when credentials are provided
    try {
      const { BusinessConfigModel } = await import("./models");
      const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY;
      const PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY;
      const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

      if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !PAYMOB_HMAC_SECRET) {
        console.log('ℹ️ PayMob credentials not configured; skipping automatic payment gateway setup');
        return;
      }

      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      if (config) {
        const pg = config.paymentGateway;
        const needsUpdate = pg?.provider !== 'paymob' ||
          !pg?.paymob?.secretKey ||
          !pg?.paymob?.publicKey;

        if (needsUpdate) {
          await BusinessConfigModel.updateOne(
            { tenantId: 'demo-tenant' },
            {
              $set: {
                'paymentGateway.provider': 'paymob',
                'paymentGateway.paymob.secretKey': PAYMOB_SECRET_KEY,
                'paymentGateway.paymob.publicKey': PAYMOB_PUBLIC_KEY,
                'paymentGateway.paymob.hmacSecret': PAYMOB_HMAC_SECRET,
                'paymentGateway.paymob.baseUrl': 'https://ksa.paymob.com',
                'paymentGateway.paymob.integrationIds': [24948],
                'paymentGateway.cashEnabled': false,
                'paymentGateway.stcPayEnabled': false,
                'paymentGateway.qahwaCardEnabled': true,
              }
            }
          );
          console.log('✅ PayMob Saudi Arabia payment gateway configured automatically');
        } else {
          console.log('✅ PayMob Saudi Arabia payment gateway already configured');
        }
      }
    } catch (err) {
      console.error('❌ Failed to auto-configure PayMob:', err);
    }
    
    // Verify Mail Service on startup
    try {
      const { testEmailConnection } = await import("./mail-service");
      console.log("📧 Performing startup email connection test...");
      const success = await testEmailConnection();
      if (success) {
        console.log("✅ Mail service verified and ready on startup");
      } else {
        console.error("❌ Mail service failed verification on startup. Check credentials and connectivity.");
      }
    } catch (err) {
      console.error("❌ Error during mail service startup test:", err);
    }
  });
})();
