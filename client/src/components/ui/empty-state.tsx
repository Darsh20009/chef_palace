import { PackageOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({ 
  icon: Icon = PackageOpen, 
  title = "لا توجد بيانات", 
  description = "لم يتم العثور على أي عناصر",
  className = "",
  children 
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 gap-4 text-center ${className}`} data-testid="empty-state">
      <div className="bg-muted rounded-full p-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
