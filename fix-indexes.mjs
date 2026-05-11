import mongoose from 'mongoose';

const connectionString = process.env.MONGODB_URI || 'mongodb+srv://qahwacup:Loz123!@cluster0.jqvda7a.mongodb.net/test?retryWrites=true&w=majority';

async function fixIndexes() {
  try {
    await mongoose.connect(connectionString);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const tablesCollection = db.collection('tables');
    
    // Delete all tables first (final cleanup)
    const deleteResult = await tablesCollection.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} tables\n`);
    
    // Drop the old single-column index if it exists
    try {
      await tablesCollection.dropIndex('tableNumber_1');
      console.log('🗑️  Dropped old index: tableNumber_1');
    } catch (err) {
      console.log('ℹ️  Old index not found (already dropped)');
    }
    
    console.log('\n✅ Index cleanup completed!');
    console.log('📌 Server will recreate correct indexes on restart\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixIndexes();
