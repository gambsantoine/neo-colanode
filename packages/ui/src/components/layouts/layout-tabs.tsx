import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Tab } from '@colanode/client/types';
import {
  compareString,
  generateFractionalIndex,
  generateId,
  IdType,
} from '@colanode/core';
import { collections } from '@colanode/ui/collections';
import { TabsContent } from '@colanode/ui/components/layouts/tabs/tabs-content';
import { TabsHeader } from '@colanode/ui/components/layouts/tabs/tabs-header';
import { TabsSidebar } from '@colanode/ui/components/layouts/tabs/tabs-sidebar';
import { LayoutContext } from '@colanode/ui/contexts/layout';
import { TabManagerContext } from '@colanode/ui/contexts/tab-manager';
import { router, routeTree } from '@colanode/ui/routes';
import { routeMasks } from '@colanode/ui/routes/masks';

// Remembers, per browser window, which tab the address bar belongs to so a
// page reload reopens it instead of creating a new tab.
const ACTIVE_TAB_SESSION_KEY = 'colanode.activeTabId';

interface LayoutTabsProps {
  // Web only: mirror the active tab location in the address bar and open the
  // URL the app was loaded with in a tab.
  syncBrowserUrl?: boolean;
}

const getActiveTabId = (): string | undefined => {
  const tabs = collections.tabs.map((tab) => tab);
  return tabs.toSorted((a, b) =>
    b.lastActiveAt.localeCompare(a.lastActiveAt)
  )[0]?.id;
};

// On web, links point to masked URLs (/<workspaceId>/...) while tabs store
// the real location (/workspace/<userId>/...).
const unmaskLocation = (location: string): string => {
  if (location.startsWith('/workspace/')) {
    return location;
  }

  const [, workspaceId, ...rest] = location.split('/');
  const workspace = collections.workspaces
    .map((workspace) => workspace)
    .find((workspace) => workspace.workspaceId === workspaceId);
  if (!workspace) {
    return location;
  }

  return ['/workspace', workspace.userId, ...rest].join('/');
};

const readSessionTabId = (): string | null => {
  try {
    return sessionStorage.getItem(ACTIVE_TAB_SESSION_KEY);
  } catch {
    return null;
  }
};

const writeSessionTabId = (id: string) => {
  try {
    sessionStorage.setItem(ACTIVE_TAB_SESSION_KEY, id);
  } catch {
    // Storage unavailable (private mode...): reloads open a new tab.
  }
};

export const LayoutTabs = ({ syncBrowserUrl = false }: LayoutTabsProps) => {
  const routersRef = useRef<Map<string, typeof router>>(new Map());
  // Preview tab, like in VS Code: a single click shows its target in this tab
  // (replacing its content); a double click makes it a regular tab. Kept in
  // memory only, so after a reload every tab is a regular one.
  const [previewTabId, setPreviewTabId] = useState<string | null>(null);
  const previewRef = useRef<{ id: string; location: string } | null>(null);

  const setPreview = useCallback(
    (preview: { id: string; location: string } | null) => {
      previewRef.current = preview;
      setPreviewTabId(preview?.id ?? null);
    },
    []
  );

  const updateBrowserUrl = useCallback(
    (id: string) => {
      if (!syncBrowserUrl) {
        return;
      }

      const tabRouter = routersRef.current.get(id);
      const location = tabRouter?.state.location;
      if (!location) {
        return;
      }

      // Show the masked (shareable) URL when the route has a mask.
      const href = location.maskedLocation?.href ?? location.href;
      if (window.location.pathname + window.location.search !== href) {
        window.history.replaceState(window.history.state, '', href);
      }
      writeSessionTabId(id);
    },
    [syncBrowserUrl]
  );

  const handleTabAdd = useCallback((location: string) => {
    const tabs = collections.tabs.map((tab) => tab);
    const orderedTabs = tabs.toSorted((a, b) =>
      compareString(a.index, b.index)
    );

    const lastIndex = orderedTabs[orderedTabs.length - 1]?.index;
    const tab: Tab = {
      id: generateId(IdType.Tab),
      location,
      index: generateFractionalIndex(lastIndex, null),
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    collections.tabs.insert(tab);
    return tab.id;
  }, []);

  const handleTabDelete = useCallback(
    (id: string) => {
      const tabs = collections.tabs.map((tab) => tab);
      if (tabs.length === 1) {
        return;
      }

      collections.tabs.delete(id);
      routersRef.current.delete(id);
      if (previewRef.current?.id === id) {
        setPreview(null);
      }

      const activeTabId = getActiveTabId();
      if (activeTabId) {
        updateBrowserUrl(activeTabId);
      }
    },
    [updateBrowserUrl, setPreview]
  );

  const handleTabSwitch = useCallback(
    (id: string) => {
      collections.tabs.update(id, (tab) => {
        tab.lastActiveAt = new Date().toISOString();
      });
      updateBrowserUrl(id);
    },
    [updateBrowserUrl]
  );

  const handleTabPin = useCallback(
    (id: string) => {
      if (previewRef.current?.id === id) {
        setPreview(null);
      }
    },
    [setPreview]
  );

  const handleTabOpen = useCallback(
    (location: string, options?: { pin?: boolean }) => {
      const target = unmaskLocation(location);
      const preview = previewRef.current;
      // The preview tab location is saved once its page rendered, so a double
      // click right after a click has to match it through previewRef.
      const existingId =
        preview?.location === target
          ? preview.id
          : collections.tabs
              .map((tab) => tab)
              .find((tab) => tab.location === target)?.id;

      if (existingId) {
        handleTabSwitch(existingId);
        if (options?.pin) {
          handleTabPin(existingId);
        }
        return;
      }

      if (options?.pin) {
        handleTabAdd(target);
        return;
      }

      if (preview && collections.tabs.get(preview.id)) {
        routersRef.current.get(preview.id)?.history.push(target);
        setPreview({ id: preview.id, location: target });
        handleTabSwitch(preview.id);
        return;
      }

      setPreview({ id: handleTabAdd(target), location: target });
    },
    [handleTabAdd, handleTabSwitch, handleTabPin, setPreview]
  );

  const handleTabGetRouter = useCallback(
    (id: string) => {
      if (routersRef.current.has(id)) {
        return routersRef.current.get(id)!;
      }

      const tab = collections.tabs.get(id);
      if (!tab) {
        throw new Error(`Tab ${id} not found`);
      }

      const tabRouter = createRouter({
        routeTree,
        routeMasks: syncBrowserUrl ? routeMasks : undefined,
        context: {},
        history: createMemoryHistory({
          initialEntries: [tab.location ?? '/'],
        }),
        defaultPreload: 'intent',
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
      });

      tabRouter.subscribe('onRendered', (event) => {
        if (getActiveTabId() === id) {
          updateBrowserUrl(id);
        }

        if (!event.hrefChanged) {
          return;
        }

        const location = event.toLocation.href;
        window.colanode.executeMutation({
          type: 'tab.update',
          id,
          location,
        });
      });

      routersRef.current.set(id, tabRouter);
      return tabRouter;
    },
    [syncBrowserUrl, updateBrowserUrl]
  );

  // Web: the URL the app was loaded with is opened in a tab, unless it is
  // the address of the tab this window was showing before a reload.
  useEffect(() => {
    if (!syncBrowserUrl) {
      return;
    }

    const sessionTabId = readSessionTabId();
    if (sessionTabId && collections.tabs.get(sessionTabId)) {
      handleTabSwitch(sessionTabId);
      return;
    }

    const href =
      window.location.pathname + window.location.search + window.location.hash;
    if (href === '/' || href === '') {
      const activeTabId = getActiveTabId();
      if (activeTabId) {
        updateBrowserUrl(activeTabId);
      }
      return;
    }

    const existing = collections.tabs
      .map((tab) => tab)
      .find((tab) => tab.location === href);
    if (existing) {
      handleTabSwitch(existing.id);
    } else {
      handleTabAdd(href);
    }
  }, []);

  const tabManager = useMemo(
    () => ({
      addTab: handleTabAdd,
      deleteTab: handleTabDelete,
      switchTab: handleTabSwitch,
      getRouter: handleTabGetRouter,
      pinTab: handleTabPin,
      previewTabId,
    }),
    [
      handleTabAdd,
      handleTabDelete,
      handleTabSwitch,
      handleTabGetRouter,
      handleTabPin,
      previewTabId,
    ]
  );

  const layout = useMemo(
    () => ({
      openInNewTab: handleTabAdd,
      openInTab: handleTabOpen,
      showTabs: true,
    }),
    [handleTabAdd, handleTabOpen]
  );

  return (
    <TabManagerContext.Provider value={tabManager}>
      <LayoutContext.Provider value={layout}>
        <div className="flex h-full">
          <TabsSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TabsHeader />
            <TabsContent />
          </div>
        </div>
      </LayoutContext.Provider>
    </TabManagerContext.Provider>
  );
};
