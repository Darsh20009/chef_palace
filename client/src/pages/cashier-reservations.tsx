import { useState, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, Phone, Users, Clock, CheckCircle2, XCircle, Clock3 } from "lucide-react";

interface Reservation {
  tableId: string;
  tableNumber: string;
  branchId: string;
  reservation: {
    customerName: string;
    customerPhone: string;
    reservationDate: string;
    reservationTime: string;
    numberOfGuests: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
    autoExpiryTime?: string;
    extensionCount?: number;
    reservedAt: string;
  };
}

export default function CashierReservations() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [searchPhone, setSearchPhone] = useState("");
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [sortBy, setSortBy] = useState<'time' | 'guests' | 'status'>('time');

  // Fetch all reservations for current branch
  const { data: allReservations = [], isLoading } = useQuery({
    queryKey: ["/api/tables"],
    queryFn: async () => {
      const response = await fetch("/api/tables");
      if (!response.ok) throw new Error("Failed to fetch tables");
      const tables = await response.json();
      
      // Extract reservations from tables
      const reservations = tables
        .filter((t: any) => t.reservedFor && ['pending', 'confirmed'].includes(t.reservedFor.status))
        .map((t: any) => ({
          tableId: t.id,
          tableNumber: t.tableNumber,
          branchId: t.branchId,
          reservation: t.reservedFor
        }));
      
      return reservations;
    }
  });

  // Search for reservation by phone
  const searchReservation = async () => {
    if (!searchPhone.trim()) {
      setFilteredReservations(allReservations);
      return;
    }

    try {
      const response = await fetch(`/api/tables/reservations/customer/${searchPhone}`);
      if (response.ok) {
        const data = await response.json();
        setFilteredReservations(data);
      }
    } catch (error) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل البحث عن الحجوزات", "Failed to search reservations"),
        variant: "destructive"
      });
    }
  };

  // Confirm reservation
  const confirmMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/approve-reservation`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(tc("فشل في تأكيد الحجز", "Failed to confirm reservation"));
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: tc("تم", "Done"),
        description: tc("تم تأكيد الحجز بنجاح", "Reservation confirmed successfully"),
        className: "bg-green-600 text-white border-green-700"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
    },
    onError: (error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: getErrorMessage(error, tc("فشل تأكيد الحجز", "Failed to confirm reservation")),
        variant: "destructive"
      });
    }
  });

  // Cancel reservation
  const cancelMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/cancel-reservation`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(tc("فشل في إلغاء الحجز", "Failed to cancel reservation"));
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: tc("تم", "Done"),
        description: tc("تم إلغاء الحجز", "Reservation cancelled"),
        className: "bg-red-600 text-white border-red-700"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
    },
    onError: (error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: getErrorMessage(error, tc("فشل إلغاء الحجز", "Failed to cancel reservation")),
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    let sorted = [...allReservations];
    
    if (sortBy === 'time') {
      sorted.sort((a, b) => {
        const timeA = new Date(a.reservation.reservationDate).getTime();
        const timeB = new Date(b.reservation.reservationDate).getTime();
        return timeA - timeB;
      });
    } else if (sortBy === 'guests') {
      sorted.sort((a, b) => b.reservation.numberOfGuests - a.reservation.numberOfGuests);
    } else if (sortBy === 'status') {
      const statusOrder = { pending: 0, confirmed: 1, cancelled: 2, expired: 3, completed: 4 };
      sorted.sort((a, b) => {
        return (statusOrder[a.reservation.status as keyof typeof statusOrder] || 5) -
               (statusOrder[b.reservation.status as keyof typeof statusOrder] || 5);
      });
    }
    
    setFilteredReservations(sorted);
  }, [allReservations, sortBy]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">{tc("قيد الانتظار", "Pending")}</Badge>;
      case 'confirmed':
        return <Badge className="bg-green-600 text-white">{tc("مؤكد", "Confirmed")}</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">{tc("ملغى", "Cancelled")}</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-300">{tc("منتهي", "Expired")}</Badge>;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('ar', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ar');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{tc("إدارة الحجوزات", "Reservation Management")}</h1>
          <p className="text-gray-600">{tc("عرض وإدارة جميع حجوزات الطاولات", "View and manage all table reservations")}</p>
        </div>

        {/* Search & Filter Bar */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              {tc("البحث والتصفية", "Search & Filter")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={tc("رقم الجوال (مثال: 501234567)", "Phone (e.g. 501234567)")}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="flex-1"
                data-testid="input-search-phone"
              />
              <Button 
                onClick={searchReservation}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-search"
              >
                <Search className="w-4 h-4 ml-2" />
                {tc("بحث", "Search")}
              </Button>
            </div>

            {/* Sorting Options */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={sortBy === 'time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('time')}
                className="text-xs"
                data-testid="button-sort-time"
              >
                {tc("الترتيب حسب الوقت", "Sort by time")}
              </Button>
              <Button
                variant={sortBy === 'guests' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('guests')}
                className="text-xs"
                data-testid="button-sort-guests"
              >
                {tc("الترتيب حسب عدد الضيوف", "Sort by guests")}
              </Button>
              <Button
                variant={sortBy === 'status' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('status')}
                className="text-xs"
                data-testid="button-sort-status"
              >
                {tc("الترتيب حسب الحالة", "Sort by status")}
              </Button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-4 gap-2 pt-4 border-t">
              <div className="text-center p-2 bg-blue-50 rounded">
                <p className="text-2xl font-bold text-blue-600">{allReservations.length}</p>
                <p className="text-xs text-gray-600">{tc("إجمالي", "Total")}</p>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded">
                <p className="text-2xl font-bold text-yellow-600">
                  {allReservations.filter((r: any) => r.reservation.status === 'pending').length}
                </p>
                <p className="text-xs text-gray-600">{tc("قيد الانتظار", "Pending")}</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="text-2xl font-bold text-green-600">
                  {allReservations.filter((r: any) => r.reservation.status === 'confirmed').length}
                </p>
                <p className="text-xs text-gray-600">{tc("مؤكدة", "Confirmed")}</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-2xl font-bold text-gray-600">
                  {allReservations.filter((r: any) => r.reservation.status === 'expired').length}
                </p>
                <p className="text-xs text-gray-600">{tc("منتهية", "Expired")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reservations List */}
        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                {tc("جاري تحميل الحجوزات...", "Loading reservations...")}
              </CardContent>
            </Card>
          ) : filteredReservations.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                {tc("لا توجد حجوزات", "No reservations found")}
              </CardContent>
            </Card>
          ) : (
            filteredReservations.map((item) => (
              <Card key={item.tableId} className="shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column - Basic Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-blue-600">
                          {tc("طاولة", "Table")} {item.tableNumber}
                        </div>
                        <div>{getStatusDisplay(item.reservation.status)}</div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <Users className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-semibold">{item.reservation.customerName}</p>
                          <p className="text-sm text-gray-600">{tc("عدد الضيوف:", "Guests:")} {item.reservation.numberOfGuests}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="w-5 h-5 text-blue-500" />
                        <span>+966{item.reservation.customerPhone}</span>
                      </div>
                    </div>

                    {/* Right Column - Reservation Details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-semibold">{formatDate(item.reservation.reservationDate)}</p>
                          <p className="text-sm text-gray-600">{item.reservation.reservationTime}</p>
                        </div>
                      </div>

                      {item.reservation.autoExpiryTime && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock3 className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="text-sm text-gray-600">{tc("ينتهي في:", "Expires at:")}</p>
                            <p className="font-semibold text-orange-600">
                              {formatTime(item.reservation.autoExpiryTime)}
                            </p>
                          </div>
                        </div>
                      )}

                      {item.reservation.extensionCount ? (
                        <div className="flex items-center gap-2 text-green-700">
                          <Clock className="w-5 h-5" />
                          <p className="text-sm">{tc("تم تمديد الحجز", "Reservation extended")}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {item.reservation.status === 'pending' && (
                    <div className="mt-6 flex gap-3 pt-4 border-t">
                      <Button
                        onClick={() => confirmMutation.mutate(item.tableId)}
                        disabled={confirmMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        data-testid={`button-confirm-${item.tableId}`}
                      >
                        <CheckCircle2 className="w-4 h-4 ml-2" />
                        {tc("تأكيد الحجز", "Confirm Reservation")}
                      </Button>
                      <Button
                        onClick={() => cancelMutation.mutate(item.tableId)}
                        disabled={cancelMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                        data-testid={`button-cancel-${item.tableId}`}
                      >
                        <XCircle className="w-4 h-4 ml-2" />
                        {tc("إلغاء الحجز", "Cancel Reservation")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
