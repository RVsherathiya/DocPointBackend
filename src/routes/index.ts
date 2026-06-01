import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import categoriesRoutes from './categories.routes';

const router = Router();

// Test Route to make sure API is online
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'DocPoint Backend API is healthy!',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/categories', categoriesRoutes);

export default router;
