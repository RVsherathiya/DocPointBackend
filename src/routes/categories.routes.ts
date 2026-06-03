import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = Router();

// Public route
router.get('/', categoryController.getAllCategories);

// Admin-only routes (protected and restricted)
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', categoryController.createCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

export default router;
