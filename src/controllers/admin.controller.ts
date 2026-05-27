import { Response } from 'express';
import User from '../models/user.model';
import Doctor from '../models/doctor.model';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Get all users with searching, filtering, sorting, and pagination
 */
export const getAllUsers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { search, role, status, verificationStatus, sort, page = 1, limit = 10 } = req.query;

  const query: any = {};

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    const searchConditions: any[] = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];

    if (role === 'doctor' || !role) {
      searchConditions.push(
        { 'doctorProfile.specialization': searchRegex },
        { 'doctorProfile.clinicName': searchRegex },
        { 'doctorProfile.qualification': searchRegex }
      );
    }

    query.$or = searchConditions;
  }

  if (status) {
    query.status = status;
  }

  if (verificationStatus) {
    query.verificationStatus = verificationStatus;
  }

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  let sortOption: any = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'name-asc') {
    sortOption = { name: 1 };
  } else if (sort === 'name-desc') {
    sortOption = { name: -1 };
  }

  let populatedUsers: any[] = [];
  let total = 0;

  // Handle collections based on role
  if (role === 'doctor') {
    total = await Doctor.countDocuments(query);
    const doctorsList = await Doctor.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);
    populatedUsers = doctorsList.map(d => d.toObject());
  } else if (role === 'patient' || role === 'admin') {
    const userQuery = { ...query, role };
    total = await User.countDocuments(userQuery);
    const usersList = await User.find(userQuery)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);
    populatedUsers = usersList.map(u => u.toObject());
  } else if (req.query.excludeDoctors === 'true') {
    const userQuery = { ...query };
    if (req.query.excludeAdmins === 'true') {
      userQuery.role = { $ne: 'admin' };
    }
    total = await User.countDocuments(userQuery);
    const usersList = await User.find(userQuery)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);
    populatedUsers = usersList.map(u => u.toObject());
  } else {
    // Combined pagination across both collections
    const usersList = await User.find(query);
    const doctorsList = await Doctor.find(query);

    const combined = [
      ...usersList.map(u => u.toObject()),
      ...doctorsList.map(d => d.toObject())
    ];

    // Sort combined records in memory
    if (sort === 'oldest') {
      combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === 'name-asc') {
      combined.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'name-desc') {
      combined.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    total = combined.length;
    populatedUsers = combined.slice(skip, skip + limitNum);
  }

  // Return counts for dashboard indicators along with request
  const patientCount = await User.countDocuments({ role: 'patient' });
  const doctorCount = await Doctor.countDocuments({});
  const adminCount = await User.countDocuments({ role: 'admin' });
  const blockedCount = 
    (await User.countDocuments({ status: 'blocked' })) + 
    (await Doctor.countDocuments({ status: 'blocked' }));

  res.status(200).json({
    status: 'success',
    results: populatedUsers.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    meta: {
      patientCount,
      doctorCount,
      adminCount,
      blockedCount,
    },
    data: {
      users: populatedUsers,
    },
  });
});

/**
 * Create user from admin panel
 */
export const createUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, phone, password, role } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // Validate presence of credentials
  if (!name || !email || !phone || !password) {
    throw new AppError('All fields (name, email, phone, password) are required', 400);
  }

  const existingEmail = await User.findOne({ email: normalizedEmail }) || await Doctor.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw new AppError('Email is already in use', 400);
  }

  const existingPhone = await User.findOne({ phone }) || await Doctor.findOne({ phone });
  if (existingPhone) {
    throw new AppError('Phone number is already in use', 400);
  }

  let createdUser;
  if (role === 'doctor') {
    createdUser = await Doctor.create({
      name,
      email: normalizedEmail,
      phone,
      password,
      role: 'doctor',
      isEmailVerified: true,
      isProfileCompleted: false,
      verificationStatus: 'pending_upload',
    });
  } else {
    createdUser = await User.create({
      name,
      email: normalizedEmail,
      phone,
      password,
      role: role || 'patient',
      isEmailVerified: true,
    });
  }

  const userResponse = createdUser.toObject();
  delete userResponse.password;

  res.status(201).json({
    status: 'success',
    message: 'User created successfully',
    data: {
      user: userResponse,
    },
  });
});

/**
 * Update user details
 */
export const updateUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, role, status, verificationStatus } = req.body;

  // Find user/doctor in either collection
  let user = await User.findById(id) || await Doctor.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: id } }) ||
                          await Doctor.findOne({ email: normalizedEmail, _id: { $ne: id } });
    if (existingEmail) {
      throw new AppError('Email is already in use', 400);
    }
    user.email = normalizedEmail;
  }

  if (phone) {
    const existingPhone = await User.findOne({ phone, _id: { $ne: id } }) ||
                          await Doctor.findOne({ phone, _id: { $ne: id } });
    if (existingPhone) {
      throw new AppError('Phone number is already in use', 400);
    }
    user.phone = phone;
  }

  if (name) user.name = name;
  if (status) user.status = status;

  // Handle role conversion if changing role between doctor and patient/admin
  if (role && role !== user.role) {
    const dummyPasswordHash = '$2a$12$DummyPasswordPlaceholderHashForTypeSafety';
    
    if (user.role === 'doctor') {
      // Remove from Doctor collection and create in User collection
      const credentials = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: (user as any).password || dummyPasswordHash,
        role: role as 'patient' | 'admin',
        isEmailVerified: user.isEmailVerified,
        status: user.status,
      };
      await Doctor.findByIdAndDelete(id);
      user = await User.create({ _id: id, ...credentials });
    } else {
      // Remove from User collection and create in Doctor collection
      const credentials = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: (user as any).password || dummyPasswordHash,
        role: 'doctor' as const,
        isEmailVerified: user.isEmailVerified,
        status: user.status,
        isProfileCompleted: false,
        verificationStatus: 'pending_upload' as const,
      };
      await User.findByIdAndDelete(id);
      user = await Doctor.create({ _id: id, ...credentials });
    }
  }

  if (user.role === 'doctor' && verificationStatus) {
    (user as any).verificationStatus = verificationStatus;
  }

  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    status: 'success',
    message: 'User updated successfully',
    data: {
      user: userResponse,
    },
  });
});

/**
 * Toggle user status (Block/Unblock)
 */
export const toggleUserStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'blocked'].includes(status)) {
    throw new AppError('Please provide a valid status: active or blocked', 400);
  }

  const user = await User.findById(id) || await Doctor.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Prevent blocking yourself
  if (req.user && req.user.id === id) {
    throw new AppError('You cannot block your own admin account!', 400);
  }

  user.status = status;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: `User has been successfully ${status}`,
    data: {
      user,
    },
  });
});

/**
 * Delete a user
 */
export const deleteUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id) || await Doctor.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Prevent deleting yourself
  if (req.user && req.user.id === id) {
    throw new AppError('You cannot delete your own admin account!', 400);
  }

  if (user.role === 'doctor') {
    await Doctor.findByIdAndDelete(id);
  } else {
    await User.findByIdAndDelete(id);
  }

  res.status(200).json({
    status: 'success',
    message: 'User deleted successfully',
  });
});
