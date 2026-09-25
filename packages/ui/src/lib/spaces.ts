import {
  LocalCategoryNode,
  LocalNode,
  LocalSpaceNode,
} from '@colanode/client/types';
import { compareString, generateFractionalIndex } from '@colanode/core';

export const sortSpaceChildren = (
  container: LocalSpaceNode | LocalCategoryNode,
  children: LocalNode[]
) => {
  const sortedById = children.toSorted((a, b) => compareString(a.id, b.id));
  const indexes: Record<string, string> = {};
  const childrenSettings = container.children ?? {};
  let lastIndex: string | null = null;

  for (const child of sortedById) {
    lastIndex = generateFractionalIndex(lastIndex, null);
    const customIndex = childrenSettings[child.id]?.index;
    indexes[child.id] = customIndex ?? lastIndex;
  }

  return sortedById.sort((a, b) => {
    const aIndex = indexes[a.id];
    const bIndex = indexes[b.id];
    return compareString(aIndex, bIndex);
  });
};

/**
 * Sorts spaces following the user's saved order. Spaces missing from the
 * saved order (e.g. newly created or shared) are appended by id.
 */
export const sortSpaces = (
  spaces: LocalSpaceNode[],
  order: string[] | undefined
) => {
  const positions = new Map((order ?? []).map((id, index) => [id, index]));
  return spaces.toSorted((a, b) => {
    const aPosition = positions.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bPosition = positions.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aPosition !== bPosition) {
      return aPosition - bPosition;
    }

    return compareString(a.id, b.id);
  });
};

export const moveSpace = (
  spaceIds: string[],
  spaceId: string,
  after: string | null
) => {
  const result = spaceIds.filter((id) => id !== spaceId);
  const position = after === null ? 0 : result.indexOf(after) + 1;
  result.splice(position, 0, spaceId);
  return result;
};
