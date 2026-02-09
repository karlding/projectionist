import * as React from "react";
import { render, screen } from "@testing-library/react";
import { VerseIndicator } from "../src/components/VerseIndicator";

describe("VerseIndicator", () => {
  it("renders current verse and total (verse number bold)", () => {
    const { container } = render(
      <VerseIndicator currentVerse={1} totalVerses={3} />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(container.textContent).toMatch(/1 \/ 3/);
    const strong = screen.getByText("1").closest("strong");
    expect(strong).toBeInTheDocument();
  });

  it("renders verse 2 / 3 with 2 bolded", () => {
    const { container } = render(
      <VerseIndicator currentVerse={2} totalVerses={3} />,
    );
    expect(container.textContent).toMatch(/2 \/ 3/);
    expect(screen.getByText("2").closest("strong")).toBeInTheDocument();
  });

  it("does not show C when hasChorus is false", () => {
    render(<VerseIndicator currentVerse={1} totalVerses={3} />);
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("does not show C when hasChorus is omitted", () => {
    render(<VerseIndicator currentVerse={1} totalVerses={3} />);
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("shows C with font-medium when hasChorus is true and not on chorus page", () => {
    render(
      <VerseIndicator
        currentVerse={1}
        totalVerses={3}
        hasChorus
        isChorus={false}
      />,
    );
    const c = screen.getByText("C");
    expect(c).toBeInTheDocument();
    expect(c).toHaveClass("font-medium");
    expect(c).not.toHaveClass("font-bold");
  });

  it("shows C with font-bold when hasChorus and isChorus are true", () => {
    render(
      <VerseIndicator currentVerse={2} totalVerses={3} hasChorus isChorus />,
    );
    const c = screen.getByText("C");
    expect(c).toBeInTheDocument();
    expect(c).toHaveClass("font-bold");
  });

  it("renders aside with expected layout classes", () => {
    const { container } = render(
      <VerseIndicator currentVerse={1} totalVerses={1} />,
    );
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("flex-shrink-0", "w-14", "border-r");
  });
});
