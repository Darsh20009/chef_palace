import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CheckCircle, ChefHat, Truck, XCircle, User, MapPin, Volume2, VolumeX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { playNotificationSound, getSoundEnabled, setSoundEnabled as saveSoundEnabled } from "@/lib/notification-sounds";
import { AudioUnlockBanner } from "@/components/audio-unlock-banner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import SarIcon from "@/components/sar-icon";

interface Employee {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface IOrder {
  id: string;
  orderNumber: string;
  items: any[];
  totalAmount: number;
  status: string;
  tableStatus?: string;
  tableNumber?: string;
  branchId?: string;
  branchName?: string;
  assignedCashierId?: string;
  customerInfo?: {
    customerName: string;
    name?: string;
    phone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface IBranch {
  id: string;
  nameAr: string;
}

export default function CashierTableOrders() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundEnabled('cashier-tables'));
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const parsed = JSON.parse(storedEmployee);
      setEmployee(parsed);
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  // Fetch unassigned orders
  const { data: unassignedOrders } = useQuery<IOrder[]>({
    queryKey: ["/api/orders/table/unassigned"],
    refetchInterval: 15000,
    enabled: !!employee,
  });

  // Notify when new orders arrive with sound
  useEffect(() => {
    if (unassignedOrders && unassignedOrders.length > 0) {
      const currentOrderIds = new Set(unassignedOrders.map(order => order.id));
      
      // Find truly new orders (IDs that weren't in previous set)
      const newOrderIds = [...currentOrderIds].filter(id => !previousOrderIdsRef.current.has(id));
      
      if (newOrderIds.length > 0 && previousOrderIdsRef.current.size > 0) {
        // Check if any new orders are online (from customer website)
        const newOrders = unassignedOrders.filter((o: any) => newOrderIds.includes(o.id));
        const hasOnlineOrder = newOrders.some((o: any) =>
          o.channel === 'online' || o.channel === 'web' || o.orderType === 'online' || !o.channel
        );

        if (soundEnabled) {
          if (hasOnlineOrder) {
            playNotificationSound('cashierOrder', 0.8);
          } else {
            playNotificationSound('newOrder', 0.6);
          }
        }
        
        toast({
          title: hasOnlineOrder ? `🌐 طلب جديد أونلاين` : `طلب جديد من الطاولة`,
          description: `لديك ${newOrderIds.length} ${newOrderIds.length === 1 ? 'طلب جديد' : 'طلبات جديدة'}`,
          duration: 6000,
          className: hasOnlineOrder ? "bg-violet-600 text-white border-violet-700" : "bg-green-600 text-white border-green-700",
        });
      }
      
      // Update the ref with current order IDs
      previousOrderIdsRef.current = currentOrderIds;
    }
  }, [unassignedOrders, toast]);

  // Fetch branches
  const { data: branches = [] } = useQuery<IBranch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
  });

  // Fetch cashier's assigned orders
  const { data: myOrders } = useQuery<IOrder[]>({
    queryKey: ["/api/cashier", employee?.id, "orders"],
    enabled: !!employee?.id,
    queryFn: async () => {
      const response = await fetch(`/api/cashier/${employee?.id}/orders`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    refetchInterval: 15000,
  });

  // Assign order to cashier mutation
  const assignOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!employee?.id) {
        throw new Error(tc("معرف الكاشير غير متاح. يرجى تسجيل الدخول مجدداً", "Cashier ID not available. Please log in again."));
      }
      const response = await fetch(`/api/orders/${orderId}/assign-cashier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ cashierId: employee.id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/table/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
      
      // Play success sound when accepting order
      if (soundEnabled) {
        playNotificationSound('success', 0.5);
      }
      
      toast({
        title: tc("تم استلام الطلب", "Order received"),
        description: tc("تم استلام الطلب بنجاح", "Order was received successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: getErrorMessage(error, tc("فشل تحديث الطلب", "Failed to update order")),
        variant: "destructive",
      });
    },
  });

  // Reject order mutation
  const rejectOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}/table-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ tableStatus: "cancelled" }),
      });
      if (!response.ok) throw new Error("Failed to reject order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/table/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
      toast({
        title: tc("تم رفض الطلب", "Order rejected"),
        description: tc("تم إلغاء الطلب بنجاح", "Order was cancelled successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل رفض الطلب", "Failed to reject order"),
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      if (!employee?.id) {
        throw new Error(tc("معرف الكاشير غير متاح. يرجى تسجيل الدخول مجدداً", "Cashier ID not available. Please log in again."));
      }
      const response = await fetch(`/api/orders/${orderId}/table-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ tableStatus: status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier", employee?.id, "orders"] });
      
      // Play different sounds based on status
      if (soundEnabled) {
        if (variables.status === 'delivered') {
          playNotificationSound('success', 0.5);
        } else {
          playNotificationSound('statusChange', 0.4);
        }
      }
      
      toast({
        title: tc("تم تحديث حالة الطلب", "Order status updated"),
        description: getStatusDescription(variables.status),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل تحديث حالة الطلب", "Failed to update order status"),
        variant: "destructive",
      });
    },
  });
  
  const getStatusDescription = (status: string) => {
    switch (status) {
      case "payment_confirmed":
        return tc("تم تأكيد الدفع", "Payment confirmed");
      case "preparing":
        return tc("الطلب قيد التحضير", "Order is being prepared");
      case "ready":
        return tc("الطلب جاهز للتقديم", "Order ready to serve");
      case "delivered":
        return tc("تم تقديم الطلب للعميل", "Order served to customer");
      case "cancelled":
        return tc("تم إلغاء الطلب", "Order cancelled");
      default:
        return tc("تم تحديث الحالة", "Status updated");
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">{tc("طلب جديد", "New Order")}</Badge>;
      case "payment_confirmed":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">{tc("تم الدفع", "Paid")}</Badge>;
      case "preparing":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{tc("قيد التحضير", "Preparing")}</Badge>;
      case "ready":
        return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">{tc("جاهز للتقديم", "Ready")}</Badge>;
      case "delivering_to_table":
        return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">{tc("جاري التوصيل", "Delivering")}</Badge>;
      case "delivered":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">{tc("تم التقديم", "Served")}</Badge>;
      case "cancelled":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white">{tc("ملغي", "Cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{tc("غير معروف", "Unknown")}</Badge>;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "pending":
        return Clock;
      case "payment_confirmed":
        return CheckCircle;
      case "preparing":
        return ChefHat;
      case "ready":
        return CheckCircle;
      case "delivering_to_table":
        return Truck;
      case "delivered":
        return CheckCircle;
      case "cancelled":
        return XCircle;
      default:
        return Clock;
    }
  };

  // No branch filtering needed here
  const filteredUnassignedOrders = unassignedOrders || [];
  const filteredMyOrders = myOrders || [];

  return (
    <div className="min-h-screen p-4 pb-20 sm:pb-4 bg-background" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-accent">{tc("إدارة طلبات الطاولات", "Table Orders")}</h1>
            <p className="text-gray-400">
              {tc("مرحباً", "Welcome")} {employee?.fullName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AudioUnlockBanner
              pageKey="cashier-tables"
              soundEnabled={soundEnabled}
              onToggleSound={(val) => { setSoundEnabled(val); saveSoundEnabled('cashier-tables', val); }}
              compact
            />
            <Button variant="outline" className="bg-gray-800" onClick={() => setLocation("/employee/home")}>
              {tc("العودة للوحة التحكم", "Back to Dashboard")}
            </Button>
          </div>
        </div>


        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              {tc("طلبات جديدة", "New Orders")} ({filteredUnassignedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="my-orders">
              {tc("طلباتي", "My Orders")} ({filteredMyOrders.filter(o => o.tableStatus !== 'delivered' && o.tableStatus !== 'cancelled').length})
            </TabsTrigger>
            <TabsTrigger value="tables">
              {tc("إدارة الطاولات", "Table Management")}
            </TabsTrigger>
          </TabsList>

          {/* Unassigned Orders */}
          <TabsContent value="pending">
            <Card className="border-primary/20 bg-card">
              <CardHeader>
                <CardTitle className="text-accent text-right">{tc("الطلبات الجديدة", "New Orders")}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredUnassignedOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {tc("لا توجد طلبات جديدة", "No new orders")}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredUnassignedOrders.map((order) => {
                      const StatusIcon = getStatusIcon(order.tableStatus);
                      const branch = branches.find(b => b.id === order.branchId);
                      return (
                        <Card key={order.id} className="bg-gray-900 border-primary/10">
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                {branch && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="w-4 h-4 text-accent" />
                                    <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                                      {branch.nameAr}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <StatusIcon className="w-5 h-5" />
                                  <h3 className="font-bold text-lg">
                                    {tc("طاولة", "Table")} {order.tableNumber}
                                  </h3>
                                  {getStatusBadge(order.tableStatus)}
                                </div>
                                {order.customerInfo && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <User className="w-4 h-4" />
                                    <span>{order.customerInfo.customerName || order.customerInfo.name}</span>
                                  </div>
                                )}
                                <div className="text-sm">
                                  <span className="font-medium">العناصر:</span>{" "}
                                  {Array.isArray(order.items) ? order.items.map((item: any) => `${item.nameAr} (${item.quantity})`).join(", ") : tc("لا توجد عناصر", "No items")}
                                </div>
                                <div className="font-bold text-lg">
                                  {order.totalAmount.toFixed(2)} <SarIcon />
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                  onClick={() => assignOrderMutation.mutate(order.id)}
                                  disabled={assignOrderMutation.isPending || rejectOrderMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                  data-testid={`button-accept-${order.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 ml-1" />
                                  {tc("قبول", "Accept")}
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(`${tc("هل أنت متأكد من رفض طلب الطاولة", "Are you sure you want to reject the order for table")} ${order.tableNumber}?`)) {
                                      rejectOrderMutation.mutate(order.id);
                                    }
                                  }}
                                  disabled={assignOrderMutation.isPending || rejectOrderMutation.isPending}
                                  data-testid={`button-reject-${order.id}`}
                                >
                                  <XCircle className="w-4 h-4 ml-1" />
                                  {tc("رفض", "Reject")}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Orders */}
          <TabsContent value="my-orders">
            <Card className="border-primary/20 bg-card">
              <CardHeader>
                <CardTitle className="text-accent text-right">{tc("طلباتي", "My Orders")}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredMyOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {tc("لا توجد طلبات مستلمة", "No received orders")}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMyOrders.map((order) => {
                      const StatusIcon = getStatusIcon(order.tableStatus);
                      return (
                        <Card key={order.id} className="bg-gray-900 border-primary/10">
                          <CardContent className="p-4">
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className="w-5 h-5" />
                                    <h3 className="font-bold text-lg">
                                      {tc("طاولة", "Table")} {order.tableNumber}
                                    </h3>
                                    {getStatusBadge(order.tableStatus)}
                                  </div>
                                  {order.customerInfo && (
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                      <User className="w-4 h-4" />
                                      <span>{order.customerInfo.customerName || order.customerInfo.name}</span>
                                    </div>
                                  )}
                                  <div className="text-sm text-white">
                                    <span className="font-medium">{tc("العناصر:", "Items:")}</span>{" "}
                                    {Array.isArray(order.items) ? order.items.map((item: any) => `${item.nameAr} (${item.quantity})`).join(", ") : tc("لا توجد عناصر", "No items")}
                                  </div>
                                  <div className="font-bold text-lg text-accent">
                                    {order.totalAmount.toFixed(2)} <SarIcon />
                                  </div>
                                </div>
                              </div>

                              {/* Status Controls */}
                              {order.tableStatus !== "delivered" && order.tableStatus !== "cancelled" && (
                                <div className="border-t border-primary/20 pt-4 space-y-3">
                                  <div>
                                    <Label className="text-accent text-sm mb-2 block">{tc("تحديث حالة الطلب:", "Update order status:")}</Label>
                                    <Select
                                      value={order.tableStatus}
                                      onValueChange={(value) =>
                                        updateStatusMutation.mutate({
                                          orderId: order.id,
                                          status: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger data-testid={`select-status-${order.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="payment_confirmed">
                                          {tc("تم تأكيد الدفع", "Payment Confirmed")}
                                        </SelectItem>
                                        <SelectItem value="preparing">{tc("قيد التحضير", "Preparing")}</SelectItem>
                                        <SelectItem value="ready">{tc("جاهز للتقديم", "Ready to Serve")}</SelectItem>
                                        <SelectItem value="delivered">{tc("تم التقديم", "Served")}</SelectItem>
                                        <SelectItem value="cancelled">{tc("إلغاء", "Cancel")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm(`${tc("هل أنت متأكد من رفض طلب الطاولة", "Are you sure you want to reject the order for table")} ${order.tableNumber}?`)) {
                                          rejectOrderMutation.mutate(order.id);
                                        }
                                      }}
                                      disabled={rejectOrderMutation.isPending}
                                      data-testid={`button-reject-order-${order.id}`}
                                    >
                                      {tc("رفض الطلب", "Reject Order")}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Management */}
          <TabsContent value="tables">
            <Card className="border-primary/20 bg-card">
              <CardHeader>
                <CardTitle className="text-accent text-right">{tc("إدارة الطاولات", "Table Management")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">
                    {tc("لإدارة الطاولات، يرجى الذهاب إلى لوحة تحكم المدير", "To manage tables, please go to the manager dashboard")}
                  </p>
                  <Button onClick={() => setLocation("/manager/tables")}>
                    {tc("الذهاب إلى إدارة الطاولات", "Go to Table Management")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <MobileBottomNav employeeRole={employee?.role} />
    </div>
  );
}
