import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { sendPushToEmployee, sendPushToCustomer } from "./push-service";
import { registerWSHooks } from "./notification-engine";

interface WSClient {
  ws:               WebSocket;
  type:             "kitchen" | "display" | "order-tracking" | "pos" | "inventory" | "delivery-driver" | "delivery-tracking" | "customer" | "pos-display" | "employee-tracking" | "manager-tracking";
  orderId?:         string;
  branchId?:        string;
  driverId?:        string;
  deliveryOrderId?: string;
  customerId?:      string;
  posId?:           string;
  userId?:          string;
  employeeId?:      string;
  attendanceId?:    string;
  lastPing:         number;
  isAlive:          boolean;
  lastSeq:          number;  // last acknowledged sequence from this client
}

interface BufferedEvent {
  seq:       number;
  type:      string;
  data:      Record<string, any>;
  timestamp: number;
}

const EVENT_BUFFER_SIZE = 300; // keep last N events for replay on reconnect

class OrderWebSocketManager {
  private wss:              WebSocketServer | null = null;
  private clients:          Map<WebSocket, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private seq =             0;
  private eventBuffer:      BufferedEvent[] = [];

  // ── Sequence & Buffer ─────────────────────────────────────────────────────

  private nextSeq(): number {
    return ++this.seq;
  }

  private bufferEvent(seq: number, type: string, data: Record<string, any>) {
    this.eventBuffer.push({ seq, type, data, timestamp: Date.now() });
    if (this.eventBuffer.length > EVENT_BUFFER_SIZE) {
      this.eventBuffer.shift();
    }
  }

  /** Replay all buffered events with seq > lastSeq to a specific client */
  private replayMissed(ws: WebSocket, lastSeq: number) {
    const missed = this.eventBuffer.filter(e => e.seq > lastSeq);
    if (missed.length === 0) return;
    for (const ev of missed) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ seq: ev.seq, type: ev.type, timestamp: ev.timestamp, ...ev.data }));
        }
      } catch (_) {}
    }
    console.log(`[WS] Replayed ${missed.length} missed events (lastSeq=${lastSeq})`);
  }

  // ── Safe Send ─────────────────────────────────────────────────────────────

  private safeSend(ws: WebSocket, payload: string) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    } catch (_) {
      this.clients.delete(ws);
    }
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  setup(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "", "http://localhost").pathname;
      if (pathname !== "/ws/orders") return;
      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit("connection", ws, request);
      });
    });

    this.wss.on("connection", (ws, _req) => {
      console.log("[WS] New client connected");

      const client: WSClient = {
        ws,
        type:      "display",
        lastPing:  Date.now(),
        isAlive:   true,
        lastSeq:   0,
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
        try { ws.terminate(); } catch (_) {}
      });

      ws.on("pong", () => {
        const client = this.clients.get(ws);
        if (client) { client.isAlive = true; client.lastPing = Date.now(); }
      });

      ws.send(JSON.stringify({ type: "welcome", timestamp: Date.now(), serverSeq: this.seq }));
    });

    this.startHeartbeat();
    console.log("✅ WebSocket server initialized at /ws/orders");
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      const now            = Date.now();
      const staleThreshold = 60_000;

      this.clients.forEach((client, ws) => {
        if (!client.isAlive || (now - client.lastPing > staleThreshold)) {
          console.log("[WS] Terminating stale client");
          this.clients.delete(ws);
          try { ws.terminate(); } catch (_) {}
          return;
        }
        client.isAlive = false;
        try {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        } catch (_) {
          this.clients.delete(ws);
        }
      });
    }, 30_000);
  }

  // ── Message Handler ───────────────────────────────────────────────────────

  private handleMessage(ws: WebSocket, message: { type: string; [key: string]: any }) {
    const client = this.clients.get(ws);
    if (client) { client.lastPing = Date.now(); client.isAlive = true; }

    switch (message.type) {
      case "subscribe":
        if (client) {
          client.type            = message.clientType || "display";
          client.orderId         = message.orderId;
          client.branchId        = message.branchId;
          client.driverId        = message.driverId;
          client.deliveryOrderId = message.deliveryOrderId;
          client.customerId      = message.customerId;
          client.userId          = message.userId || message.customerId;
          client.employeeId      = message.employeeId;
          client.attendanceId    = message.attendanceId;
        }
        console.log(`[WS] Client subscribed as ${message.clientType} userId=${message.userId || message.customerId || "anon"}`);
        ws.send(JSON.stringify({ type: "subscribed", clientType: message.clientType, serverSeq: this.seq }));
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      // ACK — client confirms it received a critical event
      case "ack":
        if (client && typeof message.seq === "number") {
          client.lastSeq = Math.max(client.lastSeq, message.seq);
        }
        break;

      // Replay — client requests missed events since lastSeq
      case "replay_from":
        if (typeof message.lastSeq === "number") {
          this.replayMissed(ws, message.lastSeq);
        }
        break;

      case "driver_location_update":
        if (client && client.type === "delivery-driver" && client.driverId) {
          this.broadcastDriverLocation(client.driverId, message.location, message.deliveryOrderId);
        }
        break;

      case "employee_location_update":
        if (client && client.type === "employee-tracking" && client.employeeId) {
          this.broadcastEmployeeLocation({
            employeeId:          client.employeeId,
            attendanceId:        client.attendanceId,
            branchId:            client.branchId,
            location:            message.location,
            isInsideBranch:      message.isInsideBranch,
            distanceFromBranch:  message.distanceFromBranch,
            employeeName:        message.employeeName,
            employeePhoto:       message.employeePhoto,
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

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private cleanupStaleClients() {
    this.clients.forEach((client, ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(ws);
      }
    });
  }

  // ── Broadcast Helpers ─────────────────────────────────────────────────────

  /** Build a sequenced message, add to replay buffer, return serialised string */
  private makeEvent(type: string, data: Record<string, any>): string {
    const seq  = this.nextSeq();
    const ts   = Date.now();
    const body = { seq, type, timestamp: ts, ...data };
    this.bufferEvent(seq, type, data);
    return JSON.stringify(body);
  }

  // ── Public Broadcast Methods ──────────────────────────────────────────────

  broadcastOrderUpdate(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("order_updated", { order });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (
          client.type === "kitchen" ||
          client.type === "display"  ||
          client.type === "pos"      ||
          (client.type === "order-tracking" && client.orderId === order.id)
        ) {
          this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastNewOrder(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("new_order", { order });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "kitchen" || client.type === "display" || client.type === "pos") {
          this.safeSend(ws, message);
        }
      }
    });

    const isOnline = order.channel === "online" || (!order.channel && !order.employeeId);
    this.sendPushNotification({
      title: isOnline ? "طلب جديد أونلاين 🌐" : "طلب جديد ☕",
      body:  `طلب رقم #${order.orderNumber} بقيمة ${order.totalAmount} ر.س`,
      url:   "/employee/orders",
      orderId: order.id,
      sound: true,
      isOnlineOrder: isOnline,
    });
  }

  private async sendPushNotification(payload: any) {
    try {
      await sendPushToEmployee(payload.branchId || "all", {
        title: payload.title,
        body:  payload.body,
        url:   payload.url || "/employee/orders",
        tag:   "new-order",
      });
    } catch (error) {
      console.error("[PUSH] Error sending push notification:", error);
    }
  }

  broadcastOrderReady(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("order_ready", { order });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (
          client.type === "display" ||
          (client.type === "order-tracking" && client.orderId === order.id)
        ) {
          this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastCarPreparationAlert(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("car_preparation_alert", { order });
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "pos" || client.type === "kitchen" || client.type === "display") {
          this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastStockAlert(alert: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("stock_alert", { alert });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "inventory" || client.type === "display") {
          this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastAlertResolved(alertId: string, branchId: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("alert_resolved", { alertId, branchId });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "inventory" || client.type === "display") {
          this.safeSend(ws, message);
        }
      }
    });
  }

  getConnectionCount(): number { return this.clients.size; }

  broadcastDeliveryUpdate(deliveryOrder: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const orderId  = String(deliveryOrder.id  || deliveryOrder._id   || "");
    const driverId = String(deliveryOrder.driverId || deliveryOrder.driver?._id || "");
    const message  = this.makeEvent("delivery_updated", { deliveryOrder });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const isDriver  = client.type === "delivery-driver"   && client.driverId        && driverId && client.driverId        === driverId;
        const isTracker = client.type === "delivery-tracking" && client.deliveryOrderId && orderId  && client.deliveryOrderId === orderId;
        if (isDriver || isTracker) this.safeSend(ws, message);
      }
    });
  }

  broadcastDriverLocation(driverId: string, location: { lat: number; lng: number }, deliveryOrderId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normOrderId  = deliveryOrderId ? String(deliveryOrderId) : "";
    const normDriverId = String(driverId);
    const message      = this.makeEvent("driver_location", { driverId: normDriverId, location, deliveryOrderId: normOrderId });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const matchesOrder  = client.type === "delivery-tracking" && client.deliveryOrderId && normOrderId  && client.deliveryOrderId === normOrderId;
        const matchesDriver = client.type === "delivery-tracking" && client.driverId        && normDriverId && client.driverId        === normDriverId;
        if (matchesOrder || matchesDriver) this.safeSend(ws, message);
      }
    });
  }

  broadcastEmployeeLocation(data: {
    employeeId:         string;
    attendanceId?:      string;
    branchId?:          string;
    location:           { lat: number; lng: number };
    isInsideBranch:     boolean;
    distanceFromBranch: number;
    employeeName?:      string;
    employeePhoto?:     string;
  }) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = this.makeEvent("employee_location", { ...data });

    if (!data.isInsideBranch) {
      const alertMsg = this.makeEvent("employee_left_branch", {
        employeeId:         data.employeeId,
        employeeName:       data.employeeName,
        branchId:           data.branchId,
        location:           data.location,
        distanceFromBranch: data.distanceFromBranch,
      });
      this.clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN && client.type === "manager-tracking") {
          const branchMatch = !data.branchId || !client.branchId || client.branchId === data.branchId || client.branchId === "all";
          if (branchMatch) this.safeSend(ws, alertMsg);
        }
      });
    }

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "manager-tracking") {
        const branchMatch = !data.branchId || !client.branchId || client.branchId === data.branchId || client.branchId === "all";
        if (branchMatch) this.safeSend(ws, message);
      }
    });
  }

  broadcastNewDeliveryOrder(deliveryOrder: any, branchId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedBranchId = branchId ? String(branchId) : "";
    const message = this.makeEvent("new_delivery_order", { deliveryOrder });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "delivery-driver") {
        const branchMatches = !normalizedBranchId || (client.branchId && client.branchId === normalizedBranchId);
        if (branchMatches) this.safeSend(ws, message);
      }
    });
  }

  broadcastToBranch(branchId: string, data: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedBranchId = branchId && branchId !== "all" ? String(branchId) : "";
    const message = this.makeEvent(data.type || "branch_event", data);

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const branchMatches = !normalizedBranchId || (client.branchId && client.branchId === normalizedBranchId);
        if (branchMatches) this.safeSend(ws, message);
      }
    });
  }

  broadcastToCustomer(customerId: string, data: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedCustomerId = String(customerId);
    const message = JSON.stringify({ ...data, timestamp: Date.now() });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "customer" && client.customerId === normalizedCustomerId) {
        this.safeSend(ws, message);
      }
    });
  }

  broadcastPosDisplay(payload: any, branchId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({ type: "pos_cart_update", payload, timestamp: Date.now() });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "pos-display") {
        const branchMatches = !branchId || !client.branchId || client.branchId === branchId;
        if (branchMatches) this.safeSend(ws, message);
      }
    });
  }

  pushToUser(userId: string, data: any) {
    if (!this.wss || !userId) return;
    const message = JSON.stringify(data);
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.userId === userId || client.customerId === userId) {
          this.safeSend(ws, message);
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
          this.safeSend(ws, message);
        }
      }
    });
  }

  shutdown() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    this.clients.forEach((_client, ws) => {
      try { ws.close(1001, "Server shutting down"); } catch (_) {}
    });
    this.clients.clear();
    this.wss?.close();
  }
}

export const wsManager = new OrderWebSocketManager();

registerWSHooks(
  (userId, data) => wsManager.pushToUser(userId, data),
  (data)         => wsManager.pushToAdmins(data)
);
