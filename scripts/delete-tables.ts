import mongoose from "mongoose";
import { TableModel } from "../shared/schema";

async function deleteAllTables() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Connected to MongoDB");
    
    const result = await TableModel.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} tables`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error deleting tables:", error);
    process.exit(1);
  }
}

deleteAllTables();
