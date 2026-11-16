import { NotebookText, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { RevealView } from '@colanode/ui/components/presentations/reveal-view';
import {
  exitFullscreen,
  useFullscreenElement,
} from '@colanode/ui/hooks/use-fullscreen-element';
import { RevealDeck } from '@colanode/ui/lib/reveal';
import { cn } from '@colanode/ui/lib/utils';

interface RevealPlayerProps {
  deck: RevealDeck;
  startIndex: number;
  onClose: (index: number) => void;
}

// Full screen Reveal.js presentation. Navigation is Reveal's own: arrows,
// Space, O / Escape for the overview, F for full screen...
export const RevealPlayer = ({
  deck,
  startIndex,
  onClose,
}: RevealPlayerProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startIndex, 0), deck.slides.length - 1)
  );
  const [showNotes, setShowNotes] = useState(false);

  const indexRef = useRef(index);
  indexRef.current = index;

  useFullscreenElement(rootRef, () => onClose(indexRef.current));

  const close = () => {
    exitFullscreen();
    onClose(indexRef.current);
  };

  const notes = deck.slides[Math.min(index, deck.slides.length - 1)]?.notes;

  return createPortal(
    <div
      ref={rootRef}
      className="group/player fixed inset-0 z-[100] flex flex-col bg-black text-white"
    >
      <div className="relative min-h-0 flex-1">
        <RevealView
          deck={deck}
          index={index}
          onIndexChange={setIndex}
          interactive
        />
      </div>

      {showNotes && (
        <div className="max-h-[30vh] shrink-0 overflow-auto border-t border-white/20 bg-neutral-900 px-6 py-3 text-base whitespace-pre-wrap">
          {notes ?? (
            <span className="text-white/50">No notes for this slide.</span>
          )}
        </div>
      )}

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-neutral-900/80 p-1 opacity-0 transition-opacity group-hover/player:opacity-100">
        <button
          type="button"
          className={cn(
            'rounded-full p-1.5 hover:bg-white/15',
            showNotes && 'bg-white/15'
          )}
          onClick={() => setShowNotes((value) => !value)}
          title="Speaker notes"
        >
          <NotebookText className="size-4" />
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-white/15"
          onClick={close}
          title="Exit"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};
