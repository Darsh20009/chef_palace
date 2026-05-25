/**
 * Crash Recovery — Phase 5
 * Auto-saves POS/Cashier/Kiosk session data to server every N seconds
 * AND mirrors to localStorage for instant offline recovery.
 *
 * Usage:
 *   const recovery = useCrashRecovery('pos', () => ({ cart, customer, payment }));
 *   recovery.snapshot();        // manual save
 *   recovery.clear();           // call after successful order submit
 */
import { useEffect, useRef } from "react";

const LS_PREFIX = "qirox_crash_";
const SAVE_INTERVAL_MS = 10_000;

function deviceId(): string {
  let id = localStorage.getItem("qirox_device_id");
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem("qirox_device_id", id);
  }
  return id;
}

async function persist(page: string, data: any) {
  // 1) localStorage mirror (instant, offline-safe)
  try {
    localStorage.setItem(`${LS_PREFIX}${page}`, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {}

  // 2) server (durable cross-device)
  try {
    await fetch("/api/crash-sessions/save", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, sessionData: data, deviceId: deviceId() }),
    });
  } catch {
    // offline — localStorage will cover it
  }
}

export function clearLocalSnapshot(page: string) {
  try { localStorage.removeItem(`${LS_PREFIX}${page}`); } catch {}
}

export function loadLocalSnapshot(page: string): any | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${page}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Stale > 24h, ignore
    if (Date.now() - parsed.savedAt > 24 * 3600 * 1000) {
      clearLocalSnapshot(page);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

export function useCrashRecovery<T>(page: string, getter: () => T, enabled = true) {
  const getterRef = useRef(getter);
  getterRef.current = getter;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      try {
        const data = getterRef.current();
        if (data && (typeof data !== "object" || Object.keys(data as any).length > 0)) {
          persist(page, data);
        }
      } catch {}
    };
    const interval = setInterval(tick, SAVE_INTERVAL_MS);

    // Save on tab close / route change
    const onUnload = () => {
      try {
        const data = getterRef.current();
        if (data) {
          localStorage.setItem(`${LS_PREFIX}${page}`, JSON.stringify({ data, savedAt: Date.now() }));
          // beacon = best-effort send during unload
          if (navigator.sendBeacon) {
            const blob = new Blob(
              [JSON.stringify({ page, sessionData: data, deviceId: deviceId() })],
              { type: "application/json" }
            );
            navigator.sendBeacon("/api/crash-sessions/save", blob);
          }
        }
      } catch {}
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onUnload();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [page, enabled]);

  return {
    snapshot: () => persist(page, getterRef.current()),
    clear: () => {
      clearLocalSnapshot(page);
      // also discard server copy
      fetch(`/api/crash-sessions/mine`, { credentials: "include" })
        .then(r => r.json())
        .then((list: any[]) => {
          const mine = list.find(s => s.page === page);
          if (mine) {
            fetch(`/api/crash-sessions/${mine.id}`, { method: "DELETE", credentials: "include" });
          }
        }).catch(() => {});
    },
    loadLocal: () => loadLocalSnapshot(page),
  };
}
