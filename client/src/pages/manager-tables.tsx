import { useState, useRef, useEffect } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table as TableIcon, Plus, Trash2, Download, QrCode, Power, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableQRCard, downloadQRCard } from "@/components/table-qr-card";

interface ITable {
  id: string;
  tableNumber: string;
  qrToken: string;
  branchId?: string;
  isActive: number;
  isOccupied: number;
  currentOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IBranch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  city: string;
  isActive: number;
  managerName?: string;
}

export default function ManagerTables() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [bulkCount, setBulkCount] = useState("10");
  const [selectedBranch, setSelectedBranch] = useState<string>("none");
  const [selectedTable, setSelectedTable] = useState<ITable | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [currentBranchName, setCurrentBranchName] = useState<string>("");
  const [currentBranchManager, setCurrentBranchManager] = useState<string>("");
  const [userBranchId, setUserBranchId] = useState<string>("");
  const qrCardRef = useRef<HTMLCanvasElement>(null);

  // Get current user's branch from localStorage
  useEffect(() => {
    const employeeData = localStorage.getItem("currentEmployee");
    if (employeeData) {
      const employee = JSON.parse(employeeData);
      setUserBranchId(employee.branchId || "");
    }
  }, []);

  // Fetch branches
  const { data: branches } = useQuery<IBranch[]>({
    queryKey: ["/api/branches"],
  });

  // Auto-select branch if user has a branchId or there's only one branch
  useEffect(() => {
    if (branches && branches.length > 0 && selectedBranch === "none") {
      if (userBranchId) {
        const userBranch = branches.find(b => b.id === userBranchId);
        if (userBranch) {
          setSelectedBranch(userBranch.id);
        }
      } else if (branches.length === 1) {
        setSelectedBranch(branches[0].id);
      }
    }
  }, [branches, userBranchId, selectedBranch]);

  // Update branch manager info when selectedBranch changes
  useEffect(() => {
    if (selectedBranch !== "none" && selectedBranch && branches) {
      const branch = branches.find(b => b.id === selectedBranch);
      if (branch) {
        setCurrentBranchName(branch.nameAr);
        setCurrentBranchManager(branch.managerName || "غير محدد");
      }
    }
  }, [selectedBranch, branches]);

  // Fetch tables - filter by selected branch
  const { data: tables = [], isLoading, refetch } = useQuery<ITable[]>({
    queryKey: ["/api/tables", selectedBranch],
    queryFn: async () => {
      let url = "/api/tables";
      if (selectedBranch && selectedBranch !== "none") {
        url += `?branchId=${selectedBranch}`;
      }
      
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      const tenantId = employee?.tenantId || 'demo-tenant';

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': tenantId,
          'Cache-Control': 'no-cache'
        },
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tables (${response.status})`);
      }
      
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    // Add interval to ensure UI stays updated
    refetchInterval: 15000, 
  });

  // Create single table mutation
  const createTableMutation = useMutation({
    mutationFn: async (tableNumber: string) => {
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      const tenantId = employee?.tenantId || 'demo-tenant';

      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({ tableNumber, branchId: selectedBranch }),
      });
      if (!response.ok) throw new Error("Failed to create table");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: tc("تم إنشاء الطاولة", "Table created"),
        description: tc("تم إنشاء الطاولة بنجاح", "Table was created successfully"),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل إنشاء الطاولة", "Failed to create table"),
        variant: "destructive",
      });
    },
  });

  // Bulk create tables mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async ({ count, branchId }: { count: number; branchId: string }) => {
      console.log("Bulk creating tables:", { count, branchId });
      
      const employeeData = localStorage.getItem("currentEmployee");
      const employee = employeeData ? JSON.parse(employeeData) : null;
      const tenantId = employee?.tenantId || 'demo-tenant';

      const response = await fetch("/api/tables/bulk-create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({ count, branchId }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Bulk create error response:", error);
        throw new Error(error.error || "Failed to bulk create tables");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log("Bulk create success data:", data);
      
      // Invalidate the queries to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      
      const createdCount = data.details?.created?.length || data.results?.created?.length || 0;
      toast({
        title: tc("تم إنشاء الطاولات", "Tables created"),
        description: `${tc("تم إنشاء", "Created")} ${createdCount} ${tc("طاولة بنجاح", "tables successfully")}`,
      });
      setBulkCount("10");
      
      // Explicitly refetch the tables for the current branch to be sure
      refetch();
    },
    onError: (error: Error) => {
      console.error("Bulk create mutation error:", error);
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل إنشاء الطاولات", "Failed to create tables"),
        variant: "destructive",
      });
    },
  });

  const getStoredTenantId = () => {
    try {
      const emp = localStorage.getItem("currentEmployee");
      return emp ? JSON.parse(emp)?.tenantId || 'demo-tenant' : 'demo-tenant';
    } catch { return 'demo-tenant'; }
  };

  // Toggle table active status mutation
  const toggleActiveStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}/toggle-active`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": getStoredTenantId()
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle table status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: tc("تم تحديث الحالة", "Status updated"),
        description: tc("تم تحديث حالة الطاولة بنجاح", "Table status updated successfully"),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل تحديث حالة الطاولة", "Failed to update table status"),
        variant: "destructive",
      });
    },
  });

  // Empty table mutation
  const emptyTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}/empty`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-tenant-id": getStoredTenantId()
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to empty table");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: tc("تم إفراغ الطاولة", "Table emptied"),
        description: tc("الطاولة الآن متاحة للزبائن الجدد", "Table is now available for new customers"),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل إفراغ الطاولة", "Failed to empty table"),
        variant: "destructive",
      });
    },
  });

  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": getStoredTenantId()
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete table");
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: tc("تم حذف الطاولة", "Table deleted"),
        description: tc("تم حذف الطاولة بنجاح", "Table was deleted successfully"),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل حذف الطاولة", "Failed to delete table"),
        variant: "destructive",
      });
    },
  });

  // Get QR code for table
  const getQRCodeMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const response = await fetch(`/api/tables/${tableId}/qr-code`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get QR code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("QR Code loaded:", data);
      setQrCodeData(data);
      setQrDialogOpen(true);
    },
    onError: (error: Error) => {
      console.error("QR Code error:", error);
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل تحميل رمز QR", "Failed to load QR code"),
        variant: "destructive",
      });
    },
  });

  const handleBulkCreate = () => {
    const count = parseInt(bulkCount);
    if (isNaN(count) || count < 1 || count > 100) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("يجب أن يكون العدد بين 1 و 100", "Count must be between 1 and 100"),
        variant: "destructive",
      });
      return;
    }
    if (!selectedBranch || selectedBranch === "none") {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("يجب اختيار الفرع أولاً", "Please select a branch first"),
        variant: "destructive",
      });
      return;
    }
    bulkCreateMutation.mutate({ count, branchId: selectedBranch });
  };

  const handleViewQR = (table: ITable) => {
    setSelectedTable(table);
    getQRCodeMutation.mutate(table.id);
  };

  const handleDownloadQRCode = () => {
    if (!selectedTable || !qrCardRef.current) return;
    downloadQRCard(qrCardRef.current, selectedTable.tableNumber);
  };

  const deleteAllTablesMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await fetch(`/api/tables/branch/${branchId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete all tables");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "تم الحذف",
        description: data.message || "تم حذف جميع الطاولات بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل حذف جميع الطاولات",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAll = () => {
    if (!selectedBranch || selectedBranch === "none") return;
    if (window.confirm(tc("هل أنت متأكد من رغبتك في حذف جميع طاولات هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to delete all tables in this branch? This action cannot be undone."))) {
      deleteAllTablesMutation.mutate(selectedBranch);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TableIcon className="w-8 h-8" />
              {tc("إدارة الطاولات", "Table Management")}
            </h1>
            <p className="text-muted-foreground">{tc("إدارة طاولات المقهى وإنشاء رموز QR", "Manage cafe tables and generate QR codes")}</p>
          </div>
          <Button variant="outline" className="" onClick={() => setLocation("/manager/dashboard")}>
            {tc("العودة للوحة التحكم", "Back to Dashboard")}
          </Button>
        </div>

        {/* Bulk Create Section */}
        <Card>
          <CardHeader>
            <CardTitle>{tc("إنشاء طاولات جديدة", "Create New Tables")}</CardTitle>
            <CardDescription>{tc("أنشئ طاولات متعددة دفعة واحدة", "Create multiple tables at once")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="branch">{tc("اختر الفرع", "Select Branch")}</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder={tc("اختر الفرع", "Select branch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="bulkCount">{tc("عدد الطاولات", "Number of Tables")}</Label>
                <Input
                  id="bulkCount"
                  type="number"
                  min="1"
                  max="100"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                  placeholder="مثال: 10"
                  data-testid="input-bulk-count"
                />
              </div>
              <Button
                onClick={handleBulkCreate}
                disabled={bulkCreateMutation.isPending || !selectedBranch}
                data-testid="button-bulk-create"
              >
                <Plus className="w-4 h-4 ml-2" />
                {tc("إنشاء الطاولات", "Create Tables")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAll}
                disabled={deleteAllTablesMutation.isPending || !selectedBranch || tables.length === 0}
                data-testid="button-delete-all-tables"
              >
                <Trash2 className="w-4 h-4 ml-2" />
                {tc("حذف الكل", "Delete All")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle>{tc("الطاولات الحالية", "Current Tables")} ({tables?.length || 0})</CardTitle>
            <CardDescription>
              {selectedBranch 
                ? tc("طاولات الفرع المختار", "Tables for selected branch")
                : tc("اختر فرعاً لعرض الطاولات", "Select a branch to view tables")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">{tc("جاري التحميل...", "Loading...")}</div>
            ) : !tables || tables.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                {selectedBranch && userBranchId && selectedBranch !== userBranchId ? (
                  <div className="text-muted-foreground">
                    <div className="text-lg font-semibold text-red-600 mb-2">
                      ⛔ {tc("أنت لست مدير هذا الفرع", "You are not the manager of this branch")}
                    </div>
                    <div className="space-y-1">
                      <p><span className="font-semibold">{tc("الفرع:", "Branch:")}</span> {currentBranchName}</p>
                      <p><span className="font-semibold">{tc("مدير الفرع:", "Branch Manager:")}</span> {currentBranchManager}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    {tc("لا توجد طاولات. أنشئ طاولات جديدة للبدء.", "No tables found. Create new tables to get started.")}
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{tc("رقم الطاولة", "Table #")}</TableHead>
                    <TableHead className="text-right">{tc("الحالة", "Status")}</TableHead>
                    <TableHead className="text-right">{tc("حالة الإشغال", "Occupancy")}</TableHead>
                    <TableHead className="text-right">{tc("الإجراءات", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow key={table.id}>
                      <TableCell className="font-medium">
                        {tc("طاولة", "Table")} {table.tableNumber}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={table.isActive ? "default" : "outline"}
                          onClick={() => toggleActiveStatusMutation.mutate(table.id)}
                          disabled={toggleActiveStatusMutation.isPending}
                          className="w-full justify-center"
                          data-testid={`button-toggle-active-${table.tableNumber}`}
                        >
                          <Power className="w-3 h-3 ml-1" />
                          {table.isActive ? tc("نشطة", "Active") : tc("غير نشطة", "Inactive")}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${table.isOccupied ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          {table.isOccupied ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="bg-red-600 hover:bg-red-700">{tc("محجوزة", "Occupied")}</Badge>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 px-2 text-xs"
                                onClick={() => emptyTableMutation.mutate(table.id)}
                                disabled={emptyTableMutation.isPending}
                              >
                                {tc("إفراغ", "Empty")}
                              </Button>
                            </div>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">{tc("متاحة", "Available")}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewQR(table)}
                            data-testid={`button-qr-${table.tableNumber}`}
                          >
                            <QrCode className="w-4 h-4 ml-1" />
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newNum = window.prompt(tc("أدخل رقم الطاولة الجديد:", "Enter new table number:"), table.tableNumber);
                              if (newNum && newNum !== table.tableNumber) {
                                apiRequest("PATCH", `/api/tables/${table.id}`, { tableNumber: newNum })
                                  .then(() => {
                                    queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
                                    toast({ title: tc("تم التحديث", "Updated"), description: tc("تم تغيير رقم الطاولة بنجاح", "Table number changed successfully") });
                                  })
                                  .catch((error) => {
                                    toast({ 
                                      title: tc("خطأ", "Error"), 
                                      description: tc("فشل تحديث الطاولة", "Failed to update table"), 
                                      variant: "destructive" 
                                    });
                                  });
                              }
                            }}
                            data-testid={`button-edit-${table.tableNumber}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm(`${tc("هل أنت متأكد من حذف الطاولة", "Are you sure you want to delete table")} ${table.tableNumber}?`)) {
                                deleteTableMutation.mutate(table.id);
                              }
                            }}
                            disabled={deleteTableMutation.isPending || table.isOccupied === 1}
                            title={table.isOccupied === 1 ? tc("لا يمكن حذف طاولة مشغولة", "Cannot delete an occupied table") : tc("حذف الطاولة", "Delete table")}
                            data-testid={`button-delete-${table.tableNumber}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader>
              <DialogTitle>
                {tc("بطاقة QR للطاولة", "QR Card for Table")} {selectedTable?.tableNumber}
              </DialogTitle>
              <DialogDescription>
                {tc("اطبع أو احفظ هذه البطاقة لوضعها على الطاولة", "Print or save this card to place on the table")}
              </DialogDescription>
            </DialogHeader>
            {qrCodeData && selectedTable && (
              <div className="space-y-4">
                <TableQRCard
                  tableNumber={selectedTable.tableNumber}
                  qrToken={qrCodeData.qrToken}
                  branchName={qrCodeData.branchName}
                  tableUrl={qrCodeData.tableUrl}
                />
                <div className="space-y-2">
                  <p className="text-xs text-center text-muted-foreground break-all">
                    {qrCodeData.tableUrl}
                  </p>
                </div>
                <Button
                  onClick={handleDownloadQRCode}
                  className="w-full"
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4 ml-2" />
                  {tc("تحميل البطاقة", "Download Card")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
