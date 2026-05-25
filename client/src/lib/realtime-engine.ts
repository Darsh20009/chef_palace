/**
 * Real-time Engine — WebSocket with ACK + Event Queue + Reconnection
 * ───────────────────────────────────────────────────────────────────
 * • Message sequence numbers on both client and server
 * • ACK system: auto-ack critical events (orders, notifications)
 * • Event queue: buffers outgoing messages when offline, flushes on reconnect
 * • Reconnection: exponential backoff (1s → 2s → 4s → ... → 30s) with jitter
 * • State recovery: re-subscribe + request missed events on reconnect
 * • Typed event system with wildcard support
 */

type RTEventType = string;
type RTHandler   = (data: any) => void;

interface OutboundMsg {
  seq:       number;
  type:      RTEventType;
  data:      Record<string, any>;
  timestamp: number;
  acked:     boolean;
}

export interface RTOptions {
  reconnectBaseMs?: number;
  reconnectMaxMs?:  number;
  ackTimeoutMs?:    number;
  maxQueueSize?:    number;
  heartbeatMs?:     number;
}

export class RealtimeEngine {
  private ws:                WebSocket | null = null;
  private handlers:          Map<RTEventType, Set<RTHandler>> = new Map();
  private outQueue:          OutboundMsg[] = [];
  private pendingAcks:       Map<number, ReturnType<typeof setTimeout>> = new Map();
  private seq =              0;
  private lastReceivedSeq =  0;
  private reconnectAttempts = 0;
  private reconnectTimer:    ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer:    ReturnType<typeof setInterval> | null = null;
  private subscribePayload:  object | null = null;
  private isDestroyed =      false;
  private opts:              Required<RTOptions>;

  readonly url: string;

  constructor(url: string, opts: RTOptions = {}) {
    this.url  = url;
    this.opts = {
      reconnectBaseMs: opts.reconnectBaseMs ?? 1_000,
      reconnectMaxMs:  opts.reconnectMaxMs  ?? 30_000,
      ackTimeoutMs:    opts.ackTimeoutMs    ?? 8_000,
      maxQueueSize:    opts.maxQueueSize    ?? 200,
      heartbeatMs:     opts.heartbeatMs     ?? 25_000,
    };
  }

  // ── Connection ────────────────────────────────────────────────────────────

  connect(subscribePayload?: object) {
    if (subscribePayload) this.subscribePayload = subscribePayload;
    if (this.isDestroyed) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws           = new WebSocket(this.url);
      this.ws.onopen    = this.onOpen;
      this.ws.onclose   = this.onClose;
      this.ws.onerror   = this.onError;
      this.ws.onmessage = this.onMessage;
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.clearTimers();
    this.ws?.close(1000, 'client_disconnect');
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  on(event: RTEventType, handler: RTHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: RTEventType, handler: RTHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: RTEventType, data: any) {
    this.handlers.get(event)?.forEach(h => {
      try { h(data); } catch (e) { console.error(`[RT] Handler error (${event}):`, e); }
    });
    if (event !== '*') {
      this.handlers.get('*')?.forEach(h => {
        try { h({ event, ...data }); } catch (_) {}
      });
    }
  }

  // ── Sending ───────────────────────────────────────────────────────────────

  send(type: string, data: Record<string, any> = {}, requireAck = false): number {
    const msg: OutboundMsg = {
      seq:       ++this.seq,
      type,
      data,
      timestamp: Date.now(),
      acked:     !requireAck,
    };

    if (this.connected) {
      this._write(msg);
    } else if (this.outQueue.length < this.opts.maxQueueSize) {
      this.outQueue.push(msg);
    }

    if (requireAck) this.waitForAck(msg);
    return msg.seq;
  }

  private _write(msg: OutboundMsg) {
    if (!this.connected) { this.outQueue.unshift(msg); return; }
    try {
      this.ws!.send(JSON.stringify({ seq: msg.seq, type: msg.type, timestamp: msg.timestamp, ...msg.data }));
    } catch (_) {
      if (this.outQueue.length < this.opts.maxQueueSize) this.outQueue.unshift(msg);
    }
  }

  private waitForAck(msg: OutboundMsg) {
    const timer = setTimeout(() => {
      this.pendingAcks.delete(msg.seq);
      // Retry on ack timeout
      if (!msg.acked && this.outQueue.length < this.opts.maxQueueSize) {
        this.outQueue.push({ ...msg, seq: ++this.seq });
      }
    }, this.opts.ackTimeoutMs);
    this.pendingAcks.set(msg.seq, timer);
  }

  private sendAck(seq: number) {
    if (!this.connected) return;
    try { this.ws!.send(JSON.stringify({ type: 'ack', seq })); } catch (_) {}
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  private onOpen = () => {
    this.reconnectAttempts = 0;
    this.emit('_connected', { reconnected: this.lastReceivedSeq > 0 });

    // Re-subscribe with client type
    if (this.subscribePayload) {
      this._write({ seq: ++this.seq, type: 'subscribe', data: this.subscribePayload, timestamp: Date.now(), acked: true });
    }

    // Request missed events since last received seq
    if (this.lastReceivedSeq > 0) {
      this._write({ seq: ++this.seq, type: 'replay_from', data: { lastSeq: this.lastReceivedSeq }, timestamp: Date.now(), acked: true });
    }

    // Flush queued outbound messages
    const queued = this.outQueue.splice(0);
    queued.forEach(msg => this._write(msg));

    this.startHeartbeat();
  };

  private onClose = (ev: CloseEvent) => {
    this.clearHeartbeat();
    this.emit('_disconnected', { code: ev.code, reason: ev.reason });
    if (!this.isDestroyed && ev.code !== 1000) {
      this.scheduleReconnect();
    }
  };

  private onError = (_ev: Event) => {
    this.emit('_error', {});
  };

  private onMessage = (ev: MessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(ev.data as string); } catch (_) { return; }

    // Track inbound sequence for replay
    if (typeof msg.seq === 'number') {
      this.lastReceivedSeq = Math.max(this.lastReceivedSeq, msg.seq);
    }

    // Server ACK — clear pending ack timer
    if (msg.type === 'ack') {
      const timer = this.pendingAcks.get(msg.seq);
      if (timer) { clearTimeout(timer); this.pendingAcks.delete(msg.seq); }
      return;
    }

    // Ignore pong (heartbeat handled separately)
    if (msg.type === 'pong') { return; }

    // Auto-ACK critical events
    const ACK_EVENTS = new Set(['new_order', 'order_updated', 'order_ready', 'notification', 'admin_notification']);
    if (msg.seq && ACK_EVENTS.has(msg.type)) {
      this.sendAck(msg.seq);
    }

    this.emit(msg.type, msg);
  };

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        try { this.ws!.send(JSON.stringify({ type: 'ping' })); } catch (_) {}
      }
    }, this.opts.heartbeatMs);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  // ── Reconnection ──────────────────────────────────────────────────────────

  private scheduleReconnect() {
    if (this.isDestroyed) return;
    const delay =
      Math.min(
        this.opts.reconnectBaseMs * Math.pow(2, Math.min(this.reconnectAttempts, 6)),
        this.opts.reconnectMaxMs
      ) + Math.random() * 500; // jitter

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.isDestroyed) this.connect();
    }, delay);
  }

  private clearTimers() {
    this.clearHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.pendingAcks.forEach(t => clearTimeout(t));
    this.pendingAcks.clear();
  }
}

// ── Singleton Factory ─────────────────────────────────────────────────────

let _instance: RealtimeEngine | null = null;

export function getRealtimeEngine(subscribePayload?: object): RealtimeEngine {
  if (!_instance) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url      = `${protocol}//${window.location.host}/ws/orders`;
    _instance      = new RealtimeEngine(url);
  }
  if (subscribePayload && !_instance.connected) {
    _instance.connect(subscribePayload);
  }
  return _instance;
}

export function destroyRealtimeEngine() {
  _instance?.disconnect();
  _instance = null;
}
