import { Request, Response, NextFunction } from "express";
import { PermissionsEngine, type Permission } from "../permissions-engine";
import mongoose from "mongoose";

export interface AuthRequest extends Request {
  employee?: {
    id: string;
    username: string;
    role: string;
    branchId?: string;
    tenantId: string;
    fullName: string;
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }

    const employeePerms = (req.employee as any).permissions || [];
    if (!PermissionsEngine.hasPermission(req.employee.role, permission, employeePerms)) {
      return res.status(403).json({ 
        error: "Forbidden - Insufficient permissions",
        required: permission,
        yourRole: req.employee.role
      });
    }

    next();
  };
}

async function tryRestoreFromHeaders(req: AuthRequest, res?: any): Promise<boolean> {
  const employeeId = req.headers['x-employee-id'] as string;
  const restoreKey = req.headers['x-restore-key'] as string;
  
  if (!employeeId || !restoreKey) return false;
  
  try {
    const EmployeeCollection = mongoose.connection.collection('employees');
    const employee = await EmployeeCollection.findOne({
      $or: [
        { id: employeeId },
        { _id: (() => { try { return new mongoose.Types.ObjectId(employeeId); } catch { return null; } })() },
      ].filter((x) => x !== null) as any[]
    });
    
    if (!employee) return false;
    
    const storedKey = (employee as any).lastRestoreKey;
    if (!storedKey || storedKey !== restoreKey) return false;
    
    const newRestoreKey = require('crypto').randomBytes(32).toString('hex');
    await EmployeeCollection.updateOne(
      { _id: employee._id },
      { $set: { lastRestoreKey: newRestoreKey } }
    );
    
    const sessionEmployee = {
      id: employee.id || employee._id.toString(),
      username: employee.username,
      role: employee.role,
      branchId: employee.branchId,
      tenantId: employee.tenantId || 'demo-tenant',
      fullName: employee.fullName || employee.username,
    };
    
    req.session.employee = sessionEmployee;
    req.session.restoreKey = newRestoreKey;
    
    if (res) res.setHeader('X-New-Restore-Key', newRestoreKey);
    
    req.employee = sessionEmployee;
    return true;
  } catch (e) {
    return false;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.session.employee) {
    req.employee = { ...req.session.employee, tenantId: (req.session.employee as any).tenantId || 'default' };
    return next();
  }

  tryRestoreFromHeaders(req, res).then((restored) => {
    if (restored) {
      return next();
    }
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }).catch(() => {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  });
}

export function requireManager(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const managerRoles = ["manager", "branch_manager", "admin", "owner"];
  if (!managerRoles.includes(req.employee.role)) {
    return res.status(403).json({ error: "Forbidden - Manager access required" });
  }

  next();
}

export function requireBranchAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.employee.role === "admin" || req.employee.role === "owner") {
    next();
    return;
  }

  const requestedBranchId = req.params.branchId || req.query.branchId || req.body.branchId;

  if (!requestedBranchId) {
    next();
    return;
  }

  if (req.employee.role === "manager" || req.employee.role === "branch_manager") {
    if (req.employee.branchId !== requestedBranchId) {
      return res.status(403).json({ error: "Forbidden - You can only access your assigned branch" });
    }
  }

  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.employee.role !== "admin" && req.employee.role !== "owner") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }

  next();
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.employee.role !== "owner") {
    return res.status(403).json({ error: "Forbidden - Owner access required" });
  }

  next();
}

export function requireKitchenAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const kitchenRoles = ["barista", "cook", "waiter", "manager", "branch_manager", "supervisor", "admin", "owner"];
  if (!kitchenRoles.includes(req.employee.role)) {
    return res.status(403).json({ error: "Forbidden - Kitchen access required" });
  }

  next();
}

export function requireCashierAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cashierRoles = ["cashier", "barista", "waiter", "manager", "branch_manager", "supervisor", "admin", "owner"];
  if (!cashierRoles.includes(req.employee.role)) {
    return res.status(403).json({ error: "Forbidden - Cashier access required" });
  }

  next();
}

export function requireDeliveryAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.employee) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const deliveryRoles = ["driver", "waiter", "manager", "branch_manager", "admin", "owner"];
  if (!deliveryRoles.includes(req.employee.role)) {
    return res.status(403).json({ error: "Forbidden - Delivery access required" });
  }

  next();
}

export function filterByBranch<T extends { branchId?: string }>(
  data: T[],
  employee?: AuthRequest["employee"]
): T[] {
  if (!employee || employee.role === "admin" || employee.role === "owner") {
    return data;
  }

  if (employee.branchId) {
    return data.filter(item => item.branchId === employee.branchId);
  }

  if (employee.role === "manager") {
    return data;
  }

  return [];
}

export interface CustomerAuthRequest extends Request {
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    points?: number;
    pendingPoints?: number;
    cardPassword?: string;
  };
}

export function requireCustomerAuth(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  if (!req.session.customer) {
    return res.status(401).json({ error: "يرجى تسجيل الدخول" });
  }

  req.customer = req.session.customer;
  next();
}
