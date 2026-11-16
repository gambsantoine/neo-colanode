// The presenter view is a second window rendered by this page (same origin,
// no URL to load): the speaker keeps it on their screen while the audience
// window goes to the projector. Its content is a React root created here, so
// both windows share the same state without any messaging.

export const PRESENTER_WINDOW_NAME = 'colanode-presenter';

// Must be called from a user action (click), or the browser blocks it.
export const openPresenterWindow = (): Window | null =>
  window.open(
    '',
    PRESENTER_WINDOW_NAME,
    'popup,width=1200,height=760,menubar=no,toolbar=no,location=no'
  );

const isStylesheet = (node: Node): node is HTMLStyleElement | HTMLLinkElement =>
  node instanceof HTMLStyleElement ||
  (node instanceof HTMLLinkElement && node.rel === 'stylesheet');

const cloneStylesheet = (
  node: HTMLStyleElement | HTMLLinkElement,
  target: Document
): HTMLElement => {
  if (node instanceof HTMLLinkElement) {
    const link = target.createElement('link');
    link.rel = 'stylesheet';
    // Absolute: the popup has no URL of its own.
    link.href = node.href;
    return link;
  }

  const style = target.createElement('style');
  style.textContent = node.textContent;
  return style;
};

// Copies the stylesheets and theme of the app into the popup, and keeps
// copying the ones added later (lazy loaded styles, Reveal.js themes, Vite
// hot updates). Returns a function stopping the mirroring.
export const mirrorAppStyles = (popup: Window): (() => void) => {
  const target = popup.document;
  const copies = new Map<Node, HTMLElement>();

  const copy = (node: Node) => {
    if (!isStylesheet(node) || copies.has(node)) {
      return;
    }

    const clone = cloneStylesheet(node, target);
    copies.set(node, clone);
    target.head.appendChild(clone);
  };

  document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(copy);

  const syncRoot = () => {
    target.documentElement.className = document.documentElement.className;
    for (const name of ['style', 'data-theme', 'lang']) {
      const value = document.documentElement.getAttribute(name);
      if (value === null) {
        target.documentElement.removeAttribute(name);
      } else {
        target.documentElement.setAttribute(name, value);
      }
    }
  };

  syncRoot();

  const headObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const parent =
          mutation.target instanceof HTMLStyleElement
            ? mutation.target
            : mutation.target.parentNode;
        // Updated <style> (Vite hot update): replace its copy.
        if (parent instanceof HTMLStyleElement && copies.has(parent)) {
          copies.get(parent)!.textContent = parent.textContent;
        }
      }

      mutation.addedNodes.forEach(copy);
      mutation.removedNodes.forEach((node) => {
        copies.get(node)?.remove();
        copies.delete(node);
      });
    }
  });

  headObserver.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const rootObserver = new MutationObserver(syncRoot);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme', 'lang'],
  });

  return () => {
    headObserver.disconnect();
    rootObserver.disconnect();
  };
};
