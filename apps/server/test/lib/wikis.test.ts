import { describe, expect, it } from 'vitest';

import { Block } from '@colanode/core';
import {
  computeWikiTree,
  normalizeWikiPath,
} from '@colanode/server/lib/wikis/paths';
import {
  generateWikiLinkToken,
  parseWikiLinkToken,
  readCookie,
} from '@colanode/server/lib/wikis/publications';
import {
  BlockRenderContext,
  renderDocumentBlocks,
} from '@colanode/server/lib/wikis/render-blocks';

const context: BlockRenderContext = {
  nodeLink: (id) =>
    id === 'page2'
      ? { href: '/wiki/docs/page-2', name: 'Page 2', type: 'page' }
      : null,
  file: (id) =>
    id === 'img'
      ? {
          href: '/wiki/docs/_files/img/a.png',
          name: 'a.png',
          mimeType: 'image/png',
          size: 10,
        }
      : id === 'svg'
        ? {
            href: '/wiki/docs/_files/svg/a.svg',
            name: 'a.svg',
            mimeType: 'image/svg+xml',
            size: 2048,
          }
        : null,
  userName: (id) => (id === 'u1' ? 'Ada <Lovelace>' : null),
  database: () => null,
};

const block = (
  block: Partial<Block> & Pick<Block, 'id' | 'type' | 'parentId' | 'index'>
): Block => block as Block;

describe('wiki paths', () => {
  const nodes = [
    {
      id: 'cat',
      type: 'category',
      parentId: 'wiki',
      name: 'Guides',
      index: 'a1',
    },
    {
      id: 'p1',
      type: 'page',
      parentId: 'cat',
      name: 'Installation',
      index: null,
    },
    {
      id: 'p2',
      type: 'page',
      parentId: 'cat',
      name: 'Installation',
      index: null,
    },
    {
      id: 'p3',
      type: 'page',
      parentId: 'wiki',
      name: 'Accueil',
      index: 'a0',
      slug: 'home',
    },
    { id: 'p4', type: 'page', parentId: 'p3', name: 'Sous page' },
    { id: 'f', type: 'file', parentId: 'p3', name: 'x.png' },
  ];

  it('builds nested readable paths', () => {
    const tree = computeWikiTree('wiki', nodes);
    expect(tree.paths.get('wiki')).toBe('');
    expect(tree.paths.get('p3')).toBe('home');
    expect(tree.paths.get('p4')).toBe('home/sous-page');
    expect(tree.paths.get('cat')).toBe('guides');
    expect(tree.paths.get('p1')).toBe('guides/installation');
    expect(tree.paths.get('p2')).toBe('guides/installation-2');
    expect(tree.paths.has('f')).toBe(false);
    expect(tree.nodes.get('guides/installation-2')).toBe('p2');
  });

  it('orders siblings by their index', () => {
    const tree = computeWikiTree('wiki', nodes);
    expect(tree.children.get('wiki')?.map((node) => node.id)).toEqual([
      'p3',
      'cat',
    ]);
  });

  it('normalizes requested paths', () => {
    expect(normalizeWikiPath('/Guides//Installation/')).toBe(
      'guides/installation'
    );
    expect(normalizeWikiPath(undefined)).toBe('');
  });
});

describe('wiki block rendering', () => {
  it('escapes text and drops unsafe links', () => {
    const { html } = renderDocumentBlocks(
      'doc',
      {
        b1: block({
          id: 'b1',
          type: 'paragraph',
          parentId: 'doc',
          index: 'a0',
          content: [
            { type: 'text', text: '<script>alert(1)</script>' },
            {
              type: 'text',
              text: 'bad',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            {
              type: 'text',
              text: 'good',
              marks: [
                { type: 'link', attrs: { href: 'https://colanode.com' } },
              ],
            },
            { type: 'mention', attrs: { target: 'u1' } },
          ],
        }),
      },
      context
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://colanode.com"');
    expect(html).toContain('@Ada &lt;Lovelace&gt;');
  });

  it('renders headings with anchors, files and links in order', () => {
    const { html, headings } = renderDocumentBlocks(
      'doc',
      {
        h: block({
          id: 'h',
          type: 'heading1',
          parentId: 'doc',
          index: 'a0',
          content: [{ type: 'text', text: 'Mise en route' }],
        }),
        h2: block({
          id: 'h2',
          type: 'heading2',
          parentId: 'doc',
          index: 'a1',
          content: [{ type: 'text', text: 'Mise en route' }],
        }),
        img: block({ id: 'img', type: 'file', parentId: 'doc', index: 'a2' }),
        svg: block({ id: 'svg', type: 'file', parentId: 'doc', index: 'a3' }),
        page2: block({
          id: 'page2',
          type: 'page',
          parentId: 'doc',
          index: 'a4',
        }),
        hidden: block({
          id: 'hidden',
          type: 'page',
          parentId: 'doc',
          index: 'a5',
        }),
      },
      context
    );

    expect(headings.map((heading) => heading.id)).toEqual([
      'mise-en-route',
      'mise-en-route-2',
    ]);
    expect(html).toContain('<img src="/wiki/docs/_files/img/a.png"');
    expect(html).not.toContain('<img src="/wiki/docs/_files/svg');
    expect(html).toContain('href="/wiki/docs/_files/svg/a.svg" download');
    expect(html).toContain('href="/wiki/docs/page-2"');
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('page-2'));
  });

  it('keeps plantuml source escaped for the browser renderer', () => {
    const { html } = renderDocumentBlocks(
      'doc',
      {
        p: block({
          id: 'p',
          type: 'plantuml',
          parentId: 'doc',
          index: 'a0',
          attrs: { code: 'A -> B : <b>' },
        }),
      },
      context
    );
    expect(html).toContain('data-plantuml');
    expect(html).toContain('A -&gt; B : &lt;b&gt;');
  });
});

describe('wiki access links', () => {
  it('round-trips a link token', () => {
    const wikiId = '01jz8n2k3m4p5q6r7s8t9v0w1xwk';
    const { token } = generateWikiLinkToken(wikiId);
    expect(parseWikiLinkToken(token)?.wikiId).toBe(wikiId);
    expect(parseWikiLinkToken('nope')).toBeNull();
  });

  it('reads cookies', () => {
    expect(readCookie('a=1; colanode_wiki=x%3Dy', 'colanode_wiki')).toBe('x=y');
    expect(readCookie(undefined, 'colanode_wiki')).toBeNull();
  });
});
