import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as authService from '../services/auth.service';
import catchAsync from '../utils/catchAsync';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { localizeMessage } from '../utils/localizeMessage';
import User from '../models/user.model';
import Doctor from '../models/doctor.model';
import AppError from '../utils/AppError';
import * as cloudinaryService from '../services/cloudinary.service';


export const register = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);

  res.status(201).json({
    status: 'success',
    message: localizeMessage(req, 'register_success'),
    data: result,
  });
});

export const sendOtp = catchAsync(async (req: Request, res: Response) => {
  const { phone, email, name } = req.body;
  const result = await authService.requestOtp(phone, email, name);

  const isDevOtpOnScreen = Boolean(result?.devCode);
  res.status(200).json({
    status: 'success',
    message: localizeMessage(
      req,
      isDevOtpOnScreen ? 'otp_sent_on_screen' : 'otp_sent'
    ),
    ...(result?.devCode ? { devCode: result.devCode, otpOnScreen: true } : {}),
  });
});

export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, code } = req.body;
  await authService.verifyOtp(email, code);

  res.status(200).json({
    status: 'success',
    message: localizeMessage(req, 'otp_verified'),
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);

  res.status(200).json({
    status: 'success',
    message: localizeMessage(req, 'login_success'),
    data: result,
  });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || '';
  const { email } = await authService.verifyEmailByToken(token);

  const message = localizeMessage(req, 'email_verified_success');

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>DocPoint</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:48px;background:#F2F2F7;">
        <h1 style="color:#0A84FF;">DocPoint</h1>
        <p style="font-size:18px;color:#1C1C1E;">${message}</p>
        <p style="color:#8E8E93;">${email}</p>
        <p style="color:#8E8E93;">You can now sign in to the DocPoint app.</p>
      </body>
    </html>
  `);
});

export const getMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not found', 404);
  }
  const userResponse = req.user.toObject();
  delete userResponse.password;

  res.status(200).json({
    status: 'success',
    data: {
      user: userResponse,
    },
  });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { type, email, phone } = req.body;
  const value = type === 'email' ? email : phone;
  const result = await authService.forgotPassword(type, value);

  res.status(200).json({
    status: 'success',
    message: result.message ? localizeMessage(req, result.message) : undefined,
    ...result,
  });
});

export const resetPasswordPage = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token as string) || '';
  
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>DocPoint - Error</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:48px;background:#F2F2F7;">
          <h1 style="color:#FF3B30;">Link Invalid or Expired</h1>
          <p style="font-size:16px;color:#1C1C1E;">This password reset link is invalid or has expired.</p>
        </body>
      </html>
    `);
  }

  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>DocPoint - Reset Password</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, sans-serif; text-align: center; padding: 48px 24px; background: #F2F2F7; }
          .container { max-width: 400px; margin: 0 auto; background: #fff; padding: 32px 24px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
          h2 { color: #0A84FF; margin-top: 0; }
          input { width: 100%; height: 48px; border: 1px solid #C7C7CC; border-radius: 8px; box-sizing: border-box; padding: 0 16px; font-size: 16px; margin-bottom: 16px; }
          button { width: 100%; height: 48px; border: none; background: #0A84FF; color: #fff; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }
          button:hover { background: #007AFF; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Password</h2>
          <p style="color:#8E8E93;font-size:14px;margin-bottom:24px;">Enter your new password below.</p>
          <form action="/api/auth/reset-password-submit" method="POST">
            <input type="hidden" name="token" value="${token}" />
            <input type="password" name="password" placeholder="New Password" required minlength="6" />
            <input type="password" name="confirmPassword" placeholder="Confirm Password" required minlength="6" />
            <button type="submit">Submit</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

export const resetPasswordSubmit = catchAsync(async (req: Request, res: Response) => {
  const { token, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>DocPoint - Error</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:48px;background:#F2F2F7;">
          <h1 style="color:#FF3B30;">Passwords Mismatch</h1>
          <p style="font-size:16px;color:#1C1C1E;">Passwords entered do not match. Please go back and try again.</p>
        </body>
      </html>
    `);
  }

  try {
    await authService.resetPasswordWithToken(token, password);
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>DocPoint - Success</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:48px;background:#F2F2F7;">
          <h1 style="color:#34C759;">Success!</h1>
          <p style="font-size:18px;color:#1C1C1E;">Password reset successfully.</p>
          <p style="color:#8E8E93;">You can now close this tab and sign in using the DocPoint app.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>DocPoint - Error</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:48px;background:#F2F2F7;">
          <h1 style="color:#FF3B30;">Error</h1>
          <p style="font-size:16px;color:#1C1C1E;">${localizeMessage(req, error.message) || 'Something went wrong.'}</p>
        </body>
      </html>
    `);
  }
});

export const resetPasswordOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  await authService.resetPasswordWithOtp(email, password);

  res.status(200).json({
    status: 'success',
    message: localizeMessage(req, 'password_reset_success'),
  });
});

export const seedAdmin = catchAsync(async (req: Request, res: Response) => {
  const { email, password, name, phone } = req.body;

  if (!email || !password || !name || !phone) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide email, password, name, and phone to seed admin',
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    existingUser.role = 'admin';
    existingUser.isEmailVerified = true;
    if (password) {
      existingUser.password = password;
    }
    await existingUser.save();

    console.log('\n======================================');
    console.log('  ✅  ADMIN PROMOTED (existing user)');
    console.log('======================================');
    console.log(`  Name   : ${existingUser.name}`);
    console.log(`  Email  : ${existingUser.email}`);
    console.log(`  Phone  : ${existingUser.phone}`);
    console.log(`  Role   : ${existingUser.role}`);
    if (password) console.log(`  Password: ${password}`);
    console.log('======================================\n');

    return res.status(200).json({
      status: 'success',
      message: `User ${email} has been promoted to Admin and password updated.`,
    });
  }

  const adminUser = await User.create({
    name,
    email: email.toLowerCase().trim(),
    phone,
    password,
    role: 'admin',
    isEmailVerified: true,
  });

  console.log('\n======================================');
  console.log('  ✅  ADMIN ACCOUNT CREATED');
  console.log('======================================');
  console.log(`  Name     : ${adminUser.name}`);
  console.log(`  Email    : ${adminUser.email}`);
  console.log(`  Phone    : ${adminUser.phone}`);
  console.log(`  Role     : ${adminUser.role}`);
  console.log(`  Password : ${password}`);
  console.log('======================================\n');

  return res.status(201).json({
    status: 'success',
    message: 'Admin user created successfully',
    data: {
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    },
  });
});

export const completeProfile = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const doctorId = req.user?._id;
  const {
    profilePhoto,
    gender,
    dob,
    address,
    specialization,
    experience,
    qualification,
    licenseNumber,
    clinicName,
    clinicAddress,
    consultationFee,
    consultationTypes,
  } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  let profilePhotoUrl = profilePhoto;
  if (profilePhoto && profilePhoto.startsWith('data:')) {
    profilePhotoUrl = await cloudinaryService.uploadBase64Image(profilePhoto, 'docpoint/doctors');
  }

  const parsedConsultationTypes = consultationTypes ? {
    video: {
      active: !!consultationTypes.video?.active,
      fee: consultationTypes.video?.fee ? Number(consultationTypes.video.fee) : 0,
    },
    clinic: {
      active: !!consultationTypes.clinic?.active,
      fee: consultationTypes.clinic?.fee ? Number(consultationTypes.clinic.fee) : 0,
    },
    chat: {
      active: !!consultationTypes.chat?.active,
      fee: consultationTypes.chat?.fee ? Number(consultationTypes.chat.fee) : 0,
    },
  } : undefined;

  doctor.doctorProfile = {
    profilePhoto: profilePhotoUrl,
    gender,
    dob,
    address,
    specialization,
    experience: experience ? Number(experience) : undefined,
    qualification,
    licenseNumber,
    clinicName,
    clinicAddress,
    consultationFee: consultationFee ? Number(consultationFee) : undefined,
    consultationTypes: parsedConsultationTypes,
  };
  doctor.isProfileCompleted = true;
  await doctor.save();

  const userResponse = doctor.toObject();
  delete userResponse.password;

  res.status(200).json({
    status: 'success',
    message: 'Profile completed successfully',
    data: {
      user: userResponse,
    },
  });
});

export const uploadDocuments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const doctorId = req.user?._id;
  const { medicalLicense, degreeCertificate, governmentId } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  let medicalLicenseUrl = medicalLicense;
  if (medicalLicense && medicalLicense.startsWith('data:')) {
    medicalLicenseUrl = await cloudinaryService.uploadBase64Image(medicalLicense, 'docpoint/documents');
  }

  let degreeCertificateUrl = degreeCertificate;
  if (degreeCertificate && degreeCertificate.startsWith('data:')) {
    degreeCertificateUrl = await cloudinaryService.uploadBase64Image(degreeCertificate, 'docpoint/documents');
  }

  let governmentIdUrl = governmentId;
  if (governmentId && governmentId.startsWith('data:')) {
    governmentIdUrl = await cloudinaryService.uploadBase64Image(governmentId, 'docpoint/documents');
  }

  doctor.verificationDocuments = {
    medicalLicense: medicalLicenseUrl,
    degreeCertificate: degreeCertificateUrl,
    governmentId: governmentIdUrl,
  };
  doctor.verificationStatus = 'pending_approval';
  await doctor.save();

  const userResponse = doctor.toObject();
  delete userResponse.password;

  res.status(200).json({
    status: 'success',
    message: 'Documents uploaded successfully. Waiting for admin approval.',
    data: {
      user: userResponse,
    },
  });
});

export const getDoctors = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { search, specialty, gender, sort, page = 1, limit = 20 } = req.query;

  const query: any = {
    status: 'active',
    verificationStatus: 'approved',
  };

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    query.$or = [
      { name: searchRegex },
      { 'doctorProfile.clinicName': searchRegex },
      { 'doctorProfile.specialization': searchRegex },
      { 'doctorProfile.qualification': searchRegex },
    ];
  }

  if (specialty && specialty !== 'All') {
    query['doctorProfile.specialization'] = new RegExp(`^${specialty}$`, 'i');
  }

  if (gender && gender !== 'any') {
    query['doctorProfile.gender'] = gender;
  }

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  let sortOption: any = { createdAt: -1 };
  if (sort === 'low_high') {
    sortOption = { 'doctorProfile.consultationFee': 1 };
  } else if (sort === 'high_low') {
    sortOption = { 'doctorProfile.consultationFee': -1 };
  }

  let total = await Doctor.countDocuments(query);
  let doctorsList = await Doctor.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum);

  // Auto-seed mock doctors if database has none
  if (total === 0 && !search && (!specialty || specialty === 'All') && (!gender || gender === 'any')) {
    const mockDoctors = [
      {
        name: 'Dr. Raj Patel',
        email: 'raj.patel@docpoint.com',
        phone: '+919999999991',
        isEmailVerified: true,
        role: 'doctor' as const,
        status: 'active' as const,
        verificationStatus: 'approved' as const,
        isProfileCompleted: true,
        doctorProfile: {
          specialization: 'Cardiologist',
          qualification: 'MBBS, MD, FACC',
          experience: 12,
          consultationFee: 500,
          clinicName: 'Apollo Clinic',
          clinicAddress: '123 Apollo Circle, Ahmedabad',
          gender: 'male',
          dob: '1984-05-15',
        },
      },
      {
        name: 'Dr. Sneha Sharma',
        email: 'sneha.sharma@docpoint.com',
        phone: '+919999999992',
        isEmailVerified: true,
        role: 'doctor' as const,
        status: 'active' as const,
        verificationStatus: 'approved' as const,
        isProfileCompleted: true,
        doctorProfile: {
          specialization: 'Pediatrician',
          qualification: 'MBBS, DCH, MD',
          experience: 8,
          consultationFee: 400,
          clinicName: 'Kids Care Clinic',
          clinicAddress: '456 Kinder Rd, Ahmedabad',
          gender: 'female',
          dob: '1990-08-22',
        },
      },
      {
        name: 'Dr. Rohan Gupta',
        email: 'rohan.gupta@docpoint.com',
        phone: '+919999999993',
        isEmailVerified: true,
        role: 'doctor' as const,
        status: 'active' as const,
        verificationStatus: 'approved' as const,
        isProfileCompleted: true,
        doctorProfile: {
          specialization: 'Dermatologist',
          qualification: 'MBBS, DVD, MD',
          experience: 10,
          consultationFee: 450,
          clinicName: 'Skin Care Clinic',
          clinicAddress: '789 Derma Way, Ahmedabad',
          gender: 'male',
          dob: '1988-12-05',
        },
      },
    ];

    for (const doc of mockDoctors) {
      await Doctor.create(doc);
    }

    total = await Doctor.countDocuments(query);
    doctorsList = await Doctor.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);
  }

  const formattedDoctors = doctorsList.map((doc) => {
    const docObj = doc.toObject();
    return {
      id: docObj._id.toString(),
      name: docObj.name,
      email: docObj.email,
      phone: docObj.phone,
      verificationStatus: docObj.verificationStatus,
      specializationKey: `home.categories.${(docObj.doctorProfile?.specialization || 'cardiologist').toLowerCase().replace(/\s+/g, '_')}`,
      qualification: docObj.doctorProfile?.qualification || 'MBBS',
      experience: docObj.doctorProfile?.experience || 5,
      fee: docObj.doctorProfile?.consultationFee || 200,
      clinicName: docObj.doctorProfile?.clinicName || 'DocPoint Clinic',
      clinicAddress: docObj.doctorProfile?.clinicAddress || 'Clinic Address',
      profilePhoto: docObj.doctorProfile?.profilePhoto || null,
      gender: docObj.doctorProfile?.gender || 'male',
      rating: 4.8,
      reviewsCount: 120,
      distance: 2.5,
      status: 'available',
      types: ['video', 'clinic', 'chat'],
    };
  });

  res.status(200).json({
    status: 'success',
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: {
      doctors: formattedDoctors,
    },
  });
});

export const getFamilyMembers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      familyMembers: user.familyMembers || [],
    },
  });
});

export const addFamilyMember = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, dob, gender, relation, image } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Generate initials
  const initials = name
    .trim()
    .split(/\s+/)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  if (!user.familyMembers) {
    user.familyMembers = [];
  }

  let imageUrl = image;
  if (image && image.startsWith('data:')) {
    imageUrl = await cloudinaryService.uploadBase64Image(image, 'docpoint/family');
  }

  user.familyMembers.push({
    _id: new mongoose.Types.ObjectId(),
    name,
    phone,
    dob,
    gender,
    relation,
    initials: initials || name[0]?.toUpperCase() || 'F',
    image: imageUrl,
  });

  await user.save();

  res.status(201).json({
    status: 'success',
    message: 'Family member added successfully',
    data: {
      familyMembers: user.familyMembers,
    },
  });
});

export const deleteFamilyMember = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.familyMembers) {
    user.familyMembers = [];
  }

  user.familyMembers = user.familyMembers.filter(
    (member: any) => member._id.toString() !== id
  );

  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Family member deleted successfully',
    data: {
      familyMembers: user.familyMembers,
    },
  });
});

