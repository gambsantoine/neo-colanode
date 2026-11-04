import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectWikiPublication } from '@colanode/server/data/schema';
import {
  fetchWikiPublicationBySlug,
  findWikiHome,
  isPublicFile,
  loadPublishedWiki,
  PublishedWiki,
  renderWikiNodeContent,
  resolveWikiPath,
  searchWiki,
  syncWikiRoutes,
  wikiFileHref,
  wikiHref,
} from '@colanode/server/lib/wikis/service';

import {
  buildDocuments,
  buildPublication,
  buildUsers,
  buildWikiNodes,
  dbHooks,
  installDocument,
  block,
  node,
  queries,
  redisStore,
  resetDatabase,
  tables,
  text,
  WIKI_ID,
  WORKSPACE_ID,
} from '../../api/wikis/helpers';

vi.mock('@colanode/server/data/database', async () => {
  const helpers = await import('../../api/wikis/helpers');
  return { database: helpers.fakeDatabase };
});

vi.mock('@colanode/server/data/redis', async () => {
  const helpers = await import('../../api/wikis/helpers');
  return { redis: helpers.fakeRedis };
});

const BASE = '/wiki/docs';

const publication = (extra: Record<string, unknown> = {}) =>
  buildPublication(extra) as SelectWikiPublication;

const load = async (
  extra: Record<string, unknown> = {}
): Promise<PublishedWiki> => {
  const wiki = await loadPublishedWiki(publication(extra), BASE);
  if (!wiki) {
    throw new Error('wiki not loaded');
  }
  return wiki;
};

beforeEach(() => {
  resetDatabase({
    nodes: [
      ...buildWikiNodes(),
      // Not public: never loaded.
      node('chan', 'channel', WIKI_ID, { name: 'General' }),
      // Other workspace.
      node(
        'foreign',
        'page',
        WIKI_ID,
        { name: 'Foreign' },
        {
          workspace_id: 'other-ws',
        }
      ),
    ],
    documents: buildDocuments(),
    users: buildUsers(),
    wiki_publications: [publication()],
  });
  redisStore.clear();
});

describe('fetchWikiPublicationBySlug', () => {
  it('returns the publication of a slug', async () => {
    expect(await fetchWikiPublicationBySlug('docs')).toMatchObject({
      wiki_id: WIKI_ID,
    });
    expect(await fetchWikiPublicationBySlug('nope')).toBeUndefined();
  });
});

describe('loadPublishedWiki', () => {
  it('loads the public nodes and computes the tree', async () => {
    const wiki = await load();

    expect(wiki.wiki.id).toBe(WIKI_ID);
    expect(wiki.basePath).toBe(BASE);
    expect(wiki.nodes.has('chan')).toBe(false);
    expect(wiki.nodes.has('foreign')).toBe(false);
    expect(Object.fromEntries(wiki.tree.paths)).toEqual({
      [WIKI_ID]: '',
      cat: 'guides',
      'page-install': 'guides/installation',
      'page-sub': 'guides/installation/details',
      db: 'guides/tasks',
      'rec-1': 'guides/tasks/first-task',
      'rec-2': 'guides/tasks/second-task',
      'folder-empty': 'empty',
      'page-blank': 'page',
    });
    expect(wiki.tree.children.get('cat')!.map((child) => child.id)).toEqual([
      'page-install',
      'db',
    ]);
  });

  it('returns null when the wiki node is missing or not a wiki', async () => {
    tables.nodes = tables.nodes!.filter((row) => row.id !== WIKI_ID);
    expect(await loadPublishedWiki(publication(), BASE)).toBeNull();

    resetDatabase({
      nodes: [node(WIKI_ID, 'page', null, { name: 'Not a wiki' })],
    });
    expect(await loadPublishedWiki(publication(), BASE)).toBeNull();
  });

  it('handles nodes without name, slug or index', async () => {
    resetDatabase({
      nodes: [
        node(WIKI_ID, 'wiki', null, {}),
        node('p', 'page', WIKI_ID, { slug: 'custom' }),
      ],
    });
    const wiki = await load();
    expect(wiki.tree.paths.get('p')).toBe('custom');
  });
});

describe('syncWikiRoutes', () => {
  it('stores the current routes and caches the fingerprint', async () => {
    const wiki = await load();
    tables.wiki_routes = [
      {
        wiki_id: WIKI_ID,
        path: 'old/path',
        node_id: 'page-install',
        is_current: true,
      },
      {
        wiki_id: WIKI_ID,
        path: 'guides',
        node_id: 'stale',
        is_current: false,
      },
    ];

    await syncWikiRoutes(wiki);

    const routes = tables.wiki_routes;
    expect(routes.find((row) => row.path === 'old/path')).toMatchObject({
      is_current: false,
    });
    expect(routes.find((row) => row.path === 'guides')).toMatchObject({
      node_id: 'cat',
      is_current: true,
    });
    expect(routes.filter((row) => row.is_current)).toHaveLength(
      wiki.tree.paths.size
    );
    expect(redisStore.get(`wiki:routes:${WIKI_ID}`)).toMatch(/^[0-9a-f]{64}$/);

    // Same tree: nothing is written again.
    queries.length = 0;
    await syncWikiRoutes(wiki);
    expect(queries).toHaveLength(0);
  });

  it('still syncs when redis fails', async () => {
    const wiki = await load();
    const { fakeRedis } = await import('../../api/wikis/helpers');
    const get = vi.spyOn(fakeRedis, 'get').mockRejectedValueOnce(new Error());
    const set = vi.spyOn(fakeRedis, 'set').mockRejectedValueOnce(new Error());

    await syncWikiRoutes(wiki);

    expect(tables.wiki_routes!.length).toBe(wiki.tree.paths.size);
    get.mockRestore();
    set.mockRestore();
  });

  it('only resets the routes of an empty tree', async () => {
    const wiki = await load();
    wiki.tree.paths.clear();
    tables.wiki_routes = [
      { wiki_id: WIKI_ID, path: 'x', node_id: 'cat', is_current: true },
    ];

    await syncWikiRoutes(wiki);

    expect(tables.wiki_routes).toEqual([
      { wiki_id: WIKI_ID, path: 'x', node_id: 'cat', is_current: false },
    ]);
    expect(queries.some((query) => query.kind === 'insert')).toBe(false);
  });
});

describe('resolveWikiPath', () => {
  it('finds current paths, redirects old ones and rejects unknown ones', async () => {
    const wiki = await load();
    tables.wiki_routes = [
      { wiki_id: WIKI_ID, path: 'old', node_id: 'page-install' },
      { wiki_id: WIKI_ID, path: 'old-home', node_id: WIKI_ID },
      { wiki_id: WIKI_ID, path: 'deleted', node_id: 'gone' },
    ];

    expect(await resolveWikiPath(wiki, 'guides/installation')).toEqual({
      type: 'found',
      nodeId: 'page-install',
    });
    expect(await resolveWikiPath(wiki, '')).toEqual({
      type: 'found',
      nodeId: WIKI_ID,
    });
    expect(await resolveWikiPath(wiki, 'old')).toEqual({
      type: 'redirect',
      path: 'guides/installation',
    });
    expect(await resolveWikiPath(wiki, 'old-home')).toEqual({
      type: 'redirect',
      path: '',
    });
    expect(await resolveWikiPath(wiki, 'deleted')).toEqual({
      type: 'not_found',
    });
    expect(await resolveWikiPath(wiki, 'never')).toEqual({
      type: 'not_found',
    });
  });
});

describe('links and files', () => {
  it('builds node and file addresses', async () => {
    const wiki = await load();
    expect(wikiHref(wiki, WIKI_ID)).toBe(BASE);
    expect(wikiHref(wiki, 'cat')).toBe(`${BASE}/guides`);
    expect(wikiHref(wiki, 'file-img')).toBeNull();

    expect(wikiFileHref(wiki, wiki.nodes.get('file-pdf')!)).toBe(
      `${BASE}/_files/file-pdf/guide%20%C3%A9.pdf`
    );
    expect(wikiFileHref(wiki, node('nameless', 'file', 'cat', {}))).toBe(
      `${BASE}/_files/nameless/fichier`
    );
  });

  it('only exposes ready files of the wiki', async () => {
    const wiki = await load();
    expect(isPublicFile(wiki, 'file-img')?.id).toBe('file-img');
    expect(isPublicFile(wiki, 'file-pending')).toBeNull();
    expect(isPublicFile(wiki, 'cat')).toBeNull();
    expect(isPublicFile(wiki, 'missing')).toBeNull();
  });
});

describe('findWikiHome', () => {
  it('uses the chosen page, or the first page under the wiki', async () => {
    expect(findWikiHome(await load({ home_node_id: 'page-install' }))).toBe(
      'page-install'
    );
    // A chosen node that is not a page is ignored.
    expect(findWikiHome(await load({ home_node_id: 'cat' }))).toBe(
      'page-blank'
    );
    expect(findWikiHome(await load())).toBe('page-blank');
  });

  it('returns null without any top-level page', async () => {
    resetDatabase({ nodes: [node(WIKI_ID, 'wiki', null, { name: 'W' })] });
    expect(findWikiHome(await load())).toBeNull();
  });
});

describe('renderWikiNodeContent', () => {
  it('renders the wiki root with its home page', async () => {
    const wiki = await load({ home_node_id: 'page-install' });
    const content = await renderWikiNodeContent(wiki, WIKI_ID);

    expect(content.title).toBe('Docs');
    expect(content.description).toBe('Documentation');
    expect(content.html).toContain('Getting started');
    expect(content.headings).toEqual([
      { id: 'getting-started', level: 2, text: 'Getting started' },
    ]);
  });

  it('renders the list of sections of a wiki without home page', async () => {
    resetDatabase({
      nodes: [
        node(WIKI_ID, 'wiki', null, {}, { updated_at: new Date(5) }),
        node('cat', 'category', WIKI_ID, { name: '' }),
        node('f', 'file', WIKI_ID, {
          name: 'a.txt',
          status: 1,
          mimeType: 'text/plain',
        }),
      ],
    });
    const content = await renderWikiNodeContent(await load(), WIKI_ID);

    expect(content.title).toBe('Sans titre');
    expect(content.description).toBeNull();
    expect(content.updatedAt).toEqual(new Date(5));
    expect(content.html).toBe(
      `<ul class="children"><li><a href="${BASE}/category">Sans titre</a></li></ul>` +
        `<h2>Fichiers</h2><ul class="children files"><li><a href="${BASE}/_files/f/a.txt" download>a.txt</a></li></ul>`
    );
  });

  it('renders a page with mentions, files, links, database and subpages', async () => {
    const wiki = await load();
    const content = await renderWikiNodeContent(wiki, 'page-install');
    const html = content.html;

    expect(content.title).toBe('Installation');
    expect(content.updatedAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    expect(content.description).toBeNull();
    // Mention resolved with the custom name, escaped.
    expect(html).toContain('@Ada &lt;Admin&gt;');
    expect(html).toContain('@utilisateur');
    // Inline image, downloadable file, pending file hidden.
    expect(html).toContain(
      `<img src="${BASE}/_files/file-img/diagram.png" alt="diagram.png"`
    );
    expect(html).toContain(`href="${BASE}/_files/file-pdf/guide%20%C3%A9.pdf"`);
    expect(html).not.toContain('pending.png');
    // Link to a subpage, unknown pages are dropped.
    expect(html).toContain(
      `<a class="node-link" href="${BASE}/guides/installation/details"><span class="node-type">Page</span>Details</a>`
    );
    // Inline database block.
    expect(html).toContain(
      `<figcaption><a href="${BASE}/guides/tasks">Tasks</a></figcaption>`
    );
    expect(html).toContain('<td>Ada &lt;Admin&gt;</td>');
    expect(html).toContain('<td>Bob</td>');
    // Subpages section.
    expect(html).toContain(
      `<h2>Dans cette section</h2><ul class="children"><li><a href="${BASE}/guides/installation/details">Details</a></li></ul>`
    );
  });

  it('renders a database with every field type', async () => {
    const wiki = await load();
    const content = await renderWikiNodeContent(wiki, 'db');
    const html = content.html;

    expect(content.headings).toEqual([]);
    expect(html).toContain(
      '<thead><tr><th>Title</th><th>Done</th><th>Status</th><th>Tags</th><th>Owner</th><th>Due</th><th>Link</th><th>Files</th><th>Related</th><th>Notes</th><th>Points</th></tr></thead>'
    );

    const [first, second] = html
      .split('<tr>')
      .filter((row) => row.includes('task</a>'));

    expect(first).toBe(
      [
        `<td><a href="${BASE}/guides/tasks/first-task">First task</a></td>`,
        '<td>✓</td>',
        '<td><span class="tag">Open</span></td>',
        '<td><span class="tag">A</span> <span class="tag">B</span></td>',
        '<td>Ada &lt;Admin&gt;</td>',
        '<td>04/03/2026</td>',
        '<td><a href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer nofollow">https://example.com/?a=1&amp;b=2</a></td>',
        `<td><a href="${BASE}/_files/file-img/diagram.png" download>diagram.png</a></td>`,
        `<td><a href="${BASE}/guides/installation">Installation</a></td>`,
        '<td>Some &lt;notes&gt;</td>',
        '<td>42</td></tr>',
      ].join('')
    );

    expect(second).toBe(
      [
        `<td><a href="${BASE}/guides/tasks/second-task">Second task</a></td>`,
        '<td></td>',
        '<td></td>',
        '<td></td>',
        '<td>Bob</td>',
        '<td></td>',
        '<td>javascript:alert(1)</td>',
        '<td></td>',
        '<td></td>',
        '<td>x, y</td>',
        '<td></td></tr></tbody></table></div></figure>',
      ].join('')
    );
  });

  it('renders an empty database without fields', async () => {
    resetDatabase({
      nodes: [
        node(WIKI_ID, 'wiki', null, { name: 'W' }),
        node('db', 'database', WIKI_ID, { name: 'Empty <db>' }),
      ],
    });
    const content = await renderWikiNodeContent(await load(), 'db');

    expect(content.html).toBe(
      `<figure class="database"><figcaption><a href="${BASE}/empty-db">Empty &lt;db&gt;</a></figcaption><div class="table"><table><thead><tr><th>Nom</th></tr></thead><tbody><tr><td colspan="1" class="muted">Aucun enregistrement</td></tr></tbody></table></div></figure>`
    );
  });

  it('renders a record with its fields and document', async () => {
    const wiki = await load();
    const content = await renderWikiNodeContent(wiki, 'rec-1');

    expect(content.title).toBe('First task');
    expect(content.html).toMatch(
      /^<dl class="fields"><div><dt>Done<\/dt><dd>✓<\/dd><\/div>/
    );
    expect(content.html).toContain(
      '<div><dt>Due</dt><dd>04/03/2026</dd></div>'
    );
    expect(content.html).toContain('<p>Record body</p>');
    // Created date is used when the document was never updated.
    expect(content.updatedAt).toEqual(new Date('2026-01-02T10:00:00Z'));
  });

  // Bug: the users of collaborator fields are only fetched for databases, so
  // a record page never shows its collaborator values.
  it('shows the collaborator fields of a record', async () => {
    const content = await renderWikiNodeContent(await load(), 'rec-1');
    expect(content.html).toContain(
      '<div><dt>Owner</dt><dd>Ada &lt;Admin&gt;</dd></div>'
    );
  });

  it('renders a record without values or database as empty', async () => {
    resetDatabase({
      nodes: [
        node(WIKI_ID, 'wiki', null, { name: 'W' }),
        node('db', 'database', WIKI_ID, {
          name: 'D',
          fields: {
            f: { id: 'f', type: 'text', name: 'F', index: 'a0' },
          },
        }),
        node('r1', 'record', 'db', { name: 'R1', databaseId: 'db' }),
        node('r2', 'record', 'db', { name: 'R2', databaseId: 'missing' }),
      ],
    });
    const wiki = await load();

    expect((await renderWikiNodeContent(wiki, 'r1')).html).toBe(
      '<p class="muted">Cette page est vide.</p>'
    );
    expect((await renderWikiNodeContent(wiki, 'r2')).html).toBe(
      '<p class="muted">Cette page est vide.</p>'
    );
  });

  it('renders categories and folders as child lists', async () => {
    const wiki = await load();

    const category = await renderWikiNodeContent(wiki, 'cat');
    expect(category.html).toContain(
      `<ul class="children"><li><a href="${BASE}/guides/installation">Installation</a></li><li><a href="${BASE}/guides/tasks">Tasks</a></li></ul>`
    );
    expect(category.html).toContain('<h2>Fichiers</h2>');
    expect(category.html).toContain('diagram.png');
    expect(category.html).not.toContain('pending.png');

    const folder = await renderWikiNodeContent(wiki, 'folder-empty');
    expect(folder.html).toBe('<p class="muted">Cette section est vide.</p>');
  });

  it('renders a page without rich text document as empty', async () => {
    const wiki = await load();
    const content = await renderWikiNodeContent(wiki, 'page-blank');

    expect(content.title).toBe('Sans titre');
    expect(content.html).toBe('<p class="muted">Cette page est vide.</p>');
    expect(content.updatedAt).toEqual(new Date('2026-01-02T10:00:00Z'));
  });

  it('ignores database blocks that do not point to a database', async () => {
    tables.documents!.push(
      installDocument('folder-empty', {}),
      installDocument('page-sub-doc', {})
    );
    tables.documents = tables.documents!.filter((row) => row.id !== 'page-sub');
    tables.documents.push(
      installDocument('page-sub', {
        x: block('x', 'database', 'page-sub', 'a0'),
        p: block('p', 'paragraph', 'page-sub', 'a1', {
          content: [text('After')],
        }),
      })
    );
    const content = await renderWikiNodeContent(await load(), 'page-sub');
    expect(content.html).toBe('<p>After</p>');
  });

  it('does not query users when nobody is mentioned', async () => {
    resetDatabase({
      nodes: [
        node(WIKI_ID, 'wiki', null, { name: 'W' }),
        node('p', 'page', WIKI_ID, { name: 'P' }),
      ],
      documents: [
        installDocument('p', {
          a: block('a', 'paragraph', 'p', 'a0', { content: [text('Hi')] }),
        }),
      ],
    });
    await renderWikiNodeContent(await load(), 'p');
    expect(queries.some((query) => query.table === 'users')).toBe(false);
  });
});

describe('searchWiki', () => {
  it('returns nothing without usable terms', async () => {
    const wiki = await load();
    expect(await searchWiki(wiki, '')).toEqual([]);
    expect(await searchWiki(wiki, ' a  b ')).toEqual([]);
  });

  it('scores titles above text and builds excerpts', async () => {
    const wiki = await load();
    const results = await searchWiki(wiki, 'Installation');

    expect(results).toEqual([
      {
        href: `${BASE}/guides/installation`,
        title: 'Installation',
        // Title only match: the excerpt is the start of the text.
        excerpt: 'Getting started Install the server with npm. Ask',
      },
      {
        href: `${BASE}/guides/installation/details`,
        title: 'Details',
        excerpt: 'Nested details about installation steps',
      },
    ]);
  });

  it('matches body text and trims long excerpts', async () => {
    const long = `${'lorem ipsum '.repeat(20)}needle${' dolor sit'.repeat(30)}`;
    tables.documents!.push(
      installDocument('cat', {
        p: block('p', 'paragraph', 'cat', 'a0', { content: [text(long)] }),
      })
    );
    const wiki = await load();
    const [result] = await searchWiki(wiki, 'needle');

    expect(result!.title).toBe('Guides');
    expect(result!.excerpt.startsWith('…')).toBe(true);
    expect(result!.excerpt.endsWith('…')).toBe(true);
    expect(result!.excerpt).toContain('needle');
    expect(result!.excerpt.length).toBeLessThanOrEqual(182);
  });

  it('skips nodes missing from the wiki and the wiki root itself', async () => {
    const wiki = await load();
    wiki.tree.paths.set('ghost', 'ghost');
    expect(await searchWiki(wiki, 'docs ghost')).toEqual([]);
  });

  it('does not query documents for a wiki without pages', async () => {
    resetDatabase({ nodes: [node(WIKI_ID, 'wiki', null, { name: 'W' })] });
    expect(await searchWiki(await load(), 'anything')).toEqual([]);
    expect(queries.some((query) => query.table === 'documents')).toBe(false);
  });

  it('keeps the workspace of the wiki for user lookups', async () => {
    const wiki = await load();
    await renderWikiNodeContent(wiki, 'page-install');
    const usersQuery = queries.find((query) => query.table === 'users')!;
    expect(usersQuery.wheres[0]).toEqual({
      column: 'workspace_id',
      op: '=',
      value: WORKSPACE_ID,
    });
    dbHooks.beforeExecute = null;
  });
});
