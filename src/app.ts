import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import routes from './routes';
import AppError from './utils/AppError';
import globalErrorHandler from './middlewares/error.middleware';

const app = express();

// 1) GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to avoid blocking resources for the React SPAs
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Enable CORS
app.use(cors());

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 2) ROUTES
app.use('/api', routes);

// Serve Admin Dashboard
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.get('/admin/*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Serve Doctor Portal
app.use('/doctor', express.static(path.join(__dirname, '../public/doctor')));
app.get('/doctor/*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/doctor/index.html'));
});

// Handle unhandled routes (404)
app.all('*', (req: Request, _res: Response, next: NextFunction) => {
  if (req.originalUrl.startsWith('/admin') || req.originalUrl.startsWith('/doctor')) {
    return next();
  }
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 3) GLOBAL ERROR HANDLING MIDDLEWARE
app.use(globalErrorHandler);

export default app;
