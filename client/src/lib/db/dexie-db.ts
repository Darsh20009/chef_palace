import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: string;
  nameAr: string;
  nameEn?: string;
  price: number;
  category: string;
  categoryId?: string;
  imageUrl?: string;
  isAvailable: number;
  tenantId: string;
  availableSizes?: Array<{ nameAr: string; nameEn?: string; price: number; sizeML?: number; sku?: string; imageUrl?: string }>;
  addons?: any[];
  updatedAt: number;
}

export interface LocalInvoice {
  id?: number;
  tempId: string;
  items: any;
  totalAmount: number;
  paymentMethod: string;
  createdAt: number;
  status: 'pending' | 'synced';
  tenantId: string;
  branchId: string;
}

export interface SyncItem {
  id?: number;
  type: 'CREATE_ORDER' | 'UPDATE_STOCK' | 'CONFIG_SNAPSHOT' | 'CACHE_UPDATE';
  payload: any;
  status: 'pending' | 'processing' | 'failed' | 'done';
  retryCount: number;
  createdAt: number;
  updatedAt?: number;
}

export interface LocalTable {
  id: string;
  tableNumber: string;
  status: 'available' | 'occupied' | 'reserved' | 'inactive';
  branchId: string;
  tenantId: string;
  currentOrderId?: string;
  updatedAt: number;
}

export interface LocalConfig {
  id: string;
  tenantId: string;
  data: any;
  cachedAt: number;
}

export interface LocalEmployee {
  id: string;
  name: string;
  nameEn?: string;
  role: string;
  branchId?: string;
  tenantId: string;
  updatedAt: number;
}

export class QahwaDatabase extends Dexie {
  products!: Table<LocalProduct>;
  invoices!: Table<LocalInvoice>;
  syncQueue!: Table<SyncItem>;
  cafeTables!: Table<LocalTable>;
  configs!: Table<LocalConfig>;
  employees!: Table<LocalEmployee>;

  constructor() {
    super('QIROX_LOCAL_DB');
    this.version(3).stores({
      products:    'id, nameAr, category, categoryId, tenantId, isAvailable, updatedAt',
      invoices:    '++id, tempId, status, tenantId, branchId, createdAt',
      syncQueue:  '++id, type, status, createdAt, updatedAt',
      tables:     'id, tableNumber, status, branchId, tenantId, updatedAt',
      configs:    'id, tenantId, cachedAt',
      employees:  'id, role, branchId, tenantId, updatedAt',
    });
    this.version(4).stores({
      products:    'id, nameAr, category, categoryId, tenantId, isAvailable, updatedAt',
      invoices:    '++id, tempId, status, tenantId, branchId, createdAt',
      syncQueue:   '++id, type, status, createdAt, updatedAt',
      cafeTables:  'id, tableNumber, status, branchId, tenantId, updatedAt',
      configs:     'id, tenantId, cachedAt',
      employees:   'id, role, branchId, tenantId, updatedAt',
      tables:      null,
    });
  }
}

export const db = new QahwaDatabase();
