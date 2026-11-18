export type WikiPublicationDeleteMutationInput = {
  type: 'wiki.publication.delete';
  userId: string;
  wikiId: string;
};

export type WikiPublicationDeleteMutationOutput = { success: boolean };

declare module '@colanode/client/mutations' {
  interface MutationMap {
    'wiki.publication.delete': {
      input: WikiPublicationDeleteMutationInput;
      output: WikiPublicationDeleteMutationOutput;
    };
  }
}
