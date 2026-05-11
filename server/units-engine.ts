/**
 * Units & Conversion Engine - Phase 2.1
 * Handles all unit conversions (g/kg, ml/L, pcs)
 * Storage unit for each ingredient
 */

import { RawItemModel, type IRawItem } from "@shared/schema";

/**
 * Supported units in the system
 */
export const SUPPORTED_UNITS = {
  WEIGHT: ["g", "kg"],
  VOLUME: ["ml", "l"],
  PIECES: ["pcs", "piece", "box"],
} as const;

export type SupportedUnit = "g" | "kg" | "ml" | "l" | "pcs" | "piece" | "box";

/**
 * Conversion ratios
 */
const CONVERSION_RULES: Record<string, number> = {
  // Weight conversions (to grams as base)
  "g-kg": 1000,
  "kg-g": 0.001,

  // Volume conversions (to ml as base)
  "ml-l": 1000,
  "l-ml": 0.001,
};

/**
 * 2.1 Units & Conversion Engine
 * Handles unit conversions across different measurement types
 */
export class UnitsEngine {
  /**
   * Normalize quantity to base units (g, ml, pcs)
   */
  static normalize(quantity: number, unit: string): number {
    const u = unit.toLowerCase().trim();
    switch (u) {
      case 'kg': return quantity * 1000;
      case 'l': return quantity * 1000;
      default: return quantity;
    }
  }

  /**
   * Convert from base units to display units
   */
  static format(quantity: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    if (from === to) return quantity;

    // g to kg
    if (from === 'g' && to === 'kg') return quantity / 1000;
    // ml to l
    if (from === 'ml' && to === 'l') return quantity / 1000;
    // kg to g
    if (from === 'kg' && to === 'g') return quantity * 1000;
    // l to ml
    if (from === 'l' && to === 'ml') return quantity * 1000;

    return quantity;
  }

  static getBaseUnit(unit: string): string {
    const u = unit.toLowerCase().trim();
    if (u === 'kg') return 'g';
    if (u === 'l') return 'ml';
    return u;
  }

  /**
   * Validate if a unit is supported
   */
  static isValidUnit(unit: string): unit is SupportedUnit {
    const normalized = unit.toLowerCase().trim();
    return (
      SUPPORTED_UNITS.WEIGHT.includes(normalized as any) ||
      SUPPORTED_UNITS.VOLUME.includes(normalized as any) ||
      SUPPORTED_UNITS.PIECES.includes(normalized as any)
    );
  }

  /**
   * Get unit type
   */
  static getUnitType(unit: string): "weight" | "volume" | "pieces" | null {
    const normalized = unit.toLowerCase().trim();
    if (SUPPORTED_UNITS.WEIGHT.includes(normalized as any)) return "weight";
    if (SUPPORTED_UNITS.VOLUME.includes(normalized as any)) return "volume";
    if (SUPPORTED_UNITS.PIECES.includes(normalized as any)) return "pieces";
    return null;
  }

  /**
   * Convert quantity from one unit to another
   * Returns converted quantity or original if units are same/incompatible
   */
  static convert(
    quantity: number,
    fromUnit: string,
    toUnit: string
  ): {
    success: boolean;
    convertedQuantity: number;
    error?: string;
  } {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    // Same unit = no conversion needed
    if (from === to) {
      return { success: true, convertedQuantity: quantity };
    }

    // Validate both units
    if (!this.isValidUnit(from)) {
      return {
        success: false,
        convertedQuantity: quantity,
        error: `Unit "${from}" not supported`,
      };
    }

    if (!this.isValidUnit(to)) {
      return {
        success: false,
        convertedQuantity: quantity,
        error: `Unit "${to}" not supported`,
      };
    }

    // Check if units are of same type
    const fromType = this.getUnitType(from);
    const toType = this.getUnitType(to);

    if (fromType !== toType) {
      return {
        success: false,
        convertedQuantity: quantity,
        error: `Cannot convert ${from} (${fromType}) to ${to} (${toType})`,
      };
    }

    // Get conversion factor
    const conversionKey = `${from}-${to}`;
    const factor = CONVERSION_RULES[conversionKey];

    if (!factor) {
      return {
        success: false,
        convertedQuantity: quantity,
        error: `No conversion rule for ${from} → ${to}`,
      };
    }

    const converted = parseFloat((quantity * factor).toFixed(4));
    return { success: true, convertedQuantity: converted };
  }

  /**
   * Normalize quantity to a standard unit for comparison
   * Weight → g, Volume → ml, Pieces → pcs
   */
  static normalizeToBase(
    quantity: number,
    unit: string
  ): {
    quantity: number;
    baseUnit: string;
  } {
    const normalized = unit.toLowerCase().trim();

    // Weight → grams
    if (normalized === "kg") {
      return { quantity: quantity * 1000, baseUnit: "g" };
    }

    // Volume → milliliters
    if (normalized === "l") {
      return { quantity: quantity * 1000, baseUnit: "ml" };
    }

    // Already base units or pieces
    return { quantity, baseUnit: normalized };
  }

  /**
   * Get storage unit for an ingredient
   */
  static async getStorageUnit(rawItemId: string): Promise<string | null> {
    const rawItem = await RawItemModel.findById(rawItemId);
    return rawItem?.unit || null;
  }

  /**
   * Convert ingredient quantity to its storage unit
   */
  static async convertToStorageUnit(
    rawItemId: string,
    quantity: number,
    fromUnit: string
  ): Promise<{
    success: boolean;
    quantity: number;
    storageUnit: string;
    error?: string;
  }> {
    const storageUnit = await this.getStorageUnit(rawItemId);
    if (!storageUnit) {
      return {
        success: false,
        quantity,
        storageUnit: "",
        error: `Ingredient ${rawItemId} not found`,
      };
    }

    const conversion = this.convert(quantity, fromUnit, storageUnit);
    if (!conversion.success) {
      return {
        success: false,
        quantity,
        storageUnit,
        error: conversion.error,
      };
    }

    return {
      success: true,
      quantity: conversion.convertedQuantity,
      storageUnit,
    };
  }

  /**
   * Bulk convert multiple items to their storage units
   */
  static async convertBulkToStorageUnits(
    items: Array<{ rawItemId: string; quantity: number; unit: string }>
  ): Promise<{
    success: boolean;
    items: Array<{
      rawItemId: string;
      quantity: number;
      storageUnit: string;
    }>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const convertedItems: Array<{
      rawItemId: string;
      quantity: number;
      storageUnit: string;
    }> = [];

    for (const item of items) {
      const result = await this.convertToStorageUnit(
        item.rawItemId,
        item.quantity,
        item.unit
      );

      if (!result.success) {
        errors.push(
          `Item ${item.rawItemId}: ${result.error || "Unknown error"}`
        );
      } else {
        convertedItems.push({
          rawItemId: item.rawItemId,
          quantity: result.quantity,
          storageUnit: result.storageUnit,
        });
      }
    }

    return {
      success: errors.length === 0,
      items: convertedItems,
      errors,
    };
  }
}

/**
 * Export types
 */
export type UnitType = "weight" | "volume" | "pieces";
