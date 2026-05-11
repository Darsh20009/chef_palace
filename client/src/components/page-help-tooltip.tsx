import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { HelpCircle, X, Sparkles, CheckCircle2 } from "lucide-react";

interface PageHelpData {
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  icon: string;
  color: string;
}

const PAGE_HELP: Record<string, PageHelpData> = {
  "/menu": {
    title: "قائمة المنتجات",
    titleEn: "Menu",
    description: "تصفح جميع المنتجات والفئات واضف ما يعجبك إلى سلة التسوق.",
    descriptionEn: "Browse all products and categories and add items to your cart.",
    icon: "☕",
    color: "#2D9B6E",
    features: ["تصفح المنتجات بالفئات", "إضافة وتعديل المنتجات في السلة", "عرض التفاصيل والمكونات", "البحث السريع عن المنتج"],
    featuresEn: ["Browse by category", "Add & modify cart items", "View details & ingredients", "Quick product search"],
  },
  "/cart": {
    title: "سلة التسوق",
    titleEn: "Shopping Cart",
    description: "راجع طلبك قبل الدفع وعدّل الكميات أو أزِل منتجات.",
    descriptionEn: "Review your order, adjust quantities or remove items.",
    icon: "🛒",
    color: "#f59e0b",
    features: ["تعديل الكميات", "إزالة المنتجات", "ملاحظات خاصة لكل منتج", "حساب الإجمالي مع الضريبة"],
    featuresEn: ["Adjust quantities", "Remove items", "Special notes per item", "Subtotal + VAT calculation"],
  },
  "/checkout": {
    title: "إتمام الطلب والدفع",
    titleEn: "Checkout & Payment",
    description: "ادفع بأمان عبر PayMob — مدى، فيزا، وماستركارد.",
    descriptionEn: "Pay securely via PayMob — Mada, Visa, and Mastercard.",
    icon: "💳",
    color: "#6366f1",
    features: ["دفع ببطاقة مدى/فيزا/ماستركارد عبر PayMob", "بوابة دفع سعودية معتمدة", "جميع المعاملات مشفرة وآمنة", "تطبيق نقاط الولاء كخصم"],
    featuresEn: ["Pay with Mada/Visa/Mastercard via PayMob", "Certified Saudi payment gateway", "All transactions are encrypted and secure", "Redeem loyalty points as SAR discount"],
  },
  "/my-card": {
    title: "بطاقة الولاء",
    titleEn: "Loyalty Card",
    description: "تابع نقاطك وتحويل رصيد لأصدقائك وتاريخ معاملاتك.",
    descriptionEn: "Track your points, transfer balance to friends, and view transaction history.",
    icon: "🎁",
    color: "#ec4899",
    features: ["عرض رصيد النقاط (0.05 ر.س/نقطة)", "تحويل نقاط لصديق برقم الهاتف", "تاريخ المعاملات بالريال", "كيو آر بطاقتك الشخصية"],
    featuresEn: ["View points balance (0.05 SAR/pt)", "Transfer points by phone number", "Transaction history in SAR", "Your personal QR code"],
  },
  "/my-orders": {
    title: "طلباتي",
    titleEn: "My Orders",
    description: "تابع جميع طلباتك السابقة والحالية.",
    descriptionEn: "Track all your past and current orders.",
    icon: "📦",
    color: "#0ea5e9",
    features: ["عرض حالة الطلب الحالي", "تاريخ الطلبات السابقة", "تفاصيل كل طلب ومنتجاته", "تقييم الطلب بعد الاستلام"],
    featuresEn: ["View current order status", "Past order history", "Itemized order details", "Rate order after delivery"],
  },
  "/tracking": {
    title: "تتبع الطلب",
    titleEn: "Order Tracking",
    description: "تابع حالة طلبك خطوة بخطوة من التحضير حتى التسليم.",
    descriptionEn: "Follow your order step-by-step from preparation to delivery.",
    icon: "📍",
    color: "#10b981",
    features: ["تتبع مباشر للحالة", "وقت التسليم المتوقع", "تحديث تلقائي كل 30 ثانية", "إشعارات فورية عند التغيير"],
    featuresEn: ["Live status tracking", "Estimated delivery time", "Auto-refresh every 30s", "Instant change notifications"],
  },
  "/profile": {
    title: "ملفي الشخصي",
    titleEn: "My Profile",
    description: "تعديل بياناتك الشخصية وكلمة المرور ومعلومات التواصل.",
    descriptionEn: "Edit your personal info, password, and contact details.",
    icon: "👤",
    color: "#8b5cf6",
    features: ["تعديل الاسم والبريد الإلكتروني", "تغيير كلمة المرور", "رقم الهاتف المرتبط بالولاء", "صورة الملف الشخصي"],
    featuresEn: ["Edit name & email", "Change password", "Phone linked to loyalty", "Profile photo"],
  },
  "/employee/dashboard": {
    title: "لوحة الموظف",
    titleEn: "Employee Dashboard",
    description: "نظرة عامة على أداء اليوم والطلبات والإيرادات.",
    descriptionEn: "Overview of today's performance, orders, and revenue.",
    icon: "📊",
    color: "#f59e0b",
    features: ["إجمالي مبيعات اليوم", "عدد الطلبات المكتملة", "أداء الفرع اليومي", "روابط سريعة للوظائف"],
    featuresEn: ["Today's total sales", "Completed orders count", "Branch daily performance", "Quick links to functions"],
  },
  "/employee/cashier": {
    title: "نقطة البيع - الكاشير",
    titleEn: "Cashier POS",
    description: "إضافة طلبات جديدة ومعالجة المدفوعات للعملاء.",
    descriptionEn: "Add new orders and process customer payments.",
    icon: "🏧",
    color: "#2D9B6E",
    features: ["إنشاء طلب سريع", "دفع نقدي أو كارت", "استخدام نقاط العميل كخصم", "طباعة الإيصال"],
    featuresEn: ["Quick order creation", "Cash or card payment", "Redeem customer loyalty points", "Print receipt"],
  },
  "/employee/orders": {
    title: "إدارة الطلبات",
    titleEn: "Order Management",
    description: "تابع جميع الطلبات الواردة وحدّث حالاتها لحظة بلحظة.",
    descriptionEn: "Monitor all incoming orders and update their statuses in real time.",
    icon: "📋",
    color: "#0ea5e9",
    features: ["عرض طلبات جميع الفروع", "تحديث الحالة (معلق → تحضير → جاهز → مكتمل)", "إكمال جميع الطلبات دفعة واحدة", "تصفية حسب الحالة أو الفرع"],
    featuresEn: ["View orders from all branches", "Update status (pending→preparing→ready→done)", "Complete all orders at once", "Filter by status or branch"],
  },
  "/employee/kitchen": {
    title: "شاشة المطبخ",
    titleEn: "Kitchen Display",
    description: "عرض الطلبات الواردة مباشرةً للمطبخ للتحضير الفوري.",
    descriptionEn: "Show incoming orders directly to the kitchen for immediate preparation.",
    icon: "👨‍🍳",
    color: "#ef4444",
    features: ["عرض بطاقة لكل طلب", "تحديث حالة التحضير", "تنبيه صوتي بطلب جديد", "ترتيب حسب الأولوية"],
    featuresEn: ["Card view per order", "Update preparation status", "Sound alert for new orders", "Priority ordering"],
  },
  "/employee/tables": {
    title: "إدارة الطاولات",
    titleEn: "Table Management",
    description: "تابع حالة الطاولات وافتح طلبات الطاولات للعملاء.",
    descriptionEn: "Monitor table status and open table orders for customers.",
    icon: "🍽️",
    color: "#8b5cf6",
    features: ["خريطة الطاولات التفاعلية", "حالة الطاولة (شاغرة/مشغولة/محجوزة)", "فتح طلب طاولة جديد", "رؤية عدد الأشخاص"],
    featuresEn: ["Interactive table map", "Table status (free/occupied/reserved)", "Open new table order", "See guest count"],
  },
  "/employee/shifts": {
    title: "إدارة الوردية",
    titleEn: "Shift Management",
    description: "تسجيل دخول وخروج الوردية وتتبع ساعات العمل.",
    descriptionEn: "Clock in/out shifts and track working hours.",
    icon: "⏰",
    color: "#f59e0b",
    features: ["تسجيل بداية ونهاية الوردية", "حساب ساعات العمل تلقائياً", "ملاحظات الوردية", "تاريخ الورديات السابقة"],
    featuresEn: ["Log shift start & end", "Auto-calculate working hours", "Shift notes", "Previous shift history"],
  },
  "/manager/dashboard": {
    title: "لوحة المدير",
    titleEn: "Manager Dashboard",
    description: "إدارة شاملة للمطعم: المنتجات والمخزون والموظفين والتقارير.",
    descriptionEn: "Comprehensive restaurant management: products, inventory, employees, and reports.",
    icon: "🏢",
    color: "#2D9B6E",
    features: ["إدارة المنتجات والفئات", "متابعة المخزون والتنبيهات", "إدارة الموظفين والصلاحيات", "التقارير المالية اليومية"],
    featuresEn: ["Manage products & categories", "Monitor inventory & alerts", "Employee & permission management", "Daily financial reports"],
  },
  "/manager/inventory": {
    title: "إدارة المخزون",
    titleEn: "Inventory Management",
    description: "تابع مستويات المواد الخام والتنبيهات عند انخفاض الكمية.",
    descriptionEn: "Monitor raw material levels and alerts when quantities run low.",
    icon: "📦",
    color: "#f59e0b",
    features: ["جرد المواد الخام", "تنبيه عند الوصول للحد الأدنى", "ربط المواد بالمنتجات", "استهلاك تلقائي عند الطلب"],
    featuresEn: ["Raw material inventory", "Low stock alerts", "Link materials to products", "Auto-deduct on order"],
  },
  "/manager/inventory/movements": {
    title: "حركات المخزون",
    titleEn: "Stock Movements",
    description: "جرد تفصيلي لجميع حركات الوارد والصادر من المواد الخام.",
    descriptionEn: "Detailed ledger of all incoming and outgoing raw material movements.",
    icon: "📈",
    color: "#10b981",
    features: ["تاريخ كل حركة مخزون بالكيلو والجرام", "تتبع مباشر لحظي (Live)", "عرض القبل والبعد لكل حركة", "تصفية حسب النوع والفرع"],
    featuresEn: ["Full history in kg & grams", "Real-time live tracking", "Before & after per movement", "Filter by type & branch"],
  },
  "/manager/reports": {
    title: "التقارير",
    titleEn: "Reports",
    description: "تقارير مبيعات مفصلة يومية وأسبوعية وشهرية.",
    descriptionEn: "Detailed daily, weekly, and monthly sales reports.",
    icon: "📊",
    color: "#6366f1",
    features: ["تقارير المبيعات اليومية", "أداء الموظفين", "أكثر المنتجات مبيعاً", "تصدير إلى Excel"],
    featuresEn: ["Daily sales reports", "Employee performance", "Top-selling products", "Export to Excel"],
  },
  "/manager/employees": {
    title: "إدارة الموظفين",
    titleEn: "Employee Management",
    description: "أضف وعدّل الموظفين وحدد صلاحياتهم.",
    descriptionEn: "Add, edit employees and set their permissions.",
    icon: "👥",
    color: "#0ea5e9",
    features: ["إضافة وتعديل الموظف", "تحديد الصلاحيات والأدوار", "تفعيل وتعطيل الحساب", "ربط بالفرع المحدد"],
    featuresEn: ["Add & edit employees", "Set roles & permissions", "Activate/deactivate account", "Assign to specific branch"],
  },
  "/manager/accounting": {
    title: "المحاسبة",
    titleEn: "Accounting",
    description: "متابعة الإيرادات والمصروفات والفواتير بشكل منظم.",
    descriptionEn: "Track revenue, expenses, and invoices in an organized way.",
    icon: "💰",
    color: "#10b981",
    features: ["تسجيل الإيرادات والمصروفات", "الفواتير والمدفوعات", "الميزانية الشهرية", "تقرير الأرباح والخسائر"],
    featuresEn: ["Log revenue & expenses", "Invoices & payments", "Monthly budget", "Profit & loss report"],
  },
  "/manager/loyalty": {
    title: "برنامج الولاء",
    titleEn: "Loyalty Program",
    description: "إعداد نظام نقاط الولاء ومكافآت العملاء.",
    descriptionEn: "Configure loyalty points system and customer rewards.",
    icon: "⭐",
    color: "#f59e0b",
    features: ["إعداد نسبة تحويل النقاط إلى ريال", "عرض أرصدة العملاء", "تحويل النقاط يدوياً", "منح نقاط مجانية للعملاء"],
    featuresEn: ["Set points-to-SAR conversion rate", "View customer balances", "Manual point transfer", "Grant free points"],
  },
  "/manager/promotions": {
    title: "العروض والتخفيضات",
    titleEn: "Promotions",
    description: "إنشاء وإدارة العروض والكوبونات والخصومات.",
    descriptionEn: "Create and manage offers, coupons, and discounts.",
    icon: "🏷️",
    color: "#ec4899",
    features: ["كوبون خصم بنسبة أو قيمة ثابتة", "عروض وقت محدد", "ربط العرض بمنتجات معينة", "عرض إحصاء استخدام الكوبون"],
    featuresEn: ["Percentage or fixed discount coupon", "Time-limited offers", "Tie offer to specific products", "Coupon usage statistics"],
  },
  "/manager/analytics": {
    title: "التحليلات المتقدمة",
    titleEn: "Advanced Analytics",
    description: "رؤى ذكية وتحليلات عميقة لأداء المطعم.",
    descriptionEn: "Smart insights and deep analytics for restaurant performance.",
    icon: "🔍",
    color: "#8b5cf6",
    features: ["مخططات الأداء الزمنية", "تحليل سلوك العملاء", "أوقات الذروة والبيع", "مقارنة الفروع"],
    featuresEn: ["Time-based performance charts", "Customer behavior analysis", "Peak times & sales patterns", "Branch comparisons"],
  },
  "/manager/suppliers": {
    title: "إدارة الموردين",
    titleEn: "Supplier Management",
    description: "تسجيل وتتبع الموردين وطلبات الشراء.",
    descriptionEn: "Register and track suppliers and purchase orders.",
    icon: "🚚",
    color: "#0ea5e9",
    features: ["إضافة وتعديل الموردين", "طلبات شراء المواد الخام", "تاريخ التوريد والفواتير", "تقييم أداء المورد"],
    featuresEn: ["Add & edit suppliers", "Raw material purchase orders", "Supply history & invoices", "Supplier performance rating"],
  },
  "/manager/reviews": {
    title: "التقييمات والمراجعات",
    titleEn: "Reviews",
    description: "متابعة تقييمات العملاء والرد عليها.",
    descriptionEn: "Monitor and respond to customer reviews.",
    icon: "⭐",
    color: "#f59e0b",
    features: ["عرض تقييمات العملاء", "متوسط التقييم العام", "الرد على المراجعات", "تصفية حسب التقييم"],
    featuresEn: ["View customer ratings", "Overall average rating", "Reply to reviews", "Filter by rating"],
  },
  "/manager/payroll": {
    title: "كشف الرواتب",
    titleEn: "Payroll",
    description: "حساب وتتبع رواتب الموظفين والمكافآت.",
    descriptionEn: "Calculate and track employee salaries and bonuses.",
    icon: "💵",
    color: "#10b981",
    features: ["حساب الراتب الشهري", "إضافة مكافآت وخصومات", "كشف الرواتب PDF", "تاريخ صرف الرواتب"],
    featuresEn: ["Calculate monthly salary", "Add bonuses & deductions", "Payroll PDF export", "Salary payment history"],
  },
  "/admin/dashboard": {
    title: "لوحة الأدمن",
    titleEn: "Admin Dashboard",
    description: "نظرة شاملة على كامل النظام: الإيرادات والموظفين والطلبات.",
    descriptionEn: "Full system overview: revenue, employees, and orders.",
    icon: "🛡️",
    color: "#6366f1",
    features: ["إجمالي إيرادات اليوم", "حضور الموظفين اليوم", "إحصاء الطلبات بالحالات", "روابط إدارية سريعة"],
    featuresEn: ["Today's total revenue", "Employee attendance today", "Orders by status stats", "Quick admin links"],
  },
  "/admin/employees": {
    title: "موظفو النظام",
    titleEn: "System Employees",
    description: "إدارة كافة موظفي النظام عبر جميع الفروع.",
    descriptionEn: "Manage all system employees across all branches.",
    icon: "👥",
    color: "#0ea5e9",
    features: ["قائمة كاملة بالموظفين", "تفعيل وتعطيل الحسابات", "تعيين الأدوار والفروع", "إعادة تعيين كلمة المرور"],
    featuresEn: ["Full employee list", "Activate & deactivate accounts", "Assign roles & branches", "Reset password"],
  },
  "/admin/branches": {
    title: "الفروع",
    titleEn: "Branches",
    description: "إضافة وتعديل وإدارة فروع المطعم.",
    descriptionEn: "Add, edit, and manage restaurant branches.",
    icon: "🏪",
    color: "#2D9B6E",
    features: ["إنشاء فرع جديد", "تعديل بيانات الفرع", "ساعات العمل لكل فرع", "ربط الموظفين بالفرع"],
    featuresEn: ["Create new branch", "Edit branch info", "Working hours per branch", "Assign employees to branch"],
  },
  "/manager/delivery": {
    title: "إدارة التوصيل",
    titleEn: "Delivery Management",
    description: "متابعة طلبات التوصيل وتعيين السائقين.",
    descriptionEn: "Monitor delivery orders and assign drivers.",
    icon: "🛵",
    color: "#f59e0b",
    features: ["طلبات التوصيل الواردة", "تعيين سائق للطلب", "تتبع موقع السائق", "أوقات التوصيل"],
    featuresEn: ["Incoming delivery orders", "Assign driver to order", "Track driver location", "Delivery times"],
  },
  "/manager/ai": {
    title: "المساعد الذكي",
    titleEn: "AI Assistant",
    description: "احصل على رؤى وتوصيات ذكية لتحسين المطعم.",
    descriptionEn: "Get smart insights and recommendations to improve your restaurant.",
    icon: "🤖",
    color: "#8b5cf6",
    features: ["تحليل أداء المطعم بالذكاء الاصطناعي", "اقتراحات تحسين المبيعات", "توقعات الطلب القادم", "اقتراحات خفض التكاليف"],
    featuresEn: ["AI restaurant performance analysis", "Sales improvement suggestions", "Order demand forecasting", "Cost reduction suggestions"],
  },
  "/manager/warehouse": {
    title: "إدارة المستودع",
    titleEn: "Warehouse Management",
    description: "إدارة مواد الخام في المستودع الرئيسي وتوزيعها على الفروع.",
    descriptionEn: "Manage raw materials in the main warehouse and distribute to branches.",
    icon: "🏭",
    color: "#0ea5e9",
    features: ["جرد المستودع الرئيسي", "تحويل مواد بين الفروع", "طلبات التوريد من المستودع", "تنبيهات نقص المخزون"],
    featuresEn: ["Main warehouse inventory", "Transfer between branches", "Supply requests from warehouse", "Low stock alerts"],
  },
  "/manager/zatca": {
    title: "فواتير ZATCA",
    titleEn: "ZATCA Invoices",
    description: "إدارة الفواتير الإلكترونية المتوافقة مع هيئة الزكاة والضريبة.",
    descriptionEn: "Manage e-invoices compliant with ZATCA (Zakat & Tax Authority).",
    icon: "📄",
    color: "#10b981",
    features: ["فواتير ضريبية رقمية", "توافق مع معايير ZATCA", "تصدير XML للفاتورة", "أرشيف الفواتير"],
    featuresEn: ["Digital tax invoices", "ZATCA compliance", "XML invoice export", "Invoice archive"],
  },
};

function getPageHelp(path: string): PageHelpData | null {
  if (PAGE_HELP[path]) return PAGE_HELP[path];
  const segments = path.split("/").filter(Boolean);
  for (let i = segments.length; i >= 1; i--) {
    const candidate = "/" + segments.slice(0, i).join("/");
    if (PAGE_HELP[candidate]) return PAGE_HELP[candidate];
  }
  return null;
}

export function PageHelpTooltip() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const help = getPageHelp(location);

  useEffect(() => {
    setOpen(false);
    setHovered(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!help) return null;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHovered(false);
      setOpen(false);
    }, 300);
  };

  const handlePanelMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
  };

  const handlePanelMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHovered(false);
      setOpen(false);
    }, 300);
  };

  const isRTL = document.dir === "rtl" || document.documentElement.dir === "rtl";

  return (
    <>
      {/* Floating Help Button */}
      <div
        className="fixed z-[9999] bottom-20 left-4 lg:bottom-6 lg:left-6"
        style={{ direction: "ltr" }}
      >
        {/* Tooltip Panel */}
        {open && (
          <div
            ref={panelRef}
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
            className="absolute bottom-14 left-0 w-72 rounded-2xl shadow-2xl border animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2"
            style={{
              background: "hsl(var(--card))",
              borderColor: `${help.color}33`,
              boxShadow: `0 8px 32px ${help.color}22, 0 2px 8px rgba(0,0,0,0.15)`,
              direction: "rtl",
            }}
          >
            {/* Header */}
            <div
              className="px-4 pt-4 pb-3 rounded-t-2xl flex items-start gap-3"
              style={{ background: `${help.color}15` }}
            >
              <span className="text-3xl leading-none mt-0.5 flex-shrink-0">{help.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-snug" style={{ color: help.color }}>
                  {isRTL ? help.title : help.titleEn}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {isRTL ? help.description : help.descriptionEn}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors mt-0.5"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Features */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: help.color }} />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isRTL ? "المميزات" : "Features"}
                </p>
              </div>
              <ul className="space-y-1.5">
                {(isRTL ? help.features : help.featuresEn).map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: help.color }} />
                    <span className="text-xs text-foreground leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer triangle */}
            <div
              className="absolute -bottom-2 left-5 w-4 h-4 rotate-45 border-b border-r rounded-sm"
              style={{
                background: "hsl(var(--card))",
                borderColor: `${help.color}33`,
              }}
            />
          </div>
        )}

        {/* Help Button */}
        <button
          ref={btnRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => setOpen(v => !v)}
          aria-label="Page Help"
          data-testid="button-page-help"
          className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border-2 border-white"
          style={{
            background: open ? help.color : `${help.color}dd`,
            boxShadow: open
              ? `0 0 0 4px ${help.color}33, 0 4px 16px ${help.color}55`
              : `0 2px 12px ${help.color}66`,
          }}
        >
          {open
            ? <X className="w-5 h-5 text-white" />
            : <HelpCircle className="w-5 h-5 text-white" />
          }
        </button>
      </div>
    </>
  );
}
