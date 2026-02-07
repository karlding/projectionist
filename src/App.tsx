import * as React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router';

function Homepage() {
  const [title, setTitle] = React.useState<string | null>(null);
  const [stanzas, setStanzas] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const sourceSkid = 1;
  const sourceSequenceNbr = 294;
  const languageSkid = 1;

  const loadSong = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      window.api.getSongTitle(sourceSkid, sourceSequenceNbr, languageSkid),
      window.api.getStanzas(sourceSkid, sourceSequenceNbr, languageSkid),
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
    loadSong();
  }, [loadSong]);

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
