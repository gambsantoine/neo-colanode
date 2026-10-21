import { inArray, useLiveQuery } from '@tanstack/react-db';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { LocalNode } from '@colanode/client/types';
import { extractNodeRole, hasNodeRole } from '@colanode/core';
import { Avatar } from '@colanode/ui/components/avatars/avatar';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@colanode/ui/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@colanode/ui/components/ui/popover';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { defaultIcons } from '@colanode/ui/lib/assets';
import { cn } from '@colanode/ui/lib/utils';

export interface FolderOption {
  id: string;
  name: string;
  avatar: string | null;
  spaceId: string;
  spaceName: string;
}

// Lists the folders in which the current user is allowed to create files
// (same rule as fileModel.canCreate: editor role on the folder's tree).
export const useWritableFolders = (): FolderOption[] => {
  const workspace = useWorkspace();

  const nodesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => inArray(nodes.type, ['folder', 'space']))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    [workspace.userId]
  );

  return useMemo(() => {
    const nodes = nodesQuery.data as LocalNode[];
    const spaces = new Map<string, LocalNode>();
    for (const node of nodes) {
      if (node.type === 'space') {
        spaces.set(node.id, node);
      }
    }

    const options: FolderOption[] = [];
    for (const node of nodes) {
      if (node.type !== 'folder') {
        continue;
      }

      const space = spaces.get(node.rootId);
      const tree = space ? [space, node] : [node];
      const role = extractNodeRole(tree, workspace.userId);
      if (!role || !hasNodeRole(role, 'editor')) {
        continue;
      }

      options.push({
        id: node.id,
        name: node.name || 'Untitled',
        avatar: node.avatar ?? null,
        spaceId: node.rootId,
        spaceName:
          space && space.type === 'space' ? space.name : 'Unknown space',
      });
    }

    return options.sort(
      (a, b) =>
        a.spaceName.localeCompare(b.spaceName) || a.name.localeCompare(b.name)
    );
  }, [nodesQuery.data, workspace.userId]);
};

interface FolderSelectProps {
  value: string | null | undefined;
  onChange: (id: string) => void;
  className?: string;
}

export const FolderSelect = ({
  value,
  onChange,
  className,
}: FolderSelectProps) => {
  const [open, setOpen] = useState(false);
  const folders = useWritableFolders();
  const selected = value
    ? folders.find((folder) => folder.id === value)
    : undefined;

  const groups = useMemo(() => {
    const result = new Map<string, FolderOption[]>();
    for (const folder of folders) {
      const group = result.get(folder.spaceId) ?? [];
      group.push(folder);
      result.set(folder.spaceId, group);
    }
    return Array.from(result.values());
  }, [folders]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between gap-2 p-2', className)}
        >
          {selected ? (
            <span className="flex min-w-0 flex-row items-center gap-1">
              <Avatar
                id={selected.id}
                name={selected.name}
                avatar={selected.avatar ?? defaultIcons.folder}
                className="size-4"
              />
              <span className="truncate">
                {selected.spaceName} / {selected.name}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select folder...</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1 overflow-hidden">
        <Command className="min-h-min">
          <CommandInput placeholder="Search folders..." className="h-9" />
          <CommandEmpty>No folder found.</CommandEmpty>
          <CommandList>
            {groups.map((group) => (
              <CommandGroup
                key={group[0]!.spaceId}
                heading={group[0]!.spaceName}
                className="h-min overflow-y-auto"
              >
                {group.map((folder) => (
                  <CommandItem
                    key={folder.id}
                    value={`${folder.id} - ${folder.spaceName} ${folder.name}`}
                    onSelect={() => {
                      onChange(folder.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex w-full flex-row items-center gap-2">
                      <Avatar
                        id={folder.id}
                        name={folder.name}
                        avatar={folder.avatar ?? defaultIcons.folder}
                        className="size-4"
                      />
                      <p className="truncate">{folder.name}</p>
                      <Check
                        className={cn(
                          'ml-auto size-4',
                          value === folder.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
