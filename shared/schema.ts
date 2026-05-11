import mongoose, { Schema, Document, Model } from "mongoose";
import { z } from "zod";

export interface ICoffeeItem extends Document {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  menuType?: 'drinks' | 'food';
  imageUrl?: string;
  imageUrls?: string[];
  availabilityStatus?: 'available' | 'out_of_stock' | 'coming_soon' | 'unavailable' | 'new' | 'temporarily_unavailable';
  isAvailable: number; // 1 for available, 0 for unavailable
  isNewProduct?: number; // 1 for new, 0 for not new
  sizeML?: number; // Default size in milliliters
  sku?: string; // Product SKU/Code
  costOfGoods?: number; // Calculated COGS from recipe
  profitMargin?: number; // Calculated profit (price - COGS)
  availableSizes?: Array<{
    nameAr: string;
    nameEn?: string;
    price: number;
    sizeML?: number;
    sku?: string;
    imageUrl?: string;
  }>;
  branchAvailability?: Array<{
    branchId: string;
    isAvailable: number;
  }>;
  recipeId?: string;
  hasRecipe?: number;
  requiresRecipe?: number;
  createdByEmployeeId?: string;
  createdByBranchId?: string;
  publishedBranches?: string[];
  isGiftable?: boolean;
  groupId?: string;
  coffeeStrength?: string;
  strengthLevel?: number;
  descriptionEn?: string;
  availableFrom?: string;
  availableTo?: string;
  availableDays?: number[];
  addons?: Array<{
    nameAr: string;
    nameEn?: string;
    price: number;
    imageUrl?: string;
    isRequired?: boolean;
    maxSelectable?: number;
    section?: string;
    selectionType?: 'single' | 'multiple';
  }>;
  bundledItems?: Array<{
    sectionTitle: string;
    selectionType: 'single' | 'multiple';
    minSelectable: number;
    maxSelectable: number;
    items: Array<{
      productId: string;
      nameAr: string;
      nameEn?: string;
      imageUrl?: string;
      originalPrice: number;
      customPrice: number;
    }>;
  }>;
  isReservation?: boolean;
  reservationPackages?: Array<{
    packageName: string;
    description?: string;
    price: number;
    duration?: string;
    maxGuests?: number;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

const CoffeeItemSchema = new Schema<ICoffeeItem>({
  id: { type: String, required: true }, // Changed unique: false to just required
  tenantId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  oldPrice: { type: Number },
  category: { type: String, required: true },
  menuType: { type: String, enum: ['drinks', 'food'], default: 'drinks' },
  imageUrl: { type: String },
  imageUrls: [{ type: String }],
  isAvailable: { type: Number, default: 1, required: true },
  availabilityStatus: { type: String, default: "available" },
  coffeeStrength: { type: String, default: "classic" },
  strengthLevel: { type: Number },
  isNewProduct: { type: Number, default: 0 },
  sku: { type: String, sparse: true }, // SKU for product identification
  sizeML: { type: Number }, // Size in milliliters (optional if using availableSizes)
  isGiftable: { type: Boolean, default: false },
  groupId: { type: String, index: true }, // For grouping similar products
  availableSizes: [{
    nameAr: { type: String, required: true },
    nameEn: { type: String },
    price: { type: Number, required: true },
    sizeML: { type: Number },
    sku: { type: String },
    imageUrl: { type: String }
  }],
  addons: [{
    nameAr: { type: String, required: true },
    nameEn: { type: String },
    price: { type: Number, required: true, default: 0 },
    imageUrl: { type: String },
    isRequired: { type: Boolean, default: false },
    maxSelectable: { type: Number, default: 1 },
    section: { type: String, default: '' },
    selectionType: { type: String, enum: ['single', 'multiple'], default: 'multiple' },
  }],
  bundledItems: [{
    sectionTitle: { type: String, required: true },
    selectionType: { type: String, enum: ['single', 'multiple'], default: 'single' },
    minSelectable: { type: Number, default: 0 },
    maxSelectable: { type: Number, default: 1 },
    items: [{
      productId: { type: String, required: true },
      nameAr: { type: String, required: true },
      nameEn: { type: String },
      imageUrl: { type: String },
      originalPrice: { type: Number, required: true, default: 0 },
      customPrice: { type: Number, required: true, default: 0 },
    }],
  }],
  isReservation: { type: Boolean, default: false },
  reservationPackages: [{
    packageName: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, default: 0 },
    duration: { type: String },
    maxGuests: { type: Number },
  }],
  recipeId: { type: String },
  costOfGoods: { type: Number, default: 0 },
  profitMargin: { type: Number, default: 0 },
  branchAvailability: [{
    branchId: { type: String },
    isAvailable: { type: Number, default: 1 }
  }],
  hasRecipe: { type: Number, default: 0 },
  requiresRecipe: { type: Number, default: 1 },
  createdByEmployeeId: { type: String },
  createdByBranchId: { type: String },
  publishedBranches: [{ type: String }],
  availableFrom: { type: String },
  availableTo: { type: String },
  availableDays: [{ type: Number }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Performance indexes for coffee items
CoffeeItemSchema.index({ tenantId: 1 });
CoffeeItemSchema.index({ tenantId: 1, category: 1 });
CoffeeItemSchema.index({ tenantId: 1, publishedBranches: 1 });
CoffeeItemSchema.index({ tenantId: 1, isAvailable: 1 });
CoffeeItemSchema.index({ category: 1 });
CoffeeItemSchema.index({ publishedBranches: 1 });
CoffeeItemSchema.index({ isAvailable: 1 });
CoffeeItemSchema.index({ createdByBranchId: 1 });
CoffeeItemSchema.index({ id: 1 }, { unique: true });

export const CoffeeItemModel = mongoose.model<ICoffeeItem>("CoffeeItem", CoffeeItemSchema);

// نظام التخصيصات والإضافات - Product Customizations & Add-ons
export interface IProductAddon extends Document {
  id: string;
  nameAr: string;
  nameEn?: string;
  category: 'sugar' | 'milk' | 'shot' | 'syrup' | 'topping' | 'size' | 'other' | 'flavor';
  price: number;
  isAvailable: number;
  isFree?: number;
  rawItemId?: string;
  quantityPerUnit?: number;
  unit?: string;
  orderIndex?: number;
  sku?: string;
  imageUrl?: string;
  isAddonDrink?: boolean;
  isIndependentProduct?: boolean;
  linkedCoffeeItemId?: string; // New field to link to a drink
  inventoryRawItemId?: string;
  linkedRawItemId?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  menuCategory?: string; // Optional: limits this addon to a specific menu category (empty = all categories)
  selectionType?: 'single' | 'multiple'; // 'single' = radio (only one per group), 'multiple' = checkbox (default)
  createdAt: Date;
}

const ProductAddonSchema = new Schema<IProductAddon>({
  id: { type: String, required: true, unique: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  category: { type: String, enum: ['sugar', 'milk', 'shot', 'syrup', 'topping', 'size', 'other', 'flavor', 'Flavor', 'Shot'], required: true },
  price: { type: Number, required: true, default: 0 },
  isAvailable: { type: Number, default: 1 },
  isFree: { type: Number, default: 0 },
  rawItemId: { type: String },
  quantityPerUnit: { type: Number },
  unit: { type: String },
  orderIndex: { type: Number, default: 0 },
  sku: { type: String },
  imageUrl: { type: String },
  isAddonDrink: { type: Boolean, default: false },
  isIndependentProduct: { type: Boolean, default: false },
  linkedCoffeeItemId: { type: String }, // New field
  inventoryRawItemId: { type: String },
  linkedRawItemId: { type: String },
  menuCategory: { type: String, default: '' }, // Optional: limits addon to a specific menu category
  selectionType: { type: String, enum: ['single', 'multiple'], default: 'multiple' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export const ProductAddonModel = mongoose.model<IProductAddon>("ProductAddon", ProductAddonSchema);

// Warehouse Transfer Model
export interface IWarehouseTransfer extends Document {
  tenantId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: Array<{
    ingredientId: string;
    quantity: number;
    unit: string;
  }>;
  status: 'pending' | 'shipped' | 'received' | 'cancelled';
  notes?: string;
  createdBy: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseTransferSchema = new Schema<IWarehouseTransfer>({
  tenantId: { type: String, required: true },
  fromWarehouseId: { type: String, required: true },
  toWarehouseId: { type: String, required: true },
  items: [{
    ingredientId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true }
  }],
  status: { type: String, enum: ['pending', 'shipped', 'received', 'cancelled'], default: 'pending' },
  notes: { type: String },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const WarehouseTransferModel = mongoose.model<IWarehouseTransfer>("WarehouseTransfer", WarehouseTransferSchema);

// ربط التخصيصات بالمشروبات - Link Addons to Coffee Items
export interface ICoffeeItemAddon extends Document {
  coffeeItemId: string;
  addonId: string;
  isDefault: number;
  defaultValue?: string;
  minQuantity: number;
  maxQuantity: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const CoffeeItemAddonSchema = new Schema<ICoffeeItemAddon>({
  coffeeItemId: { type: String, required: true },
  addonId: { type: String, required: true },
  isDefault: { type: Number, default: 0 },
  defaultValue: { type: String },
  minQuantity: { type: Number, default: 0 },
  maxQuantity: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now },
});

CoffeeItemAddonSchema.index({ coffeeItemId: 1, addonId: 1 }, { unique: true });

export const CoffeeItemAddonModel = mongoose.model<ICoffeeItemAddon>("CoffeeItemAddon", CoffeeItemAddonSchema);

// نظام العروض - Promotional Offers / Bundles
export interface IPromoOffer extends Document {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  imageUrl?: string;
  offerType: 'bundle' | 'discount' | 'bogo'; // bundle = combo, discount = percentage off, bogo = buy one get one
  originalPrice: number;
  offerPrice: number;
  items: Array<{
    coffeeItemId: string;
    quantity: number;
    sizeOption?: string;
  }>;
  isActive: number;
  startDate?: Date;
  endDate?: Date;
  sortOrder: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromoOfferSchema = new Schema<IPromoOffer>({
  id: { type: String, required: true },
  tenantId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  description: { type: String },
  imageUrl: { type: String },
  offerType: { type: String, enum: ['bundle', 'discount', 'bogo'], default: 'bundle' },
  originalPrice: { type: Number, required: true },
  offerPrice: { type: Number, required: true },
  items: [{
    coffeeItemId: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    sizeOption: { type: String }
  }],
  isActive: { type: Number, default: 1 },
  startDate: { type: Date },
  endDate: { type: Date },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PromoOfferSchema.index({ tenantId: 1, isActive: 1 });
PromoOfferSchema.index({ id: 1 }, { unique: true });

export const PromoOfferModel = mongoose.model<IPromoOffer>("PromoOffer", PromoOfferSchema);

// Menu Categories - Custom dynamic categories for drinks/food
export interface IMenuCategory extends Document {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department: 'drinks' | 'food';
  orderIndex: number;
  isSystem?: boolean;
  isActive: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const MenuCategorySchema = new Schema<IMenuCategory>({
  id: { type: String, required: true },
  tenantId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  icon: { type: String, default: 'Coffee' },
  department: { type: String, enum: ['drinks', 'food'], default: 'drinks' },
  orderIndex: { type: Number, default: 0 },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

MenuCategorySchema.index({ tenantId: 1, isActive: 1 });
MenuCategorySchema.index({ id: 1 }, { unique: true });

export const MenuCategoryModel = mongoose.model<IMenuCategory>("MenuCategory", MenuCategorySchema);

// Custom Banners for Admin Control
export interface ICustomBanner extends Document {
  id: string;
  tenantId: string;
  titleAr: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  imageUrl: string;
  linkType: 'product' | 'category' | 'offer' | 'external' | 'none';
  linkId?: string; // id of product/category/offer
  externalUrl?: string;
  badgeAr?: string;
  badgeEn?: string;
  isActive: boolean;
  orderIndex: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  couponImageUrl?: string;
  couponCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomBannerSchema = new Schema<ICustomBanner>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  titleAr: { type: String, required: true },
  titleEn: { type: String },
  subtitleAr: { type: String },
  subtitleEn: { type: String },
  imageUrl: { type: String, required: true },
  linkType: { type: String, enum: ['product', 'category', 'offer', 'external', 'none'], default: 'none' },
  linkId: { type: String },
  externalUrl: { type: String },
  badgeAr: { type: String },
  badgeEn: { type: String },
  isActive: { type: Boolean, default: true },
  orderIndex: { type: Number, default: 0 },
  couponImageUrl: { type: String },
  couponCode: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CustomBannerSchema.index({ tenantId: 1, isActive: 1, orderIndex: 1 });

export const CustomBannerModel = mongoose.model<ICustomBanner>("CustomBanner", CustomBannerSchema);

export interface ICustomer extends Document {
  phone: string;
  email?: string;
  name: string;
  password?: string;
  registeredBy?: 'self' | 'cashier';
  isPasswordSet?: number;
  points?: number;
  pendingPoints?: number;
  walletBalance?: number;
  walletPin?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  favorites?: string[];
  createdAt: Date;
}

const CustomerSchema = new Schema<ICustomer>({
  phone: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  password: { type: String },
  registeredBy: { type: String, default: 'self' },
  isPasswordSet: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  walletPin: { type: String },
  carType: { type: String },
  carColor: { type: String },
  plateNumber: { type: String },
  saveCarInfo: { type: Number, default: 0 },
  favorites: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export const CustomerModel = mongoose.model<ICustomer>("Customer", CustomerSchema);

// ---------------- Appointment System ----------------
export interface IAppointment extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  serviceType: 'table' | 'event' | 'other';
  appointmentDate: Date;
  numberOfPeople: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  customerId: { type: String },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  serviceType: { type: String, enum: ['table', 'event', 'other'], default: 'table' },
  appointmentDate: { type: Date, required: true },
  numberOfPeople: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AppointmentSchema.index({ tenantId: 1, branchId: 1 });
AppointmentSchema.index({ appointmentDate: 1 });
AppointmentSchema.index({ customerPhone: 1 });

export const AppointmentModel = mongoose.model<IAppointment>("Appointment", AppointmentSchema);

export interface IPointTransfer extends Document {
  tenantId: string;
  fromCustomerId: string;
  toCustomerId: string;
  points: number;
  status: 'completed' | 'failed';
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const PointTransferSchema = new Schema<IPointTransfer>({
  tenantId: { type: String, required: true },
  fromCustomerId: { type: String, required: true },
  toCustomerId: { type: String, required: true },
  points: { type: Number, required: true },
  status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  createdAt: { type: Date, default: Date.now },
});

export const PointTransferModel = mongoose.model<IPointTransfer>("PointTransfer", PointTransferSchema);

export interface IPasswordResetToken extends Document {
  email: string;
  token: string;
  expiresAt: Date;
  used: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>({
  email: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Number, default: 0, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const PasswordResetTokenModel = mongoose.model<IPasswordResetToken>("PasswordResetToken", PasswordResetTokenSchema);

export interface IPasswordSetupOTP extends Document {
  phone: string;
  otp: string;
  expiresAt: Date;
  used: number;
  attempts: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const PasswordSetupOTPSchema = new Schema<IPasswordSetupOTP>({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Number, default: 0, required: true },
  attempts: { type: Number, default: 0, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Create index for automatic cleanup of OTPs (TTL index)
PasswordSetupOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Index for quick phone lookup
PasswordSetupOTPSchema.index({ phone: 1 });

export const PasswordSetupOTPModel = mongoose.model<IPasswordSetupOTP>("PasswordSetupOTP", PasswordSetupOTPSchema);

// Multi-Tenant: Cafe Management
export interface ICafe extends Document {
  id: string;
  nameAr: string;
  nameEn: string;
  type: 'demo' | 'client';
  status: 'active' | 'inactive' | 'suspended';
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  taxNumber?: string;
  vatPercentage: number;
  currency: string;
  timezone: string;
  subscriptionPlan?: 'free' | 'starter' | 'professional' | 'enterprise';
  features: {
    inventoryTracking: boolean;
    loyaltyProgram: boolean;
    zatcaCompliance: boolean;
    advancedAnalytics: boolean;
    customTheme: boolean;
  };
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CafeSchema = new Schema<ICafe>({
  id: { type: String, required: true, unique: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String, required: true },
  type: { type: String, enum: ['demo', 'client'], default: 'demo' },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  businessName: { type: String, required: true },
  businessPhone: { type: String, required: true },
  businessEmail: { type: String, required: true },
  taxNumber: { type: String },
  vatPercentage: { type: Number, default: 15 },
  currency: { type: String, default: "SAR" },
  timezone: { type: String, default: "Asia/Riyadh" },
  subscriptionPlan: { type: String, enum: ['free', 'starter', 'professional', 'enterprise'], default: 'free' },
  features: {
    inventoryTracking: { type: Boolean, default: false },
    loyaltyProgram: { type: Boolean, default: false },
    zatcaCompliance: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    customTheme: { type: Boolean, default: false },
  },
  customBranding: {
    logoUrl: { type: String },
    primaryColor: { type: String },
    secondaryColor: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const CafeModel = mongoose.model<ICafe>("Cafe", CafeSchema);

// --- NEW OPERATING SYSTEM CORE MODELS ---

// 1. Business Configuration (Extended Cafe)
export type PaymentGatewayProvider = 'none' | 'neoleap' | 'geidea';

export interface IPaymentGatewayConfig {
  provider: PaymentGatewayProvider;
  enabledMethods: string[];
  paymentTestMode?: boolean;
  neoleap?: {
    clientId?: string;
    clientSecret?: string;
    merchantId?: string;
    baseUrl?: string;
    callbackUrl?: string;
  };
  geidea?: {
    publicKey?: string;
    apiPassword?: string;
    baseUrl?: string;
    callbackUrl?: string;
    configured?: boolean;
    publicKeyPrefix?: string;
  };
  cashEnabled: boolean;
  cashMaxDistance?: number;
  storeLocation?: { lat?: number; lng?: number };
  posEnabled: boolean;
  qahwaCardEnabled: boolean;
  bankTransferEnabled: boolean;
  stcPayEnabled: boolean;
}

export interface ISocialLinks {
  instagram?: string;
  twitter?: string;
  facebook?: string;
  snapchat?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface IStoreHours {
  monday: { open: string; close: string; isOpen: boolean };
  tuesday: { open: string; close: string; isOpen: boolean };
  wednesday: { open: string; close: string; isOpen: boolean };
  thursday: { open: string; close: string; isOpen: boolean };
  friday: { open: string; close: string; isOpen: boolean };
  saturday: { open: string; close: string; isOpen: boolean };
  sunday: { open: string; close: string; isOpen: boolean };
}

export interface IBusinessConfig extends Document {
  tenantId: string;
  tradeNameAr: string;
  tradeNameEn?: string;
  activityType: 'cafe' | 'restaurant' | 'both';
  isFoodEnabled: boolean;
  isDrinksEnabled: boolean;
  employeeInvoiceEnabled: boolean;
  vatNumber?: string;
  vatPercentage: number;
  currency: string;
  timezone: string;
  country?: string;
  isEmergencyClosed: boolean;
  isMaintenanceMode?: boolean;
  maintenanceReason?: string;
  storeHours: IStoreHours;
  socialLinks: ISocialLinks;
  paymentGateway?: IPaymentGatewayConfig;
  loyaltyConfig?: {
    enabled?: boolean;
    pointsPerDrink?: number;
    pointsPerSar?: number;
    pointsEarnedPerSar?: number;
    minPointsForRedemption?: number;
    pointsValueInSar?: number;
    redemptionRate?: number;
    pointsForFreeDrink?: number;
  };
  offersConfig?: Record<string, any>;
  menuLayout?: 'classic' | 'cards' | 'list';
  cashierLayout?: 'classic' | 'pos' | 'split';
  orderMethodsConfig?: {
    enableDineIn?: boolean;
    enableCarPickup?: boolean;
    enableDelivery?: boolean;
    enableScheduledPickup?: boolean;
    enableTakeaway?: boolean;
  };
  serviceFeeEnabled?: boolean;
  serviceFeeAmount?: number;
  serviceFeeLowOrderThreshold?: number;
  serviceFeeLowOrderAmount?: number;
  prepBaseMinutes?: number;
  prepExtraMinutesPerItem?: number;
  prepFreeItemCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BusinessConfig = IBusinessConfig;

const PaymentGatewayConfigSchema = new Schema({
  provider: { type: String, enum: ['none', 'neoleap', 'geidea'], default: 'none' },
  enabledMethods: [{ type: String }],
  neoleap: {
    clientId: { type: String },
    clientSecret: { type: String },
    merchantId: { type: String },
    baseUrl: { type: String, default: 'https://api.neoleap.com.sa' },
    callbackUrl: { type: String },
  },
  geidea: {
    publicKey: { type: String },
    apiPassword: { type: String },
    baseUrl: { type: String, default: 'https://api.merchant.geidea.net' },
    callbackUrl: { type: String },
  },
  paymentTestMode: { type: Boolean, default: false },
  cashEnabled: { type: Boolean, default: true },
  cashMaxDistance: { type: Number, default: 0 },
  storeLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  posEnabled: { type: Boolean, default: true },
  qahwaCardEnabled: { type: Boolean, default: true },
  bankTransferEnabled: { type: Boolean, default: false },
  stcPayEnabled: { type: Boolean, default: false },
}, { _id: false });

const BusinessConfigSchema = new Schema<IBusinessConfig>({
  tenantId: { type: String, required: true, unique: true },
  tradeNameAr: { type: String, required: true },
  tradeNameEn: { type: String },
  activityType: { type: String, enum: ['cafe', 'restaurant', 'both'], default: 'cafe' },
  isFoodEnabled: { type: Boolean, default: false },
  isDrinksEnabled: { type: Boolean, default: true },
  vatNumber: { type: String },
  vatPercentage: { type: Number, default: 15 },
  currency: { type: String, default: 'SAR' },
  timezone: { type: String, default: 'Asia/Riyadh' },
  country: { type: String, default: 'SA' },
  isMaintenanceMode: { type: Boolean, default: false },
  maintenanceReason: { type: String, default: 'maintenance' },
  isEmergencyClosed: { type: Boolean, default: false },
  storeHours: {
    type: Schema.Types.Mixed,
    default: () => ({
      monday: { open: '06:00', close: '03:00', isOpen: true, isAlwaysOpen: false },
      tuesday: { open: '06:00', close: '03:00', isOpen: true, isAlwaysOpen: false },
      wednesday: { open: '06:00', close: '03:00', isOpen: true, isAlwaysOpen: false },
      thursday: { open: '06:00', close: '03:00', isOpen: true, isAlwaysOpen: false },
      friday: { open: '13:00', close: '04:00', isOpen: true, isAlwaysOpen: false },
      saturday: { open: '13:00', close: '04:00', isOpen: true, isAlwaysOpen: false },
      sunday: { open: '06:00', close: '03:00', isOpen: true, isAlwaysOpen: false }
    })
  },
  socialLinks: {
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    facebook: { type: String, default: '' },
    snapchat: { type: String, default: '' },
    tiktok: { type: String, default: '' },
    whatsapp: { type: String, default: '' }
  },
  paymentGateway: { type: PaymentGatewayConfigSchema, default: () => ({
    provider: 'none',
    enabledMethods: ['cash'],
    cashEnabled: true,
    posEnabled: true,
    qahwaCardEnabled: true,
    bankTransferEnabled: false,
    stcPayEnabled: false,
  })},
  employeeInvoiceEnabled: { type: Boolean, default: false },
  loyaltyConfig: {
    type: Schema.Types.Mixed,
    default: () => ({
      enabled: true,
      pointsPerDrink: 10,
      pointsPerSar: 20,
      pointsEarnedPerSar: 1,
      minPointsForRedemption: 100,
      pointsValueInSar: 0.05,
      redemptionRate: 100,
    })
  },
  offersConfig: { type: Schema.Types.Mixed, default: () => ({}) },
  menuLayout: { type: String, enum: ['classic', 'cards', 'list'], default: 'classic' },
  cashierLayout: { type: String, enum: ['classic', 'pos', 'split'], default: 'classic' },
  orderMethodsConfig: {
    type: Schema.Types.Mixed,
    default: () => ({
      enableDineIn: true,
      enableCarPickup: true,
      enableDelivery: false,
      enableScheduledPickup: true,
      enableTakeaway: true,
    })
  },
  serviceFeeEnabled: { type: Boolean, default: true },
  serviceFeeAmount: { type: Number, default: 0.70 },
  serviceFeeLowOrderThreshold: { type: Number, default: 5.00 },
  serviceFeeLowOrderAmount: { type: Number, default: 0.35 },
  prepBaseMinutes: { type: Number, default: 10 },
  prepExtraMinutesPerItem: { type: Number, default: 3 },
  prepFreeItemCount: { type: Number, default: 2 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const BusinessConfigModel = mongoose.model<IBusinessConfig>("BusinessConfig", BusinessConfigSchema);

// 2. Ingredient Model (Recipe Core) - PHASE 2 Enhanced
export interface IIngredientItem extends Document {
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  sku?: string;
  category: 'beans' | 'milk' | 'syrups' | 'packaging' | 'other';
  unit: string; // Storage unit (kg, g, liter, ml, pieces)
  unitCost: number; // Cost per unit
  currentStock: number;
  minStockThreshold: number;
  maxStockLevel?: number; // PHASE 2: Max recommended stock
  reorderPoint?: number; // PHASE 2: Auto-reorder trigger
  supplierId?: string;
  lastPriceCheck?: Date; // PHASE 2: Last price verification
  priceHistory?: Array<{ // PHASE 2: Track price changes
    date: Date;
    cost: number;
  }>;
  isActive: boolean; // Added for Phase 1.1 consistency
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type IngredientItem = IIngredientItem;

const IngredientItemSchema = new Schema<IIngredientItem>({
  tenantId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  sku: { type: String },
  category: { type: String, enum: ['beans', 'milk', 'syrups', 'packaging', 'other'], default: 'other' },
  unit: { type: String, default: 'g' },
  unitCost: { type: Number, required: true, default: 0 },
  currentStock: { type: Number, default: 0 },
  minStockThreshold: { type: Number, default: 0 },
  maxStockLevel: { type: Number },
  reorderPoint: { type: Number },
  supplierId: { type: String },
  lastPriceCheck: { type: Date },
  priceHistory: [{
    date: { type: Date, default: Date.now },
    cost: { type: Number }
  }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

IngredientItemSchema.index({ tenantId: 1, sku: 1 });
export const IngredientItemModel = mongoose.model<IIngredientItem>("IngredientItem", IngredientItemSchema);

// 3. Recipe Engine
export interface IRecipeDefinition extends Document {
  tenantId: string;
  productId: string; // Refers to CoffeeItem.id
  ingredients: Array<{
    ingredientId: string;
    quantity: number;
    unit: string;
    unitCost?: number; // Snapshot of cost at recipe creation
    totalCost?: number; // Snapshot of ingredient cost
  }>;
  totalCost: number;
  version: number;
  isActive: boolean;
  description?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecipeHistory extends Document {
  tenantId: string;
  productId: string;
  recipeId: string; // Reference to RecipeDefinition
  version: number;
  ingredients: Array<{
    ingredientId: string;
    quantity: number;
    unit: string;
  }>;
  totalCost: number;
  reason?: string; // Why recipe was changed
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

export type RecipeDefinition = IRecipeDefinition;
export type RecipeHistory = IRecipeHistory;

const RecipeDefinitionSchema = new Schema<IRecipeDefinition>({
  tenantId: { type: String, required: true },
  productId: { type: String, required: true },
  ingredients: [{
    ingredientId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    unitCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  }],
  totalCost: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const RecipeHistorySchema = new Schema<IRecipeHistory>({
  tenantId: { type: String, required: true },
  productId: { type: String, required: true },
  recipeId: { type: String, required: true },
  version: { type: Number, required: true },
  ingredients: [{
    ingredientId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true }
  }],
  totalCost: { type: Number, default: 0 },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now },
});

RecipeDefinitionSchema.index({ tenantId: 1, productId: 1, isActive: 1 });
RecipeHistorySchema.index({ tenantId: 1, productId: 1, version: 1 });

export const RecipeDefinitionModel = mongoose.model<IRecipeDefinition>("RecipeDefinition", RecipeDefinitionSchema);
export const RecipeHistoryModel = mongoose.model<IRecipeHistory>("RecipeHistory", RecipeHistorySchema);

// 5. Centralized Warehouse Model
export interface IWarehouse extends Document {
  id: string;
  tenantId: string;
  nameAr: string;
  nameEn?: string;
  location?: {
    lat: number;
    lng: number;
  };
  managerId?: string;
  isActive: boolean;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  managerId: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const WarehouseModel = mongoose.model<IWarehouse>("Warehouse", WarehouseSchema);

// 6. Warehouse Stock
export interface IWarehouseStock extends Document {
  tenantId: string;
  warehouseId: string;
  ingredientId: string;
  quantity: number;
  minStockLevel: number;
  maxStockLevel?: number;
  updatedAt: Date;
}

const WarehouseStockSchema = new Schema<IWarehouseStock>({
  tenantId: { type: String, required: true },
  warehouseId: { type: String, required: true },
  ingredientId: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 0 },
  maxStockLevel: { type: Number },
  updatedAt: { type: Date, default: Date.now },
});

WarehouseStockSchema.index({ tenantId: 1, warehouseId: 1, ingredientId: 1 }, { unique: true });
export const WarehouseStockModel = mongoose.model<IWarehouseStock>("WarehouseStock", WarehouseStockSchema);

// 7. Delivery App Integration Model - تعريفه في نهاية الملف بشكل شامل

export interface IBranch extends Document {
  id: string;
  tenantId: string;
  cafeId: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  phone: string;
  workingHours: {
    open: string;
    close: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
  geofenceRadius?: number; // نطاق حدود الفرع بالمتر (للدائرة البسيطة)
  geofenceBoundary?: Array<{ lat: number; lng: number }>; // حدود الفرع متعددة النقاط (Polygon)
  isActive: boolean;
  managerName?: string;
  managerId?: string;
  isMainBranch: boolean;
  isMaintenanceMode: boolean;
  printSettings?: {
    headerText?: string;
    footerText?: string;
    showVat: boolean;
  };
  lateThresholdMinutes?: number; // عتبة التأخير بالدقائق
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  city?: string;
  createdAt: Date;
}

const BranchSchema = new Schema<IBranch>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  cafeId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  workingHours: {
    open: { type: String, default: "08:00" },
    close: { type: String, default: "23:00" }
  },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  geofenceRadius: { type: Number, default: 200 }, // الافتراضي 200 متر
  geofenceBoundary: [{ lat: { type: Number }, lng: { type: Number } }], // حدود متعددة النقاط
  isActive: { type: Schema.Types.Mixed, default: true },
  managerName: { type: String },
  managerId: { type: String },
  isMaintenanceMode: { type: Boolean, default: false },
  lateThresholdMinutes: { type: Number, default: 15 }, // الافتراضي 15 دقيقة
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export const BranchModel = mongoose.model<IBranch>("Branch", BranchSchema);

export interface IDiscountCode extends Document {
  code: string;
  discountPercentage: number;
  reason: string;
  employeeId: string;
  isActive: number;
  usageCount: number;
  visibleToCustomers: boolean;
  expiryDate?: Date;
  usageLimit?: number;
  minPurchase?: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const DiscountCodeSchema = new Schema<IDiscountCode>({
  code: { type: String, required: true, unique: true },
  discountPercentage: { type: Number, required: true },
  reason: { type: String, required: true },
  employeeId: { type: String, required: true },
  isActive: { type: Number, default: 1, required: true },
  usageCount: { type: Number, default: 0, required: true },
  visibleToCustomers: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const DiscountCodeModel = mongoose.model<IDiscountCode>("DiscountCode", DiscountCodeSchema);

export interface IOrder extends Document {
  tenantId: string;
  orderNumber: string;
  items: any;
  totalAmount: number;
  dailyNumber?: number;
  paymentMethod: string;
  paymentDetails?: string;
  paymentReceiptUrl?: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: string; // 'pending', 'payment_confirmed', 'completed', 'cancelled', 'open'
  tableStatus?: 'pending' | 'payment_confirmed' | 'preparing' | 'delivering_to_table' | 'delivered' | 'cancelled' | 'open';
  orderType?: 'dine-in' | 'pickup' | 'delivery' | 'car-pickup' | 'table' | 'car_pickup' | 'dine_in' | 'regular' | 'curbside' | 'takeaway';
  arrivalTime?: string;
  scheduledPickupTime?: string;
  preparationHoldUntil?: string;
  pickupType?: 'inside' | 'table' | 'car';
  carType?: string;
  carColor?: string;
  carPlate?: string;
  plateNumber?: string;
  arrivalNoticeSent?: boolean;
  customerInfo?: any;
  customerId?: string;
  employeeId?: string;
  assignedCashierId?: string;
  branchId?: string;
  tableNumber?: string;
  tableId?: string;
  customerNotes?: string;
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'cashier';
  isProductReservation?: boolean;
  productReservationDate?: string;
  productReservationFromTime?: string;
  productReservationToTime?: string;
  productReservationStatus?: 'pending_payment' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  productReservationPackageName?: string;
  productReservationNotes?: string;
  carPickup?: {
    carType?: string;
    carColor?: string;
    plateNumber?: string;
  };
  carInfo?: {
    carType?: string;
    carColor?: string;
    plateNumber?: string;
  };
  discountCode?: string;
  discountPercentage?: number;
  isOpenTab?: boolean;
  dineIn?: boolean;
  deliveryType?: 'pickup' | 'delivery' | 'dine-in' | 'curbside' | 'car_pickup' | 'car-pickup';
  customerArrived?: boolean;
  customerArrivedAt?: string;
  deliveryAddress?: {
    fullAddress?: string;
    lat: number;
    lng: number;
    zone?: string;
    isInDeliveryZone?: boolean;
  };
  deliveryFee?: number;
  driverId?: string;
  driverLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  deliveryStatus?: string;
  deliveryStartedAt?: Date;
  estimatedPrepTimeInMinutes?: number;
  prepTimeSetAt?: Date;
  estimatedDeliveryTime?: Date;
  deliveredAt?: Date;
  costOfGoods?: number;
  grossProfit?: number;
  inventoryDeducted?: number;
  pointsAwarded?: boolean;
  inventoryDeductionDetails?: Array<{
    rawItemId: string;
    rawItemName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  subtotal?: number;
  tax?: number;
  channel?: 'online' | 'web' | 'pos' | 'app' | 'whatsapp' | string;
  giftCardCode?: string;
  giftCardAmountUsed?: number;
  giftCardRemainingBalance?: number;
  notes?: string;
  statusHistory?: Array<{
    status: string;
    timestamp: Date;
    updatedBy?: string;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  customerId: { type: String },
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },
  customerInfo: { type: Schema.Types.Mixed },
  employeeId: { type: String },
  subtotal: { type: Number },
  tax: { type: Number },
  orderNumber: { type: String, required: true },
  orderType: { type: String, enum: ['dine-in', 'pickup', 'delivery', 'car-pickup', 'car_pickup', 'regular', 'table', 'dine_in', 'curbside', 'takeaway'], default: 'dine-in' },
  pickupType: { type: String, enum: ['inside', 'table', 'car'] },
  tableNumber: { type: String },
  arrivalTime: { type: String },
  scheduledPickupTime: { type: String },
  preparationHoldUntil: { type: String },
  dineIn: { type: Boolean, default: false },
  carPickup: { type: Boolean, default: false },
  customerArrived: { type: Boolean, default: false },
  customerArrivedAt: { type: String },
  carInfo: {
    carType: { type: String },
    carColor: { type: String },
    plateNumber: { type: String }
  },
  carType: { type: String },
  carColor: { type: String },
  carPlate: { type: String },
  plateNumber: { type: String },
  items: { type: Schema.Types.Mixed, required: true },
  totalAmount: { type: Number, required: true },
  dailyNumber: { type: Number },
  paymentMethod: { type: String, enum: ["cash", "pos", "apple_pay", "pos-network", "alinma", "rajhi", "ur", "barq", "qahwa-card", "stc-pay", "mada", "geidea", "neoleap", "neoleap-apple-pay", "bank_card", "paymob-card", "paymob-wallet", "loyalty-card"], required: true },
  paymentDetails: { type: String },
  paymentReceiptUrl: { type: String },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  isOpenTab: { type: Boolean, default: false },
  status: { type: String, default: "pending", required: true },
  channel: { type: String, default: "online" },
  notes: { type: String },
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: String },
    notes: { type: String }
  }],
  pointsAwarded: { type: Boolean, default: false },
  giftCardCode: { type: String },
  giftCardAmountUsed: { type: Number },
  giftCardRemainingBalance: { type: Number },
  isProductReservation: { type: Boolean, default: false },
  productReservationDate: { type: String },
  productReservationFromTime: { type: String },
  productReservationToTime: { type: String },
  productReservationStatus: { type: String, enum: ['pending_payment', 'pending_confirmation', 'confirmed', 'rejected', 'cancelled', 'completed'], default: 'pending_payment' },
  productReservationPackageName: { type: String },
  productReservationNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Core compound indexes for high-throughput queries
OrderSchema.index({ tenantId: 1, branchId: 1, status: 1, createdAt: -1 }); // live orders with branch + sort
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });              // live orders no-branch + sort
OrderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1, status: 1 }); // today filter with branch
OrderSchema.index({ tenantId: 1, createdAt: -1, status: 1 });              // today filter no-branch
// Existing indexes retained
OrderSchema.index({ tenantId: 1, branchId: 1, status: 1 });
OrderSchema.index({ tenantId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1, tenantId: 1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ customerPhone: 1, tenantId: 1 });
OrderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ tableId: 1, status: 1 });

export const OrderModel = mongoose.model<IOrder>("Order", OrderSchema);

export interface IOrderItemCustomization {
  selectedAddons: Array<{
    addonId: string;
    nameAr: string;
    quantity: number;
    price: number;
    category: string;
    rawItemId?: string;
    quantityPerUnit?: number;
    unit?: string;
  }>;
  notes?: string;
  totalAddonsPrice: number;
}

export interface IOrderItemSnapshot {
  coffeeItemId: string;
  nameAr: string;
  nameEn?: string;
  price: number;
  imageUrl?: string;
  category: string;
}

export interface IOrderItem extends Document {
  orderId: string;
  coffeeItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customization?: IOrderItemCustomization;
  productSnapshot?: IOrderItemSnapshot;
  lineItemId?: string;
}

const OrderItemSchema = new Schema<IOrderItem>({
  orderId: { type: String, required: true },
  coffeeItemId: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  customization: {
    selectedAddons: [{
      addonId: { type: String },
      nameAr: { type: String },
      quantity: { type: Number },
      price: { type: Number },
      category: { type: String },
      rawItemId: { type: String },
      quantityPerUnit: { type: Number },
      unit: { type: String }
    }],
    notes: { type: String },
    totalAddonsPrice: { type: Number, default: 0 }
  },
  productSnapshot: {
    coffeeItemId: { type: String },
    nameAr: { type: String },
    nameEn: { type: String },
    price: { type: Number },
    imageUrl: { type: String },
    category: { type: String }
  },
  lineItemId: { type: String }
});

export const OrderItemModel = mongoose.model<IOrderItem>("OrderItem", OrderItemSchema);

export interface ICartItem extends Document {
  id: string;
  sessionId: string;
  coffeeItemId: string;
  quantity: number;
  selectedSize?: string;
  selectedAddons?: string[];
  selectedItemAddons?: Array<{ nameAr: string; nameEn?: string; price: number }>;
  selectedReservationPackage?: { packageName: string; description?: string; price: number; duration?: string; maxGuests?: number; } | null;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  id: { type: String, required: true },
  sessionId: { type: String, required: true },
  coffeeItemId: { type: String, required: true },
  quantity: { type: Number, required: true },
  selectedSize: { type: String },
  selectedAddons: [{ type: String }],
  selectedItemAddons: [{ type: mongoose.Schema.Types.Mixed }],
  selectedReservationPackage: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Important: Index by sessionId and id for quick lookup
CartItemSchema.index({ sessionId: 1, id: 1 });

export const CartItemModel = mongoose.model<ICartItem>("CartItem", CartItemSchema);

export interface ILoyaltyCard extends Document {
  customerId: string;
  customerName?: string;
  phoneNumber: string;
  qrToken: string;
  cardNumber: string;
  cardPin?: string;
  cardDesign?: string;
  reissuanceCount: number;
  stamps: number;
  freeCupsEarned: number;
  freeCupsRedeemed: number;
  points: number;
  pendingPoints: number;
  tier: string;
  totalSpent: number;
  discountCount: number;
  status: string;
  isActive: boolean;
  lastUsedAt?: Date;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyCardSchema = new Schema<ILoyaltyCard>({
  customerId: { type: String, required: true },
  customerName: { type: String },
  phoneNumber: { type: String, required: true },
  qrToken: { type: String, required: true, unique: true },
  cardNumber: { type: String, required: true, unique: true },
  cardPin: { type: String },
  cardDesign: { type: String, default: "classic" },
  reissuanceCount: { type: Number, default: 0, required: true },
  stamps: { type: Number, default: 0, required: true },
  freeCupsEarned: { type: Number, default: 0, required: true },
  freeCupsRedeemed: { type: Number, default: 0, required: true },
  points: { type: Number, default: 0, required: true },
  pendingPoints: { type: Number, default: 0, required: true },
  tier: { type: String, default: "bronze", required: true },
  totalSpent: { type: Number, default: 0, required: true },
  discountCount: { type: Number, default: 0, required: true },
  status: { type: String, default: "active", required: true },
  isActive: { type: Boolean, default: true, required: true },
  lastUsedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LoyaltyCardSchema.index({ customerId: 1 });
LoyaltyCardSchema.index({ phoneNumber: 1 });
LoyaltyCardSchema.index({ isActive: 1, tier: 1 });

export const LoyaltyCardModel = mongoose.model<ILoyaltyCard>("LoyaltyCard", LoyaltyCardSchema);

// Status History Model to track status changes for orders, transfers, etc.
export interface IStatusHistory extends Document {
  tenantId: string;
  referenceId: string; // Order ID, Transfer ID, etc.
  referenceType: 'order' | 'stock_transfer' | 'purchase_invoice';
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  notes?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const StatusHistorySchema = new Schema<IStatusHistory>({
  tenantId: { type: String, required: true },
  referenceId: { type: String, required: true },
  referenceType: { type: String, enum: ['order', 'stock_transfer', 'purchase_invoice'], required: true },
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  changedBy: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const StatusHistoryModel = mongoose.model<IStatusHistory>("StatusHistory", StatusHistorySchema);

export interface ICardCode extends Document {
  code: string;
  issuedForOrderId: string;
  drinkName: string;
  isRedeemed: number;
  redeemedAt?: Date;
  redeemedByCardId?: string;
  cardId?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const CardCodeSchema = new Schema<ICardCode>({
  code: { type: String, required: true, unique: true },
  issuedForOrderId: { type: String, required: true },
  drinkName: { type: String, required: true },
  isRedeemed: { type: Number, default: 0, required: true },
  redeemedAt: { type: Date },
  redeemedByCardId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const CardCodeModel = mongoose.model<ICardCode>("CardCode", CardCodeSchema);

export interface ILoyaltyTransaction extends Document {
  cardId: string;
  orderId?: string;
  type: string;
  pointsChange: number;
  discountAmount?: number;
  orderAmount?: number;
  description?: string;
  employeeId?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>({
  cardId: { type: String, required: true },
  orderId: { type: String },
  type: { type: String, required: true },
  pointsChange: { type: Number, required: true },
  discountAmount: { type: Number },
  orderAmount: { type: Number },
  description: { type: String },
  employeeId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

LoyaltyTransactionSchema.index({ cardId: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ type: 1 });

export const LoyaltyTransactionModel = mongoose.model<ILoyaltyTransaction>("LoyaltyTransaction", LoyaltyTransactionSchema);

export interface ILoyaltyReward extends Document {
  nameAr: string;
  nameEn?: string;
  description: string;
  pointsCost: number;
  discountPercentage?: number;
  discountAmount?: number;
  tier?: string;
  isActive: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const LoyaltyRewardSchema = new Schema<ILoyaltyReward>({
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  description: { type: String, required: true },
  pointsCost: { type: Number, required: true },
  discountPercentage: { type: Number },
  discountAmount: { type: Number },
  tier: { type: String },
  isActive: { type: Number, default: 1, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const LoyaltyRewardModel = mongoose.model<ILoyaltyReward>("LoyaltyReward", LoyaltyRewardSchema);

/**
 * @deprecated Use RawItem with category='ingredient' instead.
 * This model is kept for backwards compatibility only.
 * New code should use RawItem and RecipeItem for ingredient management.
 * Migration script: server/migrations/migrate-ingredients-to-raw-items.ts
 */
export interface IIngredient extends Document {
  id: string;
  nameAr: string;
  nameEn?: string;
  isAvailable: number;
  icon?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const IngredientSchema = new Schema<IIngredient>({
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  isAvailable: { type: Number, default: 1, required: true },
  icon: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const IngredientModel = mongoose.model<IIngredient>("Ingredient", IngredientSchema);

/**
 * @deprecated Use RecipeItem instead for linking coffee items to raw materials.
 * This model is kept for backwards compatibility only.
 * New code should use RecipeItem with rawItemId.
 * Migration script: server/migrations/migrate-ingredients-to-raw-items.ts
 */
export interface ICoffeeItemIngredient extends Document {
  coffeeItemId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const CoffeeItemIngredientSchema = new Schema<ICoffeeItemIngredient>({
  coffeeItemId: { type: String, required: true },
  ingredientId: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, required: true, default: 'ml' },
  createdAt: { type: Date, default: Date.now },
});

CoffeeItemIngredientSchema.index({ coffeeItemId: 1, ingredientId: 1 }, { unique: true });

export const CoffeeItemIngredientModel = mongoose.model<ICoffeeItemIngredient>("CoffeeItemIngredient", CoffeeItemIngredientSchema);

// IBranch is already defined above, removing duplicate declaration at line 704
// const BranchSchema is already defined above, removing duplicate declaration at line 721
// export const BranchModel is already defined above, removing duplicate declaration at line 738

export interface ICategory extends Document {
  nameAr: string;
  nameEn?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  nameAr: { type: String, required: true, unique: true },
  nameEn: { type: String },
  description: { type: String },
  icon: { type: String },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Number, default: 1, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);

export interface IUser extends Document {
  username: string;
  password: string;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

export const UserModel = mongoose.model<IUser>("User", UserSchema);

// مناطق التوصيل - تعريفها في نهاية الملف بشكل شامل

export interface ITable extends Document {
  id?: string;
  tenantId?: string;
  tableNumber: string;
  qrToken: string;
  branchId: string;
  capacity?: number;
  location?: string;
  isActive: number;
  isOccupied: number;
  currentOrderId?: string;
  reservedFor?: {
    customerName: string;
    customerPhone: string;
    customerId?: string;
    reservationDate: Date;
    reservationTime: string;
    numberOfGuests: number;
    reservedAt: Date;
    reservedBy: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
    autoBookStartTime?: Date;
    autoExpiryTime?: Date;
    extensionCount?: number;
    lastExtendedAt?: Date;
    emailNotificationSent?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>({
  tableNumber: { type: String, required: true },
  qrToken: { type: String, required: true, unique: true },
  branchId: { type: String, required: true },
  capacity: { type: Number, default: 4 },
  location: { type: String },
  tenantId: { type: String, required: true },
  isActive: { type: Schema.Types.Mixed, default: 1, required: true },
  isOccupied: { type: Schema.Types.Mixed, default: 0, required: true },
  currentOrderId: { type: String },
  reservedFor: {
    customerName: { type: String },
    customerPhone: { type: String },
    customerId: { type: String },
    reservationDate: { type: Date },
    reservationTime: { type: String },
    numberOfGuests: { type: Number },
    reservedAt: { type: Date },
    reservedBy: { type: String },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed', 'expired'], default: 'pending' },
    autoBookStartTime: { type: Date }, // تحجز الطاولة قبل 5 دقائق من الموعد
    autoExpiryTime: { type: Date }, // تنتهي بعد ساعة
    extensionCount: { type: Number, default: 0 }, // عدد التمديدات
    lastExtendedAt: { type: Date }, // آخر تمديد
    emailNotificationSent: { type: Boolean, default: false }, // تم إرسال الإشعار
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TableSchema.index({ tableNumber: 1, branchId: 1 }, { unique: true });

export const TableModel = mongoose.model<ITable>("Table", TableSchema);

// ZATCA Phase 1 & 2 Compliant Tax Invoice
export interface ITaxInvoice extends Document {
  // Basic Invoice Info
  invoiceNumber: string;
  uuid: string; // UUID for ZATCA compliance
  orderId: string;

  // Seller Information (المنشأة)
  sellerName: string;
  sellerNameEn?: string;
  sellerVatNumber: string;
  sellerCrNumber?: string; // Commercial Registration
  sellerAddress: string;
  sellerCity?: string;
  sellerPostalCode?: string;
  sellerBuildingNumber?: string;
  sellerDistrict?: string;
  sellerCountry: string;
  branchId?: string;

  // Buyer/Customer Information (المشتري)
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerVatNumber?: string; // VAT number if B2B
  customerAddress?: string;

  // Invoice Type
  invoiceType: 'standard' | 'simplified' | 'debit_note' | 'credit_note';
  invoiceTypeCode: string; // 388 for standard, 381 for credit note, 383 for debit note
  transactionType: 'B2B' | 'B2C'; // Business to Business or Business to Customer

  // Items and Amounts
  items: Array<{
    itemId: string;
    nameAr: string;
    nameEn?: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
  }>;

  // Totals
  subtotal: number;
  totalDiscountAmount: number;
  taxableAmount: number; // Amount before VAT
  taxAmount: number; // VAT amount (15%)
  totalAmount: number; // Total with VAT

  // Payment Information
  paymentMethod: string;
  paymentMeans?: string; // 10 = Cash, 30 = Credit, etc.

  // ZATCA Compliance Fields
  invoiceCounter: number; // Sequential counter
  previousInvoiceHash?: string; // Hash of previous invoice
  invoiceHash: string; // SHA-256 hash
  qrCode: string; // TLV encoded base64 QR code
  xmlContent?: string; // Full XML invoice
  pdfUrl?: string;

  // Dates
  invoiceDate: Date;
  supplyDate?: Date; // Date of supply

  // Status
  zatcaStatus: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'cleared';
  zatcaSubmissionId?: string;
  zatcaResponse?: string;

  // Employee who created the invoice
  createdBy?: string;

  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaxInvoiceSchema = new Schema<ITaxInvoice>({
  invoiceNumber: { type: String, required: true, unique: true },
  uuid: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },

  sellerName: { type: String, required: true, default: 'BLACK ROSE CAFE' },
  sellerNameEn: { type: String, default: 'BLACK ROSE CAFE' },
  sellerVatNumber: { type: String, required: true, default: '311234567890003' },
  sellerCrNumber: { type: String },
  sellerAddress: { type: String, required: true, default: 'الرياض، المملكة العربية السعودية' },
  sellerCity: { type: String, default: 'الرياض' },
  sellerPostalCode: { type: String },
  sellerBuildingNumber: { type: String },
  sellerDistrict: { type: String },
  sellerCountry: { type: String, default: 'SA' },
  branchId: { type: String },

  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  customerVatNumber: { type: String },
  customerAddress: { type: String },

  invoiceType: { type: String, enum: ['standard', 'simplified', 'debit_note', 'credit_note'], default: 'simplified' },
  invoiceTypeCode: { type: String, default: '388' },
  transactionType: { type: String, enum: ['B2B', 'B2C'], default: 'B2C' },

  items: { type: Schema.Types.Mixed, required: true },

  subtotal: { type: Number, required: true },
  totalDiscountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },

  paymentMethod: { type: String, enum: ["cash", "pos", "apple_pay", "pos-network", "alinma", "rajhi", "ur", "barq", "qahwa-card", "stc-pay", "mada", "geidea", "neoleap", "neoleap-apple-pay", "bank_card", "paymob-card", "paymob-wallet", "loyalty-card"], required: true },
  paymentMeans: { type: String },

  invoiceCounter: { type: Number, required: true },
  previousInvoiceHash: { type: String },
  invoiceHash: { type: String, required: true },
  qrCode: { type: String, required: true },
  xmlContent: { type: String },
  pdfUrl: { type: String },

  invoiceDate: { type: Date, required: true },
  supplyDate: { type: Date },

  zatcaStatus: { type: String, enum: ['pending', 'submitted', 'accepted', 'rejected', 'cleared'], default: 'pending' },
  zatcaSubmissionId: { type: String },
  zatcaResponse: { type: String },

  createdBy: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TaxInvoiceSchema.index({ invoiceDate: -1 });
TaxInvoiceSchema.index({ branchId: 1, invoiceDate: -1 });
TaxInvoiceSchema.index({ zatcaStatus: 1 });

export const TaxInvoiceModel = mongoose.model<ITaxInvoice>("TaxInvoice", TaxInvoiceSchema);

// ===== ACCOUNTING SYSTEM MODELS =====

// Revenue Tracking - الإيرادات
export interface IRevenue extends Document {
  branchId: string;
  date: Date;
  orderId?: string;
  invoiceId?: string;
  category: 'sales' | 'delivery_fee' | 'service_charge' | 'other';
  description?: string;
  grossAmount: number; // Before VAT
  vatAmount: number;
  netAmount: number; // After VAT
  paymentMethod: string;
  employeeId?: string;
  notes?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const RevenueSchema = new Schema<IRevenue>({
  branchId: { type: String, required: true },
  date: { type: Date, required: true },
  orderId: { type: String },
  invoiceId: { type: String },
  category: { type: String, enum: ['sales', 'delivery_fee', 'service_charge', 'other'], default: 'sales' },
  description: { type: String },
  grossAmount: { type: Number, required: true },
  vatAmount: { type: Number, required: true },
  netAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ["cash", "pos", "apple_pay", "pos-network", "alinma", "rajhi", "ur", "barq", "qahwa-card", "stc-pay", "mada", "geidea", "neoleap", "neoleap-apple-pay", "bank_card", "paymob-card", "paymob-wallet", "loyalty-card"], required: true },
  employeeId: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

RevenueSchema.index({ branchId: 1, date: -1 });
RevenueSchema.index({ category: 1 });

export const RevenueModel = mongoose.model<IRevenue>("Revenue", RevenueSchema);

// Expense Tracking - المصروفات
export interface IExpense extends Document {
  branchId: string;
  date: Date;
  category: 'inventory' | 'salaries' | 'rent' | 'utilities' | 'marketing' | 'maintenance' | 'supplies' | 'other';
  subcategory?: string;
  description: string;
  amount: number;
  vatAmount?: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other';
  vendorName?: string;
  vendorVatNumber?: string;
  invoiceNumber?: string;
  receiptUrl?: string;
  approvedBy?: string;
  createdBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  notes?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>({
  branchId: { type: String, required: true },
  date: { type: Date, required: true },
  category: { type: String, enum: ['inventory', 'salaries', 'rent', 'utilities', 'marketing', 'maintenance', 'supplies', 'other'], required: true },
  subcategory: { type: String },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  vatAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'credit_card', 'check', 'other'], required: true },
  vendorName: { type: String },
  vendorVatNumber: { type: String },
  invoiceNumber: { type: String },
  receiptUrl: { type: String },
  approvedBy: { type: String },
  createdBy: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ExpenseSchema.index({ branchId: 1, date: -1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ status: 1 });

export const ExpenseModel = mongoose.model<IExpense>("Expense", ExpenseSchema);

// Daily Cash Register - الصندوق اليومي
export interface ICashRegister extends Document {
  branchId: string;
  date: Date;
  employeeId: string;

  // Opening
  openingBalance: number;
  openingTime: Date;

  // Transactions
  cashSales: number;
  cardSales: number;
  otherSales: number;

  // Expenses
  cashExpenses: number;

  // Deposits/Withdrawals
  deposits: number;
  withdrawals: number;

  // Closing
  expectedCash: number;
  actualCash: number;
  difference: number;
  closingTime?: Date;
  closedBy?: string;

  // Status
  status: 'open' | 'closed';
  notes?: string;

  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CashRegisterSchema = new Schema<ICashRegister>({
  branchId: { type: String, required: true },
  date: { type: Date, required: true },
  employeeId: { type: String, required: true },

  openingBalance: { type: Number, required: true },
  openingTime: { type: Date, required: true },

  cashSales: { type: Number, default: 0 },
  cardSales: { type: Number, default: 0 },
  otherSales: { type: Number, default: 0 },

  cashExpenses: { type: Number, default: 0 },

  deposits: { type: Number, default: 0 },
  withdrawals: { type: Number, default: 0 },

  expectedCash: { type: Number, default: 0 },
  actualCash: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  closingTime: { type: Date },
  closedBy: { type: String },

  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  notes: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CashRegisterSchema.index({ branchId: 1, date: -1 });
CashRegisterSchema.index({ employeeId: 1, date: -1 });

export const CashRegisterModel = mongoose.model<ICashRegister>("CashRegister", CashRegisterSchema);

// Daily Accounting Summary - ملخص المحاسبة اليومي
export interface IDailySummary extends Document {
  branchId: string;
  date: Date;

  // Revenue
  totalOrders: number;
  totalRevenue: number;
  totalVatCollected: number;

  // Revenue by Payment Method
  cashRevenue: number;
  cardRevenue: number;
  otherRevenue: number;

  // Revenue by Category
  salesRevenue: number;
  deliveryRevenue: number;

  // Cost of Goods Sold (COGS)
  totalCogs: number;

  // Expenses
  totalExpenses: number;

  // Profit
  grossProfit: number; // Revenue - COGS
  netProfit: number; // Gross Profit - Expenses
  profitMargin: number; // (Net Profit / Revenue) * 100

  // Discounts Given
  totalDiscounts: number;

  // Cancelled Orders
  cancelledOrders: number;
  cancelledAmount: number;

  // Generated automatically
  isGenerated: number;
  generatedAt?: Date;

  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailySummarySchema = new Schema<IDailySummary>({
  branchId: { type: String, required: true },
  date: { type: Date, required: true },

  totalOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalVatCollected: { type: Number, default: 0 },

  cashRevenue: { type: Number, default: 0 },
  cardRevenue: { type: Number, default: 0 },
  otherRevenue: { type: Number, default: 0 },

  salesRevenue: { type: Number, default: 0 },
  deliveryRevenue: { type: Number, default: 0 },

  totalCogs: { type: Number, default: 0 },

  totalExpenses: { type: Number, default: 0 },

  grossProfit: { type: Number, default: 0 },
  netProfit: { type: Number, default: 0 },
  profitMargin: { type: Number, default: 0 },

  totalDiscounts: { type: Number, default: 0 },

  cancelledOrders: { type: Number, default: 0 },
  cancelledAmount: { type: Number, default: 0 },

  isGenerated: { type: Number, default: 0 },
  generatedAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DailySummarySchema.index({ branchId: 1, date: -1 }, { unique: true });

export const DailySummaryModel = mongoose.model<IDailySummary>("DailySummary", DailySummarySchema);

// Kitchen Order Queue - طلبات المطبخ
export interface IKitchenOrder extends Document {
  orderId: string;
  orderNumber: string;
  branchId: string;
  items: Array<{
    itemId: string;
    nameAr: string;
    quantity: number;
    notes?: string;
    status: 'pending' | 'preparing' | 'ready';
    preparedBy?: string;
    preparedAt?: Date;
  }>;
  priority: 'normal' | 'high' | 'urgent';
  orderType: 'dine-in' | 'takeaway' | 'delivery';
  tableNumber?: string;
  customerName?: string;
  status: 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
  assignedTo?: string; // Cook/Barista ID
  startedAt?: Date;
  completedAt?: Date;
  estimatedTime?: number; // in minutes
  notes?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const KitchenOrderSchema = new Schema<IKitchenOrder>({
  orderId: { type: String, required: true },
  orderNumber: { type: String, required: true },
  branchId: { type: String, required: true },
  items: [{
    itemId: { type: String, required: true },
    nameAr: { type: String, required: true },
    quantity: { type: Number, required: true },
    notes: { type: String },
    status: { type: String, enum: ['pending', 'preparing', 'ready'], default: 'pending' },
    preparedBy: { type: String },
    preparedAt: { type: Date },
  }],
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  orderType: { type: String, enum: ['dine-in', 'takeaway', 'delivery'], required: true },
  tableNumber: { type: String },
  customerName: { type: String },
  status: { type: String, enum: ['pending', 'in_progress', 'ready', 'completed', 'cancelled'], default: 'pending' },
  assignedTo: { type: String },
  startedAt: { type: Date },
  completedAt: { type: Date },
  estimatedTime: { type: Number },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

KitchenOrderSchema.index({ branchId: 1, status: 1 });
KitchenOrderSchema.index({ assignedTo: 1, status: 1 });
KitchenOrderSchema.index({ createdAt: -1 });

export const KitchenOrderModel = mongoose.model<IKitchenOrder>("KitchenOrder", KitchenOrderSchema);

export interface IAttendance extends Document {
  employeeId: string;
  branchId: string;
  checkInTime: Date;
  checkOutTime?: Date;
  checkInLocation: {
    lat: number;
    lng: number;
  };
  checkOutLocation?: {
    lat: number;
    lng: number;
  };
  checkInPhoto: string;
  checkOutPhoto?: string;
  status: 'checked_in' | 'checked_out' | 'late' | 'absent';
  shiftDate: Date;
  notes?: string;
  isLate: number;
  lateMinutes?: number;
  isAtBranch?: number;
  distanceFromBranch?: number;
  checkOutIsAtBranch?: number;
  checkOutDistanceFromBranch?: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>({
  employeeId: { type: String, required: true },
  branchId: { type: String },
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date },
  checkInLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  checkOutLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },
  checkInPhoto: { type: String },
  checkOutPhoto: { type: String },
  status: { type: String, enum: ['checked_in', 'checked_out', 'late', 'absent'], default: 'checked_in', required: true },
  shiftDate: { type: Date, required: true },
  notes: { type: String },
  isLate: { type: Number, default: 0, required: true },
  lateMinutes: { type: Number },
  isAtBranch: { type: Number, default: 1 },
  distanceFromBranch: { type: Number, default: 0 },
  checkOutIsAtBranch: { type: Number },
  checkOutDistanceFromBranch: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AttendanceSchema.index({ employeeId: 1, shiftDate: 1 });
AttendanceSchema.index({ branchId: 1, shiftDate: 1 });

export const AttendanceModel = mongoose.model<IAttendance>("Attendance", AttendanceSchema);

// ───────────────────────────────────────────────────────────
// Live Location Tracking
// ───────────────────────────────────────────────────────────
export interface ILocationTrack extends Document {
  attendanceId: string;
  employeeId: string;
  branchId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  isInsideBranch: boolean;
  distanceFromBranch: number;
  timestamp: Date;
}

const LocationTrackSchema = new Schema<ILocationTrack>({
  attendanceId: { type: String, required: true },
  employeeId: { type: String, required: true },
  branchId: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number },
  isInsideBranch: { type: Boolean, default: true },
  distanceFromBranch: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

LocationTrackSchema.index({ attendanceId: 1, timestamp: 1 });
LocationTrackSchema.index({ employeeId: 1, timestamp: -1 });
LocationTrackSchema.index({ branchId: 1, timestamp: -1 });

export const LocationTrackModel = mongoose.model<ILocationTrack>("LocationTrack", LocationTrackSchema);

export const insertCoffeeItemSchema = z.object({
  id: z.string(),
  tenantId: z.string().optional(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  description: z.string(),
  price: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  oldPrice: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  category: z.string(),
  imageUrl: z.string().optional(),
  isAvailable: z.number().optional(),
  availabilityStatus: z.string().optional(),
  coffeeStrength: z.string().optional(),
  strengthLevel: z.number().optional(),
  isNewProduct: z.number().optional(),
  createdByEmployeeId: z.string().optional(),
  createdByBranchId: z.string().optional(),
  publishedBranches: z.array(z.string()).optional(),
  availableSizes: z.array(z.object({
    nameAr: z.string(),
    nameEn: z.string().optional(),
    price: z.number(),
    sizeML: z.number().optional(),
    sku: z.string().optional(),
    imageUrl: z.string().optional(),
  })).optional(),
  addons: z.array(z.object({
    id: z.string().optional(),
    nameAr: z.string(),
    nameEn: z.string().optional(),
    price: z.number(),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    section: z.string().optional(),
    selectionType: z.enum(['single', 'multiple']).optional(),
  })).optional(),
  isGiftable: z.boolean().optional(),
});

export const insertEmployeeSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
  fullName: z.string(),
  role: z.string(),
  title: z.string().optional(),
  phone: z.string(),
  jobTitle: z.string(),
  imageUrl: z.string().optional(),
  shiftTime: z.string().optional().nullable(),
  shiftStartTime: z.string().optional(),
  shiftEndTime: z.string().optional(),
  commissionPercentage: z.number().optional(),
  deviceBalance: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val) : val).optional(),
  isActivated: z.number().optional(),
  branchId: z.string().optional(),
  employmentNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  vehiclePlateNumber: z.string().optional(),
  vehicleColor: z.string().optional(),
  licenseNumber: z.string().optional(),
  isAvailableForDelivery: z.number().optional(),
  permissions: z.array(z.string()).optional(),
  allowedPages: z.array(z.string()).optional(),
  currentLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    updatedAt: z.date().optional(),
  }).optional(),
});

export interface IEmployee extends Document {
  id: string;
  tenantId?: string;
  username: string;
  email?: string;
  password?: string;
  fullName: string;
  role: string;
  title?: string;
  phone: string;
  jobTitle: string;
  imageUrl?: string;
  shiftTime?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  workDays?: string[];
  salary?: number;
  commissionPercentage?: number;
  deviceBalance?: number;
  isActivated: number;
  isActive: number;
  branchId?: string;
  employmentNumber?: string;
  vehicleType?: string;
  vehiclePlateNumber?: string;
  vehicleColor?: string;
  licenseNumber?: string;
  isAvailableForDelivery?: number;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt?: Date;
  };
  permissions?: string[];
  allowedPages?: string[];
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String },
  username: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  password: { type: String },
  fullName: { type: String, required: true },
  role: { type: String, required: true },
  title: { type: String },
  phone: { type: String, required: true, unique: true },
  jobTitle: { type: String, required: true },
  imageUrl: { type: String },
  shiftTime: { type: String },
  shiftStartTime: { type: String },
  shiftEndTime: { type: String },
  workDays: [{ type: String }],
  salary: { type: Number, default: 0 },
  commissionPercentage: { type: Number },
  deviceBalance: { type: Number, default: 0 },
  isActivated: { type: Number, default: 0 },
  isActive: { type: Number, default: 1 },
  branchId: { type: String },
  employmentNumber: { type: String },
  vehicleType: { type: String },
  vehiclePlateNumber: { type: String },
  vehicleColor: { type: String },
  licenseNumber: { type: String },
  isAvailableForDelivery: { type: Number, default: 0 },
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    updatedAt: { type: Date }
  },
  permissions: [{ type: String }],
  allowedPages: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

EmployeeSchema.index({ tenantId: 1, role: 1 });
EmployeeSchema.index({ tenantId: 1, branchId: 1, isActive: 1 });
EmployeeSchema.index({ tenantId: 1, isActive: 1 });

export const EmployeeModel = mongoose.model<IEmployee>("Employee", EmployeeSchema);

// نظام الإشعارات للمديرين - Manager Notifications
export interface IManagerNotification extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  managerId?: string;
  employeeId: string;
  employeeName: string;
  type: 'late_checkin' | 'left_branch' | 'no_checkin' | 'early_checkout' | 'overtime';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  isResolved: boolean;
  metadata?: {
    shiftStartTime?: string;
    actualCheckInTime?: string;
    lateMinutes?: number;
    distanceFromBranch?: number;
    location?: { lat: number; lng: number };
  };
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const ManagerNotificationSchema = new Schema<IManagerNotification>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  managerId: { type: String },
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['late_checkin', 'left_branch', 'no_checkin', 'early_checkout', 'overtime'],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
  isRead: { type: Boolean, default: false },
  isResolved: { type: Boolean, default: false },
  metadata: {
    shiftStartTime: { type: String },
    actualCheckInTime: { type: String },
    lateMinutes: { type: Number },
    distanceFromBranch: { type: Number },
    location: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  createdAt: { type: Date, default: Date.now },
});

ManagerNotificationSchema.index({ branchId: 1, isRead: 1 });
ManagerNotificationSchema.index({ managerId: 1, isRead: 1 });
ManagerNotificationSchema.index({ employeeId: 1, createdAt: -1 });

export const ManagerNotificationModel = mongoose.model<IManagerNotification>("ManagerNotification", ManagerNotificationSchema);

// نظام الورديات - Shift Management
export interface IShift extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  nameAr: string;
  startTime: string; // HH:mm format
  endTime: string;
  breakDurationMinutes: number;
  isOvernight: boolean; // للورديات التي تمتد لليوم التالي
  isActive: boolean;
  color?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const ShiftSchema = new Schema<IShift>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  breakDurationMinutes: { type: Number, default: 60 },
  isOvernight: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  color: { type: String, default: '#9FB2B3' },
  createdAt: { type: Date, default: Date.now },
});

ShiftSchema.index({ branchId: 1, isActive: 1 });

export const ShiftModel = mongoose.model<IShift>("Shift", ShiftSchema);

// جدول الموظفين في الورديات - Employee Shift Assignments
export interface IEmployeeShiftAssignment extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  employeeId: string;
  shiftId: string;
  dayOfWeek: number; // 0-6 (الأحد-السبت)
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const EmployeeShiftAssignmentSchema = new Schema<IEmployeeShiftAssignment>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  employeeId: { type: String, required: true },
  shiftId: { type: String, required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

EmployeeShiftAssignmentSchema.index({ employeeId: 1, dayOfWeek: 1, isActive: 1 });
EmployeeShiftAssignmentSchema.index({ branchId: 1, shiftId: 1 });

export const EmployeeShiftAssignmentModel = mongoose.model<IEmployeeShiftAssignment>("EmployeeShiftAssignment", EmployeeShiftAssignmentSchema);

export const insertOrderSchema = z.object({
  items: z.any(),
  totalAmount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  paymentMethod: z.string(),
  paymentDetails: z.string().optional(),
  paymentReceiptUrl: z.string().optional(),
  status: z.string().optional(),
  tableStatus: z.enum(['pending', 'payment_confirmed', 'preparing', 'ready', 'delivered', 'cancelled']).optional(),
  orderType: z.enum(['regular', 'table', 'dine_in', 'dine-in']).optional(),
  customerInfo: z.any().optional(),
  customerId: z.string().optional(),
  employeeId: z.string().optional(),
  assignedCashierId: z.string().optional(),
  branchId: z.string().optional(),
  tableNumber: z.string().optional(),
  tableId: z.string().optional(),
  customerNotes: z.string().optional(),
  cancellationReason: z.string().optional(),
  cancelledBy: z.enum(['customer', 'cashier']).optional(),
  carPickup: z.any().optional(),
  carType: z.string().optional(),
  carColor: z.string().optional(),
  carPlate: z.string().optional(),
  deliveryType: z.enum(['pickup', 'delivery', 'dine-in', 'curbside', 'car_pickup', 'car-pickup']).optional(),
  deliveryAddress: z.object({
    fullAddress: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    zone: z.string().optional(),
    isInDeliveryZone: z.boolean().optional(),
  }).optional(),
  deliveryFee: z.number().optional(),
  driverId: z.string().optional(),
  driverLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    updatedAt: z.date().optional(),
  }).optional(),
  deliveryStatus: z.string().optional(),
  deliveryStartedAt: z.date().optional(),
  estimatedDeliveryTime: z.date().optional(),
  deliveredAt: z.date().optional(),
  costOfGoods: z.number().optional(),
  grossProfit: z.number().optional(),
  inventoryDeducted: z.number().optional(),
  inventoryDeductionDetails: z.array(z.object({
    rawItemId: z.string(),
    rawItemName: z.string(),
    quantity: z.number(),
    unit: z.string(),
    unitCost: z.number(),
    totalCost: z.number(),
  })).optional(),
}).refine((data) => {
  const requiresReceipt = ['alinma', 'ur', 'barq', 'rajhi'].includes(data.paymentMethod);
  if (requiresReceipt && !data.paymentReceiptUrl) {
    return false;
  }
  return true;
}, {
  message: "إيصال الدفع مطلوب لطرق الدفع الإلكترونية",
  path: ["paymentReceiptUrl"],
}).refine((data) => {
  if (data.deliveryType === 'delivery' && !data.deliveryAddress) {
    return false;
  }
  return true;
}, {
  message: "عنوان التوصيل مطلوب لطلبات التوصيل",
  path: ["deliveryAddress"],
});

export const insertOrderItemSchema = z.object({
  orderId: z.string(),
  coffeeItemId: z.string(),
  quantity: z.number(),
  unitPrice: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
  totalPrice: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val),
});

export const insertCartItemSchema = z.object({
  sessionId: z.string(),
  coffeeItemId: z.string(),
  quantity: z.number(),
});

export const insertCustomerSchema = z.object({
  phone: z.string(),
  email: z.string().email("البريد الإلكتروني غير صالح").optional(),
  name: z.string().min(2, "الاسم يجب أن يكون على الأقل حرفين"),
  password: z.string().min(4, "كلمة المرور يجب أن تكون على الأقل 4 أحرف").optional(),
  registeredBy: z.enum(['self', 'cashier']).optional(),
  isPasswordSet: z.number().optional(),
  points: z.number().optional(),
  carType: z.string().optional(),
  carColor: z.string().optional(),
  saveCarInfo: z.number().optional(),
});

export const insertPasswordResetTokenSchema = z.object({
  email: z.string(),
  token: z.string(),
  expiresAt: z.date(),
});

export const insertDiscountCodeSchema = z.object({
  code: z.string(),
  discountPercentage: z.number(),
  reason: z.string(),
  employeeId: z.string(),
  isActive: z.number().optional(),
  visibleToCustomers: z.boolean().optional(),
});

export const insertLoyaltyCardSchema = z.object({
  customerName: z.string().optional(),
  phoneNumber: z.string(),
  cardNumber: z.string().optional(),
  qrToken: z.string().optional(),
  customerId: z.string().optional(),
});

export const insertCardCodeSchema = z.object({
  issuedForOrderId: z.string(),
  drinkName: z.string(),
});

export const insertLoyaltyTransactionSchema = z.object({
  cardId: z.string(),
  orderId: z.string().optional(),
  type: z.string(),
  pointsChange: z.number(),
  discountAmount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  orderAmount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  description: z.string().optional(),
  employeeId: z.string().optional(),
});

export const insertLoyaltyRewardSchema = z.object({
  nameAr: z.string(),
  nameEn: z.string().optional(),
  description: z.string(),
  pointsCost: z.number(),
  discountPercentage: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  discountAmount: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseFloat(val) : val).optional(),
  tier: z.string().optional(),
  isActive: z.number().optional(),
});

export const insertIngredientSchema = z.object({
  nameAr: z.string(),
  nameEn: z.string().optional(),
  isAvailable: z.number().optional(),
  icon: z.string().optional(),
});

export const insertCoffeeItemIngredientSchema = z.object({
  coffeeItemId: z.string(),
  ingredientId: z.string(),
});

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const insertBranchSchema = z.object({
  nameAr: z.string().min(2, "اسم الفرع مطلوب"),
  nameEn: z.string().optional(),
  address: z.string().min(5, "العنوان مطلوب"),
  phone: z.string().min(9, "رقم الهاتف مطلوب"),
  city: z.string().min(2, "المدينة مطلوبة"),
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  mapsUrl: z.string().optional(),
  isActive: z.number().optional(),
  managerName: z.string().optional(),
});

export const insertCategorySchema = z.object({
  nameAr: z.string().min(2, "اسم الفئة مطلوب"),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().optional(),
  isActive: z.number().optional(),
});

// insertDeliveryZoneSchema تعريفه في نهاية الملف

export const insertTableSchema = z.object({
  tableNumber: z.string().min(1, "رقم الطاولة مطلوب"),
  qrToken: z.string().optional(),
  branchId: z.string().min(1, "معرّف الفرع مطلوب"),
  capacity: z.number().optional(),
  location: z.string().optional(),
  isActive: z.number().optional(),
  isOccupied: z.number().optional(),
  currentOrderId: z.string().optional(),
  reservedFor: z.object({
    customerName: z.string(),
    customerPhone: z.string(),
    customerId: z.string().optional(),
    reservationDate: z.coerce.date().optional(),
    reservationTime: z.string().optional(),
    numberOfGuests: z.number().optional(),
    reservedAt: z.coerce.date().optional(),
    reservedBy: z.string(),
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  }).optional(),
});

export const insertAttendanceSchema = z.object({
  employeeId: z.string(),
  branchId: z.string(),
  checkInTime: z.coerce.date(),
  checkOutTime: z.coerce.date().optional(),
  checkInLocation: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  checkOutLocation: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  checkInPhoto: z.string(),
  checkOutPhoto: z.string().optional(),
  status: z.enum(['checked_in', 'checked_out', 'late', 'absent']).optional(),
  shiftDate: z.coerce.date(),
  notes: z.string().optional(),
  isLate: z.number().optional(),
  lateMinutes: z.number().optional(),
});

// Types for insertion
export type InsertCoffeeItem = z.infer<typeof insertCoffeeItemSchema>;

export type CoffeeItem = ICoffeeItem;
export type Category = ICategory;
export type Branch = IBranch;
// DeliveryZone type تعريفه في نهاية الملف
export type Table = ITable;

export type Customer = ICustomer;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Employee = IEmployee;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type DiscountCode = IDiscountCode;
export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;

export type Order = IOrder;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = IOrderItem;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type CartItem = ICartItem;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

export type PasswordResetToken = IPasswordResetToken;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type LoyaltyCard = ILoyaltyCard;
export type InsertLoyaltyCard = z.infer<typeof insertLoyaltyCardSchema>;

export type CardCode = ICardCode;
export type InsertCardCode = z.infer<typeof insertCardCodeSchema>;

export type LoyaltyTransaction = ILoyaltyTransaction;
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;

export type LoyaltyReward = ILoyaltyReward;
export type InsertLoyaltyReward = z.infer<typeof insertLoyaltyRewardSchema>;

export type Ingredient = IIngredient;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;

export type CoffeeItemIngredient = ICoffeeItemIngredient;
export type InsertCoffeeItemIngredient = z.infer<typeof insertCoffeeItemIngredientSchema>;

export type User = IUser;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
// InsertDeliveryZone تعريفه في نهاية الملف
export type InsertTable = z.infer<typeof insertTableSchema>;

export type Attendance = IAttendance;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type PaymentMethod = 'cash' | 'qahwa-card' | 'loyalty-card' | 'pos' | 'pos-network' | 'geidea' | 'apple-pay' | 'apple_pay' | 'mada' | 'alinma' | 'rajhi' | 'ur' | 'barq' | 'neoleap' | 'neoleap-apple-pay' | 'copy-card' | 'stc-pay';

export interface PaymentMethodInfo {
  id: PaymentMethod;
  nameAr: string;
  nameEn: string;
  details: string;
  icon: string;
  requiresReceipt?: boolean;
  cardNumber?: string;
  discount?: number;
  discountPercentage?: number;
  cashMaxDistance?: number;
  storeLocation?: { lat?: number; lng?: number } | null;
}
export type JobTitle = 'كاشير' | 'محاسب' | 'بائع' | 'عارض' | 'سائق' | 'مدير' | 'مالك';

export type OrderStatus = 'pending' | 'payment_confirmed' | 'in_progress' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';

export type CoffeeCategory = 'basic' | 'hot' | 'cold' | 'specialty' | 'desserts';

export type CoffeeStrength = 'classic' | 'mild' | 'medium' | 'strong';

export interface CoffeeStrengthInfo {
  id: CoffeeStrength;
  nameAr: string;
  nameEn: string;
  description: string;
  levelRange: string;
  color: string;
  icon: string;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTierInfo {
  id: LoyaltyTier;
  nameAr: string;
  nameEn: string;
  pointsRequired: number;
  benefits: string[];
  color: string;
  icon: string;
}

// ================== INVENTORY MANAGEMENT MODELS ==================

// المواد الخام - Raw Items
export interface IRawItem extends Document {
  id: string;
  tenantId?: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  category: 'ingredient' | 'packaging' | 'equipment' | 'consumable' | 'other';
  unit: 'kg' | 'g' | 'liter' | 'ml' | 'piece' | 'box' | 'bag';
  unitCost: number;
  lastCost?: number;
  currentStock?: number;
  currentStockLevel?: number;
  minStockLevel: number;
  maxStockLevel?: number;
  supplierId?: string;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

const RawItemSchema = new Schema<IRawItem>({
  code: { type: String, required: true, unique: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  description: { type: String },
  category: { type: String, enum: ['ingredient', 'packaging', 'equipment', 'consumable', 'other'], required: true },
  unit: { type: String, enum: ['kg', 'g', 'liter', 'ml', 'piece', 'box', 'bag'], required: true },
  tenantId: { type: String },
  unitCost: { type: Number, required: true, default: 0 },
  lastCost: { type: Number },
  currentStock: { type: Number, default: 0 },
  currentStockLevel: { type: Number, default: 0 },
  minStockLevel: { type: Number, required: true, default: 0 },
  maxStockLevel: { type: Number },
  supplierId: { type: String },
  isActive: { type: Number, default: 1, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const RawItemModel = mongoose.model<IRawItem>("RawItem", RawItemSchema);

// الموردين - Suppliers
export interface ISupplier extends Document {
  code: string;
  nameAr: string;
  nameEn?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>({
  code: { type: String, required: true, unique: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  contactPerson: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  city: { type: String },
  taxNumber: { type: String },
  paymentTerms: { type: String },
  notes: { type: String },
  isActive: { type: Number, default: 1, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const SupplierModel = mongoose.model<ISupplier>("Supplier", SupplierSchema);

// مخزون الفرع - Branch Stock
export interface IBranchStock extends Document {
  branchId: string;
  rawItemId: string;
  currentQuantity: number;
  reservedQuantity: number;
  lastUpdated: Date;
  lastCountDate?: Date;
  notes?: string;
}

const BranchStockSchema = new Schema<IBranchStock>({
  branchId: { type: String, required: true },
  rawItemId: { type: String, required: true },
  currentQuantity: { type: Number, required: true, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  lastCountDate: { type: Date },
  notes: { type: String },
});

BranchStockSchema.index({ branchId: 1, rawItemId: 1 }, { unique: true });

export const BranchStockModel = mongoose.model<IBranchStock>("BranchStock", BranchStockSchema);

// تحويلات المخزون - Stock Transfers
export interface IStockTransfer extends Document {
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  items: Array<{
    rawItemId: string;
    quantity: number;
    notes?: string;
  }>;
  requestedBy: string;
  approvedBy?: string;
  completedBy?: string;
  requestDate: Date;
  approvalDate?: Date;
  completionDate?: Date;
  notes?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const StockTransferSchema = new Schema<IStockTransfer>({
  transferNumber: { type: String, required: true, unique: true },
  fromBranchId: { type: String, required: true },
  toBranchId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'in_transit', 'completed', 'cancelled'], default: 'pending', required: true },
  items: [{
    rawItemId: { type: String, required: true },
    quantity: { type: Number, required: true },
    notes: { type: String }
  }],
  requestedBy: { type: String, required: true },
  approvedBy: { type: String },
  requestDate: { type: Date, default: Date.now },
  approvalDate: { type: Date },
  completionDate: { type: Date },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const StockTransferModel = mongoose.model<IStockTransfer>("StockTransfer", StockTransferSchema);

// فواتير الشراء - Purchase Invoices
export interface IPurchaseInvoice extends Document {
  invoiceNumber: string;
  supplierId: string;
  branchId: string;
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
  items: Array<{
    rawItemId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    notes?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paidAmount: number;
  invoiceDate: Date;
  dueDate?: Date;
  receivedDate?: Date;
  receivedBy?: string;
  createdBy: string;
  approvedBy?: string;
  notes?: string;
  attachmentUrl?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseInvoiceSchema = new Schema<IPurchaseInvoice>({
  invoiceNumber: { type: String, required: true, unique: true },
  supplierId: { type: String, required: true },
  branchId: { type: String, required: true },
  status: { type: String, enum: ['draft', 'pending', 'approved', 'received', 'cancelled'], default: 'draft', required: true },
  items: [{
    rawItemId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    notes: { type: String }
  }],
  subtotal: { type: Number, required: true, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid', required: true },
  paidAmount: { type: Number, default: 0 },
  invoiceDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date },
  receivedDate: { type: Date },
  receivedBy: { type: String },
  createdBy: { type: String, required: true },
  approvedBy: { type: String },
  notes: { type: String },
  attachmentUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const PurchaseInvoiceModel = mongoose.model<IPurchaseInvoice>("PurchaseInvoice", PurchaseInvoiceSchema);

// وصفة المنتج - Recipe (ربط المنتجات بالمواد الخام مع الكميات)
export interface IRecipeItem extends Document {
  coffeeItemId: string;
  rawItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RecipeItemSchema = new Schema<IRecipeItem>({
  coffeeItemId: { type: String, required: true },
  rawItemId: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

RecipeItemSchema.index({ coffeeItemId: 1, rawItemId: 1 }, { unique: true });

export const RecipeItemModel = mongoose.model<IRecipeItem>("RecipeItem", RecipeItemSchema);

// ============ RECIPE COMPLETE MODEL (Phase 1) ============
// Recipe container with versioning and cost calculation
export interface IRecipe extends Document {
  coffeeItemId: string;
  nameAr: string;
  nameEn?: string;
  version: number;
  isActive: boolean;
  totalCost: number; // Calculated cost of all ingredients
  ingredients: Array<{
    rawItemId: string;
    rawItemName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RecipeSchema = new Schema<IRecipe>({
  coffeeItemId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  version: { type: Number, default: 1, required: true },
  isActive: { type: Boolean, default: true, required: true },
  totalCost: { type: Number, default: 0, required: true },
  ingredients: [{
    rawItemId: { type: String, required: true },
    rawItemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    unitCost: { type: Number, required: true },
    totalCost: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

RecipeSchema.index({ coffeeItemId: 1, version: -1 });
RecipeSchema.index({ isActive: 1 });

export const RecipeModel = mongoose.model<IRecipe>("Recipe", RecipeSchema);

// تنبيهات المخزون - Stock Alerts
export interface IStockAlert extends Document {
  branchId: string;
  rawItemId: string;
  alertType: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';
  currentQuantity: number;
  thresholdQuantity: number;
  isRead: number;
  isResolved: number;
  resolvedBy?: string;
  resolvedAt?: Date;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const StockAlertSchema = new Schema<IStockAlert>({
  branchId: { type: String, required: true },
  rawItemId: { type: String, required: true },
  alertType: { type: String, enum: ['low_stock', 'out_of_stock', 'expiring_soon', 'expired'], required: true },
  currentQuantity: { type: Number, required: true },
  thresholdQuantity: { type: Number, required: true },
  isRead: { type: Number, default: 0, required: true },
  isResolved: { type: Number, default: 0, required: true },
  resolvedBy: { type: String },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

StockAlertSchema.index({ branchId: 1, isResolved: 1 });

export const StockAlertModel = mongoose.model<IStockAlert>("StockAlert", StockAlertSchema);

// حركات المخزون - Stock Movements (للتتبع)
export interface IStockMovement extends Document {
  branchId: string;
  rawItemId: string;
  movementType: 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'waste' | 'return';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType?: 'purchase_invoice' | 'order' | 'transfer' | 'manual';
  referenceId?: string;
  notes?: string;
  createdBy: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>({
  branchId: { type: String, required: true },
  rawItemId: { type: String, required: true },
  movementType: { type: String, enum: ['purchase', 'sale', 'transfer_in', 'transfer_out', 'adjustment', 'waste', 'return'], required: true },
  quantity: { type: Number, required: true },
  previousQuantity: { type: Number, required: true },
  newQuantity: { type: Number, required: true },
  referenceType: { type: String, enum: ['purchase_invoice', 'order', 'transfer', 'manual'] },
  referenceId: { type: String },
  notes: { type: String },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

StockMovementSchema.index({ branchId: 1, rawItemId: 1 });
StockMovementSchema.index({ createdAt: -1 });

export const StockMovementModel = mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);

// PHASE 2: Unit Conversion Model
export interface IUnitConversion extends Document {
  tenantId: string;
  fromUnit: string;
  toUnit: string;
  conversionFactor: number; // e.g., g to kg = 0.001
  formula?: string; // For complex conversions
}

const UnitConversionSchema = new Schema<IUnitConversion>({
  tenantId: { type: String, required: true },
  fromUnit: { type: String, required: true },
  toUnit: { type: String, required: true },
  conversionFactor: { type: Number, required: true },
  formula: { type: String }
});

UnitConversionSchema.index({ tenantId: 1, fromUnit: 1, toUnit: 1 });
export const UnitConversionModel = mongoose.model<IUnitConversion>("UnitConversion", UnitConversionSchema);

// PHASE 2: Stock Alert Model (Enhanced)
export interface IStockAlertEnhanced extends IStockAlert {
  branchId: string;
  rawItemId: string;
  alertType: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';
  severity: 'low' | 'medium' | 'high';
  actionTaken?: string;
}

// Zod Schemas for validation
export const insertRawItemSchema = z.object({
  code: z.string(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(['ingredient', 'packaging', 'equipment', 'consumable', 'other']),
  unit: z.enum(['kg', 'g', 'liter', 'ml', 'piece', 'box', 'bag']),
  unitCost: z.number().min(0),
  minStockLevel: z.number().min(0),
  maxStockLevel: z.number().min(0).optional(),
  supplierId: z.string().optional(),
  isActive: z.number().default(1),
});

export const insertSupplierSchema = z.object({
  code: z.string(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.number().optional(),
});

export const insertBranchStockSchema = z.object({
  branchId: z.string(),
  rawItemId: z.string(),
  currentQuantity: z.number().min(0),
  reservedQuantity: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const insertStockTransferSchema = z.object({
  fromBranchId: z.string(),
  toBranchId: z.string(),
  items: z.array(z.object({
    rawItemId: z.string(),
    quantity: z.number().positive(),
    notes: z.string().optional(),
  })),
  requestedBy: z.string(),
  notes: z.string().optional(),
});

export const insertPurchaseInvoiceSchema = z.object({
  supplierId: z.string(),
  branchId: z.string(),
  items: z.array(z.object({
    rawItemId: z.string(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    totalCost: z.number().min(0),
    notes: z.string().optional(),
  })),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  createdBy: z.string(),
  notes: z.string().optional(),
});

export const insertRecipeItemSchema = z.object({
  coffeeItemId: z.string(),
  rawItemId: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  notes: z.string().optional(),
});

export const insertStockMovementSchema = z.object({
  branchId: z.string(),
  rawItemId: z.string(),
  movementType: z.enum(['purchase', 'sale', 'transfer_in', 'transfer_out', 'adjustment', 'waste', 'return']),
  quantity: z.number(),
  previousQuantity: z.number(),
  newQuantity: z.number(),
  referenceType: z.enum(['purchase_invoice', 'order', 'transfer', 'manual']).optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
});

// Type exports for inventory
export type RawItem = IRawItem;
export type InsertRawItem = z.infer<typeof insertRawItemSchema>;

export type Supplier = ISupplier;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type BranchStock = IBranchStock;
export type InsertBranchStock = z.infer<typeof insertBranchStockSchema>;

export type StockTransfer = IStockTransfer;
export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;

export type PurchaseInvoice = IPurchaseInvoice;
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;

export type RecipeItem = IRecipeItem;
export type InsertRecipeItem = z.infer<typeof insertRecipeItemSchema>;

export type StockAlert = IStockAlert;

export type StockMovement = IStockMovement;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;

// Inventory category types
export type RawItemCategory = 'ingredient' | 'packaging' | 'equipment' | 'consumable' | 'other';
export type RawItemUnit = 'kg' | 'g' | 'liter' | 'ml' | 'piece' | 'box' | 'bag';
export type StockTransferStatus = 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
export type PurchaseInvoiceStatus = 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
export type PaymentStatusType = 'unpaid' | 'partial' | 'paid';
export type StockAlertType = 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';
export type StockMovementType = 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'waste' | 'return';

// ===== ZATCA & ACCOUNTING TYPE EXPORTS =====

// Tax Invoice Types
export type TaxInvoice = ITaxInvoice;
export type InvoiceType = 'standard' | 'simplified' | 'debit_note' | 'credit_note';
export type TransactionType = 'B2B' | 'B2C';
export type ZatcaStatus = 'pending' | 'submitted' | 'accepted' | 'rejected' | 'cleared';

// Accounting Types
export type Revenue = IRevenue;
export type Expense = IExpense;
export type CashRegister = ICashRegister;
export type DailySummary = IDailySummary;
export type KitchenOrder = IKitchenOrder;

export type ExpenseCategory = 'inventory' | 'salaries' | 'rent' | 'utilities' | 'marketing' | 'maintenance' | 'supplies' | 'other';
export type ExpensePaymentMethod = 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type RevenueCategory = 'sales' | 'delivery_fee' | 'service_charge' | 'other';
export type CashRegisterStatus = 'open' | 'closed';
export type KitchenOrderStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
export type KitchenOrderPriority = 'normal' | 'high' | 'urgent';
export type KitchenOrderType = 'dine-in' | 'takeaway' | 'delivery';

// Zod Schemas for ZATCA Invoice
export const insertTaxInvoiceSchema = z.object({
  orderId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string().optional(),
  customerVatNumber: z.string().optional(),
  customerAddress: z.string().optional(),
  invoiceType: z.enum(['standard', 'simplified', 'debit_note', 'credit_note']).optional(),
  transactionType: z.enum(['B2B', 'B2C']).optional(),
  items: z.array(z.object({
    itemId: z.string(),
    nameAr: z.string(),
    nameEn: z.string().optional(),
    quantity: z.number(),
    unitPrice: z.number(),
    discountAmount: z.number().optional(),
    taxRate: z.number().optional(),
  })),
  paymentMethod: z.string(),
  branchId: z.string().optional(),
  createdBy: z.string().optional(),
});

export type InsertTaxInvoice = z.infer<typeof insertTaxInvoiceSchema>;

// Zod Schemas for Accounting
export const insertExpenseSchema = z.object({
  branchId: z.string(),
  date: z.coerce.date(),
  category: z.enum(['inventory', 'salaries', 'rent', 'utilities', 'marketing', 'maintenance', 'supplies', 'other']),
  subcategory: z.string().optional(),
  description: z.string(),
  amount: z.number().positive(),
  vatAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'credit_card', 'check', 'other']),
  vendorName: z.string().optional(),
  vendorVatNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  receiptUrl: z.string().optional(),
  createdBy: z.string(),
  notes: z.string().optional(),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export const insertRevenueSchema = z.object({
  branchId: z.string(),
  date: z.coerce.date(),
  orderId: z.string().optional(),
  invoiceId: z.string().optional(),
  category: z.enum(['sales', 'delivery_fee', 'service_charge', 'other']).optional(),
  description: z.string().optional(),
  grossAmount: z.number(),
  vatAmount: z.number(),
  netAmount: z.number(),
  paymentMethod: z.string(),
  employeeId: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertRevenue = z.infer<typeof insertRevenueSchema>;

export const insertCashRegisterSchema = z.object({
  branchId: z.string(),
  employeeId: z.string(),
  openingBalance: z.number().min(0),
});

export type InsertCashRegister = z.infer<typeof insertCashRegisterSchema>;

export const insertKitchenOrderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  branchId: z.string(),
  items: z.array(z.object({
    itemId: z.string(),
    nameAr: z.string(),
    quantity: z.number(),
    notes: z.string().optional(),
  })),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  orderType: z.enum(['dine-in', 'takeaway', 'delivery']),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertKitchenOrder = z.infer<typeof insertKitchenOrderSchema>;

// Employee Role Types (including new roles)
export type EmployeeRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'driver' | 'barista' | 'cook' | 'waiter';

// Zod Schemas for Product Addons
export const insertProductAddonSchema = z.object({
  id: z.string(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  category: z.enum(['sugar', 'milk', 'shot', 'syrup', 'topping', 'size', 'other', 'flavor', 'Flavor', 'Shot']),
  price: z.number().min(0),
  isAvailable: z.number().optional().default(1),
  isFree: z.number().optional(),
  rawItemId: z.string().optional(),
  quantityPerUnit: z.number().optional(),
  unit: z.string().optional(),
  orderIndex: z.number().optional(),
  sku: z.string().optional(),
  imageUrl: z.string().optional(),
  isAddonDrink: z.boolean().optional(),
  isIndependentProduct: z.boolean().optional(),
  linkedCoffeeItemId: z.string().optional(),
  inventoryRawItemId: z.string().optional(),
  linkedRawItemId: z.string().optional(),
  menuCategory: z.string().optional(),
});

export type ProductAddon = IProductAddon;
export type InsertProductAddon = z.infer<typeof insertProductAddonSchema>;

export const insertCoffeeItemAddonSchema = z.object({
  coffeeItemId: z.string(),
  addonId: z.string(),
  isDefault: z.number().optional(),
  defaultValue: z.string().optional(),
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
});

export type CoffeeItemAddon = ICoffeeItemAddon;
export type InsertCoffeeItemAddon = z.infer<typeof insertCoffeeItemAddonSchema>;

// ============ PRODUCT REVIEWS & RATINGS ============
export interface IProductReview extends Document {
  productId?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  orderId?: string;
  orderNumber?: string;
  rating: number;
  comment?: string;
  adminReply?: string;
  adminReplyDate?: Date;
  managerReply?: string;
  repliedAt?: Date;
  repliedBy?: string;
  branchId?: string;
  status?: string;
  isVerifiedPurchase: number;
  helpful: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductReviewSchema = new Schema<IProductReview>({
  productId: { type: String },
  customerId: { type: String, default: '' },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  orderId: { type: String },
  orderNumber: { type: String },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  adminReply: { type: String },
  adminReplyDate: { type: Date },
  managerReply: { type: String },
  repliedAt: { type: Date },
  repliedBy: { type: String },
  branchId: { type: String },
  status: { type: String, default: 'published' },
  isVerifiedPurchase: { type: Number, default: 1 },
  helpful: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ProductReviewSchema.index({ productId: 1, rating: 1 });
ProductReviewSchema.index({ customerId: 1 });
ProductReviewSchema.index({ orderId: 1 });
ProductReviewSchema.index({ branchId: 1 });

export const ProductReviewModel = mongoose.model<IProductReview>("ProductReview", ProductReviewSchema);

// ============ REFERRAL PROGRAM ============
export interface IReferral extends Document {
  referrerId: string;
  referrerCode: string;
  referredCustomerId?: string;
  referredPhone: string;
  referredEmail?: string;
  status: 'pending' | 'completed' | 'verified';
  pointsAwarded: number;
  referralBonus: number;
  referralDate: Date;
  completionDate?: Date;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const ReferralSchema = new Schema<IReferral>({
  referrerId: { type: String, required: true },
  referrerCode: { type: String, required: true, unique: false },
  referredCustomerId: { type: String },
  referredPhone: { type: String, required: true },
  referredEmail: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'verified'], default: 'pending' },
  pointsAwarded: { type: Number, default: 0 },
  referralBonus: { type: Number, default: 50 },
  referralDate: { type: Date, default: Date.now },
  completionDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

ReferralSchema.index({ referrerId: 1 });
ReferralSchema.index({ referrerCode: 1 });
ReferralSchema.index({ referredCustomerId: 1 });

export const ReferralModel = mongoose.model<IReferral>("Referral", ReferralSchema);

// ============ CUSTOMER NOTIFICATIONS ============
export interface INotification extends Document {
  customerId: string;
  userId?: string;
  userType?: 'customer' | 'employee';
  title: string;
  message: string;
  type: 'order_update' | 'referral' | 'loyalty' | 'promotion' | 'system' | 'success' | 'error' | 'warning' | 'info' | 'order' | 'payment' | 'promo';
  relatedOrderId?: string;
  orderId?: string;
  orderNumber?: string;
  link?: string;
  icon?: string;
  tag?: string;
  tenantId?: string;
  isRead: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  customerId: { type: String },
  userId: { type: String },
  userType: { type: String, enum: ['customer', 'employee'], default: 'customer' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'system' },
  relatedOrderId: { type: String },
  orderId: { type: String },
  orderNumber: { type: String },
  link: { type: String },
  icon: { type: String },
  tag: { type: String },
  tenantId: { type: String, default: 'demo-tenant' },
  isRead: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ customerId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ isRead: 1 });

export const NotificationModel = mongoose.model<INotification>("Notification", NotificationSchema);

// Zod schemas
export const insertProductReviewSchema = z.object({
  productId: z.string(),
  customerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  isVerifiedPurchase: z.number().optional(),
});

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = IProductReview;

export const insertReferralSchema = z.object({
  referrerId: z.string(),
  referredPhone: z.string(),
  referredEmail: z.string().optional(),
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = IReferral;

export const insertNotificationSchema = z.object({
  customerId: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['order_update', 'referral', 'loyalty', 'promotion', 'system']),
  relatedOrderId: z.string().optional(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = INotification;

// ============ ACCOUNTING SNAPSHOT ============
export interface IAccountingSnapshot extends Document {
  tenantId: string;
  branchId: string;
  snapshotDate: Date;
  snapshotType: 'daily' | 'monthly' | 'custom';
  periodStart: Date;
  periodEnd: Date;
  // Revenue
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  // Costs
  totalCostOfGoods: number;
  totalDiscounts: number;
  totalDeliveryFees: number;
  // Expenses
  staffCosts?: number;
  utilities?: number;
  rent?: number;
  marketing?: number;
  otherExpenses?: number;
  // Waste & Inventory
  wasteAmount: number;
  wastePercentage: number;
  inventoryAdjustments: number;
  // Profit
  grossProfit: number;
  grossProfitMargin: number;
  netProfit?: number;
  netProfitMargin?: number;
  // Tax (ZATCA/VAT)
  vatPercentage: number;
  totalVAT: number;
  taxableAmount: number;
  // Metrics
  ordersWithCOGS: number;
  uniqueProducts: number;
  topProductsByRevenue: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  // Details
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvalDate?: Date;
  isApproved: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AccountingSnapshotSchema = new Schema<IAccountingSnapshot>({
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  snapshotDate: { type: Date, default: Date.now, required: true },
  snapshotType: { type: String, enum: ['daily', 'monthly', 'custom'], default: 'daily', required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  totalRevenue: { type: Number, required: true, default: 0 },
  totalOrders: { type: Number, required: true, default: 0 },
  averageOrderValue: { type: Number, required: true, default: 0 },
  totalCostOfGoods: { type: Number, required: true, default: 0 },
  totalDiscounts: { type: Number, required: true, default: 0 },
  totalDeliveryFees: { type: Number, required: true, default: 0 },
  staffCosts: { type: Number, default: 0 },
  utilities: { type: Number, default: 0 },
  rent: { type: Number, default: 0 },
  marketing: { type: Number, default: 0 },
  otherExpenses: { type: Number, default: 0 },
  wasteAmount: { type: Number, required: true, default: 0 },
  wastePercentage: { type: Number, required: true, default: 0 },
  inventoryAdjustments: { type: Number, required: true, default: 0 },
  grossProfit: { type: Number, required: true, default: 0 },
  grossProfitMargin: { type: Number, required: true, default: 0 },
  netProfit: { type: Number, default: 0 },
  netProfitMargin: { type: Number, default: 0 },
  vatPercentage: { type: Number, required: true, default: 0 },
  totalVAT: { type: Number, required: true, default: 0 },
  taxableAmount: { type: Number, required: true, default: 0 },
  ordersWithCOGS: { type: Number, required: true, default: 0 },
  uniqueProducts: { type: Number, required: true, default: 0 },
  topProductsByRevenue: [{
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    revenue: { type: Number, required: true }
  }],
  notes: { type: String },
  createdBy: { type: String, required: true },
  approvedBy: { type: String },
  approvalDate: { type: Date },
  isApproved: { type: Number, default: 0, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AccountingSnapshotSchema.index({ tenantId: 1, branchId: 1, snapshotDate: -1 });
AccountingSnapshotSchema.index({ tenantId: 1, snapshotType: 1 });
AccountingSnapshotSchema.index({ isApproved: 1 });

export const AccountingSnapshotModel = mongoose.model<IAccountingSnapshot>("AccountingSnapshot", AccountingSnapshotSchema);

// Zod schemas for Accounting Snapshot
export const insertAccountingSnapshotSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  snapshotDate: z.date().optional(),
  snapshotType: z.enum(['daily', 'monthly', 'custom']),
  periodStart: z.date(),
  periodEnd: z.date(),
  totalRevenue: z.number(),
  totalOrders: z.number(),
  averageOrderValue: z.number(),
  totalCostOfGoods: z.number(),
  totalDiscounts: z.number(),
  totalDeliveryFees: z.number(),
  staffCosts: z.number().optional(),
  utilities: z.number().optional(),
  rent: z.number().optional(),
  marketing: z.number().optional(),
  otherExpenses: z.number().optional(),
  wasteAmount: z.number(),
  wastePercentage: z.number(),
  inventoryAdjustments: z.number(),
  grossProfit: z.number(),
  grossProfitMargin: z.number(),
  netProfit: z.number().optional(),
  netProfitMargin: z.number().optional(),
  vatPercentage: z.number(),
  totalVAT: z.number(),
  taxableAmount: z.number(),
  ordersWithCOGS: z.number(),
  uniqueProducts: z.number(),
  topProductsByRevenue: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
    revenue: z.number(),
  })).optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
});

export type InsertAccountingSnapshot = z.infer<typeof insertAccountingSnapshotSchema>;
export type AccountingSnapshot = IAccountingSnapshot;

// ============================================
// نظام المحاسبة المتقدم - Professional ERP Accounting System
// ============================================

// أنواع الحسابات - Account Types
export const AccountTypes = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
  CONTRA: 'contra',
} as const;

export type AccountType = typeof AccountTypes[keyof typeof AccountTypes];

// الفترات المالية - Fiscal Period
export interface IFiscalPeriod extends Document {
  tenantId: string;
  name: string;
  nameAr: string;
  startDate: Date;
  endDate: Date;
  status: 'open' | 'closed' | 'locked';
  closedBy?: string;
  closedAt?: Date;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FiscalPeriodSchema = new Schema<IFiscalPeriod>({
  tenantId: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['open', 'closed', 'locked'], default: 'open' },
  closedBy: { type: String },
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

FiscalPeriodSchema.index({ tenantId: 1, startDate: 1 });
FiscalPeriodSchema.index({ tenantId: 1, status: 1 });

export const FiscalPeriodModel = mongoose.model<IFiscalPeriod>("FiscalPeriod", FiscalPeriodSchema);

// مراكز التكلفة - Cost Centers
export interface ICostCenter extends Document {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  parentId?: string;
  branchId?: string;
  isActive: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CostCenterSchema = new Schema<ICostCenter>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  code: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  parentId: { type: String },
  branchId: { type: String },
  isActive: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CostCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });
CostCenterSchema.index({ tenantId: 1, branchId: 1 });

export const CostCenterModel = mongoose.model<ICostCenter>("CostCenter", CostCenterSchema);

// دليل الحسابات - Chart of Accounts
export interface IAccount extends Document {
  id: string;
  tenantId: string;
  accountNumber: string;
  nameAr: string;
  nameEn?: string;
  accountType: AccountType;
  parentAccountId?: string;
  normalBalance: 'debit' | 'credit';
  currency: string;
  isActive: number;
  isSystemAccount: number;
  isBankAccount: number;
  bankName?: string;
  bankAccountNumber?: string;
  iban?: string;
  openingBalance: number;
  currentBalance: number;
  branchId?: string;
  costCenterId?: string;
  description?: string;
  level: number;
  path: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  accountNumber: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  accountType: { type: String, enum: ['asset', 'liability', 'equity', 'revenue', 'expense', 'contra'], required: true },
  parentAccountId: { type: String },
  normalBalance: { type: String, enum: ['debit', 'credit'], required: true },
  currency: { type: String, default: 'SAR' },
  isActive: { type: Number, default: 1 },
  isSystemAccount: { type: Number, default: 0 },
  isBankAccount: { type: Number, default: 0 },
  bankName: { type: String },
  bankAccountNumber: { type: String },
  iban: { type: String },
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  branchId: { type: String },
  costCenterId: { type: String },
  description: { type: String },
  level: { type: Number, default: 1 },
  path: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AccountSchema.index({ tenantId: 1, accountNumber: 1 }, { unique: true });
AccountSchema.index({ tenantId: 1, accountType: 1 });
AccountSchema.index({ tenantId: 1, parentAccountId: 1 });
AccountSchema.index({ tenantId: 1, isActive: 1 });
AccountSchema.index({ tenantId: 1, isBankAccount: 1 });

export const AccountModel = mongoose.model<IAccount>("Account", AccountSchema);

// قيود اليومية - Journal Entries
export interface IJournalLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  costCenterId?: string;
  branchId?: string;
}

export interface IJournalEntry extends Document {
  id: string;
  tenantId: string;
  entryNumber: string;
  entryDate: Date;
  fiscalPeriodId?: string;
  referenceType?: 'order' | 'invoice' | 'expense' | 'adjustment' | 'opening' | 'closing' | 'manual';
  referenceId?: string;
  description: string;
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: number;
  status: 'draft' | 'posted' | 'reversed' | 'voided';
  reversedEntryId?: string;
  isAutoPosted: number;
  postedBy?: string;
  postedAt?: Date;
  createdBy: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const JournalEntrySchema = new Schema<IJournalEntry>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  entryNumber: { type: String, required: true },
  entryDate: { type: Date, required: true },
  fiscalPeriodId: { type: String },
  referenceType: { type: String, enum: ['order', 'invoice', 'expense', 'adjustment', 'opening', 'closing', 'manual'] },
  referenceId: { type: String },
  description: { type: String, required: true },
  lines: [{
    accountId: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    description: { type: String },
    costCenterId: { type: String },
    branchId: { type: String },
  }],
  totalDebit: { type: Number, default: 0 },
  totalCredit: { type: Number, default: 0 },
  isBalanced: { type: Number, default: 1 },
  status: { type: String, enum: ['draft', 'posted', 'reversed', 'voided'], default: 'draft' },
  reversedEntryId: { type: String },
  isAutoPosted: { type: Number, default: 0 },
  postedBy: { type: String },
  postedAt: { type: Date },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

JournalEntrySchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ tenantId: 1, entryDate: -1 });
JournalEntrySchema.index({ tenantId: 1, status: 1 });
JournalEntrySchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 });
JournalEntrySchema.index({ 'lines.accountId': 1 });

export const JournalEntryModel = mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);

// معدلات الضريبة - Tax Rates
export interface ITaxRate extends Document {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  rate: number;
  taxType: 'vat' | 'service' | 'excise' | 'withholding' | 'other';
  isDefault: number;
  isActive: number;
  accountId?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaxRateSchema = new Schema<ITaxRate>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  code: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  rate: { type: Number, required: true },
  taxType: { type: String, enum: ['vat', 'service', 'excise', 'withholding', 'other'], default: 'vat' },
  isDefault: { type: Number, default: 0 },
  isActive: { type: Number, default: 1 },
  accountId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TaxRateSchema.index({ tenantId: 1, code: 1 }, { unique: true });
TaxRateSchema.index({ tenantId: 1, isActive: 1 });

export const TaxRateModel = mongoose.model<ITaxRate>("TaxRate", TaxRateSchema);

// الفواتير الإلكترونية - Professional Invoices
export interface IInvoiceLine {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  costCenterId?: string;
}

export interface IInvoice extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  invoiceType: 'sales' | 'purchase' | 'credit_note' | 'debit_note';
  status: 'draft' | 'issued' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'voided';
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxNumber?: string;
  customerAddress?: string;
  vendorId?: string;
  vendorName?: string;
  vendorTaxNumber?: string;
  orderId?: string;
  lines: IInvoiceLine[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  exchangeRate: number;
  paymentTerms?: string;
  paymentMethod?: string;
  notes?: string;
  internalNotes?: string;
  zatcaUuid?: string;
  zatcaHash?: string;
  zatcaQrCode?: string;
  zatcaInvoiceXml?: string;
  zatcaStatus?: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'cleared';
  zatcaSubmittedAt?: Date;
  zatcaResponseCode?: string;
  zatcaResponseMessage?: string;
  issuedBy?: string;
  issuedAt?: Date;
  paidAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  linkedInvoiceId?: string;
  journalEntryId?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  invoiceDate: { type: Date, required: true },
  dueDate: { type: Date },
  invoiceType: { type: String, enum: ['sales', 'purchase', 'credit_note', 'debit_note'], default: 'sales' },
  status: { type: String, enum: ['draft', 'issued', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'voided'], default: 'draft' },
  customerId: { type: String },
  customerName: { type: String, required: true },
  customerPhone: { type: String },
  customerEmail: { type: String },
  customerTaxNumber: { type: String },
  customerAddress: { type: String },
  vendorId: { type: String },
  vendorName: { type: String },
  vendorTaxNumber: { type: String },
  orderId: { type: String },
  lines: [{
    itemId: { type: String },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    taxRate: { type: Number, default: 15 },
    taxAmount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
    costCenterId: { type: String },
  }],
  subtotal: { type: Number, required: true },
  totalDiscount: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  amountDue: { type: Number, required: true },
  currency: { type: String, default: 'SAR' },
  exchangeRate: { type: Number, default: 1 },
  paymentTerms: { type: String },
  paymentMethod: { type: String },
  notes: { type: String },
  internalNotes: { type: String },
  zatcaUuid: { type: String },
  zatcaHash: { type: String },
  zatcaQrCode: { type: String },
  zatcaInvoiceXml: { type: String },
  zatcaStatus: { type: String, enum: ['pending', 'submitted', 'accepted', 'rejected', 'cleared'] },
  zatcaSubmittedAt: { type: Date },
  zatcaResponseCode: { type: String },
  zatcaResponseMessage: { type: String },
  issuedBy: { type: String },
  issuedAt: { type: Date },
  paidAt: { type: Date },
  cancelledBy: { type: String },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  linkedInvoiceId: { type: String },
  journalEntryId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ tenantId: 1, branchId: 1, invoiceDate: -1 });
InvoiceSchema.index({ tenantId: 1, status: 1 });
InvoiceSchema.index({ tenantId: 1, customerId: 1 });
InvoiceSchema.index({ tenantId: 1, orderId: 1 });
InvoiceSchema.index({ tenantId: 1, zatcaStatus: 1 });
InvoiceSchema.index({ zatcaUuid: 1 });

export const InvoiceModel = mongoose.model<IInvoice>("Invoice", InvoiceSchema);

// المصروفات المتقدمة - ERP Expenses (Advanced Expense Management)
export interface IExpenseErp extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  expenseNumber: string;
  expenseDate: Date;
  category: 'inventory' | 'salaries' | 'salary' | 'rent' | 'utilities' | 'marketing' | 'maintenance' | 'supplies' | 'other' | 'operating';
  subcategory?: string;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'other';
  paymentReference?: string;
  vendorId?: string;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  attachmentUrls?: string[];
  accountId?: string;
  costCenterId?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  paidBy?: string;
  paidAt?: Date;
  journalEntryId?: string;
  notes?: string;
  isRecurring: number;
  recurringFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextRecurringDate?: Date;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseErpSchema = new Schema<IExpenseErp>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  expenseNumber: { type: String, required: true },
  expenseDate: { type: Date, required: true },
  category: { type: String, enum: ['inventory', 'salaries', 'salary', 'rent', 'utilities', 'marketing', 'maintenance', 'supplies', 'other', 'operating'], required: true },
  subcategory: { type: String },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'check', 'credit_card', 'other'], default: 'cash' },
  paymentReference: { type: String },
  vendorId: { type: String },
  vendorName: { type: String },
  invoiceNumber: { type: String },
  invoiceDate: { type: Date },
  attachmentUrls: [{ type: String }],
  accountId: { type: String },
  costCenterId: { type: String },
  status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'], default: 'draft' },
  requestedBy: { type: String, required: true },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  rejectedBy: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  paidBy: { type: String },
  paidAt: { type: Date },
  journalEntryId: { type: String },
  notes: { type: String },
  isRecurring: { type: Number, default: 0 },
  recurringFrequency: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'] },
  nextRecurringDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ExpenseErpSchema.index({ tenantId: 1, expenseNumber: 1 }, { unique: true });
ExpenseErpSchema.index({ tenantId: 1, branchId: 1, expenseDate: -1 });
ExpenseErpSchema.index({ tenantId: 1, status: 1 });
ExpenseErpSchema.index({ tenantId: 1, category: 1 });
ExpenseErpSchema.index({ tenantId: 1, requestedBy: 1 });

export const ExpenseErpModel = mongoose.model<IExpenseErp>("ExpenseErp", ExpenseErpSchema);

// الموردين - Vendors
export interface IVendor extends Document {
  id: string;
  tenantId: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  taxNumber?: string;
  commercialRegistration?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country: string;
  bankName?: string;
  bankAccountNumber?: string;
  iban?: string;
  paymentTerms?: string;
  creditLimit: number;
  currentBalance: number;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
  isActive: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendor>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  code: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  taxNumber: { type: String },
  commercialRegistration: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  city: { type: String },
  country: { type: String, default: 'SA' },
  bankName: { type: String },
  bankAccountNumber: { type: String },
  iban: { type: String },
  paymentTerms: { type: String },
  creditLimit: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  contactPerson: { type: String },
  contactPhone: { type: String },
  notes: { type: String },
  isActive: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

VendorSchema.index({ tenantId: 1, code: 1 }, { unique: true });
VendorSchema.index({ tenantId: 1, nameAr: 1 });
VendorSchema.index({ tenantId: 1, isActive: 1 });

export const VendorModel = mongoose.model<IVendor>("Vendor", VendorSchema);

// سجل المدفوعات - Payment Records
export interface IPaymentRecord extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  paymentNumber: string;
  paymentDate: Date;
  paymentType: 'receipt' | 'payment';
  referenceType: 'invoice' | 'expense' | 'order' | 'advance' | 'refund';
  referenceId: string;
  customerId?: string;
  vendorId?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'pos' | 'wallet' | 'other';
  bankAccountId?: string;
  checkNumber?: string;
  transactionReference?: string;
  description?: string;
  status: 'pending' | 'completed' | 'bounced' | 'cancelled';
  journalEntryId?: string;
  processedBy: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  paymentNumber: { type: String, required: true },
  paymentDate: { type: Date, required: true },
  paymentType: { type: String, enum: ['receipt', 'payment'], required: true },
  referenceType: { type: String, enum: ['invoice', 'expense', 'order', 'advance', 'refund'], required: true },
  referenceId: { type: String, required: true },
  customerId: { type: String },
  vendorId: { type: String },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'check', 'credit_card', 'pos', 'wallet', 'other'], required: true },
  bankAccountId: { type: String },
  checkNumber: { type: String },
  transactionReference: { type: String },
  description: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'bounced', 'cancelled'], default: 'completed' },
  journalEntryId: { type: String },
  processedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PaymentRecordSchema.index({ tenantId: 1, paymentNumber: 1 }, { unique: true });
PaymentRecordSchema.index({ tenantId: 1, branchId: 1, paymentDate: -1 });
PaymentRecordSchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 });
PaymentRecordSchema.index({ tenantId: 1, customerId: 1 });
PaymentRecordSchema.index({ tenantId: 1, vendorId: 1 });

export const PaymentRecordModel = mongoose.model<IPaymentRecord>("PaymentRecord", PaymentRecordSchema);

// كشف حساب البنك - Bank Statements
export interface IBankStatement extends Document {
  id: string;
  tenantId: string;
  bankAccountId: string;
  statementDate: Date;
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  status: 'uploaded' | 'in_progress' | 'reconciled';
  reconciledBy?: string;
  reconciledAt?: Date;
  uploadedBy: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BankStatementSchema = new Schema<IBankStatement>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  bankAccountId: { type: String, required: true },
  statementDate: { type: Date, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  openingBalance: { type: Number, required: true },
  closingBalance: { type: Number, required: true },
  totalCredits: { type: Number, default: 0 },
  totalDebits: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  status: { type: String, enum: ['uploaded', 'in_progress', 'reconciled'], default: 'uploaded' },
  reconciledBy: { type: String },
  reconciledAt: { type: Date },
  uploadedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

BankStatementSchema.index({ tenantId: 1, bankAccountId: 1, statementDate: -1 });
BankStatementSchema.index({ tenantId: 1, status: 1 });

export const BankStatementModel = mongoose.model<IBankStatement>("BankStatement", BankStatementSchema);

// معاملات البنك - Bank Transactions
export interface IBankTransaction extends Document {
  id: string;
  tenantId: string;
  bankStatementId: string;
  bankAccountId: string;
  transactionDate: Date;
  valueDate?: Date;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
  transactionType?: string;
  isReconciled: number;
  matchedPaymentId?: string;
  matchedJournalEntryId?: string;
  matchConfidence?: number;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BankTransactionSchema = new Schema<IBankTransaction>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  bankStatementId: { type: String, required: true },
  bankAccountId: { type: String, required: true },
  transactionDate: { type: Date, required: true },
  valueDate: { type: Date },
  description: { type: String, required: true },
  reference: { type: String },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, required: true },
  transactionType: { type: String },
  isReconciled: { type: Number, default: 0 },
  matchedPaymentId: { type: String },
  matchedJournalEntryId: { type: String },
  matchConfidence: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

BankTransactionSchema.index({ tenantId: 1, bankStatementId: 1 });
BankTransactionSchema.index({ tenantId: 1, bankAccountId: 1, transactionDate: -1 });
BankTransactionSchema.index({ tenantId: 1, isReconciled: 1 });

export const BankTransactionModel = mongoose.model<IBankTransaction>("BankTransaction", BankTransactionSchema);

// Zod Schemas for ERP Accounting

export const insertAccountSchema = z.object({
  tenantId: z.string(),
  accountNumber: z.string(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense', 'contra']),
  parentAccountId: z.string().optional(),
  normalBalance: z.enum(['debit', 'credit']),
  currency: z.string().default('SAR'),
  isActive: z.number().default(1),
  isSystemAccount: z.number().default(0),
  isBankAccount: z.number().default(0),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  iban: z.string().optional(),
  openingBalance: z.number().default(0),
  branchId: z.string().optional(),
  costCenterId: z.string().optional(),
  description: z.string().optional(),
});

export const insertJournalEntrySchema = z.object({
  tenantId: z.string(),
  entryDate: z.date(),
  fiscalPeriodId: z.string().optional(),
  referenceType: z.enum(['order', 'invoice', 'expense', 'adjustment', 'opening', 'closing', 'manual']).optional(),
  referenceId: z.string().optional(),
  description: z.string(),
  lines: z.array(z.object({
    accountId: z.string(),
    accountNumber: z.string(),
    accountName: z.string(),
    debit: z.number().default(0),
    credit: z.number().default(0),
    description: z.string().optional(),
    costCenterId: z.string().optional(),
    branchId: z.string().optional(),
  })),
  createdBy: z.string(),
});

export const insertInvoiceSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  invoiceDate: z.date(),
  dueDate: z.date().optional(),
  invoiceType: z.enum(['sales', 'purchase', 'credit_note', 'debit_note']).default('sales'),
  customerId: z.string().optional(),
  customerName: z.string(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  customerTaxNumber: z.string().optional(),
  customerAddress: z.string().optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  vendorTaxNumber: z.string().optional(),
  orderId: z.string().optional(),
  lines: z.array(z.object({
    itemId: z.string().optional(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    discountAmount: z.number().default(0),
    discountPercent: z.number().default(0),
    taxRate: z.number().default(15),
  })),
  paymentTerms: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const insertExpenseErpSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  expenseDate: z.date(),
  category: z.enum(['inventory', 'salaries', 'salary', 'rent', 'utilities', 'marketing', 'maintenance', 'supplies', 'other', 'operating']),
  subcategory: z.string().optional(),
  description: z.string(),
  amount: z.number(),
  taxAmount: z.number().default(0),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'credit_card', 'other']).default('cash'),
  paymentReference: z.string().optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional(),
  accountId: z.string().optional(),
  costCenterId: z.string().optional(),
  requestedBy: z.string(),
  notes: z.string().optional(),
  isRecurring: z.number().default(0),
  recurringFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
});

export const insertVendorSchema = z.object({
  tenantId: z.string(),
  code: z.string(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  taxNumber: z.string().optional(),
  commercialRegistration: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('SA'),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  iban: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().default(0),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const insertPaymentRecordSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  paymentDate: z.date(),
  paymentType: z.enum(['receipt', 'payment']),
  referenceType: z.enum(['invoice', 'expense', 'order', 'advance', 'refund']),
  referenceId: z.string(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  amount: z.number(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'credit_card', 'pos', 'wallet', 'other']),
  bankAccountId: z.string().optional(),
  checkNumber: z.string().optional(),
  transactionReference: z.string().optional(),
  description: z.string().optional(),
  processedBy: z.string(),
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = IAccount;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = IJournalEntry;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = IInvoice;
export type InsertExpenseErp = z.infer<typeof insertExpenseErpSchema>;
export type ExpenseErp = IExpenseErp;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = IVendor;
export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentRecord = IPaymentRecord;
export type FiscalPeriod = IFiscalPeriod;
export type CostCenter = ICostCenter;
export type TaxRate = ITaxRate;
export type BankStatement = IBankStatement;
export type BankTransaction = IBankTransaction;

// =====================================================
// نظام التوصيل المتكامل - Integrated Delivery System
// =====================================================

// شركات التوصيل الخارجية - External Delivery Integrations
export interface IDeliveryIntegration extends Document {
  id: string;
  tenantId: string;
  branchId?: string;
  providerName: 'noon_food' | 'hunger_station' | 'keeta' | 'jahez' | 'toyou' | 'mrsool' | 'careem' | 'custom';
  providerNameAr: string;
  providerLogo?: string;
  apiKey?: string;
  apiSecret?: string;
  merchantId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  baseUrl?: string;
  isActive: number;
  isTestMode: number;
  autoAcceptOrders: number;
  autoAssignDriver: number;
  commissionPercent: number;
  fixedFee: number;
  settings?: Record<string, any>;
  lastSyncAt?: Date;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryIntegrationSchema = new Schema<IDeliveryIntegration>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String },
  providerName: { 
    type: String, 
    enum: ['noon_food', 'hunger_station', 'keeta', 'jahez', 'toyou', 'mrsool', 'careem', 'custom'],
    required: true 
  },
  providerNameAr: { type: String, required: true },
  providerLogo: { type: String },
  apiKey: { type: String },
  apiSecret: { type: String },
  merchantId: { type: String },
  webhookUrl: { type: String },
  webhookSecret: { type: String },
  baseUrl: { type: String },
  isActive: { type: Number, default: 0 },
  isTestMode: { type: Number, default: 1 },
  autoAcceptOrders: { type: Number, default: 0 },
  autoAssignDriver: { type: Number, default: 0 },
  commissionPercent: { type: Number, default: 0 },
  fixedFee: { type: Number, default: 0 },
  settings: { type: Schema.Types.Mixed },
  lastSyncAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DeliveryIntegrationSchema.index({ tenantId: 1 });
DeliveryIntegrationSchema.index({ tenantId: 1, providerName: 1 });
DeliveryIntegrationSchema.index({ tenantId: 1, isActive: 1 });

export const DeliveryIntegrationModel = mongoose.model<IDeliveryIntegration>("DeliveryIntegration", DeliveryIntegrationSchema);

// مناطق التوصيل - Delivery Zones
export interface IDeliveryZone extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  zoneType: 'polygon' | 'radius' | 'city' | 'district';
  boundary?: Array<{ lat: number; lng: number }>;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  city?: string;
  district?: string;
  baseFee: number;
  feePerKm: number;
  minOrderAmount: number;
  maxOrderAmount?: number;
  freeDeliveryThreshold?: number;
  estimatedMinMinutes: number;
  estimatedMaxMinutes: number;
  isActive: number;
  priority: number;
  workingHours?: {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
  }[];
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryZoneSchema = new Schema<IDeliveryZone>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String },
  description: { type: String },
  zoneType: { type: String, enum: ['polygon', 'radius', 'city', 'district'], default: 'radius' },
  boundary: [{
    lat: { type: Number },
    lng: { type: Number }
  }],
  centerLat: { type: Number },
  centerLng: { type: Number },
  radiusKm: { type: Number, default: 5 },
  city: { type: String },
  district: { type: String },
  baseFee: { type: Number, default: 10 },
  feePerKm: { type: Number, default: 2 },
  minOrderAmount: { type: Number, default: 0 },
  maxOrderAmount: { type: Number },
  freeDeliveryThreshold: { type: Number },
  estimatedMinMinutes: { type: Number, default: 20 },
  estimatedMaxMinutes: { type: Number, default: 45 },
  isActive: { type: Number, default: 1 },
  priority: { type: Number, default: 0 },
  workingHours: [{
    dayOfWeek: { type: Number },
    openTime: { type: String },
    closeTime: { type: String }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DeliveryZoneSchema.index({ tenantId: 1, branchId: 1 });
DeliveryZoneSchema.index({ tenantId: 1, isActive: 1 });
DeliveryZoneSchema.index({ branchId: 1, isActive: 1 });

export const DeliveryZoneModel = mongoose.model<IDeliveryZone>("DeliveryZone", DeliveryZoneSchema);

// مناديب التوصيل الداخلي - Internal Delivery Drivers
export interface IDeliveryDriver extends Document {
  id: string;
  tenantId: string;
  branchId?: string;
  employeeId?: string;
  fullName: string;
  phone: string;
  email?: string;
  nationalId?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  vehicleType: 'motorcycle' | 'car' | 'bicycle' | 'scooter';
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  photoUrl?: string;
  status: 'available' | 'busy' | 'offline' | 'on_break';
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: Date;
  currentOrderId?: string;
  totalDeliveries: number;
  totalEarnings: number;
  rating: number;
  ratingCount: number;
  isActive: number;
  maxConcurrentOrders: number;
  workingZoneIds?: string[];
  shiftStart?: string;
  shiftEnd?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryDriverSchema = new Schema<IDeliveryDriver>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String },
  employeeId: { type: String },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  nationalId: { type: String },
  licenseNumber: { type: String },
  licenseExpiry: { type: Date },
  vehicleType: { type: String, enum: ['motorcycle', 'car', 'bicycle', 'scooter'], default: 'motorcycle' },
  vehiclePlate: { type: String },
  vehicleModel: { type: String },
  vehicleColor: { type: String },
  photoUrl: { type: String },
  status: { type: String, enum: ['available', 'busy', 'offline', 'on_break'], default: 'offline' },
  currentLat: { type: Number },
  currentLng: { type: Number },
  lastLocationUpdate: { type: Date },
  currentOrderId: { type: String },
  totalDeliveries: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  rating: { type: Number, default: 5 },
  ratingCount: { type: Number, default: 0 },
  isActive: { type: Number, default: 1 },
  maxConcurrentOrders: { type: Number, default: 3 },
  workingZoneIds: [{ type: String }],
  shiftStart: { type: String },
  shiftEnd: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DeliveryDriverSchema.index({ tenantId: 1 });
DeliveryDriverSchema.index({ tenantId: 1, status: 1, isActive: 1 });
DeliveryDriverSchema.index({ tenantId: 1, branchId: 1 });
DeliveryDriverSchema.index({ phone: 1 });

export const DeliveryDriverModel = mongoose.model<IDeliveryDriver>("DeliveryDriver", DeliveryDriverSchema);

// طلبات التوصيل - Delivery Orders
export interface IDeliveryOrder extends Document {
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  orderNumber?: string;
  deliveryType: 'internal' | 'external';
  externalProvider?: string;
  externalOrderId?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerAddressDetails?: string;
  customerLat: number;
  customerLng: number;
  branchLat?: number;
  branchLng?: number;
  distanceKm: number;
  deliveryFee: number;
  driverEarnings?: number;
  status: 'pending' | 'accepted' | 'assigned' | 'picking_up' | 'on_the_way' | 'arrived' | 'delivered' | 'cancelled' | 'returned';
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  preparationMinutes: number;
  travelMinutes: number;
  totalEstimatedMinutes: number;
  driverCurrentLat?: number;
  driverCurrentLng?: number;
  driverLastUpdate?: Date;
  trackingHistory?: Array<{
    lat: number;
    lng: number;
    timestamp: Date;
    status: string;
  }>;
  notes?: string;
  customerNotes?: string;
  cancellationReason?: string;
  customerRating?: number;
  customerFeedback?: string;
  proofOfDelivery?: string;
  signatureUrl?: string;
  carType?: string;
  carColor?: string;
  plateNumber?: string;
  saveCarInfo?: number;
  totalAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryOrderSchema = new Schema<IDeliveryOrder>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String, required: true },
  orderId: { type: String, required: true },
  orderNumber: { type: String },
  deliveryType: { type: String, enum: ['internal', 'external'], default: 'internal' },
  externalProvider: { type: String },
  externalOrderId: { type: String },
  driverId: { type: String },
  driverName: { type: String },
  driverPhone: { type: String },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, required: true },
  customerAddressDetails: { type: String },
  customerLat: { type: Number, required: true },
  customerLng: { type: Number, required: true },
  branchLat: { type: Number },
  branchLng: { type: Number },
  distanceKm: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  driverEarnings: { type: Number },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'assigned', 'picking_up', 'on_the_way', 'arrived', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  estimatedPickupTime: { type: Date },
  estimatedDeliveryTime: { type: Date },
  actualPickupTime: { type: Date },
  actualDeliveryTime: { type: Date },
  preparationMinutes: { type: Number, default: 0 },
  travelMinutes: { type: Number, default: 0 },
  totalEstimatedMinutes: { type: Number, default: 0 },
  driverCurrentLat: { type: Number },
  driverCurrentLng: { type: Number },
  driverLastUpdate: { type: Date },
  trackingHistory: [{
    lat: { type: Number },
    lng: { type: Number },
    timestamp: { type: Date },
    status: { type: String }
  }],
  notes: { type: String },
  customerNotes: { type: String },
  cancellationReason: { type: String },
  customerRating: { type: Number },
  customerFeedback: { type: String },
  proofOfDelivery: { type: String },
  signatureUrl: { type: String },
  totalAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DeliveryOrderSchema.index({ tenantId: 1, status: 1 });
DeliveryOrderSchema.index({ tenantId: 1, branchId: 1, status: 1 });
DeliveryOrderSchema.index({ tenantId: 1, driverId: 1, status: 1 });
DeliveryOrderSchema.index({ orderId: 1 });
DeliveryOrderSchema.index({ externalOrderId: 1 });

export const DeliveryOrderModel = mongoose.model<IDeliveryOrder>("DeliveryOrder", DeliveryOrderSchema);

// Zod Schemas for Delivery System
export const insertDeliveryIntegrationSchema = z.object({
  tenantId: z.string(),
  branchId: z.string().optional(),
  providerName: z.enum(['noon_food', 'hunger_station', 'keeta', 'jahez', 'toyou', 'mrsool', 'careem', 'custom']),
  providerNameAr: z.string(),
  providerLogo: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  merchantId: z.string().optional(),
  webhookUrl: z.string().optional(),
  webhookSecret: z.string().optional(),
  baseUrl: z.string().optional(),
  isActive: z.number().default(0),
  isTestMode: z.number().default(1),
  autoAcceptOrders: z.number().default(0),
  autoAssignDriver: z.number().default(0),
  commissionPercent: z.number().default(0),
  fixedFee: z.number().default(0),
  settings: z.record(z.any()).optional(),
});

export const insertDeliveryZoneSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  nameAr: z.string(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  zoneType: z.enum(['polygon', 'radius', 'city', 'district']).default('radius'),
  boundary: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  radiusKm: z.number().default(5),
  city: z.string().optional(),
  district: z.string().optional(),
  baseFee: z.number().default(10),
  feePerKm: z.number().default(2),
  minOrderAmount: z.number().default(0),
  maxOrderAmount: z.number().optional(),
  freeDeliveryThreshold: z.number().optional(),
  estimatedMinMinutes: z.number().default(20),
  estimatedMaxMinutes: z.number().default(45),
  isActive: z.number().default(1),
  priority: z.number().default(0),
});

export const insertDeliveryDriverSchema = z.object({
  tenantId: z.string(),
  branchId: z.string().optional(),
  employeeId: z.string().optional(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  nationalId: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.date().optional(),
  vehicleType: z.enum(['motorcycle', 'car', 'bicycle', 'scooter']).default('motorcycle'),
  vehiclePlate: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleColor: z.string().optional(),
  photoUrl: z.string().optional(),
  maxConcurrentOrders: z.number().default(3),
  workingZoneIds: z.array(z.string()).optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
});

export const insertDeliveryOrderSchema = z.object({
  tenantId: z.string(),
  branchId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  deliveryType: z.enum(['internal', 'external']).default('internal'),
  externalProvider: z.string().optional(),
  externalOrderId: z.string().optional(),
  driverId: z.string().optional(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerAddress: z.string(),
  customerAddressDetails: z.string().optional(),
  customerLat: z.number(),
  customerLng: z.number(),
  branchLat: z.number().optional(),
  branchLng: z.number().optional(),
  distanceKm: z.number().default(0),
  deliveryFee: z.number().default(0),
  preparationMinutes: z.number().default(0),
  travelMinutes: z.number().default(0),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
});

export type InsertDeliveryIntegration = z.infer<typeof insertDeliveryIntegrationSchema>;
export type DeliveryIntegration = IDeliveryIntegration;
export type InsertDeliveryZone = z.infer<typeof insertDeliveryZoneSchema>;
export type DeliveryZone = IDeliveryZone;
export type InsertDeliveryDriver = z.infer<typeof insertDeliveryDriverSchema>;
export type DeliveryDriver = IDeliveryDriver;
export type InsertDeliveryOrder = z.infer<typeof insertDeliveryOrderSchema>;
export type DeliveryOrder = IDeliveryOrder;

// ============ GIFT CARDS ============
export interface IGiftCard extends Document {
  code: string;
  initialValue: number;
  balance: number;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
  status: string;
  issuedBy?: string;
  usedBy?: string;
  branchId?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const GiftCardSchema = new Schema<IGiftCard>({
  code: { type: String, required: true, unique: true },
  initialValue: { type: Number, required: true },
  balance: { type: Number, required: true },
  recipientName: { type: String, default: '' },
  recipientPhone: { type: String, default: '' },
  note: { type: String, default: '' },
  status: { type: String, default: 'active', enum: ['active', 'used', 'expired', 'cancelled'] },
  issuedBy: { type: String },
  usedBy: { type: String },
  branchId: { type: String },
  tenantId: { type: String, default: 'default' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

GiftCardSchema.index({ tenantId: 1 });
GiftCardSchema.index({ status: 1 });

export const GiftCardModel = mongoose.models['GiftCard'] || mongoose.model<IGiftCard>("GiftCard", GiftCardSchema);

// ==================== CASHIER SHIFT MANAGEMENT ====================

export interface ICashierShift extends Document {
  id: string;
  shiftNumber: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName?: string;
  status: 'open' | 'closed';
  openedAt: Date;
  closedAt?: Date;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  totalOrders: number;
  totalCashSales: number;
  totalCardSales: number;
  totalDigitalSales: number;
  totalRefunds: number;
  totalDiscounts: number;
  totalCancelledOrders: number;
  totalVAT: number;
  netRevenue: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    loyalty: number;
  };
  orderTypeBreakdown: {
    dine_in: number;
    takeaway: number;
    car_pickup: number;
    delivery: number;
    online: number;
  };
  cashMovements: Array<{
    type: 'cash_in' | 'cash_out' | 'paid_in' | 'paid_out';
    amount: number;
    reason: string;
    timestamp: Date;
    performedBy?: string;
  }>;
  orderIds: string[];
  notes?: string;
  closingNotes?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashierShiftSchema = new Schema<ICashierShift>({
  shiftNumber: { type: String, required: true },
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  branchId: { type: String, default: 'main' },
  branchName: { type: String, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
  openingCash: { type: Number, required: true, default: 0 },
  closingCash: { type: Number },
  expectedCash: { type: Number, default: 0 },
  cashDifference: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalCashSales: { type: Number, default: 0 },
  totalCardSales: { type: Number, default: 0 },
  totalDigitalSales: { type: Number, default: 0 },
  totalRefunds: { type: Number, default: 0 },
  totalDiscounts: { type: Number, default: 0 },
  totalCancelledOrders: { type: Number, default: 0 },
  totalVAT: { type: Number, default: 0 },
  netRevenue: { type: Number, default: 0 },
  paymentBreakdown: {
    cash: { type: Number, default: 0 },
    card: { type: Number, default: 0 },
    loyalty: { type: Number, default: 0 },
  },
  orderTypeBreakdown: {
    dine_in: { type: Number, default: 0 },
    takeaway: { type: Number, default: 0 },
    car_pickup: { type: Number, default: 0 },
    delivery: { type: Number, default: 0 },
    online: { type: Number, default: 0 },
  },
  cashMovements: [{
    type: { type: String, enum: ['cash_in', 'cash_out', 'paid_in', 'paid_out'] },
    amount: { type: Number },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now },
    performedBy: { type: String },
  }],
  orderIds: [{ type: String }],
  notes: { type: String },
  closingNotes: { type: String },
  tenantId: { type: String, default: 'default' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CashierShiftSchema.index({ employeeId: 1, status: 1 });
CashierShiftSchema.index({ branchId: 1, status: 1 });
CashierShiftSchema.index({ openedAt: -1 });
CashierShiftSchema.index({ tenantId: 1 });

export const CashierShiftModel = mongoose.models['CashierShift'] || mongoose.model<ICashierShift>("CashierShift", CashierShiftSchema);

// ──────────────────────────────────────────────────────────────────────────────
// Payroll Snapshot — frozen monthly payroll record
// ──────────────────────────────────────────────────────────────────────────────
export interface IPayrollSnapshot extends Document {
  id: string;
  tenantId: string;
  branchId?: string;
  year: number;
  month: number; // 1-12
  status: 'frozen' | 'approved';
  employees: Array<{
    employeeId: string;
    name: string;
    role: string;
    baseSalary: number;
    presentDays: number;
    absentDays: number;
    explicitAbsentDays: number;
    implicitAbsentDays: number;
    lateDays: number;
    totalLateMinutes: number;
    shiftHours: number;
    totalWorkingDays: number;
    deductions: number;
    lateDeductions: number;
    netSalary: number;
    attendanceRate: number;
  }>;
  totals: {
    totalBaseSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    employeeCount: number;
  };
  frozenAt: Date;
  frozenBy: string;
  approvedAt?: Date;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSnapshotSchema = new Schema<IPayrollSnapshot>({
  id: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true },
  branchId: { type: String },
  year: { type: Number, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  status: { type: String, enum: ['frozen', 'approved'], default: 'frozen', required: true },
  employees: [{
    employeeId: { type: String, required: true },
    name: { type: String },
    role: { type: String },
    baseSalary: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    explicitAbsentDays: { type: Number, default: 0 },
    implicitAbsentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    totalLateMinutes: { type: Number, default: 0 },
    shiftHours: { type: Number, default: 8 },
    totalWorkingDays: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    lateDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 },
  }],
  totals: {
    totalBaseSalary: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNetSalary: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
  },
  frozenAt: { type: Date, required: true },
  frozenBy: { type: String, required: true },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PayrollSnapshotSchema.index({ tenantId: 1, year: 1, month: 1 }, { unique: true });
PayrollSnapshotSchema.index({ tenantId: 1, status: 1 });

export const PayrollSnapshotModel = mongoose.models['PayrollSnapshot'] || mongoose.model<IPayrollSnapshot>("PayrollSnapshot", PayrollSnapshotSchema);
