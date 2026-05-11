import mongoose from 'mongoose';

const connectionString = process.env.MONGODB_URI || 'mongodb+srv://qahwacup:Loz123!@cluster0.jqvda7a.mongodb.net/test?retryWrites=true&w=majority';

async function test() {
  try {
    await mongoose.connect(connectionString);
    const db = mongoose.connection.db;
    
    console.log('\n📊 DATABASE INSPECTION\n');
    console.log('━'.repeat(70));
    
    // Get branches
    const branches = await db.collection('branches').find({}).toArray();
    console.log(`\n✓ Branches: ${branches.length}`);
    branches.slice(0, 3).forEach(b => {
      console.log(`  - ${b.nameAr} (ID: ${b._id})`);
    });
    
    // Get tables count by branchId
    console.log(`\n✓ Tables by branch:`);
    for (const branch of branches) {
      const count = await db.collection('tables').countDocuments({ branchId: branch._id });
      console.log(`  - ${branch.nameAr}: ${count} tables`);
    }
    
    // Get one table to check structure
    console.log(`\n✓ Sample table:`);
    const sampleTable = await db.collection('tables').findOne({});
    if (sampleTable) {
      console.log(`  - Table number: ${sampleTable.tableNumber}`);
      console.log(`  - Branch ID: ${sampleTable.branchId}`);
      console.log(`  - Branch ID type: ${typeof sampleTable.branchId}`);
    }
    
    console.log('\n' + '━'.repeat(70));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
