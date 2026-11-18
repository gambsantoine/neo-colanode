import { parseApiError } from '@colanode/client/lib/ky';
import { ChangeCheckResult, QueryHandler } from '@colanode/client/lib/types';
import { QueryError, QueryErrorCode } from '@colanode/client/queries';
import { WikiPublicationGetQueryInput } from '@colanode/client/queries/wikis/wiki-publication-get';
import { AppService } from '@colanode/client/services/app-service';
import { Event } from '@colanode/client/types/events';
import { WikiPublicationGetOutput } from '@colanode/core';

export class WikiPublicationGetQueryHandler implements QueryHandler<WikiPublicationGetQueryInput> {
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  async handleQuery(
    input: WikiPublicationGetQueryInput
  ): Promise<WikiPublicationGetOutput> {
    const workspace = this.app.getWorkspace(input.userId);
    if (!workspace) {
      throw new QueryError(
        QueryErrorCode.WorkspaceNotFound,
        'Workspace not found or has been deleted.'
      );
    }

    try {
      return await workspace.account.client
        .get(
          `v1/workspaces/${workspace.workspaceId}/wikis/${input.wikiId}/publication`
        )
        .json<WikiPublicationGetOutput>();
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new QueryError(QueryErrorCode.ApiError, apiError.message);
    }
  }

  async checkForChanges(
    _event: Event,
    _input: WikiPublicationGetQueryInput,
    _output: WikiPublicationGetOutput
  ): Promise<ChangeCheckResult<WikiPublicationGetQueryInput>> {
    return { hasChanges: false };
  }
}
