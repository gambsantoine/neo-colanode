import { WikiPublicationLinkOutput } from '@colanode/core';

export type WikiPublicationLinkCreateMutationInput = {
  type: 'wiki.publication.link.create';
  userId: string;
  wikiId: string;
};

export type WikiPublicationLinkCreateMutationOutput = WikiPublicationLinkOutput;

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'wiki.publication.link.create': {
      input: WikiPublicationLinkCreateMutationInput;
      output: WikiPublicationLinkCreateMutationOutput;
    };
  }
}
