/**
 * Song domain model: identity (source + sequence) and loaded content from Queries.
 */

import type { SongData as SongDataFromQueries } from './Queries';

export type { SongData } from './Queries';

export interface SongQueries {
  getSongData(sourceSkid: number, sourceSequenceNbr: number): SongDataFromQueries;
}

/** Flat lines per section for display (sentence x lang interleaved). */
function sectionsToStanzas(sections: SongDataFromQueries['sections']): string[][] {
  return sections.map((section) => section.flatMap((row) => row));
}

export class Song {
  readonly sourceSkid: number;
  readonly sourceSequenceNbr: number;
  readonly title: string[];
  readonly stanzas: string[][];
  readonly isChorus: boolean[];
  readonly languageSkid: number[];
  readonly languageCount: number;

  constructor(data: SongDataFromQueries) {
    this.sourceSkid = data.sourceSkid;
    this.sourceSequenceNbr = data.sourceSequenceNbr;
    this.title = data.title ?? [];
    this.isChorus = data.isChorus ?? [];
    this.languageSkid = data.languageSkid ?? [];
    this.languageCount = Math.max(1, this.languageSkid.length);
    this.stanzas = sectionsToStanzas(data.sections ?? []);
  }

  /** Build a Song by calling the query helpers (sync; use in main process). */
  static fromQueries(
    queries: SongQueries,
    sourceSkid: number,
    sourceSequenceNbr: number
  ): Song {
    const data = queries.getSongData(sourceSkid, sourceSequenceNbr);
    return new Song(data);
  }

  /** Build a Song from already-fetched data (e.g. after IPC in renderer). */
  static fromData(data: SongDataFromQueries): Song {
    return new Song(data);
  }

  /** Display title: first title or empty string. */
  get displayTitle(): string {
    return this.title.length > 0 ? this.title[0] : '';
  }

  /** All titles joined (e.g. for bilingual header). */
  get titleLine(): string {
    return this.title.filter(Boolean).join(' / ');
  }
}
