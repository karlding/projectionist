import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMachine } from '@xstate/react';
import { keyboardMachine } from '../keyboardMachine';

const emptyPayload = {
  totalPages: 0,
  currentPage: 0,
  stanzaIndexByPage: [] as number[],
  firstStanzaIndexByPage: [] as number[],
  chorusStartLineIndexByPage: [] as number[],
  isChorus: [] as boolean[],
  lyricsScrollEl: null as HTMLDivElement | null,
  chorusOnlyForVerse: null as number | null,
  currentVerse: 1,
  totalVerses: 0,
  effectiveChorusOnlyTotalPages: 0,
  effectiveChorusOnlyCurrentPage: 0,
};

export function NoSongFoundPage() {
  const { sourceSequenceNbr } = useParams<{ sourceSequenceNbr: string }>();
  const navigate = useNavigate();

  const [, sendKeyEvent] = useMachine(keyboardMachine, {
    input: {
      onNavigate: () => {},
      onFontSizeDelta: () => {},
      onLoadSong: (n) => navigate(`/song/${n}`),
    },
  });

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      sendKeyEvent({
        type: 'KEY_DOWN',
        key: e.key,
        ctrlKey: e.ctrlKey,
        domEvent: e,
        ...emptyPayload,
      });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      sendKeyEvent({ type: 'KEY_UP', key: e.key });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [sendKeyEvent]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-white px-8">
      <p className="text-gray-500">
        No song found for this number{sourceSequenceNbr ? ` (${sourceSequenceNbr})` : ''}.
      </p>
    </div>
  );
}
