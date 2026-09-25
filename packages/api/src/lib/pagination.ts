import { z } from 'zod/v4';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export const versionQuerySchema = z.object({
  version: z.string().optional(),
});

export const listQuerySchema = versionQuerySchema.extend({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT),
  cursor: z.string().optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const paginationSchema = z.object({
  limit: z.number(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const listOutputSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    pagination: paginationSchema,
  });

export const itemOutputSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: item,
  });

/**
 * What repositories receive: fetch at most `limit + 1` items with an id
 * strictly greater than `after`, ordered by id, so `buildPage` can tell
 * whether another page exists.
 */
export type PageRequest = {
  limit: number;
  after: string | null;
  search: string | null;
};

// Cursors are opaque to callers: the base64url encoded id of the last item.
export const encodeCursor = (id: string) =>
  Buffer.from(id, 'utf8').toString('base64url');

export const decodeCursor = (cursor: string | undefined): string | null => {
  if (!cursor) {
    return null;
  }

  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  return decoded.length > 0 ? decoded : null;
};

export const toPageRequest = (query: ListQuery): PageRequest => ({
  limit: query.limit,
  after: decodeCursor(query.cursor),
  search: query.search ?? null,
});

export const buildPage = <T extends { id: string }>(
  items: T[],
  limit: number
) => {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const last = data[data.length - 1];

  return {
    data,
    pagination: {
      limit,
      nextCursor: hasMore && last ? encodeCursor(last.id) : null,
      hasMore,
    },
  };
};
