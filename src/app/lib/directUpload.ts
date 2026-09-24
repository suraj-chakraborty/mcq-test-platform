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

  // 2. Cloudinary free tier enforces a strict 10MB (10485760 bytes) limit on raw uploads.
  // For PDFs > 10MB, if client-side extraction yields high-quality text, bypass Cloudinary raw storage
  // and pass the extracted text directly to our AI generation pipeline!
  const CLOUDINARY_RAW_MAX_BYTES = 10485760;

  if (file.size > CLOUDINARY_RAW_MAX_BYTES) {
    onProgress?.(30);
    const { text, pageCount } = await clientTextPromise;
    onProgress?.(80);

    if (text && text.trim().length >= 50) {
      onProgress?.(100);
      return {
        name: file.name,
        url: `client-text://${encodeURIComponent(file.name)}`,
        publicId: undefined,
        fileSize: file.size,
        text,
        pageCount: pageCount || 1,
      };
    }

    // Scanned image-only document > 10MB cannot be extracted client-side without OCR
    throw new Error(
      `This scanned document is ${(file.size / (1024 * 1024)).toFixed(1)} MB without an embedded text layer. Cloud storage accepts scanned PDFs up to 10 MB. Please upload a searchable text PDF or a document under 10 MB.`
    );
  }

  // 3. Fetch authenticated signed credentials from our server API for files <= 10MB
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folder: 'pdfs', fileSize: file.size }),
  });

  if (!signRes.ok) {
    const errorData = await signRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to initialize secure upload signature');
  }

  const { signature, timestamp, apiKey, cloudName, folder, max_file_size } = await signRes.json();

  if (max_file_size && file.size > max_file_size) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of ${max_file_size / (1024 * 1024)} MB.`);
  }

  // 4. Prepare FormData for direct Cloudinary REST endpoint
  const uploadFormData = new FormData();
  uploadFormData.append('file', file);
  uploadFormData.append('api_key', apiKey);
  uploadFormData.append('timestamp', timestamp.toString());
  uploadFormData.append('signature', signature);
  uploadFormData.append('folder', folder);

  // 5. Upload directly using XMLHttpRequest to support live upload progress
  const uploadResult: { url: string; publicId?: string } = await new Promise((resolve, reject) => {
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

    xhr.onload = async () => {
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
          const errMsg = errRes.error?.message || '';

          // If Cloudinary rejects due to file size, check if client already extracted text!
          if (errMsg.includes('File size too large')) {
            const { text } = await clientTextPromise;
            if (text && text.trim().length >= 50) {
              resolve({
                url: `client-text://${encodeURIComponent(file.name)}`,
                publicId: undefined,
              });
              return;
            }
          }

          reject(new Error(errMsg || `Upload failed with status ${xhr.status}`));
        } catch (e: any) {
          if (e?.message) {
            reject(e);
          } else {
            reject(new Error(`Direct Cloudinary upload failed (HTTP ${xhr.status})`));
          }
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
