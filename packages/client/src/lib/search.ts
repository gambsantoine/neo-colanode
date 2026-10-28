import { Kysely, sql } from 'kysely';

import {
  SelectNode,
  WorkspaceDatabaseSchema,
} from '@colanode/client/databases/workspace';
import {
  SEARCH_HIGHLIGHT_END,
  SEARCH_HIGHLIGHT_START,
} from '@colanode/client/queries/search/workspace-search';

const SNIPPET_TOKENS = 12;

export type SearchTextRow = SelectNode & {
  rank: number;
  snippet: string | null;
};

// Turns free text into an FTS5 query: every word is quoted (so FTS5 operators
// typed by the user are taken literally) and prefix matched, and all words
// must match. Returns null when there is nothing to search for.
export const buildSearchMatchQuery = (input: string): string | null => {
  const words = input.match(/[\p{L}\p{N}]+/gu);
  if (!words || words.length === 0) {
    return null;
  }

  return words.map((word) => `"${word}"*`).join(' ');
};

// Searches node names/attributes and document contents of a workspace
// database. A node matching in both is returned once, with its best rank.
// Name matches are boosted over document content matches.
export const searchWorkspaceTexts = async (
  database: Kysely<WorkspaceDatabaseSchema>,
  matchQuery: string,
  limit: number
): Promise<SearchTextRow[]> => {
  const query = sql<SearchTextRow>`
    WITH matches AS (
      SELECT
        nt.id AS id,
        bm25(node_texts_fts, 10.0, 1.0) * 2 AS rank,
        snippet(node_texts_fts, -1, ${SEARCH_HIGHLIGHT_START}, ${SEARCH_HIGHLIGHT_END}, '…', ${SNIPPET_TOKENS}) AS snippet
      FROM node_texts_fts
      JOIN node_texts nt ON nt.seq = node_texts_fts.rowid
      WHERE node_texts_fts MATCH ${matchQuery}
      UNION ALL
      SELECT
        dt.id AS id,
        bm25(document_texts_fts) AS rank,
        snippet(document_texts_fts, -1, ${SEARCH_HIGHLIGHT_START}, ${SEARCH_HIGHLIGHT_END}, '…', ${SNIPPET_TOKENS}) AS snippet
      FROM document_texts_fts
      JOIN document_texts dt ON dt.seq = document_texts_fts.rowid
      WHERE document_texts_fts MATCH ${matchQuery}
    ),
    ranked AS (
      SELECT
        id,
        rank,
        snippet,
        ROW_NUMBER() OVER (PARTITION BY id ORDER BY rank) AS position
      FROM matches
    )
    SELECT n.*, r.rank AS rank, r.snippet AS snippet
    FROM ranked r
    JOIN nodes n ON n.id = r.id
    WHERE r.position = 1
    ORDER BY r.rank
    LIMIT ${limit}
  `.compile(database);

  const result = await database.executeQuery(query);
  return result.rows;
};
