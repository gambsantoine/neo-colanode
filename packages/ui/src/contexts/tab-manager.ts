import { createContext, useContext } from 'react';

import { router } from '@colanode/ui/routes';

interface TabManagerContextProps {
  addTab: (location: string) => void;
  deleteTab: (id: string) => void;
  switchTab: (id: string) => void;
  getRouter: (id: string) => typeof router;
  // Makes the preview tab a regular one (no-op for other tabs).
  pinTab: (id: string) => void;
  previewTabId: string | null;
}

export const TabManagerContext = createContext<TabManagerContextProps>(
  {} as TabManagerContextProps
);

export const useTabManager = () => useContext(TabManagerContext);
