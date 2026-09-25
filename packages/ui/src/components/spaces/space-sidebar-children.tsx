import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalSpaceNode } from '@colanode/client/types';
import { hasNodeRole, NodeRole } from '@colanode/core';
import { CategorySidebarItem } from '@colanode/ui/components/categories/category-sidebar-item';
import { SpaceSidebarDraggableItem } from '@colanode/ui/components/spaces/space-sidebar-draggable-item';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { sortSpaceChildren } from '@colanode/ui/lib/spaces';

interface SpaceSidebarChildrenProps {
  space: LocalSpaceNode;
  role: NodeRole | null;
}

export const SpaceSidebarChildren = ({
  space,
  role,
}: SpaceSidebarChildrenProps) => {
  const workspace = useWorkspace();

  const nodeChildrenGetQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, space.id)),
    [workspace.userId, space.id]
  );

  const children = sortSpaceChildren(space, nodeChildrenGetQuery.data);
  const canEdit = role ? hasNodeRole(role, 'editor') : false;
  // Reordering the space root updates the space itself, which needs admin.
  const canReorder = role ? hasNodeRole(role, 'admin') : false;

  return (
    <ul className="flex min-w-0 flex-col gap-0.5 py-0.5">
      {children.map((child, index) => {
        const previousId = children[index - 1]?.id ?? null;

        if (child.type === 'category') {
          return (
            <CategorySidebarItem
              key={child.id}
              category={child}
              role={role}
              spaceId={space.id}
              previousId={previousId}
            />
          );
        }

        return (
          <SpaceSidebarDraggableItem
            key={child.id}
            node={child}
            role={role}
            spaceId={space.id}
            parentId={space.id}
            previousId={previousId}
            canDrag={canEdit}
            canDrop={canReorder}
          />
        );
      })}
    </ul>
  );
};
