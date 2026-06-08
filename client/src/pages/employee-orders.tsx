import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Coffee, BellRing, RefreshCw, ArrowRight, Search, DollarSign, XCircle, Undo2, Clock, User, Phone, CreditCard, Banknote, CheckCircle, PlayCircle, Loader2, MapPin, Printer, Eye, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { ReceiptInvoice } from "@/components/receipt-invoice";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import SarIcon from "@/components/sar-icon";
import { useTranslate } from "@/lib/useTranslate";
import { PaymentReceiptDialog } from "@/components/PaymentReceiptDialog";
import { PrepCountdown } from "@/components/PrepCountdown";
import { playNotificationSound, initAudioUnlock, getSoundEnabled, setSoundEnabled } from "@/lib/notification-sounds";
import { AudioUnlockBanner } from "@/components/audio-unlock-banner";
import { getPaymentMethodLabel } from "@shared/order-states";

export default function EmployeeOrders() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(() => getSoundEnabled('employee-orders'));
  const prevPendingIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [changeAmount, setChangeAmount] = useState<number>(0);
  const [receiptDialogOrder, setReceiptDialogOrder] = useState<any>(null);

  const BANK_TRANSFER_METHODS = ['mada', 'rajhi', 'alinma', 'ur', 'barq', 'bank_transfer'];
  const GATEWAY_METHODS = ['paymob', 'paymob-card', 'paymob-wallet', 'paymob-apple-pay', 'geidea', 'apple_pay', 'neoleap', 'neoleap-apple-pay'];

  const getPaymentLabel = (method: string) => {
    const m = (method || '').toLowerCase();
    // Use shared canonical helper for label text; resolve icon locally
    const label = getPaymentMethodLabel(method, tc('ar', 'en') === 'en' ? 'en' : 'ar');
    if (m === 'cash') return { label, icon: Banknote };
    if (m === 'bank_transfer' || m === 'rajhi' || m === 'alinma' || m === 'ur' || m === 'barq')
      return { label, icon: Building2 };
    return { label, icon: CreditCard };
  };

  const isPaymentConfirmed = (order: any) =>
    order.paymentStatus === 'paid' ||
    ['payment_confirmed', 'confirmed', 'in_progress', 'ready', 'delivered', 'received', 'completed'].includes(order.status);

  useEffect(() => {
    const stored = localStorage.getItem("currentEmployee");
    if (stored) {
      setEmployee(JSON.parse(stored));
    }
    initAudioUnlock();
  }, [setLocation]);

  const { data: orders = [], refetch, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/orders", "management"],
    queryFn: async () => {
      const res = await fetch("/api/orders?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
    retry: 2,
    staleTime: 4000,
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const currentPendingIds = new Set(
      orders.filter((o: any) => o.status === "pending").map((o: any) => o._id || o.id)
    );
    if (isFirstLoadRef.current) {
      prevPendingIdsRef.current = currentPendingIds;
      isFirstLoadRef.current = false;
      return;
    }
    let hasNew = false;
    currentPendingIds.forEach((id) => {
      if (!prevPendingIdsRef.current.has(id)) hasNew = true;
    });
    if (hasNew) {
      playNotificationSound('newOrder', 0.9).catch(() => {});
      toast({ title: "🔔 طلب جديد!", description: "وصل طلب جديد يحتاج تأكيداً", duration: 4000 });
    }
    prevPendingIdsRef.current = currentPendingIds;
  }, [orders]);

  const handlePrint = (order: any) => {
    setCurrentOrder(order);
    setShowPrintDialog(true);
  };

  const completeAllOrdersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/orders/complete-all");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: `تم إكمال ${data.modifiedCount || data.count || 0} طلب بنجاح` });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إكمال الطلبات", variant: "destructive" });
    }
  });

  const cancelAllOrdersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/orders/cancel-all", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: `تم إلغاء ${data.count || 0} طلب مفتوح بنجاح` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل إلغاء الطلبات", variant: "destructive" });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/orders/${id}/status`, { status });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      const statusLabels: Record<string, string> = {
        pending: 'جديد',
        payment_confirmed: 'تم الدفع',
        confirmed: 'مؤكد',
        in_progress: 'قيد التحضير',
        ready: 'جاهز للتسليم',
        delivered: 'تم التسليم',
        received: 'تم الاستلام',
        completed: 'مكتمل',
        cancelled: 'ملغي',
        suspended: 'معلق',
      };
      toast({ title: `تم تحديث حالة الطلب إلى: ${statusLabels[variables.status] || variables.status}` });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تحديث حالة الطلب", variant: "destructive" });
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, paymentStatus, paymentDetails }: { id: string; paymentStatus: string; paymentDetails?: string }) => {
      const response = await apiRequest("PATCH", `/api/orders/${id}/payment-status`, { paymentStatus, paymentDetails });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      // Force an immediate refetch to ensure UI is in sync
      refetch();
      setShowCashDialog(false);
      setReceivedAmount("");
      setCurrentOrder(null);
      toast({ 
        title: "تم التأكيد", 
        description: "تم تحديث حالة الدفع بنجاح",
        variant: "default" 
      });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تحديث حالة الدفع", variant: "destructive" });
    }
  });

  useEffect(() => {
    if (currentOrder && receivedAmount) {
      const received = parseFloat(receivedAmount);
      const total = parseFloat(currentOrder.totalAmount);
      if (!isNaN(received)) {
        setChangeAmount(Math.max(0, received - total));
      }
    } else {
      setChangeAmount(0);
    }
  }, [receivedAmount, currentOrder]);

  const handleCashPayment = (order: any) => {
    setCurrentOrder(order);
    setReceivedAmount("");
    setChangeAmount(0);
    setShowCashDialog(true);
  };

  const confirmCashPayment = () => {
    if (!currentOrder) return;
    const received = parseFloat(receivedAmount);
    if (isNaN(received) || received < parseFloat(currentOrder.totalAmount)) {
      toast({ title: "خطأ", description: "المبلغ المدفوع أقل من إجمالي الطلب", variant: "destructive" });
      return;
    }
    updatePaymentMutation.mutate({ 
      id: currentOrder.id, 
      paymentStatus: 'paid',
      paymentDetails: `نقدي - المستلم: ${received} ر.س - المرتجع: ${changeAmount.toFixed(2)} ر.س`
    });
  };

  if (!employee) return null;

  const filteredOrders = orders.filter((order) => {
    if (selectedBranchId && order.branchId !== selectedBranchId) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "refunded") {
        if (order.status !== 'refunded' && !(order as any).isFullyRefunded && !((order as any).refundedAmount > 0)) return false;
      } else {
        if (order.status !== statusFilter) return false;
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchOrder = (order.orderNumber || "").toLowerCase().includes(query);
      const matchCustomer = (order.customerInfo?.customerName || "").toLowerCase().includes(query);
      const matchPhone = (order.customerInfo?.phoneNumber || "").includes(query);
      return matchOrder || matchCustomer || matchPhone;
    }
    return true;
  });

  const newOrdersCount = orders.filter(o => o.status === "pending").length;

  const getStatusBadge = (status: string, order?: any) => {
    if (status === 'refunded' || order?.isFullyRefunded) {
      return <Badge className="bg-red-100 text-red-700 border border-red-300 font-bold">مسترجع ↩</Badge>;
    }
    if (order?.refundedAmount > 0 && !order?.isFullyRefunded) {
      return <Badge className="bg-orange-100 text-orange-700 border border-orange-300 font-bold">مسترجع جزئياً ↩</Badge>;
    }
    const config: Record<string, { label: string; variant: "destructive" | "default" | "success" | "outline" | "secondary" }> = {
      pending: { label: 'جديد', variant: 'destructive' },
      payment_confirmed: { label: 'تم الدفع', variant: 'default' },
      confirmed: { label: 'مؤكد', variant: 'default' },
      in_progress: { label: 'قيد التحضير', variant: 'secondary' },
      ready: { label: 'جاهز', variant: 'success' },
      delivered: { label: 'تم التسليم', variant: 'success' },
      received: { label: 'تم الاستلام', variant: 'success' },
      completed: { label: 'مكتمل', variant: 'outline' },
      cancelled: { label: 'ملغي', variant: 'outline' },
      suspended: { label: 'معلق', variant: 'secondary' },
    };
    const c = config[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20 sm:pb-4">
      <div className="max-w-7xl mx-auto">
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center relative">
                <Coffee className="w-6 h-6 text-primary" />
                {newOrdersCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center animate-bounce">
                    <span className="text-destructive-foreground text-xs font-bold">{newOrdersCount}</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-primary flex items-center gap-2" data-testid="text-page-title">
                  {tc("إدارة الطلبات", "Orders Management")}
                  {newOrdersCount > 0 && <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-destructive animate-pulse" />}
                </h1>
                <p className="text-muted-foreground text-sm">{tc("الموظف:", "Staff:")} {employee.fullName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
                {tc("تحديث", "Refresh")}
              </Button>
              <Button variant="outline" onClick={() => setLocation("/employee/home")} data-testid="button-back">
                <ArrowRight className="w-4 h-4 ml-2" />
                {tc("العودة", "Back")}
              </Button>
            </div>
          </div>

          <AudioUnlockBanner
            pageKey="employee-orders"
            soundEnabled={soundEnabled}
            onToggleSound={(v) => { setSoundEnabledState(v); setSoundEnabled('employee-orders', v); }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Label className="font-semibold">{tc("تصفية حسب الفرع:", "Filter by Branch:")}</Label>
            <Select value={selectedBranchId || "all"} onValueChange={(v) => setSelectedBranchId(v === "all" ? null : v)}>
              <SelectTrigger className="w-56" data-testid="select-branch"><SelectValue placeholder={tc("اختر فرع", "Select branch")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الفروع", "All Branches")}</SelectItem>
                {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.nameAr}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => {
                const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
                if (activeOrders.length === 0) {
                  toast({ title: tc("لا توجد طلبات مفتوحة", "No open orders") });
                  return;
                }
                if (confirm(tc(`هل تريد إكمال ${activeOrders.length} طلب مفتوح؟`, `Complete ${activeOrders.length} open orders?`))) {
                  completeAllOrdersMutation.mutate();
                }
              }} 
              disabled={completeAllOrdersMutation.isPending}
              data-testid="button-complete-all"
            >
              {completeAllOrdersMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle className="w-4 h-4 ml-2" />}
              {tc("إكمال جميع الطلبات", "Complete All Orders")}
            </Button>
            <Button 
              onClick={() => {
                const cancellableOrders = orders.filter(o => ['pending', 'in_progress', 'ready'].includes(o.status));
                if (cancellableOrders.length === 0) {
                  toast({ title: tc("لا توجد طلبات لإلغائها", "No orders to cancel") });
                  return;
                }
                if (confirm(tc("هل تريد حقاً إلغاء جميع الطلبات المفتوحة؟", "Really cancel all open orders?"))) {
                  cancelAllOrdersMutation.mutate();
                }
              }} 
              variant="destructive"
              disabled={cancelAllOrdersMutation.isPending}
              data-testid="button-cancel-all"
            >
              {cancelAllOrdersMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <XCircle className="w-4 h-4 ml-2" />}
              {tc("إلغاء كل الطلبات", "Cancel All Orders")}
            </Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input 
                    placeholder={tc("بحث بالرقم أو اسم العميل أو الجوال...", "Search by number, name or phone...")} 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="pr-10 text-right" 
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status"><SelectValue placeholder={tc("الحالة", "Status")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tc("الكل", "All")}</SelectItem>
                    <SelectItem value="pending">{tc("جديد", "New")}</SelectItem>
                    <SelectItem value="payment_confirmed">{tc("تم الدفع", "Paid")}</SelectItem>
                    <SelectItem value="confirmed">{tc("مؤكد", "Confirmed")}</SelectItem>
                    <SelectItem value="in_progress">{tc("قيد التحضير", "In Progress")}</SelectItem>
                    <SelectItem value="ready">{tc("جاهز", "Ready")}</SelectItem>
                    <SelectItem value="delivered">{tc("تم التسليم", "Delivered")}</SelectItem>
                    <SelectItem value="received">{tc("تم الاستلام", "Received")}</SelectItem>
                    <SelectItem value="completed">{tc("مكتمل", "Completed")}</SelectItem>
                    <SelectItem value="cancelled">{tc("ملغي", "Cancelled")}</SelectItem>
                    <SelectItem value="suspended">{tc("معلق", "Suspended")}</SelectItem>
                    <SelectItem value="refunded">{tc("مسترجع", "Refunded")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                <div className="p-2 border rounded-md bg-background">
                  <p className="text-primary font-bold text-lg">{filteredOrders.length}</p>
                  <p className="text-xs text-muted-foreground">{tc("إجمالي", "Total")}</p>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <p className="text-destructive font-bold text-lg">{filteredOrders.filter(o => o.status === "pending" || o.status === "payment_confirmed").length}</p>
                  <p className="text-xs text-muted-foreground">{tc("جديد", "New")}</p>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <p className="text-primary font-bold text-lg">{filteredOrders.filter(o => o.status === "in_progress").length}</p>
                  <p className="text-xs text-muted-foreground">{tc("تحضير", "Prep")}</p>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <p className="text-foreground font-bold text-lg">{filteredOrders.filter(o => o.status === "ready").length}</p>
                  <p className="text-xs text-muted-foreground">{tc("جاهز", "Ready")}</p>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <p className="text-muted-foreground font-bold text-lg">{filteredOrders.filter(o => o.status === "completed").length}</p>
                  <p className="text-xs text-muted-foreground">{tc("مكتمل", "Done")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="mr-3 text-muted-foreground">جاري تحميل الطلبات...</span>
            </div>
          )}

          {isError && !isLoading && (
            <div className="col-span-full bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-4 h-4 text-destructive" />
                </div>
                <p className="text-sm text-destructive font-medium">تعذر تحميل الطلبات. قد تكون جلسة العمل انتهت.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 ml-1" />
                إعادة المحاولة
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {!isLoading && filteredOrders.length === 0 ? (
              <div className="col-span-full text-center py-10 bg-card rounded-lg border border-dashed border-border">
                <Coffee className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">لا توجد طلبات لعرضها حالياً</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const orderId = order.id;
                return (
                  <Card key={orderId} className="hover-elevate overflow-hidden" data-testid={`card-order-${orderId}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-lg">طلب {order.orderNumber}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-SA') : 'تاريخ غير معروف'}
                          </div>
                        </div>
                        {getStatusBadge(order.status, order)}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {order.tableNumber && (
                          <Badge variant="outline" className="text-[10px]">
                            <MapPin className="w-3 h-3 ml-0.5" />
                            طاولة {order.tableNumber}
                          </Badge>
                        )}
                        {order.orderType && order.orderType !== 'regular' && (
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="text-[10px] w-fit">
                              {order.orderType === 'table' || order.orderType === 'dine-in' ? 'محلي' : order.orderType === 'delivery' ? 'توصيل' : (order.orderType === 'car_pickup' || order.orderType === 'car-pickup' || order.orderType === 'curbside') ? 'سيارة' : order.orderType === 'takeaway' ? 'سفري' : order.orderType}
                            </Badge>
                            {(order.orderType === 'car_pickup' || order.orderType === 'car-pickup' || order.orderType === 'curbside') && 
                             (order.carInfo?.carType || order.carInfo?.carColor || order.carInfo?.plateNumber || 
                              order.carType || order.carColor || order.plateNumber || order.carPlate) && (
                              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground bg-muted/30 p-1.5 rounded-sm border border-border/50">
                                {(order.carInfo?.carType || order.carType) && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-foreground">النوع:</span> {order.carInfo?.carType || order.carType}
                                  </span>
                                )}
                                {(order.carInfo?.carColor || order.carColor) && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-foreground">اللون:</span> {order.carInfo?.carColor || order.carColor}
                                  </span>
                                )}
                                {(order.carInfo?.plateNumber || order.plateNumber || order.carPlate) && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-foreground">اللوحة:</span> <span className="font-mono tracking-wider">{order.carInfo?.plateNumber || order.plateNumber || order.carPlate}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {order.customerInfo?.customerName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customerInfo.customerName}
                          </span>
                        )}
                        {order.customerInfo?.phoneNumber && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.customerInfo.phoneNumber}
                          </span>
                        )}
                      </div>

                      {order.estimatedPrepTimeInMinutes && ['pending', 'in_progress', 'payment_confirmed', 'confirmed'].includes(order.status) && (
                        <PrepCountdown
                          estimatedPrepTimeInMinutes={order.estimatedPrepTimeInMinutes}
                          prepTimeSetAt={order.prepTimeSetAt || order.createdAt}
                          status={order.status}
                        />
                      )}

                      <Separator />

                      <div className="space-y-1">
                        {order.items?.map((item: any, idx: number) => {
                          const unitPrice = item.unitPrice || item.price || item.coffeeItem?.price || 0;
                          const name = item.nameAr || item.name || item.coffeeItem?.nameAr || item.coffeeItem?.name || 'منتج';
                          return (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{name} x{item.quantity}</span>
                              <span className="font-semibold">{(item.totalPrice || (unitPrice * item.quantity)).toFixed(2)} <SarIcon /></span>
                            </div>
                          );
                        })}
                      </div>

                      <Separator />

                      {(order as any).refundedAmount > 0 && (
                        <div className="flex items-center justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                          <span className="text-red-700 font-semibold flex items-center gap-1">↩ {tc("مبلغ الاسترجاع:", "Refunded:")}</span>
                          <span className="text-red-700 font-black">{Number((order as any).refundedAmount).toFixed(2)} <SarIcon /></span>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="font-bold text-primary text-lg">{tc("الإجمالي:", "Total:")} {Number(order.totalAmount).toFixed(2)} <SarIcon /></span>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handlePrint(order)}
                            data-testid={`button-print-${orderId}`}
                          >
                            <Printer className="w-3.5 h-3.5 ml-1" />
                            {tc("طباعة", "Print")}
                          </Button>
                          <Badge variant={isPaymentConfirmed(order) ? 'success' : 'outline'} className="text-[10px]">
                            {isPaymentConfirmed(order) ? tc('مدفوع', 'Paid') : tc('غير مدفوع', 'Unpaid')}
                          </Badge>
                          {(() => {
                            const pm = getPaymentLabel(order.paymentMethod);
                            const Icon = pm.icon;
                            return (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Icon className="w-3 h-3" /> {pm.label}
                              </span>
                            );
                          })()}
                          {order.paymentReceiptUrl && BANK_TRANSFER_METHODS.includes(order.paymentMethod) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] text-blue-600 border-blue-300"
                              onClick={() => setReceiptDialogOrder(order)}
                              data-testid={`button-view-receipt-${orderId}`}
                            >
                              <Eye className="w-3 h-3 ml-1" />
                              {tc("عرض التحويل", "View Transfer")}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {['pending', 'payment_confirmed', 'confirmed', 'accepted'].includes(order.status) && (
                          <Button 
                            size="sm"
                            className="bg-primary text-white hover:bg-primary/90"
                            onClick={() => updateStatusMutation.mutate({ id: orderId, status: 'in_progress' })}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-start-${orderId}`}
                          >
                            <PlayCircle className="w-3.5 h-3.5 ml-1" />
                            {tc("بدء التحضير", "Start Prep")}
                          </Button>
                        )}
                        {order.status === 'in_progress' && (
                          <Button 
                            size="sm" 
                            onClick={() => updateStatusMutation.mutate({ id: orderId, status: 'ready' })}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-ready-${orderId}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 ml-1" />
                            {tc("جاهز للتسليم", "Ready")}
                          </Button>
                        )}
                        {order.status === 'ready' && (
                          <>
                            {(order.orderType === 'delivery' || order.orderType === 'car_pickup' || order.orderType === 'car-pickup' || order.orderType === 'curbside') ? (
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                                onClick={() => updateStatusMutation.mutate({ id: orderId, status: 'delivered' })}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-delivered-${orderId}`}
                              >
                                <CheckCircle className="w-3.5 h-3.5 ml-1" />
                                {tc("تم التسليم", "Delivered")}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: orderId, status: 'completed' })}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-complete-${orderId}`}
                              >
                                <CheckCircle className="w-3.5 h-3.5 ml-1" />
                                {tc("إكمال", "Complete")}
                              </Button>
                            )}
                          </>
                        )}
                        {order.status === 'delivered' && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => updateStatusMutation.mutate({ id: orderId, status: 'received' })}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-received-${orderId}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 ml-1" />
                            {tc("تم الاستلام", "Received")}
                          </Button>
                        )}
                        {order.status === 'received' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: orderId, status: 'completed' })}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-complete-${orderId}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 ml-1" />
                            {tc("إكمال", "Complete")}
                          </Button>
                        )}

                        {!isPaymentConfirmed(order) && !['completed', 'cancelled'].includes(order.status) && !GATEWAY_METHODS.includes(order.paymentMethod) && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              if (order.paymentMethod === 'cash') {
                                handleCashPayment(order);
                              } else if (BANK_TRANSFER_METHODS.includes(order.paymentMethod)) {
                                if (order.paymentReceiptUrl) {
                                  setReceiptDialogOrder({ ...order, confirmOnClose: true });
                                } else {
                                  updatePaymentMutation.mutate({ id: orderId, paymentStatus: 'paid' });
                                }
                              } else {
                                updatePaymentMutation.mutate({ id: orderId, paymentStatus: 'paid' });
                              }
                            }}
                            disabled={updatePaymentMutation.isPending}
                            data-testid={`button-confirm-payment-${orderId}`}
                          >
                            <DollarSign className="w-3.5 h-3.5 ml-1" />
                            {BANK_TRANSFER_METHODS.includes(order.paymentMethod) ? tc("تأكيد التحويل", "Confirm Transfer") : tc("تأكيد الدفع", "Confirm Payment")}
                          </Button>
                        )}

                        {['in_progress', 'ready', 'delivered', 'received', 'completed'].includes(order.status) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="رجوع للخطوة السابقة"
                            onClick={() => {
                              const prevStatus =
                                order.status === 'in_progress' ? 'pending' :
                                order.status === 'ready' ? 'in_progress' :
                                order.status === 'delivered' ? 'ready' :
                                order.status === 'received' ? 'delivered' :
                                order.status === 'completed' ? 'ready' : 'pending';
                              const labels: Record<string, string> = { pending: 'جديد', in_progress: 'تحضير', ready: 'جاهز', delivered: 'تم التسليم', received: 'تم الاستلام' };
                              if (confirm(`هل تريد العودة بحالة الطلب إلى "${labels[prevStatus] || prevStatus}"؟`)) {
                                updateStatusMutation.mutate({ id: orderId, status: prevStatus });
                              }
                            }}
                            data-testid={`button-rollback-${orderId}`}
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        )}

                        {['pending', 'confirmed', 'payment_confirmed', 'in_progress', 'ready', 'suspended'].includes(order.status) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            title="إلغاء الطلب"
                            onClick={() => {
                              if (confirm("هل تريد حقاً إلغاء هذا الطلب؟")) {
                                updateStatusMutation.mutate({ id: orderId, status: 'cancelled' });
                              }
                            }}
                            data-testid={`button-cancel-${orderId}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              طباعة فاتورة رسمية
            </DialogTitle>
          </DialogHeader>
          {currentOrder && (
            <div className="py-4">
              <ReceiptInvoice order={currentOrder} variant="button" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">تحصيل مبلغ نقدي</DialogTitle>
            <DialogDescription className="text-center">
              طلب رقم {currentOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="flex justify-between items-center p-4 bg-primary/5 rounded-md border border-primary/10">
              <span className="text-lg font-semibold">المبلغ المطلوب:</span>
              <span className="text-2xl font-black text-primary">{currentOrder ? Number(currentOrder.totalAmount).toFixed(2) : '0.00'} <SarIcon /></span>
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-bold">المبلغ المستلم من العميل:</Label>
              <div className="relative">
                <Input 
                  type="number"
                  placeholder="0.00"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="text-2xl h-14 text-center font-bold border-2 border-primary/30 focus:border-primary transition-all rounded-md"
                  autoFocus
                  data-testid="input-received-amount"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold"><SarIcon /></span>
              </div>
            </div>

            {changeAmount > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md border-2 border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-green-800 dark:text-green-300">المبلغ المتبقي للعميل:</span>
                  <span className="text-2xl font-black text-green-700 dark:text-green-400">{changeAmount.toFixed(2)} <SarIcon /></span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-3 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowCashDialog(false)} 
              className="flex-1"
              data-testid="button-cancel-cash"
            >
              إلغاء
            </Button>
            <Button 
              onClick={confirmCashPayment} 
              disabled={updatePaymentMutation.isPending || !receivedAmount || parseFloat(receivedAmount) < (currentOrder?.totalAmount || 0)}
              className="flex-1"
              data-testid="button-confirm-cash"
            >
              {updatePaymentMutation.isPending ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</>
              ) : (
                "تأكيد واستلام"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Payment Receipt View Dialog */}
      {receiptDialogOrder && (
        <PaymentReceiptDialog
          open={!!receiptDialogOrder}
          onOpenChange={(open) => {
            if (!open) {
              if (receiptDialogOrder?.confirmOnClose) {
                const orderId = receiptDialogOrder.id || receiptDialogOrder._id;
                updatePaymentMutation.mutate({ id: orderId, paymentStatus: 'paid' });
              }
              setReceiptDialogOrder(null);
            }
          }}
          orderId={receiptDialogOrder.id || receiptDialogOrder._id}
          receiptUrl={receiptDialogOrder.paymentReceiptUrl}
          showConfirm={receiptDialogOrder?.confirmOnClose}
          onConfirm={() => {
            const orderId = receiptDialogOrder.id || receiptDialogOrder._id;
            updatePaymentMutation.mutate({ id: orderId, paymentStatus: 'paid' });
            setReceiptDialogOrder(null);
          }}
        />
      )}

      <MobileBottomNav employeeRole={employee?.role} />
    </div>
  );
}
