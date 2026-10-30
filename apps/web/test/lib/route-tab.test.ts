import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { getRouteTab } from '@colanode/ui/lib/route-tab';

const rootRoute = createRootRoute();

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace/$userId',
  context: (ctx) => ({ tab: `workspace ${ctx.params.userId}` }),
});

const toolRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tools/json',
  context: () => ({ tab: 'JSON' }),
});

const plainRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/plain',
});

const buildRouter = () =>
  createRouter({
    routeTree: rootRoute.addChildren([
      workspaceRoute.addChildren([toolRoute, plainRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

// The router has not loaded these locations: this is the state of a tab whose
// page has not been rendered yet.
describe('getRouteTab', () => {
  it('returns the label of a route that has not been loaded', () => {
    expect(getRouteTab(buildRouter(), '/workspace/u1/tools/json')).toBe('JSON');
  });

  it('falls back on the closest parent and passes it the params', () => {
    expect(getRouteTab(buildRouter(), '/workspace/u1/plain')).toBe(
      'workspace u1'
    );
  });

  it('returns nothing for an unknown location', () => {
    expect(getRouteTab(buildRouter(), '/unknown')).toBeNull();
  });
});
