import { describe, expect, it } from 'vitest';

import {
  categoryModel,
  channelModel,
  getNestedContentDepth,
  isSpaceLikeType,
  isValidSlug,
  isValidWikiSlug,
  MAX_SLUG_LENGTH,
  MIN_WIKI_SLUG_LENGTH,
  Node,
  NodeAttributes,
  RESERVED_WIKI_SLUGS,
  slugify,
  uniqueSlug,
  wikiModel,
  WorkspaceRole,
} from '@colanode/core';

const buildUser = (role: WorkspaceRole = 'collaborator') => ({
  id: 'user1',
  role,
  workspaceId: 'ws1',
  accountId: 'acc1',
});

const buildNode = (
  id: string,
  attributes: Record<string, unknown>,
  parentId: string | null = null
): Node =>
  ({
    id,
    parentId,
    rootId: 'wiki1',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user1',
    updatedAt: null,
    updatedBy: null,
    ...attributes,
  }) as unknown as Node;

const buildWiki = (
  collaborators: Record<string, string> = { user1: 'admin' }
) =>
  buildNode('wiki1', {
    type: 'wiki',
    name: 'Docs',
    collaborators,
  });

const wikiAttributes = (
  collaborators: Record<string, string> = { user1: 'admin' }
): NodeAttributes =>
  ({
    type: 'wiki',
    name: 'Docs',
    collaborators,
  }) as NodeAttributes;

describe('core/lib/slugs', () => {
  describe('slugify', () => {
    it('removes accents, apostrophes and punctuation', () => {
      expect(slugify('Premiers pas !')).toBe('premiers-pas');
      expect(slugify("L'API Réseau v2")).toBe('lapi-reseau-v2');
      expect(slugify('L’été à Paris')).toBe('lete-a-paris');
      expect(slugify('Ça  &  Là')).toBe('ca-la');
    });

    it('trims leading and trailing dashes', () => {
      expect(slugify('---hello---')).toBe('hello');
      expect(slugify('  --  ')).toBe('');
      expect(slugify('')).toBe('');
    });

    it('limits the slug length without leaving a trailing dash', () => {
      const long = `${'a'.repeat(MAX_SLUG_LENGTH - 1)} bcd`;
      const slug = slugify(long);
      expect(slug).toBe('a'.repeat(MAX_SLUG_LENGTH - 1));
      expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);

      expect(slugify('b'.repeat(100))).toBe('b'.repeat(MAX_SLUG_LENGTH));
    });
  });

  describe('isValidSlug', () => {
    it('accepts lowercase alphanumerics separated by single dashes', () => {
      expect(isValidSlug('a')).toBe(true);
      expect(isValidSlug('getting-started')).toBe(true);
      expect(isValidSlug('v2-api-3')).toBe(true);
      expect(isValidSlug('x'.repeat(MAX_SLUG_LENGTH))).toBe(true);
    });

    it('rejects empty, too long or badly formed slugs', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('x'.repeat(MAX_SLUG_LENGTH + 1))).toBe(false);
      expect(isValidSlug('Upper')).toBe(false);
      expect(isValidSlug('-start')).toBe(false);
      expect(isValidSlug('end-')).toBe(false);
      expect(isValidSlug('double--dash')).toBe(false);
      expect(isValidSlug('with space')).toBe(false);
      expect(isValidSlug('under_score')).toBe(false);
    });
  });

  describe('isValidWikiSlug', () => {
    it('requires a minimum length', () => {
      expect(MIN_WIKI_SLUG_LENGTH).toBe(3);
      expect(isValidWikiSlug('ab')).toBe(false);
      expect(isValidWikiSlug('abc')).toBe(true);
    });

    it('rejects reserved slugs', () => {
      for (const reserved of RESERVED_WIKI_SLUGS) {
        expect(isValidWikiSlug(reserved)).toBe(false);
      }
      expect(isValidWikiSlug('wikis')).toBe(true);
    });

    it('rejects invalid slugs', () => {
      expect(isValidWikiSlug('Docs')).toBe(false);
      expect(isValidWikiSlug('bad--slug')).toBe(false);
      expect(isValidWikiSlug('x'.repeat(MAX_SLUG_LENGTH + 1))).toBe(false);
    });
  });

  describe('uniqueSlug', () => {
    it('returns the base when free', () => {
      expect(uniqueSlug('install', new Set())).toBe('install');
      expect(uniqueSlug('install', new Set(['other']))).toBe('install');
    });

    it('adds the first free numeric suffix', () => {
      expect(uniqueSlug('install', new Set(['install']))).toBe('install-2');
      expect(
        uniqueSlug('install', new Set(['install', 'install-2', 'install-3']))
      ).toBe('install-4');
    });

    it('falls back to "page" for an empty base', () => {
      expect(uniqueSlug('', new Set())).toBe('page');
      expect(uniqueSlug('', new Set(['page']))).toBe('page-2');
    });
  });
});

describe('core/registry/nodes/wiki', () => {
  describe('canCreate', () => {
    it('allows a collaborator who administrates the new wiki', () => {
      expect(
        wikiModel.canCreate({
          user: buildUser('collaborator'),
          tree: [],
          attributes: wikiAttributes(),
        })
      ).toBe(true);
    });

    it('allows workspace admins and owners', () => {
      for (const role of ['admin', 'owner'] as const) {
        expect(
          wikiModel.canCreate({
            user: buildUser(role),
            tree: [],
            attributes: wikiAttributes(),
          })
        ).toBe(true);
      }
    });

    it('refuses a wiki with a parent tree', () => {
      expect(
        wikiModel.canCreate({
          user: buildUser(),
          tree: [buildWiki()],
          attributes: wikiAttributes(),
        })
      ).toBe(false);
    });

    it('refuses guests and users without a workspace role', () => {
      for (const role of ['guest', 'none'] as const) {
        expect(
          wikiModel.canCreate({
            user: buildUser(role),
            tree: [],
            attributes: wikiAttributes(),
          })
        ).toBe(false);
      }
    });

    it('refuses attributes of another node type', () => {
      expect(
        wikiModel.canCreate({
          user: buildUser(),
          tree: [],
          attributes: {
            type: 'space',
            name: 'Space',
            collaborators: { user1: 'admin' },
            visibility: 'private',
          } as NodeAttributes,
        })
      ).toBe(false);
    });

    it('refuses when the creator is not an admin of the wiki', () => {
      expect(
        wikiModel.canCreate({
          user: buildUser(),
          tree: [],
          attributes: wikiAttributes({ user1: 'editor' }),
        })
      ).toBe(false);
      expect(
        wikiModel.canCreate({
          user: buildUser(),
          tree: [],
          attributes: wikiAttributes({ user2: 'admin' }),
        })
      ).toBe(false);
      expect(
        wikiModel.canCreate({
          user: buildUser(),
          tree: [],
          attributes: wikiAttributes({}),
        })
      ).toBe(false);
    });
  });

  describe('canUpdateAttributes', () => {
    it('allows wiki admins only', () => {
      const adminWiki = buildWiki({ user1: 'admin' });
      expect(
        wikiModel.canUpdateAttributes({
          user: buildUser(),
          tree: [adminWiki],
          node: adminWiki,
          attributes: wikiAttributes(),
        })
      ).toBe(true);

      const editorWiki = buildWiki({ user1: 'editor' });
      expect(
        wikiModel.canUpdateAttributes({
          user: buildUser(),
          tree: [editorWiki],
          node: editorWiki,
          attributes: wikiAttributes(),
        })
      ).toBe(false);
    });

    it('refuses an empty tree or a non collaborator', () => {
      const wiki = buildWiki({ user2: 'admin' });
      expect(
        wikiModel.canUpdateAttributes({
          user: buildUser(),
          tree: [],
          node: wiki,
          attributes: wikiAttributes(),
        })
      ).toBe(false);
      expect(
        wikiModel.canUpdateAttributes({
          user: buildUser(),
          tree: [wiki],
          node: wiki,
          attributes: wikiAttributes(),
        })
      ).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('allows wiki admins only', () => {
      const adminWiki = buildWiki({ user1: 'admin' });
      expect(
        wikiModel.canDelete({
          user: buildUser(),
          tree: [adminWiki],
          node: adminWiki,
        })
      ).toBe(true);

      const editorWiki = buildWiki({ user1: 'editor' });
      expect(
        wikiModel.canDelete({
          user: buildUser(),
          tree: [editorWiki],
          node: editorWiki,
        })
      ).toBe(false);
    });

    it('refuses an empty tree', () => {
      expect(
        wikiModel.canDelete({ user: buildUser(), tree: [], node: buildWiki() })
      ).toBe(false);
    });
  });

  it('never allows document updates or reactions', () => {
    const wiki = buildWiki();
    expect(
      wikiModel.canUpdateDocument({
        user: buildUser(),
        tree: [wiki],
        node: wiki,
      })
    ).toBe(false);
    expect(
      wikiModel.canReact({ user: buildUser(), tree: [wiki], node: wiki })
    ).toBe(false);
  });

  describe('extractText', () => {
    it('returns the name and description', () => {
      expect(
        wikiModel.extractText('wiki1', {
          type: 'wiki',
          name: 'Docs',
          description: 'Product documentation',
          collaborators: {},
        } as NodeAttributes)
      ).toEqual({ name: 'Docs', attributes: 'Product documentation' });
    });

    it('returns null attributes without a description', () => {
      expect(wikiModel.extractText('wiki1', wikiAttributes())).toEqual({
        name: 'Docs',
        attributes: null,
      });
    });

    it('throws for another node type', () => {
      expect(() =>
        wikiModel.extractText('wiki1', {
          type: 'page',
          name: 'Page',
          parentId: 'wiki1',
        } as NodeAttributes)
      ).toThrow('Invalid node type');
    });
  });

  it('extracts no mentions', () => {
    expect(wikiModel.extractMentions('wiki1', wikiAttributes())).toEqual([]);
  });

  it('validates its attributes schema', () => {
    expect(
      wikiModel.attributesSchema.safeParse({
        type: 'wiki',
        name: 'Docs',
        collaborators: { user1: 'admin' },
        children: { page1: { id: 'page1', index: 'a0' } },
      }).success
    ).toBe(true);
    expect(
      wikiModel.attributesSchema.safeParse({
        type: 'wiki',
        name: 'Docs',
        collaborators: { user1: 'owner' },
      }).success
    ).toBe(false);
  });
});

describe('core/lib/nodes wiki helpers', () => {
  it('identifies space-like types', () => {
    expect(isSpaceLikeType('space')).toBe(true);
    expect(isSpaceLikeType('wiki')).toBe(true);
    expect(isSpaceLikeType('category')).toBe(false);
    expect(isSpaceLikeType('page')).toBe(false);
  });

  it('ignores wikis, spaces and categories in the nested content depth', () => {
    const wiki = buildWiki();
    const category = buildNode(
      'cat1',
      { type: 'category', name: 'Guides', parentId: 'wiki1' },
      'wiki1'
    );
    const folder = buildNode(
      'folder1',
      { type: 'folder', name: 'Folder', parentId: 'cat1' },
      'cat1'
    );
    const page = buildNode(
      'page1',
      { type: 'page', name: 'Page', parentId: 'folder1' },
      'folder1'
    );

    expect(getNestedContentDepth([wiki])).toBe(0);
    expect(getNestedContentDepth([wiki, category])).toBe(0);
    expect(getNestedContentDepth([wiki, category, folder, page])).toBe(2);
  });
});

describe('category and channel with a wiki parent', () => {
  it('allows wiki editors to create categories', () => {
    expect(
      categoryModel.canCreate({
        user: buildUser(),
        tree: [buildWiki({ user1: 'editor' })],
        attributes: {
          type: 'category',
          name: 'Guides',
          parentId: 'wiki1',
        } as NodeAttributes,
      })
    ).toBe(true);
  });

  it('refuses categories for wiki viewers or outside a space-like parent', () => {
    expect(
      categoryModel.canCreate({
        user: buildUser(),
        tree: [buildWiki({ user1: 'viewer' })],
        attributes: {
          type: 'category',
          name: 'Guides',
          parentId: 'wiki1',
        } as NodeAttributes,
      })
    ).toBe(false);

    const folder = buildNode(
      'folder1',
      { type: 'folder', name: 'Folder', parentId: 'wiki1' },
      'wiki1'
    );
    expect(
      categoryModel.canCreate({
        user: buildUser(),
        tree: [buildWiki(), folder],
        attributes: {
          type: 'category',
          name: 'Guides',
          parentId: 'folder1',
        } as NodeAttributes,
      })
    ).toBe(false);
  });

  it('refuses channels anywhere inside a wiki', () => {
    const category = buildNode(
      'cat1',
      { type: 'category', name: 'Guides', parentId: 'wiki1' },
      'wiki1'
    );
    expect(
      channelModel.canCreate({
        user: buildUser(),
        tree: [buildWiki(), category],
        attributes: {
          type: 'channel',
          name: 'Chat',
          parentId: 'cat1',
        } as NodeAttributes,
      })
    ).toBe(false);
  });

  it('still allows channels in a regular space', () => {
    const space = buildNode('space1', {
      type: 'space',
      name: 'Space',
      collaborators: { user1: 'editor' },
      visibility: 'private',
    });
    expect(
      channelModel.canCreate({
        user: buildUser(),
        tree: [space],
        attributes: {
          type: 'channel',
          name: 'Chat',
          parentId: 'space1',
        } as NodeAttributes,
      })
    ).toBe(true);
  });
});
