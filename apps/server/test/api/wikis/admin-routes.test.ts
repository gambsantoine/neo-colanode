import { fastify, FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorCode } from '@colanode/core';
import { errorHandler } from '@colanode/server/api/client/plugins/error-handler';
import { wikiRoutes } from '@colanode/server/api/client/routes/workspaces/wikis';
import { SelectNode } from '@colanode/server/data/schema';
import { fetchNodeTree } from '@colanode/server/lib/nodes';
import { verifyWikiLinkToken } from '@colanode/server/lib/wikis/publications';

import {
  ADMIN_ID,
  buildPublication,
  dbHooks,
  EDITOR_ID,
  node,
  resetDatabase,
  tables,
  WIKI_ID,
  WORKSPACE_ID,
} from './helpers';

vi.mock('@colanode/server/data/database', async () => {
  const helpers = await import('./helpers');
  return { database: helpers.fakeDatabase };
});

vi.mock('@colanode/server/data/redis', async () => {
  const helpers = await import('./helpers');
  return { redis: helpers.fakeRedis };
});

vi.mock('@colanode/server/lib/nodes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@colanode/server/lib/nodes')>()),
  fetchNodeTree: vi.fn(),
}));

const fetchTree = vi.mocked(fetchNodeTree);

const OTHER_WIKI_ID = 'other'.padEnd(28, '0');

let app: FastifyInstance;
let currentUserId = ADMIN_ID;

const wikiNode = (extra: Partial<SelectNode> = {}) =>
  node(
    WIKI_ID,
    'wiki',
    null,
    {
      name: 'Docs',
      collaborators: { [ADMIN_ID]: 'admin', [EDITOR_ID]: 'editor' },
    },
    extra
  );

const buildApp = async () => {
  const instance = fastify();
  instance.setValidatorCompiler(validatorCompiler);
  instance.setSerializerCompiler(serializerCompiler);
  instance.register(errorHandler);
  instance.decorateRequest('workspace');
  instance.addHook('onRequest', async (request) => {
    request.workspace = {
      id: WORKSPACE_ID,
      maxFileSize: '0',
      status: 1,
      user: { id: currentUserId, accountId: 'acc', role: 'owner' },
    } as never;
  });
  instance.register(wikiRoutes, { prefix: '/wikis' });
  await instance.ready();
  return instance;
};

const putPublication = (body: Record<string, unknown>, wikiId = WIKI_ID) =>
  app.inject({
    method: 'PUT',
    url: `/wikis/${wikiId}/publication`,
    payload: body,
  });

beforeEach(async () => {
  currentUserId = ADMIN_ID;
  resetDatabase({ wiki_publications: [] });
  fetchTree.mockReset();
  fetchTree.mockImplementation(async (id) =>
    id === WIKI_ID ? [wikiNode()] : []
  );
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
});

describe('GET /wikis/slug-availability', () => {
  it('normalizes and checks a free slug', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wikis/slug-availability?slug=%20My-Docs%20',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      slug: 'my-docs',
      valid: true,
      available: true,
    });
  });

  it('flags invalid and reserved slugs', async () => {
    for (const slug of ['ab', 'admin', 'not_valid']) {
      const response = await app.inject({
        method: 'GET',
        url: `/wikis/slug-availability?slug=${slug}`,
      });
      expect(response.json()).toMatchObject({ valid: false, available: false });
    }
  });

  it('reports slugs used by another wiki only', async () => {
    tables.wiki_publications = [
      buildPublication({ wiki_id: OTHER_WIKI_ID, slug: 'docs' }),
    ];

    const taken = await app.inject({
      method: 'GET',
      url: '/wikis/slug-availability?slug=docs',
    });
    expect(taken.json()).toMatchObject({ valid: true, available: false });

    const own = await app.inject({
      method: 'GET',
      url: `/wikis/slug-availability?slug=docs&wikiId=${OTHER_WIKI_ID}`,
    });
    expect(own.json()).toMatchObject({ valid: true, available: true });
  });
});

describe('admin checks', () => {
  const requests = () => [
    app.inject({ method: 'GET', url: `/wikis/${WIKI_ID}/publication` }),
    putPublication({ slug: 'docs', access: 'public' }),
    app.inject({ method: 'DELETE', url: `/wikis/${WIKI_ID}/publication` }),
    app.inject({ method: 'POST', url: `/wikis/${WIKI_ID}/publication/link` }),
  ];

  it('answers 404 when the node is not a wiki of the workspace', async () => {
    const cases: SelectNode[][] = [
      [],
      [node('child', 'page', null, {})],
      [node(WIKI_ID, 'space', null, {})],
      [wikiNode({ workspace_id: 'other-ws' })],
    ];

    for (const tree of cases) {
      fetchTree.mockResolvedValue(tree);
      for (const response of await Promise.all(requests())) {
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
          code: ApiErrorCode.WikiNotFound,
          message: 'Wiki not found.',
        });
      }
    }
  });

  it('answers 403 to members that are not admins of the wiki', async () => {
    for (const userId of [EDITOR_ID, 'stranger']) {
      currentUserId = userId;
      for (const response of await Promise.all(requests())) {
        expect(response.statusCode).toBe(403);
        expect(response.json().code).toBe(ApiErrorCode.WikiNoAccess);
      }
    }
    expect(tables.wiki_publications).toEqual([]);
  });
});

describe('GET /wikis/:wikiId/publication', () => {
  it('returns null for an unpublished wiki', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/wikis/${WIKI_ID}/publication`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publication: null });
  });

  it('returns the publication with its address', async () => {
    tables.wiki_publications = [buildPublication({ link_token_hash: 'h' })];
    const response = await app.inject({
      method: 'GET',
      url: `/wikis/${WIKI_ID}/publication`,
      headers: { host: 'colanode.test' },
    });
    expect(response.json()).toEqual({
      publication: {
        wikiId: WIKI_ID,
        slug: 'docs',
        access: 'public',
        homeNodeId: null,
        url: 'http://colanode.test/wiki/docs',
        hasLink: true,
        createdAt: '2026-01-02T10:00:00.000Z',
        updatedAt: null,
      },
    });
  });
});

describe('PUT /wikis/:wikiId/publication', () => {
  it('publishes a wiki', async () => {
    const response = await putPublication({
      slug: ' My-Docs ',
      access: 'link',
      homeNodeId: 'page-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      wikiId: WIKI_ID,
      slug: 'my-docs',
      access: 'link',
      homeNodeId: 'page-1',
      url: 'http://localhost/wiki/my-docs',
    });
    expect(tables.wiki_publications).toHaveLength(1);
    expect(tables.wiki_publications![0]).toMatchObject({
      workspace_id: WORKSPACE_ID,
      created_by: ADMIN_ID,
    });
  });

  it('updates the publication and keeps routes of the same slug', async () => {
    tables.wiki_publications = [buildPublication()];
    tables.wiki_routes = [{ wiki_id: WIKI_ID, path: 'a', node_id: 'n' }];

    const response = await putPublication({ slug: 'docs', access: 'link' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ access: 'link', homeNodeId: null });
    expect(response.json().updatedAt).not.toBeNull();
    expect(tables.wiki_publications![0]).toMatchObject({
      updated_by: ADMIN_ID,
    });
    expect(tables.wiki_routes).toHaveLength(1);
  });

  it('forgets the old routes when the slug changes', async () => {
    tables.wiki_publications = [buildPublication()];
    tables.wiki_routes = [
      { wiki_id: WIKI_ID, path: 'a', node_id: 'n' },
      { wiki_id: OTHER_WIKI_ID, path: 'b', node_id: 'm' },
    ];

    const response = await putPublication({
      slug: 'handbook',
      access: 'public',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().slug).toBe('handbook');
    expect(tables.wiki_routes).toEqual([
      { wiki_id: OTHER_WIKI_ID, path: 'b', node_id: 'm' },
    ]);
  });

  it('rejects invalid slugs', async () => {
    const response = await putPublication({ slug: 'API', access: 'public' });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe(ApiErrorCode.WikiSlugInvalid);
  });

  it('rejects bodies that do not match the schema', async () => {
    const response = await putPublication({ slug: 'docs', access: 'secret' });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe(ApiErrorCode.ValidationError);
  });

  it('rejects slugs used by another wiki', async () => {
    tables.wiki_publications = [
      buildPublication({ wiki_id: OTHER_WIKI_ID, slug: 'docs' }),
    ];
    const response = await putPublication({ slug: 'docs', access: 'public' });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(ApiErrorCode.WikiSlugTaken);
  });

  it('answers 409 when the database refuses the slug', async () => {
    dbHooks.beforeExecute = (query) => {
      if (query.kind === 'insert') {
        throw new Error('duplicate key value violates unique constraint');
      }
    };
    const response = await putPublication({ slug: 'docs', access: 'public' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: ApiErrorCode.WikiSlugTaken,
      message: 'This address is already used by another wiki.',
    });
  });
});

describe('DELETE /wikis/:wikiId/publication', () => {
  it('removes the publication and its routes', async () => {
    tables.wiki_publications = [
      buildPublication(),
      buildPublication({ wiki_id: OTHER_WIKI_ID, slug: 'other' }),
    ];
    tables.wiki_routes = [
      { wiki_id: WIKI_ID, path: 'a', node_id: 'n' },
      { wiki_id: OTHER_WIKI_ID, path: 'b', node_id: 'm' },
    ];

    const response = await app.inject({
      method: 'DELETE',
      url: `/wikis/${WIKI_ID}/publication`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(tables.wiki_publications!.map((row) => row.wiki_id)).toEqual([
      OTHER_WIKI_ID,
    ]);
    expect(tables.wiki_routes!.map((row) => row.wiki_id)).toEqual([
      OTHER_WIKI_ID,
    ]);
  });
});

describe('POST /wikis/:wikiId/publication/link', () => {
  it('requires a publication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/wikis/${WIKI_ID}/publication/link`,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe(ApiErrorCode.WikiNotPublished);
  });

  it('creates a new access link and revokes the previous one', async () => {
    tables.wiki_publications = [buildPublication({ access: 'link' })];

    const first = await app.inject({
      method: 'POST',
      url: `/wikis/${WIKI_ID}/publication/link`,
      headers: { host: 'colanode.test' },
    });
    expect(first.statusCode).toBe(200);
    const firstUrl: string = first.json().linkUrl;
    expect(firstUrl).toMatch(/^http:\/\/colanode\.test\/s\/cwl_/);
    const firstToken = firstUrl.split('/s/')[1]!;

    const publication = tables.wiki_publications![0] as never;
    expect(verifyWikiLinkToken(publication, firstToken)).toBe(true);
    expect(tables.wiki_publications![0]).toMatchObject({
      updated_by: ADMIN_ID,
    });

    const second = await app.inject({
      method: 'POST',
      url: `/wikis/${WIKI_ID}/publication/link`,
    });
    const secondToken = (second.json().linkUrl as string).split('/s/')[1]!;
    const updated = tables.wiki_publications![0] as never;
    expect(verifyWikiLinkToken(updated, secondToken)).toBe(true);
    expect(verifyWikiLinkToken(updated, firstToken)).toBe(false);
  });
});
