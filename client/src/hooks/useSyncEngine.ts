/**
 * useSyncEngine — React hook for offline sync status
 *
 * Usage:
 *   const { status, pendingCount, sync, warmUp } = useSyncEngine(tenantId);
 *
 * status:       'idle' | 'online' | 'offline' | 'syncing'
 * pendingCount: number of orders waiting to sync
 * sync():       manually trigger a sync
 * warmUp():     cache menu/config/tables for offline use
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { SyncEngine, type SyncStatus } from "@/lib/sync-engine";

interface SyncEngineState {
  status:       SyncStatus;
  pendingCount: number;
  lastSynced:   Date | null;
}

interface UseSyncEngineResult extends SyncEngineState {
  sync:   () => Promise<void>;
  warmUp: (tenantId: string) => Promise<void>;
}

export function useSyncEngine(tenantId?: string): UseSyncEngineResult {
  const [state, setState] = useState<SyncEngineState>({
    status:       SyncEngine.getStatus(),
    pendingCount: 0,
    lastSynced:   null,
  });

  const lastSyncedRef = useRef<Date | null>(null);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    const count = await SyncEngine.getPendingCount();
    setState(prev => ({ ...prev, pendingCount: count }));
  }, []);

  useEffect(() => {
    // Status changes
    const offStatus = SyncEngine.on("status", (newStatus: SyncStatus) => {
      setState(prev => ({ ...prev, status: newStatus }));
    });

    // Sync completed
    const offSynced = SyncEngine.on("synced", async () => {
      lastSyncedRef.current = new Date();
      const count = await SyncEngine.getPendingCount();
      setState(prev => ({ ...prev, pendingCount: count, lastSynced: lastSyncedRef.current }));
    });

    // Initial pending count
    refreshCount();

    return () => {
      offStatus();
      offSynced();
    };
  }, [refreshCount]);

  // Warm up when tenantId changes
  useEffect(() => {
    if (tenantId) {
      SyncEngine.warmUp(tenantId).then(refreshCount).catch(() => {});
    }
  }, [tenantId, refreshCount]);

  const sync = useCallback(async () => {
    await SyncEngine.sync();
    await refreshCount();
  }, [refreshCount]);

  const warmUp = useCallback(async (tid: string) => {
    await SyncEngine.warmUp(tid);
    await refreshCount();
  }, [refreshCount]);

  return { ...state, sync, warmUp };
}

export { SyncEngine };
