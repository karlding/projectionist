/** Max sentences per language per page (4 per language → 8 rows for 2 languages). */
export const SENTENCES_PER_LANGUAGE = 4;
/** Single-language songs can fit more lines (no alternating language rows). */
export const LINES_PER_PAGE_SINGLE_LANGUAGE = 8;

/** Lyrics font size steps: '=' increases, '-' decreases. */
export const LYRICS_FONT_SIZES = [
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
];
export const DEFAULT_LYRICS_FONT_SIZE_INDEX = 0;

export function clampPage(page: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(page, total - 1));
}

/**
 * Chunk stanzas into display pages: at most 4 sentences per language (8 rows for 2 langs),
 * or 8 lines for single language. Each page contains lines from a single stanza only (no mixing verses),
 * except that a chorus may be appended to the current page (as many lines as fit), with the rest on following pages.
 */
export function buildDisplayPages(
  stanzas: string[][],
  languageCount: number,
  isChorus?: boolean[],
): {
  pages: string[][];
  stanzaIndexByPage: number[];
  firstStanzaIndexByPage: number[];
  chorusStartLineIndexByPage: number[];
} {
  const linesPerPage =
    languageCount <= 1
      ? LINES_PER_PAGE_SINGLE_LANGUAGE
      : SENTENCES_PER_LANGUAGE * languageCount;
  const pages: string[][] = [];
  const stanzaIndexByPage: number[] = [];
  const firstStanzaIndexByPage: number[] = [];
  const chorusStartLineIndexByPage: number[] = [];
  for (let s = 0; s < stanzas.length; s++) {
    const stanza = stanzas[s];
    const isChorusStanza = isChorus?.[s];
    const lastPage = pages.length > 0 ? pages[pages.length - 1] : null;
    const freeOnLastPage = lastPage ? linesPerPage - lastPage.length : 0;

    if (isChorusStanza && lastPage && freeOnLastPage > 0) {
      // Append as many chorus lines as fit on the current page, then add pages for the rest
      const verseLineCount = lastPage.length;
      const take = Math.min(stanza.length, freeOnLastPage);
      chorusStartLineIndexByPage[chorusStartLineIndexByPage.length - 1] =
        verseLineCount;
      lastPage.push(...stanza.slice(0, take));
      stanzaIndexByPage[stanzaIndexByPage.length - 1] = s;
      const remainder = stanza.slice(take);
      for (let i = 0; i < remainder.length; i += linesPerPage) {
        pages.push(remainder.slice(i, i + linesPerPage));
        stanzaIndexByPage.push(s);
        firstStanzaIndexByPage.push(s);
        chorusStartLineIndexByPage.push(-1);
      }
      continue;
    }

    for (let i = 0; i < stanza.length; i += linesPerPage) {
      pages.push(stanza.slice(i, i + linesPerPage));
      stanzaIndexByPage.push(s);
      firstStanzaIndexByPage.push(s);
      chorusStartLineIndexByPage.push(-1);
    }
  }
  if (pages.length === 0) {
    pages.push([]);
    stanzaIndexByPage.push(0);
    firstStanzaIndexByPage.push(0);
    chorusStartLineIndexByPage.push(-1);
  }
  return {
    pages,
    stanzaIndexByPage,
    firstStanzaIndexByPage,
    chorusStartLineIndexByPage,
  };
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
 * When chorusStartLineIndex >= 0, the page has verse then chorus merged; show yellow line after that verse.
 * When the next page has a merged verse+chorus (nextPageChorusStartIndex >= 0), do not show yellow at end
 * of current verse page—the yellow will show on the next page at the boundary.
 */
export function getLineDecoration(
  currentPage: number,
  totalPages: number,
  stanzaIndexByPage: number[],
  isChorus: boolean[],
  languageCount: number,
  lineIndex: number,
  pageLineCount: number,
  chorusStartLineIndex: number = -1,
  suppressEndOfSong: boolean = false,
  nextPageChorusStartIndex: number = -1,
): LineDecoration {
  const stanzaIdx = stanzaIndexByPage[currentPage] ?? 0;
  const nextStanzaIsChorus =
    stanzaIdx + 1 < isChorus.length && isChorus[stanzaIdx + 1];
  const isVerse = !isChorus[stanzaIdx];
  const isLastLine = lineIndex === pageLineCount - 1;
  const isLastPageOfStanza =
    currentPage >= totalPages - 1 ||
    stanzaIndexByPage[currentPage + 1] !== stanzaIdx;
  const isMergedVerseChorusBoundary =
    chorusStartLineIndex >= 0 && lineIndex === chorusStartLineIndex - 1;
  const chorusStartsOnNextPage = nextPageChorusStartIndex >= 0;
  const showYellowLine =
    isMergedVerseChorusBoundary ||
    (isVerse &&
      nextStanzaIsChorus &&
      isLastLine &&
      isLastPageOfStanza &&
      !chorusStartsOnNextPage);
  const isEndOfSong =
    !suppressEndOfSong && currentPage === totalPages - 1 && isLastLine;
  const showVerseEndLine =
    isVerse &&
    isLastLine &&
    isLastPageOfStanza &&
    !isEndOfSong &&
    !showYellowLine;
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
export function stanzaIndexForVerse(
  verseNum: number,
  isChorus: boolean[],
): number {
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

/** Stanza index of the chorus that follows the given verse (1-based). Returns -1 if none. */
export function chorusStanzaIndexAfterVerse(
  verseNum: number,
  isChorus: boolean[],
): number {
  const verseStanzaIdx = stanzaIndexForVerse(verseNum, isChorus);
  if (verseStanzaIdx < 0) return -1;
  for (let s = verseStanzaIdx + 1; s < isChorus.length; s++) {
    if (isChorus[s]) return s;
  }
  return -1;
}

/**
 * Stanza index of the N-th chorus in the song (1-based). Used for "show chorus for verse N":
 * verse 1 → 1st chorus, verse 2 → 2nd chorus. If there are fewer choruses than N, returns the last chorus.
 * Returns -1 if there are no choruses.
 */
export function nthChorusStanzaIndex(
  verseNum: number,
  isChorus: boolean[],
): number {
  if (verseNum < 1) return -1;
  const indices: number[] = [];
  for (let s = 0; s < isChorus.length; s++) {
    if (isChorus[s]) indices.push(s);
  }
  if (indices.length === 0) return -1;
  const n = Math.min(verseNum, indices.length);
  return indices[n - 1];
}

/** Compute current verse number for a given page. */
export function currentVerseForPage(
  currentPage: number,
  stanzaIndexByPage: number[],
  isChorus: boolean[],
): number {
  if (stanzaIndexByPage.length === 0 || currentPage >= stanzaIndexByPage.length)
    return 1;
  return isChorus.slice(0, stanzaIndexByPage[currentPage] + 1).filter((c) => !c)
    .length;
}

/**
 * Whether pressing "0" should enter chorus-only view for the current verse.
 * True when not already in chorus-only, current verse has a chorus, and we have page data.
 * Works whether the user is currently on a verse page or a chorus page.
 */
export function shouldEnterChorusOnlyOnZero(
  chorusOnlyForVerse: number | null,
  currentVerse: number,
  firstStanzaIndexByPage: number[],
  isChorus: boolean[],
): boolean {
  return (
    chorusOnlyForVerse == null &&
    currentVerse >= 1 &&
    firstStanzaIndexByPage.length > 0 &&
    nthChorusStanzaIndex(currentVerse, isChorus) >= 0
  );
}

/** Input for getEffectiveLyricsView (pure function for testability). */
export interface EffectiveLyricsViewInput {
  chorusOnlyForVerse: number | null;
  /** When in chorus-only view with multiple pages, which page of the chorus is shown (0-based). */
  chorusOnlyPage?: number;
  currentPage: number;
  currentVerse: number;
  displayPages: string[][];
  stanzaIndexByPage: number[];
  chorusStartLineIndexByPage: number[];
  stanzas: string[][];
  isChorus: boolean[];
  languageCount: number;
}

/** Result of getEffectiveLyricsView: what to show in the lyrics area and verse indicator. */
export interface EffectiveLyricsView {
  lines: string[];
  effectiveCurrentPage: number;
  effectiveTotalPages: number;
  effectiveStanzaIndexByPage: number[];
  effectiveChorusStartLineIndexByPage: number[];
  isChorusOnlyView: boolean;
  displayVerseForIndicator: number;
  isChorusForIndicator: boolean;
}

/**
 * Pure function: given chorus-only state and page data, returns the effective view state
 * (lines to show, page indices, verse indicator values). Used by App and by tests.
 */
export function getEffectiveLyricsView(
  input: EffectiveLyricsViewInput,
): EffectiveLyricsView {
  const {
    chorusOnlyForVerse,
    chorusOnlyPage = 0,
    currentPage,
    currentVerse,
    displayPages,
    stanzaIndexByPage,
    chorusStartLineIndexByPage,
    stanzas,
    isChorus,
    languageCount,
  } = input;

  // Resolve which stanza holds the chorus for the requested verse (when in chorus-only mode).
  const chorusOnlyStanzaIdx =
    chorusOnlyForVerse != null
      ? nthChorusStanzaIndex(chorusOnlyForVerse, isChorus)
      : -1;
  const chorusOnlyLines =
    chorusOnlyStanzaIdx >= 0 && stanzas[chorusOnlyStanzaIdx]
      ? stanzas[chorusOnlyStanzaIdx]
      : [];
  const isChorusOnlyView =
    chorusOnlyForVerse != null && chorusOnlyLines.length > 0;

  const totalPages = displayPages.length;
  const linesPerPage =
    languageCount <= 1
      ? LINES_PER_PAGE_SINGLE_LANGUAGE
      : SENTENCES_PER_LANGUAGE * languageCount;

  // In chorus-only view, chorus may span multiple pages; compute page count and clamp requested page.
  const chorusOnlyPageCount = isChorusOnlyView
    ? Math.max(1, Math.ceil(chorusOnlyLines.length / linesPerPage))
    : 1;
  const clampedChorusPage = Math.max(
    0,
    Math.min(chorusOnlyPage, chorusOnlyPageCount - 1),
  );
  const chorusPageLines = isChorusOnlyView
    ? chorusOnlyLines.slice(
        clampedChorusPage * linesPerPage,
        clampedChorusPage * linesPerPage + linesPerPage,
      )
    : [];

  // Return view state: either chorus-only (single stanza, possibly paginated) or normal full-song pages.
  return {
    lines: isChorusOnlyView
      ? chorusPageLines
      : Array.isArray(displayPages[currentPage])
        ? displayPages[currentPage]
        : [],
    effectiveCurrentPage: isChorusOnlyView ? clampedChorusPage : currentPage,
    effectiveTotalPages: isChorusOnlyView ? chorusOnlyPageCount : totalPages,
    effectiveStanzaIndexByPage: isChorusOnlyView
      ? [chorusOnlyStanzaIdx]
      : stanzaIndexByPage,
    effectiveChorusStartLineIndexByPage: isChorusOnlyView
      ? [-1]
      : chorusStartLineIndexByPage,
    isChorusOnlyView,
    displayVerseForIndicator: isChorusOnlyView
      ? chorusOnlyForVerse!
      : currentVerse,
    isChorusForIndicator:
      isChorusOnlyView ||
      (stanzaIndexByPage[currentPage] !== undefined &&
        isChorus[stanzaIndexByPage[currentPage]]),
  };
}
