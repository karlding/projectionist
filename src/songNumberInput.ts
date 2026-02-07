/**
 * Pure logic for Ctrl+digit song number entry.
 * Buffer is managed by the caller (e.g. a ref); these functions take current buffer
 * and return the next buffer and any side-effect (preventDefault or sequence number to load).
 */

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

/**
 * Handle keydown. Call with current buffer; returns updated buffer and whether to preventDefault.
 */
export function handleKeyDown(key: string, ctrlKey: boolean, buffer: string): KeyDownResult {
  if (key === 'Control') {
    return { buffer: '', preventDefault: false };
  }
  if (ctrlKey && DIGIT.test(key)) {
    return { buffer: buffer + key, preventDefault: true };
  }
  return { buffer, preventDefault: false };
}

/**
 * Handle keyup. Call with current buffer; returns updated buffer and sequence number to load (if any).
 */
export function handleKeyUp(key: string, buffer: string): KeyUpResult {
  if (key !== 'Control') {
    return { buffer, sequenceNbr: null };
  }
  if (buffer.length === 0) {
    return { buffer: '', sequenceNbr: null };
  }
  const n = parseInt(buffer, 10);
  return {
    buffer: '',
    sequenceNbr: Number.isNaN(n) ? null : n,
  };
}
