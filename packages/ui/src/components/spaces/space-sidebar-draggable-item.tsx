import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { LocalNode } from '@colanode/client/types';
import { NodeRole, NodeType } from '@colanode/core';
import { SidebarDropIndicator } from '@colanode/ui/components/layouts/sidebars/sidebar-drop-indicator';
import { SidebarItem } from '@colanode/ui/components/layouts/sidebars/sidebar-item';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useSidebarDragDrop } from '@colanode/ui/hooks/use-sidebar-drag-drop';
import { cn } from '@colanode/ui/lib/utils';

export const SPACE_CHILD_DND_TYPE = 'space-child';

export interface SpaceChildDragItem {
  id: string;
  type: NodeType;
  parentId: string;
}

export const useSpaceChildReorder = (spaceId: string) => {
  const workspace = useWorkspace();

  return useCallback(
    async (childId: string, parentId: string, after: string | null) => {
      const result = await window.colanode.executeMutation({
        type: 'space.child.reorder',
        userId: workspace.userId,
        spaceId,
        parentId,
        childId,
        after,
      });

      if (!result.success) {
        toast.error(result.error.message);
      }
    },
    [workspace.userId, spaceId]
  );
};

interface SpaceSidebarDraggableItemProps {
  node: LocalNode;
  role: NodeRole | null;
  spaceId: string;
  parentId: string;
  previousId: string | null;
  canDrag: boolean;
  canDrop: boolean;
}

export const SpaceSidebarDraggableItem = ({
  node,
  role,
  spaceId,
  parentId,
  previousId,
  canDrag,
  canDrop,
}: SpaceSidebarDraggableItemProps) => {
  const reorder = useSpaceChildReorder(spaceId);

  const { ref, isDragging, dropPosition } = useSidebarDragDrop<
    SpaceChildDragItem,
    HTMLLIElement
  >({
    type: SPACE_CHILD_DND_TYPE,
    item: useMemo(
      () => ({ id: node.id, type: node.type, parentId }),
      [node.id, node.type, parentId]
    ),
    canDrag,
    canDrop: useCallback(
      (dragged: SpaceChildDragItem) =>
        canDrop && (dragged.type !== 'category' || parentId === spaceId),
      [canDrop, parentId, spaceId]
    ),
    onDrop: useCallback(
      (dragged: SpaceChildDragItem, position) => {
        const after = position === 'before' ? previousId : node.id;
        if (dragged.parentId === parentId && after === dragged.id) {
          return;
        }

        reorder(dragged.id, parentId, after);
      },
      [previousId, node.id, parentId, reorder]
    ),
  });

  return (
    <li ref={ref} className={cn('relative', isDragging && 'opacity-50')}>
      <SidebarDropIndicator position={dropPosition} />
      <SidebarItem node={node} role={role} />
    </li>
  );
};
