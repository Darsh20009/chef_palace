/**
 * Notification Engine — 3-Layer Unified System
 * Layer 1: MongoDB (persists even when device is off)
 * Layer 2: WebSocket (instant in-app popup)
 * Layer 3: Web Push (system notification even when app is closed)
 */

import { NotificationModel } from "@shared/schema";
import { sendPushToCustomer, sendPushBySubscriptions, sendPushToAll, PushPayload, PushSubscriptionModel } from "./push-service";
import mongoose from "mongoose";

// --- Types ---

export interface NotifyOptions {
  type?: "success" | "error" | "warning" | "info" | "order" | "payment" | "promo" | "system" | "order_update";
  icon?: string;
  link?: string;
  tag?: string;
  userType?: "employee" | "customer";
  tenantId?: string;
  orderId?: string;
  orderNumber?: string;
}

// --- WebSocket push hook (set by websocket.ts to avoid circular deps) ---
let _pushToUser: ((userId: string, data: any) => void) | null = null;
let _pushToAdmins: ((data: any) => void) | null = null;

export function registerWSHooks(
  pushToUserFn: (userId: string, data: any) => void,
  pushToAdminsFn: (data: any) => void
) {
  _pushToUser = pushToUserFn;
  _pushToAdmins = pushToAdminsFn;
}

// --- Core: fireNotify (single user) ---

export async function fireNotify(
  userId: string,
  title: string,
  body: string,
  opts: NotifyOptions = {}
): Promise<void> {
  const {
    type = "info",
    icon = "🔔",
    link = "/",
    tag,
    userType = "customer",
    tenantId = "demo-tenant",
    orderId,
    orderNumber,
  } = opts;

  const notifTag = tag || `notif-${userId}-${Date.now()}`;

  // === Layer 1: Save to MongoDB ===
  try {
    await NotificationModel.create({
      customerId: userType === "customer" ? userId : undefined,
      userId,
      userType,
      tenantId,
      type,
      title,
      message: body,
      link,
      icon,
      tag: notifTag,
      orderId,
      orderNumber,
      isRead: 0,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[NOTIFY] DB save failed:", err);
  }

  // === Layer 2: WebSocket (live in-app) ===
  if (_pushToUser) {
    try {
      _pushToUser(userId, {
        type: "notification",
        notification: {
          userId,
          userType,
          type,
          title,
          message: body,
          link,
          icon,
          tag: notifTag,
          orderId,
          orderNumber,
          isRead: 0,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("[NOTIFY] WS push failed:", err);
    }
  }

  // === Layer 3: Web Push (device/system level) ===
  const pushPayload: PushPayload = {
    title,
    body,
    url: link,
    tag: notifTag,
    type: "general",
    orderId,
    orderNumber,
  };

  try {
    if (userType === "customer") {
      await sendPushToCustomer(userId, pushPayload);
    } else {
      const subs = await PushSubscriptionModel.find({ userType: "employee", userId });
      if (subs.length > 0) {
        await sendPushBySubscriptions(subs, pushPayload);
      }
    }
  } catch (err) {
    console.error("[NOTIFY] Push failed:", err);
  }
}

// --- fireNotifyAdmins: notify all managers/admins/owners ---

export async function fireNotifyAdmins(
  title: string,
  body: string,
  opts: NotifyOptions = {}
): Promise<void> {
  const {
    type = "info",
    icon = "🔔",
    link = "/",
    tag,
    tenantId = "demo-tenant",
    orderId,
    orderNumber,
  } = opts;

  const notifTag = tag || `notif-admin-${Date.now()}`;

  // Find all admin/manager/owner employees
  let adminIds: string[] = [];
  try {
    const EmployeeCollection = mongoose.connection.collection("employees");
    const admins = await EmployeeCollection.find({
      tenantId,
      role: { $in: ["admin", "manager", "owner", "superadmin"] },
      isActive: { $ne: false },
    }).project({ id: 1, _id: 1 }).toArray();
    adminIds = admins.map((a: any) => a.id || a._id?.toString()).filter(Boolean);
  } catch (err) {
    console.error("[NOTIFY] Failed to fetch admins:", err);
  }

  // Save to DB for each admin & WS push
  for (const adminId of adminIds) {
    try {
      await NotificationModel.create({
        userId: adminId,
        userType: "employee",
        tenantId,
        type,
        title,
        message: body,
        link,
        icon,
        tag: notifTag,
        orderId,
        orderNumber,
        isRead: 0,
        createdAt: new Date(),
      });
    } catch (_) {}

    if (_pushToUser) {
      try {
        _pushToUser(adminId, {
          type: "notification",
          notification: {
            userId: adminId,
            userType: "employee",
            type,
            title,
            message: body,
            link,
            icon,
            tag: notifTag,
            orderId,
            orderNumber,
            isRead: 0,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (_) {}
    }
  }

  // Broadcast to admin WS clients (kitchen/pos/display)
  if (_pushToAdmins) {
    try {
      _pushToAdmins({
        type: "admin_notification",
        notification: { type, title, message: body, link, icon, tag: notifTag, orderId, orderNumber },
      });
    } catch (_) {}
  }

  // Web Push to all admin subscriptions
  try {
    const adminSubs = await PushSubscriptionModel.find({
      userType: "employee",
      $or: [
        { userId: { $in: adminIds } },
        { userId: { $exists: false } }, // legacy subscriptions without userId
      ],
    });
    if (adminSubs.length > 0) {
      await sendPushBySubscriptions(adminSubs, {
        title,
        body,
        url: link,
        tag: notifTag,
        type: "general",
        orderId,
        orderNumber,
      });
    }
  } catch (err) {
    console.error("[NOTIFY] Admin push failed:", err);
  }
}

// --- fireNotifyBroadcast: notify ALL users of a tenant ---

export async function fireNotifyBroadcast(
  title: string,
  body: string,
  opts: NotifyOptions = {}
): Promise<void> {
  const { type = "promo", icon = "📢", link = "/", tag, tenantId = "demo-tenant" } = opts;
  const notifTag = tag || `broadcast-${Date.now()}`;

  if (_pushToAdmins) {
    try {
      _pushToAdmins({
        type: "admin_notification",
        notification: { type, title, message: body, link, icon, tag: notifTag },
      });
    } catch (_) {}
  }

  try {
    await sendPushToAll(tenantId, { title, body, url: link, tag: notifTag, type: "general" });
  } catch (err) {
    console.error("[NOTIFY] Broadcast push failed:", err);
  }
}
