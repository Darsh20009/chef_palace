import { useState } from "react";
import { tc } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Search,
  Phone,
  Mail,
  MapPin,
  Loader2
} from "lucide-react";

interface Supplier {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: number;
}

export default function InventorySuppliersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    nameAr: "",
    nameEn: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    taxNumber: "",
    paymentTerms: "",
    notes: "",
  });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/inventory/suppliers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/inventory/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/suppliers"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: tc("تم إضافة المورد بنجاح", "Supplier added successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في إضافة المورد", "Failed to add supplier"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      apiRequest("PUT", `/api/inventory/suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/suppliers"] });
      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      resetForm();
      toast({ title: tc("تم تحديث المورد بنجاح", "Supplier updated successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في تحديث المورد", "Failed to update supplier"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/suppliers"] });
      toast({ title: tc("تم حذف المورد بنجاح", "Supplier deleted successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في حذف المورد", "Failed to delete supplier"), variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      nameAr: "",
      nameEn: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      taxNumber: "",
      paymentTerms: "",
      notes: "",
    });
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      code: supplier.code,
      nameAr: supplier.nameAr,
      nameEn: supplier.nameEn || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone,
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      taxNumber: supplier.taxNumber || "",
      paymentTerms: supplier.paymentTerms || "",
      notes: supplier.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(tc("هل أنت متأكد من حذف هذا المورد؟", "Are you sure you want to delete this supplier?"))) {
      deleteMutation.mutate(id);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    return (
      supplier.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      supplier.phone.includes(searchQuery)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">{tc("الموردين", "Suppliers")}</h1>
            <p className="text-muted-foreground text-sm">{tc("إدارة الموردين والشركات المتعاملة", "Manage suppliers and partner companies")}</p>
          </div>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-supplier">
          <Plus className="h-4 w-4 ml-2" />
          إضافة مورد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tc("بحث بالاسم أو الكود أو رقم الهاتف...", "Search by name, code or phone...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="input-search-suppliers"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">{tc("الكود", "Code")}</TableHead>
                  <TableHead className="text-right">{tc("الاسم", "Name")}</TableHead>
                  <TableHead className="text-right">{tc("جهة الاتصال", "Contact")}</TableHead>
                  <TableHead className="text-right">{tc("الهاتف", "Phone")}</TableHead>
                  <TableHead className="text-right">{tc("المدينة", "City")}</TableHead>
                  <TableHead className="text-right">{tc("الإجراءات", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا يوجد موردين
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                      <TableCell className="font-mono">{supplier.code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{supplier.nameAr}</div>
                          {supplier.nameEn && (
                            <div className="text-sm text-muted-foreground">{supplier.nameEn}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.contactPerson || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {supplier.phone}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.city || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(supplier)}
                            data-testid={`button-edit-${supplier.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(supplier.id)}
                            data-testid={`button-delete-${supplier.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{tc("إضافة مورد جديد", "Add New Supplier")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">{tc("الكود *", "Code *")}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="SUP-001"
                  data-testid="input-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameAr">{tc("الاسم بالعربي *", "Arabic Name *")}</Label>
                <Input
                  id="nameAr"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder={tc("شركة التوريد", "Supply Company")}
                  data-testid="input-name-ar"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nameEn">{tc("الاسم بالإنجليزي", "English Name")}</Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Supply Company"
                  data-testid="input-name-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">{tc("جهة الاتصال", "Contact Person")}</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder={tc("اسم المسؤول", "Manager name")}
                  data-testid="input-contact-person"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{tc("رقم الهاتف *", "Phone *")}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{tc("البريد الإلكتروني", "Email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">{tc("المدينة", "City")}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="الرياض"
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxNumber">{tc("الرقم الضريبي", "Tax Number")}</Label>
                <Input
                  id="taxNumber"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="XXXXXXXXX"
                  data-testid="input-tax-number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{tc("العنوان", "Address")}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={tc("العنوان الكامل", "Full address")}
                data-testid="input-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">{tc("شروط الدفع", "Payment Terms")}</Label>
              <Input
                id="paymentTerms"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                placeholder={tc("صافي 30 يوم", "Net 30 days")}
                data-testid="input-payment-terms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{tc("ملاحظات", "Notes")}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={tc("ملاحظات إضافية...", "Additional notes...")}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.code || !formData.nameAr || !formData.phone}
              data-testid="button-submit-add"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{tc("تعديل المورد", "Edit Supplier")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">{tc("الكود *", "Code *")}</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  data-testid="input-edit-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nameAr">{tc("الاسم بالعربي *", "Arabic Name *")}</Label>
                <Input
                  id="edit-nameAr"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  data-testid="input-edit-name-ar"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nameEn">{tc("الاسم بالإنجليزي", "English Name")}</Label>
                <Input
                  id="edit-nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  data-testid="input-edit-name-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactPerson">{tc("جهة الاتصال", "Contact Person")}</Label>
                <Input
                  id="edit-contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  data-testid="input-edit-contact-person"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">{tc("رقم الهاتف *", "Phone *")}</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{tc("البريد الإلكتروني", "Email")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">{tc("المدينة", "City")}</Label>
                <Input
                  id="edit-city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  data-testid="input-edit-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-taxNumber">{tc("الرقم الضريبي", "Tax Number")}</Label>
                <Input
                  id="edit-taxNumber"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  data-testid="input-edit-tax-number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">{tc("العنوان", "Address")}</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                data-testid="input-edit-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-paymentTerms">{tc("شروط الدفع", "Payment Terms")}</Label>
              <Input
                id="edit-paymentTerms"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                data-testid="input-edit-payment-terms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">{tc("ملاحظات", "Notes")}</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => selectedSupplier && updateMutation.mutate({ id: selectedSupplier.id, data: formData })}
              disabled={updateMutation.isPending || !formData.code || !formData.nameAr || !formData.phone}
              data-testid="button-submit-edit"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              تحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
