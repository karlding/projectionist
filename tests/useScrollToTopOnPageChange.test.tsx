import * as React from "react";
import { render, screen } from "@testing-library/react";
import { useScrollToTopOnPageChange } from "../src/useScrollToTopOnPageChange";

// jsdom does not implement scrollTo on elements; add a mock so we can assert it was called
const scrollToMock = jest.fn();
beforeAll(() => {
  (HTMLElement.prototype as { scrollTo?: typeof scrollToMock }).scrollTo =
    scrollToMock;
});
beforeEach(() => scrollToMock.mockClear());
afterAll(() => {
  delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
});

function TestComponent({ page }: { page: number }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  useScrollToTopOnPageChange(scrollRef, page);
  return <div ref={scrollRef} data-testid="scroll-container" />;
}

describe("useScrollToTopOnPageChange", () => {
  it("scrolls to top when page changes", () => {
    const { rerender } = render(<TestComponent page={0} />);
    scrollToMock.mockClear();

    rerender(<TestComponent page={1} />);

    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
  });

  it("does not call scrollTo when page stays the same", () => {
    const { rerender } = render(<TestComponent page={1} />);
    scrollToMock.mockClear();

    rerender(<TestComponent page={1} />);

    expect(scrollToMock).not.toHaveBeenCalled();
  });
});
