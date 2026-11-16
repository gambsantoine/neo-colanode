import { describe, expect, it } from 'vitest';

import {
  buildRevealSlidesHtml,
  DEFAULT_REVEAL_CONTENT,
  findRevealIndex,
  parseRevealDeck,
  renderRevealSlide,
} from '@colanode/ui/lib/reveal';
import { scopeThemeCss } from '@colanode/ui/lib/reveal-themes';
import { findSlideAtLine } from '@colanode/ui/lib/slides';

describe('lib/reveal', () => {
  it('splits horizontal and vertical slides', () => {
    const deck = parseRevealDeck(
      '# A\n---\n# B\n--\n# B.1\n--\n# B.2\n---\n# C'
    );
    expect(
      deck.slides.map((slide) => [slide.h, slide.v, slide.content])
    ).toEqual([
      [0, 0, '# A'],
      [1, 0, '# B'],
      [1, 1, '# B.1'],
      [1, 2, '# B.2'],
      [2, 0, '# C'],
    ]);
  });

  it('reads the options block', () => {
    const deck = parseRevealDeck(
      '---\ntitle: Deck\ntheme: white\ntransition: zoom\nslideNumber: false\n---\n# A\n---\n# B'
    );
    expect(deck.title).toBe('Deck');
    expect(deck.config.theme).toBe('white');
    expect(deck.config.transition).toBe('zoom');
    expect(deck.config.slideNumber).toBe(false);
    expect(deck.dark).toBe(false);
    expect(deck.slides.map((slide) => slide.content)).toEqual(['# A', '# B']);
  });

  it('falls back to default options', () => {
    const deck = parseRevealDeck('---\ntheme: unknown\n---\n# A');
    expect(deck.config.theme).toBe('black');
    expect(deck.config.transition).toBe('slide');
    expect(deck.dark).toBe(true);
  });

  it('extracts the speaker notes', () => {
    const deck = parseRevealDeck(
      '# A\n\nText\n\nNote: Say hello\nand more\n---\n# B'
    );
    expect(deck.slides[0]!.content).toBe('# A\n\nText');
    expect(deck.slides[0]!.notes).toBe('Say hello\nand more');
    expect(deck.slides[1]!.notes).toBeNull();
  });

  it('ignores separators and notes inside code blocks', () => {
    const deck = parseRevealDeck('```\n---\nNote: code\n--\n```\n---\n# B');
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]!.notes).toBeNull();
  });

  it('maps lines and positions to slides', () => {
    const source = '---\ntheme: black\n---\n# A\n---\n# B\n--\n# B.1';
    const deck = parseRevealDeck(source);
    expect(deck.slides.map((slide) => slide.startLine)).toEqual([0, 4, 6]);
    expect(findSlideAtLine(deck, 3)).toBe(0);
    expect(findSlideAtLine(deck, 5)).toBe(1);
    expect(findSlideAtLine(deck, 7)).toBe(2);
    expect(findRevealIndex(deck, 1, 1)).toBe(2);
    expect(findRevealIndex(deck, 1, 9)).toBe(2);
  });

  it('parses the default deck', () => {
    const deck = parseRevealDeck(DEFAULT_REVEAL_CONTENT);
    expect(deck.title).toBe('My presentation');
    expect(deck.slides.length).toBe(5);
    expect(deck.slides.filter((slide) => slide.v > 0)).toHaveLength(1);
  });
});

describe('lib/reveal rendering', () => {
  it('applies element attributes', () => {
    const { html } = renderRevealSlide(
      '- One <!-- .element: class="fragment" data-fragment-index="2" -->\n- Two'
    );
    expect(html).toContain('<li class="fragment" data-fragment-index="2">');
    expect(html).not.toContain('<!--');
  });

  it('applies slide attributes', () => {
    const { attributes } = renderRevealSlide(
      '<!-- .slide: data-background-color="#4f46e5" data-transition="zoom" -->\n# A'
    );
    expect(attributes).toEqual([
      ['data-background-color', '#4f46e5'],
      ['data-transition', 'zoom'],
    ]);
  });

  it('drops unsafe attributes', () => {
    const { html, attributes } = renderRevealSlide(
      [
        '<!-- .slide: data-background-iframe="https://evil.test" data-background-image="javascript:alert(1)" onclick="x" -->',
        'Text <!-- .element: onmouseover="alert(1)" style="color:red" -->',
      ].join('\n')
    );
    expect(attributes).toEqual([]);
    expect(html).not.toContain('onmouseover');
    expect(html).not.toContain('style');
  });

  it('builds nested sections for vertical slides', () => {
    const deck = parseRevealDeck(
      '# A\n---\n<!-- .slide: data-background-color="red" -->\n# B\n--\n# B.1'
    );
    const html = buildRevealSlidesHtml(deck).replace(/\n/g, '');
    expect(html).toMatch(
      /^<section><h1>A<\/h1><\/section><section><section data-background-color="red">/
    );
    expect(html).toContain('<h1>B.1</h1></section></section>');
  });

  it('removes scripts', () => {
    const html = buildRevealSlidesHtml(
      parseRevealDeck(
        '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>'
      )
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});

describe('lib/reveal-themes', () => {
  it('scopes theme rules to a class', () => {
    const css =
      '@import "https://fonts.example/x.css";:root{--r-main-color:#fff}.reveal-viewport{background:var(--r-background)}.reveal h1,.reveal .slides{color:red}section.has-light-background h1{color:#222}@media (max-width:10px){.reveal p{margin:0}}';
    expect(scopeThemeCss(css, 'T')).toBe(
      '.T{--r-main-color:#fff}.T.reveal-viewport{background:var(--r-background)}.T .reveal h1,.T .reveal .slides{color:red}.T section.has-light-background h1{color:#222}@media (max-width:10px){.T .reveal p{margin:0}}'
    );
  });
});
