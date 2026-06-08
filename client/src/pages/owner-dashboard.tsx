import { useEffect, useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Coffee, Database, Trash2, RefreshCw, AlertTriangle, 
  ShoppingCart, Users, Package, GitBranch, Settings,
  Calendar, CreditCard, Table, Clock, ChevronLeft, ChevronRight,
  Eye, BarChart3, Shield, ArrowRight, Utensils, Menu
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import { ManagerSidebar, MobileBottomNav } from "@/components/manager-sidebar";

interface CollectionStats {
  count: number;
  nameAr: string;
}

interface DatabaseStats {
  collections: Record<string, CollectionStats>;
  summary: {
    todayOrders: number;
    dayOrders?: number;
    dayRevenue?: number;
    totalRevenue: number;
    dayStart?: string;
    dayEnd?: string;
    dayStartHour?: number;
  };
}

function formatLocalDateISO(d: Date): string {
  const saudi = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return saudi.toISOString().slice(0, 10);
}

interface CollectionData {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const collectionIcons: Record<string, any> = {
  orders: ShoppingCart,
  customers: Users,
  employees: Users,
  coffeeItems: Package,
  branches: GitBranch,
  discountCodes: CreditCard,
  loyaltyCards: CreditCard,
  tables: Table,
  attendance: Clock,
  ingredients: Package,
  categories: Settings,
  deliveryZones: Settings
};

export default function OwnerDashboard() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateISO(new Date()));
  const [dayStartHour, setDayStartHour] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('qirox_day_start_hour') || '0', 10);
    return isNaN(v) ? 0 : Math.max(0, Math.min(23, v));
  });

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role !== 'owner' && emp.role !== 'admin') {
        setLocation("/employee/gateway");
        return;
      }
      setEmployee(emp);
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  useEffect(() => {
    if (employee) {
      fetchStats();
    }
  }, [employee, selectedDate, dayStartHour]);

  useEffect(() => {
    localStorage.setItem('qirox_day_start_hour', String(dayStartHour));
  }, [dayStartHour]);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionData(selectedCollection, currentPage);
    }
  }, [selectedCollection, currentPage]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const url = `/api/owner/database-stats?date=${encodeURIComponent(selectedDate)}&dayStartHour=${dayStartHour}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isToday = selectedDate === formatLocalDateISO(new Date());

  const fetchCollectionData = async (collection: string, page: number) => {
    try {
      const response = await fetch(`/api/owner/collection/${collection}?page=${page}&limit=20`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCollectionData(data);
      }
    } catch (error) {
      console.error("Error fetching collection data:", error);
    }
  };

  const deleteKeyword = tc('حذف', 'DELETE');
  const resetKeyword = tc('احذف جميع البيانات', 'DELETE ALL DATA');

  const handleDeleteCollection = async (collection: string) => {
    if (deleteConfirm !== deleteKeyword) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc(`يرجى كتابة '${deleteKeyword}' للتأكيد`, `Please type '${deleteKeyword}' to confirm`),
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await apiRequest('DELETE', `/api/owner/collection/${collection}`);
      const data = await response.json();

      toast({
        title: tc("تم الحذف", "Deleted"),
        description: data.message
      });

      fetchStats();
      setSelectedCollection(null);
      setCollectionData(null);
      setDeleteConfirm('');
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل الحذف", "Delete failed"),
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRecord = async (collection: string, id: string) => {
    try {
      await apiRequest('DELETE', `/api/owner/record/${collection}/${id}`);

      toast({
        title: tc("تم الحذف", "Deleted"),
        description: tc("تم حذف السجل بنجاح", "Record deleted successfully")
      });

      fetchCollectionData(collection, currentPage);
      fetchStats();
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل الحذف", "Delete failed"),
        variant: "destructive"
      });
    }
  };

  const handleResetOrdersOnly = async () => {
    if (!confirm(tc("سيتم حذف جميع الطلبات والمحاسبة. المنتجات والموظفون والصور ستبقى. هل أنت متأكد؟", "All orders and accounting will be deleted. Products, employees and images will be preserved. Are you sure?"))) return;
    try {
      const response = await apiRequest('DELETE', '/api/admin/reset-orders-only');
      const data = await response.json();
      toast({
        title: tc("تم التصفير", "Reset Done"),
        description: data.message
      });
      fetchStats();
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل التصفير", "Reset failed"),
        variant: "destructive"
      });
    }
  };

  const handleResetDatabase = async () => {
    if (resetConfirm !== resetKeyword) {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("يرجى كتابة العبارة الصحيحة للتأكيد", "Please type the correct confirmation phrase"),
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/owner/reset-database', { 
        confirmPhrase: resetConfirm 
      });
      const data = await response.json();

      toast({
        title: tc("تم إعادة التعيين", "Reset Done"),
        description: data.message
      });

      fetchStats();
      setResetDialogOpen(false);
      setResetConfirm('');
    } catch (error: any) {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل إعادة التعيين", "Reset failed"),
        variant: "destructive"
      });
    }
  };

  if (!employee) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={tc('rtl','ltr')} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <ManagerSidebar
        manager={employee as any}
        onLogout={() => { localStorage.removeItem("currentEmployee"); setLocation("/employee/gateway"); }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        role={employee?.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <header className="flex-shrink-0 bg-background border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-foreground font-bold text-sm">{tc("مرحباً،", "Hello,")} <span className="text-[#2D9B6E]">{employee?.fullName}</span></div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                employee?.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
                {employee?.role === 'admin' ? tc('مدير عام', 'Admin') : tc('مالك', 'Owner')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{tc("إدارة قاعدة البيانات والصلاحيات", "Database & permissions management")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setLocation("/employee/menu-management")} data-testid="button-owner-manage-drinks">
            <Coffee className="w-4 h-4 ml-2" />{tc("المشروبات", "Drinks")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/employee/menu-management?type=food")} data-testid="button-owner-manage-food">
            <Utensils className="w-4 h-4 ml-2" />{tc("المأكولات", "Food")}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStats} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 ml-2" />{tc("تحديث", "Refresh")}
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
      <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">

        {/* Day-period selector */}
        <Card className="bg-card border border-border mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {tc("اختر اليوم", "Select day")}
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || formatLocalDateISO(new Date()))}
                  max={formatLocalDateISO(new Date())}
                  className="h-9 w-44"
                  data-testid="input-stats-date"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {tc("اليوم يبدأ من الساعة", "Day starts at hour")}
                </label>
                <select
                  value={dayStartHour}
                  onChange={(e) => setDayStartHour(parseInt(e.target.value, 10) || 0)}
                  className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
                  data-testid="select-day-start-hour"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(formatLocalDateISO(new Date()))}
                disabled={isToday}
                data-testid="button-stats-today"
              >
                {tc("اليوم", "Today")}
              </Button>
              {stats?.summary.dayStart && (
                <div className="text-xs text-muted-foreground mr-auto">
                  {tc("الفترة:", "Window:")}{" "}
                  <span className="font-mono" dir="ltr">
                    {new Date(stats.summary.dayStart).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', hour12: false })}
                    {" → "}
                    {new Date(stats.summary.dayEnd!).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', hour12: false })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-4">{tc("جاري التحميل...", "Loading...")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6">
              {[
                { label: isToday ? tc("طلبات اليوم", "Today's Orders") : tc("طلبات اليوم المحدد", "Orders (selected day)"), value: stats?.summary.dayOrders ?? stats?.summary.todayOrders ?? 0, icon: BarChart3, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
                { label: isToday ? tc("إيرادات اليوم", "Today's Revenue") : tc("إيرادات اليوم المحدد", "Revenue (selected day)"), value: <>{(stats?.summary.dayRevenue || 0).toLocaleString()} <SarIcon /></>, icon: CreditCard, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                { label: tc("إجمالي الإيرادات", "Total Revenue"), value: <>{(stats?.summary.totalRevenue || 0).toLocaleString()} <SarIcon /></>, icon: CreditCard, iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
                { label: tc("الطلبات", "Orders"), value: stats?.collections.orders?.count || 0, icon: ShoppingCart, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
              ].map((k, i) => (
                <Card key={i} className="bg-card border border-border hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${k.iconBg}`}>
                      <k.icon className={`w-5 h-5 ${k.iconColor}`} />
                    </div>
                    <p className="text-muted-foreground text-xs mb-1">{k.label}</p>
                    <p className="text-2xl font-bold text-foreground leading-tight">{k.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-card border border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  {tc("مجموعات قاعدة البيانات", "Database Collections")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {tc("اضغط على أي مجموعة لعرض بياناتها", "Click any collection to view its data")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {stats?.collections && Object.entries(stats.collections).map(([key, value]) => {
                    const Icon = collectionIcons[key] || Database;
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedCollection(key);
                          setCurrentPage(1);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedCollection === key
                            ? 'border-primary bg-primary/10'
                            : 'border-primary/20 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                        data-testid={`collection-${key}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-5 h-5 text-accent" />
                          <span className="text-white font-medium">{value.nameAr}</span>
                        </div>
                        <p className="text-2xl font-bold text-accent">{value.count}</p>
                        <p className="text-gray-500 text-xs">{key}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedCollection && (
              <Card className="bg-card border border-border mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">
                      {stats?.collections[selectedCollection]?.nameAr || selectedCollection}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {collectionData?.pagination.total || 0} {tc("سجل", "records")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {['orders', 'customers', 'discountCodes', 'loyaltyCards', 'attendance'].includes(selectedCollection) && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid="button-delete-collection">
                            <Trash2 className="w-4 h-4 ml-2" />
                            {tc("حذف الكل", "Delete All")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#2d1f1a] border-primary/20">
                          <DialogHeader>
                            <DialogTitle className="text-red-500">{tc("تأكيد الحذف", "Confirm Delete")}</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              {tc(`سيتم حذف جميع سجلات ${stats?.collections[selectedCollection]?.nameAr}. اكتب "${deleteKeyword}" للتأكيد.`,
                                  `All records of ${selectedCollection} will be deleted. Type "${deleteKeyword}" to confirm.`)}
                            </DialogDescription>
                          </DialogHeader>
                          <Input
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={tc(`اكتب: ${deleteKeyword}`, `Type: ${deleteKeyword}`)}
                            className="bg-[#1a1410] border-red-500/50 text-white"
                            data-testid="input-delete-confirm"
                          />
                          <DialogFooter>
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteCollection(selectedCollection)}
                              disabled={isDeleting || deleteConfirm !== deleteKeyword}
                              data-testid="button-confirm-delete"
                            >
                              {isDeleting ? tc('جاري الحذف...', 'Deleting...') : tc('تأكيد الحذف', 'Confirm Delete')}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCollection(null);
                        setCollectionData(null);
                      }}
                      className="text-gray-400"
                      data-testid="button-close-collection"
                    >
                      {tc("إغلاق", "Close")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {collectionData && collectionData.data.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-primary/20">
                              {Object.keys(collectionData.data[0]).slice(0, 6).map((key) => (
                                <th key={key} className="text-right py-2 px-3 text-gray-400 font-medium">
                                  {key}
                                </th>
                              ))}
                              <th className="text-right py-2 px-3 text-gray-400 font-medium">{tc("إجراءات", "Actions")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {collectionData.data.map((item, index) => (
                              <tr key={item.id || index} className="border-b border-primary/10">
                                {Object.entries(item).slice(0, 6).map(([key, value]) => (
                                  <td key={key} className="py-2 px-3 text-white">
                                    {typeof value === 'object' 
                                      ? JSON.stringify(value).slice(0, 50) + '...'
                                      : String(value).slice(0, 30)}
                                  </td>
                                ))}
                                <td className="py-2 px-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRecord(selectedCollection, item.id)}
                                    className="text-red-500 hover:text-red-400 p-1 h-auto"
                                    data-testid={`button-delete-record-${item.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {collectionData.pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="border-primary/50 text-accent"
                            data-testid="button-prev-page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          <span className="text-gray-400">
                            {tc(`صفحة ${currentPage} من ${collectionData.pagination.pages}`, `Page ${currentPage} of ${collectionData.pagination.pages}`)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(collectionData.pagination.pages, p + 1))}
                            disabled={currentPage === collectionData.pagination.pages}
                            className="border-primary/50 text-accent"
                            data-testid="button-next-page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-400">{tc("لا توجد بيانات", "No data")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(employee.role === 'owner' || employee.role === 'admin') && (
              <Card className="bg-rose-50/40 border border-rose-200">
                <CardHeader>
                  <CardTitle className="text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {tc("منطقة الخطر", "Danger Zone")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {tc("عمليات لا يمكن التراجع عنها", "Operations that cannot be undone")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Reset Orders Only */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-700 text-sm font-medium mb-1">{tc("تصفير الطلبات والمكاسب", "Reset Orders & Revenue")}</p>
                    <p className="text-muted-foreground text-xs mb-3">{tc("يحذف الطلبات والمحاسبة فقط — المنتجات، الموظفون، والصور تبقى", "Deletes orders & accounting only — products, employees, images remain")}</p>
                    <Button
                      variant="outline"
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={handleResetOrdersOnly}
                      data-testid="button-reset-orders-only"
                    >
                      <ShoppingCart className="w-4 h-4 ml-2" />
                      {tc("تصفير الطلبات فقط", "Reset Orders Only")}
                    </Button>
                  </div>

                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="w-full" data-testid="button-reset-database">
                        <Trash2 className="w-4 h-4 ml-2" />
                        {tc("إعادة تعيين قاعدة البيانات الكاملة", "Full Database Reset")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#2d1f1a] border-red-500/20">
                      <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          {tc("تحذير خطير", "Critical Warning")}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                          {tc("سيتم حذف جميع بيانات العمليات (الطلبات، العملاء، أكواد الخصم، بطاقات الولاء، سجلات الحضور).",
                              "All operational data will be deleted (orders, customers, discount codes, loyalty cards, attendance records).")}
                          <br />
                          <br />
                          <strong className="text-red-400">{tc("هذه العملية لا يمكن التراجع عنها!", "This action cannot be undone!")}</strong>
                          <br />
                          <br />
                          {tc(`اكتب "${resetKeyword}" للتأكيد.`, `Type "${resetKeyword}" to confirm.`)}
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        value={resetConfirm}
                        onChange={(e) => setResetConfirm(e.target.value)}
                        placeholder={tc(`اكتب: ${resetKeyword}`, `Type: ${resetKeyword}`)}
                        className="bg-[#1a1410] border-red-500/50 text-white"
                        data-testid="input-reset-confirm"
                      />
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setResetDialogOpen(false)}
                          className="border-gray-500/50 text-gray-400"
                        >
                          {tc("إلغاء", "Cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleResetDatabase}
                          disabled={resetConfirm !== resetKeyword}
                          data-testid="button-confirm-reset"
                        >
                          {tc("تأكيد إعادة التعيين", "Confirm Reset")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}
          </>
        )}
        </div>
        </main>
        <MobileBottomNav manager={employee as any} />
      </div>
    </div>
  );
}
