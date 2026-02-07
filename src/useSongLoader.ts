import * as React from 'react';
import type { SongData } from './data/Queries';
import type { RendererDbApi } from './types/renderer-api';

export interface UseSongLoaderResult {
  titleLine: string;
  displayTitle: string;
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
  const [titleLine, setTitleLine] = React.useState('');
  const [displayTitle, setDisplayTitle] = React.useState('');
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
          const langSkids = data.languageSkid ?? [];
          const bySkid = data.titleByLanguageSkid ?? {};
          setTitleLine(
            langSkids
              .map((skid) => bySkid[skid])
              .filter(Boolean)
              .join(' / ')
          );
          setDisplayTitle(
            langSkids.length > 0 ? (bySkid[langSkids[0]] ?? '') : ''
          );
          const stanzasList = data.sections.map((section) => section.flatMap((row) => row));
          setStanzas(stanzasList);
          setIsChorus(
            data.isChorus.length === stanzasList.length
              ? data.isChorus
              : stanzasList.map(() => false)
          );
          setLanguageCount(Math.max(1, langSkids.length));
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
    titleLine,
    displayTitle,
    stanzas,
    isChorus,
    languageCount,
    loading,
    error,
    loadSong,
  };
}
