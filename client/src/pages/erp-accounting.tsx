import { useTranslate, tc } from "@/lib/useTranslate";
import { PlanGate } from "@/components/plan-gate";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Receipt,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Building2,
  PiggyBank,
  CreditCard,
  Banknote,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Settings,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  BookOpen,
  Users,
  Scale,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";
import { format, subDays, startOfMonth, endOfMonth, isValid } from "date-fns";
import { ar } from "date-fns/locale";
import SarIcon from "@/components/sar-icon";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

const safeFormat = (value: any, fmt: string, opts?: object) => {
  if (!value) return "—";
  const d = new Date(value);
  if (!isValid(d)) return "—";
  return format(d, fmt, opts);
};

interface Account {
  id: string;
  accountNumber: string;
  nameAr: string;
  nameEn?: string;
  accountType: string;
  normalBalance: string;
  currentBalance: number;
  isActive: number;
  level: number;
  children?: Account[];
}

interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  accountsReceivable: number;
  accountsPayable: number;
  cashBalance: number;
  pendingExpenses: number;
  invoiceCount: number;
  orderCount?: number;
  usingOrderData?: boolean;
}

interface TrialBalanceItem {
  accountNumber: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
}

interface IncomeStatement {
  revenue: Array<{ accountName: string; amount: number }>;
  totalRevenue: number;
  expenses: Array<{ accountName: string; amount: number }>;
  totalExpenses: number;
  cogs: number;
  grossProfit: number;
  netIncome: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string;
  customerTaxNumber?: string;
  status: string;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  zatcaQrCode?: string;
  zatcaHash?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    lineTotal: number;
  }>;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  lines: Array<{
    accountId: string;
    accountNumber: string;
    accountName: string;
    debit: number;
    credit: number;
    description?: string;
    branchId?: string;
  }>;
  totalDebit: number;
  totalCredit: number;
  status: string;
  referenceType?: string;
  referenceId?: string;
  createdBy: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  status: string;
  accountId?: string;
  vendorId?: string;
  vendorName?: string;
  createdAt: string;
  approvedBy?: string;
}

interface Vendor {
  id: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  address?: string;
  isActive: number;
}

interface BalanceSheet {
  assets: Array<{ accountName: string; balance: number }>;
  totalAssets: number;
  liabilities: Array<{ accountName: string; balance: number }>;
  totalLiabilities: number;
  equity: Array<{ accountName: string; balance: number }>;
  totalEquity: number;
}

const invoiceStatusLabels: Record<string, string> = {
  draft: tc("مسودة", "Draft"),
  issued: tc("صادرة", "Issued"),
  sent: tc("مرسلة", "Sent"),
  paid: tc("مدفوعة", "Paid"),
  partially_paid: tc("مدفوعة جزئياً", "Partially Paid"),
  overdue: tc("متأخرة", "Overdue"),
  cancelled: tc("ملغاة", "Cancelled"),
  voided: tc("ملغاة", "Voided"),
};

const invoiceStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  issued: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  sent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  partially_paid: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const accountTypeLabels: Record<string, string> = {
  asset: tc("أصول", "Assets"),
  liability: tc("خصوم", "Liabilities"),
  equity: tc("حقوق ملكية", "Equity"),
  revenue: tc("إيرادات", "Revenue"),
  expense: tc("مصروفات", "Expenses"),
  contra: tc("حساب مقابل", "Contra Account"),
};

const accountTypeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  revenue: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const journalStatusLabels: Record<string, string> = {
  draft: tc("مسودة", "Draft"),
  posted: tc("مرحل", "Posted"),
};

const journalStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const expenseStatusLabels: Record<string, string> = {
  pending_approval: tc("بانتظار الموافقة", "Pending Approval"),
  approved: tc("معتمد", "Approved"),
  rejected: tc("مرفوض", "Rejected"),
  paid: tc("مدفوع", "Paid"),
};

const expenseStatusColors: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const expenseCategoryLabels: Record<string, string> = {
  operating: tc("تشغيلية", "Operating"),
  salary: tc("رواتب", "Salary"),
  rent: tc("إيجار", "Rent"),
  utilities: tc("مرافق", "Utilities"),
  marketing: tc("تسويق", "Marketing"),
  maintenance: tc("صيانة", "Maintenance"),
  other: tc("أخرى", "Other"),
};

function flattenAccounts(accounts: Account[]): Account[] {
  const result: Account[] = [];
  function traverse(accs: Account[]) {
    for (const acc of accs) {
      result.push(acc);
      if (acc.children && acc.children.length > 0) {
        traverse(acc.children);
      }
    }
  }
  traverse(accounts);
  return result;
}

function AccountTreeNode({ account, level = 0 }: { account: Account; level?: number }) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = account.children && account.children.length > 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover-elevate cursor-pointer"
          style={{ paddingRight: `${level * 20 + 12}px` }}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}
          <span className="font-mono text-sm text-muted-foreground">{account.accountNumber}</span>
          <span className="flex-1 font-medium">{account.nameAr}</span>
          <Badge className={accountTypeColors[account.accountType] || "bg-gray-100"}>
            {accountTypeLabels[account.accountType]}
          </Badge>
          <span className="font-mono text-sm min-w-[100px] text-left">
            {account.currentBalance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
          </span>
        </div>
        {hasChildren && (
          <CollapsibleContent>
            {account.children?.map((child) => (
              <AccountTreeNode key={child.id} account={child} level={level + 1} />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color,
}: {
  title: string;
  value: number;
  icon: any;
  trend?: "up" | "down";
  trendValue?: string;
  color: string;
}) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {value.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
            </p>
            {trend && trendValue && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
                {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {trendValue}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ErpAccountingPage() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({
    accountNumber: "",
    nameAr: "",
    nameEn: "",
    accountType: "asset",
    normalBalance: "debit",
    openingBalance: 0,
    parentAccountId: "",
  });
  const [showAddJournalDialog, setShowAddJournalDialog] = useState(false);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [showAddVendorDialog, setShowAddVendorDialog] = useState(false);
  const [newJournal, setNewJournal] = useState({ description: "", lines: [{ accountId: "", accountNumber: "", accountName: "", debit: 0, credit: 0 }, { accountId: "", accountNumber: "", accountName: "", debit: 0, credit: 0 }] });
  const [newExpense, setNewExpense] = useState({ description: "", amount: 0, category: "operating", accountId: "", paymentMethod: "cash" });
  const [newVendor, setNewVendor] = useState({ nameAr: "", nameEn: "", phone: "", email: "", taxNumber: "" });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ success: boolean; summary: DashboardSummary }>({
    queryKey: ["/api/erp/dashboard"],
  });

  const { data: accountsData, isLoading: accountsLoading } = useQuery<{ success: boolean; tree: Account[] }>({
    queryKey: ["/api/erp/accounts/tree"],
  });

  const { data: trialBalanceData, isLoading: trialBalanceLoading } = useQuery<{ success: boolean; trialBalance: TrialBalanceItem[] }>({
    queryKey: ["/api/erp/reports/trial-balance"],
  });

  const { data: incomeStatementData, isLoading: incomeLoading } = useQuery<{ success: boolean; incomeStatement: IncomeStatement }>({
    queryKey: ["/api/erp/reports/income-statement"],
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ success: boolean; invoices: Invoice[] }>({
    queryKey: ["/api/erp/invoices"],
  });

  const { data: journalData, isLoading: journalLoading } = useQuery<{ success: boolean; entries: JournalEntry[] }>({
    queryKey: ["/api/erp/journal-entries"],
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery<{ success: boolean; expenses: Expense[] }>({
    queryKey: ["/api/erp/expenses"],
  });

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery<{ success: boolean; vendors: Vendor[] }>({
    queryKey: ["/api/erp/vendors"],
  });

  const { data: balanceSheetData, isLoading: balanceSheetLoading } = useQuery<{ success: boolean; balanceSheet: BalanceSheet }>({
    queryKey: ["/api/erp/reports/balance-sheet"],
  });

  const initializeAccountsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/erp/accounts/initialize"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/accounts/tree"] });
      toast({ title: tc("تم إنشاء دليل الحسابات بنجاح", "Chart of accounts created successfully") });
    },
    onError: () => {
      toast({ title: tc("فشل في إنشاء دليل الحسابات", "Failed to create chart of accounts"), variant: "destructive" });
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: typeof newAccount) => apiRequest("POST", "/api/erp/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/accounts/tree"] });
      setShowAddAccountDialog(false);
      setNewAccount({ accountNumber: "", nameAr: "", nameEn: "", accountType: "asset", normalBalance: "debit", openingBalance: 0, parentAccountId: "" });
      toast({ title: tc("تم إنشاء الحساب بنجاح", "Account created successfully") });
    },
    onError: (error: any) => {
      toast({ title: error.message || tc("فشل في إنشاء الحساب", "Failed to create account"), variant: "destructive" });
    },
  });

  const createJournalMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/erp/journal-entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/reports/trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/reports/income-statement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/reports/balance-sheet"] });
      setShowAddJournalDialog(false);
      setNewJournal({ description: "", lines: [{ accountId: "", accountNumber: "", accountName: "", debit: 0, credit: 0 }, { accountId: "", accountNumber: "", accountName: "", debit: 0, credit: 0 }] });
      toast({ title: tc("تم إنشاء القيد بنجاح", "Journal entry created successfully") });
    },
    onError: (error: any) => { toast({ title: error.message || tc("فشل في إنشاء القيد", "Failed to create journal entry"), variant: "destructive" }); },
  });

  const postJournalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/erp/journal-entries/${id}/post`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/accounts/tree"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/dashboard"] });
      toast({ title: tc("تم ترحيل القيد بنجاح", "Journal entry posted successfully") });
    },
    onError: (error: any) => { toast({ title: error.message || tc("فشل في ترحيل القيد", "Failed to post journal entry"), variant: "destructive" }); },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/erp/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/dashboard"] });
      setShowAddExpenseDialog(false);
      setNewExpense({ description: "", amount: 0, category: "operating", accountId: "", paymentMethod: "cash" });
      toast({ title: tc("تم إضافة المصروف بنجاح", "Expense added successfully") });
    },
    onError: (error: any) => { toast({ title: error.message || tc("فشل في إضافة المصروف", "Failed to add expense"), variant: "destructive" }); },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/erp/expenses/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erp/dashboard"] });
      toast({ title: tc("تم اعتماد المصروف بنجاح", "Expense approved successfully") });
    },
    onError: (error: any) => { toast({ title: error.message || tc("فشل في اعتماد المصروف", "Failed to approve expense"), variant: "destructive" }); },
  });

  const createVendorMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/erp/vendors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp/vendors"] });
      setShowAddVendorDialog(false);
      setNewVendor({ nameAr: "", nameEn: "", phone: "", email: "", taxNumber: "" });
      toast({ title: tc("تم إضافة المورد بنجاح", "Supplier added successfully") });
    },
    onError: (error: any) => { toast({ title: error.message || tc("فشل في إضافة المورد", "Failed to add supplier"), variant: "destructive" }); },
  });

  const summary = dashboardData?.summary;
  const accounts = accountsData?.tree || [];
  const trialBalance = trialBalanceData?.trialBalance || [];
  const incomeStatement = incomeStatementData?.incomeStatement;
  const invoices = invoicesData?.invoices || [];
  const journalEntries = journalData?.entries || [];
  const expenses = expensesData?.expenses || [];
  const vendors = vendorsData?.vendors || [];
  const balanceSheet = balanceSheetData?.balanceSheet;
  const flatAccounts = flattenAccounts(accounts);

  const totalDebit = trialBalance.reduce((sum, item) => sum + item.debitBalance, 0);
  const totalCredit = trialBalance.reduce((sum, item) => sum + item.creditBalance, 0);

  return (
    <PlanGate feature="erpIntegration">
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="btn-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold font-playfair text-foreground">{tc("نظام المحاسبة ERP", "ERP Accounting System")}</h1>
              <p className="text-muted-foreground mt-1">{tc("إدارة الحسابات والتقارير المالية", "Manage accounts and financial reports")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/erp"] });
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Button
              onClick={() => initializeAccountsMutation.mutate()}
              disabled={initializeAccountsMutation.isPending}
              data-testid="button-init-coa"
            >
              {initializeAccountsMutation.isPending ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Settings className="h-4 w-4 ml-2" />
              )}
              تهيئة دليل الحسابات
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="h-4 w-4 ml-2" />
              لوحة التحكم
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">
              <Receipt className="h-4 w-4 ml-2" />
              الفواتير
            </TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts">
              <Building2 className="h-4 w-4 ml-2" />
              دليل الحسابات
            </TabsTrigger>
            <TabsTrigger value="trial-balance" data-testid="tab-trial-balance">
              <FileText className="h-4 w-4 ml-2" />
              ميزان المراجعة
            </TabsTrigger>
            <TabsTrigger value="income" data-testid="tab-income">
              <TrendingUp className="h-4 w-4 ml-2" />
              قائمة الدخل
            </TabsTrigger>
            <TabsTrigger value="journal-entries" data-testid="tab-journal-entries">
              <BookOpen className="h-4 w-4 ml-2" />
              القيود
            </TabsTrigger>
            <TabsTrigger value="expenses" data-testid="tab-expenses">
              <Wallet className="h-4 w-4 ml-2" />
              المصروفات
            </TabsTrigger>
            <TabsTrigger value="vendors" data-testid="tab-vendors">
              <Users className="h-4 w-4 ml-2" />
              الموردين
            </TabsTrigger>
            <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet">
              <Scale className="h-4 w-4 ml-2" />
              الميزانية
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : summary ? (
              <>
                {summary.usingOrderData && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
                    <BookOpen className="h-5 w-5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <span className="font-semibold">البيانات مأخوذة من الطلبات الفعلية</span>
                      <span className="mr-2 text-blue-600 dark:text-blue-300">— لم يتم إعداد قيود المحاسبة بعد. يمكنك تهيئة دليل الحسابات من تبويب "الحسابات" لتفعيل القيد المزدوج الكامل.</span>
                    </div>
                    {summary.orderCount !== undefined && (
                      <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 shrink-0">
                        {summary.orderCount} طلب
                      </Badge>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SummaryCard
                    title="إجمالي الإيرادات"
                    value={summary.totalRevenue}
                    icon={TrendingUp}
                    color="bg-green-500"
                    trend="up"
                    trendValue={summary.usingOrderData ? `${summary.orderCount || 0} طلب` : "+12%"}
                  />
                  <SummaryCard
                    title="مصروفات التشغيل"
                    value={summary.totalExpenses}
                    icon={TrendingDown}
                    color="bg-red-500"
                  />
                  <SummaryCard
                    title="الذمم الدائنة (موردين)"
                    value={summary.accountsPayable}
                    icon={TrendingDown}
                    color="bg-orange-500"
                  />
                  <SummaryCard
                    title="رصيد الصندوق"
                    value={summary.cashBalance}
                    icon={Wallet}
                    color="bg-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                          <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">الذمم المدينة</p>
                          <p className="text-lg font-bold">{summary.accountsReceivable.toLocaleString("ar-SA")} <SarIcon /></p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                          <Banknote className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">الذمم الدائنة</p>
                          <p className="text-lg font-bold">{summary.accountsPayable.toLocaleString("ar-SA")} <SarIcon /></p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                          <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">مصروفات معلقة</p>
                          <p className="text-lg font-bold">{summary.pendingExpenses}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                          <Receipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">عدد الفواتير</p>
                          <p className="text-lg font-bold">{summary.invoiceCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">الإيرادات مقابل المصروفات</CardTitle>
                      <CardDescription>مقارنة الأداء المالي</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: "الإيرادات",
                                value: summary.totalRevenue,
                                fill: "#22c55e",
                              },
                              {
                                name: "المصروفات",
                                value: summary.totalExpenses,
                                fill: "#ef4444",
                              },
                              {
                                name: "الذمم الدائنة",
                                value: summary.accountsPayable,
                                fill: "#f97316",
                              },
                            ]}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                            <YAxis type="category" dataKey="name" width={80} />
                            <Tooltip
                              formatter={(value: number) => [`${value.toLocaleString("ar-SA")} ر.س`, ""]}
                              contentStyle={{ direction: "rtl" }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">توزيع الأصول والخصوم</CardTitle>
                      <CardDescription>المركز المالي</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "رصيد الصندوق", value: summary.cashBalance, color: "#3b82f6" },
                                { name: "الذمم المدينة", value: summary.accountsReceivable, color: "#22c55e" },
                                { name: "الذمم الدائنة", value: summary.accountsPayable, color: "#ef4444" },
                              ].filter(item => item.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {[
                                { name: "رصيد الصندوق", value: summary.cashBalance, color: "#3b82f6" },
                                { name: "الذمم المدينة", value: summary.accountsReceivable, color: "#22c55e" },
                                { name: "الذمم الدائنة", value: summary.accountsPayable, color: "#ef4444" },
                              ].filter(item => item.value > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [`${value.toLocaleString("ar-SA")} ر.س`, ""]}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {incomeStatement && (
                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">تفاصيل قائمة الدخل</CardTitle>
                      <CardDescription>الإيرادات والمصروفات حسب الفئة</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              ...incomeStatement.revenue.map(r => ({
                                name: r.accountName.substring(0, 15),
                                amount: r.amount,
                                type: "إيراد",
                                fill: "#22c55e",
                              })),
                              ...incomeStatement.expenses.map(e => ({
                                name: e.accountName.substring(0, 15),
                                amount: e.amount,
                                type: "مصروف",
                                fill: "#ef4444",
                              })),
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                            <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                            <Tooltip
                              formatter={(value: number, name) => [`${value.toLocaleString("ar-SA")} ر.س`, name === "amount" ? "المبلغ" : name]}
                              contentStyle={{ direction: "rtl" }}
                            />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-card border-border/50">
                <CardContent className="p-12 text-center">
                  <PiggyBank className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد بيانات</h3>
                  <p className="text-muted-foreground mb-4">يرجى تهيئة دليل الحسابات أولاً</p>
                  <Button onClick={() => initializeAccountsMutation.mutate()} disabled={initializeAccountsMutation.isPending}>
                    تهيئة دليل الحسابات
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">الفواتير الضريبية</h2>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  متوافق مع ZATCA
                </Badge>
              </div>
            </div>

            <Card className="bg-card border-border/50">
              {invoicesLoading ? (
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </CardContent>
              ) : invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الفاتورة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-left">الإجمالي</TableHead>
                      <TableHead className="text-left">الضريبة</TableHead>
                      <TableHead className="text-center">QR</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          {safeFormat(invoice.invoiceDate, "dd/MM/yyyy", { locale: ar })}
                        </TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>
                          <Badge className={invoiceStatusColors[invoice.status] || "bg-gray-100"}>
                            {invoiceStatusLabels[invoice.status] || invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left font-mono">
                          {invoice.grandTotal.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </TableCell>
                        <TableCell className="text-left font-mono">
                          {invoice.totalTax.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </TableCell>
                        <TableCell className="text-center">
                          {invoice.zatcaQrCode ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3" />
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600">-</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowInvoiceDialog(true);
                            }}
                            data-testid={`button-view-invoice-${invoice.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <CardContent className="p-12 text-center">
                  <Receipt className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد فواتير</h3>
                  <p className="text-muted-foreground">سيتم عرض الفواتير الضريبية هنا</p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tc("دليل الحسابات", "Chart of Accounts")}</h2>
              <Button onClick={() => setShowAddAccountDialog(true)} data-testid="button-add-account">
                <Plus className="h-4 w-4 ml-2" />
                إضافة حساب
              </Button>
            </div>

            <Card className="bg-card border-border/50">
              {accountsLoading ? (
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </CardContent>
              ) : accounts.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="p-4">
                    {accounts.map((account) => (
                      <AccountTreeNode key={account.id} account={account} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <CardContent className="p-12 text-center">
                  <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا يوجد دليل حسابات</h3>
                  <p className="text-muted-foreground mb-4">اضغط على تهيئة دليل الحسابات لإنشاء الحسابات الافتراضية</p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="trial-balance" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tc("ميزان المراجعة", "Trial Balance")}</h2>
              <Button variant="outline" data-testid="button-export-trial-balance">
                <Download className="h-4 w-4 ml-2" />
                تصدير
              </Button>
            </div>

            <Card className="bg-card border-border/50">
              {trialBalanceLoading ? (
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </CardContent>
              ) : trialBalance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الحساب</TableHead>
                      <TableHead className="text-right">اسم الحساب</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-left">مدين</TableHead>
                      <TableHead className="text-left">دائن</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{item.accountNumber}</TableCell>
                        <TableCell>{item.accountName}</TableCell>
                        <TableCell>
                          <Badge className={accountTypeColors[item.accountType] || "bg-gray-100"}>
                            {accountTypeLabels[item.accountType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left font-mono">
                          {item.debitBalance > 0 ? item.debitBalance.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "-"}
                        </TableCell>
                        <TableCell className="text-left font-mono">
                          {item.creditBalance > 0 ? item.creditBalance.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3} className="text-right">المجموع</TableCell>
                      <TableCell className="text-left font-mono">{totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-left font-mono">{totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد بيانات</h3>
                  <p className="text-muted-foreground">يرجى تهيئة دليل الحسابات وإضافة قيود</p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="income" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tc("قائمة الدخل", "Income Statement")}</h2>
              <Button variant="outline" data-testid="button-export-income">
                <Download className="h-4 w-4 ml-2" />
                تصدير
              </Button>
            </div>

            {incomeLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : incomeStatement ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      الإيرادات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {incomeStatement.revenue.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span>{item.accountName}</span>
                        <span className="font-mono text-green-600">{item.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3 font-bold bg-green-50 dark:bg-green-900/20 px-3 rounded">
                      <span>{tc("إجمالي الإيرادات", "Total Revenue")}</span>
                      <span className="font-mono text-green-600">{incomeStatement.totalRevenue.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      المصروفات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                      <span>تكلفة البضاعة المباعة</span>
                      <span className="font-mono text-red-600">{incomeStatement.cogs.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                    </div>
                    {incomeStatement.expenses.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span>{item.accountName}</span>
                        <span className="font-mono text-red-600">{item.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3 font-bold bg-red-50 dark:bg-red-900/20 px-3 rounded">
                      <span>إجمالي المصروفات</span>
                      <span className="font-mono text-red-600">{(incomeStatement.totalExpenses + incomeStatement.cogs).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">إجمالي الربح</p>
                        <p className="text-2xl font-bold text-green-600">
                          {incomeStatement.grossProfit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </p>
                      </div>
                      <div className="border-x border-border">
                        <p className="text-sm text-muted-foreground mb-1">مصروفات التشغيل</p>
                        <p className="text-2xl font-bold text-red-600">
                          {incomeStatement.totalExpenses.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">إجمالي المصروفات (مخزون+تشغيل)</p>
                        <p className="text-2xl font-bold text-red-600">
                          {(incomeStatement.cogs + incomeStatement.totalExpenses).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-card border-border/50">
                <CardContent className="p-12 text-center">
                  <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد بيانات</h3>
                  <p className="text-muted-foreground">يرجى تهيئة دليل الحسابات وإضافة قيود</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="journal-entries" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">القيود المحاسبية</h2>
              <Button onClick={() => setShowAddJournalDialog(true)} data-testid="button-add-journal">
                <Plus className="h-4 w-4 ml-2" />
                إضافة قيد
              </Button>
            </div>

            <Card className="bg-card border-border/50">
              {journalLoading ? (
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </CardContent>
              ) : journalEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم القيد</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-left">مدين</TableHead>
                      <TableHead className="text-left">دائن</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono font-medium">{entry.entryNumber}</TableCell>
                        <TableCell>
                          {safeFormat(entry.entryDate, "dd/MM/yyyy", { locale: ar })}
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-left font-mono">
                          {entry.totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </TableCell>
                        <TableCell className="text-left font-mono">
                          {entry.totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </TableCell>
                        <TableCell>
                          <Badge className={journalStatusColors[entry.status] || "bg-gray-100"}>
                            {journalStatusLabels[entry.status] || entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => postJournalMutation.mutate(entry.id)}
                              disabled={postJournalMutation.isPending}
                              data-testid={`button-post-journal-${entry.id}`}
                            >
                              <CheckCircle className="h-4 w-4 ml-1" />
                              ترحيل
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد قيود محاسبية</h3>
                  <p className="text-muted-foreground">اضغط على إضافة قيد لإنشاء قيد جديد</p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tc("المصروفات", "Expenses")}</h2>
              <Button onClick={() => setShowAddExpenseDialog(true)} data-testid="button-add-expense">
                <Plus className="h-4 w-4 ml-2" />
                إضافة مصروف
              </Button>
            </div>

            <Card className="bg-card border-border/50">
              {expensesLoading ? (
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </CardContent>
              ) : expenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">الفئة</TableHead>
                      <TableHead className="text-left">المبلغ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>{expenseCategoryLabels[expense.category] || expense.category}</TableCell>
                        <TableCell className="text-left font-mono">
                          {expense.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </TableCell>
                        <TableCell>
                          <Badge className={expenseStatusColors[expense.status] || "bg-gray-100"}>
                            {expenseStatusLabels[expense.status] || expense.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {safeFormat(expense.createdAt, "dd/MM/yyyy", { locale: ar })}
                        </TableCell>
                        <TableCell className="text-center">
                          {expense.status === "pending_approval" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => approveExpenseMutation.mutate(expense.id)}
                              disabled={approveExpenseMutation.isPending}
                              data-testid={`button-approve-expense-${expense.id}`}
                            >
                              <CheckCircle className="h-4 w-4 ml-1" />
                              اعتماد
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <CardContent className="p-12 text-center">
                  <Wallet className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد مصروفات</h3>
                  <p className="text-muted-foreground">اضغط على إضافة مصروف لإنشاء مصروف جديد</p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">الموردين</h2>
              <Button onClick={() => setShowAddVendorDialog(true)} data-testid="button-add-vendor">
                <Plus className="h-4 w-4 ml-2" />
                إضافة مورد
              </Button>
            </div>

            <Card className="bg-card border-border/50">
              {vendorsLoading ? (
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </CardContent>
              ) : vendors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم (عربي)</TableHead>
                      <TableHead className="text-right">الاسم (إنجليزي)</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">البريد</TableHead>
                      <TableHead className="text-right">الرقم الضريبي</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.nameAr}</TableCell>
                        <TableCell>{vendor.nameEn || "-"}</TableCell>
                        <TableCell className="font-mono">{vendor.phone || "-"}</TableCell>
                        <TableCell>{vendor.email || "-"}</TableCell>
                        <TableCell className="font-mono">{vendor.taxNumber || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={vendor.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                            {vendor.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <CardContent className="p-12 text-center">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا يوجد موردين</h3>
                  <p className="text-muted-foreground">اضغط على إضافة مورد لإنشاء مورد جديد</p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="balance-sheet" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">الميزانية العمومية</h2>
              <Button variant="outline" data-testid="button-export-balance-sheet">
                <Download className="h-4 w-4 ml-2" />
                تصدير
              </Button>
            </div>

            {balanceSheetLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : balanceSheet ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        الأصول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {balanceSheet.assets.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-border/50">
                          <span>{item.accountName}</span>
                          <span className="font-mono text-green-600">{item.balance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-3 font-bold bg-green-50 dark:bg-green-900/20 px-3 rounded">
                        <span>إجمالي الأصول</span>
                        <span className="font-mono text-green-600">{balanceSheet.totalAssets.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        الخصوم
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {balanceSheet.liabilities.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-border/50">
                          <span>{item.accountName}</span>
                          <span className="font-mono text-red-600">{item.balance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-3 font-bold bg-red-50 dark:bg-red-900/20 px-3 rounded">
                        <span>إجمالي الخصوم</span>
                        <span className="font-mono text-red-600">{balanceSheet.totalLiabilities.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Scale className="h-5 w-5 text-purple-600" />
                        حقوق الملكية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {balanceSheet.equity.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-border/50">
                          <span>{item.accountName}</span>
                          <span className="font-mono text-purple-600">{item.balance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-3 font-bold bg-purple-50 dark:bg-purple-900/20 px-3 rounded">
                        <span>إجمالي حقوق الملكية</span>
                        <span className="font-mono text-purple-600">{balanceSheet.totalEquity.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">إجمالي الأصول</p>
                        <p className="text-2xl font-bold text-green-600">
                          {balanceSheet.totalAssets.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </p>
                      </div>
                      <div className="border-x border-border">
                        <p className="text-sm text-muted-foreground mb-1">إجمالي الخصوم</p>
                        <p className="text-2xl font-bold text-red-600">
                          {balanceSheet.totalLiabilities.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">حقوق الملكية</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {balanceSheet.totalEquity.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-card border-border/50">
                <CardContent className="p-12 text-center">
                  <Scale className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد بيانات</h3>
                  <p className="text-muted-foreground">يرجى تهيئة دليل الحسابات وإضافة قيود</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة حساب جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الحساب</Label>
                <Input
                  value={newAccount.accountNumber}
                  onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                  placeholder="مثال: 1115"
                  data-testid="input-account-number"
                />
              </div>
              <div className="space-y-2">
                <Label>نوع الحساب</Label>
                <Select
                  value={newAccount.accountType}
                  onValueChange={(value) => setNewAccount({ ...newAccount, accountType: value })}
                >
                  <SelectTrigger data-testid="select-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">أصول</SelectItem>
                    <SelectItem value="liability">خصوم</SelectItem>
                    <SelectItem value="equity">حقوق ملكية</SelectItem>
                    <SelectItem value="revenue">إيرادات</SelectItem>
                    <SelectItem value="expense">مصروفات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>الحساب الأب (اختياري)</Label>
              <Select
                value={newAccount.parentAccountId || "none"}
                onValueChange={(value) => setNewAccount({ ...newAccount, parentAccountId: value === "none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-parent-account">
                  <SelectValue placeholder="بدون حساب أب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون حساب أب</SelectItem>
                  {flatAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountNumber} - {acc.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اسم الحساب (عربي)</Label>
              <Input
                value={newAccount.nameAr}
                onChange={(e) => setNewAccount({ ...newAccount, nameAr: e.target.value })}
                placeholder="اسم الحساب"
                data-testid="input-account-name-ar"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم الحساب (إنجليزي)</Label>
              <Input
                value={newAccount.nameEn}
                onChange={(e) => setNewAccount({ ...newAccount, nameEn: e.target.value })}
                placeholder="Account Name"
                data-testid="input-account-name-en"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الطبيعة</Label>
                <Select
                  value={newAccount.normalBalance}
                  onValueChange={(value) => setNewAccount({ ...newAccount, normalBalance: value })}
                >
                  <SelectTrigger data-testid="select-normal-balance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">مدين</SelectItem>
                    <SelectItem value="credit">دائن</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الرصيد الافتتاحي</Label>
                <Input
                  type="number"
                  value={newAccount.openingBalance}
                  onChange={(e) => setNewAccount({ ...newAccount, openingBalance: parseFloat(e.target.value) || 0 })}
                  data-testid="input-opening-balance"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccountDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createAccountMutation.mutate(newAccount)}
              disabled={createAccountMutation.isPending || !newAccount.accountNumber || !newAccount.nameAr}
              data-testid="button-submit-account"
            >
              {createAccountMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : null}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              فاتورة ضريبية - {selectedInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={invoiceStatusColors[selectedInvoice.status] || "bg-gray-100"}>
                      {invoiceStatusLabels[selectedInvoice.status]}
                    </Badge>
                    {selectedInvoice.zatcaQrCode && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        متوافق مع ZATCA
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    التاريخ: {safeFormat(selectedInvoice.invoiceDate, "dd/MM/yyyy HH:mm", { locale: ar })}
                  </p>
                </div>

                {selectedInvoice.zatcaQrCode && (
                  <div className="text-center">
                    <img
                      src={selectedInvoice.zatcaQrCode}
                      alt="ZATCA QR Code"
                      className="w-32 h-32 border rounded-lg"
                      data-testid="img-zatca-qr"
                    />
                    <p className="text-xs text-muted-foreground mt-1">رمز ZATCA</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">بيانات العميل</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>الاسم:</strong> {selectedInvoice.customerName}</p>
                    {selectedInvoice.customerPhone && (
                      <p><strong>الهاتف:</strong> {selectedInvoice.customerPhone}</p>
                    )}
                    {selectedInvoice.customerTaxNumber && (
                      <p><strong>الرقم الضريبي:</strong> {selectedInvoice.customerTaxNumber}</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">ملخص الفاتورة</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{selectedInvoice.subtotal.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                    </div>
                    {selectedInvoice.totalDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>الخصم:</span>
                        <span className="font-mono">-{selectedInvoice.totalDiscount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ضريبة القيمة المضافة (15%):</span>
                      <span className="font-mono">{selectedInvoice.totalTax.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>الإجمالي:</span>
                      <span className="font-mono">{selectedInvoice.grandTotal.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} <SarIcon /></span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">تفاصيل البنود</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-left">السعر</TableHead>
                        <TableHead className="text-left">الضريبة</TableHead>
                        <TableHead className="text-left">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.lines?.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell className="text-center">{line.quantity}</TableCell>
                          <TableCell className="text-left font-mono">
                            {line.unitPrice.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-left font-mono">
                            {line.taxAmount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-left font-mono font-medium">
                            {line.lineTotal.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedInvoice.zatcaHash && (
                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <p className="font-medium mb-1">ZATCA TLV Hash:</p>
                  <code className="break-all">{selectedInvoice.zatcaHash}</code>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
              إغلاق
            </Button>
            <Button variant="default" data-testid="button-print-invoice">
              <Download className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddJournalDialog} onOpenChange={setShowAddJournalDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة قيد محاسبي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input
                value={newJournal.description}
                onChange={(e) => setNewJournal({ ...newJournal, description: e.target.value })}
                placeholder="وصف القيد"
                data-testid="input-journal-description"
              />
            </div>
            {newJournal.lines.map((line, index) => (
              <div key={index} className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs">الحساب</Label>
                  <Select
                    value={line.accountId || "none"}
                    onValueChange={(value) => {
                      const lines = [...newJournal.lines];
                      const selectedAcc = flatAccounts.find(a => a.id === value);
                      lines[index] = {
                        ...lines[index],
                        accountId: value === "none" ? "" : value,
                        accountNumber: selectedAcc?.accountNumber || "",
                        accountName: selectedAcc?.nameAr || "",
                      };
                      setNewJournal({ ...newJournal, lines });
                    }}
                  >
                    <SelectTrigger data-testid={`select-journal-line-account-${index}`}>
                      <SelectValue placeholder="اختر حساب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر حساب</SelectItem>
                      {flatAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.accountNumber} - {acc.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">مدين</Label>
                  <Input
                    type="number"
                    value={line.debit}
                    onChange={(e) => {
                      const lines = [...newJournal.lines];
                      lines[index] = { ...lines[index], debit: parseFloat(e.target.value) || 0 };
                      setNewJournal({ ...newJournal, lines });
                    }}
                    data-testid={`input-journal-line-debit-${index}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">دائن</Label>
                  <Input
                    type="number"
                    value={line.credit}
                    onChange={(e) => {
                      const lines = [...newJournal.lines];
                      lines[index] = { ...lines[index], credit: parseFloat(e.target.value) || 0 };
                      setNewJournal({ ...newJournal, lines });
                    }}
                    data-testid={`input-journal-line-credit-${index}`}
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setNewJournal({ ...newJournal, lines: [...newJournal.lines, { accountId: "", accountNumber: "", accountName: "", debit: 0, credit: 0 }] })}
              data-testid="button-add-journal-line"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة سطر
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddJournalDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createJournalMutation.mutate({
                description: newJournal.description,
                lines: newJournal.lines,
                autoPost: true,
                entryDate: new Date(),
              })}
              disabled={createJournalMutation.isPending || !newJournal.description}
              data-testid="button-submit-journal"
            >
              {createJournalMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : null}
              إنشاء القيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مصروف</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="وصف المصروف"
                data-testid="input-expense-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ</Label>
                <Input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                  data-testid="input-expense-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select
                  value={newExpense.category}
                  onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                >
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operating">تشغيلية</SelectItem>
                    <SelectItem value="salary">رواتب</SelectItem>
                    <SelectItem value="rent">إيجار</SelectItem>
                    <SelectItem value="utilities">مرافق</SelectItem>
                    <SelectItem value="marketing">تسويق</SelectItem>
                    <SelectItem value="maintenance">صيانة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select
                value={newExpense.paymentMethod}
                onValueChange={(value) => setNewExpense({ ...newExpense, paymentMethod: value })}
              >
                <SelectTrigger data-testid="select-expense-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="credit_card">بطاقة ائتمان</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                  <SelectItem value="mada">مدى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createExpenseMutation.mutate(newExpense)}
              disabled={createExpenseMutation.isPending || !newExpense.description || newExpense.amount <= 0}
              data-testid="button-submit-expense"
            >
              {createExpenseMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : null}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddVendorDialog} onOpenChange={setShowAddVendorDialog}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم المورد (عربي)</Label>
              <Input
                value={newVendor.nameAr}
                onChange={(e) => setNewVendor({ ...newVendor, nameAr: e.target.value })}
                placeholder="اسم المورد بالعربي"
                data-testid="input-vendor-name-ar"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم المورد (إنجليزي)</Label>
              <Input
                value={newVendor.nameEn}
                onChange={(e) => setNewVendor({ ...newVendor, nameEn: e.target.value })}
                placeholder="Vendor Name"
                data-testid="input-vendor-name-en"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                  data-testid="input-vendor-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  value={newVendor.email}
                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-vendor-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الرقم الضريبي</Label>
              <Input
                value={newVendor.taxNumber}
                onChange={(e) => setNewVendor({ ...newVendor, taxNumber: e.target.value })}
                placeholder="الرقم الضريبي"
                data-testid="input-vendor-tax-number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVendorDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createVendorMutation.mutate(newVendor)}
              disabled={createVendorMutation.isPending || !newVendor.nameAr}
              data-testid="button-submit-vendor"
            >
              {createVendorMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : null}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PlanGate>
  );
}
