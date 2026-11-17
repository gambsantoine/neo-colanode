import { CalendarPlus, PencilLine } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LocalPageNode } from '@colanode/client/types';
import { formatDate } from '@colanode/core';
import { usePageUpdate } from '@colanode/ui/hooks/use-page-update';

interface PageHeaderProps {
  page: LocalPageNode;
  canEdit: boolean;
}

export const PageHeader = ({ page, canEdit }: PageHeaderProps) => {
  const updatePage = usePageUpdate(page.id);
  const [title, setTitle] = useState(page.name);

  useEffect(() => {
    setTitle(page.name);
  }, [page.name]);

  const saveTitle = () => {
    const name = title.trim();
    if (!name) {
      setTitle(page.name);
      return;
    }

    if (name !== page.name) {
      updatePage((draft) => {
        draft.name = name;
      });
    }
  };

  return (
    <div className="pt-4 pb-2">
      <input
        value={title}
        readOnly={!canEdit}
        aria-label="Page title"
        placeholder="Untitled"
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className="w-full bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-2 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarPlus className="size-3.5" />
          Created {formatDate(page.createdAt)}
        </span>
        {page.updatedAt && (
          <span className="inline-flex items-center gap-1.5">
            <PencilLine className="size-3.5" />
            Last edited {formatDate(page.updatedAt)}
          </span>
        )}
      </div>
    </div>
  );
};
