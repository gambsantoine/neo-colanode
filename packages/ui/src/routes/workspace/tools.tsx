import { createRoute, redirect } from '@tanstack/react-router';

import { PlantUmlToolContainer } from '@colanode/ui/components/tools/plantuml/plantuml-tool-container';
import { PlantUmlToolTab } from '@colanode/ui/components/tools/plantuml/plantuml-tool-tab';
import { getWorkspaceUserId } from '@colanode/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@colanode/ui/routes/workspace';

export const workspaceToolsPlantUmlRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/plantuml',
  component: PlantUmlToolContainer,
  context: () => {
    return {
      tab: <PlantUmlToolTab />,
    };
  },
});

export const workspaceToolsPlantUmlMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/tools/plantuml',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/tools/plantuml',
        params: { userId },
        replace: true,
      });
    }
  },
});
