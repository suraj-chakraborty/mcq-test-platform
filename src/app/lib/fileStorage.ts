// import { writeFile, mkdir } from 'fs/promises';
// import path from 'path';

// const UPLOAD_DIR = path.join( '/tmp', 'uploads');

// export async function saveFile(file: File): Promise<string> {
//   try {
//     // Ensure upload directory exists
//     await mkdir(UPLOAD_DIR, { recursive: true });

//     // Create a unique filename
//     const timestamp = Date.now();
//     const originalName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
//     const filename = `${timestamp}-${originalName}`;
//     const filepath = path.join(UPLOAD_DIR, filename);

//     // Convert File to Buffer
//     const arrayBuffer = await file.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);

//     // Save the file
//     await writeFile(filepath, buffer);

//     // Return the relative path
//     return `/uploads/${filename}`;
//   } catch (error) {
//     console.error('Error saving file:', error);
//     throw new Error('Failed to save file');
//   }
// } 

export const runtime = 'nodejs';

import { uploadToCloudinary } from './cloudinary';

export async function saveFile(file: File): Promise<string> {
  try {
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filename = `${timestamp}-${originalName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary instead of local filesystem
    const cloudinaryUrl = await uploadToCloudinary(buffer, originalName);

    return cloudinaryUrl;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload file');
  }
}
