import * as React from 'react';

export interface VerseIndicatorProps {
  currentVerse: number;
  totalVerses: number;
}

export function VerseIndicator({ currentVerse, totalVerses }: VerseIndicatorProps) {
  return (
    <aside className="flex-shrink-0 w-14 border-r border-gray-200 bg-white z-10 px-1 pt-0.5">
      <span className="text-gray-500 text-sm tabular-nums text-center block">
        {currentVerse} / {totalVerses}
      </span>
    </aside>
  );
}
