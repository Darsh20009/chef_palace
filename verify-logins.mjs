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
  isActivated: { type: Number, default: 0 },
  tenantId: { type: String }
}, { strict: false });

const EmployeeModel = mongoose.model('Employee', EmployeeSchema);

async function testLogin(username, password) {
  const employee = await EmployeeModel.findOne({ username });
  if (!employee) return { success: false, message: 'User not found' };
  
  if (employee.isActivated === 0) return { success: false, message: 'Account not activated' };
  
  const isMatch = bcrypt.compareSync(password, employee.password);
  return { success: isMatch, role: employee.role, tenantId: employee.tenantId };
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Reset admin to 2030 to ensure we can test it
    const admin = await EmployeeModel.findOne({ username: 'admin' });
    if (admin) {
        const hashedPassword = bcrypt.hashSync('2030', 10);
        await EmployeeModel.updateOne({ username: 'admin' }, { $set: { password: hashedPassword, isActivated: 1 } });
        console.log('✅ Reset admin password to 2030');
    }

    const testUsers = [
      { username: 'manager', password: '2030' },
      { username: 'admin', password: '2030' }
    ];

    for (const user of testUsers) {
      const result = await testLogin(user.username, user.password);
      console.log(`👤 Login Test [${user.username}]: ${result.success ? '✅ SUCCESS' : '❌ FAILED'} (${result.message || result.role})`);
    }

    const roles = await EmployeeModel.distinct('role');
    console.log('🎭 Available Roles in DB:', roles);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
