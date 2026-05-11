import webpush from "web-push";
import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String },
    auth: { type: String },
  },
  userType: { type: String, enum: ["employee", "customer"] },
  userId: { type: String },
  branchId: { type: String },
  tenantId: { type: String, default: "demo-tenant" },
  createdAt: { type: Date, default: Date.now },
});

export const PushSubscriptionModel =
  mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", pushSubscriptionSchema);

export function initWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:cafe@chefsplace.online";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[PUSH] VAPID keys not configured. Web Push notifications disabled.");
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log("✅ Web Push initialized with VAPID keys");
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function saveSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userType: string,
  userId: string,
  branchId?: string,
  tenantId?: string
) {
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userType,
      userId,
      branchId,
      tenantId: tenantId || "demo-tenant",
      createdAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

export async function removeSubscription(endpoint: string) {
  await PushSubscriptionModel.deleteOne({ endpoint });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: 'order_status' | 'new_order' | 'general' | 'promo';
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  status?: string;
  totalAmount?: number;
  itemCount?: number;
  items?: Array<{ name: string; quantity: number }>;
  customerName?: string;
  orderType?: string;
  estimatedTime?: number;
  branchName?: string;
  image?: string;
  actions?: Array<{ action: string; title: string }>;
  stageIndex?: number;
  totalStages?: number;
}

async function sendPushToSubscriptions(
  subscriptions: any[],
  payload: PushPayload
) {
  if (subscriptions.length === 0) return;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "notification",
    type: payload.type || "general",
    orderNumber: payload.orderNumber,
    orderStatus: payload.orderStatus,
    totalAmount: payload.totalAmount,
    itemCount: payload.itemCount,
    items: payload.items,
    customerName: payload.customerName,
    orderType: payload.orderType,
    estimatedTime: payload.estimatedTime,
    branchName: payload.branchName,
    image: payload.image,
    actions: payload.actions,
    stageIndex: payload.stageIndex,
    totalStages: payload.totalStages,
    timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        pushPayload
      )
    )
  );

  const staleEndpoints: string[] = [];
  let successCount = 0;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const statusCode = (result.reason as any)?.statusCode;
      console.log(`[PUSH] Failed to send to ${subscriptions[index].userId}: status=${statusCode}, error=${(result.reason as any)?.body || result.reason}`);
      if (statusCode === 410 || statusCode === 404 || statusCode === 401) {
        staleEndpoints.push(subscriptions[index].endpoint);
      }
    } else {
      successCount++;
    }
  });
  console.log(`[PUSH] Sent ${successCount}/${subscriptions.length} notifications successfully`);

  if (staleEndpoints.length > 0) {
    await PushSubscriptionModel.deleteMany({
      endpoint: { $in: staleEndpoints },
    });
    console.log(`[PUSH] Removed ${staleEndpoints.length} stale subscriptions`);
  }
}

export async function sendPushToEmployee(branchId: string, payload: PushPayload) {
  const query: any = { userType: "employee" };
  if (branchId && branchId !== "all") {
    query.branchId = branchId;
  }
  const subscriptions = await PushSubscriptionModel.find(query);
  console.log(`[PUSH] sendPushToEmployee: branch=${branchId}, found ${subscriptions.length} subscriptions`);
  if (subscriptions.length === 0) {
    const allEmpSubs = await PushSubscriptionModel.find({ userType: "employee" });
    console.log(`[PUSH] Total employee subscriptions in DB: ${allEmpSubs.length}`, allEmpSubs.map(s => ({ userId: s.userId, branchId: s.branchId })));
    if (allEmpSubs.length > 0 && branchId && branchId !== "all") {
      console.log(`[PUSH] Falling back to all employee subscriptions since branch ${branchId} had none`);
      await sendPushToSubscriptions(allEmpSubs, payload);
      return;
    }
  }
  await sendPushToSubscriptions(subscriptions, payload);
}

export async function sendPushToCustomer(customerId: string, payload: PushPayload, fallbackPhone?: string) {
  let subscriptions = await PushSubscriptionModel.find({
    userType: "customer",
    userId: customerId,
  });
  console.log(`[PUSH] sendPushToCustomer: customerId=${customerId}, found ${subscriptions.length} subscriptions`);

  // Fallback: if no subscription found by ID, try phone number variants
  if (subscriptions.length === 0 && fallbackPhone) {
    const cleanPhone = fallbackPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
    const variants = [cleanPhone, fallbackPhone, cleanPhone.replace(/^0/, '966'), cleanPhone.replace(/^0/, '+966')];
    subscriptions = await PushSubscriptionModel.find({
      userType: "customer",
      userId: { $in: variants },
    });
    if (subscriptions.length > 0) {
      console.log(`[PUSH] Found ${subscriptions.length} subscriptions via phone fallback for ${cleanPhone}`);
    }
  }

  await sendPushToSubscriptions(subscriptions, payload);
}

export async function sendPushToAll(tenantId: string, payload: PushPayload) {
  const subscriptions = await PushSubscriptionModel.find({
    tenantId: tenantId || "demo-tenant",
  });
  await sendPushToSubscriptions(subscriptions, payload);
}

export async function sendPushBySubscriptions(subscriptions: any[], payload: PushPayload) {
  await sendPushToSubscriptions(subscriptions, payload);
}
