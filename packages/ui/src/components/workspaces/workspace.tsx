import { WorkspaceLayout } from '@colanode/ui/components/workspaces/workspace-layout';
import { WorkspaceLocationTracker } from '@colanode/ui/components/workspaces/workspace-location-tracker';
import { WorkspaceNotFound } from '@colanode/ui/components/workspaces/workspace-not-found';
import { WorkspaceProvider } from '@colanode/ui/components/workspaces/workspace-provider';

interface WorkspaceProps {
  userId: string;
}

export const Workspace = ({ userId }: WorkspaceProps) => {
  return (
    <WorkspaceProvider userId={userId} fallback={<WorkspaceNotFound />}>
      <WorkspaceLocationTracker />
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
};
