import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, ArrowLeft, Send, History, Warehouse, BarChart3, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";

export default function WarehouseManagementPage() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [transferItems, setTransferItems] = useState([{ ingredientId: "", quantity: 0, unit: "g" }]);

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
  });

  const transferMutation = useMutation({
    mutationFn: async (transfer: any) => {
      const res = await apiRequest("POST", "/api/warehouses/transfer", transfer);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: tc("تم بدء عملية التحويل بنجاح", "Transfer process started successfully"), className: "bg-green-600 text-white" });
    },
  });

  return (
    <PlanGate feature="warehouseManagement">
    <div className="p-6 space-y-6 bg-background min-h-screen" dir="rtl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/manager")} className="hover:bg-primary/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">{tc("إدارة المستودعات المركزية", "Central Warehouse Management")}</h1>
          <p className="text-muted-foreground">{tc("تتبع المخزون وإدارة التحويلات بين الفروع والمخازن", "Track inventory and manage transfers between branches and warehouses")}</p>
        </div>
        <Warehouse className="h-10 w-10 text-primary mr-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Summary */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Warehouse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tc("إجمالي المستودعات", "Total Warehouses")}</p>
              <p className="text-2xl font-bold">{warehouses.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <LayoutDashboard className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tc("الفروع النشطة", "Active Branches")}</p>
              <p className="text-2xl font-bold">{branches.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tc("تحويلات معلقة", "Pending Transfers")}</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Send className="w-5 h-5 text-primary" /> طلب تحويل جديد
            </CardTitle>
            <CardDescription>{tc("نقل المواد الخام بين المستودعات والفروع", "Transfer raw materials between warehouses and branches")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tc("من مستودع", "From Warehouse")}</Label>
                <Select onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue placeholder={tc("اختر المصدر", "Select Source")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.nameAr}</SelectItem>
                    ))}
                    {warehouses.length === 0 && <SelectItem value="demo">{tc("مستودع تجريبي", "Demo Warehouse")}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tc("إلى فرع / مستودع", "To Branch / Warehouse")}</Label>
                <Select onValueChange={setSelectedTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder={tc("اختر الوجهة", "Select Destination")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.nameAr}</SelectItem>
                    ))}
                    {branches.length === 0 && <SelectItem value="demo-branch">{tc("فرع تجريبي", "Demo Branch")}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tc("الأصناف المراد تحويلها", "Items to Transfer")}</Label>
              {transferItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input placeholder={tc("اسم الصنف أو المعرف", "Item name or ID")} className="flex-1" />
                  <Input type="number" placeholder={tc("الكمية", "Quantity")} className="w-24" />
                  <Button variant="outline" size="icon" onClick={() => {
                    const newItems = [...transferItems];
                    newItems.splice(index, 1);
                    setTransferItems(newItems);
                  }}>×</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setTransferItems([...transferItems, { ingredientId: "", quantity: 0, unit: "g" }])}>
                + إضافة صنف آخر
              </Button>
            </div>

            <Button className="w-full" size="lg" onClick={() => transferMutation.mutate({
              fromWarehouseId: selectedSource,
              toWarehouseId: selectedTarget,
              items: transferItems
            })}>
              تأكيد وبدء التحويل
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="w-5 h-5 text-primary" /> سجل التحويلات والمخزون
            </CardTitle>
            <CardDescription>{tc("متابعة حالة الشحنات وتوافر المخزون عبر الشبكة", "Track shipment status and inventory across the network")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 border rounded-lg p-8 bg-muted/20 flex flex-col items-center justify-center text-center">
              <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">{tc("لا توجد عمليات تحويل حالية", "No current transfer operations")}</p>
              <p className="text-sm text-muted-foreground">{tc("سيظهر تاريخ عمليات النقل هنا فور بدئها", "Transfer history will appear here once started")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </PlanGate>
  );
}
