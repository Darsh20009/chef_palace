import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslate } from "@/lib/useTranslate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/hooks/use-toast";
import { playNotificationSound, getSoundEnabled, setSoundEnabled as saveSoundEnabled } from "@/lib/notification-sounds";
import { AudioUnlockBanner } from "@/components/audio-unlock-banner";
import { useOrderWebSocket } from "@/lib/websocket";
import { OrderCard } from "@/components/ui/order-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChefHat,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Wifi,
  WifiOff,
  Store,
  ShoppingBag,
  Truck,
  Navigation,
  Clock,
  History,
} from "lucide-react";
import { useLocation } from "wouter";
import { MobileBottomNav } from "@/components/MobileBottomNav";

if (typeof document !== "undefined") {
  document.title = "Kitchen Display - مكان الشيف البخاري | Order Management";
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc)
    metaDesc.setAttribute(
      "content",
      "Kitchen Display for مكان الشيف البخاري - Easy and fast order management"
    );
}

interface OrderItem {
  coffeeItemId: string;
  quantity: number;
  size: string;
  extras?: string[];
  sugarLevel?: string;
  notes?: string;
  coffeeItem?: {
    nameAr: string;
    nameEn?: string;
    price?: number;
    imageUrl?: string;
    category?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  tableStatus?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  tableNumber?: string;
  orderType?: string;
  deliveryType?: "pickup" | "delivery" | "dine-in" | "car-pickup" | "car_pickup";
  carInfo?: { carType: string; carColor: string; plateNumber: string };
  carType?: string;
  carColor?: string;
  carPlate?: string;
  plateNumber?: string;
  arrivalTime?: string;
  scheduledPickupTime?: string;
  preparationHoldUntil?: string;
  estimatedPrepTimeInMinutes?: number;
  customerNotes?: string;
  branchId?: string;
  channel?: string;
  notes?: string;
}

function getElapsedMinutes(dateString: string): number {
  const created = new Date(dateString).getTime();
  return Math.floor((Date.now() - created) / (1000 * 60));
}

function getDelayThreshold(order: Order): number {
  return order.estimatedPrepTimeInMinutes || 10;
}

export default function KitchenDisplay() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [activeTab, setActiveTab] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundEnabled("kitchen"));
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>("all");
  const previousReadyCountRef = useRef<number>(-1);
  const alertedPrepNowIds = useRef<Set<string>>(new Set());

  const {
    data: orders = [],
    isLoading,
    refetch,
  } = useQuery<Order[]>({
    queryKey: ["/api/orders/kitchen"],
    refetchInterval: autoRefresh ? 8000 : false,
  });

  const handleNewOrder = useCallback(
    (order: Order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
      const isOnlineOrder =
        order?.channel === "online" ||
        order?.channel === "web" ||
        order?.orderType === "online";
      if (soundEnabled) {
        playNotificationSound(isOnlineOrder ? "cashierOrder" : "newOrder", 0.8);
        toast({
          title: tc("طلب جديد!", "New Order!"),
          description: `${tc("وصل طلب جديد", "New order arrived")} #${order.orderNumber}`,
        });
      }

      // ── Auto-print online orders from KDS as a fallback when no POS tab is open ──
      if (isOnlineOrder) {
        (async () => {
          try {
            const { loadPrinterSettings } = await import("@/lib/thermal-printer");
            const ps = loadPrinterSettings();
            if (!ps.autoPrint) return;
            // Multi-tab guard: only one tab prints per order (1 minute lock)
            const lockKey = `kds-print-lock-${order.id || order.orderNumber}`;
            if (typeof localStorage !== "undefined") {
              const existing = localStorage.getItem(lockKey);
              if (existing && Date.now() - Number(existing) < 60_000) return;
              localStorage.setItem(lockKey, String(Date.now()));
            }
            const { printTaxInvoice } = await import("@/lib/print-utils");
            const printData: any = {
              orderNumber: order.orderNumber,
              items: (order as any).items || [],
              subtotal: Number((order as any).subtotal ?? 0),
              tax: Number((order as any).tax ?? (order as any).vat ?? 0),
              total: Number((order as any).totalAmount ?? (order as any).total ?? 0),
              paymentMethod: (order as any).paymentMethod || "غير محدد",
              employeeName: (order as any).employeeName || "أونلاين",
              customerName: (order as any).customerName || "عميل أونلاين",
              tableNumber: (order as any).tableNumber,
              orderType: (order as any).deliveryType || (order as any).orderType,
              date: (order as any).createdAt || new Date().toISOString(),
            };
            setTimeout(() => {
              try { printTaxInvoice(printData, { autoPrint: true }); } catch (e) {
                console.warn("[KDS] Online order auto-print failed:", e);
              }
            }, 300);
          } catch (e) {
            console.warn("[KDS] Auto-print init failed:", e);
          }
        })();
      }
    },
    [soundEnabled, toast, tc]
  );

  const handleOrderUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
  }, []);

  const handleOrderReady = useCallback(
    (order: Order) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
      if (soundEnabled) {
        playNotificationSound("success", 0.8);
        toast({
          title: tc("✅ طلب جاهز!", "✅ Order Ready!"),
          description: `${tc("الطلب رقم", "Order #")}${order.orderNumber} ${tc("جاهز للاستلام", "is ready for pickup")}`,
        });
      }
    },
    [soundEnabled, toast, tc]
  );

  const { isConnected } = useOrderWebSocket({
    clientType: "kitchen",
    onNewOrder: handleNewOrder,
    onOrderUpdated: handleOrderUpdated,
    onOrderReady: handleOrderReady,
    enabled: true,
  });

  useEffect(() => {
    if (!Array.isArray(orders)) return;
    const readyCount = orders.filter((o) => o.status === "ready").length;
    if (
      previousReadyCountRef.current >= 0 &&
      readyCount > previousReadyCountRef.current &&
      soundEnabled
    ) {
      playNotificationSound("success", 0.8);
    }
    previousReadyCountRef.current = readyCount;
  }, [orders, soundEnabled]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      estimatedPrepTimeInMinutes,
    }: {
      id: string;
      status: string;
      estimatedPrepTimeInMinutes?: number;
    }) => {
      return apiRequest("PUT", `/api/orders/${id}/status`, {
        status,
        estimatedPrepTimeInMinutes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
      toast({
        title: tc("تم تحديث الحالة", "Status Updated"),
        description: tc(
          "تم تحديث حالة الطلب بنجاح",
          "Order status updated successfully"
        ),
      });
    },
    onError: (error: any) => {
      console.error("[KDS] Status update failed:", error);
      toast({
        title: tc("خطأ", "Error"),
        description:
          error?.message ||
          tc("فشل تحديث حالة الطلب", "Failed to update order status"),
        variant: "destructive",
      });
    },
  });

  const handleStartPreparing = (id: string, estimatedPrepTime?: number) => {
    updateStatusMutation.mutate({
      id,
      status: "in_progress",
      estimatedPrepTimeInMinutes: estimatedPrepTime || 5,
    });
  };

  const handleMarkReady = (id: string) => {
    updateStatusMutation.mutate({ id, status: "ready" });
  };

  const handleMarkCompleted = (id: string) => {
    updateStatusMutation.mutate({ id, status: "completed" });
  };

  const updateTimeMutation = useMutation({
    mutationFn: async ({
      id,
      additionalMinutes,
    }: {
      id: string;
      additionalMinutes: number;
    }) => {
      return apiRequest("PATCH", `/api/orders/${id}/prep-time`, {
        additionalMinutes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/kitchen"] });
      toast({
        title: tc("تم تحديث الوقت", "Time Updated"),
        description: tc(
          "تم إضافة وقت إضافي وإبلاغ العميل",
          "Extra time added and customer notified"
        ),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل تحديث الوقت", "Failed to update prep time"),
        variant: "destructive",
      });
    },
  });

  const handleUpdateTime = (id: string, additionalMinutes: number) => {
    updateTimeMutation.mutate({ id, additionalMinutes });
  };

  const filterByDeliveryType = useCallback(
    (orderList: Order[]) => {
      if (deliveryTypeFilter === "all") return orderList;
      return orderList.filter((o) => {
        const type = o.deliveryType || o.orderType;
        if (deliveryTypeFilter === "dine-in")
          return type === "dine-in" || type === "dine_in";
        if (deliveryTypeFilter === "pickup")
          return type === "pickup" || type === "takeaway";
        if (deliveryTypeFilter === "delivery") return type === "delivery";
        if (deliveryTypeFilter === "car-pickup")
          return type === "car-pickup" || type === "car_pickup";
        return true;
      });
    },
    [deliveryTypeFilter]
  );

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const {
    pendingOrders,
    preparingOrders,
    readyOrders,
    completedOrders,
    delayedOrders,
    delayedCount,
    scheduledOrders,
    needsPrepNowOrders,
  } = useMemo(() => {
    void tick;
    const filteredOrders = filterByDeliveryType(orders);
    const now = Date.now();

    const isOnHold = (o: Order) =>
      !!(
        o.scheduledPickupTime &&
        o.preparationHoldUntil &&
        new Date(o.preparationHoldUntil).getTime() > now
      );

    const isPrepDue = (o: Order) =>
      !!(
        o.scheduledPickupTime &&
        o.preparationHoldUntil &&
        new Date(o.preparationHoldUntil).getTime() <= now
      );

    const scheduled = filteredOrders.filter(
      (o) =>
        isOnHold(o) &&
        (o.status === "pending" ||
          o.status === "payment_confirmed" ||
          o.status === "confirmed")
    );

    const needsPrepNow = filteredOrders.filter(
      (o) =>
        isPrepDue(o) &&
        (o.status === "pending" ||
          o.status === "payment_confirmed" ||
          o.status === "confirmed")
    );

    const pending = filteredOrders.filter(
      (o) =>
        (o.status === "pending" ||
          o.status === "payment_confirmed" ||
          o.status === "confirmed") &&
        !isOnHold(o)
    );

    const preparing = filteredOrders.filter((o) => o.status === "in_progress");

    // Separate ready (awaiting pickup) from completed (handed over)
    const ready = filteredOrders.filter((o) => o.status === "ready");
    const completed = filteredOrders.filter((o) => o.status === "completed");

    const delayed = [...pending, ...preparing].filter(
      (o) => getElapsedMinutes(o.createdAt) >= getDelayThreshold(o)
    );

    return {
      pendingOrders: pending,
      preparingOrders: preparing,
      readyOrders: ready,
      completedOrders: completed,
      delayedOrders: delayed,
      delayedCount: delayed.length,
      scheduledOrders: scheduled,
      needsPrepNowOrders: needsPrepNow,
    };
  }, [orders, filterByDeliveryType, tick]);

  useEffect(() => {
    if (!soundEnabled || needsPrepNowOrders.length === 0) return;
    const newAlerts = needsPrepNowOrders.filter(
      (o) => !alertedPrepNowIds.current.has(o.id)
    );
    if (newAlerts.length === 0) return;
    newAlerts.forEach((o) => alertedPrepNowIds.current.add(o.id));
    playNotificationSound("cashierOrder", 0.9);
    toast({
      title: tc("⏰ حان وقت التحضير!", "⏰ Time to prepare!"),
      description: `${newAlerts.length} ${tc("طلب مجدول يحتاج للتحضير الآن", "scheduled order(s) need preparation now")}`,
    });
  }, [needsPrepNowOrders, soundEnabled, tc, toast]);

  const getFilteredOrders = (): Order[] => {
    switch (activeTab) {
      case "pending":
        return [...needsPrepNowOrders, ...pendingOrders];
      case "preparing":
        return preparingOrders;
      case "ready":
        return readyOrders;
      case "completed":
        return completedOrders;
      case "delayed":
        return delayedOrders;
      case "scheduled":
        return scheduledOrders;
      default:
        return [
          ...needsPrepNowOrders,
          ...pendingOrders,
          ...preparingOrders,
          ...readyOrders,
          ...scheduledOrders,
        ];
    }
  };

  const totalActiveOrders =
    pendingOrders.length +
    needsPrepNowOrders.length +
    preparingOrders.length +
    readyOrders.length +
    scheduledOrders.length;

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        dir="rtl"
      >
        <LoadingState message={tc("جاري تحميل الطلبات...", "Loading orders...")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0" dir="rtl">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/employee/home")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">
                  {tc("شاشة المطبخ", "Kitchen Display")}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {needsPrepNowOrders.length > 0 && (
                <Badge className="bg-orange-500 text-white animate-pulse">
                  <AlertTriangle className="h-3 w-3 ml-1" />
                  {needsPrepNowOrders.length}{" "}
                  {tc("يحتاج تحضير الآن!", "need prep now!")}
                </Badge>
              )}
              {delayedCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                  <AlertTriangle className="h-3 w-3 ml-1" />
                  {delayedCount} {tc("متأخر", "delayed")}
                </Badge>
              )}

              <Badge
                variant="outline"
                className={
                  isConnected
                    ? "bg-green-500/10 text-green-500 border-green-500/50"
                    : "bg-red-500/10 text-red-500 border-red-500/50"
                }
                data-testid="badge-ws-status"
              >
                {isConnected ? (
                  <Wifi className="h-3 w-3 ml-1" />
                ) : (
                  <WifiOff className="h-3 w-3 ml-1" />
                )}
                {isConnected
                  ? tc("متصل", "Connected")
                  : tc("غير متصل", "Disconnected")}
              </Badge>

              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-xs"
                >
                  {tc("انتظار", "Wait")}: {pendingOrders.length}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs"
                >
                  {tc("تحضير", "Prep")}: {preparingOrders.length}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-600 border-green-500/20 text-xs"
                >
                  {tc("جاهز", "Ready")}: {readyOrders.length}
                </Badge>
              </div>

              <Select
                value={deliveryTypeFilter}
                onValueChange={setDeliveryTypeFilter}
              >
                <SelectTrigger
                  className="w-28 h-8 text-xs"
                  data-testid="select-delivery-filter"
                >
                  <SelectValue
                    placeholder={tc("نوع الطلب", "Order Type")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tc("الكل", "All")}</SelectItem>
                  <SelectItem value="dine-in">
                    <div className="flex items-center gap-2">
                      <Store className="h-3 w-3" />
                      {tc("محلي", "Dine-in")}
                    </div>
                  </SelectItem>
                  <SelectItem value="pickup">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-3 w-3" />
                      {tc("سفري", "Takeaway")}
                    </div>
                  </SelectItem>
                  <SelectItem value="delivery">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3 w-3" />
                      {tc("توصيل", "Delivery")}
                    </div>
                  </SelectItem>
                  <SelectItem value="car-pickup">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-3 w-3" />
                      {tc("سيارة", "Car")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <AudioUnlockBanner
                pageKey="kitchen"
                soundEnabled={soundEnabled}
                onToggleSound={(val) => {
                  setSoundEnabled(val);
                  saveSoundEnabled("kitchen", val);
                }}
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "border-primary text-primary" : ""}
                data-testid="button-toggle-auto-refresh"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ml-1 ${autoRefresh ? "animate-spin" : ""}`}
                />
                {autoRefresh ? tc("تلقائي", "Auto") : tc("يدوي", "Manual")}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="all" data-testid="tab-all">
              {tc("الكل", "All")} ({totalActiveOrders})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              {tc("انتظار", "Waiting")} (
              {pendingOrders.length + needsPrepNowOrders.length})
            </TabsTrigger>
            <TabsTrigger value="preparing" data-testid="tab-preparing">
              {tc("تحضير", "Preparing")} ({preparingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="ready" data-testid="tab-ready">
              {tc("جاهز", "Ready")} ({readyOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="delayed"
              data-testid="tab-delayed"
              className={delayedCount > 0 ? "text-destructive" : ""}
            >
              {tc("متأخر", "Delayed")} ({delayedCount})
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              data-testid="tab-scheduled"
              className={
                needsPrepNowOrders.length > 0
                  ? "text-orange-500 font-bold"
                  : scheduledOrders.length > 0
                  ? "text-blue-500"
                  : ""
              }
            >
              {tc("مجدول", "Sched.")} (
              {scheduledOrders.length + needsPrepNowOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              data-testid="tab-completed"
              className="text-muted-foreground"
            >
              <History className="h-3.5 w-3.5 ml-1" />
              {tc("مكتمل", "Done")} ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {getFilteredOrders().length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {tc("لا توجد طلبات", "No Orders")}
                </h3>
                <p className="text-muted-foreground">
                  {activeTab === "all"
                    ? tc("لا توجد طلبات نشطة حالياً", "No active orders at the moment")
                    : activeTab === "completed"
                    ? tc("لا توجد طلبات مكتملة بعد", "No completed orders yet")
                    : tc("لا توجد طلبات في هذه الحالة", "No orders in this state")}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {getFilteredOrders()
                  .sort(
                    (a, b) =>
                      new Date(a.createdAt).getTime() -
                      new Date(b.createdAt).getTime()
                  )
                  .map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      variant="kds"
                      showTimer={true}
                      showActions={true}
                      onStartPreparing={handleStartPreparing}
                      onMarkReady={handleMarkReady}
                      onMarkCompleted={handleMarkCompleted}
                      onUpdateTime={handleUpdateTime}
                      isPending={
                        updateStatusMutation.isPending ||
                        updateTimeMutation.isPending
                      }
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <MobileBottomNav />
    </div>
  );
}
