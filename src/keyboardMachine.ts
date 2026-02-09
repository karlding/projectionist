/**
 * XState machine for global keyboard handling: song number entry (Ctrl+digits),
 * page/verse navigation, chorus jump (0), lyrics font size (+/-), and lyrics scroll (arrows).
 */

import { setup, assign, enqueueActions } from 'xstate';
import { getPageNavigation, handleKeyDown, handleKeyUp } from './songNumberInput';
import { totalVersesFromChorus, stanzaIndexForVerse, nthChorusStanzaIndex, shouldEnterChorusOnlyOnZero } from './displayPages';
import { getChorusOnlyNavigation } from './chorusOnlyNavigation';

const LYRICS_FONT_SIZES_LENGTH = 6;

/**
 * Clamp the page number to be within the valid range [0, total - 1].
 * @param page - The current page index (may be out of bounds).
 * @param total - The total number of pages.
 * @returns The clamped page index.
 */
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
      firstStanzaIndexByPage: number[];
      chorusStartLineIndexByPage: number[];
      isChorus: boolean[];
      lyricsScrollEl: HTMLDivElement | null;
      onScrollToChorus?: () => void;
      chorusOnlyForVerse: number | null;
      currentVerse: number;
      totalVerses: number;
      onChorusOnlyChange?: (verseNum: number | null) => void;
      effectiveChorusOnlyTotalPages: number;
      effectiveChorusOnlyCurrentPage: number;
      onChorusOnlyPageNavigate?: (page: number) => void;
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
            const { key, ctrlKey, domEvent, totalPages, currentPage, stanzaIndexByPage, firstStanzaIndexByPage, chorusStartLineIndexByPage, isChorus, lyricsScrollEl, onScrollToChorus, chorusOnlyForVerse, currentVerse, totalVerses, onChorusOnlyChange, effectiveChorusOnlyTotalPages, effectiveChorusOnlyCurrentPage, onChorusOnlyPageNavigate } = event;
            const result = handleKeyDown(key, ctrlKey, context.digitBuffer);
            enqueue.assign({ digitBuffer: result.buffer });
            if (result.preventDefault) domEvent.preventDefault();

            // Arrow/PageUp/Down: in chorus-only view use getChorusOnlyNavigation; else normal navigation.
            const isDigit = /^[0-9]$/.test(key);
            if (!isDigit) {
              const chorusNav = getChorusOnlyNavigation(
                key,
                ctrlKey,
                chorusOnlyForVerse,
                effectiveChorusOnlyTotalPages,
                effectiveChorusOnlyCurrentPage,
                totalVerses,
                firstStanzaIndexByPage,
                isChorus
              );
              if (chorusNav) {
                domEvent.preventDefault();
                if (chorusNav.type === 'exit_to_verse') {
                  if (chorusNav.targetPage >= 0) {
                    onChorusOnlyChange?.(null);
                    context.onNavigate(chorusNav.targetPage);
                  }
                  // targetPage -1: no next/prev verse; stay in chorus view, key consumed
                } else {
                  onChorusOnlyPageNavigate?.(chorusNav.page);
                }
              } else {
                const nav = getPageNavigation(key, ctrlKey, totalPages, currentPage);
                if (nav) {
                  context.onNavigate(nav.page);
                  domEvent.preventDefault();
                }
              }
            } else if (key !== '0' && !ctrlKey && firstStanzaIndexByPage.length > 0 && isChorus.length > 0) {
              const verse = parseInt(key, 10);
              const totalVerses = totalVersesFromChorus(isChorus);
              if (verse >= 1 && verse <= totalVerses) {
                const stanzaIdx = stanzaIndexForVerse(verse, isChorus);
                if (stanzaIdx >= 0) {
                  const targetPage = firstStanzaIndexByPage.findIndex((s) => s === stanzaIdx);
                  if (targetPage >= 0) {
                    onChorusOnlyChange?.(null);
                    context.onNavigate(targetPage);
                    domEvent.preventDefault();
                  }
                }
              }
            }

            if (
              key === '0' &&
              !ctrlKey &&
              onChorusOnlyChange &&
              shouldEnterChorusOnlyOnZero(chorusOnlyForVerse, currentVerse, firstStanzaIndexByPage, isChorus)
            ) {
              onChorusOnlyChange(currentVerse);
              domEvent.preventDefault();
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
