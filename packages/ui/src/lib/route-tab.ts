import { AnyRouter } from '@tanstack/react-router';
import { ReactNode } from 'react';

type RouteContextFn = (ctx: {
  params: unknown;
}) => { tab?: ReactNode } | undefined;

// Label of a tab: the `tab` declared in the context of its deepest route. The
// route is asked directly because `matchRoutes` only fills `match.context` once
// the route has loaded, and a tab must be labelled before its page is shown.
export const getRouteTab = (router: AnyRouter, location: string): ReactNode => {
  const matches = router.matchRoutes(location);

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]!;
    const context = router.routesById[match.routeId]?.options.context as
      RouteContextFn | undefined;

    const tab = context?.({ params: match.params })?.tab;
    if (tab) {
      return tab;
    }
  }

  return null;
};
