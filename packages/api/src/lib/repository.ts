import { WorkspaceRole } from '@colanode/core';

import { PageRequest } from './pagination';
import {
  ApiDocument,
  ApiDocumentUpdateInput,
  ApiNode,
  ApiNodeCreateInput,
  ApiNodeUpdateInput,
  ApiSpace,
  ApiWorkspace,
} from './schemas';

export type ApiKeyVerifyResult = {
  accountId: string;
  workspaceId: string | null;
};

/** The caller's membership in a workspace, checked on every request. */
export type ApiWorkspaceAccess = {
  workspaceId: string;
  accountId: string;
  userId: string;
  role: WorkspaceRole;
  readonly: boolean;
};

export type ApiNodeFilters = {
  parentId: string | null;
  type: string | null;
};

export type ApiWriteResult<T> =
  | { type: 'success'; data: T }
  | { type: 'not_found' }
  | { type: 'forbidden' }
  | { type: 'conflict'; message: string }
  | { type: 'invalid'; message: string }
  | { type: 'failed' };

export type ApiNodeWriteResult = ApiWriteResult<ApiNode>;

export type ApiDocumentWriteResult =
  | ApiWriteResult<ApiDocument>
  | { type: 'unsupported' };

/**
 * Data access used by the public API. List methods follow the PageRequest
 * contract: at most `limit + 1` items, ordered by id, with id > `after`.
 */
export interface ApiRepository {
  verifyApiKey(
    apiKeyId: string,
    secret: string
  ): Promise<ApiKeyVerifyResult | null>;
  touchApiKeyLastUsed(apiKeyId: string): Promise<void>;

  listWorkspaces(
    accountId: string,
    workspaceId: string | null,
    page: PageRequest
  ): Promise<ApiWorkspace[]>;
  getWorkspaceAccess(
    accountId: string,
    workspaceId: string
  ): Promise<ApiWorkspaceAccess | null>;
  getWorkspace(access: ApiWorkspaceAccess): Promise<ApiWorkspace | null>;

  listSpaces(
    access: ApiWorkspaceAccess,
    page: PageRequest
  ): Promise<ApiSpace[]>;
  getSpace(
    access: ApiWorkspaceAccess,
    spaceId: string
  ): Promise<ApiSpace | null>;

  listNodes(
    access: ApiWorkspaceAccess,
    spaceId: string,
    filters: ApiNodeFilters,
    page: PageRequest
  ): Promise<ApiNode[]>;
  getNode(
    access: ApiWorkspaceAccess,
    spaceId: string,
    nodeId: string,
    includeState: boolean
  ): Promise<ApiNode | null>;
  createNode(
    access: ApiWorkspaceAccess,
    spaceId: string,
    input: ApiNodeCreateInput
  ): Promise<ApiNodeWriteResult>;
  updateNode(
    access: ApiWorkspaceAccess,
    spaceId: string,
    nodeId: string,
    input: ApiNodeUpdateInput
  ): Promise<ApiNodeWriteResult>;

  /** `unsupported` when the node type has no document (only pages and records do). */
  getDocument(
    access: ApiWorkspaceAccess,
    spaceId: string,
    nodeId: string,
    includeState: boolean
  ): Promise<ApiDocument | 'unsupported' | null>;
  updateDocument(
    access: ApiWorkspaceAccess,
    spaceId: string,
    nodeId: string,
    input: ApiDocumentUpdateInput
  ): Promise<ApiDocumentWriteResult>;
}
