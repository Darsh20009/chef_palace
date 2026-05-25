import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/lib/brand";
import {
  Rocket, Users, ShoppingCart, ChefHat, Coffee, Calendar,
  CreditCard, BarChart3, Package, Wallet, UserCog, Bell, Search,
  Zap, Award, ArrowRight, ArrowLeft, X, Sparkles, KeyboardIcon,
  TrendingUp, Receipt, Boxes, Star, CheckCircle2, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  icon: React.ReactNode;
  accent: string;
  audience: "all" | "staff" | "manager";
  render: (tc: (a: string, e: string) => string) => React.ReactNode;
}

const COLORS = {
  primary: "from-emerald-500 to-emerald-700",
  blue: "from-blue-500 to-blue-700",
  amber: "from-amber-500 to-orange-600",
  purple: "from-purple-500 to-fuchsia-600",
  rose: "from-rose-500 to-pink-600",
  slate: "from-slate-700 to-slate-900",
  teal: "from-teal-500 to-cyan-700",
};

function Feature({ icon, titleAr, titleEn, descAr, descEn, tc }: any) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white/80 backdrop-blur rounded-xl border border-border/40 hover:border-primary/30 transition">
      <div className="p-2.5 bg-primary/10 text-primary rounded-lg flex-shrink-0">{icon}</div>
      <div>
        <h4 className="font-bold text-base mb-1">{tc(titleAr, titleEn)}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{tc(descAr, descEn)}</p>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-foreground text-background rounded-md shadow-sm">
      {children}
    </kbd>
  );
}

const SLIDES: Slide[] = [
  {
    id: "welcome",
    titleAr: "مرحباً بك في نظام QIROX",
    titleEn: "Welcome to QIROX System",
    subtitleAr: "دليلك السريع لاستغلال كل ميزة في النظام",
    subtitleEn: "Your quick guide to mastering every feature",
    icon: <Rocket className="w-8 h-8" />,
    accent: COLORS.primary,
    audience: "all",
    render: (tc) => (
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-lg text-muted-foreground mb-8 leading-loose">
          {tc(
            "نظام إدارة متكامل للمقهى — نقاط بيع، مخزون، محاسبة، ولاء، توصيل، تحليلات، وأكثر. هذا الدليل سيرشدك خطوة بخطوة.",
            "A complete cafe management system — POS, inventory, accounting, loyalty, delivery, analytics, and more. This guide walks you through everything step by step."
          )}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <Users className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">3</div>
            <div className="text-xs text-muted-foreground">{tc("بوابات منفصلة", "Separate portals")}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <Sparkles className="w-7 h-7 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">50+</div>
            <div className="text-xs text-muted-foreground">{tc("ميزة جاهزة", "Ready features")}</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <Globe className="w-7 h-7 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">2</div>
            <div className="text-xs text-muted-foreground">{tc("عربي / إنجليزي", "Arabic / English")}</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "roles",
    titleAr: "من يستخدم النظام؟",
    titleEn: "Who uses the system?",
    subtitleAr: "ثلاث بوابات لثلاث فئات",
    subtitleEn: "Three portals for three audiences",
    icon: <Users className="w-8 h-8" />,
    accent: COLORS.blue,
    audience: "all",
    render: (tc) => (
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border-2 border-emerald-200">
          <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center mb-3"><Coffee className="w-6 h-6" /></div>
          <h3 className="text-xl font-bold mb-2">{tc("العميل", "Customer")}</h3>
          <p className="text-sm text-muted-foreground mb-3">{tc("يطلب من الجوال أو الطاولة، يتتبع طلبه، يجمع نقاط ولاء.", "Orders from phone or table, tracks order, earns loyalty.")}</p>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
            <li>{tc("القائمة + السلة + الدفع", "Menu + cart + pay")}</li>
            <li>{tc("تتبع حي + إشعارات", "Live tracking + notifications")}</li>
            <li>{tc("بطاقة ولاء وحجوزات", "Loyalty card & reservations")}</li>
          </ul>
        </div>
        <div className="p-6 bg-gradient-to-br from-blue-50 to-white rounded-2xl border-2 border-blue-200">
          <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center mb-3"><UserCog className="w-6 h-6" /></div>
          <h3 className="text-xl font-bold mb-2">{tc("الموظف / الكاشير", "Employee / Cashier")}</h3>
          <p className="text-sm text-muted-foreground mb-3">{tc("ينفّذ الطلبات، يخدم في المطبخ والطاولات، يسجّل الحضور.", "Executes orders, serves kitchen & tables, logs attendance.")}</p>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
            <li>{tc("POS + شاشة المطبخ KDS", "POS + Kitchen Display KDS")}</li>
            <li>{tc("الطاولات والحجوزات", "Tables & reservations")}</li>
            <li>{tc("الحضور والولاء", "Attendance & loyalty")}</li>
          </ul>
        </div>
        <div className="p-6 bg-gradient-to-br from-purple-50 to-white rounded-2xl border-2 border-purple-200">
          <div className="w-12 h-12 bg-purple-500 text-white rounded-xl flex items-center justify-center mb-3"><BarChart3 className="w-6 h-6" /></div>
          <h3 className="text-xl font-bold mb-2">{tc("المدير / المالك", "Manager / Owner")}</h3>
          <p className="text-sm text-muted-foreground mb-3">{tc("يحلل الأداء، يدير المخزون والمحاسبة، يضيف موظفين.", "Analyzes performance, manages inventory & accounting, adds staff.")}</p>
          <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
            <li>{tc("تحليلات BI + تقارير موحدة", "BI Analytics + unified reports")}</li>
            <li>{tc("محاسبة + ZATCA + ERP", "Accounting + ZATCA + ERP")}</li>
            <li>{tc("صلاحيات وفروع وموردين", "Permissions, branches, suppliers")}</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "staff-login",
    titleAr: "بداية يوم الموظف",
    titleEn: "Employee — Start of Day",
    subtitleAr: "ثلاث خطوات لتبدأ التشغيل",
    subtitleEn: "Three steps to start operating",
    icon: <Calendar className="w-8 h-8" />,
    accent: COLORS.teal,
    audience: "staff",
    render: (tc) => (
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { n: 1, ar: "تسجيل الدخول", en: "Sign in", descAr: "ادخل من /employee/login برقم الجوال وكلمة المرور — أو امسح رمز QR للدخول السريع.", descEn: "Sign in at /employee/login with phone & password — or scan QR for instant access." },
          { n: 2, ar: "تسجيل الحضور", en: "Clock-in", descAr: "اضغط 'حضور' في الصفحة الرئيسية. النظام يتحقق من موقعك تلقائياً.", descEn: "Tap 'Attendance' on the home page. The system verifies your location automatically." },
          { n: 3, ar: "فتح الوردية", en: "Open shift", descAr: "إذا كنت كاشيراً، تُفتح وردية جديدة تلقائياً برصيد افتتاحي. شريط ملخّص الوردية يظهر أعلى صفحة الكاشير.", descEn: "If you're a cashier, a new shift opens automatically with an opening balance. The shift summary bar appears atop the cashier page." },
        ].map((s) => (
          <div key={s.n} className="p-5 bg-white rounded-2xl border-2 border-border/50 relative">
            <div className="absolute -top-3 -right-3 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg shadow-lg">{s.n}</div>
            <h4 className="font-bold text-lg mb-2 mt-2">{tc(s.ar, s.en)}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{tc(s.descAr, s.descEn)}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "pos",
    titleAr: "نقطة البيع (POS)",
    titleEn: "Point of Sale (POS)",
    subtitleAr: "قلب العمليات اليومية",
    subtitleEn: "The heart of daily operations",
    icon: <ShoppingCart className="w-8 h-8" />,
    accent: COLORS.primary,
    audience: "staff",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-4">
        <Feature tc={tc} icon={<Coffee className="w-5 h-5" />} titleAr="إضافة منتجات سريعة" titleEn="Quick add products" descAr="اضغط على المنتج → تخصيص (حجم/إضافات) → يُضاف للسلة فوراً. المنتجات البسيطة تُضاف بنقرة واحدة." descEn="Tap product → customize (size/addons) → added instantly. Simple products add with one tap." />
        <Feature tc={tc} icon={<Users className="w-5 h-5" />} titleAr="ربط العميل بالطلب" titleEn="Link customer to order" descAr="ابحث برقم الجوال → النقاط والولاء تطبق تلقائياً + سجل الطلبات السابق." descEn="Search by phone → loyalty points apply automatically + past order history." />
        <Feature tc={tc} icon={<CreditCard className="w-5 h-5" />} titleAr="3 طرق دفع" titleEn="3 payment methods" descAr="نقدي / شبكة (مدى/فيزا/Apple Pay) / بطاقة كيروكس الذكية للولاء." descEn="Cash / Card (mada/Visa/Apple Pay) / QIROX smart loyalty card." />
        <Feature tc={tc} icon={<Receipt className="w-5 h-5" />} titleAr="طباعة ZATCA" titleEn="ZATCA print" descEn="Auto-generates a tax invoice with QR code complying with Saudi e-invoicing." descAr="ينشئ فاتورة ضريبية تلقائياً برمز QR متوافقة مع الفوترة الإلكترونية السعودية." />
        <Feature tc={tc} icon={<Award className="w-5 h-5" />} titleAr="خصومات وعروض" titleEn="Discounts & promos" descAr="أضف كود خصم، استبدل نقاط الولاء، طبّق عرض الباقات — كله من نفس الشاشة." descEn="Add discount code, redeem loyalty points, apply bundle offers — all from one screen." />
        <Feature tc={tc} icon={<Sparkles className="w-5 h-5" />} titleAr="وضع غير متصل" titleEn="Offline mode" descAr="إذا انقطع الإنترنت، الطلبات تُحفظ محلياً وتُرسل تلقائياً عند العودة." descEn="If internet drops, orders save locally and sync automatically on reconnect." />
      </div>
    ),
  },
  {
    id: "shortcuts",
    titleAr: "اختصارات الكاشير الاحترافية",
    titleEn: "Pro Cashier Shortcuts",
    subtitleAr: "وفّر الوقت بضغطة واحدة",
    subtitleEn: "Save time with one keystroke",
    icon: <KeyboardIcon className="w-8 h-8" />,
    accent: COLORS.slate,
    audience: "staff",
    render: (tc) => (
      <div className="max-w-2xl mx-auto space-y-3">
        {[
          { key: "F1", ar: "طلب جديد — يفرّغ السلة وبيانات العميل", en: "New order — clears cart & customer info" },
          { key: "F2", ar: "إتمام الطلب وإرساله للمطبخ والطباعة", en: "Submit order to kitchen & print" },
          { key: "F4", ar: "إعادة طباعة آخر طلب", en: "Reprint last order" },
          { key: "Esc", ar: "إلغاء السلة (مع تأكيد)", en: "Cancel cart (with confirmation)" },
          { key: "Ctrl+K", ar: "بحث موحّد في كل النظام (متاح من أي صفحة)", en: "Global search across the system (any page)" },
        ].map((s) => (
          <div key={s.key} className="flex items-center justify-between p-4 bg-white border-2 border-border/50 rounded-xl hover:border-primary/40 transition">
            <span className="text-sm font-medium flex-1">{tc(s.ar, s.en)}</span>
            <Kbd>{s.key}</Kbd>
          </div>
        ))}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>{tc("💡 ملاحظة:", "💡 Note:")}</strong> {tc("الاختصارات لا تتفعل أثناء الكتابة في حقول الإدخال أو عند فتح نوافذ.", "Shortcuts won't trigger while typing in input fields or when modals are open.")}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "kitchen",
    titleAr: "شاشة المطبخ (KDS)",
    titleEn: "Kitchen Display (KDS)",
    subtitleAr: "نظام تحضير الطلبات",
    subtitleEn: "Order preparation system",
    icon: <ChefHat className="w-8 h-8" />,
    accent: COLORS.amber,
    audience: "staff",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-4">
        <Feature tc={tc} icon={<ChefHat className="w-5 h-5" />} titleAr="بطاقات الطلبات الحية" titleEn="Live order cards" descAr="كل طلب يظهر كبطاقة كبيرة بالعناصر والملاحظات والوقت المنقضي." descEn="Each order appears as a large card with items, notes, and elapsed time." />
        <Feature tc={tc} icon={<Zap className="w-5 h-5" />} titleAr="تحديث الحالة بنقرة" titleEn="One-tap status update" descAr="بدء التحضير → جاهز → تم التسليم. كل تحديث يصل للكاشير والعميل فوراً." descEn="Start preparing → Ready → Delivered. Every update reaches cashier & customer instantly." />
        <Feature tc={tc} icon={<Bell className="w-5 h-5" />} titleAr="تنبيهات صوتية" titleEn="Sound alerts" descAr="صوت تنبيه عند وصول طلب جديد لضمان عدم تفويت أي طلب." descEn="Audio alert on new order arrival to ensure nothing is missed." />
        <Feature tc={tc} icon={<TrendingUp className="w-5 h-5" />} titleAr="ترتيب ذكي" titleEn="Smart ordering" descAr="الطلبات الأقدم تظهر أولاً مع تمييز لوني للطلبات المتأخرة." descEn="Oldest orders show first with color highlights for delayed ones." />
      </div>
    ),
  },
  {
    id: "tables",
    titleAr: "الطاولات والحجوزات",
    titleEn: "Tables & Reservations",
    subtitleAr: "إدارة كاملة للجلسات",
    subtitleEn: "Complete dine-in management",
    icon: <Coffee className="w-8 h-8" />,
    accent: COLORS.teal,
    audience: "staff",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-4">
        <Feature tc={tc} icon={<Coffee className="w-5 h-5" />} titleAr="حالة الطاولات الحية" titleEn="Live table status" descAr="مخطط بصري للطاولات: متاحة / مشغولة / محجوزة / تنتظر الدفع." descEn="Visual table map: available / occupied / reserved / waiting payment." />
        <Feature tc={tc} icon={<Sparkles className="w-5 h-5" />} titleAr="رمز QR لكل طاولة" titleEn="QR per table" descAr="العميل يمسح رمز الطاولة ويطلب من جواله مباشرة بدون كاشير." descEn="Customer scans the table QR and orders from their phone — no cashier needed." />
        <Feature tc={tc} icon={<Calendar className="w-5 h-5" />} titleAr="حجوزات الطاولات" titleEn="Table reservations" descAr="احجز طاولة لتاريخ ووقت محدد، النظام يمنع الازدواج." descEn="Reserve a table for a specific date/time — system prevents conflicts." />
        <Feature tc={tc} icon={<Award className="w-5 h-5" />} titleAr="حجز منتجات/تجارب" titleEn="Product reservations" descAr="منتجات خاصة (مثل تجربة الرومانسية) تتطلب حجز مسبق بباقة." descEn="Special products (e.g. romantic experience) require a package reservation." />
      </div>
    ),
  },
  {
    id: "manager-dashboard",
    titleAr: "لوحة المدير",
    titleEn: "Manager Dashboard",
    subtitleAr: "نظرة شاملة في ثوانٍ",
    subtitleEn: "Full overview in seconds",
    icon: <BarChart3 className="w-8 h-8" />,
    accent: COLORS.purple,
    audience: "manager",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-4">
        <Feature tc={tc} icon={<TrendingUp className="w-5 h-5" />} titleAr="KPI لحظية" titleEn="Live KPIs" descAr="المبيعات، عدد الطلبات، متوسط الطلب، أفضل المنتجات — تتحدث كل دقيقة." descEn="Sales, order count, avg order, top items — updated every minute." />
        <Feature tc={tc} icon={<BarChart3 className="w-5 h-5" />} titleAr="BI Analytics ذكية" titleEn="Smart BI Analytics" descAr="رؤى تلقائية: ساعات الذروة، الساعات الميتة، تغيرات الإيراد، مزيج المنتجات." descEn="Auto insights: peak hours, dead hours, revenue changes, product mix." />
        <Feature tc={tc} icon={<Globe className="w-5 h-5" />} titleAr="مقارنة الفروع" titleEn="Multi-branch compare" descAr="ضع كل الفروع جنباً إلى جنب: إيراد، عدد طلبات، متوسط، تفصيل دفعات." descEn="Side-by-side branches: revenue, orders, average, payment breakdown." />
        <Feature tc={tc} icon={<Bell className="w-5 h-5" />} titleAr="مركز الإشعارات الذكي" titleEn="Smart notification center" descAr="جرس واحد يجمع: طلبات معلّقة، مخزون منخفض، موظفين متأخرين، تقييمات بلا رد." descEn="One bell aggregates: pending orders, low stock, late employees, unreplied reviews." />
      </div>
    ),
  },
  {
    id: "inventory",
    titleAr: "المخزون والوصفات",
    titleEn: "Inventory & Recipes",
    subtitleAr: "تتبع كل قطرة وحبة",
    subtitleEn: "Track every drop & bean",
    icon: <Package className="w-8 h-8" />,
    accent: COLORS.amber,
    audience: "manager",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-4">
        <Feature tc={tc} icon={<Boxes className="w-5 h-5" />} titleAr="مواد خام كاملة" titleEn="Full raw materials" descAr="سجّل كل مادة بسعرها وكميتها ومخزونها الأدنى والمورد." descEn="Log every item with price, quantity, min stock, and supplier." />
        <Feature tc={tc} icon={<ChefHat className="w-5 h-5" />} titleAr="وصفات لكل منتج" titleEn="Recipe per product" descAr="ربط كل منتج بمكوناته — النظام يخصم تلقائياً عند البيع." descEn="Link each product to its ingredients — system deducts automatically on sale." />
        <Feature tc={tc} icon={<Bell className="w-5 h-5" />} titleAr="تنبيهات نفاد" titleEn="Stock alerts" descAr="إشعار فوري عند وصول مادة للحد الأدنى — لا تنفد قهوة أبداً." descEn="Instant alert when an item hits minimum — never run out of coffee." />
        <Feature tc={tc} icon={<TrendingUp className="w-5 h-5" />} titleAr="أوامر شراء ذكية" titleEn="Smart purchase orders" descAr="أنشئ أمر شراء تلقائي للموردين عند انخفاض عدة مواد." descEn="Auto-create supplier POs when multiple items run low." />
      </div>
    ),
  },
  {
    id: "accounting",
    titleAr: "المحاسبة وZATCA",
    titleEn: "Accounting & ZATCA",
    subtitleAr: "متوافق مع المعايير السعودية",
    subtitleEn: "Saudi-compliant",
    icon: <Wallet className="w-8 h-8" />,
    accent: COLORS.rose,
    audience: "manager",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-4">
        <Feature tc={tc} icon={<Wallet className="w-5 h-5" />} titleAr="إيرادات ومصروفات" titleEn="Revenue & expenses" descAr="سجّل كل مصروف بتصنيف، ولوحة الأرباح تتحدث تلقائياً." descEn="Log every expense by category — profit dashboard updates automatically." />
        <Feature tc={tc} icon={<Receipt className="w-5 h-5" />} titleAr="فواتير ZATCA" titleEn="ZATCA invoices" descAr="كل طلب يُنشئ فاتورة ضريبية برمز QR متوافقة مع المرحلة الثانية." descEn="Every order generates a Phase 2 compliant tax invoice with QR." />
        <Feature tc={tc} icon={<TrendingUp className="w-5 h-5" />} titleAr="ERP بقيد مزدوج" titleEn="Double-entry ERP" descAr="دفتر يومية كامل بحسابات (نقدية، مبيعات، ضريبة) — جاهز للمصدّر." descEn="Full journal with accounts (cash, sales, VAT) — export-ready." />
        <Feature tc={tc} icon={<Globe className="w-5 h-5" />} titleAr="تصدير للأنظمة" titleEn="Export to systems" descAr="صدّر القيود لـقيود، دفترة، Zoho بصيغة CSV أو JSON." descEn="Export entries to Qoyod, Daftra, Zoho as CSV or JSON." />
      </div>
    ),
  },
  {
    id: "discovery",
    titleAr: "اكتشاف سريع: Ctrl+K و FAB",
    titleEn: "Quick Discovery: Ctrl+K & FAB",
    subtitleAr: "وصول لأي شيء في ثانيتين",
    subtitleEn: "Reach anything in 2 seconds",
    icon: <Search className="w-8 h-8" />,
    accent: COLORS.blue,
    audience: "all",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="p-5 bg-gradient-to-br from-blue-50 to-white rounded-2xl border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-3"><Search className="w-6 h-6 text-blue-600" /><h4 className="font-bold text-lg">{tc("بحث موحّد", "Universal Search")}</h4></div>
          <p className="text-sm text-muted-foreground mb-3">{tc("اضغط Ctrl+K من أي صفحة → ابحث في:", "Press Ctrl+K anywhere → search:")}</p>
          <ul className="space-y-1 text-sm text-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" />{tc("الطلبات (رقم/اسم/جوال)", "Orders (number/name/phone)")}</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" />{tc("المنتجات والعملاء والموظفين", "Products, customers, employees")}</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" />{tc("أكثر من 30 صفحة في النظام", "30+ pages in the system")}</li>
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <Kbd>Ctrl</Kbd><span className="text-xs">+</span><Kbd>K</Kbd>
          </div>
        </div>
        <div className="p-5 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border-2 border-emerald-200">
          <div className="flex items-center gap-2 mb-3"><Zap className="w-6 h-6 text-emerald-600" /><h4 className="font-bold text-lg">{tc("زر الإجراءات السريعة", "Quick Action FAB")}</h4></div>
          <p className="text-sm text-muted-foreground mb-3">{tc("الزر الأخضر الدائري — قائمة فورية:", "Round green button — instant menu:")}</p>
          <ul className="space-y-1 text-sm text-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{tc("كاشير / مطبخ / طلبات", "Cashier / Kitchen / Orders")}</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{tc("حضور / طاولات / رئيسية", "Attendance / Tables / Home")}</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{tc("فتح بحث Ctrl+K مباشرة", "Open Ctrl+K search directly")}</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "tips",
    titleAr: "نصائح ذهبية للاستغلال الأمثل",
    titleEn: "Golden Tips for Maximum Value",
    subtitleAr: "خبرة سنوات في 7 نصائح",
    subtitleEn: "Years of experience in 7 tips",
    icon: <Star className="w-8 h-8" />,
    accent: COLORS.amber,
    audience: "all",
    render: (tc) => (
      <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
        {[
          { ar: "اربط كل منتج بوصفة لتعرف ربحك الحقيقي", en: "Link every product to a recipe to know your real profit" },
          { ar: "فعّل تنبيهات المخزون لتجنب نفاد المواد", en: "Enable stock alerts to avoid running out" },
          { ar: "استخدم F1-F4 في الكاشير لتسريع الخدمة 3 أضعاف", en: "Use F1-F4 in cashier to triple service speed" },
          { ar: "راقب مركز الإشعارات كل صباح لتبدأ يومك مرتباً", en: "Check the notification center each morning for an organized day" },
          { ar: "اطبع رموز QR للطاولات لتقليل الازدحام على الكاشير", en: "Print table QRs to reduce cashier congestion" },
          { ar: "افحص BI Analytics أسبوعياً لاكتشاف ساعات الذروة", en: "Review BI Analytics weekly to discover peak hours" },
          { ar: "صدّر قيود المحاسبة شهرياً لمحاسبك الخارجي", en: "Export accounting entries monthly for your external accountant" },
          { ar: "استخدم برنامج الولاء لزيادة تكرار الزيارات 40%+", en: "Use loyalty program to increase repeat visits 40%+" },
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-border/50">
            <div className="w-7 h-7 flex-shrink-0 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</div>
            <p className="text-sm leading-relaxed">{tc(t.ar, t.en)}</p>
          </div>
        ))}
      </div>
    ),
  },
];

export default function SystemGuide() {
  const [, setLocation] = useLocation();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const slide = SLIDES[current];
  const total = SLIDES.length;

  const goNext = () => {
    if (current < total - 1) { setDirection(1); setCurrent((c) => c + 1); }
  };
  const goPrev = () => {
    if (current > 0) { setDirection(-1); setCurrent((c) => c - 1); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { isRtl ? goPrev() : goNext(); }
      else if (e.key === "ArrowLeft") { isRtl ? goNext() : goPrev(); }
      else if (e.key === "Escape") { setLocation("/employee/home"); }
      else if (e.key === "Home") setCurrent(0);
      else if (e.key === "End") setCurrent(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, isRtl]);

  const progress = useMemo(() => ((current + 1) / total) * 100, [current, total]);

  const switchLang = () => {
    i18n.changeLanguage(isRtl ? "en" : "ar");
    document.documentElement.dir = isRtl ? "ltr" : "rtl";
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50 z-50 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl bg-gradient-to-br text-white", slide.accent)}>{slide.icon}</div>
          <div>
            <h1 className="font-bold text-sm md:text-base">{brand.platformNameAr || brand.nameAr} — {tc("دليل النظام", "System Guide")}</h1>
            <p className="text-xs text-muted-foreground">{tc(`الشريحة ${current + 1} من ${total}`, `Slide ${current + 1} of ${total}`)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
            {slide.audience === "staff" ? tc("للموظف", "Staff") : slide.audience === "manager" ? tc("للمدير", "Manager") : tc("للجميع", "All")}
          </Badge>
          <Button variant="ghost" size="sm" onClick={switchLang} data-testid="guide-lang-switch">
            <Globe className="w-4 h-4 ml-1" />
            {isRtl ? "EN" : "AR"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/employee/home")} data-testid="guide-close">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted relative overflow-hidden">
        <motion.div
          className={cn("h-full bg-gradient-to-r", slide.accent)}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * (isRtl ? -60 : 60) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * (isRtl ? 60 : -60) }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="min-h-full px-4 md:px-12 py-8 md:py-12 max-w-6xl mx-auto"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-4xl font-bold mb-2">{tc(slide.titleAr, slide.titleEn)}</h2>
              {slide.subtitleAr && <p className="text-sm md:text-base text-muted-foreground">{tc(slide.subtitleAr, slide.subtitleEn || "")}</p>}
            </div>
            {slide.render(tc)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="border-t bg-white/90 backdrop-blur-sm p-3 md:p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Button variant="outline" onClick={goPrev} disabled={current === 0} data-testid="guide-prev" size="sm">
            {isRtl ? <ArrowRight className="w-4 h-4 ml-1" /> : <ArrowLeft className="w-4 h-4 mr-1" />}
            {tc("السابق", "Previous")}
          </Button>

          {/* Dots */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60%]">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={cn(
                  "transition-all rounded-full flex-shrink-0",
                  i === current ? "w-8 h-2.5 bg-primary" : "w-2.5 h-2.5 bg-muted hover:bg-muted-foreground/30"
                )}
                aria-label={`Slide ${i + 1}`}
                data-testid={`guide-dot-${i}`}
              />
            ))}
          </div>

          {current < total - 1 ? (
            <Button onClick={goNext} className="bg-primary text-primary-foreground hover:bg-primary/90" size="sm" data-testid="guide-next">
              {tc("التالي", "Next")}
              {isRtl ? <ArrowLeft className="w-4 h-4 mr-1" /> : <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          ) : (
            <Button onClick={() => setLocation("/employee/home")} className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-white hover:opacity-90" size="sm" data-testid="guide-finish">
              <CheckCircle2 className="w-4 h-4 ml-1" />
              {tc("ابدأ الآن", "Get Started")}
            </Button>
          )}
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2 hidden sm:block">
          {tc("استخدم ← → للتنقل، Esc للخروج", "Use ← → to navigate, Esc to exit")}
        </p>
      </div>
    </div>
  );
}
