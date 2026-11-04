import {
  Database,
  Ellipsis,
  Folder,
  MessageCircle,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import { LocalCategoryNode } from '@colanode/client/types';
import { ChannelCreateDialog } from '@colanode/ui/components/channels/channel-create-dialog';
import { DatabaseCreateDialog } from '@colanode/ui/components/databases/database-create-dialog';
import { FolderCreateDialog } from '@colanode/ui/components/folders/folder-create-dialog';
import { NodeDeleteDialog } from '@colanode/ui/components/nodes/node-delete-dialog';
import { PageCreateDialog } from '@colanode/ui/components/pages/page-create-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';

interface CategorySidebarDropdownProps {
  category: LocalCategoryNode;
  allowChannels?: boolean;
}

export const CategorySidebarDropdown = ({
  category,
  allowChannels = true,
}: CategorySidebarDropdownProps) => {
  const [openCreatePage, setOpenCreatePage] = useState(false);
  const [openCreateChannel, setOpenCreateChannel] = useState(false);
  const [openCreateDatabase, setOpenCreateDatabase] = useState(false);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  return (
    <Fragment>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-muted-foreground opacity-0 transition-opacity group-hover/category-row:opacity-100 flex items-center justify-center p-0 size-4 focus-visible:outline-none focus-visible:ring-0 cursor-pointer">
            <Ellipsis className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="ml-1 w-64">
          <DropdownMenuLabel>{category.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setOpenCreatePage(true)}
            className="flex flex-row items-center gap-2 cursor-pointer"
          >
            <StickyNote className="size-4" />
            <span>Add page</span>
          </DropdownMenuItem>
          {allowChannels && (
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setOpenDelete(true)}
            className="flex flex-row items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            <span>Delete category</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {openCreateChannel && (
        <ChannelCreateDialog
          parentId={category.id}
          rootId={category.rootId}
          open={openCreateChannel}
          onOpenChange={setOpenCreateChannel}
        />
      )}
      {openCreatePage && (
        <PageCreateDialog
          parentId={category.id}
          rootId={category.rootId}
          open={openCreatePage}
          onOpenChange={setOpenCreatePage}
        />
      )}
      {openCreateDatabase && (
        <DatabaseCreateDialog
          parentId={category.id}
          rootId={category.rootId}
          open={openCreateDatabase}
          onOpenChange={setOpenCreateDatabase}
        />
      )}
      {openCreateFolder && (
        <FolderCreateDialog
          parentId={category.id}
          rootId={category.rootId}
          open={openCreateFolder}
          onOpenChange={setOpenCreateFolder}
        />
      )}
      {openDelete && (
        <NodeDeleteDialog
          id={category.id}
          title="Are you sure you want to delete this category?"
          description="This action cannot be undone. Items inside this category will no longer be accessible by you or others you've shared them with."
          open={openDelete}
          onOpenChange={setOpenDelete}
        />
      )}
    </Fragment>
  );
};
