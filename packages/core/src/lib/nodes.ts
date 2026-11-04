import { generateKeyBetween } from 'fractional-indexing-jittered';

import { Node, NodeAttributes, NodeRole } from '@colanode/core';

export const extractNodeCollaborators = (
  attributes: NodeAttributes | NodeAttributes[]
): Record<string, NodeRole> => {
  const items = Array.isArray(attributes) ? attributes : [attributes];
  const collaborators: Record<string, NodeRole> = {};

  for (const item of items) {
    if ('collaborators' in item && item.collaborators) {
      for (const [collaboratorId, role] of Object.entries(item.collaborators)) {
        collaborators[collaboratorId] = role as NodeRole;
      }
    }
  }

  return collaborators;
};

export const extractNodeName = (attributes: NodeAttributes): string | null => {
  if ('name' in attributes && attributes.name) {
    return attributes.name as string;
  }

  return null;
};

export const extractNodeAvatar = (
  attributes: NodeAttributes
): string | null => {
  if ('avatar' in attributes && attributes.avatar) {
    return attributes.avatar as string;
  }

  return null;
};

export const extractNodeRole = (
  tree: Node | Node[],
  collaboratorId: string
): NodeRole | null => {
  const nodes = Array.isArray(tree) ? tree : [tree];
  let role: NodeRole | null = null;
  for (const node of nodes) {
    const collaborators = extractNodeCollaborators(node);
    const collaboratorRole = collaborators[collaboratorId];
    if (collaboratorRole) {
      role = collaboratorRole;
    }
  }

  return role;
};

export const MAX_NESTED_CONTENT_DEPTH = 3;

export const getNestedContentDepth = (tree: Node[]): number =>
  tree.filter(
    (node) =>
      node.type !== 'space' && node.type !== 'wiki' && node.type !== 'category'
  ).length;

// Root containers that hold collaborators and appear in the sidebar.
export const isSpaceLikeType = (type: string): type is 'space' | 'wiki' =>
  type === 'space' || type === 'wiki';

export const generateFractionalIndex = (
  previous?: string | null,
  next?: string | null
) => {
  const lower = previous === undefined ? null : previous;
  const upper = next === undefined ? null : next;

  return generateKeyBetween(lower, upper);
};
