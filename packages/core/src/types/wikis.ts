import { z } from 'zod/v4';

export const wikiAccessEnum = z.enum(['link', 'public']);

export type WikiAccess = z.infer<typeof wikiAccessEnum>;

export const wikiPublicationInputSchema = z.object({
  slug: z.string().min(1).max(64),
  access: wikiAccessEnum,
  homeNodeId: z.string().nullable().optional(),
});

export type WikiPublicationInput = z.infer<typeof wikiPublicationInputSchema>;

export const wikiPublicationOutputSchema = z.object({
  wikiId: z.string(),
  slug: z.string(),
  access: wikiAccessEnum,
  homeNodeId: z.string().nullable(),
  // Readable address of the wiki. In `link` mode it only works for visitors
  // who opened the access link first.
  url: z.string(),
  hasLink: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export type WikiPublicationOutput = z.infer<typeof wikiPublicationOutputSchema>;

export const wikiPublicationGetOutputSchema = z.object({
  publication: wikiPublicationOutputSchema.nullable(),
});

export type WikiPublicationGetOutput = z.infer<
  typeof wikiPublicationGetOutputSchema
>;

export const wikiPublicationLinkOutputSchema = z.object({
  // Shown once: only a hash is stored on the server.
  linkUrl: z.string(),
});

export type WikiPublicationLinkOutput = z.infer<
  typeof wikiPublicationLinkOutputSchema
>;

export const wikiSlugAvailabilityOutputSchema = z.object({
  slug: z.string(),
  valid: z.boolean(),
  available: z.boolean(),
});

export type WikiSlugAvailabilityOutput = z.infer<
  typeof wikiSlugAvailabilityOutputSchema
>;
