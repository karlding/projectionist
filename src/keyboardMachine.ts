/**
 * XState machine for global keyboard handling: song number entry (Ctrl+digits),
 * page/verse navigation, chorus jump (0), lyrics font size (+/-), and lyrics scroll (arrows).
 */

import { setup, assign, enqueueActions } from 'xstate';
import { getPageNavigation, handleKeyDown, handleKeyUp } from './songNumberInput';
import { totalVersesFromChorus, stanzaIndexForVerse } from './displayPages';

const LYRICS_FONT_SIZES_LENGTH = 6;

function clampPage(page: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(page, total - 1));
}

export interface KeyboardMachineInput {
  onNavigate: (page: number) => void;
  onFontSizeDelta: (delta: number) => void;
  onLoadSong: (sequenceNbr: number) => void;
}

export type KeyboardMachineEvent =
  | {
      type: 'KEY_DOWN';
      key: string;
      ctrlKey: boolean;
      domEvent: KeyboardEvent;
      totalPages: number;
      currentPage: number;
      stanzaIndexByPage: number[];
      isChorus: boolean[];
      lyricsScrollEl: HTMLDivElement | null;
    }
  | { type: 'KEY_UP'; key: string };

type Context = {
  digitBuffer: string;
  onNavigate: (page: number) => void;
  onFontSizeDelta: (delta: number) => void;
  onLoadSong: (sequenceNbr: number) => void;
};

const keyboardSetup = setup({
  types: {
    context: {} as Context,
    events: {} as KeyboardMachineEvent,
    input: {} as KeyboardMachineInput,
  },
});

export const keyboardMachine = keyboardSetup.createMachine({
  context: ({ input }) => ({
    digitBuffer: '',
    onNavigate: input.onNavigate,
    onFontSizeDelta: input.onFontSizeDelta,
    onLoadSong: input.onLoadSong,
  }),
  initial: 'listening',
  states: {
    listening: {
      on: {
        KEY_DOWN: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            if (event.type !== 'KEY_DOWN') return;
            const { key, ctrlKey, domEvent, totalPages, currentPage, stanzaIndexByPage, isChorus, lyricsScrollEl } = event;
            const result = handleKeyDown(key, ctrlKey, context.digitBuffer);
            enqueue.assign({ digitBuffer: result.buffer });
            if (result.preventDefault) domEvent.preventDefault();

            // Arrow/PageUp/Down: use getPageNavigation. Digit without Ctrl: verse jump to first page of that stanza.
            const isDigit = /^[0-9]$/.test(key);
            if (!isDigit) {
              const nav = getPageNavigation(key, ctrlKey, totalPages, currentPage);
              if (nav) {
                context.onNavigate(nav.page);
                domEvent.preventDefault();
              }
            } else if (!ctrlKey && stanzaIndexByPage.length > 0 && isChorus.length > 0) {
              const verse = key === '0' ? 10 : parseInt(key, 10);
              const totalVerses = totalVersesFromChorus(isChorus);
              if (verse >= 1 && verse <= totalVerses) {
                const stanzaIdx = stanzaIndexForVerse(verse, isChorus);
                if (stanzaIdx >= 0) {
                  const targetPage = stanzaIndexByPage.findIndex((s) => s === stanzaIdx);
                  if (targetPage >= 0) {
                    context.onNavigate(targetPage);
                    domEvent.preventDefault();
                  }
                }
              }
            }

            if (key === '0') {
              const byPage = stanzaIndexByPage;
              const chorusFlags = isChorus;
              const page = currentPage;
              if (byPage.length > 0 && page < byPage.length && chorusFlags.length > 0) {
                const currentStanzaIdx = byPage[page];
                if (!chorusFlags[currentStanzaIdx]) {
                  let chorusStanzaIdx = -1;
                  for (let i = currentStanzaIdx + 1; i < chorusFlags.length; i++) {
                    if (chorusFlags[i]) {
                      chorusStanzaIdx = i;
                      break;
                    }
                  }
                  if (chorusStanzaIdx >= 0) {
                    const chorusPage = byPage.findIndex((s: number) => s === chorusStanzaIdx);
                    if (chorusPage >= 0) {
                      context.onNavigate(chorusPage);
                      domEvent.preventDefault();
                    }
                  }
                }
              }
            }

            if (key === '=' || key === '+') {
              context.onFontSizeDelta(1);
              domEvent.preventDefault();
            } else if (key === '-') {
              context.onFontSizeDelta(-1);
              domEvent.preventDefault();
            }

            if (lyricsScrollEl && (key === 'ArrowUp' || key === 'ArrowDown')) {
              const step = 56;
              const before = lyricsScrollEl.scrollTop;
              lyricsScrollEl.scrollTop += key === 'ArrowDown' ? step : -step;
              if (lyricsScrollEl.scrollTop !== before) domEvent.preventDefault();
            }
          }),
        },
        KEY_UP: {
          actions: assign({
            digitBuffer: ({ context, event }) => {
              if (event.type !== 'KEY_UP') return context.digitBuffer;
              const result = handleKeyUp(event.key, context.digitBuffer);
              if (result.sequenceNbr !== null) context.onLoadSong(result.sequenceNbr);
              return result.buffer;
            },
          }),
        },
      },
    },
  },
});

export function clampLyricsFontSizeIndex(index: number): number {
  return clampPage(index, LYRICS_FONT_SIZES_LENGTH);
}
