import type { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

const SAMPLE_RATE = 1.0; // 100% sampling. Lower in heavy production.
const SLOW_THRESHOLD_MS = 1500;
// Suppress slow-API warnings for the first 30 s after boot (MongoDB Atlas cold-start + init tasks).
const STARTUP_GRACE_UNTIL = Date.now() + 30_000;
const SKIP_PATHS = [
  /^\/api\/orders\/active/,          // polled frequently
  /^\/api\/notifications\/unread/,   // polled
  /^\/api\/notifications\/unread-count/, // polled
  /^\/api\/employees\/live-status/,  // polled every 15s
  /^\/api\/ai\//,                   // AI endpoints depend on Groq/LLM latency — always "slow"
  /^\/api\/shifts\/auto-periods/,   // heavy aggregation — polled on shift screen
  /^\/__/,                          // vite/replit internal
  /^\/@/,                           // vite
  /^\/src\//,
  /^\/node_modules/,
  /\.(js|css|map|png|jpg|svg|ico|woff2?)$/i,
];

function shouldSkip(url: string) {
  return SKIP_PATHS.some((re) => re.test(url));
}

// Buffer to avoid hitting DB on every request
const buffer: any[] = [];
let flushTimer: NodeJS.Timeout | null = null;

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const { ApiMetricModel } = await import("@shared/schema");
    await ApiMetricModel.insertMany(batch, { ordered: false });
  } catch (e) {
    // swallow — monitoring must never crash app
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flush();
  }, 5000);
}

export function apiMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl || req.url;
  if (!url.startsWith("/api") || shouldSkip(url)) return next();
  if (Math.random() > SAMPLE_RATE) return next();

  const start = Date.now();
  res.on("finish", () => {
    try {
      const durationMs = Date.now() - start;
      const isError = res.statusCode >= 500;
      const session: any = (req as any).session;
      const employee = session?.employee;
      const path = (req.route?.path)
        ? `${req.baseUrl || ""}${req.route.path}`
        : url.split("?")[0].replace(/\/[a-f0-9]{20,}|\/\d{3,}/g, "/:id");

      buffer.push({
        id: nanoid(),
        tenantId: employee?.tenantId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
        isError,
        userId: employee?.id,
        ipAddress: ((req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "").trim(),
        userAgent: (req.headers["user-agent"] || "").slice(0, 200),
        createdAt: new Date(),
      });

      if (durationMs > SLOW_THRESHOLD_MS && Date.now() > STARTUP_GRACE_UNTIL) {
        console.warn(`⚠️  SLOW API: ${req.method} ${path} took ${durationMs}ms (status ${res.statusCode})`);
      }

      if (buffer.length >= 50) flush();
      else scheduleFlush();
    } catch {
      // never throw
    }
  });
  next();
}
