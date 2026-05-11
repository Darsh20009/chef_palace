import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Search, Calendar, Phone, Users, Clock, Clock3, ArrowRight, Loader2 } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

interface Reservation {
  tableId: string;
  tableNumber: string;
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

export default function CustomerReservations() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const tc = useTranslate();
  const [searchPhone, setSearchPhone] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'product'>('product');

  const { data: reservations = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/tables/reservations/customer", searchPhone],
    queryFn: async () => {
      if (!searchPhone.trim()) return [];
      const response = await fetch(`/api/tables/reservations/customer/${searchPhone}`);
      if (response.ok) return await response.json();
      throw new Error(tc("فشل البحث عن الحجوزات", "Failed to search reservations"));
    },
    enabled: false
  });

  const { data: productReservations = [], isLoading: productLoading, refetch: refetchProduct } = useQuery<any[]>({
    queryKey: ["/api/product-reservations/customer", searchPhone],
    queryFn: async () => {
      if (!searchPhone.trim()) return [];
      const response = await fetch(`/api/product-reservations/customer/${encodeURIComponent(searchPhone)}`);
      if (response.ok) return await response.json();
      return [];
    },
    enabled: false
  });

  const PRODUCT_RES_STATUS: Record<string, { label: string; color: string }> = {
    pending_payment:      { label: 'بانتظار الدفع', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    pending_confirmation: { label: 'بانتظار التأكيد', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    confirmed:            { label: 'مؤكد', color: 'bg-green-50 text-green-700 border-green-200' },
    rejected:             { label: 'مرفوض', color: 'bg-red-50 text-red-700 border-red-200' },
    cancelled:            { label: 'ملغى', color: 'bg-gray-50 text-gray-600 border-gray-200' },
    completed:            { label: 'مكتمل', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  };

  const extendMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/extend-reservation`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(tc("فشل في تمديد الحجز", "Failed to extend reservation"));
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: tc("تم", "Done"),
        description: tc("تم تمديد الحجز لساعة إضافية", "Reservation extended by one hour"),
        className: "bg-green-600 text-white border-green-700"
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: getErrorMessage(error, tc("فشل تمديد الحجز", "Failed to extend reservation")),
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!searchPhone.trim()) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("الرجاء إدخال رقم جوالك", "Please enter your phone number"),
        variant: "destructive"
      });
      return;
    }
    setHasSearched(true);
    refetch();
    refetchProduct();
  };

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
      case 'completed':
        return <Badge className="bg-blue-600 text-white">{tc("مكتمل", "Completed")}</Badge>;
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

  const isReservationActive = (reservation: any) => {
    return ['pending', 'confirmed'].includes(reservation.status);
  };

  const canExtend = (reservation: any) => {
    return reservation.status === 'confirmed' && !reservation.extensionCount;
  };

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">{tc("حجوزاتي", "My Reservations")}</h1>
          </div>
          <p className="text-gray-600 mr-10">{tc("ابحث عن حجوزات طاولاتك بنمرة جوالك", "Search for your table reservations by phone number")}</p>
        </div>

        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              {tc("ابحث عن حجزك", "Find Your Reservation")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder={tc("رقم الجوال (مثال: 501234567)", "Phone number (e.g. 501234567)")}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
                data-testid="input-search-phone"
              />
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-search"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 ml-2" />
                )}
                {tc("بحث", "Search")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {hasSearched && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('product')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${activeTab === 'product' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-card border-border text-muted-foreground'}`}
              data-testid="tab-product-reservations"
            >
              🗓️ حجوزات المنتجات {productReservations.length > 0 ? `(${productReservations.length})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${activeTab === 'table' ? 'bg-primary text-primary-foreground border-primary' : 'bg-white dark:bg-card border-border text-muted-foreground'}`}
              data-testid="tab-table-reservations"
            >
              🪑 حجوزات الطاولات {reservations.length > 0 ? `(${reservations.length})` : ''}
            </button>
          </div>
        )}

        {/* Product Reservations Tab */}
        {hasSearched && activeTab === 'product' && (
          <div className="space-y-3 mb-6">
            {productLoading ? (
              <Card><CardContent className="pt-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>
            ) : productReservations.length === 0 ? (
              <Card>
                <CardContent className="pt-8 text-center text-gray-500">
                  لا توجد حجوزات منتجات لهذا الرقم
                </CardContent>
              </Card>
            ) : (
              productReservations.map((order: any) => {
                const statusKey = order.productReservationStatus || 'pending_payment';
                const statusCfg = PRODUCT_RES_STATUS[statusKey] || PRODUCT_RES_STATUS['pending_payment'];
                return (
                  <Card key={order.id} className="shadow-sm">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">#{order.orderNumber}</span>
                        <Badge variant="outline" className={`${statusCfg.color} text-xs`}>{statusCfg.label}</Badge>
                      </div>
                      {order.productReservationDate && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 space-y-1">
                          <p className="text-xs font-semibold text-amber-700">📅 {new Date(order.productReservationDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          {order.productReservationFromTime && (
                            <p className="text-xs text-amber-600">⏰ {order.productReservationFromTime} — {order.productReservationToTime}</p>
                          )}
                        </div>
                      )}
                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div className="space-y-1">
                          {order.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs text-muted-foreground">
                              <span>{item.nameAr || 'منتج'} × {item.quantity}</span>
                              <span>{((item.price || 0) * (item.quantity || 1)).toFixed(2)} ر.س</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-xs text-muted-foreground">الإجمالي</span>
                        <span className="font-bold text-sm">{(order.totalAmount || 0).toFixed(2)} ر.س</span>
                      </div>
                      {statusKey === 'pending_payment' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-xs text-orange-700">
                          ⚠️ يرجى إرسال إيصال الدفع عبر واتساب لتأكيد حجزك
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Table Reservations Tab */}
        {activeTab === 'table' && (
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                <div className="flex justify-center mb-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                {tc("جاري البحث...", "Searching...")}
              </CardContent>
            </Card>
          ) : hasSearched && reservations.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                {tc("لا توجد حجوزات لهذا الرقم", "No reservations found for this number")}
              </CardContent>
            </Card>
          ) : hasSearched && reservations.length > 0 ? (
            reservations.map((item: any) => (
              <Card key={item.tableId} className="shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-blue-600">
                          {item.tableNumber}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">{tc("طاولة رقم", "Table No.")}</p>
                          <p className="font-semibold text-gray-900">{item.reservation.customerName}</p>
                        </div>
                      </div>
                      <div>
                        {getStatusDisplay(item.reservation.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Users className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">{tc("عدد الضيوف", "Guests")}</p>
                          <p className="font-semibold">{item.reservation.numberOfGuests} {tc("ضيف", "guests")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">{tc("الموعد", "Date")}</p>
                          <p className="font-semibold">{formatDate(item.reservation.reservationDate)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">{tc("الساعة", "Time")}</p>
                          <p className="font-semibold">{item.reservation.reservationTime}</p>
                        </div>
                      </div>

                      {isReservationActive(item.reservation) && item.reservation.autoExpiryTime && (
                        <div className="flex items-center gap-2 text-orange-700">
                          <Clock3 className="w-5 h-5 text-orange-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-600">{tc("ينتهي في", "Expires at")}</p>
                            <p className="font-semibold text-orange-600">
                              {formatTime(item.reservation.autoExpiryTime)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {item.reservation.extensionCount > 0 && (
                      <div className="flex items-center gap-2 text-green-700 pt-2 border-t">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                        <p className="text-sm">{tc("تم تمديد الحجز", "Reservation extended")}</p>
                      </div>
                    )}

                    {canExtend(item.reservation) && (
                      <div className="pt-4 border-t">
                        <Button
                          onClick={() => extendMutation.mutate(item.tableId)}
                          disabled={extendMutation.isPending}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          data-testid={`button-extend-${item.tableId}`}
                        >
                          {extendMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              {tc("جاري التمديد...", "Extending...")}
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 ml-2" />
                              {tc("تمديد الحجز لساعة إضافية", "Extend reservation by one hour")}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {item.reservation.status === 'expired' && (
                      <div className="pt-4 border-t bg-gray-50 p-3 rounded text-center">
                        <p className="text-sm text-gray-700">{tc("انتهت صلاحية هذا الحجز", "This reservation has expired")}</p>
                      </div>
                    )}

                    {item.reservation.status === 'cancelled' && (
                      <div className="pt-4 border-t bg-red-50 p-3 rounded text-center">
                        <p className="text-sm text-red-700">{tc("تم إلغاء هذا الحجز", "This reservation has been cancelled")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : null}
        </div>
        )}
      </div>
    </div>
  );
}
