import type { Database } from "./Model";

export interface SongTitleRow {
  TitleName: string;
  LanguageSkid: number;
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
  if (!Number.isSafeInteger(i)) throw new Error("Invalid integer parameter");
  return i;
}

/** Bind (sourceSkid, sourceSequenceNbr) for queries. Both are INTEGER in the schema. */
function bindParams(
  sourceSkid: number,
  sourceSequenceNbr: number,
): [number, number] {
  return [safeInt(sourceSkid), safeInt(sourceSequenceNbr)];
}

/** Section: section[sentenceIndex][langIndex] = line text. */
export type Section = string[][];

/** Title text keyed by language skid. */
export type TitleByLanguageSkid = Record<number, string>;

export interface SongData {
  sourceSkid: number;
  sourceSequenceNbr: number;
  titleByLanguageSkid: TitleByLanguageSkid;
  sections: Section[];
  isChorus: boolean[];
  languageSkid: number[];
}

/** Build section as sentence x lang matrix from ordered items (seq, lang, content). */
function buildSection(
  items: { seq: number; lang: number; content: string }[],
  langOrder: number[],
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
    const row = langOrder.map(
      (lang) => lineItems.find((i) => i.lang === lang)?.content ?? "",
    );
    section.push(row);
  }
  return section;
}

/** Unique language skids in order of first appearance in items. */
function languageOrder(
  items: { seq: number; lang: number; content: string }[],
): number[] {
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

type LineItem = { seq: number; lang: number; content: string };

/** Parse stanza/chorus row into stanza number and line item. Returns null if stanza nbr invalid. */
function parseStanzaLine(
  row: Record<string, unknown>,
  content: string,
  seqKey: string,
  langKey: string,
): { n: number; item: LineItem } | null {
  const n = Number(
    row.StanzaNbr ?? row["Stanza.StanzaSequenceNbr"] ?? row.StanzaSequenceNbr,
  );
  if (!Number.isFinite(n)) return null;
  const seq = Number(row.SentenceSequenceNbr ?? row[seqKey] ?? 0);
  const lang = Number(row.LanguageSkid ?? row[langKey] ?? 0);
  return { n, item: { seq, lang, content } };
}

const TITLE_SQL = `
  SELECT Song.TitleName, Song.LanguageSkid
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

/** Chorus sentences with stanza position; all languages. */
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
  let chorusSentencesStmt: ReturnType<Database["prepare"]> | null = null;
  try {
    chorusSentencesStmt = db.prepare(CHORUS_SENTENCES_SQL);
  } catch {
    // ChorusSentence table or schema may be missing; chorus will be omitted
  }

  return {
    getSongData(sourceSkid: number, sourceSequenceNbr: number): SongData {
      const [a, b] = bindParams(sourceSkid, sourceSequenceNbr);
      const titleRows = titleStmt.all(a, b) as unknown as SongTitleRow[];
      const titleByLanguageSkid: TitleByLanguageSkid = {};
      for (const r of titleRows) {
        if (r.TitleName != null && r.TitleName !== "") {
          titleByLanguageSkid[r.LanguageSkid] = r.TitleName;
        }
      }

      const rows = stanzasStmt.all(a, b) as unknown as StanzaSentenceRow[];
      const byStanza = new Map<number, LineItem[]>();
      const chorusByStanza = new Map<number, boolean>();
      for (const r of rows) {
        const row = r as StanzaSentenceRow & Record<string, unknown>;
        const parsed = parseStanzaLine(
          row,
          r.Content,
          "StanzaSentence.SentenceSequenceNbr",
          "Stanza.LanguageSkid",
        );
        if (!parsed) continue;
        const { n, item } = parsed;
        if (!byStanza.has(n)) {
          byStanza.set(n, []);
          chorusByStanza.set(n, Number(row.IsChorus) === 1);
        }
        byStanza.get(n)!.push(item);
      }
      let chorusRows: StanzaSentenceRow[] = [];
      if (chorusSentencesStmt) {
        try {
          chorusRows = chorusSentencesStmt.all(
            a,
            b,
          ) as unknown as StanzaSentenceRow[];
        } catch {
          // Chorus query failed; verse-only
        }
      }
      const chorusContentByStanza = new Map<number, LineItem[]>();
      for (const r of chorusRows) {
        const parsed = parseStanzaLine(
          r as unknown as Record<string, unknown>,
          r.Content,
          "ChorusSentence.SentenceSequenceNbr",
          "ChorusSentence.LanguageSkid",
        );
        if (!parsed) continue;
        const { n, item } = parsed;
        if (!chorusContentByStanza.has(n)) chorusContentByStanza.set(n, []);
        chorusContentByStanza.get(n)!.push(item);
      }
      const allStanzaNbrs = [
        ...new Set([...byStanza.keys(), ...chorusContentByStanza.keys()]),
      ].sort((x, y) => x - y);
      const sections: Section[] = [];
      const isChorus: boolean[] = [];
      let languageSkid: number[] = [];
      for (const n of allStanzaNbrs) {
        const verseItems = byStanza.get(n);
        const chorusItems = chorusContentByStanza.get(n);
        if (verseItems?.length) {
          if (languageSkid.length === 0)
            languageSkid = languageOrder(verseItems);
          sections.push(buildSection(verseItems, languageSkid));
          isChorus.push(false);
        }
        if (chorusItems?.length) {
          if (languageSkid.length === 0)
            languageSkid = languageOrder(chorusItems);
          sections.push(buildSection(chorusItems, languageSkid));
          isChorus.push(true);
        }
      }
      return {
        sourceSkid,
        sourceSequenceNbr,
        titleByLanguageSkid,
        sections,
        isChorus,
        languageSkid,
      };
    },
  };
}
