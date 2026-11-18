import { sha256 } from 'js-sha256';
import { sql } from 'kysely';

import { WorkspaceStatus } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectWikiPublication } from '@colanode/server/data/schema';

interface WikiVersionRow {
  nodes_revision: string | null;
  nodes_count: string | null;
  documents_revision: string | null;
  workspace_status: number | null;
}

// Fingerprint of everything a public page depends on: any created, updated
// or deleted node or document of the wiki, and the publication settings.
// One indexed aggregate query, much cheaper than loading the wiki.
// Returns null when the workspace can no longer be read.
export const fetchWikiVersion = async (
  publication: SelectWikiPublication
): Promise<string | null> => {
  const result = await sql<WikiVersionRow>`
    select
      (select max(revision)::text from nodes where root_id = ${publication.wiki_id}) as nodes_revision,
      (select count(*)::text from nodes where root_id = ${publication.wiki_id}) as nodes_count,
      (
        select max(d.revision)::text
        from documents d
        inner join nodes n on n.id = d.id
        where n.root_id = ${publication.wiki_id}
      ) as documents_revision,
      (select status from workspaces where id = ${publication.workspace_id}) as workspace_status
  `.execute(database);

  const row = result.rows[0];
  if (
    !row ||
    (row.workspace_status !== WorkspaceStatus.Active &&
      row.workspace_status !== WorkspaceStatus.Readonly)
  ) {
    return null;
  }

  return sha256(
    JSON.stringify([
      row.nodes_revision,
      row.nodes_count,
      row.documents_revision,
      publication.slug,
      publication.access,
      publication.home_node_id,
      publication.updated_at?.toISOString() ?? null,
    ])
  ).slice(0, 24);
};
