import { z } from 'zod/v4';

import { hasWorkspaceRole } from '@colanode/core/lib/permissions';
import { NodeModel, nodeRoleEnum } from '@colanode/core/registry/nodes/core';
import {
  spaceChildAttributesSchema,
  spaceModel,
} from '@colanode/core/registry/nodes/space';

// A wiki is a space meant to be read as documentation. It shares the space
// permission model (collaborators on the root) and can be published from the
// server (see `wiki_publications`), which is why it has no visibility flag.
export const wikiAttributesSchema = z.object({
  type: z.literal('wiki'),
  name: z.string(),
  description: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  collaborators: z.record(z.string(), nodeRoleEnum),
  children: z.record(z.string(), spaceChildAttributesSchema).optional(),
});

export type WikiAttributes = z.infer<typeof wikiAttributesSchema>;

// Node types that can live in a wiki (directly or nested).
export const WIKI_CHILD_TYPES = [
  'page',
  'category',
  'folder',
  'database',
] as const;

export const wikiModel: NodeModel = {
  type: 'wiki',
  attributesSchema: wikiAttributesSchema,
  canCreate: (context) => {
    if (context.tree.length > 0) {
      return false;
    }

    if (!hasWorkspaceRole(context.user.role, 'collaborator')) {
      return false;
    }

    if (context.attributes.type !== 'wiki') {
      return false;
    }

    return context.attributes.collaborators[context.user.id] === 'admin';
  },
  canUpdateAttributes: (context) => spaceModel.canUpdateAttributes(context),
  canUpdateDocument: () => false,
  canDelete: (context) => spaceModel.canDelete(context),
  canReact: () => false,
  extractText: (_, attributes) => {
    if (attributes.type !== 'wiki') {
      throw new Error('Invalid node type');
    }

    return {
      name: attributes.name,
      attributes: attributes.description ?? null,
    };
  },
  extractMentions: () => {
    return [];
  },
};
