import { eq, useLiveQuery } from '@tanstack/react-db';
import { ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { LocalCategoryNode } from '@colanode/client/types';
import { hasNodeRole, NodeRole } from '@colanode/core';
import { CategorySidebarDropdown } from '@colanode/ui/components/categories/category-sidebar-dropdown';
import { SidebarDropIndicator } from '@colanode/ui/components/layouts/sidebars/sidebar-drop-indicator';
import {
  SPACE_CHILD_DND_TYPE,
  SpaceChildDragItem,
  SpaceSidebarDraggableItem,
  useSpaceChildReorder,
} from '@colanode/ui/components/spaces/space-sidebar-draggable-item';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@colanode/ui/components/ui/collapsible';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useSidebarDragDrop } from '@colanode/ui/hooks/use-sidebar-drag-drop';
import { sortSpaceChildren } from '@colanode/ui/lib/spaces';
import { cn } from '@colanode/ui/lib/utils';

interface CategorySidebarItemProps {
  category: LocalCategoryNode;
  role: NodeRole | null;
  spaceId: string;
  previousId: string | null;
}

export const CategorySidebarItem = ({
  category,
  role,
  spaceId,
  previousId,
}: CategorySidebarItemProps) => {
  const workspace = useWorkspace();
  const [open, setOpen] = useState(true);
  const reorder = useSpaceChildReorder(spaceId);

  const canEdit = role ? hasNodeRole(role, 'editor') : false;
  // Moving within the space root updates the space itself, which needs admin.
  const canReorderSpace = role ? hasNodeRole(role, 'admin') : false;

  const childrenQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, category.id)),
    [workspace.userId, category.id]
  );

  const children = sortSpaceChildren(category, childrenQuery.data);

  // Dropping on the header: a category is placed before/after this one; any
  // other node goes before this category (space root) or at the top of it.
  const { ref, isDragging, dropPosition } = useSidebarDragDrop<
    SpaceChildDragItem,
    HTMLDivElement
  >({
    type: SPACE_CHILD_DND_TYPE,
    item: useMemo(
      () => ({ id: category.id, type: category.type, parentId: spaceId }),
      [category.id, category.type, spaceId]
    ),
    canDrag: canReorderSpace,
    canDrop: useCallback(
      (dragged: SpaceChildDragItem) =>
        dragged.type === 'category' ? canReorderSpace : canEdit,
      [canReorderSpace, canEdit]
    ),
    onDrop: useCallback(
      (dragged: SpaceChildDragItem, position) => {
        if (dragged.type !== 'category' && position === 'after') {
          reorder(dragged.id, category.id, null);
          setOpen(true);
          return;
        }

        const after = position === 'before' ? previousId : category.id;
        if (dragged.parentId === spaceId && after === dragged.id) {
          return;
        }

        reorder(dragged.id, spaceId, after);
      },
      [reorder, category.id, previousId, spaceId]
    ),
  });

  return (
    <li className={cn(isDragging && 'opacity-50')}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="group/category-item w-full"
      >
        <div
          ref={ref}
          className={cn(
            'relative group/category-row flex h-6 min-w-0 items-center gap-1 rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground cursor-pointer select-none'
          )}
        >
          <SidebarDropIndicator position={dropPosition} />
          <CollapsibleTrigger asChild>
            <button
              className="flex flex-1 min-w-0 items-center gap-1 cursor-pointer"
              onClick={() => setOpen((value) => !value)}
            >
              <ChevronRight
                className={cn(
                  'size-3 shrink-0 transition-transform duration-200',
                  open && 'rotate-90'
                )}
              />
              <span className="line-clamp-1 text-left">{category.name}</span>
            </button>
          </CollapsibleTrigger>
          <CategorySidebarDropdown category={category} />
        </div>
        <CollapsibleContent>
          <ul className="flex min-w-0 flex-col gap-0.5 py-0.5">
            {children.map((child, index) => (
              <SpaceSidebarDraggableItem
                key={child.id}
                node={child}
                role={role}
                spaceId={spaceId}
                parentId={category.id}
                previousId={children[index - 1]?.id ?? null}
                canDrag={canEdit}
                canDrop={canEdit}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};
