import { storage } from "./storage";
import { TenantModel } from "@shared/tenant-schema";
import type { InsertEmployee } from "@shared/schema";

export async function runSeeds() {
  console.log("🌱 Starting clean re-initialization...");

  try {
    // 1. Create Default Tenant
    let demoTenant = await TenantModel.findOne({ id: "demo-tenant" });
    if (!demoTenant) {
      demoTenant = await TenantModel.create({
        id: "demo-tenant",
        nameAr: "المنشأة الأساسية",
        nameEn: "Main Tenant",
        type: "client",
        status: "active",
        subscription: {
          plan: "professional",
          status: "active",
          startDate: new Date(),
          features: ["all"]
        }
      });
      console.log("✅ Created clean tenant: demo-tenant");
    }

    // 2. Create Super Admin Employee
    const adminPhone = "0500000000";
    const existingAdmin = await storage.getEmployeeByPhone(adminPhone);
    
    if (!existingAdmin) {
      const superAdmin: any = {
        username: "admin",
        fullName: "مدير النظام",
        role: "admin",
        phone: adminPhone,
        jobTitle: "Super Admin",
        password: "admin", // User can change this later
        isActivated: 1,
        tenantId: "demo-tenant"
      };
      
      await storage.createEmployee(superAdmin);
      console.log("✅ Created Super Admin: admin / admin");
    }

    console.log("✅ System re-initialized successfully with clean state.");
  } catch (error) {
    console.error("❌ Error during re-initialization:", error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
