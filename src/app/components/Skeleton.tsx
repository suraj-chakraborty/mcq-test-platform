export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-800 ${className}`}
      {...props}
    />
  );
}

export function TestCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex justify-between items-start">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PYQCardSkeleton() {
  return (
    <div className="flex flex-col justify-between h-full bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-28 rounded-md" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-5 w-4/5 rounded" />
        <Skeleton className="h-4 w-3/5 rounded" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-3.5 w-12 rounded" />
          <Skeleton className="h-3.5 w-20 rounded" />
        </div>
        <Skeleton className="h-3.5 w-full rounded" />
      </div>
      <div className="pt-2">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function FlashcardSkeleton() {
  return (
    <div className="max-w-xl mx-auto py-10 text-center space-y-6">
      <Skeleton className="h-20 w-20 rounded-xl mx-auto" />
      <Skeleton className="h-7 w-72 mx-auto rounded" />
      <Skeleton className="h-4 w-60 mx-auto rounded" />
      <Skeleton className="h-11 w-48 mx-auto rounded-lg" />
      <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 flex items-start gap-3 text-left">
        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3.5 w-full rounded" />
        </div>
      </div>
    </div>
  );
}

export function PdfListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
