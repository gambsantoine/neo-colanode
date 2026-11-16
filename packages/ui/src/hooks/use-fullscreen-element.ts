import { RefObject, useEffect, useRef } from 'react';

// Puts the element in browser full screen while mounted. Leaving full screen
// (Escape, F11...) calls `onExit`. When full screen is not allowed (e.g. in an
// iframe), the element is left as is: callers make it fill the window.
export const useFullscreenElement = (
  ref: RefObject<HTMLElement | null>,
  onExit: () => void
) => {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    const element = ref.current;
    let entered = false;

    element
      ?.requestFullscreen?.()
      .then(() => {
        entered = true;
      })
      .catch(() => undefined);

    const onFullscreenChange = () => {
      if (entered && !document.fullscreenElement) {
        onExitRef.current();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (element && document.fullscreenElement === element) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [ref]);
};

export const exitFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  }
};
