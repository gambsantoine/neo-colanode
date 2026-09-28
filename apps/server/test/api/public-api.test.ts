import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  generateId,
  getNodeModel,
  IdType,
  NodeAttributes,
  UserStatus,
} from '@colanode/core';
import { encodeState, YDoc } from '@colanode/crdt';
import { database } from '@colanode/server/data/database';
import { generateApiKeyToken } from '@colanode/server/lib/api-key-tokens';

import { buildTestApp } from '../helpers/app';
import {
  createAccount,
  createPageNode,
  createSpaceNode,
  createUser,
  createWorkspace,
} from '../helpers/seed';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const createApiKey = async (accountId: string, workspaceId?: string) => {
  const apiKeyId = generateId(IdType.ApiKey);
  const { token, salt, hash } = generateApiKeyToken(apiKeyId);

  await database
    .insertInto('api_keys')
    .values({
      id: apiKeyId,
      account_id: accountId,
      workspace_id: workspaceId ?? null,
      name: 'test',
      token_hash: hash,
      token_salt: salt,
      created_at: new Date(),
    })
    .execute();

  return { authorization: `Bearer ${token}` };
};

const setup = async (email: string) => {
  const account = await createAccount({ email, password: 'Password123!' });
  const workspace = await createWorkspace({ createdBy: account.id });
  const user = await createUser({
    workspaceId: workspace.id,
    account,
    role: 'owner',
  });

  const spaceId = await createSpaceNode({
    workspaceId: workspace.id,
    userId: user.id,
    name: 'Engineering',
  });

  const headers = await createApiKey(account.id);
  return { account, workspace, user, spaceId, headers };
};

type ListBody<T> = {
  data: T[];
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
};

describe('public api: workspaces', () => {
  it('lists accessible workspaces with cursor pagination and ISO dates', async () => {
    const { account, workspace, headers } = await setup('api-ws@example.com');
    const other = await createWorkspace({ createdBy: account.id });
    await createUser({ workspaceId: other.id, account, role: 'collaborator' });

    const first = await app.inject({
      method: 'GET',
      url: '/api/workspaces?limit=1',
      headers,
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as ListBody<{
      id: string;
      createdAt: string;
    }>;
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.data[0]?.createdAt).toMatch(ISO_DATE);
    expect(firstBody.pagination.hasMore).toBe(true);

    const second = await app.inject({
      method: 'GET',
      url: `/api/workspaces?limit=1&cursor=${firstBody.pagination.nextCursor}`,
      headers,
    });

    const secondBody = second.json() as ListBody<{ id: string }>;
    expect(secondBody.pagination.hasMore).toBe(false);
    expect([firstBody.data[0]?.id, secondBody.data[0]?.id].sort()).toEqual(
      [workspace.id, other.id].sort()
    );
  });

  it('limits a workspace scoped key to its workspace', async () => {
    const { account, workspace } = await setup('api-scope@example.com');
    const other = await createWorkspace({ createdBy: account.id });
    await createUser({ workspaceId: other.id, account, role: 'owner' });
    const headers = await createApiKey(account.id, workspace.id);

    const list = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers,
    });
    const body = list.json() as ListBody<{ id: string }>;
    expect(body.data.map((item) => item.id)).toEqual([workspace.id]);

    const denied = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${other.id}`,
      headers,
    });
    expect(denied.statusCode).toBe(403);
  });

  it('rejects keys of users removed from the workspace', async () => {
    const { workspace, user, headers } = await setup('api-removed@example.com');
    await database
      .updateTable('users')
      .set({ status: UserStatus.Removed })
      .where('id', '=', user.id)
      .execute();

    const response = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspace.id}/spaces`,
      headers,
    });
    expect(response.statusCode).toBe(403);
  });

  it('answers 501 for operations that are not implemented', async () => {
    const { workspace, headers } = await setup('api-501@example.com');
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/workspaces/${workspace.id}`,
      headers,
    });
    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({ code: 'not_implemented' });
  });
});

describe('public api: spaces and nodes', () => {
  it('lists and searches spaces', async () => {
    const { workspace, user, headers } = await setup('api-spaces@example.com');
    await createSpaceNode({
      workspaceId: workspace.id,
      userId: user.id,
      name: 'Marketing',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspace.id}/spaces?search=engin`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as ListBody<{ name: string; role: string }>;
    expect(body.data.map((space) => space.name)).toEqual(['Engineering']);
    expect(body.data[0]?.role).toBe('admin');
  });

  it('lists and searches the nodes of a space', async () => {
    const { workspace, user, spaceId, headers } = await setup(
      'api-nodes@example.com'
    );

    for (const name of ['Roadmap', 'Retro notes', 'Hiring']) {
      await createPageNode({
        workspaceId: workspace.id,
        userId: user.id,
        parentId: spaceId,
        rootId: spaceId,
        name,
      });
    }

    const base = `/api/workspaces/${workspace.id}/spaces/${spaceId}/nodes`;
    const all = await app.inject({ method: 'GET', url: base, headers });
    const allBody = all.json() as ListBody<{ name: string; spaceId: string }>;
    expect(allBody.data).toHaveLength(3);
    expect(allBody.data.every((node) => node.spaceId === spaceId)).toBe(true);

    const search = await app.inject({
      method: 'GET',
      url: `${base}?search=r&type=page&limit=2`,
      headers,
    });
    const searchBody = search.json() as ListBody<{ name: string }>;
    expect(searchBody.data).toHaveLength(2);
    expect(searchBody.pagination.hasMore).toBe(true);
  });

  it('creates and updates nodes through Yjs updates', async () => {
    const { workspace, spaceId, headers } = await setup(
      'api-write@example.com'
    );
    const base = `/api/workspaces/${workspace.id}/spaces/${spaceId}/nodes`;

    const created = await app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: {
        attributes: { type: 'page', name: 'Draft', parentId: spaceId },
      },
    });

    expect(created.statusCode).toBe(201);
    const node = (created.json() as { data: { id: string; name: string } })
      .data;
    expect(node.name).toBe('Draft');

    const renamed = await app.inject({
      method: 'PATCH',
      url: `${base}/${node.id}`,
      headers,
      payload: { attributes: { name: 'Final' } },
    });

    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ data: { name: 'Final' } });

    // A raw Yjs update built from the state returned by the API.
    const withState = await app.inject({
      method: 'GET',
      url: `${base}/${node.id}?include=state`,
      headers,
    });
    const state = (withState.json() as { data: { state: string } }).data.state;
    const ydoc = new YDoc(state);
    const current = ydoc.getObject<NodeAttributes>();
    const update = ydoc.update(getNodeModel('page').attributesSchema, {
      ...current,
      name: 'From Yjs',
    });

    const patched = await app.inject({
      method: 'PATCH',
      url: `${base}/${node.id}`,
      headers,
      payload: { update: encodeState(update!) },
    });

    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ data: { name: 'From Yjs' } });

    const updates = await database
      .selectFrom('node_updates')
      .select('id')
      .where('node_id', '=', node.id)
      .execute();
    expect(updates).toHaveLength(3);
  });

  it('rejects parents outside the space and type changes', async () => {
    const { workspace, user, spaceId, headers } = await setup(
      'api-invalid@example.com'
    );
    const otherSpaceId = await createSpaceNode({
      workspaceId: workspace.id,
      userId: user.id,
    });
    const base = `/api/workspaces/${workspace.id}/spaces/${spaceId}/nodes`;

    const outside = await app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: {
        attributes: { type: 'page', name: 'Lost', parentId: otherSpaceId },
      },
    });
    expect(outside.statusCode).toBe(400);

    const pageId = await createPageNode({
      workspaceId: workspace.id,
      userId: user.id,
      parentId: spaceId,
      rootId: spaceId,
    });

    const retyped = await app.inject({
      method: 'PATCH',
      url: `${base}/${pageId}`,
      headers,
      payload: { attributes: { type: 'folder' } },
    });

    // The type is kept, so this is a no-op rather than an error.
    expect(retyped.statusCode).toBe(200);
    expect(retyped.json()).toMatchObject({ data: { type: 'page' } });
  });
});
