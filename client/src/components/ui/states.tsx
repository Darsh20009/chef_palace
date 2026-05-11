import { Loader2, AlertCircle, FileQuestion, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  message?: string;
  variant?: "spinner" | "skeleton" | "card";
  count?: number;
}

export function LoadingState({ 
  message = "جاري التحميل...", 
  variant = "spinner",
  count = 3 
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className="space-y-4 p-4" data-testid="loading-skeleton">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4" data-testid="loading-cards">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4" data-testid="loading-spinner">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = "لا توجد بيانات",
  description = "لم يتم العثور على أي عناصر",
  icon,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center" data-testid="empty-state">
      <div className="rounded-full bg-muted p-4">
        {icon || <FileQuestion className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action && (
        <Button onClick={action.onClick} data-testid="button-empty-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "حدث خطأ",
  description = "لم نتمكن من تحميل البيانات",
  error,
  onRetry,
  retryLabel = "إعادة المحاولة"
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center" data-testid="error-state">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {errorMessage && (
          <p className="text-xs text-destructive/80 font-mono bg-destructive/5 p-2 rounded-md max-w-md">
            {errorMessage}
          </p>
        )}
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" data-testid="button-retry">
          <RefreshCw className="h-4 w-4 ml-2" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

interface SuccessStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function SuccessState({
  title = "تمت العملية بنجاح",
  description,
  action
}: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8 text-center" data-testid="success-state">
      <div className="rounded-full bg-green-500/10 p-4">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} data-testid="button-success-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface TableLoadingStateProps {
  columns?: number;
  rows?: number;
}

export function TableLoadingState({ columns = 5, rows = 5 }: TableLoadingStateProps) {
  return (
    <div className="w-full" data-testid="loading-table">
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 p-3 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-t p-3 flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MenuLoadingSkeleton() {
  return (
    <div className="p-4 space-y-6" data-testid="loading-menu">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function OrdersLoadingSkeleton() {
  return (
    <div className="p-4 space-y-4" data-testid="loading-orders">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-16 w-16 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="flex justify-between items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="p-4 space-y-6" data-testid="loading-dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function KitchenLoadingSkeleton() {
  return (
    <div className="p-4" data-testid="loading-kitchen">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-2">
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex justify-between gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | string;
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingVariant?: "spinner" | "skeleton" | "card";
  emptyState?: EmptyStateProps;
  className?: string;
}

export function PageContainer({
  children,
  isLoading,
  isError,
  error,
  isEmpty,
  onRetry,
  loadingVariant = "spinner",
  emptyState,
  className = ""
}: PageContainerProps) {
  if (isLoading) {
    return <LoadingState variant={loadingVariant} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <EmptyState {...emptyState} />;
  }

  return <div className={className}>{children}</div>;
}
