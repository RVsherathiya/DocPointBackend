import env from '../config/env';
import Otp from '../models/otp.model';
import AppError from '../utils/AppError';
import https from 'https';
import * as emailService from './email.service';
import logger from '../utils/logger';

/**
 * Generate a secure 6-digit numerical OTP
 */
export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via Twilio REST API using native Node.js https module
 */
export const sendOtpSms = (phone: string, otp: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const accountSid = env.TWILIO_ACCOUNT_SID!;
    const authToken = env.TWILIO_AUTH_TOKEN!;
    const fromNumber = env.TWILIO_PHONE_NUMBER!;

    const postData = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: `Your DocPoint verification code is: ${otp}. It will expire in 5 minutes.`,
    }).toString();

    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[OTP SMS Sent via Twilio] Phone: ${phone}`);
          resolve(true);
        } else {
          console.error('[Twilio Response Error]', data);
          reject(new AppError('sms_send_failed', 500));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[Twilio Network Error]', e);
      reject(new AppError('sms_send_failed', 500));
    });

    req.write(postData);
    req.end();
  });
};

export interface SendOtpResult {
  devCode?: string;
  otpOnScreen?: boolean;
}

/**
 * Save OTP to database and send via email (primary) and optionally SMS when Twilio is configured.
 */
export const saveAndSendOtp = async (
  phone: string,
  email: string,
  recipientName?: string
): Promise<SendOtpResult> => {
  const otp = generateOtp();
  const normalizedEmail = email.toLowerCase().trim();

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.deleteMany({ email: normalizedEmail });

  const created = await Otp.create({
    phone,
    email: normalizedEmail,
    otp,
    expiresAt,
  });
  logger.info(`[OTP CREATED] email="${normalizedEmail}" otp="${otp}" id=${created._id}`);

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const fromNumber = env.TWILIO_PHONE_NUMBER;
  const smtpConfigured = emailService.isSmtpConfigured();

  if (smtpConfigured) {
    try {
      await emailService.sendOtpEmail(normalizedEmail, otp, recipientName);
    } catch (err) {
      if (env.NODE_ENV !== 'development') {
        throw err;
      }
      console.warn(
        '[SMTP] OTP email failed — code will be shown in the app. Fix SMTP_PASS in .env for real email.',
        err
      );
    }
  } else {
    await emailService.sendOtpEmail(normalizedEmail, otp, recipientName);
  }

  if (accountSid && authToken && fromNumber) {
    try {
      await sendOtpSms(phone, otp);
    } catch (err) {
      console.warn('[Twilio] SMS failed; email OTP may still be valid.', err);
    }
  }

  // In development always return OTP for on-screen display (email may not arrive).
  if (env.NODE_ENV === 'development') {
    return { devCode: otp, otpOnScreen: true };
  }

  return {};
};

const REGISTRATION_WINDOW_MS = 15 * 60 * 1000;

const findOtpRecord = async (normalizedEmail: string, code: string) => {
  // Diagnostic: check what exists for this email
  const allForEmail = await Otp.find({ email: normalizedEmail });
  logger.info(`[OTP VERIFY] email="${normalizedEmail}" code="${code}" | DB records: ${allForEmail.length}`);
  if (allForEmail.length > 0) {
    allForEmail.forEach((r, i) => logger.info(`  [${i}] storedOtp="${r.otp}" match=${r.otp === code} expired=${new Date() > r.expiresAt}`));
  }

  const record = await Otp.findOne({ email: normalizedEmail, otp: code });

  if (!record) {
    throw new AppError('otp_invalid', 400);
  }

  if (new Date() > record.expiresAt) {
    await Otp.deleteOne({ _id: record._id });
    throw new AppError('otp_expired', 400);
  }

  return record;
};

/**
 * Step 2: Validate OTP and mark email ready for registration (does not create user).
 */
export const markOtpVerifiedForRegistration = async (
  email: string,
  code: string
): Promise<boolean> => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await findOtpRecord(normalizedEmail, code);
  record.verifiedAt = new Date();
  await record.save();
  return true;
};

/**
 * Step 3: Ensure OTP was verified before completing registration.
 */
export const consumeVerifiedRegistrationOtp = async (email: string): Promise<void> => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await Otp.findOne({
    email: normalizedEmail,
    verifiedAt: { $ne: null },
  });

  if (!record) {
    throw new AppError('otp_not_verified', 400);
  }

  if (new Date() > record.expiresAt) {
    await Otp.deleteOne({ _id: record._id });
    throw new AppError('otp_expired', 400);
  }

  const verifiedAt = record.verifiedAt as Date;
  if (Date.now() - verifiedAt.getTime() > REGISTRATION_WINDOW_MS) {
    await Otp.deleteOne({ _id: record._id });
    throw new AppError('otp_verification_expired', 400);
  }

  await Otp.deleteOne({ _id: record._id });
};
