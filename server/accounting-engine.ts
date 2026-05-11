/**
 * Operational Accounting Engine - Phase 3
 * Financial reporting for café owners (not accountants)
 * Daily snapshots, profit analysis, waste tracking
 */

import {
  OrderModel,
  StockMovementModel,
  AccountingSnapshotModel,
  CoffeeItemModel,
  CategoryModel,
  type IOrder,
  type IStockMovement,
  type IAccountingSnapshot,
} from "@shared/schema";

/**
 * 3.1 Daily Snapshot
 * Real-time aggregations for today's operations
 */
export class AccountingEngine {
  /**
   * Get today's sales snapshot
   */
  static async getDailySnapshot(
    branchId: string,
    date?: Date
  ): Promise<{
    date: string;
    salesCount: number;
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    profitMargin: number;
    wasteAmount: number;
    wastePercentage: number;
  }> {
    const snapshotDate = date || new Date();
    const startOfDay = new Date(snapshotDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(snapshotDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all orders for today
    const orders = await OrderModel.find({
      branchId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["completed", "delivered"] },
    });

    // Calculate aggregates
    let totalRevenue = 0;
    let totalCOGS = 0;
    let ordersWithCOGS = 0;

    for (const order of orders) {
      totalRevenue += order.totalAmount || 0;
      if (order.costOfGoods !== undefined && order.costOfGoods > 0) {
        totalCOGS += order.costOfGoods;
        ordersWithCOGS++;
      }
    }

    const grossProfit = totalRevenue - totalCOGS;
    const profitMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Get waste for today
    const wasteMovements = await StockMovementModel.find({
      branchId,
      movementType: "waste",
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // Calculate waste cost (need to look up item prices)
    let wasteAmount = 0;
    for (const movement of wasteMovements) {
      // Get raw item cost
      const item = await this.getRawItemCost(movement.rawItemId);
      if (item) {
        wasteAmount += Math.abs(movement.quantity) * item.costPerUnit;
      }
    }

    const wastePercentage =
      totalRevenue > 0 ? (wasteAmount / totalRevenue) * 100 : 0;

    return {
      date: snapshotDate.toISOString().split("T")[0],
      salesCount: orders.length,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCOGS: parseFloat(totalCOGS.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      wasteAmount: parseFloat(wasteAmount.toFixed(2)),
      wastePercentage: parseFloat(wastePercentage.toFixed(2)),
    };
  }

  /**
   * 3.2 Reports - Profit per drink
   */
  static async getProfitPerDrink(
    branchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      itemId: string;
      itemName: string;
      category: string;
      quantitySold: number;
      totalRevenue: number;
      totalCOGS: number;
      totalProfit: number;
      profitMargin: number;
      profitPerUnit: number;
    }>
  > {
    const orders = await OrderModel.find({
      branchId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ["completed", "delivered"] },
    });

    const itemStats: Record<
      string,
      {
        name: string;
        category: string;
        quantity: number;
        revenue: number;
        cogs: number;
      }
    > = {};

    // Aggregate by item
    for (const order of orders) {
      if (!order.items || !Array.isArray(order.items)) continue;

      for (const item of order.items) {
        const itemId = item.menuItemId || item.coffeeItemId || "unknown";
        const itemName = item.name || "Unknown Item";
        const itemCategory = item.category || "Uncategorized";
        const quantity = item.quantity || 1;
        const itemPrice = item.price || item.unitPrice || 0;

        if (!itemStats[itemId]) {
          itemStats[itemId] = {
            name: itemName,
            category: itemCategory,
            quantity: 0,
            revenue: 0,
            cogs: 0,
          };
        }

        itemStats[itemId].quantity += quantity;
        itemStats[itemId].revenue += itemPrice * quantity;

        // Add item COGS if available
        if (order.costOfGoods && order.items.length > 0) {
          itemStats[itemId].cogs +=
            (order.costOfGoods / order.items.length) * quantity;
        }
      }
    }

    // Convert to array with calculations
    return Object.entries(itemStats).map(([itemId, stats]) => {
      const totalProfit = stats.revenue - stats.cogs;
      const profitMargin =
        stats.revenue > 0 ? (totalProfit / stats.revenue) * 100 : 0;
      const profitPerUnit =
        stats.quantity > 0 ? totalProfit / stats.quantity : 0;

      return {
        itemId,
        itemName: stats.name,
        category: stats.category,
        quantitySold: stats.quantity,
        totalRevenue: parseFloat(stats.revenue.toFixed(2)),
        totalCOGS: parseFloat(stats.cogs.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        profitPerUnit: parseFloat(profitPerUnit.toFixed(2)),
      };
    });
  }

  /**
   * 3.2 Reports - Profit per category
   */
  static async getProfitPerCategory(
    branchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      category: string;
      quantitySold: number;
      totalRevenue: number;
      totalCOGS: number;
      totalProfit: number;
      profitMargin: number;
    }>
  > {
    const drinkStats = await this.getProfitPerDrink(
      branchId,
      startDate,
      endDate
    );

    const categoryStats: Record<
      string,
      {
        quantity: number;
        revenue: number;
        cogs: number;
      }
    > = {};

    for (const drink of drinkStats) {
      const cat = drink.category || "Other";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { quantity: 0, revenue: 0, cogs: 0 };
      }
      categoryStats[cat].quantity += drink.quantitySold;
      categoryStats[cat].revenue += drink.totalRevenue;
      categoryStats[cat].cogs += drink.totalCOGS;
    }

    return Object.entries(categoryStats).map(([category, stats]) => {
      const totalProfit = stats.revenue - stats.cogs;
      const profitMargin =
        stats.revenue > 0 ? (totalProfit / stats.revenue) * 100 : 0;

      return {
        category,
        quantitySold: stats.quantity,
        totalRevenue: parseFloat(stats.revenue.toFixed(2)),
        totalCOGS: parseFloat(stats.cogs.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2)),
      };
    });
  }

  /**
   * 3.2 Reports - Top profitable items
   */
  static async getTopProfitableItems(
    branchId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<
    Array<{
      itemId: string;
      itemName: string;
      quantitySold: number;
      totalProfit: number;
      profitMargin: number;
    }>
  > {
    const items = await this.getProfitPerDrink(
      branchId,
      startDate,
      endDate
    );

    return items
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, limit)
      .map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantitySold: item.quantitySold,
        totalProfit: item.totalProfit,
        profitMargin: item.profitMargin,
      }));
  }

  /**
   * 3.2 Reports - Worst performing items (high cost, low margin)
   */
  static async getWorstItems(
    branchId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<
    Array<{
      itemId: string;
      itemName: string;
      quantitySold: number;
      totalProfit: number;
      profitMargin: number;
      reasonForLoss: string;
    }>
  > {
    const items = await this.getProfitPerDrink(
      branchId,
      startDate,
      endDate
    );

    const analyzed = items.map((item) => {
      let reason = "";
      if (item.profitMargin < 0) {
        reason = "Loss - selling below cost";
      } else if (item.profitMargin < 10) {
        reason = "Very low margin (< 10%)";
      } else if (item.profitMargin < 30) {
        reason = "Low margin (10-30%)";
      } else if (item.quantitySold < 5) {
        reason = "Low sales volume";
      }

      return { ...item, reasonForLoss: reason };
    });

    return analyzed
      .filter((item) => item.reasonForLoss)
      .sort((a, b) => a.profitMargin - b.profitMargin)
      .slice(0, limit);
  }

  /**
   * 3.2 Reports - Waste report by reason/type
   */
  static async getWasteReport(
    branchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      rawItemName: string;
      quantity: number;
      unit: string;
      wasteAmount: number;
      notes: string;
      createdAt: Date;
    }>
  > {
    const wasteMovements = await StockMovementModel.find({
      branchId,
      movementType: "waste",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const result: Array<{
      rawItemName: string;
      quantity: number;
      unit: string;
      wasteAmount: number;
      notes: string;
      createdAt: Date;
    }> = [];

    for (const movement of wasteMovements) {
      const item = await this.getRawItemInfo(movement.rawItemId);
      if (item) {
        const wasteAmount =
          Math.abs(movement.quantity) * (item.costPerUnit || 0);
        result.push({
          rawItemName: item.nameAr,
          quantity: Math.abs(movement.quantity),
          unit: item.unit,
          wasteAmount: parseFloat(wasteAmount.toFixed(2)),
          notes: movement.notes || "No reason specified",
          createdAt: movement.createdAt,
        });
      }
    }

    return result.sort((a, b) => b.wasteAmount - a.wasteAmount);
  }

  /**
   * Save daily snapshot to database
   */
  static async saveDailySnapshot(
    tenantId: string,
    branchId: string,
    createdBy: string,
    date?: Date
  ): Promise<IAccountingSnapshot | null> {
    try {
      const snapshotDate = date || new Date();
      const snapshot = await this.getDailySnapshot(branchId, snapshotDate);
      const reports = await this.getProfitPerDrink(
        branchId,
        new Date(snapshotDate.setHours(0, 0, 0, 0)),
        new Date(snapshotDate.setHours(23, 59, 59, 999))
      );

      // Get top products
      const topProducts = reports
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5)
        .map((item) => ({
          productId: item.itemId,
          productName: item.itemName,
          quantity: item.quantitySold,
          revenue: item.totalRevenue,
        }));

      const accountingSnapshot = new AccountingSnapshotModel({
        tenantId,
        branchId,
        snapshotDate: snapshotDate,
        snapshotType: "daily",
        periodStart: new Date(snapshotDate),
        periodEnd: new Date(snapshotDate),
        totalRevenue: snapshot.totalRevenue,
        totalOrders: snapshot.salesCount,
        averageOrderValue:
          snapshot.salesCount > 0
            ? snapshot.totalRevenue / snapshot.salesCount
            : 0,
        totalCostOfGoods: snapshot.totalCOGS,
        wasteAmount: snapshot.wasteAmount,
        wastePercentage: snapshot.wastePercentage,
        grossProfit: snapshot.grossProfit,
        grossProfitMargin: snapshot.profitMargin,
        topProductsByRevenue: topProducts,
        createdBy,
        isApproved: 0,
      });

      await accountingSnapshot.save();
      return accountingSnapshot;
    } catch (error) {
      console.error("Error saving daily snapshot:", error);
      return null;
    }
  }

  /**
   * Get saved snapshots for date range
   */
  static async getSnapshots(
    tenantId: string,
    branchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IAccountingSnapshot[]> {
    return AccountingSnapshotModel.find({
      tenantId,
      branchId,
      snapshotDate: { $gte: startDate, $lte: endDate },
    }).sort({ snapshotDate: -1 });
  }

  /**
   * Private helpers
   */
  private static async getRawItemCost(
    rawItemId: string
  ): Promise<{ costPerUnit: number } | null> {
    try {
      const { RawItemModel } = await import("@shared/schema");
      const item = await RawItemModel.findById(rawItemId);
      if (!item) return null;
      return { costPerUnit: (item as any).unitCost || 0 };
    } catch {
      return null;
    }
  }

  private static async getRawItemInfo(
    rawItemId: string
  ): Promise<{
    nameAr: string;
    unit: string;
    costPerUnit: number;
  } | null> {
    try {
      const { RawItemModel } = await import("@shared/schema");
      const item = await RawItemModel.findById(rawItemId);
      if (!item) return null;
      return {
        nameAr: (item as any).nameAr || "Unknown",
        unit: (item as any).unit || "piece",
        costPerUnit: (item as any).unitCost || 0,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Export types
 */
export type DailySnapshot = {
  date: string;
  salesCount: number;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  profitMargin: number;
  wasteAmount: number;
  wastePercentage: number;
};

export type ProfitByItem = {
  itemId: string;
  itemName: string;
  category: string;
  quantitySold: number;
  totalRevenue: number;
  totalCOGS: number;
  totalProfit: number;
  profitMargin: number;
  profitPerUnit: number;
};

export type ProfitByCategory = {
  category: string;
  quantitySold: number;
  totalRevenue: number;
  totalCOGS: number;
  totalProfit: number;
  profitMargin: number;
};

export type WasteReport = {
  rawItemName: string;
  quantity: number;
  unit: string;
  wasteAmount: number;
  notes: string;
  createdAt: Date;
};

/**
 * 3.4 Export functionality - CSV export
 */
export class ReportExporter {
  static exportOrdersToCSV(orders: any[]): string {
    const headers = [
      'رقم الطلب',
      'التاريخ',
      'العميل',
      'المبلغ',
      'تكلفة البضاعة',
      'الربح',
      'طريقة الدفع',
      'الحالة',
    ];

    const rows = orders.map(order => [
      order.orderNumber || order._id,
      new Date(order.createdAt).toLocaleDateString('ar-SA'),
      order.customerName || 'زائر',
      order.totalAmount?.toFixed(2) || '0.00',
      order.costOfGoods?.toFixed(2) || '0.00',
      ((order.totalAmount || 0) - (order.costOfGoods || 0)).toFixed(2),
      order.paymentMethod || 'cash',
      order.status || 'unknown',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  static exportInventoryToCSV(items: any[]): string {
    const headers = [
      'اسم المكون',
      'الكمية الحالية',
      'الوحدة',
      'الحد الأدنى',
      'التكلفة للوحدة',
      'الحالة',
    ];

    const rows = items.map(item => [
      item.nameAr,
      item.currentStock?.toString() || '0',
      item.unit || 'piece',
      item.minStockThreshold?.toString() || '0',
      item.unitCost?.toFixed(2) || '0.00',
      item.currentStock <= (item.minStockThreshold || 0) ? 'منخفض' : 'طبيعي',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  static exportProfitReportToCSV(profitData: any[]): string {
    const headers = [
      'المنتج',
      'الفئة',
      'الكمية المباعة',
      'إجمالي الإيرادات',
      'تكلفة البضاعة',
      'الربح',
      'نسبة الربح %',
    ];

    const rows = profitData.map(item => [
      item.itemName,
      item.category,
      item.quantitySold?.toString() || '0',
      item.totalRevenue?.toFixed(2) || '0.00',
      item.totalCOGS?.toFixed(2) || '0.00',
      item.totalProfit?.toFixed(2) || '0.00',
      item.profitMargin?.toFixed(1) || '0.0',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  static generateDailySummaryReport(snapshot: DailySnapshot): string {
    return `
تقرير يومي - ${snapshot.date}
=====================================
عدد الطلبات: ${snapshot.salesCount}
إجمالي المبيعات: ${snapshot.totalRevenue.toFixed(2)} ريال
تكلفة البضاعة: ${snapshot.totalCOGS.toFixed(2)} ريال
إجمالي الربح: ${snapshot.grossProfit.toFixed(2)} ريال
نسبة الربح: ${snapshot.profitMargin.toFixed(1)}%
قيمة الهدر: ${snapshot.wasteAmount.toFixed(2)} ريال
نسبة الهدر: ${snapshot.wastePercentage.toFixed(1)}%
=====================================
    `.trim();
  }
}
