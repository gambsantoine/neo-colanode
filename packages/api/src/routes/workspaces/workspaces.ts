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
import { apiWorkspaceSchema } from '../../lib/schemas';
import { dispatchVersion } from '../../lib/versioning';

/** Routes on the workspace collection: /workspaces */
export const createWorkspaceCollectionRoutes = (
  repository: ApiRepository
): FastifyPluginCallbackZod => {
  return (instance, _, done) => {
    instance.route({
      method: 'GET',
      url: '/workspaces',
      schema: {
        querystring: listQuerySchema,
        response: {
          200: listOutputSchema(apiWorkspaceSchema),
          400: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const page = toPageRequest(request.query);
            const workspaces = await repository.listWorkspaces(
              request.apiKeyContext.accountId,
              request.apiKeyContext.workspaceId,
              page
            );

            return buildPage(workspaces, page.limit);
          },
        }),
    });

    instance.route({
      method: 'POST',
      url: '/workspaces',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Creating a workspace'),
    });

    done();
  };
};

/** Routes on one workspace: /workspaces/:workspaceId */
export const createWorkspaceItemRoutes = (
  repository: ApiRepository
): FastifyPluginCallbackZod => {
  return (instance, _, done) => {
    instance.route({
      method: 'GET',
      url: '/',
      schema: {
        params: z.object({ workspaceId: z.string() }),
        querystring: versionQuerySchema,
        response: {
          200: itemOutputSchema(apiWorkspaceSchema),
          400: apiErrorOutputSchema,
          404: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const workspace = await repository.getWorkspace(
              request.apiWorkspaceAccess
            );

            if (!workspace) {
              return sendError(
                reply,
                404,
                ApiErrorCode.WorkspaceNotFound,
                'Workspace not found.'
              );
            }

            return { data: workspace };
          },
        }),
    });

    instance.route({
      method: 'PATCH',
      url: '/',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Updating a workspace'),
    });

    instance.route({
      method: 'DELETE',
      url: '/',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Deleting a workspace'),
    });

    done();
  };
};
