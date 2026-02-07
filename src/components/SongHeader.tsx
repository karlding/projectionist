import * as React from 'react';

export interface SongHeaderProps {
  title: string[];
  sourceSequenceNbr: number;
  /** Shown when no title (e.g. before load). */
  fallbackTitle?: string;
}

export function SongHeader({
  title,
  sourceSequenceNbr,
  fallbackTitle = 'Projectionist',
}: SongHeaderProps) {
  const heading =
    title.length > 0 ? `${sourceSequenceNbr}: ${title.join(' / ')}` : fallbackTitle;
  return (
    <header className="flex-shrink-0 sticky top-0 z-10 px-8 pt-6 pb-4 border-b border-gray-200 bg-white">
      <h1 className="text-2xl font-semibold text-center">{heading}</h1>
    </header>
  );
}
