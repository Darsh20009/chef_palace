export type PlanName = 'lite' | 'pro' | 'infinity';

export interface FeatureFlag {
  key: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  category: string;
  categoryAr: string;
  icon: string;
  plan: PlanName;
}

export const PLAN_INFO: Record<PlanName, {
  nameAr: string;
  nameEn: string;
  color: string;
  badge: string;
  priceAr: string;
  priceEn: string;
  icon: string;
  nextPlan?: PlanName;
}> = {
  lite: {
    nameAr: 'لايت',
    nameEn: 'Lite',
    color: '#6b7280',
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
    priceAr: '٤٩٩ ريال / شهر',
    priceEn: '499 SAR / mo',
    icon: '⚡',
    nextPlan: 'pro',
  },
  pro: {
    nameAr: 'برو',
    nameEn: 'Pro',
    color: '#2D9B6E',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    priceAr: '١٤٩٩ ريال / شهر',
    priceEn: '1,499 SAR / mo',
    icon: '🚀',
    nextPlan: 'infinity',
  },
  infinity: {
    nameAr: 'إنفينيتي',
    nameEn: 'Infinity',
    color: '#8b5cf6',
    badge: 'bg-purple-100 text-purple-700 border-purple-300',
    priceAr: '٣٩٩٩ ريال / شهر',
    priceEn: '3,999 SAR / mo',
    icon: '♾️',
  },
};

export const ALL_FEATURES: FeatureFlag[] = [
  {
    key: 'posSystem',
    nameAr: 'نظام نقاط البيع (POS)',
    nameEn: 'POS System',
    descAr: 'شاشة الكاشير الاحترافية مع إدارة الطلبات والمدفوعات',
    descEn: 'Professional cashier screen with order & payment management',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '🖥️',
    plan: 'lite',
  },
  {
    key: 'kitchenDisplay',
    nameAr: 'شاشة المطبخ (KDS)',
    nameEn: 'Kitchen Display System',
    descAr: 'شاشة المطبخ الرقمية لتتبع الطلبات مباشرة',
    descEn: 'Digital kitchen screen for real-time order tracking',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '👨‍🍳',
    plan: 'lite',
  },
  {
    key: 'customerApp',
    nameAr: 'تطبيق العميل',
    nameEn: 'Customer App',
    descAr: 'واجهة العميل لعرض المنيو والطلب وتتبع الحالة',
    descEn: 'Customer interface for menu browsing, ordering & tracking',
    category: 'Customer',
    categoryAr: 'العملاء',
    icon: '📱',
    plan: 'lite',
  },
  {
    key: 'menuManagement',
    nameAr: 'إدارة المنيو',
    nameEn: 'Menu Management',
    descAr: 'إضافة وتعديل المنتجات والفئات والأسعار',
    descEn: 'Add, edit products, categories and prices',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '📋',
    plan: 'lite',
  },
  {
    key: 'orderManagement',
    nameAr: 'إدارة الطلبات',
    nameEn: 'Order Management',
    descAr: 'متابعة وإدارة جميع طلبات العملاء',
    descEn: 'Track and manage all customer orders',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '📦',
    plan: 'lite',
  },
  {
    key: 'employeeManagement',
    nameAr: 'إدارة الموظفين',
    nameEn: 'Employee Management',
    descAr: 'إدارة حسابات الموظفين والأدوار والصلاحيات',
    descEn: 'Manage employee accounts, roles and permissions',
    category: 'HR',
    categoryAr: 'الموارد البشرية',
    icon: '👥',
    plan: 'lite',
  },
  {
    key: 'basicReports',
    nameAr: 'التقارير الأساسية',
    nameEn: 'Basic Reports',
    descAr: 'تقارير المبيعات والإيرادات اليومية والأسبوعية',
    descEn: 'Daily & weekly sales and revenue reports',
    category: 'Analytics',
    categoryAr: 'التحليلات',
    icon: '📊',
    plan: 'lite',
  },
  {
    key: 'tableManagement',
    nameAr: 'إدارة الطاولات',
    nameEn: 'Table Management',
    descAr: 'إدارة الطاولات وطلبات الجلوس وQR لكل طاولة',
    descEn: 'Table management, seating orders & QR per table',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '🪑',
    plan: 'pro',
  },
  {
    key: 'inventoryManagement',
    nameAr: 'إدارة المخزون',
    nameEn: 'Inventory Management',
    descAr: 'تتبع المواد الخام والمخزون والتنبيهات التلقائية',
    descEn: 'Track raw materials, stock levels & auto alerts',
    category: 'Inventory',
    categoryAr: 'المخزون',
    icon: '📦',
    plan: 'pro',
  },
  {
    key: 'recipeManagement',
    nameAr: 'إدارة الوصفات',
    nameEn: 'Recipe Management',
    descAr: 'ربط الوصفات بالمواد الخام وتكلفة الإنتاج',
    descEn: 'Link recipes to raw materials & production cost',
    category: 'Inventory',
    categoryAr: 'المخزون',
    icon: '🧪',
    plan: 'pro',
  },
  {
    key: 'supplierManagement',
    nameAr: 'إدارة الموردين',
    nameEn: 'Supplier Management',
    descAr: 'إدارة الموردين وأوامر الشراء والفواتير',
    descEn: 'Manage suppliers, purchase orders & invoices',
    category: 'Inventory',
    categoryAr: 'المخزون',
    icon: '🏭',
    plan: 'pro',
  },
  {
    key: 'loyaltyProgram',
    nameAr: 'برنامج الولاء',
    nameEn: 'Loyalty Program',
    descAr: 'نقاط الولاء والمستويات والمشروب المجاني',
    descEn: 'Loyalty points, tiers & free drink rewards',
    category: 'Customer',
    categoryAr: 'العملاء',
    icon: '⭐',
    plan: 'pro',
  },
  {
    key: 'giftCards',
    nameAr: 'بطاقات الهدايا',
    nameEn: 'Gift Cards',
    descAr: 'إصدار وإدارة بطاقات الهدايا الرقمية والمادية',
    descEn: 'Issue and manage digital & physical gift cards',
    category: 'Customer',
    categoryAr: 'العملاء',
    icon: '🎁',
    plan: 'pro',
  },
  {
    key: 'deliveryManagement',
    nameAr: 'إدارة التوصيل',
    nameEn: 'Delivery Management',
    descAr: 'إدارة السائقين والمناطق وتتبع التوصيل',
    descEn: 'Manage drivers, zones & real-time delivery tracking',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '🛵',
    plan: 'pro',
  },
  {
    key: 'payrollManagement',
    nameAr: 'إدارة الرواتب',
    nameEn: 'Payroll Management',
    descAr: 'حساب الرواتب والحضور والغيابات والمكافآت',
    descEn: 'Calculate salaries, attendance, leaves & bonuses',
    category: 'HR',
    categoryAr: 'الموارد البشرية',
    icon: '💰',
    plan: 'pro',
  },
  {
    key: 'accountingModule',
    nameAr: 'المحاسبة والحسابات',
    nameEn: 'Accounting Module',
    descAr: 'لوحة المحاسبة الكاملة مع المصروفات والإيرادات',
    descEn: 'Full accounting dashboard with expenses & revenue',
    category: 'Finance',
    categoryAr: 'المالية',
    icon: '📒',
    plan: 'pro',
  },
  {
    key: 'zatcaCompliance',
    nameAr: 'توافق زاتكا (فاتورة)',
    nameEn: 'ZATCA Compliance',
    descAr: 'إصدار الفواتير الإلكترونية المتوافقة مع هيئة الزكاة',
    descEn: 'Issue e-invoices compliant with ZATCA requirements',
    category: 'Finance',
    categoryAr: 'المالية',
    icon: '🧾',
    plan: 'pro',
  },
  {
    key: 'advancedAnalytics',
    nameAr: 'التحليلات المتقدمة',
    nameEn: 'Advanced Analytics',
    descAr: 'تحليلات عميقة للمبيعات والموظفين والعملاء',
    descEn: 'Deep analytics for sales, staff & customer insights',
    category: 'Analytics',
    categoryAr: 'التحليلات',
    icon: '📈',
    plan: 'pro',
  },
  {
    key: 'customBranding',
    nameAr: 'الهوية البصرية المخصصة',
    nameEn: 'Custom Branding',
    descAr: 'تخصيص الألوان والشعار والهوية البصرية الكاملة',
    descEn: 'Customize colors, logo & complete visual identity',
    category: 'Branding',
    categoryAr: 'الهوية',
    icon: '🎨',
    plan: 'pro',
  },
  {
    key: 'reservations',
    nameAr: 'الحجوزات المسبقة',
    nameEn: 'Table Reservations',
    descAr: 'نظام حجز الطاولات مسبقاً عبر التطبيق',
    descEn: 'Advance table booking system via customer app',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '📅',
    plan: 'pro',
  },
  {
    key: 'promotionsManagement',
    nameAr: 'إدارة العروض والخصومات',
    nameEn: 'Promotions & Discounts',
    descAr: 'إنشاء وإدارة رموز الخصم والعروض الترويجية',
    descEn: 'Create & manage discount codes & promotional offers',
    category: 'Customer',
    categoryAr: 'العملاء',
    icon: '🏷️',
    plan: 'pro',
  },
  {
    key: 'multiBranch',
    nameAr: 'إدارة الفروع المتعددة',
    nameEn: 'Multi-Branch Management',
    descAr: 'إدارة حتى 5 فروع من لوحة تحكم واحدة',
    descEn: 'Manage up to 5 branches from a single dashboard',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '🏢',
    plan: 'pro',
  },
  {
    key: 'warehouseManagement',
    nameAr: 'إدارة المستودعات',
    nameEn: 'Warehouse Management',
    descAr: 'إدارة مستودعات متعددة والتحويل بين الفروع',
    descEn: 'Manage multiple warehouses & inter-branch transfers',
    category: 'Inventory',
    categoryAr: 'المخزون',
    icon: '🏭',
    plan: 'infinity',
  },
  {
    key: 'erpIntegration',
    nameAr: 'محاسبة ERP',
    nameEn: 'ERP Accounting',
    descAr: 'نظام ERP متكامل مع محاسبة ودفاتر قيود',
    descEn: 'Full ERP system with journal entries & accounting',
    category: 'Finance',
    categoryAr: 'المالية',
    icon: '🏦',
    plan: 'infinity',
  },
  {
    key: 'b2bMarketplace',
    nameAr: 'سوق الموردين B2B',
    nameEn: 'B2B Supplier Marketplace',
    descAr: 'ربط مباشر مع الموردين والمصانع وطلبات الجملة',
    descEn: 'Direct connection with suppliers & wholesale ordering',
    category: 'Inventory',
    categoryAr: 'المخزون',
    icon: '🛒',
    plan: 'infinity',
  },
  {
    key: 'partnerProgram',
    nameAr: 'برنامج الشركاء والموزعين',
    nameEn: 'Partner & Reseller Program',
    descAr: 'برنامج الإحالة والعمولات لشركاء الأعمال',
    descEn: 'Referral commissions & business partner program',
    category: 'Business',
    categoryAr: 'الأعمال',
    icon: '🤝',
    plan: 'infinity',
  },
  {
    key: 'apiAccess',
    nameAr: 'إدارة API',
    nameEn: 'API Management',
    descAr: 'وصول كامل لـ API مع مفاتيح مخصصة للتكاملات',
    descEn: 'Full API access with custom keys for integrations',
    category: 'Developer',
    categoryAr: 'المطورين',
    icon: '⚙️',
    plan: 'infinity',
  },
  {
    key: 'hardwareSupport',
    nameAr: 'دعم الأجهزة (طابعات / بصمة)',
    nameEn: 'Hardware Support',
    descAr: 'طابعات ESC/POS ودرج النقود ومستشعر البصمة',
    descEn: 'ESC/POS printers, cash drawer & fingerprint sensor',
    category: 'Hardware',
    categoryAr: 'الأجهزة',
    icon: '🖨️',
    plan: 'infinity',
  },
  {
    key: 'biAnalytics',
    nameAr: 'تحليلات ذكاء الأعمال (BI)',
    nameEn: 'Business Intelligence Analytics',
    descAr: 'لوحات تحكم تحليلية متقدمة ومقارنة الفروع',
    descEn: 'Advanced dashboards & cross-branch comparison',
    category: 'Analytics',
    categoryAr: 'التحليلات',
    icon: '🔭',
    plan: 'infinity',
  },
  {
    key: 'offlineMode',
    nameAr: 'وضع عدم الاتصال (Offline)',
    nameEn: 'Full Offline Mode',
    descAr: 'استمرار العمل بدون إنترنت مع مزامنة تلقائية',
    descEn: 'Continue working without internet & auto-sync',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '📡',
    plan: 'infinity',
  },
  {
    key: 'unlimitedBranches',
    nameAr: 'فروع وموظفون غير محدودون',
    nameEn: 'Unlimited Branches & Employees',
    descAr: 'توسع بلا حدود - فروع وموظفون غير محدودون',
    descEn: 'Scale without limits - unlimited branches & staff',
    category: 'Operations',
    categoryAr: 'العمليات',
    icon: '♾️',
    plan: 'infinity',
  },
  {
    key: 'whiteLabel',
    nameAr: 'النظام بعلامتك التجارية',
    nameEn: 'White-Label Solution',
    descAr: 'إطلاق النظام بالكامل باسمك وشعارك الخاص',
    descEn: 'Launch the full system under your own brand',
    category: 'Branding',
    categoryAr: 'الهوية',
    icon: '🏷️',
    plan: 'infinity',
  },
  {
    key: 'dedicatedSupport',
    nameAr: 'دعم مخصص على مدار الساعة',
    nameEn: 'Dedicated 24/7 Support',
    descAr: 'مدير حساب مخصص ودعم فني على مدار الساعة',
    descEn: 'Dedicated account manager & 24/7 technical support',
    category: 'Support',
    categoryAr: 'الدعم',
    icon: '🎯',
    plan: 'infinity',
  },
];

const PLAN_ORDER: Record<PlanName, number> = { lite: 1, pro: 2, infinity: 3 };

export function isFeatureInPlan(featureMinPlan: PlanName, currentPlan: PlanName): boolean {
  return PLAN_ORDER[currentPlan] >= PLAN_ORDER[featureMinPlan];
}

export function getFeaturesByPlan(plan: PlanName): FeatureFlag[] {
  return ALL_FEATURES.filter(f => isFeatureInPlan(f.plan, plan));
}

export function getLockedFeatures(plan: PlanName): FeatureFlag[] {
  return ALL_FEATURES.filter(f => !isFeatureInPlan(f.plan, plan));
}

export function getFeatureByKey(key: string): FeatureFlag | undefined {
  return ALL_FEATURES.find(f => f.key === key);
}

export type FeatureKey =
  | 'posSystem' | 'kitchenDisplay' | 'customerApp' | 'menuManagement'
  | 'orderManagement' | 'employeeManagement' | 'basicReports'
  | 'tableManagement' | 'inventoryManagement' | 'recipeManagement'
  | 'supplierManagement' | 'loyaltyProgram' | 'giftCards'
  | 'deliveryManagement' | 'payrollManagement' | 'accountingModule'
  | 'zatcaCompliance' | 'advancedAnalytics' | 'customBranding'
  | 'reservations' | 'promotionsManagement' | 'multiBranch'
  | 'warehouseManagement' | 'erpIntegration' | 'b2bMarketplace'
  | 'partnerProgram' | 'apiAccess' | 'hardwareSupport' | 'biAnalytics'
  | 'offlineMode' | 'unlimitedBranches' | 'whiteLabel' | 'dedicatedSupport';
