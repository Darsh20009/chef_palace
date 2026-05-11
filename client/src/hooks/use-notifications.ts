import { useState, useEffect, useCallback, useRef } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UseNotificationsOptions {
  userType: 'employee' | 'customer';
  userId?: string;
  branchId?: string;
  autoSubscribe?: boolean;
}

export function useNotifications(options?: UseNotificationsOptions) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  // ✅ Prevent duplicate POST /api/push/subscribe calls
  const serverSyncedRef = useRef(false);
  const syncingRef = useRef(false);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('SW registration failed:', error);
      return null;
    }
  }, []);

  // ✅ Internal helper — sends subscription to server ONCE
  const syncSubToServer = useCallback(async (sub: PushSubscription) => {
    if (serverSyncedRef.current || syncingRef.current) return;
    if (!options?.userId) return;
    syncingRef.current = true;
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userType: options?.userType || 'customer',
          userId: options?.userId || 'anonymous',
          branchId: options?.branchId,
        }),
      });
      serverSyncedRef.current = true;
    } catch {
      // ignore
    } finally {
      syncingRef.current = false;
    }
  }, [options?.userType, options?.userId, options?.branchId]);

  const subscribeToPush = useCallback(async () => {
    if (isLoading || syncingRef.current) return;
    setIsLoading(true);
    try {
      const registration = await registerServiceWorker();
      if (!registration) return;

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        subscriptionRef.current = existingSub;
        setIsSubscribed(true);
        await syncSubToServer(existingSub);
        return;
      }

      const response = await fetch('/api/push/vapid-key');
      const { publicKey } = await response.json();
      if (!publicKey) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      subscriptionRef.current = subscription;
      setIsSubscribed(true);
      await syncSubToServer(subscription);
    } catch (error) {
      console.error('[Push] Subscription failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, registerServiceWorker, syncSubToServer]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      if (subscriptionRef.current) {
        const endpoint = subscriptionRef.current.endpoint;
        await subscriptionRef.current.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        subscriptionRef.current = null;
        serverSyncedRef.current = false;
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      await subscribeToPush();
    }
    return result;
  }, [subscribeToPush]);

  const sendNotification = useCallback((title: string, notifOptions?: NotificationOptions) => {
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/favicon.png',
          ...({ vibrate: [200, 100, 200] } as any),
          ...notifOptions,
        });
      });
    }
  }, []);

  // ✅ Single consolidated effect — check existing subscription once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const init = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          subscriptionRef.current = existingSub;
          setIsSubscribed(true);
          // Sync to server if we have a userId
          if (options?.userId) {
            await syncSubToServer(existingSub);
          }
        } else if (options?.autoSubscribe && options?.userId && Notification.permission === 'granted') {
          // ✅ Only auto-subscribe if no existing sub and conditions are met
          await subscribeToPush();
        }
      } catch {
        // silently ignore
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ Only run once on mount — not on every userId change

  // ✅ Re-sync when userId changes (e.g., login after mount), but throttled
  useEffect(() => {
    if (!options?.userId || !isSubscribed || !subscriptionRef.current) return;
    // If userId changed and we haven't synced yet, re-sync
    serverSyncedRef.current = false;
    syncSubToServer(subscriptionRef.current).catch(() => {});
  }, [options?.userId]);

  return {
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendNotification,
  };
}
