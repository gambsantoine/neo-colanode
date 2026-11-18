import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRESENTATION_CONTENT,
  findSlideAtLine,
  getLineAt,
  parseDeck,
  toCssBackground,
  toSafeImageUrl,
} from '@colanode/ui/lib/slides';
import { renderSlideMarkdown } from '@colanode/ui/lib/slides-render';

describe('lib/slides', () => {
  it('splits slides on --- lines', () => {
    const deck = parseDeck('# One\n\n---\n\n# Two\n---\n# Three');
    expect(deck.slides.map((slide) => slide.content)).toEqual([
      '# One',
      '# Two',
      '# Three',
    ]);
  });

  it('reads the headmatter as deck and first slide options', () => {
    const deck = parseDeck(
      '---\ntitle: Deck\nlayout: cover\n---\n# Hello\n---\n# Next'
    );
    expect(deck.title).toBe('Deck');
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]!.layout).toBe('cover');
    expect(deck.slides[0]!.content).toBe('# Hello');
    expect(deck.slides[1]!.layout).toBe('default');
  });

  it('reads the frontmatter of a slide', () => {
    const deck = parseDeck(
      '# A\n---\nlayout: center\nclass: text-xl\n---\n# B'
    );
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[1]!.layout).toBe('center');
    expect(deck.slides[1]!.frontmatter.class).toBe('text-xl');
    expect(deck.slides[1]!.content).toBe('# B');
  });

  it('keeps a block that is not YAML as slide content', () => {
    const deck = parseDeck('# A\n---\n# B\n---\n# C');
    expect(deck.slides.map((slide) => slide.content)).toEqual([
      '# A',
      '# B',
      '# C',
    ]);
  });

  it('ignores separators inside code blocks', () => {
    const deck = parseDeck(
      '# A\n\n```yaml\n---\nkey: value\n---\n```\n---\n# B'
    );
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]!.content).toContain('key: value');
  });

  it('extracts the presenter notes', () => {
    const deck = parseDeck('# A\n\nText\n\n<!-- Say hello -->\n---\n# B');
    expect(deck.slides[0]!.notes).toBe('Say hello');
    expect(deck.slides[0]!.content).toBe('# A\n\nText');
    expect(deck.slides[1]!.notes).toBeNull();
  });

  it('splits the two-cols layout on ::right::', () => {
    const deck = parseDeck(
      '---\nlayout: two-cols\n---\nLeft\n\n::right::\n\nRight'
    );
    expect(deck.slides[0]!.content).toBe('Left');
    expect(deck.slides[0]!.right).toBe('Right');
  });

  it('skips hidden slides', () => {
    const deck = parseDeck('# A\n---\nhide: true\n---\n# B\n---\n# C');
    expect(deck.slides.map((slide) => slide.content)).toEqual(['# A', '# C']);
    expect(deck.slides.map((slide) => slide.index)).toEqual([0, 1]);
  });

  it('defaults to image-right when an image is given', () => {
    const deck = parseDeck('---\nimage: https://example.com/a.png\n---\n# A');
    expect(deck.slides[0]!.layout).toBe('image-right');
  });

  it('always returns at least one slide', () => {
    expect(parseDeck('').slides).toHaveLength(1);
    expect(parseDeck('---\ntitle: Only\n---\n').slides).toHaveLength(1);
  });

  it('handles Windows line endings', () => {
    const deck = parseDeck('# A\r\n---\r\n# B');
    expect(deck.slides.map((slide) => slide.content)).toEqual(['# A', '# B']);
  });

  it('finds the slide under a line of the source', () => {
    const source = '# A\n---\nlayout: center\n---\n# B\n---\n# C';
    const deck = parseDeck(source);
    expect(findSlideAtLine(deck, 0)).toBe(0);
    expect(findSlideAtLine(deck, 2)).toBe(1);
    expect(findSlideAtLine(deck, 4)).toBe(1);
    expect(findSlideAtLine(deck, 6)).toBe(2);
    expect(getLineAt(source, source.indexOf('# C'))).toBe(6);
  });

  it('parses the default presentation', () => {
    const deck = parseDeck(DEFAULT_PRESENTATION_CONTENT);
    expect(deck.title).toBe('My presentation');
    expect(deck.slides.map((slide) => slide.layout)).toEqual([
      'default',
      'center',
      'two-cols',
      'end',
    ]);
    expect(deck.slides[2]!.notes).toContain('Presenter notes');
  });

  it('only accepts plain URLs and colors as backgrounds', () => {
    expect(toCssBackground('#123456')).toBe('#123456');
    expect(toCssBackground('https://example.com/a.png')).toContain('url(');
    expect(toCssBackground('red; position: fixed')).toBeNull();
    expect(toCssBackground('url(x) , red')).toBeNull();
    expect(toSafeImageUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeImageUrl('https://example.com/a")')).toBeNull();
  });
});

describe('lib/slides-render', () => {
  it('renders Markdown', () => {
    const html = renderSlideMarkdown('# Title\n\n- **one**\n- two');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>one</strong>');
  });

  it('removes scripts and event handlers', () => {
    const html = renderSlideMarkdown(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<a href="javascript:alert(1)">x</a>'
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('opens links outside of the app', () => {
    const html = renderSlideMarkdown('[site](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('labels code blocks with the language name', () => {
    const ts = renderSlideMarkdown('```ts\nconst a = 1;\n```');
    expect(ts).toContain('<div class="slide-code">');
    expect(ts).toContain('<span class="slide-code-language">TypeScript</span>');

    const html = renderSlideMarkdown('```html\n<p>Hi</p>\n```');
    expect(html).toContain('>HTML</span>');
    expect(html).toContain('hljs-tag');
  });

  it('keeps plain and unknown languages unhighlighted', () => {
    const plain = renderSlideMarkdown('```\nconst a = 1;\n```');
    expect(plain).not.toContain('hljs-');
    expect(plain).toContain('<span class="slide-code-language"></span>');

    const unknown = renderSlideMarkdown('```foobar\nconst a = 1;\n```');
    expect(unknown).not.toContain('hljs-');
    expect(unknown).toContain('>foobar</span>');
  });

  it('escapes code', () => {
    const html = renderSlideMarkdown('```js\nconst a = "<script>";\n```');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('highlights code and defers mermaid blocks', () => {
    const code = renderSlideMarkdown('```ts {2}\nconst a = 1;\n```');
    expect(code).toContain('hljs-keyword');

    const mermaid = renderSlideMarkdown('```mermaid\ngraph TD\nA-->B\n```');
    expect(mermaid).toContain('slide-mermaid');
    expect(mermaid).toContain(
      `data-code="${encodeURIComponent('graph TD\nA-->B')}"`
    );
  });
});
