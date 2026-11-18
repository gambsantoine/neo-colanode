import { WikiAccess, WikiPublicationOutput } from '@colanode/core';

export type WikiPublicationUpdateMutationInput = {
  type: 'wiki.publication.update';
  userId: string;
  wikiId: string;
  slug: string;
  access: WikiAccess;
  homeNodeId?: string | null;
};

export type WikiPublicationUpdateMutationOutput = WikiPublicationOutput;

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'wiki.publication.update': {
      input: WikiPublicationUpdateMutationInput;
      output: WikiPublicationUpdateMutationOutput;
    };
  }
}
