import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function CurbsidePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    try {
      sessionStorage.setItem("qirox_car_pickup_mode", "1");
    } catch {}
    setLocation("/menu");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold">جاري فتح منيو السيارات...</p>
      </div>
    </div>
  );
}
