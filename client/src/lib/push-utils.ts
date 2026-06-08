function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export async function subscribeToPush(opts: {
  userType: 'employee' | 'customer';
  userId: string;
  branchId?: string;
}): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const resp = await fetch('/api/push/vapid-key');
    if (!resp.ok) return false;
    const { publicKey } = await resp.json();
    if (!publicKey) return false;

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const body: Record<string, any> = {
      subscription: subscription.toJSON(),
      userType: opts.userType,
      userId: opts.userId,
    };
    if (opts.branchId) body.branchId = opts.branchId;

    const saveResp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return saveResp.ok;
  } catch (err) {
    console.warn('[Push] subscribeToPush error:', err);
    return false;
  }
}

export async function requestAndSubscribeEmployee(employee: {
  id?: string;
  _id?: string;
  username?: string;
  branchId?: string;
  role?: string;
}): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const userId = employee.id || employee._id || employee.username || 'employee';
    const branchId = employee.branchId || '';

    if (Notification.permission === 'granted') {
      await subscribeToPush({ userType: 'employee', userId, branchId });
      return;
    }

    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        await subscribeToPush({ userType: 'employee', userId, branchId });
      }
    }
  } catch (err) {
    console.warn('[Push] requestAndSubscribeEmployee error:', err);
  }
}
