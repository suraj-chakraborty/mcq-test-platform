export function LoadingSpinner({ message = 'Preparing your experience...' }: { message?: string } = {}) {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-neutral-950 text-gray-900 dark:text-white transition-colors duration-300">
      <div className="relative mb-8">
        <div className="h-20 w-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center p-3 shadow-2xl shadow-indigo-500/20 animate-pulse">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-[1.5rem] animate-spin scale-125 opacity-20" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
          MCQ<span className="text-indigo-600 dark:text-indigo-400">Test</span>
        </h2>
        <p className="text-gray-400 dark:text-gray-500 font-bold text-xs uppercase tracking-widest animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
}