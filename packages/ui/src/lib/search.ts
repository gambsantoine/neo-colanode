import {
  SEARCH_HIGHLIGHT_END,
  SEARCH_HIGHLIGHT_START,
} from '@colanode/client/queries';
import { LocalNode } from '@colanode/client/types';

export type SearchSnippetPart = {
  text: string;
  highlight: boolean;
};

// Splits a search snippet into plain and highlighted parts, using the markers
// placed around the matched terms by the workspace search query.
export const splitSearchSnippet = (snippet: string): SearchSnippetPart[] => {
  const parts: SearchSnippetPart[] = [];
  let rest = snippet;

  while (rest.length > 0) {
    const start = rest.indexOf(SEARCH_HIGHLIGHT_START);
    if (start === -1) {
      parts.push({ text: rest, highlight: false });
      break;
    }

    if (start > 0) {
      parts.push({ text: rest.slice(0, start), highlight: false });
    }

    const end = rest.indexOf(SEARCH_HIGHLIGHT_END, start);
    if (end === -1) {
      parts.push({ text: rest.slice(start + 1), highlight: true });
      break;
    }

    parts.push({ text: rest.slice(start + 1, end), highlight: true });
    rest = rest.slice(end + 1);
  }

  return parts.filter((part) => part.text.length > 0);
};

// Messages have no page of their own: a message result opens its channel or
// chat. Every other node opens itself.
export const getSearchResultTarget = (node: LocalNode): string => {
  if (node.type === 'message' && node.parentId) {
    return node.parentId;
  }

  return node.id;
};
