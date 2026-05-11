import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, ShoppingBag, Users, ShoppingCart, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface DemoStats {
  ordersCount: number;
  customersCount: number;
  cartCount: number;
}

interface DemoDataManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DemoDataManager({ open, onOpenChange }: DemoDataManagerProps) {
  const { toast } = useToast();

  const { data: stats, isLoading, refetch } = useQuery<DemoStats>({
    queryKey: ["/api/admin/demo-stats"],
    enabled: open,
  });

  const clearOrdersMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/demo-orders"),
    onSuccess: (data: any) => {
      toast({ title: "✅ تم الحذف", description: data?.message || "تم حذف الطلبات التجريبية بنجاح" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ", description: "فشل حذف الطلبات" }),
  });

  const clearCustomersMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/demo-customers"),
    onSuccess: (data: any) => {
      toast({ title: "✅ تم الحذف", description: data?.message || "تم حذف العملاء التجريبيين بنجاح" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ", description: "فشل حذف العملاء" }),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/admin/demo-orders");
      await apiRequest("DELETE", "/api/admin/demo-customers");
    },
    onSuccess: () => {
      toast({ title: "✅ تم تنظيف النظام", description: "تم حذف جميع البيانات التجريبية بنجاح" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/live"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: () => toast({ variant: "destructive", title: "خطأ", description: "فشل تنظيف البيانات" }),
  });

  const totalItems = (stats?.ordersCount || 0) + (stats?.customersCount || 0) + (stats?.cartCount || 0);
  const hasData = totalItems > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[440px]" dir="rtl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-right">
            <FlaskConical className="w-5 h-5 text-primary" />
            إدارة البيانات التجريبية
          </SheetTitle>
          <SheetDescription className="text-right">
            احذف البيانات التجريبية قبل عرض النظام على العملاء الحقيقيين
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${hasData ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'}`}>
            {hasData ? (
              <>
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">يحتوي النظام على بيانات تجريبية</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">احذفها قبل عرض النظام على العملاء</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">النظام نظيف</p>
                  <p className="text-xs text-green-600 dark:text-green-400">لا توجد بيانات تجريبية</p>
                </div>
              </>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <CardContent className="pt-4 pb-3 px-2">
                <ShoppingBag className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold">{isLoading ? '...' : stats?.ordersCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">طلب</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-3 px-2">
                <Users className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold">{isLoading ? '...' : stats?.customersCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">عميل</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-3 px-2">
                <ShoppingCart className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold">{isLoading ? '...' : stats?.cartCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">سلة</p>
              </CardContent>
            </Card>
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث الإحصائيات
          </Button>

          <Separator />

          {/* Individual actions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">حذف حسب النوع</h4>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">الطلبات والسلات</p>
                  <p className="text-xs text-muted-foreground">{stats?.ordersCount ?? 0} طلب + {stats?.cartCount ?? 0} سلة</p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" disabled={!stats?.ordersCount && !stats?.cartCount} data-testid="button-clear-orders">
                    <Trash2 className="w-3.5 h-3.5 ml-1" />
                    حذف
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف الطلبات التجريبية؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف {stats?.ordersCount} طلب و{stats?.cartCount} عنصر سلة. هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearOrdersMutation.mutate()} className="bg-destructive hover:bg-destructive/90">
                      تأكيد الحذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">العملاء وبطاقات الولاء</p>
                  <p className="text-xs text-muted-foreground">{stats?.customersCount ?? 0} عميل</p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" disabled={!stats?.customersCount} data-testid="button-clear-customers">
                    <Trash2 className="w-3.5 h-3.5 ml-1" />
                    حذف
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف العملاء التجريبيين؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف {stats?.customersCount} عميل وبطاقات الولاء المرتبطة بهم. هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearCustomersMutation.mutate()} className="bg-destructive hover:bg-destructive/90">
                      تأكيد الحذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Separator />

          {/* Clear all */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">حذف الكل دفعة واحدة</h4>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={!hasData || clearAllMutation.isPending} data-testid="button-clear-all-demo">
                  <Trash2 className="w-4 h-4" />
                  {clearAllMutation.isPending ? "جاري التنظيف..." : "تنظيف جميع البيانات التجريبية"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ تنظيف جميع البيانات التجريبية</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف: <strong>{stats?.ordersCount} طلب</strong>، <strong>{stats?.cartCount} سلة</strong>، <strong>{stats?.customersCount} عميل</strong> وجميع بطاقات الولاء. هذا الإجراء لا يمكن التراجع عنه.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearAllMutation.mutate()} className="bg-destructive hover:bg-destructive/90">
                    نعم، احذف كل شيء
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-[11px] text-muted-foreground text-center">
              بيانات المنتجات والموظفين والإعدادات لن تتأثر
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
