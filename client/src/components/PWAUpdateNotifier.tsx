import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

export function PWAUpdateNotifier() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setShowUpdate(true);
    };

    window.addEventListener('sw-update-available', handleUpdate);
    return () => window.removeEventListener('sw-update-available', handleUpdate);
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:w-96" dir="rtl">
      <div className="bg-primary text-primary-foreground rounded-xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-500">
        <div className="bg-white/20 rounded-full p-2 shrink-0">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">تحديث جديد متاح</p>
          <p className="text-xs opacity-90">قم بتحديث التطبيق للحصول على أحدث الميزات</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              window.location.reload();
            }}
            className="h-8 text-xs font-bold"
            data-testid="button-pwa-update"
          >
            تحديث
          </Button>
          <button
            onClick={() => setShowUpdate(false)}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            data-testid="button-dismiss-update"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
