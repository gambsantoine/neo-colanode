import { SidebarDropPosition } from '@colanode/ui/hooks/use-sidebar-drag-drop';
import { cn } from '@colanode/ui/lib/utils';

interface SidebarDropIndicatorProps {
  position: SidebarDropPosition | null;
}

export const SidebarDropIndicator = ({
  position,
}: SidebarDropIndicatorProps) => {
  if (!position) {
    return null;
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-blue-500',
        position === 'before' ? '-top-px' : '-bottom-px'
      )}
    />
  );
};
