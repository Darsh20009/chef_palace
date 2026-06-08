import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Coffee, LogOut, ShoppingCart, ClipboardList, User, ChefHat,
  Warehouse, Eye, Calendar, FileText, BarChart3, Lock, Utensils,
  ChevronLeft, Car, Copy, Sparkles
} from "lucide-react";
import type { Employee } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useTranslate } from "@/lib/useTranslate";
import qiroxLogo from "@assets/qirox-logo-customer.png";

export default function EmployeeHome() {
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const tc = useTranslate();
  const { toast } = useToast();

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role === "owner" || emp.role === "admin") {
        window.location.href = "/admin/dashboard";
        return;
      }
      if (emp.role === "manager") {
        window.location.href = "/manager/dashboard";
        return;
      }
      setEmployee(emp);
    } else {
      window.location.href = "/employee/gateway";
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    setLocation("/employee/gateway");
  };

  function copyDriveThroughLink() {
    const link = `${window.location.origin}/drive-through`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: tc("✅ تم نسخ رابط Drive-Through", "✅ Drive-Through link copied") });
    });
  }

  if (!employee) return null;

  const isManager = employee.role === "manager" || employee.role === "admin";

  const employeeQuickAccess = [
    { title: tc("المساعد الذكي", "AI Assistant"), icon: Sparkles, path: "/employee/ai", testId: "button-brand-ai", highlight: true },
    { title: tc("نقطة البيع", "Point of Sale"), icon: ShoppingCart, path: "/employee/pos", testId: "button-pos" },
    { title: tc("الطلبات", "Orders"), icon: ClipboardList, path: "/employee/orders", testId: "button-orders" },
    { title: tc("الحضور", "Attendance"), icon: Calendar, path: "/employee/attendance", testId: "button-attendance" },
    { title: tc("طلب إجازة", "Leave Request"), icon: FileText, path: "/employee/leave-request", testId: "button-leave" },
    { title: tc("المطبخ", "Kitchen"), icon: ChefHat, path: "/employee/kitchen", testId: "button-kitchen" },
    { title: tc("ملفي الشخصي", "My Profile"), icon: User, path: "/employee/dashboard", testId: "button-hr" },
    { title: tc("📖 دليل النظام", "📖 System Guide"), icon: FileText, path: "/guide", testId: "button-guide" },
  ];

  const managerAccess = [
    { title: tc("إدارة المشروبات", "Drinks Menu"), icon: Coffee, path: "/employee/menu-management", testId: "button-menu-mgmt" },
    { title: tc("إدارة الطعام", "Food Menu"), icon: Utensils, path: "/employee/menu-management?type=food", testId: "button-food-mgmt" },
    { title: tc("المواد الخام", "Ingredients"), icon: Warehouse, path: "/employee/ingredients", testId: "button-ingredients-mgmt" },
    { title: tc("لوحة التحكم", "Dashboard"), icon: BarChart3, path: "/employee/dashboard", testId: "button-dashboard" },
    { title: tc("إدارة الموظفين", "Employees"), icon: Lock, path: "/manager/employees", testId: "button-employees" },
    { title: tc("الطاولات", "Tables"), icon: Eye, path: "/employee/tables", testId: "button-tables" },
  ];

  const initials = (employee.fullName || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("");

  return (
    <div className="min-h-screen bg-background pb-nav">

      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={qiroxLogo} alt="مكان الشيف" className="w-9 h-9 object-contain rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="text-xs text-muted-foreground leading-none mb-0.5">مكان الشيف البخاري</p>
              <h1 className="text-sm font-bold text-foreground leading-none">{tc("بوابة الموظفين", "Employee Portal")}</h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors py-1.5 px-3 rounded-lg hover:bg-destructive/10"
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            {tc("خروج", "Sign Out")}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

        {/* Employee Card */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-black text-base">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground text-base truncate">{employee.fullName}</h2>
            <p className="text-muted-foreground text-xs mt-0.5">{employee.jobTitle || employee.role}</p>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
            {tc("موظف", "Employee")}
          </Badge>
        </div>

        {/* Quick Access */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {tc("الخدمات", "Services")}
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {employeeQuickAccess.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-right group"
                  data-testid={item.testId}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Manager Access */}
        {isManager && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {tc("إدارة", "Management")}
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {managerAccess.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-right group"
                    data-testid={item.testId}
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Drive-Through Link */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {tc("🚗 Drive-Through", "🚗 Drive-Through")}
          </h2>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  {tc("منيو السيارات", "Car Order Menu")}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                  {tc("شارك هذا الرابط مع عملاء السيارات", "Share this link with drive-through customers")}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-black/30 rounded-xl px-3 py-2 text-xs font-mono text-amber-700 dark:text-amber-400 mb-3 break-all">
              {window.location.origin}/drive-through
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyDriveThroughLink}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
                data-testid="button-copy-drive-through"
              >
                <Copy className="w-4 h-4" />
                {tc("نسخ الرابط", "Copy Link")}
              </button>
              <button
                onClick={() => window.open("/drive-through", "_blank")}
                className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-white/10 hover:bg-amber-50 dark:hover:bg-white/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/40 text-sm font-medium py-2.5 rounded-xl transition-colors"
                data-testid="button-open-drive-through"
              >
                <Car className="w-4 h-4" />
                {tc("فتح المنيو", "Open Menu")}
              </button>
            </div>
          </div>
        </div>

      </div>

      <MobileBottomNav employeeRole={employee?.role} onLogout={handleLogout} />
    </div>
  );
}
