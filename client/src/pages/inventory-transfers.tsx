import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowRightLeft,
  Search,
  Eye,
  Check,
  X,
  Truck,
  Loader2,
  Trash2,
  Clock,
  CheckCircle2,
  PackageCheck,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { useTranslate, tc } from "@/lib/useTranslate";
import { ar } from "date-fns/locale";

interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: string;
  items: Array<{
    rawItemId: string;
    quantity: number;
    notes?: string;
  }>;
  requestedBy: string;
  approvedBy?: string;
  requestDate: string;
  approvalDate?: string;
  completionDate?: string;
  notes?: string;
  createdAt: string;
}

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  unit: string;
}

interface Branch {
  id?: string;
  nameAr: string;
}

const statusLabels: Record<string, { labelAr: string; labelEn: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { labelAr: "قيد الانتظار", labelEn: "Pending", variant: "secondary" },
  approved: { labelAr: "تمت الموافقة", labelEn: "Approved", variant: "default" },
  in_transit: { labelAr: "في الطريق", labelEn: "In Transit", variant: "outline" },
  completed: { labelAr: "مكتمل", labelEn: "Completed", variant: "default" },
  cancelled: { labelAr: "ملغي", labelEn: "Cancelled", variant: "destructive" },
};

export default function InventoryTransfersPage() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  const [formData, setFormData] = useState({
    fromBranchId: "",
    toBranchId: "",
    items: [] as Array<{ rawItemId: string; quantity: number; notes?: string }>,
    notes: "",
  });

  const [newItem, setNewItem] = useState({
    rawItemId: "",
    quantity: 1,
  });

  const { data: transfers = [], isLoading } = useQuery<StockTransfer[]>({
    queryKey: ["/api/inventory/transfers"],
  });

  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inventory/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/transfers"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: tc("تم إنشاء طلب التحويل بنجاح", "Transfer request created successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في إنشاء طلب التحويل", "Failed to create transfer request"), variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/transfers/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/transfers"] });
      toast({ title: "تمت الموافقة على التحويل" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في الموافقة على التحويل", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/transfers/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock"] });
      toast({ title: "تم إتمام التحويل وتحديث المخزون" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إتمام التحويل", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/inventory/transfers/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/transfers"] });
      toast({ title: "تم إلغاء التحويل" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "فشل في إلغاء التحويل", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      fromBranchId: "",
      toBranchId: "",
      items: [],
      notes: "",
    });
    setNewItem({ rawItemId: "", quantity: 1 });
  };

  const addItemToTransfer = () => {
    if (!newItem.rawItemId || newItem.quantity <= 0) return;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          rawItemId: newItem.rawItemId,
          quantity: newItem.quantity,
        },
      ],
    });

    setNewItem({ rawItemId: "", quantity: 1 });
  };

  const removeItemFromTransfer = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleView = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsViewDialogOpen(true);
  };

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch = transfer.transferNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statistics = {
    totalTransfers: transfers.length,
    pending: transfers.filter(t => t.status === 'pending').length,
    approved: transfers.filter(t => t.status === 'approved').length,
    completed: transfers.filter(t => t.status === 'completed').length,
    cancelled: transfers.filter(t => t.status === 'cancelled').length,
    totalItems: transfers.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0),
  };

  const getRawItemName = (id: string) => rawItems.find(r => r.id === id)?.nameAr || id;
  const getRawItemUnit = (id: string) => rawItems.find(r => r.id === id)?.unit || '';
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.nameAr || id;

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
          <ArrowRightLeft className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">{tc("تحويلات المخزون", "Stock Transfers")}</h1>
            <p className="text-muted-foreground text-sm">إدارة تحويلات المواد بين الفروع</p>
          </div>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-transfer">
          <Plus className="h-4 w-4 ml-2" />
          طلب تحويل جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">بانتظار الموافقة</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statistics.pending}</div>
            <p className="text-xs text-muted-foreground">طلب تحويل</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تمت الموافقة</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statistics.approved}</div>
            <p className="text-xs text-muted-foreground">في انتظار النقل</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مكتملة</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.completed}</div>
            <p className="text-xs text-muted-foreground">تحويل مكتمل</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الكميات</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalItems}</div>
            <p className="text-xs text-muted-foreground">وحدة محولة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم التحويل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-transfers"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الحالات", "All Statuses")}</SelectItem>
                {Object.entries(statusLabels).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{tc(cfg.labelAr, cfg.labelEn)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">{tc("رقم التحويل", "Transfer #")}</TableHead>
                  <TableHead className="text-right">من</TableHead>
                  <TableHead className="text-right">إلى</TableHead>
                  <TableHead className="text-right">عدد المواد</TableHead>
                  <TableHead className="text-right">{tc("الحالة", "Status")}</TableHead>
                  <TableHead className="text-right">{tc("التاريخ", "Date")}</TableHead>
                  <TableHead className="text-right">{tc("الإجراءات", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد تحويلات
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                      <TableCell className="font-mono">{transfer.transferNumber}</TableCell>
                      <TableCell>{getBranchName(transfer.fromBranchId)}</TableCell>
                      <TableCell>{getBranchName(transfer.toBranchId)}</TableCell>
                      <TableCell>{transfer.items.length}</TableCell>
                      <TableCell>
                        <Badge variant={statusLabels[transfer.status]?.variant || "secondary"}>
                          {tc(statusLabels[transfer.status]?.labelAr || transfer.status, statusLabels[transfer.status]?.labelEn || transfer.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(transfer.requestDate), "dd/MM/yyyy", { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleView(transfer)}
                            data-testid={`button-view-${transfer.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {transfer.status === "pending" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => approveMutation.mutate(transfer.id)}
                                disabled={approveMutation.isPending}
                                data-testid={`button-approve-${transfer.id}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => cancelMutation.mutate(transfer.id)}
                                disabled={cancelMutation.isPending}
                                data-testid={`button-cancel-${transfer.id}`}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {transfer.status === "approved" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => completeMutation.mutate(transfer.id)}
                              disabled={completeMutation.isPending}
                              data-testid={`button-complete-${transfer.id}`}
                            >
                              <Truck className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
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
            <DialogTitle>{tc("طلب تحويل جديد", "New Transfer Request")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>من الفرع *</Label>
                <Select
                  value={formData.fromBranchId}
                  onValueChange={(value) => setFormData({ ...formData, fromBranchId: value })}
                >
                  <SelectTrigger data-testid="select-from-branch">
                    <SelectValue placeholder="اختر الفرع المرسل" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id as string}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>إلى الفرع *</Label>
                <Select
                  value={formData.toBranchId}
                  onValueChange={(value) => setFormData({ ...formData, toBranchId: value })}
                >
                  <SelectTrigger data-testid="select-to-branch">
                    <SelectValue placeholder="اختر الفرع المستقبل" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter(b => b.id !== formData.fromBranchId)
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id as string}>
                          {branch.nameAr}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">المواد المحولة</h3>
              
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={newItem.rawItemId}
                  onValueChange={(value) => setNewItem({ ...newItem, rawItemId: value })}
                >
                  <SelectTrigger data-testid="select-raw-item">
                    <SelectValue placeholder="اختر المادة" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  placeholder="الكمية"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  data-testid="input-quantity"
                />
                <Button onClick={addItemToTransfer} data-testid="button-add-item">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formData.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">المادة</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{getRawItemName(item.rawItemId)}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeItemFromTransfer(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.fromBranchId || !formData.toBranchId || formData.items.length === 0}
              data-testid="button-submit"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              إنشاء الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{tc("تفاصيل التحويل", "Transfer Details")}</DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">رقم التحويل</Label>
                  <p className="font-mono font-medium">{selectedTransfer.transferNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <Badge variant={statusLabels[selectedTransfer.status]?.variant || "secondary"}>
                    {tc(statusLabels[selectedTransfer.status]?.labelAr, statusLabels[selectedTransfer.status]?.labelEn) || selectedTransfer.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">من الفرع</Label>
                  <p>{getBranchName(selectedTransfer.fromBranchId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">إلى الفرع</Label>
                  <p>{getBranchName(selectedTransfer.toBranchId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">تاريخ الطلب</Label>
                  <p>{format(new Date(selectedTransfer.requestDate), "dd/MM/yyyy HH:mm", { locale: ar })}</p>
                </div>
                {selectedTransfer.completionDate && (
                  <div>
                    <Label className="text-muted-foreground">تاريخ الإتمام</Label>
                    <p>{format(new Date(selectedTransfer.completionDate), "dd/MM/yyyy HH:mm", { locale: ar })}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">المادة</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">الوحدة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTransfer.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{getRawItemName(item.rawItemId)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-muted-foreground">{getRawItemUnit(item.rawItemId)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedTransfer.notes && (
                <div>
                  <Label className="text-muted-foreground">ملاحظات</Label>
                  <p>{selectedTransfer.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
