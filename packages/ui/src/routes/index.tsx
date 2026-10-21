import { createRouter } from '@tanstack/react-router';

import { authRoute } from '@colanode/ui/routes/auth';
import { loginRoute } from '@colanode/ui/routes/auth/login';
import { registerRoute } from '@colanode/ui/routes/auth/register';
import { resetRoute } from '@colanode/ui/routes/auth/reset';
import { workspaceCreateRoute } from '@colanode/ui/routes/create';
import { homeRoute } from '@colanode/ui/routes/home';
import { rootRoute } from '@colanode/ui/routes/root';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@colanode/ui/routes/workspace';
import {
  accountSettingsMaskRoute,
  accountSettingsRoute,
} from '@colanode/ui/routes/workspace/account';
import {
  accountApiKeysMaskRoute,
  accountApiKeysRoute,
} from '@colanode/ui/routes/workspace/account-api-keys';
import {
  appAppearanceMaskRoute,
  appAppearanceRoute,
} from '@colanode/ui/routes/workspace/appearance';
import {
  workspaceDownloadsMaskRoute,
  workspaceDownloadsRoute,
} from '@colanode/ui/routes/workspace/downloads';
import {
  workspaceHomeMaskRoute,
  workspaceHomeRoute,
} from '@colanode/ui/routes/workspace/home';
import { infoMaskRoute, infoRoute } from '@colanode/ui/routes/workspace/info';
import {
  logoutMaskRoute,
  logoutRoute,
} from '@colanode/ui/routes/workspace/logout';
import { modalNodeRoute } from '@colanode/ui/routes/workspace/modal';
import { nodeMaskRoute, nodeRoute } from '@colanode/ui/routes/workspace/node';
import {
  workspaceRedirectMaskRoute,
  workspaceRedirectRoute,
} from '@colanode/ui/routes/workspace/redirect';
import {
  workspaceSettingsMaskRoute,
  workspaceSettingsRoute,
} from '@colanode/ui/routes/workspace/settings';
import {
  workspaceToolsPlantUmlMaskRoute,
  workspaceToolsPlantUmlRoute,
} from '@colanode/ui/routes/workspace/tools';
import {
  workspaceUploadsMaskRoute,
  workspaceUploadsRoute,
} from '@colanode/ui/routes/workspace/uploads';
import {
  workspaceUsersMaskRoute,
  workspaceUsersRoute,
} from '@colanode/ui/routes/workspace/users';
import {
  workspaceApiKeysMaskRoute,
  workspaceApiKeysRoute,
} from '@colanode/ui/routes/workspace/workspace-api-keys';

export const routeTree = rootRoute.addChildren([
  homeRoute,
  authRoute.addChildren([loginRoute, registerRoute, resetRoute]),
  workspaceCreateRoute,
  workspaceRoute.addChildren([
    workspaceRedirectRoute,
    workspaceHomeRoute,
    nodeRoute.addChildren([modalNodeRoute]),
    workspaceDownloadsRoute,
    workspaceUploadsRoute,
    workspaceUsersRoute,
    workspaceApiKeysRoute,
    workspaceSettingsRoute,
    accountSettingsRoute,
    accountApiKeysRoute,
    logoutRoute,
    infoRoute,
    appAppearanceRoute,
    workspaceToolsPlantUmlRoute,
  ]),
  workspaceMaskRoute.addChildren([
    workspaceRedirectMaskRoute,
    workspaceHomeMaskRoute,
    nodeMaskRoute,
    workspaceSettingsMaskRoute,
    workspaceUsersMaskRoute,
    workspaceApiKeysMaskRoute,
    workspaceUploadsMaskRoute,
    workspaceDownloadsMaskRoute,
    accountSettingsMaskRoute,
    accountApiKeysMaskRoute,
    logoutMaskRoute,
    infoMaskRoute,
    appAppearanceMaskRoute,
    workspaceToolsPlantUmlMaskRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
