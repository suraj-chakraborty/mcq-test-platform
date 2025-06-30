import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export async function uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: 'raw', // important for non-image files like PDFs
          public_id: `pdfs/${filename}`,
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary upload failed'));
          resolve(result.secure_url);
        }
      )
      .end(buffer);
  });
}
