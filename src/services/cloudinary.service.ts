import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: env.CLOUDINARY_API_KEY?.trim(),
  api_secret: env.CLOUDINARY_API_SECRET?.trim(),
});

console.log('🔌 Cloudinary Config:', {
  cloud_name: cloudinary.config().cloud_name,
  api_key: cloudinary.config().api_key,
  api_secret: cloudinary.config().api_secret ? '***PRESENT***' : '***MISSING***',
});

export const uploadBase64Image = async (base64Data: string, folder: string): Promise<string> => {
  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Data, {
      folder: folder || 'docpoint',
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Image upload failed');
  }
};
