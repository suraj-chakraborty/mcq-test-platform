'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Truncate from './Truncate';
import { FileText, Trash2 } from 'lucide-react';
import { LoadingSpinner as Loading } from './LoadingSpinner';

interface Pdf {
  id: string;
  title: string;
  name?: string;
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

      setPdfs(pdfs.filter((pdf) => pdf.id !== id));
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
    return <Loading />;
  }

  if (pdfs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-xs font-semibold">
        No PDFs uploaded yet. Upload a PDF to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Your Uploaded Documents</h2>
      <div className="grid gap-3">
        {pdfs.map((pdf) => (
          <div
            key={pdf.id}
            className="flex items-center justify-between p-3.5 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-gray-900 dark:text-white">
                  {Truncate(pdf.name || (pdf as any).title, 35)}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Uploaded on {pdf.createdAt ? new Date(pdf.createdAt).toLocaleDateString() : 'Recent'}
                </p>
              </div>
            </div>
            <button
              onClick={() => deletePdf(pdf.id)}
              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Delete PDF"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}