import { WikiPublicationGetOutput } from '@colanode/core';

export type WikiPublicationGetQueryInput = {
  type: 'wiki.publication.get';
  userId: string;
  wikiId: string;
};

declare module '@colanode/client/queries' {
  interface QueryMap {
    'wiki.publication.get': {
      input: WikiPublicationGetQueryInput;
      output: WikiPublicationGetOutput;
    };
  }
}
