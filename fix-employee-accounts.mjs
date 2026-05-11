import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

const EmployeeSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String },
  fullName: { type: String },
  role: { type: String },
  isActivated: { type: Number, default: 0 },
  tenantId: { type: String }
}, { strict: false });

const EmployeeModel = mongoose.model('Employee', EmployeeSchema);

async function run() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    const employees = await EmployeeModel.find({});
    console.log(`📊 Found ${employees.length} employees.`);

    for (const emp of employees) {
      console.log(`👤 Checking: ${emp.username} (Activated: ${emp.isActivated})`);
      
      // Reset 'manager' to '2030'
      if (emp.username === 'manager') {
        const hashedPassword = bcrypt.hashSync('2030', 10);
        await EmployeeModel.updateOne({ _id: emp._id }, { 
          $set: { 
            password: hashedPassword,
            isActivated: 1 
          } 
        });
        console.log(`   ✅ Reset password for 'manager' to '2030'`);
      }
      
      // Ensure all employees are activated
      if (emp.isActivated === 0) {
        await EmployeeModel.updateOne({ _id: emp._id }, { $set: { isActivated: 1 } });
        console.log(`   ✅ Activated employee: ${emp.username}`);
      }
    }

    console.log('🚀 All tasks completed.');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
