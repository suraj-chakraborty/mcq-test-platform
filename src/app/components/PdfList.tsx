'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Truncate from './Truncate';
import { FileText, Trash2, Loader2, ChevronDown } from 'lucide-react';
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchPdfs = async (pageNum = 1, isAppend = false) => {
    try {
      if (isAppend) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch(`/api/pdfs?page=${pageNum}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch PDFs');
      const data = await response.json();

      if (isAppend) {
        setPdfs((prev) => [...prev, ...(data.pdfs || [])]);
      } else {
        setPdfs(data.pdfs || []);
      }

      setPage(pageNum);
      setHasMore(Boolean(data.pagination?.hasMore));
      setTotal(data.pagination?.total || data.pdfs?.length || 0);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      toast.error('Failed to fetch PDFs');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchPdfs(page + 1, true);
    }
  };

  const deletePdf = async (id: string) => {
    try {
      const response = await fetch(`/api/pdfs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete PDF');

      setPdfs((prev) => prev.filter((pdf) => pdf.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success('PDF deleted successfully');
    } catch (error) {
      console.error('Error deleting PDF:', error);
      toast.error('Failed to delete PDF');
    }
  };

  useEffect(() => {
    fetchPdfs(1, false);
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
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Your Uploaded Documents</h2>
        {total > 0 && (
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full">
            Showing {pdfs.length} of {total}
          </span>
        )}
      </div>

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
              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Delete PDF"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {total - pdfs.length} more document{total - pdfs.length === 1 ? '' : 's'} available
          </p>
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-50 dark:bg-neutral-800 hover:bg-indigo-100 dark:hover:bg-neutral-700 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-indigo-200/60 dark:border-neutral-700 cursor-pointer disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading 10 more...</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Load 10 More Documents</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}