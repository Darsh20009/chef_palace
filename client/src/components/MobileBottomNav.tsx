import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Home, ClipboardList, CreditCard, LogOut, Menu, Languages, Bell } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Coffee, ChefHat, Users, Settings, BarChart3, Wallet, Warehouse,
  Table, ShoppingCart, Calendar, FileText, Utensils, Eye
} from "lucide-react";

interface MobileBottomNavProps {
  employeeRole?: string;
  onLogout?: () => void;
}

export function MobileBottomNav({ employeeRole, onLogout }: MobileBottomNavProps) {
  const [location] = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const { t, i18n } = useTranslation();

  // Unread notification count — poll every 30s
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30_000,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  const resolvedRole = employeeRole || (() => {
    try {
      const stored = localStorage.getItem("currentEmployee");
      if (stored) return JSON.parse(stored).role;
    } catch {}
    return '';
  })();

  const isManager = ['manager', 'owner', 'admin'].includes(resolvedRole || '');

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("currentEmployee");
      localStorage.removeItem("chefsplace-restore-key");
      window.location.href = "/employee/gateway";
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const allPages = [
    { path: "/employee/home",        icon: Home,        label: t('mobile_nav.home') },
    { path: "/employee/dashboard",   icon: BarChart3,   label: t('mobile_nav.dashboard') },
    { path: "/employee/pos",         icon: CreditCard,  label: t('mobile_nav.pos') },
    { path: "/employee/orders",      icon: ClipboardList, label: t('mobile_nav.orders') },
    { path: "/employee/cashier",     icon: ShoppingCart, label: t('mobile_nav.cashier') },
    { path: "/employee/kitchen",     icon: ChefHat,     label: t('mobile_nav.kitchen') },
    { path: "/employee/table-orders",icon: Table,       label: t('mobile_nav.tables') },
    { path: "/employee/loyalty",     icon: Users,       label: t('mobile_nav.loyalty') },
    { path: "/employee/attendance",  icon: Calendar,    label: t('mobile_nav.attendance') },
    { path: "/employee/leave-request", icon: FileText,  label: t('mobile_nav.leave') },
    { path: "/notifications",        icon: Bell,        label: 'الإشعارات' },
    ...(isManager ? [
      { path: "/employee/menu-management",         icon: Coffee,    label: t('mobile_nav.drinks') },
      { path: "/employee/menu-management?type=food", icon: Utensils, label: t('mobile_nav.food') },
      { path: "/admin/settings",                   icon: Settings,  label: t('mobile_nav.settings') },
      { path: "/manager/accounting",               icon: Wallet,    label: t('mobile_nav.accounting') },
      { path: "/manager/inventory",                icon: Warehouse, label: t('mobile_nav.inventory') },
    ] : []),
  ];

  const visibleNav = [
    { path: "/employee/home",        icon: Home,         label: t('mobile_nav.home') },
    { path: "/employee/orders",      icon: ClipboardList, label: t('mobile_nav.orders') },
    { path: "/employee/pos",         icon: CreditCard,   label: t('mobile_nav.pos') },
    { path: "/employee/attendance",  icon: Calendar,     label: t('mobile_nav.attendance') },
    { path: "/notifications",        icon: Bell,         label: 'إشعارات', isNotifications: true },
    ...(isManager ? [{ path: "/employee/menu-management", icon: Coffee, label: t('mobile_nav.drinks') }] : []),
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background border-t border-border shadow-[0_-1px_12px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
    >
      <div
        className="flex items-center overflow-x-auto no-scrollbar px-1 pt-1.5 gap-0.5"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const fullPath = location + window.location.search;
          const isActive = item.path.includes('?')
            ? fullPath === item.path
            : location === item.path;
          const showBadge = (item as any).isNotifications && unreadCount > 0;
          return (
            <Link key={item.path} href={item.path}>
              <button
                className={`flex flex-col items-center gap-0.5 min-w-[56px] px-2 py-1.5 rounded-xl text-[10px] whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                  isActive
                    ? 'text-primary font-bold bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                data-testid={`mobile-nav-${item.path.split('/').pop()?.split('?')[0]}`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none ring-1 ring-background">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="leading-none mt-0.5">{item.label}</span>
              </button>
            </Link>
          );
        })}

        <Sheet open={showMenu} onOpenChange={setShowMenu}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center gap-0.5 min-w-[56px] px-2 py-1.5 rounded-xl text-[10px] whitespace-nowrap shrink-0 text-muted-foreground hover:bg-muted/50 transition-all active:scale-95"
              data-testid="mobile-nav-menu"
            >
              <div className="relative">
                <Menu className="h-5 w-5" />
              </div>
              <span className="leading-none mt-0.5">{t('mobile_nav.more')}</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl flex flex-col overflow-hidden p-0"
            style={{ maxHeight: '75dvh', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />
            <SheetHeader className="px-4 pb-2 shrink-0">
              <SheetTitle className="text-base">{t('mobile_nav.menu_title')}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto min-h-0 px-4">
              <div className="grid grid-cols-3 gap-2 py-2 pb-4">
                {allPages.map((item) => {
                  const Icon = item.icon;
                  const fullPath = location + window.location.search;
                  const isActive = item.path.includes('?')
                    ? fullPath === item.path
                    : location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <button
                        onClick={() => setShowMenu(false)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-full transition-all active:scale-95 ${
                          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                        }`}
                        data-testid={`mobile-menu-${item.path.split('/').pop()}`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="border-t px-4 pt-3 pb-2 shrink-0 space-y-2">
              <Button variant="outline" className="w-full h-11 text-sm" onClick={toggleLanguage} data-testid="mobile-menu-language">
                <Languages className="h-4 w-4 mr-2" />
                {i18n.language === 'ar' ? 'English' : 'عربي'}
              </Button>
              <Button variant="destructive" className="w-full h-11 text-sm" onClick={handleLogout} data-testid="mobile-menu-logout">
                <LogOut className="h-4 w-4 ml-2" />
                {t('mobile_nav.logout')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
