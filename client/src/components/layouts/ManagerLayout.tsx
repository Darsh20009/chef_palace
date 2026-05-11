import { ReactNode, useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  DollarSign, 
  LogOut,
  TableIcon,
  Truck,
  Clock,
  ChevronDown,
  ArrowRight,
  Beaker,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Manager {
  id: string;
  nameAr: string;
  role: string;
  branchId?: string;
}

interface ManagerLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backPath?: string;
}

export function ManagerLayout({ 
  children, 
  title,
  showBack = false,
  backPath = "/manager/dashboard"
}: ManagerLayoutProps) {
  const [location, setLocation] = useLocation();
  const [manager, setManager] = useState<Manager | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(location.includes("/manager/inventory"));

  useEffect(() => {
    const storedManager = localStorage.getItem("currentManager");
    if (storedManager) {
      setManager(JSON.parse(storedManager));
    }
  }, []);

  useEffect(() => {
    if (location.includes("/manager/inventory")) {
      setInventoryOpen(true);
    }
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem("currentManager");
    setLocation("/manager/login");
  };

  const navItems = [
    { path: "/manager/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
    { path: "/admin/settings", icon: Settings, label: "إدارة النظام" },
    { path: "/manager/employees", icon: Users, label: "الموظفين" },
    { path: "/manager/tables", icon: TableIcon, label: "الطاولات" },
    { path: "/manager/drivers", icon: Truck, label: "السائقين" },
    { path: "/manager/attendance", icon: Clock, label: "الحضور" },
    { path: "/manager/accounting", icon: DollarSign, label: "المحاسبة" },
    { path: "/manager/os-inventory", icon: Package, label: "المواد الخام" },
    { path: "/manager/os-recipes", icon: Beaker, label: "هندسة الوصفات" },
  ];

  const inventoryItems = [
    { path: "/manager/inventory", label: "لوحة التحكم", id: "inventory-smart" },
    { path: "/manager/inventory/raw-items", label: "المواد الخام", id: "inventory-raw-items" },
    { path: "/manager/inventory/stock", label: "المخزون", id: "inventory-stock" },
    { path: "/manager/inventory/recipes", label: "الوصفات", id: "inventory-recipes" },
    { path: "/manager/inventory/suppliers", label: "الموردين", id: "inventory-suppliers" },
    { path: "/manager/inventory/purchases", label: "المشتريات", id: "inventory-purchases" },
    { path: "/manager/inventory/alerts", label: "التنبيهات", id: "inventory-alerts" },
  ];

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full" dir="rtl">
        <Sidebar side="right" collapsible="icon">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {manager?.nameAr?.charAt(0) || "م"}
                </AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-medium text-sm">{manager?.nameAr || "مدير"}</p>
                <Badge variant="secondary" className="text-xs">
                  مدير الفرع
                </Badge>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location === item.path;
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

                  <Collapsible 
                    open={inventoryOpen} 
                    onOpenChange={setInventoryOpen}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          isActive={location.includes("/manager/inventory")}
                          data-testid="nav-inventory-toggle"
                        >
                          <Package className="h-5 w-5" />
                          <span>المخزون</span>
                          <ChevronDown className="mr-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {inventoryItems.map((item) => {
                            const isActive = location === item.path;
                            return (
                              <SidebarMenuSubItem key={item.path}>
                                <SidebarMenuSubButton 
                                  asChild 
                                  isActive={isActive}
                                  data-testid={`nav-${item.id}`}
                                >
                                  <Link href={item.path}>
                                    <span>{item.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
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
            {manager && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {manager.nameAr}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {manager.nameAr?.charAt(0) || "م"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
