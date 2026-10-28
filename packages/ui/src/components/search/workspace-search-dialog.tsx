import { keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { WorkspaceSearchResult } from '@colanode/client/queries';
import { NodeBreadcrumbItem } from '@colanode/ui/components/nodes/node-breadcrumb-item';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@colanode/ui/components/ui/command';
import { useLayout } from '@colanode/ui/contexts/layout';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useQuery } from '@colanode/ui/hooks/use-query';
import { getSearchResultTarget, splitSearchSnippet } from '@colanode/ui/lib/search';

const SEARCH_DEBOUNCE_MS = 150;

interface WorkspaceSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkspaceSearchDialog = ({
  open,
  onOpenChange,
}: WorkspaceSearchDialogProps) => {
  const workspace = useWorkspace();
  const layout = useLayout();
  const navigate = useNavigate({ from: '/workspace/$userId' });

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timeout);
  }, [query]);

  const searchQuery = useQuery(
    {
      type: 'workspace.search',
      searchQuery: debouncedQuery,
      userId: workspace.userId,
    },
    {
      enabled: open && debouncedQuery.length > 0,
      placeholderData: keepPreviousData,
    }
  );

  const results = debouncedQuery.length > 0 ? (searchQuery.data ?? []) : [];

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setQuery('');
      setDebouncedQuery('');
    }

    onOpenChange(value);
  };

  const openResult = (result: WorkspaceSearchResult) => {
    const nodeId = getSearchResultTarget(result.node);
    handleOpenChange(false);

    if (layout.openInTab) {
      layout.openInTab(`/workspace/${workspace.userId}/${nodeId}`);
      return;
    }

    navigate({ to: '$nodeId', params: { nodeId } });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search pages, databases, records, files and messages"
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search in this workspace..."
      />
      <CommandList>
        {debouncedQuery.length > 0 && !searchQuery.isFetching && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={result.node.id}
                value={result.node.id}
                onSelect={() => openResult(result)}
                className="flex flex-col items-start gap-1"
              >
                <NodeBreadcrumbItem node={result.node} />
                <SearchSnippet result={result} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Searching content synced to this device.
      </p>
    </CommandDialog>
  );
};

const SearchSnippet = ({ result }: { result: WorkspaceSearchResult }) => {
  if (!result.snippet) {
    return null;
  }

  const parts = splitSearchSnippet(result.snippet);
  const text = parts.map((part) => part.text).join('');

  // A match on the name alone repeats the title shown just above.
  if ('name' in result.node && text === result.node.name) {
    return null;
  }

  return (
    <p className="line-clamp-2 pl-6 text-xs text-muted-foreground">
      {parts.map((part, index) =>
        part.highlight ? (
          <mark
            key={index}
            className="rounded-sm bg-yellow-200/60 text-foreground dark:bg-yellow-500/30"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </p>
  );
};
