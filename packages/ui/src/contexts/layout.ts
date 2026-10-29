import { createContext, useContext } from 'react';

interface LayoutContextProps {
  openInNewTab: (url: string) => void;
  // Set by the tabbed layouts (desktop/web): the sidebar is rendered once,
  // outside of the tabs, so tab pages only render their content.
  showTabs?: boolean;
  // Tabbed layouts: focuses the tab showing this location, or shows it in the
  // preview tab; with `pin` it opens (or keeps) it as a regular tab.
  openInTab?: (url: string, options?: { pin?: boolean }) => void;
  // Set inside the shared sidebar: links open their target in a tab, like the
  // explorer in VS Code, instead of navigating the active tab.
  openLinksInTabs?: boolean;
}

export const LayoutContext = createContext<LayoutContextProps>(
  {} as LayoutContextProps
);

export const useLayout = () => useContext(LayoutContext);
