import { LocalNode } from '@colanode/client/types';
import { NodeRole } from '@colanode/core';
import { ChannelSidebarItem } from '@colanode/ui/components/channels/channel-sidebar-item';
import { ChatSidebarItem } from '@colanode/ui/components/chats/chat-sidebar-item';
import { DatabaseSidebarItem } from '@colanode/ui/components/databases/database-sidiebar-item';
import { ViewSidebarItem } from '@colanode/ui/components/databases/view-sidebar-item';
import { FolderSidebarItem } from '@colanode/ui/components/folders/folder-sidebar-item';
import { PageSidebarItem } from '@colanode/ui/components/pages/page-sidebar-item';

interface SidebarItemProps {
  node: LocalNode;
  role: NodeRole | null;
}

export const SidebarItem = ({
  node,
  role,
}: SidebarItemProps): React.ReactNode => {
  switch (node.type) {
    case 'channel':
      return <ChannelSidebarItem channel={node} role={role} />;
    case 'chat':
      return <ChatSidebarItem chat={node} />;
    case 'page':
      return <PageSidebarItem page={node} role={role} />;
    case 'database':
      return <DatabaseSidebarItem database={node} role={role} />;
    case 'database_view':
      return <ViewSidebarItem view={node} />;
    case 'folder':
      return <FolderSidebarItem folder={node} role={role} />;
    default:
      return null;
  }
};
