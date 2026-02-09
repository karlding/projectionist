/**
 * Pure logic for keyboard navigation when in chorus-only view.
 * Returns the action to take (exit to verse, navigate chorus page, or none).
 */

import { getPageNavigation } from "./songNumberInput";
import { stanzaIndexForVerse } from "./displayPages";

export type ChorusOnlyNavigationResult =
  | { type: "exit_to_verse"; targetPage: number }
  | { type: "chorus_page"; page: number }
  | null;

/**
 * Determine navigation action for Arrow/Page keys when in chorus-only view.
 * Returns null if the key should be handled as normal (non–chorus-only) navigation.
 */
export function getChorusOnlyNavigation(
  key: string,
  ctrlKey: boolean,
  chorusOnlyForVerse: number | null,
  effectiveChorusOnlyTotalPages: number,
  effectiveChorusOnlyCurrentPage: number,
  totalVerses: number,
  firstStanzaIndexByPage: number[],
  isChorus: boolean[],
): ChorusOnlyNavigationResult {
  if (chorusOnlyForVerse == null || effectiveChorusOnlyTotalPages <= 0) {
    return null;
  }

  const atLastChorusPage =
    effectiveChorusOnlyCurrentPage === effectiveChorusOnlyTotalPages - 1;
  const atFirstChorusPage = effectiveChorusOnlyCurrentPage === 0;

  // Arrow Right on last page (or single page) → exit to next verse
  if (
    key === "ArrowRight" &&
    (effectiveChorusOnlyTotalPages <= 1 || atLastChorusPage)
  ) {
    const nextVerse = chorusOnlyForVerse + 1;
    const targetPage =
      nextVerse >= 1 &&
      nextVerse <= totalVerses &&
      firstStanzaIndexByPage.length > 0
        ? firstStanzaIndexByPage.findIndex(
            (s) => s === stanzaIndexForVerse(nextVerse, isChorus),
          )
        : -1;
    return {
      type: "exit_to_verse",
      targetPage: targetPage >= 0 ? targetPage : -1,
    };
  }

  // Arrow Left on first page (or single page) → exit to previous verse
  if (
    key === "ArrowLeft" &&
    (effectiveChorusOnlyTotalPages <= 1 || atFirstChorusPage)
  ) {
    const prevVerse = chorusOnlyForVerse - 1;
    const targetPage =
      prevVerse >= 1 &&
      prevVerse <= totalVerses &&
      firstStanzaIndexByPage.length > 0
        ? firstStanzaIndexByPage.findIndex(
            (s) => s === stanzaIndexForVerse(prevVerse, isChorus),
          )
        : -1;
    return {
      type: "exit_to_verse",
      targetPage: targetPage >= 0 ? targetPage : -1,
    };
  }

  // Multiple chorus pages: navigate within chorus (Page Down/Up or Arrow with room)
  if (
    effectiveChorusOnlyTotalPages > 1 &&
    (key === "PageDown" ||
      key === "PageUp" ||
      (key === "ArrowRight" && !atLastChorusPage) ||
      (key === "ArrowLeft" && !atFirstChorusPage))
  ) {
    const nav = getPageNavigation(
      key,
      ctrlKey,
      effectiveChorusOnlyTotalPages,
      effectiveChorusOnlyCurrentPage,
    );
    if (nav) return { type: "chorus_page", page: nav.page };
  }

  return null;
}
