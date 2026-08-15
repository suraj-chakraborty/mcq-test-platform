import { v2 as cloudinary } from 'cloudinary';

let isConfigured = false;

export function configureCloudinary() {
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
  configureCloudinary();

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: 'raw',
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

/**
 * Downloads a PDF buffer from Cloudinary with full signature authentication fallback
 * to resolve Cloudinary "401 Unauthorized" when PDF delivery restrictions are enabled.
 */
export async function downloadCloudinaryPdf(url: string, publicId?: string): Promise<Buffer> {
  configureCloudinary();

  // 1. Try public fetch directly
  try {
    const res = await fetch(url);
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
    console.warn(`Direct Cloudinary fetch returned ${res.status}, attempting authenticated/signed access...`);
  } catch (e) {
    console.warn('Direct fetch failed, trying signed URLs:', e);
  }

  // Derive publicId from URL if not explicitly passed
  let targetPublicId = publicId;
  if (!targetPublicId && url.includes('/upload/')) {
    const parts = url.split('/upload/');
    if (parts[1]) {
      targetPublicId = parts[1].replace(/^v\d+\//, '').replace(/\.pdf$/i, '');
    }
  }

  // 2. Try signed private download URL using Cloudinary SDK
  if (targetPublicId) {
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const signedUrl = cloudinary.utils.private_download_url(targetPublicId, '', {
        resource_type: 'raw',
        type: 'upload',
        expires_at: expiresAt,
      });

      const res = await fetch(signedUrl);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      console.warn(`Signed private download returned ${res.status}`);
    } catch (e) {
      console.warn('Private download URL error:', e);
    }

    // 3. Try cloudinary.url with sign_url
    try {
      const signedUrl2 = cloudinary.url(targetPublicId, {
        resource_type: 'raw',
        sign_url: true,
        secure: true,
        type: 'upload',
      });
      const res = await fetch(signedUrl2);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      console.warn(`Signed URL v2 returned ${res.status}`);
    } catch (e) {
      console.warn('Signed URL v2 error:', e);
    }
  }

  // 4. Try Basic Auth header using API key & secret
  if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const basicAuth = Buffer.from(
        `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
      ).toString('base64');

      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch (e) {
      console.warn('Basic auth fetch error:', e);
    }
  }

  throw new Error('Failed to download PDF from Cloudinary (401 Unauthorized)');
}
