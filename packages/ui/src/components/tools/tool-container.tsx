import { ReactNode } from 'react';

import { SidebarMobile } from '@colanode/ui/components/layouts/sidebars/sidebar-mobile';
import { useIsMobile } from '@colanode/ui/hooks/use-is-mobile';

interface ToolContainerProps {
  children: ReactNode;
}

// Page of a tool. Unlike Container it has no header bar (the tab already
// names the tool), so the tool gets the whole remaining height. The content
// scrolls when it is taller than the page.
export const ToolContainer = ({ children }: ToolContainerProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-full flex-col">
      {isMobile && (
        <div className="flex h-10 shrink-0 items-center">
          <SidebarMobile />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
};
