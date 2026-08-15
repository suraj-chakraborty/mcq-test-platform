export interface UploadedPdfMetadata {
  name: string;
  url: string;
  fileSize: number;
}

/**
 * Uploads a PDF file directly from the browser to Cloudinary
 * to completely bypass Netlify's 4.5MB serverless payload limit.
 */
export async function uploadPdfDirectToCloudinary(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedPdfMetadata> {
  // 1. Fetch authenticated signed credentials from our server API
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

  // 2. Prepare FormData for direct Cloudinary REST endpoint
  const uploadFormData = new FormData();
  uploadFormData.append('file', file);
  uploadFormData.append('api_key', apiKey);
  uploadFormData.append('timestamp', timestamp.toString());
  uploadFormData.append('signature', signature);
  uploadFormData.append('folder', folder);

  // 3. Upload directly using XMLHttpRequest to support live upload progress
  return new Promise((resolve, reject) => {
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
            name: file.name,
            url: res.secure_url,
            fileSize: file.size,
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
}
