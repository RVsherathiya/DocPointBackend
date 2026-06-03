import { Request, Response } from 'express';
import Category from '../models/category.model';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';
import Doctor from '../models/doctor.model';
import * as cloudinaryService from '../services/cloudinary.service';

export const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const filter: any = {};
  const isAdmin = req.query.all === 'true';

  if (!isAdmin) {
    filter.status = 'active';
  }

  let query = Category.find(filter).sort({ name: 1 });

  if (!isAdmin) {
    query = query.limit(5);
  }

  const categories = await query;

  // Dynamically count the number of active doctors under each category
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const count = await Doctor.countDocuments({
        'doctorProfile.specialization': cat.name,
        status: 'active',
      });
      return {
        ...cat.toObject(),
        doctorsCount: count,
      };
    })
  );

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories: categoriesWithCount,
    },
  });
});

export const createCategory = catchAsync(async (req: Request, res: Response) => {
  const { name, color, icon, image, status } = req.body;

  if (!name) {
    throw new AppError('Please provide a category name', 400);
  }

  const existing = await Category.findOne({ name: name.trim() });
  if (existing) {
    throw new AppError('Category already exists', 400);
  }

  let imageUrl = '';
  if (image && image.startsWith('data:image')) {
    imageUrl = await cloudinaryService.uploadBase64Image(image, 'docpoint/categories');
  } else if (image) {
    imageUrl = image;
  }

  const category = await Category.create({
    name: name.trim(),
    color: color || '#0A84FF',
    icon: icon || 'stethoscope',
    image: imageUrl,
    status: status || 'active',
  });

  res.status(201).json({
    status: 'success',
    data: {
      category,
    },
  });
});

export const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, color, icon, image, status } = req.body;

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  if (name) {
    const existing = await Category.findOne({ name: name.trim(), _id: { $ne: id } });
    if (existing) {
      throw new AppError('Category name already exists', 400);
    }
    category.name = name.trim();
  }

  if (color !== undefined) category.color = color;
  if (icon !== undefined) category.icon = icon;
  if (status !== undefined) category.status = status;
  
  if (image !== undefined) {
    if (image && image.startsWith('data:image')) {
      category.image = await cloudinaryService.uploadBase64Image(image, 'docpoint/categories');
    } else {
      category.image = image;
    }
  }

  await category.save();

  res.status(200).json({
    status: 'success',
    data: {
      category,
    },
  });
});

export const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
