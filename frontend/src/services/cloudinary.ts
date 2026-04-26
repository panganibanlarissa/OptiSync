import { cloudinaryConfig } from '@/config/cloudinary';

export async function uploadImage(file: File, folder: string = 'products'): Promise<string> {
  const CLOUD_NAME = cloudinaryConfig.cloudName;
  const UPLOAD_PRESET = cloudinaryConfig.uploadPreset;
  
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error('Cloudinary config missing:', { CLOUD_NAME, UPLOAD_PRESET });
    throw new Error('Cloudinary configuration missing. Check your environment variables.');
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', `optisync/${folder}`);
    
    console.log('Uploading to Cloudinary...', { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET });
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary error response:', errorData);
      throw new Error(errorData.error?.message || `Upload failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Upload successful:', data.secure_url);
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}