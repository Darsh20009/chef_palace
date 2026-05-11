import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { useOrderWebSocket } from "@/lib/websocket";
import { 
  Coffee, 
  CheckCircle2, 
  Clock, 
  Loader2,
  RefreshCw,
  Store,
  MapPin,
  Truck,
  Bell,
  Maximize,
  Minimize,
  Wifi,
  WifiOff
} from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  itemCount: number;
  createdAt: string;
  orderType?: string;
  deliveryType?: 'pickup' | 'delivery' | 'dine-in';
}

const getLastThreeDigits = (orderNumber: string): string => {
  if (!orderNumber) return "0000";
  return orderNumber;
};

const getOrderTypeDisplay = (order: Order) => {
  const type = order.deliveryType || order.orderType;
  
  if (type === 'dine-in' || type === 'dine_in') {
    return { label: tc("محلي", "Dine-In"), icon: Store, color: "bg-green-500/20 text-green-400 border-green-500/50" };
  }
  if (type === 'pickup' || type === 'takeaway') {
    return { label: tc("سفري", "Takeaway"), icon: MapPin, color: "bg-primary/20 text-accent border-primary/50" };
  }
  if (type === 'delivery') {
    return { label: tc("توصيل", "Delivery"), icon: Truck, color: "bg-blue-500/20 text-blue-400 border-blue-500/50" };
  }
  return { label: tc("طلب", "Order"), icon: Coffee, color: "bg-muted text-muted-foreground border-border" };
};

function OrderCard({ order, isReady, isFullscreen }: { order: Order; isReady: boolean; isFullscreen: boolean }) {
  const tc = useTranslate();
  const orderType = getOrderTypeDisplay(order);
  const OrderIcon = orderType.icon;
  const lastThree = getLastThreeDigits(order.orderNumber);
  
  return (
    <Card 
      className={`relative overflow-visible transition-all duration-500 ${
        isReady 
          ? "border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20" 
          : "border-primary/30 bg-primary/5"
      } ${isReady ? "animate-pulse" : ""}`}
      data-testid={`order-card-${order.id}`}
    >
      <CardContent className={`text-center ${isFullscreen ? 'p-8' : 'p-6'}`}>
        <div 
          className={`font-bold mb-3 ${isFullscreen ? 'text-8xl' : 'text-6xl'}`} 
          style={{ fontFamily: 'monospace' }}
        >
          <span className={isReady ? "text-green-400" : "text-accent"}>
            {lastThree}
          </span>
        </div>
        
        <div className="flex items-center justify-center gap-2 mb-3">
          <Badge variant="outline" className={`${orderType.color} ${isFullscreen ? 'text-base px-4 py-1' : ''}`}>
            <OrderIcon className={`${isFullscreen ? 'h-5 w-5' : 'h-4 w-4'} ml-1`} />
            {orderType.label}
          </Badge>
        </div>
        
        <div className={`text-muted-foreground ${isFullscreen ? 'text-base' : 'text-sm'}`}>
          {order.itemCount || 0} عناصر
        </div>
        
        {isReady && (
          <div className="absolute -top-3 -right-3 z-10">
            <div className={`bg-green-500 rounded-full animate-bounce ${isFullscreen ? 'p-3' : 'p-2'}`}>
              <Bell className={`text-white ${isFullscreen ? 'h-6 w-6' : 'h-4 w-4'}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderStatusDisplayPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previousReadyIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef<boolean>(true);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: ordersData, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders/active-display"],
    queryFn: async () => {
      const res = await fetch("/api/orders/active-display");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 15000,
  });

  const handleOrderUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/active-display"] });
  }, []);

  const handleOrderReady = (order: Order) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders/active-display"] });
    // Sound alert removed as requested by user
  };

  const { isConnected } = useOrderWebSocket({
    clientType: "display",
    onOrderUpdated: handleOrderUpdated,
    onOrderReady: handleOrderReady,
    enabled: true,
  });

  const orders = ordersData || [];
  const inProgressOrders = orders.filter(o => o.status === "in_progress" || o.status === "preparing");
  const readyOrders = orders.filter(o => o.status === "ready");

  useEffect(() => {
    const currentReadyIds = new Set(readyOrders.map(o => o.id));
    
    if (isFirstLoadRef.current) {
      previousReadyIdsRef.current = currentReadyIds;
      isFirstLoadRef.current = false;
      return;
    }
    
    // Notifications disabled
    previousReadyIdsRef.current = currentReadyIds;
  }, [readyOrders]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        setIsFullscreen(false);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState message={tc("جاري تحميل الطلبات...", "Loading orders...")} />
      </div>
    );
  }

  return (
    <div dir="rtl" className={`min-h-screen bg-background ${isFullscreen ? 'p-8' : 'p-6'}`}>
      <div className={`mx-auto ${isFullscreen ? 'max-w-none' : 'max-w-7xl'}`}>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`bg-primary rounded-full flex items-center justify-center ${isFullscreen ? 'w-20 h-20' : 'w-14 h-14'}`}>
              <Coffee className={`text-primary-foreground ${isFullscreen ? 'w-10 h-10' : 'w-7 h-7'}`} />
            </div>
            <div>
              <h1 className={`font-bold text-foreground ${isFullscreen ? 'text-5xl' : 'text-3xl'}`}>
                حالة الطلبات
              </h1>
              <p className={`text-muted-foreground ${isFullscreen ? 'text-xl' : 'text-base'}`}>
                متابعة الطلبات الجارية والجاهزة
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <Badge 
              variant="outline" 
              className={isConnected ? "bg-green-500/10 text-green-500 border-green-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"}
              data-testid="badge-ws-status"
            >
              {isConnected ? <Wifi className="h-3 w-3 ml-1" /> : <WifiOff className="h-3 w-3 ml-1" />}
              {isConnected ? tc("متصل", "Connected") : tc("غير متصل", "Disconnected")}
            </Badge>

            <div className={`font-mono text-foreground ${isFullscreen ? 'text-4xl' : 'text-2xl'}`}>
              {currentTime.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            
            <Button
              variant="outline"
              size={isFullscreen ? "lg" : "icon"}
              onClick={toggleFullscreen}
              data-testid="button-toggle-fullscreen"
              aria-label={isFullscreen ? "إلغاء ملء الشاشة" : "ملء الشاشة"}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
            
            <Button
              variant="outline"
              size={isFullscreen ? "lg" : "icon"}
              onClick={() => refetch()}
              data-testid="button-refresh-orders"
              aria-label="تحديث الطلبات"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isFullscreen ? 'lg:grid-cols-2 gap-12' : 'lg:grid-cols-2 gap-8'}`}>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className={`bg-primary/20 rounded-full flex items-center justify-center ${isFullscreen ? 'w-14 h-14' : 'w-10 h-10'}`}>
                <Clock className={`text-accent ${isFullscreen ? 'h-7 w-7' : 'h-5 w-5'}`} />
              </div>
              <div>
                <h2 className={`font-bold text-accent ${isFullscreen ? 'text-3xl' : 'text-xl'}`}>
                  جاري التحضير
                </h2>
                <p className={`text-muted-foreground ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
                  {inProgressOrders.length} طلب
                </p>
              </div>
            </div>
            
            <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {inProgressOrders.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Loader2 className={`mx-auto mb-4 opacity-30 ${isFullscreen ? 'h-16 w-16' : 'h-12 w-12'}`} />
                  <p className={isFullscreen ? 'text-xl' : ''}>{tc("لا توجد طلبات قيد التحضير", "No orders in preparation")}</p>
                </div>
              ) : (
                inProgressOrders.map(order => (
                  <OrderCard key={order.id} order={order} isReady={false} isFullscreen={isFullscreen} />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className={`bg-green-500/20 rounded-full flex items-center justify-center ${isFullscreen ? 'w-14 h-14' : 'w-10 h-10'}`}>
                <CheckCircle2 className={`text-green-400 ${isFullscreen ? 'h-7 w-7' : 'h-5 w-5'}`} />
              </div>
              <div>
                <h2 className={`font-bold text-green-400 ${isFullscreen ? 'text-3xl' : 'text-xl'}`}>
                  جاهز للاستلام
                </h2>
                <p className={`text-muted-foreground ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
                  {readyOrders.length} طلب
                </p>
              </div>
            </div>
            
            <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {readyOrders.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <CheckCircle2 className={`mx-auto mb-4 opacity-30 ${isFullscreen ? 'h-16 w-16' : 'h-12 w-12'}`} />
                  <p className={isFullscreen ? 'text-xl' : ''}>{tc("لا توجد طلبات جاهزة", "No ready orders")}</p>
                </div>
              ) : (
                readyOrders.map(order => (
                  <OrderCard key={order.id} order={order} isReady={true} isFullscreen={isFullscreen} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className={`mt-8 text-center ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
          <p className="text-muted-foreground">
            يتم تحديث الشاشة تلقائياً كل 5 ثوانٍ
          </p>
        </div>
      </div>
    </div>
  );
}
