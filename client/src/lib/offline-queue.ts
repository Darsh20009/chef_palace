const DB_NAME = "chefsplace-offline-db";
const DB_VERSION = 1;
const STORE_NAME = "offline-orders";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "localId" });
        store.createIndex("status", "status", { unique: false });
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
  error?: string;
}

export async function queueOfflineOrder(orderData: any): Promise<string> {
  const db = await openDB();
  const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: OfflineOrder = {
    localId,
    orderData: { ...orderData, offlineQueued: true },
    status: "pending",
    createdAt: new Date().toISOString(),
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
    req.onsuccess = () => resolve(req.result as OfflineOrder[]);
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
      const record = getReq.result;
      if (record) {
        record.status = status;
        if (error) record.error = error;
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
        await updateOrderStatus(order.localId, "failed", err.error || "فشل الخادم");
        failed++;
      }
    } catch (err: any) {
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
