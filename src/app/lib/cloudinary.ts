import { v2 as cloudinary } from 'cloudinary';

let isConfigured = false;

function configureCloudinary() {
  if (!isConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
      secure: true,
    });
    isConfigured = true;
  }
}

export async function uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  configureCloudinary(); // <-- ensures envs are loaded at runtime

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: 'raw', // for PDFs or other non-image files
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
