import * as React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router';
import { handleKeyDown, handleKeyUp } from './songNumberInput';

const sourceSkid = 1;
const languageSkid = 1;

function Homepage() {
  const [sourceSequenceNbr, setSourceSequenceNbr] = React.useState(294);
  const [title, setTitle] = React.useState<string | null>(null);
  const [stanzas, setStanzas] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const digitBufferRef = React.useRef('');

  const loadSong = React.useCallback((sequenceNbr: number) => {
    setLoading(true);
    setError(null);
    Promise.all([
      window.api.getSongTitle(sourceSkid, sequenceNbr, languageSkid),
      window.api.getStanzas(sourceSkid, sequenceNbr, languageSkid),
    ])
      .then(([t, s]) => {
        setTitle(t);
        setStanzas(s ?? []);
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
    const onKeyDown = (e: KeyboardEvent) => {
      const result = handleKeyDown(e.key, e.ctrlKey, digitBufferRef.current);
      digitBufferRef.current = result.buffer;
      if (result.preventDefault) e.preventDefault();
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
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">{title ?? 'Projectionist'}</h1>
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <>
          {stanzas.length > 0 ? (
            <div className="space-y-2 text-gray-700">
              {stanzas.map((content, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {content}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No song found for this number.</p>
          )}
        </>
      )}
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
