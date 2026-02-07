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
    Source.SourceSkid = __A__
    AND SourceSong.SourceSequenceNbr = __B__
    AND Song.LanguageSkid = __C__
  )
`;

const STANZAS_SQL = `
  SELECT Stanza.StanzaSequenceNbr AS StanzaNbr, Sentence.Content
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
    Source.SourceSkid = __A__
    AND SourceSong.SourceSequenceNbr = __B__
    AND Stanza.LanguageSkid = __C__
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
    Source.SourceSkid = __A__
    AND SourceSong.SourceSequenceNbr = __B__
    AND Stanza.LanguageSkid = __C__
  )
`;

/**
 * Create query helpers for the songs database. Use only in the main process.
 * Uses inline integer params to avoid node:sqlite binding issues.
 */
export function createQueries(db: Database) {
  return {
    getSongTitle(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string | null {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const sql = TITLE_SQL.replace('__A__', String(a)).replace('__B__', String(b)).replace('__C__', String(c));
      const row = db.prepare(sql).get() as unknown as SongTitleRow | undefined;
      return row?.TitleName ?? null;
    },
    /** Returns stanzas as array of arrays: each stanza is an array of sentence strings. */
    getStanzas(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string[][] {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const sql = STANZAS_SQL.replace('__A__', String(a)).replace('__B__', String(b)).replace('__C__', String(c));
      const rows = db.prepare(sql).all() as unknown as StanzaSentenceRow[];
      const byStanza = new Map<number, string[]>();
      for (const r of rows) {
        const row = r as StanzaSentenceRow & Record<string, unknown>;
        const n = Number(row.StanzaNbr ?? row['Stanza.StanzaSequenceNbr'] ?? row.StanzaSequenceNbr);
        if (!Number.isFinite(n)) continue;
        if (!byStanza.has(n)) byStanza.set(n, []);
        byStanza.get(n)!.push(r.Content);
      }
      const order = [...byStanza.keys()].sort((x, y) => x - y);
      return order.map((k) => byStanza.get(k)!);
    },
    getChorus(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string | null {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const sql = CHORUS_SQL.replace('__A__', String(a)).replace('__B__', String(b)).replace('__C__', String(c));
      const row = db.prepare(sql).get() as unknown as SentenceRow | undefined;
      return row?.Content ?? null;
    },
  };
}
