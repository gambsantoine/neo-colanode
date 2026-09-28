import { SelectNode } from '@colanode/client/databases';
import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@colanode/client/lib/types';
import {
  MutationError,
  MutationErrorCode,
  SpaceChildReorderMutationInput,
  SpaceChildReorderMutationOutput,
} from '@colanode/client/mutations';
import {
  CategoryAttributes,
  compareString,
  generateFractionalIndex,
  NodeAttributes,
  SpaceAttributes,
} from '@colanode/core';

interface NodeFractionalIndex {
  id: string;
  defaultIndex: string;
  customIndex: string | null;
}

type ContainerAttributes = SpaceAttributes | CategoryAttributes;

export class SpaceChildReorderMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<SpaceChildReorderMutationInput>
{
  async handleMutation(
    input: SpaceChildReorderMutationInput
  ): Promise<SpaceChildReorderMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    const parent = await workspace.database
      .selectFrom('nodes')
      .where('id', '=', input.parentId)
      .selectAll()
      .executeTakeFirst();

    const isValidParent =
      parent &&
      ((parent.type === 'space' && parent.id === input.spaceId) ||
        (parent.type === 'category' && parent.parent_id === input.spaceId));

    if (!isValidParent) {
      throw new MutationError(
        MutationErrorCode.SpaceNotFound,
        'Target container not found in this space.'
      );
    }

    const child = await workspace.database
      .selectFrom('nodes')
      .where('id', '=', input.childId)
      .selectAll()
      .executeTakeFirst();

    if (!child || child.root_id !== input.spaceId) {
      throw new MutationError(
        MutationErrorCode.NodeNotFound,
        'Node not found in this space.'
      );
    }

    if (child.type === 'category' && parent.type !== 'space') {
      throw new MutationError(
        MutationErrorCode.SpaceUpdateFailed,
        'Categories cannot be nested.'
      );
    }

    const children = await workspace.database
      .selectFrom('nodes')
      .where('parent_id', '=', input.parentId)
      .selectAll()
      .execute();

    const result = await workspace.nodes.updateNode<ContainerAttributes>(
      input.parentId,
      (attributes) => {
        const indexes = this.generateChildIndexes(
          attributes,
          children,
          input.childId,
          input.after
        );

        if (!indexes) {
          throw new MutationError(
            MutationErrorCode.SpaceUpdateFailed,
            'Failed to generate new index.'
          );
        }

        const childrenSettings = attributes.children ?? {};
        for (const [id, index] of Object.entries(indexes)) {
          childrenSettings[id] = {
            ...(childrenSettings[id] ?? {}),
            id,
            index,
          };
        }

        attributes.children = childrenSettings;
        return attributes;
      }
    );

    if (result === 'unauthorized') {
      throw new MutationError(
        MutationErrorCode.SpaceUpdateForbidden,
        "You don't have permission to reorder this space."
      );
    }

    if (result !== 'success') {
      throw new MutationError(
        MutationErrorCode.SpaceUpdateFailed,
        'Failed to reorder space.'
      );
    }

    if (child.parent_id !== input.parentId) {
      const moveResult = await workspace.nodes.updateNode<NodeAttributes>(
        input.childId,
        (attributes) => {
          if (attributes.type === 'space' || attributes.type === 'chat') {
            throw new MutationError(
              MutationErrorCode.SpaceUpdateFailed,
              'This node cannot be moved.'
            );
          }

          attributes.parentId = input.parentId;
          return attributes;
        }
      );

      if (moveResult === 'unauthorized') {
        throw new MutationError(
          MutationErrorCode.SpaceUpdateForbidden,
          "You don't have permission to move this node."
        );
      }

      if (moveResult !== 'success') {
        throw new MutationError(
          MutationErrorCode.SpaceUpdateFailed,
          'Failed to move node.'
        );
      }
    }

    return {
      success: true,
    };
  }

  /**
   * Returns the indexes to persist in the container: the moved child's new
   * index plus the current effective index of every sibling that has none yet,
   * so the order stays stable when nodes join or leave the container.
   */
  private generateChildIndexes(
    attributes: ContainerAttributes,
    children: SelectNode[],
    childId: string,
    after: string | null
  ): Record<string, string> | null {
    const sortedById = children.toSorted((a, b) => compareString(a.id, b.id));
    const childrenSettings = attributes.children ?? {};
    const indexes: NodeFractionalIndex[] = [];
    let lastIndex: string | null = null;

    for (const child of sortedById) {
      lastIndex = generateFractionalIndex(lastIndex, null);
      indexes.push({
        id: child.id,
        defaultIndex: lastIndex,
        customIndex: childrenSettings[child.id]?.index ?? null,
      });
    }

    const siblings = indexes
      .filter((index) => index.id !== childId)
      .map((index) => ({
        id: index.id,
        index: index.customIndex ?? index.defaultIndex,
        pinned: index.customIndex !== null,
      }))
      .sort((a, b) => compareString(a.index, b.index));

    const result: Record<string, string> = {};
    for (const sibling of siblings) {
      if (!sibling.pinned) {
        result[sibling.id] = sibling.index;
      }
    }

    if (after === null) {
      const first = siblings[0];
      result[childId] = generateFractionalIndex(null, first?.index ?? null);
      return result;
    }

    const afterPosition = siblings.findIndex((node) => node.id === after);
    const afterNode = siblings[afterPosition];
    if (!afterNode) {
      return null;
    }

    // Skip siblings sharing the same index, which would make the key
    // generation fail.
    const nextNode = siblings
      .slice(afterPosition + 1)
      .find((node) => compareString(node.index, afterNode.index) > 0);

    result[childId] = generateFractionalIndex(
      afterNode.index,
      nextNode?.index ?? null
    );

    return result;
  }
}
