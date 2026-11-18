import tailwindRuntimeUrl from '@tailwindcss/browser?url';
import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@colanode/ui/lib/utils';

// Slides are rendered in an iframe, so none of the app styles apply to them:
// a deck only gets the styles of its engine (Slidev or Reveal.js) and
// Tailwind, whose browser runtime generates the classes used in the slides
// (`class: grid grid-cols-2`, `<div class="text-red-500">`...).
// The content is still rendered by React, through a portal.

const FRAME_DOCUMENT =
  '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

const BASE_CSS = `
html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
`;

interface SlideFrameProps {
  // Stylesheets of the engine, as text.
  styles: string[];
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  onReady?: (document: Document) => void;
}

export const SlideFrame = ({
  styles,
  children,
  className,
  style,
  title = 'Slide',
  onReady,
}: SlideFrameProps) => {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [styleElement, setStyleElement] = useState<HTMLStyleElement | null>(
    null
  );

  const setup = (element: HTMLIFrameElement) => {
    const doc = element.contentDocument;
    // The empty document an iframe starts with is replaced by the srcdoc one.
    if (!doc || doc.URL !== 'about:srcdoc' || doc.body.dataset.ready) {
      return;
    }

    doc.body.dataset.ready = 'true';

    const base = doc.createElement('style');
    base.textContent = BASE_CSS;
    doc.head.appendChild(base);

    const tailwind = doc.createElement('script');
    tailwind.src = new URL(tailwindRuntimeUrl, window.location.href).href;
    doc.head.appendChild(tailwind);

    // Engine styles come last: unlayered, they win over Tailwind's layers.
    const engine = doc.createElement('style');
    doc.head.appendChild(engine);
    setStyleElement(engine);

    const container = doc.createElement('div');
    container.style.height = '100%';
    doc.body.appendChild(container);

    // Shortcuts typed while the frame has the focus reach the app (players,
    // Reveal.js keyboard), as if the slide were part of the page.
    doc.addEventListener('keydown', (event) => {
      const forwarded = new KeyboardEvent('keydown', {
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        bubbles: true,
        cancelable: true,
      });
      element.ownerDocument.dispatchEvent(forwarded);
      if (forwarded.defaultPrevented) {
        event.preventDefault();
      }
    });

    setMount(container);
    onReady?.(doc);
  };

  useEffect(() => {
    if (styleElement) {
      styleElement.textContent = styles.join('\n');
    }
  }, [styleElement, styles]);

  // Some browsers have the srcdoc document ready before `load`.
  useEffect(() => {
    if (frame?.contentDocument?.readyState === 'complete') {
      setup(frame);
    }
  }, [frame]);

  return (
    <>
      <iframe
        ref={setFrame}
        title={title}
        srcDoc={FRAME_DOCUMENT}
        onLoad={(event) => setup(event.currentTarget)}
        className={cn('block border-0 bg-transparent', className)}
        style={style}
      />
      {mount && createPortal(children, mount)}
    </>
  );
};
