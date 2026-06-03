import nodemailer from 'nodemailer';
import env from '../config/env';
import AppError from '../utils/AppError';

const BRAND = {
  primary: '#0A84FF',
  secondary: '#5AC8FA',
  accent: '#5856D6',
  dark: '#0A0C10',
  text: '#1C1C1E',
  muted: '#8E8E93',
  background: '#F2F2F7',
  white: '#FFFFFF',
};

const buildOtpEmailHtml = (otp: string, recipientName?: string): string => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DocPoint Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(10,12,16,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.secondary} 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:700;color:${BRAND.white};letter-spacing:-0.5px;">
                Doc<span style="color:${BRAND.white};opacity:0.95;">Point</span>
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">Your digital healthcare portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;font-size:16px;color:${BRAND.text};">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.muted};">
                Enter this code in the DocPoint app to verify your email before creating your account. This code expires in <strong style="color:${BRAND.text};">5 minutes</strong>.
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <span style="display:inline-block;padding:16px 32px;background-color:${BRAND.background};border-radius:12px;border:2px solid ${BRAND.primary};font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.dark};">
                  ${otp}
                </span>
              </div>
              <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted};">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:${BRAND.background};border-top:1px solid #E5E5EA;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};text-align:center;">
                © ${new Date().getFullYear()} DocPoint. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const normalizeSmtpPassword = (pass: string): string => pass.replace(/\s+/g, '');

const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  const port = SMTP_PORT || 587;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER.trim(),
      pass: normalizeSmtpPassword(SMTP_PASS),
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    ...(port === 587 ? { requireTLS: true } : {}),
  });
};

export const sendOtpEmail = async (
  toEmail: string,
  otp: string,
  recipientName?: string
): Promise<boolean> => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n----------------------------------------');
    console.log('[OTP EMAIL SIMULATION]');
    console.log(`To: ${toEmail}`);
    console.log(`OTP Code: ${otp}`);
    console.log('----------------------------------------\n');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"DocPoint" <${env.SMTP_FROM || env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Your DocPoint verification code',
      text: `Your DocPoint verification code is: ${otp}. It expires in 5 minutes.`,
      html: buildOtpEmailHtml(otp, recipientName),
    });
    console.log(`[OTP Email Sent] To: ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[SMTP Error]', error);
    if (error?.code === 'EAUTH') {
      throw new AppError('smtp_auth_failed', 500);
    }
    throw new AppError('email_send_failed', 500);
  }
};

export const isSmtpConfigured = (): boolean => {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
};

const buildVerifyAccountEmailHtml = (
  verifyUrl: string,
  recipientName?: string
): string => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your DocPoint account</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(10,12,16,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.secondary} 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:26px;font-weight:700;color:${BRAND.white};">DocPoint</p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">Verify your account</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;font-size:16px;color:${BRAND.text};">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.muted};">
                Your DocPoint account was created successfully. Please verify your email address to sign in.
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background-color:${BRAND.primary};color:${BRAND.white};text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">
                  Verify Email Address
                </a>
              </div>
              <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted};">
                This link expires in 24 hours. If you did not create an account, ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:${BRAND.background};border-top:1px solid #E5E5EA;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};text-align:center;">
                © ${new Date().getFullYear()} DocPoint
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const sendAccountVerificationEmail = async (
  toEmail: string,
  verifyUrl: string,
  recipientName?: string
): Promise<void> => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n----------------------------------------');
    console.log('[EMAIL VERIFICATION SIMULATION]');
    console.log(`To: ${toEmail}`);
    console.log(`Verify URL: ${verifyUrl}`);
    console.log('----------------------------------------\n');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"DocPoint" <${env.SMTP_FROM || env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Verify your DocPoint account',
      text: `Welcome to DocPoint! Verify your account: ${verifyUrl}`,
      html: buildVerifyAccountEmailHtml(verifyUrl, recipientName),
    });
    console.log(`[Verification Email Sent] To: ${toEmail}`);
  } catch (error: any) {
    console.error('[SMTP Verification Email Error]', error);
    if (error?.code === 'EAUTH') {
      throw new AppError('smtp_auth_failed', 500);
    }
    throw new AppError('email_send_failed', 500);
  }
};
