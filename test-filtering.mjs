import mongoose from 'mongoose';

const connectionString = process.env.MONGODB_URI || 'mongodb+srv://qahwacup:Loz123!@cluster0.jqvda7a.mongodb.net/test?retryWrites=true&w=majority';

async function test() {
  try {
    await mongoose.connect(connectionString);
    const db = mongoose.connection.db;
    
    // Get employees
    const employees = await db.collection('employees').find({
      role: { $in: ['cashier', 'manager'] }
    }).toArray();
    
    // Get branches
    const branches = await db.collection('branches').find({}).toArray();
    const branchMap = {};
    branches.forEach(b => branchMap[b._id.toString()] = b.nameAr);
    
    console.log('\n🧪 FILTERING TEST:\n');
    console.log('━'.repeat(70));
    
    for (const emp of employees) {
      if (!emp.branchId) {
        console.log(`\n❌ ${emp.fullName} (${emp.role}) - NO BRANCH ASSIGNED!`);
        continue;
      }
      
      // Get tables for this employee's branch
      const tables = await db.collection('tables').find({
        branchId: emp.branchId
      }).toArray();
      
      const branchName = branchMap[emp.branchId];
      console.log(`\n✅ ${emp.fullName} (${emp.role})`);
      console.log(`   Branch: ${branchName}`);
      console.log(`   Should see: ${tables.length} tables`);
      
      if (tables.length > 10) {
        console.log(`   ⚠️  WARNING: Should be <= 10 tables!`);
      } else if (tables.length === 10) {
        console.log(`   ✓ Table numbers: ${tables.map(t => t.tableNumber).sort((a,b)=>parseInt(a)-parseInt(b)).join(', ')}`);
      }
    }
    
    console.log('\n' + '━'.repeat(70));
    console.log('\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
