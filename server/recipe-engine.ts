/**
 * Recipe Intelligence Engine - Phase 1 Enhanced
 * Handles recipe cost calculation, validation, modifiers, and integration with orders
 * Competitive advantage: Full cost transparency for every drink
 */

import { RecipeModel, RawItemModel, CoffeeItemModel, ProductAddonModel, type IRecipe } from "@shared/schema";
import { nanoid } from "nanoid";

interface RecipeIngredient {
  rawItemId: string;
  quantity: number;
  unit: string;
}

interface CalculatedRecipeIngredient extends RecipeIngredient {
  rawItemName: string;
  unitCost: number;
  totalCost: number;
}

interface ModifierCost {
  modifierId: string;
  modifierName: string;
  quantity: number;
  priceImpact: number;
  recipeCost: number;
  totalCost: number;
}

interface OrderItemCostSnapshot {
  baseRecipeCost: number;
  modifiersCost: number;
  totalCost: number;
  sellingPrice: number;
  profitAmount: number;
  profitMargin: number;
  ingredients: CalculatedRecipeIngredient[];
  modifiers: ModifierCost[];
  snapshotTime: Date;
}

/**
 * 1.4 Cost Calculation Engine
 * Calculates actual cost for each drink
 */
export class RecipeEngine {
  /**
   * Calculate total cost of recipe from raw item prices
   */
  static async calculateRecipeCost(
    ingredients: RecipeIngredient[]
  ): Promise<{
    success: boolean;
    totalCost: number;
    ingredients: CalculatedRecipeIngredient[];
    errors?: string[];
  }> {
    const errors: string[] = [];
    let totalCost = 0;
    const calculatedIngredients: CalculatedRecipeIngredient[] = [];

    for (const ing of ingredients) {
      // Validation 1: Check if raw item exists
      const rawItem = await RawItemModel.findOne({ _id: ing.rawItemId });
      if (!rawItem) {
        errors.push(`Raw item ${ing.rawItemId} not found`);
        continue;
      }

      // Validation 2: Check quantity > 0
      if (!ing.quantity || ing.quantity <= 0) {
        errors.push(`Ingredient ${rawItem.nameAr} must have quantity > 0`);
        continue;
      }

      // Validation 3: Check supported units
      const supportedUnits = ["g", "ml", "kg", "l", "pieces", "pcs", "box"];
      if (!supportedUnits.includes(ing.unit.toLowerCase())) {
        errors.push(`Unit "${ing.unit}" not supported`);
        continue;
      }

      // Convert units if needed and calculate cost
      const unitCost = (rawItem as any).unitCost || (rawItem as any).costPerUnit || 0;
      const convertedQuantity = this.convertUnits(
        ing.quantity,
        ing.unit,
        rawItem.unit
      );
      const ingredientCost = convertedQuantity * unitCost;

      totalCost += ingredientCost;
      calculatedIngredients.push({
        rawItemId: ing.rawItemId,
        quantity: ing.quantity,
        unit: ing.unit,
        rawItemName: rawItem.nameAr,
        unitCost: unitCost,
        totalCost: ingredientCost,
      });
    }

    return {
      success: errors.length === 0,
      totalCost: parseFloat(totalCost.toFixed(2)),
      ingredients: calculatedIngredients,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create or update recipe with versioning
   */
  static async createRecipe(
    coffeeItemId: string,
    nameAr: string,
    nameEn: string | undefined,
    ingredients: RecipeIngredient[]
  ): Promise<{
    success: boolean;
    recipe?: IRecipe;
    error?: string;
  }> {
    try {
      // Validate coffee item exists
      const coffeeItem = await CoffeeItemModel.findOne({ _id: coffeeItemId });
      if (!coffeeItem) {
        return {
          success: false,
          error: `Coffee item ${coffeeItemId} not found`,
        };
      }

      // Calculate cost
      const costResult = await this.calculateRecipeCost(ingredients);
      if (!costResult.success) {
        return {
          success: false,
          error: `Recipe validation failed: ${costResult.errors?.join(", ")}`,
        };
      }

      // Get next version
      const lastRecipe = await RecipeModel.findOne({ coffeeItemId })
        .sort({ version: -1 })
        .limit(1);
      const nextVersion = (lastRecipe?.version || 0) + 1;

      // Create recipe
      const recipe = new RecipeModel({
        coffeeItemId,
        nameAr,
        nameEn,
        version: nextVersion,
        isActive: true,
        totalCost: costResult.totalCost,
        ingredients: costResult.ingredients,
      });

      await recipe.save();

      return {
        success: true,
        recipe,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Get active recipe for a coffee item
   */
  static async getActiveRecipe(
    coffeeItemId: string
  ): Promise<IRecipe | null> {
    return RecipeModel.findOne({ coffeeItemId, isActive: true }).sort({
      version: -1,
    });
  }

  /**
   * 1.5 Freeze cost snapshot for order
   * Called when order is created - locks current recipe cost
   */
  static async freezeRecipeSnapshot(coffeeItemId: string): Promise<{
    totalCost: number;
    ingredients: CalculatedRecipeIngredient[];
  } | null> {
    const recipe = await this.getActiveRecipe(coffeeItemId);
    if (!recipe) {
      return null;
    }

    return {
      totalCost: recipe.totalCost,
      ingredients: recipe.ingredients,
    };
  }

  /**
   * Calculate profit for order item
   */
  static calculateProfit(
    sellingPrice: number,
    costOfGoods: number
  ): {
    profitAmount: number;
    profitMargin: number;
  } {
    const profitAmount = sellingPrice - costOfGoods;
    const profitMargin = sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : 0;

    return {
      profitAmount: parseFloat(profitAmount.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
    };
  }

  /**
   * 1.3 Calculate modifier cost with recipe impact
   * Each modifier can have a price impact AND recipe/inventory impact
   */
  static async calculateModifiersCost(
    modifiers: Array<{ modifierId: string; quantity: number }>
  ): Promise<{
    success: boolean;
    totalCost: number;
    modifiers: ModifierCost[];
    errors?: string[];
  }> {
    const errors: string[] = [];
    let totalCost = 0;
    const calculatedModifiers: ModifierCost[] = [];

    for (const mod of modifiers) {
      let addon = await ProductAddonModel.findOne({ id: mod.modifierId });
      if (!addon) {
        addon = await ProductAddonModel.findById(mod.modifierId);
      }
      if (!addon) {
        continue;
      }

      const priceImpact = (addon.price || 0) * mod.quantity;
      let recipeCost = 0;

      if (addon.rawItemId && addon.quantityPerUnit) {
        const rawItem = await RawItemModel.findOne({ _id: addon.rawItemId });
        if (rawItem) {
          const unitCost = (rawItem as any).unitCost || (rawItem as any).costPerUnit || 0;
          recipeCost = addon.quantityPerUnit * mod.quantity * unitCost;
        }
      }

      const modifierTotalCost = recipeCost;
      totalCost += modifierTotalCost;

      calculatedModifiers.push({
        modifierId: mod.modifierId,
        modifierName: addon.nameAr,
        quantity: mod.quantity,
        priceImpact,
        recipeCost,
        totalCost: modifierTotalCost,
      });
    }

    return {
      success: errors.length === 0,
      totalCost: parseFloat(totalCost.toFixed(2)),
      modifiers: calculatedModifiers,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 1.5 Enhanced: Create complete cost snapshot for order item
   * Freezes recipe + modifiers cost at order creation time
   */
  static async createOrderItemCostSnapshot(
    coffeeItemId: string,
    sellingPrice: number,
    quantity: number,
    modifiers?: Array<{ modifierId: string; quantity: number }>
  ): Promise<OrderItemCostSnapshot | null> {
    const recipe = await this.getActiveRecipe(coffeeItemId);
    
    const unitRecipeCost = recipe ? recipe.totalCost : 0;
    const ingredients = recipe ? recipe.ingredients : [];

    let unitModifiersCost = 0;
    let calculatedModifiers: ModifierCost[] = [];

    if (modifiers && modifiers.length > 0) {
      const modResult = await this.calculateModifiersCost(modifiers);
      unitModifiersCost = modResult.totalCost;
      calculatedModifiers = modResult.modifiers;
    }

    const unitTotalCost = unitRecipeCost + unitModifiersCost;
    const totalCost = unitTotalCost * quantity;
    const totalSellingPrice = sellingPrice * quantity;
    const { profitAmount, profitMargin } = this.calculateProfit(totalSellingPrice, totalCost);

    return {
      baseRecipeCost: unitRecipeCost,
      modifiersCost: unitModifiersCost,
      totalCost,
      sellingPrice: totalSellingPrice,
      profitAmount,
      profitMargin,
      ingredients,
      modifiers: calculatedModifiers,
      snapshotTime: new Date(),
    };
  }

  /**
   * Calculate total COGS for entire order
   */
  static async calculateOrderCOGS(
    items: Array<{
      coffeeItemId: string;
      price: number;
      quantity: number;
      selectedAddons?: Array<{ id: string; quantity?: number }>;
      addons?: Array<{ id: string; quantity?: number }>;
      customization?: { selectedAddons?: Array<{ id: string; quantity?: number }> };
    }>
  ): Promise<{
    totalCOGS: number;
    totalRevenue: number;
    totalProfit: number;
    profitMargin: number;
    itemSnapshots: OrderItemCostSnapshot[];
  }> {
    const itemSnapshots: OrderItemCostSnapshot[] = [];
    let totalCOGS = 0;
    let totalRevenue = 0;

    for (const item of items) {
      const rawAddons = item.selectedAddons || 
                        item.addons || 
                        (item.customization as any)?.selectedAddons || 
                        [];
      const modifiers = rawAddons.map((a: any) => ({
        modifierId: a.id || a.addonId || a.modifierId || a._id,
        quantity: (a.quantity || 1),
      }));

      const snapshot = await this.createOrderItemCostSnapshot(
        item.coffeeItemId,
        item.price,
        item.quantity,
        modifiers
      );

      if (snapshot) {
        itemSnapshots.push(snapshot);
        totalCOGS += snapshot.totalCost;
        totalRevenue += snapshot.sellingPrice;
      }
    }

    const totalProfit = totalRevenue - totalCOGS;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalCOGS: parseFloat(totalCOGS.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      itemSnapshots,
    };
  }

  /**
   * Unit conversion helper
   */
  private static convertUnits(
    quantity: number,
    fromUnit: string,
    toUnit: string
  ): number {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    if (from === to) return quantity;

    // ml to l
    if ((from === "ml" || from === "milliliter") && (to === "l" || to === "liter")) {
      return quantity / 1000;
    }
    // l to ml
    if ((from === "l" || from === "liter") && (to === "ml" || to === "milliliter")) {
      return quantity * 1000;
    }
    // g to kg
    if ((from === "g" || from === "gram") && (to === "kg" || to === "kilogram")) {
      return quantity / 1000;
    }
    // kg to g
    if ((from === "kg" || from === "kilogram") && (to === "g" || to === "gram")) {
      return quantity * 1000;
    }

    return quantity;
  }
}

/**
 * Export types for API
 */
export type RecipeCreateRequest = {
  coffeeItemId: string;
  nameAr: string;
  nameEn?: string;
  ingredients: RecipeIngredient[];
};

export type RecipeCostResponse = {
  totalCost: number;
  ingredients: CalculatedRecipeIngredient[];
  profitMargin?: number;
};
