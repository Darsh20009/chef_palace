import { useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coffee, Calendar, User, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

interface Branch {
  id: string;
  nameAr: string;
  city: string;
  address: string;
  phone: string;
}

interface Table {
  id: string;
  tableNumber: string;
  branchId: string;
  isOccupied: number;
  isActive: number;
  reservedFor?: {
    customerName: string;
    customerPhone: string;
  };
}

export default function TableReservation() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedBranch, setSelectedBranch] = useState("none");
  const [selectedTable, setSelectedTable] = useState("none");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [numberOfGuests, setNumberOfGuests] = useState("2");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["/api/tables"],
  });

  const availableTables = tables.filter(
    (table) =>
      table.branchId === selectedBranch &&
      table.isActive === 1 &&
      table.isOccupied === 0 &&
      !table.reservedFor
  );

  const reserveTableMutation = useMutation({
    mutationFn: async (data: {
      tableId: string;
      customerName: string;
      customerPhone: string;
      reservationDate: string;
      reservationTime: string;
      numberOfGuests: number;
      branchId: string;
    }) => {
      // First create the appointment in the new system
      const appointmentResponse = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: data.branchId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          appointmentDate: `${data.reservationDate}T${data.reservationTime}`,
          numberOfPeople: data.numberOfGuests,
          serviceType: 'table',
          notes: `Table ${data.tableId}`
        }),
      });

      if (!appointmentResponse.ok) {
        throw new Error(tc("فشل تسجيل الموعد في النظام الجديد", "Failed to register appointment in new system"));
      }

      // Then call the legacy table reservation for compatibility
      const response = await fetch("/api/tables/customer-reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: data.tableId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          reservationDate: data.reservationDate,
          reservationTime: data.reservationTime,
          numberOfGuests: data.numberOfGuests,
          branchId: data.branchId,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error || tc("فشل حجز الطاولة. حاول مرة أخرى", "Failed to reserve table. Try again.");
        throw new Error(errorMsg);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || tc("فشل حجز الطاولة. حاول مرة أخرى", "Failed to reserve table. Try again."));
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: tc("تم الحجز بنجاح", "Reservation Successful"),
        description: data.message || tc("تم حجز طاولتك بنجاح", "Your table has been reserved successfully"),
        className: "bg-green-600 text-white border-green-700",
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedBranch("none");
        setSelectedTable("none");
        setCustomerName("");
        setCustomerPhone("");
        setReservationDate("");
        setReservationTime("");
        setNumberOfGuests("2");
      }, 3000);
    },
    onError: (error: Error) => {
      const errorMsg = error.message || tc("فشل حجز الطاولة. حاول مرة أخرى", "Failed to reserve table. Try again.");
      console.error("Reservation error:", errorMsg);
      toast({
        title: tc("خطأ في الحجز", "Reservation Error"),
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const handleReserve = () => {
    if (!selectedBranch || !selectedTable || !customerName || !customerPhone || !reservationDate || !reservationTime || !numberOfGuests) {
      toast({
        title: tc("معلومات ناقصة", "Missing Information"),
        description: tc("الرجاء ملء جميع الحقول", "Please fill all fields"),
        variant: "destructive",
      });
      return;
    }

    if (customerPhone.length !== 9 || !customerPhone.startsWith("5")) {
      toast({
        title: tc("رقم جوال غير صحيح", "Invalid Phone Number"),
        description: tc("الرجاء إدخال رقم جوال صحيح يبدأ بـ 5 ويتكون من 9 أرقام", "Please enter a valid phone number starting with 5 and 9 digits"),
        variant: "destructive",
      });
      return;
    }

    const guests = parseInt(numberOfGuests);
    if (isNaN(guests) || guests < 1 || guests > 20) {
      toast({
        title: tc("عدد الضيوف غير صحيح", "Invalid Guest Count"),
        description: tc("الرجاء إدخال عدد صحيح من 1 إلى 20", "Please enter a valid number between 1 and 20"),
        variant: "destructive",
      });
      return;
    }

    reserveTableMutation.mutate({
      tableId: selectedTable,
      customerName,
      customerPhone,
      reservationDate,
      reservationTime,
      numberOfGuests: guests,
      branchId: selectedBranch,
    });
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-500">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4 animate-bounce">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-green-700 mb-3">{tc("تم الحجز بنجاح!", "Reservation Successful!")}</h2>
            <p className="text-lg text-muted-foreground mb-6">
              تم حجز طاولتك بنجاح. سنتواصل معك قريباً للتأكيد.
            </p>
            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
              <p className="text-sm text-green-800">
                سيتم إرسال رسالة تأكيد على الرقم {customerPhone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
            <Calendar className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{tc("حجز طاولة", "Table Reservation")}</h1>
          <p className="text-lg text-muted-foreground">
            احجز طاولتك المفضلة في أقرب فرع واستمتع بتجربة قهوة لا تُنسى
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coffee className="w-6 h-6 text-primary" />
              معلومات الحجز
            </CardTitle>
            <CardDescription className="text-base">
              اختر الفرع والطاولة واملأ معلوماتك
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                اختر الفرع *
              </Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue placeholder={tc("اختر الفرع", "Select Branch")} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.nameAr} - {branch.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBranch !== "none" && selectedBranch && (
              <div className="space-y-2 animate-in slide-in-from-top duration-500">
                <Label htmlFor="table" className="text-base flex items-center gap-2">
                  <Coffee className="w-4 h-4" />
                  اختر الطاولة *
                </Label>
                {availableTables.length === 0 ? (
                  <div className="text-center py-8 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground">
                      لا توجد طاولات متاحة في هذا الفرع حالياً
                    </p>
                  </div>
                ) : (
                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder={tc("اختر رقم الطاولة", "Select Table Number")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          طاولة رقم {table.tableNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {selectedTable !== "none" && selectedTable && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top duration-500">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      تاريخ الحجز *
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={reservationDate}
                      onChange={(e) => setReservationDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="h-12 text-lg"
                      data-testid="input-reservation-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time" className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      وقت الحجز *
                    </Label>
                    <Input
                      id="time"
                      type="time"
                      value={reservationTime}
                      onChange={(e) => setReservationTime(e.target.value)}
                      className="h-12 text-lg"
                      data-testid="input-reservation-time"
                    />
                  </div>
                </div>

                <div className="space-y-2 animate-in slide-in-from-top duration-500">
                  <Label htmlFor="guests" className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    عدد الضيوف *
                  </Label>
                  <Select value={numberOfGuests} onValueChange={setNumberOfGuests}>
                    <SelectTrigger className="h-12 text-lg" data-testid="select-guests">
                      <SelectValue placeholder="اختر عدد الضيوف" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? 'شخص' : num === 2 ? 'شخصين' : 'أشخاص'}
                        </SelectItem>
                      ))}
                      <SelectItem value="9">9 أشخاص</SelectItem>
                      <SelectItem value="10">10 أشخاص</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 animate-in slide-in-from-top duration-500">
                  <Label htmlFor="name" className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    الاسم *
                  </Label>
                  <Input
                    id="name"
                    placeholder="أدخل اسمك"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-12 text-lg"
                  />
                </div>

                <div className="space-y-2 animate-in slide-in-from-top duration-500">
                  <Label htmlFor="phone" className="text-base flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    رقم الجوال *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      placeholder="5xxxxxxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      maxLength={9}
                      className="h-12 text-lg flex-1"
                    />
                    <div className="flex items-center justify-center h-12 px-4 bg-muted rounded-md text-muted-foreground font-medium">
                      +966
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg animate-in slide-in-from-top duration-500">
                  <p className="text-sm text-muted-foreground">
                    سنتواصل معك على رقم الجوال لتأكيد الحجز
                  </p>
                </div>

                <Button
                  onClick={handleReserve}
                  disabled={reserveTableMutation.isPending}
                  className="w-full h-14 text-lg font-bold shadow-lg animate-in slide-in-from-bottom duration-500"
                >
                  {reserveTableMutation.isPending ? "جاري الحجز..." : "تأكيد الحجز"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}
