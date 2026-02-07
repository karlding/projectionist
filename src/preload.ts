import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getSongData: (sourceSkid: number, sourceSequenceNbr: number) =>
    ipcRenderer.invoke('db:getSongData', sourceSkid, sourceSequenceNbr),
});
