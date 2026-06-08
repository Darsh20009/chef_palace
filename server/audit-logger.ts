import { nanoid } from "nanoid";
import { AuditLogModel } from "@shared/schema";
import type { Request } from "express";

export interface AuditParams {
  tenantId: string;
  branchId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  actorType?: "employee" | "manager" | "admin" | "system" | "customer";
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  details?: Record<string, any>;
  before?: any;
  after?: any;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await AuditLogModel.create({
      id: nanoid(),
      actorType: "system",
      createdAt: new Date(),
      ...params,
    });
  } catch (e) {
    console.error("[AUDIT] Failed to write audit log:", e);
  }
}

export function extractActor(req: Request): {
  actorType: "employee" | "manager" | "admin" | "system";
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  tenantId: string;
  branchId?: string;
} {
  const session = req.session as any;
  const employee = session?.employee;
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!employee) {
    return { actorType: "system", ipAddress: ip, tenantId: "demo-tenant" };
  }

  const role = employee.role || "employee";
  const actorType: "employee" | "manager" | "admin" =
    role === "admin" || role === "owner"
      ? "admin"
      : role === "manager" || role === "branch_manager" || role === "supervisor"
      ? "manager"
      : "employee";

  return {
    actorType,
    actorId: employee.id,
    actorName: employee.nameAr || employee.nameEn || employee.username,
    actorRole: role,
    ipAddress: ip,
    tenantId: employee.tenantId || "demo-tenant",
    branchId: employee.branchId,
  };
}

export async function logFromRequest(
  req: Request,
  params: Omit<AuditParams, "tenantId" | "actorType" | "actorId" | "actorName" | "actorRole" | "ipAddress" | "branchId">
): Promise<void> {
  const actor = extractActor(req);
  await logAudit({ ...actor, ...params });
}
