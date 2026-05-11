import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Package, Warehouse,
  Wallet, Users, Truck, BarChart3, Building2, Brain, Tag, Settings,
  ChefHat, Clock, Coffee, Gift, Star, Banknote, FileText, Globe,
  HardDrive, Code2, Store, Handshake, Shield, HeadphonesIcon,
  TrendingUp, MapPin, Receipt, ChevronDown, ChevronRight,
  LogOut, Menu, X, BarChart2, Zap, Box, FlaskConical, 
  ArrowRightLeft, Bell, Table, BookOpen, UserCheck, CreditCard, Monitor,
  Sparkles, MessageSquare
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface ManagerSidebarProps {
  manager: any;
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  role?: string;
}

interface NavItem {
  label: string;
  labelEn: string;
  icon: any;
  path?: string;
  children?: NavItem[];
  color?: string;
  badge?: string;
  roles?: string[];
}

const NAV_GROUPS: { label: string; labelEn: string; color: string; items: NavItem[] }[] = [
  {
    label: "الرئيسية", labelEn: "Home", color: "#2D9B6E",
    items: [
      { label: "لوحة التحكم", labelEn: "Dashboard", icon: LayoutDashboard, path: "/manager/dashboard", color: "#2D9B6E" },
      { label: "نقطة البيع", labelEn: "POS", icon: ShoppingCart, path: "/employee/pos", color: "#10b981" },
      { label: "الكيوسك", labelEn: "Kiosk", icon: Monitor, path: "/kiosk", color: "#059669" },
    ]
  },
  {
    label: "العمليات", labelEn: "Operations", color: "#3b82f6",
    items: [
      { label: "إدارة الطلبات", labelEn: "Orders", icon: ClipboardList, path: "/manager/orders", color: "#3b82f6" },
      { label: "الطاولات", labelEn: "Tables", icon: Table, path: "/manager/tables", color: "#60a5fa" },
      { label: "إدارة قائمة الطعام", labelEn: "Menu", icon: Coffee, path: "/employee/menu-management", color: "#818cf8" },
      { label: "حجوزات الطاولات", labelEn: "Table Reservations", icon: BookOpen, path: "/manager/reservations", color: "#6366f1" },
      { label: "حجوزات المنتجات", labelEn: "Product Reservations", icon: Star, path: "/manager/product-reservations", color: "#8b5cf6" },
      { label: "الورديات", labelEn: "Shifts", icon: Clock, path: "/manager/shifts", color: "#a78bfa" },
    ]
  },
  {
    label: "المخزون", labelEn: "Inventory", color: "#f59e0b",
    items: [
      { label: "نظرة المخزون", labelEn: "Inventory", icon: Warehouse, path: "/manager/inventory", color: "#f59e0b" },
      { label: "المواد الخام", labelEn: "Raw Items", icon: Box, path: "/manager/inventory/raw-items", color: "#fbbf24" },
      { label: "الوصفات", labelEn: "Recipes", icon: FlaskConical, path: "/manager/inventory/recipes", color: "#f97316" },
      { label: "المشتريات", labelEn: "Purchases", icon: Receipt, path: "/manager/inventory/purchases", color: "#fb923c" },
      { label: "حركات المخزون", labelEn: "Movements", icon: ArrowRightLeft, path: "/manager/inventory/movements", color: "#fcd34d" },
      { label: "نقل بين الفروع", labelEn: "Transfers", icon: Truck, path: "/manager/inventory/transfers", color: "#fde68a" },
      { label: "تنبيهات المخزون", labelEn: "Alerts", icon: Bell, path: "/manager/inventory/alerts", color: "#ef4444", badge: "!" },
    ]
  },
  {
    label: "المالية", labelEn: "Finance", color: "#8b5cf6",
    items: [
      { label: "المحاسبة", labelEn: "Accounting", icon: Wallet, path: "/manager/accounting", color: "#8b5cf6" },
      { label: "ZATCA فاتورة", labelEn: "ZATCA", icon: Shield, path: "/manager/zatca", color: "#a78bfa", roles: ["admin", "owner"] },
      { label: "ERP المحاسبة", labelEn: "ERP Accounting", icon: BookOpen, path: "/erp/accounting", color: "#c4b5fd", roles: ["admin", "owner"] },
    ]
  },
  {
    label: "الفريق", labelEn: "Team", color: "#ec4899",
    items: [
      { label: "الموظفون", labelEn: "Employees", icon: Users, path: "/admin/employees", color: "#ec4899" },
      { label: "الحضور", labelEn: "Attendance", icon: UserCheck, path: "/manager/attendance", color: "#f472b6" },
    ]
  },
  {
    label: "التوصيل", labelEn: "Delivery", color: "#06b6d4",
    items: [
      { label: "إدارة التوصيل", labelEn: "Delivery", icon: Truck, path: "/manager/delivery", color: "#06b6d4" },
      { label: "السائقون", labelEn: "Drivers", icon: MapPin, path: "/manager/drivers", color: "#22d3ee" },
      { label: "حالة التوصيل", labelEn: "Delivery Status", icon: Zap, path: "/manager/delivery-services", color: "#67e8f9" },
    ]
  },
  {
    label: "الذكاء الاصطناعي", labelEn: "AI Center", color: "#a855f7",
    items: [
      { label: "مركز الذكاء الاصطناعي", labelEn: "AI Center", icon: Sparkles, path: "/manager/ai", color: "#a855f7" },
    ]
  },
  {
    label: "التحليلات والتقارير", labelEn: "Analytics", color: "#14b8a6",
    items: [
      { label: "التقارير", labelEn: "Reports", icon: FileText, path: "/admin/reports", color: "#14b8a6" },
      { label: "التقارير الموحدة", labelEn: "Unified Reports", icon: Building2, path: "/manager/unified-reports", color: "#2dd4bf" },
      { label: "تحليلات BI", labelEn: "BI Analytics", icon: Brain, path: "/manager/bi-analytics", color: "#99f6e4" },
    ]
  },
  {
    label: "التسويق", labelEn: "Marketing", color: "#f43f5e",
    items: [
      { label: "برنامج الولاء", labelEn: "Loyalty", icon: CreditCard, path: "/manager/loyalty", color: "#f43f5e" },
      { label: "العروض الترويجية", labelEn: "Promotions", icon: Tag, path: "/manager/promotions", color: "#fda4af" },
      { label: "إرسال إشعارات Push", labelEn: "Push Notifications", icon: Bell, path: "/admin/notifications", color: "#fb7185" },
      { label: "الموردون", labelEn: "Suppliers", icon: Handshake, path: "/manager/suppliers", color: "#fecdd3" },
    ]
  },
  {
    label: "الإعدادات", labelEn: "Settings", color: "#64748b",
    items: [
      { label: "إعدادات الفروع", labelEn: "Branches", icon: Building2, path: "/admin/branches", color: "#64748b", roles: ["admin", "owner"] },
      { label: "الإعدادات", labelEn: "Settings", icon: Settings, path: "/admin/settings", color: "#94a3b8" },
      { label: "التكاملات", labelEn: "Integrations", icon: Globe, path: "/manager/integrations", color: "#cbd5e1", roles: ["admin", "owner"] },
      { label: "الدعم الفني", labelEn: "Support", icon: HeadphonesIcon, path: "/manager/support", color: "#e2e8f0" },
    ]
  },
  {
    label: "المتقدمة", labelEn: "Advanced", color: "#7c3aed",
    items: [
      { label: "سوق B2B", labelEn: "B2B Market", icon: Store, path: "/manager/b2b", color: "#7c3aed", roles: ["admin", "owner"] },
      { label: "برنامج الشركاء", labelEn: "Partners", icon: Handshake, path: "/manager/partners", color: "#9333ea", roles: ["admin", "owner"] },
      { label: "إدارة الأجهزة", labelEn: "Hardware", icon: HardDrive, path: "/manager/hardware", color: "#a855f7", roles: ["admin", "owner"] },
      { label: "إدارة المستودع", labelEn: "Warehouse", icon: Warehouse, path: "/manager/warehouse", color: "#c084fc" },
      { label: "إدارة API", labelEn: "API Mgmt", icon: Code2, path: "/admin/api", color: "#d8b4fe", roles: ["admin", "owner"] },
    ]
  },
];

function SidebarNavItem({ item, collapsed, depth = 0 }: { item: NavItem; collapsed: boolean; depth?: number }) {
  const [location, navigate] = useLocation();
  const isActive = location === item.path;

  if (item.children) {
    return (
      <div className="space-y-0.5">
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all",
            "text-[#888] hover:text-white hover:bg-[#1a1a1a]",
            depth > 0 && "pl-8"
          )}
        >
          <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && <ChevronDown className="w-3 h-3 opacity-50" />}
        </button>
        {!collapsed && (
          <div className="ml-4 space-y-0.5">
            {item.children.map(child => (
              <SidebarNavItem key={child.path} item={child} collapsed={collapsed} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => item.path && navigate(item.path)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all group relative",
        isActive
          ? "text-white font-semibold"
          : "text-[#888] hover:text-white hover:bg-[#1a1a1a] font-medium",
        depth > 0 && "pl-6"
      )}
      style={isActive ? { background: `linear-gradient(135deg, ${item.color}22, ${item.color}11)`, border: `1px solid ${item.color}33` } : {}}
      title={collapsed ? item.label : undefined}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ background: item.color }} />
      )}
      <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110", isActive && "scale-110")} style={{ color: isActive ? item.color : undefined }} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-right">{item.label}</span>
          {item.badge && (
            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
              {item.badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export function ManagerSidebar({ manager, onLogout, mobileOpen, onMobileClose, role }: ManagerSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["الرئيسية", "العمليات"]));
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const userRole = role || manager?.role || "manager";

  const filterItemsByRole = (items: NavItem[]) =>
    items.filter(item => !item.roles || item.roles.includes(userRole));

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: filterItemsByRole(group.items),
  })).filter(group => group.items.length > 0);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const sidebarContent = (
    <div className={cn("flex flex-col h-full bg-[#0a0a0a] border-l border-[#1a1a1a] overflow-hidden transition-all duration-300", collapsed ? "w-[60px]" : "w-[240px]")}>
      {/* Header */}
      <div className={cn("flex items-center border-b border-[#1a1a1a] flex-shrink-0", collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-4")}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-[#2D9B6E] rounded-lg flex items-center justify-center flex-shrink-0">
              <Coffee className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-bold truncate">{brand.nameAr}</div>
              <div className="text-[#2D9B6E] text-[10px] truncate">{manager?.fullName || "مدير"}</div>
            </div>
          </div>
        )}
        <button
          onClick={onMobileClose || (() => setCollapsed(!collapsed))}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666] hover:text-white hover:bg-[#1a1a1a] flex-shrink-0"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : collapsed ? <Menu className="w-4 h-4" /> : <X className="w-3 h-3" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1 scrollbar-thin scrollbar-thumb-[#222] scrollbar-track-transparent px-2">
        {visibleGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#444] hover:text-[#666] transition-colors"
              >
                <span>{isAr ? group.label : group.labelEn}</span>
                {expandedGroups.has(group.label) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
            {(collapsed || expandedGroups.has(group.label)) && (
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <SidebarNavItem key={item.path || item.label} item={item} collapsed={collapsed} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a1a1a] p-2 flex-shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
          title={collapsed ? "تسجيل الخروج" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="font-medium">تسجيل الخروج</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onMobileClose} />
          <aside className="fixed right-0 top-0 h-full z-50 flex lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

/* Mobile bottom navigation bar */
export function MobileBottomNav({ manager }: { manager: any }) {
  const [location, navigate] = useLocation();

  const items = [
    { label: "الرئيسية", icon: LayoutDashboard, path: "/manager/dashboard", color: "#2D9B6E" },
    { label: "الطلبات", icon: ClipboardList, path: "/employee/orders", color: "#3b82f6" },
    { label: "المخزون", icon: Warehouse, path: "/manager/inventory", color: "#f59e0b" },
    { label: "التقارير", icon: BarChart2, path: "/manager/unified-reports", color: "#14b8a6" },
    { label: "المحاسبة", icon: Wallet, path: "/manager/accounting", color: "#8b5cf6" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-[#0a0a0a] border-t border-[#1a1a1a]">
      <div className="flex items-center justify-around px-1 py-1 safe-area-pb">
        {items.map(item => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl flex-1 transition-all", isActive ? "bg-[#1a1a1a]" : "")}
            >
              <item.icon className="w-5 h-5 transition-transform" style={{ color: isActive ? item.color : "#555" }} />
              <span className="text-[10px] font-medium" style={{ color: isActive ? item.color : "#555" }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
