import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { LocalPresentationNode } from '@colanode/client/types';
import { generateId, IdType, PresentationFormat } from '@colanode/core';
import {
  PageForm,
  PageFormValues,
} from '@colanode/ui/components/pages/page-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { DEFAULT_REVEAL_CONTENT } from '@colanode/ui/lib/reveal';
import { DEFAULT_PRESENTATION_CONTENT } from '@colanode/ui/lib/slides';
import { cn } from '@colanode/ui/lib/utils';

const FORMATS: Array<{
  value: PresentationFormat;
  label: string;
  description: string;
}> = [
  {
    value: 'slidev',
    label: 'Slidev',
    description: 'Layouts per slide, two columns, images',
  },
  {
    value: 'reveal',
    label: 'Reveal.js',
    description: 'Vertical slides, fragments, transitions, themes',
  },
];

interface PresentationCreateDialogProps {
  parentId: string;
  rootId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PresentationCreateDialog = ({
  parentId,
  rootId,
  open,
  onOpenChange,
}: PresentationCreateDialogProps) => {
  const workspace = useWorkspace();
  const navigate = useNavigate({ from: '/workspace/$userId' });
  const [format, setFormat] = useState<PresentationFormat>('slidev');
  const { mutate } = useMutation({
    mutationFn: async (values: PageFormValues) => {
      const presentationId = generateId(IdType.Presentation);
      const nodes = workspace.collections.nodes;

      const presentation: LocalPresentationNode = {
        id: presentationId,
        type: 'presentation',
        name: values.name,
        avatar: values.avatar,
        parentId,
        rootId,
        content:
          format === 'reveal'
            ? DEFAULT_REVEAL_CONTENT
            : DEFAULT_PRESENTATION_CONTENT,
        format,
        createdAt: new Date().toISOString(),
        createdBy: workspace.userId,
        updatedAt: null,
        updatedBy: null,
        localRevision: '0',
        serverRevision: '0',
      };

      nodes.insert(presentation);
      return presentation;
    },
    onSuccess: (presentation) => {
      navigate({
        to: '$nodeId',
        params: {
          nodeId: presentation.id,
        },
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create presentation</DialogTitle>
          <DialogDescription>
            Create a slide deck written in Markdown
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFormat(item.value)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border p-3 text-left text-sm cursor-pointer',
                format === item.value
                  ? 'border-primary bg-accent'
                  : 'hover:bg-accent/50'
              )}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
        <PageForm
          id={generateId(IdType.Presentation)}
          values={{
            name: '',
          }}
          submitText="Create"
          onCancel={() => {
            onOpenChange(false);
          }}
          onSubmit={(values) => mutate(values)}
        />
      </DialogContent>
    </Dialog>
  );
};
