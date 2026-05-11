import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, X, CheckCheck, ExternalLink, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface NotifItem {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  type?: string;
  icon?: string;
  link?: string;
  isRead?: number;
  createdAt?: string | Date;
  orderId?: string;
  orderNumber?: string;
}

interface NotificationBellProps {
  userId?: string;
  userType?: "employee" | "customer";
  clientType?: string;
  branchId?: string;
}

export function NotificationBell({ userId, userType = "employee", clientType = "pos", branchId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const computeUnread = (notifs: NotifItem[]) =>
    notifs.filter((n) => !n.isRead || n.isRead === 0).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(computeUnread(data));
    } catch (err) {}
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNewNotification = useCallback((notif: NotifItem) => {
    if (!notif) return;
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === notif.id || n._id === notif._id);
      if (exists) return prev;
      const updated = [notif, ...prev].slice(0, 50);
      setUnreadCount(computeUnread(updated));
      return updated;
    });

    // Animate bell and show toast
    toast({
      title: notif.icon ? `${notif.icon} ${notif.title}` : notif.title,
      description: notif.message,
      duration: 5000,
    });

    // Native browser notification (if permission granted)
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(notif.title, {
        body: notif.message,
        icon: "/logo.png",
        tag: notif.id || `notif-${Date.now()}`,
      });
    }
  }, [toast]);

  const connectWS = useCallback(() => {
    if (!userId) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/orders`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: "subscribe",
        clientType,
        branchId,
        userId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "notification" || msg.type === "admin_notification") {
          handleNewNotification(msg.notification);
        }
        if (msg.type === "welcome") {
          ws.send(JSON.stringify({ type: "subscribe", clientType, branchId, userId }));
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectRef.current = setTimeout(connectWS, 5000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [userId, clientType, branchId, handleNewNotification]);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await apiRequest("POST", "/api/notifications/mark-all-read", { userId });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const markOneRead = async (notif: NotifItem) => {
    const id = notif.id || notif._id;
    if (!id || notif.isRead === 1) return;
    try {
      await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id || n._id === id ? { ...n, isRead: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (_) {}
  };

  const deleteNotif = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/notifications/${id}`, {});
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id && n._id !== id);
        setUnreadCount(computeUnread(updated));
        return updated;
      });
    } catch (_) {}
  };

  const typeColor: Record<string, string> = {
    order_update: "bg-blue-500",
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    order: "bg-blue-500",
    payment: "bg-purple-500",
    promo: "bg-orange-500",
    info: "bg-slate-400",
  };

  const formatTime = (date?: string | Date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "الآن";
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
    return d.toLocaleDateString("ar");
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => { setOpen((v) => !v); if (!open) fetchNotifications(); }}
        data-testid="notification-bell-button"
      >
        <Bell className={cn("h-5 w-5 transition-transform", unreadCount > 0 && "animate-[bell-ring_0.5s_ease]")} />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white border-0"
            data-testid="notification-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className={cn(
          "absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white",
          isConnected ? "bg-green-400" : "bg-gray-300"
        )} />
      </Button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-80 md:w-96 bg-white dark:bg-gray-900 border border-border rounded-xl shadow-2xl overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">الإشعارات</span>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">{unreadCount} جديد</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isConnected ? <Wifi className="h-3 w-3 text-green-400" /> : <WifiOff className="h-3 w-3 text-gray-300" />}
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3 mr-1" />
                  قراءة الكل
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* List */}
          <ScrollArea className="h-[380px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                <Bell className="h-10 w-10 opacity-20" />
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map((notif, i) => {
                  const id = notif.id || notif._id || String(i);
                  const isRead = notif.isRead === 1;
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                        !isRead && "bg-primary/5"
                      )}
                      onClick={() => { markOneRead(notif); if (notif.link) window.location.href = notif.link; }}
                      data-testid={`notification-item-${id}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-sm",
                          typeColor[notif.type || "info"] || "bg-slate-400",
                          "text-white"
                        )}>
                          {notif.icon || "🔔"}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className={cn("text-sm font-medium truncate", !isRead && "text-primary")}>{notif.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(notif.createdAt)}</span>
                            <button
                              className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteNotif(id); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        {notif.link && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                            <ExternalLink className="h-3 w-3" />
                            <span>عرض التفاصيل</span>
                          </div>
                        )}
                      </div>
                      {!isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
