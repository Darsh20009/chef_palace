import mongoose, { Schema, Document } from "mongoose";

export interface ILeaveRequest extends Document {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: Date;
  rejectionReason?: string;
  numberOfDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>({
  employeeId: { type: String, required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  approvedBy: { type: String },
  approvalDate: { type: Date },
  rejectionReason: { type: String },
  numberOfDays: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

export const LeaveRequestModel = mongoose.model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);
