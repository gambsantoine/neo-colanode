import { FastifyReply, FastifyRequest } from 'fastify';
import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import {
  ApiErrorCode,
  apiErrorOutputSchema,
  extractNodeRole,
  hasNodeRole,
  isValidWikiSlug,
  wikiPublicationGetOutputSchema,
  wikiPublicationInputSchema,
  wikiPublicationLinkOutputSchema,
  wikiPublicationOutputSchema,
  wikiSlugAvailabilityOutputSchema,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectWikiPublication } from '@colanode/server/data/schema';
import { fetchNodeTree, mapNode } from '@colanode/server/lib/nodes';
import { isUniqueViolation } from '@colanode/server/lib/postgres-errors';
import {
  deleteWikiPublication,
  deleteWikiRoutes,
  forgetWikiCaches,
} from '@colanode/server/lib/wikis/cleanup';
import {
  buildServerBaseUrl,
  generateWikiLinkToken,
  mapWikiPublication,
} from '@colanode/server/lib/wikis/publications';

const wikiParams = z.object({ wikiId: z.string() });

// Publishing exposes a wiki outside the workspace: only its admins can do it.
const checkWikiAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
  wikiId: string
): Promise<boolean> => {
  const tree = await fetchNodeTree(wikiId);
  const wiki = tree[tree.length - 1];

  if (
    !wiki ||
    wiki.id !== wikiId ||
    wiki.type !== 'wiki' ||
    wiki.workspace_id !== request.workspace.id
  ) {
    await reply.code(404).send({
      code: ApiErrorCode.WikiNotFound,
      message: 'Wiki not found.',
    });
    return false;
  }

  const role = extractNodeRole(tree.map(mapNode), request.workspace.user.id);
  if (!role || !hasNodeRole(role, 'admin')) {
    await reply.code(403).send({
      code: ApiErrorCode.WikiNoAccess,
      message: 'Only the wiki admins can publish it.',
    });
    return false;
  }

  return true;
};

const isWikiPage = async (wikiId: string, nodeId: string) => {
  const node = await database
    .selectFrom('nodes')
    .select(['id'])
    .where('id', '=', nodeId)
    .where('root_id', '=', wikiId)
    .where('type', '=', 'page')
    .executeTakeFirst();

  return node !== undefined;
};

const fetchPublication = (wikiId: string) =>
  database
    .selectFrom('wiki_publications')
    .selectAll()
    .where('wiki_id', '=', wikiId)
    .executeTakeFirst();

const isSlugTaken = async (slug: string, wikiId: string | null) => {
  const existing = await database
    .selectFrom('wiki_publications')
    .select(['wiki_id'])
    .where('slug', '=', slug)
    .executeTakeFirst();

  return existing !== undefined && existing.wiki_id !== wikiId;
};

export const wikiRoutes: FastifyPluginCallbackZod = (instance, _, done) => {
  instance.route({
    method: 'GET',
    url: '/slug-availability',
    schema: {
      querystring: z.object({
        slug: z.string(),
        wikiId: z.string().optional(),
      }),
      response: { 200: wikiSlugAvailabilityOutputSchema },
    },
    handler: async (request) => {
      const slug = request.query.slug.trim().toLowerCase();
      const valid = isValidWikiSlug(slug);
      const available =
        valid && !(await isSlugTaken(slug, request.query.wikiId ?? null));
      return { slug, valid, available };
    },
  });

  instance.route({
    method: 'GET',
    url: '/:wikiId/publication',
    schema: {
      params: wikiParams,
      response: {
        200: wikiPublicationGetOutputSchema,
        403: apiErrorOutputSchema,
        404: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      if (!(await checkWikiAdmin(request, reply, request.params.wikiId))) {
        return reply;
      }

      const publication = await fetchPublication(request.params.wikiId);
      return {
        publication: publication
          ? mapWikiPublication(publication, buildServerBaseUrl(request))
          : null,
      };
    },
  });

  instance.route({
    method: 'PUT',
    url: '/:wikiId/publication',
    schema: {
      params: wikiParams,
      body: wikiPublicationInputSchema,
      response: {
        200: wikiPublicationOutputSchema,
        400: apiErrorOutputSchema,
        403: apiErrorOutputSchema,
        404: apiErrorOutputSchema,
        409: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const wikiId = request.params.wikiId;
      if (!(await checkWikiAdmin(request, reply, wikiId))) {
        return reply;
      }

      const slug = request.body.slug.trim().toLowerCase();
      if (!isValidWikiSlug(slug)) {
        return reply.code(400).send({
          code: ApiErrorCode.WikiSlugInvalid,
          message:
            'The address can use lowercase letters, digits and dashes (3 to 64 characters).',
        });
      }

      if (await isSlugTaken(slug, wikiId)) {
        return reply.code(409).send({
          code: ApiErrorCode.WikiSlugTaken,
          message: 'This address is already used by another wiki.',
        });
      }

      const existing = await fetchPublication(wikiId);

      // The home page is kept when the request does not mention it.
      const homeNodeId =
        request.body.homeNodeId === undefined
          ? (existing?.home_node_id ?? null)
          : request.body.homeNodeId;

      // Only a newly chosen home is checked: a kept one that was deleted
      // since must not block saving (the first page is shown instead).
      if (
        request.body.homeNodeId &&
        !(await isWikiPage(wikiId, request.body.homeNodeId))
      ) {
        return reply.code(400).send({
          code: ApiErrorCode.WikiHomeInvalid,
          message: 'The home page must be a page of this wiki.',
        });
      }

      const now = new Date();
      const userId = request.workspace.user.id;
      const access = request.body.access;
      const slugChanged = existing !== undefined && existing.slug !== slug;

      let publication: SelectWikiPublication;
      try {
        publication = await database.transaction().execute(async (trx) => {
          const saved = existing
            ? await trx
                .updateTable('wiki_publications')
                .set({
                  slug,
                  access,
                  home_node_id: homeNodeId,
                  // A public wiki needs no secret: going back to link mode
                  // later starts with a new link, old readers are out.
                  ...(access === 'public'
                    ? { link_token_hash: null, link_token_salt: null }
                    : {}),
                  updated_at: now,
                  updated_by: userId,
                })
                .where('wiki_id', '=', wikiId)
                .returningAll()
                .executeTakeFirstOrThrow()
            : await trx
                .insertInto('wiki_publications')
                .values({
                  wiki_id: wikiId,
                  workspace_id: request.workspace.id,
                  slug,
                  access,
                  home_node_id: homeNodeId,
                  created_at: now,
                  created_by: userId,
                })
                .returningAll()
                .executeTakeFirstOrThrow();

          // Old addresses of another slug must not redirect anymore.
          if (slugChanged) {
            await deleteWikiRoutes(wikiId, trx);
          }

          return saved;
        });
      } catch (error) {
        // Two wikis claimed the same address at the same time.
        if (isUniqueViolation(error, 'wiki_publications_slug_key')) {
          return reply.code(409).send({
            code: ApiErrorCode.WikiSlugTaken,
            message: 'This address is already used by another wiki.',
          });
        }

        throw error;
      }

      await forgetWikiCaches([wikiId]);
      return mapWikiPublication(publication, buildServerBaseUrl(request));
    },
  });

  instance.route({
    method: 'DELETE',
    url: '/:wikiId/publication',
    schema: {
      params: wikiParams,
      response: {
        200: z.object({ success: z.boolean() }),
        403: apiErrorOutputSchema,
        404: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const wikiId = request.params.wikiId;
      if (!(await checkWikiAdmin(request, reply, wikiId))) {
        return reply;
      }

      await deleteWikiPublication(wikiId);

      return { success: true };
    },
  });

  // Creates a new access link. The previous one stops working at once.
  instance.route({
    method: 'POST',
    url: '/:wikiId/publication/link',
    schema: {
      params: wikiParams,
      response: {
        200: wikiPublicationLinkOutputSchema,
        403: apiErrorOutputSchema,
        404: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const wikiId = request.params.wikiId;
      if (!(await checkWikiAdmin(request, reply, wikiId))) {
        return reply;
      }

      const publication = await fetchPublication(wikiId);
      if (!publication) {
        return reply.code(404).send({
          code: ApiErrorCode.WikiNotPublished,
          message: 'Publish the wiki before creating an access link.',
        });
      }

      const { token, salt, hash } = generateWikiLinkToken(wikiId);
      await database
        .updateTable('wiki_publications')
        .set({
          link_token_hash: hash,
          link_token_salt: salt,
          updated_at: new Date(),
          updated_by: request.workspace.user.id,
        })
        .where('wiki_id', '=', wikiId)
        .execute();

      await forgetWikiCaches([wikiId]);
      return { linkUrl: `${buildServerBaseUrl(request)}/s/${token}` };
    },
  });

  done();
};
