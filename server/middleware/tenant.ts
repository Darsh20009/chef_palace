import { Request, Response, NextFunction } from "express";
import { TenantModel } from "@shared/tenant-schema";

export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: any;
}

export async function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    // Get tenantId from various sources
    const tenantId = req.params.tenantId || 
                     req.query.tenantId || 
                     req.body.tenantId ||
                     req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    // Verify tenant exists
    const tenant = await TenantModel.findOne({ id: tenantId });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    if (tenant.status !== 'active') {
      return res.status(403).json({ error: "Tenant is not active" });
    }

    req.tenantId = tenantId;
    req.tenant = tenant;
    next();
  } catch (error) {
    res.status(500).json({ error: "Tenant validation failed" });
  }
}

export function getTenantIdFromRequest(req: any): string | null {
  return req.tenantId || 
         req.params.tenantId || 
         req.query.tenantId ||
         req.body.tenantId ||
         (req.headers['x-tenant-id'] as string) ||
         null;
}
