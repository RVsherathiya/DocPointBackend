import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = Router();

// Apply protection and restrict to admins for all routes under /admin
router.use(protect);
router.use(restrictTo('admin'));

router
  .route('/users')
  .get(adminController.getAllUsers)
  .post(adminController.createUser);

router
  .route('/users/:id')
  .patch(adminController.updateUser)
  .delete(adminController.deleteUser);

router.patch('/users/:id/status', adminController.toggleUserStatus);

export default router;
