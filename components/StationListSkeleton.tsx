import React from 'react';

const SkeletonCard: React.FC = () => (
  <div className="bg-bg-secondary rounded-lg p-4 flex flex-col items-center justify-center">
    <div className="w-24 h-24 rounded-md bg-gray-700 animate-pulse mb-3"></div>
    <div className="h-4 w-20 bg-gray-700 animate-pulse rounded"></div>
  </div>
);

const StationListSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
};

export default StationListSkeleton;
