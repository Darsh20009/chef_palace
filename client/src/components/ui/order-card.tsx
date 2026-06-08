import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, DeliveryTypeBadge, TimerBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { Play, Check, CheckCircle, Printer, Clock, Coffee, MapPin, User, AlertTriangle, Flame, Timer, UtensilsCrossed, Car, ShoppingBag, Bell } from "lucide-react";
import { PrepCountdown } from "@/components/PrepCountdown";

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
    prepTimeMinutes?: number;
    station?: string;
    allergens?: string[];
  };
}

interface OrderCardProps {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    tableStatus?: string;
    items: OrderItem[];
    createdAt: string;
    updatedAt?: string;
    tableNumber?: string;
    orderType?: string;
    deliveryType?: 'pickup' | 'delivery' | 'dine-in' | 'car-pickup' | 'car_pickup' | 'curbside';
    carInfo?: {
      carType: string;
      carColor: string;
      plateNumber: string;
    };
    arrivalTime?: string;
    scheduledPickupTime?: string;
    preparationHoldUntil?: string;
    customerNotes?: string;
    customerName?: string;
    carType?: string;
    carColor?: string;
    carPlate?: string;
    plateNumber?: string;
    customerArrived?: boolean;
    customerArrivedAt?: string;
    branchId?: string;
    estimatedPrepTimeMinutes?: number;
    estimatedPrepTimeInMinutes?: number;
    prepStartedAt?: string;
    prepTimeSetAt?: string;
    priority?: 'normal' | 'rush' | 'vip';
  };
  variant?: "compact" | "detailed" | "kds";
  showActions?: boolean;
  showTimer?: boolean;
  onStartPreparing?: (id: string, estimatedPrepTime?: number) => void;
  onMarkReady?: (id: string) => void;
  onMarkCompleted?: (id: string) => void;
  onUpdateTime?: (id: string, additionalMinutes: number) => void;
  onPrint?: (id: string) => void;
  isPending?: boolean;
  className?: string;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function getElapsedMinutes(dateString: string): number {
  const created = new Date(dateString).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60));
}

function getSizeAr(size: string): string {
  const sizes: Record<string, string> = {
    small: "صغير",
    medium: "وسط",
    large: "كبير",
  };
  return sizes[size] || size;
}

function getStationAr(station?: string): string {
  const stations: Record<string, string> = {
    barista: "باريستا",
    kitchen: "المطبخ",
    cold: "المشروبات الباردة",
    hot: "المشروبات الساخنة",
    food: "الطعام",
    desserts: "الحلويات",
  };
  return station ? stations[station] || station : "";
}

function calculateTotalPrepTime(items: OrderItem[]): number {
  return items.reduce((total, item) => {
    const itemPrepTime = item.coffeeItem?.prepTimeMinutes || 3;
    return total + (itemPrepTime * item.quantity);
  }, 0);
}

function getMinutesUntilPrepStart(preparationHoldUntil?: string): number | null {
  if (!preparationHoldUntil) return null;
  const holdDate = new Date(preparationHoldUntil).getTime();
  const now = Date.now();
  return Math.ceil((holdDate - now) / (1000 * 60));
}

function getPrepTimeRemaining(order: { prepStartedAt?: string; estimatedPrepTimeMinutes?: number }): number | null {
  if (!order.prepStartedAt || !order.estimatedPrepTimeMinutes) return null;
  const startTime = new Date(order.prepStartedAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - startTime) / (1000 * 60);
  return Math.ceil(order.estimatedPrepTimeMinutes - elapsedMinutes);
}

function getSlaStatus(elapsedMinutes: number, estimatedPrepTime?: number): 'on-track' | 'warning' | 'overdue' {
  const targetTime = estimatedPrepTime || 10;
  if (elapsedMinutes >= targetTime) return 'overdue';
  if (elapsedMinutes >= targetTime * 0.7) return 'warning';
  return 'on-track';
}

function getUniqueStations(items: OrderItem[]): string[] {
  const stations = items
    .map(item => item.coffeeItem?.station || item.coffeeItem?.category)
    .filter((station): station is string => !!station && station !== 'general')
    .filter((v, i, a) => a.indexOf(v) === i);
  return stations;
}

function hasAllergens(items: OrderItem[]): boolean {
  return items.some(item => item.coffeeItem?.allergens && item.coffeeItem.allergens.length > 0);
}

function getAllAllergens(items: OrderItem[]): string[] {
  const allergens: string[] = [];
  items.forEach(item => {
    if (item.coffeeItem?.allergens) {
      item.coffeeItem.allergens.forEach(a => {
        if (!allergens.includes(a)) allergens.push(a);
      });
    }
  });
  return allergens;
}

export function OrderCard({
  order,
  variant = "detailed",
  showActions = true,
  showTimer = true,
  onStartPreparing,
  onMarkReady,
  onMarkCompleted,
  onUpdateTime,
  onPrint,
  isPending = false,
  className,
}: OrderCardProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMinutes = getElapsedMinutes(order.createdAt);
  void tick;
  const isDelayed = elapsedMinutes >= 10;
  const isWarning = elapsedMinutes >= 5 && !isDelayed;
  const displayStatus = order.tableStatus || order.status;
  
  const displayOrderNumber = order.orderNumber;

  const cardBorderClass = isDelayed 
    ? "border-red-500/50" 
    : isWarning 
    ? "border-amber-500/50" 
    : "";

  if (variant === "compact") {
    return (
      <Card className={cn("p-3", cardBorderClass, className)} data-testid={`card-order-${order.id}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono" data-testid="text-order-number">
              #{displayOrderNumber}
            </span>
            <StatusBadge status={displayStatus} size="sm" />
          </div>
          {showTimer && <TimerBadge minutes={elapsedMinutes} />}
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          {order.items.length} عنصر
        </div>
      </Card>
    );
  }

  if (variant === "kds") {
    const effectivePrepMins = order.estimatedPrepTimeMinutes || order.estimatedPrepTimeInMinutes;
    const effectivePrepStart = order.prepStartedAt || order.prepTimeSetAt;
    const hasPrepMetadata = !!(effectivePrepMins || effectivePrepStart);
    const slaStatus = hasPrepMetadata 
      ? getSlaStatus(elapsedMinutes, effectivePrepMins) 
      : (isDelayed ? 'overdue' : isWarning ? 'warning' : 'on-track');
    const prepTimeRemaining = hasPrepMetadata ? getPrepTimeRemaining({ prepStartedAt: effectivePrepStart, estimatedPrepTimeMinutes: effectivePrepMins }) : null;
    const stations = getUniqueStations(order.items);
    const orderHasAllergens = hasAllergens(order.items);
    const allergensList = getAllAllergens(order.items);
    const estimatedTime = calculateTotalPrepTime(order.items);
    const minutesUntilPrepStart = getMinutesUntilPrepStart(order.preparationHoldUntil);
    const isScheduledPickup = !!(order.scheduledPickupTime);
    const isOnHold = isScheduledPickup && minutesUntilPrepStart !== null && minutesUntilPrepStart > 0;
    const isPrepStarting = isScheduledPickup && minutesUntilPrepStart !== null && minutesUntilPrepStart <= 0;
    
    const slaBorderClass = isOnHold
      ? "border-blue-500 border-2"
      : isPrepStarting
      ? "border-orange-500 border-2 animate-pulse"
      : slaStatus === 'overdue' 
      ? "border-red-500 border-2" 
      : slaStatus === 'warning' 
      ? "border-amber-500 border-2" 
      : cardBorderClass;

    return (
      <Card className={cn("flex flex-col h-full", slaBorderClass, className)} data-testid={`card-order-kds-${order.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold font-mono text-primary" data-testid="text-order-number-kds">
                #{displayOrderNumber}
              </span>
              {order.priority === 'rush' && (
                <Badge className="bg-red-500 text-white animate-pulse">
                  <Flame className="h-3 w-3 ml-1" />
                  مستعجل
                </Badge>
              )}
              {order.priority === 'vip' && (
                <Badge className="bg-amber-500 text-black">VIP</Badge>
              )}
              {order.deliveryType && (
                <DeliveryTypeBadge type={order.deliveryType} size="sm" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={displayStatus} size="sm" />
              {showTimer && <TimerBadge minutes={elapsedMinutes} />}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {order.tableNumber && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>طاولة {order.tableNumber}</span>
              </div>
            )}
            {(order.orderType === 'car-pickup' || order.orderType === 'car_pickup' || order.deliveryType === 'car_pickup' || order.deliveryType === 'car-pickup' || order.deliveryType === 'curbside') && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 font-bold">
                  <Car className="h-3.5 w-3.5" />
                  <span>استلام من السيارة</span>
                  {order.customerArrived && (
                    <span className="mr-1 px-1.5 py-0.5 rounded text-xs bg-green-500 text-white animate-pulse">🚗 وصل</span>
                  )}
                </div>
                {(order.carType || order.carColor || order.carInfo?.carType) && (
                  <div className="flex items-center gap-2 text-xs bg-purple-500/10 rounded p-1.5 border border-purple-500/20">
                    <span className="font-medium">{order.carInfo?.carType || order.carType}</span>
                    <span>{order.carInfo?.carColor || order.carColor}</span>
                    <span className="font-mono font-bold">{order.carInfo?.plateNumber || order.plateNumber || order.carPlate}</span>
                  </div>
                )}
              </div>
            )}
            {stations.length > 0 && (
              <div className="flex items-center gap-1">
                {stations.map((station, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    <UtensilsCrossed className="h-3 w-3 ml-1" />
                    {getStationAr(station) || station}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>~{estimatedTime} د</span>
            </div>
          </div>
          
          {orderHasAllergens && (
            <div className="flex items-center gap-1 mt-2 p-1.5 rounded bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-red-600 font-medium">تنبيه: {allergensList.join(", ")}</span>
            </div>
          )}

          {isScheduledPickup && (
            <div className={cn(
              "flex flex-col gap-1 mt-2 p-2 rounded border text-xs",
              isOnHold
                ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                : isPrepStarting
                ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300"
                : "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300"
            )}>
              <div className="flex items-center gap-1.5 font-bold">
                {isOnHold ? (
                  <><ShoppingBag className="h-3.5 w-3.5" /> استلام مجدول - الطلب مُعلَّق</>
                ) : isPrepStarting ? (
                  <><Bell className="h-3.5 w-3.5 animate-bounce" /> حان وقت بدء التحضير الآن!</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> استلام مجدول</>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>وقت وصول العميل:</span>
                <span className="font-bold" dir="ltr">{order.scheduledPickupTime}</span>
              </div>
              {isOnHold && minutesUntilPrepStart !== null && (
                <div className="flex items-center justify-between">
                  <span>يبدأ التحضير بعد:</span>
                  <span className="font-bold">{minutesUntilPrepStart} دقيقة</span>
                </div>
              )}
              {isPrepStarting && (
                <div className="text-center font-bold text-sm animate-pulse">ابدأ التحضير الآن!</div>
              )}
            </div>
          )}
          
          {(order.estimatedPrepTimeInMinutes || order.estimatedPrepTimeMinutes) && (
            <div className="mt-2">
              <PrepCountdown
                estimatedPrepTimeInMinutes={order.estimatedPrepTimeInMinutes || order.estimatedPrepTimeMinutes}
                prepTimeSetAt={order.prepTimeSetAt || order.prepStartedAt || order.createdAt}
                status={displayStatus}
                compact={false}
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 pb-2">
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div 
                key={index} 
                className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                data-testid={`item-order-${order.id}-${index}`}
              >
                <Coffee className="h-4 w-4 mt-0.5 text-primary" />
                <div className="flex-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {item.coffeeItem?.nameAr || item.coffeeItemId}
                    </span>
                    <span className="text-muted-foreground">x{item.quantity}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getSizeAr(item.size)}
                    {item.extras && item.extras.length > 0 && (
                      <span className="mr-2">+ {item.extras.join(", ")}</span>
                    )}
                  </div>
                  {item.notes && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ملاحظة: {item.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {order.customerNotes && (
            <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {order.customerNotes}
              </p>
            </div>
          )}

          {(order.deliveryType === 'car-pickup' || order.deliveryType === 'car_pickup' || order.deliveryType === 'curbside') && (order.carInfo || order.carType) && (
            <div className="mt-3 p-3 rounded-md bg-blue-500/10 border border-blue-500/20 space-y-1">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                بيانات الاستلام من السيارة:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-blue-600 dark:text-blue-400">
                {order.carInfo?.carType || order.carType ? <span>النوع: {order.carInfo?.carType || order.carType}</span> : null}
                {order.carInfo?.carColor || order.carColor ? <span>اللون: {order.carInfo?.carColor || order.carColor}</span> : null}
                {order.carInfo?.plateNumber || order.plateNumber || order.carPlate ? <span className="col-span-2 font-bold">اللوحة: {order.carInfo?.plateNumber || order.plateNumber || order.carPlate}</span> : null}
                {order.arrivalTime && <span className="col-span-2 text-primary">موعد الوصول: {order.arrivalTime}</span>}
              </div>
            </div>
          )}

          {order.deliveryType === 'dine-in' && order.tableNumber && (
            <div className="mt-3 p-2 rounded-md bg-green-500/10 border border-green-500/20 space-y-1">
              <p className="text-xs font-bold text-green-700 dark:text-green-300 flex items-center gap-1">
                <UtensilsCrossed className="h-3 w-3" />
                جلوس في الكافيه:
              </p>
              <div className="text-[10px] text-green-600 dark:text-green-400">
                <span>طاولة رقم: {order.tableNumber}</span>
                {order.arrivalTime && <span className="mr-3">موعد الوصول: {order.arrivalTime}</span>}
              </div>
            </div>
          )}
        </CardContent>

        {showActions && (
          <CardFooter className="pt-2 gap-2">
            {(displayStatus === "confirmed" || displayStatus === "pending" || displayStatus === "payment_confirmed") && onStartPreparing && (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                  {[5, 10, 15, 20, 30].map((mins) => (
                    <Button
                      key={mins}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2 min-w-fit"
                      onClick={() => onStartPreparing(order.id, mins)}
                    >
                      {mins} د
                    </Button>
                  ))}
                </div>
                <Button 
                  onClick={() => onStartPreparing(order.id, 5)}
                  disabled={isPending}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid={`button-start-preparing-${order.orderNumber}`}
                >
                  <Play className="h-4 w-4 ml-2" />
                  بدء (5د)
                </Button>
              </div>
            )}
            {displayStatus === "in_progress" && (
              <div className="flex flex-col gap-2 w-full">
                {onUpdateTime && (
                  <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {[3, 5, 10, 15].map((mins) => (
                      <Button
                        key={mins}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2 min-w-fit border-blue-300 text-blue-600 hover:bg-blue-50"
                        onClick={() => onUpdateTime(order.id, mins)}
                        disabled={isPending}
                        data-testid={`button-add-time-${mins}-${order.orderNumber}`}
                      >
                        <Clock className="h-3 w-3 ml-1" />
                        +{mins} د
                      </Button>
                    ))}
                  </div>
                )}
                {onMarkReady && (
                  <Button 
                    onClick={() => onMarkReady(order.id)}
                    disabled={isPending}
                    className="flex-1 bg-green-500 hover:bg-green-600"
                    data-testid={`button-mark-ready-${order.orderNumber}`}
                  >
                    <Check className="h-4 w-4 ml-2" />
                    جاهز للتسليم
                  </Button>
                )}
              </div>
            )}
            {displayStatus === "ready" && onMarkCompleted && (
              <Button
                onClick={() => onMarkCompleted(order.id)}
                disabled={isPending}
                variant="outline"
                className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                data-testid={`button-mark-completed-${order.orderNumber}`}
              >
                <CheckCircle className="h-4 w-4 ml-2" />
                تم التسليم
              </Button>
            )}
            {onPrint && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => onPrint(order.id)}
                data-testid="button-print-order"
              >
                <Printer className="h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <Card className={cn(cardBorderClass, className)} data-testid={`card-order-${order.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono" data-testid="text-order-number">
              #{displayOrderNumber}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={displayStatus} />
            {order.deliveryType && (
              <DeliveryTypeBadge type={order.deliveryType} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(order.createdAt)}</span>
          </div>
          {order.tableNumber && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>طاولة {order.tableNumber}</span>
            </div>
          )}
          {order.customerName && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{order.customerName}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {item.coffeeItem?.nameAr || item.coffeeItemId}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({getSizeAr(item.size)})
                </span>
              </div>
              <span className="text-muted-foreground">x{item.quantity}</span>
            </div>
          ))}
        </div>
      </CardContent>

      {showActions && (
        <CardFooter className="pt-2 gap-2">
          {(displayStatus === "confirmed" || displayStatus === "pending" || displayStatus === "payment_confirmed") && onStartPreparing && (
            <Button 
              onClick={() => onStartPreparing(order.id)}
              disabled={isPending}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid={`button-start-preparing-${order.orderNumber}`}
            >
              <Play className="h-4 w-4 ml-2" />
              بدء التحضير
            </Button>
          )}
          {displayStatus === "in_progress" && onMarkReady && (
            <Button 
              onClick={() => onMarkReady(order.id)}
              disabled={isPending}
              className="flex-1 bg-green-500 hover:bg-green-600"
              data-testid={`button-mark-ready-${order.orderNumber}`}
            >
              <Check className="h-4 w-4 ml-2" />
              جاهز للتسليم
            </Button>
          )}
          {displayStatus === "ready" && onMarkCompleted && (
            <Button
              onClick={() => onMarkCompleted(order.id)}
              disabled={isPending}
              variant="outline"
              className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
              data-testid={`button-mark-completed-${order.orderNumber}`}
            >
              <CheckCircle className="h-4 w-4 ml-2" />
              تم التسليم
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
