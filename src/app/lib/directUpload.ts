import { extractTextFromPdfClient } from './clientPdfUtils';

export interface UploadedPdfMetadata {
  name: string;
  url: string;
  publicId?: string;
  fileSize: number;
  text?: string;
  pageCount?: number;
}

/**
 * Uploads a PDF file directly from the browser to Cloudinary
 * to completely bypass Netlify's 4.5MB serverless payload limit,
 * while extracting text in the browser to prevent 401 download restrictions.
 */
export async function uploadPdfDirectToCloudinary(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedPdfMetadata> {
  // 1. In parallel, start client-side text extraction (super fast in browser)
  const clientTextPromise = extractTextFromPdfClient(file).catch(() => ({ text: '', pageCount: 1 }));

  // 2. Fetch authenticated signed credentials from our server API
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!signRes.ok) {
    const errorData = await signRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to initialize secure upload signature');
  }

  const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

  // 3. Prepare FormData for direct Cloudinary REST endpoint
  const uploadFormData = new FormData();
  uploadFormData.append('file', file);
  uploadFormData.append('api_key', apiKey);
  uploadFormData.append('timestamp', timestamp.toString());
  uploadFormData.append('signature', signature);
  uploadFormData.append('folder', folder);

  // 4. Upload directly using XMLHttpRequest to support live upload progress
  const uploadResult: { url: string; publicId: string } = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({
            url: res.secure_url,
            publicId: res.public_id,
          });
        } catch (e) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Direct Cloudinary upload failed (HTTP ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during direct Cloudinary upload'));
    };

    xhr.send(uploadFormData);
  });

  // Await the client-extracted text
  const { text, pageCount } = await clientTextPromise;

  return {
    name: file.name,
    url: uploadResult.url,
    publicId: uploadResult.publicId,
    fileSize: file.size,
    text,
    pageCount,
  };
}

/**
 * Uploads an image (avatar/profile picture) directly from browser to Cloudinary
 */
export async function uploadImageDirectToCloudinary(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; publicId: string }> {
  // 1. Fetch signed upload params for 'avatars' folder
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: 'avatars' }),
  });

  if (!signRes.ok) {
    const errorData = await signRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to initialize secure image upload signature');
  }

  const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

  const uploadFormData = new FormData();
  uploadFormData.append('file', file);
  uploadFormData.append('api_key', apiKey);
  uploadFormData.append('timestamp', timestamp.toString());
  uploadFormData.append('signature', signature);
  uploadFormData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({
            url: res.secure_url,
            publicId: res.public_id,
          });
        } catch {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error?.message || `Image upload failed (HTTP ${xhr.status})`));
        } catch {
          reject(new Error(`Image upload failed (HTTP ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during avatar upload'));
    };

    xhr.send(uploadFormData);
  });
}
