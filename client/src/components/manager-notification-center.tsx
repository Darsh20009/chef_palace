import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, ShoppingCart, Package, UserX, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useTranslate } from "@/lib/useTranslate";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "order" | "stock" | "employee" | "review";
  title: string;
  desc: string;
  count?: number;
  path: string;
  severity: "info" | "warning" | "critical";
  icon: React.ReactNode;
}

export function ManagerNotificationCenter() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const tc = useTranslate();

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const { data: lowStock = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory/low-stock"],
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ["/api/reviews"],
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: attendance = [] } = useQuery<any[]>({
    queryKey: ["/api/attendance/today"],
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const notifications = useMemo<Notification[]>(() => {
    const list: Notification[] = [];

    const pendingOrders = (orders || []).filter(
      (o: any) =>
        o.status === "pending" ||
        o.status === "confirmed" ||
        o.status === "preparing"
    );
    if (pendingOrders.length > 0) {
      list.push({
        id: "orders-pending",
        type: "order",
        title: tc("طلبات معلّقة", "Pending Orders"),
        desc: tc(
          `لديك ${pendingOrders.length} طلب يحتاج متابعة`,
          `You have ${pendingOrders.length} orders that need attention`
        ),
        count: pendingOrders.length,
        path: "/employee/orders",
        severity: pendingOrders.length > 10 ? "critical" : "warning",
        icon: <ShoppingCart className="w-4 h-4" />,
      });
    }

    if (lowStock && lowStock.length > 0) {
      list.push({
        id: "stock-low",
        type: "stock",
        title: tc("تنبيهات مخزون", "Stock Alerts"),
        desc: tc(
          `${lowStock.length} مادة خام وصلت للحد الأدنى`,
          `${lowStock.length} raw items reached minimum threshold`
        ),
        count: lowStock.length,
        path: "/manager/inventory/alerts",
        severity: "warning",
        icon: <Package className="w-4 h-4" />,
      });
    }

    const lateEmployees = (attendance || []).filter(
      (a: any) => a.status === "late" || a.isLate
    );
    if (lateEmployees.length > 0) {
      list.push({
        id: "emp-late",
        type: "employee",
        title: tc("موظفون متأخرون", "Late Employees"),
        desc: tc(
          `${lateEmployees.length} موظف سجّل دخوله متأخراً اليوم`,
          `${lateEmployees.length} employees clocked in late today`
        ),
        count: lateEmployees.length,
        path: "/manager/attendance",
        severity: "info",
        icon: <UserX className="w-4 h-4" />,
      });
    }

    const unrepliedReviews = (reviews || []).filter(
      (r: any) => !r.adminReply && (r.rating || 5) <= 3
    );
    if (unrepliedReviews.length > 0) {
      list.push({
        id: "reviews",
        type: "review",
        title: tc("تقييمات تحتاج رداً", "Reviews Need Reply"),
        desc: tc(
          `${unrepliedReviews.length} تقييم سلبي بدون رد`,
          `${unrepliedReviews.length} negative reviews without reply`
        ),
        count: unrepliedReviews.length,
        path: "/admin/reviews",
        severity: "warning",
        icon: <MessageSquare className="w-4 h-4" />,
      });
    }

    return list;
  }, [orders, lowStock, attendance, reviews, tc]);

  const totalCount = notifications.reduce((sum, n) => sum + (n.count || 1), 0);
  const hasCritical = notifications.some((n) => n.severity === "critical");

  const go = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          data-testid="manager-notif-trigger"
        >
          <Bell className={cn("w-5 h-5", hasCritical && "text-destructive animate-pulse")} />
          {totalCount > 0 && (
            <Badge
              className={cn(
                "absolute -top-1 -right-1 h-5 min-w-5 p-0 px-1 text-[10px] flex items-center justify-center",
                hasCritical ? "bg-destructive" : "bg-primary"
              )}
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        data-testid="manager-notif-panel"
      >
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">{tc("مركز الإشعارات", "Notification Center")}</h4>
          </div>
          <Badge variant="outline">{notifications.length}</Badge>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{tc("لا توجد إشعارات حالياً 🎉", "No notifications right now 🎉")}</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.path)}
                className={cn(
                  "w-full text-start p-3 border-b last:border-b-0 hover:bg-muted/50 transition flex items-start gap-3",
                  n.severity === "critical" && "bg-destructive/5",
                  n.severity === "warning" && "bg-amber-50"
                )}
                data-testid={`notif-${n.id}`}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg flex-shrink-0",
                    n.severity === "critical" && "bg-destructive/10 text-destructive",
                    n.severity === "warning" && "bg-amber-100 text-amber-700",
                    n.severity === "info" && "bg-primary/10 text-primary"
                  )}
                >
                  {n.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-medium">{n.title}</h5>
                    {n.severity === "critical" && (
                      <AlertTriangle className="w-3 h-3 text-destructive" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                </div>
                {n.count !== undefined && (
                  <Badge variant="secondary" className="text-[10px]">
                    {n.count}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t bg-muted/30 text-center">
          <p className="text-[10px] text-muted-foreground">
            {tc("تحديث تلقائي كل 30 ثانية", "Auto-refresh every 30 seconds")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
