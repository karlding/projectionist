/**
 * Pure logic for Ctrl+digit song number entry and page/verse navigation.
 * Buffer is managed by the caller (e.g. a ref); these functions take current state
 * and return the next state and any side-effect (preventDefault or sequence number to load).
 */

export interface PageNavigationResult {
  /** The page index to navigate to (0-based) */
  page: number;
  /** Whether the caller should call preventDefault() */
  preventDefault: boolean;
}

export interface KeyDownResult {
  /** New buffer value after this keydown */
  buffer: string;
  /** Whether the caller should call preventDefault() */
  preventDefault: boolean;
}

export interface KeyUpResult {
  /** New buffer value after this keyup (always '' when key is Control and we commit) */
  buffer: string;
  /** When key is Control and buffer was non-empty, the parsed song sequence number; otherwise null */
  sequenceNbr: number | null;
}

const DIGIT = /^[0-9]$/;

/** Max digits for Ctrl+number song entry; avoids precision loss and scientific notation in URLs. */
const MAX_BUFFER_DIGITS = 8;

/**
 * Handle keydown. Call with current buffer; returns updated buffer and whether to preventDefault.
 */
export function handleKeyDown(
  key: string,
  ctrlKey: boolean,
  buffer: string,
): KeyDownResult {
  if (key === "Control") {
    return { buffer: "", preventDefault: false };
  }
  if (ctrlKey && DIGIT.test(key)) {
    const nextBuffer =
      buffer.length < MAX_BUFFER_DIGITS ? buffer + key : buffer;
    return { buffer: nextBuffer, preventDefault: true };
  }
  return { buffer, preventDefault: false };
}

/**
 * Handle keyup. Call with current buffer; returns updated buffer and sequence number to load (if any).
 */
export function handleKeyUp(key: string, buffer: string): KeyUpResult {
  if (key !== "Control") {
    return { buffer, sequenceNbr: null };
  }
  if (buffer.length === 0) {
    return { buffer: "", sequenceNbr: null };
  }
  const n = parseInt(buffer, 10);
  return {
    buffer: "",
    sequenceNbr: Number.isNaN(n) ? null : n,
  };
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.max(0, Math.min(page, totalPages - 1));
}

/**
 * Determine page navigation from a keydown (arrows, PageUp/Down, or digit for verse jump).
 * Returns null if the key does not trigger navigation.
 */
export function getPageNavigation(
  key: string,
  ctrlKey: boolean,
  totalPages: number,
  currentPage: number,
): PageNavigationResult | null {
  if (key === "ArrowRight" || key === "PageDown") {
    return {
      page: clampPage(currentPage + 1, totalPages),
      preventDefault: true,
    };
  }
  if (key === "ArrowLeft" || key === "PageUp") {
    return {
      page: clampPage(currentPage - 1, totalPages),
      preventDefault: true,
    };
  }
  // Digit-based verse jump is handled in the keyboard machine using stanzaIndexByPage.
  return null;
}
