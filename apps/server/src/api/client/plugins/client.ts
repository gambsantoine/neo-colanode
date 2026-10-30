import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { ApiHeader } from '@colanode/core';
import { config } from '@colanode/server/lib/config';
import { ClientContext, ClientType } from '@colanode/server/types/api';

declare module 'fastify' {
  interface FastifyRequest {
    client: ClientContext;
  }
}

const getHeaderAsString = (
  request: FastifyRequest,
  header: string
): string | undefined => {
  const value = request.headers[header.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const clientDecoratorCallback: FastifyPluginCallback = (fastify, _, done) => {
  if (!fastify.hasRequestDecorator('client')) {
    fastify.decorateRequest('client');
  }

  fastify.addHook('onRequest', async (request) => {
    // Headers are client controlled: only the configured one is trusted, and
    // `request.ip` honours the `trustProxy` setting.
    const ip =
      (config.clientIpHeader &&
        getHeaderAsString(request, config.clientIpHeader)) ||
      request.ip;
    const platform = getHeaderAsString(request, ApiHeader.ClientPlatform);
    const version = getHeaderAsString(request, ApiHeader.ClientVersion);
    const type = getHeaderAsString(request, ApiHeader.ClientType);

    request.client = {
      ip,
      platform: platform || 'unknown',
      version: version || 'unknown',
      type: (type as ClientType) || 'web',
    };
  });

  done();
};

export const clientDecorator = fp(clientDecoratorCallback);
