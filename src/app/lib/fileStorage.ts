export const runtime = 'nodejs';

import { uploadToCloudinary } from './cloudinary';

export async function saveFile(file: File): Promise<string> {
  try {
    const originalName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cloudinaryUrl = await uploadToCloudinary(buffer, originalName);

    return cloudinaryUrl;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload file');
  }
}
