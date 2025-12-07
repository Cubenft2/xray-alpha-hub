import React from 'react';

export function PageSkeleton() {
  return (
    <div className="min-h-[60vh] animate-pulse p-4 sm:p-8">
      <div className="h-8 bg-muted rounded w-1/3 mb-4" />
      <div className="h-4 bg-muted rounded w-2/3 mb-2" />
      <div className="h-4 bg-muted rounded w-1/2 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-32 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
    </div>
  );
}
