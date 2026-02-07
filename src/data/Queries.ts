import type { Database } from './Model';

export interface SongTitleRow {
  TitleName: string;
}

export interface SentenceRow {
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
  SELECT Sentence.Content
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
    getStanzas(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string[] {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const sql = STANZAS_SQL.replace('__A__', String(a)).replace('__B__', String(b)).replace('__C__', String(c));
      const rows = db.prepare(sql).all() as unknown as SentenceRow[];
      return rows.map((r) => r.Content);
    },
    getChorus(sourceSkid: number, sourceSequenceNbr: number, languageSkid: number): string | null {
      const a = safeInt(sourceSkid), b = safeInt(sourceSequenceNbr), c = safeInt(languageSkid);
      const sql = CHORUS_SQL.replace('__A__', String(a)).replace('__B__', String(b)).replace('__C__', String(c));
      const row = db.prepare(sql).get() as unknown as SentenceRow | undefined;
      return row?.Content ?? null;
    },
  };
}
