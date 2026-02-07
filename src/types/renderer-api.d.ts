import type { SongData } from '../data/Queries';

export interface RendererDbApi {
  getSongData: (sourceSkid: number, sourceSequenceNbr: number) => Promise<SongData>;
}

declare global {
  interface Window {
    api: RendererDbApi;
  }
}

export {};
