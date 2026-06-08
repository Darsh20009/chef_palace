import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Bell, Code2, GitBranch, Mail, Coffee, BookOpen, Star, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";
import { brand } from "@/lib/brand";


export function AdminSidebar() {
  const [location, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language !== 'en';

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30_000,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  const groups = [
    {
      label: isAr ? "الرئيسية" : "Main",
      items: [
        { label: isAr ? 'لوحة التحكم' : 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard', isNotifications: false },
      ]
    },
    {
      label: isAr ? "العمليات" : "Operations",
      items: [
        { label: isAr ? 'إدارة المأكولات والمشروبات' : 'Menu Management', icon: Coffee, path: '/employee/menu-management', isNotifications: false },
        { label: isAr ? 'إدارة الطلبات' : 'Orders', icon: ClipboardList, path: '/manager/orders', isNotifications: false },
        { label: isAr ? 'حجوزات الطاولات' : 'Table Reservations', icon: BookOpen, path: '/manager/reservations', isNotifications: false },
        { label: isAr ? 'حجوزات المنتجات' : 'Product Reservations', icon: Star, path: '/manager/product-reservations', isNotifications: false },
      ]
    },
    {
      label: isAr ? "الإدارة" : "Management",
      items: [
        { label: isAr ? 'الموظفون' : 'Employees', icon: Users, path: '/admin/employees', isNotifications: false },
        { label: isAr ? 'الفروع' : 'Branches', icon: GitBranch, path: '/admin/branches', isNotifications: false },
        { label: isAr ? 'التقارير' : 'Reports', icon: FileText, path: '/admin/reports', isNotifications: false },
      ]
    },
    {
      label: isAr ? "التواصل" : "Communication",
      items: [
        { label: isAr ? 'إرسال الإشعارات' : 'Send Notifications', icon: Bell, path: '/admin/notifications', isNotifications: true },
        { label: isAr ? 'التسويق البريدي' : 'Email Marketing', icon: Mail, path: '/admin/email', isNotifications: false },
      ]
    },
    {
      label: isAr ? "الإعدادات" : "Settings",
      items: [
        { label: isAr ? 'الإعدادات' : 'Settings', icon: Settings, path: '/admin/settings', isNotifications: false },
        { label: isAr ? 'إدارة API' : 'API Management', icon: Code2, path: '/admin/api', isNotifications: false },
      ]
    },
  ];

  const handleLogout = async () => {
    await fetch('/api/employees/logout', { method: 'POST' });
    localStorage.removeItem("qirox-restore-key");
    navigate('/employee/login');
  };

  return (
    <>
      <div className="w-64 bg-background border-l border-border flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-1">
            <img
              src={qiroxLogoStaff}
              alt={brand.platformNameEn}
              className="w-10 h-10 object-contain rounded-lg"
            />
            <div>
              <h2 className="text-lg font-bold text-foreground">{isAr ? brand.platformNameAr : brand.platformNameEn}</h2>
              <p className="text-xs text-muted-foreground">{isAr ? 'لوحة التحكم الإدارية' : 'Admin Dashboard'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-1">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  const showBadge = item.isNotifications && unreadCount > 0;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-right ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground hover:bg-primary/10'
                      }`}
                      data-testid={`sidebar-link-${item.path.split('/').pop()}`}
                    >
                      <div className="relative shrink-0">
                        <Icon className="w-4 h-4" />
                        {showBadge && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none ring-1 ring-background">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-sm flex-1">{item.label}</span>
                      {showBadge && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 ml-2" />
            {isAr ? 'تسجيل الخروج' : 'Logout'}
          </Button>
        </div>
      </div>
    </>
  );
}
