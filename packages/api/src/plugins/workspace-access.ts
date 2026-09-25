import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';

import { sendError } from '../lib/errors';
import { ApiRepository, ApiWorkspaceAccess } from '../lib/repository';

declare module 'fastify' {
  interface FastifyRequest {
    apiWorkspaceAccess: ApiWorkspaceAccess;
  }
}

/**
 * Resolves the caller's membership in `:workspaceId` on every request, so a
 * key stops working as soon as its owner loses access to the workspace.
 * Workspace scoped keys are limited to their own workspace.
 */
export const createWorkspaceAccessResolver = (
  repository: ApiRepository
): FastifyPluginCallback => {
  const callback: FastifyPluginCallback = (fastify, _, done) => {
    if (!fastify.hasRequestDecorator('apiWorkspaceAccess')) {
      fastify.decorateRequest('apiWorkspaceAccess');
    }

    fastify.addHook('onRequest', async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId?: string };
      const context = request.apiKeyContext;

      if (
        !workspaceId ||
        (context.workspaceId && context.workspaceId !== workspaceId)
      ) {
        return sendError(
          reply,
          403,
          ApiErrorCode.WorkspaceNoAccess,
          'You do not have access to this workspace.'
        );
      }

      const access = await repository.getWorkspaceAccess(
        context.accountId,
        workspaceId
      );

      if (!access) {
        return sendError(
          reply,
          403,
          ApiErrorCode.WorkspaceNoAccess,
          'You do not have access to this workspace.'
        );
      }

      request.apiWorkspaceAccess = access;
    });

    done();
  };

  return fp(callback);
};
