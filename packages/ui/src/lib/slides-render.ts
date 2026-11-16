import DOMPurify from 'dompurify';
import { Marked, Tokens } from 'marked';

import { highlightCode } from '@colanode/ui/lib/lowlight';

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

const renderCode = ({ text, lang }: Tokens.Code): string => {
  // Slidev accepts options after the language: ```ts {2-3}
  const language = (lang ?? '').trim().split(/[\s{]/)[0]?.toLowerCase() ?? '';

  if (language === 'mermaid') {
    return `<div class="${MERMAID_PLACEHOLDER_CLASS}" data-code="${encodeURIComponent(text)}"></div>`;
  }

  const highlighted = highlightCode(text, language || undefined);
  const body = highlighted
    ? highlighted.nodes
        .map((node) =>
          node.classes.length > 0
            ? `<span class="${escapeHtml(node.classes.join(' '))}">${escapeHtml(node.text)}</span>`
            : escapeHtml(node.text)
        )
        .join('')
    : escapeHtml(text);

  return `<pre class="hljs"><code>${body}</code></pre>`;
};

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

export const sanitizeSlideHtml = (html: string): string => {
  installHooks();
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
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
