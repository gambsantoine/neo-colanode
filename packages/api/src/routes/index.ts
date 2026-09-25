import { FastifyPluginCallback } from 'fastify';

import { meRoute } from './me';
import { ApiRepository } from '../lib/repository';
import { createApiKeyAuthenticator } from '../plugins/api-key-auth';
import { createWorkspaceAccessResolver } from '../plugins/workspace-access';
import { createNodeRoutes } from './workspaces/nodes';
import { createSpaceRoutes } from './workspaces/spaces';
import {
  createWorkspaceCollectionRoutes,
  createWorkspaceItemRoutes,
} from './workspaces/workspaces';

export const createApiRoutes = (
  repository: ApiRepository
): FastifyPluginCallback => {
  return (instance, _, done) => {
    instance.register(createApiKeyAuthenticator(repository));
    instance.register(meRoute);
    instance.register(createWorkspaceCollectionRoutes(repository));

    instance.register(
      (workspaceInstance, _, workspaceDone) => {
        workspaceInstance.register(createWorkspaceAccessResolver(repository));
        workspaceInstance.register(createWorkspaceItemRoutes(repository));
        workspaceInstance.register(createSpaceRoutes(repository));
        workspaceInstance.register(createNodeRoutes(repository), {
          prefix: '/spaces/:spaceId/nodes',
        });

        workspaceDone();
      },
      { prefix: '/workspaces/:workspaceId' }
    );

    done();
  };
};
