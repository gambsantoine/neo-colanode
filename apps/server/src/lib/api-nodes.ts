import {
  ApiNode,
  ApiNodeCreateInput,
  ApiNodeUpdateInput,
  ApiNodeWriteResult,
  ApiWorkspaceAccess,
} from '@colanode/api';
import {
  generateId,
  getNodeModel,
  IdType,
  MutationStatus,
  NodeAttributes,
  NodeType,
  WorkspaceStatus,
} from '@colanode/core';
import { decodeState, encodeState, YDoc } from '@colanode/crdt';
import { database } from '@colanode/server/data/database';
import { SelectNode } from '@colanode/server/data/schema';
import {
  createNodeFromMutation,
  fetchNode,
  fetchNodeTree,
  fetchNodeUpdates,
  updateNodeFromMutation,
} from '@colanode/server/lib/nodes';
import { WorkspaceContext } from '@colanode/server/types/api';

export const mapApiNode = (node: SelectNode): ApiNode => {
  const attributes = node.attributes as unknown as Record<string, unknown>;
  const name = attributes.name;

  return {
    id: node.id,
    workspaceId: node.workspace_id,
    spaceId: node.root_id,
    parentId: node.parent_id,
    type: node.type,
    name: typeof name === 'string' ? name : null,
    attributes,
    revision: node.revision.toString(),
    createdAt: node.created_at.toISOString(),
    createdBy: node.created_by,
    updatedAt: node.updated_at?.toISOString() ?? null,
    updatedBy: node.updated_by ?? null,
  };
};

/** A node of the space other than the space itself, or null. */
export const fetchSpaceNode = async (
  access: ApiWorkspaceAccess,
  spaceId: string,
  nodeId: string
): Promise<SelectNode | null> => {
  if (nodeId === spaceId) {
    return null;
  }

  const node = await database
    .selectFrom('nodes')
    .selectAll()
    .where('id', '=', nodeId)
    .where('root_id', '=', spaceId)
    .where('workspace_id', '=', access.workspaceId)
    .executeTakeFirst();

  return node ?? null;
};

// Node types the API can create inside a space. Spaces and chats are roots
// and files need an upload, so they are left out.
const CREATABLE_NODE_ID_TYPES: Partial<Record<NodeType, IdType>> = {
  category: IdType.Category,
  channel: IdType.Channel,
  database: IdType.Database,
  database_view: IdType.DatabaseView,
  folder: IdType.Folder,
  message: IdType.Message,
  page: IdType.Page,
  record: IdType.Record,
};

export const toWorkspaceContext = (
  access: ApiWorkspaceAccess
): WorkspaceContext => ({
  id: access.workspaceId,
  status: access.readonly ? WorkspaceStatus.Readonly : WorkspaceStatus.Active,
  user: {
    id: access.userId,
    accountId: access.accountId,
    role: access.role,
  },
});

const getParentId = (attributes: NodeAttributes): string | null =>
  'parentId' in attributes && typeof attributes.parentId === 'string'
    ? attributes.parentId
    : null;

const validateAttributes = (
  attributes: NodeAttributes
): { valid: true } | { valid: false; message: string } => {
  const result = getNodeModel(attributes.type).attributesSchema.safeParse(
    attributes
  );

  if (!result.success) {
    return { valid: false, message: result.error.message };
  }

  return { valid: true };
};

/** The parent must belong to the space and must not be the node itself or one of its descendants. */
const validateParent = async (
  access: ApiWorkspaceAccess,
  spaceId: string,
  parentId: string | null,
  nodeId: string
): Promise<string | null> => {
  if (!parentId) {
    return '"parentId" is required.';
  }

  if (parentId !== spaceId) {
    const parent = await fetchSpaceNode(access, spaceId, parentId);
    if (!parent) {
      return '"parentId" must be the space or one of its nodes.';
    }
  }

  const tree = await fetchNodeTree(parentId);
  if (parentId === nodeId || tree.some((ancestor) => ancestor.id === nodeId)) {
    return 'A node cannot be moved inside itself.';
  }

  return null;
};

const mapStatus = async (
  status: MutationStatus,
  nodeId: string
): Promise<ApiNodeWriteResult> => {
  if (status === MutationStatus.OK || status === MutationStatus.CREATED) {
    const node = await fetchNode(nodeId);
    return node
      ? { type: 'success', data: mapApiNode(node) }
      : { type: 'failed' };
  }

  if (status === MutationStatus.FORBIDDEN) {
    return { type: 'forbidden' };
  }

  if (status === MutationStatus.NOT_FOUND) {
    return { type: 'not_found' };
  }

  return { type: 'failed' };
};

/**
 * Creates a node through the same Yjs mutation path as the apps: the
 * attributes become a Yjs state, then `createNodeFromMutation` checks
 * permissions, stores the update and notifies synced clients.
 */
export const createApiNode = async (
  access: ApiWorkspaceAccess,
  spaceId: string,
  input: ApiNodeCreateInput
): Promise<ApiNodeWriteResult> => {
  const ydoc = new YDoc();
  try {
    if (input.update) {
      ydoc.applyUpdate(decodeState(input.update));
    } else {
      const attributes = input.attributes as NodeAttributes;
      const idType = CREATABLE_NODE_ID_TYPES[attributes?.type];
      if (!idType) {
        return {
          type: 'invalid',
          message: `Nodes of type "${String(attributes?.type)}" cannot be created.`,
        };
      }

      ydoc.update(getNodeModel(attributes.type).attributesSchema, attributes);
    }
  } catch {
    return { type: 'invalid', message: 'Invalid node attributes or update.' };
  }

  const attributes = ydoc.getObject<NodeAttributes>();
  const idType = CREATABLE_NODE_ID_TYPES[attributes.type];
  if (!idType) {
    return {
      type: 'invalid',
      message: `Nodes of type "${String(attributes.type)}" cannot be created.`,
    };
  }

  const validation = validateAttributes(attributes);
  if (!validation.valid) {
    return { type: 'invalid', message: validation.message };
  }

  const nodeId = input.id ?? generateId(idType);
  if (nodeId.length > 30) {
    return { type: 'invalid', message: '"id" must be at most 30 characters.' };
  }

  const existing = await database
    .selectFrom('nodes')
    .select('id')
    .where('id', '=', nodeId)
    .executeTakeFirst();

  if (existing) {
    return { type: 'conflict', message: `Node "${nodeId}" already exists.` };
  }

  const parentError = await validateParent(
    access,
    spaceId,
    getParentId(attributes),
    nodeId
  );

  if (parentError) {
    return { type: 'invalid', message: parentError };
  }

  const status = await createNodeFromMutation(toWorkspaceContext(access), {
    nodeId,
    updateId: generateId(IdType.Update),
    createdAt: new Date().toISOString(),
    data: ydoc.getEncodedState(),
  });

  return mapStatus(status, nodeId);
};

/**
 * Updates a node with a Yjs update: either the caller's own update, or one
 * computed from the shallow merge of `attributes` into the current state.
 * `updateNodeFromMutation` then checks permissions and syncs it.
 */
export const updateApiNode = async (
  access: ApiWorkspaceAccess,
  spaceId: string,
  nodeId: string,
  input: ApiNodeUpdateInput
): Promise<ApiNodeWriteResult> => {
  const node = await fetchSpaceNode(access, spaceId, nodeId);
  if (!node) {
    return { type: 'not_found' };
  }

  const nodeUpdates = await fetchNodeUpdates(nodeId);
  const ydoc = new YDoc(nodeUpdates.map((nodeUpdate) => nodeUpdate.data));
  const current = ydoc.getObject<NodeAttributes>();

  let update: Uint8Array | null;
  try {
    if (input.update) {
      update = decodeState(input.update);
      ydoc.applyUpdate(update);
    } else {
      const merged = {
        ...current,
        ...input.attributes,
        type: current.type,
      } as NodeAttributes;

      update = ydoc.update(getNodeModel(current.type).attributesSchema, merged);
    }
  } catch {
    return { type: 'invalid', message: 'Invalid node attributes or update.' };
  }

  if (!update) {
    return { type: 'success', data: mapApiNode(node) };
  }

  const attributes = ydoc.getObject<NodeAttributes>();
  if (attributes.type !== current.type) {
    return { type: 'invalid', message: 'The node type cannot be changed.' };
  }

  const validation = validateAttributes(attributes);
  if (!validation.valid) {
    return { type: 'invalid', message: validation.message };
  }

  const parentId = getParentId(attributes);
  if (parentId !== node.parent_id) {
    const parentError = await validateParent(access, spaceId, parentId, nodeId);
    if (parentError) {
      return { type: 'invalid', message: parentError };
    }
  }

  const status = await updateNodeFromMutation(toWorkspaceContext(access), {
    nodeId,
    updateId: generateId(IdType.Update),
    createdAt: new Date().toISOString(),
    data: encodeState(update),
  });

  return mapStatus(status, nodeId);
};
