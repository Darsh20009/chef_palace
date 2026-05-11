import { Router, Request, Response, NextFunction } from "express";
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

export interface IQiroxAdmin extends Document {
  passwordHash: string;
  sessionToken?: string;
  lastLogin?: Date;
  createdAt: Date;
}

const QiroxAdminSchema = new Schema<IQiroxAdmin>({
  passwordHash: { type: String, required: true },
  sessionToken: { type: String },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const QiroxAdminModel = mongoose.models['QiroxAdmin'] || mongoose.model<IQiroxAdmin>("QiroxAdmin", QiroxAdminSchema);

export type SubscriptionPlan = 'lite' | 'pro' | 'infinity';

export interface ISubscriptionConfig extends Document {
  tenantId: string;
  plan: SubscriptionPlan;
  features: Record<string, boolean>;
  maxBranches: number;
  maxEmployees: number;
  maxProducts: number;
  maxOrders: number;
  customBranding: boolean;
  apiAccess: boolean;
  advancedAnalytics: boolean;
  multiLanguage: boolean;
  inventoryManagement: boolean;
  recipeManagement: boolean;
  accountingModule: boolean;
  erpIntegration: boolean;
  deliveryManagement: boolean;
  loyaltyProgram: boolean;
  giftCards: boolean;
  tableManagement: boolean;
  kitchenDisplay: boolean;
  customerApp: boolean;
  posSystem: boolean;
  payrollManagement: boolean;
  supplierManagement: boolean;
  warehouseManagement: boolean;
  zatcaCompliance: boolean;
  supportPriority: 'basic' | 'priority' | 'dedicated';
  isActive: boolean;
  activatedAt: Date;
  expiresAt?: Date;
  activatedBy: string;
  updatedAt: Date;
}

const SubscriptionConfigSchema = new Schema<ISubscriptionConfig>({
  tenantId: { type: String, required: true, unique: true },
  plan: { type: String, enum: ['lite', 'pro', 'infinity'], default: 'lite' },
  features: { type: Schema.Types.Mixed, default: {} },
  maxBranches: { type: Number, default: 1 },
  maxEmployees: { type: Number, default: 5 },
  maxProducts: { type: Number, default: 50 },
  maxOrders: { type: Number, default: 500 },
  customBranding: { type: Boolean, default: false },
  apiAccess: { type: Boolean, default: false },
  advancedAnalytics: { type: Boolean, default: false },
  multiLanguage: { type: Boolean, default: true },
  inventoryManagement: { type: Boolean, default: false },
  recipeManagement: { type: Boolean, default: false },
  accountingModule: { type: Boolean, default: false },
  erpIntegration: { type: Boolean, default: false },
  deliveryManagement: { type: Boolean, default: false },
  loyaltyProgram: { type: Boolean, default: false },
  giftCards: { type: Boolean, default: false },
  tableManagement: { type: Boolean, default: false },
  kitchenDisplay: { type: Boolean, default: false },
  customerApp: { type: Boolean, default: true },
  posSystem: { type: Boolean, default: false },
  payrollManagement: { type: Boolean, default: false },
  supplierManagement: { type: Boolean, default: false },
  warehouseManagement: { type: Boolean, default: false },
  zatcaCompliance: { type: Boolean, default: false },
  supportPriority: { type: String, enum: ['basic', 'priority', 'dedicated'], default: 'basic' },
  isActive: { type: Boolean, default: true },
  activatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  activatedBy: { type: String, default: 'system' },
  updatedAt: { type: Date, default: Date.now },
});

export const SubscriptionConfigModel = mongoose.models['SubscriptionConfig'] || mongoose.model<ISubscriptionConfig>("SubscriptionConfig", SubscriptionConfigSchema);

export interface ISystemLog extends Document {
  action: string;
  details: string;
  performedBy: string;
  targetTenant?: string;
  ipAddress?: string;
  timestamp: Date;
}

const SystemLogSchema = new Schema<ISystemLog>({
  action: { type: String, required: true },
  details: { type: String },
  performedBy: { type: String, default: 'qirox-admin' },
  targetTenant: { type: String },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now },
});

SystemLogSchema.index({ timestamp: -1 });
SystemLogSchema.index({ action: 1 });

export const SystemLogModel = mongoose.models['SystemLog'] || mongoose.model<ISystemLog>("SystemLog", SystemLogSchema);

const PLAN_DEFAULTS: Record<SubscriptionPlan, Partial<ISubscriptionConfig>> = {
  lite: {
    maxBranches: 1,
    maxEmployees: 5,
    maxProducts: 50,
    maxOrders: 500,
    customBranding: false,
    apiAccess: false,
    advancedAnalytics: false,
    multiLanguage: true,
    inventoryManagement: false,
    recipeManagement: false,
    accountingModule: false,
    erpIntegration: false,
    deliveryManagement: false,
    loyaltyProgram: false,
    giftCards: false,
    tableManagement: false,
    kitchenDisplay: true,
    customerApp: true,
    posSystem: true,
    payrollManagement: false,
    supplierManagement: false,
    warehouseManagement: false,
    zatcaCompliance: false,
    supportPriority: 'basic',
  },
  pro: {
    maxBranches: 5,
    maxEmployees: 30,
    maxProducts: 500,
    maxOrders: 10000,
    customBranding: true,
    apiAccess: false,
    advancedAnalytics: true,
    multiLanguage: true,
    inventoryManagement: true,
    recipeManagement: true,
    accountingModule: true,
    erpIntegration: false,
    deliveryManagement: true,
    loyaltyProgram: true,
    giftCards: true,
    tableManagement: true,
    kitchenDisplay: true,
    customerApp: true,
    posSystem: true,
    payrollManagement: true,
    supplierManagement: true,
    warehouseManagement: false,
    zatcaCompliance: true,
    supportPriority: 'priority',
  },
  infinity: {
    maxBranches: 999,
    maxEmployees: 9999,
    maxProducts: 99999,
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
  },
};

const SUPER_ADMIN_PASSWORD = "11222333344444555555";

async function ensureSuperAdmin() {
  const existing = await QiroxAdminModel.findOne();
  if (!existing) {
    const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
    await QiroxAdminModel.create({ passwordHash: hash });
  }
}

interface QiroxAuthRequest extends Request {
  qiroxAdmin?: IQiroxAdmin;
}

function requireQiroxAuth(req: QiroxAuthRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-qirox-token'] as string || (req.session as any)?.qiroxToken;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  QiroxAdminModel.findOne({ sessionToken: token }).then(admin => {
    if (!admin) {
      return res.status(401).json({ error: "Invalid session" });
    }
    req.qiroxAdmin = admin;
    next();
  }).catch(() => res.status(500).json({ error: "Auth error" }));
}

export function registerQiroxRoutes(app: ReturnType<typeof Router> | any) {
  ensureSuperAdmin();

  const qiroxLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many login attempts. Try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/qirox/login", qiroxLoginLimiter, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password required" });
      }

      const admin = await QiroxAdminModel.findOne();
      if (!admin) {
        return res.status(401).json({ error: "System not configured" });
      }

      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        await SystemLogModel.create({
          action: 'login_failed',
          details: 'Failed super admin login attempt',
          ipAddress: req.ip,
        });
        return res.status(401).json({ error: "Invalid password" });
      }

      const sessionToken = crypto.randomBytes(48).toString('hex');
      admin.sessionToken = sessionToken;
      admin.lastLogin = new Date();
      await admin.save();

      (req.session as any).qiroxToken = sessionToken;

      await SystemLogModel.create({
        action: 'login_success',
        details: 'Super admin logged in',
        ipAddress: req.ip,
      });

      res.json({ success: true, token: sessionToken });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/verify", requireQiroxAuth, (req: QiroxAuthRequest, res: Response) => {
    res.json({ authenticated: true, lastLogin: req.qiroxAdmin?.lastLogin });
  });

  app.post("/api/qirox/logout", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      if (req.qiroxAdmin) {
        req.qiroxAdmin.sessionToken = undefined;
        await req.qiroxAdmin.save();
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/dashboard", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const CafeCollection = mongoose.connection.collection('cafes');
      const EmployeeCollection = mongoose.connection.collection('employees');
      const OrderCollection = mongoose.connection.collection('orders');
      const CustomerCollection = mongoose.connection.collection('customers');
      const BranchCollection = mongoose.connection.collection('branches');

      const [tenants, employees, orders, customers, branches, subscriptions, recentLogs] = await Promise.all([
        CafeCollection.countDocuments(),
        EmployeeCollection.countDocuments(),
        OrderCollection.countDocuments(),
        CustomerCollection.countDocuments(),
        BranchCollection.countDocuments(),
        SubscriptionConfigModel.find().lean(),
        SystemLogModel.find().sort({ timestamp: -1 }).limit(50).lean(),
      ]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = await OrderCollection.countDocuments({ createdAt: { $gte: todayStart } });

      const revenueAgg = await OrderCollection.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]).toArray();

      const todayRevenueAgg = await OrderCollection.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]).toArray();

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthRevenueAgg = await OrderCollection.aggregate([
        { $match: { createdAt: { $gte: monthStart }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]).toArray();

      const planDistribution = {
        lite: subscriptions.filter(s => s.plan === 'lite').length,
        pro: subscriptions.filter(s => s.plan === 'pro').length,
        infinity: subscriptions.filter(s => s.plan === 'infinity').length,
      };

      res.json({
        stats: {
          totalTenants: tenants,
          totalEmployees: employees,
          totalOrders: orders,
          totalCustomers: customers,
          totalBranches: branches,
          todayOrders,
          totalRevenue: revenueAgg[0]?.total || 0,
          todayRevenue: todayRevenueAgg[0]?.total || 0,
          monthRevenue: monthRevenueAgg[0]?.total || 0,
        },
        planDistribution,
        subscriptions,
        recentLogs,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/tenants", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const CafeCollection = mongoose.connection.collection('cafes');
      const tenants = await CafeCollection.find().toArray();
      
      const tenantsWithSubs = await Promise.all(tenants.map(async (t: any) => {
        const sub = await SubscriptionConfigModel.findOne({ tenantId: t.tenantId || t._id?.toString() });
        const BranchCollection = mongoose.connection.collection('branches');
        const branchCount = await BranchCollection.countDocuments({ tenantId: t.tenantId || t._id?.toString() });
        const EmployeeCollection = mongoose.connection.collection('employees');
        const employeeCount = await EmployeeCollection.countDocuments({ tenantId: t.tenantId || t._id?.toString() });
        return {
          ...t,
          subscription: sub || null,
          branchCount,
          employeeCount,
        };
      }));

      res.json(tenantsWithSubs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/subscriptions", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const subscriptions = await SubscriptionConfigModel.find().lean();
      res.json(subscriptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/qirox/subscriptions", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const { tenantId, plan } = req.body;
      if (!tenantId || !plan) {
        return res.status(400).json({ error: "tenantId and plan required" });
      }

      const planDefaults = PLAN_DEFAULTS[plan as SubscriptionPlan];
      if (!planDefaults) {
        return res.status(400).json({ error: "Invalid plan. Use: lite, pro, infinity" });
      }

      let sub = await SubscriptionConfigModel.findOne({ tenantId });
      if (sub) {
        Object.assign(sub, planDefaults, { plan, updatedAt: new Date() });
        await sub.save();
      } else {
        sub = await SubscriptionConfigModel.create({
          tenantId,
          plan,
          ...planDefaults,
          activatedBy: 'qirox-admin',
        });
      }

      await SystemLogModel.create({
        action: 'subscription_updated',
        details: `Set plan to ${plan} for tenant ${tenantId}`,
        targetTenant: tenantId,
      });

      res.json(sub);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/qirox/subscriptions/:tenantId", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const updates = req.body;

      let sub = await SubscriptionConfigModel.findOne({ tenantId });
      if (!sub) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      Object.assign(sub, updates, { updatedAt: new Date() });
      await sub.save();

      await SystemLogModel.create({
        action: 'subscription_feature_updated',
        details: `Updated features for tenant ${tenantId}: ${JSON.stringify(updates)}`,
        targetTenant: tenantId,
      });

      res.json(sub);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/plan-defaults", requireQiroxAuth, (req: QiroxAuthRequest, res: Response) => {
    res.json(PLAN_DEFAULTS);
  });

  app.get("/api/qirox/logs", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const { limit = 100, action, tenant } = req.query;
      const query: any = {};
      if (action) query.action = action;
      if (tenant) query.targetTenant = tenant;

      const logs = await SystemLogModel.find(query)
        .sort({ timestamp: -1 })
        .limit(Number(limit))
        .lean();

      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/system-health", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const dbState = mongoose.connection.readyState;
      const dbStates: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

      const collections = await mongoose.connection.db!.listCollections().toArray();
      const dbStats = await mongoose.connection.db!.stats();

      res.json({
        database: {
          status: dbStates[dbState] || 'unknown',
          collections: collections.length,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
        },
        timestamp: new Date(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/qirox/tenants/:tenantId", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { confirm } = req.body;
      if (confirm !== 'DELETE') {
        return res.status(400).json({ error: "Send { confirm: 'DELETE' } to confirm" });
      }

      await SubscriptionConfigModel.deleteOne({ tenantId });

      await SystemLogModel.create({
        action: 'tenant_subscription_deleted',
        details: `Removed subscription for tenant ${tenantId}`,
        targetTenant: tenantId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/qirox/change-password", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Both passwords required" });
      }

      const admin = await QiroxAdminModel.findOne();
      if (!admin) return res.status(404).json({ error: "Admin not found" });

      const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!valid) return res.status(401).json({ error: "Current password incorrect" });

      admin.passwordHash = await bcrypt.hash(newPassword, 12);
      admin.sessionToken = crypto.randomBytes(48).toString('hex');
      await admin.save();

      (req.session as any).qiroxToken = admin.sessionToken;

      await SystemLogModel.create({
        action: 'password_changed',
        details: 'Super admin password changed',
      });

      res.json({ success: true, token: admin.sessionToken });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/qirox/analytics", requireQiroxAuth, async (req: QiroxAuthRequest, res: Response) => {
    try {
      const OrderCollection = mongoose.connection.collection('orders');
      const CustomerCollection = mongoose.connection.collection('customers');

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const dailyRevenue = await OrderCollection.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'cancelled' } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]).toArray();

      const topProducts = await OrderCollection.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: "$items" },
        { $group: {
          _id: "$items.nameAr",
          count: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        }},
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray();

      const newCustomersWeek = await CustomerCollection.countDocuments({
        createdAt: { $gte: sevenDaysAgo }
      });

      const paymentMethods = await OrderCollection.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          total: { $sum: "$totalAmount" },
        }},
      ]).toArray();

      res.json({
        dailyRevenue,
        topProducts,
        newCustomersWeek,
        paymentMethods,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
