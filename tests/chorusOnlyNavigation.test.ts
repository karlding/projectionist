import { getChorusOnlyNavigation } from '../src/chorusOnlyNavigation';

/**
 * Song layout: verse 1 (stanza 0), chorus (stanza 1), verse 2 (stanza 2).
 * firstStanzaIndexByPage: page 0 = verse 1, page 1 = chorus, page 2 = verse 2.
 */
const isChorusV1CV2 = [false, true, false];
const firstStanzaIndexByPageV1CV2 = [0, 1, 2];
const totalVerses2 = 2;

/**
 * Three verses: V1 (0), C (1), V2 (2), C (3), V3 (4). Pages start at each stanza.
 */
const isChorusV1CV2CV3 = [false, true, false, true, false];
const firstStanzaIndexByPageV1CV2CV3 = [0, 1, 2, 3, 4];
const totalVerses3 = 3;

describe('getChorusOnlyNavigation', () => {
  it('returns null when not in chorus-only view', () => {
    expect(
      getChorusOnlyNavigation(
        'ArrowRight',
        false,
        null,
        1,
        0,
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      )
    ).toBeNull();
  });

  it('returns null when effectiveChorusOnlyTotalPages is 0', () => {
    expect(
      getChorusOnlyNavigation(
        'ArrowRight',
        false,
        1,
        0,
        0,
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      )
    ).toBeNull();
  });

  describe('single-page chorus', () => {
    it('ArrowRight exits to next verse (verse 2)', () => {
      const result = getChorusOnlyNavigation(
        'ArrowRight',
        false,
        1, // viewing chorus for verse 1
        1, // one chorus page
        0,
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'exit_to_verse', targetPage: 2 });
    });

    it('ArrowLeft exits to previous verse; targetPage -1 when already on verse 1', () => {
      const result = getChorusOnlyNavigation(
        'ArrowLeft',
        false,
        1, // chorus for verse 1; "previous" would be verse 0 (none)
        1,
        0,
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'exit_to_verse', targetPage: -1 });
    });
  });

  describe('multi-page chorus (2 pages)', () => {
    const chorusTotalPages = 2;

    it('ArrowRight on first chorus page goes to second chorus page', () => {
      const result = getChorusOnlyNavigation(
        'ArrowRight',
        false,
        1,
        chorusTotalPages,
        0, // first chorus page
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'chorus_page', page: 1 });
    });

    it('ArrowRight on last chorus page exits to next verse (verse 2)', () => {
      const result = getChorusOnlyNavigation(
        'ArrowRight',
        false,
        1,
        chorusTotalPages,
        1, // last chorus page
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'exit_to_verse', targetPage: 2 });
    });

    it('ArrowLeft on first chorus page exits to previous verse (targetPage -1 when verse 1)', () => {
      const result = getChorusOnlyNavigation(
        'ArrowLeft',
        false,
        1,
        chorusTotalPages,
        0, // first chorus page
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'exit_to_verse', targetPage: -1 });
    });

    it('ArrowLeft from verse 2 chorus exits to verse 1 (page 0) when 3 verses', () => {
      const result = getChorusOnlyNavigation(
        'ArrowLeft',
        false,
        2, // chorus for verse 2; previous verse = 1
        chorusTotalPages,
        0, // first chorus page
        totalVerses3,
        firstStanzaIndexByPageV1CV2CV3,
        isChorusV1CV2CV3
      );
      expect(result).toEqual({ type: 'exit_to_verse', targetPage: 0 });
    });

    it('ArrowLeft on last chorus page goes to first chorus page', () => {
      const result = getChorusOnlyNavigation(
        'ArrowLeft',
        false,
        1,
        chorusTotalPages,
        1, // last chorus page
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'chorus_page', page: 0 });
    });

    it('PageDown on first chorus page goes to second chorus page', () => {
      const result = getChorusOnlyNavigation(
        'PageDown',
        false,
        1,
        chorusTotalPages,
        0,
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'chorus_page', page: 1 });
    });

    it('PageUp on last chorus page goes to first chorus page', () => {
      const result = getChorusOnlyNavigation(
        'PageUp',
        false,
        1,
        chorusTotalPages,
        1,
        totalVerses2,
        firstStanzaIndexByPageV1CV2,
        isChorusV1CV2
      );
      expect(result).toEqual({ type: 'chorus_page', page: 0 });
    });
  });

  it('returns exit_to_verse with targetPage -1 when next verse is out of range', () => {
    const result = getChorusOnlyNavigation(
      'ArrowRight',
      false,
      2, // viewing chorus for verse 2 (last verse)
      1,
      0,
      2, // only 2 verses
      firstStanzaIndexByPageV1CV2,
      isChorusV1CV2
    );
    expect(result).toEqual({ type: 'exit_to_verse', targetPage: -1 });
  });

  it('on last page of last verse’s chorus, ArrowRight returns targetPage -1 so UI stays in chorus view', () => {
    const result = getChorusOnlyNavigation(
      'ArrowRight',
      false,
      2, // chorus for last verse
      2, // 2 chorus pages; user is on last chorus page
      1, // last chorus page
      2, // only 2 verses total
      firstStanzaIndexByPageV1CV2,
      isChorusV1CV2
    );
    expect(result).toEqual({ type: 'exit_to_verse', targetPage: -1 });
  });
});
