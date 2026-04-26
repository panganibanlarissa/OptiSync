// src/config/cloudinary.ts
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dn95k6pnt',
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'optisync_products',
};

export const isCloudinaryConfigured = (): boolean => {
  return Boolean(cloudinaryConfig.cloudName && cloudinaryConfig.uploadPreset);
};