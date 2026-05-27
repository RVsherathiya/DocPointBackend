import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'Name is required',
    })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must be at most 50 characters'),
    email: z.string({
      required_error: 'Email is required',
    })
      .trim()
      .email('Please provide a valid email address')
      .max(100, 'Email must be at most 100 characters')
      .toLowerCase(),
    phone: z.string({
      required_error: 'Phone number is required',
    })
      .trim()
      .min(7, 'Phone number must be at least 7 digits')
      .max(20, 'Phone number must be at most 20 digits'),
    password: z.string({
      required_error: 'Password is required',
    })
      .min(6, 'Password must be at least 6 characters long')
      .max(32, 'Password must be at most 32 characters long'),
    idToken: z.string().optional(),
    role: z.enum(['patient', 'doctor', 'admin']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().email('Please provide a valid email address').optional(),
      phone: z.string().trim().optional(),
      password: z.string({
        required_error: 'Password is required',
      }).min(6, 'Password must be at least 6 characters long'),
    })
    .refine((data) => data.email || data.phone, {
      message: 'Either email or phone number is required to login',
      path: ['email'],
    }),
});

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string({
      required_error: 'Phone number is required',
    })
      .trim()
      .min(7, 'Phone number must be at least 7 digits')
      .max(20, 'Phone number must be at most 20 digits'),
    email: z.string({
      required_error: 'Email is required',
    })
      .trim()
      .email('Please provide a valid email address')
      .toLowerCase(),
    name: z.string().trim().min(2).max(50).optional(),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: 'Email is required',
    })
      .trim()
      .email('Please provide a valid email address')
      .toLowerCase(),
    code: z.string({
      required_error: 'Verification code is required',
    })
      .trim()
      .length(6, 'Verification code must be exactly 6 digits'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    type: z.enum(['email', 'phone'], {
      required_error: 'Type is required',
    }),
    email: z.string().trim().email('Please provide a valid email address').toLowerCase().optional(),
    phone: z.string().trim().optional(),
  }).refine((data) => {
    if (data.type === 'email') return !!data.email;
    if (data.type === 'phone') return !!data.phone;
    return false;
  }, {
    message: 'Value for selected forgot password method is required',
    path: ['email'],
  }),
});

export const resetPasswordOtpSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: 'Email is required',
    })
      .trim()
      .email('Please provide a valid email address')
      .toLowerCase(),
    password: z.string({
      required_error: 'Password is required',
    })
      .min(6, 'Password must be at least 6 characters long')
      .max(32, 'Password must be at most 32 characters long'),
  }),
});
