/**
 * PHASE 2 - Smart Inventory Core - API Implementation
 * Stock Movements, Alerts, and Unit Conversions
 */

import { StockMovementModel, StockAlertModel, UnitConversionModel } from "@shared/schema";

export async function setupInventoryPhase2Routes(app: any, requireAuth: any, requireManager: any) {
  // Record stock movement (In/Out/Adjustment)
  app.post("/api/inventory/movements", requireAuth, requireManager, async (req: any, res: any) => {
    try {
      const { branchId, rawItemId, movementType, quantity, previousQuantity, newQuantity, notes } = req.body;
      
      const movement = await StockMovementModel.create({
        branchId,
        rawItemId,
        movementType,
        quantity,
        previousQuantity,
        newQuantity,
        referenceType: 'manual',
        notes,
        createdBy: req.employee?.username || 'system'
      });
      
      res.status(201).json({ success: true, movement });
    } catch (error) {
      res.status(500).json({ error: "Failed to record stock movement" });
    }
  });

  // Get stock movement history
  app.get("/api/inventory/movements/:branchId", requireAuth, async (req: any, res: any) => {
    try {
      const { branchId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      
      const movements = await StockMovementModel
        .find({ branchId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      
      res.json({ success: true, count: movements.length, movements });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movements" });
    }
  });

  // Get stock alerts
  app.get("/api/inventory/alerts/:branchId", requireAuth, async (req: any, res: any) => {
    try {
      const { branchId } = req.params;
      const unresolved = req.query.unresolved === 'true' ? { isResolved: 0 } : {};
      
      const alerts = await StockAlertModel
        .find({ branchId, ...unresolved })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      
      res.json({ success: true, count: alerts.length, alerts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Resolve alert
  app.patch("/api/inventory/alerts/:alertId/resolve", requireAuth, requireManager, async (req: any, res: any) => {
    try {
      const { alertId } = req.params;
      const { actionTaken } = req.body;
      
      const alert = await StockAlertModel.findByIdAndUpdate(alertId, {
        isResolved: 1,
        resolvedBy: req.employee?.username,
        resolvedAt: new Date()
      }, { new: true });
      
      res.json({ success: true, alert });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  // Get unit conversions
  app.get("/api/inventory/units/:tenantId", requireAuth, async (req: any, res: any) => {
    try {
      const { tenantId } = req.params;
      const conversions = await UnitConversionModel.find({ tenantId }).lean();
      
      res.json({ success: true, conversions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversions" });
    }
  });

  // Add unit conversion
  app.post("/api/inventory/units", requireAuth, requireManager, async (req: any, res: any) => {
    try {
      const { tenantId, fromUnit, toUnit, conversionFactor } = req.body;
      
      const conversion = await UnitConversionModel.create({
        tenantId,
        fromUnit,
        toUnit,
        conversionFactor
      });
      
      res.status(201).json({ success: true, conversion });
    } catch (error) {
      res.status(500).json({ error: "Failed to add conversion" });
    }
  });
}
