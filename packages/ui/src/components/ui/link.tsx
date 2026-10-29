import { createLink, LinkComponent } from '@tanstack/react-router';
import * as React from 'react';

import { useApp } from '@colanode/ui/contexts/app';
import { useLayout } from '@colanode/ui/contexts/layout';

const isNewTabClick = (
  event: React.MouseEvent<HTMLAnchorElement>,
  target?: React.AnchorHTMLAttributes<HTMLAnchorElement>['target']
) => {
  if (target === '_blank') {
    return true;
  }

  return event.metaKey || event.ctrlKey || event.shiftKey || event.button === 2;
};

const DesktopLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => {
  const layout = useLayout();
  const { onClick, target, ...rest } = props;

  return (
    <a
      ref={ref}
      {...rest}
      target={target}
      onClick={(e) => {
        if (rest.href && isNewTabClick(e, target)) {
          e.preventDefault();
          e.stopPropagation();
          layout.openInNewTab(rest.href as string);
          return;
        }

        onClick?.(e);
      }}
    />
  );
});

// Shared sidebar of the tabbed layouts: a click shows the target in the
// preview tab (or focuses the tab already showing it), a double click keeps it
// open in a regular tab. Clicks already handled by an inner control (expand
// button, menu...) are default-prevented and left alone.
const TabLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => {
  const layout = useLayout();
  const { onClick, onDoubleClick, target, ...rest } = props;

  return (
    <a
      ref={ref}
      {...rest}
      target={target}
      onDoubleClick={(e) => {
        const href = rest.href as string | undefined;
        if (href && layout.openInTab && !e.defaultPrevented) {
          layout.openInTab(href, { pin: true });
        }

        onDoubleClick?.(e);
      }}
      onClick={(e) => {
        const href = rest.href as string | undefined;
        if (href && isNewTabClick(e, target)) {
          e.preventDefault();
          e.stopPropagation();
          layout.openInNewTab(href);
          return;
        }

        if (href && layout.openInTab && !e.defaultPrevented) {
          e.preventDefault();
          layout.openInTab(href);
          return;
        }

        onClick?.(e);
      }}
    />
  );
});

const BasicLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => {
  const app = useApp();
  const layout = useLayout();
  if (layout.openLinksInTabs) {
    return <TabLinkComponent ref={ref} {...props} data-router-link="true" />;
  }

  if (app.type === 'desktop') {
    return (
      <DesktopLinkComponent ref={ref} {...props} data-router-link="true" />
    );
  }

  return <a ref={ref} {...props} data-router-link="true" />;
});

const CreatedLinkComponent = createLink(BasicLinkComponent);

export const Link: LinkComponent<typeof BasicLinkComponent> = (props) => {
  return <CreatedLinkComponent {...props} />;
};
