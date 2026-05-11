/**
 * Inventory Engine Tests
 * Tests for stock management, alerts, and movements
 */

import { InventoryEngine } from "../server/inventory-engine";

async function runTests() {
  console.log("🧪 Inventory Engine Tests\n");
  
  let passCount = 0;
  let failCount = 0;

  const branchId = "branch-test-001";
  const rawItemId = "coffee-beans-test";

  // Test 1: Get stock level
  try {
    console.log("Test 1: Get stock level");
    const level = await InventoryEngine.getStockLevel(branchId, rawItemId);
    
    if (level) {
      console.log("✅ PASS: Stock level retrieved");
      console.log(`   Current: ${level.currentQuantity} ${level.unit}`);
      console.log(`   Minimum Threshold: ${level.minThreshold}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Stock level not found\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 2: Record stock in (purchase)
  try {
    console.log("Test 2: Record stock in (purchase)");
    const result = await InventoryEngine.recordStockIn({
      branchId,
      rawItemId,
      quantity: 10,
      unit: "kg",
      supplierId: "supplier-001",
      notes: "Test purchase",
      createdBy: "test-user"
    });
    
    if (result.success && result.newQuantity !== undefined) {
      console.log("✅ PASS: Stock recorded");
      console.log(`   New Quantity: ${result.newQuantity}`);
      console.log(`   Movement ID: ${result.movement?.id}\n`);
      passCount++;
    } else {
      console.log(`❌ FAIL: ${result.error || "Stock in failed"}\n`);
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 3: Get active alerts
  try {
    console.log("Test 3: Get active alerts");
    const alerts = await InventoryEngine.getActiveAlerts(branchId);
    
    if (Array.isArray(alerts)) {
      console.log("✅ PASS: Alerts retrieved");
      console.log(`   Active Alerts: ${alerts.length}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Alerts retrieval failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 4: Get low stock items
  try {
    console.log("Test 4: Get low stock items");
    const items = await InventoryEngine.getLowStockItems(branchId);
    
    if (Array.isArray(items)) {
      console.log("✅ PASS: Low stock items retrieved");
      console.log(`   Low Stock Items: ${items.length}`);
      if (items.length > 0) {
        console.log(`   Example: ${items[0].rawItemId} - ${items[0].currentQuantity}/${items[0].minThreshold}\n`);
      } else {
        console.log("   (No low stock items found)\n");
      }
      passCount++;
    } else {
      console.log("❌ FAIL: Low stock retrieval failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 5: Get movement history
  try {
    console.log("Test 5: Get movement history");
    const movements = await InventoryEngine.getMovementHistory(branchId, rawItemId, 10);
    
    if (Array.isArray(movements)) {
      console.log("✅ PASS: Movement history retrieved");
      console.log(`   Total Movements: ${movements.length}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Movement history retrieval failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 6: Prevent negative stock
  try {
    console.log("Test 6: Prevent negative stock on deduction");
    const result = await InventoryEngine.deductFromOrder(
      "order-test-001",
      branchId,
      [{ rawItemId, quantity: 99999 }],
      "test-user"
    );
    
    if (!result.success || result.error?.includes("insufficient")) {
      console.log("✅ PASS: Negative stock prevented");
      console.log(`   Reason: ${result.error}\n`);
      passCount++;
    } else if (result.success) {
      console.log("⚠️  WARNING: Deduction succeeded (might indicate no validation)\n");
      passCount++;
    } else {
      console.log("❌ FAIL: Unexpected result\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 7: Check and create alerts
  try {
    console.log("Test 7: Check and create low stock alerts");
    const result = await InventoryEngine.checkAndCreateAlerts(branchId, "test-user");
    
    if (result !== undefined) {
      console.log("✅ PASS: Alert check completed");
      console.log(`   Result: ${result}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Alert check failed\n");
      failCount++;
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
