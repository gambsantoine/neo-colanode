import { describe, expect, it } from 'vitest';

import {
  appendMarkdownToContent,
  contentToMarkdown,
  markdownToContent,
} from '../src/markdown';

const DOC = 'pg1';

const SAMPLE = `# Titre

Du **gras**, de l'*italique*, du \`code\` et un [lien](https://colanode.com).

## Liste

- un
- deux
  - imbriqué

1. premier
2. second

- [ ] à faire
- [x] fait

> une citation

\`\`\`ts
const a = 1;
\`\`\`

| A | B |
| --- | --- |
| 1 | 2 |

---`;

describe('markdown conversion', () => {
  it('round trips the supported syntax', () => {
    const content = markdownToContent(DOC, SAMPLE, null);
    expect(contentToMarkdown(DOC, content)).toBe(SAMPLE);
  });

  it('uses the editor block types', () => {
    const blocks = Object.values(markdownToContent(DOC, SAMPLE, null).blocks);
    const types = new Set(blocks.map((block) => block.type));
    for (const type of [
      'heading1',
      'heading2',
      'paragraph',
      'bulletList',
      'listItem',
      'orderedList',
      'taskList',
      'taskItem',
      'blockquote',
      'codeBlock',
      'table',
      'tableRow',
      'tableHeader',
      'tableCell',
      'horizontalRule',
    ]) {
      expect(types).toContain(type);
    }
  });

  it('keeps block ids of unchanged blocks when replacing', () => {
    const first = markdownToContent(DOC, '# A\n\nB\n\nC', null);
    const second = markdownToContent(DOC, '# A\n\nB modifié\n\nC', first);
    expect(Object.keys(second.blocks).sort()).toEqual(
      Object.keys(first.blocks).sort()
    );
  });

  it('keeps embedded blocks written as marker comments', () => {
    const current = {
      type: 'rich_text' as const,
      blocks: {
        emb: {
          id: 'emb',
          type: 'page',
          parentId: DOC,
          index: 'a0',
          attrs: { id: 'x' },
        },
      },
    };
    const markdown = contentToMarkdown(DOC, current);
    expect(markdown).toBe('<!-- colanode:page:emb -->');
    const next = markdownToContent(DOC, `Intro\n\n${markdown}`, current);
    expect(next.blocks.emb).toMatchObject({ type: 'page', attrs: { id: 'x' } });
  });

  it('appends after the existing content', () => {
    const first = markdownToContent(DOC, 'A', null);
    const next = appendMarkdownToContent(DOC, 'B', first);
    expect(contentToMarkdown(DOC, next)).toBe('A\n\nB');
  });

  it('keeps adjacent marks in a single wrapper', () => {
    const markdown =
      '***gras et italique***, **gras avec `code`**, et un **[lien en gras](https://example.com)**.';
    const content = markdownToContent(DOC, markdown, null);
    expect(contentToMarkdown(DOC, content)).toBe(markdown);
  });

  it('keeps multi paragraph quotes in one quote', () => {
    const markdown = '> Une citation\n>\n> sur plusieurs paragraphes.';
    const content = markdownToContent(DOC, markdown, null);
    expect(
      Object.values(content.blocks).filter((b) => b.type === 'blockquote')
    ).toHaveLength(1);
    expect(contentToMarkdown(DOC, content)).toBe(markdown);
  });
});
