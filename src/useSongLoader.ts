import * as React from 'react';
import type { SongData } from './data/Queries';
import type { RendererDbApi } from './types/renderer-api';

export interface UseSongLoaderResult {
  title: string[];
  stanzas: string[][];
  isChorus: boolean[];
  languageCount: number;
  loading: boolean;
  error: string | null;
  loadSong: (sequenceNbr: number) => Promise<void>;
}

/**
 * Hook to load song data by sequence number. Accepts optional `api` for testing (defaults to window.api).
 */
export function useSongLoader(
  sourceSkid: number,
  api?: RendererDbApi
): UseSongLoaderResult {
  const [title, setTitle] = React.useState<string[]>([]);
  const [stanzas, setStanzas] = React.useState<string[][]>([]);
  const [isChorus, setIsChorus] = React.useState<boolean[]>([]);
  const [languageCount, setLanguageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSong = React.useCallback(
    (sequenceNbr: number): Promise<void> => {
      setLoading(true);
      setError(null);
      const client = api ?? window.api;
      return client
        .getSongData(sourceSkid, sequenceNbr)
        .then((data: SongData) => {
          setTitle(data.title);
          const stanzasList = data.sections.map((section) => section.flatMap((row) => row));
          setStanzas(stanzasList);
          setIsChorus(
            data.isChorus.length === stanzasList.length
              ? data.isChorus
              : stanzasList.map(() => false)
          );
          setLanguageCount(Math.max(1, data.languageSkid.length));
        })
        .catch((err: Error) => {
          setError(err?.message ?? String(err));
          throw err;
        })
        .finally(() => setLoading(false));
    },
    [sourceSkid, api]
  );

  return {
    title,
    stanzas,
    isChorus,
    languageCount,
    loading,
    error,
    loadSong,
  };
}
