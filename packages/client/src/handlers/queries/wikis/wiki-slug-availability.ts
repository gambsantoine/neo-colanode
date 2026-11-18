import { parseApiError } from '@colanode/client/lib/ky';
import { ChangeCheckResult, QueryHandler } from '@colanode/client/lib/types';
import { QueryError, QueryErrorCode } from '@colanode/client/queries';
import { WikiSlugAvailabilityQueryInput } from '@colanode/client/queries/wikis/wiki-slug-availability';
import { AppService } from '@colanode/client/services/app-service';
import { Event } from '@colanode/client/types/events';
import { WikiSlugAvailabilityOutput } from '@colanode/core';

export class WikiSlugAvailabilityQueryHandler implements QueryHandler<WikiSlugAvailabilityQueryInput> {
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  async handleQuery(
    input: WikiSlugAvailabilityQueryInput
  ): Promise<WikiSlugAvailabilityOutput> {
    const workspace = this.app.getWorkspace(input.userId);
    if (!workspace) {
      throw new QueryError(
        QueryErrorCode.WorkspaceNotFound,
        'Workspace not found or has been deleted.'
      );
    }

    try {
      return await workspace.account.client
        .get(`v1/workspaces/${workspace.workspaceId}/wikis/slug-availability`, {
          searchParams: { slug: input.slug, wikiId: input.wikiId },
        })
        .json<WikiSlugAvailabilityOutput>();
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new QueryError(QueryErrorCode.ApiError, apiError.message);
    }
  }

  async checkForChanges(
    _event: Event,
    _input: WikiSlugAvailabilityQueryInput,
    _output: WikiSlugAvailabilityOutput
  ): Promise<ChangeCheckResult<WikiSlugAvailabilityQueryInput>> {
    return { hasChanges: false };
  }
}
