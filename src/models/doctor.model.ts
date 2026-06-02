import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IDoctor extends Document {
  name: string;
  email: string;
  phone: string;
  password?: string;
  isEmailVerified: boolean;
  role: 'doctor';
  status: 'active' | 'blocked';
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isProfileCompleted: boolean;
  verificationStatus: 'pending_upload' | 'pending_approval' | 'approved' | 'rejected';
  doctorProfile?: {
    profilePhoto?: string;
    gender?: string;
    dob?: string;
    address?: string;
    specialization?: string;
    experience?: number;
    qualification?: string;
    licenseNumber?: string;
    clinicName?: string;
    clinicAddress?: string;
    consultationFee?: number;
    consultationTypes?: {
      video?: { active: boolean; fee: number };
      clinic?: { active: boolean; fee: number };
      chat?: { active: boolean; fee: number };
    };
  };
  verificationDocuments?: {
    medicalLicense?: string;
    degreeCertificate?: string;
    governmentId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const doctorSchema: Schema<IDoctor> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Please provide your phone number'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['doctor'],
      default: 'doctor',
    },
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['pending_upload', 'pending_approval', 'approved', 'rejected'],
      default: 'pending_upload',
    },
    doctorProfile: {
      profilePhoto: { type: String },
      gender: { type: String },
      dob: { type: String },
      address: { type: String },
      specialization: { type: String },
      experience: { type: Number },
      qualification: { type: String },
      licenseNumber: { type: String },
      clinicName: { type: String },
      clinicAddress: { type: String },
      consultationFee: { type: Number },
      consultationTypes: {
        video: {
          active: { type: Boolean, default: false },
          fee: { type: Number, default: 0 }
        },
        clinic: {
          active: { type: Boolean, default: false },
          fee: { type: Number, default: 0 }
        },
        chat: {
          active: { type: Boolean, default: false },
          fee: { type: Number, default: 0 }
        }
      }
    },
    verificationDocuments: {
      medicalLicense: { type: String },
      degreeCertificate: { type: String },
      governmentId: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
doctorSchema.pre<IDoctor>('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  if (this.password) {
    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Instance method to compare password
doctorSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const Doctor = mongoose.model<IDoctor>('Doctor', doctorSchema);
export default Doctor;
