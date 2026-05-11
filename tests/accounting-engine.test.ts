/**
 * Accounting Engine Tests
 * Tests for financial calculations and reporting
 */

import { AccountingEngine } from "../server/accounting-engine";

async function runTests() {
  console.log("🧪 Accounting Engine Tests\n");
  
  let passCount = 0;
  let failCount = 0;

  const branchId = "branch-test-001";

  // Test 1: Get daily snapshot
  try {
    console.log("Test 1: Get daily snapshot");
    const snapshot = await AccountingEngine.getDailySnapshot(branchId);
    
    if (snapshot) {
      console.log("✅ PASS: Daily snapshot retrieved");
      console.log(`   Revenue: ${snapshot.totalRevenue?.toFixed(2)} SAR`);
      console.log(`   COGS: ${snapshot.totalCOGS?.toFixed(2)} SAR`);
      console.log(`   Profit: ${snapshot.totalProfit?.toFixed(2)} SAR`);
      console.log(`   Items Sold: ${snapshot.itemsSold}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Snapshot not found\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 2: Get profit per drink
  try {
    console.log("Test 2: Get profit per drink");
    const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date();
    
    const report = await AccountingEngine.getProfitPerDrink(branchId, startDate, endDate);
    
    if (Array.isArray(report)) {
      console.log("✅ PASS: Profit per drink retrieved");
      console.log(`   Items: ${report.length}`);
      if (report.length > 0) {
        console.log(`   Example: ${report[0].nameAr || report[0].itemId}`);
        console.log(`   Profit: ${report[0].totalProfit?.toFixed(2)} SAR\n`);
      } else {
        console.log("   (No data for period)\n");
      }
      passCount++;
    } else {
      console.log("❌ FAIL: Profit report failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 3: Get profit per category
  try {
    console.log("Test 3: Get profit per category");
    const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date();
    
    const report = await AccountingEngine.getProfitPerCategory(branchId, startDate, endDate);
    
    if (Array.isArray(report)) {
      console.log("✅ PASS: Profit per category retrieved");
      console.log(`   Categories: ${report.length}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Category report failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 4: Get top profitable items
  try {
    console.log("Test 4: Get top profitable items");
    const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date();
    
    const items = await AccountingEngine.getTopProfitableItems(branchId, startDate, endDate, 10);
    
    if (Array.isArray(items)) {
      console.log("✅ PASS: Top items retrieved");
      console.log(`   Top Items: ${items.length}`);
      if (items.length > 0) {
        console.log(`   #1: ${items[0].nameAr || items[0].itemId} - ${items[0].totalProfit?.toFixed(2)} SAR\n`);
      } else {
        console.log("   (No data)\n");
      }
      passCount++;
    } else {
      console.log("❌ FAIL: Top items retrieval failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 5: Get worst performing items
  try {
    console.log("Test 5: Get worst performing items");
    const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date();
    
    const items = await AccountingEngine.getWorstItems(branchId, startDate, endDate, 10);
    
    if (Array.isArray(items)) {
      console.log("✅ PASS: Worst items retrieved");
      console.log(`   Worst Items: ${items.length}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Worst items retrieval failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 6: Get waste report
  try {
    console.log("Test 6: Get waste report");
    const startDate = new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date();
    
    const report = await AccountingEngine.getWasteReport(branchId, startDate, endDate);
    
    if (Array.isArray(report)) {
      console.log("✅ PASS: Waste report retrieved");
      console.log(`   Waste Items: ${report.length}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Waste report failed\n");
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    failCount++;
  }

  // Test 7: Save daily snapshot
  try {
    console.log("Test 7: Save daily snapshot to database");
    const snapshot = await AccountingEngine.saveDailySnapshot(
      "tenant-test",
      branchId,
      "test-user"
    );
    
    if (snapshot) {
      console.log("✅ PASS: Snapshot saved");
      console.log(`   ID: ${snapshot.id}`);
      console.log(`   Date: ${new Date(snapshot.date).toLocaleDateString()}\n`);
      passCount++;
    } else {
      console.log("❌ FAIL: Snapshot save failed\n");
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
