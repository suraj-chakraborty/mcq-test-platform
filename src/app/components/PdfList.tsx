import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Truncate from './Truncate';

interface Pdf {
  _id: string;
  title: string;
  createdAt: string;
  isReference: boolean;
}

export default function PdfList() {
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPdfs = async () => {
    try {
      const response = await fetch('/api/pdfs');
      if (!response.ok) throw new Error('Failed to fetch PDFs');
      const data = await response.json();
      setPdfs(data.pdfs);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      toast.error('Failed to fetch PDFs');
    } finally {
      setIsLoading(false);
    }
  };

  const deletePdf = async (id: string) => {
    try {
      const response = await fetch(`/api/pdfs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete PDF');

      setPdfs(pdfs.filter(pdf => pdf._id !== id));
      toast.success('PDF deleted successfully');
    } catch (error) {
      console.error('Error deleting PDF:', error);
      toast.error('Failed to delete PDF');
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No PDFs uploaded yet. Upload a PDF to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">Your PDFs</h2>
      <div className="grid gap-4">
        {pdfs.map((pdf) => (
          <div
            key={pdf._id}
            className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center space-x-4">
              <div className="text-2xl text-gray-400">📄</div>
              <div>
                <h3 className="font-medium text-gray-900">{Truncate(pdf.title, 30)}</h3>
                <p className="text-sm text-gray-500">
                  Uploaded on {new Date(pdf.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => deletePdf(pdf._id)}
              className="text-red-500 hover:text-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 