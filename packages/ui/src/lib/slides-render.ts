import DOMPurify from 'dompurify';
import { Marked, Tokens } from 'marked';

import { highlightCode, languages, lowlight } from '@colanode/ui/lib/lowlight';

// Markdown of a slide to sanitized HTML. Slides are shared with every member
// of the space, so any HTML they hold goes through DOMPurify: scripts, event
// handlers, iframes, forms and styles are removed.

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Mermaid blocks are rendered later, in the browser (see SlideView). The code
// is URI encoded: DOMPurify drops attributes holding `-->`, as in `A-->B`.
export const MERMAID_PLACEHOLDER_CLASS = 'slide-mermaid';

// Code blocks get a header with the language name; the copy button is added
// in the browser (see slides-code), as buttons are not allowed in slides.
export const CODE_BLOCK_CLASS = 'slide-code';

const languageNames = new Map(
  languages.map((language) => [language.code, language.name])
);

// lowlight reports aliases as given: the common ones are mapped to the
// language they stand for.
const ALIASES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  sh: 'bash',
  zsh: 'bash',
  console: 'shell',
  yml: 'yaml',
  md: 'markdown',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  cs: 'csharp',
  'c#': 'csharp',
  'c++': 'cpp',
  golang: 'go',
  docker: 'dockerfile',
  ps1: 'powershell',
  jsonc: 'json',
};

const getLanguageLabel = (
  requested: string,
  detected: string | undefined
): string | null => {
  if (!requested) {
    return null;
  }

  // Highlighted as XML, but better known by their own name.
  const own: Record<string, string> = { html: 'HTML', svg: 'SVG', vue: 'Vue' };
  if (own[requested]) {
    return own[requested];
  }

  if (!detected) {
    return requested;
  }

  return (
    languageNames.get(ALIASES[detected] ?? detected) ??
    languageNames.get(ALIASES[requested] ?? requested) ??
    detected
  );
};

// A code block (language name, highlighting, copy button added later).
export const renderCodeBlock = (text: string, lang?: string | null): string => {
  // Slidev and Reveal.js accept options after the language: ```ts {2-3}
  const language =
    (lang ?? '')
      .trim()
      .split(/[\s{[]/)[0]
      ?.toLowerCase() ?? '';

  if (language === 'mermaid') {
    return `<div class="${MERMAID_PLACEHOLDER_CLASS}" data-code="${encodeURIComponent(text)}"></div>`;
  }

  // Unknown or missing languages are not highlighted: auto detection guesses
  // wrong too often.
  const plain = ['', 'text', 'txt', 'plain', 'plaintext'].includes(language);
  const highlighted =
    !plain && lowlight.registered(language)
      ? highlightCode(text, language)
      : null;
  const body = highlighted
    ? highlighted.nodes
        .map((node) =>
          node.classes.length > 0
            ? `<span class="${escapeHtml(node.classes.join(' '))}">${escapeHtml(node.text)}</span>`
            : escapeHtml(node.text)
        )
        .join('')
    : escapeHtml(text);

  const label = plain
    ? null
    : getLanguageLabel(language, highlighted?.language);
  const header = `<div class="${CODE_BLOCK_CLASS}-header"><span class="${CODE_BLOCK_CLASS}-language">${label ? escapeHtml(label) : ''}</span></div>`;

  return `<div class="${CODE_BLOCK_CLASS}">${header}<pre class="${CODE_BLOCK_CLASS}-body hljs"><code>${body}</code></pre></div>`;
};

const renderCode = ({ text, lang }: Tokens.Code): string =>
  renderCodeBlock(text, lang);

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code: renderCode,
  },
});

const PURIFY_CONFIG = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  FORBID_ATTR: ['style'],
  ADD_ATTR: ['target'],
};

// Links open outside of the app.
let hooksInstalled = false;
const installHooks = () => {
  if (hooksInstalled) {
    return;
  }

  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
};

// Markdown to raw (unsafe) HTML. HTML comments are kept, as Reveal.js uses
// them for attributes: the result must go through sanitizeSlideHtml.
export const markdownToHtml = (markdown: string): string =>
  marked.parse(markdown, { async: false }) as string;

// Reveal.js HTML decks rely on styles (`style=`, `<style>`): they are kept,
// as slides are rendered in their own frame. Scripts never are.
const PURIFY_CONFIG_WITH_STYLES = {
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'],
  ADD_ATTR: ['target'],
  // Keeps a <style> placed before any content.
  FORCE_BODY: true,
};

export const sanitizeSlideHtml = (
  html: string,
  options: { allowStyles?: boolean } = {}
): string => {
  installHooks();
  return DOMPurify.sanitize(
    html,
    options.allowStyles ? PURIFY_CONFIG_WITH_STYLES : PURIFY_CONFIG
  ) as string;
};

const CACHE_LIMIT = 200;
const cache = new Map<string, string>();

export const renderSlideMarkdown = (markdown: string): string => {
  const cached = cache.get(markdown);
  if (cached !== undefined) {
    return cached;
  }

  const safe = sanitizeSlideHtml(markdownToHtml(markdown));

  cache.set(markdown, safe);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }

  return safe;
};
