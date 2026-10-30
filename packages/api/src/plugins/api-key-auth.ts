import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { ApiErrorCode } from '@colanode/core';

import { ApiRepository } from '../lib/repository';

const API_KEY_TOKEN_PREFIX = 'cak_';
const API_KEY_ID_LENGTH = 28;

export type ApiKeyContext = {
  apiKeyId: string;
  accountId: string;
  workspaceId: string | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyContext: ApiKeyContext;
  }
}

const parseApiKeyToken = (
  token: string
): { apiKeyId: string; secret: string } | null => {
  if (!token.startsWith(API_KEY_TOKEN_PREFIX)) {
    return null;
  }

  const tokenWithoutPrefix = token.slice(API_KEY_TOKEN_PREFIX.length);
  const apiKeyId = tokenWithoutPrefix.slice(0, API_KEY_ID_LENGTH);
  const secret = tokenWithoutPrefix.slice(API_KEY_ID_LENGTH);

  if (!apiKeyId || !secret) {
    return null;
  }

  return { apiKeyId, secret };
};

export const createApiKeyAuthenticator = (
  repository: ApiRepository
): FastifyPluginCallback => {
  const apiKeyAuthenticatorCallback: FastifyPluginCallback = (
    fastify,
    _,
    done
  ) => {
    if (!fastify.hasRequestDecorator('apiKeyContext')) {
      fastify.decorateRequest('apiKeyContext');
    }

    fastify.addHook('onRequest', async (request, reply) => {
      const auth = request.headers.authorization;
      if (!auth) {
        return reply.code(401).send({
          code: ApiErrorCode.TokenMissing,
          message: 'No api key provided',
        });
      }

      const parts = auth.split(' ');
      const token = parts.length === 2 ? parts[1] : parts[0];

      const tokenData = token ? parseApiKeyToken(token) : null;
      if (!tokenData) {
        return reply.code(401).send({
          code: ApiErrorCode.TokenInvalid,
          message: 'Api key is invalid',
        });
      }

      if (await repository.isIpRateLimited(request.ip)) {
        return reply.code(429).send({
          code: ApiErrorCode.TooManyRequests,
          message: 'Too many requests. Please try again later.',
        });
      }

      const result = await repository.verifyApiKey(
        tokenData.apiKeyId,
        tokenData.secret
      );

      if (!result) {
        return reply.code(401).send({
          code: ApiErrorCode.TokenInvalid,
          message: 'Api key is invalid or has been revoked',
        });
      }

      if (await repository.isApiKeyRateLimited(tokenData.apiKeyId)) {
        return reply.code(429).send({
          code: ApiErrorCode.TooManyRequests,
          message: 'Too many requests. Please try again later.',
        });
      }

      request.apiKeyContext = {
        apiKeyId: tokenData.apiKeyId,
        accountId: result.accountId,
        workspaceId: result.workspaceId,
      };

      // Not awaited: a failure must not fail the request nor crash the process.
      repository
        .touchApiKeyLastUsed(tokenData.apiKeyId)
        .catch((error: unknown) => {
          request.log.error(error, 'Failed to update the api key last use');
        });
    });

    done();
  };

  return fp(apiKeyAuthenticatorCallback);
};
