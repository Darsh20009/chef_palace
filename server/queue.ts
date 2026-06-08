/**
 * QIROX Background Job Queue
 * In-memory priority queue for async background tasks.
 * Swap `runJob` implementation for BullMQ/Redis when REDIS_URL is available.
 */

export type JobType =
  | "send_notification"
  | "send_push"
  | "send_email"
  | "deduct_inventory"
  | "create_journal_entry"
  | "invalidate_cache"
  | "generate_report"
  | "sync_attendance"
  | "recalc_loyalty";

export type JobPriority = "high" | "normal" | "low";

export interface Job {
  id: string;
  type: JobType;
  priority: JobPriority;
  payload: Record<string, any>;
  attempt: number;
  maxAttempts: number;
  createdAt: number;
  scheduledAt: number;
  error?: string;
}

type JobHandler = (job: Job) => Promise<void>;

interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  avgProcessingMs: number;
  byType: Record<string, number>;
}

const PRIORITY_WEIGHT: Record<JobPriority, number> = { high: 0, normal: 1, low: 2 };
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [0, 2000, 8000]; // per attempt index

class JobQueue {
  private pending: Job[] = [];
  private handlers: Map<JobType, JobHandler> = new Map();
  private running = 0;
  private maxConcurrent: number;

  // Stats
  private completed = 0;
  private failed = 0;
  private totalMs = 0;
  private byType: Record<string, number> = {};

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
  }

  /** Register a handler for a job type */
  register(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /** Enqueue a new job */
  enqueue(
    type: JobType,
    payload: Record<string, any>,
    opts: { priority?: JobPriority; delayMs?: number; maxAttempts?: number } = {}
  ): string {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: Job = {
      id,
      type,
      priority: opts.priority ?? "normal",
      payload,
      attempt: 0,
      maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      createdAt: Date.now(),
      scheduledAt: Date.now() + (opts.delayMs ?? 0),
    };
    this.insertSorted(job);
    this.drain();
    return id;
  }

  private insertSorted(job: Job): void {
    // Insert maintaining priority order (high first, then by scheduledAt)
    let i = 0;
    while (
      i < this.pending.length &&
      (PRIORITY_WEIGHT[this.pending[i].priority] < PRIORITY_WEIGHT[job.priority] ||
        (PRIORITY_WEIGHT[this.pending[i].priority] === PRIORITY_WEIGHT[job.priority] &&
          this.pending[i].scheduledAt <= job.scheduledAt))
    ) i++;
    this.pending.splice(i, 0, job);
  }

  private async drain(): Promise<void> {
    while (this.running < this.maxConcurrent && this.pending.length > 0) {
      const now = Date.now();
      const idx = this.pending.findIndex(j => j.scheduledAt <= now);
      if (idx === -1) break;
      const [job] = this.pending.splice(idx, 1);
      this.running++;
      this.processJob(job).catch(() => {}).finally(() => {
        this.running--;
        this.drain();
      });
    }
    // Re-check delayed jobs
    if (this.pending.some(j => j.scheduledAt > Date.now())) {
      const nextAt = Math.min(...this.pending.map(j => j.scheduledAt));
      setTimeout(() => this.drain(), nextAt - Date.now() + 10);
    }
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.warn(`[Queue] No handler for job type: ${job.type}`);
      this.failed++;
      return;
    }
    const start = Date.now();
    job.attempt++;
    try {
      await handler(job);
      this.completed++;
      this.totalMs += Date.now() - start;
      this.byType[job.type] = (this.byType[job.type] ?? 0) + 1;
    } catch (err: any) {
      console.error(`[Queue] Job ${job.id} (${job.type}) attempt ${job.attempt} failed:`, err?.message);
      job.error = err?.message;
      if (job.attempt < job.maxAttempts) {
        job.scheduledAt = Date.now() + (RETRY_DELAY_MS[job.attempt] ?? 10000);
        this.insertSorted(job);
      } else {
        console.error(`[Queue] Job ${job.id} (${job.type}) permanently failed after ${job.attempt} attempts`);
        this.failed++;
      }
    }
  }

  stats(): QueueStats {
    const totalProcessed = this.completed + this.failed;
    return {
      pending: this.pending.length,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      totalProcessed,
      avgProcessingMs: totalProcessed > 0 ? Math.round(this.totalMs / totalProcessed) : 0,
      byType: { ...this.byType },
    };
  }

  pendingJobs(): Pick<Job, "id" | "type" | "priority" | "attempt" | "scheduledAt" | "error">[] {
    return this.pending.map(({ id, type, priority, attempt, scheduledAt, error }) => ({
      id, type, priority, attempt, scheduledAt, error,
    }));
  }

  clear(): void {
    this.pending = [];
  }
}

// ── Singleton queue instance ──────────────────────────────────────────────────
export const queue = new JobQueue(4);

// ── Convenience helpers ───────────────────────────────────────────────────────

export function queueNotification(payload: {
  customerId?: string;
  customerPhone?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): string {
  return queue.enqueue("send_notification", payload, { priority: "high" });
}

export function queueInventoryDeduction(payload: {
  orderId: string;
  tenantId: string;
  branchId?: string;
  items: Array<{ coffeeItemId: string; quantity: number }>;
}): string {
  return queue.enqueue("deduct_inventory", payload, { priority: "normal" });
}

export function queueJournalEntry(payload: {
  tenantId: string;
  branchId?: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
}): string {
  return queue.enqueue("create_journal_entry", payload, { priority: "low" });
}

export function queueCacheInvalidation(pattern: string): string {
  return queue.enqueue("invalidate_cache", { pattern }, { priority: "high", maxAttempts: 1 });
}

export function queueReport(payload: {
  tenantId: string;
  reportType: string;
  period: string;
  branchId?: string;
}): string {
  return queue.enqueue("generate_report", payload, { priority: "low" });
}

export function queueLoyaltyRecalc(payload: {
  customerId: string;
  tenantId: string;
  pointsDelta: number;
}): string {
  return queue.enqueue("recalc_loyalty", payload, { priority: "normal" });
}
