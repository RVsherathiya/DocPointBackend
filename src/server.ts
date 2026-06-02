import app from './app';
import env from './config/env';
import connectDB from './config/db';
import logger from './utils/logger';

// Handle Uncaught Exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack || 'No stack trace');
  process.exit(1);
});

// Connect to Database
connectDB();

const PORT = env.PORT || 5001;

// Start Server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`🔗 Server URL: https://docpointbackend-1.onrender.com/api`);

  // ─── Admin Credentials Banner ────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║         🔐 ADMIN CREDENTIALS         ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Name     : ${(env.ADMIN_NAME     || 'Super Admin').padEnd(23)}║`);
  console.log(`║  Email    : ${(env.ADMIN_EMAIL    || 'admin@docpoint.com').padEnd(23)}║`);
  console.log(`║  Phone    : ${(env.ADMIN_PHONE    || '+919876543210').padEnd(23)}║`);
  console.log(`║  Password : ${(env.ADMIN_PASSWORD || 'Admin@1234').padEnd(23)}║`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  URL: https://docpointbackend-1.onrender.com ║');
  console.log('╚══════════════════════════════════════╝\n');
  // ─────────────────────────────────────────────────────────────────────
  // Seed initial doctors/data on startup if db is empty
});

// Handle Unhandled Rejections
process.on('unhandledRejection', (err: any) => {
  logger.error('💥 UNHANDLED REJECTION! Shutting down...');
  logger.error(`${err.name}: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});
