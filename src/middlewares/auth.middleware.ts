import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import AppError from '../utils/AppError';
import catchAsync from '../utils/catchAsync';
import User from '../models/user.model';
import Doctor from '../models/doctor.model';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

interface JwtPayload {
  id: string;
}

export const protect = catchAsync(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    // 1) Getting token and check if it exists
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verification token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // 3) Check if user/doctor still exists
    let currentUser = await User.findById(decoded.id) as any;
    if (!currentUser) {
      currentUser = await Doctor.findById(decoded.id);
    }

    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token no longer exists.',
          401
        )
      );
    }

    // Check if user is blocked
    if (currentUser.status === 'blocked') {
      return next(
        new AppError(
          'Your account has been blocked. Please contact support.',
          403
        )
      );
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  }
);

export const restrictTo = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};
