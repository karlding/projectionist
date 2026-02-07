import {
  buildDisplayPages,
  clampPage,
  getLineDecoration,
  totalVersesFromChorus,
  currentVerseForPage,
  stanzaIndexForVerse,
  SENTENCES_PER_LANGUAGE,
  LINES_PER_PAGE_SINGLE_LANGUAGE,
} from '../src/displayPages';

describe('displayPages', () => {
  describe('clampPage', () => {
    it('returns 0 when total is 0', () => {
      expect(clampPage(0, 0)).toBe(0);
      expect(clampPage(5, 0)).toBe(0);
    });
    it('clamps to [0, total-1]', () => {
      expect(clampPage(-1, 10)).toBe(0);
      expect(clampPage(0, 10)).toBe(0);
      expect(clampPage(9, 10)).toBe(9);
      expect(clampPage(10, 10)).toBe(9);
      expect(clampPage(100, 10)).toBe(9);
    });
  });

  describe('buildDisplayPages', () => {
    it('returns one empty page when no stanzas', () => {
      const { pages, stanzaIndexByPage } = buildDisplayPages([], 1);
      expect(pages).toEqual([[]]);
      expect(stanzaIndexByPage).toEqual([0]);
    });
    it('chunks single-language stanza by LINES_PER_PAGE_SINGLE_LANGUAGE', () => {
      const stanza = Array.from({ length: 10 }, (_, i) => `line${i}`);
      const { pages, stanzaIndexByPage } = buildDisplayPages([stanza], 1);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(LINES_PER_PAGE_SINGLE_LANGUAGE);
      expect(pages[1].length).toBe(2);
      expect(stanzaIndexByPage).toEqual([0, 0]);
    });
    it('chunks two-language by SENTENCES_PER_LANGUAGE * 2 rows per page', () => {
      const stanza = Array.from({ length: 16 }, (_, i) => `line${i}`);
      const { pages, stanzaIndexByPage } = buildDisplayPages([stanza], 2);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(SENTENCES_PER_LANGUAGE * 2);
      expect(pages[1].length).toBe(SENTENCES_PER_LANGUAGE * 2);
      expect(stanzaIndexByPage).toEqual([0, 0]);
    });
  });

  describe('getLineDecoration', () => {
    it('returns showEndOfSong on last line of last page', () => {
      const stanzaIndexByPage = [0, 0];
      const isChorus = [false];
      const dec = getLineDecoration(
        1, 2, stanzaIndexByPage, isChorus, 1, 2, 3
      );
      expect(dec.showEndOfSong).toBe(true);
    });
    it('returns showYellowLine on last line of verse when next stanza is chorus', () => {
      const stanzaIndexByPage = [0, 1];
      const isChorus = [false, true];
      const dec = getLineDecoration(
        0, 2, stanzaIndexByPage, isChorus, 1, 3, 4
      );
      expect(dec.showYellowLine).toBe(true);
    });
  });

  describe('totalVersesFromChorus', () => {
    it('counts non-chorus stanzas', () => {
      expect(totalVersesFromChorus([])).toBe(1);
      expect(totalVersesFromChorus([false])).toBe(1);
      expect(totalVersesFromChorus([false, true, false])).toBe(2);
    });
  });

  describe('currentVerseForPage', () => {
    it('returns 1 when no pages or page out of range', () => {
      expect(currentVerseForPage(0, [], [])).toBe(1);
      expect(currentVerseForPage(5, [0, 0, 0], [false, false, false])).toBe(1);
    });
    it('returns verse number for page (chorus does not increment verse)', () => {
      const stanzaIndexByPage = [0, 0, 1, 2];
      const isChorus = [false, true, false];
      expect(currentVerseForPage(0, stanzaIndexByPage, isChorus)).toBe(1);
      expect(currentVerseForPage(2, stanzaIndexByPage, isChorus)).toBe(1);
      expect(currentVerseForPage(3, stanzaIndexByPage, isChorus)).toBe(2);
    });
  });

  describe('stanzaIndexForVerse', () => {
    it('returns stanza index for N-th verse (1-based), skipping chorus', () => {
      const isChorus = [false, true, false, true, false]; // V, C, V, C, V
      expect(stanzaIndexForVerse(1, isChorus)).toBe(0);
      expect(stanzaIndexForVerse(2, isChorus)).toBe(2);
      expect(stanzaIndexForVerse(3, isChorus)).toBe(4);
    });
    it('returns -1 when verse number out of range', () => {
      const isChorus = [false, true, false];
      expect(stanzaIndexForVerse(0, isChorus)).toBe(-1);
      expect(stanzaIndexForVerse(3, isChorus)).toBe(-1);
    });
  });
});
