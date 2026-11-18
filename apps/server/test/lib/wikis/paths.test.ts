import { describe, expect, it } from 'vitest';

import {
  baseSlugForNode,
  computeWikiTree,
  normalizeWikiPath,
  WIKI_ROUTABLE_TYPES,
  WikiTreeNode,
} from '@colanode/server/lib/wikis/paths';

const node = (
  id: string,
  parentId: string | null,
  name: string,
  extra: Partial<WikiTreeNode> = {}
): WikiTreeNode => ({ id, type: 'page', parentId, name, ...extra });

describe('WIKI_ROUTABLE_TYPES', () => {
  it('contains the routable node types only', () => {
    expect([...WIKI_ROUTABLE_TYPES].sort()).toEqual(
      ['category', 'database', 'folder', 'page', 'record'].sort()
    );
  });
});

describe('baseSlugForNode', () => {
  it('uses a valid explicit slug', () => {
    expect(baseSlugForNode(node('a', 'w', 'Ignored', { slug: 'custom' }))).toBe(
      'custom'
    );
  });

  it('falls back to the slugified name when the slug is invalid', () => {
    expect(
      baseSlugForNode(node('a', 'w', 'Premiers pas !', { slug: 'Bad Slug' }))
    ).toBe('premiers-pas');
  });

  it('falls back to the slugified name when the slug is empty or null', () => {
    expect(baseSlugForNode(node('a', 'w', 'Été', { slug: '' }))).toBe('ete');
    expect(baseSlugForNode(node('a', 'w', 'Été', { slug: null }))).toBe('ete');
  });

  it('falls back to the node type when the name has no slug characters', () => {
    expect(baseSlugForNode(node('a', 'w', '!!!', { type: 'folder' }))).toBe(
      'folder'
    );
    expect(
      baseSlugForNode({
        id: 'a',
        type: 'database',
        parentId: 'w',
        name: undefined as unknown as string,
      })
    ).toBe('database');
  });
});

describe('computeWikiTree', () => {
  it('maps the wiki itself to the empty path', () => {
    const tree = computeWikiTree('w', []);
    expect(tree.paths.get('w')).toBe('');
    expect(tree.nodes.get('')).toBe('w');
    expect(tree.children.size).toBe(0);
  });

  it('builds nested readable paths in both directions', () => {
    const tree = computeWikiTree('w', [
      node('w', null, 'Wiki', { type: 'wiki' }),
      node('guide', 'w', 'Guide'),
      node('install', 'guide', 'Installation'),
      node('linux', 'install', 'Sous Linux'),
    ]);

    expect(tree.paths.get('guide')).toBe('guide');
    expect(tree.paths.get('install')).toBe('guide/installation');
    expect(tree.paths.get('linux')).toBe('guide/installation/sous-linux');
    expect(tree.nodes.get('guide/installation/sous-linux')).toBe('linux');
    expect(tree.byId.get('install')?.name).toBe('Installation');
  });

  it('gives -2, -3 suffixes to colliding siblings in display order', () => {
    const tree = computeWikiTree('w', [
      node('c', 'w', 'Notes', { index: 'a2' }),
      node('a', 'w', 'Notes', { index: 'a0' }),
      node('b', 'w', 'notes', { index: 'a1' }),
    ]);

    expect(tree.paths.get('a')).toBe('notes');
    expect(tree.paths.get('b')).toBe('notes-2');
    expect(tree.paths.get('c')).toBe('notes-3');
    expect(tree.children.get('w')?.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('allows the same slug under different parents', () => {
    const tree = computeWikiTree('w', [
      node('p1', 'w', 'One'),
      node('p2', 'w', 'Two'),
      node('c1', 'p1', 'Intro'),
      node('c2', 'p2', 'Intro'),
    ]);

    expect(tree.paths.get('c1')).toBe('one/intro');
    expect(tree.paths.get('c2')).toBe('two/intro');
  });

  it('orders by index, then by id when indexes are missing or equal', () => {
    const tree = computeWikiTree('w', [
      node('z', 'w', 'Same', { index: 'a0' }),
      node('y', 'w', 'Same', { index: 'a0' }),
      node('m', 'w', 'Other'),
      node('k', 'w', 'Other'),
    ]);

    // Without index, the id is used as sort key ('a0' < 'k' < 'm').
    expect(tree.children.get('w')?.map((n) => n.id)).toEqual([
      'y',
      'z',
      'k',
      'm',
    ]);
    expect(tree.paths.get('y')).toBe('same');
    expect(tree.paths.get('z')).toBe('same-2');
    expect(tree.paths.get('k')).toBe('other');
    expect(tree.paths.get('m')).toBe('other-2');
  });

  it('orders siblings with equal indexes by id whatever the input order', () => {
    for (const ids of [
      ['p', 'q', 'r'],
      ['r', 'q', 'p'],
    ]) {
      const tree = computeWikiTree(
        'w',
        ids.map((id) => node(id, 'w', 'Twin', { index: 'a0' }))
      );
      expect(tree.children.get('w')?.map((n) => n.id)).toEqual(['p', 'q', 'r']);
      expect(tree.paths.get('p')).toBe('twin');
      expect(tree.paths.get('r')).toBe('twin-3');
    }
  });

  it('keeps nodes with the same index and id stable', () => {
    const tree = computeWikiTree('w', [
      node('a', 'w', 'First', { index: 'x' }),
      node('a', 'w', 'First', { index: 'x' }),
    ]);
    expect(tree.children.get('w')).toHaveLength(2);
  });

  it('skips non-routable types and root nodes without parent', () => {
    const tree = computeWikiTree('w', [
      node('chan', 'w', 'Channel', { type: 'channel' }),
      node('file', 'w', 'Image', { type: 'file' }),
      node('orphan', null, 'Orphan'),
      node('cat', 'w', 'Catégorie', { type: 'category' }),
      node('db', 'cat', 'Base', { type: 'database' }),
      node('rec', 'db', 'Ligne', { type: 'record' }),
      node('dir', 'w', 'Dossier', { type: 'folder' }),
    ]);

    expect(tree.paths.has('chan')).toBe(false);
    expect(tree.paths.has('file')).toBe(false);
    expect(tree.paths.has('orphan')).toBe(false);
    expect(tree.byId.has('chan')).toBe(true);
    expect(tree.paths.get('rec')).toBe('categorie/base/ligne');
    expect(tree.paths.get('dir')).toBe('dossier');
  });

  it('ignores nodes that are not reachable from the wiki', () => {
    const tree = computeWikiTree('w', [node('a', 'other-wiki', 'Elsewhere')]);
    expect(tree.paths.has('a')).toBe(false);
  });

  it('stops at a bounded depth on cyclic data', () => {
    const tree = computeWikiTree('w', [
      node('a', 'w', 'A'),
      node('b', 'a', 'B'),
      node('a', 'b', 'A'),
    ]);
    // Must terminate; the cycle path is bounded in length.
    const longest = Math.max(
      ...[...tree.nodes.keys()].map((p) => p.split('/').length)
    );
    expect(longest).toBeLessThanOrEqual(34);
    expect(tree.paths.has('a')).toBe(true);
  });

  it('uses explicit slugs and resolves collisions with them', () => {
    const tree = computeWikiTree('w', [
      node('a', 'w', 'Something', { slug: 'faq', index: 'a0' }),
      node('b', 'w', 'FAQ', { index: 'a1' }),
    ]);
    expect(tree.paths.get('a')).toBe('faq');
    expect(tree.paths.get('b')).toBe('faq-2');
  });
});

describe('normalizeWikiPath', () => {
  it('returns an empty string for empty input', () => {
    expect(normalizeWikiPath(undefined)).toBe('');
    expect(normalizeWikiPath(null)).toBe('');
    expect(normalizeWikiPath('')).toBe('');
    expect(normalizeWikiPath('///')).toBe('');
  });

  it('removes empty segments and lower-cases', () => {
    expect(normalizeWikiPath('/Guide//Installation/')).toBe(
      'guide/installation'
    );
  });

  it('decodes percent-encoded segments', () => {
    expect(normalizeWikiPath('caf%C3%A9/A%20B')).toBe('café/a b');
  });

  it('keeps malformed escape sequences as is', () => {
    expect(normalizeWikiPath('bad%E0%A4%A/ok')).toBe('bad%e0%a4%a/ok');
  });
});
