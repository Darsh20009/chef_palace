import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Star,
  FileText,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Eye,
  Send,
  RefreshCw,
  Download,
  Filter,
  Building2,
  User,
  Calendar,
  TrendingUp,
  BarChart3,
  Receipt,
  Loader2,
  Percent,
  TrendingDown,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";

interface Supplier {
  id: string;
  name: string;
  nameEn?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  category: string;
  rating: number;
  totalOrders: number;
  totalSpent: number;
  paymentTerms: string;
  notes?: string;
  status: 'active' | 'inactive' | 'blocked';
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  expectedDelivery?: string;
  actualDelivery?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

interface PurchaseOrderItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  amount: number;
  vatAmount: number;
  total: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'disputed';
  paidAt?: string;
  createdAt: string;
}

const mockSuppliers: Supplier[] = [
  { id: "1", name: "شركة الفاخرية للمؤن", contactPerson: "أحمد محمد", phone: "0501234567", email: "info@arabiccoffee.sa", address: "حي الملز", city: "الرياض", category: "بهارات", rating: 4.8, totalOrders: 45, totalSpent: 125000, paymentTerms: "30 يوم", status: "active", createdAt: "2024-01-15" },
  { id: "2", name: "مصنع الحليب الطازج", contactPerson: "خالد علي", phone: "0559876543", email: "sales@freshmilk.sa", address: "المنطقة الصناعية", city: "جدة", category: "ألبان", rating: 4.5, totalOrders: 78, totalSpent: 89000, paymentTerms: "15 يوم", status: "active", createdAt: "2024-02-20" },
  { id: "3", name: "موردين السكر والحلويات", contactPerson: "سعيد أحمد", phone: "0541112233", address: "حي الصفا", city: "الدمام", category: "مواد غذائية", rating: 4.2, totalOrders: 32, totalSpent: 45000, paymentTerms: "نقدي", status: "active", createdAt: "2024-03-10" },
];

const mockPurchaseOrders: PurchaseOrder[] = [
  { id: "1", orderNumber: "PO-2025-001", supplierId: "1", supplierName: "شركة الفاخرية للمؤن", items: [{ ingredientId: "1", ingredientName: "بن عربي محمص", quantity: 50, unit: "كجم", unitPrice: 120, total: 6000 }], subtotal: 6000, vatAmount: 900, total: 6900, status: "received", expectedDelivery: "2025-12-25", actualDelivery: "2025-12-24", createdAt: "2025-12-20", createdBy: "المدير" },
  { id: "2", orderNumber: "PO-2025-002", supplierId: "2", supplierName: "مصنع الحليب الطازج", items: [{ ingredientId: "2", ingredientName: "حليب كامل الدسم", quantity: 200, unit: "لتر", unitPrice: 8, total: 1600 }], subtotal: 1600, vatAmount: 240, total: 1840, status: "confirmed", expectedDelivery: "2025-12-30", createdAt: "2025-12-28", createdBy: "المدير" },
  { id: "3", orderNumber: "PO-2025-003", supplierId: "1", supplierName: "شركة الفاخرية للمؤن", items: [{ ingredientId: "1", ingredientName: "بن كولومبي", quantity: 30, unit: "كجم", unitPrice: 150, total: 4500 }], subtotal: 4500, vatAmount: 675, total: 5175, status: "sent", expectedDelivery: "2025-01-05", createdAt: "2025-12-29", createdBy: "المدير" },
];

const mockInvoices: SupplierInvoice[] = [
  { id: "1", invoiceNumber: "INV-SUP-001", supplierId: "1", supplierName: "شركة الفاخرية للمؤن", purchaseOrderId: "1", amount: 6000, vatAmount: 900, total: 6900, dueDate: "2026-01-20", status: "paid", paidAt: "2025-12-28", createdAt: "2025-12-24" },
  { id: "2", invoiceNumber: "INV-SUP-002", supplierId: "2", supplierName: "مصنع الحليب الطازج", amount: 1600, vatAmount: 240, total: 1840, dueDate: "2026-01-15", status: "pending", createdAt: "2025-12-28" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: tc("مسودة", "Draft"), color: "bg-gray-500" },
  sent: { label: tc("مرسل", "Sent"), color: "bg-blue-500" },
  confirmed: { label: tc("مؤكد", "Confirmed"), color: "bg-green-500" },
  received: { label: tc("تم الاستلام", "Received"), color: "bg-emerald-600" },
  cancelled: { label: tc("ملغي", "Cancelled"), color: "bg-red-500" },
  pending: { label: tc("قيد الانتظار", "Pending"), color: "bg-primary" },
  paid: { label: tc("مدفوع", "Paid"), color: "bg-green-500" },
  overdue: { label: tc("متأخر", "Overdue"), color: "bg-red-500" },
  disputed: { label: tc("متنازع", "Disputed"), color: "bg-primary" },
  active: { label: tc("نشط", "Active"), color: "bg-green-500" },
  inactive: { label: tc("غير نشط", "Inactive"), color: "bg-gray-500" },
  blocked: { label: tc("محظور", "Blocked"), color: "bg-red-500" },
};

interface COGSItem {
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
  cogs: number;
  profit: number;
  margin: number;
  category: string;
  ingredientCount: number;
}

interface COGSSummary {
  totalItems: number;
  avgMargin: number;
  highMargin: number;
  lowMargin: number;
  itemsWithCOGS: number;
}

function COGSReport() {
  const tc = useTranslate();
  const { data, isLoading } = useQuery<{ items: COGSItem[]; summary: COGSSummary }>({
    queryKey: ["/api/analytics/cogs"],
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const { items = [], summary } = data;

  const getMarginColor = (margin: number) => {
    if (margin >= 60) return "text-green-600";
    if (margin >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getMarginBg = (margin: number) => {
    if (margin >= 60) return "bg-green-50 text-green-700 border-green-200";
    if (margin >= 40) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{tc("متوسط هامش الربح", "Avg. Profit Margin")}</p>
            <p className={`text-3xl font-bold ${getMarginColor(summary?.avgMargin || 0)}`}>{summary?.avgMargin || 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{tc("منتجات هامش مرتفع (≥60%)", "High Margin Products (≥60%)")}</p>
            <p className="text-3xl font-bold text-green-600">{summary?.highMargin || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{tc("منتجات هامش منخفض (<30%)", "Low Margin Products (<30%)")}</p>
            <p className="text-3xl font-bold text-red-600">{summary?.lowMargin || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{tc("منتجات محددة التكلفة", "Products with Defined Cost")}</p>
            <p className="text-3xl font-bold text-blue-600">{summary?.itemsWithCOGS || 0} / {summary?.totalItems || 0}</p>
          </CardContent>
        </Card>
      </div>

      {summary && summary.itemsWithCOGS < summary.totalItems && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            <strong>{summary.totalItems - summary.itemsWithCOGS}</strong> منتج لم يتم تحديد تكلفة التصنيع لها بعد. يمكنك تحديث التكلفة من صفحة إدارة القائمة.
          </p>
        </div>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary" />
            هوامش الربح لجميع المنتجات
          </CardTitle>
          <CardDescription>{tc("مرتبة من الأعلى هامشاً إلى الأقل", "Sorted from highest to lowest margin")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">{tc("المنتج", "Product")}</TableHead>
                <TableHead className="text-center">{tc("سعر البيع", "Selling Price")}</TableHead>
                <TableHead className="text-center">{tc("تكلفة التصنيع (COGS)", "Manufacturing Cost (COGS)")}</TableHead>
                <TableHead className="text-center">{tc("صافي الربح", "Net Profit")}</TableHead>
                <TableHead className="text-center">{tc("هامش الربح", "Profit Margin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.nameAr}</p>
                    {item.nameEn && <p className="text-xs text-muted-foreground">{item.nameEn}</p>}
                  </TableCell>
                  <TableCell className="text-center font-mono">{item.price.toFixed(2)} <SarIcon /></TableCell>
                  <TableCell className="text-center font-mono">
                    {item.cogs > 0 ? (
                      <span>{item.cogs.toFixed(2)} <SarIcon /></span>
                    ) : (
                      <span className="text-muted-foreground text-xs">{tc("غير محدد", "Not Set")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {item.cogs > 0 ? (
                      <span className={item.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {item.profit.toFixed(2)} <SarIcon />
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.cogs > 0 ? (
                      <Badge variant="outline" className={`${getMarginBg(item.margin)} font-bold`}>
                        {item.margin}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">—</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupplierManagementPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("suppliers");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isViewSupplierOpen, setIsViewSupplierOpen] = useState(false);

  const suppliers = mockSuppliers;
  const purchaseOrders = mockPurchaseOrders;
  const invoices = mockInvoices;

  const totalSpent = suppliers.reduce((sum, s) => sum + s.totalSpent, 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.total, 0);
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;

  const filteredSuppliers = suppliers.filter(s =>
    s.name.includes(searchQuery) || s.contactPerson.includes(searchQuery)
  );

  const handleViewSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsViewSupplierOpen(true);
  };

  return (
    <PlanGate feature="supplierManagement">
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/manager/dashboard")}
            className="text-accent dark:text-accent"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-accent dark:text-accent flex items-center gap-2">
            <Truck className="w-8 h-8" />
            إدارة الموردين
          </h1>
          <Button onClick={() => setIsAddSupplierOpen(true)} className="bg-primary hover:bg-primary">
            <Plus className="w-4 h-4 ml-2" />
            مورد جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{tc("الموردين النشطين", "Active Suppliers")}</p>
                  <p className="text-3xl font-bold mt-1">{activeSuppliers}</p>
                </div>
                <Building2 className="w-12 h-12 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">{tc("إجمالي المشتريات", "Total Purchases")}</p>
                  <p className="text-3xl font-bold mt-1">{(totalSpent / 1000).toFixed(0)}K</p>
                  <p className="text-green-200 text-xs mt-1">{tc("ريال سعودي", "SAR")}</p>
                </div>
                <DollarSign className="w-12 h-12 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-accent text-sm">{tc("فواتير معلقة", "Pending Invoices")}</p>
                  <p className="text-3xl font-bold mt-1">{pendingInvoices.toLocaleString()}</p>
                  <p className="text-accent text-xs mt-1">{tc("ريال سعودي", "SAR")}</p>
                </div>
                <Receipt className="w-12 h-12 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">طلبات الشراء</p>
                  <p className="text-3xl font-bold mt-1">{purchaseOrders.length}</p>
                  <p className="text-purple-200 text-xs mt-1">هذا الشهر</p>
                </div>
                <FileText className="w-12 h-12 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-primary dark:bg-primary/30">
            <TabsTrigger value="suppliers" className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              الموردين
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              طلبات الشراء
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-1">
              <Receipt className="w-4 h-4" />
              الفواتير
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              التحليلات
            </TabsTrigger>
            <TabsTrigger value="cogs" className="flex items-center gap-1">
              <Percent className="w-4 h-4" />
              تقرير التكاليف
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث بالاسم أو جهة الاتصال..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الفئة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفئات</SelectItem>
                  <SelectItem value="spices">بهارات ومواد غذائية</SelectItem>
                  <SelectItem value="dairy">ألبان</SelectItem>
                  <SelectItem value="food">مواد غذائية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((supplier) => (
                <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">{supplier.category}</p>
                      </div>
                      <Badge className={`${statusConfig[supplier.status].color} text-white`}>
                        {statusConfig[supplier.status].label}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{supplier.contactPerson}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span dir="ltr">{supplier.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{supplier.city}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-accent fill-amber-500" />
                        <span className="font-medium">{supplier.rating}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {supplier.totalOrders} طلب
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewSupplier(supplier)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">طلبات الشراء</h2>
              <Button onClick={() => setIsAddOrderOpen(true)} className="bg-primary hover:bg-primary">
                <Plus className="w-4 h-4 ml-2" />
                طلب شراء جديد
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الطلب</TableHead>
                      <TableHead className="text-right">المورد</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">التاريخ المتوقع</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{order.supplierName}</TableCell>
                        <TableCell className="font-medium">{order.total.toLocaleString()} <SarIcon /></TableCell>
                        <TableCell>
                          {order.expectedDelivery && format(new Date(order.expectedDelivery), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig[order.status].color} text-white`}>
                            {statusConfig[order.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {order.status === 'draft' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {order.status === 'confirmed' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">فواتير الموردين</h2>
              <div className="flex gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="pending">معلق</SelectItem>
                    <SelectItem value="paid">مدفوع</SelectItem>
                    <SelectItem value="overdue">متأخر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الفاتورة</TableHead>
                      <TableHead className="text-right">المورد</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.supplierName}</TableCell>
                        <TableCell className="font-medium">{invoice.total.toLocaleString()} <SarIcon /></TableCell>
                        <TableCell>{format(new Date(invoice.dueDate), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig[invoice.status].color} text-white`}>
                            {statusConfig[invoice.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {invoice.status === 'pending' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    أفضل الموردين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {suppliers.slice(0, 3).map((supplier, idx) => (
                      <div key={supplier.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? 'bg-primary text-white' :
                          idx === 1 ? 'bg-gray-400 text-white' :
                          'bg-primary text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{supplier.name}</p>
                          <p className="text-sm text-muted-foreground">{supplier.totalSpent.toLocaleString()} <SarIcon /></p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-accent fill-amber-500" />
                          <span>{supplier.rating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    توزيع المشتريات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-background dark:bg-primary/20 rounded-lg">
                      <span>بهارات</span>
                      <span className="font-bold">55%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span>ألبان</span>
                      <span className="font-bold">28%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span>مواد غذائية</span>
                      <span className="font-bold">17%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>تقييم أداء الموردين</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المورد</TableHead>
                      <TableHead className="text-right">التسليم في الوقت</TableHead>
                      <TableHead className="text-right">جودة المنتجات</TableHead>
                      <TableHead className="text-right">التواصل</TableHead>
                      <TableHead className="text-right">التقييم الكلي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">95%</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">ممتاز</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">جيد جداً</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-accent fill-amber-500" />
                            <span className="font-bold">{supplier.rating}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cogs" className="space-y-6">
            <COGSReport />
          </TabsContent>
        </Tabs>

        <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                إضافة مورد جديد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم المورد</Label>
                  <Input placeholder="شركة ..." />
                </div>
                <div>
                  <Label>الفئة</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spices">بهارات ومواد غذائية</SelectItem>
                      <SelectItem value="dairy">ألبان</SelectItem>
                      <SelectItem value="food">مواد غذائية</SelectItem>
                      <SelectItem value="packaging">تغليف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>جهة الاتصال</Label>
                  <Input placeholder="الاسم" />
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input placeholder="05XXXXXXXX" dir="ltr" />
                </div>
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input placeholder="email@example.com" type="email" dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>المدينة</Label>
                  <Input placeholder="الرياض" />
                </div>
                <div>
                  <Label>شروط الدفع</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقدي</SelectItem>
                      <SelectItem value="15">15 يوم</SelectItem>
                      <SelectItem value="30">30 يوم</SelectItem>
                      <SelectItem value="60">60 يوم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea placeholder="ملاحظات إضافية..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddSupplierOpen(false)}>إلغاء</Button>
              <Button className="bg-primary hover:bg-primary">حفظ المورد</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewSupplierOpen} onOpenChange={setIsViewSupplierOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                تفاصيل المورد
              </DialogTitle>
            </DialogHeader>
            {selectedSupplier && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selectedSupplier.name}</h2>
                    <p className="text-muted-foreground">{selectedSupplier.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-accent fill-amber-500" />
                    <span className="text-xl font-bold">{selectedSupplier.rating}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">جهة الاتصال</p>
                    <p className="font-medium">{selectedSupplier.contactPerson}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">الهاتف</p>
                    <p className="font-medium" dir="ltr">{selectedSupplier.phone}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                    <p className="font-medium">{selectedSupplier.totalOrders} طلب</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{tc("إجمالي المشتريات", "Total Purchases")}</p>
                    <p className="font-medium">{selectedSupplier.totalSpent.toLocaleString()} <SarIcon /></p>
                  </div>
                </div>

                <div className="p-4 bg-background dark:bg-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">شروط الدفع</p>
                  <p className="font-medium">{selectedSupplier.paymentTerms}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewSupplierOpen(false)}>إغلاق</Button>
              <Button className="bg-primary hover:bg-primary">
                <FileText className="w-4 h-4 ml-2" />
                طلب شراء جديد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </PlanGate>
  );
}
