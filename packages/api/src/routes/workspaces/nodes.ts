import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';

import { createDocumentRoutes } from './documents';
import { notImplemented, sendError, sendWriteResult } from '../../lib/errors';
import {
  buildPage,
  itemOutputSchema,
  listOutputSchema,
  listQuerySchema,
  toPageRequest,
  versionQuerySchema,
} from '../../lib/pagination';
import { ApiRepository } from '../../lib/repository';
import {
  apiNodeCreateInputSchema,
  apiNodeSchema,
  apiNodeUpdateInputSchema,
} from '../../lib/schemas';
import { dispatchVersion } from '../../lib/versioning';


const spaceParamsSchema = z.object({
  workspaceId: z.string(),
  spaceId: z.string(),
});

const nodeParamsSchema = spaceParamsSchema.extend({
  nodeId: z.string(),
});

const nodeWriteResponses = {
  400: apiErrorOutputSchema,
  403: apiErrorOutputSchema,
  404: apiErrorOutputSchema,
  409: apiErrorOutputSchema,
  500: apiErrorOutputSchema,
};

/** Routes on the nodes of a space: /workspaces/:workspaceId/spaces/:spaceId/nodes */
export const createNodeRoutes = (
  repository: ApiRepository
): FastifyPluginCallbackZod => {
  return (instance, _, done) => {
    instance.addHook('onRequest', async (request, reply) => {
      const { spaceId } = request.params as { spaceId: string };
      const space = await repository.getSpace(
        request.apiWorkspaceAccess,
        spaceId
      );

      if (!space) {
        return sendError(
          reply,
          404,
          ApiErrorCode.SpaceNotFound,
          'Space not found.'
        );
      }
    });

    instance.route({
      method: 'GET',
      url: '/',
      schema: {
        params: spaceParamsSchema,
        querystring: listQuerySchema.extend({
          parentId: z.string().optional(),
          type: z.string().optional(),
        }),
        response: {
          200: listOutputSchema(apiNodeSchema),
          400: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const page = toPageRequest(request.query);
            const nodes = await repository.listNodes(
              request.apiWorkspaceAccess,
              request.params.spaceId,
              {
                parentId: request.query.parentId ?? null,
                type: request.query.type ?? null,
              },
              page
            );

            return buildPage(nodes, page.limit);
          },
        }),
    });

    instance.route({
      method: 'GET',
      url: '/:nodeId',
      schema: {
        params: nodeParamsSchema,
        querystring: versionQuerySchema.extend({
          include: z.enum(['state']).optional(),
        }),
        response: {
          200: itemOutputSchema(apiNodeSchema),
          400: apiErrorOutputSchema,
          404: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const node = await repository.getNode(
              request.apiWorkspaceAccess,
              request.params.spaceId,
              request.params.nodeId,
              request.query.include === 'state'
            );

            if (!node) {
              return sendError(
                reply,
                404,
                ApiErrorCode.NodeNotFound,
                'Node not found.'
              );
            }

            return { data: node };
          },
        }),
    });

    instance.route({
      method: 'POST',
      url: '/',
      schema: {
        params: spaceParamsSchema,
        querystring: versionQuerySchema,
        body: apiNodeCreateInputSchema,
        response: {
          201: itemOutputSchema(apiNodeSchema),
          ...nodeWriteResponses,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            if (request.apiWorkspaceAccess.readonly) {
              return sendError(
                reply,
                403,
                ApiErrorCode.WorkspaceReadonly,
                'Workspace is readonly and you cannot make any changes.'
              );
            }

            const result = await repository.createNode(
              request.apiWorkspaceAccess,
              request.params.spaceId,
              request.body
            );

            return sendWriteResult(reply, result, {
              successStatus: 201,
              failedCode: ApiErrorCode.NodeCreateFailed,
              notFoundCode: ApiErrorCode.NodeNotFound,
              resource: 'Node',
            });
          },
        }),
    });

    instance.route({
      method: 'PATCH',
      url: '/:nodeId',
      schema: {
        params: nodeParamsSchema,
        querystring: versionQuerySchema,
        body: apiNodeUpdateInputSchema,
        response: {
          200: itemOutputSchema(apiNodeSchema),
          ...nodeWriteResponses,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            if (request.apiWorkspaceAccess.readonly) {
              return sendError(
                reply,
                403,
                ApiErrorCode.WorkspaceReadonly,
                'Workspace is readonly and you cannot make any changes.'
              );
            }

            const result = await repository.updateNode(
              request.apiWorkspaceAccess,
              request.params.spaceId,
              request.params.nodeId,
              request.body
            );

            return sendWriteResult(reply, result, {
              successStatus: 200,
              failedCode: ApiErrorCode.NodeUpdateFailed,
              notFoundCode: ApiErrorCode.NodeNotFound,
              resource: 'Node',
            });
          },
        }),
    });

    instance.route({
      method: 'DELETE',
      url: '/:nodeId',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Deleting a node'),
    });

    instance.register(createDocumentRoutes(repository));

    done();
  };
};
