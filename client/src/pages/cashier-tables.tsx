import { useState, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, User, Phone, CheckCircle2, XCircle, Clock, Check, X } from "lucide-react";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ITable {
  id: string;
  tableNumber: string;
  branchId: string;
  isActive: number;
  isOccupied: number;
  currentOrderId?: string;
  reservedFor?: {
    customerName: string;
    customerPhone: string;
    reservationDate: Date;
    reservationTime: string;
    numberOfGuests: number;
    reservedAt: Date;
    reservedBy: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  };
}

interface IPendingOrder {
  id: string;
  tableNumber?: string;
  customerInfo?: {
    customerName: string;
    customerPhone: string;
  };
  status: string;
}

interface IBranch {
  id: string;
  nameAr: string;
}

export default function CashierTables() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<ITable | null>(null);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [numberOfGuests, setNumberOfGuests] = useState("2");
  const [reservationDateTime, setReservationDateTime] = useState("");
  const [employeeBranchId, setEmployeeBranchId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Get current employee info from localStorage or API
  useEffect(() => {
    const employeeData = localStorage.getItem("currentEmployee");
    if (employeeData) {
      const emp = JSON.parse(employeeData);
      if (emp.branchId) {
        setEmployeeBranchId(emp.branchId);
      } else if (emp.id) {
        fetch(`/api/employees/${emp.id}`, { credentials: "include" })
          .then(res => res.json())
          .then(data => {
            if (data.branchId) {
              setEmployeeBranchId(data.branchId);
              const updated = { ...emp, branchId: data.branchId };
              localStorage.setItem("currentEmployee", JSON.stringify(updated));
            }
          })
          .catch(error => console.error("Failed to fetch employee:", error));
      }
    }
  }, []);

  // Fetch all branches
  const { data: allBranches = [] } = useQuery<IBranch[]>({
    queryKey: ["/api/branches"],
  });

  // Fetch tables for the cashier's branch
  const { data: tables = [], isLoading } = useQuery<ITable[]>({
    queryKey: ["/api/tables", selectedBranchId || employeeBranchId],
    queryFn: async () => {
      const branchId = selectedBranchId || employeeBranchId;
      const response = await fetch(`/api/tables?branchId=${branchId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch tables");
      const data = await response.json();
      return Array.isArray(data) ? data.filter((t: ITable) => t.branchId === branchId) : [];
    },
    enabled: !!(selectedBranchId || employeeBranchId),
    refetchInterval: 15000,
  });

  // Fetch pending table orders
  const { data: pendingOrders = [] } = useQuery<IPendingOrder[]>({
    queryKey: ["/api/orders/table/pending"],
    queryFn: async () => {
      const response = await fetch(`/api/orders/table/pending`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 15000,
  });

  // Get branch info
  const { data: branch } = useQuery<IBranch>({
    queryKey: ["/api/branches", selectedBranchId || employeeBranchId],
    queryFn: async () => {
      const branchId = selectedBranchId || employeeBranchId;
      const response = await fetch(`/api/branches/${branchId}`);
      if (!response.ok) throw new Error("Failed to fetch branch");
      return response.json();
    },
    enabled: !!(selectedBranchId || employeeBranchId),
  });

  // Reserve table mutation
  const reserveTableMutation = useMutation({
    mutationFn: async ({ tableId, customerName, customerPhone, numberOfGuests, reservationDateTime }: { 
      tableId: string; 
      customerName: string; 
      customerPhone: string;
      numberOfGuests: number;
      reservationDateTime: string;
    }) => {
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      
      // Parse the datetime from input
      const dateTime = new Date(reservationDateTime);
      const reservationDate = dateTime.toISOString();
      const reservationTime = dateTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      
      const response = await fetch(`/api/tables/${tableId}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          numberOfGuests,
          reservationDate,
          reservationTime,
          employeeId: employee?.id,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reserve table");
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.refetchQueries({ queryKey: ["/api/tables", employeeBranchId] });
      toast({
        title: tc("تم حجز الطاولة", "Table reserved"),
        description: tc("تم حجز الطاولة بنجاح", "Table was reserved successfully"),
      });
      setReserveDialogOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setNumberOfGuests("2");
      setReservationDateTime("");
      setSelectedTable(null);
      // Open WhatsApp to notify customer if URL was returned
      if (data?.whatsappNotification?.url) {
        setTimeout(() => window.open(data.whatsappNotification.url, '_blank'), 500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل حجز الطاولة", "Failed to reserve table"),
        variant: "destructive",
      });
    },
  });

  // Release table mutation
  const releaseTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      
      const response = await fetch(`/api/tables/${tableId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee?.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to release table");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/tables"] });
      toast({
        title: tc("تم تحرير الطاولة", "Table released"),
        description: tc("الطاولة متاحة الآن", "Table is now available"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل تحرير الطاولة", "Failed to release table"),
        variant: "destructive",
      });
    },
  });

  // Approve reservation mutation
  const approveReservationMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/approve-reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve reservation");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/tables", employeeBranchId] });
      toast({
        title: tc("تم تفعيل الحجز", "Reservation confirmed"),
        description: tc("تم تفعيل الحجز بنجاح", "Reservation was confirmed successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل تفعيل الحجز", "Failed to confirm reservation"),
        variant: "destructive",
      });
    },
  });

  // Cancel reservation mutation
  const cancelReservationMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/cancel-reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel reservation");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/tables", employeeBranchId] });
      toast({
        title: tc("تم إلغاء الحجز", "Reservation cancelled"),
        description: tc("تم إلغاء الحجز بنجاح", "Reservation was cancelled successfully"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل إلغاء الحجز", "Failed to cancel reservation"),
        variant: "destructive",
      });
    },
  });

  const handleReserveTable = (table: ITable) => {
    setSelectedTable(table);
    setReserveDialogOpen(true);
  };

  const handleReleaseTable = (table: ITable) => {
    if (window.confirm(`${tc("هل أنت متأكد من تحرير الطاولة", "Are you sure you want to release table")} ${table.tableNumber}?`)) {
      releaseTableMutation.mutate(table.id);
    }
  };

  const handleSubmitReservation = () => {
    if (!selectedTable) return;
    
    if (!customerName.trim()) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء إدخال اسم العميل", "Please enter the customer name"),
        variant: "destructive",
      });
      return;
    }

    if (!customerPhone.trim() || customerPhone.length < 9) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء إدخال رقم جوال صحيح", "Please enter a valid phone number"),
        variant: "destructive",
      });
      return;
    }

    const guests = parseInt(numberOfGuests);
    if (isNaN(guests) || guests < 1 || guests > 20) {
      toast({
        title: tc("عدد غير صحيح", "Invalid count"),
        description: tc("الرجاء إدخال عدد صحيح من الضيوف (1-20)", "Please enter a valid number of guests (1-20)"),
        variant: "destructive",
      });
      return;
    }

    if (!reservationDateTime) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء اختيار الميعاد", "Please select a date and time"),
        variant: "destructive",
      });
      return;
    }

    reserveTableMutation.mutate({
      tableId: selectedTable.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      numberOfGuests: guests,
      reservationDateTime,
    });
  };

  // Fetch all branches
  const { data: branches = [] } = useQuery<IBranch[]>({
    queryKey: ["/api/branches"],
  });

  // Get reservation status based on time
  const getReservationStatus = (reservation: ITable["reservedFor"]) => {
    if (!reservation || reservation.status !== 'pending') return reservation?.status;
    
    const reservationTime = new Date(reservation.reservationDate);
    const now = new Date();
    const diffMinutes = (reservationTime.getTime() - now.getTime()) / (1000 * 60);
    
    if (diffMinutes <= -5) return 'cancelled'; // Expired
    if (diffMinutes >= -5 && diffMinutes <= 5) return 'auto-approve-soon';
    return 'pending';
  };

  // Get current employee info
  const employeeData = localStorage.getItem("currentEmployee");
  const currentEmployee = employeeData ? JSON.parse(employeeData) : null;

  // For admin/owner, allow branch selection
  const isAdminUser = currentEmployee?.role === "admin" || currentEmployee?.role === "owner";

  if (!employeeBranchId && !isAdminUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{tc("خطأ", "Error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{tc("لم يتم تعيينك لفرع معين. يرجى التواصل مع المدير.", "You have not been assigned to a branch. Please contact the manager.")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAdminUser && !selectedBranchId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{tc("اختر الفرع", "Select Branch")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tc("اختر الفرع", "Select branch")} />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => setSelectedBranchId(selectedBranchId)}
              className="w-full"
              disabled={!selectedBranchId}
            >
              {tc("متابعة", "Continue")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeBranchId = selectedBranchId || employeeBranchId;

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0" dir="rtl">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-accent">{tc("إدارة الطاولات", "Table Management")}</h1>
            <p className="text-accent">
              {branch?.nameAr || tc("تحميل...", "Loading...")} • {tables.length} {tc("طاولة", "tables")}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setLocation("/employee/home")}
            data-testid="button-back"
          >
            <ArrowRight className="ml-2 h-5 w-5" />
            {tc("العودة", "Back")}
          </Button>
        </div>

        {/* Legend */}
        <Card className="bg-white/80 backdrop-blur">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">{tc("متاحة", "Available")}</Badge>
                <span className="text-sm text-muted-foreground">{tc("جاهزة للحجز", "Ready to reserve")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <Badge variant="destructive" className="bg-red-600 hover:bg-red-700">{tc("محجوزة", "Occupied")}</Badge>
                <span className="text-sm text-muted-foreground">{tc("بها عميل حالياً", "Has customer now")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tables Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-lg text-accent">{tc("جاري التحميل...", "Loading...")}</div>
          </div>
        ) : tables.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {tc("لا توجد طاولات في هذا الفرع. يرجى التواصل مع المدير.", "No tables in this branch. Please contact the manager.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tables.map((table) => (
              <Card
                key={table.id}
                className={`hover-elevate cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                  table.isOccupied
                    ? "bg-gradient-to-br from-red-100 via-red-50 to-orange-100 border-2 border-red-400 shadow-lg shadow-red-200/50 dark:from-red-900 dark:via-red-950 dark:to-orange-900"
                    : "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 border-2 border-emerald-400 shadow-lg shadow-emerald-200/50 dark:from-emerald-900 dark:via-green-950 dark:to-teal-900"
                }`}
                data-testid={`card-table-${table.tableNumber}`}
              >
                <CardContent className="p-4 sm:p-6 text-center space-y-3">
                  {/* Table Number - Large and Bold */}
                  <div className="relative">
                    <div className={`text-4xl sm:text-5xl font-bold ${
                      table.isOccupied 
                        ? "text-red-700 dark:text-red-300" 
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}>
                      {table.tableNumber}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{tc("الطاولة", "Table")}</div>
                  </div>
                  
                  {table.reservedFor?.customerName ? (
                    <div className="space-y-3">
                      {/* Reservation Status Badge */}
                      <div className="flex justify-center gap-2 flex-wrap">
                        {table.reservedFor.status === 'pending' && (
                          <>
                            <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white animate-pulse px-3 py-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {tc("معلقة", "Pending")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{tc("الميعاد:", "Time:")} {table.reservedFor.reservationTime}</span>
                          </>
                        )}
                        {table.reservedFor.status === 'confirmed' && (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1">
                            <Check className="w-3 h-3 ml-1" />
                            {tc("مفعلة", "Confirmed")}
                          </Badge>
                        )}
                        {table.reservedFor.status === 'cancelled' && (
                          <Badge className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1">
                            {tc("ملغاة", "Cancelled")}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Customer Info */}
                      <div className="bg-white/70 dark:bg-card/70 rounded-lg p-3 space-y-2 backdrop-blur">
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <User className="w-4 h-4 text-red-600" />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {table.reservedFor?.customerName || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <Phone className="w-3 h-3 text-red-600" />
                          <span className="font-mono" dir="ltr">
                            {table.reservedFor?.customerPhone || "N/A"}
                          </span>
                        </div>
                        {table.reservedFor?.numberOfGuests && (
                          <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold">{tc("ضيوف:", "Guests:")}</span>
                            <span>{table.reservedFor.numberOfGuests}</span>
                          </div>
                        )}
                      </div>

                      {/* Pending Reservation Action Buttons */}
                      {table.reservedFor.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveReservationMutation.mutate(table.id)}
                            disabled={approveReservationMutation.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-${table.tableNumber}`}
                          >
                            <Check className="w-3 h-3 ml-1" />
                            {tc("تفعيل", "Confirm")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelReservationMutation.mutate(table.id)}
                            disabled={cancelReservationMutation.isPending}
                            className="flex-1"
                            data-testid={`button-cancel-reserve-${table.tableNumber}`}
                          >
                            <X className="w-3 h-3 ml-1" />
                            {tc("إلغاء", "Cancel")}
                          </Button>
                        </div>
                      )}
                      
                      {/* Pending Order Link */}
                      {table.currentOrderId && pendingOrders.find(o => o.id === table.currentOrderId) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/table-order-tracking/${table.currentOrderId}`)}
                          className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                          data-testid={`button-order-${table.tableNumber}`}
                        >
                          {tc("عرض طلب الطاولة", "View Table Order")}
                        </Button>
                      )}

                      {/* Release Button */}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReleaseTable(table)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white transition-all"
                        data-testid={`button-release-${table.tableNumber}`}
                      >
                        <XCircle className="w-3 h-3 ml-1" />
                        {tc("تحرير الطاولة", "Release Table")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Available Badge */}
                      <div className="flex justify-center">
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1">
                          {tc("متاحة الآن", "Available Now")}
                        </Badge>
                      </div>
                      
                      {/* Empty State Info */}
                      <div className="text-xs text-muted-foreground py-2">
                        {tc("جاهزة للحجز", "Ready to reserve")}
                      </div>
                      
                      {/* Reserve Button */}
                      <Button
                        size="sm"
                        onClick={() => handleReserveTable(table)}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all shadow-md hover:shadow-lg"
                        data-testid={`button-reserve-${table.tableNumber}`}
                      >
                        <CheckCircle2 className="w-4 h-4 ml-1" />
                        {tc("حجز الطاولة", "Reserve Table")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reserve Dialog */}
        <Dialog open={reserveDialogOpen} onOpenChange={setReserveDialogOpen}>
          <DialogContent className="sm:max-w-md bg-[#11936c]" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {tc("حجز طاولة", "Reserve Table")} {selectedTable?.tableNumber}
              </DialogTitle>
              <DialogDescription>
                {tc("أدخل معلومات العميل لحجز الطاولة", "Enter customer information to reserve the table")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">{tc("اسم العميل *", "Customer Name *")}</Label>
                <Input
                  id="customer-name"
                  placeholder={tc("محمد أحمد", "Mohammed Ahmed")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  data-testid="input-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">{tc("رقم الجوال *", "Phone Number *")}</Label>
                <Input
                  id="customer-phone"
                  placeholder="5xxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  maxLength={9}
                  data-testid="input-customer-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number-of-guests">{tc("عدد الضيوف *", "Number of Guests *")}</Label>
                <Input
                  id="number-of-guests"
                  type="number"
                  placeholder="2"
                  value={numberOfGuests}
                  onChange={(e) => setNumberOfGuests(e.target.value)}
                  min="1"
                  max="20"
                  data-testid="input-number-of-guests"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reservation-datetime">{tc("الميعاد *", "Date & Time *")}</Label>
                <Input
                  id="reservation-datetime"
                  type="datetime-local"
                  value={reservationDateTime}
                  onChange={(e) => setReservationDateTime(e.target.value)}
                  data-testid="input-reservation-datetime"
                />
                <p className="text-xs text-muted-foreground">{tc("يتم تفعيل الحجز عند قدوم الميعاد قبله بـ 5 دقايق، والإلغاء تلقائياً بعد 5 دقايق من الميعاد", "Reservation is confirmed 5 minutes before the time and auto-cancelled 5 minutes after")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmitReservation}
                  disabled={reserveTableMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm-reserve"
                >
                  {tc("تأكيد الحجز", "Confirm Reservation")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReserveDialogOpen(false);
                    setCustomerName("");
                    setCustomerPhone("");
                    setNumberOfGuests("2");
                  }}
                  className="flex-1"
                  data-testid="button-cancel-reserve"
                >
                  {tc("إلغاء", "Cancel")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <MobileBottomNav />
    </div>
  );
}
