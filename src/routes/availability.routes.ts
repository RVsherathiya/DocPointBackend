import { Router } from 'express';
import * as availabilityController from '../controllers/availability.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import validateRequest from '../middlewares/validation.middleware';
import { setAvailabilitySchema } from '../validations/availability.validation';

const router = Router();

router.get('/doctor/:doctorId', protect, availabilityController.getAvailability);
router.get('/doctor-slots', protect, availabilityController.getDoctorSlots);

// All other routes below require authentication and doctor-specific role restriction
router.use(protect);
router.use(restrictTo('doctor'));

router.post('/', validateRequest(setAvailabilitySchema), availabilityController.setAvailability);
router.get('/me', availabilityController.getMyAvailability);

export default router;
