import { ReactNode, useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  Home, 
  ShoppingBag, 
  Users, 
  Coffee, 
  LogOut,
  ChefHat,
  CreditCard,
  TableIcon,
  ArrowRight,
  ClipboardList,
  SplitSquareVertical,
  Utensils,
  Bell,
  X,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface Employee {
  id: string;
  nameAr: string;
  role: string;
  branchId?: string;
}

interface EmployeeLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backPath?: string;
}

export function EmployeeLayout({ 
  children, 
  title,
  showBack = false,
  backPath = "/employee/dashboard"
}: EmployeeLayoutProps) {
  const [location, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      setEmployee(JSON.parse(storedEmployee));
    }
  }, []);

  const { requestPermission, isSubscribed } = useNotifications({
    userType: 'employee',
    userId: employee?.id,
    branchId: employee?.branchId,
    autoSubscribe: true,
  });

  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
  }, []);

  useEffect(() => {
    if (!employee) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem('notif-banner-dismissed')) return;
    const timer = setTimeout(() => setShowNotifBanner(true), 2000);
    return () => clearTimeout(timer);
  }, [employee]);

  const [isSplitView, setIsSplitView] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    localStorage.removeItem("chefsplace-restore-key");
    setLocation("/employee/gateway");
  };

  const navItems = [
    { path: "/employee/dashboard", icon: Home, label: "الرئيسية", roles: ["all"] },
    { path: "/employee/cashier", icon: ShoppingBag, label: "الكاشير", roles: ["all"] },
    { path: "/employee/orders", icon: ClipboardList, label: "الطلبات", roles: ["all"] },
    { path: "/employee/pos", icon: CreditCard, label: "نقطة البيع", roles: ["cashier", "manager", "admin", "owner"] },
    { path: "/employee/kitchen", icon: ChefHat, label: "المطبخ", roles: ["barista", "manager", "admin", "owner"] },
    { path: "/employee/table-orders", icon: TableIcon, label: "الطاولات", roles: ["all"] },
    { path: "/employee/menu-management", icon: Coffee, label: "الأطباق", roles: ["manager", "admin", "owner"] },
    { path: "/employee/menu-management?type=food", icon: Utensils, label: "المأكولات", roles: ["manager", "admin", "owner"] },
    { path: "/employee/loyalty", icon: Users, label: "الولاء", roles: ["all"] },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes("all") || (employee?.role && item.roles.includes(employee.role))
  );

  const roleLabels: Record<string, string> = {
    admin: "مدير النظام",
    owner: "المالك",
    manager: "مدير",
    cashier: "كاشير",
    barista: "محضر طعام",
    driver: "سائق",
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider defaultOpen={false} style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full" dir="rtl">
        <Sidebar side="right" collapsible="icon">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-[#9FB2B3] text-white">
                  {employee?.nameAr?.charAt(0) || "م"}
                </AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-medium text-sm text-[#1F2D2E]">{employee?.nameAr || "موظف"}</p>
                <Badge className="bg-[#B58B5A] hover:bg-[#B58B5A]/90 text-white text-xs border-none">
                  {roleLabels[employee?.role || ""] || employee?.role}
                </Badge>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredNavItems.map((item) => {
                    const fullPath = location + window.location.search;
                    const isActive = item.path.includes('?')
                      ? fullPath === item.path
                      : location === item.path && !window.location.search;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          data-testid={`nav-${item.path.split('/').pop()}`}
                        >
                          <Link href={item.path}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleLogout}
                  className="text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut className="h-5 w-5" />
                  <span>تسجيل الخروج</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSplitView(!isSplitView)}
                className="hidden lg:flex gap-2"
                data-testid="button-toggle-split"
              >
                <SplitSquareVertical className="h-4 w-4" />
                {isSplitView ? "عرض كامل" : "شاشة مقسمة"}
              </Button>
              {showBack ? (
                <Button 
                  asChild 
                  variant="ghost" 
                  size="icon" 
                  data-testid="button-back"
                >
                  <Link href={backPath}>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              )}
              {title && <h1 className="text-lg font-semibold">{title}</h1>}
            </div>
            {employee && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {employee.nameAr}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {employee.nameAr?.charAt(0) || "م"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </header>

          <main className="flex-1 overflow-hidden pb-14 sm:pb-0">
            {isSplitView ? (
              <div className="flex h-full w-full divide-x divide-x-reverse">
                <div className="w-1/2 overflow-auto">
                  {children}
                </div>
                <div className="w-1/2 overflow-auto bg-muted/30">
                  <div className="p-4">
                    <iframe 
                      src="/employee/orders" 
                      className="w-full h-[calc(100vh-8rem)] border-none rounded-lg shadow-sm bg-background"
                      title="Order Management"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
      <MobileBottomNav employeeRole={employee?.role} onLogout={handleLogout} />

      {/* Mobile Notification Permission Banner */}
      {showNotifBanner && (
        <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto" dir="rtl">
          <div className="bg-primary text-primary-foreground rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">تفعيل إشعارات الطلبات</p>
                  <p className="text-xs text-primary-foreground/80">
                    {isIOS
                      ? 'لتلقي الإشعارات على iPhone، أضف التطبيق للشاشة الرئيسية'
                      : 'احصل على تنبيه فوري عند وصول طلب جديد'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNotifBanner(false);
                  localStorage.setItem('notif-banner-dismissed', '1');
                }}
                className="text-primary-foreground/70 hover:text-primary-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isIOS ? (
              <div className="bg-white/10 rounded-xl p-3 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> خطوات التفعيل على iPhone:
                </p>
                <p>١. اضغط على زر المشاركة في Safari <span className="font-mono">⬆</span></p>
                <p>٢. اختر "إضافة إلى الشاشة الرئيسية"</p>
                <p>٣. افتح التطبيق من الشاشة الرئيسية</p>
                <p>٤. وافق على تفعيل الإشعارات</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 h-9 text-sm font-bold"
                  onClick={async () => {
                    setShowNotifBanner(false);
                    await requestPermission();
                    localStorage.setItem('notif-banner-dismissed', '1');
                  }}
                >
                  <Bell className="w-4 h-4 ml-1" />
                  تفعيل الإشعارات
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary-foreground/70 hover:text-primary-foreground h-9"
                  onClick={() => {
                    setShowNotifBanner(false);
                    localStorage.setItem('notif-banner-dismissed', '1');
                  }}
                >
                  لاحقاً
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
