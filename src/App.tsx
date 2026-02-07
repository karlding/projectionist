import * as React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router';
import { useMachine } from '@xstate/react';
import { keyboardMachine, clampLyricsFontSizeIndex } from './keyboardMachine';
import {
  buildDisplayPages,
  clampPage,
  DEFAULT_LYRICS_FONT_SIZE_INDEX,
  totalVersesFromChorus,
  currentVerseForPage,
} from './displayPages';
import { useSongLoader } from './useSongLoader';
import { SongHeader } from './components/SongHeader';
import { VerseIndicator } from './components/VerseIndicator';
import { LyricsPageContent } from './components/LyricsPageContent';

const sourceSkid = 1;

function Homepage() {
  const [sourceSequenceNbr, setSourceSequenceNbr] = React.useState(294);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [lyricsFontSizeIndex, setLyricsFontSizeIndex] = React.useState(
    DEFAULT_LYRICS_FONT_SIZE_INDEX
  );
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const stanzaIndexByPageRef = React.useRef<number[]>([]);
  const isChorusRef = React.useRef<boolean[]>([]);

  const {
    title,
    stanzas,
    isChorus,
    languageCount,
    loading,
    error,
    loadSong,
  } = useSongLoader(sourceSkid);

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

  const totalVerses = totalVersesFromChorus(isChorus);
  const currentVerse = currentVerseForPage(currentPage, stanzaIndexByPage, isChorus);

  React.useEffect(() => {
    loadSong(sourceSequenceNbr).then(() => setCurrentPage(0));
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

  const showTwoColumns =
    !loading && !error && stanzas.length > 0 && totalVerses > 0;
  const currentPageLines = Array.isArray(displayPages[currentPage])
    ? displayPages[currentPage]
    : [];

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white">
      <SongHeader title={title} sourceSequenceNbr={sourceSequenceNbr} />
      <div
        className={`flex-1 min-h-0 overflow-hidden pt-6 flex ${
          showTwoColumns ? 'flex-row' : 'flex-col'
        }`}
      >
        {showTwoColumns && (
          <VerseIndicator currentVerse={currentVerse} totalVerses={totalVerses} />
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
                lines={currentPageLines}
                currentPage={currentPage}
                totalPages={totalPages}
                stanzaIndexByPage={stanzaIndexByPage}
                isChorus={isChorus}
                languageCount={languageCount}
                lyricsFontSizeIndex={lyricsFontSizeIndex}
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
        <Route path="/" element={<Homepage />} />
      </Routes>
    </Router>
  );
}
