import { eq, useLiveQuery } from '@tanstack/react-db';
import { useState } from 'react';

import { LocalSpaceNode, SidebarMenuType } from '@colanode/client/types';
import { SidebarChats } from '@colanode/ui/components/layouts/sidebars/sidebar-chats';
import { SidebarMenu } from '@colanode/ui/components/layouts/sidebars/sidebar-menu';
import { SidebarSettings } from '@colanode/ui/components/layouts/sidebars/sidebar-settings';
import { SidebarSpaces } from '@colanode/ui/components/layouts/sidebars/sidebar-spaces';
import { SidebarTools } from '@colanode/ui/components/layouts/sidebars/sidebar-tools';
import { useApp } from '@colanode/ui/contexts/app';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { sortSpaces } from '@colanode/ui/lib/spaces';
import { cn } from '@colanode/ui/lib/utils';

export const Sidebar = () => {
  const app = useApp();
  const workspace = useWorkspace();
  const [menu, setMenu] = useState<SidebarMenuType>('spaces');
  const [storedActiveSpaceId, setStoredActiveSpaceId] = useMetadata<string>(
    workspace.userId,
    'sidebar.activeSpaceId'
  );

  const spaceListQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'space'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    [workspace.userId]
  );

  const [spaceOrder] = useMetadata<string[]>(
    workspace.userId,
    'sidebar.spaceOrder'
  );

  const spaces = sortSpaces(
    spaceListQuery.data.map((node) => node as LocalSpaceNode),
    spaceOrder
  );
  const activeSpaceId =
    spaces.find((space) => space.id === storedActiveSpaceId)?.id ??
    spaces[0]?.id;

  return (
    <div
      className={cn(
        'flex h-full min-h-full max-h-full w-full min-w-full flex-row',
        app.type === 'mobile' ? 'bg-background' : 'bg-sidebar'
      )}
    >
      <SidebarMenu
        value={menu}
        onChange={setMenu}
        activeSpaceId={activeSpaceId}
        onSelectSpace={setStoredActiveSpaceId}
      />
      <div className="min-h-0 grow overflow-auto border-l border-sidebar-border">
        {menu === 'spaces' && <SidebarSpaces activeSpaceId={activeSpaceId} />}
        {menu === 'chats' && <SidebarChats />}
        {menu === 'tools' && <SidebarTools />}
        {menu === 'settings' && <SidebarSettings />}
      </div>
    </div>
  );
};
