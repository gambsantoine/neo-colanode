import { useCallback } from 'react';

import { LocalPageNode } from '@colanode/client/types';
import { useWorkspace } from '@colanode/ui/contexts/workspace';

// Applies a local-first update to the attributes of a page.
export const usePageUpdate = (pageId: string) => {
  const workspace = useWorkspace();

  return useCallback(
    (update: (draft: LocalPageNode) => void) => {
      const nodes = workspace.collections.nodes;
      if (!nodes.has(pageId)) {
        return;
      }

      nodes.update(pageId, (draft) => {
        if (draft.type === 'page') {
          update(draft);
        }
      });
    },
    [workspace, pageId]
  );
};
