/**
 * Migration Script: Convert CoffeeItemIngredient to RecipeItem using RawItem
 * 
 * This script:
 * 1. Reads all CoffeeItemIngredient records
 * 2. For each ingredient, finds or creates a matching RawItem
 * 3. Creates RecipeItem entries linking coffee items to raw items
 * 
 * Run with: npx tsx server/migrations/migrate-ingredients-to-raw-items.ts
 */

import mongoose from 'mongoose';
import { 
  IngredientModel, 
  CoffeeItemIngredientModel, 
  RawItemModel, 
  RecipeItemModel,
  CoffeeItemModel 
} from '@shared/schema';

async function migrateIngredientsToRawItems() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    console.log('\n📋 Starting migration: CoffeeItemIngredient → RecipeItem via RawItem\n');

    const ingredients = await IngredientModel.find({}).lean();
    console.log(`Found ${ingredients.length} legacy ingredients`);

    const coffeeItemIngredients = await CoffeeItemIngredientModel.find({}).lean();
    console.log(`Found ${coffeeItemIngredients.length} coffee-item-ingredient links`);

    const existingRawItems = await RawItemModel.find({}).lean();
    console.log(`Found ${existingRawItems.length} existing raw items`);

    const ingredientToRawItemMap = new Map<string, string>();

    for (const ingredient of ingredients) {
      const ingId = (ingredient as any)._id.toString();
      const nameAr = ingredient.nameAr;
      const nameEn = ingredient.nameEn || '';

      let matchingRawItem = existingRawItems.find(
        (ri: any) => ri.nameAr === nameAr || ri.nameEn === nameEn
      );

      if (matchingRawItem) {
        ingredientToRawItemMap.set(ingId, (matchingRawItem as any)._id.toString());
        console.log(`✅ Mapped ingredient "${nameAr}" to existing RawItem`);
      } else {
        const code = `RAW-ING-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const newRawItem = await RawItemModel.create({
          code,
          nameAr,
          nameEn: nameEn || nameAr,
          description: `تم الترحيل من المكون القديم: ${nameAr}`,
          category: 'ingredient',
          unit: 'piece',
          unitCost: 0,
          minStockLevel: 0,
          maxStockLevel: 100,
          isActive: ingredient.isAvailable ?? 1,
        });
        ingredientToRawItemMap.set(ingId, (newRawItem._id as mongoose.Types.ObjectId).toString());
        console.log(`🆕 Created new RawItem for ingredient "${nameAr}"`);
      }
    }

    console.log('\n📝 Creating RecipeItem entries...\n');

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const link of coffeeItemIngredients) {
      const coffeeItemId = link.coffeeItemId;
      const ingredientId = link.ingredientId;
      const quantity = link.quantity || 1;
      const unit = (link as any).unit || 'piece';

      const rawItemId = ingredientToRawItemMap.get(ingredientId);
      
      if (!rawItemId) {
        console.log(`⚠️ No RawItem found for ingredient ${ingredientId}, skipping`);
        skippedCount++;
        continue;
      }

      try {
        const existingRecipe = await RecipeItemModel.findOne({
          coffeeItemId,
          rawItemId
        });

        if (existingRecipe) {
          console.log(`ℹ️ RecipeItem already exists for coffee ${coffeeItemId} → raw ${rawItemId}`);
          skippedCount++;
          continue;
        }

        await RecipeItemModel.create({
          coffeeItemId,
          rawItemId,
          quantity,
          unit,
        });
        createdCount++;
        console.log(`✅ Created RecipeItem: coffee ${coffeeItemId} → raw ${rawItemId}`);
      } catch (error: any) {
        if (error.code === 11000) {
          console.log(`ℹ️ Duplicate RecipeItem skipped (already exists)`);
          skippedCount++;
        } else {
          console.error(`❌ Error creating RecipeItem:`, error.message);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Created: ${createdCount} RecipeItems`);
    console.log(`   Skipped: ${skippedCount} (already exist or no mapping)`);
    console.log(`   Errors:  ${errorCount}`);
    console.log(`   Ingredient → RawItem mappings: ${ingredientToRawItemMap.size}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('📌 Note: Old Ingredient and CoffeeItemIngredient data is preserved (not deleted)');
    console.log('📌 You can safely mark them as deprecated in the codebase');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

migrateIngredientsToRawItems();
