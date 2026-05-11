import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState } from "@/components/ui/states";
import SarIcon from "@/components/sar-icon";
import { 
  Truck, Package, MapPin, Clock, Phone, User, 
  CheckCircle, XCircle, Navigation, ArrowRight,
  Coffee, RefreshCw, Bike, Car, LogOut
} from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

interface DeliveryOrder {
  id: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLocation?: { lat: number; lng: number };
  branchId: string;
  branchName?: string;
  estimatedDeliveryTime?: string;
  estimatedMinutes?: number;
  totalAmount: number;
  items?: Array<{ name: string; quantity: number }>;
  createdAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

interface Driver {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  vehicleType: string;
  currentLocation?: { lat: number; lng: number };
}

const VEHICLE_ICONS: Record<string, any> = {
  motorcycle: Bike,
  car: Car,
  bicycle: Bike,
};

export default function DriverPortal() {
  const [, setLocation] = useLocation();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();
  const tc = useTranslate();

  const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:    { label: tc("في الانتظار", "Pending"),      color: "bg-yellow-500" },
    assigned:   { label: tc("تم التعيين", "Assigned"),      color: "bg-blue-500" },
    accepted:   { label: tc("تم القبول", "Accepted"),       color: "bg-indigo-500" },
    picked_up:  { label: tc("تم الاستلام", "Picked Up"),    color: "bg-purple-500" },
    on_the_way: { label: tc("في الطريق", "On the Way"),     color: "bg-orange-500" },
    delivered:  { label: tc("تم التوصيل", "Delivered"),     color: "bg-green-500" },
    cancelled:  { label: tc("ملغي", "Cancelled"),           color: "bg-red-500" },
  };

  useEffect(() => {
    document.title = tc("بوابة المندوب - مكان الشيف البخاري", "Driver Portal - مكان الشيف البخاري");
    const storedDriver = localStorage.getItem("currentDriver");
    if (storedDriver) {
      const driverData = JSON.parse(storedDriver);
      setDriver(driverData);
      setIsOnline(driverData.status === "available");
    }
  }, [tc]);

  const { data: ordersData, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['/api/delivery/orders/driver', driver?.id],
    enabled: !!driver,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest('PATCH', `/api/delivery/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/delivery/orders/driver'] });
      refetchOrders();
      toast({ title: tc("تم التحديث", "Updated"), description: tc("تم تحديث حالة الطلب", "Order status updated") });
    },
    onError: () => {
      toast({ title: tc("خطأ", "Error"), description: tc("فشل في تحديث الحالة", "Failed to update status"), variant: "destructive" });
    },
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async (status: string) => {
      const driverId = driver?.id;
      return apiRequest('PATCH', `/api/delivery/drivers/${driverId}/status`, { status });
    },
    onSuccess: (_, status) => {
      setIsOnline(status === "available");
      if (driver) {
        const updatedDriver = { ...driver, status };
        setDriver(updatedDriver);
        localStorage.setItem("currentDriver", JSON.stringify(updatedDriver));
      }
      toast({ 
        title: status === "available" ? tc("أنت متصل الآن", "You are now online") : tc("أنت غير متصل", "You are now offline"),
        description: status === "available" ? tc("يمكنك استلام طلبات جديدة", "You can receive new orders") : tc("لن تستلم طلبات جديدة", "You will not receive new orders")
      });
    },
  });

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const handleToggleOnline = (checked: boolean) => {
    toggleOnlineMutation.mutate(checked ? "available" : "offline");
  };

  const handleLogout = () => {
    localStorage.removeItem("currentDriver");
    setLocation("/driver/login");
  };

  const orders = (ordersData as any)?.orders || [];
  const activeOrders = orders.filter((o: DeliveryOrder) => 
    !["delivered", "cancelled"].includes(o.status)
  );
  const completedOrders = orders.filter((o: DeliveryOrder) => 
    ["delivered", "cancelled"].includes(o.status)
  );

  const VehicleIcon = driver?.vehicleType ? VEHICLE_ICONS[driver.vehicleType] || Truck : Truck;

  if (!driver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Truck className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle>{tc("بوابة المندوب", "Driver Portal")}</CardTitle>
            <CardDescription>{tc("يرجى تسجيل الدخول للمتابعة", "Please sign in to continue")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/driver/login")} data-testid="button-driver-login">
              {tc("تسجيل الدخول", "Sign In")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <VehicleIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">{driver.fullName}</h1>
                <p className="text-sm text-muted-foreground">{driver.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch 
                  id="online-status" 
                  checked={isOnline} 
                  onCheckedChange={handleToggleOnline}
                  data-testid="switch-online-status"
                />
                <Label htmlFor="online-status" className="text-sm">
                  {isOnline ? (
                    <span className="text-green-600 font-medium">{tc("متصل", "Online")}</span>
                  ) : (
                    <span className="text-muted-foreground">{tc("غير متصل", "Offline")}</span>
                  )}
                </Label>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-600">{activeOrders.length}</p>
              <p className="text-xs text-muted-foreground">{tc("طلبات نشطة", "Active Orders")}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-600">
                {completedOrders.filter((o: DeliveryOrder) => o.status === "delivered").length}
              </p>
              <p className="text-xs text-muted-foreground">{tc("تم التوصيل", "Delivered")}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto text-orange-600 mb-2" />
              <p className="text-2xl font-bold text-orange-600">
                {orders.filter((o: DeliveryOrder) => o.status === "on_the_way").length}
              </p>
              <p className="text-xs text-muted-foreground">{tc("في الطريق", "On the Way")}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{tc("الطلبات", "Orders")}</h2>
          <Button variant="outline" size="sm" onClick={() => refetchOrders()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 ml-2" />
            {tc("تحديث", "Refresh")}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active">
              {tc("نشطة", "Active")} ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              {tc("مكتملة", "Completed")} ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {loadingOrders ? (
              <LoadingState />
            ) : activeOrders.length === 0 ? (
              <EmptyState 
                title={tc("لا توجد طلبات نشطة", "No Active Orders")}
                description={isOnline ? tc("انتظر طلبات جديدة", "Wait for new orders") : tc("قم بتفعيل حالة الاتصال لاستلام الطلبات", "Go online to receive orders")}
              />
            ) : (
              activeOrders.map((order: DeliveryOrder) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onStatusChange={handleStatusChange}
                  isPending={updateStatusMutation.isPending}
                  statusLabels={ORDER_STATUS_LABELS}
                  tc={tc}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedOrders.length === 0 ? (
              <EmptyState title={tc("لا توجد طلبات مكتملة", "No Completed Orders")} description={tc("ستظهر هنا الطلبات المكتملة", "Completed orders will appear here")} />
            ) : (
              completedOrders.slice(0, 20).map((order: DeliveryOrder) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onStatusChange={handleStatusChange}
                  isPending={updateStatusMutation.isPending}
                  isCompleted
                  statusLabels={ORDER_STATUS_LABELS}
                  tc={tc}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function OrderCard({ 
  order, 
  onStatusChange, 
  isPending,
  isCompleted = false,
  statusLabels,
  tc,
}: { 
  order: DeliveryOrder; 
  onStatusChange: (orderId: string, status: string) => void;
  isPending: boolean;
  isCompleted?: boolean;
  statusLabels: Record<string, { label: string; color: string }>;
  tc: (ar: string, en: string) => string;
}) {
  const orderId = order.id || "";
  const statusInfo = statusLabels[order.status] || { label: order.status, color: "bg-gray-500" };

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      assigned: "accepted",
      accepted: "picked_up",
      picked_up: "on_the_way",
      on_the_way: "delivered",
    };
    return flow[currentStatus] || null;
  };

  const getNextStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      accepted:  tc("قبول الطلب", "Accept Order"),
      picked_up: tc("تم الاستلام", "Picked Up"),
      on_the_way: tc("بدء التوصيل", "Start Delivery"),
      delivered: tc("تم التوصيل", "Delivered"),
    };
    return labels[status] || status;
  };

  const nextStatus = getNextStatus(order.status);

  return (
    <Card className={`overflow-hidden ${isCompleted ? "opacity-75" : ""}`}>
      <div className={`h-1 ${statusInfo.color}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg">{tc("طلب", "Order")} {order.orderNumber || orderId.slice(-6)}</span>
              <Badge className={`${statusInfo.color} text-white`}>
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("ar-SA")}
            </p>
          </div>
          <div className="text-left">
            <p className="font-bold text-primary text-lg">{order.totalAmount?.toFixed(2)} <SarIcon /></p>
            {order.estimatedMinutes && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {order.estimatedMinutes} {tc("دقيقة", "min")}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{order.customerName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${order.customerPhone}`} className="text-primary hover:underline">
              {order.customerPhone}
            </a>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="flex-1">{order.customerAddress}</span>
          </div>
        </div>

        {order.items && order.items.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Coffee className="w-4 h-4" />
              {tc("المنتجات", "Products")}
            </p>
            <div className="space-y-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isCompleted && (
          <div className="flex gap-2">
            {order.customerLocation && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  const { lat, lng } = order.customerLocation!;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
                }}
                data-testid={`button-navigate-${orderId}`}
              >
                <Navigation className="w-4 h-4 ml-2" />
                {tc("الملاحة", "Navigate")}
              </Button>
            )}
            {nextStatus && (
              <Button 
                className="flex-1"
                onClick={() => onStatusChange(orderId, nextStatus)}
                disabled={isPending}
                data-testid={`button-next-status-${orderId}`}
              >
                {getNextStatusLabel(nextStatus)}
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            )}
            {order.status === "assigned" && (
              <Button 
                variant="destructive"
                onClick={() => onStatusChange(orderId, "cancelled")}
                disabled={isPending}
                data-testid={`button-cancel-${orderId}`}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
