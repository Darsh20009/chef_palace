const DB_NAME = "qirox-offline-db";
const DB_VERSION = 2;
const STORE_NAME = "offline-orders";
const MAX_RETRIES = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "localId" });
        store.createIndex("status", "status", { unique: false });
      } else {
        // Migration: existing store might lack retryCount index
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains("retryCount")) {
          store.createIndex("retryCount", "retryCount", { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineOrder {
  localId: string;
  orderData: any;
  status: "pending" | "syncing" | "synced" | "failed";
  createdAt: string;
  retryCount: number;
  lastRetryAt?: string;
  nextRetryAt?: string;
  error?: string;
}

/** Exponential backoff: 30s, 2min, 10min, 30min, 2hr */
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];

export async function queueOfflineOrder(orderData: any): Promise<string> {
  const db = await openDB();
  const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: OfflineOrder = {
    localId,
    orderData: { ...orderData, offlineQueued: true },
    status: "pending",
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve(localId);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOrders(): Promise<OfflineOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index("status");
    const req = idx.getAll("pending");
    req.onsuccess = () => {
      const now = Date.now();
      // Only return orders whose nextRetryAt has passed (or is not set)
      const ready = (req.result as OfflineOrder[]).filter(o => {
        if (o.retryCount >= MAX_RETRIES) return false;
        if (!o.nextRetryAt) return true;
        return new Date(o.nextRetryAt).getTime() <= now;
      });
      resolve(ready);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineOrders(): Promise<OfflineOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as OfflineOrder[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

export async function updateOrderStatus(localId: string, status: OfflineOrder["status"], error?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const record = getReq.result as OfflineOrder | undefined;
      if (record) {
        record.status = status;
        if (error) record.error = error;
        if (status === "pending") {
          // Going back to pending means a retry — schedule next retry with backoff
          const newCount = (record.retryCount || 0) + 1;
          record.retryCount = newCount;
          record.lastRetryAt = new Date().toISOString();
          const delayMs = RETRY_DELAYS_MS[Math.min(newCount - 1, RETRY_DELAYS_MS.length - 1)];
          record.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
          // Mark as failed permanently if max retries exceeded
          if (newCount >= MAX_RETRIES) {
            record.status = "failed";
            record.error = error || `فشل بعد ${MAX_RETRIES} محاولات`;
          }
        }
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function clearSyncedOrders(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index("status");
    const req = idx.getAll("synced");
    req.onsuccess = () => {
      const synced = req.result as OfflineOrder[];
      synced.forEach(o => store.delete(o.localId));
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearFailedOrders(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index("status");
    const req = idx.getAll("failed");
    req.onsuccess = () => {
      const failed = req.result as OfflineOrder[];
      failed.forEach(o => store.delete(o.localId));
      resolve(failed.length);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function retryFailedOrder(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const record = getReq.result as OfflineOrder | undefined;
      if (record) {
        record.status = "pending";
        record.retryCount = 0;
        record.error = undefined;
        record.nextRetryAt = undefined;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function syncOfflineOrders(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingOrders();
  let synced = 0;
  let failed = 0;

  for (const order of pending) {
    await updateOrderStatus(order.localId, "syncing");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order.orderData),
      });
      if (res.ok) {
        await updateOrderStatus(order.localId, "synced");
        synced++;
      } else {
        const err = await res.json().catch(() => ({ error: "فشل الخادم" }));
        // 4xx = permanent failure (bad data); 5xx = transient, retry
        if (res.status >= 400 && res.status < 500) {
          await updateOrderStatus(order.localId, "failed", err.error || `خطأ ${res.status}`);
        } else {
          await updateOrderStatus(order.localId, "pending", err.error || "فشل الخادم — سيعاد المحاولة");
        }
        failed++;
      }
    } catch (err: any) {
      // Network error — retry with backoff
      await updateOrderStatus(order.localId, "pending", err.message);
      failed++;
    }
  }

  if (synced > 0) {
    await clearSyncedOrders();
  }

  return { synced, failed };
}

export async function countPendingOrders(): Promise<number> {
  const pending = await getPendingOrders();
  return pending.length;
}
