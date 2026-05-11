/**
 * Recipe Engine Tests
 * Basic unit tests for recipe costing and versioning
 */

import { RecipeEngine } from "../server/recipe-engine";

async function runTests() {
  console.log("🧪 Recipe Engine Tests\n");
  
  let passCount = 0;
  let failCount = 0;

  // Test 1: Create recipe
  try {
    console.log("Test 1: Create recipe with ingredients");
    const result = await RecipeEngine.createRecipe(
      "espresso-001",
      "إسبريسو",
      "Espresso",
      [
        { rawItemId: "coffee-beans", quantity: 18, unit: "g" }
      ]
    );
    
    if (result.success && result.recipe) {
      console.log("✅ PASS: Recipe created successfully");
      console.log(`   Recipe ID: ${result.recipe.id}`);
      console.log(`   Cost: ${result.recipe.totalCost} SAR\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Recipe creation failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 2: Get active recipe
  try {
    console.log("Test 2: Get active recipe");
    const recipe = await RecipeEngine.getActiveRecipe("espresso-001");
    
    if (recipe && recipe.id) {
      console.log("✅ PASS: Recipe retrieved");
      console.log(`   Name: ${recipe.nameAr}`);
      console.log(`   Cost: ${recipe.totalCost} SAR\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Recipe not found\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 3: Recipe with multiple ingredients
  try {
    console.log("Test 3: Recipe with multiple ingredients");
    const result = await RecipeEngine.createRecipe(
      "cappuccino-001",
      "كابتشينو",
      "Cappuccino",
      [
        { rawItemId: "coffee-beans", quantity: 18, unit: "g" },
        { rawItemId: "milk", quantity: 150, unit: "ml" }
      ]
    );
    
    if (result.success && result.recipe && result.recipe.totalCost > 0) {
      console.log("✅ PASS: Multi-ingredient recipe created");
      console.log(`   Ingredients: ${result.recipe.ingredients?.length}`);
      console.log(`   Total Cost: ${result.recipe.totalCost} SAR\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Multi-ingredient recipe failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 4: Freeze recipe snapshot
  try {
    console.log("Test 4: Freeze recipe snapshot for order");
    const snapshot = await RecipeEngine.freezeRecipeSnapshot("order-001", "espresso-001");
    
    if (snapshot && snapshot.frozenCost >= 0) {
      console.log("✅ PASS: Recipe snapshot frozen");
      console.log(`   Frozen Cost: ${snapshot.frozenCost} SAR`);
      console.log(`   Timestamp: ${snapshot.frozenAt}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Snapshot freezing failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 5: Calculate profit
  try {
    console.log("Test 5: Calculate profit for item");
    const recipe = await RecipeEngine.getActiveRecipe("espresso-001");
    
    if (recipe) {
      const sellingPrice = 15; // 15 SAR
      const profit = await RecipeEngine.calculateProfit("espresso-001", sellingPrice);
      
      if (profit && profit.profit !== undefined) {
        console.log("✅ PASS: Profit calculated");
        console.log(`   Selling Price: ${sellingPrice} SAR`);
        console.log(`   Cost: ${recipe.totalCost} SAR`);
        console.log(`   Profit: ${profit.profit} SAR`);
        console.log(`   Margin: ${profit.margin}%\n`);
        passCount++;
      } else {
        console.log("❌ FAIL: Profit calculation failed\n");
        failCount++;
      }
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Summary
  console.log("═══════════════════════════════════════");
  console.log(`Tests Passed: ${passCount}`);
  console.log(`Tests Failed: ${failCount}`);
  console.log(`Total Tests: ${passCount + failCount}`);
  console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log("═══════════════════════════════════════\n");

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("❌ Test runner error:", error);
  process.exit(1);
});
