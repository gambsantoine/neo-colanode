import { RefObject, useEffect, useRef } from 'react';

// With `auto`, puts the element in browser full screen while mounted, and
// leaving full screen (Escape, F11...) calls `onExit`. When full screen is not
// allowed (e.g. in an iframe), the element is left as is: callers make it fill
// the window.
export const useFullscreenElement = (
  ref: RefObject<HTMLElement | null>,
  onExit: () => void,
  auto = true
) => {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    const element = ref.current;
    let entered = false;

    if (auto) {
      element
        ?.requestFullscreen?.()
        .then(() => {
          entered = true;
        })
        .catch(() => undefined);
    }

    const onFullscreenChange = () => {
      if (auto && entered && !document.fullscreenElement) {
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
  }, [ref, auto]);
};

export const exitFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  }
};

export const toggleFullscreen = (element: HTMLElement | null) => {
  if (document.fullscreenElement) {
    exitFullscreen();
  } else {
    element?.requestFullscreen?.().catch(() => undefined);
  }
};
