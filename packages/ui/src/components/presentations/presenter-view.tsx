import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { RevealView } from '@colanode/ui/components/presentations/reveal-view';
import { SlideView } from '@colanode/ui/components/presentations/slide-view';
import { PresentationController } from '@colanode/ui/lib/presentation-controller';
import { RevealDeck } from '@colanode/ui/lib/reveal';
import { Deck } from '@colanode/ui/lib/slides';
import { cn } from '@colanode/ui/lib/utils';

export type PresenterDeck =
  | { format: 'slidev'; deck: Deck; dark: boolean }
  | { format: 'reveal'; deck: RevealDeck };

export interface PresenterViewProps {
  title: string;
  presenterDeck: PresenterDeck;
  index: number;
  getController: () => PresentationController | null;
  onEnd: () => void;
}

const NOTES_SIZES = [14, 16, 18, 21, 24, 28, 32, 38];

const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${hours > 0 ? `${hours}:` : ''}${pad(minutes)}:${pad(seconds)}`;
};

const useTimer = () => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const startRef = useRef(Date.now());
  const offsetRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      if (running) {
        setElapsed(offsetRef.current + Date.now() - startRef.current);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [running]);

  const toggle = () => {
    if (running) {
      offsetRef.current += Date.now() - startRef.current;
    } else {
      startRef.current = Date.now();
    }

    setRunning(!running);
  };

  const reset = () => {
    offsetRef.current = 0;
    startRef.current = Date.now();
    setElapsed(0);
  };

  return { elapsed, running, now, toggle, reset };
};

const SlidePreview = ({
  presenterDeck,
  index,
}: {
  presenterDeck: PresenterDeck;
  index: number;
}) => {
  if (presenterDeck.format === 'reveal') {
    return (
      <RevealView
        deck={presenterDeck.deck}
        index={index}
        className="rounded-md"
      />
    );
  }

  const slide = presenterDeck.deck.slides[index];
  if (!slide) {
    return null;
  }

  return <SlideView slide={slide} dark={presenterDeck.dark} />;
};

// Speaker view: current and next slides, notes, timer. Rendered in the
// presenter window (see PresenterWindow).
export const PresenterView = ({
  title,
  presenterDeck,
  index,
  getController,
  onEnd,
}: PresenterViewProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [notesSize, setNotesSize] = useState(3);
  const timer = useTimer();

  const slides = presenterDeck.deck.slides;
  const count = slides.length;
  const current = Math.min(index, count - 1);
  const next = current + 1 < count ? current + 1 : null;
  const notes = slides[current]?.notes ?? null;

  const getControllerRef = useRef(getController);
  getControllerRef.current = getController;

  // Keyboard of the presenter window (not the app window).
  useEffect(() => {
    const target = rootRef.current?.ownerDocument;
    if (!target) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const controller = getControllerRef.current();
      if (!controller) {
        return;
      }

      if (
        ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(
          event.key
        )
      ) {
        event.preventDefault();
        controller.next();
      } else if (
        ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)
      ) {
        event.preventDefault();
        controller.previous();
      } else if (event.key === 'Home') {
        event.preventDefault();
        controller.goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        controller.goTo(count - 1);
      }
    };

    target.addEventListener('keydown', onKeyDown);
    return () => target.removeEventListener('keydown', onKeyDown);
  }, [count]);

  return (
    <div
      ref={rootRef}
      className="flex h-screen flex-col gap-3 bg-background p-4 text-foreground"
    >
      <header className="flex shrink-0 items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            Slide {current + 1} / {count}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
          <span className="text-2xl font-semibold tabular-nums">
            {formatDuration(timer.elapsed)}
          </span>
          <button
            type="button"
            onClick={timer.toggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={timer.running ? 'Pause the timer' : 'Resume the timer'}
          >
            {timer.running ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={timer.reset}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Reset the timer"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        <div className="text-2xl text-muted-foreground tabular-nums">
          {timer.now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          End presentation
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <section className="flex min-w-0 flex-[3] flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Current slide
          </h2>
          <div className="min-h-0 flex-1 rounded-lg bg-muted/40 p-3">
            <SlidePreview presenterDeck={presenterDeck} index={current} />
          </div>
        </section>

        <section className="flex min-w-0 flex-[2] flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Next
          </h2>
          <div className="aspect-video shrink-0 rounded-lg bg-muted/40 p-2">
            {next !== null ? (
              <SlidePreview presenterDeck={presenterDeck} index={next} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                End of the presentation
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Notes
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setNotesSize((size) => Math.max(0, size - 1))}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Smaller notes"
              >
                <Minus className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setNotesSize((size) =>
                    Math.min(NOTES_SIZES.length - 1, size + 1)
                  )
                }
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Larger notes"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-auto rounded-lg border p-4 leading-relaxed whitespace-pre-wrap"
            style={{ fontSize: NOTES_SIZES[notesSize] }}
          >
            {notes ?? (
              <span className="text-muted-foreground">
                No notes for this slide.
              </span>
            )}
          </div>
        </section>
      </div>

      <footer className="flex shrink-0 items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => getController()?.previous()}
          disabled={current === 0}
          className="flex items-center gap-1 rounded-md border px-4 py-2 hover:bg-accent disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => getController()?.next()}
          className={cn(
            'flex items-center gap-1 rounded-md bg-primary px-6 py-2 text-primary-foreground hover:opacity-90'
          )}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
        <span className="ml-2 text-xs text-muted-foreground">
          ← → / Space to navigate from this window
        </span>
      </footer>
    </div>
  );
};
