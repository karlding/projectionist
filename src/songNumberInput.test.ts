import { handleKeyDown, handleKeyUp } from './songNumberInput';

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
  });
});
