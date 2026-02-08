import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { LyricsPageContent } from '../src/components/LyricsPageContent';

describe('LyricsPageContent', () => {
  it('renders page lines', () => {
    render(
      <LyricsPageContent
        lines={['line one', 'line two']}
        currentPage={0}
        totalPages={1}
        stanzaIndexByPage={[0]}
        chorusStartLineIndexByPage={[-1]}
        isChorus={[false]}
        languageCount={1}
        lyricsFontSizeIndex={0}
      />
    );
    expect(screen.getByText('line one')).toBeInTheDocument();
    expect(screen.getByText('line two')).toBeInTheDocument();
  });

  it('renders yellow line (chorus separator) after verse on merged page', () => {
    const lines = [...Array(5)].map((_, i) => `verse ${i + 1}`);
    lines.push('chorus 1', 'chorus 2', 'chorus 3');
    const { container } = render(
      <LyricsPageContent
        lines={lines}
        currentPage={0}
        totalPages={1}
        stanzaIndexByPage={[1]}
        chorusStartLineIndexByPage={[5]}
        isChorus={[false, true]}
        languageCount={1}
        lyricsFontSizeIndex={0}
      />
    );
    const yellowHr = container.querySelector('hr.border-yellow-500');
    expect(yellowHr).toBeInTheDocument();
  });

  it('renders element with data-chorus-start at chorus start line on merged page', () => {
    const lines = ['v1', 'v2', 'v3', 'c1', 'c2'];
    render(
      <LyricsPageContent
        lines={lines}
        currentPage={0}
        totalPages={1}
        stanzaIndexByPage={[1]}
        chorusStartLineIndexByPage={[3]}
        isChorus={[false, true]}
        languageCount={1}
        lyricsFontSizeIndex={0}
      />
    );
    const chorusStart = document.querySelector('[data-chorus-start]');
    expect(chorusStart).toBeInTheDocument();
    expect(chorusStart?.textContent).toBe('c1');
  });

  it('renders end-of-song red line on last line of last page', () => {
    const { container } = render(
      <LyricsPageContent
        lines={['only line']}
        currentPage={0}
        totalPages={1}
        stanzaIndexByPage={[0]}
        chorusStartLineIndexByPage={[-1]}
        isChorus={[false]}
        languageCount={1}
        lyricsFontSizeIndex={0}
      />
    );
    const redHr = container.querySelector('hr.border-red-500');
    expect(redHr).toBeInTheDocument();
  });
});
