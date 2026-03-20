export function LoadingSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="relative mb-8">
        <div className="h-20 w-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center p-3 shadow-2xl shadow-indigo-100 animate-pulse">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-[1.5rem] animate-spin scale-125 opacity-20" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">MCQ<span className="text-indigo-600">Test</span></h2>
        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest animate-pulse">Preparing your experience...</p>
      </div>
    </div>
  );
}