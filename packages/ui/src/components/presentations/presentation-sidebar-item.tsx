import { LocalPresentationNode } from '@colanode/client/types';
import { NodeRole } from '@colanode/core';
import { Avatar } from '@colanode/ui/components/avatars/avatar';
import { PresentationSettings } from '@colanode/ui/components/presentations/presentation-settings';
import { Link } from '@colanode/ui/components/ui/link';
import { cn } from '@colanode/ui/lib/utils';

interface PresentationSidebarItemProps {
  presentation: LocalPresentationNode;
  role: NodeRole | null;
}

export const PresentationSidebarItem = ({
  presentation,
  role,
}: PresentationSidebarItemProps) => {
  return (
    <Link
      from="/workspace/$userId"
      to="$nodeId"
      params={{ nodeId: presentation.id }}
    >
      {({ isActive }) => (
        <div
          className={cn(
            'group/presentation-row text-sm flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer',
            isActive &&
              'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          )}
        >
          <Avatar
            id={presentation.id}
            avatar={presentation.avatar}
            name={presentation.name}
            className="size-4 shrink-0"
          />
          <span className="line-clamp-1 w-full grow text-left">
            {presentation.name ?? 'Unnamed'}
          </span>
          {role && (
            <div
              className="opacity-0 group-hover/presentation-row:opacity-100 shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <PresentationSettings presentation={presentation} role={role} />
            </div>
          )}
        </div>
      )}
    </Link>
  );
};
