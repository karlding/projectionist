import * as React from 'react';

export interface VerseIndicatorProps {
  sourceSequenceNbr: number;
  currentVerse: number;
  totalVerses: number;
  /** Show "C" when the song has a chorus (shown on all pages). */
  hasChorus?: boolean;
  /** Current page is a chorus; when true, bold the "C". */
  isChorus?: boolean;
}

export function VerseIndicator({
  sourceSequenceNbr,
  currentVerse,
  totalVerses,
  hasChorus,
  isChorus: isCurrentPageChorus,
}: VerseIndicatorProps) {
  return (
    <aside className="flex-shrink-0 w-14 border-r border-gray-200 bg-white z-10 px-1 pt-0.5">
      <span className="text-gray-500 text-sm tabular-nums text-center block">
        {sourceSequenceNbr}
      </span>
      <span className="text-gray-500 text-sm tabular-nums text-center block">
        <strong>{currentVerse}</strong> / {totalVerses}
      </span>
      {hasChorus && (
        <span
          className={`text-gray-400 text-xs text-center block mt-0.5 ${
            isCurrentPageChorus ? 'font-bold' : 'font-medium'
          }`}
        >
          C
        </span>
      )}
    </aside>
  );
}
