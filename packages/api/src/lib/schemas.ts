import { z } from 'zod/v4';

import {
  nodeRoleEnum,
  richTextContentSchema,
  workspaceRoleSchema,
} from '@colanode/core';

/**
 * Public API resources. Every date is an ISO 8601 string in UTC
 * (e.g. "2026-09-24T10:22:37.000Z").
 */

export const apiWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  role: workspaceRoleSchema,
  status: z.enum(['active', 'readonly']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
});

export type ApiWorkspace = z.infer<typeof apiWorkspaceSchema>;

export const apiSpaceSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  visibility: z.enum(['public', 'private']),
  role: nodeRoleEnum,
  createdAt: z.iso.datetime(),
  createdBy: z.string(),
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.string().nullable(),
});

export type ApiSpace = z.infer<typeof apiSpaceSchema>;

export const apiNodeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  spaceId: z.string(),
  parentId: z.string().nullable(),
  type: z.string(),
  name: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  revision: z.string(),
  createdAt: z.iso.datetime(),
  createdBy: z.string(),
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.string().nullable(),
  /** Base64 encoded Yjs state, only returned with `?include=state`. */
  state: z.string().optional(),
});

export type ApiNode = z.infer<typeof apiNodeSchema>;

const nodeAttributesInputSchema = z.record(z.string(), z.unknown());

/**
 * A node is created either from plain attributes (converted server side into
 * a Yjs update) or from a base64 encoded Yjs update built by the caller.
 */
export const apiNodeCreateInputSchema = z
  .object({
    id: z.string().optional(),
    attributes: nodeAttributesInputSchema.optional(),
    update: z.string().optional(),
  })
  .refine(
    (input) =>
      (input.attributes === undefined) !== (input.update === undefined),
    {
      message: 'Provide exactly one of "attributes" or "update".',
    }
  );

export type ApiNodeCreateInput = z.infer<typeof apiNodeCreateInputSchema>;

/**
 * `attributes` is shallow merged into the current attributes; `update` is a
 * base64 encoded Yjs update applied on top of the node state.
 */
export const apiNodeUpdateInputSchema = z
  .object({
    attributes: nodeAttributesInputSchema.optional(),
    update: z.string().optional(),
  })
  .refine(
    (input) =>
      (input.attributes === undefined) !== (input.update === undefined),
    {
      message: 'Provide exactly one of "attributes" or "update".',
    }
  );

export type ApiNodeUpdateInput = z.infer<typeof apiNodeUpdateInputSchema>;

/**
 * The collaborative content of a node (pages and records). `content` is the
 * Colanode rich text format: a flat map of blocks linked by `parentId` and
 * ordered by fractional `index`; top level blocks have the node id as parent.
 */
export const apiDocumentSchema = z.object({
  nodeId: z.string(),
  content: richTextContentSchema.nullable(),
  revision: z.string().nullable(),
  createdAt: z.iso.datetime().nullable(),
  createdBy: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.string().nullable(),
  /** Base64 encoded Yjs state, only returned with `?include=state`. */
  state: z.string().optional(),
});

export type ApiDocument = z.infer<typeof apiDocumentSchema>;

/**
 * `content` replaces the whole document: the server turns the difference with
 * the current state into a Yjs update, so unchanged blocks (same id) are kept.
 * `update` is a base64 encoded Yjs update applied as is.
 */
export const apiDocumentUpdateInputSchema = z
  .object({
    content: richTextContentSchema.optional(),
    update: z.string().optional(),
  })
  .refine(
    (input) => (input.content === undefined) !== (input.update === undefined),
    {
      message: 'Provide exactly one of "content" or "update".',
    }
  );

export type ApiDocumentUpdateInput = z.infer<
  typeof apiDocumentUpdateInputSchema
>;
