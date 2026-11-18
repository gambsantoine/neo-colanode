import { WikiSlugAvailabilityOutput } from '@colanode/core';

export type WikiSlugAvailabilityQueryInput = {
  type: 'wiki.slug.availability';
  userId: string;
  wikiId: string;
  slug: string;
};

declare module '@colanode/client/queries' {
  interface QueryMap {
    'wiki.slug.availability': {
      input: WikiSlugAvailabilityQueryInput;
      output: WikiSlugAvailabilityOutput;
    };
  }
}
