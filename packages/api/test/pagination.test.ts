import { describe, expect, it } from 'vitest';

import {
  buildPage,
  decodeCursor,
  encodeCursor,
  listQuerySchema,
  toPageRequest,
} from '../src/lib/pagination';

describe('pagination', () => {
  it('round trips cursors', () => {
    expect(decodeCursor(encodeCursor('01j0abcwc'))).toBe('01j0abcwc');
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('builds a page with a cursor when more items exist', () => {
    const page = buildPage([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2);
    expect(page.data).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(page.pagination).toEqual({
      limit: 2,
      nextCursor: encodeCursor('b'),
      hasMore: true,
    });
  });

  it('ends pagination on the last page', () => {
    const page = buildPage([{ id: 'a' }], 2);
    expect(page.pagination).toEqual({
      limit: 2,
      nextCursor: null,
      hasMore: false,
    });
  });

  it('parses list queries with defaults and bounds', () => {
    const query = listQuerySchema.parse({ search: '  road  ' });
    expect(toPageRequest(query)).toEqual({
      limit: 50,
      after: null,
      search: 'road',
    });

    expect(listQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
