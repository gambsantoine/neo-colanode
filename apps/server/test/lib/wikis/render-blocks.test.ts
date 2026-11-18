import { describe, expect, it } from 'vitest';

import { Block, BlockLeaf } from '@colanode/core';
import {
  BlockRenderContext,
  INLINE_IMAGE_TYPES,
  renderDocumentBlocks,
  WikiFileTarget,
} from '@colanode/server/lib/wikis/render-blocks';

const files: Record<string, WikiFileTarget> = {
  png: {
    href: '/w/_files/png/a.png',
    name: 'a "b".png',
    mimeType: 'image/png',
    size: 10,
  },
  svg: {
    href: '/w/_files/svg/a.svg',
    name: 'a.svg',
    mimeType: 'image/svg+xml',
    size: 1023,
  },
  ko: {
    href: '/w/_files/ko/a.pdf',
    name: 'a.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 5 + 300,
  },
  mo: {
    href: '/w/_files/mo/a.zip',
    name: 'a.zip',
    mimeType: 'application/zip',
    size: 1024 * 1024 * 2.25,
  },
};

const context: BlockRenderContext = {
  nodeLink: (id) => {
    if (id === 'page-ok') {
      return { href: '/w/page?<x>', name: 'Page <1>', type: 'page' };
    }
    if (id === 'folder-ok') {
      return { href: '/w/dir', name: 'Dir', type: 'folder' };
    }
    return null;
  },
  file: (id) => files[id] ?? null,
  userName: (id) => (id === 'u1' ? 'Ada <Lovelace>' : null),
  database: (id) =>
    id === 'db-ok' ? '<figure class="database">DB</figure>' : null,
};

let counter = 0;
const block = (
  type: string,
  parentId: string,
  extra: Partial<Block> = {}
): Block => ({
  id: extra.id ?? `b${counter++}`,
  type,
  parentId,
  index: extra.index ?? `a${String(counter).padStart(4, '0')}`,
  ...extra,
});

const text = (value: string, marks?: BlockLeaf['marks']): BlockLeaf => ({
  type: 'text',
  text: value,
  marks,
});

const render = (blocks: Block[]) =>
  renderDocumentBlocks(
    'doc',
    Object.fromEntries(blocks.map((b) => [b.id, b])),
    context
  );

const html = (blocks: Block[]) => render(blocks).html;

describe('renderDocumentBlocks', () => {
  it('returns empty output for missing blocks', () => {
    expect(renderDocumentBlocks('doc', null, context)).toEqual({
      html: '',
      headings: [],
    });
    expect(renderDocumentBlocks('doc', undefined, context)).toEqual({
      html: '',
      headings: [],
    });
    expect(renderDocumentBlocks('doc', {}, context)).toEqual({
      html: '',
      headings: [],
    });
  });

  it('renders root blocks sorted by index', () => {
    expect(
      html([
        block('paragraph', 'doc', { index: 'a2', content: [text('second')] }),
        block('paragraph', 'doc', { index: 'a1', content: [text('first')] }),
        block('paragraph', 'other', { content: [text('elsewhere')] }),
      ])
    ).toBe('<p>first</p><p>second</p>');
  });

  it('keeps blocks with equal indexes', () => {
    const out = html([
      block('paragraph', 'doc', { index: 'a1', content: [text('x')] }),
      block('paragraph', 'doc', { index: 'a1', content: [text('y')] }),
    ]);
    expect(out).toContain('<p>x</p>');
    expect(out).toContain('<p>y</p>');
  });

  it('renders an empty paragraph and escapes text', () => {
    expect(html([block('paragraph', 'doc')])).toBe('<p></p>');
    expect(
      html([block('paragraph', 'doc', { content: [text('<b>&</b>')] })])
    ).toBe('<p>&lt;b&gt;&amp;&lt;/b&gt;</p>');
    expect(
      html([
        block('paragraph', 'doc', {
          content: [{ type: 'text', text: null }],
        }),
      ])
    ).toBe('<p></p>');
  });

  describe('headings', () => {
    it('maps heading1-3 to h2-h4 with anchors and collects them', () => {
      const result = render([
        block('heading1', 'doc', { content: [text('Intro')] }),
        block('heading2', 'doc', { content: [text('Détails ')] }),
        block('heading3', 'doc', {
          content: [text('Fin', [{ type: 'bold' }])],
        }),
      ]);

      expect(result.html).toBe(
        '<h2 id="intro"><a class="anchor" href="#intro" aria-hidden="true">#</a>Intro</h2>' +
          '<h3 id="details"><a class="anchor" href="#details" aria-hidden="true">#</a>Détails </h3>' +
          '<h4 id="fin"><a class="anchor" href="#fin" aria-hidden="true">#</a><strong>Fin</strong></h4>'
      );
      expect(result.headings).toEqual([
        { id: 'intro', level: 2, text: 'Intro' },
        { id: 'details', level: 3, text: 'Détails ' },
        { id: 'fin', level: 4, text: 'Fin' },
      ]);
    });

    it('gives unique anchors to duplicate and empty headings', () => {
      const result = render([
        block('heading1', 'doc', { content: [text('Notes')] }),
        block('heading2', 'doc', { content: [text('Notes')] }),
        block('heading2', 'doc', { content: [text('!!!')] }),
        block('heading3', 'doc'),
        block('heading3', 'doc', { content: [{ type: 'text', text: null }] }),
      ]);

      expect(result.headings.map((h) => h.id)).toEqual([
        'notes',
        'notes-2',
        'section',
        'section-2',
        'section-3',
      ]);
      expect(result.headings[3]!.text).toBe('');
    });

    it('resets anchors between documents', () => {
      const blocks = [block('heading1', 'doc', { content: [text('A')] })];
      expect(render(blocks).headings[0]!.id).toBe('a');
      expect(render(blocks).headings[0]!.id).toBe('a');
    });
  });

  it('renders quotes and lists with their children', () => {
    const quote = block('blockquote', 'doc', { id: 'q' });
    const ul = block('bulletList', 'doc', { id: 'ul' });
    const ol = block('orderedList', 'doc', { id: 'ol' });
    expect(
      html([
        quote,
        block('paragraph', 'q', { content: [text('quoted')] }),
        ul,
        block('listItem', 'ul', { id: 'li1' }),
        block('paragraph', 'li1', { content: [text('one')] }),
        ol,
        block('listItem', 'ol', { id: 'li2' }),
        block('paragraph', 'li2', { content: [text('two')] }),
      ])
    ).toBe(
      '<blockquote><p>quoted</p></blockquote>' +
        '<ul><li><p>one</p></li></ul>' +
        '<ol><li><p>two</p></li></ol>'
    );
  });

  it('renders task lists with checked and unchecked items', () => {
    expect(
      html([
        block('taskList', 'doc', { id: 'tl' }),
        block('taskItem', 'tl', { id: 't1', attrs: { checked: true } }),
        block('paragraph', 't1', { content: [text('done')] }),
        block('taskItem', 'tl', { id: 't2', attrs: { checked: false } }),
        block('taskItem', 'tl', { id: 't3', attrs: { checked: 'true' } }),
        block('taskItem', 'tl', { id: 't4' }),
      ])
    ).toBe(
      '<ul class="tasks">' +
        '<li class="task done"><span class="box" aria-label="Fait">✓</span><div><p>done</p></div></li>' +
        '<li class="task"><span class="box" aria-label="À faire"></span><div></div></li>' +
        '<li class="task"><span class="box" aria-label="À faire"></span><div></div></li>' +
        '<li class="task"><span class="box" aria-label="À faire"></span><div></div></li>' +
        '</ul>'
    );
  });

  it('renders horizontal rules', () => {
    expect(html([block('horizontalRule', 'doc')])).toBe('<hr>');
  });

  describe('code blocks', () => {
    it('renders escaped code with a language label', () => {
      expect(
        html([
          block('codeBlock', 'doc', {
            attrs: { language: '<ts>' },
            content: [text('const a = 1 < 2;'), text('\n'), { type: 'text' }],
          }),
        ])
      ).toBe(
        '<div class="code"><span class="code-lang">&lt;ts&gt;</span><pre><code>const a = 1 &lt; 2;\n</code></pre></div>'
      );
    });

    it('renders code without language and without content', () => {
      expect(
        html([block('codeBlock', 'doc', { attrs: { language: 42 } })])
      ).toBe('<div class="code"><pre><code></code></pre></div>');
      expect(html([block('codeBlock', 'doc')])).toBe(
        '<div class="code"><pre><code></code></pre></div>'
      );
    });

    it('does not render marks inside code', () => {
      expect(
        html([
          block('codeBlock', 'doc', {
            content: [text('x', [{ type: 'bold' }])],
          }),
        ])
      ).toBe('<div class="code"><pre><code>x</code></pre></div>');
    });
  });

  it('renders PlantUML source escaped with a marker attribute', () => {
    expect(
      html([
        block('plantuml', 'doc', {
          attrs: { code: '@startuml\nA -> B\n@enduml' },
        }),
      ])
    ).toBe(
      '<figure class="plantuml"><pre data-plantuml><code>@startuml\nA -&gt; B\n@enduml</code></pre><figcaption>Diagramme PlantUML</figcaption></figure>'
    );
    expect(html([block('plantuml', 'doc')])).toContain(
      '<pre data-plantuml><code></code></pre>'
    );
  });

  it('renders tables with header, cells and spans', () => {
    expect(
      html([
        block('table', 'doc', { id: 'tbl' }),
        block('tableRow', 'tbl', { id: 'r1' }),
        block('tableHeader', 'r1', {
          id: 'h1',
          attrs: { colspan: 2, rowspan: 1 },
        }),
        block('paragraph', 'h1', { content: [text('H')] }),
        block('tableRow', 'tbl', { id: 'r2' }),
        block('tableCell', 'r2', { id: 'c1', attrs: { rowspan: '3' } }),
        block('tableCell', 'r2', { id: 'c2', attrs: { colspan: 'x' } }),
        block('tableCell', 'r2', { id: 'c3' }),
      ])
    ).toBe(
      '<div class="table"><table><tbody>' +
        '<tr><th colspan="2"><p>H</p></th></tr>' +
        '<tr><td rowspan="3"></td><td></td><td></td></tr>' +
        '</tbody></table></div>'
    );
  });

  describe('files', () => {
    it('renders inline images with escaped attributes', () => {
      expect(html([block('file', 'doc', { id: 'png' })])).toBe(
        '<figure class="image"><img src="/w/_files/png/a.png" alt="a &quot;b&quot;.png" loading="lazy"></figure>'
      );
    });

    it('accepts all inline image types but not SVG', () => {
      expect([...INLINE_IMAGE_TYPES]).toEqual([
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/avif',
      ]);
      expect(INLINE_IMAGE_TYPES.has('image/svg+xml')).toBe(false);
    });

    it('renders other files as downloads with a readable size', () => {
      expect(html([block('file', 'doc', { id: 'svg' })])).toBe(
        '<a class="file" href="/w/_files/svg/a.svg" download><span class="file-name">a.svg</span><span class="file-size">1023 o</span></a>'
      );
      expect(html([block('file', 'doc', { id: 'ko' })])).toContain(
        '<span class="file-size">5 Ko</span>'
      );
      expect(html([block('file', 'doc', { id: 'mo' })])).toContain(
        '<span class="file-size">2.3 Mo</span>'
      );
    });

    it('renders nothing for a file that is not public', () => {
      expect(html([block('file', 'doc', { id: 'missing' })])).toBe('');
    });
  });

  describe('node links', () => {
    it('renders page and folder links', () => {
      expect(html([block('page', 'doc', { id: 'page-ok' })])).toBe(
        '<a class="node-link" href="/w/page?&lt;x&gt;"><span class="node-type">Page</span>Page &lt;1&gt;</a>'
      );
      expect(html([block('folder', 'doc', { id: 'folder-ok' })])).toBe(
        '<a class="node-link" href="/w/dir"><span class="node-type">Dossier</span>Dir</a>'
      );
    });

    it('renders nothing when the target is not published', () => {
      expect(html([block('page', 'doc', { id: 'private' })])).toBe('');
      expect(html([block('folder', 'doc', { id: 'private-dir' })])).toBe('');
    });
  });

  it('renders the database HTML given by the context', () => {
    expect(html([block('database', 'doc', { id: 'db-ok' })])).toBe(
      '<figure class="database">DB</figure>'
    );
    expect(html([block('database', 'doc', { id: 'db-private' })])).toBe('');
  });

  it('renders the content of unknown containers', () => {
    expect(
      html([
        block('columns', 'doc', { id: 'col' }),
        block('paragraph', 'col', { content: [text('inside')] }),
      ])
    ).toBe('<p>inside</p>');
    expect(html([block('mystery', 'doc')])).toBe('');
  });

  it('stops rendering deeply nested (cyclic) blocks', () => {
    // Corrupted data: a block that is its own child.
    const result = renderDocumentBlocks(
      'doc',
      {
        root: { id: 'x', type: 'blockquote', parentId: 'doc', index: 'a0' },
        loop: { id: 'x', type: 'blockquote', parentId: 'x', index: 'a0' },
      },
      context
    );
    const depth = result.html.split('<blockquote>').length - 1;
    expect(depth).toBe(51);
  });

  describe('inline leafs', () => {
    const inline = (leafs: BlockLeaf[]) =>
      html([block('paragraph', 'doc', { content: leafs })]);

    it('renders hard breaks', () => {
      expect(inline([text('a'), { type: 'hardBreak' }, text('b')])).toBe(
        '<p>a<br>b</p>'
      );
    });

    it('renders mentions with the user name, escaped', () => {
      expect(inline([{ type: 'mention', attrs: { target: 'u1' } }])).toBe(
        '<p><span class="mention">@Ada &lt;Lovelace&gt;</span></p>'
      );
    });

    it('renders unknown or invalid mentions with a placeholder', () => {
      expect(inline([{ type: 'mention', attrs: { target: 'u2' } }])).toBe(
        '<p><span class="mention">@utilisateur</span></p>'
      );
      expect(inline([{ type: 'mention', attrs: { target: 3 } }])).toBe(
        '<p><span class="mention">@utilisateur</span></p>'
      );
      expect(inline([{ type: 'mention' }])).toBe(
        '<p><span class="mention">@utilisateur</span></p>'
      );
    });

    it.each([
      ['bold', '<strong>x</strong>'],
      ['italic', '<em>x</em>'],
      ['underline', '<u>x</u>'],
      ['strike', '<s>x</s>'],
      ['code', '<code>x</code>'],
      ['highlight', '<mark>x</mark>'],
      ['unknownMark', 'x'],
    ])('renders the %s mark', (type, expected) => {
      expect(inline([text('x', [{ type }])])).toBe(`<p>${expected}</p>`);
    });

    it('nests marks in their order', () => {
      expect(inline([text('x', [{ type: 'bold' }, { type: 'italic' }])])).toBe(
        '<p><em><strong>x</strong></em></p>'
      );
    });

    it('renders safe links with escaped href and rel', () => {
      expect(
        inline([
          text('site', [
            { type: 'link', attrs: { href: 'https://a.test/?q="x"&y' } },
          ]),
        ])
      ).toBe(
        '<p><a href="https://a.test/?q=&quot;x&quot;&amp;y" rel="noopener noreferrer nofollow">site</a></p>'
      );
      expect(
        inline([
          text('mail', [{ type: 'link', attrs: { href: 'mailto:a@b.c' } }]),
        ])
      ).toContain('<a href="mailto:a@b.c"');
    });

    it('drops unsafe or missing link targets but keeps the text', () => {
      expect(
        inline([
          text('<x>', [
            { type: 'link', attrs: { href: 'javascript:alert(1)' } },
          ]),
        ])
      ).toBe('<p>&lt;x&gt;</p>');
      expect(inline([text('y', [{ type: 'link' }])])).toBe('<p>y</p>');
      expect(inline([text('z', [{ type: 'link', attrs: null }])])).toBe(
        '<p>z</p>'
      );
    });

    it('treats a null marks list as no marks', () => {
      expect(inline([text('x', null)])).toBe('<p>x</p>');
    });
  });
});
