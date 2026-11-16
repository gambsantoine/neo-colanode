import { renderMermaid } from '@colanode/ui/lib/mermaid';
import { MERMAID_PLACEHOLDER_CLASS } from '@colanode/ui/lib/slides-render';

// Renders the Mermaid placeholders of rendered slides (see slides-render).
// Returns a function cancelling the renderings still in progress.
export const renderMermaidPlaceholders = (
  root: HTMLElement,
  dark: boolean
): (() => void) => {
  let cancelled = false;
  const placeholders = root.querySelectorAll<HTMLElement>(
    `.${MERMAID_PLACEHOLDER_CLASS}`
  );

  placeholders.forEach((placeholder) => {
    let code = '';
    try {
      code = decodeURIComponent(placeholder.dataset.code ?? '');
    } catch {
      return;
    }

    renderMermaid(code, { dark })
      .then((svg) => {
        if (cancelled) {
          return;
        }

        // Through an <img>: the SVG can't run anything in the page.
        const image = document.createElement('img');
        image.alt = 'Mermaid diagram';
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        placeholder.replaceChildren(image);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const pre = document.createElement('pre');
        pre.textContent = code;
        placeholder.replaceChildren(pre);
      });
  });

  return () => {
    cancelled = true;
  };
};
