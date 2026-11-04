import { WorkspaceMutationHandlerBase } from '@colanode/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@colanode/client/lib/ky';
import { MutationHandler } from '@colanode/client/lib/types';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import {
  WikiPublicationUpdateMutationInput,
  WikiPublicationUpdateMutationOutput,
} from '@colanode/client/mutations/wikis/wiki-publication-update';

export class WikiPublicationUpdateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<WikiPublicationUpdateMutationInput>
{
  async handleMutation(
    input: WikiPublicationUpdateMutationInput
  ): Promise<WikiPublicationUpdateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    try {
      return await workspace.account.client
        .put(
          `v1/workspaces/${workspace.workspaceId}/wikis/${input.wikiId}/publication`,
          {
            json: {
              slug: input.slug,
              access: input.access,
              homeNodeId: input.homeNodeId ?? null,
            },
          }
        )
        .json<WikiPublicationUpdateMutationOutput>();
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
