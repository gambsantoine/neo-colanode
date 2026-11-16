import { ChevronLeft, ChevronRight, NotebookText, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SlideView } from '@colanode/ui/components/presentations/slide-view';
import {
  exitFullscreen,
  useFullscreenElement,
} from '@colanode/ui/hooks/use-fullscreen-element';
import { Deck } from '@colanode/ui/lib/slides';
import { cn } from '@colanode/ui/lib/utils';

interface PresentationPlayerProps {
  deck: Deck;
  dark: boolean;
  startIndex: number;
  onClose: (index: number) => void;
}

const CONTROLS_HIDE_DELAY_MS = 2500;

const NEXT_KEYS = new Set([
  'ArrowRight',
  'ArrowDown',
  'PageDown',
  ' ',
  'Enter',
]);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);

// Full screen slideshow, driven by the keyboard, clicks or the controls.
export const PresentationPlayer = ({
  deck,
  dark,
  startIndex,
  onClose,
}: PresentationPlayerProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const count = deck.slides.length;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startIndex, 0), count - 1)
  );
  const [showNotes, setShowNotes] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const indexRef = useRef(index);
  indexRef.current = index;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // The deck can change while presenting (a collaborator edits it).
  const current = Math.min(index, count - 1);
  const slide = deck.slides[current]!;

  const go = useCallback(
    (delta: number) =>
      setIndex((value) => Math.min(Math.max(value + delta, 0), count - 1)),
    [count]
  );

  const close = useCallback(() => {
    exitFullscreen();
    onCloseRef.current(indexRef.current);
  }, []);

  // Leaving full screen (Escape, F11...) ends the presentation.
  useFullscreenElement(rootRef, () => onCloseRef.current(indexRef.current));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (NEXT_KEYS.has(event.key)) {
        event.preventDefault();
        go(1);
      } else if (PREVIOUS_KEYS.has(event.key)) {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setIndex(count - 1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setShowNotes((value) => !value);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go, close, count]);

  // Controls and cursor disappear when the mouse stops moving.
  useEffect(() => {
    if (!showControls) {
      return;
    }

    const timeout = setTimeout(
      () => setShowControls(false),
      CONTROLS_HIDE_DELAY_MS
    );
    return () => clearTimeout(timeout);
  }, [showControls, index]);

  return createPortal(
    <div
      ref={rootRef}
      className={cn(
        'fixed inset-0 z-[100] flex flex-col bg-black text-white select-none',
        !showControls && 'cursor-none'
      )}
      onMouseMove={() => setShowControls(true)}
    >
      <div
        className="relative min-h-0 flex-1"
        onClick={(event) => {
          const { left, width } = event.currentTarget.getBoundingClientRect();
          go(event.clientX - left < width / 3 ? -1 : 1);
        }}
      >
        <SlideView slide={slide} dark={dark} />
      </div>

      {showNotes && (
        <div className="max-h-[30vh] shrink-0 overflow-auto border-t border-white/20 bg-neutral-900 px-6 py-3 text-base whitespace-pre-wrap">
          {slide.notes ?? (
            <span className="text-white/50">No notes for this slide.</span>
          )}
        </div>
      )}

      <div
        className={cn(
          'absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900/90 px-2 py-1 text-sm shadow-lg transition-opacity',
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0',
          showNotes && 'bottom-[calc(30vh+1rem)]'
        )}
      >
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
          onClick={() => go(-1)}
          disabled={current === 0}
          title="Previous (←)"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-14 text-center tabular-nums">
          {current + 1} / {count}
        </span>
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
          onClick={() => go(1)}
          disabled={current === count - 1}
          title="Next (→, Space)"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          className={cn(
            'rounded-full p-1.5 hover:bg-white/15',
            showNotes && 'bg-white/15'
          )}
          onClick={() => setShowNotes((value) => !value)}
          title="Presenter notes (N)"
        >
          <NotebookText className="size-4" />
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-white/15"
          onClick={close}
          title="Exit (Esc)"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};
