import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', appointmentController.getAppointments);
router.post('/', appointmentController.bookAppointment);
router.post('/:id/cancel', appointmentController.cancelAppointment);
router.post('/:id/reschedule', appointmentController.rescheduleAppointment);
router.post('/:id/review', appointmentController.addReview);

export default router;
