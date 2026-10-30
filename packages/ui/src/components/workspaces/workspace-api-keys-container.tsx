import { KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ApiKeyAuditOutput } from '@colanode/core';
import { ApiKeyRevokeDialog } from '@colanode/ui/components/accounts/api-key-revoke-dialog';
import { McpSetupNote } from '@colanode/ui/components/api-keys/mcp-setup-note';
import { Avatar } from '@colanode/ui/components/avatars/avatar';
import { Container } from '@colanode/ui/components/layouts/containers/container';
import { Button } from '@colanode/ui/components/ui/button';
import { Separator } from '@colanode/ui/components/ui/separator';
import { WorkspaceApiKeysBreadcrumb } from '@colanode/ui/components/workspaces/workspace-api-keys-breadcrumb';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMutation } from '@colanode/ui/hooks/use-mutation';
import { useQuery } from '@colanode/ui/hooks/use-query';

export const WorkspaceApiKeysContainer = () => {
  const workspace = useWorkspace();
  const canView = workspace.role === 'owner' || workspace.role === 'admin';
  const { mutate: revoke, isPending: isRevoking } = useMutation();

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyAuditOutput | null>(
    null
  );

  const apiKeysQuery = useQuery(
    { type: 'api.key.list.workspace', userId: workspace.userId },
    { enabled: canView }
  );

  if (!canView) {
    return (
      <Container type="full" breadcrumb={<WorkspaceApiKeysBreadcrumb />}>
        <p className="text-sm text-muted-foreground">
          You do not have access to view the api keys of this workspace.
        </p>
      </Container>
    );
  }

  const apiKeys = apiKeysQuery.data?.apiKeys ?? [];

  return (
    <Container type="full" breadcrumb={<WorkspaceApiKeysBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Api keys
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              All api keys created by members of this workspace. The value
              of a key is never shown here, only its name and creator.
            </p>
            <Separator className="mt-3" />
          </div>
          <div className="flex flex-col gap-3">
            {apiKeys.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No api keys have been created in this workspace yet.
              </p>
            )}
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <KeyRound className="size-5 text-muted-foreground shrink-0" />
                <Avatar
                  id={apiKey.creator.id}
                  name={apiKey.creator.name}
                  avatar={null}
                  className="size-8 shrink-0"
                />
                <div className="grow min-w-0">
                  <p className="text-sm font-medium leading-none truncate">
                    {apiKey.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Created by {apiKey.creator.name} ({apiKey.creator.email})
                    {' · '}
                    {new Date(apiKey.createdAt).toLocaleDateString()}
                    {apiKey.revokedAt && ' · Revoked'}
                  </p>
                </div>
                {!apiKey.revokedAt && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isRevoking}
                    onClick={() => setRevokeTarget(apiKey)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <McpSetupNote canCreateKeysHere={false} />
        </div>
      </div>
      {revokeTarget && (
        <ApiKeyRevokeDialog
          name={revokeTarget.name}
          open={!!revokeTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRevokeTarget(null);
            }
          }}
          onConfirm={() => {
            revoke({
              input: {
                type: 'api.key.revoke.workspace',
                userId: workspace.userId,
                id: revokeTarget.id,
              },
              onSuccess() {
                apiKeysQuery.refetch();
              },
              onError(error) {
                toast.error(error.message);
              },
            });
          }}
        />
      )}
    </Container>
  );
};
