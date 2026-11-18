import { eq, useLiveQuery } from '@tanstack/react-db';
import { X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { LocalPageNode } from '@colanode/client/types';
import { normalizeTag } from '@colanode/core';
import { Badge } from '@colanode/ui/components/ui/badge';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { usePageUpdate } from '@colanode/ui/hooks/use-page-update';

interface PageTagsEditorProps {
  page: LocalPageNode;
  canEdit: boolean;
}

// Tags belong to the workspace: the ones already used in it are suggested.
export const PageTagsEditor = ({ page, canEdit }: PageTagsEditorProps) => {
  const workspace = useWorkspace();
  const suggestionsId = useId();
  const updatePage = usePageUpdate(page.id);
  const [newTag, setNewTag] = useState('');

  const pagesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'page')),
    [workspace.userId]
  );

  const tags = useMemo(() => page.tags ?? [], [page.tags]);
  const suggestions = useMemo(() => {
    const used = new Set<string>();
    for (const node of pagesQuery.data) {
      if (node.type === 'page') {
        node.tags?.forEach((tag) => used.add(tag));
      }
    }

    return [...used].filter((tag) => !tags.includes(tag)).sort();
  }, [pagesQuery.data, tags]);

  const addTag = () => {
    const tag = normalizeTag(newTag);
    setNewTag('');
    if (tag && !tags.includes(tag)) {
      updatePage((draft) => {
        draft.tags = [...tags, tag];
      });
    }
  };

  const removeTag = (tag: string) => {
    updatePage((draft) => {
      draft.tags = tags.filter((value) => value !== tag);
    });
  };

  if (!canEdit && tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          #{tag}
          {canEdit && (
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="cursor-pointer"
              onClick={() => removeTag(tag)}
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {canEdit && (
        <>
          <input
            value={newTag}
            list={suggestionsId}
            aria-label="Add a tag"
            placeholder="Add a tag..."
            onChange={(event) => setNewTag(event.target.value)}
            onBlur={addTag}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addTag();
              }
            }}
            className="w-28 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          <datalist id={suggestionsId}>
            {suggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </>
      )}
    </div>
  );
};
