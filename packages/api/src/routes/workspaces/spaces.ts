import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';

import { notImplemented, sendError } from '../../lib/errors';
import {
  buildPage,
  itemOutputSchema,
  listOutputSchema,
  listQuerySchema,
  toPageRequest,
  versionQuerySchema,
} from '../../lib/pagination';
import { ApiRepository } from '../../lib/repository';
import { apiSpaceSchema } from '../../lib/schemas';
import { dispatchVersion } from '../../lib/versioning';

/** Routes on spaces: /workspaces/:workspaceId/spaces */
export const createSpaceRoutes = (
  repository: ApiRepository
): FastifyPluginCallbackZod => {
  return (instance, _, done) => {
    instance.route({
      method: 'GET',
      url: '/spaces',
      schema: {
        params: z.object({ workspaceId: z.string() }),
        querystring: listQuerySchema,
        response: {
          200: listOutputSchema(apiSpaceSchema),
          400: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const page = toPageRequest(request.query);
            const spaces = await repository.listSpaces(
              request.apiWorkspaceAccess,
              page
            );

            return buildPage(spaces, page.limit);
          },
        }),
    });

    instance.route({
      method: 'GET',
      url: '/spaces/:spaceId',
      schema: {
        params: z.object({ workspaceId: z.string(), spaceId: z.string() }),
        querystring: versionQuerySchema,
        response: {
          200: itemOutputSchema(apiSpaceSchema),
          400: apiErrorOutputSchema,
          404: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const space = await repository.getSpace(
              request.apiWorkspaceAccess,
              request.params.spaceId
            );

            if (!space) {
              return sendError(
                reply,
                404,
                ApiErrorCode.SpaceNotFound,
                'Space not found.'
              );
            }

            return { data: space };
          },
        }),
    });

    instance.route({
      method: 'POST',
      url: '/spaces',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Creating a space'),
    });

    instance.route({
      method: 'PATCH',
      url: '/spaces/:spaceId',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Updating a space'),
    });

    instance.route({
      method: 'DELETE',
      url: '/spaces/:spaceId',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Deleting a space'),
    });

    done();
  };
};
