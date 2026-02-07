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
  SentenceSequenceNbr?: number;
  LanguageSkid?: number;
}

/** Ensure value is a safe integer for inlining in SQL (no injection). */
function safeInt(n: number): number {
  const i = Math.floor(Number(n));
  if (!Number.isSafeInteger(i)) throw new Error('Invalid integer parameter');
  return i;
}

/** Title uses first language only. */
const TITLE_LANGUAGE_SKID = 1;

/** Bind (sourceSkid, sourceSequenceNbr) for queries. Pass as strings so node:sqlite matches TEXT (e.g. SourceSequenceNbr) and INTEGER columns. */
function bindParams(sourceSkid: number, sourceSequenceNbr: number): [string, string] {
  return [String(safeInt(sourceSkid)), String(safeInt(sourceSequenceNbr))];
}

/** Order lines by sentence index then language: lang1 line1, lang2 line1, lang1 line2, lang2 line2, ... */
function interleaveBySentenceThenLanguage(
  items: { seq: number; lang: number; content: string }[]
): string[] {
  return [...items]
    .sort((a, b) => a.seq - b.seq || a.lang - b.lang)
    .map((x) => x.content);
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
    AND Source.LanguageSkid = SourceSong.LanguageSkid
  )
  WHERE (
    Source.SourceSkid = ?
    AND SourceSong.SourceSequenceNbr = ?
  )
  ORDER BY Song.LanguageSkid
`;

const STANZAS_SQL = `
  SELECT Stanza.StanzaSequenceNbr AS StanzaNbr, Sentence.Content,
    (Stanza.ChorusSkid IS NOT NULL) AS IsChorus,
    StanzaSentence.SentenceSequenceNbr AS SentenceSequenceNbr,
    Stanza.LanguageSkid AS LanguageSkid
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
  )
  ORDER BY Stanza.StanzaSequenceNbr, StanzaSentence.SentenceSequenceNbr, Stanza.LanguageSkid
`;

const CHORUS_SQL = `
  SELECT Sentence.Content
  FROM Sentence
  INNER JOIN ChorusSentence ON (
    ChorusSentence.SentenceSkid = Sentence.SentenceSkid
    AND ChorusSentence.LanguageSkid = ${TITLE_LANGUAGE_SKID}
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
    AND Stanza.LanguageSkid = ${TITLE_LANGUAGE_SKID}
  )
`;

/** Chorus sentences with stanza position; all languages, interleaved by sentence index (lang1 line1, lang2 line1, lang1 line2, ...). */
const CHORUS_SENTENCES_SQL = `
  SELECT Stanza.StanzaSequenceNbr AS StanzaNbr, Sentence.Content,
    ChorusSentence.SentenceSequenceNbr AS SentenceSequenceNbr,
    ChorusSentence.LanguageSkid AS LanguageSkid
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
    AND Stanza.LanguageSkid = ChorusSentence.LanguageSkid
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
  ORDER BY Stanza.StanzaSequenceNbr, ChorusSentence.SentenceSequenceNbr, ChorusSentence.LanguageSkid
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
    getSongTitle(sourceSkid: number, sourceSequenceNbr: number, _languageSkid: number): string[] {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const rows = titleStmt.all(a, b) as unknown as SongTitleRow[];
      return rows.map((r) => r.TitleName).filter(Boolean);
    },
    /** Returns stanzas and per-stanza isChorus (verse vs chorus). Verse from StanzaSentence; chorus from ChorusSentence when present. Many songs have no chorus. */
    getStanzas(sourceSkid: number, sourceSequenceNbr: number, _languageSkid: number): { stanzas: string[][]; isChorus: boolean[] } {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const rows = stanzasStmt.all(a, b) as unknown as StanzaSentenceRow[];
      const byStanza = new Map<number, { seq: number; lang: number; content: string }[]>();
      const chorusByStanza = new Map<number, boolean>();
      for (const r of rows) {
        const row = r as StanzaSentenceRow & Record<string, unknown>;
        const n = Number(row.StanzaNbr ?? row['Stanza.StanzaSequenceNbr'] ?? row.StanzaSequenceNbr);
        if (!Number.isFinite(n)) continue;
        const seq = Number(row.SentenceSequenceNbr ?? row['StanzaSentence.SentenceSequenceNbr'] ?? 0);
        const lang = Number(row.LanguageSkid ?? row['Stanza.LanguageSkid'] ?? 0);
        if (!byStanza.has(n)) {
          byStanza.set(n, []);
          chorusByStanza.set(n, Number(row.IsChorus) === 1);
        }
        byStanza.get(n)!.push({ seq, lang, content: r.Content });
      }
      let chorusRows: StanzaSentenceRow[] = [];
      if (chorusSentencesStmt) {
        try {
          chorusRows = chorusSentencesStmt.all(a, b) as unknown as StanzaSentenceRow[];
        } catch {
          // Chorus query failed; verse-only
        }
      }
      const chorusContentByStanza = new Map<number, { seq: number; lang: number; content: string }[]>();
      for (const r of chorusRows) {
        const row = r as StanzaSentenceRow & Record<string, unknown>;
        const n = Number(row.StanzaNbr ?? row['Stanza.StanzaSequenceNbr'] ?? row.StanzaSequenceNbr);
        if (!Number.isFinite(n)) continue;
        const seq = Number(row.SentenceSequenceNbr ?? row['ChorusSentence.SentenceSequenceNbr'] ?? 0);
        const lang = Number(row.LanguageSkid ?? row['ChorusSentence.LanguageSkid'] ?? 0);
        if (!chorusContentByStanza.has(n)) chorusContentByStanza.set(n, []);
        chorusContentByStanza.get(n)!.push({ seq, lang, content: r.Content });
      }
      const allStanzaNbrs = [...new Set([...byStanza.keys(), ...chorusContentByStanza.keys()])].sort((x, y) => x - y);
      const stanzas: string[][] = [];
      const isChorus: boolean[] = [];
      for (const n of allStanzaNbrs) {
        const verseItems = byStanza.get(n);
        const chorusItems = chorusContentByStanza.get(n);
        if (verseItems?.length) {
          stanzas.push(interleaveBySentenceThenLanguage(verseItems));
          isChorus.push(false);
        }
        if (chorusItems?.length) {
          stanzas.push(interleaveBySentenceThenLanguage(chorusItems));
          isChorus.push(true);
        }
      }
      return { stanzas, isChorus };
    },
    getChorus(sourceSkid: number, sourceSequenceNbr: number, _languageSkid: number): string | null {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const row = chorusStmt.get(a, b) as unknown as SentenceRow | undefined;
      return row?.Content ?? null;
    },
  };
}
