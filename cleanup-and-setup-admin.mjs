import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not defined');
  process.exit(1);
}

const EmployeeSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String },
  role: { type: String },
  fullName: { type: String },
  isActivated: { type: Number, default: 0 },
  tenantId: { type: String },
  branchId: { type: String }
}, { strict: false });

const BranchSchema = new mongoose.Schema({
  nameAr: { type: String },
  tenantId: { type: String }
}, { strict: false });

const EmployeeModel = mongoose.model('Employee', EmployeeSchema);
const BranchModel = mongoose.model('Branch', BranchSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Delete all employees
    const deleteResult = await EmployeeModel.deleteMany({});
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} employees`);

    // 2. Ensure at least one branch exists
    let branch = await BranchModel.findOne({ tenantId: 'demo-tenant' });
    if (!branch) {
      branch = await BranchModel.create({
        nameAr: 'الفرع الرئيسي',
        tenantId: 'demo-tenant'
      });
      console.log('✅ Created main branch');
    }

    // 3. Create Super Admin
    const hashedPassword = bcrypt.hashSync('2030', 10);
    const admin = await EmployeeModel.create({
      username: 'admin',
      password: hashedPassword,
      fullName: 'مدير النظام',
      role: 'admin', // Admin role has all permissions including branch manager ones
      isActivated: 1,
      tenantId: 'demo-tenant',
      branchId: branch._id.toString()
    });
    console.log('✅ Created Super Admin (admin/2030)');

    console.log('🚀 All tasks completed.');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
