import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, User, Phone, Plus, Edit2, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import { useTranslate } from "@/lib/useTranslate";

export default function ManagerDrivers() {
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Employee | null>(null);
  const { toast } = useToast();
  const tc = useTranslate();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const drivers = employees.filter(emp => emp.role === "driver");

  const createDriverMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsAddDialogOpen(false);
      toast({ title: tc("تم الإضافة", "Added"), description: tc("تم إضافة السائق بنجاح", "Driver added successfully") });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: tc("فشل الإضافة", "Add Failed"), description: error.message || tc("حدث خطأ أثناء إضافة السائق", "An error occurred while adding the driver") });
    },
  });

  const updateDriverMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const res = await apiRequest("PUT", `/api/employees/${data.id}`, data.updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsEditDialogOpen(false);
      setEditingDriver(null);
      toast({ title: tc("تم التحديث", "Updated"), description: tc("تم تحديث معلومات السائق بنجاح", "Driver information updated successfully") });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: tc("فشل التحديث", "Update Failed"), description: error.message || tc("حدث خطأ أثناء تحديث السائق", "An error occurred while updating the driver") });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: number }) => {
      const res = await apiRequest("PUT", `/api/employees/${id}`, { isAvailableForDelivery: isAvailable });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: tc("تم التحديث", "Updated"), description: tc("تم تحديث حالة توفر السائق", "Driver availability updated") });
    },
  });

  const handleSubmitNewDriver = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createDriverMutation.mutate({
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      fullName: formData.get("fullName") as string,
      phone: formData.get("phone") as string,
      role: "driver",
      jobTitle: tc("سائق توصيل", "Delivery Driver"),
      vehicleType: formData.get("vehicleType") as string,
      vehiclePlateNumber: formData.get("vehiclePlateNumber") as string,
      vehicleColor: formData.get("vehicleColor") as string,
      licenseNumber: formData.get("licenseNumber") as string,
      isAvailableForDelivery: 1,
      isActivated: 1,
    });
  };

  const handleSubmitEditDriver = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDriver) return;
    const formData = new FormData(e.currentTarget);
    updateDriverMutation.mutate({
      id: editingDriver.id,
      updates: {
        fullName: formData.get("fullName") as string,
        phone: formData.get("phone") as string,
        vehicleType: formData.get("vehicleType") as string,
        vehiclePlateNumber: formData.get("vehiclePlateNumber") as string,
        vehicleColor: formData.get("vehicleColor") as string,
        licenseNumber: formData.get("licenseNumber") as string,
      }
    });
  };

  const handleEdit = (driver: Employee) => { setEditingDriver(driver); setIsEditDialogOpen(true); };
  const handleToggleAvailability = (driver: Employee) => {
    toggleAvailabilityMutation.mutate({ id: driver.id, isAvailable: driver.isAvailableForDelivery === 1 ? 0 : 1 });
  };

  const DriverFormFields = ({ prefix = "", defaults }: { prefix?: string; defaults?: Employee }) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}fullName`} className="text-gray-300">{tc("الاسم الكامل *", "Full Name *")}</Label>
          <Input id={`${prefix}fullName`} name="fullName" defaultValue={defaults?.fullName} required className="bg-[#1a1410] border-primary/30 text-white" data-testid={`input-${prefix}fullname`} />
        </div>
        <div>
          <Label htmlFor={`${prefix}phone`} className="text-gray-300">{tc("رقم الهاتف *", "Phone Number *")}</Label>
          <Input id={`${prefix}phone`} name="phone" type="tel" defaultValue={defaults?.phone} required placeholder="05xxxxxxxx" className="bg-[#1a1410] border-primary/30 text-white" data-testid={`input-${prefix}phone`} />
        </div>
      </div>
      {!defaults && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username" className="text-gray-300">{tc("اسم المستخدم *", "Username *")}</Label>
            <Input id="username" name="username" required className="bg-[#1a1410] border-primary/30 text-white" data-testid="input-username" />
          </div>
          <div>
            <Label htmlFor="password" className="text-gray-300">{tc("كلمة المرور *", "Password *")}</Label>
            <Input id="password" name="password" type="password" required className="bg-[#1a1410] border-primary/30 text-white" data-testid="input-password" />
          </div>
        </div>
      )}
      <div className="border-t border-primary/20 pt-4">
        <h3 className="text-accent font-semibold mb-3">{tc("معلومات المركبة", "Vehicle Information")}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${prefix}vehicleType`} className="text-gray-300">{tc("نوع المركبة *", "Vehicle Type *")}</Label>
            <Select name="vehicleType" defaultValue={defaults?.vehicleType} required>
              <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid={`select-${prefix}vehicle-type`}>
                <SelectValue placeholder={tc("اختر نوع المركبة", "Select vehicle type")} />
              </SelectTrigger>
              <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
                <SelectItem value="سيارة">{tc("سيارة", "Car")}</SelectItem>
                <SelectItem value="دراجة نارية">{tc("دراجة نارية", "Motorcycle")}</SelectItem>
                <SelectItem value="دراجة كهربائية">{tc("دراجة كهربائية", "E-Bike")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${prefix}vehicleColor`} className="text-gray-300">{tc("لون المركبة *", "Vehicle Color *")}</Label>
            <Input id={`${prefix}vehicleColor`} name="vehicleColor" defaultValue={defaults?.vehicleColor} required placeholder={tc("مثال: أبيض", "e.g. White")} className="bg-[#1a1410] border-primary/30 text-white" data-testid={`input-${prefix}vehicle-color`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor={`${prefix}vehiclePlateNumber`} className="text-gray-300">{tc("رقم اللوحة *", "Plate Number *")}</Label>
            <Input id={`${prefix}vehiclePlateNumber`} name="vehiclePlateNumber" defaultValue={defaults?.vehiclePlateNumber} required placeholder="ABC 1234" className="bg-[#1a1410] border-primary/30 text-white font-mono" data-testid={`input-${prefix}plate-number`} />
          </div>
          <div>
            <Label htmlFor={`${prefix}licenseNumber`} className="text-gray-300">{tc("رقم الرخصة", "License Number")}</Label>
            <Input id={`${prefix}licenseNumber`} name="licenseNumber" defaultValue={defaults?.licenseNumber} className="bg-[#1a1410] border-primary/30 text-white font-mono" data-testid={`input-${prefix}license-number`} />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4" dir="rtl">
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-accent">{tc("إدارة السائقين", "Driver Management")}</h1>
              <p className="text-gray-400 text-sm">{tc("إضافة وتعديل حسابات السائقين", "Add and edit driver accounts")}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-green-500 to-green-700" data-testid="button-add-driver">
              <Plus className="w-4 h-4 ml-2" />
              {tc("إضافة سائق جديد", "Add New Driver")}
            </Button>
            <Button variant="outline" onClick={() => setLocation("/manager/dashboard")} className="border-primary/50 text-accent hover:bg-primary hover:text-white" data-testid="button-back">
              <ArrowRight className="w-4 h-4 ml-2" />
              {tc("العودة", "Back")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <Card className="bg-[#2d1f1a] border-primary/20">
            <CardContent className="p-12 text-center">
              <Truck className="w-12 h-12 animate-pulse mx-auto mb-4 text-accent" />
              <p className="text-gray-400">{tc("جاري تحميل السائقين...", "Loading drivers...")}</p>
            </CardContent>
          </Card>
        ) : drivers.length === 0 ? (
          <Card className="bg-[#2d1f1a] border-primary/20">
            <CardContent className="p-12 text-center">
              <Truck className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">{tc("لا يوجد سائقين مسجلين", "No drivers registered")}</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="mt-4 bg-gradient-to-r from-green-500 to-green-700">
                <Plus className="w-4 h-4 ml-2" />
                {tc("إضافة أول سائق", "Add First Driver")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {drivers.map((driver) => (
              <Card key={driver.id} className="bg-[#2d1f1a] border-primary/20">
                <CardHeader>
                  <CardTitle className="text-accent text-right flex items-center justify-between">
                    <span className="flex items-center gap-2"><User className="w-5 h-5" />{driver.fullName}</span>
                    <Badge className={driver.isAvailableForDelivery === 1 ? "bg-green-500" : "bg-gray-500"} data-testid={`badge-status-${driver.id}`}>
                      {driver.isAvailableForDelivery === 1 ? tc("متاح", "Available") : tc("غير متاح", "Unavailable")}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-300"><Phone className="w-4 h-4 text-accent" /><span className="text-sm" dir="ltr">{driver.phone}</span></div>
                    <div className="flex items-center gap-2 text-gray-300"><Truck className="w-4 h-4 text-accent" /><span className="text-sm">{driver.vehicleType} - {driver.vehicleColor}</span></div>
                    <div className="bg-[#1a1410] p-2 rounded-lg">
                      <p className="text-xs text-gray-400">{tc("لوح المركبة", "Plate Number")}</p>
                      <p className="text-white font-mono font-semibold" data-testid={`text-plate-${driver.id}`}>{driver.vehiclePlateNumber}</p>
                    </div>
                    {driver.licenseNumber && (
                      <div className="bg-[#1a1410] p-2 rounded-lg">
                        <p className="text-xs text-gray-400">{tc("رقم الرخصة", "License Number")}</p>
                        <p className="text-white font-mono" data-testid={`text-license-${driver.id}`}>{driver.licenseNumber}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-primary/20">
                    <Button size="sm" variant="outline" onClick={() => handleToggleAvailability(driver)}
                      className={`flex-1 ${driver.isAvailableForDelivery === 1 ? "border-green-500/30 text-green-500" : "border-gray-500/30 text-gray-500"}`}
                      disabled={toggleAvailabilityMutation.isPending} data-testid={`button-toggle-${driver.id}`}
                    >
                      {driver.isAvailableForDelivery === 1 ? (<><CheckCircle className="w-4 h-4 ml-1" />{tc("متاح", "Available")}</>) : (<><XCircle className="w-4 h-4 ml-1" />{tc("غير متاح", "Unavailable")}</>)}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(driver)} className="border-blue-500/30 text-blue-500" data-testid={`button-edit-${driver.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-accent">{tc("إضافة سائق جديد", "Add New Driver")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitNewDriver} className="space-y-4">
            <DriverFormFields />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-gray-600 text-gray-300" data-testid="button-cancel">{tc("إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={createDriverMutation.isPending} className="bg-gradient-to-r from-green-500 to-green-700" data-testid="button-submit">
                {createDriverMutation.isPending ? tc("جاري الإضافة...", "Adding...") : tc("إضافة السائق", "Add Driver")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-accent">{tc("تعديل معلومات السائق", "Edit Driver Information")}</DialogTitle></DialogHeader>
          {editingDriver && (
            <form onSubmit={handleSubmitEditDriver} className="space-y-4">
              <DriverFormFields prefix="edit-" defaults={editingDriver} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingDriver(null); }} className="border-gray-600 text-gray-300" data-testid="button-edit-cancel">{tc("إلغاء", "Cancel")}</Button>
                <Button type="submit" disabled={updateDriverMutation.isPending} className="bg-gradient-to-r from-blue-500 to-blue-700" data-testid="button-edit-submit">
                  {updateDriverMutation.isPending ? tc("جاري التحديث...", "Updating...") : tc("تحديث المعلومات", "Update Information")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
