import {
  findLinesOutsideCode,
  parseFrontmatter,
  toSafeImageUrl,
} from '@colanode/ui/lib/slides';
import {
  markdownToHtml,
  sanitizeSlideHtml,
} from '@colanode/ui/lib/slides-render';

// Decks written for Reveal.js (https://revealjs.com/markdown/):
//
//   ---
//   theme: black            <- optional options (see RevealConfig)
//   transition: slide
//   ---
//   # First slide
//
//   ---                     <- next horizontal slide
//   ## Second slide
//
//   --                      <- vertical slide, below the previous one
//   Details <!-- .element: class="fragment" -->
//
//   Note: speaker notes, until the end of the slide.
//
// `<!-- .slide: ... -->` sets attributes of the slide (background,
// transition...) and `<!-- .element: ... -->` those of the element before it
// (fragments...). Only a safe subset of attributes is kept.

export const REVEAL_THEMES = [
  'black',
  'white',
  'dracula',
  'serif',
  'solarized',
  'black-contrast',
  'white-contrast',
] as const;

export type RevealTheme = (typeof REVEAL_THEMES)[number];

const DARK_THEMES = new Set<RevealTheme>([
  'black',
  'dracula',
  'black-contrast',
]);

export const REVEAL_TRANSITIONS = [
  'none',
  'fade',
  'slide',
  'convex',
  'concave',
  'zoom',
] as const;

export type RevealTransition = (typeof REVEAL_TRANSITIONS)[number];

export interface RevealConfig {
  theme: RevealTheme;
  transition: RevealTransition;
  center: boolean;
  slideNumber: boolean;
  progress: boolean;
  controls: boolean;
}

export interface RevealSlide {
  // Position in the flat list of slides (reading order).
  index: number;
  h: number;
  v: number;
  // 0-based line of the source where the slide starts.
  startLine: number;
  content: string;
  notes: string | null;
}

export interface RevealDeck {
  title: string | null;
  config: RevealConfig;
  dark: boolean;
  slides: RevealSlide[];
}

export const DEFAULT_REVEAL_CONTENT = `---
title: My presentation
theme: black
transition: slide
---

# My presentation

A Reveal.js deck written in Markdown

---

## Horizontal slides

Separated by a line with \`---\`

--

## Vertical slides

Separated by a line with \`--\`, press ↓ to see them

---

## Fragments

- Appear <!-- .element: class="fragment" -->
- One by one <!-- .element: class="fragment" -->

Note: Speaker notes start with "Note:" and go until the end of the slide.

---

<!-- .slide: data-background-color="#4f46e5" -->

## Backgrounds

\`\`\`js
Reveal.initialize({ transition: 'zoom' });
\`\`\`
`;

const HORIZONTAL = /^---\s*$/;
const VERTICAL = /^--\s*$/;
const NOTES = /^notes?:/i;

const pick = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const toConfig = (options: Record<string, unknown>): RevealConfig => ({
  theme: pick(options.theme, REVEAL_THEMES, 'black'),
  transition: pick(options.transition, REVEAL_TRANSITIONS, 'slide'),
  center: toBoolean(options.center, true),
  slideNumber: toBoolean(options.slideNumber, true),
  progress: toBoolean(options.progress, true),
  controls: toBoolean(options.controls, true),
});

const splitNotes = (
  lines: string[]
): { content: string; notes: string | null } => {
  const noteLines = findLinesOutsideCode(lines, (line) => NOTES.test(line));
  const start = noteLines[0];
  if (start === undefined) {
    return { content: lines.join('\n').trim(), notes: null };
  }

  const notes = [lines[start]!.replace(NOTES, ''), ...lines.slice(start + 1)]
    .join('\n')
    .trim();

  return {
    content: lines.slice(0, start).join('\n').trim(),
    notes: notes.length > 0 ? notes : null,
  };
};

export const parseRevealDeck = (source: string): RevealDeck => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  // Optional options block at the top, as in Slidev.
  let options: Record<string, unknown> = {};
  let first = 0;
  if (HORIZONTAL.test(lines[0] ?? '')) {
    const close = lines.findIndex(
      (line, index) => index > 0 && HORIZONTAL.test(line)
    );
    const block = close > 0 ? parseFrontmatter(lines.slice(1, close)) : null;
    if (block) {
      options = block;
      first = close + 1;
    } else {
      first = 1;
    }
  }

  const body = lines.slice(first);
  const separators = findLinesOutsideCode(
    body,
    (line) => HORIZONTAL.test(line) || VERTICAL.test(line)
  );

  const slides: RevealSlide[] = [];
  let h = 0;
  let v = 0;
  let start = 0;
  let startLine = 0;

  const push = (end: number) => {
    const { content, notes } = splitNotes(body.slice(start, end));
    slides.push({ index: slides.length, h, v, startLine, content, notes });
  };

  for (const separator of separators) {
    push(separator);
    if (VERTICAL.test(body[separator]!)) {
      v += 1;
    } else {
      h += 1;
      v = 0;
    }

    start = separator + 1;
    startLine = first + separator;
  }

  push(body.length);

  // An empty last slide comes from a trailing separator.
  const last = slides[slides.length - 1];
  if (slides.length > 1 && last && !last.content && !last.notes) {
    slides.pop();
  }

  const config = toConfig(options);
  const title =
    typeof options.title === 'string' && options.title.trim()
      ? options.title.trim()
      : null;

  return {
    title,
    config,
    dark: DARK_THEMES.has(config.theme),
    slides,
  };
};

export const findRevealIndex = (
  deck: RevealDeck,
  h: number,
  v: number
): number =>
  deck.slides.find((slide) => slide.h === h && slide.v === v)?.index ??
  deck.slides.filter((slide) => slide.h <= h).pop()?.index ??
  0;

// Attributes from `<!-- .slide: ... -->` and `<!-- .element: ... -->`.

const ATTRIBUTE = /([\w-]+)\s*=\s*"([^"]*)"|([\w-]+)\s*=\s*'([^']*)'/g;
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%/]+\))$/i;
const GRADIENT = /^(linear|radial)-gradient\(([\w\s.,%#()/-]+)\)$/i;
const NUMBER = /^-?\d+(\.\d+)?$/;
const KEYWORDS = /^[\w\s-]+$/;

const SLIDE_ATTRIBUTES: Record<string, (value: string) => boolean> = {
  'data-background': (value) =>
    COLOR.test(value) || toSafeImageUrl(value) !== null,
  'data-background-color': (value) => COLOR.test(value),
  'data-background-gradient': (value) => GRADIENT.test(value),
  'data-background-image': (value) => toSafeImageUrl(value) !== null,
  'data-background-size': (value) => KEYWORDS.test(value),
  'data-background-position': (value) => KEYWORDS.test(value),
  'data-background-repeat': (value) => KEYWORDS.test(value),
  'data-background-opacity': (value) => NUMBER.test(value),
  'data-background-transition': (value) =>
    (REVEAL_TRANSITIONS as readonly string[]).includes(value),
  'data-transition': (value) => KEYWORDS.test(value),
  'data-transition-speed': (value) =>
    ['default', 'fast', 'slow'].includes(value),
  'data-auto-animate': () => true,
  'data-visibility': (value) => ['hidden', 'uncounted'].includes(value),
  class: (value) => KEYWORDS.test(value),
};

const ELEMENT_ATTRIBUTES: Record<string, (value: string) => boolean> = {
  class: (value) => KEYWORDS.test(value),
  'data-fragment-index': (value) => NUMBER.test(value),
  'data-id': (value) => KEYWORDS.test(value),
  'data-auto-animate-delay': (value) => NUMBER.test(value),
};

const parseAttributes = (
  text: string,
  allowed: Record<string, (value: string) => boolean>
): Array<[string, string]> => {
  const result: Array<[string, string]> = [];
  for (const match of text.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? match[3])!.toLowerCase();
    const value = (match[2] ?? match[4] ?? '').trim();
    const check = allowed[name];
    if (check && check(value)) {
      result.push([name, value]);
    }
  }

  return result;
};

const SLIDE_COMMENT = /^\s*\.slide:([\s\S]*)$/;
const ELEMENT_COMMENT = /^\s*\.element:([\s\S]*)$/;

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface RenderedSlide {
  html: string;
  attributes: Array<[string, string]>;
}

// Markdown of one slide to sanitized HTML, applying the attribute comments.
export const renderRevealSlide = (markdown: string): RenderedSlide => {
  const template = document.createElement('template');
  template.innerHTML = markdownToHtml(markdown);

  const attributes: Array<[string, string]> = [];
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_COMMENT
  );

  const comments: Comment[] = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode as Comment);
  }

  for (const comment of comments) {
    const text = comment.nodeValue ?? '';
    const slideMatch = SLIDE_COMMENT.exec(text);
    const elementMatch = ELEMENT_COMMENT.exec(text);

    if (slideMatch) {
      attributes.push(...parseAttributes(slideMatch[1]!, SLIDE_ATTRIBUTES));
    } else if (elementMatch) {
      // As in Reveal.js: the closest element before the comment, or its
      // parent when the comment follows text.
      let target: Element | null = null;
      let sibling = comment.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE) {
          target = sibling as Element;
          break;
        }

        if (sibling.nodeType === Node.TEXT_NODE && sibling.nodeValue?.trim()) {
          break;
        }

        sibling = sibling.previousSibling;
      }

      target ??= comment.parentElement;
      if (target) {
        for (const [name, value] of parseAttributes(
          elementMatch[1]!,
          ELEMENT_ATTRIBUTES
        )) {
          target.setAttribute(
            name,
            name === 'class'
              ? `${target.getAttribute('class') ?? ''} ${value}`.trim()
              : value
          );
        }
      }
    }

    comment.remove();
  }

  return {
    html: sanitizeSlideHtml(template.innerHTML),
    attributes,
  };
};

const renderSection = (slide: RevealSlide): string => {
  const { html, attributes } = renderRevealSlide(slide.content);
  const attributeText = attributes
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');

  return `<section${attributeText}>${html}</section>`;
};

const CACHE_LIMIT = 300;
const sectionCache = new Map<string, string>();

const renderSectionCached = (slide: RevealSlide): string => {
  const cached = sectionCache.get(slide.content);
  if (cached !== undefined) {
    return cached;
  }

  const section = renderSection(slide);
  sectionCache.set(slide.content, section);
  if (sectionCache.size > CACHE_LIMIT) {
    const oldest = sectionCache.keys().next().value;
    if (oldest !== undefined) {
      sectionCache.delete(oldest);
    }
  }

  return section;
};

// The `<section>` elements Reveal.js expects in `.slides`: vertical slides
// are nested in a parent section.
export const buildRevealSlidesHtml = (deck: RevealDeck): string => {
  const stacks = new Map<number, RevealSlide[]>();
  for (const slide of deck.slides) {
    const stack = stacks.get(slide.h) ?? [];
    stack.push(slide);
    stacks.set(slide.h, stack);
  }

  const html = [...stacks.values()]
    .map((stack) =>
      stack.length === 1
        ? renderSectionCached(stack[0]!)
        : `<section>${stack.map(renderSectionCached).join('')}</section>`
    )
    .join('');

  // Each section is already sanitized: this pass only guards the assembly.
  return sanitizeSlideHtml(html);
};
