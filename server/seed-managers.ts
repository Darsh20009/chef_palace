import bcrypt from "bcryptjs";
import { EmployeeModel, BranchModel } from "../shared/schema";
import mongoose from "mongoose";

async function seedManagersAndBranches() {
  try {
    console.log("Starting seed process...");

    const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/coffee-shop";
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // First, create branches if they don't exist
    const demoTenantId = "demo-tenant";
    const demoCafeId = "cafe-demo";

    const branches = [
      {
        id: "branch-olaya",
        tenantId: demoTenantId,
        cafeId: demoCafeId,
        nameAr: "فرع العليا",
        nameEn: "Olaya Branch",
        address: "حي العليا، شارع التحلية",
        phone: "0112345678",
        city: "الرياض",
        isActive: 1,
        managerName: "درويش",
      },
      {
        id: "branch-malaz",
        tenantId: demoTenantId,
        cafeId: demoCafeId,
        nameAr: "فرع الملز",
        nameEn: "Malaz Branch",
        address: "حي الملز، طريق الملك فهد",
        phone: "0112345679",
        city: "الرياض",
        isActive: 1,
        managerName: "محمد",
      },
      {
        id: "branch-rawdah",
        tenantId: demoTenantId,
        cafeId: demoCafeId,
        nameAr: "فرع الروضة",
        nameEn: "Rawdah Branch",
        address: "حي الروضة، شارع العروبة",
        phone: "0112345680",
        city: "الرياض",
        isActive: 1,
        managerName: "أحمد",
      },
    ];

    const createdBranches: any[] = [];
    for (const branchData of branches) {
      let branch = await BranchModel.findOne({ nameAr: branchData.nameAr });
      if (!branch) {
        branch = await BranchModel.create(branchData);
        console.log(`Created branch: ${branchData.nameAr}`);
      } else {
        console.log(`Branch already exists: ${branchData.nameAr}`);
      }
      createdBranches.push(branch);
    }

    // Create or update owner account (cafe owner with full control)
    const ownerPassword = await bcrypt.hash("b2030", 10);
    let owner = await EmployeeModel.findOne({ username: "owner" });
    if (!owner) {
      owner = await EmployeeModel.create({
        id: "owner-demo",
        tenantId: demoTenantId,
        username: "owner",
        password: ownerPassword,
        fullName: "صاحب الكافيه",
        role: "owner",
        phone: "0500000099",
        jobTitle: "المالك",
        isActivated: 1,
        commissionPercentage: 0,
      });
      console.log("✅ Created owner account (owner/b2030)");
    } else {
      owner.role = "owner";
      owner.password = ownerPassword;
      owner.fullName = "صاحب الكافيه";
      owner.jobTitle = "المالك";
      await owner.save();
      console.log("✅ Updated owner account");
    }

    // Create or update admin account (oversees all branches)
    const adminPassword = await bcrypt.hash("b2030", 10);
    let admin = await EmployeeModel.findOne({ username: "admin" });
    if (!admin) {
      admin = await EmployeeModel.create({
        id: "admin-demo",
        tenantId: demoTenantId,
        username: "admin",
        password: adminPassword,
        fullName: "مدير النظام",
        role: "admin",
        phone: "0500000000",
        jobTitle: "مدير عام",
        isActivated: 1,
        commissionPercentage: 0,
      });
      console.log("✅ Created admin account (admin/b2030)");
    } else {
      // Update existing admin
      admin.role = "admin";
      admin.password = adminPassword;
      await admin.save();
      console.log("✅ Updated admin account");
    }

    // Create branch managers
    const managers = [
      {
        username: "darwish",
        password: await bcrypt.hash("darwish123", 10),
        fullName: "درويش",
        role: "manager",
        phone: "0500000001",
        jobTitle: "مدير فرع العليا",
        branchId: createdBranches[0]._id.toString(),
      },
      {
        username: "mohmmed",
        password: await bcrypt.hash("123456", 10),
        fullName: "محمد",
        role: "manager",
        phone: "0500000002",
        jobTitle: "مدير فرع الملز",
        branchId: createdBranches[1]._id.toString(),
      },
      {
        username: "amed",
        password: await bcrypt.hash("123456", 10),
        fullName: "أحمد",
        role: "manager",
        phone: "0500000003",
        jobTitle: "مدير فرع الروضة",
        branchId: createdBranches[2]._id.toString(),
      },
    ];

    for (const managerData of managers) {
      let manager = await EmployeeModel.findOne({ username: managerData.username });
      if (!manager) {
        manager = await EmployeeModel.create({
          id: `manager-${managerData.username}`,
          tenantId: demoTenantId,
          ...managerData,
          isActivated: 1,
          commissionPercentage: 0,
        });
        console.log(`✅ Created manager: ${managerData.username} for ${managerData.jobTitle}`);
      } else {
        // Update existing manager with all fields
        manager.branchId = managerData.branchId;
        manager.role = managerData.role;
        manager.fullName = managerData.fullName;
        manager.jobTitle = managerData.jobTitle;
        manager.phone = managerData.phone;
        manager.password = managerData.password;
        manager.isActivated = 1;
        await manager.save();
        console.log(`✅ Updated manager: ${managerData.username}`);
      }
    }

    console.log("\n=== Seed Summary ===");
    console.log("Branches created:", createdBranches.length);
    console.log("\nAccounts:");
    console.log("- Owner: owner / owner123 (صاحب الكافيه - full control)");
    console.log("- Admin: admin / admin (all branches)");
    console.log("- Olaya Branch: darwish / darwish123");
    console.log("- Malaz Branch: mohmmed / 123456");
    console.log("- Rawdah Branch: amed / 123456");
    console.log("\nSeed completed successfully!");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seedManagersAndBranches();
