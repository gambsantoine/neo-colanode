import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalSpaceLikeNode } from '@colanode/client/types';
import { extractNodeRole } from '@colanode/core';
import { SidebarHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-header';
import { SpaceSidebarChildren } from '@colanode/ui/components/spaces/space-sidebar-children';
import { SpaceSidebarDropdown } from '@colanode/ui/components/spaces/space-sidebar-dropdown';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

interface SidebarSpacesProps {
  activeSpaceId: string | undefined;
}

export const SidebarSpaces = ({ activeSpaceId }: SidebarSpacesProps) => {
  const workspace = useWorkspace();

  const spaceQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, activeSpaceId ?? ''))
        .findOne(),
    [workspace.userId, activeSpaceId]
  );

  const space = spaceQuery.data as LocalSpaceLikeNode | undefined;
  const role = space ? extractNodeRole(space, workspace.userId) : null;

  if (!space) {
    return (
      <div className="flex flex-col group/sidebar h-full px-2">
        <SidebarHeader title="Spaces" />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No space selected
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col group/sidebar h-full px-2">
      <SidebarHeader
        title={space.name ?? 'Unnamed'}
        actions={<SpaceSidebarDropdown space={space} />}
      />
      <div className="flex w-full min-w-0 flex-col gap-1">
        <SpaceSidebarChildren space={space} role={role} />
      </div>
    </div>
  );
};
