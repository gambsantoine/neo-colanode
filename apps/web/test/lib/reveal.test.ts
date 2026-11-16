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

describe('lib/reveal HTML decks', () => {
  const page = `<!doctype html>
<html>
  <head>
    <title>HTML deck</title>
    <link rel="stylesheet" href="dist/theme/white.css">
    <style>.big { font-size: 3em; }</style>
  </head>
  <body>
    <div class="reveal">
      <div class="slides">
        <section data-background-color="#123456" onclick="alert(1)">
          <h1 class="big">Title</h1>
          <aside class="notes">Say hello</aside>
        </section>
        <section>
          <section><h2>Down 1</h2></section>
          <section style="color: red"><h2>Down 2</h2></section>
        </section>
        <section data-markdown>
          <textarea data-template>
            ## From Markdown
            - item
          </textarea>
        </section>
        <section>
          <pre><code class="language-js" data-trim>
            const a = 1;
          </code></pre>
          <script>alert(1)</script>
        </section>
      </div>
    </div>
    <script src="dist/reveal.js"></script>
  </body>
</html>`;

  it('detects HTML sources', () => {
    expect(parseRevealDeck(page).source).toBe('html');
    expect(parseRevealDeck('<section><h1>A</h1></section>').source).toBe(
      'html'
    );
    expect(
      parseRevealDeck('# A\n---\n<section>in markdown</section>').source
    ).toBe('markdown');
  });

  it('reads slides, stacks, notes and page options', () => {
    const deck = parseRevealDeck(page);
    expect(deck.title).toBe('HTML deck');
    expect(deck.config.theme).toBe('white');
    expect(deck.styles).toContain('.big');
    expect(deck.slides.map((slide) => [slide.h, slide.v, slide.kind])).toEqual([
      [0, 0, 'html'],
      [1, 0, 'html'],
      [1, 1, 'html'],
      [2, 0, 'markdown'],
      [3, 0, 'html'],
    ]);
    expect(deck.slides[0]!.notes).toBe('Say hello');
    expect(deck.slides[0]!.content).not.toContain('aside');
    expect(deck.slides[0]!.attributes).toEqual([
      ['data-background-color', '#123456'],
    ]);
    expect(deck.slides[3]!.content).toBe('## From Markdown\n- item');
  });

  it('maps slides to the lines of their <section>', () => {
    const source =
      '<section>\n  <h1>A</h1>\n</section>\n<section>\n  <h1>B</h1>\n</section>';
    const deck = parseRevealDeck(source);
    expect(deck.slides.map((slide) => slide.startLine)).toEqual([0, 3]);
    expect(findSlideAtLine(deck, 4)).toBe(1);
  });

  it('renders HTML slides safely, with styles and highlighted code', () => {
    const html = buildRevealSlidesHtml(parseRevealDeck(page));
    expect(html).toContain('<style>');
    expect(html).toContain('class="big"');
    expect(html).toContain('style="color: red"');
    expect(html).toContain('data-background-color="#123456"');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<script');
    expect(html).toContain('slide-code-language">JavaScript');
    expect(html).toContain('<h2>From Markdown</h2>');
  });
});
