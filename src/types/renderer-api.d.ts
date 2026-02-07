export interface RendererDbApi {
  getSongTitle: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) => Promise<string | null>;
  getStanzas: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) => Promise<string[][]>;
  getChorus: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) => Promise<string | null>;
}

declare global {
  interface Window {
    api: RendererDbApi;
  }
}

export {};
