/** Max sentences per language per page (4 per language → 8 rows for 2 languages). */
export const SENTENCES_PER_LANGUAGE = 4;
/** Single-language songs can fit more lines (no alternating language rows). */
export const LINES_PER_PAGE_SINGLE_LANGUAGE = 8;

/** Lyrics font size steps: '=' increases, '-' decreases. */
export const LYRICS_FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
export const DEFAULT_LYRICS_FONT_SIZE_INDEX = 0;

export function clampPage(page: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(page, total - 1));
}

/**
 * Chunk stanzas into display pages: at most 4 sentences per language (8 rows for 2 langs),
 * or 8 lines for single language. Each page contains lines from a single stanza only (no mixing verses).
 */
export function buildDisplayPages(
  stanzas: string[][],
  languageCount: number
): { pages: string[][]; stanzaIndexByPage: number[] } {
  const linesPerPage =
    languageCount <= 1 ? LINES_PER_PAGE_SINGLE_LANGUAGE : SENTENCES_PER_LANGUAGE * languageCount;
  const pages: string[][] = [];
  const stanzaIndexByPage: number[] = [];
  for (let s = 0; s < stanzas.length; s++) {
    const stanza = stanzas[s];
    for (let i = 0; i < stanza.length; i += linesPerPage) {
      pages.push(stanza.slice(i, i + linesPerPage));
      stanzaIndexByPage.push(s);
    }
  }
  if (pages.length === 0) {
    pages.push([]);
    stanzaIndexByPage.push(0);
  }
  return { pages, stanzaIndexByPage };
}

export interface LineDecoration {
  showYellowLine: boolean;
  showVerseEndLine: boolean;
  showLanguageDivider: boolean;
  showEndOfSong: boolean;
}

/**
 * Pure function: given page and line index, returns which dividers to show after that line.
 * Makes the display rules testable without rendering.
 */
export function getLineDecoration(
  currentPage: number,
  totalPages: number,
  stanzaIndexByPage: number[],
  isChorus: boolean[],
  languageCount: number,
  lineIndex: number,
  pageLineCount: number
): LineDecoration {
  const stanzaIdx = stanzaIndexByPage[currentPage] ?? 0;
  const nextStanzaIsChorus = stanzaIdx + 1 < isChorus.length && isChorus[stanzaIdx + 1];
  const isVerse = !isChorus[stanzaIdx];
  const isLastLine = lineIndex === pageLineCount - 1;
  const isLastPageOfStanza =
    currentPage >= totalPages - 1 || stanzaIndexByPage[currentPage + 1] !== stanzaIdx;
  const showYellowLine = isVerse && nextStanzaIsChorus && isLastLine && isLastPageOfStanza;
  const isEndOfSong = currentPage === totalPages - 1 && isLastLine;
  const showVerseEndLine =
    isVerse && isLastLine && isLastPageOfStanza && !isEndOfSong && !showYellowLine;
  const showLanguageDivider =
    (lineIndex + 1) % languageCount === 0 && !isLastLine;

  return {
    showYellowLine,
    showVerseEndLine,
    showLanguageDivider,
    showEndOfSong: isEndOfSong,
  };
}

/** Compute total verse count (non-chorus stanzas). */
export function totalVersesFromChorus(isChorus: boolean[]): number {
  const n = isChorus.filter((c) => !c).length;
  return n || 1;
}

/** Stanza index for the N-th verse (1-based). Verse = non-chorus stanza. Returns -1 if out of range. */
export function stanzaIndexForVerse(verseNum: number, isChorus: boolean[]): number {
  if (verseNum < 1) return -1;
  let count = 0;
  for (let s = 0; s < isChorus.length; s++) {
    if (!isChorus[s]) {
      count++;
      if (count === verseNum) return s;
    }
  }
  return -1;
}

/** Compute current verse number for a given page. */
export function currentVerseForPage(
  currentPage: number,
  stanzaIndexByPage: number[],
  isChorus: boolean[]
): number {
  if (stanzaIndexByPage.length === 0 || currentPage >= stanzaIndexByPage.length) return 1;
  return isChorus
    .slice(0, stanzaIndexByPage[currentPage] + 1)
    .filter((c) => !c).length;
}
