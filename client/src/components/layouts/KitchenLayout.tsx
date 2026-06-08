import { ReactNode, useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { LanguageToggle } from "@/components/language-toggle";
import { useTranslation } from "react-i18next";
import { 
  ChefHat, 
  ShoppingBag, 
  LogOut,
  ArrowRight,
  Home,
  Clock
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
  SidebarGroupLabel,
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

interface KitchenLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backPath?: string;
}

export function KitchenLayout({ 
  children, 
  title,
  showBack = false,
  backPath = "/employee/kitchen"
}: KitchenLayoutProps) {
  const [location, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const { i18n } = useTranslation();

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      setEmployee(JSON.parse(storedEmployee));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    localStorage.removeItem("qirox-restore-key");
    setLocation("/employee/gateway");
  };

  const navItems = [
    { path: "/employee/kitchen", icon: ChefHat, label: "شاشة المطبخ" },
    { path: "/employee/orders", icon: ShoppingBag, label: "الطلبات" },
    { path: "/employee/attendance", icon: Clock, label: "الحضور" },
    { path: "/employee/dashboard", icon: Home, label: "الرئيسية" },
  ];

  const roleLabels: Record<string, string> = {
    admin: "مدير النظام",
    manager: "مدير",
    cashier: "كاشير",
    barista: "باريستا",
  };

  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
        <Sidebar side="right" collapsible="icon">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {employee?.nameAr?.charAt(0) || "ب"}
                </AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-medium text-sm">{employee?.nameAr || "باريستا"}</p>
                <Badge variant="secondary" className="text-xs">
                  {roleLabels[employee?.role || ""] || "باريستا"}
                </Badge>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>المطبخ</SidebarGroupLabel>
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
            <div className="flex items-center gap-2">
              <LanguageToggle />
              {employee && (
                <>
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    KDS
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {employee.nameAr}
                  </span>
                </>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
