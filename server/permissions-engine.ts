export type Role = 'cashier' | 'barista' | 'supervisor' | 'branch_manager' | 'owner' | 'admin' | 'cleaner' | 'accountant' | 'driver';

export type Permission = 
  | 'order.create'
  | 'order.view'
  | 'order.void'
  | 'order.refund'
  | 'order.apply_discount'
  | 'order.modify'
  | 'kitchen.view_queue'
  | 'kitchen.update_status'
  | 'inventory.view'
  | 'inventory.stock_in'
  | 'inventory.stock_out'
  | 'inventory.waste'
  | 'inventory.adjustment'
  | 'menu.view'
  | 'menu.create'
  | 'menu.edit'
  | 'menu.delete'
  | 'recipe.view'
  | 'recipe.create'
  | 'recipe.edit'
  | 'reports.daily'
  | 'reports.branch'
  | 'reports.all_branches'
  | 'reports.export'
  | 'employees.view'
  | 'employees.create'
  | 'employees.edit'
  | 'employees.delete'
  | 'settings.branch'
  | 'settings.cafe'
  | 'settings.billing'
  | 'shift.open'
  | 'shift.close'
  | 'shift.view_history'
  | 'shift.cash_movement'
  | 'pos.open_drawer'
  | 'pos.apply_coupon'
  | 'delivery.manage'
  | 'tables.manage'
  | 'accounting.view'
  | 'accounting.export';

export type PageId = 
  | 'dashboard'
  | 'cashier'
  | 'pos'
  | 'shifts'
  | 'orders'
  | 'kitchen'
  | 'tables'
  | 'menu_management'
  | 'inventory'
  | 'reports'
  | 'accounting'
  | 'employees'
  | 'settings'
  | 'delivery'
  | 'unified_reports'
  | 'bi_analytics';

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  cleaner: [],

  driver: [
    'order.view',
    'delivery.manage',
  ],

  accountant: [
    'order.view',
    'reports.daily',
    'reports.branch',
    'reports.export',
    'accounting.view',
    'accounting.export',
    'inventory.view',
  ],

  cashier: [
    'order.create',
    'order.view',
    'order.apply_discount',
    'menu.view',
    'kitchen.view_queue',
    'shift.open',
    'shift.close',
    'shift.view_history',
    'pos.apply_coupon',
  ],
  
  barista: [
    'order.view',
    'kitchen.view_queue',
    'kitchen.update_status',
    'menu.view',
    'recipe.view',
    'shift.open',
    'shift.close',
  ],
  
  supervisor: [
    'order.create',
    'order.view',
    'order.void',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'menu.view',
    'inventory.view',
    'inventory.waste',
    'recipe.view',
    'reports.daily',
    'employees.view',
    'shift.open',
    'shift.close',
    'shift.view_history',
    'shift.cash_movement',
    'pos.open_drawer',
    'pos.apply_coupon',
    'tables.manage',
  ],
  
  branch_manager: [
    'order.create',
    'order.view',
    'order.void',
    'order.refund',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'inventory.view',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.waste',
    'inventory.adjustment',
    'menu.view',
    'menu.create',
    'menu.edit',
    'recipe.view',
    'recipe.create',
    'recipe.edit',
    'reports.daily',
    'reports.branch',
    'reports.export',
    'employees.view',
    'employees.create',
    'employees.edit',
    'settings.branch',
    'shift.open',
    'shift.close',
    'shift.view_history',
    'shift.cash_movement',
    'pos.open_drawer',
    'pos.apply_coupon',
    'tables.manage',
    'delivery.manage',
    'accounting.view',
    'accounting.export',
  ],
  
  owner: [
    'order.create',
    'order.view',
    'order.void',
    'order.refund',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'inventory.view',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.waste',
    'inventory.adjustment',
    'menu.view',
    'menu.create',
    'menu.edit',
    'menu.delete',
    'recipe.view',
    'recipe.create',
    'recipe.edit',
    'reports.daily',
    'reports.branch',
    'reports.all_branches',
    'reports.export',
    'employees.view',
    'employees.create',
    'employees.edit',
    'employees.delete',
    'settings.branch',
    'settings.cafe',
    'settings.billing',
    'shift.open',
    'shift.close',
    'shift.view_history',
    'shift.cash_movement',
    'pos.open_drawer',
    'pos.apply_coupon',
    'tables.manage',
    'delivery.manage',
    'accounting.view',
    'accounting.export',
  ],
  
  admin: [
    'order.create',
    'order.view',
    'order.void',
    'order.refund',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'inventory.view',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.waste',
    'inventory.adjustment',
    'menu.view',
    'menu.create',
    'menu.edit',
    'menu.delete',
    'recipe.view',
    'recipe.create',
    'recipe.edit',
    'reports.daily',
    'reports.branch',
    'reports.all_branches',
    'reports.export',
    'employees.view',
    'employees.create',
    'employees.edit',
    'employees.delete',
    'settings.branch',
    'settings.cafe',
    'settings.billing',
    'shift.open',
    'shift.close',
    'shift.view_history',
    'shift.cash_movement',
    'pos.open_drawer',
    'pos.apply_coupon',
    'tables.manage',
    'delivery.manage',
    'accounting.view',
    'accounting.export',
  ],
};

const PAGE_PERMISSIONS: Record<PageId, Permission[]> = {
  dashboard: ['order.view'],
  cashier: ['order.create'],
  pos: ['order.create'],
  shifts: ['shift.open'],
  orders: ['order.view'],
  kitchen: ['kitchen.view_queue'],
  tables: ['tables.manage'],
  menu_management: ['menu.view'],
  inventory: ['inventory.view'],
  reports: ['reports.daily'],
  accounting: ['accounting.view'],
  employees: ['employees.view'],
  settings: ['settings.branch'],
  delivery: ['delivery.manage'],
  unified_reports: ['reports.daily'],
  bi_analytics: ['reports.daily'],
};

const DEFAULT_PAGES: Record<Role, PageId[]> = {
  cleaner: ['dashboard'],
  driver: ['dashboard', 'orders', 'delivery'],
  accountant: ['dashboard', 'orders', 'reports', 'accounting', 'inventory'],
  cashier: ['dashboard', 'cashier', 'pos', 'shifts', 'orders'],
  barista: ['dashboard', 'orders', 'kitchen', 'shifts'],
  supervisor: ['dashboard', 'cashier', 'pos', 'shifts', 'orders', 'kitchen', 'tables', 'menu_management', 'reports'],
  branch_manager: ['dashboard', 'cashier', 'pos', 'shifts', 'orders', 'kitchen', 'tables', 'menu_management', 'inventory', 'reports', 'accounting', 'employees', 'settings', 'delivery', 'unified_reports', 'bi_analytics'],
  owner: ['dashboard', 'cashier', 'pos', 'shifts', 'orders', 'kitchen', 'tables', 'menu_management', 'inventory', 'reports', 'accounting', 'employees', 'settings', 'delivery', 'unified_reports', 'bi_analytics'],
  admin: ['dashboard', 'cashier', 'pos', 'shifts', 'orders', 'kitchen', 'tables', 'menu_management', 'inventory', 'reports', 'accounting', 'employees', 'settings', 'delivery', 'unified_reports', 'bi_analytics'],
};

const ROLE_HIERARCHY: Record<Role, number> = {
  cleaner: 0,
  driver: 1,
  accountant: 1,
  cashier: 1,
  barista: 1,
  supervisor: 2,
  branch_manager: 3,
  owner: 5,
  admin: 5,
};

const ROLE_NAMES_AR: Record<Role, string> = {
  cleaner: 'عامل نظافة',
  driver: 'سائق توصيل',
  accountant: 'محاسب',
  cashier: 'كاشير',
  barista: 'باريستا',
  supervisor: 'مشرف',
  branch_manager: 'مدير فرع',
  owner: 'مالك',
  admin: 'مدير النظام',
};

export class PermissionsEngine {
  static hasPermission(role: string, permission: Permission, employeePermissions?: string[]): boolean {
    if (employeePermissions && employeePermissions.length > 0) {
      if (employeePermissions.includes(permission)) return true;
    }
    const normalizedRole = this.normalizeRole(role);
    const permissions = PERMISSION_MATRIX[normalizedRole];
    return permissions?.includes(permission) || false;
  }

  static getPermissions(role: string): Permission[] {
    const normalizedRole = this.normalizeRole(role);
    return PERMISSION_MATRIX[normalizedRole] || [];
  }

  static getEffectivePermissions(role: string, employeePermissions?: string[]): Permission[] {
    const rolePerms = this.getPermissions(role);
    if (!employeePermissions || employeePermissions.length === 0) return rolePerms;
    const allPerms = new Set<Permission>([...rolePerms]);
    for (const p of employeePermissions) {
      allPerms.add(p as Permission);
    }
    return Array.from(allPerms);
  }

  static canAccessPage(role: string, pageId: string, employeeAllowedPages?: string[], employeePermissions?: string[]): boolean {
    const normalizedRole = this.normalizeRole(role);
    if (normalizedRole === 'owner' || normalizedRole === 'admin') return true;

    if (employeeAllowedPages && employeeAllowedPages.length > 0) {
      return employeeAllowedPages.includes(pageId);
    }

    const defaultPages = DEFAULT_PAGES[normalizedRole] || [];
    return defaultPages.includes(pageId as PageId);
  }

  static getAccessiblePages(role: string, employeeAllowedPages?: string[]): PageId[] {
    const normalizedRole = this.normalizeRole(role);
    if (normalizedRole === 'owner' || normalizedRole === 'admin') {
      return Object.keys(PAGE_PERMISSIONS) as PageId[];
    }

    if (employeeAllowedPages && employeeAllowedPages.length > 0) {
      return employeeAllowedPages as PageId[];
    }

    return DEFAULT_PAGES[normalizedRole] || [];
  }

  static getDefaultPagesForRole(role: string): PageId[] {
    const normalizedRole = this.normalizeRole(role);
    return DEFAULT_PAGES[normalizedRole] || [];
  }

  static canAccessBranch(role: string, employeeBranchId: string | undefined, targetBranchId: string): boolean {
    const normalizedRole = this.normalizeRole(role);
    if (normalizedRole === 'owner' || normalizedRole === 'admin') {
      return true;
    }
    return employeeBranchId === targetBranchId;
  }

  static getRoleLevel(role: string): number {
    const normalizedRole = this.normalizeRole(role);
    return ROLE_HIERARCHY[normalizedRole] || 0;
  }

  static isHigherRole(role1: string, role2: string): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }

  static canManageRole(managerRole: string, targetRole: string): boolean {
    return this.getRoleLevel(managerRole) > this.getRoleLevel(targetRole);
  }

  static getRoleNameAr(role: string): string {
    const normalizedRole = this.normalizeRole(role);
    return ROLE_NAMES_AR[normalizedRole] || role;
  }

  static getAllRoles(): { id: Role; nameAr: string; level: number }[] {
    return Object.entries(ROLE_HIERARCHY).map(([role, level]) => ({
      id: role as Role,
      nameAr: ROLE_NAMES_AR[role as Role],
      level,
    }));
  }

  static getAvailableRolesForManager(managerRole: string): Role[] {
    const managerLevel = this.getRoleLevel(managerRole);
    return Object.entries(ROLE_HIERARCHY)
      .filter(([_, level]) => level < managerLevel)
      .map(([role]) => role as Role);
  }

  static getAllPermissionsList(): { id: Permission; nameAr: string; category: string }[] {
    return [
      { id: 'order.create', nameAr: 'إنشاء طلب', category: 'الطلبات' },
      { id: 'order.view', nameAr: 'عرض الطلبات', category: 'الطلبات' },
      { id: 'order.void', nameAr: 'إلغاء طلب', category: 'الطلبات' },
      { id: 'order.refund', nameAr: 'استرجاع طلب', category: 'الطلبات' },
      { id: 'order.apply_discount', nameAr: 'تطبيق خصم', category: 'الطلبات' },
      { id: 'order.modify', nameAr: 'تعديل طلب', category: 'الطلبات' },
      { id: 'kitchen.view_queue', nameAr: 'عرض طابور المطبخ', category: 'المطبخ' },
      { id: 'kitchen.update_status', nameAr: 'تحديث حالة الطلب', category: 'المطبخ' },
      { id: 'inventory.view', nameAr: 'عرض المخزون', category: 'المخزون' },
      { id: 'inventory.stock_in', nameAr: 'إدخال مخزون', category: 'المخزون' },
      { id: 'inventory.stock_out', nameAr: 'إخراج مخزون', category: 'المخزون' },
      { id: 'inventory.waste', nameAr: 'تسجيل هدر', category: 'المخزون' },
      { id: 'inventory.adjustment', nameAr: 'تعديل مخزون', category: 'المخزون' },
      { id: 'menu.view', nameAr: 'عرض القائمة', category: 'القائمة' },
      { id: 'menu.create', nameAr: 'إضافة صنف', category: 'القائمة' },
      { id: 'menu.edit', nameAr: 'تعديل صنف', category: 'القائمة' },
      { id: 'menu.delete', nameAr: 'حذف صنف', category: 'القائمة' },
      { id: 'recipe.view', nameAr: 'عرض الوصفات', category: 'القائمة' },
      { id: 'recipe.create', nameAr: 'إنشاء وصفة', category: 'القائمة' },
      { id: 'recipe.edit', nameAr: 'تعديل وصفة', category: 'القائمة' },
      { id: 'reports.daily', nameAr: 'تقرير يومي', category: 'التقارير' },
      { id: 'reports.branch', nameAr: 'تقرير الفرع', category: 'التقارير' },
      { id: 'reports.all_branches', nameAr: 'تقارير كل الفروع', category: 'التقارير' },
      { id: 'reports.export', nameAr: 'تصدير التقارير', category: 'التقارير' },
      { id: 'employees.view', nameAr: 'عرض الموظفين', category: 'الموظفين' },
      { id: 'employees.create', nameAr: 'إضافة موظف', category: 'الموظفين' },
      { id: 'employees.edit', nameAr: 'تعديل موظف', category: 'الموظفين' },
      { id: 'employees.delete', nameAr: 'حذف موظف', category: 'الموظفين' },
      { id: 'settings.branch', nameAr: 'إعدادات الفرع', category: 'الإعدادات' },
      { id: 'settings.cafe', nameAr: 'إعدادات المقهى', category: 'الإعدادات' },
      { id: 'settings.billing', nameAr: 'إعدادات الفوترة', category: 'الإعدادات' },
      { id: 'shift.open', nameAr: 'فتح وردية', category: 'الورديات' },
      { id: 'shift.close', nameAr: 'إغلاق وردية', category: 'الورديات' },
      { id: 'shift.view_history', nameAr: 'سجل الورديات', category: 'الورديات' },
      { id: 'shift.cash_movement', nameAr: 'حركة نقدية', category: 'الورديات' },
      { id: 'pos.open_drawer', nameAr: 'فتح درج النقود', category: 'نقاط البيع' },
      { id: 'pos.apply_coupon', nameAr: 'تطبيق كوبون', category: 'نقاط البيع' },
      { id: 'delivery.manage', nameAr: 'إدارة التوصيل', category: 'التوصيل' },
      { id: 'tables.manage', nameAr: 'إدارة الطاولات', category: 'الطاولات' },
      { id: 'accounting.view', nameAr: 'عرض المحاسبة', category: 'المحاسبة' },
      { id: 'accounting.export', nameAr: 'تصدير المحاسبة', category: 'المحاسبة' },
    ];
  }

  static getAllPagesList(): { id: PageId; nameAr: string }[] {
    return [
      { id: 'dashboard', nameAr: 'لوحة التحكم' },
      { id: 'cashier', nameAr: 'الكاشير' },
      { id: 'pos', nameAr: 'نقاط البيع' },
      { id: 'shifts', nameAr: 'الورديات' },
      { id: 'orders', nameAr: 'الطلبات' },
      { id: 'kitchen', nameAr: 'المطبخ' },
      { id: 'tables', nameAr: 'الطاولات' },
      { id: 'menu_management', nameAr: 'إدارة القائمة' },
      { id: 'inventory', nameAr: 'المخزون' },
      { id: 'reports', nameAr: 'التقارير' },
      { id: 'accounting', nameAr: 'المحاسبة' },
      { id: 'employees', nameAr: 'إدارة الموظفين' },
      { id: 'settings', nameAr: 'الإعدادات' },
      { id: 'delivery', nameAr: 'التوصيل' },
    ];
  }

  private static normalizeRole(role: string): Role {
    const roleMap: Record<string, Role> = {
      'cleaner': 'cleaner',
      'driver': 'driver',
      'accountant': 'accountant',
      'cashier': 'cashier',
      'barista': 'barista',
      'cook': 'barista',
      'waiter': 'cashier',
      'supervisor': 'supervisor',
      'manager': 'branch_manager',
      'branch_manager': 'branch_manager',
      'owner': 'owner',
      'admin': 'admin',
    };
    return roleMap[role.toLowerCase()] || 'cashier';
  }
}

export const PERMISSIONS = {
  ORDER_CREATE: 'order.create' as Permission,
  ORDER_VIEW: 'order.view' as Permission,
  ORDER_VOID: 'order.void' as Permission,
  ORDER_REFUND: 'order.refund' as Permission,
  ORDER_APPLY_DISCOUNT: 'order.apply_discount' as Permission,
  KITCHEN_VIEW_QUEUE: 'kitchen.view_queue' as Permission,
  KITCHEN_UPDATE_STATUS: 'kitchen.update_status' as Permission,
  INVENTORY_VIEW: 'inventory.view' as Permission,
  INVENTORY_STOCK_IN: 'inventory.stock_in' as Permission,
  REPORTS_DAILY: 'reports.daily' as Permission,
  REPORTS_BRANCH: 'reports.branch' as Permission,
  REPORTS_ALL: 'reports.all_branches' as Permission,
  REPORTS_EXPORT: 'reports.export' as Permission,
  EMPLOYEES_VIEW: 'employees.view' as Permission,
  EMPLOYEES_CREATE: 'employees.create' as Permission,
  SETTINGS_BRANCH: 'settings.branch' as Permission,
  SETTINGS_CAFE: 'settings.cafe' as Permission,
  SHIFT_OPEN: 'shift.open' as Permission,
  SHIFT_CLOSE: 'shift.close' as Permission,
  POS_OPEN_DRAWER: 'pos.open_drawer' as Permission,
  DELIVERY_MANAGE: 'delivery.manage' as Permission,
  TABLES_MANAGE: 'tables.manage' as Permission,
  ACCOUNTING_VIEW: 'accounting.view' as Permission,
};
