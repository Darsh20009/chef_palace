import mongoose from 'mongoose';

const connectionString = process.env.MONGODB_URI || 'mongodb+srv://qahwacup:Loz123!@cluster0.jqvda7a.mongodb.net/test?retryWrites=true&w=majority';

async function fixTables() {
  try {
    await mongoose.connect(connectionString);
    const db = mongoose.connection.db;
    
    console.log('\n🔧 FIXING TABLE BRANCH ASSIGNMENTS\n');
    console.log('━'.repeat(70));
    
    // Get branches
    const branches = await db.collection('branches').find({}).toArray();
    console.log(`\n✓ Found ${branches.length} branches`);
    
    // Get ALL tables first to understand structure
    const allTables = await db.collection('tables').find({}).toArray();
    console.log(`✓ Total tables: ${allTables.length}`);
    
    // Group tables by current branchId
    const tablesByBranchId = {};
    allTables.forEach(t => {
      if (!tablesByBranchId[t.branchId]) tablesByBranchId[t.branchId] = [];
      tablesByBranchId[t.branchId].push(t.tableNumber);
    });
    
    console.log(`\n📊 Current table distribution:`);
    Object.entries(tablesByBranchId).forEach(([branchId, tables]) => {
      console.log(`  - BranchId ${branchId}: ${tables.length} tables`);
    });
    
    // Fix tables - assign to correct branches
    console.log(`\n🔄 Fixing table assignments...`);
    
    // Delete all old tables
    await db.collection('tables').deleteMany({});
    console.log(`✓ Deleted all tables`);
    
    // Create new tables with correct branchIds
    const tableNumber = 1;
    for (const branch of branches) {
      const tables = [];
      for (let i = 1; i <= 10; i++) {
        tables.push({
          tableNumber: i.toString(),
          branchId: branch._id,
          qrToken: `qr_${branch._id}_${i}`,
          isActive: 1,
          isOccupied: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      const result = await db.collection('tables').insertMany(tables);
      console.log(`✓ Created 10 tables for ${branch.nameAr}`);
    }
    
    // Verify
    console.log(`\n✅ Verification:`);
    for (const branch of branches) {
      const count = await db.collection('tables').countDocuments({ branchId: branch._id });
      console.log(`  - ${branch.nameAr}: ${count} tables`);
    }
    
    console.log('\n' + '━'.repeat(70));
    console.log('✅ All tables fixed!\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixTables();
