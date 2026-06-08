import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import SarIcon from "@/components/sar-icon";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@/lib/useTranslate";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ShoppingCart, Coffee, Users, ClipboardList, Calendar, ChefHat,
  LayoutDashboard, Package, BarChart3, Settings, CreditCard,
  Receipt, Boxes, Truck, FileText, UserCog, Bell, Gift, Tag,
  MonitorSmartphone, Home, Wallet, TrendingUp,
} from "lucide-react";

interface QuickLink {
  ar: string;
  en: string;
  path: string;
  icon: React.ReactNode;
  groupAr: string;
  groupEn: string;
}

const QUICK_LINKS: QuickLink[] = [
  { ar: "الصفحة الرئيسية للموظف", en: "Employee Home", path: "/employee/home", icon: <Home className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "كاشير POS", en: "POS Cashier", path: "/employee/pos", icon: <ShoppingCart className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "شاشة المطبخ", en: "Kitchen Display", path: "/employee/kitchen", icon: <ChefHat className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "الطلبات الحية", en: "Live Orders", path: "/employee/orders", icon: <ClipboardList className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "حضور وانصراف", en: "Attendance", path: "/employee/attendance", icon: <Calendar className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "الطاولات", en: "Tables", path: "/employee/tables", icon: <LayoutDashboard className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "حجوزات الطاولات", en: "Table Reservations", path: "/employee/reservations", icon: <Calendar className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "حجوزات المنتجات", en: "Product Reservations", path: "/employee/product-reservations", icon: <Gift className="w-4 h-4" />, groupAr: "تنقل سريع", groupEn: "Quick Navigation" },
  { ar: "إدارة المنيو", en: "Menu Management", path: "/employee/menu-management", icon: <Coffee className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "الموظفون", en: "Employees", path: "/admin/employees", icon: <Users className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "لوحة المدير", en: "Manager Dashboard", path: "/manager/dashboard", icon: <BarChart3 className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "لوحة المالك", en: "Owner Dashboard", path: "/owner/dashboard", icon: <UserCog className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "لوحة الإدارة العليا", en: "Executive Dashboard", path: "/executive/dashboard", icon: <TrendingUp className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "المحاسبة", en: "Accounting", path: "/manager/accounting", icon: <Wallet className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "التحليلات", en: "Analytics", path: "/manager/analytics", icon: <BarChart3 className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "تقارير موحدة", en: "Unified Reports", path: "/manager/unified-reports", icon: <FileText className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "BI Analytics", en: "BI Analytics", path: "/manager/bi-analytics", icon: <TrendingUp className="w-4 h-4" />, groupAr: "إدارة", groupEn: "Management" },
  { ar: "المخزون - المواد الخام", en: "Inventory - Raw Items", path: "/manager/inventory/raw-items", icon: <Boxes className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "المخزون - تنبيهات", en: "Inventory - Alerts", path: "/manager/inventory/alerts", icon: <Bell className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "المخزون - الموردون", en: "Inventory - Suppliers", path: "/manager/inventory/suppliers", icon: <Truck className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "المخزون - المشتريات", en: "Inventory - Purchases", path: "/manager/inventory/purchases", icon: <Package className="w-4 h-4" />, groupAr: "مخزون", groupEn: "Inventory" },
  { ar: "الفروع", en: "Branches", path: "/admin/branches", icon: <LayoutDashboard className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "إعدادات النظام", en: "System Settings", path: "/admin/settings", icon: <Settings className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "بطاقات الهدايا", en: "Gift Cards", path: "/manager/gift-cards", icon: <Gift className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "العروض والخصومات", en: "Promotions", path: "/manager/promotions", icon: <Tag className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "الولاء", en: "Loyalty", path: "/manager/loyalty", icon: <CreditCard className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "فواتير ZATCA", en: "ZATCA Invoices", path: "/manager/zatca-invoices", icon: <Receipt className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "كشك الطلب الذاتي", en: "Self-Order Kiosk", path: "/kiosk", icon: <MonitorSmartphone className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
  { ar: "شاشة العميل", en: "Customer Display", path: "/customer-display", icon: <MonitorSmartphone className="w-4 h-4" />, groupAr: "إعدادات", groupEn: "Settings" },
];

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const tc = useTranslate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    enabled: open,
    staleTime: 30_000,
  });
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/coffee-items"],
    enabled: open,
    staleTime: 60_000,
  });
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    enabled: open,
    staleTime: 60_000,
  });
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    enabled: open,
    staleTime: 60_000,
  });

  const q = search.trim().toLowerCase();
  const currency = tc("ر.س", "SAR");

  const filteredOrders = useMemo(() => {
    if (!q) return [];
    return (orders || []).filter((o: any) => {
      const num = String(o.orderNumber || "").toLowerCase();
      const phone = String(o.customerPhone || "").toLowerCase();
      const name = String(o.customerName || "").toLowerCase();
      return num.includes(q) || phone.includes(q) || name.includes(q);
    }).slice(0, 6);
  }, [orders, q]);

  const filteredProducts = useMemo(() => {
    if (!q) return [];
    return (products || []).filter((p: any) => {
      const ar = String(p.nameAr || p.name || "").toLowerCase();
      const en = String(p.nameEn || "").toLowerCase();
      return ar.includes(q) || en.includes(q);
    }).slice(0, 6);
  }, [products, q]);

  const filteredCustomers = useMemo(() => {
    if (!q) return [];
    return (customers || []).filter((c: any) => {
      const phone = String(c.phone || "").toLowerCase();
      const name = String(c.name || "").toLowerCase();
      return phone.includes(q) || name.includes(q);
    }).slice(0, 5);
  }, [customers, q]);

  const filteredEmployees = useMemo(() => {
    if (!q) return [];
    return (employees || []).filter((e: any) => {
      const name = String(e.name || "").toLowerCase();
      const phone = String(e.phone || "").toLowerCase();
      const role = String(e.role || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || role.includes(q);
    }).slice(0, 5);
  }, [employees, q]);

  const go = (path: string) => {
    setOpen(false);
    setSearch("");
    setLocation(path);
  };

  const linkGroups = useMemo(() => {
    const groups: Record<string, { ar: string; en: string; path: string; icon: React.ReactNode }[]> = {};
    QUICK_LINKS.forEach((l) => {
      const label = tc(l.ar, l.en).toLowerCase();
      if (q && !label.includes(q)) return;
      const key = tc(l.groupAr, l.groupEn);
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return groups;
  }, [q, tc]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={tc("ابحث عن طلب / منتج / عميل / موظف أو صفحة...", "Search orders / products / customers / employees or pages...")}
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />
      <CommandList className="max-h-[500px]">
        <CommandEmpty>{tc("لا توجد نتائج", "No results")}</CommandEmpty>

        {filteredOrders.length > 0 && (
          <>
            <CommandGroup heading={tc("الطلبات", "Orders")}>
              {filteredOrders.map((o: any) => (
                <CommandItem
                  key={o.id || o._id}
                  onSelect={() => go(`/employee/orders?id=${o.id || o._id}`)}
                  data-testid={`cmd-order-${o.orderNumber || o.id}`}
                >
                  <Receipt className="w-4 h-4 ml-2 text-primary" />
                  <span className="font-medium">#{o.orderNumber}</span>
                  <span className="text-muted-foreground text-sm mr-2">
                    {o.customerName || o.customerPhone || "—"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{o.total} <SarIcon size={11} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredProducts.length > 0 && (
          <>
            <CommandGroup heading={tc("المنتجات", "Products")}>
              {filteredProducts.map((p: any) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => go(`/employee/menu-management?productId=${p.id}`)}
                  data-testid={`cmd-product-${p.id}`}
                >
                  <Coffee className="w-4 h-4 ml-2 text-primary" />
                  <span>{tc(p.nameAr || p.name, p.nameEn || p.nameAr || p.name)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.price} <SarIcon size={11} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredCustomers.length > 0 && (
          <>
            <CommandGroup heading={tc("العملاء", "Customers")}>
              {filteredCustomers.map((c: any) => (
                <CommandItem
                  key={c.phone}
                  onSelect={() => go(`/employee/loyalty?phone=${encodeURIComponent(c.phone)}`)}
                  data-testid={`cmd-customer-${c.phone}`}
                >
                  <Users className="w-4 h-4 ml-2 text-primary" />
                  <span>{c.name || tc("بدون اسم", "No name")}</span>
                  <span className="text-muted-foreground text-xs mr-2">{c.phone}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredEmployees.length > 0 && (
          <>
            <CommandGroup heading={tc("الموظفون", "Employees")}>
              {filteredEmployees.map((e: any) => (
                <CommandItem
                  key={e.id}
                  onSelect={() => go(`/admin/employees?employeeId=${e.id}`)}
                  data-testid={`cmd-employee-${e.id}`}
                >
                  <UserCog className="w-4 h-4 ml-2 text-primary" />
                  <span>{e.name}</span>
                  <span className="text-muted-foreground text-xs mr-2">({e.role})</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {Object.entries(linkGroups).map(([heading, items]) => (
          <CommandGroup key={heading} heading={heading}>
            {items.map((l) => (
              <CommandItem
                key={l.path}
                onSelect={() => go(l.path)}
                data-testid={`cmd-link-${l.path.replace(/\//g, "-")}`}
              >
                {l.icon}
                <span className="mr-2">{tc(l.ar, l.en)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="px-3 py-2 text-[10px] text-muted-foreground border-t flex items-center justify-between">
        <span>{tc("اضغط Esc للإغلاق", "Press Esc to close")}</span>
        <span>{tc("Ctrl+K لفتح البحث", "Ctrl+K to open search")}</span>
      </div>
    </CommandDialog>
  );
}
