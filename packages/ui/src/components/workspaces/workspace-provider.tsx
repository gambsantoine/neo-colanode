import { eq, useLiveQuery } from '@tanstack/react-db';

import { collections } from '@colanode/ui/collections';
import { ServerProvider } from '@colanode/ui/components/servers/server-provider';
import { WorkspaceContext } from '@colanode/ui/contexts/workspace';

interface WorkspaceProviderProps {
  userId: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

export const WorkspaceProvider = ({
  userId,
  fallback,
  children,
}: WorkspaceProviderProps) => {
  const workspaceQuery = useLiveQuery(
    (q) =>
      q
        .from({ workspaces: collections.workspaces })
        .where(({ workspaces }) => eq(workspaces.userId, userId))
        .select(({ workspaces }) => ({
          userId: workspaces.userId,
          workspaceId: workspaces.workspaceId,
          role: workspaces.role,
          accountId: workspaces.accountId,
        }))
        .findOne(),
    [userId]
  );

  const accountQuery = useLiveQuery(
    (q) =>
      q
        .from({ accounts: collections.accounts })
        .where(({ accounts }) =>
          eq(accounts.id, workspaceQuery.data?.accountId)
        )
        .select(({ accounts }) => ({
          server: accounts.server,
        }))
        .findOne(),
    [workspaceQuery.data?.accountId]
  );

  const role = workspaceQuery.data?.role;
  const workspaceId = workspaceQuery.data?.workspaceId;
  const accountId = workspaceQuery.data?.accountId;
  const server = accountQuery.data?.server;

  if (!workspaceId || !accountId || !server) {
    return fallback;
  }

  if (!userId || !role) {
    return fallback;
  }

  return (
    <ServerProvider domain={server}>
      <WorkspaceContext.Provider
        value={{
          accountId: accountId,
          workspaceId: workspaceId,
          userId,
          role,
          collections: collections.workspace(userId),
        }}
      >
        {children}
      </WorkspaceContext.Provider>
    </ServerProvider>
  );
};
