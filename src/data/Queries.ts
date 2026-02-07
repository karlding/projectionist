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

/** Section: section[sentenceIndex][langIndex] = line text. */
export type Section = string[][];

export interface SongData {
  sourceSkid: number;
  sourceSequenceNbr: number;
  title: string[];
  sections: Section[];
  isChorus: boolean[];
  languageSkid: number[];
}

/** Order lines by sentence index then language: lang1 line1, lang2 line1, lang1 line2, lang2 line2, ... */
function interleaveBySentenceThenLanguage(
  items: { seq: number; lang: number; content: string }[]
): string[] {
  return [...items]
    .sort((a, b) => a.seq - b.seq || a.lang - b.lang)
    .map((x) => x.content);
}

/** Build section as sentence x lang matrix from ordered items (seq, lang, content). Returns { section, languageSkid } with lang order. */
function buildSection(
  items: { seq: number; lang: number; content: string }[],
  langOrder: number[]
): Section {
  const bySeq = new Map<number, { lang: number; content: string }[]>();
  for (const x of items) {
    if (!bySeq.has(x.seq)) bySeq.set(x.seq, []);
    bySeq.get(x.seq)!.push({ lang: x.lang, content: x.content });
  }
  const sentences = [...bySeq.keys()].sort((a, b) => a - b);
  const section: Section = [];
  for (const seq of sentences) {
    const lineItems = bySeq.get(seq)!;
    const row = langOrder.map((lang) => lineItems.find((i) => i.lang === lang)?.content ?? '');
    section.push(row);
  }
  return section;
}

/** Unique language skids in order of first appearance in items. */
function languageOrder(items: { seq: number; lang: number; content: string }[]): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  for (const x of [...items].sort((a, b) => a.seq - b.seq || a.lang - b.lang)) {
    if (!seen.has(x.lang)) {
      seen.add(x.lang);
      order.push(x.lang);
    }
  }
  return order;
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
    getSongData(sourceSkid: number, sourceSequenceNbr: number): SongData {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const titleRows = titleStmt.all(a, b) as unknown as SongTitleRow[];
      const title = titleRows.map((r) => r.TitleName).filter(Boolean);

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
      const sections: Section[] = [];
      const isChorus: boolean[] = [];
      let languageSkid: number[] = [];
      for (const n of allStanzaNbrs) {
        const verseItems = byStanza.get(n);
        const chorusItems = chorusContentByStanza.get(n);
        if (verseItems?.length) {
          if (languageSkid.length === 0) languageSkid = languageOrder(verseItems);
          sections.push(buildSection(verseItems, languageSkid));
          isChorus.push(false);
        }
        if (chorusItems?.length) {
          if (languageSkid.length === 0) languageSkid = languageOrder(chorusItems);
          sections.push(buildSection(chorusItems, languageSkid));
          isChorus.push(true);
        }
      }
      return {
        sourceSkid,
        sourceSequenceNbr,
        title,
        sections,
        isChorus,
        languageSkid,
      };
    },
  };
}
