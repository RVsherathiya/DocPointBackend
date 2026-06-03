import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import User from '../models/user.model';
import Doctor from '../models/doctor.model';
import AppError from '../utils/AppError';
import * as otpService from './otp.service';
import * as firebaseService from './firebase.service';
import * as emailService from './email.service';
import * as cloudinaryService from './cloudinary.service';

export const signToken = (id: string): string => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password?: string;
  idToken?: string;
  role?: 'patient' | 'doctor' | 'admin';
  image?: string;
}

interface LoginInput {
  email?: string;
  phone?: string;
  password?: string;
}

export const requestOtp = async (
  phone: string,
  email: string,
  name?: string
): Promise<{ devCode?: string }> => {
  const normalizedEmail = email.toLowerCase().trim();

  const existingEmail = await User.findOne({ email: normalizedEmail }) || await Doctor.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw new AppError('email_in_use', 400);
  }

  const existingPhone = await User.findOne({ phone }) || await Doctor.findOne({ phone });
  if (existingPhone) {
    throw new AppError('phone_in_use', 400);
  }

  return await otpService.saveAndSendOtp(phone, normalizedEmail, name);
};

/** Step 2: Verify OTP only (before register). */
export const verifyOtp = async (email: string, code: string) => {
  return await otpService.markOtpVerifiedForRegistration(email, code);
};

/** Step 3: Create account and send email verification link. */
export const registerUser = async (input: RegisterInput) => {
  const { name, email, phone, password, idToken } = input;
  const normalizedEmail = email.toLowerCase().trim();

  if (idToken) {
    const verifiedPhone = await firebaseService.verifyFirebaseToken(idToken);
    const cleanVerified = verifiedPhone.replace(/[+\s]/g, '');
    const cleanInput = phone.replace(/[+\s]/g, '');
    if (cleanVerified !== cleanInput) {
      throw new AppError('phone_mismatch', 400);
    }
  } else {
    await otpService.consumeVerifiedRegistrationOtp(normalizedEmail);
  }

  const existingEmail = await User.findOne({ email: normalizedEmail }) || await Doctor.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw new AppError('email_in_use', 400);
  }

  const existingPhone = await User.findOne({ phone }) || await Doctor.findOne({ phone });
  if (existingPhone) {
    throw new AppError('phone_in_use', 400);
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (input.role === 'doctor') {
    const newDoctor = await Doctor.create({
      name,
      email: normalizedEmail,
      phone,
      password,
      role: 'doctor',
      isEmailVerified: !!idToken,
      emailVerificationToken: idToken ? undefined : verificationToken,
      emailVerificationExpires: idToken ? undefined : verificationExpires,
      isProfileCompleted: false,
      verificationStatus: 'pending_upload',
    });

    if (!idToken) {
      const baseUrl = (env.APP_URL || `http://localhost:${env.PORT}`).replace(/\/$/, '');
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
      try {
        await emailService.sendAccountVerificationEmail(normalizedEmail, verifyUrl, name);
      } catch (err) {
        if (env.NODE_ENV === 'development') {
          console.warn('\n----------------------------------------');
          console.warn('[DEV] Account verification email failed.');
          console.warn(`Open this link in a browser to verify: ${verifyUrl}`);
          console.warn('----------------------------------------\n');
          newDoctor.isEmailVerified = true;
          newDoctor.emailVerificationToken = undefined;
          newDoctor.emailVerificationExpires = undefined;
          await newDoctor.save({ validateBeforeSave: false });
        } else {
          await Doctor.deleteOne({ _id: newDoctor._id });
          throw err;
        }
      }
    }

    const doctorResponse = newDoctor.toObject() as any;
    delete doctorResponse.password;
    delete doctorResponse.emailVerificationToken;
    delete doctorResponse.emailVerificationExpires;

    return {
      user: doctorResponse,
    };
  } else {
    let imageUrl: string | undefined;
    if (input.image && input.image.startsWith('data:')) {
      imageUrl = await cloudinaryService.uploadBase64Image(input.image, 'docpoint/profiles');
    }

    const newUser = await User.create({
      name,
      email: normalizedEmail,
      phone,
      password,
      role: input.role || 'patient',
      isEmailVerified: !!idToken,
      emailVerificationToken: idToken ? undefined : verificationToken,
      emailVerificationExpires: idToken ? undefined : verificationExpires,
      image: imageUrl,
    });

    if (!idToken) {
      const baseUrl = (env.APP_URL || `http://localhost:${env.PORT}`).replace(/\/$/, '');
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
      try {
        await emailService.sendAccountVerificationEmail(normalizedEmail, verifyUrl, name);
      } catch (err) {
        if (env.NODE_ENV === 'development') {
          console.warn('\n----------------------------------------');
          console.warn('[DEV] Account verification email failed.');
          console.warn(`Open this link in a browser to verify: ${verifyUrl}`);
          console.warn('----------------------------------------\n');
          newUser.isEmailVerified = true;
          newUser.emailVerificationToken = undefined;
          newUser.emailVerificationExpires = undefined;
          await newUser.save({ validateBeforeSave: false });
        } else {
          await User.deleteOne({ _id: newUser._id });
          throw err;
        }
      }
    }

    const userResponse = newUser.toObject() as any;
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;

    return {
      user: userResponse,
    };
  }
};

export const verifyEmailByToken = async (token: string) => {
  let user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    user = await Doctor.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires') as any;
  }

  if (!user) {
    throw new AppError('email_verify_link_invalid', 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return { email: user.email };
};

export const loginUser = async (input: LoginInput) => {
  const { email, phone, password } = input;

  if ((!email && !phone) || !password) {
    throw new AppError('credentials_required', 400);
  }

  let user;
  if (email) {
    const normalized = email.toLowerCase().trim();
    user = await User.findOne({ email: normalized }).select('+password') ||
           await Doctor.findOne({ email: normalized }).select('+password');
  } else if (phone) {
    user = await User.findOne({ phone }).select('+password') ||
           await Doctor.findOne({ phone }).select('+password');
  }

  if (!user || !(await user.comparePassword(password))) {
    const errorKey = email ? 'incorrect_email_password' : 'incorrect_phone_password';
    throw new AppError(errorKey, 401);
  }

  if (user.isEmailVerified === false) {
    throw new AppError('email_not_verified', 403);
  }

  if (user.status === 'blocked') {
    throw new AppError('Your account has been blocked. Please contact support.', 403);
  }

  const token = signToken(user.id);

  const userResponse = user.toObject() as any;
  delete userResponse.password;

  return {
    user: userResponse,
    token,
  };
};

export const forgotPassword = async (
  type: 'email' | 'phone',
  value: string
): Promise<{ devCode?: string; email?: string; message?: string }> => {
  if (type === 'phone') {
    const user = await User.findOne({ phone: value }) || await Doctor.findOne({ phone: value });
    if (!user) {
      throw new AppError('user_not_found', 404);
    }
    const result = await otpService.saveAndSendOtp(value, user.email, user.name);
    return { devCode: result?.devCode, email: user.email };
  } else {
    const normalizedEmail = value.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }) || await Doctor.findOne({ email: normalizedEmail });
    if (!user) {
      throw new AppError('user_not_found', 404);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save({ validateBeforeSave: false });

    const baseUrl = (env.APP_URL || `http://localhost:${env.PORT || 5001}`).replace(/\/$/, '');
    const resetUrl = `${baseUrl}/api/auth/reset-password?token=${resetToken}`;
    
    const smtpConfigured = emailService.isSmtpConfigured();

    if (smtpConfigured) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT || 587,
          secure: (env.SMTP_PORT || 587) === 465,
          auth: {
            user: env.SMTP_USER?.trim(),
            pass: env.SMTP_PASS?.replace(/\s+/g, ''),
          },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });
        await transporter.sendMail({
          from: `"DocPoint" <${env.SMTP_FROM || env.SMTP_USER}>`,
          to: normalizedEmail,
          subject: 'Reset your DocPoint password',
          text: `You requested a password reset. Reset your password using this link: ${resetUrl}`,
          html: `
            <div style="font-family: sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <h2 style="color: #0A84FF; text-align: center;">DocPoint</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>You requested to reset your password. Click the button below to reset it. This link is valid for 1 hour.</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0A84FF; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
              </div>
              <p style="color: #8E8E93; font-size: 12px;">If you did not request a password reset, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (err) {
        console.warn('Failed to send reset email via SMTP:', err);
      }
    }

    if (env.NODE_ENV === 'development') {
      console.warn('\n----------------------------------------');
      console.warn('[DEV] Password reset email link:');
      console.warn(`Open this link in a browser to reset: ${resetUrl}`);
      console.warn('----------------------------------------\n');
    }

    return { message: 'password_reset_sent' };
  }
};

export const resetPasswordWithToken = async (token: string, newPassword: string) => {
  let user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires') ||
  await Doctor.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new AppError('password_reset_link_invalid', 400);
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  return user;
};

export const resetPasswordWithOtp = async (email: string, newPassword: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  
  await otpService.consumeVerifiedRegistrationOtp(normalizedEmail);

  const user = await User.findOne({ email: normalizedEmail }) || await Doctor.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError('user_not_found', 404);
  }

  user.password = newPassword;
  await user.save();
  return user;
};
