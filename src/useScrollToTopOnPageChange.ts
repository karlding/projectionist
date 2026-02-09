import * as React from "react";

/**
 * Scrolls the given element to top whenever the page index changes.
 * Used so that switching to a new verse page resets vertical scroll.
 */
export function useScrollToTopOnPageChange(
  scrollRef: React.RefObject<HTMLElement | null>,
  page: number,
): void {
  React.useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [scrollRef, page]);
}
