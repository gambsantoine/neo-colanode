import { LocalPresentationNode } from '@colanode/client/types';
import { NodeRole, hasNodeRole } from '@colanode/core';
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

interface PresentationUpdateDialogProps {
  presentation: LocalPresentationNode;
  role: NodeRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PresentationUpdateDialog = ({
  presentation,
  role,
  open,
  onOpenChange,
}: PresentationUpdateDialogProps) => {
  const workspace = useWorkspace();
  const canEdit = hasNodeRole(role, 'editor');

  const handleSubmit = (values: PageFormValues) => {
    const nodes = workspace.collections.nodes;
    if (!nodes.has(presentation.id)) {
      return;
    }

    nodes.update(presentation.id, (draft) => {
      if (draft.type !== 'presentation') {
        return;
      }

      draft.name = values.name;
      draft.avatar = values.avatar;
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update presentation</DialogTitle>
          <DialogDescription>
            Update the presentation name and icon
          </DialogDescription>
        </DialogHeader>
        <PageForm
          id={presentation.id}
          values={{
            name: presentation.name,
            avatar: presentation.avatar,
          }}
          submitText="Update"
          readOnly={!canEdit}
          onCancel={() => {
            onOpenChange(false);
          }}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
};
