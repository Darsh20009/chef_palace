/**
 * useRealtimeEngine — React hook for real-time WebSocket events
 *
 * Wraps RealtimeEngine with React lifecycle management.
 * Provides typed event subscription with auto-cleanup on unmount.
 *
 * Usage:
 *   // Subscribe to events
 *   useRealtimeEvent("new_order", (data) => setOrders(prev => [data.order, ...prev]));
 *   useRealtimeEvent("order_updated", handleUpdate);
 *
 *   // Get connection status
 *   const { connected, reconnectCount } = useRealtimeStatus();
 *
 *   // Send a message
 *   const { send } = useRealtimeSend();
 *   send("pos_cart_update", { payload: cart });
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { getRealtimeEngine } from "@/lib/realtime-engine";

// ── Shared connection init ────────────────────────────────────────────────────

let _initDone = false;

function ensureConnected(subscribePayload?: object) {
  if (_initDone) return;
  _initDone = true;
  const engine = getRealtimeEngine(subscribePayload);
  if (!engine.connected) engine.connect(subscribePayload);
}

// ── useRealtimeEvent ──────────────────────────────────────────────────────────

export function useRealtimeEvent<T = any>(
  event:   string,
  handler: (data: T) => void,
  subscribePayload?: object
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    ensureConnected(subscribePayload);
    const engine = getRealtimeEngine();
    const off = engine.on(event, (data: T) => handlerRef.current(data));
    return off;
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── useRealtimeStatus ─────────────────────────────────────────────────────────

interface RealtimeStatus {
  connected:      boolean;
  reconnectCount: number;
}

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>({
    connected:      false,
    reconnectCount: 0,
  });

  useEffect(() => {
    ensureConnected();
    const engine = getRealtimeEngine();

    const offConn = engine.on("_connected", () =>
      setStatus(prev => ({ connected: true, reconnectCount: prev.reconnectCount }))
    );
    const offDisc = engine.on("_disconnected", () =>
      setStatus(prev => ({ connected: false, reconnectCount: prev.reconnectCount + 1 }))
    );

    // Sync initial state
    setStatus(prev => ({ ...prev, connected: engine.connected }));

    return () => { offConn(); offDisc(); };
  }, []);

  return status;
}

// ── useRealtimeSend ───────────────────────────────────────────────────────────

export function useRealtimeSend() {
  const send = useCallback((type: string, data: Record<string, any> = {}, requireAck = false) => {
    const engine = getRealtimeEngine();
    return engine.send(type, data, requireAck);
  }, []);

  return { send };
}

// ── useRealtimeConnection ─────────────────────────────────────────────────────
// All-in-one hook: connect + subscribe to multiple events

interface RTEventMap {
  [event: string]: (data: any) => void;
}

export function useRealtimeConnection(
  subscribePayload: object,
  eventHandlers:    RTEventMap
) {
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    ensureConnected(subscribePayload);
    const engine = getRealtimeEngine(subscribePayload);

    const offs = Object.entries(handlersRef.current).map(([event, handler]) =>
      engine.on(event, (data: any) => handlersRef.current[event]?.(data))
    );

    return () => offs.forEach(off => off());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
