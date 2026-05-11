import { useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Truck,
  AlertCircle,
} from "lucide-react";
import SarIcon from "@/components/sar-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslate } from "@/lib/useTranslate";

interface IOrder {
  id: string;
  orderNumber: string;
  items: any[];
  totalAmount: number;
  status: string;
  tableStatus?: string;
  tableNumber?: string;
  customerInfo?: {
    customerName: string;
    phone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export default function TableOrderTracking() {
  const [match, params] = useRoute("/table-order-tracking/:orderId");
  const { toast } = useToast();
  const tc = useTranslate();
  const orderId = params?.orderId;
  const previousStatusRef = useRef<string | undefined>(undefined);

  const { data: order, isLoading } = useQuery<IOrder>({
    queryKey: ["/api/orders", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error(tc("الطلب غير موجود", "Order not found"));
      const data = await response.json();

      if (data.items && typeof data.items === 'string') {
        try {
          data.items = JSON.parse(data.items);
        } catch (e) {
          console.error("Error parsing order items:", e);
          data.items = [];
        }
      }

      if (!Array.isArray(data.items)) {
        data.items = [];
      }

      return data;
    },
    enabled: !!orderId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    const currentStatus = order?.tableStatus || order?.status;

    if (order && currentStatus && previousStatusRef.current && previousStatusRef.current !== currentStatus) {
      const statusMessages: Record<string, string> = {
        'payment_confirmed': tc('تم تأكيد الدفع', 'Payment Confirmed'),
        'preparing': tc('جاري تحضير طلبك', 'Your order is being prepared'),
        'ready': tc('طلبك جاهز', 'Your order is ready'),
        'delivering_to_table': tc('طلبك في الطريق', 'Your order is on the way'),
        'delivered': tc('تم توصيل طلبك', 'Your order has been delivered'),
      };

      const message = statusMessages[currentStatus] || tc('تم تحديث حالة طلبك', 'Your order status has been updated');

      toast({
        title: tc('تحديث حالة الطلب', 'Order Status Update'),
        description: message,
        duration: 6000,
        className: "bg-blue-600 text-white border-blue-700",
      });
    }

    if (order && currentStatus) {
      previousStatusRef.current = currentStatus;
    }
  }, [order, toast, tc]);

  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}/cancel-by-customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationReason: tc("طلب الإلغاء من العميل", "Customer requested cancellation"),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || tc("فشل في إلغاء الطلب", "Failed to cancel order"));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
      toast({
        title: tc("تم إلغاء الطلب", "Order Cancelled"),
        description: tc("تم إلغاء طلبك بنجاح", "Your order has been cancelled successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل إلغاء الطلب", "Failed to cancel order"),
        variant: "destructive",
      });
    },
  });

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          label: tc("في الانتظار", "Pending"),
          description: tc("طلبك في انتظار استلام الكاشير", "Your order is waiting to be received by the cashier"),
          color: "text-yellow-500",
        };
      case "payment_confirmed":
        return {
          icon: CheckCircle,
          label: tc("تم تأكيد الدفع", "Payment Confirmed"),
          description: tc("تم استلام طلبك وسيتم تحضيره قريباً", "Your order has been received and will be prepared soon"),
          color: "text-blue-500",
        };
      case "preparing":
        return {
          icon: ChefHat,
          label: tc("قيد التحضير", "Preparing"),
          description: tc("طلبك قيد التحضير الآن", "Your order is being prepared now"),
          color: "text-orange-500",
        };
      case "ready":
        return {
          icon: CheckCircle,
          label: tc("جاهز للتقديم", "Ready to Serve"),
          description: tc("طلبك جاهز والآن يتم تقديمه لك", "Your order is ready and is being served"),
          color: "text-green-500",
        };
      case "delivered":
        return {
          icon: CheckCircle,
          label: tc("تم التقديم", "Served"),
          description: tc("تم تقديم طلبك بنجاح", "Your order has been served successfully"),
          color: "text-green-500",
        };
      case "delivering_to_table":
        return {
          icon: Truck,
          label: tc("جاري التوصيل", "On the Way"),
          description: tc("طلبك في الطريق إلى طاولتك", "Your order is on its way to your table"),
          color: "text-purple-500",
        };
      case "cancelled":
        return {
          icon: XCircle,
          label: tc("ملغي", "Cancelled"),
          description: tc("تم إلغاء الطلب", "Order has been cancelled"),
          color: "text-red-500",
        };
      default:
        return {
          icon: AlertCircle,
          label: tc("غير معروف", "Unknown"),
          description: tc("حالة الطلب غير معروفة", "Order status is unknown"),
          color: "text-gray-500",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-lg">{tc("جاري التحميل...", "Loading...")}</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{tc("طلب غير موجود", "Order Not Found")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{tc("عذراً، لم نتمكن من العثور على هذا الطلب.", "Sorry, we couldn't find this order.")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = order.tableStatus || order.status;
  const statusInfo = getStatusInfo(currentStatus);
  const StatusIcon = statusInfo.icon;
  const canCancel = currentStatus === "pending";

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{tc("تتبع الطلب", "Track Order")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {tc("رقم الطلب:", "Order #:")} {order.orderNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tc("طاولة:", "Table:")} {order.tableNumber}
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {order.totalAmount.toFixed(2)} <SarIcon />
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted ${statusInfo.color}`}>
                <StatusIcon className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{statusInfo.label}</h2>
                <p className="text-muted-foreground">{statusInfo.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tc("تفاصيل الطلب", "Order Details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order && Array.isArray(order.items) && order.items.length > 0 ? (
                <>
                  {order.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.nameAr}</p>
                        <p className="text-sm text-muted-foreground">
                          {tc("الكمية:", "Qty:")} {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold">
                        {(item.price * item.quantity).toFixed(2)} <SarIcon />
                      </p>
                    </div>
                  ))}
                  <div className="border-t pt-3 flex justify-between items-center font-bold text-lg">
                    <span>{tc("الإجمالي", "Total")}</span>
                    <span>{order.totalAmount.toFixed(2)} <SarIcon /></span>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground">{tc("جاري تحميل تفاصيل الطلب...", "Loading order details...")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {order.customerInfo && (
          <Card>
            <CardHeader>
              <CardTitle>{tc("معلومات العميل", "Customer Info")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{order.customerInfo.customerName}</p>
              {order.customerInfo.phone && order.customerInfo.phone !== "guest" && (
                <p className="text-sm text-muted-foreground">
                  {tc("الهاتف:", "Phone:")} {order.customerInfo.phone}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                data-testid="button-cancel-order"
              >
                <XCircle className="w-4 h-4 ml-2" />
                {tc("إلغاء الطلب", "Cancel Order")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>{tc("هل أنت متأكد؟", "Are you sure?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tc("هل تريد حقاً إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.", "Do you really want to cancel this order? This action cannot be undone.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("رجوع", "Back")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => cancelOrderMutation.mutate()}
                  disabled={cancelOrderMutation.isPending}
                >
                  {tc("تأكيد الإلغاء", "Confirm Cancellation")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div className="text-center text-sm text-muted-foreground">
          {tc("يتم تحديث حالة الطلب تلقائياً", "Order status updates automatically")}
        </div>
      </div>
    </div>
  );
}
