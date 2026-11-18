import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@colanode/client/lib/ky';
import { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import {
  WikiPublicationLinkCreateMutationInput,
  WikiPublicationLinkCreateMutationOutput,
} from '@colanode/client/mutations/wikis/wiki-publication-link-create';

export class WikiPublicationLinkCreateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<WikiPublicationLinkCreateMutationInput>
{
  async handleMutation(
    input: WikiPublicationLinkCreateMutationInput
  ): Promise<WikiPublicationLinkCreateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    try {
      return await workspace.account.client
        .post(
          `v1/workspaces/${workspace.workspaceId}/wikis/${input.wikiId}/publication/link`
        )
        .json<WikiPublicationLinkCreateMutationOutput>();
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
