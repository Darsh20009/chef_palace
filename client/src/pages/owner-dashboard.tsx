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
  Eye, BarChart3, Shield, ArrowRight, Utensils, Printer
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";
import SarIcon from "@/components/sar-icon";

interface CollectionStats {
  count: number;
  nameAr: string;
}

interface DatabaseStats {
  collections: Record<string, CollectionStats>;
  summary: {
    todayOrders: number;
    totalRevenue: number;
  };
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
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');

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
  }, [employee]);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionData(selectedCollection, currentPage);
    }
  }, [selectedCollection, currentPage]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/owner/database-stats', { credentials: 'include' });
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

  const handleDeleteCollection = async (collection: string) => {
    if (deleteConfirm !== 'حذف') {
      toast({
        title: tc("خطأ", "Error"),
        description: "يرجى كتابة 'حذف' للتأكيد",
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
    if (!confirm("سيتم حذف جميع الطلبات والمحاسبة. المنتجات والموظفون والصور ستبقى. هل أنت متأكد؟")) return;
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
    if (resetConfirm !== 'احذف جميع البيانات') {
      toast({
        title: tc("خطأ", "Error"),
        description: "يرجى كتابة العبارة الصحيحة للتأكيد",
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
    <div className="dark min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-red-500">لوحة تحكم المالك</h1>
              <p className="text-gray-400 text-xs">إدارة قاعدة البيانات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/employee/menu-management")}
              className="border-green-500/50 text-green-300 hover:bg-green-500/10"
              data-testid="button-owner-manage-drinks"
            >
              <Coffee className="w-4 h-4 ml-2" />
              إدارة الأطباق
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/employee/menu-management?type=food")}
              className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
              data-testid="button-owner-manage-food"
            >
              <Utensils className="w-4 h-4 ml-2" />
              إدارة المأكولات
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/manager/printer-setup")}
              className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
              data-testid="button-printer-setup"
            >
              <Printer className="w-4 h-4 ml-2" />
              إعداد الطابعات
            </Button>
            <Button
              variant="outline"
              onClick={fetchStats}
              className="border-primary/50 text-accent"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/manager/dashboard")}
              className="border-primary/50 text-accent"
              data-testid="button-back"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-4">جاري التحميل...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-blue-400 text-2xl font-bold">{stats?.summary.todayOrders || 0}</p>
                      <p className="text-gray-400 text-xs">{tc("طلبات اليوم", "Today's Orders")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-green-400 text-2xl font-bold">
                        {(stats?.summary.totalRevenue || 0).toLocaleString()} <SarIcon />
                      </p>
                      <p className="text-gray-400 text-xs">{tc("إجمالي الإيرادات", "Total Revenue")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-purple-400 text-2xl font-bold">
                        {stats?.collections.customers?.count || 0}
                      </p>
                      <p className="text-gray-400 text-xs">{tc("العملاء", "Customers")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-accent" />
                    <div>
                      <p className="text-accent text-2xl font-bold">
                        {stats?.collections.orders?.count || 0}
                      </p>
                      <p className="text-gray-400 text-xs">{tc("الطلبات", "Orders")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
              <CardHeader>
                <CardTitle className="text-accent flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  مجموعات قاعدة البيانات
                </CardTitle>
                <CardDescription className="text-gray-400">
                  اضغط على أي مجموعة لعرض بياناتها
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
              <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-accent">
                      {stats?.collections[selectedCollection]?.nameAr || selectedCollection}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      {collectionData?.pagination.total || 0} سجل
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {['orders', 'customers', 'discountCodes', 'loyaltyCards', 'attendance'].includes(selectedCollection) && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid="button-delete-collection">
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف الكل
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#2d1f1a] border-primary/20">
                          <DialogHeader>
                            <DialogTitle className="text-red-500">تأكيد الحذف</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              سيتم حذف جميع سجلات {stats?.collections[selectedCollection]?.nameAr}.
                              اكتب "حذف" للتأكيد.
                            </DialogDescription>
                          </DialogHeader>
                          <Input
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder="اكتب: حذف"
                            className="bg-[#1a1410] border-red-500/50 text-white"
                            data-testid="input-delete-confirm"
                          />
                          <DialogFooter>
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteCollection(selectedCollection)}
                              disabled={isDeleting || deleteConfirm !== 'حذف'}
                              data-testid="button-confirm-delete"
                            >
                              {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
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
                      إغلاق
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
                              <th className="text-right py-2 px-3 text-gray-400 font-medium">إجراءات</th>
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
                            صفحة {currentPage} من {collectionData.pagination.pages}
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
                      <p className="text-gray-400">لا توجد بيانات</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(employee.role === 'owner' || employee.role === 'admin') && (
              <Card className="bg-gradient-to-br from-red-900/20 to-red-950/10 border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    منطقة الخطر
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    عمليات لا يمكن التراجع عنها
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Reset Orders Only */}
                  <div className="p-3 bg-amber-900/20 border border-amber-500/20 rounded-lg">
                    <p className="text-amber-400 text-sm font-medium mb-1">تصفير الطلبات والمكاسب</p>
                    <p className="text-gray-500 text-xs mb-3">يحذف الطلبات والمحاسبة فقط — المنتجات، الموظفون، والصور تبقى</p>
                    <Button
                      variant="outline"
                      className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-900/30"
                      onClick={handleResetOrdersOnly}
                      data-testid="button-reset-orders-only"
                    >
                      <ShoppingCart className="w-4 h-4 ml-2" />
                      تصفير الطلبات فقط
                    </Button>
                  </div>

                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="w-full" data-testid="button-reset-database">
                        <Trash2 className="w-4 h-4 ml-2" />
                        إعادة تعيين قاعدة البيانات الكاملة
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#2d1f1a] border-red-500/20">
                      <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          تحذير خطير
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                          سيتم حذف جميع بيانات العمليات (الطلبات، العملاء، أكواد الخصم، بطاقات الولاء، سجلات الحضور).
                          <br />
                          <br />
                          <strong className="text-red-400">هذه العملية لا يمكن التراجع عنها!</strong>
                          <br />
                          <br />
                          اكتب "احذف جميع البيانات" للتأكيد.
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        value={resetConfirm}
                        onChange={(e) => setResetConfirm(e.target.value)}
                        placeholder="اكتب: احذف جميع البيانات"
                        className="bg-[#1a1410] border-red-500/50 text-white"
                        data-testid="input-reset-confirm"
                      />
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setResetDialogOpen(false)}
                          className="border-gray-500/50 text-gray-400"
                        >
                          إلغاء
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleResetDatabase}
                          disabled={resetConfirm !== 'احذف جميع البيانات'}
                          data-testid="button-confirm-reset"
                        >
                          تأكيد إعادة التعيين
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
    </div>
  );
}
