'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import FileUpload from '../components/FileUpload';
import PdfPreview from '../components/PdfPreview';
import { LoadingSpinner } from '../components/LoadingSpinner';

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    }
  }, [session, router]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError(null);
    
    // For PDF files, we'll need to get the page count
    if (file.type === 'application/pdf') {
      // This is a placeholder - in a real app, you'd want to use a PDF parsing library
      // to get the actual page count
      setPageCount(1);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Clear the form and show success message
      setSelectedFile(null);
      setPreviewUrl(null);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">File Upload & Preview</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      {uploading === true ? (
        <LoadingSpinner />
      ):(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload File</h2>
          <FileUpload
            onFileSelect={handleFileSelect}
            accept={{
              'application/pdf': ['.pdf'],
              'image/*': ['.png', '.jpg', '.jpeg']
            }}
            maxSize={10 * 1024 * 1024} // 10MB
          />
          
          {selectedFile && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium">Selected File:</h3>
                <p className="text-sm text-gray-600">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              
              <button
                onClick={handleUpload}
                disabled={uploading}
                className={`w-full py-2 px-4 rounded-md text-white font-medium
                  ${uploading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Preview</h2>
          {previewUrl ? (
            selectedFile?.type === 'application/pdf' ? (
              <PdfPreview url={previewUrl} pageCount={pageCount} />
            ) : (
              <div className="border rounded-lg p-4 bg-white shadow-lg">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full h-auto"
                />
              </div>
            )
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
              No file selected
            </div>
          )}
        </div>
      </div>
      )}
      
    </div>
  );
} 