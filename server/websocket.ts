import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { sendPushToEmployee, sendPushToCustomer } from "./push-service";
import { registerWSHooks } from "./notification-engine";

interface WSClient {
  ws: WebSocket;
  type: "kitchen" | "display" | "order-tracking" | "pos" | "inventory" | "delivery-driver" | "delivery-tracking" | "customer" | "pos-display" | "employee-tracking" | "manager-tracking";
  orderId?: string;
  branchId?: string;
  driverId?: string;
  deliveryOrderId?: string;
  customerId?: string;
  posId?: string;
  userId?: string;
  employeeId?: string;
  attendanceId?: string;
  lastPing: number;
  isAlive: boolean;
}

class OrderWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  setup(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "", "http://localhost").pathname;
      if (pathname !== "/ws/orders") return;

      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit("connection", ws, request);
      });
    });

    this.wss.on("connection", (ws, req) => {
      console.log("[WS] New client connected");

      const client: WSClient = {
        ws,
        type: "display",
        lastPing: Date.now(),
        isAlive: true,
      };
      this.clients.set(ws, client);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      });

      ws.on("close", (code, reason) => {
        console.log(`[WS] Client disconnected: ${code} ${reason || ''}`);
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("[WS] Client error:", error.message);
        this.clients.delete(ws);
        try {
          ws.terminate();
        } catch (e) {}
      });

      ws.on("pong", () => {
        const client = this.clients.get(ws);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      ws.send(JSON.stringify({ type: "welcome", timestamp: Date.now() }));
    });

    this.startHeartbeat();
    console.log("✅ WebSocket server initialized at /ws/orders");
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000;

      this.clients.forEach((client, ws) => {
        if (!client.isAlive || (now - client.lastPing > staleThreshold)) {
          console.log("[WS] Terminating stale client");
          this.clients.delete(ws);
          try {
            ws.terminate();
          } catch (e) {}
          return;
        }

        client.isAlive = false;
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
        } catch (e) {
          this.clients.delete(ws);
        }
      });
    }, 30000);
  }

  private handleMessage(ws: WebSocket, message: { type: string; [key: string]: any }) {
    const client = this.clients.get(ws);
    if (client) {
      client.lastPing = Date.now();
      client.isAlive = true;
    }

    switch (message.type) {
      case "subscribe":
        if (client) {
          client.type = message.clientType || "display";
          client.orderId = message.orderId;
          client.branchId = message.branchId;
          client.driverId = message.driverId;
          client.deliveryOrderId = message.deliveryOrderId;
          client.customerId = message.customerId;
          client.userId = message.userId || message.customerId;
          client.employeeId = message.employeeId;
          client.attendanceId = message.attendanceId;
        }
        console.log(`[WS] Client subscribed as ${message.clientType} userId=${message.userId || message.customerId || "anon"}`);
        ws.send(JSON.stringify({ type: "subscribed", clientType: message.clientType }));
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      case "driver_location_update":
        if (client && client.type === "delivery-driver" && client.driverId) {
          this.broadcastDriverLocation(client.driverId, message.location, message.deliveryOrderId);
        }
        break;

      case "employee_location_update":
        if (client && client.type === "employee-tracking" && client.employeeId) {
          this.broadcastEmployeeLocation({
            employeeId: client.employeeId,
            attendanceId: client.attendanceId,
            branchId: client.branchId,
            location: message.location,
            isInsideBranch: message.isInsideBranch,
            distanceFromBranch: message.distanceFromBranch,
            employeeName: message.employeeName,
            employeePhoto: message.employeePhoto,
          });
        }
        break;

      case "pos_cart_update":
        if (client && client.type === "pos") {
          this.broadcastPosDisplay(message.payload, client.branchId);
        }
        break;

      default:
        break;
    }
  }

  private cleanupStaleClients() {
    this.clients.forEach((client, ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log("[WS] Removing closed connection");
        this.clients.delete(ws);
      }
    });
  }

  broadcastOrderUpdate(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({
      type: "order_updated",
      order,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (
          client.type === "kitchen" ||
          client.type === "display" ||
          client.type === "pos" ||
          (client.type === "order-tracking" && client.orderId === order.id)
        ) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastNewOrder(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({
      type: "new_order",
      order,
      timestamp: Date.now(),
    });

    // Send to connected WS clients
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "kitchen" || client.type === "display" || client.type === "pos") {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });

    // Also trigger a background push notification for PWA
    const isOnline = order.channel === 'online' || (!order.channel && !order.employeeId);
    this.sendPushNotification({
      title: isOnline ? "طلب جديد أونلاين 🌐" : "طلب جديد ☕",
      body: `طلب رقم #${order.orderNumber} بقيمة ${order.totalAmount} ر.س`,
      url: "/employee/orders",
      orderId: order.id,
      sound: true,
      isOnlineOrder: isOnline
    });
  }

  private async sendPushNotification(payload: any) {
    try {
      const branchId = payload.branchId || 'all';
      await sendPushToEmployee(branchId, {
        title: payload.title,
        body: payload.body,
        url: payload.url || '/employee/orders',
        tag: 'new-order'
      });
    } catch (error) {
      console.error("[PUSH] Error sending push notification:", error);
    }
    // No push_alert broadcast needed — pages that receive new_order handle their own sound
  }

  broadcastOrderReady(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({
      type: "order_ready",
      order,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (
          client.type === "display" ||
          (client.type === "order-tracking" && client.orderId === order.id)
        ) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastStockAlert(alert: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({
      type: "stock_alert",
      alert,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "inventory" || client.type === "display") {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastAlertResolved(alertId: string, branchId: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({
      type: "alert_resolved",
      alertId,
      branchId,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "inventory" || client.type === "display") {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  getConnectionCount(): number {
    return this.clients.size;
  }

  broadcastDeliveryUpdate(deliveryOrder: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const orderId = String(deliveryOrder.id || deliveryOrder._id || "");
    const driverId = String(deliveryOrder.driverId || deliveryOrder.driver?._id || "");

    const message = JSON.stringify({
      type: "delivery_updated",
      deliveryOrder,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const isDriver = client.type === "delivery-driver" && client.driverId && driverId && client.driverId === driverId;
        const isTracker = client.type === "delivery-tracking" && client.deliveryOrderId && orderId && client.deliveryOrderId === orderId;
        if (isDriver || isTracker) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastDriverLocation(driverId: string, location: { lat: number; lng: number }, deliveryOrderId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedOrderId = deliveryOrderId ? String(deliveryOrderId) : "";
    const normalizedDriverId = String(driverId);

    const message = JSON.stringify({
      type: "driver_location",
      driverId: normalizedDriverId,
      location,
      deliveryOrderId: normalizedOrderId,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const matchesOrder = client.type === "delivery-tracking" && 
          client.deliveryOrderId && normalizedOrderId && 
          client.deliveryOrderId === normalizedOrderId;
        const matchesDriver = client.type === "delivery-tracking" &&
          client.driverId && normalizedDriverId &&
          client.driverId === normalizedDriverId;
        if (matchesOrder || matchesDriver) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastEmployeeLocation(data: {
    employeeId: string;
    attendanceId?: string;
    branchId?: string;
    location: { lat: number; lng: number };
    isInsideBranch: boolean;
    distanceFromBranch: number;
    employeeName?: string;
    employeePhoto?: string;
  }) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({
      type: "employee_location",
      ...data,
      timestamp: Date.now(),
    });

    // Alert if outside branch
    if (!data.isInsideBranch) {
      const alertMessage = JSON.stringify({
        type: "employee_left_branch",
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        branchId: data.branchId,
        location: data.location,
        distanceFromBranch: data.distanceFromBranch,
        timestamp: Date.now(),
      });
      this.clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN && client.type === "manager-tracking") {
          const branchMatch = !data.branchId || !client.branchId || client.branchId === data.branchId || client.branchId === "all";
          if (branchMatch) {
            try { ws.send(alertMessage); } catch (e) { this.clients.delete(ws); }
          }
        }
      });
    }

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "manager-tracking") {
        const branchMatch = !data.branchId || !client.branchId || client.branchId === data.branchId || client.branchId === "all";
        if (branchMatch) {
          try { ws.send(message); } catch (e) { this.clients.delete(ws); }
        }
      }
    });
  }

  broadcastNewDeliveryOrder(deliveryOrder: any, branchId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedBranchId = branchId ? String(branchId) : "";

    const message = JSON.stringify({
      type: "new_delivery_order",
      deliveryOrder,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "delivery-driver") {
          const branchMatches = !normalizedBranchId || 
            (client.branchId && client.branchId === normalizedBranchId);
          if (branchMatches) {
            try {
              ws.send(message);
            } catch (e) {
              this.clients.delete(ws);
            }
          }
        }
      }
    });
  }

  broadcastToBranch(branchId: string, data: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedBranchId = branchId && branchId !== 'all' ? String(branchId) : "";
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const branchMatches = !normalizedBranchId || 
          (client.branchId && client.branchId === normalizedBranchId);
        if (branchMatches) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastToCustomer(customerId: string, data: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedCustomerId = String(customerId);
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now(),
    });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "customer" && client.customerId === normalizedCustomerId) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  broadcastPosDisplay(payload: any, branchId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = JSON.stringify({
      type: "pos_cart_update",
      payload,
      timestamp: Date.now(),
    });
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "pos-display") {
        const branchMatches = !branchId || !client.branchId || client.branchId === branchId;
        if (branchMatches) {
          try {
            ws.send(message);
          } catch (e) {
            this.clients.delete(ws);
          }
        }
      }
    });
  }

  pushToUser(userId: string, data: any) {
    if (!this.wss || !userId) return;
    const message = JSON.stringify(data);
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const match =
          client.userId === userId ||
          client.customerId === userId;
        if (match) {
          try { ws.send(message); } catch (e) { this.clients.delete(ws); }
        }
      }
    });
  }

  pushToAdmins(data: any) {
    if (!this.wss) return;
    const message = JSON.stringify(data);
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "pos" || client.type === "kitchen" || client.type === "display") {
          try { ws.send(message); } catch (e) { this.clients.delete(ws); }
        }
      }
    });
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.forEach((client, ws) => {
      try {
        ws.close(1001, "Server shutting down");
      } catch (e) {}
    });
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const wsManager = new OrderWebSocketManager();

// Register WebSocket hooks with the notification engine (runs after setup)
registerWSHooks(
  (userId, data) => wsManager.pushToUser(userId, data),
  (data) => wsManager.pushToAdmins(data)
);
