import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ApiKeyOutput } from '@colanode/core';
import { AccountApiKeysBreadcrumb } from '@colanode/ui/components/accounts/account-api-keys-breadcrumb';
import { ApiKeyCreateDialog } from '@colanode/ui/components/accounts/api-key-create-dialog';
import { ApiKeyRevokeDialog } from '@colanode/ui/components/accounts/api-key-revoke-dialog';
import { McpSetupNote } from '@colanode/ui/components/api-keys/mcp-setup-note';
import { Container } from '@colanode/ui/components/layouts/containers/container';
import { Button } from '@colanode/ui/components/ui/button';
import { Separator } from '@colanode/ui/components/ui/separator';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMutation } from '@colanode/ui/hooks/use-mutation';
import { useQuery } from '@colanode/ui/hooks/use-query';

export const AccountApiKeysContainer = () => {
  const workspace = useWorkspace();
  const { mutate: revoke, isPending: isRevoking } = useMutation();

  const [openCreate, setOpenCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyOutput | null>(null);

  const apiKeysQuery = useQuery({
    type: 'api.key.list',
    accountId: workspace.accountId,
  });
  const workspacesQuery = useQuery({ type: 'workspace.list' });

  const apiKeys = apiKeysQuery.data?.apiKeys ?? [];
  const workspaces = workspacesQuery.data ?? [];
  const workspaceNameById = new Map(
    workspaces.map((item) => [item.workspaceId, item.name])
  );

  return (
    <Container type="full" breadcrumb={<AccountApiKeysBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Api keys
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Keys you&apos;ve created, global or scoped to a workspace.
                The value is only shown once, at creation.
              </p>
            </div>
            <Button type="button" onClick={() => setOpenCreate(true)}>
              <Plus className="size-4 mr-1" />
              Create
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            {apiKeys.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No api keys yet.
              </p>
            )}
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <KeyRound className="size-5 text-muted-foreground shrink-0" />
                <div className="grow min-w-0">
                  <p className="text-sm font-medium leading-none truncate">
                    {apiKey.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {apiKey.workspaceId
                      ? (workspaceNameById.get(apiKey.workspaceId) ??
                        'Unknown workspace')
                      : 'Global'}
                    {' · '}
                    Created {new Date(apiKey.createdAt).toLocaleDateString()}
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
          <McpSetupNote canCreateKeysHere />
        </div>
      </div>
      <ApiKeyCreateDialog
        accountId={workspace.accountId}
        workspaces={workspaces}
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={() => apiKeysQuery.refetch()}
      />
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
                type: 'api.key.revoke',
                accountId: workspace.accountId,
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
