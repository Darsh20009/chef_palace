import { useEffect, useRef, useCallback } from "react";
import { useCustomer } from "@/contexts/CustomerContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/**
 * Silent background component — mounts once in App.tsx.
 * Connects to WebSocket with the customer's userId and:
 *  • shows toast for in-app real-time notifications (Layer 2)
 *  • invalidates order cache so My-Orders page stays fresh
 */
export function CustomerNotificationListener() {
  const { customer } = useCustomer();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = customer?.id || (customer as any)?._id;

  const showToast = useCallback((notif: any) => {
    if (!notif) return;
    const icon = notif.icon || "🔔";
    toast({
      title: `${icon} ${notif.title || ""}`,
      description: notif.message || notif.body || "",
      duration: 6000,
    });

    // Also fire a native browser notification if permission granted
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(notif.title || "مكان الشيف البخاري", {
          body: notif.message || notif.body || "",
          icon: "/logo.png",
          badge: "/badge-icon.png",
          tag: notif.tag || `notif-${Date.now()}`,
          data: { url: notif.link || "/" },
          dir: "rtl",
          lang: "ar",
        } as NotificationOptions);
      }).catch(() => {});
    }
  }, [toast]);

  const connect = useCallback(() => {
    if (!userId) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/orders`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "subscribe",
        clientType: "customer",
        userId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "welcome") {
          ws.send(JSON.stringify({ type: "subscribe", clientType: "customer", userId }));
        }

        if (msg.type === "notification") {
          showToast(msg.notification);
          // Refresh notifications list if it was open
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        }

        if (msg.type === "order_updated") {
          // Silently refresh order lists
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/my-orders"] });
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (userId) {
        reconnectTimerRef.current = setTimeout(connect, 5000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [userId, showToast]);

  useEffect(() => {
    if (!userId) return;
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [userId, connect]);

  return null;
}
