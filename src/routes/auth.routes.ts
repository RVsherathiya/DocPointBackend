import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import validateRequest from '../middlewares/validation.middleware';
import { registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordOtpSchema } from '../validations/auth.validation';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/send-otp', validateRequest(sendOtpSchema), authController.sendOtp);
router.post('/verify-otp', validateRequest(verifyOtpSchema), authController.verifyOtp);
router.get('/verify-email', authController.verifyEmail);
router.get('/me', protect, authController.getMe);
router.post('/complete-profile', protect, authController.completeProfile);
router.post('/upload-documents', protect, authController.uploadDocuments);
router.get('/doctors', protect, authController.getDoctors);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.get('/reset-password', authController.resetPasswordPage);
router.post('/reset-password-submit', authController.resetPasswordSubmit);
router.post('/reset-password-otp', validateRequest(resetPasswordOtpSchema), authController.resetPasswordOtp);
router.post('/seed-admin', authController.seedAdmin);

export default router;
