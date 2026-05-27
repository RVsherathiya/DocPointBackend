import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';
import User from '../models/user.model';

const seedAdminUser = async (): Promise<void> => {
  try {
    const adminEmail = (env.ADMIN_EMAIL || 'admin@docpoint.com').toLowerCase().trim();
    const adminPhone = env.ADMIN_PHONE || '+919876543210';
    const adminPassword = env.ADMIN_PASSWORD || 'Admin@1234';
    const adminName = env.ADMIN_NAME || 'Super Admin';

    // 1. Check if user exists with the admin email, explicitly selecting the password
    let admin = await User.findOne({ email: adminEmail }).select('+password');

    if (!admin) {
      // Check if phone already in use by another user to avoid validation collision
      const phoneExists = await User.findOne({ phone: adminPhone });
      const finalPhone = phoneExists ? `${adminPhone}_admin` : adminPhone;

      admin = await User.create({
        name: adminName,
        email: adminEmail,
        phone: finalPhone,
        password: adminPassword,
        role: 'admin',
        isEmailVerified: true,
        status: 'active',
      });
      logger.info(`👤 Admin account created automatically: ${adminEmail}`);
    } else {
      // Admin exists, ensure role is admin and is verified
      let needsSave = false;
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        needsSave = true;
      }
      if (!admin.isEmailVerified) {
        admin.isEmailVerified = true;
        needsSave = true;
      }
      if (admin.status !== 'active') {
        admin.status = 'active';
        needsSave = true;
      }

      // Check/reset password to match environment variable if needed
      const isPasswordCorrect = await admin.comparePassword(adminPassword);
      if (!isPasswordCorrect) {
        admin.password = adminPassword;
        needsSave = true;
        logger.info(`👤 Admin password updated in database to match environment config.`);
      }

      if (needsSave) {
        await admin.save();
        logger.info(`👤 Admin account credentials verified and updated in database.`);
      } else {
        logger.info(`👤 Admin account is up-to-date in database.`);
      }
    }
  } catch (error) {
    logger.error(`❌ Auto-seeding admin user failed: ${(error as Error).message}`);
  }
};

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info(`🔌 MongoDB Connected: ${conn.connection.host}`);
    
    // Trigger auto-seeding of admin user
    await seedAdminUser();
  } catch (error) {
    logger.error(`❌ Error connecting to MongoDB: ${(error as Error).message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('🔌 MongoDB connection disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`🔌 MongoDB connection error: ${err}`);
});

export default connectDB;
