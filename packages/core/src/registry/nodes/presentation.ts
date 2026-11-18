import { z } from 'zod/v4';

import { ZOD_TEXT_DESCRIPTION } from '@colanode/core/lib/constants';
import {
  extractNodeRole,
  getNestedContentDepth,
  MAX_NESTED_CONTENT_DEPTH,
} from '@colanode/core/lib/nodes';
import { hasNodeRole } from '@colanode/core/lib/permissions';
import { NodeModel } from '@colanode/core/registry/nodes/core';

// A slide deck written in Markdown, with the syntax of Slidev
// (https://sli.dev) or Reveal.js (https://revealjs.com/markdown/). The source
// is a collaborative text (Y.Text), so concurrent edits are merged.
export const presentationFormatSchema = z.enum(['slidev', 'reveal']);

export type PresentationFormat = z.infer<typeof presentationFormatSchema>;

export const presentationAttributesSchema = z.object({
  type: z.literal('presentation'),
  name: z.string(),
  avatar: z.string().nullable().optional(),
  parentId: z.string(),
  content: z.string().describe(ZOD_TEXT_DESCRIPTION),
  // Missing on the first presentations: Slidev.
  format: presentationFormatSchema.nullable().optional(),
});

export type PresentationAttributes = z.infer<
  typeof presentationAttributesSchema
>;

export const presentationModel: NodeModel = {
  type: 'presentation',
  attributesSchema: presentationAttributesSchema,
  canCreate: (context) => {
    if (context.tree.length === 0) {
      return false;
    }

    if (getNestedContentDepth(context.tree) >= MAX_NESTED_CONTENT_DEPTH) {
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
  extractText: (_id, attributes) => {
    if (attributes.type !== 'presentation') {
      throw new Error('Invalid node type');
    }

    return {
      name: attributes.name,
      attributes: attributes.content,
    };
  },
  extractMentions: () => {
    return [];
  },
};
