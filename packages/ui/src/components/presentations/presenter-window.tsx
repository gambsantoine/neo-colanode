import { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';

import {
  PresenterView,
  PresenterViewProps,
} from '@colanode/ui/components/presentations/presenter-view';
import { mirrorAppStyles } from '@colanode/ui/lib/presenter-window';

interface PresenterWindowProps extends Omit<PresenterViewProps, 'onEnd'> {
  popup: Window;
  // The presenter window was closed, or "End presentation" was clicked.
  onClose: (ended: boolean) => void;
}

// Renders the presenter view in the popup through its own React root: React
// events don't reach a portal in another document.
export const PresenterWindow = ({
  popup,
  onClose,
  ...viewProps
}: PresenterWindowProps) => {
  const rootRef = useRef<Root | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const target = popup.document;
    target.title = `Presenter · ${viewProps.title}`;
    // A reused popup still holds the previous presentation.
    target.body.replaceChildren();
    target.body.style.margin = '0';

    const stopMirroring = mirrorAppStyles(popup);
    const container = target.createElement('div');
    target.body.appendChild(container);
    const root = createRoot(container);
    rootRef.current = root;

    let closing = false;
    const onPageHide = () => {
      if (!closing) {
        onCloseRef.current(false);
      }
    };
    popup.addEventListener('pagehide', onPageHide);

    return () => {
      closing = true;
      popup.removeEventListener('pagehide', onPageHide);
      stopMirroring();
      rootRef.current = null;
      // Unmounting during a render of the parent root is not allowed.
      setTimeout(() => {
        root.unmount();
        if (!popup.closed) {
          popup.close();
        }
      });
    };
    // The window is set up once; content updates go through render below.
  }, [popup]);

  useEffect(() => {
    rootRef.current?.render(
      <PresenterView {...viewProps} onEnd={() => onCloseRef.current(true)} />
    );
  });

  return null;
};
