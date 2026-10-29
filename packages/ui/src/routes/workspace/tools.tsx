import { createRoute, redirect } from '@tanstack/react-router';

import { DiagramToolContainer } from '@colanode/ui/components/tools/diagrams/diagram-tool-container';
import { DiagramToolTab } from '@colanode/ui/components/tools/diagrams/diagram-tool-tab';
import { JsonToolContainer } from '@colanode/ui/components/tools/json/json-tool-container';
import { PasswordToolContainer } from '@colanode/ui/components/tools/password/password-tool-container';
import { PasswordToolTab } from '@colanode/ui/components/tools/password/password-tool-tab';
import { QrCodeToolContainer } from '@colanode/ui/components/tools/qr-code/qr-code-tool-container';
import { ToolTab } from '@colanode/ui/components/tools/tool-tab';
import {
  mermaidLanguage,
  plantUmlLanguage,
} from '@colanode/ui/lib/diagram-languages';
import { getWorkspaceUserId } from '@colanode/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@colanode/ui/routes/workspace';

export const workspaceToolsPlantUmlRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/plantuml',
  component: () => (
    <DiagramToolContainer key="plantuml" language={plantUmlLanguage} />
  ),
  context: () => {
    return {
      tab: <DiagramToolTab language={plantUmlLanguage} />,
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

export const workspaceToolsPasswordRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/password',
  component: PasswordToolContainer,
  context: () => {
    return {
      tab: <PasswordToolTab />,
    };
  },
});

export const workspaceToolsPasswordMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/tools/password',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/tools/password',
        params: { userId },
        replace: true,
      });
    }
  },
});

export const workspaceToolsMermaidRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/mermaid',
  component: () => (
    <DiagramToolContainer key="mermaid" language={mermaidLanguage} />
  ),
  context: () => {
    return {
      tab: <DiagramToolTab language={mermaidLanguage} />,
    };
  },
});

export const workspaceToolsMermaidMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/tools/mermaid',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/tools/mermaid',
        params: { userId },
        replace: true,
      });
    }
  },
});

export const workspaceToolsJsonRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/json',
  component: JsonToolContainer,
  context: () => {
    return {
      tab: <ToolTab id="json" name="JSON / YAML" />,
    };
  },
});

export const workspaceToolsJsonMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/tools/json',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/tools/json',
        params: { userId },
        replace: true,
      });
    }
  },
});

export const workspaceToolsQrCodeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/qrcode',
  component: QrCodeToolContainer,
  context: () => {
    return {
      tab: <ToolTab id="qrcode" name="QR code" />,
    };
  },
});

export const workspaceToolsQrCodeMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/tools/qrcode',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/tools/qrcode',
        params: { userId },
        replace: true,
      });
    }
  },
});
