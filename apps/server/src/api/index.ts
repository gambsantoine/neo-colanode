import { FastifyPluginCallback } from 'fastify';

import { createApiRoutes } from '@colanode/api';
import { clientRoutes } from '@colanode/server/api/client/routes';
import { configGetRoute } from '@colanode/server/api/config';
import { homeRoute } from '@colanode/server/api/home';
import { apiRepository } from '@colanode/server/lib/api-repository';
import { config } from '@colanode/server/lib/config';

export const apiRoutes: FastifyPluginCallback = (instance, _, done) => {
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';

  instance.register(homeRoute, { prefix });
  instance.register(configGetRoute, { prefix });
  instance.register(clientRoutes, { prefix: `${prefix}/client/v1` });
  instance.register(
    createApiRoutes(apiRepository, (request) => request.client.ip),
    { prefix: `${prefix}/api` }
  );

  done();
};
