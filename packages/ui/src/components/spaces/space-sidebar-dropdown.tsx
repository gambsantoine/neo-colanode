import { useNavigate } from '@tanstack/react-router';
import {
  Database,
  Ellipsis,
  Folder,
  MessageCircle,
  Plus,
  Settings,
  SquareStack,
  StickyNote,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import { LocalSpaceLikeNode } from '@colanode/client/types';
import { CategoryCreateDialog } from '@colanode/ui/components/categories/category-create-dialog';
import { ChannelCreateDialog } from '@colanode/ui/components/channels/channel-create-dialog';
import { DatabaseCreateDialog } from '@colanode/ui/components/databases/database-create-dialog';
import { FolderCreateDialog } from '@colanode/ui/components/folders/folder-create-dialog';
import { PageCreateDialog } from '@colanode/ui/components/pages/page-create-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';

interface SpaceSidebarDropdownProps {
  space: LocalSpaceLikeNode;
}

export const SpaceSidebarDropdown = ({ space }: SpaceSidebarDropdownProps) => {
  const navigate = useNavigate({ from: '/workspace/$userId' });

  const [openCreatePage, setOpenCreatePage] = useState(false);
  const [openCreateChannel, setOpenCreateChannel] = useState(false);
  const [openCreateDatabase, setOpenCreateDatabase] = useState(false);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openCreateCategory, setOpenCreateCategory] = useState(false);

  return (
    <Fragment>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-muted-foreground flex items-center justify-center p-0 mr-1 size-4 focus-visible:outline-none focus-visible:ring-0 cursor-pointer">
            <Ellipsis />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="ml-1 w-72">
          <DropdownMenuLabel>{space.name ?? 'Unnamed'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setOpenCreatePage(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <StickyNote className="size-4" />
            <span>Add page</span>
          </DropdownMenuItem>
          {space.type === 'space' && (
            <DropdownMenuItem
              onSelect={() => setOpenCreateChannel(true)}
              className="flex flex-row items-center gap-2 cursor-pointer"
            >
              <MessageCircle className="size-4" />
              <span>Add channel</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setOpenCreateDatabase(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Database className="size-4" />
            <span>Add database</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenCreateFolder(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Folder className="size-4" />
            <span>Add folder</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenCreateCategory(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <SquareStack className="size-4" />
            <span>Add category</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '$nodeId',
                params: { nodeId: space.id },
              })
            }
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Settings className="size-4" />
            <span>
              {space.type === 'wiki' ? 'Settings & publication' : 'Settings'}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '$nodeId',
                params: { nodeId: space.id },
              })
            }
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add collaborators</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {openCreateChannel && (
        <ChannelCreateDialog
          parentId={space.id}
          rootId={space.id}
          open={openCreateChannel}
          onOpenChange={setOpenCreateChannel}
        />
      )}
      {openCreatePage && (
        <PageCreateDialog
          parentId={space.id}
          rootId={space.id}
          open={openCreatePage}
          onOpenChange={setOpenCreatePage}
        />
      )}
      {openCreateDatabase && (
        <DatabaseCreateDialog
          parentId={space.id}
          rootId={space.id}
          open={openCreateDatabase}
          onOpenChange={setOpenCreateDatabase}
        />
      )}
      {openCreateFolder && (
        <FolderCreateDialog
          parentId={space.id}
          rootId={space.id}
          open={openCreateFolder}
          onOpenChange={setOpenCreateFolder}
        />
      )}
      {openCreateCategory && (
        <CategoryCreateDialog
          spaceId={space.id}
          open={openCreateCategory}
          onOpenChange={setOpenCreateCategory}
        />
      )}
    </Fragment>
  );
};
