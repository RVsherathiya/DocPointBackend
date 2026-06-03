import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import Category from '../models/category.model';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';
import Doctor from '../models/doctor.model';
import * as cloudinaryService from '../services/cloudinary.service';

export const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const filter: any = {};
  if (req.query.all !== 'true') {
    filter.status = 'active';
  }
  const categories = await Category.find(filter).sort({ name: 1 });

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

export const seedCategories = catchAsync(async (_req: Request, res: Response) => {
  const defaultCategories = [
    { name: 'General Physician', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Dentist', color: '#30C759', icon: 'stethoscope', imageFileName: 'dentist.png' },
    { name: 'Cardiologist', color: '#FF3B30', icon: 'stethoscope', imageFileName: 'cardiologist.png' },
    { name: 'Dermatologist', color: '#FF9500', icon: 'stethoscope', imageFileName: 'dermatologist.png' },
    { name: 'Pediatrician', color: '#5856D6', icon: 'stethoscope', imageFileName: 'pediatrician.png' },
    { name: 'Gynecologist', color: '#FF2D55', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Neurologist', color: '#30B0C7', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Orthopedic Surgeon', color: '#AF52DE', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Psychiatrist', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Ophthalmologist', color: '#30C759', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'ENT Specialist', color: '#FF3B30', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Gastroenterologist', color: '#FF9500', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Oncologist', color: '#5856D6', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Endocrinologist', color: '#FF2D55', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Pulmonologist', color: '#30B0C7', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Urologist', color: '#AF52DE', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Nephrologist', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Rheumatologist', color: '#30C759', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'General Surgeon', color: '#FF3B30', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Plastic Surgeon', color: '#FF9500', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Neurosurgeon', color: '#5856D6', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Cardiothoracic Surgeon', color: '#FF2D55', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Anesthesiologist', color: '#30B0C7', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Radiologist', color: '#AF52DE', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Pathologist', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Emergency Medicine', color: '#FF3B30', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Allergist', color: '#30C759', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Hematologist', color: '#FF9500', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Infectious Disease', color: '#5856D6', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Physiotherapist', color: '#FF2D55', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Chiropractor', color: '#30B0C7', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Podiatrist', color: '#AF52DE', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Audiologist', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Speech Therapist', color: '#30C759', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Nutritionist', color: '#FF9500', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Psychologist', color: '#5856D6', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Occupational Therapist', color: '#FF2D55', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Geriatrician', color: '#30B0C7', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Neonatologist', color: '#AF52DE', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Sports Medicine', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Pain Management', color: '#FF3B30', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Sleep Medicine', color: '#30C759', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Vascular Surgeon', color: '#FF9500', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Bariatric Surgeon', color: '#5856D6', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Colorectal Surgeon', color: '#FF2D55', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Pediatric Surgeon', color: '#30B0C7', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Surgical Oncologist', color: '#AF52DE', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Medical Geneticist', color: '#0A84FF', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Preventive Medicine', color: '#30C759', icon: 'stethoscope', imageFileName: 'general_physician.png' },
    { name: 'Reproductive Endocrinologist', color: '#FF3B30', icon: 'stethoscope', imageFileName: 'general_physician.png' }
  ];

  const seededCategories = [];
  let alreadySeededCount = 0;

  for (const cat of defaultCategories) {
    const existing = await Category.findOne({ name: cat.name });
    if (existing) {
      alreadySeededCount++;
      continue;
    }

    let imageUrl = '';
    
    // Attempt to locate and upload image from client assets
    try {
      const possiblePaths = [
        path.join(__dirname, '../../../DocPoint/src/assets/images', cat.imageFileName),
        path.join(__dirname, '../../../../DocPoint/src/assets/images', cat.imageFileName),
        `/Users/ravisherathiya/Documents/sherathiya/DocPoint/src/assets/images/${cat.imageFileName}`
      ];

      let imagePath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          imagePath = p;
          break;
        }
      }

      if (!imagePath) {
        // Fallback to general physician image
        const fallbackPaths = [
          path.join(__dirname, '../../../DocPoint/src/assets/images/general_physician.png'),
          path.join(__dirname, '../../../../DocPoint/src/assets/images/general_physician.png'),
          '/Users/ravisherathiya/Documents/sherathiya/DocPoint/src/assets/images/general_physician.png'
        ];
        for (const p of fallbackPaths) {
          if (fs.existsSync(p)) {
            imagePath = p;
            break;
          }
        }
      }

      if (imagePath) {
        const fileBuffer = fs.readFileSync(imagePath);
        const base64String = `data:image/png;base64,${fileBuffer.toString('base64')}`;
        imageUrl = await cloudinaryService.uploadBase64Image(base64String, 'docpoint/categories');
      } else {
        console.warn(`Local file not found for ${cat.name}`);
      }
    } catch (err) {
      console.error(`Error uploading default image for ${cat.name}:`, err);
    }

    const newCat = await Category.create({
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      image: imageUrl,
      status: 'active',
    });

    seededCategories.push(newCat);
  }

  if (seededCategories.length === 0 && alreadySeededCount > 0) {
    throw new AppError('Default categories have already been seeded', 400);
  }

  res.status(201).json({
    status: 'success',
    message: `${seededCategories.length} default categories seeded successfully!`,
    data: {
      categories: seededCategories,
    },
  });
});
