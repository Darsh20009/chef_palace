import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import compression from "compression";
import mongoose from "mongoose";
import { registerRoutes } from "./routes";
import { registerQiroxRoutes } from "./qirox-admin";
import { initWebPush } from "./push-service";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

const MONGODB_URI = (process.env.MONGODB_URI || "mongodb+srv://chefsplace:chefsplace123@chefsplace.zy8ckot.mongodb.net/?appName=chefsplace").trim();

// Global MongoDB connection cache — prevents reconnecting on every cold start
declare global {
  var _mongoConnPromise: Promise<void> | undefined;
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;

  if (!global._mongoConnPromise) {
    global._mongoConnPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 5,
        minPoolSize: 1,
        retryWrites: true,
        retryReads: true,
      })
      .then(() => {
        console.log("✅ MongoDB connected (Vercel)");
      })
      .catch((err) => {
        global._mongoConnPromise = undefined;
        throw err;
      });
  }

  await global._mongoConnPromise;
}

// Seed owner/admin accounts and subscription once per cold start
let seeded = false;
async function seedInitialData() {
  if (seeded) return;
  seeded = true;
  try {
    const bcrypt = await import("bcryptjs");
    const { v4: uuidv4 } = await import("uuid");
    const { EmployeeModel } = await import("@shared/schema");

    const allPermissions = [
      "order.create","order.view","order.void","order.refund","order.apply_discount","order.modify",
      "kitchen.view_queue","kitchen.update_status",
      "inventory.view","inventory.stock_in","inventory.stock_out","inventory.waste","inventory.adjustment",
      "menu.view","menu.create","menu.edit","menu.delete",
      "recipe.view","recipe.create","recipe.edit",
      "reports.daily","reports.branch","reports.all_branches","reports.export",
      "employees.view","employees.create","employees.edit","employees.delete",
      "settings.branch","settings.cafe","settings.billing",
      "shift.open","shift.close","shift.view_history","shift.cash_movement",
      "pos.open_drawer","pos.apply_coupon",
      "tables.manage","delivery.manage",
      "accounting.view","accounting.export",
    ];
    const allPages = [
      "dashboard","cashier","pos","shifts","orders","kitchen","tables",
      "menu_management","inventory","reports","accounting","employees","settings",
      "delivery","unified_reports","bi_analytics","promotions","kiosk","notifications",
    ];

    const branch = await mongoose.connection
      .collection("branches")
      .findOne({}, { projection: { id: 1 } });
    const branchId = (branch as any)?.id || "";

    // Sync OWNER — password: 123456
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
    } else {
      await EmployeeModel.updateOne(
        { username: "owner" },
        { $set: { password: ownerPassword, role: "owner", branchId, permissions: allPermissions, allowedPages: allPages, isActivated: 1, isActive: 1 } }
      );
    }

    // Sync ADMIN — password: admin
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
    } else {
      await EmployeeModel.updateOne(
        { username: "admin" },
        { $set: { password: adminPassword, role: "admin", branchId, permissions: allPermissions, allowedPages: allPages, isActivated: 1, isActive: 1 } }
      );
    }

    // Ensure Infinity plan
    const { SubscriptionConfigModel } = await import("./qirox-admin");
    await SubscriptionConfigModel.findOneAndUpdate(
      { tenantId: "demo-tenant" },
      {
        $set: {
          plan: "infinity", isActive: true,
          maxBranches: 999, maxEmployees: 9999, maxProducts: 9999, maxOrders: 999999,
          customBranding: true, apiAccess: true, advancedAnalytics: true, multiLanguage: true,
          inventoryManagement: true, recipeManagement: true, accountingModule: true,
          erpIntegration: true, deliveryManagement: true, loyaltyProgram: true,
          giftCards: true, tableManagement: true, kitchenDisplay: true, customerApp: true,
          posSystem: true, payrollManagement: true, supplierManagement: true,
          warehouseManagement: true, zatcaCompliance: true,
          supportPriority: "dedicated", activatedBy: "system", updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log("✅ Vercel: seed complete (owner/admin/subscription)");
  } catch (err) {
    console.error("Vercel seed error:", err);
    seeded = false; // allow retry on next request
  }
}

// Build Express app
const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.geidea.net", "https://*.paymob.com", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:", "https://*.geidea.net", "https://*.paymob.com"],
        frameSrc: ["'self'", "https://*.geidea.net", "https://*.paymob.com", "https://accept.paymob.com"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api/employees/login",    authLimiter);
app.use("/api/customers/login",    authLimiter);
app.use("/api/customers/register", authLimiter);
app.use("/api", apiLimiter);

app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));
app.use(hpp());
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS,PATCH");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With, x-employee-id, x-restore-key");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(
    session({
      secret: process.env.SESSION_SECRET || "qirox-vercel-secret-2025",
      resave: false,
      saveUninitialized: false,
      name: "qirox.sid",
      store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: "sessions",
        ttl: 30 * 24 * 60 * 60,
        autoRemove: "native",
        touchAfter: 24 * 3600,
      }),
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "none",
        path: "/",
      },
    })
  );

app.get("/healthz", (_req, res) => res.status(200).send("OK"));
app.get("/health", (_req, res) =>
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    env: "vercel",
  })
);

// Ensure DB is connected before any API call
app.use("/api", async (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDatabase();
    } catch (err) {
      console.error("DB connection failed:", err);
      return res.status(503).json({
        message: "خدمة قاعدة البيانات غير متوفرة، يرجى المحاولة مرة أخرى.",
        retryAfter: 5,
      });
    }
  }
  next();
});

// One-time initialization per cold start
let initialized = false;
let initPromise: Promise<void> | null = null;

async function initialize() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await connectDatabase();
    await seedInitialData();
    initWebPush();
    registerQiroxRoutes(app);
    await registerRoutes(app, { skipWebSocket: true });

    // Error handler — must be AFTER all routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("[Vercel Error]", err);
      res.status(status).json({ message });
    });

    initialized = true;
    console.log("✅ Vercel app initialized");
  })();

  return initPromise;
}

// Warm start on module load (runs when the function container starts)
initialize().catch(console.error);

// Vercel serverless handler export
export default async function handler(req: Request, res: Response) {
  try {
    await initialize();
  } catch (err) {
    console.error("Init failed:", err);
    return res.status(503).json({ message: "Server initialization failed. Please try again." });
  }
  return app(req, res);
}
