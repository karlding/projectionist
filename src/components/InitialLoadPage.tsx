import * as React from 'react';

export interface InitialLoadPageProps {
  loading?: boolean;
  error?: string | null;
}

export function InitialLoadPage({
  loading = false,
  error = null,
}: InitialLoadPageProps) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-white px-8">
      <h1 className="text-2xl font-semibold text-center text-gray-800">
        Projectionist
      </h1>
      {loading && <p className="mt-4 text-gray-500">Loading…</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}
