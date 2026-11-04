import { describe, expect, it, vi } from 'vitest';

import { SelectNode } from '@colanode/server/data/schema';
import {
  buildWikiCsp,
  flattenWikiNav,
  renderWikiPage,
  WikiPageView,
} from '@colanode/server/lib/wikis/layout';
import {
  computeWikiTree,
  WikiTreeNode,
} from '@colanode/server/lib/wikis/paths';
import { PublishedWiki } from '@colanode/server/lib/wikis/service';

vi.mock('@colanode/server/data/database', () => ({ database: {} }));
vi.mock('@colanode/server/data/redis', () => ({ redis: {} }));

interface NodeSpec {
  id: string;
  type: string;
  parentId: string | null;
  name: string;
}

const buildWiki = (
  specs: NodeSpec[],
  wikiName: string | null = 'Docs'
): PublishedWiki => {
  const all: NodeSpec[] = [
    { id: 'w', type: 'wiki', parentId: null, name: wikiName ?? '' },
    ...specs,
  ];
  const nodes = new Map<string, SelectNode>();
  for (const spec of all) {
    nodes.set(spec.id, {
      id: spec.id,
      type: spec.type,
      parent_id: spec.parentId,
      attributes:
        spec.id === 'w' && wikiName === null ? {} : { name: spec.name },
    } as unknown as SelectNode);
  }

  const treeNodes: WikiTreeNode[] = all.map((spec, position) => ({
    id: spec.id,
    type: spec.type,
    parentId: spec.parentId,
    name: spec.name,
    index: `a${String(position).padStart(3, '0')}`,
  }));

  return {
    publication: {} as PublishedWiki['publication'],
    wiki: nodes.get('w')!,
    nodes,
    tree: computeWikiTree('w', treeNodes),
    basePath: '/wiki/docs',
  };
};

// w
// ├── intro (page)
// │   └── intro-child (page)
// │       └── intro-grandchild (page)
// ├── guides (category)
// │   ├── install (page)
// │   │   └── linux (page)
// │   └── db (database)
// │       └── rec (record)
// └── dir (folder)
//     └── file-in-dir (page)
const sampleWiki = () =>
  buildWiki([
    { id: 'intro', type: 'page', parentId: 'w', name: 'Intro' },
    { id: 'intro-child', type: 'page', parentId: 'intro', name: 'Sub' },
    {
      id: 'intro-grandchild',
      type: 'page',
      parentId: 'intro-child',
      name: 'Deep',
    },
    { id: 'guides', type: 'category', parentId: 'w', name: 'Guides' },
    { id: 'install', type: 'page', parentId: 'guides', name: 'Install' },
    { id: 'linux', type: 'page', parentId: 'install', name: 'Linux' },
    { id: 'db', type: 'database', parentId: 'guides', name: 'Base' },
    { id: 'rec', type: 'record', parentId: 'db', name: 'Row' },
    { id: 'dir', type: 'folder', parentId: 'w', name: '' },
    { id: 'file-in-dir', type: 'page', parentId: 'dir', name: 'Inner' },
  ]);

const view = (
  wiki: PublishedWiki,
  overrides: Partial<WikiPageView> = {}
): WikiPageView => ({
  wiki,
  nodeId: 'w',
  title: 'Docs',
  contentHtml: '<p>Hello</p>',
  headings: [],
  updatedAt: null,
  description: null,
  nonce: 'n0nce',
  canonicalUrl: null,
  indexable: true,
  ...overrides,
});

const section = (html: string, start: string, end: string) => {
  const from = html.indexOf(start);
  if (from === -1) {
    return '';
  }
  const to = html.indexOf(end, from + start.length);
  return html.slice(from, to === -1 ? undefined : to + end.length);
};

const navOf = (html: string) =>
  section(html, '<nav class="nav"', '</nav>\n  <main>');

describe('flattenWikiNav', () => {
  it('lists pages, folders and databases in reading order', () => {
    expect(flattenWikiNav(sampleWiki())).toEqual([
      'intro',
      'intro-child',
      'intro-grandchild',
      'install',
      'linux',
      'db',
      'dir',
      'file-in-dir',
    ]);
  });

  it('limits the depth of the navigation', () => {
    const specs: NodeSpec[] = [];
    let parent = 'w';
    for (let i = 0; i < 8; i++) {
      specs.push({
        id: `p${i}`,
        type: 'page',
        parentId: parent,
        name: `P${i}`,
      });
      parent = `p${i}`;
    }
    expect(flattenWikiNav(buildWiki(specs))).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
  });
});

describe('renderWikiPage', () => {
  describe('head', () => {
    it('uses the wiki name as title on the home page', () => {
      const html = renderWikiPage(view(sampleWiki()));
      expect(html).toContain('<title>Docs</title>');
      expect(html).toContain('<meta property="og:site_name" content="Docs">');
      expect(html).toContain('<a class="brand" href="/wiki/docs">Docs</a>');
    });

    it('suffixes page titles with the wiki name and escapes them', () => {
      const html = renderWikiPage(
        view(sampleWiki(), { nodeId: 'intro', title: 'A <b> & "c"' })
      );
      expect(html).toContain(
        '<title>A &lt;b&gt; &amp; &quot;c&quot; · Docs</title>'
      );
      expect(html).toContain(
        '<h1 class="title">A &lt;b&gt; &amp; &quot;c&quot;</h1>'
      );
    });

    it('falls back to "Wiki" when the wiki has no name', () => {
      expect(
        renderWikiPage(view(buildWiki([], null), { title: 'Wiki' }))
      ).toContain('<title>Wiki</title>');
      expect(
        renderWikiPage(view(buildWiki([], '   '), { title: 'X' }))
      ).toContain('<title>X · Wiki</title>');
    });

    it('sets robots according to indexability', () => {
      expect(renderWikiPage(view(sampleWiki()))).toContain(
        '<meta name="robots" content="index, follow">'
      );
      expect(
        renderWikiPage(view(sampleWiki(), { indexable: false }))
      ).toContain('<meta name="robots" content="noindex, nofollow">');
    });

    it('adds description and canonical only when given', () => {
      const without = renderWikiPage(view(sampleWiki()));
      expect(without).not.toContain('name="description"');
      expect(without).not.toContain('rel="canonical"');

      const withMeta = renderWikiPage(
        view(sampleWiki(), {
          description: 'About "us"',
          canonicalUrl: 'https://x.test/wiki/docs',
        })
      );
      expect(withMeta).toContain(
        '<meta name="description" content="About &quot;us&quot;">'
      );
      expect(withMeta).toContain(
        '<link rel="canonical" href="https://x.test/wiki/docs">'
      );
    });

    it('uses the nonce on inline style and script', () => {
      const html = renderWikiPage(view(sampleWiki()));
      expect(html).toContain('<style nonce="n0nce">');
      expect(html).toContain('<script nonce="n0nce">');
    });
  });

  describe('search form', () => {
    it('points to the wiki search and keeps the query escaped', () => {
      const html = renderWikiPage(
        view(sampleWiki(), { searchQuery: '"><script>' })
      );
      expect(html).toContain('action="/wiki/docs/_search"');
      expect(html).toContain('value="&quot;&gt;&lt;script&gt;"');
      expect(renderWikiPage(view(sampleWiki()))).toContain('value=""');
    });
  });

  describe('navigation', () => {
    it('marks the home link as current on the home page', () => {
      const nav = navOf(renderWikiPage(view(sampleWiki())));
      expect(nav).toContain(
        '<ul><li><a href="/wiki/docs" aria-current="page">Accueil</a></li></ul>'
      );
      expect(nav.match(/aria-current/g)).toHaveLength(1);
    });

    it('renders categories as sections with their children', () => {
      const nav = navOf(renderWikiPage(view(sampleWiki())));
      expect(nav).toContain(
        '<li><div class="section"><a href="/wiki/docs/guides">Guides</a></div><ul><li><a href="/wiki/docs/guides/install">Install</a></li><li><a href="/wiki/docs/guides/base">Base</a></li></ul></li>'
      );
    });

    it('collapses nested pages outside the current branch', () => {
      const nav = navOf(renderWikiPage(view(sampleWiki())));
      expect(nav).not.toContain('Sub');
      expect(nav).not.toContain('Linux');
      expect(nav).not.toContain('Inner');
      expect(nav).not.toContain('Row');
    });

    it('expands the current branch and marks the current page', () => {
      const nav = navOf(
        renderWikiPage(
          view(sampleWiki(), { nodeId: 'intro-child', title: 'Sub' })
        )
      );
      expect(nav).toContain(
        '<a href="/wiki/docs/intro/sub" aria-current="page">Sub</a>'
      );
      expect(nav).toContain('/wiki/docs/intro/sub/deep');
      expect(nav).not.toContain('Linux');
      expect(nav.match(/aria-current/g)).toHaveLength(1);
      expect(nav).toContain('<a href="/wiki/docs">Accueil</a>');
    });

    it('stops expanding the current branch beyond the maximum depth', () => {
      const specs: NodeSpec[] = [];
      let parent = 'w';
      for (let i = 0; i < 8; i++) {
        specs.push({
          id: `p${i}`,
          type: 'page',
          parentId: parent,
          name: `Level${i}`,
        });
        parent = `p${i}`;
      }
      const nav = navOf(
        renderWikiPage(view(buildWiki(specs), { nodeId: 'p7', title: 'L7' }))
      );
      expect(nav).toContain('Level4');
      expect(nav).not.toContain('Level5');
    });

    it('never expands databases and names untitled nodes', () => {
      const nav = navOf(
        renderWikiPage(view(sampleWiki(), { nodeId: 'rec', title: 'Row' }))
      );
      expect(nav).not.toContain('Row');
      expect(nav).toContain('<a href="/wiki/docs/folder">Sans titre</a>');
    });

    it('marks a current category', () => {
      const nav = navOf(
        renderWikiPage(view(sampleWiki(), { nodeId: 'guides', title: 'G' }))
      );
      expect(nav).toContain(
        '<a href="/wiki/docs/guides" aria-current="page">Guides</a>'
      );
    });

    it('skips children without a published path', () => {
      const wiki = sampleWiki();
      wiki.tree.paths.delete('intro');
      const nav = navOf(renderWikiPage(view(wiki)));
      expect(nav).not.toContain('Intro');
    });

    it('omits the list when a wiki has no navigable children', () => {
      const nav = navOf(
        renderWikiPage(
          view(
            buildWiki([{ id: 'r', type: 'record', parentId: 'w', name: 'Rec' }])
          )
        )
      );
      expect(nav).toBe(
        '<nav class="nav" id="nav" aria-label="Navigation du wiki"><ul><li><a href="/wiki/docs" aria-current="page">Accueil</a></li></ul></nav>\n  <main>'
      );
    });
  });

  describe('breadcrumb', () => {
    it('is hidden on the home page', () => {
      expect(renderWikiPage(view(sampleWiki()))).not.toContain(
        'class="breadcrumb"'
      );
    });

    it('lists the ancestors of the current page', () => {
      const html = renderWikiPage(
        view(sampleWiki(), { nodeId: 'intro-grandchild', title: 'Deep' })
      );
      expect(html).toContain(
        '<nav class="breadcrumb" aria-label="Fil d\'Ariane"><a href="/wiki/docs">Accueil</a><span aria-hidden="true">/</span><a href="/wiki/docs/intro">Intro</a><span aria-hidden="true">/</span><a href="/wiki/docs/intro/sub">Sub</a></nav>'
      );
    });

    it('shows only the home link for a top level page', () => {
      const html = renderWikiPage(
        view(sampleWiki(), { nodeId: 'intro', title: 'Intro' })
      );
      expect(section(html, '<nav class="breadcrumb"', '</nav>')).toContain(
        '><a href="/wiki/docs">Accueil</a></nav>'
      );
    });

    it('names untitled ancestors and skips unpublished ones', () => {
      const wiki = sampleWiki();
      let html = renderWikiPage(
        view(wiki, { nodeId: 'file-in-dir', title: 'Inner' })
      );
      expect(section(html, '<nav class="breadcrumb"', '</nav>')).toContain(
        '<a href="/wiki/docs/folder">Sans titre</a>'
      );

      wiki.tree.paths.delete('dir');
      html = renderWikiPage(
        view(wiki, { nodeId: 'file-in-dir', title: 'Inner' })
      );
      expect(section(html, '<nav class="breadcrumb"', '</nav>')).not.toContain(
        'Sans titre'
      );
    });

    it('stops on an unknown node', () => {
      const html = renderWikiPage(
        view(sampleWiki(), { nodeId: 'ghost', title: 'Ghost' })
      );
      expect(section(html, '<nav class="breadcrumb"', '</nav>')).toContain(
        '><a href="/wiki/docs">Accueil</a></nav>'
      );
    });
  });

  describe('table of contents', () => {
    it('is hidden with fewer than two headings', () => {
      expect(renderWikiPage(view(sampleWiki()))).not.toContain('class="toc"');
      expect(
        renderWikiPage(
          view(sampleWiki(), { headings: [{ id: 'a', level: 2, text: 'A' }] })
        )
      ).not.toContain('class="toc"');
    });

    it('lists headings with their level and escaped text', () => {
      const html = renderWikiPage(
        view(sampleWiki(), {
          headings: [
            { id: 'a', level: 2, text: 'A & B' },
            { id: 'b"x', level: 3, text: 'B' },
            { id: 'c', level: 5, text: 'Too deep' },
          ],
        })
      );
      expect(html).toContain(
        '<aside class="toc" aria-label="Sur cette page"><p>Sur cette page</p><ul><li class="l2"><a href="#a">A &amp; B</a></li><li class="l3"><a href="#b&quot;x">B</a></li></ul></aside>'
      );
      expect(html).not.toContain('Too deep');
    });
  });

  describe('pager', () => {
    const pagerOf = (html: string) =>
      section(html, '<nav class="pager"', '</nav>');

    it('links the first page from the home page', () => {
      expect(pagerOf(renderWikiPage(view(sampleWiki())))).toBe(
        '<nav class="pager" aria-label="Pages"><a class="next" href="/wiki/docs/intro"><small>Suivant</small>Intro</a></nav>'
      );
    });

    it('links previous and next pages', () => {
      const pager = pagerOf(
        renderWikiPage(view(sampleWiki(), { nodeId: 'linux', title: 'Linux' }))
      );
      expect(pager).toBe(
        '<nav class="pager" aria-label="Pages"><a class="prev" href="/wiki/docs/guides/install"><small>Précédent</small>Install</a><a class="next" href="/wiki/docs/guides/base"><small>Suivant</small>Base</a></nav>'
      );
    });

    it('has no previous link on the first page and no next on the last', () => {
      const first = pagerOf(
        renderWikiPage(view(sampleWiki(), { nodeId: 'intro', title: 'Intro' }))
      );
      expect(first).not.toContain('class="prev"');
      expect(first).toContain('class="next"');

      const last = pagerOf(
        renderWikiPage(
          view(sampleWiki(), { nodeId: 'file-in-dir', title: 'Inner' })
        )
      );
      expect(last).toContain(
        '<a class="prev" href="/wiki/docs/folder"><small>Précédent</small>Sans titre</a>'
      );
      expect(last).not.toContain('class="next"');
    });

    it('is hidden for nodes outside the navigation', () => {
      expect(
        renderWikiPage(view(sampleWiki(), { nodeId: 'rec', title: 'Row' }))
      ).not.toContain('class="pager"');
      expect(
        renderWikiPage(view(sampleWiki(), { nodeId: 'guides', title: 'G' }))
      ).not.toContain('class="pager"');
    });

    it('is hidden when disabled or when the wiki is empty', () => {
      expect(
        renderWikiPage(view(sampleWiki(), { withPager: false }))
      ).not.toContain('class="pager"');
      expect(renderWikiPage(view(buildWiki([])))).not.toContain(
        'class="pager"'
      );
    });

    it('skips neighbours without a published path', () => {
      const wiki = sampleWiki();
      wiki.tree.byId.delete('intro');
      expect(renderWikiPage(view(wiki))).not.toContain('class="pager"');
    });
  });

  describe('content', () => {
    it('inserts the content HTML unescaped', () => {
      expect(
        renderWikiPage(
          view(sampleWiki(), { contentHtml: '<p>Raw <b>x</b></p>' })
        )
      ).toContain('<article><p>Raw <b>x</b></p></article>');
    });

    it('shows the update date in French when known', () => {
      const html = renderWikiPage(
        view(sampleWiki(), { updatedAt: new Date('2026-03-15T12:00:00Z') })
      );
      expect(html).toContain('<p class="meta">Mis à jour le 15 mars 2026</p>');
      expect(renderWikiPage(view(sampleWiki()))).not.toContain('class="meta"');
    });

    it('loads the PlantUML renderer only for PlantUML content', () => {
      const without = renderWikiPage(view(sampleWiki()));
      expect(without).not.toContain('type="module"');
      expect(without).not.toContain('_assets/plantuml');

      const html = renderWikiPage(
        view(sampleWiki(), {
          contentHtml:
            '<figure class="plantuml"><pre data-plantuml><code>A</code></pre></figure>',
        })
      );
      expect(html).toContain('<script nonce="n0nce" type="module">');
      expect(html).toContain('const base = "/wiki/docs/_assets/plantuml";');
      expect(html).toContain('script.nonce = "n0nce";');
    });
  });
});

describe('buildWikiCsp', () => {
  it('only allows the nonce scripts and same origin resources', () => {
    expect(buildWikiCsp('abc')).toBe(
      "default-src 'none'; " +
        "script-src 'self' 'nonce-abc' 'wasm-unsafe-eval'; " +
        "style-src 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "font-src 'self'; " +
        "connect-src 'self'; " +
        "form-action 'self'; " +
        "base-uri 'none'; " +
        "frame-ancestors 'none'"
    );
  });
});
