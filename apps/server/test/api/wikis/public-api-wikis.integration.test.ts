import { randomUUID } from 'crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateId, IdType } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { generateApiKeyToken } from '@colanode/server/lib/api-key-tokens';

import { buildTestApp } from '../../helpers/app';
import {
  createAccount,
  createSpaceNode,
  createUser,
  createWikiNode,
  createWorkspace,
} from '../../helpers/seed';

// Wikis through the public API used by the MCP server, on a real database.
const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const createApiKey = async (accountId: string) => {
  const apiKeyId = generateId(IdType.ApiKey);
  const { token, salt, hash } = generateApiKeyToken(apiKeyId);

  await database
    .insertInto('api_keys')
    .values({
      id: apiKeyId,
      account_id: accountId,
      workspace_id: null,
      name: 'test',
      token_hash: hash,
      token_salt: salt,
      created_at: new Date(),
    })
    .execute();

  return { authorization: `Bearer ${token}` };
};

describe('wikis in the public API (real database)', () => {
  it('lists wikis with spaces and gives the publication address', async () => {
    const account = await createAccount();
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });
    const headers = await createApiKey(account.id);

    const spaceId = await createSpaceNode({
      workspaceId: workspace.id,
      userId: user.id,
      name: 'Team',
    });
    const wikiId = await createWikiNode({
      workspaceId: workspace.id,
      userId: user.id,
      name: 'Docs',
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspace.id}/spaces`,
      headers,
    });
    expect(list.statusCode).toBe(200);
    const kinds = Object.fromEntries(
      list
        .json()
        .data.map((space: { id: string; kind: string }) => [
          space.id,
          space.kind,
        ])
    );
    expect(kinds).toEqual({ [spaceId]: 'space', [wikiId]: 'wiki' });

    const unpublished = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspace.id}/spaces/${wikiId}/publication`,
      headers,
    });
    expect(unpublished.statusCode).toBe(404);
    expect(unpublished.json().code).toBe('wiki_not_published');

    const slug = `api-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await database
      .insertInto('wiki_publications')
      .values({
        wiki_id: wikiId,
        workspace_id: workspace.id,
        slug,
        access: 'public',
        created_at: new Date(),
        created_by: user.id,
      })
      .execute();

    const published = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspace.id}/spaces/${wikiId}/publication`,
      headers,
    });
    expect(published.statusCode).toBe(200);
    expect(published.json().data).toEqual({
      wikiId,
      slug,
      access: 'public',
      path: `/wiki/${slug}`,
    });

    const page = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspace.id}/spaces/${wikiId}/nodes`,
      headers,
      payload: {
        attributes: { type: 'page', name: 'Guide', parentId: wikiId },
      },
    });
    expect(page.statusCode).toBe(201);

    const channel = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspace.id}/spaces/${wikiId}/nodes`,
      headers,
      payload: {
        attributes: { type: 'channel', name: 'Chat', parentId: wikiId },
      },
    });
    expect(channel.statusCode).toBe(403);
  });
});
