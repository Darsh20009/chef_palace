import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Bell,
  AlertTriangle,
  TrendingDown,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  Package,
  CheckCheck,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { useTranslate, tc } from "@/lib/useTranslate";
import { ar } from "date-fns/locale";

interface StockAlert {
  id: string;
  branchId: string;
  rawItemId: string;
  alertType: string;
  currentQuantity: number;
  thresholdQuantity: number;
  isRead: number;
  isResolved: number;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  rawItem?: {
    nameAr: string;
    code: string;
    unit: string;
  };
  branch?: {
    nameAr: string;
  };
}

interface Branch {
  id?: string;
  nameAr: string;
}

const alertTypeConfig: Record<string, { labelAr: string; labelEn: string; icon: typeof AlertTriangle; color: string }> = {
  low_stock: { labelAr: "مخزون منخفض", labelEn: "Low Stock", icon: TrendingDown, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  out_of_stock: { labelAr: "نفاد المخزون", labelEn: "Out of Stock", icon: AlertTriangle, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  expiring_soon: { labelAr: "قارب على الانتهاء", labelEn: "Expiring Soon", icon: Clock, color: "bg-accent text-accent dark:bg-accent dark:text-accent" },
  expired: { labelAr: "منتهي الصلاحية", labelEn: "Expired", icon: AlertTriangle, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const unitLabels: Record<string, string> = {
  kg: "كيلوجرام",
  g: "جرام",
  liter: "لتر",
  ml: "ملليلتر",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

export default function InventoryAlertsPage() {
  const { toast } = useToast();
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("unresolved");

  // WebSocket for real-time alerts
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/orders`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', clientType: 'inventory' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'stock_alert' || data.type === 'alert_resolved') {
          queryClient.invalidateQueries({ queryKey: ["/api/inventory/alerts"] });
          if (data.type === 'stock_alert') {
            toast({ title: tc("تنبيه مخزون جديد", "New Stock Alert"), description: tc("تم استلام تنبيه مخزون جديد", "A new stock alert has been received") });
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [toast]);

  const { data: alerts = [], isLoading } = useQuery<StockAlert[]>({
    queryKey: ["/api/inventory/alerts"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/alerts/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/alerts"] });
      toast({ title: tc("تم حل التنبيه بنجاح", "Alert resolved successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في حل التنبيه", "Failed to resolve alert"), variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/alerts/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/alerts"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في تحديث التنبيه", "Failed to update alert"), variant: "destructive" });
    },
  });

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.nameAr || id;

  const filteredAlerts = alerts.filter((alert) => {
    const matchesBranch = branchFilter === "all" || alert.branchId === branchFilter;
    const matchesType = typeFilter === "all" || alert.alertType === typeFilter;
    let matchesStatus = true;
    if (statusFilter === "unresolved") {
      matchesStatus = alert.isResolved === 0;
    } else if (statusFilter === "resolved") {
      matchesStatus = alert.isResolved === 1;
    }
    
    return matchesBranch && matchesType && matchesStatus;
  });

  const unresolvedCount = alerts.filter(a => a.isResolved === 0).length;
  const unreadCount = alerts.filter(a => a.isRead === 0 && a.isResolved === 0).length;
  const lowStockCount = alerts.filter(a => a.alertType === 'low_stock' && a.isResolved === 0).length;
  const outOfStockCount = alerts.filter(a => a.alertType === 'out_of_stock' && a.isResolved === 0).length;
  const expiringCount = alerts.filter(a => (a.alertType === 'expiring_soon' || a.alertType === 'expired') && a.isResolved === 0).length;

  const markAllAsReadMutation = useMutation({
    mutationFn: () => Promise.all(
      filteredAlerts.filter(a => a.isRead === 0).map(a => apiRequest("PUT", `/api/inventory/alerts/${a.id}/read`))
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/alerts"] });
      toast({ title: tc("تم تحديد جميع التنبيهات كمقروءة", "All alerts marked as read") });
    },
    onError: (error: any) => {
      toast({ 
        title: tc("فشل في تحديد التنبيهات كمقروءة", "Failed to mark alerts as read"), 
        description: error.message || tc("حدث خطأ أثناء تحديث التنبيهات", "Error updating alerts"),
        variant: "destructive" 
      });
    },
  });

  const getDeficit = (current: number, threshold: number) => {
    const deficit = threshold - current;
    return deficit > 0 ? deficit : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">{tc("تنبيهات المخزون", "Inventory Alerts")}</h1>
            <p className="text-muted-foreground text-sm">{tc("متابعة تنبيهات نفاد وانخفاض المخزون", "Monitor stock depletion and low inventory alerts")}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/inventory/alerts"] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc("نفاد المخزون", "Out of Stock")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">{tc("تنبيه عاجل", "Urgent alert")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc("مخزون منخفض", "Low Stock")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">{tc("يحتاج إعادة طلب", "Needs reorder")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc("صلاحية منتهية", "Expired")}</CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{expiringCount}</div>
            <p className="text-xs text-muted-foreground">{tc("تنبيه صلاحية", "Expiry alert")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc("غير مقروءة", "Unread")}</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">{tc("تنبيه جديد", "New alert")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-branch-filter">
                <SelectValue placeholder={tc("الفرع", "Branch")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الفروع", "All Branches")}</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id as string}>
                    {branch.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                <SelectValue placeholder={tc("نوع التنبيه", "Alert Type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الأنواع", "All Types")}</SelectItem>
                {Object.entries(alertTypeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{tc(cfg.labelAr, cfg.labelEn)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder={tc("الحالة", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الحالات", "All Statuses")}</SelectItem>
                <SelectItem value="unresolved">{tc("غير محلولة", "Unresolved")}</SelectItem>
                <SelectItem value="resolved">{tc("محلولة", "Resolved")}</SelectItem>
              </SelectContent>
            </Select>
            
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <Eye className="h-4 w-4 ml-2" />
                تحديد الكل كمقروء
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">{tc("النوع", "Type")}</TableHead>
                  <TableHead className="text-right">{tc("المادة", "Material")}</TableHead>
                  <TableHead className="text-right">{tc("الفرع", "Branch")}</TableHead>
                  <TableHead className="text-right">{tc("الكمية الحالية", "Current Qty")}</TableHead>
                  <TableHead className="text-right">{tc("الحد الأدنى", "Min. Threshold")}</TableHead>
                  <TableHead className="text-right">{tc("النقص", "Deficit")}</TableHead>
                  <TableHead className="text-right">{tc("التاريخ", "Date")}</TableHead>
                  <TableHead className="text-right">{tc("الحالة", "Status")}</TableHead>
                  <TableHead className="text-right">{tc("الإجراءات", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{tc("لا توجد تنبيهات", "No alerts found")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlerts.map((alert) => {
                    const config = alertTypeConfig[alert.alertType] || alertTypeConfig.low_stock;
                    const AlertIcon = config.icon;
                    
                    return (
                      <TableRow 
                        key={alert.id} 
                        className={alert.isRead === 0 ? "bg-muted/30" : ""}
                        data-testid={`row-alert-${alert.id}`}
                      >
                        <TableCell>
                          <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                            <AlertIcon className="h-3 w-3" />
                            {tc(config.labelAr, config.labelEn)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{alert.rawItem?.nameAr}</div>
                            <div className="text-sm text-muted-foreground font-mono">{alert.rawItem?.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{alert.branch?.nameAr || getBranchName(alert.branchId)}</TableCell>
                        <TableCell>
                          <span className="font-medium">{alert.currentQuantity}</span>
                          <span className="text-muted-foreground mr-1">
                            {unitLabels[alert.rawItem?.unit || ""] || alert.rawItem?.unit}
                          </span>
                        </TableCell>
                        <TableCell>{alert.thresholdQuantity}</TableCell>
                        <TableCell>
                          {getDeficit(alert.currentQuantity, alert.thresholdQuantity) > 0 ? (
                            <span className="text-red-600 font-medium">
                              -{getDeficit(alert.currentQuantity, alert.thresholdQuantity)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(alert.createdAt), "dd/MM/yyyy HH:mm", { locale: ar })}
                        </TableCell>
                        <TableCell>
                          {alert.isResolved === 1 ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3" />
                              محلول
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{tc("قيد الانتظار", "Pending")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {alert.isResolved === 0 && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveMutation.mutate(alert.id)}
                                disabled={resolveMutation.isPending}
                                data-testid={`button-resolve-${alert.id}`}
                              >
                                <CheckCircle className="h-4 w-4 ml-1" />
                                حل
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
