import { PanelRight } from 'lucide-react';
import { createPortal } from 'react-dom';

import { LocalPageNode } from '@colanode/client/types';
import { NodeRole, hasNodeRole } from '@colanode/core';
import { Document } from '@colanode/ui/components/documents/document';
import { PageHeader } from '@colanode/ui/components/pages/page-header';
import { PageInfoPanel } from '@colanode/ui/components/pages/page-info-panel';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@colanode/ui/components/ui/sheet';
import { useContainer } from '@colanode/ui/contexts/container';
import { useNode } from '@colanode/ui/contexts/node';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useIsMobile } from '@colanode/ui/hooks/use-is-mobile';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { cn } from '@colanode/ui/lib/utils';

interface PageContainerProps {
  page: LocalPageNode;
  role: NodeRole;
}

export const PageContainer = ({ page, role }: PageContainerProps) => {
  const workspace = useWorkspace();
  const isMobile = useIsMobile();
  const { actionsSlot, type: containerType } = useContainer();
  const { breadcrumb, root } = useNode();
  // A modal is too narrow for a side panel.
  const panelAllowed = containerType !== 'modal';
  const location = breadcrumb.filter((node) => node.id !== page.id);
  const canEdit = hasNodeRole(role, 'editor');

  // Remembered per workspace, like in Notion: once opened it stays open
  // from page to page.
  const [storedOpen, setOpen] = useMetadata<boolean>(
    workspace.userId,
    'page.infoPanel.open'
  );
  const open = storedOpen === true;

  const toggle =
    actionsSlot && panelAllowed
      ? createPortal(
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Hide page info' : 'Show page info'}
            aria-pressed={open}
            title="Page info"
            className={cn(
              'flex items-center justify-center cursor-pointer hover:text-foreground',
              open ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <PanelRight className="size-4" />
          </button>,
          actionsSlot
        )
      : null;

  const panel = (
    <PageInfoPanel
      page={page}
      location={location}
      root={root ?? null}
      canEdit={canEdit}
      onClose={() => setOpen(false)}
    />
  );

  return (
    <>
      {toggle}
      <div className="flex min-h-full gap-6">
        <div className="min-w-0 flex-1">
          <PageHeader page={page} canEdit={canEdit} />
          <Document node={page} canEdit={canEdit} autoFocus="start" />
        </div>
        {open && panelAllowed && !isMobile && (
          <aside
            aria-label="Page info"
            className="sticky top-0 self-start w-80 shrink-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-l border-border -mr-4 lg:-mr-10"
          >
            {panel}
          </aside>
        )}
      </div>
      {isMobile && panelAllowed && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-[90%] max-w-sm p-0"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">Page info</SheetTitle>
            <SheetDescription className="sr-only">
              Properties, location, activity and statistics of the page
            </SheetDescription>
            {panel}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};
