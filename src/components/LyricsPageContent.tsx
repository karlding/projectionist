import * as React from 'react';
import {
  getLineDecoration,
  LYRICS_FONT_SIZES,
  type LineDecoration,
} from '../displayPages';

export interface LyricsPageContentProps {
  lines: string[];
  currentPage: number;
  totalPages: number;
  stanzaIndexByPage: number[];
  isChorus: boolean[];
  languageCount: number;
  lyricsFontSizeIndex: number;
}

function LineWithDecorations({
  content,
  decoration,
}: {
  content: string;
  decoration: LineDecoration;
}) {
  return (
    <React.Fragment>
      <p className="whitespace-pre-wrap py-0.5">{content}</p>
      {decoration.showYellowLine ? (
        <hr className="border-0 border-t-2 border-yellow-500 my-3 w-full" />
      ) : decoration.showVerseEndLine ? (
        <hr className="border-0 border-t-2 border-gray-300 my-3 w-full" />
      ) : decoration.showLanguageDivider ? (
        <hr className="border-0 border-t border-gray-200 my-3 w-full" />
      ) : null}
      {decoration.showEndOfSong ? (
        <hr className="border-0 border-t-2 border-red-500 my-3 w-full" />
      ) : null}
    </React.Fragment>
  );
}

export function LyricsPageContent({
  lines,
  currentPage,
  totalPages,
  stanzaIndexByPage,
  isChorus,
  languageCount,
  lyricsFontSizeIndex,
}: LyricsPageContentProps) {
  const pageLineCount = lines.length;
  const fontClass = LYRICS_FONT_SIZES[lyricsFontSizeIndex] ?? 'text-base';

  return (
    <div className={`text-gray-700 ${fontClass}`}>
      {lines.map((content, i) => {
        const decoration = getLineDecoration(
          currentPage,
          totalPages,
          stanzaIndexByPage,
          isChorus,
          languageCount,
          i,
          pageLineCount
        );
        return (
          <LineWithDecorations key={i} content={content} decoration={decoration} />
        );
      })}
    </div>
  );
}
