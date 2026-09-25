import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@colanode/core';

import { notImplemented, sendError, sendWriteResult } from '../../lib/errors';
import { itemOutputSchema, versionQuerySchema } from '../../lib/pagination';
import { ApiRepository } from '../../lib/repository';
import {
  apiDocumentSchema,
  apiDocumentUpdateInputSchema,
} from '../../lib/schemas';
import { dispatchVersion } from '../../lib/versioning';

const documentParamsSchema = z.object({
  workspaceId: z.string(),
  spaceId: z.string(),
  nodeId: z.string(),
});

/**
 * Routes on the document of a node:
 * /workspaces/:workspaceId/spaces/:spaceId/nodes/:nodeId/document
 * Registered inside the node routes so the space check applies.
 */
export const createDocumentRoutes = (
  repository: ApiRepository
): FastifyPluginCallbackZod => {
  return (instance, _, done) => {
    instance.route({
      method: 'GET',
      url: '/:nodeId/document',
      schema: {
        params: documentParamsSchema,
        querystring: versionQuerySchema.extend({
          include: z.enum(['state']).optional(),
        }),
        response: {
          200: itemOutputSchema(apiDocumentSchema),
          400: apiErrorOutputSchema,
          404: apiErrorOutputSchema,
        },
      },
      handler: async (request, reply) =>
        dispatchVersion(request, reply, {
          '1': async () => {
            const document = await repository.getDocument(
              request.apiWorkspaceAccess,
              request.params.spaceId,
              request.params.nodeId,
              request.query.include === 'state'
            );

            if (document === 'unsupported') {
              return sendError(
                reply,
                400,
                ApiErrorCode.DocumentNotSupported,
                'This node type has no document.'
              );
            }

            if (!document) {
              return sendError(
                reply,
                404,
                ApiErrorCode.NodeNotFound,
                'Node not found.'
              );
            }

            return { data: document };
          },
        }),
    });

    instance.route({
      method: 'PUT',
      url: '/:nodeId/document',
      schema: {
        params: documentParamsSchema,
        querystring: versionQuerySchema,
        body: apiDocumentUpdateInputSchema,
        response: {
          200: itemOutputSchema(apiDocumentSchema),
          400: apiErrorOutputSchema,
          403: apiErrorOutputSchema,
          404: apiErrorOutputSchema,
          500: apiErrorOutputSchema,
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

            const result = await repository.updateDocument(
              request.apiWorkspaceAccess,
              request.params.spaceId,
              request.params.nodeId,
              request.body
            );

            return sendWriteResult(reply, result, {
              successStatus: 200,
              failedCode: ApiErrorCode.DocumentUpdateFailed,
              notFoundCode: ApiErrorCode.NodeNotFound,
              resource: 'Document',
            });
          },
        }),
    });

    instance.route({
      method: 'DELETE',
      url: '/:nodeId/document',
      schema: { response: { 501: apiErrorOutputSchema } },
      handler: notImplemented('Deleting a document'),
    });

    done();
  };
};
