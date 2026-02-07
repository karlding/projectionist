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
    AND Song.LanguageSkid = ?
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
    AND Stanza.LanguageSkid = ?
  )
  ORDER BY Stanza.StanzaSequenceNbr
`;

const CHORUS_SQL = `
  SELECT Sentence.Content
  FROM Sentence
  INNER JOIN ChorusSentence ON (
    ChorusSentence.SentenceSkid = Sentence.SentenceSkid
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
    AND Stanza.LanguageSkid = ?
  )
`;

/**
 * Create query helpers for the songs database. Use only in the main process.
 * Uses parameterized queries (? placeholders) so the driver binds values safely.
 */
export function createQueries(db: Database) {
  const titleStmt = db.prepare(TITLE_SQL);
  const stanzasStmt = db.prepare(STANZAS_SQL);
  const chorusStmt = db.prepare(CHORUS_SQL);

  return {
    getSongTitle(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string | null {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const row = titleStmt.get(a, b, c) as unknown as SongTitleRow | undefined;
      return row?.TitleName ?? null;
    },
    /** Returns stanzas and per-stanza isChorus (verse vs chorus). Chorus stanzas follow their verse; verse number does not change until after the chorus. */
    getStanzas(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): { stanzas: string[][]; isChorus: boolean[] } {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const rows = stanzasStmt.all(a, b, c) as unknown as StanzaSentenceRow[];
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
      const order = [...byStanza.keys()].sort((x, y) => x - y);
      return {
        stanzas: order.map((k) => byStanza.get(k)!),
        isChorus: order.map((k) => chorusByStanza.get(k) ?? false),
      };
    },
    getChorus(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string | null {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const row = chorusStmt.get(a, b, c) as unknown as SentenceRow | undefined;
      return row?.Content ?? null;
    },
  };
}
