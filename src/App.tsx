import * as React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router';
import { useMachine } from '@xstate/react';
import { keyboardMachine, clampLyricsFontSizeIndex } from './keyboardMachine';

const sourceSkid = 1;
const languageSkid = 1;

function clampPage(page: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(page, total - 1));
}

/** Max sentences per language per page (4 per language → 8 rows for 2 languages). */
const SENTENCES_PER_LANGUAGE = 4;
/** Single-language songs can fit more lines (no alternating language rows). */
const LINES_PER_PAGE_SINGLE_LANGUAGE = 8;

/** Lyrics font size steps: '=' increases, '-' decreases. */
const LYRICS_FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
const DEFAULT_LYRICS_FONT_SIZE_INDEX = 0; // text-2xl

/** Chunk stanzas into display pages: at most 4 sentences per language (8 rows for 2 langs), or 8 lines for single language. Each page contains lines from a single stanza only (no mixing verses). */
function buildDisplayPages(stanzas: string[][], languageCount: number): { pages: string[][]; stanzaIndexByPage: number[] } {
  const linesPerPage = languageCount <= 1
    ? LINES_PER_PAGE_SINGLE_LANGUAGE
    : SENTENCES_PER_LANGUAGE * languageCount;
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

function Homepage() {
  const [sourceSequenceNbr, setSourceSequenceNbr] = React.useState(294);
  const [title, setTitle] = React.useState<string[]>([]);
  const [stanzas, setStanzas] = React.useState<string[][]>([]);
  const [isChorus, setIsChorus] = React.useState<boolean[]>([]);
  const [languageCount, setLanguageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [lyricsFontSizeIndex, setLyricsFontSizeIndex] = React.useState(DEFAULT_LYRICS_FONT_SIZE_INDEX);
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const stanzaIndexByPageRef = React.useRef<number[]>([]);
  const isChorusRef = React.useRef<boolean[]>([]);

  const [, sendKeyEvent] = useMachine(keyboardMachine, {
    input: {
      onNavigate: setCurrentPage,
      onFontSizeDelta: (delta) =>
        setLyricsFontSizeIndex((i) => clampLyricsFontSizeIndex(i + delta)),
      onLoadSong: setSourceSequenceNbr,
    },
  });

  const { pages: displayPages, stanzaIndexByPage } = React.useMemo(
    () => buildDisplayPages(stanzas, languageCount),
    [stanzas, languageCount]
  );
  const totalPages = displayPages.length;
  const totalPagesRef = React.useRef(totalPages);
  totalPagesRef.current = totalPages;
  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  stanzaIndexByPageRef.current = stanzaIndexByPage;
  isChorusRef.current = isChorus;

  const totalVerses = isChorus.filter((c) => !c).length || 1;
  const currentVerse =
    stanzaIndexByPage.length > 0 && currentPage < stanzaIndexByPage.length
      ? isChorus
          .slice(0, stanzaIndexByPage[currentPage] + 1)
          .filter((c) => !c).length
      : 1;

  const loadSong = React.useCallback((sequenceNbr: number) => {
    setLoading(true);
    setError(null);
    window.api
      .getSongData(sourceSkid, sequenceNbr)
      .then((data) => {
        setTitle(data.title);
        const stanzasList = data.sections.map((section) => section.flatMap((row) => row));
        setStanzas(stanzasList);
        setIsChorus(
          data.isChorus.length === stanzasList.length
            ? data.isChorus
            : stanzasList.map(() => false)
        );
        setLanguageCount(Math.max(1, data.languageSkid.length));
        setCurrentPage(0);
      })
      .catch((err: Error) => {
        setError(err?.message ?? String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadSong(sourceSequenceNbr);
  }, [sourceSequenceNbr, loadSong]);

  React.useEffect(() => {
    setCurrentPage((p) => clampPage(p, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      sendKeyEvent({
        type: 'KEY_DOWN',
        key: e.key,
        ctrlKey: e.ctrlKey,
        domEvent: e,
        totalPages: totalPagesRef.current,
        currentPage: currentPageRef.current,
        stanzaIndexByPage: stanzaIndexByPageRef.current,
        isChorus: isChorusRef.current,
        lyricsScrollEl: lyricsScrollRef.current,
      });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      sendKeyEvent({ type: 'KEY_UP', key: e.key });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [sendKeyEvent]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white">
      {/* Title with full-width horizontal line below */}
      <header className="flex-shrink-0 sticky top-0 z-10 px-8 pt-6 pb-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-semibold text-center">
          {title.length > 0 ? `${sourceSequenceNbr}: ${title.join(' / ')}` : 'Projectionist'}
        </h1>
      </header>
      {/* Two columns when song loaded: verse indicator (sticky left) | lyrics (majority) — flex so lyrics area has bounded height and can scroll */}
      <div className={`flex-1 min-h-0 overflow-hidden pt-6 flex ${!loading && !error && stanzas.length > 0 && totalVerses > 0 ? 'flex-row' : 'flex-col'}`}>
        {!loading && !error && stanzas.length > 0 && totalVerses > 0 && (
          <aside className="flex-shrink-0 w-14 border-r border-gray-200 bg-white z-10 px-1 pt-0.5">
            <span className="text-gray-500 text-sm tabular-nums text-center block">{currentVerse} / {totalVerses}</span>
          </aside>
        )}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          {loading ? (
            <p className="px-8 py-6">Loading…</p>
          ) : error ? (
            <p className="px-8 py-6 text-red-600">{error}</p>
          ) : stanzas.length > 0 ? (
            <div ref={lyricsScrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-8 pb-6">
              <div className={`text-gray-700 ${LYRICS_FONT_SIZES[lyricsFontSizeIndex]}`}>
                {(Array.isArray(displayPages[currentPage]) ? displayPages[currentPage] : []).map((content: string, i: number) => {
                  const stanzaIdx = stanzaIndexByPage[currentPage] ?? 0;
                  const nextStanzaIsChorus = stanzaIdx + 1 < isChorus.length && isChorus[stanzaIdx + 1];
                  const isVerse = !isChorus[stanzaIdx];
                  const isLastLine = i === (displayPages[currentPage]?.length ?? 1) - 1;
                  const isLastPageOfStanza = currentPage >= totalPages - 1 || stanzaIndexByPage[currentPage + 1] !== stanzaIdx;
                  const showYellowLine = isVerse && nextStanzaIsChorus && isLastLine && isLastPageOfStanza;
                  const isEndOfSong = currentPage === totalPages - 1 && isLastLine;
                  const showVerseEndLine = isVerse && isLastLine && isLastPageOfStanza && !isEndOfSong && !showYellowLine;
                  return (
                    <React.Fragment key={i}>
                      <p className="whitespace-pre-wrap py-0.5">
                        {content}
                      </p>
                      {showYellowLine ? (
                        <hr className="border-0 border-t-2 border-yellow-500 my-3 w-full" />
                      ) : showVerseEndLine ? (
                        <hr className="border-0 border-t-2 border-gray-300 my-3 w-full" />
                      ) : (i + 1) % languageCount === 0 && !isLastLine ? (
                        <hr className="border-0 border-t border-gray-200 my-3 w-full" />
                      ) : null}
                      {isEndOfSong ? (
                        <hr className="border-0 border-t-2 border-red-500 my-3 w-full" />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="px-8 py-6 text-gray-500">no song found for this number.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<Homepage />} />
        </Routes>
      </Router>
    );
  }
