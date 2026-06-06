import { useTranslate, tc } from "@/lib/useTranslate";
import { PlanGate } from "@/components/plan-gate";
import { useState } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  FileText,
  ArrowLeft,
  Loader2,
  Calendar,
  Check,
  X,
  CreditCard,
  Banknote,
  PiggyBank,
  BarChart3,
  Building2,
  Package,
  ShoppingCart,
  Percent,
  Eye,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  Printer,
  Filter,
  RefreshCw,
  RotateCcw,
  PieChart as PieChartIcon,
  LineChart,
  LayoutDashboard,
  Clock,
  Users,
  Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface Branch {
  id: string;
  nameAr: string;
}

interface Expense {
  id: string;
  branchId: string;
  date: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  approvedBy?: string;
  approvalDate?: string;
  paidDate?: string;
  createdAt: string;
}

interface Revenue {
  id: string;
  branchId: string;
  date: string;
  orderId?: string;
  invoiceId?: string;
  category: string;
  description: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

interface TrendData {
  date?: string;
  week?: string;
  revenue: number;
  expenses: number;
  cogs: number;
  netProfit: number;
}

interface TopSellingItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName?: string;
  totalAmount: number;
  costOfGoods?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: Array<{ nameAr?: string; quantity: number; price?: number }>;
}

interface StockMovement {
  id: string;
  rawItemName?: string;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes?: string;
  createdAt: string;
}

type DrilldownType = 'revenue' | 'cogs' | 'expenses' | 'orders' | null;

interface DashboardData {
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  totalVat: number;
  totalExpenses: number;
  totalCogs: number;
  grossProfit: number;
  netProfit: number;
  orderCount: number;
  refundCount: number;
  invoiceCount: number;
  profitMargin: number;
  expensesByCategory: Record<string, number>;
  revenueByPayment: Record<string, number>;
  dailyTrend: TrendData[];
  weeklyTrend: TrendData[];
  topSellingItems: TopSellingItem[];
}

const expenseCategories = [
  { value: "inventory", label: tc("المخزون والمواد الخام", "Inventory & Raw Materials") },
  { value: "salaries", label: tc("الرواتب والأجور", "Salaries & Wages") },
  { value: "rent", label: tc("الإيجار", "Rent") },
  { value: "utilities", label: tc("المرافق (كهرباء/ماء)", "Utilities (electricity/water)") },
  { value: "marketing", label: tc("التسويق والإعلان", "Marketing & Advertising") },
  { value: "maintenance", label: tc("الصيانة", "Maintenance") },
  { value: "supplies", label: tc("المستلزمات", "Supplies") },
  { value: "other", label: tc("أخرى", "Other") },
];

const statusLabels: Record<string, { labelAr: string; labelEn: string; label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { labelAr: "قيد الانتظار", labelEn: "Pending", label: "Pending", variant: "secondary" },
  approved: { labelAr: "معتمد", labelEn: "Approved", label: "Approved", variant: "default" },
  rejected: { labelAr: "مرفوض", labelEn: "Rejected", label: "Rejected", variant: "destructive" },
  paid: { labelAr: "مدفوع", labelEn: "Paid", label: "Paid", variant: "default" },
};

const paymentMethodLabels: Record<string, string> = {
  cash: tc("نقدي", "Cash"),
  pos: tc("شبكة", "POS"),
  bank_transfer: tc("تحويل بنكي", "Bank Transfer"),
  stc: "STC Pay",
  alinma: "Alinma Pay",
};

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899'];

const periodLabels: Record<string, string> = {
  today: tc('اليوم', 'Today'),
  week: tc('هذا الأسبوع', 'This Week'),
  month: tc('هذا الشهر', 'This Month'),
  year: tc('هذه السنة', 'This Year')
};

// ── Refunds Tab Component ──────────────────────────────────────────────────
function RefundsTab({ period, selectedBranch }: { period: string; selectedBranch: string }) {
  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const { data: refundsData, isLoading } = useQuery<{ refunds: any[]; total: number }>({
    queryKey: ["/api/refunds", period, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ period, limit: "200" });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/refunds?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30000,
  });

  const refunds = refundsData?.refunds || [];

  const filtered = refunds.filter((r: any) => {
    const matchSearch = !searchText ||
      r.refundNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
      r.originalOrderNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
      r.reason?.toLowerCase().includes(searchText.toLowerCase()) ||
      r.processedByName?.toLowerCase().includes(searchText.toLowerCase());
    const matchMethod = methodFilter === "all" || r.refundMethod === methodFilter;
    return matchSearch && matchMethod;
  });

  const totalRefundAmount = filtered.reduce((s: number, r: any) => s + (r.refundAmount || 0), 0);
  const cashRefunds = filtered.filter((r: any) => r.refundMethod === 'cash').reduce((s: number, r: any) => s + (r.refundAmount || 0), 0);
  const cardRefunds = filtered.filter((r: any) => r.refundMethod === 'card').reduce((s: number, r: any) => s + (r.refundAmount || 0), 0);
  const splitRefunds = filtered.filter((r: any) => r.refundMethod === 'split').reduce((s: number, r: any) => s + (r.refundAmount || 0), 0);

  const methodLabel: Record<string, string> = { cash: '💵 نقدي', card: '💳 بطاقة', split: '💵+💳 مختلط' };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">إجمالي الاسترجاعات</p>
            <p className="text-2xl font-black text-orange-600 mt-1">{totalRefundAmount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">ريال سعودي ({filtered.length} عملية)</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">💵 نقدي</p>
            <p className="text-2xl font-black text-green-700 mt-1">{cashRefunds.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">ريال</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">💳 بطاقة</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{cardRefunds.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">ريال</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-900/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">💵+💳 مختلط</p>
            <p className="text-2xl font-black text-purple-700 mt-1">{splitRefunds.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">ريال</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter row */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="بحث برقم الاسترجاع أو الطلب أو السبب..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="max-w-xs"
        />
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="طريقة الاسترجاع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الطرق</SelectItem>
            <SelectItem value="cash">💵 نقدي</SelectItem>
            <SelectItem value="card">💳 بطاقة</SelectItem>
            <SelectItem value="split">💵+💳 مختلط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            سجل الاسترجاعات
          </CardTitle>
          <CardDescription>جميع عمليات الاسترجاع والإرجاع المُسجّلة</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">لا توجد استرجاعات في هذه الفترة</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الاسترجاع</TableHead>
                    <TableHead>رقم الطلب الأصلي</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>طريقة الإرجاع</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المعالج</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((refund: any) => (
                    <TableRow key={refund._id || refund.id}>
                      <TableCell className="font-bold text-orange-600">{refund.refundNumber}</TableCell>
                      <TableCell className="font-mono text-sm">{refund.originalOrderNumber}</TableCell>
                      <TableCell>
                        <span className="font-black text-orange-600">{Number(refund.refundAmount).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground mr-1">ر.س</span>
                        {refund.refundMethod === 'split' && (
                          <div className="text-xs text-muted-foreground">
                            💵 {Number(refund.cashAmount||0).toFixed(2)} + 💳 {Number(refund.cardAmount||0).toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${
                          refund.refundMethod === 'cash' ? 'border-green-500 text-green-700' :
                          refund.refundMethod === 'card' ? 'border-blue-500 text-blue-700' :
                          'border-purple-500 text-purple-700'
                        }`}>
                          {methodLabel[refund.refundMethod] || refund.refundMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">{refund.reason}</TableCell>
                      <TableCell>
                        <Badge variant={refund.refundType === 'full' ? 'default' : 'secondary'} className="text-xs">
                          {refund.refundType === 'full' ? 'كامل' : 'جزئي'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{refund.processedByName || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(refund.createdAt).toLocaleDateString('ar-SA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccountingDashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tc = useTranslate();
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState("today");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  
  const [newExpense, setNewExpense] = useState({
    category: "",
    subcategory: "",
    description: "",
    amount: "",
    vatAmount: "",
    paymentMethod: "cash",
    notes: "",
  });
  
  const [drilldownType, setDrilldownType] = useState<DrilldownType>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/accounting/dashboard", period, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/accounting/dashboard?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      const data = await res.json();
      return {
        totalRevenue: data.summary?.totalRevenue || 0,
        totalRefunds: data.summary?.totalRefunds || 0,
        netRevenue: data.summary?.netRevenue || data.summary?.totalRevenue || 0,
        totalVat: data.summary?.totalVatCollected || 0,
        totalExpenses: data.summary?.totalExpenses || 0,
        totalCogs: data.summary?.totalCogs || 0,
        grossProfit: data.summary?.grossProfit || 0,
        netProfit: data.summary?.netProfit || 0,
        orderCount: data.summary?.orderCount || 0,
        refundCount: data.summary?.refundCount || 0,
        invoiceCount: data.summary?.invoiceCount || 0,
        profitMargin: data.summary?.profitMargin || 0,
        expensesByCategory: data.expensesByCategory || {},
        revenueByPayment: data.revenueByPayment || {},
        dailyTrend: data.dailyTrend || [],
        weeklyTrend: data.weeklyTrend || [],
        topSellingItems: data.topSellingItems || [],
      };
    },
  });

  const { data: expensesData, isLoading: isExpensesLoading } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ["/api/accounting/expenses", period, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", period });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/accounting/expenses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
  });

  const { data: revenuesData, isLoading: isRevenuesLoading } = useQuery<{ revenues: Revenue[]; total: number }>({
    queryKey: ["/api/accounting/revenue", period, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", period });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/accounting/revenue?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch revenues");
      return res.json();
    },
  });

  const { data: ordersData, isLoading: isOrdersLoading } = useQuery<{ orders: Order[] }>({
    queryKey: ["/api/orders", period, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100", period });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/orders?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const orders = await res.json();
      return { orders: Array.isArray(orders) ? orders : [] };
    },
    enabled: drilldownOpen && (drilldownType === 'revenue' || drilldownType === 'cogs' || drilldownType === 'orders'),
  });

  const { data: stockMovementsData, isLoading: isStockLoading } = useQuery<{ movements: StockMovement[] }>({
    queryKey: ["/api/inventory/stock-movements", period, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", period });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/inventory/stock-movements?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stock movements");
      const data = await res.json();
      return { movements: data.movements || [] };
    },
    enabled: drilldownOpen && drilldownType === 'cogs',
  });

  const openDrilldown = (type: DrilldownType) => {
    setDrilldownType(type);
    setDrilldownOpen(true);
  };

  const closeDrilldown = () => {
    setDrilldownOpen(false);
    setDrilldownType(null);
  };

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/accounting/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/dashboard"] });
      setIsAddExpenseOpen(false);
      setNewExpense({
        category: "",
        subcategory: "",
        description: "",
        amount: "",
        vatAmount: "",
        paymentMethod: "cash",
        notes: "",
      });
      toast({ title: tc("تم إضافة المصروف بنجاح", "Expense added successfully") });
    },
    onError: () => {
      toast({ title: tc("فشل في إضافة المصروف", "Failed to add expense"), variant: "destructive" });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/accounting/expenses/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/dashboard"] });
      toast({ title: tc("تم اعتماد المصروف بنجاح", "Expense approved successfully") });
    },
    onError: () => {
      toast({ title: tc("فشل في اعتماد المصروف", "Failed to approve expense"), variant: "destructive" });
    },
  });

  const handleAddExpense = () => {
    if (!newExpense.category) {
      toast({ title: tc("يرجى اختيار فئة المصروف", "Please select expense category"), variant: "destructive" });
      return;
    }
    if (!newExpense.description.trim()) {
      toast({ title: tc("يرجى إدخال وصف المصروف", "Please enter expense description"), variant: "destructive" });
      return;
    }
    const amount = parseFloat(newExpense.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: tc("يرجى إدخال مبلغ صحيح أكبر من صفر", "Please enter a valid amount greater than zero"), variant: "destructive" });
      return;
    }
    const vatAmount = parseFloat(newExpense.vatAmount || "0");
    
    createExpenseMutation.mutate({
      branchId: selectedBranch !== "all" ? selectedBranch : undefined,
      date: new Date().toISOString(),
      category: newExpense.category,
      subcategory: newExpense.subcategory || undefined,
      description: newExpense.description.trim(),
      amount,
      vatAmount,
      totalAmount: amount + vatAmount,
      paymentMethod: newExpense.paymentMethod,
      notes: newExpense.notes || undefined,
    });
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.nameAr || tc("غير محدد", "Unknown");
  };

  const sanitizeForExport = (items: any[]) => {
    return items.map((item) => {
      const sanitized: any = {};
      Object.keys(item).forEach((key) => {
        if (!key.startsWith("_") && key !== "__v" && key !== "password" && key !== "token") {
          sanitized[key] = item[key];
        }
      });
      return sanitized;
    });
  };

  const exportToExcel = (data: any[], filename: string, headers: string[]) => {
    import('xlsx').then((XLSX) => {
      const cleanData = sanitizeForExport(data);
      const ws = XLSX.utils.json_to_sheet(cleanData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
      XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast({ title: tc('تم تصدير التقرير بنجاح', 'Report exported successfully'), description: 'تم حفظ الملف بصيغة Excel' });
    }).catch(() => {
      toast({ title: tc('فشل التصدير', 'Export failed'), variant: 'destructive' });
    });
  };

  const exportToPDF = (title: string, data: any) => {
    try {
      const lines: string[] = [];
      lines.push(title);
      lines.push(`الفترة: ${periodLabels[period]}`);
      lines.push(`التاريخ: ${format(new Date(), 'yyyy/MM/dd')}`);
      lines.push('');
      if (data.summary) {
        lines.push('ملخص الأداء المالي');
        lines.push(`إجمالي الإيرادات: ${data.summary.totalRevenue?.toFixed(2) || 0} ر.س`);
        lines.push(`تكلفة المكونات: ${data.summary.totalCogs?.toFixed(2) || 0} ر.س`);
        lines.push(`المصروفات: ${data.summary.totalExpenses?.toFixed(2) || 0} ر.س`);
        lines.push(`صافي الربح: ${data.summary.netProfit?.toFixed(2) || 0} ر.س`);
        lines.push(`هامش الربح: ${data.summary.profitMargin?.toFixed(1) || 0}%`);
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}_${format(new Date(), 'yyyy-MM-dd')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: tc('تم تصدير التقرير بنجاح', 'Report exported successfully'), description: 'تم حفظ الملف' });
    } catch {
      toast({ title: tc('فشل التصدير', 'Export failed'), variant: 'destructive' });
    }
  };

  const handleExportSummaryExcel = () => {
    if (!dashboardData) return;
    const data = [
      { البند: 'إجمالي الإيرادات', القيمة: dashboardData.totalRevenue },
      { البند: 'ضريبة القيمة المضافة', القيمة: dashboardData.totalVat },
      { البند: 'تكلفة المكونات (COGS)', القيمة: dashboardData.totalCogs },
      { البند: 'إجمالي الربح', القيمة: dashboardData.grossProfit },
      { البند: 'المصروفات التشغيلية', القيمة: dashboardData.totalExpenses },
      { البند: 'صافي الربح', القيمة: dashboardData.netProfit },
      { البند: 'هامش الربح %', القيمة: dashboardData.profitMargin },
      { البند: 'عدد الطلبات', القيمة: dashboardData.orderCount },
    ];
    exportToExcel(data, 'ملخص_محاسبي', ['البند', 'القيمة']);
  };

  const handleExportExpensesExcel = () => {
    if (!expensesData?.expenses) return;
    const data = expensesData.expenses.map(exp => ({
      التاريخ: format(new Date(exp.date), 'yyyy/MM/dd'),
      الفئة: expenseCategories.find(c => c.value === exp.category)?.label || exp.category,
      الوصف: exp.description,
      المبلغ: exp.amount,
      الضريبة: exp.vatAmount,
      الإجمالي: exp.totalAmount,
      الحالة: statusLabels[exp.status]?.label || exp.status
    }));
    exportToExcel(data, 'سجل_المصروفات', ['التاريخ', 'الفئة', 'الوصف', 'المبلغ', 'الضريبة', 'الإجمالي', 'الحالة']);
  };

  const handleExportRevenuesExcel = () => {
    if (!revenuesData?.revenues) return;
    const data = revenuesData.revenues.map(rev => ({
      التاريخ: format(new Date(rev.date), 'yyyy/MM/dd'),
      الفرع: getBranchName(rev.branchId),
      الفئة: rev.category,
      الوصف: rev.description,
      المبلغ: rev.amount,
      الضريبة: rev.vatAmount,
      الإجمالي: rev.totalAmount,
      'طريقة الدفع': paymentMethodLabels[rev.paymentMethod] || rev.paymentMethod
    }));
    exportToExcel(data, 'سجل_الإيرادات', ['التاريخ', 'الفرع', 'الفئة', 'الوصف', 'المبلغ', 'الضريبة', 'الإجمالي', 'طريقة الدفع']);
  };

  const handleExportSummaryPDF = () => {
    if (!dashboardData) return;
    exportToPDF('التقرير المالي الشامل', {
      summary: {
        totalRevenue: dashboardData.totalRevenue,
        totalCogs: dashboardData.totalCogs,
        totalExpenses: dashboardData.totalExpenses,
        netProfit: dashboardData.netProfit,
        profitMargin: dashboardData.profitMargin
      }
    });
  };

  const paymentMethodData = dashboardData?.revenueByPayment 
    ? Object.entries(dashboardData.revenueByPayment).map(([method, amount]) => ({
        name: paymentMethodLabels[method] || method,
        value: amount as number,
      }))
    : [];

  const expenseCategoryData = dashboardData?.expensesByCategory 
    ? Object.entries(dashboardData.expensesByCategory).map(([category, amount]) => ({
        name: expenseCategories.find(c => c.value === category)?.label || category,
        value: amount as number,
      }))
    : [];

  return (
    <PlanGate feature="accountingModule">
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/manager/dashboard")}
            className="text-accent dark:text-accent"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-accent dark:text-accent">
            نظام المحاسبة المتكامل
          </h1>
          <div className="w-20"></div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40" data-testid="select-period">
              <SelectValue placeholder="الفترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">هذا الأسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-48" data-testid="select-branch">
              <SelectValue placeholder="الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tc("جميع الفروع", "All Branches")}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={() => setIsAddExpenseOpen(true)}
            className="bg-primary hover:bg-primary"
            data-testid="button-add-expense"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة مصروف
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-primary dark:bg-primary/30">
            <TabsTrigger value="overview" data-testid="tab-overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="expenses" data-testid="tab-expenses">المصروفات</TabsTrigger>
            <TabsTrigger value="revenues" data-testid="tab-revenues">الإيرادات</TabsTrigger>
            <TabsTrigger value="refunds" data-testid="tab-refunds" className="text-orange-300 data-[state=active]:text-orange-700">الاسترجاعات</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">التقارير</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {isDashboardLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : dashboardData ? (
              <>
                {/* Main KPI Cards - Clickable for Drilldown */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card 
                    className="bg-gradient-to-br from-green-500 to-green-600 text-white cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => openDrilldown('revenue')}
                    data-testid="card-revenue-drilldown"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-green-100 text-sm flex items-center gap-1">
                            إجمالي الإيرادات
                            <Eye className="w-3 h-3" />
                          </p>
                          <p className="text-3xl font-bold mt-1" data-testid="text-total-revenue">{dashboardData.totalRevenue.toFixed(2)}</p>
                          {dashboardData.totalRefunds > 0 && (
                            <p className="text-green-200 text-xs mt-1 flex items-center gap-1">
                              <span>صافي بعد الاسترجاع:</span>
                              <span className="font-bold text-white">{dashboardData.netRevenue.toFixed(2)}</span>
                            </p>
                          )}
                          <p className="text-green-200 text-xs mt-1">ريال سعودي - انقر للتفاصيل</p>
                        </div>
                        <TrendingUp className="w-12 h-12 text-green-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => openDrilldown('cogs')}
                    data-testid="card-cogs-drilldown"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-accent text-sm flex items-center gap-1">
                            تكلفة المكونات (COGS)
                            <Eye className="w-3 h-3" />
                          </p>
                          <p className="text-3xl font-bold mt-1" data-testid="text-total-cogs">{dashboardData.totalCogs.toFixed(2)}</p>
                          <p className="text-accent text-xs mt-1">ريال سعودي - انقر للتفاصيل</p>
                        </div>
                        <Package className="w-12 h-12 text-accent" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gradient-to-br from-red-500 to-red-600 text-white cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => openDrilldown('expenses')}
                    data-testid="card-expenses-drilldown"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-red-100 text-sm flex items-center gap-1">
                            المصروفات الشهرية
                            <Eye className="w-3 h-3" />
                          </p>
                          <p className="text-3xl font-bold mt-1" data-testid="text-total-expenses">{dashboardData.totalExpenses.toFixed(2)}</p>
                          <p className="text-red-200 text-xs mt-1">ريال سعودي - انقر للتفاصيل</p>
                        </div>
                        <TrendingDown className="w-12 h-12 text-red-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className="bg-gradient-to-br from-orange-500 to-orange-600 text-white cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => openDrilldown('cogs')}
                    data-testid="card-cogs-total-drilldown"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-orange-100 text-sm flex items-center gap-1">
                            إجمالي المصروفات (شامل المخزون)
                            <Eye className="w-3 h-3" />
                          </p>
                          <p className="text-3xl font-bold mt-1" data-testid="text-total-all-expenses">{(dashboardData.totalCogs + dashboardData.totalExpenses).toFixed(2)}</p>
                          <p className="text-orange-200 text-xs mt-1">ريال سعودي - انقر للتفاصيل</p>
                        </div>
                        <TrendingDown className="w-12 h-12 text-orange-200" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Expenses Breakdown Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-red-600" />
                      تحليل المصروفات التفصيلي
                    </CardTitle>
                    <CardDescription>تفاصيل الإيرادات والمصروفات (تكلفة المخزون + التشغيل)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <p className="text-muted-foreground text-sm">إجمالي الإيرادات</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-gross-profit">{dashboardData.totalRevenue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground"><SarIcon /></p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                        <p className="text-muted-foreground text-sm">تكلفة المخزون المستخدم</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {dashboardData.totalCogs.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground"><SarIcon /></p>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                        <p className="text-muted-foreground text-sm">المصروفات التشغيلية</p>
                        <p className="text-2xl font-bold text-red-600">
                          {dashboardData.totalExpenses.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground"><SarIcon /></p>
                      </div>
                    </div>
                    
                    {dashboardData.totalRefunds > 0 && (
                      <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-orange-700 dark:text-orange-400">إجمالي الاسترجاعات ({dashboardData.refundCount} عملية)</p>
                            <p className="text-xs text-muted-foreground">مخصومة من الإيرادات</p>
                          </div>
                        </div>
                        <p className="font-black text-xl text-orange-600">-{dashboardData.totalRefunds.toFixed(2)} <SarIcon /></p>
                      </div>
                    )}

                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span>{tc("إجمالي الإيرادات", "Total Revenue")}</span>
                          <span className="font-medium text-green-600">+{dashboardData.totalRevenue.toFixed(2)} <SarIcon /></span>
                        </div>
                        {dashboardData.totalRefunds > 0 && (
                          <div className="flex justify-between">
                            <span className="text-orange-600">المسترجع / المُرتجع</span>
                            <span className="font-medium text-orange-600">-{dashboardData.totalRefunds.toFixed(2)} <SarIcon /></span>
                          </div>
                        )}
                        {dashboardData.totalRefunds > 0 && (
                          <div className="flex justify-between bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                            <span className="font-medium">صافي الإيرادات بعد الاسترجاع</span>
                            <span className="font-bold text-green-700">={dashboardData.netRevenue.toFixed(2)} <SarIcon /></span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>{tc("ضريبة القيمة المضافة", "VAT")}</span>
                          <span className="font-medium text-accent">-{dashboardData.totalVat.toFixed(2)} <SarIcon /></span>
                        </div>
                        <div className="flex justify-between">
                          <span>تكلفة مخزون الأطباق (مصروف)</span>
                          <span className="font-medium text-orange-600">-{dashboardData.totalCogs.toFixed(2)} <SarIcon /></span>
                        </div>
                        <div className="flex justify-between">
                          <span>{tc("المصروفات التشغيلية", "Operating Expenses")}</span>
                          <span className="font-medium text-red-600">-{dashboardData.totalExpenses.toFixed(2)} <SarIcon /></span>
                        </div>
                        <div className="flex justify-between border-t pt-2 border-primary">
                          <span className="font-bold">= صافي الربح</span>
                          <span className={`font-bold text-lg ${dashboardData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dashboardData.netProfit.toFixed(2)} <SarIcon />
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Daily Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-accent" />
                      الإيرادات اليومية (آخر 7 أيام)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.dailyTrend && dashboardData.dailyTrend.length > 0 ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dashboardData.dailyTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                return `${date.getDate()}/${date.getMonth() + 1}`;
                              }}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: number) => [`${value.toFixed(2)} ر.س`]}
                              labelFormatter={(label) => {
                                const date = new Date(label);
                                return format(date, "EEEE dd/MM/yyyy", { locale: ar });
                              }}
                            />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stackId="1"
                              stroke="#10b981" 
                              fill="#10b981" 
                              fillOpacity={0.6}
                              name="الإيرادات"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="cogs" 
                              stackId="2"
                              stroke="#f97316" 
                              fill="#f97316" 
                              fillOpacity={0.6}
                              name="تكلفة المخزون"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">لا توجد بيانات كافية لعرض الرسم البياني</p>
                    )}
                  </CardContent>
                </Card>

                {/* Weekly Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      الإيرادات والمصروفات الأسبوعية (آخر 4 أسابيع)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.weeklyTrend && dashboardData.weeklyTrend.length > 0 ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashboardData.weeklyTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#10b981" name="الإيرادات" />
                            <Bar dataKey="cogs" fill="#f97316" name="تكلفة مخزون الأطباق" />
                            <Bar dataKey="expenses" fill="#ef4444" name="المصروفات التشغيلية" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">لا توجد بيانات كافية لعرض الرسم البياني</p>
                    )}
                  </CardContent>
                </Card>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Methods Pie Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-green-600" />
                        الإيرادات حسب طريقة الدفع
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {paymentMethodData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={paymentMethodData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              >
                                {paymentMethodData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expenses by Category */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-red-600" />
                        المصروفات حسب الفئة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {expenseCategoryData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={expenseCategoryData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis type="category" dataKey="name" width={120} />
                              <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                              <Bar dataKey="value" fill="#ef4444" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">لا توجد مصروفات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary dark:bg-primary/30 rounded-full">
                          <ShoppingCart className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">{tc("عدد الطلبات", "Order Count")}</p>
                          <p className="text-2xl font-bold" data-testid="text-order-count">{dashboardData.orderCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          <Receipt className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">عدد الفواتير</p>
                          <p className="text-2xl font-bold" data-testid="text-invoice-count">{dashboardData.invoiceCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                          <Percent className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">متوسط قيمة الطلب</p>
                          <p className="text-2xl font-bold">
                            {dashboardData.orderCount > 0 
                              ? (dashboardData.totalRevenue / dashboardData.orderCount).toFixed(2)
                              : "0"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                          <DollarSign className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">{tc("ضريبة القيمة المضافة", "VAT")}</p>
                          <p className="text-2xl font-bold">{dashboardData.totalVat.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Top Selling Items */}
                {dashboardData.topSellingItems && dashboardData.topSellingItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-accent" />
                        المنتجات الأكثر مبيعاً
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">المنتج</TableHead>
                            <TableHead className="text-right">الكمية المباعة</TableHead>
                            <TableHead className="text-right">الإيرادات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardData.topSellingItems.map((item, index) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{index + 1}</Badge>
                                  {item.name}
                                </div>
                              </TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell className="font-bold text-green-600">{item.revenue.toFixed(2)} <SarIcon /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>سجل المصروفات</CardTitle>
                <CardDescription>جميع المصروفات المسجلة في النظام</CardDescription>
              </CardHeader>
              <CardContent>
                {isExpensesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">الضريبة</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesData?.expenses?.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{format(new Date(expense.date), "yyyy/MM/dd", { locale: ar })}</TableCell>
                          <TableCell>
                            {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                          </TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>{expense.amount.toFixed(2)}</TableCell>
                          <TableCell>{expense.vatAmount.toFixed(2)}</TableCell>
                          <TableCell className="font-bold">{expense.totalAmount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={statusLabels[expense.status]?.variant || "secondary"}>
                              {statusLabels[expense.status]?.label || expense.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {expense.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveExpenseMutation.mutate(expense.id)}
                                disabled={approveExpenseMutation.isPending}
                                data-testid={`button-approve-expense-${expense.id}`}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!expensesData?.expenses || expensesData.expenses.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            لا توجد مصروفات مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>سجل الإيرادات</CardTitle>
                <CardDescription>جميع الإيرادات المسجلة في النظام</CardDescription>
              </CardHeader>
              <CardContent>
                {isRevenuesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">الضريبة</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                        <TableHead className="text-right">طريقة الدفع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenuesData?.revenues?.map((revenue) => (
                        <TableRow key={revenue.id}>
                          <TableCell>{format(new Date(revenue.date), "yyyy/MM/dd", { locale: ar })}</TableCell>
                          <TableCell>{getBranchName(revenue.branchId)}</TableCell>
                          <TableCell>{revenue.category}</TableCell>
                          <TableCell>{revenue.description}</TableCell>
                          <TableCell>{revenue.amount.toFixed(2)}</TableCell>
                          <TableCell>{revenue.vatAmount.toFixed(2)}</TableCell>
                          <TableCell className="font-bold text-green-600">{revenue.totalAmount.toFixed(2)}</TableCell>
                          <TableCell>{paymentMethodLabels[revenue.paymentMethod] || revenue.paymentMethod}</TableCell>
                        </TableRow>
                      ))}
                      {(!revenuesData?.revenues || revenuesData.revenues.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            لا توجد إيرادات مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="refunds" className="space-y-4">
            <RefundsTab period={period} selectedBranch={selectedBranch} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {isDashboardLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : dashboardData ? (
              <>
                {/* Report Header with Export Buttons */}
                <Card className="bg-card border-primary dark:border-primary">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-accent dark:text-accent">
                          <FileText className="w-6 h-6" />
                          مركز التقارير المالية
                        </CardTitle>
                        <CardDescription className="mt-1">
                          تقارير شاملة للفترة: <Badge variant="outline">{periodLabels[period]}</Badge>
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleExportSummaryExcel}
                          className="border-green-500 text-green-700 hover:bg-green-50"
                        >
                          <FileSpreadsheet className="w-4 h-4 ml-2" />
                          تصدير Excel
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleExportSummaryPDF}
                          className="border-red-500 text-red-700 hover:bg-red-50"
                        >
                          <Download className="w-4 h-4 ml-2" />
                          تصدير PDF
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.print()}
                          className="border-blue-500 text-blue-700 hover:bg-blue-50"
                        >
                          <Printer className="w-4 h-4 ml-2" />
                          طباعة
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Financial Summary Report */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LayoutDashboard className="w-5 h-5 text-blue-600" />
                      ملخص الأداء المالي
                    </CardTitle>
                    <CardDescription>تقرير شامل للوضع المالي للفترة المحددة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-green-700 dark:text-green-400 font-medium">الإيرادات</span>
                        </div>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-300">{dashboardData.totalRevenue.toFixed(2)}</p>
                        <p className="text-xs text-green-600"><SarIcon /></p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/20 dark:to-primary/10 rounded-xl border border-accent dark:border-accent">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-5 h-5 text-accent" />
                          <span className="text-sm text-accent dark:text-accent font-medium">تكلفة المكونات</span>
                        </div>
                        <p className="text-2xl font-bold text-accent dark:text-accent">{dashboardData.totalCogs.toFixed(2)}</p>
                        <p className="text-xs text-accent"><SarIcon /></p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="w-5 h-5 text-red-600" />
                          <span className="text-sm text-red-700 dark:text-red-400 font-medium">المصروفات</span>
                        </div>
                        <p className="text-2xl font-bold text-red-800 dark:text-red-300">{dashboardData.totalExpenses.toFixed(2)}</p>
                        <p className="text-xs text-red-600"><SarIcon /></p>
                      </div>
                      <div className="p-4 rounded-xl border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-5 h-5 text-orange-600" />
                          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">إجمالي المصروفات (مخزون+تشغيل)</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-800 dark:text-orange-300">{(dashboardData.totalCogs + dashboardData.totalExpenses).toFixed(2)}</p>
                        <p className="text-xs text-orange-600"><SarIcon /></p>
                      </div>
                    </div>

                    {/* Detailed Financial Breakdown */}
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        تفصيل العمليات المالية
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">البند</TableHead>
                            <TableHead className="text-right">القيمة</TableHead>
                            <TableHead className="text-right">النسبة من الإيرادات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">{tc("إجمالي الإيرادات", "Total Revenue")}</TableCell>
                            <TableCell className="text-green-600 font-bold">{dashboardData.totalRevenue.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell>100%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">ضريبة القيمة المضافة (المحصلة)</TableCell>
                            <TableCell className="text-accent">{dashboardData.totalVat.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell>{dashboardData.totalRevenue > 0 ? ((dashboardData.totalVat / dashboardData.totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">تكلفة مخزون الأطباق (مصروف)</TableCell>
                            <TableCell className="text-orange-600">{dashboardData.totalCogs.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell>{dashboardData.totalRevenue > 0 ? ((dashboardData.totalCogs / dashboardData.totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">{tc("المصروفات التشغيلية", "Operating Expenses")}</TableCell>
                            <TableCell className="text-red-600">{dashboardData.totalExpenses.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell>{dashboardData.totalRevenue > 0 ? ((dashboardData.totalExpenses / dashboardData.totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                          <TableRow className="bg-red-50/50 dark:bg-red-900/20">
                            <TableCell className="font-bold text-lg">= إجمالي المصروفات</TableCell>
                            <TableCell className="font-bold text-lg text-red-700">{(dashboardData.totalCogs + dashboardData.totalExpenses).toFixed(2)} <SarIcon /></TableCell>
                            <TableCell className="font-bold">{dashboardData.totalRevenue > 0 ? (((dashboardData.totalCogs + dashboardData.totalExpenses) / dashboardData.totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LineChart className="w-5 h-5 text-green-600" />
                        تطور الإيرادات اليومية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData.dailyTrend && dashboardData.dailyTrend.length > 0 ? (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardData.dailyTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={(value) => {
                                  const date = new Date(value);
                                  return `${date.getDate()}/${date.getMonth() + 1}`;
                                }}
                              />
                              <YAxis />
                              <Tooltip 
                                formatter={(value: number) => [`${value.toFixed(2)} ر.س`]}
                                labelFormatter={(label) => {
                                  const date = new Date(label);
                                  return format(date, "EEEE dd/MM/yyyy", { locale: ar });
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#10b981" 
                                fill="#10b981" 
                                fillOpacity={0.3}
                                name="الإيرادات"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Profit vs Expenses */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        مقارنة الأرباح والمصروفات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData.weeklyTrend && dashboardData.weeklyTrend.length > 0 ? (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.weeklyTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="week" />
                              <YAxis />
                              <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                              <Legend />
                              <Bar dataKey="revenue" fill="#10b981" name="الإيرادات" />
                              <Bar dataKey="cogs" fill="#f97316" name="تكلفة المخزون" />
                              <Bar dataKey="expenses" fill="#ef4444" name="المصروفات التشغيلية" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Reports */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Methods Analysis */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-green-600" />
                        تحليل طرق الدفع
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {paymentMethodData.length > 0 ? (
                        <>
                          <div className="h-[200px] mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={paymentMethodData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  fill="#8884d8"
                                  paddingAngle={5}
                                  dataKey="value"
                                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                  {paymentMethodData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">طريقة الدفع</TableHead>
                                <TableHead className="text-right">المبلغ</TableHead>
                                <TableHead className="text-right">النسبة</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paymentMethodData.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell>{item.value.toFixed(2)} <SarIcon /></TableCell>
                                  <TableCell>
                                    {dashboardData.totalRevenue > 0 
                                      ? ((item.value / dashboardData.totalRevenue) * 100).toFixed(1) 
                                      : 0}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Expense Categories Analysis */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-red-600" />
                        تحليل فئات المصروفات
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={handleExportExpensesExcel}>
                        <FileSpreadsheet className="w-4 h-4 ml-1" />
                        تصدير
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {expenseCategoryData.length > 0 ? (
                        <>
                          <div className="h-[200px] mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={expenseCategoryData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" width={100} />
                                <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ر.س`]} />
                                <Bar dataKey="value" fill="#ef4444" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">الفئة</TableHead>
                                <TableHead className="text-right">المبلغ</TableHead>
                                <TableHead className="text-right">النسبة</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {expenseCategoryData.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell className="text-red-600">{item.value.toFixed(2)} <SarIcon /></TableCell>
                                  <TableCell>
                                    {dashboardData.totalExpenses > 0 
                                      ? ((item.value / dashboardData.totalExpenses) * 100).toFixed(1) 
                                      : 0}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">لا توجد مصروفات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Key Performance Indicators */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-accent" />
                      مؤشرات الأداء الرئيسية (KPIs)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-accent" />
                        <p className="text-2xl font-bold">{dashboardData.orderCount}</p>
                        <p className="text-sm text-muted-foreground">{tc("عدد الطلبات", "Order Count")}</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <Receipt className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <p className="text-2xl font-bold">{dashboardData.invoiceCount}</p>
                        <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold">
                          {dashboardData.orderCount > 0 
                            ? (dashboardData.totalRevenue / dashboardData.orderCount).toFixed(2)
                            : "0"}
                        </p>
                        <p className="text-sm text-muted-foreground">متوسط قيمة الطلب</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <Percent className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                        <p className="text-2xl font-bold text-orange-600">
                          {dashboardData.totalRevenue > 0 ? ((dashboardData.totalCogs / dashboardData.totalRevenue) * 100).toFixed(1) : "0"}%
                        </p>
                        <p className="text-sm text-muted-foreground">نسبة تكلفة المخزون</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Drilldown Dialog */}
        <Dialog open={drilldownOpen} onOpenChange={closeDrilldown}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={closeDrilldown}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {drilldownType === 'revenue' && 'تفاصيل الإيرادات'}
                {drilldownType === 'cogs' && 'تفاصيل تكلفة المكونات (COGS)'}
                {drilldownType === 'expenses' && 'تفاصيل المصروفات'}
                {drilldownType === 'orders' && 'تفاصيل الطلبات والأرباح'}
              </DialogTitle>
              <DialogDescription>
                {drilldownType === 'revenue' && 'جميع الطلبات المساهمة في الإيرادات'}
                {drilldownType === 'cogs' && 'تكلفة المكونات المستخدمة في الطلبات'}
                {drilldownType === 'expenses' && 'جميع المصروفات التشغيلية'}
                {drilldownType === 'orders' && 'تفصيل الطلبات مع هوامش الربح'}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[60vh]">
              {(drilldownType === 'revenue' || drilldownType === 'orders') && (
                isOrdersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">رقم الطلب</TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                        <TableHead className="text-right">التكلفة</TableHead>
                        <TableHead className="text-right">الربح</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersData?.orders?.filter(o => o.status !== 'cancelled').map((order) => {
                        const profit = order.totalAmount - (order.costOfGoods || 0);
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>{order.customerName || 'عميل'}</TableCell>
                            <TableCell className="text-green-600 font-medium">{order.totalAmount?.toFixed(2)} <SarIcon /></TableCell>
                            <TableCell className="text-accent">{(order.costOfGoods || 0).toFixed(2)} <SarIcon /></TableCell>
                            <TableCell className={profit >= 0 ? 'text-blue-600 font-medium' : 'text-red-600'}>
                              {profit.toFixed(2)} <SarIcon />
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                                {order.status === 'completed' ? 'مكتمل' : order.status === 'pending' ? 'قيد الانتظار' : order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm", { locale: ar })}</TableCell>
                          </TableRow>
                        );
                      })}
                      {(!ordersData?.orders || ordersData.orders.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            لا توجد طلبات
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )
              )}

              {drilldownType === 'cogs' && (
                <>
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">تكلفة المكونات حسب الطلب</h4>
                    {isOrdersLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">رقم الطلب</TableHead>
                            <TableHead className="text-right">الإجمالي</TableHead>
                            <TableHead className="text-right">تكلفة المكونات</TableHead>
                            <TableHead className="text-right">{tc("هامش الربح", "Profit Margin")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ordersData?.orders?.filter(o => o.costOfGoods && o.costOfGoods > 0).map((order) => {
                            const margin = order.totalAmount > 0 ? ((order.totalAmount - (order.costOfGoods || 0)) / order.totalAmount * 100) : 0;
                            return (
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                <TableCell>{order.totalAmount?.toFixed(2)} <SarIcon /></TableCell>
                                <TableCell className="text-accent font-medium">{order.costOfGoods?.toFixed(2)} <SarIcon /></TableCell>
                                <TableCell className={margin >= 50 ? 'text-green-600' : margin >= 30 ? 'text-accent' : 'text-red-600'}>
                                  {margin.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <h4 className="font-semibold mb-2">حركات المخزون</h4>
                    {isStockLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-accent" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">المادة</TableHead>
                            <TableHead className="text-right">النوع</TableHead>
                            <TableHead className="text-right">الكمية</TableHead>
                            <TableHead className="text-right">الرصيد السابق</TableHead>
                            <TableHead className="text-right">الرصيد الجديد</TableHead>
                            <TableHead className="text-right">ملاحظات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockMovementsData?.movements?.slice(0, 20).map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell>{movement.rawItemName || 'مادة'}</TableCell>
                              <TableCell>
                                <Badge variant={movement.movementType === 'sale' ? 'destructive' : movement.movementType === 'purchase' ? 'default' : 'secondary'}>
                                  {movement.movementType === 'sale' ? 'بيع' : movement.movementType === 'purchase' ? 'شراء' : movement.movementType}
                                </Badge>
                              </TableCell>
                              <TableCell className={movement.quantity < 0 ? 'text-red-600' : 'text-green-600'}>
                                {movement.quantity.toFixed(3)}
                              </TableCell>
                              <TableCell>{movement.previousQuantity.toFixed(3)}</TableCell>
                              <TableCell>{movement.newQuantity.toFixed(3)}</TableCell>
                              <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                {movement.notes}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </>
              )}

              {drilldownType === 'expenses' && (
                isExpensesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">الضريبة</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesData?.expenses?.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{format(new Date(expense.date), "yyyy/MM/dd", { locale: ar })}</TableCell>
                          <TableCell>
                            {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                          </TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>{expense.amount.toFixed(2)} <SarIcon /></TableCell>
                          <TableCell>{expense.vatAmount.toFixed(2)} <SarIcon /></TableCell>
                          <TableCell className="font-bold text-red-600">{expense.totalAmount.toFixed(2)} <SarIcon /></TableCell>
                          <TableCell>
                            <Badge variant={statusLabels[expense.status]?.variant || "secondary"}>
                              {statusLabels[expense.status]?.label || expense.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!expensesData?.expenses || expensesData.expenses.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            لا توجد مصروفات
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Add Expense Dialog */}
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مصروف جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>الفئة</Label>
                <Select value={newExpense.category} onValueChange={(v) => setNewExpense(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الوصف</Label>
                <Input 
                  value={newExpense.description}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف المصروف"
                  data-testid="input-expense-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>المبلغ</Label>
                  <Input 
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    data-testid="input-expense-amount"
                  />
                </div>
                <div>
                  <Label>الضريبة</Label>
                  <Input 
                    type="number"
                    value={newExpense.vatAmount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, vatAmount: e.target.value }))}
                    placeholder="0.00"
                    data-testid="input-expense-vat"
                  />
                </div>
              </div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={newExpense.paymentMethod} onValueChange={(v) => setNewExpense(prev => ({ ...prev, paymentMethod: v }))}>
                  <SelectTrigger data-testid="select-expense-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="credit_card">بطاقة ائتمان</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea 
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="ملاحظات إضافية (اختياري)"
                  data-testid="input-expense-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleAddExpense}
                disabled={!newExpense.category || !newExpense.description || !newExpense.amount || createExpenseMutation.isPending}
                className="bg-primary hover:bg-primary"
                data-testid="button-submit-expense"
              >
                {createExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </PlanGate>
  );
}
