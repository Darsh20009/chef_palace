import { useState, useEffect } from "react";
import { Clock, CheckCircle } from "lucide-react";

interface PrepCountdownProps {
  estimatedPrepTimeInMinutes?: number;
  prepTimeSetAt?: string | Date;
  status: string;
  compact?: boolean;
}

export function PrepCountdown({ estimatedPrepTimeInMinutes, prepTimeSetAt, status, compact = false }: PrepCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!estimatedPrepTimeInMinutes || !prepTimeSetAt) {
      setRemainingSeconds(null);
      return;
    }

    const calcRemaining = () => {
      const setAt = new Date(prepTimeSetAt).getTime();
      const totalMs = estimatedPrepTimeInMinutes * 60 * 1000;
      const elapsedMs = Date.now() - setAt;
      const rem = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
      setRemainingSeconds(rem);
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [estimatedPrepTimeInMinutes, prepTimeSetAt]);

  if (!estimatedPrepTimeInMinutes) return null;
  if (!['pending', 'in_progress', 'payment_confirmed', 'confirmed'].includes(status)) return null;

  const isOverdue = remainingSeconds === 0;
  const minutes = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : estimatedPrepTimeInMinutes;
  const seconds = remainingSeconds !== null ? remainingSeconds % 60 : 0;
  const totalOriginalSecs = estimatedPrepTimeInMinutes * 60;
  const progress = remainingSeconds !== null && totalOriginalSecs > 0
    ? Math.max(0, Math.min(100, ((totalOriginalSecs - remainingSeconds) / totalOriginalSecs) * 100))
    : 0;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
          isOverdue
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        }`}
        data-testid="prep-countdown-compact"
      >
        <Clock className="w-3 h-3" />
        {remainingSeconds !== null
          ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          : `${estimatedPrepTimeInMinutes}:00`
        }
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border p-2 space-y-1.5 ${
        isOverdue
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700'
      }`}
      data-testid="prep-countdown"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
          {isOverdue ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {isOverdue ? 'وقت التحضير انتهى' : 'وقت التحضير المتبقي'}
        </span>
        <span className={`text-lg font-mono font-bold tabular-nums ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {remainingSeconds !== null
            ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${estimatedPrepTimeInMinutes}:00`
          }
        </span>
      </div>
      <div className="w-full h-1.5 bg-amber-200 dark:bg-amber-900/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        إجمالي وقت التحضير: {estimatedPrepTimeInMinutes} دقيقة
      </p>
    </div>
  );
}
