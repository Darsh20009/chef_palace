import { useEffect } from "react";
import { useCustomer } from "@/contexts/CustomerContext";

const COOLDOWN_KEY = "br_proximity_notified_at";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Checks whether the customer is within 100 meters of any branch.
 * If so, triggers a push notification "لا تفوتك قهوتنا وأنت قريب منا".
 *
 * - Runs once per page session (with 1-hour localStorage cooldown)
 * - Waits 3 seconds after mount to avoid blocking the initial render
 * - Works for both logged-in customers and anonymous visitors with push subscriptions
 */
export function useProximityNotify() {
  const { customer } = useCustomer();

  useEffect(() => {
    // Check client-side cooldown first
    const lastNotified = localStorage.getItem(COOLDOWN_KEY);
    if (lastNotified && Date.now() - parseInt(lastNotified, 10) < COOLDOWN_MS) return;

    if (!navigator.geolocation) return;

    let cancelled = false;

    const run = async () => {
      // Get push subscription endpoint (if available) for anonymous users
      let subscriptionEndpoint: string | undefined;
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          subscriptionEndpoint = sub?.endpoint;
        }
      } catch {
        // ignore — push may not be available
      }

      if (cancelled) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          try {
            const body: Record<string, unknown> = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            if (customer?.id) body.customerId = customer.id;
            if (subscriptionEndpoint) body.subscriptionEndpoint = subscriptionEndpoint;

            const res = await fetch("/api/customer/proximity-notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });

            if (res.ok) {
              const data = await res.json();
              if (data.triggered) {
                localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
              }
            }
          } catch {
            // silently ignore network errors
          }
        },
        () => {
          // User denied or geolocation failed — do nothing
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
      );
    };

    // Delay 3 s to not block initial render / critical resources
    const timer = setTimeout(run, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);
}
