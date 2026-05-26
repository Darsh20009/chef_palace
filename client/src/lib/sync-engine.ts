/**
 * Sync Engine — Offline-First Architecture
 * ─────────────────────────────────────────
 * • Cache warm-up: menu, config, tables cached in IndexedDB on startup
 * • Conflict resolution: last-write-wins (updatedAt timestamp)
 * • Auto-sync: triggers when coming back online
 * • Event emitter: status, synced, conflict, error, warmup-complete
 */

import { db, type LocalProduct, type LocalTable, type LocalConfig } from './db/dexie-db';
import { syncOfflineOrders, countPendingOrders } from './offline-queue';

export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline';
export type SyncEvent = 'status' | 'synced' | 'conflict' | 'error' | 'warmup-complete';

type Unsubscribe = () => void;

class SyncEngineClass {
  private status: SyncStatus = 'idle';
  private listeners: Array<{ event: SyncEvent; cb: (d?: any) => void }> = [];
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isWarm = false;
  private warmUpPromise: Promise<void> | null = null;

  // ── Event System ──────────────────────────────────────────────────────────

  on(event: SyncEvent, cb: (data?: any) => void): Unsubscribe {
    this.listeners.push({ event, cb });
    return () => { this.listeners = this.listeners.filter(l => l.cb !== cb); };
  }

  private emit(event: SyncEvent, data?: any) {
    this.listeners.filter(l => l.event === event).forEach(l => l.cb(data));
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus(): SyncStatus { return this.status; }

  async getPendingCount(): Promise<number> { return countPendingOrders(); }

  private setStatus(s: SyncStatus) {
    if (this.status !== s) {
      this.status = s;
      this.emit('status', s);
    }
  }

  // ── Cache Warm-up ─────────────────────────────────────────────────────────
  // Call once on app startup. Caches menu/config/tables for offline use.

  warmUp(tenantId: string): Promise<void> {
    if (this.warmUpPromise) return this.warmUpPromise;
    this.warmUpPromise = this._warmUp(tenantId);
    return this.warmUpPromise;
  }

  private async _warmUp(tenantId: string) {
    if (this.isWarm) return;

    const results = await Promise.allSettled([
      this.cacheMenuItems(tenantId),
      this.cacheBusinessConfig(tenantId),
      this.cacheTables(tenantId),
    ]);

    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason?.message);

    this.isWarm = true;
    this.emit('warmup-complete', { tenantId, errors: errors.filter(Boolean) });
  }

  private async cacheMenuItems(tenantId: string) {
    const res = await fetch('/api/coffee-items', { credentials: 'include' });
    if (!res.ok) return;
    const items: any[] = await res.json();

    await db.transaction('rw', db.products, async () => {
      await db.products.where('tenantId').equals(tenantId).delete();
      await db.products.bulkPut(
        items.map(item => ({
          id:            item.id,
          nameAr:        item.nameAr || item.name || '',
          nameEn:        item.nameEn || '',
          price:         Number(item.price) || 0,
          category:      item.category || item.categoryId || '',
          categoryId:    item.categoryId || '',
          imageUrl:      item.imageUrl || '',
          isAvailable:   item.isAvailable ? 1 : 0,
          tenantId,
          availableSizes: item.availableSizes || [],
          addons:        item.addons || [],
          updatedAt:     Date.now(),
        }))
      );
    });
  }

  private async cacheBusinessConfig(tenantId: string) {
    const res = await fetch('/api/business-config', { credentials: 'include' });
    if (!res.ok) return;
    const config = await res.json();

    await db.configs.put({
      id:       `config_${tenantId}`,
      tenantId,
      data:     config,
      cachedAt: Date.now(),
    });
  }

  private async cacheTables(tenantId: string) {
    const res = await fetch('/api/tables', { credentials: 'include' });
    if (!res.ok) return;
    const tables: any[] = await res.json();

    await db.transaction('rw', db.cafeTables, async () => {
      await db.cafeTables.where('tenantId').equals(tenantId).delete();
      await db.cafeTables.bulkPut(
        tables.map(t => ({
          id:             t.id || t._id,
          tableNumber:    t.tableNumber || t.number || '',
          status:         t.status || 'available',
          branchId:       t.branchId || '',
          tenantId,
          currentOrderId: t.currentOrderId,
          updatedAt:      Date.now(),
        }))
      );
    });
  }

  // ── Offline Data Access ───────────────────────────────────────────────────

  async getOfflineProducts(tenantId: string): Promise<LocalProduct[]> {
    return db.products.where('tenantId').equals(tenantId).toArray();
  }

  async getOfflineAvailableProducts(tenantId: string): Promise<LocalProduct[]> {
    return db.products
      .where('[tenantId+isAvailable]')
      .equals([tenantId, 1])
      .toArray()
      .catch(() =>
        db.products.filter(p => p.tenantId === tenantId && p.isAvailable === 1).toArray()
      );
  }

  async getOfflineConfig(tenantId: string): Promise<any | null> {
    const entry = await db.configs.get(`config_${tenantId}`);
    return entry?.data ?? null;
  }

  async getOfflineTables(tenantId: string): Promise<LocalTable[]> {
    return db.cafeTables.where('tenantId').equals(tenantId).toArray();
  }

  isCacheStale(cachedAt: number, maxAgeMs = 12 * 60 * 60 * 1000): boolean {
    return Date.now() - cachedAt > maxAgeMs;
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async sync(): Promise<{ synced: number; failed: number }> {
    if (this.status === 'syncing') return { synced: 0, failed: 0 };
    this.setStatus('syncing');

    try {
      const result = await syncOfflineOrders();
      if (result.synced > 0) this.emit('synced', result);
      this.setStatus('online');
      return result;
    } catch (e: any) {
      this.setStatus('offline');
      this.emit('error', e);
      return { synced: 0, failed: 0 };
    }
  }

  // ── Auto Sync ─────────────────────────────────────────────────────────────

  startAutoSync(intervalMs = 15_000) {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) this.sync();
    }, intervalMs);

    window.addEventListener('online',  this.onOnline);
    window.addEventListener('offline', this.onOffline);

    if (navigator.onLine) this.setStatus('online');
    else this.setStatus('offline');
  }

  stopAutoSync() {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    window.removeEventListener('online',  this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  private onOnline = async () => {
    this.setStatus('online');
    await this.sync();
  };

  private onOffline = () => {
    this.setStatus('offline');
  };

  // ── Conflict Resolution ───────────────────────────────────────────────────
  // Strategy: last-write-wins using updatedAt timestamp.
  // If timestamps are equal, remote wins (server is source of truth).

  resolveConflict<T extends { updatedAt?: number }>(local: T, remote: T): T {
    const localTs  = local.updatedAt  ?? 0;
    const remoteTs = remote.updatedAt ?? 0;

    if (localTs > remoteTs) {
      // Local is newer — keep local, queue a push to server
      return local;
    }

    if (localTs < remoteTs) {
      this.emit('conflict', { local, remote, winner: 'remote' });
      return remote;
    }

    // Equal timestamps — server wins
    return remote;
  }
}

export const SyncEngine = new SyncEngineClass();
