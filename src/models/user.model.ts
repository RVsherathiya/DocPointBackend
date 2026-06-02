import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password?: string;
  isEmailVerified: boolean;
  role: 'patient' | 'doctor' | 'admin';
  status: 'active' | 'blocked';
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isProfileCompleted: boolean;
  image?: string;
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
  };
  verificationDocuments?: {
    medicalLicense?: string;
    degreeCertificate?: string;
    governmentId?: string;
  };
  familyMembers?: Array<{
    _id: any;
    name: string;
    phone: string;
    dob: string;
    gender: string;
    relation: string;
    initials?: string;
    image?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema: Schema<IUser> = new Schema(
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
      enum: ['patient', 'admin'],
      default: 'patient',
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
    familyMembers: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        dob: { type: String, required: true },
        gender: { type: String, required: true },
        relation: { type: String, required: true },
        initials: { type: String },
        image: { type: String },
      },
    ],
    image: { type: String },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password
userSchema.pre<IUser>('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  if (this.password) {
    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);
export default User;
