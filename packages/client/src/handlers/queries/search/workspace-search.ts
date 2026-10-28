import { WorkspaceQueryHandlerBase } from '@colanode/client/handlers/queries/workspace-query-handler-base';
import { ChangeCheckResult, QueryHandler } from '@colanode/client/lib';
import { mapNode } from '@colanode/client/lib/mappers';
import {
  buildSearchMatchQuery,
  searchWorkspaceTexts,
} from '@colanode/client/lib/search';
import {
  WorkspaceSearchQueryInput,
  WorkspaceSearchResult,
} from '@colanode/client/queries/search/workspace-search';
import { Event } from '@colanode/client/types/events';

const DEFAULT_LIMIT = 50;

export class WorkspaceSearchQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<WorkspaceSearchQueryInput>
{
  public async handleQuery(
    input: WorkspaceSearchQueryInput
  ): Promise<WorkspaceSearchResult[]> {
    const matchQuery = buildSearchMatchQuery(input.searchQuery);
    if (!matchQuery) {
      return [];
    }

    const workspace = this.getWorkspace(input.userId);
    const rows = await searchWorkspaceTexts(
      workspace.database,
      matchQuery,
      input.limit ?? DEFAULT_LIMIT
    );

    return rows.map((row) => ({
      node: mapNode(row),
      snippet: row.snippet,
    }));
  }

  public async checkForChanges(
    event: Event,
    input: WorkspaceSearchQueryInput,
    _: WorkspaceSearchResult[]
  ): Promise<ChangeCheckResult<WorkspaceSearchQueryInput>> {
    if (
      event.type === 'workspace.deleted' &&
      event.workspace.userId === input.userId
    ) {
      return {
        hasChanges: true,
        result: [],
      };
    }

    return {
      hasChanges: false,
    };
  }
}
