import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@colanode/client/lib/ky';
import { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import {
  WikiPublicationDeleteMutationInput,
  WikiPublicationDeleteMutationOutput,
} from '@colanode/client/mutations/wikis/wiki-publication-delete';

export class WikiPublicationDeleteMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<WikiPublicationDeleteMutationInput>
{
  async handleMutation(
    input: WikiPublicationDeleteMutationInput
  ): Promise<WikiPublicationDeleteMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    try {
      return await workspace.account.client
        .delete(
          `v1/workspaces/${workspace.workspaceId}/wikis/${input.wikiId}/publication`
        )
        .json<WikiPublicationDeleteMutationOutput>();
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
