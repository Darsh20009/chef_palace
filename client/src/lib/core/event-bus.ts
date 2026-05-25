/**
 * Phase 9 — Frontend typed event bus.
 * Mirrors the server bus. Useful for cross-component coordination
 * (e.g., "order.created" triggers cart clear + toast + analytics).
 */
import type { EventName, EventPayloads } from "@shared/core/contracts";

type Handler<E extends EventName> = (payload: EventPayloads[E]) => void;

class FrontendBus {
  private handlers = new Map<EventName, Set<Handler<any>>>();

  on<E extends EventName>(name: E, h: Handler<E>): () => void {
    let s = this.handlers.get(name);
    if (!s) { s = new Set(); this.handlers.set(name, s); }
    s.add(h as Handler<any>);
    return () => s!.delete(h as Handler<any>);
  }

  emit<E extends EventName>(name: E, payload: EventPayloads[E]): void {
    const s = this.handlers.get(name);
    if (!s) return;
    for (const h of s) {
      try { h(payload); }
      catch (e) { console.error(`[bus] ${name} handler error:`, e); }
    }
  }
}

export const bus = new FrontendBus();
