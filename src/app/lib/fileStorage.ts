export const runtime = 'nodejs';

import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary } from './cloudinary';

export async function saveFile(file: File): Promise<string> {
  try {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueFilename = `${uuidv4()}-${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cloudinaryUrl = await uploadToCloudinary(buffer, uniqueFilename);

    return cloudinaryUrl;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload file');
  }
}
