import { useMutation } from '@tanstack/react-query';
import { BookOpen, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  LocalPageNode,
  LocalSpaceNode,
  LocalWikiNode,
} from '@colanode/client/types';
import { generateId, IdType } from '@colanode/core';
import {
  SpaceForm,
  SpaceFormValues,
} from '@colanode/ui/components/spaces/space-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { cn } from '@colanode/ui/lib/utils';

type SpaceKind = 'space' | 'wiki';

const KINDS: {
  value: SpaceKind;
  label: string;
  description: string;
  icon: typeof BookOpen;
}[] = [
  {
    value: 'space',
    label: 'Space',
    description: 'Pages, channels, databases and files for your team.',
    icon: LayoutGrid,
  },
  {
    value: 'wiki',
    label: 'Wiki',
    description:
      'Documentation that can be published with a link or a public URL.',
    icon: BookOpen,
  },
];

interface SpaceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SpaceCreateDialog = ({
  open,
  onOpenChange,
}: SpaceCreateDialogProps) => {
  const workspace = useWorkspace();
  const [kind, setKind] = useState<SpaceKind>('space');

  const { mutate } = useMutation({
    mutationFn: async (values: SpaceFormValues) => {
      const nodes = workspace.collections.nodes;

      const spaceId = generateId(kind === 'wiki' ? IdType.Wiki : IdType.Space);
      const base = {
        id: spaceId,
        parentId: null,
        name: values.name,
        description: values.description,
        avatar: values.avatar,
        collaborators: {
          [workspace.userId]: 'admin' as const,
        },
        rootId: spaceId,
        createdAt: new Date().toISOString(),
        createdBy: workspace.userId,
        updatedAt: null,
        updatedBy: null,
        localRevision: '0',
        serverRevision: '0',
      };

      const space: LocalSpaceNode | LocalWikiNode =
        kind === 'wiki'
          ? { ...base, type: 'wiki' }
          : { ...base, type: 'space', visibility: 'private' };

      const pageId = generateId(IdType.Page);
      const page: LocalPageNode = {
        id: pageId,
        type: 'page',
        name: 'Home',
        parentId: spaceId,
        rootId: spaceId,
        createdAt: new Date().toISOString(),
        createdBy: workspace.userId,
        updatedAt: null,
        updatedBy: null,
        localRevision: '0',
        serverRevision: '0',
      };

      nodes.insert([space, page]);
      return space;
    },
    onSuccess: () => {
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-xl max-w-full">
        <DialogHeader>
          <DialogTitle>
            {kind === 'wiki' ? 'Create wiki' : 'Create space'}
          </DialogTitle>
          <DialogDescription>
            {kind === 'wiki'
              ? 'Write documentation with your peers, then publish it when it is ready'
              : 'Create a new space to collaborate with your peers'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={kind === item.value}
              onClick={() => setKind(item.value)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-md border p-3 text-left cursor-pointer transition-colors',
                kind === item.value
                  ? 'border-primary bg-accent'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <item.icon className="size-4" />
                {item.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
        <SpaceForm
          onSubmit={(values) => mutate(values)}
          submitText="Create"
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
