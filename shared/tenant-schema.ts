import mongoose, { Schema, Document } from "mongoose";

export interface ITenant extends Document {
  id: string;
  nameAr: string;
  nameEn: string;
  type: 'demo' | 'client';
  status: 'active' | 'inactive' | 'suspended';
  subscriptionPlan: string;
  features: any;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>({
  id: { type: String, required: true, unique: true },
  nameAr: { type: String, required: true },
  nameEn: { type: String, required: true },
  type: { type: String, enum: ['demo', 'client'], default: 'demo' },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  subscriptionPlan: { type: String, default: 'free' },
  features: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const TenantModel = mongoose.model<ITenant>("Tenant", TenantSchema);
