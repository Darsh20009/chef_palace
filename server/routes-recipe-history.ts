/**
 * Recipe History API Endpoints - Phase 1
 * Exported routes to be added to routes.ts
 */

import { RecipeHistoryModel, RecipeDefinitionModel } from "@shared/schema";

export async function setupRecipeHistoryRoutes(app: any, requireAuth: any, requireManager: any) {
  // Get recipe version history
  app.get("/api/recipes/:recipeId/history", requireAuth, requireManager, async (req: any, res: any) => {
    try {
      const { recipeId } = req.params;
      const history = await RecipeHistoryModel.find({ recipeId })
        .sort({ version: -1 })
        .lean();
      
      res.json({
        success: true,
        count: history.length,
        versions: history
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe history" });
    }
  });

  // Get specific version of recipe
  app.get("/api/recipes/:recipeId/version/:version", requireAuth, requireManager, async (req: any, res: any) => {
    try {
      const { recipeId, version } = req.params;
      const versionRecord = await RecipeHistoryModel.findOne({
        recipeId,
        version: parseInt(version)
      }).lean();
      
      if (!versionRecord) {
        return res.status(404).json({ error: "Recipe version not found" });
      }
      
      res.json({
        success: true,
        version: versionRecord
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe version" });
    }
  });

  // Restore recipe to previous version (creates new version with old content)
  app.post("/api/recipes/:recipeId/restore/:targetVersion", requireAuth, requireManager, async (req: any, res: any) => {
    try {
      const { recipeId, targetVersion } = req.params;
      
      // Get target version to restore
      const targetVersionRecord = await RecipeHistoryModel.findOne({
        recipeId,
        version: parseInt(targetVersion)
      });
      
      if (!targetVersionRecord) {
        return res.status(404).json({ error: "Target version not found" });
      }
      
      // Get current recipe
      const currentRecipe = await RecipeDefinitionModel.findById(recipeId);
      if (!currentRecipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      
      // Get highest version for new version number
      const highestVersion = await RecipeHistoryModel.findOne({ recipeId })
        .sort({ version: -1 })
        .lean();
      
      const newVersion = (highestVersion?.version || currentRecipe.version || 0) + 1;
      
      // Save current version to history before restoring
      await RecipeHistoryModel.create({
        tenantId: currentRecipe.tenantId,
        productId: currentRecipe.productId,
        recipeId: recipeId.toString(),
        version: newVersion - 1,
        ingredients: currentRecipe.ingredients,
        totalCost: currentRecipe.totalCost,
        reason: `Restored from version ${targetVersion}`
      });
      
      // Update recipe with old content
      await RecipeDefinitionModel.findByIdAndUpdate(recipeId, {
        ingredients: targetVersionRecord.ingredients,
        totalCost: targetVersionRecord.totalCost,
        version: newVersion,
        updatedAt: new Date()
      });
      
      res.json({
        success: true,
        message: `Recipe restored to version ${targetVersion}, saved as version ${newVersion}`,
        newVersion
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore recipe version" });
    }
  });
}
