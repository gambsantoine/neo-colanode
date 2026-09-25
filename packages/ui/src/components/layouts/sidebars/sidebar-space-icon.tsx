import { useCallback, useMemo } from 'react';

import { LocalSpaceNode } from '@colanode/client/types';
import { Avatar } from '@colanode/ui/components/avatars/avatar';
import { SidebarDropIndicator } from '@colanode/ui/components/layouts/sidebars/sidebar-drop-indicator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@colanode/ui/components/ui/tooltip';
import { useSidebarDragDrop } from '@colanode/ui/hooks/use-sidebar-drag-drop';
import { cn } from '@colanode/ui/lib/utils';

const SPACE_DND_TYPE = 'sidebar-space';

interface SidebarSpaceIconProps {
  space: LocalSpaceNode;
  previousId: string | null;
  isActive: boolean;
  onClick: () => void;
  onMove: (spaceId: string, after: string | null) => void;
}

export const SidebarSpaceIcon = ({
  space,
  previousId,
  isActive,
  onClick,
  onMove,
}: SidebarSpaceIconProps) => {
  const { ref, isDragging, dropPosition } = useSidebarDragDrop<{
    id: string;
  }>({
    type: SPACE_DND_TYPE,
    item: useMemo(() => ({ id: space.id }), [space.id]),
    canDrag: true,
    canDrop: useCallback(() => true, []),
    onDrop: useCallback(
      (dragged: { id: string }, position) => {
        const after = position === 'before' ? previousId : space.id;
        if (after === dragged.id) {
          return;
        }

        onMove(dragged.id, after);
      },
      [previousId, space.id, onMove]
    ),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          className={cn(
            'group w-10 h-10 flex items-center justify-center cursor-pointer relative shrink-0',
            isDragging && 'opacity-50'
          )}
          onClick={onClick}
        >
          <SidebarDropIndicator position={dropPosition} />
          <div
            className={cn(
              'absolute -left-2 h-2 w-1 rounded-r-full bg-foreground transition-all duration-150',
              isActive
                ? 'h-5 opacity-100'
                : 'h-2 opacity-0 group-hover:opacity-60'
            )}
          />
          <Avatar
            id={space.id}
            avatar={space.avatar}
            name={space.name}
            className={cn(
              'size-10 rounded-full transition-[border-radius] duration-150',
              !isActive && 'rounded-2xl'
            )}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{space.name}</TooltipContent>
    </Tooltip>
  );
};
