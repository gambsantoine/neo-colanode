import { describe, expect, it } from 'vitest';

import {
  channelModel,
  categoryModel,
  isValidWikiSlug,
  Node,
  slugify,
  uniqueSlug,
  wikiModel,
} from '@colanode/core';

const user = {
  id: 'user1',
  role: 'collaborator' as const,
  workspaceId: 'ws1',
  accountId: 'acc1',
};

const wiki = {
  id: 'wiki1',
  type: 'wiki',
  name: 'Docs',
  parentId: null,
  rootId: 'wiki1',
  collaborators: { user1: 'admin' },
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'user1',
  updatedAt: null,
  updatedBy: null,
} as Node;

describe('wiki slugs', () => {
  it('builds readable slugs from names', () => {
    expect(slugify('Premiers pas !')).toBe('premiers-pas');
    expect(slugify("L'API Réseau v2")).toBe('lapi-reseau-v2');
    expect(slugify('  --  ')).toBe('');
  });

  it('adds a suffix to duplicated slugs', () => {
    expect(uniqueSlug('install', new Set())).toBe('install');
    expect(uniqueSlug('install', new Set(['install', 'install-2']))).toBe(
      'install-3'
    );
  });

  it('validates wiki addresses', () => {
    expect(isValidWikiSlug('product-docs')).toBe(true);
    expect(isValidWikiSlug('ab')).toBe(false);
    expect(isValidWikiSlug('Docs')).toBe(false);
    expect(isValidWikiSlug('wiki')).toBe(false);
    expect(isValidWikiSlug('bad--slug')).toBe(false);
  });
});

describe('wiki node permissions', () => {
  it('lets a collaborator create a wiki they administrate', () => {
    expect(
      wikiModel.canCreate({
        user,
        tree: [],
        attributes: {
          type: 'wiki',
          name: 'Docs',
          collaborators: { user1: 'admin' },
        },
      })
    ).toBe(true);
  });

  it('refuses channels inside a wiki', () => {
    expect(
      channelModel.canCreate({
        user,
        tree: [wiki],
        attributes: { type: 'channel', name: 'Chat', parentId: 'wiki1' },
      })
    ).toBe(false);
  });

  it('allows categories directly in a wiki', () => {
    expect(
      categoryModel.canCreate({
        user,
        tree: [wiki],
        attributes: { type: 'category', name: 'Guides', parentId: 'wiki1' },
      })
    ).toBe(true);
  });
});
