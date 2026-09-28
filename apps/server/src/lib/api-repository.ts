import { sql } from 'kysely';

import {
  ApiKeyVerifyResult,
  ApiRepository,
  ApiSpace,
  ApiWorkspace,
  ApiWorkspaceAccess,
} from '@colanode/api';
import {
  NodeType,
  SpaceAttributes,
  UserStatus,
  WorkspaceRole,
  WorkspaceStatus,
} from '@colanode/core';
import { YDoc } from '@colanode/crdt';
import { database } from '@colanode/server/data/database';
import { SelectNode, SelectWorkspace } from '@colanode/server/data/schema';
import {
  getApiDocument,
  updateApiDocument,
} from '@colanode/server/lib/api-documents';
import { verifyApiKeySecret } from '@colanode/server/lib/api-key-tokens';
import {
  createApiNode,
  fetchSpaceNode,
  mapApiNode,
  updateApiNode,
} from '@colanode/server/lib/api-nodes';
import { fetchNodeUpdates } from '@colanode/server/lib/nodes';

const escapeLikePattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, '\\$&')}%`;

const nameMatches = (search: string) =>
  sql<boolean>`nodes.attributes->>'name' ILIKE ${escapeLikePattern(search)}`;

const mapWorkspace = (
  workspace: SelectWorkspace,
  role: WorkspaceRole
): ApiWorkspace => ({
  id: workspace.id,
  name: workspace.name,
  description: workspace.description,
  avatar: workspace.avatar,
  role,
  status: workspace.status === WorkspaceStatus.Readonly ? 'readonly' : 'active',
  createdAt: workspace.created_at.toISOString(),
  updatedAt: workspace.updated_at?.toISOString() ?? null,
});

const mapSpace = (node: SelectNode, role: ApiSpace['role']): ApiSpace => {
  const attributes = node.attributes as SpaceAttributes;
  return {
    id: node.id,
    workspaceId: node.workspace_id,
    name: attributes.name,
    description: attributes.description ?? null,
    avatar: attributes.avatar ?? null,
    visibility: attributes.visibility,
    role,
    createdAt: node.created_at.toISOString(),
    createdBy: node.created_by,
    updatedAt: node.updated_at?.toISOString() ?? null,
    updatedBy: node.updated_by ?? null,
  };
};

// Spaces the user collaborates on are the ones synced to (and readable by) them.
const selectAccessibleSpaces = (access: ApiWorkspaceAccess) =>
  database
    .selectFrom('nodes')
    .innerJoin('collaborations', 'collaborations.node_id', 'nodes.id')
    .selectAll('nodes')
    .select('collaborations.role as collaboration_role')
    .where('nodes.workspace_id', '=', access.workspaceId)
    .where('nodes.type', '=', 'space')
    .where('collaborations.collaborator_id', '=', access.userId)
    .where('collaborations.deleted_at', 'is', null);

export const apiRepository: ApiRepository = {
  verifyApiKey: async (
    apiKeyId: string,
    secret: string
  ): Promise<ApiKeyVerifyResult | null> => {
    const apiKey = await database
      .selectFrom('api_keys')
      .selectAll()
      .where('id', '=', apiKeyId)
      .executeTakeFirst();

    if (!apiKey || apiKey.revoked_at) {
      return null;
    }

    if (!verifyApiKeySecret(secret, apiKey.token_salt, apiKey.token_hash)) {
      return null;
    }

    return {
      accountId: apiKey.account_id,
      workspaceId: apiKey.workspace_id,
    };
  },
  touchApiKeyLastUsed: async (apiKeyId: string): Promise<void> => {
    await database
      .updateTable('api_keys')
      .set({ last_used_at: new Date() })
      .where('id', '=', apiKeyId)
      .execute();
  },
  listWorkspaces: async (accountId, workspaceId, page) => {
    let query = database
      .selectFrom('workspaces')
      .innerJoin('users', 'users.workspace_id', 'workspaces.id')
      .selectAll('workspaces')
      .select('users.role as user_role')
      .where('users.account_id', '=', accountId)
      .where('users.status', '=', UserStatus.Active)
      .where('users.role', '!=', 'none')
      .where('workspaces.status', 'in', [
        WorkspaceStatus.Active,
        WorkspaceStatus.Readonly,
      ]);

    if (workspaceId) {
      query = query.where('workspaces.id', '=', workspaceId);
    }

    if (page.after) {
      query = query.where('workspaces.id', '>', page.after);
    }

    if (page.search) {
      query = query.where(
        sql<boolean>`workspaces.name ILIKE ${escapeLikePattern(page.search)}`
      );
    }

    const rows = await query
      .orderBy('workspaces.id', 'asc')
      .limit(page.limit + 1)
      .execute();

    return rows.map((row) => mapWorkspace(row, row.user_role));
  },
  getWorkspaceAccess: async (accountId, workspaceId) => {
    const row = await database
      .selectFrom('workspaces')
      .innerJoin('users', 'users.workspace_id', 'workspaces.id')
      .select([
        'workspaces.status as workspace_status',
        'users.id as user_id',
        'users.role as user_role',
        'users.status as user_status',
      ])
      .where('workspaces.id', '=', workspaceId)
      .where('users.account_id', '=', accountId)
      .executeTakeFirst();

    if (
      !row ||
      row.user_role === 'none' ||
      row.user_status !== UserStatus.Active ||
      (row.workspace_status !== WorkspaceStatus.Active &&
        row.workspace_status !== WorkspaceStatus.Readonly)
    ) {
      return null;
    }

    return {
      workspaceId,
      accountId,
      userId: row.user_id,
      role: row.user_role,
      readonly: row.workspace_status === WorkspaceStatus.Readonly,
    };
  },
  getWorkspace: async (access) => {
    const workspace = await database
      .selectFrom('workspaces')
      .selectAll()
      .where('id', '=', access.workspaceId)
      .executeTakeFirst();

    return workspace ? mapWorkspace(workspace, access.role) : null;
  },
  listSpaces: async (access, page) => {
    let query = selectAccessibleSpaces(access);

    if (page.after) {
      query = query.where('nodes.id', '>', page.after);
    }

    if (page.search) {
      query = query.where(nameMatches(page.search));
    }

    const rows = await query
      .orderBy('nodes.id', 'asc')
      .limit(page.limit + 1)
      .execute();

    return rows.map((row) => mapSpace(row, row.collaboration_role));
  },
  getSpace: async (access, spaceId) => {
    const row = await selectAccessibleSpaces(access)
      .where('nodes.id', '=', spaceId)
      .executeTakeFirst();

    return row ? mapSpace(row, row.collaboration_role) : null;
  },
  listNodes: async (access, spaceId, filters, page) => {
    let query = database
      .selectFrom('nodes')
      .selectAll()
      .where('workspace_id', '=', access.workspaceId)
      .where('root_id', '=', spaceId)
      .where('id', '!=', spaceId);

    if (filters.parentId) {
      query = query.where('parent_id', '=', filters.parentId);
    }

    if (filters.type) {
      query = query.where('type', '=', filters.type as NodeType);
    }

    if (page.after) {
      query = query.where('id', '>', page.after);
    }

    if (page.search) {
      query = query.where(nameMatches(page.search));
    }

    const rows = await query
      .orderBy('id', 'asc')
      .limit(page.limit + 1)
      .execute();

    return rows.map(mapApiNode);
  },
  getNode: async (access, spaceId, nodeId, includeState) => {
    const node = await fetchSpaceNode(access, spaceId, nodeId);
    if (!node) {
      return null;
    }

    const apiNode = mapApiNode(node);
    if (includeState) {
      const updates = await fetchNodeUpdates(node.id);
      const ydoc = new YDoc(updates.map((update) => update.data));
      apiNode.state = ydoc.getEncodedState();
    }

    return apiNode;
  },
  createNode: createApiNode,
  updateNode: updateApiNode,
  getDocument: getApiDocument,
  updateDocument: updateApiDocument,
};
