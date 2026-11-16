import { CODE_BLOCK_CLASS } from '@colanode/ui/lib/slides-render';

const COPY_BUTTON_CLASS = `${CODE_BLOCK_CLASS}-copy`;
const COPIED_DELAY_MS = 1500;

// Static markup (lucide icons), never built from slide content.
const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

const setButtonState = (button: HTMLButtonElement, copied: boolean) => {
  button.innerHTML = `${copied ? CHECK_ICON : COPY_ICON}<span>${copied ? 'Copied' : 'Copy'}</span>`;
  button.dataset.copied = copied ? 'true' : 'false';
};

// Through the window of the document clicked (slides live in iframes): the
// clipboard API needs the focused document.
export const copyText = async (
  text: string,
  target: Document = document
): Promise<boolean> => {
  const view = target.defaultView ?? window;
  try {
    await view.navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard API (insecure context...): legacy copy.
    const textarea = target.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    target.body.appendChild(textarea);
    textarea.select();
    const copied = target.execCommand('copy');
    textarea.remove();
    return copied;
  }
};

// Adds a copy button to the code blocks under `root`. Returns a cleanup
// function removing the listener.
export const enhanceCodeBlocks = (root: HTMLElement): (() => void) => {
  root
    .querySelectorAll<HTMLElement>(`.${CODE_BLOCK_CLASS}-header`)
    .forEach((header) => {
      if (header.querySelector(`.${COPY_BUTTON_CLASS}`)) {
        return;
      }

      const button = root.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = COPY_BUTTON_CLASS;
      button.title = 'Copy the code';
      setButtonState(button, false);
      header.appendChild(button);
    });

  const timeouts = new Set<ReturnType<typeof setTimeout>>();

  // Clicks on code must not change the slide (players advance on click).
  const stop = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest(`.${CODE_BLOCK_CLASS}`)) {
      event.stopPropagation();
    }
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>(`.${COPY_BUTTON_CLASS}`);
    if (!button || !root.contains(button)) {
      stop(event);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const code =
      button.closest(`.${CODE_BLOCK_CLASS}`)?.querySelector('pre code')
        ?.textContent ?? '';

    void copyText(code, root.ownerDocument).then((copied) => {
      if (!copied) {
        return;
      }

      setButtonState(button, true);
      const timeout = setTimeout(() => {
        timeouts.delete(timeout);
        setButtonState(button, false);
      }, COPIED_DELAY_MS);
      timeouts.add(timeout);
    });
  };

  root.addEventListener('click', onClick);
  root.addEventListener('dblclick', stop);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('dblclick', stop);
    timeouts.forEach(clearTimeout);
  };
};
