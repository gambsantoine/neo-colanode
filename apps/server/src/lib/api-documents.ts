import {
  ApiDocument,
  ApiDocumentUpdateInput,
  ApiDocumentWriteResult,
  ApiWorkspaceAccess,
} from '@colanode/api';
import {
  DocumentContent,
  generateId,
  getNodeModel,
  IdType,
  MutationStatus,
} from '@colanode/core';
import { decodeState, encodeState, YDoc } from '@colanode/crdt';
import { database } from '@colanode/server/data/database';
import {
  fetchSpaceNode,
  toWorkspaceContext,
} from '@colanode/server/lib/api-nodes';
import { updateDocumentFromMutation } from '@colanode/server/lib/documents';

const fetchDocumentYDoc = async (nodeId: string) => {
  const updates = await database
    .selectFrom('document_updates')
    .select('data')
    .where('document_id', '=', nodeId)
    .execute();

  return new YDoc(updates.map((update) => update.data));
};

export const getApiDocument = async (
  access: ApiWorkspaceAccess,
  spaceId: string,
  nodeId: string,
  includeState: boolean
): Promise<ApiDocument | 'unsupported' | null> => {
  const node = await fetchSpaceNode(access, spaceId, nodeId);
  if (!node) {
    return null;
  }

  if (!getNodeModel(node.type).documentSchema) {
    return 'unsupported';
  }

  const document = await database
    .selectFrom('documents')
    .selectAll()
    .where('id', '=', nodeId)
    .executeTakeFirst();

  // A node gets its document row on the first edit.
  const apiDocument: ApiDocument = {
    nodeId,
    content: document?.content ?? null,
    revision: document?.revision.toString() ?? null,
    createdAt: document?.created_at.toISOString() ?? null,
    createdBy: document?.created_by ?? null,
    updatedAt: document?.updated_at?.toISOString() ?? null,
    updatedBy: document?.updated_by ?? null,
  };

  if (includeState) {
    const ydoc = await fetchDocumentYDoc(nodeId);
    apiDocument.state = ydoc.getEncodedState();
  }

  return apiDocument;
};

/**
 * Writes a document through `updateDocumentFromMutation`, the same Yjs path
 * as the apps: `content` is diffed against the current state into a Yjs
 * update, while a raw `update` is validated then applied as is.
 */
export const updateApiDocument = async (
  access: ApiWorkspaceAccess,
  spaceId: string,
  nodeId: string,
  input: ApiDocumentUpdateInput
): Promise<ApiDocumentWriteResult> => {
  const node = await fetchSpaceNode(access, spaceId, nodeId);
  if (!node) {
    return { type: 'not_found' };
  }

  const documentSchema = getNodeModel(node.type).documentSchema;
  if (!documentSchema) {
    return { type: 'unsupported' };
  }

  const ydoc = await fetchDocumentYDoc(nodeId);

  let update: Uint8Array | null;
  try {
    if (input.update) {
      update = decodeState(input.update);
      ydoc.applyUpdate(update);
    } else {
      update = ydoc.update(documentSchema, input.content);
    }
  } catch {
    return { type: 'invalid', message: 'Invalid document content or update.' };
  }

  const result = documentSchema.safeParse(ydoc.getObject<DocumentContent>());
  if (!result.success) {
    return { type: 'invalid', message: result.error.message };
  }

  if (update) {
    const status = await updateDocumentFromMutation(
      toWorkspaceContext(access),
      {
        documentId: nodeId,
        updateId: generateId(IdType.Update),
        createdAt: new Date().toISOString(),
        data: encodeState(update),
      }
    );

    if (status === MutationStatus.FORBIDDEN) {
      return { type: 'forbidden' };
    }

    if (status === MutationStatus.BAD_REQUEST) {
      return { type: 'invalid', message: 'Invalid document content.' };
    }

    if (status !== MutationStatus.OK) {
      return { type: 'failed' };
    }
  }

  const document = await getApiDocument(access, spaceId, nodeId, false);
  if (!document || document === 'unsupported') {
    return { type: 'failed' };
  }

  return { type: 'success', data: document };
};
