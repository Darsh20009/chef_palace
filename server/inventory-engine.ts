/**
 * Smart Inventory Engine - Phase 2
 * Handles stock movements, deductions, alerts, and automation
 * Prevents negative stock and provides real-time alerts
 */

import {
  RawItemModel,
  BranchStockModel,
  StockMovementModel,
  StockAlertModel,
  type IRawItem,
  type IBranchStock,
  type IStockMovement,
  type IStockAlert,
} from "@shared/schema";
import { UnitsEngine } from "./units-engine";

/**
 * 2.2 Ingredient Catalog + 2.3 Stock Movements + 2.4 Deduction
 */
export class InventoryEngine {
  /**
   * 2.2 Create/Get ingredient
   */
  static async getIngredient(rawItemId: string): Promise<IRawItem | null> {
    return RawItemModel.findById(rawItemId);
  }

  /**
   * Get ingredient by name
   */
  static async getIngredientByName(nameAr: string): Promise<IRawItem | null> {
    return RawItemModel.findOne({ nameAr });
  }

  /**
   * 2.3 Record Stock In (Purchase)
   */
  static async recordStockIn(params: {
    branchId: string;
    rawItemId: string;
    quantity: number;
    unit: string;
    supplierId?: string;
    notes?: string;
    createdBy: string;
  }): Promise<{
    success: boolean;
    newQuantity?: number;
    movement?: IStockMovement;
    error?: string;
  }> {
    try {
      const rawItem = await this.getIngredient(params.rawItemId);
      if (!rawItem) {
        return { success: false, error: "Ingredient not found" };
      }

      // Convert to storage unit
      const conversion = await UnitsEngine.convertToStorageUnit(
        params.rawItemId,
        params.quantity,
        params.unit
      );
      if (!conversion.success) {
        return { success: false, error: conversion.error };
      }

      // Get or create branch stock
      let branchStock = await BranchStockModel.findOne({
        branchId: params.branchId,
        rawItemId: params.rawItemId,
      });

      const previousQuantity = branchStock?.currentQuantity || 0;
      const newQuantity = previousQuantity + conversion.quantity;

      if (!branchStock) {
        branchStock = new BranchStockModel({
          branchId: params.branchId,
          rawItemId: params.rawItemId,
          currentQuantity: newQuantity,
          reservedQuantity: 0,
        });
      } else {
        branchStock.currentQuantity = newQuantity;
      }

      await branchStock.save();

      // Record movement
      const movement = new StockMovementModel({
        branchId: params.branchId,
        rawItemId: params.rawItemId,
        movementType: "purchase",
        quantity: conversion.quantity,
        previousQuantity,
        newQuantity,
        referenceType: "purchase_invoice",
        notes: params.notes,
        createdBy: params.createdBy,
      });
      await movement.save();

      return {
        success: true,
        newQuantity,
        movement,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 2.3 Record Stock Out (Waste/Manual)
   */
  static async recordStockOut(params: {
    branchId: string;
    rawItemId: string;
    quantity: number;
    unit: string;
    movementType: "waste" | "adjustment" | "return";
    notes?: string;
    createdBy: string;
  }): Promise<{
    success: boolean;
    newQuantity?: number;
    movement?: IStockMovement;
    error?: string;
  }> {
    try {
      const rawItem = await this.getIngredient(params.rawItemId);
      if (!rawItem) {
        return { success: false, error: "Ingredient not found" };
      }

      // Convert to storage unit
      const conversion = await UnitsEngine.convertToStorageUnit(
        params.rawItemId,
        params.quantity,
        params.unit
      );
      if (!conversion.success) {
        return { success: false, error: conversion.error };
      }

      // Get branch stock
      const branchStock = await BranchStockModel.findOne({
        branchId: params.branchId,
        rawItemId: params.rawItemId,
      });

      if (!branchStock) {
        return { success: false, error: "No stock record for this item" };
      }

      const previousQuantity = branchStock.currentQuantity;

      // 2.4 Prevent negative stock
      if (previousQuantity - conversion.quantity < 0) {
        return {
          success: false,
          error: `Insufficient stock. Available: ${previousQuantity}${conversion.storageUnit}, Requested: ${conversion.quantity}${conversion.storageUnit}`,
        };
      }

      const newQuantity = previousQuantity - conversion.quantity;
      branchStock.currentQuantity = newQuantity;
      await branchStock.save();

      // Record movement
      const movement = new StockMovementModel({
        branchId: params.branchId,
        rawItemId: params.rawItemId,
        movementType: params.movementType,
        quantity: -conversion.quantity,
        previousQuantity,
        newQuantity,
        notes: params.notes,
        createdBy: params.createdBy,
      });
      await movement.save();

      // 2.5 Check alerts
      await this.checkAndCreateAlerts(params.branchId, params.rawItemId);

      return {
        success: true,
        newQuantity,
        movement,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 2.4 Deduct inventory from order completion
   * Called when order is completed
   */
  static async deductFromOrder(params: {
    branchId: string;
    items: Array<{
      rawItemId: string;
      quantity: number;
      unit: string;
    }>;
    orderId: string;
    createdBy: string;
  }): Promise<{
    success: boolean;
    deductions: Array<{
      rawItemId: string;
      previousQty: number;
      deductedQty: number;
      newQty: number;
    }>;
    errors: string[];
  }> {
    const deductions: Array<{
      rawItemId: string;
      previousQty: number;
      deductedQty: number;
      newQty: number;
    }> = [];
    const errors: string[] = [];

    for (const item of params.items) {
      const result = await this.recordStockOut({
        branchId: params.branchId,
        rawItemId: item.rawItemId,
        quantity: item.quantity,
        unit: item.unit,
        movementType: "adjustment",
        notes: `Order: ${params.orderId}`,
        createdBy: params.createdBy,
      });

      if (!result.success) {
        errors.push(`${item.rawItemId}: ${result.error}`);
      } else {
        deductions.push({
          rawItemId: item.rawItemId,
          previousQty: result.movement?.previousQuantity || 0,
          deductedQty: item.quantity,
          newQty: result.newQuantity || 0,
        });
      }
    }

    return {
      success: errors.length === 0,
      deductions,
      errors,
    };
  }

  /**
   * Check current stock level
   */
  static async getStockLevel(
    branchId: string,
    rawItemId: string
  ): Promise<{
    currentQuantity: number;
    unit: string;
    minThreshold: number;
    status: "sufficient" | "low" | "out_of_stock";
  } | null> {
    const branchStock = await BranchStockModel.findOne({
      branchId,
      rawItemId,
    });

    if (!branchStock) {
      return null;
    }

    const rawItem = await this.getIngredient(rawItemId);
    if (!rawItem) {
      return null;
    }

    let status: "sufficient" | "low" | "out_of_stock" = "sufficient";
    if (branchStock.currentQuantity === 0) {
      status = "out_of_stock";
    } else if (branchStock.currentQuantity <= (rawItem.minStockLevel || 0)) {
      status = "low";
    }

    return {
      currentQuantity: branchStock.currentQuantity,
      unit: rawItem.unit,
      minThreshold: rawItem.minStockLevel || 0,
      status,
    };
  }

  /**
   * 2.5 Alert Management - Check and create alerts
   */
  static async checkAndCreateAlerts(
    branchId: string,
    rawItemId: string
  ): Promise<void> {
    const branchStock = await BranchStockModel.findOne({
      branchId,
      rawItemId,
    });

    if (!branchStock) {
      return;
    }

    const rawItem = await this.getIngredient(rawItemId);
    if (!rawItem) {
      return;
    }

    // Clear old alerts for this item
    await StockAlertModel.deleteMany({
      branchId,
      rawItemId,
      isResolved: 0,
    });

    // Create appropriate alert
    let alertType: "low_stock" | "out_of_stock" | null = null;

    if (branchStock.currentQuantity === 0) {
      alertType = "out_of_stock";
    } else if (branchStock.currentQuantity <= (rawItem.minStockLevel || 0)) {
      alertType = "low_stock";
    }

    if (alertType) {
      const alert = new StockAlertModel({
        branchId,
        rawItemId,
        alertType,
        currentQuantity: branchStock.currentQuantity,
        thresholdQuantity: rawItem.minStockLevel || 0,
      });
      await alert.save();
    }
  }

  /**
   * Get all active alerts for a branch
   */
  static async getActiveAlerts(branchId: string): Promise<IStockAlert[]> {
    return StockAlertModel.find({
      branchId,
      isResolved: 0,
    }).sort({ createdAt: -1 });
  }

  /**
   * Get low stock items (for daily summary)
   */
  static async getLowStockItems(branchId: string): Promise<
    Array<{
      rawItemId: string;
      nameAr: string;
      currentQuantity: number;
      minThreshold: number;
      unit: string;
    }>
  > {
    const alerts = await StockAlertModel.find({
      branchId,
      alertType: "low_stock",
      isResolved: 0,
    });

    const result = [];
    for (const alert of alerts) {
      const rawItem = await this.getIngredient(alert.rawItemId);
      if (rawItem) {
        result.push({
          rawItemId: alert.rawItemId,
          nameAr: rawItem.nameAr,
          currentQuantity: alert.currentQuantity,
          minThreshold: alert.thresholdQuantity,
          unit: rawItem.unit,
        });
      }
    }
    return result;
  }

  /**
   * Resolve alert (mark as handled)
   */
  static async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const result = await StockAlertModel.findByIdAndUpdate(
      alertId,
      {
        isResolved: 1,
        resolvedBy,
        resolvedAt: new Date(),
      },
      { new: true }
    );
    return !!result;
  }

  /**
   * Get movement history
   */
  static async getMovementHistory(
    branchId: string,
    rawItemId: string,
    limit: number = 100
  ): Promise<IStockMovement[]> {
    return StockMovementModel.find({
      branchId,
      rawItemId,
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}

/**
 * Export types
 */
export type StockLevel = {
  currentQuantity: number;
  unit: string;
  minThreshold: number;
  status: "sufficient" | "low" | "out_of_stock";
};
