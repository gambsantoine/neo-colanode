import { count, eq, inArray, useLiveQuery } from '@tanstack/react-db';
import { MessageCircle, Plus, Settings, Wrench } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
  LocalSpaceNode,
  SidebarMenuType,
  UploadStatus,
} from '@colanode/client/types';
import { SidebarMenuFooter } from '@colanode/ui/components/layouts/sidebars/sidebar-menu-footer';
import { SidebarMenuHeader } from '@colanode/ui/components/layouts/sidebars/sidebar-menu-header';
import { SidebarMenuIcon } from '@colanode/ui/components/layouts/sidebars/sidebar-menu-icon';
import { SidebarSpaceIcon } from '@colanode/ui/components/layouts/sidebars/sidebar-space-icon';
import { SpaceCreateDialog } from '@colanode/ui/components/spaces/space-create-dialog';
import { Separator } from '@colanode/ui/components/ui/separator';
import { useRadar } from '@colanode/ui/contexts/radar';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { moveSpace, sortSpaces } from '@colanode/ui/lib/spaces';

interface SidebarMenuProps {
  value: SidebarMenuType;
  onChange: (value: SidebarMenuType) => void;
  activeSpaceId: string | undefined;
  onSelectSpace: (spaceId: string) => void;
}

export const SidebarMenu = ({
  value,
  onChange,
  activeSpaceId,
  onSelectSpace,
}: SidebarMenuProps) => {
  const workspace = useWorkspace();
  const radar = useRadar();
  const [openCreateSpace, setOpenCreateSpace] = useState(false);

  const chatsState = radar.getChatsState(workspace.userId);

  const canCreateSpace =
    workspace.role !== 'guest' && workspace.role !== 'none';

  const spaceListQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'space'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    [workspace.userId]
  );

  const [spaceOrder, setSpaceOrder] = useMetadata<string[]>(
    workspace.userId,
    'sidebar.spaceOrder'
  );

  const spaces = sortSpaces(
    spaceListQuery.data.map((node) => node as LocalSpaceNode),
    spaceOrder
  );

  const handleMoveSpace = useCallback(
    (spaceId: string, after: string | null) => {
      setSpaceOrder(
        moveSpace(
          spaces.map((space) => space.id),
          spaceId,
          after
        )
      );
    },
    [spaces, setSpaceOrder]
  );

  const pendingUploadsQuery = useLiveQuery(
    (q) =>
      q
        .from({ uploads: workspace.collections.uploads })
        .where(({ uploads }) =>
          inArray(uploads.status, [
            UploadStatus.Pending,
            UploadStatus.Uploading,
          ])
        )
        .select(({ uploads }) => ({
          count: count(uploads.fileId),
        }))
        .findOne(),
    [workspace.userId]
  );

  const pendingUploads = pendingUploadsQuery.data?.count ?? 0;

  return (
    <div className="flex flex-col h-full w-[65px] min-w-[65px] items-center">
      <SidebarMenuHeader />
      <div className="flex flex-col gap-1 mt-2 w-full p-2 items-center">
        <SidebarMenuIcon
          icon={MessageCircle}
          onClick={() => {
            onChange('chats');
          }}
          isActive={value === 'chats'}
          unreadBadge={{
            count: chatsState.unreadCount,
            unread: chatsState.hasUnread,
            maxCount: 99,
          }}
        />
        <SidebarMenuIcon
          icon={Wrench}
          onClick={() => {
            onChange('tools');
          }}
          isActive={value === 'tools'}
        />
      </div>
      <Separator className="w-8" />
      <div className="flex flex-col gap-1 mt-2 w-full px-2 items-center grow overflow-y-auto overflow-x-hidden">
        {spaces.map((space, index) => (
          <SidebarSpaceIcon
            key={space.id}
            space={space}
            previousId={spaces[index - 1]?.id ?? null}
            onMove={handleMoveSpace}
            isActive={value === 'spaces' && activeSpaceId === space.id}
            onClick={() => {
              onSelectSpace(space.id);
              onChange('spaces');
            }}
          />
        ))}
        {canCreateSpace && (
          <div
            className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-full border border-dashed border-sidebar-border text-muted-foreground hover:text-foreground hover:border-foreground shrink-0"
            onClick={() => setOpenCreateSpace(true)}
          >
            <Plus className="size-5" />
          </div>
        )}
      </div>
      <SidebarMenuIcon
        icon={Settings}
        onClick={() => {
          onChange('settings');
        }}
        className="mt-auto mb-2"
        isActive={value === 'settings'}
        unreadBadge={{
          count: pendingUploads,
          unread: pendingUploads > 0,
          maxCount: 20,
          className: 'bg-blue-500',
        }}
      />
      <SidebarMenuFooter />
      {openCreateSpace && (
        <SpaceCreateDialog
          open={openCreateSpace}
          onOpenChange={setOpenCreateSpace}
        />
      )}
    </div>
  );
};
