export interface RendererDbApi {
  getSongTitle: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) => Promise<string[]>;
  getStanzas: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) => Promise<{ stanzas: string[][]; isChorus: boolean[]; languageCount: number }>;
  getChorus: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) => Promise<string | null>;
}

declare global {
  interface Window {
    api: RendererDbApi;
  }
}

export {};
