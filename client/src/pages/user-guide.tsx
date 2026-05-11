import { useState } from "react";
  import { useLocation } from "wouter";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
  import { Badge } from "@/components/ui/badge";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { Input } from "@/components/ui/input";
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
  import { 
    BookOpen, Coffee, Users, Package, Receipt, ChefHat, ShoppingCart, Settings,
    ArrowLeft, Search, Play, CheckCircle, HelpCircle, Lightbulb, Monitor, Smartphone,
    BarChart3, FileText, AlertTriangle, Shield, Wallet, ClipboardList, TrendingUp,
    Bell, Calculator, Map, Clock, Star
  } from "lucide-react";
  import { useTranslate } from "@/lib/useTranslate";

  interface GuideSection {
    id: string;
    titleAr: string;
    titleEn: string;
    icon: any;
    descriptionAr: string;
    descriptionEn: string;
    steps: GuideStep[];
  }

  interface GuideStep {
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
    tipAr?: string;
    tipEn?: string;
  }

  const guideSections: GuideSection[] = [
    {
      id: "getting-started",
      titleAr: "البداية السريعة", titleEn: "Quick Start",
      icon: Play,
      descriptionAr: "تعرف على النظام وابدأ استخدامه في دقائق", descriptionEn: "Learn the system and start using it in minutes",
      steps: [
        {
          titleAr: "تسجيل الدخول", titleEn: "Sign In",
          contentAr: "استخدم اسم المستخدم وكلمة المرور للدخول إلى لوحة التحكم. اختر 'تذكرني' للبقاء مسجلاً.", contentEn: "Use your username and password to access the dashboard. Choose 'Remember Me' to stay logged in.",
          tipAr: "إذا نسيت كلمة المرور، استخدم 'نسيت كلمة المرور' لإعادة تعيينها", tipEn: "If you forgot your password, use 'Forgot Password' to reset it"
        },
        {
          titleAr: "لوحة التحكم الرئيسية", titleEn: "Main Dashboard",
          contentAr: "ستجد ملخصاً سريعاً للمبيعات والطلبات والتنبيهات. انقر على أي بطاقة للتفاصيل.", contentEn: "You'll find a quick summary of sales, orders and alerts. Click any card for details.",
          tipAr: "البطاقات الملونة تعرض أهم الإحصائيات بلمحة سريعة", tipEn: "Colored cards display key statistics at a glance"
        },
        {
          titleAr: "التنقل بين الصفحات", titleEn: "Page Navigation",
          contentAr: "استخدم القائمة الجانبية للتنقل بين أقسام النظام: الطلبات، المخزون، المحاسبة، الموظفين.", contentEn: "Use the sidebar to navigate between system sections: Orders, Inventory, Accounting, Employees."
        }
      ]
    },
    {
      id: "orders",
      titleAr: "إدارة الطلبات", titleEn: "Order Management",
      icon: ShoppingCart,
      descriptionAr: "استقبال الطلبات ومتابعتها حتى التسليم", descriptionEn: "Receive orders and track them until delivery",
      steps: [
        {
          titleAr: "استقبال طلب جديد", titleEn: "Receive a New Order",
          contentAr: "الطلبات الجديدة تظهر تلقائياً مع تنبيه صوتي. انقر 'قبول' لبدء التحضير أو 'رفض' مع السبب.", contentEn: "New orders appear automatically with an audio alert. Click 'Accept' to start preparation or 'Reject' with a reason.",
          tipAr: "يمكنك تفعيل/إيقاف التنبيهات الصوتية من الإعدادات", tipEn: "You can enable/disable audio alerts from Settings"
        },
        {
          titleAr: "تحديث حالة الطلب", titleEn: "Update Order Status",
          contentAr: "بعد القبول، انقل الطلب عبر المراحل: قيد التحضير ← جاهز ← تم التسليم.", contentEn: "After acceptance, move the order through stages: Preparing → Ready → Delivered."
        },
        {
          titleAr: "طباعة الفاتورة", titleEn: "Print Invoice",
          contentAr: "انقر على رمز الطابعة لطباعة فاتورة تتضمن QR Code متوافق مع ZATCA.", contentEn: "Click the printer icon to print an invoice including a ZATCA-compliant QR code."
        },
        {
          titleAr: "إلغاء الطلب", titleEn: "Cancel Order",
          contentAr: "يمكن إلغاء الطلب من أي مرحلة ما عدا 'تم التسليم'. سيُطلب منك إدخال سبب الإلغاء.", contentEn: "Orders can be cancelled from any stage except 'Delivered'. You will be asked for a cancellation reason.",
          tipAr: "الإلغاءات المتكررة تظهر في تقارير الأداء", tipEn: "Frequent cancellations appear in performance reports"
        }
      ]
    },
    {
      id: "pos",
      titleAr: "نقطة البيع (POS)", titleEn: "Point of Sale (POS)",
      icon: Monitor,
      descriptionAr: "نظام الكاشير للبيع المباشر", descriptionEn: "Cashier system for direct sales",
      steps: [
        {
          titleAr: "فتح نقطة البيع", titleEn: "Open POS",
          contentAr: "انقر على 'نقطة البيع' من القائمة. سيظهر قائمة المنتجات مرتبة حسب الفئات.", contentEn: "Click 'Point of Sale' from the menu. Products will appear sorted by category."
        },
        {
          titleAr: "إضافة منتجات للسلة", titleEn: "Add Products to Cart",
          contentAr: "انقر على المنتج لإضافته. استخدم + و - لتعديل الكمية. انقر مطولاً لحذف المنتج.", contentEn: "Click a product to add it. Use + and - to adjust quantity. Long-press to remove a product."
        },
        {
          titleAr: "تطبيق الخصم", titleEn: "Apply Discount",
          contentAr: "انقر 'خصم' لإدخال نسبة أو قيمة الخصم. يمكنك أيضاً استخدام كوبونات الخصم.", contentEn: "Click 'Discount' to enter a percentage or amount. You can also use discount coupons."
        },
        {
          titleAr: "اختيار طريقة الدفع", titleEn: "Choose Payment Method",
          contentAr: "اختر: نقدي، مدى، Apple Pay، أو STC Pay. للدفع النقدي أدخل المبلغ المستلم لحساب الباقي.", contentEn: "Choose: Cash, Mada, Apple Pay, or STC Pay. For cash, enter the received amount to calculate change.",
          tipAr: "يمكن تقسيم الدفع بين عدة طرق", tipEn: "Payment can be split between multiple methods"
        }
      ]
    },
    {
      id: "inventory",
      titleAr: "إدارة المخزون", titleEn: "Inventory Management",
      icon: Package,
      descriptionAr: "متابعة المواد الخام والتنبيهات", descriptionEn: "Track raw materials and alerts",
      steps: [
        {
          titleAr: "عرض المخزون", titleEn: "View Inventory",
          contentAr: "صفحة المخزون تعرض جميع المواد الخام مع الكميات الحالية والحد الأدنى.", contentEn: "The inventory page displays all raw materials with current quantities and minimum levels."
        },
        {
          titleAr: "إضافة مادة جديدة", titleEn: "Add New Material",
          contentAr: "انقر 'إضافة مادة' وأدخل: الاسم، الوحدة، تكلفة الوحدة، الكمية الحالية، والحد الأدنى.", contentEn: "Click 'Add Material' and enter: name, unit, unit cost, current quantity, and minimum level."
        },
        {
          titleAr: "تنبيهات المخزون المنخفض", titleEn: "Low Stock Alerts",
          contentAr: "المواد التي تصل للحد الأدنى تظهر باللون الأحمر مع تنبيه. تصلك رسالة تذكير يومية.", contentEn: "Materials that reach minimum level appear in red with an alert. You receive a daily reminder.",
          tipAr: "اضبط الحد الأدنى بناءً على سرعة الاستهلاك ووقت التوريد", tipEn: "Set minimum levels based on consumption rate and supply lead time"
        },
        {
          titleAr: "تسجيل استلام المواد", titleEn: "Record Material Receipt",
          contentAr: "انقر 'إضافة مخزون' وأدخل الكمية المستلمة والتكلفة. يُحدث الرصيد تلقائياً.", contentEn: "Click 'Add Stock' and enter the received quantity and cost. The balance updates automatically."
        }
      ]
    },
    {
      id: "recipes",
      titleAr: "إدارة الوصفات", titleEn: "Recipe Management",
      icon: ChefHat,
      descriptionAr: "ربط المنتجات بالمكونات وحساب التكلفة", descriptionEn: "Link products to ingredients and calculate cost",
      steps: [
        {
          titleAr: "إنشاء وصفة جديدة", titleEn: "Create New Recipe",
          contentAr: "اختر المنتج من القائمة، ثم أضف المكونات مع الكميات المطلوبة لكل منها.", contentEn: "Select the product from the list, then add ingredients with required quantities for each."
        },
        {
          titleAr: "حساب تكلفة الوصفة", titleEn: "Calculate Recipe Cost",
          contentAr: "النظام يحسب تلقائياً تكلفة الوصفة بناءً على أسعار المكونات الحالية.", contentEn: "The system automatically calculates recipe cost based on current ingredient prices.",
          tipAr: "راجع التكلفة دورياً خاصة عند تغير أسعار الموردين", tipEn: "Review cost periodically, especially when supplier prices change"
        },
        {
          titleAr: "الخصم التلقائي من المخزون", titleEn: "Automatic Stock Deduction",
          contentAr: "عند تأكيد الطلب، يُخصم من المخزون تلقائياً حسب الوصفة المرتبطة بكل منتج.", contentEn: "When an order is confirmed, stock is automatically deducted according to each product's linked recipe."
        }
      ]
    },
    {
      id: "accounting",
      titleAr: "المحاسبة والتقارير", titleEn: "Accounting & Reports",
      icon: BarChart3,
      descriptionAr: "متابعة الإيرادات والمصروفات والأرباح", descriptionEn: "Track revenue, expenses, and profit",
      steps: [
        {
          titleAr: "لوحة المحاسبة", titleEn: "Accounting Dashboard",
          contentAr: "تعرض ملخصاً للإيرادات، المصروفات، وصافي الربح. اختر الفترة: اليوم، الأسبوع، الشهر.", contentEn: "Displays a summary of revenue, expenses, and net profit. Select period: Today, Week, Month."
        },
        {
          titleAr: "تسجيل مصروف", titleEn: "Record Expense",
          contentAr: "انقر 'إضافة مصروف' واختر الفئة (إيجار، رواتب، مواد، إلخ) وأدخل المبلغ والوصف.", contentEn: "Click 'Add Expense', choose category (rent, salaries, materials, etc.) and enter amount and description."
        },
        {
          titleAr: "تقارير مالية", titleEn: "Financial Reports",
          contentAr: "اذهب لتبويب 'التقارير' لعرض تقارير تفصيلية مع رسومات بيانية.", contentEn: "Go to the 'Reports' tab to view detailed reports with charts.",
          tipAr: "استخدم 'تصدير Excel' لتحليل البيانات أو إرسالها للمحاسب", tipEn: "Use 'Export Excel' to analyze data or send it to your accountant"
        },
        {
          titleAr: "تحليل الربحية", titleEn: "Profitability Analysis",
          contentAr: "تقرير الربحية يوضح هامش الربح لكل منتج، ويساعدك على تحديد المنتجات الأكثر ربحية.", contentEn: "The profitability report shows the profit margin for each product, helping identify the most profitable items."
        }
      ]
    },
    {
      id: "zatca",
      titleAr: "الفوترة الإلكترونية ZATCA", titleEn: "ZATCA E-Invoicing",
      icon: Receipt,
      descriptionAr: "فواتير متوافقة مع هيئة الزكاة", descriptionEn: "Invoices compliant with the Zakat Authority",
      steps: [
        {
          titleAr: "إعداد بيانات المنشأة", titleEn: "Setup Business Data",
          contentAr: "أدخل: اسم المنشأة، الرقم الضريبي، رقم السجل التجاري، والعنوان الكامل.", contentEn: "Enter: business name, tax number, commercial registration number, and full address.",
          tipAr: "تأكد من صحة الرقم الضريبي قبل إرسال أي فاتورة", tipEn: "Verify the tax number before sending any invoice"
        },
        {
          titleAr: "إنشاء فاتورة ضريبية", titleEn: "Create Tax Invoice",
          contentAr: "الفواتير تُنشأ تلقائياً عند إتمام الطلب. تتضمن جميع البيانات المطلوبة ورمز QR.", contentEn: "Invoices are automatically created when an order is completed. They include all required data and a QR code."
        },
        {
          titleAr: "إرسال الفاتورة لـ ZATCA", titleEn: "Submit Invoice to ZATCA",
          contentAr: "انقر 'إرسال' لإرسال الفاتورة لمنصة فاتورة. ستتلقى رد القبول أو الرفض.", contentEn: "Click 'Submit' to send the invoice to the Fatoorah platform. You will receive an acceptance or rejection response."
        },
        {
          titleAr: "تقارير الضريبة", titleEn: "Tax Reports",
          contentAr: "تقرير شهري يجمع ضريبة القيمة المضافة المحصلة لتقديمها للهيئة.", contentEn: "A monthly report aggregating collected VAT for submission to the authority."
        }
      ]
    },
    {
      id: "employees",
      titleAr: "إدارة الموظفين", titleEn: "Employee Management",
      icon: Users,
      descriptionAr: "إضافة الموظفين وتحديد صلاحياتهم", descriptionEn: "Add employees and define their permissions",
      steps: [
        {
          titleAr: "إضافة موظف جديد", titleEn: "Add New Employee",
          contentAr: "انقر 'إضافة موظف' وأدخل: الاسم، الهاتف، اسم المستخدم، والدور الوظيفي.", contentEn: "Click 'Add Employee' and enter: name, phone, username, and job role."
        },
        {
          titleAr: "الأدوار والصلاحيات", titleEn: "Roles & Permissions",
          contentAr: "اختر الدور المناسب: كاشير (POS فقط)، باريستا (المطبخ)، مدير (كل الصلاحيات)، مالك (الإعدادات).", contentEn: "Choose the appropriate role: Cashier (POS only), Barista (Kitchen), Manager (full access), Owner (settings)."
        },
        {
          titleAr: "تحديد ورديات العمل", titleEn: "Set Work Shifts",
          contentAr: "حدد أيام العمل وأوقات الوردية لكل موظف. يظهر في جدول الحضور.", contentEn: "Set working days and shift times for each employee. This appears in the attendance schedule."
        },
        {
          titleAr: "تتبع الحضور", titleEn: "Track Attendance",
          contentAr: "الموظفون يسجلون حضورهم وانصرافهم. يمكنك مراجعة السجل وتصحيح الأخطاء.", contentEn: "Employees clock in and out. You can review the log and correct errors.",
          tipAr: "فعّل الموقع الجغرافي للتحقق من مكان تسجيل الحضور", tipEn: "Enable geolocation to verify the location of attendance registration"
        }
      ]
    }
  ];

  const faqData = [
    {
      questionAr: "كيف أغير كلمة المرور؟", questionEn: "How do I change my password?",
      answerAr: "اذهب إلى الإعدادات ← الحساب ← تغيير كلمة المرور. أدخل كلمة المرور الحالية ثم الجديدة مرتين.", answerEn: "Go to Settings → Account → Change Password. Enter the current password then the new one twice."
    },
    {
      questionAr: "لماذا لا تظهر الطلبات الجديدة؟", questionEn: "Why don't new orders appear?",
      answerAr: "تأكد من أن الاتصال بالإنترنت يعمل. جرب تحديث الصفحة. إذا استمرت المشكلة، تواصل مع الدعم الفني.", answerEn: "Make sure your internet connection is working. Try refreshing the page. If the problem persists, contact technical support."
    },
    {
      questionAr: "كيف أعدل سعر منتج؟", questionEn: "How do I edit a product price?",
      answerAr: "اذهب إلى إدارة القائمة ← اختر المنتج ← انقر 'تعديل' ← غير السعر ← احفظ.", answerEn: "Go to Menu Management → Select product → Click 'Edit' → Change price → Save."
    },
    {
      questionAr: "كيف أضيف فرعاً جديداً؟", questionEn: "How do I add a new branch?",
      answerAr: "هذه الصلاحية للمالك فقط. اذهب إلى الإعدادات ← الفروع ← إضافة فرع جديد.", answerEn: "This permission is for owners only. Go to Settings → Branches → Add New Branch."
    },
    {
      questionAr: "هل يمكنني استخدام النظام بدون إنترنت؟", questionEn: "Can I use the system without internet?",
      answerAr: "النظام يحتاج اتصالاً بالإنترنت لمزامنة البيانات. في حالة الانقطاع المؤقت، البيانات تُحفظ محلياً وتُزامن عند عودة الاتصال.", answerEn: "The system needs an internet connection to sync data. During temporary outages, data is saved locally and synced when the connection returns."
    },
    {
      questionAr: "كيف أطبع تقريراً للفترة المحددة؟", questionEn: "How do I print a report for a specific period?",
      answerAr: "اختر الفترة من فلتر التاريخ، ثم انقر 'تصدير PDF' أو 'طباعة' من شريط الأدوات.", answerEn: "Choose the period from the date filter, then click 'Export PDF' or 'Print' from the toolbar."
    },
    {
      questionAr: "كيف أفعل الدفع الإلكتروني (مدى، Apple Pay)؟", questionEn: "How do I activate electronic payment (Mada, Apple Pay)?",
      answerAr: "تواصل مع الدعم لربط جهاز الدفع الإلكتروني. بمجرد الربط، ستظهر خيارات الدفع في نقطة البيع.", answerEn: "Contact support to link the electronic payment device. Once linked, payment options will appear in the POS."
    },
    {
      questionAr: "كيف أسترجع طلباً ملغياً؟", questionEn: "How do I restore a cancelled order?",
      answerAr: "الطلبات الملغاة لا يمكن استرجاعها. يجب إنشاء طلب جديد إذا تغير رأي العميل.", answerEn: "Cancelled orders cannot be restored. A new order must be created if the customer changes their mind."
    }
  ];

  const tipsData = [
    {
      titleAr: "استخدم اختصارات لوحة المفاتيح", titleEn: "Use Keyboard Shortcuts",
      contentAr: "اضغط F1 للمساعدة، F2 لطلب جديد، ESC للإلغاء.", contentEn: "Press F1 for help, F2 for a new order, ESC to cancel.",
      icon: Lightbulb
    },
    {
      titleAr: "راجع التقارير أسبوعياً", titleEn: "Review Reports Weekly",
      contentAr: "متابعة الأداء الأسبوعي تساعدك على اكتشاف المشاكل مبكراً.", contentEn: "Weekly performance monitoring helps you detect issues early.",
      icon: TrendingUp
    },
    {
      titleAr: "حدّث المخزون يومياً", titleEn: "Update Inventory Daily",
      contentAr: "الجرد اليومي يمنع الفروقات ويضمن دقة التكاليف.", contentEn: "Daily stocktaking prevents discrepancies and ensures cost accuracy.",
      icon: Package
    },
    {
      titleAr: "درّب الموظفين على النظام", titleEn: "Train Staff on the System",
      contentAr: "موظف متمكن = خدمة أسرع وأخطاء أقل.", contentEn: "A skilled employee = faster service and fewer mistakes.",
      icon: Users
    }
  ];

  export default function UserGuidePage() {
    const [, setLocation] = useLocation();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSection, setActiveSection] = useState("getting-started");
    const tc = useTranslate();

    const filteredSections = guideSections.filter(section =>
      section.titleAr.includes(searchQuery) || section.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.descriptionAr.includes(searchQuery) || section.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.steps.some(step =>
        step.titleAr.includes(searchQuery) || step.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        step.contentAr.includes(searchQuery) || step.contentEn.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    const currentSection = guideSections.find(s => s.id === activeSection);

    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/manager/dashboard")}
              className="text-accent dark:text-accent"
            >
              <ArrowLeft className="w-4 h-4 ml-2" />
              {tc("العودة", "Back")}
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-accent dark:text-accent flex items-center gap-2">
              <BookOpen className="w-8 h-8" />
              {tc("دليل استخدام مكان الشيف البخاري", "مكان الشيف البخاري User Guide")}
            </h1>
            <div className="w-20"></div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder={tc("ابحث في الدليل...", "Search the guide...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-12 text-lg h-12"
            />
          </div>

          <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
            <div className="flex gap-6">
              <div className="w-64 shrink-0 hidden lg:block">
                <Card className="sticky top-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardList className="w-5 h-5" />
                      {tc("الأقسام", "Sections")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="space-y-1">
                      {guideSections.map((section) => {
                        const Icon = section.icon;
                        return (
                          <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-2 p-3 rounded-lg text-right transition-colors ${
                              activeSection === section.id
                                ? 'bg-primary dark:bg-primary/30 text-accent dark:text-accent'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-sm font-medium">{tc(section.titleAr, section.titleEn)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1 space-y-6">
                <TabsList className="grid grid-cols-4 lg:hidden bg-primary dark:bg-primary/30">
                  <TabsTrigger value="getting-started" className="text-xs">{tc("البداية", "Start")}</TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs">{tc("الطلبات", "Orders")}</TabsTrigger>
                  <TabsTrigger value="inventory" className="text-xs">{tc("المخزون", "Inventory")}</TabsTrigger>
                  <TabsTrigger value="accounting" className="text-xs">{tc("المحاسبة", "Accounting")}</TabsTrigger>
                </TabsList>

                {currentSection && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary dark:bg-primary/30 rounded-xl">
                          <currentSection.icon className="w-8 h-8 text-accent" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{tc(currentSection.titleAr, currentSection.titleEn)}</CardTitle>
                          <CardDescription>{tc(currentSection.descriptionAr, currentSection.descriptionEn)}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {currentSection.steps.map((step, index) => (
                          <div key={index} className="relative pr-8 pb-6 border-r-2 border-primary dark:border-primary last:border-0 last:pb-0">
                            <div className="absolute right-0 top-0 -translate-x-1/2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="mr-6">
                              <h4 className="font-medium text-lg mb-2">{tc(step.titleAr, step.titleEn)}</h4>
                              <p className="text-muted-foreground">{tc(step.contentAr, step.contentEn)}</p>
                              {step.tipAr && step.tipEn && (
                                <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <Lightbulb className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                  <p className="text-sm text-blue-700 dark:text-blue-400">{tc(step.tipAr, step.tipEn)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-purple-600" />
                      {tc("الأسئلة الشائعة", "Frequently Asked Questions")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {faqData.map((faq, index) => (
                        <AccordionItem key={index} value={`faq-${index}`}>
                          <AccordionTrigger className="text-right hover:no-underline">
                            <span className="flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-accent" />
                              {tc(faq.questionAr, faq.questionEn)}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground pr-6">
                            {tc(faq.answerAr, faq.answerEn)}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-accent" />
                      {tc("نصائح للاستخدام الأمثل", "Tips for Optimal Use")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tipsData.map((tip, index) => {
                        const Icon = tip.icon;
                        return (
                          <div key={index} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                            <div className="p-2 bg-primary dark:bg-primary/30 rounded-lg">
                              <Icon className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                              <h4 className="font-medium mb-1">{tc(tip.titleAr, tip.titleEn)}</h4>
                              <p className="text-sm text-muted-foreground">{tc(tip.contentAr, tip.contentEn)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-l from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border-primary">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="p-4 bg-card rounded-xl border border-border shadow-sm">
                      <Coffee className="w-10 h-10 text-accent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-accent dark:text-accent">{tc("تحتاج مساعدة إضافية؟", "Need More Help?")}</h3>
                      <p className="text-accent dark:text-accent">{tc("فريق الدعم الفني متاح على مدار الساعة لمساعدتك", "Our technical support team is available 24/7 to assist you")}</p>
                    </div>
                    <Button className="bg-primary hover:bg-primary">
                      {tc("تواصل معنا", "Contact Us")}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }
  