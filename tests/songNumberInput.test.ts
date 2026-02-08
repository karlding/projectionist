import { getPageNavigation, handleKeyDown, handleKeyUp } from '../src/songNumberInput';

describe('songNumberInput', () => {
  describe('handleKeyDown', () => {
    it('clears buffer when Control is pressed', () => {
      expect(handleKeyDown('Control', false, '294')).toEqual({
        buffer: '',
        preventDefault: false,
      });
    });

    it('appends digit to buffer when Ctrl is held and key is 0-9', () => {
      expect(handleKeyDown('2', true, '')).toEqual({
        buffer: '2',
        preventDefault: true,
      });
      expect(handleKeyDown('9', true, '2')).toEqual({
        buffer: '29',
        preventDefault: true,
      });
      expect(handleKeyDown('4', true, '29')).toEqual({
        buffer: '294',
        preventDefault: true,
      });
    });

    it('does not append when Ctrl is not held', () => {
      expect(handleKeyDown('2', false, '')).toEqual({
        buffer: '',
        preventDefault: false,
      });
    });

    it('does not append non-digit when Ctrl is held', () => {
      expect(handleKeyDown('a', true, '29')).toEqual({
        buffer: '29',
        preventDefault: false,
      });
    });

    it('does nothing for other keys without Ctrl', () => {
      expect(handleKeyDown('x', false, '12')).toEqual({
        buffer: '12',
        preventDefault: false,
      });
    });

    it('caps buffer at 8 digits to avoid precision loss and scientific notation in URLs', () => {
      const eightDigits = '12345678';
      expect(handleKeyDown('9', true, eightDigits)).toEqual({
        buffer: eightDigits,
        preventDefault: true,
      });
      expect(handleKeyDown('1', true, eightDigits)).toEqual({
        buffer: eightDigits,
        preventDefault: true,
      });
    });
  });

  describe('handleKeyUp', () => {
    it('returns sequence number when Control is released with non-empty buffer', () => {
      expect(handleKeyUp('Control', '294')).toEqual({
        buffer: '',
        sequenceNbr: 294,
      });
      expect(handleKeyUp('Control', '1')).toEqual({
        buffer: '',
        sequenceNbr: 1,
      });
    });

    it('returns null sequence number when Control released with empty buffer', () => {
      expect(handleKeyUp('Control', '')).toEqual({
        buffer: '',
        sequenceNbr: null,
      });
    });

    it('does nothing when a non-Control key is released', () => {
      expect(handleKeyUp('2', '29')).toEqual({
        buffer: '29',
        sequenceNbr: null,
      });
    });

    it('parses leading zeros as integer', () => {
      expect(handleKeyUp('Control', '0294')).toEqual({
        buffer: '',
        sequenceNbr: 294,
      });
    });

    it('returns correct integer for 8-digit buffer (no scientific notation)', () => {
      expect(handleKeyUp('Control', '12345678')).toEqual({
        buffer: '',
        sequenceNbr: 12345678,
      });
    });
  });

  describe('getPageNavigation', () => {
    const totalPages = 5;

    it('ArrowRight goes to next page', () => {
      expect(getPageNavigation('ArrowRight', false, totalPages, 0)).toEqual({
        page: 1,
        preventDefault: true,
      });
      expect(getPageNavigation('ArrowRight', false, totalPages, 4)).toEqual({
        page: 4,
        preventDefault: true,
      });
    });

    it('PageDown goes to next page', () => {
      expect(getPageNavigation('PageDown', false, totalPages, 2)).toEqual({
        page: 3,
        preventDefault: true,
      });
    });

    it('ArrowLeft goes to previous page', () => {
      expect(getPageNavigation('ArrowLeft', false, totalPages, 2)).toEqual({
        page: 1,
        preventDefault: true,
      });
      expect(getPageNavigation('ArrowLeft', false, totalPages, 0)).toEqual({
        page: 0,
        preventDefault: true,
      });
    });

    it('PageUp goes to previous page', () => {
      expect(getPageNavigation('PageUp', false, totalPages, 3)).toEqual({
        page: 2,
        preventDefault: true,
      });
    });

    it('returns null for digits (verse jump is handled in keyboard machine)', () => {
      expect(getPageNavigation('1', false, totalPages, 0)).toBeNull();
      expect(getPageNavigation('3', false, totalPages, 0)).toBeNull();
      expect(getPageNavigation('0', false, totalPages, 0)).toBeNull();
      expect(getPageNavigation('2', true, totalPages, 0)).toBeNull();
    });

    it('returns null for non-navigation keys', () => {
      expect(getPageNavigation('a', false, totalPages, 0)).toBeNull();
      expect(getPageNavigation('Enter', false, totalPages, 0)).toBeNull();
    });
  });

  describe('full flow: Ctrl + digits + release Ctrl', () => {
    it('accumulates digits then commits on Control release', () => {
      let buffer = '';
      // Press Control -> clear
      let result = handleKeyDown('Control', false, buffer);
      buffer = result.buffer;
      expect(buffer).toBe('');
      // Type 2, 9, 4 with Ctrl held
      result = handleKeyDown('2', true, buffer);
      buffer = result.buffer;
      result = handleKeyDown('9', true, buffer);
      buffer = result.buffer;
      result = handleKeyDown('4', true, buffer);
      buffer = result.buffer;
      expect(buffer).toBe('294');
      // Release Control -> commit
      const up = handleKeyUp('Control', buffer);
      expect(up.sequenceNbr).toBe(294);
      expect(up.buffer).toBe('');
    });

    it('stops accepting digits after 8, commit uses only those 8 (avoids huge number -> song 1 bug)', () => {
      let buffer = '';
      for (let i = 0; i < 10; i++) {
        const result = handleKeyDown('1', true, buffer);
        buffer = result.buffer;
      }
      expect(buffer).toBe('11111111');
      const up = handleKeyUp('Control', buffer);
      expect(up.sequenceNbr).toBe(11111111);
      expect(up.buffer).toBe('');
    });
  });
});
