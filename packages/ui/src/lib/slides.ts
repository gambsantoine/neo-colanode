import { parse as parseYaml } from 'yaml';

// Parser for slide decks written with the Slidev syntax (https://sli.dev):
//
//   ---
//   title: My deck          <- headmatter: deck options + first slide options
//   ---
//   # First slide
//
//   ---
//   layout: center          <- optional frontmatter of the next slide
//   ---
//   # Second slide
//
//   <!-- Presenter notes: the last comment of a slide -->
//
// Only the Markdown part of Slidev is supported: Vue components and
// directives are not rendered (their text content is kept).

export const SLIDE_LAYOUTS = [
  'default',
  'center',
  'cover',
  'intro',
  'section',
  'statement',
  'fact',
  'quote',
  'end',
  'full',
  'two-cols',
  'image',
  'image-left',
  'image-right',
] as const;

export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export interface Slide {
  index: number;
  // 0-based line of the source where the slide starts (its separator or
  // frontmatter included), used to follow the editor caret.
  startLine: number;
  layout: SlideLayout;
  frontmatter: Record<string, unknown>;
  content: string;
  // Second column of the `two-cols` layout (after `::right::`).
  right: string | null;
  notes: string | null;
}

export interface Deck {
  title: string | null;
  headmatter: Record<string, unknown>;
  slides: Slide[];
}

export const SLIDES_FILE_EXTENSION = '.md';

export const DEFAULT_PRESENTATION_CONTENT = `---
title: My presentation
---

# My presentation

A slide deck written in Markdown

---
layout: center
---

## Slides are separated by \`---\`

Each slide can start with a frontmatter block to pick its layout.

---
layout: two-cols
---

### Left column

- Lists
- **Bold**, *italic*, \`code\`

::right::

### Right column

\`\`\`ts
const hello = (name: string) => \`Hello \${name}\`;
\`\`\`

<!-- Presenter notes: the last comment of a slide (press N in the viewer) -->

---
layout: end
---

# Thank you
`;

const SEPARATOR = /^---\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;
const RIGHT_SLOT = /^::right::\s*$/m;
const TRAILING_COMMENT = /<!--([\s\S]*?)-->\s*$/;

interface RawSlide {
  startLine: number;
  frontmatter: Record<string, unknown>;
  body: string;
}

export const parseFrontmatter = (
  lines: string[]
): Record<string, unknown> | null => {
  if (lines.every((line) => line.trim() === '')) {
    return {};
  }

  try {
    const value: unknown = parseYaml(lines.join('\n'));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Not YAML: the block is regular slide content.
  }

  return null;
};

// Lines matching `test` outside of fenced code blocks (slide separators...).
export const findLinesOutsideCode = (
  lines: string[],
  test: (line: string) => boolean
): number[] => {
  const separators: number[] = [];
  let fence: string | null = null;

  lines.forEach((line, index) => {
    const match = FENCE.exec(line);
    if (match) {
      const marker = match[1]!;
      if (fence === null) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      return;
    }

    if (fence === null && test(line)) {
      separators.push(index);
    }
  });

  return separators;
};

const splitSlides = (source: string): RawSlide[] => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const separators = findLinesOutsideCode(lines, (line) =>
    SEPARATOR.test(line)
  );
  const slides: RawSlide[] = [];

  let position = 0;
  let pending: { startLine: number; frontmatter: Record<string, unknown> } = {
    startLine: 0,
    frontmatter: {},
  };
  let separatorIndex = 0;

  // A `---` on the very first line opens the headmatter.
  const opensFrontmatter = (at: number) => {
    const next = separators[separatorIndex + 1];
    if (next === undefined) {
      return null;
    }

    const frontmatter = parseFrontmatter(lines.slice(at + 1, next));
    return frontmatter ? { end: next, frontmatter } : null;
  };

  if (separators[0] === 0) {
    const block = opensFrontmatter(0);
    if (block) {
      pending = { startLine: 0, frontmatter: block.frontmatter };
      position = block.end + 1;
      separatorIndex = separators.indexOf(block.end) + 1;
    } else {
      position = 1;
      separatorIndex = 1;
    }
  }

  while (separatorIndex <= separators.length) {
    const separator = separators[separatorIndex];
    const end = separator ?? lines.length;
    slides.push({
      startLine: pending.startLine,
      frontmatter: pending.frontmatter,
      body: lines.slice(position, end).join('\n'),
    });

    if (separator === undefined) {
      break;
    }

    const block = opensFrontmatter(separator);
    if (block) {
      pending = { startLine: separator, frontmatter: block.frontmatter };
      position = block.end + 1;
      separatorIndex = separators.indexOf(block.end) + 1;
    } else {
      pending = { startLine: separator, frontmatter: {} };
      position = separator + 1;
      separatorIndex += 1;
    }
  }

  return slides;
};

const toLayout = (value: unknown, hasImage: boolean): SlideLayout => {
  if (
    typeof value === 'string' &&
    (SLIDE_LAYOUTS as readonly string[]).includes(value)
  ) {
    return value as SlideLayout;
  }

  return hasImage ? 'image-right' : 'default';
};

const extractNotes = (
  body: string
): { content: string; notes: string | null } => {
  const match = TRAILING_COMMENT.exec(body);
  if (!match) {
    return { content: body, notes: null };
  }

  const notes = match[1]!.trim();
  return {
    content: body.slice(0, match.index),
    notes: notes.length > 0 ? notes : null,
  };
};

const isHidden = (frontmatter: Record<string, unknown>) =>
  frontmatter.hide === true || frontmatter.disabled === true;

export const parseDeck = (source: string): Deck => {
  const raw = splitSlides(source);
  const headmatter = raw[0]?.frontmatter ?? {};

  // A deck starting with a headmatter and nothing else has no empty first
  // slide to show.
  const slides: Slide[] = [];
  raw.forEach((item, rawIndex) => {
    if (isHidden(item.frontmatter)) {
      return;
    }

    const { content, notes } = extractNotes(item.body);
    const trimmed = content.trim();
    if (
      rawIndex === raw.length - 1 &&
      trimmed === '' &&
      Object.keys(item.frontmatter).length === 0 &&
      slides.length > 0
    ) {
      return;
    }

    const layout = toLayout(
      item.frontmatter.layout,
      typeof item.frontmatter.image === 'string'
    );

    let main = trimmed;
    let right: string | null = null;
    if (layout === 'two-cols') {
      const parts = trimmed.split(RIGHT_SLOT);
      main = parts[0]!.trim();
      right = parts.slice(1).join('\n').trim();
    }

    slides.push({
      index: slides.length,
      startLine: item.startLine,
      layout,
      frontmatter: item.frontmatter,
      content: main,
      right,
      notes,
    });
  });

  if (slides.length === 0) {
    slides.push({
      index: 0,
      startLine: 0,
      layout: 'default',
      frontmatter: {},
      content: '',
      right: null,
      notes: null,
    });
  }

  const title =
    typeof headmatter.title === 'string' && headmatter.title.trim()
      ? headmatter.title.trim()
      : null;

  return { title, headmatter, slides };
};

// Index of the slide containing the given 0-based line of the source.
export const findSlideAtLine = (
  deck: { slides: Array<{ index: number; startLine: number }> },
  line: number
): number => {
  let found = 0;
  for (const slide of deck.slides) {
    if (slide.startLine <= line) {
      found = slide.index;
    } else {
      break;
    }
  }

  return found;
};

export const getLineAt = (source: string, offset: number): number => {
  let line = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
    }
  }

  return line;
};

// CSS background for the `background` / `image` frontmatter options. Only
// plain URLs and colors are accepted, so a value can't inject other CSS.
const SAFE_URL = /^(https?:\/\/|data:image\/|\/|\.\/)[^\s"'()\\]*$/i;
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%/]+\))$/i;

export const toCssBackground = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (SAFE_URL.test(trimmed)) {
    return `center / cover no-repeat url("${trimmed}")`;
  }

  if (SAFE_COLOR.test(trimmed)) {
    return trimmed;
  }

  return null;
};

export const toSafeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return SAFE_URL.test(trimmed) ? trimmed : null;
};
