import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: string;
  nameAr: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable: number;
  tenantId: string;
  availableSizes?: Array<{ nameAr: string; nameEn?: string; price: number; sizeML?: number; sku?: string; imageUrl?: string }>;
  updatedAt: number;
}

export interface LocalInvoice {
  id?: string;
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
  type: 'CREATE_ORDER' | 'UPDATE_STOCK';
  payload: any;
  status: 'pending' | 'processing' | 'failed';
  retryCount: number;
  createdAt: number;
}

export class QahwaDatabase extends Dexie {
  products!: Table<LocalProduct>;
  invoices!: Table<LocalInvoice>;
  syncQueue!: Table<SyncItem>;

  constructor() {
    super('مكان الشيف البخاريDB');
    this.version(1).stores({
      products: 'id, nameAr, category, tenantId, updatedAt',
      invoices: '++id, tempId, status, tenantId, branchId, createdAt',
      syncQueue: '++id, type, status, createdAt'
    });
  }
}

export const db = new QahwaDatabase();
