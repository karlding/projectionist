import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getSongTitle: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) =>
    ipcRenderer.invoke('db:getSongTitle', sourceSkid, sourceSequenceNbr, languageSkid),
  getStanzas: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) =>
    ipcRenderer.invoke('db:getStanzas', sourceSkid, sourceSequenceNbr, languageSkid),
  getChorus: (sourceSkid: number, sourceSequenceNbr: number, languageSkid: number) =>
    ipcRenderer.invoke('db:getChorus', sourceSkid, sourceSequenceNbr, languageSkid),
});
