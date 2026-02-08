import * as React from 'react';

export interface SongHeaderProps {
  titleLine: string;
}

export function SongHeader({ titleLine }: SongHeaderProps) {
  return (
    <header className="flex-shrink-0 sticky top-0 z-10 px-8 pt-3 pb-2 border-b border-gray-200 bg-white">
      <h1 className="text-2xl font-semibold text-center">{titleLine}</h1>
    </header>
  );
}
