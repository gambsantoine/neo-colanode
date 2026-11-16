import {
  Columns2,
  Download,
  Eye,
  PenLine,
  Play,
  StepForward,
  Upload,
} from 'lucide-react';
import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { LocalPresentationNode } from '@colanode/client/types';
import { NodeRole, PresentationFormat, hasNodeRole } from '@colanode/core';
import { PresentationPlayer } from '@colanode/ui/components/presentations/presentation-player';
import { RevealPlayer } from '@colanode/ui/components/presentations/reveal-player';
import { RevealView } from '@colanode/ui/components/presentations/reveal-view';
import {
  SlideView,
  resolveDeckDark,
} from '@colanode/ui/components/presentations/slide-view';
import { Button } from '@colanode/ui/components/ui/button';
import { useTheme } from '@colanode/ui/contexts/theme';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { applyTextEdit, indentLines } from '@colanode/ui/lib/diagram-editing';
import { downloadBlob } from '@colanode/ui/lib/download';
import {
  DEFAULT_REVEAL_CONTENT,
  parseRevealDeck,
} from '@colanode/ui/lib/reveal';
import {
  DEFAULT_PRESENTATION_CONTENT,
  SLIDES_FILE_EXTENSION,
  findSlideAtLine,
  getLineAt,
  parseDeck,
} from '@colanode/ui/lib/slides';
import { cn } from '@colanode/ui/lib/utils';

type PresentationLayout = 'editor' | 'split' | 'preview';

const SAVE_DELAY_MS = 400;
const MAX_IMPORT_SIZE = 2 * 1024 * 1024;
const IMPORT_ACCEPT = '.md,.markdown,.txt,text/markdown,text/plain';

const isTextFile = (file: File) =>
  /\.(md|markdown|txt)$/i.test(file.name) ||
  file.type === 'text/markdown' ||
  file.type === 'text/plain';

const toFileName = (name: string) =>
  (name.trim() || 'presentation').replace(/[\\/:*?"<>|]+/g, '-') +
  SLIDES_FILE_EXTENSION;

interface PresentationContainerProps {
  presentation: LocalPresentationNode;
  role: NodeRole;
}

export const PresentationContainer = ({
  presentation,
  role,
}: PresentationContainerProps) => {
  const workspace = useWorkspace();
  const theme = useTheme();
  const canEdit = hasNodeRole(role, 'editor');

  const [draft, setDraft] = useState(presentation.content ?? '');
  const [layout, setLayout] = useState<PresentationLayout>(
    canEdit ? 'split' : 'preview'
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerStart, setPlayerStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  // Local edits are saved after a short pause. Until then, changes coming
  // from the server (collaborators) don't overwrite what is being typed.
  const pendingRef = useRef<string | null>(null);
  const lastSavedRef = useRef(presentation.content ?? '');

  const save = (value: string) => {
    pendingRef.current = null;
    if (value === lastSavedRef.current) {
      return;
    }

    const nodes = workspace.collections.nodes;
    if (!nodes.has(presentation.id)) {
      return;
    }

    lastSavedRef.current = value;
    nodes.update(presentation.id, (node) => {
      if (node.type === 'presentation') {
        node.content = value;
      }
    });
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (pendingRef.current === null) {
      return;
    }

    const timeout = setTimeout(() => saveRef.current(draft), SAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [draft]);

  // Flush on leave.
  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) {
        saveRef.current(pendingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const remote = presentation.content ?? '';
    if (pendingRef.current !== null || remote === lastSavedRef.current) {
      return;
    }

    lastSavedRef.current = remote;
    const textarea = textareaRef.current;
    const selection = textarea
      ? [textarea.selectionStart, textarea.selectionEnd]
      : null;

    setDraft(remote);
    if (textarea && selection && document.activeElement === textarea) {
      requestAnimationFrame(() =>
        textarea.setSelectionRange(selection[0]!, selection[1]!)
      );
    }
  }, [presentation.content]);

  const updateDraft = (value: string) => {
    pendingRef.current = value;
    setDraft(value);
  };

  const format: PresentationFormat = presentation.format ?? 'slidev';
  const slidevDeck = useMemo(
    () => (format === 'slidev' ? parseDeck(draft) : null),
    [format, draft]
  );
  const revealDeck = useMemo(
    () => (format === 'reveal' ? parseRevealDeck(draft) : null),
    [format, draft]
  );
  const deck = (slidevDeck ?? revealDeck)!;
  const current = Math.min(currentIndex, deck.slides.length - 1);
  const dark = slidevDeck
    ? resolveDeckDark(slidevDeck.headmatter, theme.mode === 'dark')
    : (revealDeck?.dark ?? false);

  // Switching an untouched sample deck gives the sample of the other format.
  const changeFormat = (next: PresentationFormat) => {
    if (next === format || !canEdit) {
      return;
    }

    const nodes = workspace.collections.nodes;
    if (!nodes.has(presentation.id)) {
      return;
    }

    const samples: Record<PresentationFormat, string> = {
      slidev: DEFAULT_PRESENTATION_CONTENT,
      reveal: DEFAULT_REVEAL_CONTENT,
    };

    const swapSample = draft === samples[format];
    nodes.update(presentation.id, (node) => {
      if (node.type === 'presentation') {
        node.format = next;
        if (swapSample) {
          node.content = samples[next];
        }
      }
    });

    if (swapSample) {
      pendingRef.current = null;
      lastSavedRef.current = samples[next];
      setDraft(samples[next]);
    }

    setCurrentIndex(0);
  };

  // The preview follows the slide under the caret.
  const syncSlideWithCaret = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const line = getLineAt(textarea.value, textarea.selectionStart);
    setCurrentIndex(findSlideAtLine(deck, line));
  };

  // Typing may add or remove slides before the caret.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && document.activeElement === textarea) {
      const line = getLineAt(textarea.value, textarea.selectionStart);
      setCurrentIndex(findSlideAtLine(deck, line));
    }
  }, [deck]);

  useEffect(() => {
    const thumbnail = thumbnailsRef.current?.querySelector<HTMLElement>(
      `[data-slide-index="${current}"]`
    );
    thumbnail?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const selectSlide = (index: number) => {
    setCurrentIndex(index);

    const textarea = textareaRef.current;
    const slide = deck.slides[index];
    if (!textarea || !slide || layout === 'preview') {
      return;
    }

    // Puts the caret at the start of the slide in the source.
    const lines = textarea.value.split('\n');
    let offset = 0;
    for (let i = 0; i < slide.startLine && i < lines.length; i++) {
      offset += lines[i]!.length + 1;
    }

    textarea.focus();
    textarea.setSelectionRange(offset, offset);
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = Math.max(0, slide.startLine * lineHeight - 40);
  };

  const replaceContent = (content: string, source: string) => {
    const textarea = textareaRef.current;
    const normalized = content.replace(/\r\n?/g, '\n');

    if (textarea && layout !== 'preview') {
      // Through the editing commands, so Ctrl+Z restores the previous deck.
      applyTextEdit(
        textarea,
        {
          from: 0,
          to: textarea.value.length,
          text: normalized,
          selectionStart: 0,
          selectionEnd: 0,
        },
        updateDraft
      );
    } else {
      updateDraft(normalized);
    }

    setCurrentIndex(0);
    toast.success(`Imported ${source}`, {
      description:
        textarea && layout !== 'preview'
          ? 'Press Ctrl+Z in the editor to undo.'
          : undefined,
    });
  };

  const importFile = async (file: File) => {
    if (!canEdit) {
      return;
    }

    if (!isTextFile(file)) {
      toast.error('Only Markdown files (.md) can be imported.');
      return;
    }

    if (file.size > MAX_IMPORT_SIZE) {
      toast.error('The file is too large (2 MB max).');
      return;
    }

    try {
      replaceContent(await file.text(), file.name);
    } catch {
      toast.error(`Could not read ${file.name}.`);
    }
  };

  const handleImportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void importFile(file);
    }
  };

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files');

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canEdit || !hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    if (!canEdit || !hasFiles(event)) {
      return;
    }

    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void importFile(file);
    }
  };

  const exportFile = () => {
    downloadBlob(
      new Blob([draft], { type: 'text/markdown;charset=utf-8' }),
      toFileName(presentation.name)
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Tab' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const textarea = event.currentTarget;
      applyTextEdit(
        textarea,
        indentLines(
          textarea.value,
          textarea.selectionStart,
          textarea.selectionEnd,
          event.shiftKey ? 'out' : 'in'
        ),
        updateDraft
      );
      return;
    }

    if (event.key === 'F5') {
      event.preventDefault();
      setPlayerStart(event.shiftKey ? current : 0);
    }
  };

  const showEditor = layout !== 'preview';
  const showPreview = layout !== 'editor';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button size="sm" onClick={() => setPlayerStart(0)}>
          <Play className="size-4" />
          Present
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPlayerStart(current)}
          title="Present from the current slide (Shift+F5)"
        >
          <StepForward className="size-4" />
          From slide {current + 1}
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => importInputRef.current?.click()}
            title="Replace the deck with a Markdown file (or drop a file on the editor)"
          >
            <Upload className="size-4" />
            Import .md
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={exportFile}>
          <Download className="size-4" />
          Export .md
        </Button>
        <div
          className="ml-auto flex items-center rounded-md border p-0.5 text-xs"
          title="Markdown syntax and presentation engine"
        >
          {(['slidev', 'reveal'] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={!canEdit && value !== format}
              onClick={() => changeFormat(value)}
              className={cn(
                'rounded-sm px-2 py-0.5 text-muted-foreground enabled:hover:text-foreground',
                format === value && 'bg-accent text-foreground'
              )}
            >
              {value === 'slidev' ? 'Slidev' : 'Reveal.js'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {deck.slides.length} slide{deck.slides.length > 1 ? 's' : ''}
        </span>
        <div className="flex items-center rounded-md border p-0.5">
          {canEdit && (
            <LayoutButton
              active={layout === 'editor'}
              onClick={() => setLayout('editor')}
              title="Editor only"
            >
              <PenLine className="size-4" />
            </LayoutButton>
          )}
          {canEdit && (
            <LayoutButton
              active={layout === 'split'}
              onClick={() => setLayout('split')}
              title="Editor and preview"
            >
              <Columns2 className="size-4" />
            </LayoutButton>
          )}
          <LayoutButton
            active={layout === 'preview'}
            onClick={() => setLayout('preview')}
            title="Preview only"
          >
            <Eye className="size-4" />
          </LayoutButton>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept={IMPORT_ACCEPT}
          className="hidden"
          onChange={handleImportChange}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {showEditor && (
          <div
            className={cn(
              'relative flex min-h-0 min-w-0 flex-col',
              showPreview ? 'w-1/2 border-r' : 'flex-1'
            )}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              readOnly={!canEdit}
              spellCheck={false}
              placeholder={
                format === 'reveal'
                  ? 'Paste or write your Reveal.js Markdown here. Separate slides with --- (vertical: --)'
                  : 'Paste or write your Slidev Markdown here. Separate slides with ---'
              }
              onChange={(event) => updateDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={syncSlideWithCaret}
              onClick={syncSlideWithCaret}
              onSelect={syncSlideWithCaret}
              className="min-h-0 w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none dark:bg-input/30"
            />
            {isDragging && (
              <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
                Drop a Markdown file to replace the deck
              </div>
            )}
          </div>
        )}

        {showPreview && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
            {revealDeck && (
              <div className="min-h-0 flex-1 p-4">
                <RevealView
                  deck={revealDeck}
                  index={current}
                  onIndexChange={setCurrentIndex}
                  className="rounded-md shadow-lg"
                />
              </div>
            )}
            {slidevDeck && (
              <div
                className="min-h-0 flex-1 cursor-pointer p-4"
                onDoubleClick={() => setPlayerStart(current)}
                title="Double click to present from this slide"
              >
                <SlideView slide={slidevDeck.slides[current]!} dark={dark} />
              </div>
            )}
            {slidevDeck && (
              <div
                ref={thumbnailsRef}
                className="flex shrink-0 gap-2 overflow-x-auto border-t px-4 py-3"
              >
                {slidevDeck.slides.map((item) => (
                  <button
                    key={item.index}
                    type="button"
                    data-slide-index={item.index}
                    onClick={() => selectSlide(item.index)}
                    className={cn(
                      'relative h-[72px] w-32 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-background',
                      item.index === current
                        ? 'border-primary'
                        : 'border-transparent hover:border-border'
                    )}
                  >
                    <SlideView
                      slide={item}
                      dark={dark}
                      className="pointer-events-none"
                    />
                    <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {item.index + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {playerStart !== null && revealDeck && (
        <RevealPlayer
          deck={revealDeck}
          startIndex={playerStart}
          onClose={(index) => {
            setPlayerStart(null);
            setCurrentIndex(index);
          }}
        />
      )}
      {playerStart !== null && slidevDeck && (
        <PresentationPlayer
          deck={slidevDeck}
          dark={dark}
          startIndex={playerStart}
          onClose={(index) => {
            setPlayerStart(null);
            setCurrentIndex(index);
          }}
        />
      )}
    </div>
  );
};

interface LayoutButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

const LayoutButton = ({
  active,
  onClick,
  title,
  children,
}: LayoutButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      'rounded-sm p-1 text-muted-foreground hover:text-foreground',
      active && 'bg-accent text-foreground'
    )}
  >
    {children}
  </button>
);
