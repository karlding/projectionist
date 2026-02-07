import * as React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router';
import { getPageNavigation, handleKeyDown, handleKeyUp } from './songNumberInput';

const sourceSkid = 1;
const languageSkid = 1;

function clampPage(page: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(page, total - 1));
}

/** Normalize stanzas array (handles legacy flat string[] from older API if needed). */
function normalizeStanzas(s: string[] | string[][] | null | undefined): string[][] {
  if (!s || !Array.isArray(s)) return [];
  if (s.length === 0) return [];
  const first = s[0];
  if (Array.isArray(first)) return s as string[][];
  return (s as string[]).map((line) => [line]);
}

function Homepage() {
  const [sourceSequenceNbr, setSourceSequenceNbr] = React.useState(294);
  const [title, setTitle] = React.useState<string | null>(null);
  const [stanzas, setStanzas] = React.useState<string[][]>([]);
  const [isChorus, setIsChorus] = React.useState<boolean[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const digitBufferRef = React.useRef('');

  const totalPages = stanzas.length > 0 ? stanzas.length : 1;
  const totalPagesRef = React.useRef(totalPages);
  totalPagesRef.current = totalPages;
  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;

  const totalVerses = isChorus.filter((c) => !c).length || 1;
  const currentVerse =
    isChorus.length > 0
      ? isChorus
          .slice(0, currentPage + 1)
          .filter((c) => !c).length
      : 1;

  const loadSong = React.useCallback((sequenceNbr: number) => {
    setLoading(true);
    setError(null);
    Promise.all([
      window.api.getSongTitle(sourceSkid, sequenceNbr, languageSkid),
      window.api.getStanzas(sourceSkid, sequenceNbr, languageSkid),
    ])
      .then(([t, s]) => {
        console.log('[loadSong] getStanzas response:', s, 'stanzas?.length:', (s as { stanzas?: unknown[] })?.stanzas?.length);
        setTitle(t);
        const stanzasList = normalizeStanzas((s as { stanzas?: string[][] }).stanzas);
        console.log('[loadSong] stanzasList.length:', stanzasList.length, 'first:', stanzasList[0]?.[0]?.slice(0, 50));
        setStanzas(stanzasList);
        const chorusFlags =
          Array.isArray(s.isChorus) && s.isChorus.length === stanzasList.length
            ? s.isChorus
            : stanzasList.map(() => false);
        setIsChorus(chorusFlags);
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
      const result = handleKeyDown(e.key, e.ctrlKey, digitBufferRef.current);
      digitBufferRef.current = result.buffer;
      if (result.preventDefault) e.preventDefault();

      const nav = getPageNavigation(e.key, e.ctrlKey, totalPagesRef.current, currentPageRef.current);
      if (nav) {
        setCurrentPage(nav.page);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const result = handleKeyUp(e.key, digitBufferRef.current);
      digitBufferRef.current = result.buffer;
      if (result.sequenceNbr !== null) setSourceSequenceNbr(result.sequenceNbr);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white">
      <header className="flex-shrink-0 sticky top-0 z-10 flex items-baseline justify-between gap-4 px-8 pt-6 pb-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-semibold">{title ?? 'Projectionist'}</h1>
        {!loading && !error && stanzas.length > 0 && totalVerses > 0 && (
          <span className="text-gray-500 text-sm tabular-nums">{currentVerse} / {totalVerses}</span>
        )}
      </header>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-8 py-6">
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : stanzas.length > 0 ? (
          <div className="text-gray-700 overflow-hidden space-y-3">
            {(Array.isArray(stanzas[currentPage]) ? stanzas[currentPage] : []).map((content: string, i: number) => (
              <p key={i} className="whitespace-pre-wrap">
                {content}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No song found for this number.</p>
        )}
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
