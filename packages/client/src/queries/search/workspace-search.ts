import { LocalNode } from '@colanode/client/types/nodes';

// Markers wrapped around the matched terms in search snippets. Control
// characters never appear in user content, so the UI can split on them.
export const SEARCH_HIGHLIGHT_START = '\u0002';
export const SEARCH_HIGHLIGHT_END = '\u0003';

export type WorkspaceSearchQueryInput = {
  type: 'workspace.search';
  searchQuery: string;
  userId: string;
  limit?: number;
};

export type WorkspaceSearchResult = {
  node: LocalNode;
  // Excerpt around the matched terms, wrapped in SEARCH_HIGHLIGHT_START and
  // SEARCH_HIGHLIGHT_END markers.
  snippet: string | null;
};

declare module '@colanode/client/queries' {
  interface QueryMap {
    'workspace.search': {
      input: WorkspaceSearchQueryInput;
      output: WorkspaceSearchResult[];
    };
  }
}
