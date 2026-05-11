import { nanoid } from "nanoid";
import {
  DeliveryIntegrationModel,
  DeliveryZoneModel,
  DeliveryDriverModel,
  DeliveryOrderModel,
  IDeliveryIntegration,
  IDeliveryZone,
  IDeliveryDriver,
  IDeliveryOrder,
} from "@shared/schema";
import * as turf from "@turf/turf";

const MINUTES_PER_KM = 2;
const MINUTES_PER_DRINK = 5;

export class DeliveryService {
  async getAllIntegrations(tenantId: string): Promise<IDeliveryIntegration[]> {
    return DeliveryIntegrationModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  async getIntegration(id: string): Promise<IDeliveryIntegration | null> {
    return DeliveryIntegrationModel.findOne({ id });
  }

  async createIntegration(data: Partial<IDeliveryIntegration>): Promise<IDeliveryIntegration> {
    const integration = new DeliveryIntegrationModel({
      ...data,
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return integration.save();
  }

  async updateIntegration(id: string, data: Partial<IDeliveryIntegration>): Promise<IDeliveryIntegration | null> {
    return DeliveryIntegrationModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true }
    );
  }

  async deleteIntegration(id: string): Promise<boolean> {
    const result = await DeliveryIntegrationModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getAllZones(tenantId: string, branchId?: string): Promise<IDeliveryZone[]> {
    const query: any = { tenantId };
    if (branchId) query.branchId = branchId;
    return DeliveryZoneModel.find(query).sort({ priority: -1 });
  }

  async getZone(id: string): Promise<IDeliveryZone | null> {
    return DeliveryZoneModel.findOne({ id });
  }

  async createZone(data: Partial<IDeliveryZone>): Promise<IDeliveryZone> {
    const zone = new DeliveryZoneModel({
      ...data,
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return zone.save();
  }

  async updateZone(id: string, data: Partial<IDeliveryZone>): Promise<IDeliveryZone | null> {
    return DeliveryZoneModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true }
    );
  }

  async deleteZone(id: string): Promise<boolean> {
    const result = await DeliveryZoneModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getAllDrivers(tenantId: string, branchId?: string): Promise<IDeliveryDriver[]> {
    const query: any = { tenantId };
    if (branchId) query.branchId = branchId;
    return DeliveryDriverModel.find(query).sort({ createdAt: -1 });
  }

  async getAvailableDrivers(tenantId: string, branchId?: string): Promise<IDeliveryDriver[]> {
    const query: any = { tenantId, status: 'available', isActive: 1 };
    if (branchId) query.branchId = branchId;
    return DeliveryDriverModel.find(query);
  }

  async getDriver(id: string): Promise<IDeliveryDriver | null> {
    return DeliveryDriverModel.findOne({ id });
  }

  async getDriverByPhone(phone: string): Promise<IDeliveryDriver | null> {
    return DeliveryDriverModel.findOne({ phone, isActive: 1 });
  }

  async createDriver(data: Partial<IDeliveryDriver>): Promise<IDeliveryDriver> {
    const driver = new DeliveryDriverModel({
      ...data,
      id: nanoid(),
      status: 'offline',
      totalDeliveries: 0,
      totalEarnings: 0,
      rating: 5,
      ratingCount: 0,
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return driver.save();
  }

  async updateDriver(id: string, data: Partial<IDeliveryDriver>): Promise<IDeliveryDriver | null> {
    return DeliveryDriverModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true }
    );
  }

  async updateDriverLocation(id: string, lat: number, lng: number): Promise<IDeliveryDriver | null> {
    return DeliveryDriverModel.findOneAndUpdate(
      { id },
      { 
        currentLat: lat,
        currentLng: lng,
        lastLocationUpdate: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async updateDriverStatus(id: string, status: IDeliveryDriver['status']): Promise<IDeliveryDriver | null> {
    return DeliveryDriverModel.findOneAndUpdate(
      { id },
      { status, updatedAt: new Date() },
      { new: true }
    );
  }

  async deleteDriver(id: string): Promise<boolean> {
    const result = await DeliveryDriverModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async getAllDeliveryOrders(tenantId: string, filters?: {
    branchId?: string;
    status?: string;
    driverId?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<IDeliveryOrder[]> {
    const query: any = { tenantId };
    if (filters?.branchId) query.branchId = filters.branchId;
    if (filters?.status) query.status = filters.status;
    if (filters?.driverId) query.driverId = filters.driverId;
    if (filters?.fromDate || filters?.toDate) {
      query.createdAt = {};
      if (filters.fromDate) query.createdAt.$gte = filters.fromDate;
      if (filters.toDate) query.createdAt.$lte = filters.toDate;
    }
    return DeliveryOrderModel.find(query).sort({ createdAt: -1 });
  }

  async getDeliveryOrder(id: string): Promise<IDeliveryOrder | null> {
    return DeliveryOrderModel.findOne({ id });
  }

  async getDeliveryOrderByOrderId(orderId: string): Promise<IDeliveryOrder | null> {
    return DeliveryOrderModel.findOne({ orderId });
  }

  async getPendingOrdersForDriver(tenantId: string, branchId?: string): Promise<IDeliveryOrder[]> {
    const query: any = { 
      tenantId, 
      status: { $in: ['pending', 'accepted'] },
      deliveryType: 'internal'
    };
    if (branchId) query.branchId = branchId;
    return DeliveryOrderModel.find(query).sort({ createdAt: 1 });
  }

  async getDriverActiveOrders(driverId: string): Promise<IDeliveryOrder[]> {
    return DeliveryOrderModel.find({
      driverId,
      status: { $in: ['assigned', 'picking_up', 'on_the_way', 'arrived'] }
    }).sort({ createdAt: 1 });
  }

  async createDeliveryOrder(data: Partial<IDeliveryOrder>): Promise<IDeliveryOrder> {
    const distanceKm = data.distanceKm || this.calculateDistance(
      data.branchLat || 0,
      data.branchLng || 0,
      data.customerLat || 0,
      data.customerLng || 0
    );

    const travelMinutes = Math.ceil(distanceKm * MINUTES_PER_KM);
    const preparationMinutes = data.preparationMinutes || 0;
    const totalEstimatedMinutes = travelMinutes + preparationMinutes;

    const now = new Date();
    const estimatedPickupTime = new Date(now.getTime() + preparationMinutes * 60000);
    const estimatedDeliveryTime = new Date(now.getTime() + totalEstimatedMinutes * 60000);

    const order = new DeliveryOrderModel({
      ...data,
      id: nanoid(),
      distanceKm,
      travelMinutes,
      totalEstimatedMinutes,
      estimatedPickupTime,
      estimatedDeliveryTime,
      status: 'pending',
      trackingHistory: [{
        lat: data.branchLat || 0,
        lng: data.branchLng || 0,
        timestamp: now,
        status: 'pending'
      }],
      createdAt: now,
      updatedAt: now,
    });
    return order.save();
  }

  async updateDeliveryOrder(id: string, data: Partial<IDeliveryOrder>): Promise<IDeliveryOrder | null> {
    return DeliveryOrderModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true }
    );
  }

  async assignDriverToOrder(orderId: string, driverId: string): Promise<IDeliveryOrder | null> {
    const driver = await this.getDriver(driverId);
    if (!driver) return null;

    const order = await DeliveryOrderModel.findOneAndUpdate(
      { id: orderId },
      {
        driverId,
        driverName: driver.fullName,
        driverPhone: driver.phone,
        status: 'assigned',
        driverCurrentLat: driver.currentLat,
        driverCurrentLng: driver.currentLng,
        driverLastUpdate: new Date(),
        updatedAt: new Date(),
        $push: {
          trackingHistory: {
            lat: driver.currentLat || 0,
            lng: driver.currentLng || 0,
            timestamp: new Date(),
            status: 'assigned'
          }
        }
      },
      { new: true }
    );

    if (order) {
      await this.updateDriverStatus(driverId, 'busy');
      await DeliveryDriverModel.findOneAndUpdate(
        { id: driverId },
        { currentOrderId: orderId }
      );
    }

    return order;
  }

  async updateOrderStatus(id: string, status: IDeliveryOrder['status'], additionalData?: Partial<IDeliveryOrder>): Promise<IDeliveryOrder | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
      ...additionalData
    };

    if (status === 'picking_up') {
      updateData.actualPickupTime = new Date();
    } else if (status === 'delivered') {
      updateData.actualDeliveryTime = new Date();
    }

    const order = await DeliveryOrderModel.findOneAndUpdate(
      { id },
      {
        ...updateData,
        $push: {
          trackingHistory: {
            lat: additionalData?.driverCurrentLat || 0,
            lng: additionalData?.driverCurrentLng || 0,
            timestamp: new Date(),
            status
          }
        }
      },
      { new: true }
    );

    if (order && (status === 'delivered' || status === 'cancelled' || status === 'returned') && order.driverId) {
      await this.updateDriverStatus(order.driverId, 'available');
      await DeliveryDriverModel.findOneAndUpdate(
        { id: order.driverId },
        { 
          currentOrderId: null,
          $inc: status === 'delivered' ? { totalDeliveries: 1 } : {}
        }
      );
    }

    return order;
  }

  async updateOrderDriverLocation(orderId: string, lat: number, lng: number): Promise<IDeliveryOrder | null> {
    return DeliveryOrderModel.findOneAndUpdate(
      { id: orderId },
      {
        driverCurrentLat: lat,
        driverCurrentLng: lng,
        driverLastUpdate: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const from = turf.point([lng1, lat1]);
    const to = turf.point([lng2, lat2]);
    return turf.distance(from, to, { units: 'kilometers' });
  }

  calculateETA(distanceKm: number, drinkCount: number): { 
    travelMinutes: number; 
    preparationMinutes: number; 
    totalMinutes: number;
    estimatedDeliveryTime: Date;
  } {
    const travelMinutes = Math.ceil(distanceKm * MINUTES_PER_KM);
    const preparationMinutes = drinkCount * MINUTES_PER_DRINK;
    const totalMinutes = travelMinutes + preparationMinutes;
    const estimatedDeliveryTime = new Date(Date.now() + totalMinutes * 60000);

    return {
      travelMinutes,
      preparationMinutes,
      totalMinutes,
      estimatedDeliveryTime
    };
  }

  async checkPointInZone(lat: number, lng: number, tenantId: string, branchId?: string): Promise<IDeliveryZone | null> {
    const zones = await this.getAllZones(tenantId, branchId);
    const activeZones = zones.filter(z => z.isActive === 1);

    for (const zone of activeZones) {
      if (zone.zoneType === 'polygon' && zone.boundary && zone.boundary.length >= 3) {
        const polygon = turf.polygon([zone.boundary.map(p => [p.lng, p.lat]).concat([[zone.boundary[0].lng, zone.boundary[0].lat]])]);
        const point = turf.point([lng, lat]);
        if (turf.booleanPointInPolygon(point, polygon)) {
          return zone;
        }
      } else if (zone.zoneType === 'radius' && zone.centerLat && zone.centerLng && zone.radiusKm) {
        const distance = this.calculateDistance(zone.centerLat, zone.centerLng, lat, lng);
        if (distance <= zone.radiusKm) {
          return zone;
        }
      }
    }

    return null;
  }

  async calculateDeliveryFee(lat: number, lng: number, tenantId: string, branchId: string, orderAmount: number): Promise<{
    zone: IDeliveryZone | null;
    deliveryFee: number;
    isFreeDelivery: boolean;
    isDeliverable: boolean;
    distanceKm: number;
    estimatedMinutes: { min: number; max: number };
  }> {
    const zone = await this.checkPointInZone(lat, lng, tenantId, branchId);
    
    if (!zone) {
      return {
        zone: null,
        deliveryFee: 0,
        isFreeDelivery: false,
        isDeliverable: false,
        distanceKm: 0,
        estimatedMinutes: { min: 0, max: 0 }
      };
    }

    const branchZones = await DeliveryZoneModel.findOne({ id: zone.id });
    let distanceKm = 0;
    
    if (zone.centerLat && zone.centerLng) {
      distanceKm = this.calculateDistance(zone.centerLat, zone.centerLng, lat, lng);
    }

    let deliveryFee = zone.baseFee + (distanceKm * zone.feePerKm);
    let isFreeDelivery = false;

    if (zone.freeDeliveryThreshold && orderAmount >= zone.freeDeliveryThreshold) {
      deliveryFee = 0;
      isFreeDelivery = true;
    }

    if (zone.minOrderAmount && orderAmount < zone.minOrderAmount) {
      return {
        zone,
        deliveryFee: 0,
        isFreeDelivery: false,
        isDeliverable: false,
        distanceKm,
        estimatedMinutes: { min: zone.estimatedMinMinutes, max: zone.estimatedMaxMinutes }
      };
    }

    return {
      zone,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      isFreeDelivery,
      isDeliverable: true,
      distanceKm: Math.round(distanceKm * 100) / 100,
      estimatedMinutes: { min: zone.estimatedMinMinutes, max: zone.estimatedMaxMinutes }
    };
  }

  async autoAssignDriver(orderId: string, tenantId: string, branchId?: string): Promise<IDeliveryOrder | null> {
    const order = await this.getDeliveryOrder(orderId);
    if (!order || order.status !== 'pending') return null;

    const availableDrivers = await this.getAvailableDrivers(tenantId, branchId);
    if (availableDrivers.length === 0) return null;

    let bestDriver = availableDrivers[0];
    let minDistance = Infinity;

    for (const driver of availableDrivers) {
      if (driver.currentLat && driver.currentLng && order.branchLat && order.branchLng) {
        const dist = this.calculateDistance(driver.currentLat, driver.currentLng, order.branchLat, order.branchLng);
        if (dist < minDistance) {
          minDistance = dist;
          bestDriver = driver;
        }
      }
    }

    return this.assignDriverToOrder(orderId, bestDriver.id);
  }

  async processWebhookOrder(provider: string, payload: any, tenantId: string): Promise<IDeliveryOrder> {
    const externalOrderId = payload.orderId || payload.order_id || payload.id || `${provider}-${Date.now()}`;
    const customerName = payload.customerName || payload.customer_name || payload.customer?.name || 'عميل خارجي';
    const customerPhone = payload.customerPhone || payload.customer_phone || payload.customer?.phone || '';
    const customerAddress = payload.address || payload.delivery_address || payload.customer?.address || '';
    const customerLat = payload.lat || payload.latitude || payload.customer?.lat || 0;
    const customerLng = payload.lng || payload.longitude || payload.customer?.lng || 0;
    const totalAmount = payload.totalAmount || payload.total || payload.order_total || 0;
    const items = payload.items || payload.order_items || [];
    const notes = payload.notes || payload.special_instructions || '';

    const order = await this.createDeliveryOrder({
      tenantId,
      orderId: externalOrderId,
      deliveryType: 'external',
      externalProvider: provider,
      externalOrderId,
      customerName,
      customerPhone,
      customerAddress,
      customerLat,
      customerLng,
      totalAmount,
      deliveryFee: payload.deliveryFee || payload.delivery_fee || 0,
      notes,
      status: 'pending',
    });

    return order;
  }

  async getDeliveryStats(tenantId: string, branchId?: string, fromDate?: Date, toDate?: Date): Promise<{
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    avgDeliveryTime: number;
    totalRevenue: number;
    totalDeliveryFees: number;
    driverStats: { total: number; online: number; busy: number; offline: number };
    providerBreakdown: Record<string, { orders: number; revenue: number }>;
    ordersByStatus: Record<string, number>;
  }> {
    const query: any = { tenantId };
    if (branchId) query.branchId = branchId;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = fromDate;
      if (toDate) query.createdAt.$lte = toDate;
    }

    const orders = await DeliveryOrderModel.find(query).lean();
    const driverQuery: any = { tenantId };
    if (branchId) driverQuery.branchId = branchId;
    const drivers = await DeliveryDriverModel.find(driverQuery).lean();

    const completedOrders = orders.filter(o => o.status === 'delivered');
    const activeOrders = orders.filter(o => ['pending', 'accepted', 'assigned', 'picking_up', 'on_the_way', 'arrived'].includes(o.status));
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    let totalDeliveryMinutes = 0;
    let deliveryCount = 0;
    for (const order of completedOrders) {
      if (order.actualDeliveryTime && order.createdAt) {
        const mins = (new Date(order.actualDeliveryTime).getTime() - new Date(order.createdAt).getTime()) / 60000;
        if (mins > 0 && mins < 300) {
          totalDeliveryMinutes += mins;
          deliveryCount++;
        }
      }
    }

    const providerBreakdown: Record<string, { orders: number; revenue: number }> = {};
    const ordersByStatus: Record<string, number> = {};

    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;

      const prov = order.externalProvider || (order.deliveryType === 'internal' ? 'internal' : 'unknown');
      if (!providerBreakdown[prov]) providerBreakdown[prov] = { orders: 0, revenue: 0 };
      providerBreakdown[prov].orders++;
      providerBreakdown[prov].revenue += order.totalAmount || 0;
    }

    return {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      avgDeliveryTime: deliveryCount > 0 ? Math.round(totalDeliveryMinutes / deliveryCount) : 0,
      totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      totalDeliveryFees: orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0),
      driverStats: {
        total: drivers.length,
        online: drivers.filter(d => d.status === 'available').length,
        busy: drivers.filter(d => d.status === 'busy').length,
        offline: drivers.filter(d => d.status === 'offline').length,
      },
      providerBreakdown,
      ordersByStatus,
    };
  }
}

export const deliveryService = new DeliveryService();
