import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ToggleLeft, ToggleRight, Ticket, Percent, Tag, Eye, EyeOff } from "lucide-react";

interface DiscountCode {
  id: string;
  _id?: string;
  code: string;
  discountPercentage: number;
  reason: string;
  employeeId: string;
  isActive: number;
  usageCount?: number;
  visibleToCustomers?: boolean;
  createdAt?: string;
}

interface CouponManagementProps {
  employeeId: string;
}

export function CouponManagement({ employeeId }: CouponManagementProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discountPercentage: 10,
    reason: "",
    visibleToCustomers: false,
  });

  const { data: discountCodes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ['/api/discount-codes/employee', employeeId],
    enabled: !!employeeId,
  });

  const createCouponMutation = useMutation({
    mutationFn: async (data: { code: string; discountPercentage: number; reason: string; employeeId: string; visibleToCustomers: boolean }) => {
      return await apiRequest('POST', '/api/discount-codes', data);
    },
    onSuccess: () => {
      toast({
        title: "تم إنشاء الكوبون",
        description: "تم إنشاء كود الخصم بنجاح",
        className: "bg-green-600 text-white",
      });
      setIsAddDialogOpen(false);
      setNewCoupon({ code: "", discountPercentage: 10, reason: "", visibleToCustomers: false });
      queryClient.invalidateQueries({ queryKey: ['/api/discount-codes/employee', employeeId] });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء كود الخصم",
        variant: "destructive",
      });
    },
  });

  const toggleCouponMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      return await apiRequest('PATCH', `/api/discount-codes/${id}`, { [field]: value, employeeId });
    },
    onSuccess: () => {
      toast({ title: "تم التحديث", description: "تم تحديث حالة الكوبون" });
      queryClient.invalidateQueries({ queryKey: ['/api/discount-codes/employee', employeeId] });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message || "فشل في تحديث الكوبون", variant: "destructive" });
    },
  });

  const handleCreateCoupon = () => {
    if (!newCoupon.code.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال كود الخصم", variant: "destructive" });
      return;
    }
    if (newCoupon.discountPercentage <= 0 || newCoupon.discountPercentage > 100) {
      toast({ title: "خطأ", description: "نسبة الخصم يجب أن تكون بين 1 و 100", variant: "destructive" });
      return;
    }
    if (!newCoupon.reason.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال سبب الخصم", variant: "destructive" });
      return;
    }
    createCouponMutation.mutate({
      code: newCoupon.code.toUpperCase(),
      discountPercentage: newCoupon.discountPercentage,
      reason: newCoupon.reason,
      visibleToCustomers: newCoupon.visibleToCustomers,
      employeeId,
    });
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCoupon({ ...newCoupon, code });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <span className="font-medium">أكواد الخصم الخاصة بك</span>
          <Badge variant="secondary">{discountCodes.length}</Badge>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-coupon">
              <Plus className="w-4 h-4 ml-2" />
              إضافة كوبون
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء كود خصم جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">كود الخصم</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="مثال: WELCOME20"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                    className="flex-1"
                    data-testid="input-coupon-code"
                  />
                  <Button variant="outline" onClick={generateRandomCode} type="button">
                    توليد تلقائي
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentage">نسبة الخصم (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="percentage"
                    type="number"
                    min="1"
                    max="100"
                    value={newCoupon.discountPercentage}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountPercentage: parseInt(e.target.value) || 0 })}
                    data-testid="input-coupon-percentage"
                  />
                  <Percent className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">سبب الخصم</Label>
                <Input
                  id="reason"
                  placeholder="مثال: عرض الافتتاح، عميل مميز"
                  value={newCoupon.reason}
                  onChange={(e) => setNewCoupon({ ...newCoupon, reason: e.target.value })}
                  data-testid="input-coupon-reason"
                />
              </div>
              <div
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${newCoupon.visibleToCustomers ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30 bg-muted/30'}`}
                onClick={() => setNewCoupon({ ...newCoupon, visibleToCustomers: !newCoupon.visibleToCustomers })}
                data-testid="toggle-visible-to-customers"
              >
                <div className="flex items-center gap-3">
                  {newCoupon.visibleToCustomers ? (
                    <Eye className="w-5 h-5 text-primary" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">إظهار للعملاء</p>
                    <p className="text-xs text-muted-foreground">
                      {newCoupon.visibleToCustomers
                        ? 'سيظهر هذا الكوبون في صفحة الدفع للعملاء'
                        : 'لن يظهر هذا الكوبون للعملاء (يُستخدم يدوياً فقط)'}
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors ${newCoupon.visibleToCustomers ? 'bg-primary' : 'bg-muted-foreground/30'} relative`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${newCoupon.visibleToCustomers ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleCreateCoupon}
                disabled={createCouponMutation.isPending}
                data-testid="button-confirm-create-coupon"
              >
                {createCouponMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {discountCodes.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-8 text-center">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لم تقم بإنشاء أي أكواد خصم بعد</p>
            <p className="text-sm text-muted-foreground mt-1">اضغط على "إضافة كوبون" لإنشاء كود خصم جديد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discountCodes.map((code) => {
            const codeId = code.id || code._id || '';
            return (
              <Card key={codeId} className={`border ${code.isActive ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/10' : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/10'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="font-mono font-bold text-lg">{code.code}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {code.visibleToCustomers && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5 py-0.5 gap-0.5">
                          <Eye className="w-3 h-3" />
                          عام
                        </Badge>
                      )}
                      <Badge className={code.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {code.isActive ? 'نشط' : 'معطل'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <span>خصم {code.discountPercentage}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{code.reason}</span>
                    </div>
                    {code.usageCount !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        تم الاستخدام: {code.usageCount} مرة
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleCouponMutation.mutate({ id: codeId, field: 'isActive', value: code.isActive ? 0 : 1 })}
                      disabled={toggleCouponMutation.isPending}
                      data-testid={`button-toggle-coupon-${code.code}`}
                    >
                      {code.isActive ? <><ToggleRight className="w-4 h-4 ml-2" />تعطيل</> : <><ToggleLeft className="w-4 h-4 ml-2" />تفعيل</>}
                    </Button>
                    <Button
                      variant={code.visibleToCustomers ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleCouponMutation.mutate({ id: codeId, field: 'visibleToCustomers', value: !code.visibleToCustomers })}
                      disabled={toggleCouponMutation.isPending}
                      data-testid={`button-visibility-coupon-${code.code}`}
                    >
                      {code.visibleToCustomers ? <><EyeOff className="w-4 h-4 ml-2" />إخفاء</> : <><Eye className="w-4 h-4 ml-2" />إظهار</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CouponManagement;
