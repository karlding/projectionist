import { createActor } from "xstate";
import {
  keyboardMachine,
  clampLyricsFontSizeIndex,
} from "../src/keyboardMachine";

function createMockDomEvent(): { preventDefault: jest.Mock; key: string } {
  return {
    preventDefault: jest.fn(),
    key: "",
  };
}

interface TestActor {
  send: (event: unknown) => void;
  getSnapshot: () => { value: string; context: { digitBuffer: string } };
}

function createTestActor() {
  const onNavigate = jest.fn();
  const onFontSizeDelta = jest.fn();
  const onLoadSong = jest.fn();
  const actor = createActor(keyboardMachine, {
    input: {
      onNavigate,
      onFontSizeDelta,
      onLoadSong,
    },
  });
  actor.start();
  return {
    actor: actor as unknown as TestActor,
    onNavigate,
    onFontSizeDelta,
    onLoadSong,
  };
}

const defaultKeyDownPayload = {
  totalPages: 10,
  currentPage: 0,
  stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
  firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
  chorusStartLineIndexByPage: [-1, -1, -1, -1, -1, -1],
  isChorus: [false, true, false, true, false, true],
  lyricsScrollEl: null as HTMLDivElement | null,
  chorusOnlyForVerse: null as number | null,
  currentVerse: 1,
  totalVerses: 3,
  onChorusOnlyChange: undefined as
    | ((verseNum: number | null) => void)
    | undefined,
  effectiveChorusOnlyTotalPages: 0,
  effectiveChorusOnlyCurrentPage: 0,
};

function keyDown(
  actor: TestActor,
  key: string,
  ctrlKey: boolean,
  domEvent = createMockDomEvent(),
  payload: Partial<typeof defaultKeyDownPayload> = {},
): ReturnType<typeof createMockDomEvent> {
  actor.send({
    type: "KEY_DOWN",
    key,
    ctrlKey,
    domEvent: domEvent as unknown as KeyboardEvent,
    ...defaultKeyDownPayload,
    ...payload,
  });
  return domEvent;
}

describe("keyboardMachine", () => {
  describe("initial state", () => {
    it("starts in listening state with empty digit buffer", () => {
      const { actor } = createTestActor();
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("listening");
      expect(snapshot.context.digitBuffer).toBe("");
    });
  });

  describe("KEY_DOWN — digit buffer (Ctrl+digits)", () => {
    it("appends digits to buffer when Ctrl is held", () => {
      const { actor } = createTestActor();
      const domEvent = keyDown(actor, "2", true);
      expect(actor.getSnapshot().context.digitBuffer).toBe("2");
      expect(domEvent.preventDefault).toHaveBeenCalled();

      keyDown(actor, "9", true);
      expect(actor.getSnapshot().context.digitBuffer).toBe("29");

      keyDown(actor, "4", true);
      expect(actor.getSnapshot().context.digitBuffer).toBe("294");
    });

    it("calls preventDefault when Ctrl+digit is pressed", () => {
      const { actor } = createTestActor();
      const domEvent = keyDown(actor, "5", true);
      expect(domEvent.preventDefault).toHaveBeenCalled();
    });

    it("does not append when Ctrl is not held", () => {
      const { actor } = createTestActor();
      keyDown(actor, "3", false);
      expect(actor.getSnapshot().context.digitBuffer).toBe("");
    });
  });

  describe("KEY_UP — commit song number", () => {
    it("calls onLoadSong when Control is released with non-empty buffer", () => {
      const { actor, onLoadSong } = createTestActor();
      keyDown(actor, "2", true);
      keyDown(actor, "9", true);
      keyDown(actor, "4", true);
      expect(actor.getSnapshot().context.digitBuffer).toBe("294");

      actor.send({ type: "KEY_UP", key: "Control" });
      expect(onLoadSong).toHaveBeenCalledWith(294);
      expect(actor.getSnapshot().context.digitBuffer).toBe("");
    });

    it("does not call onLoadSong when Control released with empty buffer", () => {
      const { actor, onLoadSong } = createTestActor();
      actor.send({ type: "KEY_UP", key: "Control" });
      expect(onLoadSong).not.toHaveBeenCalled();
    });

    it("does not call onLoadSong when non-Control key is released", () => {
      const { actor, onLoadSong } = createTestActor();
      keyDown(actor, "1", true);
      actor.send({ type: "KEY_UP", key: "1" });
      expect(onLoadSong).not.toHaveBeenCalled();
      expect(actor.getSnapshot().context.digitBuffer).toBe("1");
    });
  });

  describe("KEY_DOWN — page navigation", () => {
    it("calls onNavigate for ArrowRight and prevents default", () => {
      const { actor, onNavigate } = createTestActor();
      const domEvent = keyDown(
        actor,
        "ArrowRight",
        false,
        createMockDomEvent(),
        {
          totalPages: 5,
          currentPage: 1,
        },
      );
      expect(onNavigate).toHaveBeenCalledWith(2);
      expect(domEvent.preventDefault).toHaveBeenCalled();
    });

    it("calls onNavigate for ArrowLeft", () => {
      const { actor, onNavigate } = createTestActor();
      keyDown(actor, "ArrowLeft", false, createMockDomEvent(), {
        totalPages: 5,
        currentPage: 2,
      });
      expect(onNavigate).toHaveBeenCalledWith(1);
    });

    it("calls onNavigate for PageDown / PageUp", () => {
      const { actor, onNavigate } = createTestActor();
      keyDown(actor, "PageDown", false, createMockDomEvent(), {
        totalPages: 5,
        currentPage: 0,
      });
      expect(onNavigate).toHaveBeenCalledWith(1);

      onNavigate.mockClear();
      keyDown(actor, "PageUp", false, createMockDomEvent(), {
        totalPages: 5,
        currentPage: 2,
      });
      expect(onNavigate).toHaveBeenCalledWith(1);
    });

    it("calls onNavigate for digit 1–9 without Ctrl (verse jump to first page of that verse)", () => {
      const { actor, onNavigate } = createTestActor();
      // stanzaIndexByPage: [0, 0, 1, 1, 2, 2]; isChorus: [false, true, false] → verse 1 = stanza 0, verse 2 = stanza 2
      // verse 2 = second non-chorus stanza = stanza 2, first page is index 4
      keyDown(actor, "2", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 0,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false],
      });
      expect(onNavigate).toHaveBeenCalledWith(4); // verse 2 → first page of stanza 2 (not chorus stanza 1)
      onNavigate.mockClear();
      keyDown(actor, "1", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 4,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false],
      });
      expect(onNavigate).toHaveBeenCalledWith(0); // verse 1 → first page of stanza 0
    });

    it("clears chorus-only view when jumping to another verse (calls onChorusOnlyChange(null))", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor, onNavigate } = createTestActor();
      keyDown(actor, "2", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 0,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false, true, false, true],
        chorusOnlyForVerse: 1,
        currentVerse: 1,
        totalVerses: 3,
        onChorusOnlyChange,
      });
      expect(onChorusOnlyChange).toHaveBeenCalledWith(null);
      expect(onNavigate).toHaveBeenCalledWith(4);
    });
  });

  describe("KEY_DOWN — arrow from chorus-only view", () => {
    it("ArrowRight exits chorus view and navigates to next verse", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor, onNavigate } = createTestActor();
      keyDown(actor, "ArrowRight", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 0,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false, true, false, true],
        chorusOnlyForVerse: 1,
        currentVerse: 1,
        totalVerses: 3,
        onChorusOnlyChange,
        effectiveChorusOnlyTotalPages: 2,
        effectiveChorusOnlyCurrentPage: 1,
      });
      expect(onChorusOnlyChange).toHaveBeenCalledWith(null);
      expect(onNavigate).toHaveBeenCalledWith(4); // first page of verse 2
    });
    it("ArrowLeft exits chorus view and navigates to previous verse", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor, onNavigate } = createTestActor();
      keyDown(actor, "ArrowLeft", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 4,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false, true, false, true],
        chorusOnlyForVerse: 2,
        currentVerse: 2,
        totalVerses: 3,
        onChorusOnlyChange,
        effectiveChorusOnlyTotalPages: 2,
        effectiveChorusOnlyCurrentPage: 0,
      });
      expect(onChorusOnlyChange).toHaveBeenCalledWith(null);
      expect(onNavigate).toHaveBeenCalledWith(0); // first page of verse 1
    });
  });

  describe("KEY_DOWN — verse jump (digits)", () => {
    it("verse jump: pressing 2 goes to verse 2 (first page of that verse), not chorus (regression)", () => {
      // Digit 2 must jump to the first page of verse 2 (second non-chorus stanza), not to the chorus.
      // Layout: stanza 0 = verse 1 (pages 0,1), stanza 1 = chorus (pages 2,3), stanza 2 = verse 2 (pages 4,5).
      const { actor, onNavigate } = createTestActor();
      const stanzaIndexByPage = [0, 0, 1, 1, 2, 2];
      keyDown(actor, "2", false, createMockDomEvent(), {
        totalPages: stanzaIndexByPage.length,
        currentPage: 0,
        stanzaIndexByPage,
        isChorus: [false, true, false],
      });
      const targetPage = onNavigate.mock.calls[0][0];
      expect(targetPage).toBe(4); // first page of verse 2 (stanza 2), not 2 (chorus)
    });

    it("clamps navigation to valid page range", () => {
      const { actor, onNavigate } = createTestActor();
      keyDown(actor, "ArrowRight", false, createMockDomEvent(), {
        totalPages: 3,
        currentPage: 2,
      });
      expect(onNavigate).toHaveBeenCalledWith(2); // already at last page
    });
  });

  describe("KEY_DOWN — chorus only (0)", () => {
    it("calls onChorusOnlyChange(currentVerse) when pressing 0 from a verse", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor } = createTestActor();
      keyDown(actor, "0", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 0,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false, true, false, true],
        chorusOnlyForVerse: null,
        currentVerse: 1,
        onChorusOnlyChange,
      });
      expect(onChorusOnlyChange).toHaveBeenCalledWith(1);
    });

    it("calls onChorusOnlyChange(2) when pressing 0 from verse 2", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor } = createTestActor();
      keyDown(actor, "0", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 4,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false, true, false, true],
        chorusOnlyForVerse: null,
        currentVerse: 2,
        onChorusOnlyChange,
      });
      expect(onChorusOnlyChange).toHaveBeenCalledWith(2);
    });

    it("does not call onChorusOnlyChange when pressing 0 while already in chorus-only view", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor } = createTestActor();
      keyDown(actor, "0", false, createMockDomEvent(), {
        totalPages: 6,
        currentPage: 0,
        stanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        firstStanzaIndexByPage: [0, 0, 1, 1, 2, 2],
        isChorus: [false, true, false, true, false, true],
        chorusOnlyForVerse: 1,
        currentVerse: 1,
        onChorusOnlyChange,
      });
      expect(onChorusOnlyChange).not.toHaveBeenCalled();
    });

    it("calls onChorusOnlyChange when pressing 0 from a chorus page (e.g. last chorus page)", () => {
      const onChorusOnlyChange = jest.fn();
      const { actor } = createTestActor();
      keyDown(actor, "0", false, createMockDomEvent(), {
        totalPages: 4,
        currentPage: 1,
        stanzaIndexByPage: [0, 1, 1, 2],
        firstStanzaIndexByPage: [0, 1, 1, 2],
        isChorus: [false, true, false, true],
        chorusOnlyForVerse: null,
        currentVerse: 1,
        onChorusOnlyChange,
      });
      expect(onChorusOnlyChange).toHaveBeenCalledWith(1);
    });
  });

  describe("KEY_DOWN — font size", () => {
    it("calls onFontSizeDelta(1) for = and +", () => {
      const { actor, onFontSizeDelta } = createTestActor();
      keyDown(actor, "=", false);
      expect(onFontSizeDelta).toHaveBeenCalledWith(1);
      onFontSizeDelta.mockClear();
      keyDown(actor, "+", false);
      expect(onFontSizeDelta).toHaveBeenCalledWith(1);
    });

    it("calls onFontSizeDelta(-1) for -", () => {
      const { actor, onFontSizeDelta } = createTestActor();
      keyDown(actor, "-", false);
      expect(onFontSizeDelta).toHaveBeenCalledWith(-1);
    });

    it("calls preventDefault for + / - / =", () => {
      const domEq = createMockDomEvent();
      const domPlus = createMockDomEvent();
      const domMinus = createMockDomEvent();
      const { actor } = createTestActor();
      keyDown(actor, "=", false, domEq);
      keyDown(actor, "+", false, domPlus);
      keyDown(actor, "-", false, domMinus);
      expect(domEq.preventDefault).toHaveBeenCalled();
      expect(domPlus.preventDefault).toHaveBeenCalled();
      expect(domMinus.preventDefault).toHaveBeenCalled();
    });
  });

  describe("KEY_DOWN — lyrics scroll", () => {
    it("scrolls lyrics and prevents default when ArrowUp/ArrowDown and element has scroll", () => {
      const scrollEl = {
        scrollTop: 100,
      } as unknown as HTMLDivElement;
      const { actor } = createTestActor();
      const domEvent = keyDown(
        actor,
        "ArrowDown",
        false,
        createMockDomEvent(),
        {
          lyricsScrollEl: scrollEl,
        },
      );
      expect(scrollEl.scrollTop).toBe(156); // 100 + 56
      expect(domEvent.preventDefault).toHaveBeenCalled();
    });

    it("scrolls up with ArrowUp", () => {
      const scrollEl = {
        scrollTop: 100,
      } as unknown as HTMLDivElement;
      const { actor } = createTestActor();
      keyDown(actor, "ArrowUp", false, createMockDomEvent(), {
        lyricsScrollEl: scrollEl,
      });
      expect(scrollEl.scrollTop).toBe(44); // 100 - 56
    });

    it("does not preventDefault when scroll does not change (at top)", () => {
      let scrollTop = 0;
      const scrollEl = {
        get scrollTop() {
          return scrollTop;
        },
        set scrollTop(v: number) {
          scrollTop = Math.max(0, v); // simulate browser clamping
        },
      } as unknown as HTMLDivElement;
      const { actor } = createTestActor();
      const domEvent = keyDown(actor, "ArrowUp", false, createMockDomEvent(), {
        lyricsScrollEl: scrollEl,
      });
      expect(scrollEl.scrollTop).toBe(0);
      // preventDefault is only called when scrollTop actually changed
      expect(domEvent.preventDefault).not.toHaveBeenCalled();
    });
  });
});

describe("clampLyricsFontSizeIndex", () => {
  it("clamps to [0, length-1]", () => {
    expect(clampLyricsFontSizeIndex(0)).toBe(0);
    expect(clampLyricsFontSizeIndex(5)).toBe(5);
    expect(clampLyricsFontSizeIndex(-1)).toBe(0);
    expect(clampLyricsFontSizeIndex(6)).toBe(5);
    expect(clampLyricsFontSizeIndex(10)).toBe(5);
  });
});
