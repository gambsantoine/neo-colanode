import { useRef, useState } from 'react';
import { DropTargetMonitor, useDrag, useDrop } from 'react-dnd';

export type SidebarDropPosition = 'before' | 'after';

interface SidebarDragDropOptions<T extends { id: string }> {
  type: string;
  item: T;
  canDrag: boolean;
  canDrop: (dragged: T) => boolean;
  onDrop: (dragged: T, position: SidebarDropPosition) => void;
}

const getDropPosition = (
  element: HTMLElement | null,
  monitor: DropTargetMonitor
): SidebarDropPosition => {
  const offset = monitor.getClientOffset();
  if (!element || !offset) {
    return 'after';
  }

  const rect = element.getBoundingClientRect();
  return offset.y < rect.top + rect.height / 2 ? 'before' : 'after';
};

/**
 * Makes a sidebar element both draggable and a drop target. The drop
 * position (before/after) is derived from the pointer position relative to
 * the vertical middle of the element.
 */
export const useSidebarDragDrop = <
  T extends { id: string },
  E extends HTMLElement = HTMLDivElement,
>({
  type,
  item,
  canDrag,
  canDrop,
  onDrop,
}: SidebarDragDropOptions<T>) => {
  const ref = useRef<E>(null);
  const [position, setPosition] = useState<SidebarDropPosition | null>(null);

  const [{ isDragging }, dragRef] = useDrag<T, void, { isDragging: boolean }>(
    {
      type,
      item: () => item,
      canDrag: () => canDrag,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    },
    [type, item, canDrag]
  );

  const [{ isOver }, dropRef] = useDrop<T, void, { isOver: boolean }>(
    {
      accept: type,
      canDrop: (dragged) => dragged.id !== item.id && canDrop(dragged),
      hover: (_, monitor) => {
        if (!monitor.isOver({ shallow: true }) || !monitor.canDrop()) {
          return;
        }

        setPosition(getDropPosition(ref.current, monitor));
      },
      drop: (dragged, monitor) => {
        if (monitor.didDrop()) {
          return;
        }

        onDrop(dragged, getDropPosition(ref.current, monitor));
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }) && monitor.canDrop(),
      }),
    },
    [type, item, canDrop, onDrop]
  );

  dragRef(dropRef(ref));

  return {
    ref,
    isDragging,
    dropPosition: isOver ? position : null,
  };
};
