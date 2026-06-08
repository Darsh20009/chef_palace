import { useState, useEffect } from "react";
  import { useTranslate } from "@/lib/useTranslate";
  import { WifiOff, Wifi, RefreshCw } from "lucide-react";
  import { Button } from "@/components/ui/button";

  export function OfflineIndicator() {
    const tc = useTranslate();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
      const handleOnline = () => { setIsOnline(true); if (!navigator.onLine) setWasOffline(true); };
      const handleOffline = () => { setIsOnline(false); setWasOffline(true); };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);

    useEffect(() => {
      if (!isOnline) {
        const timer = setInterval(async () => {
          try {
            const request = indexedDB.open('qirox-offline', 2);
            request.onsuccess = (e) => {
              const db = (e.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains('pending-writes')) return;
              const tx = db.transaction('pending-writes', 'readonly');
              const store = tx.objectStore('pending-writes');
              const req = store.count();
              req.onsuccess = () => setPendingCount(req.result);
            };
          } catch {}
        }, 3000);
        return () => clearInterval(timer);
      } else {
        setPendingCount(0);
      }
    }, [isOnline]);

    if (isOnline && !wasOffline) return null;

    if (isOnline && wasOffline) {
      return (
        <div className="fixed top-16 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
          <div className="bg-green-500 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <Wifi className="w-4 h-4" />
            {tc("تمت استعادة الاتصال — جاري مزامنة البيانات...", "Connection restored — syncing data...")}
          </div>
        </div>
      );
    }

    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">{tc("لا يوجد اتصال بالإنترنت", "No Internet Connection")}</p>
            {pendingCount > 0 && (
              <p className="text-xs opacity-80">{pendingCount} {tc("عملية معلقة — ستُزامن عند الاتصال", "pending operations — will sync on reconnect")}</p>
            )}
          </div>
        </div>
        <Button size="sm" variant="ghost" className="text-white hover:bg-red-700 h-7 px-2 text-xs" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3.5 h-3.5 ml-1" />{tc("إعادة المحاولة", "Retry")}
        </Button>
      </div>
    );
  }
  