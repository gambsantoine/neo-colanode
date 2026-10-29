import { Outlet } from '@tanstack/react-router';

import { SidebarDesktop } from '@colanode/ui/components/layouts/sidebars/sidebar-desktop';
import { useLayout } from '@colanode/ui/contexts/layout';
import { useIsMobile } from '@colanode/ui/hooks/use-is-mobile';

export const WorkspaceLayout = () => {
  const isMobile = useIsMobile();
  const layout = useLayout();

  return (
    <div className="w-full h-full flex">
      {/* With tabs the sidebar is shared by all tabs, outside of them. */}
      {!isMobile && !layout.showTabs && <SidebarDesktop />}
      <section className="min-w-0 flex-1">
        <Outlet />
      </section>
    </div>
  );
};
