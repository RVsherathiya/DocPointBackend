import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  patient: mongoose.Types.ObjectId;
  familyMemberId?: string;
  doctor: mongoose.Types.ObjectId;
  appointmentId: string;
  date: string; // "YYYY-MM-DD"
  timeSlot: string; // e.g. "11:30 AM"
  consultationType: 'video' | 'clinic' | 'chat';
  status: 'upcoming' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  cancellationReason?: string;
  paymentInfo: {
    fee: number;
    paidAmount: number;
    paymentMethod: string;
    transactionStatus: string;
    transactionId: string;
  };
  prescription?: string;
  invoiceUrl?: string;
  doctorNotes?: string;
  review?: {
    rating: number;
    comment: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema: Schema<IAppointment> = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    familyMemberId: {
      type: String,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    appointmentId: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: String,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    consultationType: {
      type: String,
      enum: ['video', 'clinic', 'chat'],
      default: 'video',
    },
    status: {
      type: String,
      enum: ['upcoming', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
      default: 'upcoming',
    },
    cancellationReason: {
      type: String,
    },
    paymentInfo: {
      fee: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      paymentMethod: { type: String, default: 'card' },
      transactionStatus: { type: String, default: 'paid' },
      transactionId: { type: String },
    },
    prescription: {
      type: String,
    },
    invoiceUrl: {
      type: String,
    },
    doctorNotes: {
      type: String,
    },
    review: {
      rating: { type: Number },
      comment: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

const Appointment = mongoose.model<IAppointment>('Appointment', appointmentSchema);
export default Appointment;
