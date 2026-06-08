import { useEffect, useRef, useState, useCallback } from "react";

type WSClientType = "kitchen" | "display" | "order-tracking" | "pos" | "pos-display";

interface WSMessage {
  type: string;
  order?: any;
  payload?: any;
  timestamp?: number;
  [key: string]: any;
}

interface UseOrderWebSocketOptions {
  clientType: WSClientType | "customer";
  orderId?: string;
  branchId?: string;
  customerId?: string;
  userId?: string;
  onNewOrder?: (order: any) => void;
  onOrderUpdated?: (order: any) => void;
  onOrderReady?: (order: any) => void;
  onPointsVerificationCode?: (data: any) => void;
  onPosCartUpdate?: (payload: any) => void;
  onNotification?: (notification: any) => void;
  enabled?: boolean;
}

export function useOrderWebSocket({
  clientType,
  orderId,
  branchId,
  customerId,
  userId,
  onNewOrder,
  onOrderUpdated,
  onOrderReady,
  onPointsVerificationCode,
  onPosCartUpdate,
  onNotification,
  enabled = true,
}: UseOrderWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasSubscribedRef = useRef(false); // ✅ prevent double-subscribe per connection
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onNewOrderRef = useRef(onNewOrder);
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  const onOrderReadyRef = useRef(onOrderReady);
  const onPointsVerificationCodeRef = useRef(onPointsVerificationCode);
  const onPosCartUpdateRef = useRef(onPosCartUpdate);
  const onNotificationRef = useRef(onNotification);

  useEffect(() => { onNewOrderRef.current = onNewOrder; }, [onNewOrder]);
  useEffect(() => { onOrderUpdatedRef.current = onOrderUpdated; }, [onOrderUpdated]);
  useEffect(() => { onOrderReadyRef.current = onOrderReady; }, [onOrderReady]);
  useEffect(() => { onPointsVerificationCodeRef.current = onPointsVerificationCode; }, [onPointsVerificationCode]);
  useEffect(() => { onPosCartUpdateRef.current = onPosCartUpdate; }, [onPosCartUpdate]);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

  const clientTypeRef = useRef(clientType);
  const orderIdRef = useRef(orderId);
  const branchIdRef = useRef(branchId);
  const customIdRef = useRef(customerId);
  const userIdRef = useRef(userId);

  useEffect(() => { clientTypeRef.current = clientType; }, [clientType]);
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);
  useEffect(() => { branchIdRef.current = branchId; }, [branchId]);
  useEffect(() => { customIdRef.current = customerId; }, [customerId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const sendSubscribe = useCallback((ws: WebSocket) => {
    // ✅ Only subscribe once per connection to prevent duplicate server-side subscriptions
    if (hasSubscribedRef.current) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    hasSubscribedRef.current = true;
    ws.send(
      JSON.stringify({
        type: "subscribe",
        clientType: clientTypeRef.current,
        orderId: orderIdRef.current,
        branchId: branchIdRef.current,
        customerId: customIdRef.current,
        userId: userIdRef.current || customIdRef.current,
      })
    );
  }, []);

  const sendMessage = useCallback((data: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (isConnectingRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    clearTimers();
    isConnectingRef.current = true;
    hasSubscribedRef.current = false; // ✅ reset subscribe flag on new connection

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState !== WebSocket.CLOSED &&
            wsRef.current.readyState !== WebSocket.CLOSING) {
          wsRef.current.close(1000, "Reconnecting");
        }
      } catch (e) {}
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/orders`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        isConnectingRef.current = false;
        setIsConnected(true);
        setError(null);

        sendSubscribe(ws);

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          } else {
            clearTimers();
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);

          switch (message.type) {
            case "new_order":
              onNewOrderRef.current?.(message.order);
              if (Notification.permission === 'granted' && window.location.pathname !== '/employee/orders') {
                const n = new Notification(message.title || 'طلب جديد', {
                  body: message.body || `طلب جديد بقيمة ${message.order?.totalAmount} ر.س`,
                  icon: '/logo.png',
                  tag: 'new-order',
                  requireInteraction: true,
                });
                n.onclick = () => {
                  window.focus();
                  window.location.href = '/employee/orders';
                };
              }
              break;
            case "push_alert":
              if (Notification.permission === 'granted') {
                const n = new Notification(message.title, {
                  body: message.body,
                  icon: '/logo.png',
                  tag: 'remote-alert',
                  requireInteraction: true
                });
                n.onclick = () => {
                  window.focus();
                  window.location.href = message.url || '/employee/orders';
                };
              }
              break;
            case "order_updated":
              onOrderUpdatedRef.current?.(message.order);
              break;
            case "order_ready":
              onOrderReadyRef.current?.(message.order);
              break;
            case "points_verification_code":
              onPointsVerificationCodeRef.current?.(message);
              break;
            case "pos_cart_update":
              onPosCartUpdateRef.current?.(message.payload);
              break;
            case "notification":
              onNotificationRef.current?.(message.notification);
              break;
            case "admin_notification":
              onNotificationRef.current?.(message.notification);
              break;
            case "welcome":
              // ✅ Don't re-subscribe on welcome — already handled in onopen
              // Server sends welcome after we already subscribed, no need to subscribe again
              break;
          }
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      };

      ws.onclose = (event) => {
        isConnectingRef.current = false;
        hasSubscribedRef.current = false; // ✅ allow subscribe on next connection
        setIsConnected(false);
        clearTimers();

        if (isMountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        setError("خطأ في الاتصال - جاري إعادة المحاولة");
        setIsConnected(false);
        isConnectingRef.current = false;
      };
    } catch (error) {
      console.error("[WS] Failed to create WebSocket:", error);
      isConnectingRef.current = false;

      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    }
  }, [clearTimers, sendSubscribe]);

  const disconnect = useCallback(() => {
    clearTimers();
    isConnectingRef.current = false;
    hasSubscribedRef.current = false;
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState !== WebSocket.CLOSED &&
            wsRef.current.readyState !== WebSocket.CLOSING) {
          wsRef.current.close(1000, "Disconnecting");
        }
      } catch (e) {}
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearTimers]);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    isConnected,
    lastMessage,
    error,
    reconnect: connect,
    disconnect,
    sendMessage,
  };
}
