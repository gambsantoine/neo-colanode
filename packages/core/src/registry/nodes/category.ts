import { z } from 'zod/v4';

import { extractNodeRole } from '@colanode/core/lib/nodes';
import { hasNodeRole } from '@colanode/core/lib/permissions';
import { NodeAttributes } from '@colanode/core/registry/nodes';
import { NodeModel } from '@colanode/core/registry/nodes/core';
import { spaceChildAttributesSchema } from '@colanode/core/registry/nodes/space';

export const categoryAttributesSchema = z.object({
  type: z.literal('category'),
  name: z.string(),
  parentId: z.string(),
  children: z.record(z.string(), spaceChildAttributesSchema).optional(),
});

export type CategoryAttributes = z.infer<typeof categoryAttributesSchema>;

export const categoryModel: NodeModel = {
  type: 'category',
  attributesSchema: categoryAttributesSchema,
  canCreate: (context) => {
    if (context.tree.length === 0) {
      return false;
    }

    const parent = context.tree[context.tree.length - 1];
    if (parent?.type !== 'space') {
      return false;
    }

    const role = extractNodeRole(context.tree, context.user.id);
    if (!role) {
      return false;
    }

    return hasNodeRole(role, 'editor');
  },
  canUpdateAttributes: (context) => {
    if (context.tree.length === 0) {
      return false;
    }

    const role = extractNodeRole(context.tree, context.user.id);
    if (!role) {
      return false;
    }

    return hasNodeRole(role, 'editor');
  },
  canUpdateDocument: () => {
    return false;
  },
  canDelete: (context) => {
    if (context.tree.length === 0) {
      return false;
    }

    const role = extractNodeRole(context.tree, context.user.id);
    if (!role) {
      return false;
    }

    return hasNodeRole(role, 'admin');
  },
  canReact: () => {
    return false;
  },
  extractText: (_: string, attributes: NodeAttributes) => {
    if (attributes.type !== 'category') {
      throw new Error('Invalid node type');
    }

    return {
      name: attributes.name,
      attributes: null,
    };
  },
  extractMentions: () => {
    return [];
  },
};
