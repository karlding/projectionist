import * as React from 'react';
import {
  MemoryRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from 'react-router';
import { useMachine } from '@xstate/react';
import { keyboardMachine, clampLyricsFontSizeIndex } from './keyboardMachine';
import {
  buildDisplayPages,
  clampPage,
  DEFAULT_LYRICS_FONT_SIZE_INDEX,
  totalVersesFromChorus,
  currentVerseForPage,
  getEffectiveLyricsView,
} from './displayPages';
import { useSongLoader } from './useSongLoader';
import { SongHeader } from './components/SongHeader';
import { InitialLoadPage } from './components/InitialLoadPage';
import { VerseIndicator } from './components/VerseIndicator';
import { LyricsPageContent } from './components/LyricsPageContent';
import { useScrollToTopOnPageChange } from './useScrollToTopOnPageChange';

const sourceSkid = 1;
const DEFAULT_SOURCE_SEQUENCE_NBR = 294;

function InitialLoadRoute() {
  const navigate = useNavigate();
  const { loading, error, loadSong } = useSongLoader(sourceSkid);
  const sourceSequenceNbr = DEFAULT_SOURCE_SEQUENCE_NBR;

  React.useEffect(() => {
    loadSong(sourceSequenceNbr).then(() => {
      navigate(`/song/${sourceSequenceNbr}`, { replace: true });
    });
  }, [loadSong, sourceSequenceNbr, navigate]);

  return (
    <InitialLoadPage loading={loading} error={error ?? undefined} />
  );
}

function SongView() {
  const { sourceSequenceNbr: param } = useParams<{ sourceSequenceNbr: string }>();
  const sourceSequenceNbr = Math.max(
    0,
    parseInt(param ?? String(DEFAULT_SOURCE_SEQUENCE_NBR), 10) || DEFAULT_SOURCE_SEQUENCE_NBR
  );
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = React.useState(0);
  const [chorusOnlyForVerse, setChorusOnlyForVerse] = React.useState<number | null>(null);
  const [lyricsFontSizeIndex, setLyricsFontSizeIndex] = React.useState(
    DEFAULT_LYRICS_FONT_SIZE_INDEX
  );
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const stanzaIndexByPageRef = React.useRef<number[]>([]);
  const isChorusRef = React.useRef<boolean[]>([]);
  const chorusOnlyForVerseRef = React.useRef<number | null>(null);
  const currentVerseRef = React.useRef(1);

  const {
    titleLine,
    stanzas,
    isChorus,
    languageCount,
    loading,
    error,
    loadSong,
  } = useSongLoader(sourceSkid);

  const onChorusOnlyChange = React.useCallback((verseNum: number | null) => {
    setChorusOnlyForVerse(verseNum);
    setTimeout(() => {
      lyricsScrollRef.current?.scrollTo(0, 0);
    }, 0);
  }, []);

  const [, sendKeyEvent] = useMachine(keyboardMachine, {
    input: {
      onNavigate: setCurrentPage,
      onFontSizeDelta: (delta) =>
        setLyricsFontSizeIndex((i) => clampLyricsFontSizeIndex(i + delta)),
      onLoadSong: (n) => navigate(`/song/${n}`),
    },
  });

  const { pages: displayPages, stanzaIndexByPage, firstStanzaIndexByPage, chorusStartLineIndexByPage } = React.useMemo(
    () => buildDisplayPages(stanzas, languageCount, isChorus),
    [stanzas, languageCount, isChorus]
  );
  const totalPages = displayPages.length;
  const totalPagesRef = React.useRef(totalPages);
  totalPagesRef.current = totalPages;
  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  stanzaIndexByPageRef.current = stanzaIndexByPage;
  const firstStanzaIndexByPageRef = React.useRef<number[]>([]);
  firstStanzaIndexByPageRef.current = firstStanzaIndexByPage;
  const chorusStartLineIndexByPageRef = React.useRef<number[]>([]);
  chorusStartLineIndexByPageRef.current = chorusStartLineIndexByPage;
  isChorusRef.current = isChorus;
  chorusOnlyForVerseRef.current = chorusOnlyForVerse;

  const onScrollToChorus = React.useCallback(() => {
    setTimeout(() => {
      const el = lyricsScrollRef.current?.querySelector('[data-chorus-start]');
      (el as HTMLElement)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 0);
  }, []);

  const totalVerses = totalVersesFromChorus(isChorus);
  const totalVersesRef = React.useRef(totalVerses);
  totalVersesRef.current = totalVerses;
  const currentVerse = currentVerseForPage(currentPage, stanzaIndexByPage, isChorus);
  currentVerseRef.current = currentVerse;

  React.useEffect(() => {
    loadSong(sourceSequenceNbr).then(() => setCurrentPage(0));
  }, [sourceSequenceNbr, loadSong]);

  React.useEffect(() => {
    setCurrentPage((p) => clampPage(p, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setChorusOnlyForVerse(null);
  }, [currentPage]);

  useScrollToTopOnPageChange(lyricsScrollRef, currentPage);

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
        firstStanzaIndexByPage: firstStanzaIndexByPageRef.current,
        chorusStartLineIndexByPage: chorusStartLineIndexByPageRef.current,
        isChorus: isChorusRef.current,
        lyricsScrollEl: lyricsScrollRef.current,
        onScrollToChorus,
        chorusOnlyForVerse: chorusOnlyForVerseRef.current,
        currentVerse: currentVerseRef.current,
        totalVerses: totalVersesRef.current,
        onChorusOnlyChange,
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
  }, [sendKeyEvent, onScrollToChorus, onChorusOnlyChange]);

  const showTwoColumns =
    !loading && !error && stanzas.length > 0 && totalVerses > 0;

  const effectiveView = getEffectiveLyricsView({
    chorusOnlyForVerse,
    currentPage,
    currentVerse,
    displayPages,
    stanzaIndexByPage,
    chorusStartLineIndexByPage,
    stanzas,
    isChorus,
  });

  const hasSongData = Boolean(titleLine);
  const header = hasSongData ? (
    <SongHeader titleLine={titleLine} />
  ) : (
    <header className="flex-shrink-0 sticky top-0 z-10 px-8 pt-6 pb-2 border-b border-gray-200 bg-white">
      <h1 className="text-2xl font-semibold text-center text-gray-500">
        Loading…
      </h1>
    </header>
  );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white">
      {header}
      <div
        className={`flex-1 min-h-0 overflow-hidden pt-3 flex ${
          showTwoColumns ? 'flex-row' : 'flex-col'
        }`}
      >
        {showTwoColumns && (
          <VerseIndicator
            sourceSequenceNbr={sourceSequenceNbr}
            currentVerse={effectiveView.displayVerseForIndicator}
            totalVerses={totalVerses}
            hasChorus={isChorus.some(Boolean)}
            isChorus={effectiveView.isChorusForIndicator}
          />
        )}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          {loading ? (
            <p className="px-8 py-6">Loading…</p>
          ) : error ? (
            <p className="px-8 py-6 text-red-600">{error}</p>
          ) : stanzas.length > 0 ? (
            <div
              ref={lyricsScrollRef}
              className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-8 pb-6"
            >
              <LyricsPageContent
                lines={effectiveView.lines}
                currentPage={effectiveView.effectiveCurrentPage}
                totalPages={effectiveView.effectiveTotalPages}
                stanzaIndexByPage={effectiveView.effectiveStanzaIndexByPage}
                chorusStartLineIndexByPage={effectiveView.effectiveChorusStartLineIndexByPage}
                isChorus={isChorus}
                languageCount={languageCount}
                lyricsFontSizeIndex={lyricsFontSizeIndex}
                suppressEndOfSong={effectiveView.isChorusOnlyView}
              />
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
        <Route path="/" element={<InitialLoadRoute />} />
        <Route path="/song/:sourceSequenceNbr" element={<SongView />} />
      </Routes>
    </Router>
  );
}
