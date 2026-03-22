// src/config/cloudinary.ts
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
};

export const isCloudinaryConfigured = (): boolean => {
  return Boolean(
    cloudinaryConfig.cloudName && 
    cloudinaryConfig.apiKey && 
    cloudinaryConfig.apiSecret
  );
};