import type { Database } from './Model';

export interface SongTitleRow {
  TitleName: string;
}

export interface SentenceRow {
  Content: string;
}

export interface StanzaSentenceRow {
  StanzaNbr: number;
  Content: string;
  IsChorus?: number; /* 0 or 1 from SQLite */
}

/** Ensure value is a safe integer for inlining in SQL (no injection). */
function safeInt(n: number): number {
  const i = Math.floor(Number(n));
  if (!Number.isSafeInteger(i)) throw new Error('Invalid integer parameter');
  return i;
}

/** Single language for now (schema has LanguageSkid on all tables). */
const LANGUAGE_SKID = 1;

/** Bind (sourceSkid, sourceSequenceNbr) for queries. Pass as strings so node:sqlite matches TEXT (e.g. SourceSequenceNbr) and INTEGER columns. */
function bindParams(sourceSkid: number, sourceSequenceNbr: number): [string, string] {
  return [String(safeInt(sourceSkid)), String(safeInt(sourceSequenceNbr))];
}

const TITLE_SQL = `
  SELECT Song.TitleName
  FROM Song
  INNER JOIN SourceSong ON (
    SourceSong.SongSkid = Song.SongSkid
    AND SourceSong.LanguageSkid = Song.LanguageSkid
  )
  INNER JOIN Source ON (
    Source.SourceSkid = SourceSong.SourceSkid
    AND Source.LanguageSkid = Song.LanguageSkid
  )
  WHERE (
    Source.SourceSkid = ?
    AND SourceSong.SourceSequenceNbr = ?
    AND Song.LanguageSkid = ${LANGUAGE_SKID}
  )
`;

const STANZAS_SQL = `
  SELECT Stanza.StanzaSequenceNbr AS StanzaNbr, Sentence.Content,
    (Stanza.ChorusSkid IS NOT NULL) AS IsChorus
  FROM Sentence
  INNER JOIN StanzaSentence ON (
    StanzaSentence.SentenceSkid = Sentence.SentenceSkid
  )
  INNER JOIN Stanza ON (
    Stanza.SongSkid = StanzaSentence.SongSkid
    AND Stanza.LanguageSkid = StanzaSentence.LanguageSkid
    AND Stanza.StanzaSequenceNbr = StanzaSentence.StanzaSequenceNbr
  )
  INNER JOIN SourceSong ON (
    SourceSong.SongSkid = Stanza.SongSkid
    AND SourceSong.LanguageSkid = Stanza.LanguageSkid
  )
  INNER JOIN Source ON (
    Source.SourceSkid = SourceSong.SourceSkid
    AND Source.LanguageSkid = SourceSong.LanguageSkid
  )
  WHERE (
    Source.SourceSkid = ?
    AND SourceSong.SourceSequenceNbr = ?
    AND Stanza.LanguageSkid = ${LANGUAGE_SKID}
  )
  ORDER BY Stanza.StanzaSequenceNbr
`;

const CHORUS_SQL = `
  SELECT Sentence.Content
  FROM Sentence
  INNER JOIN ChorusSentence ON (
    ChorusSentence.SentenceSkid = Sentence.SentenceSkid
    AND ChorusSentence.LanguageSkid = ${LANGUAGE_SKID}
  )
  INNER JOIN Chorus ON (
    Chorus.ChorusSkid = ChorusSentence.ChorusSkid
    AND Chorus.LanguageSkid = ChorusSentence.LanguageSkid
  )
  INNER JOIN Stanza ON (
    Stanza.ChorusSkid = Chorus.ChorusSkid
    AND Stanza.StanzaSequenceNbr = ChorusSentence.SentenceSequenceNbr
  )
  INNER JOIN SourceSong ON (
    SourceSong.SongSkid = Stanza.SongSkid
    AND SourceSong.LanguageSkid = Stanza.LanguageSkid
  )
  INNER JOIN Source ON (
    Source.SourceSkid = SourceSong.SourceSkid
    AND Source.LanguageSkid = SourceSong.LanguageSkid
  )
  WHERE (
    Source.SourceSkid = ?
    AND SourceSong.SourceSequenceNbr = ?
    AND Stanza.LanguageSkid = ${LANGUAGE_SKID}
  )
`;

/** Chorus sentences with stanza position; all lines per slot, single language. Do not join StanzaSequenceNbr = SentenceSequenceNbr so we get every line of the chorus for each slot. */
const CHORUS_SENTENCES_SQL = `
  SELECT Stanza.StanzaSequenceNbr AS StanzaNbr, Sentence.Content
  FROM Sentence
  INNER JOIN ChorusSentence ON (
    ChorusSentence.SentenceSkid = Sentence.SentenceSkid
    AND ChorusSentence.LanguageSkid = ${LANGUAGE_SKID}
  )
  INNER JOIN Chorus ON (
    Chorus.ChorusSkid = ChorusSentence.ChorusSkid
    AND Chorus.LanguageSkid = ChorusSentence.LanguageSkid
  )
  INNER JOIN Stanza ON (
    Stanza.ChorusSkid = Chorus.ChorusSkid
    AND Stanza.LanguageSkid = ${LANGUAGE_SKID}
  )
  INNER JOIN SourceSong ON (
    SourceSong.SongSkid = Stanza.SongSkid
    AND SourceSong.LanguageSkid = Stanza.LanguageSkid
  )
  INNER JOIN Source ON (
    Source.SourceSkid = SourceSong.SourceSkid
    AND Source.LanguageSkid = SourceSong.LanguageSkid
  )
  WHERE (
    Source.SourceSkid = ?
    AND SourceSong.SourceSequenceNbr = ?
  )
  ORDER BY Stanza.StanzaSequenceNbr, ChorusSentence.SentenceSequenceNbr
`;

/**
 * Create query helpers for the songs database. Use only in the main process.
 * Uses parameterized queries (? placeholders) so the driver binds values safely.
 */
export function createQueries(db: Database) {
  const titleStmt = db.prepare(TITLE_SQL);
  const stanzasStmt = db.prepare(STANZAS_SQL);
  const chorusStmt = db.prepare(CHORUS_SQL);
  let chorusSentencesStmt: ReturnType<Database['prepare']> | null = null;
  try {
    chorusSentencesStmt = db.prepare(CHORUS_SENTENCES_SQL);
  } catch {
    // ChorusSentence table or schema may be missing; chorus will be omitted
  }

  return {
    getSongTitle(sourceSkid: number, sourceSequenceNbr: number, _languageSkid: number): string | null {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const row = titleStmt.get(a, b) as unknown as SongTitleRow | undefined;
      return row?.TitleName ?? null;
    },
    /** Returns stanzas and per-stanza isChorus (verse vs chorus). Verse from StanzaSentence; chorus from ChorusSentence when present. Many songs have no chorus. */
    getStanzas(sourceSkid: number, sourceSequenceNbr: number, _languageSkid: number): { stanzas: string[][]; isChorus: boolean[] } {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const rows = stanzasStmt.all(a, b) as unknown as StanzaSentenceRow[];
      console.log('[getStanzas] verse rows:', rows.length, rows[0] ? { keys: Object.keys(rows[0]), first: rows[0] } : null);
      const byStanza = new Map<number, string[]>();
      const chorusByStanza = new Map<number, boolean>();
      for (const r of rows) {
        const row = r as StanzaSentenceRow & Record<string, unknown>;
        const n = Number(row.StanzaNbr ?? row['Stanza.StanzaSequenceNbr'] ?? row.StanzaSequenceNbr);
        if (!Number.isFinite(n)) continue;
        if (!byStanza.has(n)) {
          byStanza.set(n, []);
          chorusByStanza.set(n, Number(row.IsChorus) === 1);
        }
        byStanza.get(n)!.push(r.Content);
      }
      let chorusRows: StanzaSentenceRow[] = [];
      if (chorusSentencesStmt) {
        try {
          chorusRows = chorusSentencesStmt.all(a, b) as unknown as StanzaSentenceRow[];
        } catch {
          // Chorus query failed; verse-only
        }
      }
      const chorusContentByStanza = new Map<number, string[]>();
      for (const r of chorusRows) {
        const row = r as StanzaSentenceRow & Record<string, unknown>;
        const n = Number(row.StanzaNbr ?? row['Stanza.StanzaSequenceNbr'] ?? row.StanzaSequenceNbr);
        if (!Number.isFinite(n)) continue;
        if (!chorusContentByStanza.has(n)) chorusContentByStanza.set(n, []);
        chorusContentByStanza.get(n)!.push(r.Content);
      }
      const allStanzaNbrs = [...new Set([...byStanza.keys(), ...chorusContentByStanza.keys()])].sort((x, y) => x - y);
      const stanzas: string[][] = [];
      const isChorus: boolean[] = [];
      for (const n of allStanzaNbrs) {
        const verseLines = byStanza.get(n);
        const chorusLines = chorusContentByStanza.get(n);
        if (verseLines?.length) {
          stanzas.push(verseLines);
          isChorus.push(false);
        }
        if (chorusLines?.length) {
          stanzas.push(chorusLines);
          isChorus.push(true);
        }
      }
      console.log('[getStanzas] result:', { stanzaCount: stanzas.length, isChorusLength: isChorus.length, firstStanzaPreview: stanzas[0]?.[0]?.slice(0, 50) });
      return { stanzas, isChorus };
    },
    getChorus(sourceSkid: number, sourceSequenceNbr: number, _languageSkid: number): string | null {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const row = chorusStmt.get(a, b) as unknown as SentenceRow | undefined;
      return row?.Content ?? null;
    },
  };
}
