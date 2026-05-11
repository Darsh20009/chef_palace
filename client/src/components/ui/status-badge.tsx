import { Badge } from "@/components/ui/badge";
import { getStatusStyle, getDeliveryTypeInfo } from "@/lib/design-tokens";
import { Store, ShoppingBag, Truck, Clock, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  in_progress: Loader2,
  ready: CheckCircle2,
  completed: CheckCircle2,
  cancelled: XCircle,
  refunded: XCircle,
  delayed: AlertTriangle,
};

export function StatusBadge({ status, size = "md", showIcon = true, className }: StatusBadgeProps) {
  const style = getStatusStyle(status);
  const Icon = statusIcons[status] || Clock;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        style.bg,
        style.text,
        style.border,
        sizeClasses[size],
        "flex items-center gap-1.5 font-medium",
        className
      )}
      data-testid={`badge-status-${status}`}
    >
      {showIcon && <Icon className={cn("h-3.5 w-3.5", status === "in_progress" && "animate-spin")} />}
      <span>{style.label}</span>
    </Badge>
  );
}

interface DeliveryTypeBadgeProps {
  type: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const deliveryIcons: Record<string, React.ElementType> = {
  'dine-in': Store,
  pickup: ShoppingBag,
  delivery: Truck,
};

export function DeliveryTypeBadge({ type, size = "md", showIcon = true, className }: DeliveryTypeBadgeProps) {
  const info = getDeliveryTypeInfo(type);
  const Icon = deliveryIcons[type] || ShoppingBag;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        sizeClasses[size],
        "flex items-center gap-1.5 font-medium",
        className
      )}
      data-testid={`badge-delivery-${type}`}
    >
      {showIcon && <Icon className={cn("h-3.5 w-3.5", info.color)} />}
      <span>{info.label}</span>
    </Badge>
  );
}

interface TimerBadgeProps {
  minutes: number;
  warningThreshold?: number;
  delayedThreshold?: number;
  className?: string;
}

export function TimerBadge({ 
  minutes, 
  warningThreshold = 5, 
  delayedThreshold = 10,
  className 
}: TimerBadgeProps) {
  const isDelayed = minutes >= delayedThreshold;
  const isWarning = minutes >= warningThreshold && !isDelayed;
  
  const bgColor = isDelayed 
    ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
    : isWarning 
    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
    : "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30";

  return (
    <Badge
      variant="outline"
      className={cn(
        bgColor,
        "flex items-center gap-1.5 font-mono text-sm",
        className
      )}
      data-testid="badge-timer"
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{minutes} د</span>
    </Badge>
  );
}
