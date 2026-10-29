import { useLiveQuery } from '@tanstack/react-db';
import {
  RouterContextProvider,
  useRouterState,
} from '@tanstack/react-router';
import { useMemo } from 'react';

import { collections } from '@colanode/ui/collections';
import { SidebarDesktop } from '@colanode/ui/components/layouts/sidebars/sidebar-desktop';
import { WorkspaceProvider } from '@colanode/ui/components/workspaces/workspace-provider';
import { LayoutContext, useLayout } from '@colanode/ui/contexts/layout';
import { useTabManager } from '@colanode/ui/contexts/tab-manager';
import { useIsMobile } from '@colanode/ui/hooks/use-is-mobile';
import { router as appRouter } from '@colanode/ui/routes';

// Sidebar shared by all tabs: it shows the workspace of the active tab and
// opens what is clicked in its own tab.
export const TabsSidebar = () => {
  const isMobile = useIsMobile();
  const tabManager = useTabManager();

  const tabsQuery = useLiveQuery(
    (q) =>
      q.from({ tabs: collections.tabs }).select(({ tabs }) => ({
        id: tabs.id,
        lastActiveAt: tabs.lastActiveAt,
      })),
    []
  );

  const activeTabId = tabsQuery.data?.toSorted((a, b) =>
    b.lastActiveAt.localeCompare(a.lastActiveAt)
  )[0]?.id;

  if (isMobile || !activeTabId) {
    return null;
  }

  return <TabsSidebarContent router={tabManager.getRouter(activeTabId)} />;
};

interface TabsSidebarContentProps {
  router: typeof appRouter;
}

const TabsSidebarContent = ({ router }: TabsSidebarContentProps) => {
  const layout = useLayout();
  const sidebarLayout = useMemo(
    () => ({ ...layout, openLinksInTabs: true }),
    [layout]
  );
  const pathname = useRouterState({
    router,
    select: (state) => state.location.pathname,
  });
  const userId = pathname.match(/^\/workspace\/([^/]+)/)?.[1];

  if (!userId) {
    return null;
  }

  return (
    <RouterContextProvider router={router}>
      <LayoutContext.Provider value={sidebarLayout}>
        <WorkspaceProvider userId={userId} fallback={null}>
          <SidebarDesktop />
        </WorkspaceProvider>
      </LayoutContext.Provider>
    </RouterContextProvider>
  );
};
