import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Table {
  id: string;
  tableNumber: string;
  isOccupied: number;
  branchId: string;
  reservedFor?: {
    autoExpiryTime?: string;
  };
}

export function TableOccupancyAlerts({ branchId }: { branchId?: string }) {
  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["/api/tables", branchId],
    queryFn: async () => {
      let url = "/api/tables";
      if (branchId) url += `?branchId=${branchId}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!branchId,
    refetchInterval: 30000,
  });

  const alerts = tables.filter(t => {
    if (!t.isOccupied || !t.reservedFor?.autoExpiryTime) return false;
    const expiry = new Date(t.reservedFor.autoExpiryTime);
    const now = new Date();
    // Show alert if less than 2 minutes left or already expired
    return expiry.getTime() - now.getTime() < 2 * 60 * 1000;
  });

  if (alerts.length === 0) return null;

  return (
    <Card className="border-red-500/50 bg-red-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          تنبيهات إشغال الطاولات
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(table => (
          <div key={table.id} className="flex items-center justify-between bg-white/50 p-2 rounded border border-red-200">
            <span className="text-sm font-bold">طاولة {table.tableNumber}</span>
            <div className="flex items-center gap-1 text-xs text-red-600">
              <Clock className="w-3 h-3" />
              {new Date(table.reservedFor!.autoExpiryTime!) < new Date() ? 'انتهى الوقت' : 'أوشك الوقت على الانتهاء'}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
