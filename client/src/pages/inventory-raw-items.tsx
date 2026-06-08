import { useTranslate, tc } from "@/lib/useTranslate";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import SarIcon from "@/components/sar-icon";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Search,
  Loader2,
  Coffee,
  Box,
  Wrench,
  Droplet,
  HelpCircle,
  CircleDollarSign,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const categoryLabels: Record<string, { labelAr: string; labelEn: string; icon: any; color: string }> = {
  ingredient: { 
    labelAr: "مكون", labelEn: "Ingredient", 
    icon: Coffee,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  packaging: { 
    labelAr: "تغليف", labelEn: "Packaging", 
    icon: Box,
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
  },
  equipment: { 
    labelAr: "معدات", labelEn: "Equipment", 
    icon: Wrench,
    color: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-card/30 dark:text-slate-300 dark:border-slate-700"
  },
  consumable: { 
    labelAr: "مستهلكات", labelEn: "Consumable", 
    icon: Droplet,
    color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
  },
  other: { 
    labelAr: "أخرى", labelEn: "Other", 
    icon: HelpCircle,
    color: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700"
  },
};

const unitLabels: Record<string, string> = {
  kg: "كيلوجرام",
  g: "جرام",
  liter: "لتر",
  ml: "ملليلتر",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

interface RawItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  category: string;
  unit: string;
  unitCost: number;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel?: number;
  supplierId?: string;
  isActive: number;
}

export default function InventoryRawItemsPage() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RawItem | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    nameAr: "",
    nameEn: "",
    description: "",
    category: "ingredient",
    unit: "g",
    unitCost: 0,
    minStockLevel: 0,
    maxStockLevel: 0,
  });

  const { data: rawItems = [], isLoading } = useQuery<RawItem[]>({
    queryKey: ["/api/inventory/raw-items"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/inventory/raw-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: tc("تم إضافة المادة الخام بنجاح", "Raw material added successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في إضافة المادة الخام", "Failed to add raw material"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      apiRequest("PUT", `/api/inventory/raw-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();
      toast({ title: tc("تم تحديث المادة الخام بنجاح", "Raw material updated successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في تحديث المادة الخام", "Failed to update raw material"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/raw-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      toast({ title: tc("تم حذف المادة الخام بنجاح", "Raw material deleted successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في حذف المادة الخام", "Failed to delete raw material"), variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      nameAr: "",
      nameEn: "",
      description: "",
      category: "ingredient",
      unit: "g",
      unitCost: 0,
      minStockLevel: 0,
      maxStockLevel: 0,
    });
  };

  const handleEdit = (item: RawItem) => {
    setSelectedItem(item);
    setFormData({
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn || "",
      description: item.description || "",
      category: item.category,
      unit: item.unit,
      unitCost: item.unitCost,
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel || 0,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(tc("هل أنت متأكد من حذف هذه المادة الخام؟", "Are you sure you want to delete this raw material?"))) {
      deleteMutation.mutate(id);
    }
  };

  const filteredItems = rawItems.filter((item) => {
    const matchesSearch =
      item.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = rawItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalValue = rawItems.reduce((sum, item) => sum + item.unitCost, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="relative">
            <Package className="h-12 w-12 text-accent dark:text-accent animate-pulse mx-auto" />
            <Loader2 className="h-6 w-6 animate-spin text-accent absolute -bottom-1 -right-1" />
          </div>
          <p className="text-muted-foreground mt-3">جاري تحميل المواد الخام...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 shadow-sm shadow-green-200">
            <Package className="h-8 w-8 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tc("المواد الخام", "Raw Materials")}</h1>
            <p className="text-muted-foreground text-sm">{tc("إدارة المواد الخام والمكونات", "Manage raw materials and ingredients")}</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)} 
          className="bg-primary hover:bg-primary"
          data-testid="button-add-raw-item"
        >
          <Plus className="h-4 w-4 ml-2" />
          إضافة مادة خام
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-4 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/20 dark:to-primary/10 border-primary dark:border-primary">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("إجمالي المواد", "Total Items")}</span>
            <Package className="h-4 w-4 text-accent" />
          </div>
          <div className="text-3xl font-bold text-accent dark:text-accent">{rawItems.length}</div>
          <p className="text-xs text-muted-foreground mt-1">{tc("مادة خام مسجلة", "registered materials")}</p>
        </div>

        <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("المكونات", "Ingredients")}</span>
            <Coffee className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{categoryCounts['ingredient'] || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">{tc("مكون رئيسي", "main ingredients")}</p>
        </div>

        <div className="rounded-xl border p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("التغليف", "Packaging")}</span>
            <Box className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">{categoryCounts['packaging'] || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">{tc("مادة تغليف", "packaging materials")}</p>
        </div>

        <div className="rounded-xl border p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">{tc("متوسط التكلفة", "Avg. Cost")}</span>
            <CircleDollarSign className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-black dark:text-black">
            {rawItems.length > 0 ? (totalValue / rawItems.length).toFixed(2) : '0.00'}
          </div>
          <p className="text-xs text-muted-foreground mt-1"><SarIcon /> / وحدة</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-stone-50/50 to-transparent dark:from-stone-900/20 dark:to-transparent">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tc("بحث بالاسم أو الكود...", "Search by name or code...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-raw-items"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder={tc("الفئة", "Category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الفئات", "All Categories")}</SelectItem>
                {Object.entries(categoryLabels).map(([key, { labelAr, labelEn, icon: Icon }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {tc(labelAr, labelEn)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">{tc("الكود", "Code")}</TableHead>
                  <TableHead className="text-right">{tc("الاسم", "Name")}</TableHead>
                  <TableHead className="text-right">{tc("الفئة", "Category")}</TableHead>
                  <TableHead className="text-right">{tc("الوحدة", "Unit")}</TableHead>
                  <TableHead className="text-right">{tc("التكلفة", "Cost")}</TableHead>
                  <TableHead className="text-right">{tc("المخزون المتبقي", "Current Stock")}</TableHead>
                  <TableHead className="text-right">{tc("الحد الأدنى", "Min Level")}</TableHead>
                  <TableHead className="text-right">{tc("الإجراءات", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">{tc("لا توجد مواد خام", "No raw materials found")}</p>
                      <p className="text-sm">{tc("أضف مواد خام جديدة للبدء", "Add new raw materials to get started")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const categoryInfo = categoryLabels[item.category] || categoryLabels.other;
                    const CategoryIcon = categoryInfo.icon;
                    return (
                      <TableRow 
                        key={item.id} 
                        className="hover-elevate transition-all"
                        data-testid={`row-raw-item-${item.id}`}
                      >
                        <TableCell>
                          <code className="px-2 py-1 rounded bg-muted font-mono text-sm">
                            {item.code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${categoryInfo.color}`}>
                              <CategoryIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{item.nameAr}</div>
                              {item.nameEn && (
                                <div className="text-sm text-muted-foreground">{item.nameEn}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={categoryInfo.color}>
                            {tc(categoryInfo.labelAr, categoryInfo.labelEn)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{unitLabels[item.unit]}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{item.unitCost.toFixed(2)}</span>
                          <span className="text-muted-foreground mr-1"><SarIcon /></span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(item.currentStock ?? 0) <= 0 ? (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">
                                نفاد
                              </Badge>
                            ) : (item.currentStock ?? 0) <= item.minStockLevel ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                                {item.currentStock} {unitLabels[item.unit]}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                                {item.currentStock ?? 0} {unitLabels[item.unit]}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.minStockLevel > 0 ? (
                              <Badge variant="outline" className="bg-background text-accent border-primary dark:bg-primary/30 dark:text-accent dark:border-primary">
                                <AlertTriangle className="h-3 w-3 ml-1" />
                                {item.minStockLevel}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-muted-foreground border-gray-200 dark:bg-gray-900/30 dark:text-muted-foreground dark:border-gray-700">
                                غير محدد
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-accent" />
              إضافة مادة خام جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">{tc("الكود *", "Code *")}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="RAW-001"
                  data-testid="input-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameAr">{tc("الاسم بالعربي *", "Arabic Name *")}</Label>
                <Input
                  id="nameAr"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder={tc("حبوب قهوة", "Coffee beans")}
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
                  placeholder="Coffee Beans"
                  data-testid="input-name-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">{tc("الفئة *", "Category *")}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, { labelAr, labelEn, icon: Icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {tc(labelAr, labelEn)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">{tc("الوحدة *", "Unit *")}</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger data-testid="select-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(unitLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCost">تكلفة الوحدة (<SarIcon />) *</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                  data-testid="input-unit-cost"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minStockLevel">{tc("الحد الأدنى للمخزون *", "Min Stock Level *")}</Label>
                <Input
                  id="minStockLevel"
                  type="number"
                  min="0"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                  data-testid="input-min-stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxStockLevel">{tc("الحد الأقصى للمخزون", "Max Stock Level")}</Label>
                <Input
                  id="maxStockLevel"
                  type="number"
                  min="0"
                  value={formData.maxStockLevel}
                  onChange={(e) => setFormData({ ...formData, maxStockLevel: parseInt(e.target.value) || 0 })}
                  data-testid="input-max-stock"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{tc("الوصف", "Description")}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={tc("وصف المادة الخام...", "Raw material description...")}
                data-testid="input-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.code || !formData.nameAr}
              className="bg-primary hover:bg-primary"
              data-testid="button-submit-add"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-accent" />
              تعديل المادة الخام
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">الكود *</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  data-testid="input-edit-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nameAr">الاسم بالعربي *</Label>
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
                <Label htmlFor="edit-nameEn">الاسم بالإنجليزي</Label>
                <Input
                  id="edit-nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  data-testid="input-edit-name-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">الفئة *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, { labelAr, labelEn, icon: Icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {tc(labelAr, labelEn)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-unit">الوحدة *</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger data-testid="select-edit-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(unitLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unitCost">تكلفة الوحدة (<SarIcon />) *</Label>
                <Input
                  id="edit-unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                  data-testid="input-edit-unit-cost"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-minStockLevel">الحد الأدنى للمخزون *</Label>
                <Input
                  id="edit-minStockLevel"
                  type="number"
                  min="0"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-min-stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxStockLevel">الحد الأقصى للمخزون</Label>
                <Input
                  id="edit-maxStockLevel"
                  type="number"
                  min="0"
                  value={formData.maxStockLevel}
                  onChange={(e) => setFormData({ ...formData, maxStockLevel: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-max-stock"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">الوصف</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{tc("إلغاء", "Cancel")}</Button>
            <Button
              onClick={() => selectedItem && updateMutation.mutate({ id: selectedItem.id, data: formData })}
              disabled={updateMutation.isPending || !formData.code || !formData.nameAr}
              className="bg-primary hover:bg-primary"
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
