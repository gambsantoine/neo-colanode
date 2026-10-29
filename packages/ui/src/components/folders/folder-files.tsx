import { eq, useLiveInfiniteQuery } from '@tanstack/react-db';
import { useNavigate } from '@tanstack/react-router';
import { match } from 'ts-pattern';

import { FolderLayoutType, LocalFileNode } from '@colanode/client/types';
import { GalleryLayout } from '@colanode/ui/components/folders/galleries/gallery-layout';
import { GridLayout } from '@colanode/ui/components/folders/grids/grid-layout';
import { ListLayout } from '@colanode/ui/components/folders/lists/list-layout';
import { FolderContext } from '@colanode/ui/contexts/folder';
import { useLayout } from '@colanode/ui/contexts/layout';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

const FILES_PER_PAGE = 100;

interface FolderFilesProps {
  id: string;
  name: string;
  layout: FolderLayoutType;
}

export const FolderFiles = ({
  id,
  name,
  layout: folderLayout,
}: FolderFilesProps) => {
  const workspace = useWorkspace();
  const layout = useLayout();
  const navigate = useNavigate({ from: '/workspace/$userId/$nodeId' });

  const fileListQuery = useLiveInfiniteQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'file'))
        .where(({ nodes }) => eq(nodes.parentId, id))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    {
      pageSize: FILES_PER_PAGE,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === FILES_PER_PAGE ? allPages.length : undefined,
    },
    [workspace.userId, id]
  );

  const files = fileListQuery.data.map((node) => node as LocalFileNode);

  // Tabbed layouts, like in VS Code: a click shows the file in the preview
  // tab, a double click keeps it open in its own tab.
  const openFile = (fileId: string, pin: boolean) => {
    if (layout.openInTab) {
      layout.openInTab(`/workspace/${workspace.userId}/${fileId}`, { pin });
      return;
    }

    navigate({
      to: 'modal/$modalNodeId',
      params: { modalNodeId: fileId },
    });
  };

  return (
    <FolderContext.Provider
      value={{
        id,
        name,
        files,
        onClick: (_, id) => openFile(id, false),
        onDoubleClick: (_, id) => {
          if (layout.openInTab) {
            openFile(id, true);
          }
        },
        onMove: () => {},
      }}
    >
      {match(folderLayout)
        .with('grid', () => <GridLayout />)
        .with('list', () => <ListLayout />)
        .with('gallery', () => <GalleryLayout />)
        .exhaustive()}
    </FolderContext.Provider>
  );
};
