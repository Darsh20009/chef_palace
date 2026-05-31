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

const MONGODB_URI = process.env.MONGODB_URI?.trim();

// Global MongoDB connection cache — prevents reconnecting on every cold start
declare global {
  var _mongoConnPromise: Promise<void> | undefined;
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

  if (!global._mongoConnPromise) {
    global._mongoConnPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
    }).then(() => {
      console.log("✅ MongoDB connected (Vercel)");
    }).catch((err) => {
      global._mongoConnPromise = undefined;
      throw err;
    });
  }

  await global._mongoConnPromise;
}

// Build Express app
const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api/employees/login", authLimiter);
app.use("/api/customers/login", authLimiter);
app.use("/api/customers/register", authLimiter);
app.use("/api", apiLimiter);

app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));
app.use(hpp());
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With, x-employee-id, x-restore-key");
  next();
});

app.disable("x-powered-by");

if (MONGODB_URI) {
  app.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret",
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
  }));
}

app.get("/healthz", (_req, res) => res.status(200).send("OK"));
app.get("/health", (_req, res) => res.status(200).json({
  status: "ok",
  timestamp: new Date().toISOString(),
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
}));

app.use("/api", async (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try { await connectDatabase(); } catch {
      return res.status(503).json({ message: "خدمة قاعدة البيانات غير متوفرة، يرجى المحاولة مرة أخرى.", retryAfter: 5 });
    }
  }
  next();
});

// One-time initialization per serverless instance
let initialized = false;
let initPromise: Promise<void> | null = null;

async function initialize() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await connectDatabase();
    initWebPush();
    registerQiroxRoutes(app);
    await registerRoutes(app, { skipWebSocket: true });

    // Error handler — must be added AFTER all routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({ message: err.message || "Internal Server Error" });
    });

    initialized = true;
  })();

  return initPromise;
}

// Warm start: initialize on module load
initialize().catch(console.error);

// Vercel serverless handler
export default async function handler(req: Request, res: Response) {
  if (!MONGODB_URI) {
    return res.status(500).json({ error: "MONGODB_URI environment variable is not set" });
  }
  await initialize();
  return app(req, res);
}
