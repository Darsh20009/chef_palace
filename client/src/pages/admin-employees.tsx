import { useState } from 'react';
import { useTranslate } from "@/lib/useTranslate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Plus, Search, Edit2, Trash2, ChevronDown, X, Download, Trash, Clock, Shield, QrCode } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  fullName: string;
  username: string;
  phone: string;
  jobTitle: string;
  role: string;
  isActivated: number;
  branchId?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  workDays?: string[];
  allowedPages?: string[];
  permissions?: string[];
}

const WORK_DAYS = [
  { id: 'الأحد', name: 'الأحد' },
  { id: 'الاثنين', name: 'الاثنين' },
  { id: 'الثلاثاء', name: 'الثلاثاء' },
  { id: 'الأربعاء', name: 'الأربعاء' },
  { id: 'الخميس', name: 'الخميس' },
  { id: 'الجمعة', name: 'الجمعة' },
  { id: 'السبت', name: 'السبت' },
];

export default function AdminEmployees() {
  const tc = useTranslate();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    phone: '',
    jobTitle: '',
    role: 'cashier',
    shiftStartTime: '',
    shiftEndTime: '',
    workDays: [] as string[],
    allowedPages: [] as string[],
    permissions: [] as string[],
  });

  const AVAILABLE_PAGES = [
    { id: 'dashboard', name: 'لوحة التحكم' },
    { id: 'cashier', name: 'الكاشير' },
    { id: 'pos', name: 'نقاط البيع' },
    { id: 'shifts', name: 'الورديات' },
    { id: 'orders', name: 'الطلبات' },
    { id: 'kitchen', name: 'المطبخ' },
    { id: 'tables', name: 'الطاولات' },
    { id: 'menu_management', name: 'إدارة القائمة' },
    { id: 'inventory', name: 'المخزون' },
    { id: 'reports', name: 'التقارير' },
    { id: 'accounting', name: 'المحاسبة' },
    { id: 'employees', name: 'إدارة الموظفين' },
    { id: 'settings', name: 'الإعدادات' },
    { id: 'delivery', name: 'التوصيل' },
  ];

  const PERMISSION_GROUPS = [
    { category: 'الطلبات', items: [
      { id: 'order.create', name: 'إنشاء طلب' },
      { id: 'order.view', name: 'عرض الطلبات' },
      { id: 'order.void', name: 'إلغاء طلب' },
      { id: 'order.refund', name: 'استرجاع طلب' },
      { id: 'order.apply_discount', name: 'تطبيق خصم' },
      { id: 'order.modify', name: 'تعديل طلب' },
    ]},
    { category: 'المطبخ', items: [
      { id: 'kitchen.view_queue', name: 'عرض طابور المطبخ' },
      { id: 'kitchen.update_status', name: 'تحديث حالة الطلب' },
    ]},
    { category: 'المخزون', items: [
      { id: 'inventory.view', name: 'عرض المخزون' },
      { id: 'inventory.stock_in', name: 'إدخال مخزون' },
      { id: 'inventory.stock_out', name: 'إخراج مخزون' },
      { id: 'inventory.waste', name: 'تسجيل هدر' },
      { id: 'inventory.adjustment', name: 'تعديل مخزون' },
    ]},
    { category: 'القائمة', items: [
      { id: 'menu.view', name: 'عرض القائمة' },
      { id: 'menu.create', name: 'إضافة صنف' },
      { id: 'menu.edit', name: 'تعديل صنف' },
      { id: 'menu.delete', name: 'حذف صنف' },
    ]},
    { category: 'التقارير', items: [
      { id: 'reports.daily', name: 'تقرير يومي' },
      { id: 'reports.branch', name: 'تقرير الفرع' },
      { id: 'reports.all_branches', name: 'تقارير كل الفروع' },
      { id: 'reports.export', name: 'تصدير التقارير' },
    ]},
    { category: 'الورديات', items: [
      { id: 'shift.open', name: 'فتح وردية' },
      { id: 'shift.close', name: 'إغلاق وردية' },
      { id: 'shift.view_history', name: 'سجل الورديات' },
      { id: 'shift.cash_movement', name: 'حركة نقدية' },
    ]},
    { category: 'نقاط البيع', items: [
      { id: 'pos.open_drawer', name: 'فتح درج النقود' },
      { id: 'pos.apply_coupon', name: 'تطبيق كوبون' },
    ]},
    { category: 'أخرى', items: [
      { id: 'delivery.manage', name: 'إدارة التوصيل' },
      { id: 'tables.manage', name: 'إدارة الطاولات' },
      { id: 'accounting.view', name: 'عرض المحاسبة' },
      { id: 'accounting.export', name: 'تصدير المحاسبة' },
      { id: 'employees.view', name: 'عرض الموظفين' },
      { id: 'employees.create', name: 'إضافة موظف' },
      { id: 'employees.edit', name: 'تعديل موظف' },
      { id: 'employees.delete', name: 'حذف موظف' },
      { id: 'settings.branch', name: 'إعدادات الفرع' },
      { id: 'settings.cafe', name: 'إعدادات المقهى' },
    ]},
  ];

  const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items);

  const { data: employees = [], refetch } = useQuery({
    queryKey: ['/api/employees'],
  });

  const resetForm = () => ({
    fullName: '',
    username: '',
    phone: '',
    jobTitle: '',
    role: 'cashier',
    shiftStartTime: '',
    shiftEndTime: '',
    workDays: [] as string[],
    allowedPages: [] as string[],
    permissions: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/employees', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowAddForm(false);
      setFormData(resetForm());
      toast({ title: tc('تم إضافة الموظف بنجاح', 'Employee added successfully') });
    },
    onError: (err: any) => {
      toast({ title: tc('خطأ', 'Error'), description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const res = await apiRequest('PATCH', `/api/employees/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setEditingId(null);
      setFormData(resetForm());
      toast({ title: tc('تم تحديث الموظف بنجاح', 'Employee updated successfully') });
    },
    onError: (err: any) => {
      toast({ title: tc('خطأ', 'Error'), description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/employees/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({ title: tc('تم حذف الموظف بنجاح', 'Employee deleted successfully') });
    },
    onError: (err: any) => {
      toast({ title: tc('خطأ', 'Error'), description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const payload = {
      ...formData,
      shiftTime: formData.shiftStartTime && formData.shiftEndTime
        ? `${formData.shiftStartTime}-${formData.shiftEndTime}`
        : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredEmployees = (employees as Employee[]).filter((emp: Employee) => {
    const matchSearch = emp.fullName?.includes(search) || emp.phone?.includes(search) || emp.username?.includes(search);
    const matchRole = roleFilter === 'all' || emp.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? emp.isActivated === 1 : emp.isActivated === 0);
    return matchSearch && matchRole && matchStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(filteredEmployees.map((emp: Employee) => emp.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (id: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`هل تريد حذف ${selectedEmployees.size} موظف؟`)) return;
    for (const id of selectedEmployees) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedEmployees(new Set());
  };

  const handleExportCSV = () => {
    const headers = ['الاسم', 'رقم الهاتف', 'المسمى الوظيفي', 'الدور', 'الحالة'];
    const rows = filteredEmployees.map((emp: Employee) => [
      emp.fullName,
      emp.phone,
      emp.jobTitle,
      emp.role,
      emp.isActivated === 1 ? 'نشط' : 'معطل',
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach((row: string[]) => {
      csv += row.map((cell: string) => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      cleaner: tc('عامل نظافة','Cleaner'),
      driver: tc('سائق توصيل','Driver'),
      accountant: tc('محاسب','Accountant'),
      cashier: tc('كاشير','Cashier'),
      barista: tc('باريستا','Barista'),
      supervisor: tc('مشرف','Supervisor'),
      manager: tc('مدير فرع','Branch Manager'),
      owner: tc('مالك','Owner'),
      admin: tc('مدير النظام','Admin'),
    };
    return labels[role] || role;
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tc("إدارة الموظفين", "Employee Management")}</h1>
          <p className="text-muted-foreground mt-1">{tc("إدارة بيانات الموظفين والأدوار والصلاحيات", "Manage employee data, roles, and permissions")}</p>
        </div>
        <Button 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingId(null);
            setFormData(resetForm());
          }}
          className="bg-accent hover:bg-accent"
          data-testid="button-add-employee"
        >
          <Plus className="w-4 h-4 ml-2" />
          {tc("إضافة موظف", "Add Employee")}
        </Button>
      </div>

      {(showAddForm || editingId) && (
        <Card className="border-primary/30 bg-background dark:bg-accent/10">
          <CardHeader className="pb-4">
            <CardTitle>{editingId ? tc('تعديل الموظف', 'Edit Employee') : tc('إضافة موظف جديد', 'Add New Employee')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{tc("الاسم الكامل", "Full Name")}</label>
                  <Input
                    placeholder={tc("أحمد محمد", "Ahmed Mohammed")}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    data-testid="input-fullname"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tc("اسم المستخدم", "Username")}</label>
                  <Input
                    placeholder="ahmed123"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    data-testid="input-username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tc("رقم الهاتف", "Phone Number")}</label>
                  <Input
                    placeholder="0501234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tc("المسمى الوظيفي", "Job Title")}</label>
                  <Input
                    placeholder={tc("كاشير", "Cashier")}
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    data-testid="input-jobtitle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{tc("الدور", "Role")}</label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleaner">{tc("عامل نظافة", "Cleaner")}</SelectItem>
                      <SelectItem value="driver">{tc("سائق توصيل", "Driver")}</SelectItem>
                      <SelectItem value="accountant">{tc("محاسب", "Accountant")}</SelectItem>
                      <SelectItem value="cashier">{tc("كاشير", "Cashier")}</SelectItem>
                      <SelectItem value="barista">{tc("باريستا", "Barista")}</SelectItem>
                      <SelectItem value="supervisor">{tc("مشرف", "Supervisor")}</SelectItem>
                      <SelectItem value="manager">{tc("مدير فرع", "Branch Manager")}</SelectItem>
                      <SelectItem value="owner">{tc("مالك", "Owner")}</SelectItem>
                      <SelectItem value="admin">{tc("مدير النظام", "Admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <label className="block text-sm font-bold">{tc("مواقيت الدوام", "Work Schedule")}</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">{tc("بداية الدوام", "Shift Start")}</label>
                    <Input
                      type="time"
                      value={formData.shiftStartTime}
                      onChange={(e) => setFormData({ ...formData, shiftStartTime: e.target.value })}
                      data-testid="input-shiftstart"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">{tc("نهاية الدوام", "Shift End")}</label>
                    <Input
                      type="time"
                      value={formData.shiftEndTime}
                      onChange={(e) => setFormData({ ...formData, shiftEndTime: e.target.value })}
                      data-testid="input-shiftend"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">{tc("أيام العمل", "Work Days")}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {WORK_DAYS.map(day => (
                      <label key={day.id} className="flex items-center gap-2 p-2 hover:bg-background rounded cursor-pointer transition-colors border border-transparent hover:border-border">
                        <input
                          type="checkbox"
                          checked={formData.workDays.includes(day.id)}
                          onChange={(e) => {
                            const days = e.target.checked
                              ? [...formData.workDays, day.id]
                              : formData.workDays.filter(d => d !== day.id);
                            setFormData({ ...formData, workDays: days });
                          }}
                          className="w-4 h-4 rounded"
                          data-testid={`checkbox-workday-${day.id}`}
                        />
                        <span className="text-sm">{day.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    {tc("الصفحات المسموحة", "Allowed Pages")}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {formData.allowedPages.length === 0 ? tc('الافتراضي حسب الدور', 'Default by role') : `${formData.allowedPages.length} ${tc('صفحة', 'pages')}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{tc("اتركها فارغة لاستخدام الافتراضي حسب الدور، أو خصّص الصفحات يدوياً", "Leave empty to use defaults by role, or customize pages manually")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {AVAILABLE_PAGES.map(page => (
                    <label key={page.id} className="flex items-center gap-2 p-2 hover:bg-background rounded cursor-pointer transition-colors border border-transparent hover:border-border">
                      <input
                        type="checkbox"
                        checked={formData.allowedPages?.includes(page.id)}
                        onChange={(e) => {
                          const pages = formData.allowedPages || [];
                          const newPages = e.target.checked 
                            ? [...pages, page.id] 
                            : pages.filter(p => p !== page.id);
                          setFormData({
                            ...formData,
                            allowedPages: newPages
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-[#2D9B6E] focus:ring-[#2D9B6E]"
                      />
                      <span className="text-sm">{page.name}</span>
                    </label>
                  ))}
                </div>
                {formData.allowedPages.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground"
                    onClick={() => setFormData({ ...formData, allowedPages: [] })}
                  >
                    {tc("إعادة للافتراضي", "Reset to Default")}
                  </Button>
                )}
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    {tc("صلاحيات تفصيلية", "Granular Permissions")}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {formData.permissions.length === 0 ? tc('الافتراضي حسب الدور', 'Default by role') : `${formData.permissions.length} ${tc('صلاحية إضافية', 'extra permissions')}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{tc("أضف صلاحيات إضافية فوق الافتراضي حسب الدور", "Add extra permissions on top of the role defaults")}</p>
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.category}>
                      <p className="text-xs font-bold text-[#2D9B6E] mb-2">{group.category}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {group.items.map(perm => (
                          <label key={perm.id} className="flex items-center gap-2 p-1.5 hover:bg-background rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.permissions?.includes(perm.id)}
                              onChange={(e) => {
                                const perms = formData.permissions || [];
                                const newPerms = e.target.checked 
                                  ? [...perms, perm.id] 
                                  : perms.filter(p => p !== perm.id);
                                setFormData({
                                  ...formData,
                                  permissions: newPerms
                                });
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-[#2D9B6E] focus:ring-[#2D9B6E]"
                            />
                            <span className="text-xs">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {formData.permissions.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground"
                    onClick={() => setFormData({ ...formData, permissions: [] })}
                  >
                    {tc("مسح الصلاحيات الإضافية", "Clear Extra Permissions")}
                  </Button>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-accent hover:bg-accent" data-testid="button-save-employee">
                  {editingId ? tc('تحديث', 'Update') : tc('إضافة', 'Add')}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setEditingId(null); }} data-testid="button-cancel">
                  {tc("إلغاء", "Cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {selectedEmployees.size > 0 && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm font-medium">{selectedEmployees.size} {tc("موظف مختار", "employees selected")}</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} data-testid="button-bulk-delete">
            <Trash className="w-4 h-4 ml-2" />
            {tc("حذف المختارين", "Delete Selected")}
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tc("ابحث برقم الهاتف أو الاسم...", "Search by phone or name...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-4"
            data-testid="input-search"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40" data-testid="select-role-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("جميع الأدوار", "All Roles")}</SelectItem>
            <SelectItem value="cleaner">{tc("عامل نظافة", "Cleaner")}</SelectItem>
            <SelectItem value="driver">{tc("سائق", "Driver")}</SelectItem>
            <SelectItem value="accountant">{tc("محاسب", "Accountant")}</SelectItem>
            <SelectItem value="cashier">{tc("كاشير", "Cashier")}</SelectItem>
            <SelectItem value="barista">{tc("باريستا", "Barista")}</SelectItem>
            <SelectItem value="manager">{tc("مدير", "Manager")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("جميع الحالات", "All Statuses")}</SelectItem>
            <SelectItem value="active">{tc("نشط", "Active")}</SelectItem>
            <SelectItem value="inactive">{tc("معطل", "Inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          data-testid="button-export-csv"
        >
          <Download className="w-4 h-4 ml-2" />
          {tc("تصدير", "Export")}
        </Button>
      </div>

      <Card className="border-0 bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {tc("الموظفون", "Employees")} ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-right p-4 font-semibold w-8">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="text-right p-4 font-semibold">{tc("الاسم", "Name")}</th>
                    <th className="text-right p-4 font-semibold">{tc("رقم الهاتف", "Phone")}</th>
                    <th className="text-right p-4 font-semibold">{tc("المسمى الوظيفي", "Job Title")}</th>
                    <th className="text-right p-4 font-semibold">{tc("الدور", "Role")}</th>
                    <th className="text-right p-4 font-semibold">{tc("الدوام", "Schedule")}</th>
                    <th className="text-right p-4 font-semibold">{tc("الحالة", "Status")}</th>
                    <th className="text-right p-4 font-semibold">{tc("الإجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp: Employee) => (
                    <tr key={emp.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(emp.id)}
                          onChange={() => handleSelectEmployee(emp.id)}
                          className="w-4 h-4"
                          data-testid={`checkbox-employee-${emp.id}`}
                        />
                      </td>
                      <td className="p-4 font-medium">{emp.fullName}</td>
                      <td className="p-4 text-muted-foreground">{emp.phone}</td>
                      <td className="p-4 text-muted-foreground">{emp.jobTitle}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {getRoleLabel(emp.role)}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {(emp as any).shiftStartTime && (emp as any).shiftEndTime ? (
                          <span>{(emp as any).shiftStartTime} - {(emp as any).shiftEndTime}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          emp.isActivated === 1
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {emp.isActivated === 1 ? tc('نشط','Active') : tc('معطل','Inactive')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(emp.id);
                              setFormData({
                                fullName: emp.fullName,
                                username: emp.username,
                                phone: emp.phone,
                                jobTitle: emp.jobTitle,
                                role: emp.role,
                                shiftStartTime: (emp as any).shiftStartTime || '',
                                shiftEndTime: (emp as any).shiftEndTime || '',
                                workDays: (emp as any).workDays || [],
                                allowedPages: (emp as any).allowedPages || [],
                                permissions: (emp as any).permissions || [],
                              });
                              setShowAddForm(false);
                            }}
                            data-testid={`button-edit-${emp.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`${(emp as any).faceEnrolledAt ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"}`}
                            onClick={() => navigate(`/admin/employees/${emp.id}/face-enrollment`)}
                            title={(emp as any).faceEnrolledAt ? "بصمة الوجه مسجلة — انقر لتحديثها" : "تسجيل بصمة الوجه"}
                            data-testid={`button-face-${emp.id}`}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => deleteMutation.mutate(emp.id)}
                            data-testid={`button-delete-${emp.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">{tc("لا توجد موظفون", "No employees found")}</h3>
              <p className="text-muted-foreground">{tc("ابدأ بإضافة موظف جديد", "Start by adding a new employee")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
