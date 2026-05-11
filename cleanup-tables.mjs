import mongoose from 'mongoose';

const connectionString = process.env.MONGODB_URI || 'mongodb+srv://qahwacup:Loz123!@cluster0.jqvda7a.mongodb.net/test?retryWrites=true&w=majority';

async function cleanup() {
  try {
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    
    // Delete all tables
    const result = await mongoose.connection.db.collection('tables').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} tables`);
    
    // Show remaining tables
    const remaining = await mongoose.connection.db.collection('tables').find({}).toArray();
    console.log(`📊 Remaining tables: ${remaining.length}`);
    
    await mongoose.disconnect();
    console.log('✅ Cleanup completed!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

cleanup();
