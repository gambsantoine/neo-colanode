import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateId, IdType, WorkspaceStatus } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { updateNode } from '@colanode/server/lib/nodes';
import { deleteWikiPublication } from '@colanode/server/lib/wikis/cleanup';

import { buildTestApp } from '../../helpers/app';
import {
  buildAuthHeader,
  createAccount,
  createCategoryNode,
  createDevice,
  createPageNode,
  createUser,
  createWikiNode,
  createWorkspace,
} from '../../helpers/seed';

// End to end on a real Postgres: migration, publication API, readable
// addresses, redirects after a rename, access links and search.
const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const setDocument = async (
  nodeId: string,
  workspaceId: string,
  userId: string,
  text: string
) => {
  await database
    .insertInto('documents')
    .values({
      id: nodeId,
      workspace_id: workspaceId,
      revision: '1',
      content: JSON.stringify({
        type: 'rich_text',
        blocks: {
          [`${nodeId}-b1`]: {
            id: `${nodeId}-b1`,
            type: 'paragraph',
            parentId: nodeId,
            index: 'a0',
            content: [{ type: 'text', text }],
          },
        },
      }),
      created_at: new Date(),
      created_by: userId,
    })
    .execute();
};

// The start of an id is its timestamp: take random characters instead.
const uniqueSuffix = () => generateId(IdType.Wiki).slice(14, 24);

const setup = async (slugSuffix: string) => {
  const account = await createAccount();
  const workspace = await createWorkspace({ createdBy: account.id });
  const user = await createUser({
    workspaceId: workspace.id,
    account,
    role: 'owner',
  });
  const { token } = await createDevice({ accountId: account.id });

  const wikiId = await createWikiNode({
    workspaceId: workspace.id,
    userId: user.id,
    name: 'Product Docs',
  });
  const homeId = await createPageNode({
    workspaceId: workspace.id,
    userId: user.id,
    parentId: wikiId,
    rootId: wikiId,
    name: 'Accueil',
  });
  const categoryId = await createCategoryNode({
    workspaceId: workspace.id,
    userId: user.id,
    parentId: wikiId,
    rootId: wikiId,
    name: 'Guides',
  });
  const pageId = await createPageNode({
    workspaceId: workspace.id,
    userId: user.id,
    parentId: categoryId,
    rootId: wikiId,
    name: 'Premiers pas',
  });

  await setDocument(homeId, workspace.id, user.id, 'Bienvenue dans la doc');
  await setDocument(pageId, workspace.id, user.id, 'Installer le serveur');

  return {
    workspace,
    user,
    wikiId,
    pageId,
    slug: `docs-${slugSuffix}`,
    headers: buildAuthHeader(token),
    base: `/client/v1/workspaces/${workspace.id}/wikis/${wikiId}`,
  };
};

describe('wiki publication (real database)', () => {
  it('publishes a wiki at readable addresses', async () => {
    const ctx = await setup(uniqueSuffix());

    const unpublished = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}`,
    });
    expect(unpublished.statusCode).toBe(404);

    const publish = await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: ctx.slug, access: 'public' },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json()).toMatchObject({ slug: ctx.slug, access: 'public' });

    const home = await app.inject({ method: 'GET', url: `/wiki/${ctx.slug}` });
    expect(home.statusCode).toBe(200);
    expect(home.headers['content-security-policy']).toContain(
      "default-src 'none'"
    );
    expect(home.body).toContain('Bienvenue dans la doc');
    expect(home.body).toContain('Premiers pas');

    const page = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}/guides/premiers-pas`,
    });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Installer le serveur');

    const search = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}/_search?q=serveur`,
    });
    expect(search.statusCode).toBe(200);
    expect(search.body).toContain(`/wiki/${ctx.slug}/guides/premiers-pas`);

    const sitemap = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}/sitemap.xml`,
    });
    expect(sitemap.statusCode).toBe(200);
    expect(sitemap.body).toContain('/guides/premiers-pas</loc>');
  });

  it('redirects old addresses after a rename', async () => {
    const ctx = await setup(uniqueSuffix());
    await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: ctx.slug, access: 'public' },
    });
    await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}/guides/premiers-pas`,
    });

    const renamed = await updateNode({
      nodeId: ctx.pageId,
      userId: ctx.user.id,
      workspaceId: ctx.workspace.id,
      updater(attributes) {
        if (attributes.type !== 'page') {
          throw new Error('Not a page');
        }
        attributes.name = 'Démarrage rapide';
        return attributes;
      },
    });
    expect(renamed).toBe(true);

    const old = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}/guides/premiers-pas`,
    });
    expect(old.statusCode).toBe(301);
    expect(old.headers.location).toBe(
      `/wiki/${ctx.slug}/guides/demarrage-rapide`
    );
  });

  it('protects a wiki published with an access link', async () => {
    const ctx = await setup(uniqueSuffix());
    await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: ctx.slug, access: 'link' },
    });

    const link = await app.inject({
      method: 'POST',
      url: `${ctx.base}/publication/link`,
      headers: ctx.headers,
    });
    expect(link.statusCode).toBe(200);
    const linkPath = new URL(link.json().linkUrl).pathname;

    const anonymous = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}`,
    });
    expect(anonymous.statusCode).toBe(404);

    const open = await app.inject({ method: 'GET', url: linkPath });
    expect(open.statusCode).toBe(302);
    const cookie = String(open.headers['set-cookie']).split(';')[0]!;

    const reader = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}`,
      headers: { cookie },
    });
    expect(reader.statusCode).toBe(200);
    expect(reader.headers['x-robots-tag']).toContain('noindex');

    // A new link revokes the previous one.
    await app.inject({
      method: 'POST',
      url: `${ctx.base}/publication/link`,
      headers: ctx.headers,
    });
    const revoked = await app.inject({
      method: 'GET',
      url: `/wiki/${ctx.slug}`,
      headers: { cookie },
    });
    expect(revoked.statusCode).toBe(404);
  });

  it('refuses a slug already used and unpublishes', async () => {
    const first = await setup(uniqueSuffix());
    const second = await setup('unused');
    await app.inject({
      method: 'PUT',
      url: `${first.base}/publication`,
      headers: first.headers,
      payload: { slug: first.slug, access: 'public' },
    });

    const taken = await app.inject({
      method: 'PUT',
      url: `${second.base}/publication`,
      headers: second.headers,
      payload: { slug: first.slug, access: 'public' },
    });
    expect(taken.statusCode).toBe(409);

    const removed = await app.inject({
      method: 'DELETE',
      url: `${first.base}/publication`,
      headers: first.headers,
    });
    expect(removed.statusCode).toBe(200);
    const gone = await app.inject({
      method: 'GET',
      url: `/wiki/${first.slug}`,
    });
    expect(gone.statusCode).toBe(404);
  });

  it('answers 304 while the wiki is unchanged, and refreshes after an edit', async () => {
    const ctx = await setup(uniqueSuffix());
    await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: ctx.slug, access: 'public' },
    });

    const url = `/wiki/${ctx.slug}/guides/premiers-pas`;
    const first = await app.inject({ method: 'GET', url });
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^W\//);

    const unchanged = await app.inject({
      method: 'GET',
      url,
      headers: { 'if-none-match': etag },
    });
    expect(unchanged.statusCode).toBe(304);

    await database
      .updateTable('documents')
      .set({
        revision: '999999',
        content: JSON.stringify({
          type: 'rich_text',
          blocks: {
            b: {
              id: 'b',
              type: 'paragraph',
              parentId: ctx.pageId,
              index: 'a0',
              content: [{ type: 'text', text: 'Nouvelle version' }],
            },
          },
        }),
      })
      .where('id', '=', ctx.pageId)
      .execute();

    const changed = await app.inject({
      method: 'GET',
      url,
      headers: { 'if-none-match': etag },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.body).toContain('Nouvelle version');
  });

  it('keeps link readers signed in when the address changes', async () => {
    const ctx = await setup(uniqueSuffix());
    await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: ctx.slug, access: 'link' },
    });
    const link = await app.inject({
      method: 'POST',
      url: `${ctx.base}/publication/link`,
      headers: ctx.headers,
    });
    const open = await app.inject({
      method: 'GET',
      url: new URL(link.json().linkUrl).pathname,
    });
    const setCookie = String(open.headers['set-cookie']);
    expect(setCookie).toContain('Path=/wiki/;');
    const cookie = setCookie.split(';')[0]!;

    const renamedSlug = `${ctx.slug}-v2`;
    await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: renamedSlug, access: 'link' },
    });

    const reader = await app.inject({
      method: 'GET',
      url: `/wiki/${renamedSlug}`,
      headers: { cookie },
    });
    expect(reader.statusCode).toBe(200);
  });

  it('stops serving a disabled workspace and frees a deleted wiki address', async () => {
    const ctx = await setup(uniqueSuffix());
    await app.inject({
      method: 'PUT',
      url: `${ctx.base}/publication`,
      headers: ctx.headers,
      payload: { slug: ctx.slug, access: 'public' },
    });
    expect(
      (await app.inject({ method: 'GET', url: `/wiki/${ctx.slug}` })).statusCode
    ).toBe(200);

    await database
      .updateTable('workspaces')
      .set({ status: WorkspaceStatus.Inactive })
      .where('id', '=', ctx.workspace.id)
      .execute();
    expect(
      (await app.inject({ method: 'GET', url: `/wiki/${ctx.slug}` })).statusCode
    ).toBe(404);

    await deleteWikiPublication(ctx.wikiId);
    const publication = await database
      .selectFrom('wiki_publications')
      .selectAll()
      .where('slug', '=', ctx.slug)
      .executeTakeFirst();
    expect(publication).toBeUndefined();
  });
});
