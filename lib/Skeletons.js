import { Skeleton, Card } from "@heroui/react";

export function TableSkeleton({ rows = 8, columns = 7 }) {
  return (
    <div className="w-full w-full flex flex-col items-center gap-3">

      <div className="w-full grid grid-cols-4 gap-4 px-5">
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
      </div>
      <div className="w-full grid grid-cols-4 gap-4 px-5">
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
      </div>
      <div className="w-full grid grid-cols-4 gap-4 px-5">
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
      </div>
      <div className="w-full grid grid-cols-4 gap-4 px-5">
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
        <Skeleton className="h-6 rounded-lg" />
      </div>
    </div>
  );
}

