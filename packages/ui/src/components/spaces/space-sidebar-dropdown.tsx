import { useNavigate } from '@tanstack/react-router';
import {
  Database,
  Ellipsis,
  Folder,
  MessageCircle,
  Presentation,
  Plus,
  Settings,
  SquareStack,
  StickyNote,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import { LocalSpaceNode } from '@colanode/client/types';
import { CategoryCreateDialog } from '@colanode/ui/components/categories/category-create-dialog';
import { ChannelCreateDialog } from '@colanode/ui/components/channels/channel-create-dialog';
import { DatabaseCreateDialog } from '@colanode/ui/components/databases/database-create-dialog';
import { FolderCreateDialog } from '@colanode/ui/components/folders/folder-create-dialog';
import { PageCreateDialog } from '@colanode/ui/components/pages/page-create-dialog';
import { PresentationCreateDialog } from '@colanode/ui/components/presentations/presentation-create-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';

interface SpaceSidebarDropdownProps {
  space: LocalSpaceNode;
}

export const SpaceSidebarDropdown = ({ space }: SpaceSidebarDropdownProps) => {
  const navigate = useNavigate({ from: '/workspace/$userId' });

  const [openCreatePage, setOpenCreatePage] = useState(false);
  const [openCreatePresentation, setOpenCreatePresentation] = useState(false);
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
          <DropdownMenuItem
            onSelect={() => setOpenCreatePresentation(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <Presentation className="size-4" />
            <span>Add presentation</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenCreateChannel(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <MessageCircle className="size-4" />
            <span>Add channel</span>
          </DropdownMenuItem>
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
            <span>Settings</span>
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
      {openCreatePresentation && (
        <PresentationCreateDialog
          parentId={space.id}
          rootId={space.id}
          open={openCreatePresentation}
          onOpenChange={setOpenCreatePresentation}
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
