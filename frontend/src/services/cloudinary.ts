// src/services/cloudinary.ts

/**
 * Upload an image to Cloudinary using unsigned upload
 * This works entirely in the browser without Node.js modules
 * @param file File object to upload
 * @param folder Folder to store the image in
 * @returns Cloudinary upload result URL
 */
export async function uploadImage(file: File, folder: string = 'products'): Promise<string> {
  console.log('📤 uploadImage called with folder:', folder);
  console.log('📤 File type:', file.type, 'size:', file.size, 'bytes');
  
  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'optisync_products');
    formData.append('folder', `optisync/${folder}`);
    
    console.log('📤 Sending to Cloudinary...');
    
    // Upload to Cloudinary using fetch
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cloudinary response not OK:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Cloudinary upload successful!');
    console.log('✅ Public ID:', data.public_id);
    console.log('✅ Secure URL:', data.secure_url);
    
    return data.secure_url;
  } catch (error) {
    console.error('❌ Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Upload multiple images to Cloudinary
 */
export async function uploadMultipleImages(files: File[], folder: string = 'products'): Promise<string[]> {
  const uploadPromises = files.map(file => uploadImage(file, folder));
  return Promise.all(uploadPromises);
}

/**
 * Delete an image from Cloudinary (requires server-side API)
 * For client-side, you'll need to call your own API endpoint
 * @param imageUrl Full URL of the image to delete
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extract public ID from URL
    const publicId = extractPublicIdFromUrl(imageUrl);
    if (!publicId) return;
    
    // Call your server-side API to delete
    const response = await fetch('/api/upload', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicId }),
    });
    
    if (!response.ok) {
      console.error('Failed to delete image:', await response.text());
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
}

/**
 * Extract Cloudinary public ID from URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find the part after '/upload/'
    const uploadIndex = pathParts.findIndex(part => part === 'upload');
    if (uploadIndex === -1 || uploadIndex === pathParts.length - 1) return null;
    
    // The next part after 'upload' is the version (e.g., v1234567890)
    // The remaining parts form the public ID
    const publicIdParts = pathParts.slice(uploadIndex + 2);
    const publicId = publicIdParts.join('/').split('.')[0]; // Remove file extension
    
    return publicId;
  } catch {
    return null;
  }
}