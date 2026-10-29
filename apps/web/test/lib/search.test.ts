import { describe, expect, it } from 'vitest';

import { buildSearchMatchQuery } from '@colanode/client/lib/search';
import {
  SEARCH_HIGHLIGHT_END,
  SEARCH_HIGHLIGHT_START,
} from '@colanode/client/queries';
import { LocalNode } from '@colanode/client/types';
import {
  getSearchResultTarget,
  splitSearchSnippet,
} from '@colanode/ui/lib/search';

const mark = (text: string) =>
  `${SEARCH_HIGHLIGHT_START}${text}${SEARCH_HIGHLIGHT_END}`;

describe('lib/search', () => {
  describe('buildSearchMatchQuery', () => {
    it('prefix matches every word', () => {
      expect(buildSearchMatchQuery('projet neo')).toBe('"projet"* "neo"*');
    });

    it('keeps accented words whole', () => {
      expect(buildSearchMatchQuery('réunion été')).toBe('"réunion"* "été"*');
    });

    it('neutralizes FTS5 syntax typed by the user', () => {
      expect(buildSearchMatchQuery('"a" OR b* (c) NEAR')).toBe(
        '"a"* "OR"* "b"* "c"* "NEAR"*'
      );
    });

    it('returns null when there is no word to search', () => {
      expect(buildSearchMatchQuery('')).toBeNull();
      expect(buildSearchMatchQuery('  !? ** ')).toBeNull();
    });
  });

  describe('splitSearchSnippet', () => {
    it('splits plain and highlighted parts', () => {
      expect(
        splitSearchSnippet(`On parle du ${mark('projet')} ${mark('Neo')}…`)
      ).toEqual([
        { text: 'On parle du ', highlight: false },
        { text: 'projet', highlight: true },
        { text: ' ', highlight: false },
        { text: 'Neo', highlight: true },
        { text: '…', highlight: false },
      ]);
    });

    it('handles a snippet without highlight', () => {
      expect(splitSearchSnippet('plain')).toEqual([
        { text: 'plain', highlight: false },
      ]);
    });

    it('highlights until the end when the closing marker is missing', () => {
      expect(splitSearchSnippet(`a ${SEARCH_HIGHLIGHT_START}b`)).toEqual([
        { text: 'a ', highlight: false },
        { text: 'b', highlight: true },
      ]);
    });
  });

  describe('getSearchResultTarget', () => {
    it('opens the channel of a message', () => {
      const node = { id: 'msg', type: 'message', parentId: 'chan' };
      expect(getSearchResultTarget(node as LocalNode)).toBe('chan');
    });

    it('opens other nodes directly', () => {
      const node = { id: 'page', type: 'page', parentId: 'space' };
      expect(getSearchResultTarget(node as LocalNode)).toBe('page');
    });
  });
});
