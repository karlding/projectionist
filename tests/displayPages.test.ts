import {
  buildDisplayPages,
  clampPage,
  getLineDecoration,
  totalVersesFromChorus,
  currentVerseForPage,
  stanzaIndexForVerse,
  chorusStanzaIndexAfterVerse,
  nthChorusStanzaIndex,
  shouldEnterChorusOnlyOnZero,
  getEffectiveLyricsView,
  SENTENCES_PER_LANGUAGE,
  LINES_PER_PAGE_SINGLE_LANGUAGE,
} from "../src/displayPages";

describe("displayPages", () => {
  describe("clampPage", () => {
    it("returns 0 when total is 0", () => {
      expect(clampPage(0, 0)).toBe(0);
      expect(clampPage(5, 0)).toBe(0);
    });
    it("clamps to [0, total-1]", () => {
      expect(clampPage(-1, 10)).toBe(0);
      expect(clampPage(0, 10)).toBe(0);
      expect(clampPage(9, 10)).toBe(9);
      expect(clampPage(10, 10)).toBe(9);
      expect(clampPage(100, 10)).toBe(9);
    });
  });

  describe("buildDisplayPages", () => {
    it("returns one empty page when no stanzas", () => {
      const { pages, stanzaIndexByPage } = buildDisplayPages([], 1);
      expect(pages).toEqual([[]]);
      expect(stanzaIndexByPage).toEqual([0]);
    });
    it("chunks single-language stanza by LINES_PER_PAGE_SINGLE_LANGUAGE", () => {
      const stanza = Array.from({ length: 10 }, (_, i) => `line${i}`);
      const { pages, stanzaIndexByPage } = buildDisplayPages([stanza], 1);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(LINES_PER_PAGE_SINGLE_LANGUAGE);
      expect(pages[1].length).toBe(2);
      expect(stanzaIndexByPage).toEqual([0, 0]);
    });
    it("chunks two-language by SENTENCES_PER_LANGUAGE * 2 rows per page", () => {
      const stanza = Array.from({ length: 16 }, (_, i) => `line${i}`);
      const { pages, stanzaIndexByPage } = buildDisplayPages([stanza], 2);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(SENTENCES_PER_LANGUAGE * 2);
      expect(pages[1].length).toBe(SENTENCES_PER_LANGUAGE * 2);
      expect(stanzaIndexByPage).toEqual([0, 0]);
    });
    it("appends chorus to current page when it fits (single language)", () => {
      // Verse: 5 lines leaves 3 on 8-line page; chorus 3 lines fits
      const verse = Array.from({ length: 5 }, (_, i) => `v${i}`);
      const chorus = Array.from({ length: 3 }, (_, i) => `c${i}`);
      const {
        pages,
        stanzaIndexByPage,
        firstStanzaIndexByPage,
        chorusStartLineIndexByPage,
      } = buildDisplayPages([verse, chorus], 1, [false, true]);
      expect(pages.length).toBe(1);
      expect(pages[0].length).toBe(8);
      expect(pages[0].slice(0, 5)).toEqual(verse);
      expect(pages[0].slice(5, 8)).toEqual(chorus);
      expect(stanzaIndexByPage).toEqual([1]); // page shows chorus at end
      expect(firstStanzaIndexByPage).toEqual([0]); // page starts with verse (for verse jump)
      expect(chorusStartLineIndexByPage).toEqual([5]); // chorus starts at line 5 (after verse)
    });
    it("does not merge when isChorus is not provided (treats all as verse)", () => {
      const verse = Array.from({ length: 5 }, (_, i) => `v${i}`);
      const next = Array.from({ length: 3 }, (_, i) => `n${i}`);
      const { pages, firstStanzaIndexByPage, chorusStartLineIndexByPage } =
        buildDisplayPages([verse, next], 1);
      expect(pages.length).toBe(2);
      expect(pages[0]).toEqual(verse);
      expect(pages[1]).toEqual(next);
      expect(firstStanzaIndexByPage).toEqual([0, 1]);
      expect(chorusStartLineIndexByPage).toEqual([-1, -1]);
    });

    it("appends as many chorus lines as fit then continues on next page", () => {
      // Verse 6 lines → page 1 has 2 free; chorus 5 lines: 2 on page 1, 3 on page 2
      const verse = Array.from({ length: 6 }, (_, i) => `v${i}`);
      const chorus = Array.from({ length: 5 }, (_, i) => `c${i}`);
      const {
        pages,
        stanzaIndexByPage,
        firstStanzaIndexByPage,
        chorusStartLineIndexByPage,
      } = buildDisplayPages([verse, chorus], 1, [false, true]);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(8);
      expect(pages[0].slice(0, 6)).toEqual(verse);
      expect(pages[0].slice(6, 8)).toEqual(chorus.slice(0, 2));
      expect(pages[1].length).toBe(3);
      expect(pages[1]).toEqual(chorus.slice(2, 5));
      expect(stanzaIndexByPage).toEqual([1, 1]);
      expect(firstStanzaIndexByPage).toEqual([0, 1]);
      expect(chorusStartLineIndexByPage).toEqual([6, -1]);
    });
  });

  describe("getLineDecoration", () => {
    it("returns showEndOfSong on last line of last page", () => {
      const stanzaIndexByPage = [0, 0];
      const isChorus = [false];
      const dec = getLineDecoration(1, 2, stanzaIndexByPage, isChorus, 1, 2, 3);
      expect(dec.showEndOfSong).toBe(true);
    });
    it("returns showYellowLine on last line of verse when next stanza is chorus", () => {
      const stanzaIndexByPage = [0, 1];
      const isChorus = [false, true];
      const dec = getLineDecoration(0, 2, stanzaIndexByPage, isChorus, 1, 3, 4);
      expect(dec.showYellowLine).toBe(true);
    });
    it("returns showYellowLine at verse/chorus boundary on merged page (chorusStartLineIndex)", () => {
      const stanzaIndexByPage = [1]; // page ends with chorus
      const isChorus = [false, true];
      const decAfterVerse = getLineDecoration(
        0,
        1,
        stanzaIndexByPage,
        isChorus,
        1,
        4,
        8,
        5,
      );
      expect(decAfterVerse.showYellowLine).toBe(true); // line index 4 is last verse line
      const decChorusLine = getLineDecoration(
        0,
        1,
        stanzaIndexByPage,
        isChorus,
        1,
        5,
        8,
        5,
      );
      expect(decChorusLine.showYellowLine).toBe(false);
    });
    it("does not show yellow at end of verse page when next page has merged verse+chorus", () => {
      // Page 0: verse only (8 lines). Page 1: 4 verse + 4 chorus (merged). Yellow only on page 1 at boundary.
      const stanzaIndexByPage = [0, 1];
      const isChorus = [false, true];
      const decEndOfPage0 = getLineDecoration(
        0,
        2,
        stanzaIndexByPage,
        isChorus,
        1,
        7,
        8,
        -1,
        false,
        4 /* next page has chorus at line 4 */,
      );
      expect(decEndOfPage0.showYellowLine).toBe(false);
      const decBoundaryPage1 = getLineDecoration(
        1,
        2,
        stanzaIndexByPage,
        isChorus,
        1,
        3,
        8,
        4,
      );
      expect(decBoundaryPage1.showYellowLine).toBe(true);
    });
    it("returns showEndOfSong on last line of merged page when it is the last page", () => {
      const stanzaIndexByPage = [1];
      const isChorus = [false, true];
      const decLastLine = getLineDecoration(
        0,
        1,
        stanzaIndexByPage,
        isChorus,
        1,
        7,
        8,
        5,
      );
      expect(decLastLine.showEndOfSong).toBe(true);
    });
    it("returns showEndOfSong false when suppressEndOfSong is true (e.g. chorus-only view)", () => {
      const stanzaIndexByPage = [0];
      const isChorus = [false];
      const dec = getLineDecoration(
        0,
        1,
        stanzaIndexByPage,
        isChorus,
        1,
        0,
        1,
        -1,
        true,
      );
      expect(dec.showEndOfSong).toBe(false);
    });
  });

  describe("totalVersesFromChorus", () => {
    it("counts non-chorus stanzas", () => {
      expect(totalVersesFromChorus([])).toBe(1);
      expect(totalVersesFromChorus([false])).toBe(1);
      expect(totalVersesFromChorus([false, true, false])).toBe(2);
    });
  });

  describe("currentVerseForPage", () => {
    it("returns 1 when no pages or page out of range", () => {
      expect(currentVerseForPage(0, [], [])).toBe(1);
      expect(currentVerseForPage(5, [0, 0, 0], [false, false, false])).toBe(1);
    });
    it("returns verse number for page (chorus does not increment verse)", () => {
      const stanzaIndexByPage = [0, 0, 1, 2];
      const isChorus = [false, true, false];
      expect(currentVerseForPage(0, stanzaIndexByPage, isChorus)).toBe(1);
      expect(currentVerseForPage(2, stanzaIndexByPage, isChorus)).toBe(1);
      expect(currentVerseForPage(3, stanzaIndexByPage, isChorus)).toBe(2);
    });
  });

  describe("chorusStanzaIndexAfterVerse", () => {
    it("returns chorus stanza index that follows the given verse", () => {
      const isChorus = [false, true, false, true, false];
      expect(chorusStanzaIndexAfterVerse(1, isChorus)).toBe(1);
      expect(chorusStanzaIndexAfterVerse(2, isChorus)).toBe(3);
    });
    it("returns -1 when verse has no following chorus", () => {
      const isChorus = [false, true, false];
      expect(chorusStanzaIndexAfterVerse(3, isChorus)).toBe(-1);
    });
    it("returns -1 for verse number < 1", () => {
      const isChorus = [false, true];
      expect(chorusStanzaIndexAfterVerse(0, isChorus)).toBe(-1);
      expect(chorusStanzaIndexAfterVerse(-1, isChorus)).toBe(-1);
    });
  });

  describe("nthChorusStanzaIndex", () => {
    it("returns 1st chorus for verse 1, 2nd for verse 2", () => {
      const isChorus = [false, true, false, true, false];
      expect(nthChorusStanzaIndex(1, isChorus)).toBe(1);
      expect(nthChorusStanzaIndex(2, isChorus)).toBe(3);
    });
    it("returns the only chorus when verse number exceeds chorus count", () => {
      const isChorus = [false, true, false];
      expect(nthChorusStanzaIndex(1, isChorus)).toBe(1);
      expect(nthChorusStanzaIndex(3, isChorus)).toBe(1);
    });
    it("returns -1 when no choruses or verse < 1", () => {
      expect(nthChorusStanzaIndex(1, [false, false])).toBe(-1);
      expect(nthChorusStanzaIndex(0, [false, true])).toBe(-1);
    });
  });

  describe("stanzaIndexForVerse", () => {
    it("returns stanza index for N-th verse (1-based), skipping chorus", () => {
      const isChorus = [false, true, false, true, false]; // V, C, V, C, V
      expect(stanzaIndexForVerse(1, isChorus)).toBe(0);
      expect(stanzaIndexForVerse(2, isChorus)).toBe(2);
      expect(stanzaIndexForVerse(3, isChorus)).toBe(4);
    });
    it("returns -1 when verse number out of range", () => {
      const isChorus = [false, true, false];
      expect(stanzaIndexForVerse(0, isChorus)).toBe(-1);
      expect(stanzaIndexForVerse(3, isChorus)).toBe(-1);
    });
  });

  describe("shouldEnterChorusOnlyOnZero", () => {
    const isChorus = [false, true, false]; // verse 1, chorus, verse 2
    const firstStanzaIndexByPage = [0, 1, 2]; // page 0 = verse 1, page 1 = chorus, page 2 = verse 2

    it("returns true when not in chorus-only view and current verse has a chorus (verse or chorus page)", () => {
      expect(
        shouldEnterChorusOnlyOnZero(null, 1, firstStanzaIndexByPage, isChorus),
      ).toBe(true);
    });

    it("returns false when already in chorus-only view", () => {
      expect(
        shouldEnterChorusOnlyOnZero(1, 1, firstStanzaIndexByPage, isChorus),
      ).toBe(false);
    });

    it("returns false when current verse has no chorus", () => {
      const isChorusNoChorus = [false, false, false];
      expect(
        shouldEnterChorusOnlyOnZero(
          null,
          1,
          firstStanzaIndexByPage,
          isChorusNoChorus,
        ),
      ).toBe(false);
    });

    it("returns false when currentVerse is 0", () => {
      expect(
        shouldEnterChorusOnlyOnZero(null, 0, firstStanzaIndexByPage, isChorus),
      ).toBe(false);
    });

    it("returns false when firstStanzaIndexByPage is empty", () => {
      expect(shouldEnterChorusOnlyOnZero(null, 1, [], isChorus)).toBe(false);
    });
  });

  describe("getEffectiveLyricsView", () => {
    const displayPages = [["v1a", "v1b"], ["c1a", "c1b"], ["v2a"]];
    const stanzaIndexByPage = [0, 1, 2];
    const chorusStartLineIndexByPage = [-1, -1, -1];
    const stanzas = [["v1a", "v1b"], ["c1a", "c1b"], ["v2a"]];
    const isChorus = [false, true, false];

    it("returns normal page content when chorusOnlyForVerse is null", () => {
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: null,
        currentPage: 0,
        currentVerse: 1,
        displayPages,
        stanzaIndexByPage,
        chorusStartLineIndexByPage,
        stanzas,
        isChorus,
        languageCount: 1,
      });
      expect(view.lines).toEqual(["v1a", "v1b"]);
      expect(view.effectiveCurrentPage).toBe(0);
      expect(view.effectiveTotalPages).toBe(3);
      expect(view.effectiveStanzaIndexByPage).toEqual(stanzaIndexByPage);
      expect(view.effectiveChorusStartLineIndexByPage).toEqual(
        chorusStartLineIndexByPage,
      );
      expect(view.isChorusOnlyView).toBe(false);
      expect(view.displayVerseForIndicator).toBe(1);
      expect(view.isChorusForIndicator).toBe(false);
    });

    it("returns chorus-only content when chorusOnlyForVerse is set", () => {
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: 1,
        currentPage: 0,
        currentVerse: 1,
        displayPages,
        stanzaIndexByPage,
        chorusStartLineIndexByPage,
        stanzas,
        isChorus,
        languageCount: 1,
      });
      expect(view.lines).toEqual(["c1a", "c1b"]);
      expect(view.effectiveCurrentPage).toBe(0);
      expect(view.effectiveTotalPages).toBe(1);
      expect(view.effectiveStanzaIndexByPage).toEqual([1]);
      expect(view.effectiveChorusStartLineIndexByPage).toEqual([-1]);
      expect(view.isChorusOnlyView).toBe(true);
      expect(view.displayVerseForIndicator).toBe(1);
      expect(view.isChorusForIndicator).toBe(true);
    });

    it("returns chorus for verse 2 when chorusOnlyForVerse is 2", () => {
      const isChorusV2 = [false, true, false, true];
      const stanzasV2 = [["v1"], ["c1"], ["v2"], ["c2"]];
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: 2,
        currentPage: 2,
        currentVerse: 2,
        displayPages: [["v1"], ["c1"], ["v2"], ["c2"]],
        stanzaIndexByPage: [0, 1, 2, 3],
        chorusStartLineIndexByPage: [-1, -1, -1, -1],
        stanzas: stanzasV2,
        isChorus: isChorusV2,
        languageCount: 1,
      });
      expect(view.lines).toEqual(["c2"]);
      expect(view.isChorusOnlyView).toBe(true);
      expect(view.displayVerseForIndicator).toBe(2);
    });
    it("limits chorus-only view to linesPerPage (8 for 2 languages)", () => {
      const chorus12 = Array.from({ length: 12 }, (_, i) => `c${i}`);
      const stanzasLongChorus = [["v1"], chorus12];
      const isChorusLong = [false, true];
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: 1,
        currentPage: 0,
        currentVerse: 1,
        displayPages: [["v1"], chorus12],
        stanzaIndexByPage: [0, 1],
        chorusStartLineIndexByPage: [-1, -1],
        stanzas: stanzasLongChorus,
        isChorus: isChorusLong,
        languageCount: 2,
      });
      expect(view.isChorusOnlyView).toBe(true);
      expect(view.lines).toHaveLength(8);
      expect(view.lines).toEqual(chorus12.slice(0, 8));
      expect(view.effectiveTotalPages).toBe(2);
      expect(view.effectiveCurrentPage).toBe(0);
    });

    it("chorus-only view page 1 returns second page of lines", () => {
      const chorus12 = Array.from({ length: 12 }, (_, i) => `c${i}`);
      const stanzasLongChorus = [["v1"], chorus12];
      const isChorusLong = [false, true];
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: 1,
        chorusOnlyPage: 1,
        currentPage: 0,
        currentVerse: 1,
        displayPages: [["v1"], chorus12],
        stanzaIndexByPage: [0, 1],
        chorusStartLineIndexByPage: [-1, -1],
        stanzas: stanzasLongChorus,
        isChorus: isChorusLong,
        languageCount: 2,
      });
      expect(view.isChorusOnlyView).toBe(true);
      expect(view.effectiveTotalPages).toBe(2);
      expect(view.effectiveCurrentPage).toBe(1);
      expect(view.lines).toHaveLength(4);
      expect(view.lines).toEqual(chorus12.slice(8, 12));
    });

    it("returns normal view when chorusOnlyForVerse is set but song has no choruses", () => {
      const isChorusNone = [false, false, false];
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: 1,
        currentPage: 0,
        currentVerse: 1,
        displayPages,
        stanzaIndexByPage,
        chorusStartLineIndexByPage,
        stanzas,
        isChorus: isChorusNone,
        languageCount: 1,
      });
      expect(view.lines).toEqual(["v1a", "v1b"]);
      expect(view.isChorusOnlyView).toBe(false);
    });

    it("returns empty lines when currentPage out of range and not chorus-only", () => {
      const view = getEffectiveLyricsView({
        chorusOnlyForVerse: null,
        currentPage: 10,
        currentVerse: 1,
        displayPages,
        stanzaIndexByPage,
        chorusStartLineIndexByPage,
        stanzas,
        isChorus,
        languageCount: 1,
      });
      expect(view.lines).toEqual([]);
      expect(view.effectiveCurrentPage).toBe(10);
    });
  });
});
